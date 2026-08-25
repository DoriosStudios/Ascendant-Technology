import { system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { getLiveEquipmentItem, persistEquipmentItem } from "../core/equipment.js";
import { getStatsCoreDefinition } from "../core/registry.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showAbilityFeedback, showCombatFeedback, showLevelUp } from "../feedback/index.js";
import {
    applyCombatEffects,
    applyBlessingCurse,
    applyPreparedBlessing,
    getMarkedDamageBonus,
    isProcDamageTarget,
    prepareBlessingForHit,
} from "./effects.js";
import { rollStatsCrit, rememberCombatContact } from "./crit.js";
import { applyArmorPenetration } from "./penetration.js";
import { applyLifeSteal } from "./lifesteal.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { getEntityHurtAttacker, getEntityHurtTarget } from "../shared/damage.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { applyEffectById } from "../shared/effects.js";
import { OFFENSIVE_ENTITY_CATEGORIES, getEntityCategory } from "../shared/entityCategories.js";
import { getStatsCoreEffect, getStatsCoreEffects, upsertStatsCoreEffect } from "../effects/index.js";

const pendingCombatFollowUps = new Map();
const blessingCurseCooldowns = new Map();
const preparedBlessings = new WeakMap();
let useImmediateAfterHurtFollowUp = false;
let pendingFollowUpCleanupScheduled = false;
let blessingGateInitialized = false;

function getCombatFollowUpKey(attacker, target) {
    return `${String(target?.id ?? "target")}:${String(attacker?.id ?? "attacker")}`;
}

function enqueueCombatFollowUp(followUp) {
    const key = getCombatFollowUpKey(followUp.attacker, followUp.target);
    const queue = pendingCombatFollowUps.get(key) ?? [];
    queue.push(followUp);
    pendingCombatFollowUps.set(key, queue);

    if (!pendingFollowUpCleanupScheduled) {
        pendingFollowUpCleanupScheduled = true;
        system.runTimeout(() => {
            pendingFollowUpCleanupScheduled = false;
            const currentTick = Number(system.currentTick ?? 0) || 0;
            for (const [pendingKey, pendingQueue] of pendingCombatFollowUps) {
                const active = pendingQueue.filter(entry => Number(entry?.expiresAt ?? 0) >= currentTick);
                if (active.length > 0) pendingCombatFollowUps.set(pendingKey, active);
                else pendingCombatFollowUps.delete(pendingKey);
            }
        }, 2);
    }
}

function takeCombatFollowUp(event) {
    const target = getEntityHurtTarget(event);
    const attacker = getEntityHurtAttacker(event);
    if (!target || !attacker) return null;

    const key = getCombatFollowUpKey(attacker, target);
    const queue = pendingCombatFollowUps.get(key);
    if (!queue?.length) return null;

    const currentTick = Number(system.currentTick ?? 0) || 0;
    while (queue.length > 0 && Number(queue[0]?.expiresAt ?? 0) < currentTick) {
        queue.shift();
    }

    const followUp = queue.shift() ?? null;
    if (queue.length > 0) pendingCombatFollowUps.set(key, queue);
    else pendingCombatFollowUps.delete(key);
    return followUp;
}

function canUseDefinitionForCombat(definition, attributes = undefined) {
    if (!definition || definition.enabled === false) return false;
    if (definition.type === ITEM_TYPES.support) return false;
    if (attributes?.refinement?.active !== true) return false;
    return getProgressAmount(definition, "combat", 0) > 0
        || (attributes?.flatDamageBonus ?? 0) > 0
        || (attributes?.crit?.chance ?? 0) > 0
        || (attributes?.penetration?.percent ?? 0) > 0
        || (Array.isArray(attributes?.elemental) && attributes.elemental.length > 0)
        || (Array.isArray(attributes?.effects) && attributes.effects.length > 0);
}

function getBerserkDamageBonus(attacker, effect) {
    if (!attacker || !effect) return 0;

    const state = getStatsCoreEffect(attacker, "berserk");
    if (!state) return 0;

    const perStack = Math.max(0, Number(effect.damagePerStack ?? 1) || 1);
    return Math.max(0, Number(state.level ?? 0) || 0) * perStack;
}

function addBerserkStack(attacker, effect) {
    if (!attacker || !effect) return 0;

    const durationTicks = Math.max(20, Math.floor(Number(effect.durationTicks ?? 300) || 300));
    const maxStacks = Math.min(5, Math.max(1, Math.floor(Number(effect.maxStacks ?? 5) || 5)));
    const currentStacks = Number(getStatsCoreEffect(attacker, "berserk")?.level ?? 0) || 0;
    const nextStacks = Math.min(maxStacks, currentStacks + 1);

    upsertStatsCoreEffect(attacker, {
        id: "berserk",
        level: nextStacks,
        durationTicks,
    });
    applyEffectById(attacker, "strength", durationTicks, nextStacks - 1, false);

    showAbilityFeedback(attacker, `\u00A7cBerserk x${nextStacks}`);

    return nextStacks;
}

function persistCombatProgress(attacker, expectedTypeId, amount, reason, levelFeedback, knownDefinition) {
    const access = getLiveEquipmentItem(attacker, expectedTypeId, STATSCORE.slots.mainhand);
    const stack = access.item;
    if (!stack) return;

    const definition = knownDefinition ?? getStatsCoreDefinition(stack);
    if (!definition) return;

    const progress = grantStatsProgress(stack, definition, amount, reason);
    if (progress.changed) persistEquipmentItem(attacker, STATSCORE.slots.mainhand, stack);

    if (levelFeedback !== false) {
        showLevelUp(attacker, stack, progress);
    }
}

function processCombatFollowUp(followUp) {
    if (!followUp) return;

    const {
        attacker,
        target,
        attributes,
        definition,
        crit,
        finalDamage,
        damageSource,
        damagingProjectile,
        weaponTypeId,
        combatXp,
        penetration,
        baseDamage,
        markedDamageBonus,
        berserkDamageBonus,
        preAppliedElemental,
    } = followUp;
    let lifestealHealed = 0;
    let effects = { elemental: [], abilities: [] };
    try {
        lifestealHealed = applyLifeSteal(attacker, finalDamage, attributes, { crit: crit.active });
        effects = applyCombatEffects({
            attacker,
            target,
            attributes,
            crit,
            finalDamage,
            damageSource,
            damagingProjectile,
            preAppliedElemental,
        });
    } catch (error) {
        console.warn("[StatsCore] combat effects failed:", error);
    }

    try {
        persistCombatProgress(attacker, weaponTypeId, combatXp, "combat", true, definition);
    } catch (error) {
        console.warn("[StatsCore] combat progression failed:", error);
    }

    try {
        showCombatFeedback(attacker, target, {
            crit,
            penetration,
            damage: finalDamage,
            extraDamage: Math.max(0, finalDamage - baseDamage),
            elemental: effects.elemental,
            abilities: effects.abilities,
            lifestealHealed,
            markedDamageBonus,
            flatDamageBonus: attributes.flatDamageBonus,
            damageMultiplier: attributes.damageMultiplier,
            berserkDamageBonus,
        });
    } catch (error) {
        console.warn("[StatsCore] combat feedback failed:", error);
    }
}

function handleCombatAfterHurt(event) {
    try {
        processCombatFollowUp(takeCombatFollowUp(event));
    } catch (error) {
        console.warn("[StatsCore] combat after-hurt handler failed:", error);
    }
}

function handleBlessingGate(event) {
    try {
        if (event?.cancel === true) return;

        const target = getEntityHurtTarget(event);
        if (!target) return;

        const attacker = getEntityHurtAttacker(event);
        if (!attacker || target.id === attacker.id) return;

        const activeBlessing = getStatsCoreEffects(target).find((effect) =>
            effect.id === "blessed" && effect.polarity !== "debuff"
        );
        if (activeBlessing) {
            const curseKey = `${attacker.id}:${target.id}`;
            const now = Number(system.currentTick ?? 0);
            if (Number(blessingCurseCooldowns.get(curseKey) ?? 0) <= now) {
                blessingCurseCooldowns.set(curseKey, now + 10);
                system.runTimeout(() => blessingCurseCooldowns.delete(curseKey), 11);
                system.run(() => applyBlessingCurse(attacker));
            }
        }

        if (isProcDamageTarget(target)) return;

        const context = getEquipmentStatsContext(attacker, STATSCORE.slots.mainhand);
        if (!context) return;

        const { stack: weapon, definition, attributes } = context;
        if (!canUseDefinitionForCombat(definition, attributes)) return;

        const baseDamage = Number(event.damage ?? 0);
        if (!Number.isFinite(baseDamage) || baseDamage <= 0) return;

        const prepared = prepareBlessingForHit({
            attacker,
            target,
            attributes,
            weaponTypeId: weapon.typeId,
            definition,
        });
        if (!prepared) return;

        preparedBlessings.set(event, prepared);
        if (prepared.curseAttacker === true && !activeBlessing) {
            system.run(() => applyBlessingCurse(attacker));
        } else if (prepared.curseAttacker !== true) {
            system.run(() => applyPreparedBlessing({ attacker, target, prepared }));
        }

        if (prepared.cancelDamage) {
            event.damage = 0;
            event.cancel = true;
            rememberCombatContact(attacker, target);
        }
    } catch (error) {
        console.warn("[StatsCore] blessing gate failed:", error);
    }
}

function handleCombatHurt(event) {
    try {
        if (event?.cancel === true) return;

        const target = getEntityHurtTarget(event);
        if (!target || isProcDamageTarget(target)) return;

        const attacker = getEntityHurtAttacker(event);
        if (!attacker || target.id === attacker.id) return;

        const context = getEquipmentStatsContext(attacker, STATSCORE.slots.mainhand);
        if (!context) return;

        const { stack: weapon, definition, attributes } = context;
        if (!canUseDefinitionForCombat(definition, attributes)) return;

        const baseDamage = Number(event.damage ?? 0);
        if (!Number.isFinite(baseDamage) || baseDamage <= 0) return;

        const preparedBlessing = preparedBlessings.get(event) ?? null;
        preparedBlessings.delete(event);

        const berserkEffect = findEffectByKind(attributes?.effects, "berserk");
        const markedDamageBonus = getMarkedDamageBonus(target, attributes);
        const crit = rollStatsCrit({ attacker, target, attributes });
        const penetration = applyArmorPenetration({ damage: baseDamage, target, event, attributes });
        const berserkDamageBonus = getBerserkDamageBonus(attacker, berserkEffect);

        let nextDamage = penetration.damage
            + Math.max(0, Number(attributes.flatDamageBonus ?? 0) || 0)
            + berserkDamageBonus;
        nextDamage *= Math.max(0, Number(attributes.damageMultiplier ?? 1) || 1);

        if (markedDamageBonus > 0) {
            nextDamage *= 1 + markedDamageBonus;
        }

        if (crit.active) {
            nextDamage *= Math.max(1, Number(crit.multiplier) || 1);
        }

        const damageCap = Math.max(baseDamage, penetration.damage) * Number(definition?.limits?.maxDamageMultiplier ?? 3.25);
        event.damage = Math.max(0, Math.min(damageCap, nextDamage));

        rememberCombatContact(attacker, target);

        const finalDamage = event.damage;
        const weaponTypeId = weapon.typeId;
        const combatXp = getProgressAmount(definition, "combat", 1);
        const damageSource = event?.damageSource;
        const damagingProjectile = damageSource?.damagingProjectile;

        const followUp = {
            attacker,
            target,
            attributes,
            definition,
            crit,
            finalDamage,
            damageSource,
            damagingProjectile,
            weaponTypeId,
            combatXp,
            penetration,
            baseDamage,
            markedDamageBonus,
            berserkDamageBonus,
            preAppliedElemental: preparedBlessing
                ? [preparedBlessing.elementId ?? "light"]
                : [],
            expiresAt: (Number(system.currentTick ?? 0) || 0) + 1,
        };
        if (useImmediateAfterHurtFollowUp) enqueueCombatFollowUp(followUp);
        else system.run(() => processCombatFollowUp(followUp));
    } catch (error) {
        console.warn("[StatsCore] combat hurt handler failed:", error);
    }
}

function handleEntityDie(event) {
    try {
        const attacker = event?.damageSource?.damagingEntity ?? event?.damagingEntity;
        if (!attacker) return;

        const context = getEquipmentStatsContext(attacker, STATSCORE.slots.mainhand);
        if (!context) return;

        const { stack: weapon, definition, attributes } = context;
        if (!canUseDefinitionForCombat(definition, attributes)) return;

        const berserkEffect = findEffectByKind(attributes?.effects, "berserk");
        const hasWaterElement = (attributes?.elemental ?? []).some((element) =>
            String(element?.id ?? "").trim().toLowerCase() === "water"
        );
        if (
            hasWaterElement &&
            OFFENSIVE_ENTITY_CATEGORIES.includes(getEntityCategory(event?.deadEntity))
        ) {
            applyEffectById(attacker, "water_breathing", 200, 0, false);
        }
        const killXp = getProgressAmount(definition, "kill", 0);
        if (killXp <= 0 && !berserkEffect) return;

        if (berserkEffect) {
            addBerserkStack(attacker, berserkEffect);
        }

        if (killXp > 0) {
            persistCombatProgress(attacker, weapon.typeId, killXp, "kill", true, definition);
        }
    } catch (error) {
        console.warn("[StatsCore] kill handler failed:", error);
    }
}

/** Registers the Light/Blessing decision before all other StatsCore damage handlers. */
export function initializeBlessingGate() {
    if (blessingGateInitialized) return;
    blessingGateInitialized = true;

    if (world.beforeEvents?.entityHurt?.subscribe) {
        world.beforeEvents.entityHurt.subscribe(handleBlessingGate);
    } else {
        console.warn("[StatsCore] beforeEvents.entityHurt unavailable; Blessing gate disabled.");
    }
}

export function initializeCombatModule() {
    if (globalThis.__statsCoreCombatInitialized) return;
    globalThis.__statsCoreCombatInitialized = true;

    if (world.beforeEvents?.entityHurt?.subscribe) {
        world.beforeEvents.entityHurt.subscribe(handleCombatHurt);
    } else {
        console.warn("[StatsCore] beforeEvents.entityHurt unavailable; combat damage modules disabled.");
    }

    if (world.afterEvents?.entityHurt?.subscribe) {
        useImmediateAfterHurtFollowUp = true;
        world.afterEvents.entityHurt.subscribe(handleCombatAfterHurt);
    }

    if (world.afterEvents?.entityDie?.subscribe) {
        world.afterEvents.entityDie.subscribe(handleEntityDie);
    }
}

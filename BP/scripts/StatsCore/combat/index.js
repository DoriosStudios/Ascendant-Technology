import { system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { getEquipment, getLiveEquipmentItem, persistEquipmentItem } from "../core/equipment.js";
import { getStatsCoreDefinition } from "../core/registry.js";
import { readStatsState } from "../core/state.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showCombatFeedback, showLevelUp } from "../feedback/index.js";
import { applyCombatEffects, getMarkedDamageBonus, isProcDamageTarget } from "./effects.js";
import { rollStatsCrit, rememberCombatContact } from "./crit.js";
import { applyArmorPenetration } from "./penetration.js";
import { applyLifeSteal } from "./lifesteal.js";

const berserkStates = new Map();

function getAttackerFromHurtEvent(event) {
    const projectile = event?.damageSource?.damagingProjectile ?? event?.damagingProjectile ?? null;
    return event?.damageSource?.damagingEntity
        ?? projectile?.owner
        ?? projectile?.source
        ?? projectile?.damagingEntity
        ?? event?.damagingEntity
        ?? event?.source
        ?? event?.sourceEntity;
}

function getTargetFromHurtEvent(event) {
    return event?.hurtEntity ?? event?.entity;
}

function canUseDefinitionForCombat(definition) {
    if (!definition || definition.enabled === false) return false;
    if (definition.type === ITEM_TYPES.support) return false;
    return getProgressAmount(definition, "combat", 0) > 0
        || (definition?.attributes?.crit?.chance ?? 0) > 0
        || (definition?.attributes?.penetration?.percent ?? 0) > 0;
}

function getCombatEffect(attributes, kind) {
    const effects = Array.isArray(attributes?.effects) ? attributes.effects : [];
    return effects.find(effect => String(effect?.kind ?? "").toLowerCase() === String(kind ?? "").toLowerCase()) ?? null;
}

function getBerserkStateKey(entity) {
    return String(entity?.id ?? entity?.name ?? "berserk");
}

function cleanupBerserkStates() {
    const now = Number(system.currentTick ?? 0) || 0;
    for (const [key, value] of berserkStates.entries()) {
        if (Number(value?.expiresAt ?? 0) <= now) {
            berserkStates.delete(key);
        }
    }
}

function getBerserkDamageBonus(attacker, effect) {
    if (!attacker || !effect) return 0;

    cleanupBerserkStates();
    const state = berserkStates.get(getBerserkStateKey(attacker));
    if (!state) return 0;

    const perStack = Math.max(0, Number(effect.damagePerStack ?? 1) || 1);
    return Math.max(0, Number(state.stacks ?? 0) || 0) * perStack;
}

function addBerserkStack(attacker, effect) {
    if (!attacker || !effect) return 0;

    const now = Number(system.currentTick ?? 0) || 0;
    const key = getBerserkStateKey(attacker);
    const durationTicks = Math.max(20, Math.floor(Number(effect.durationTicks ?? 300) || 300));
    const maxStacks = Math.max(1, Math.floor(Number(effect.maxStacks ?? 10) || 10));
    const currentStacks = Number(berserkStates.get(key)?.stacks ?? 0) || 0;
    const nextStacks = Math.min(maxStacks, currentStacks + 1);

    berserkStates.set(key, {
        stacks: nextStacks,
        expiresAt: now + durationTicks,
    });

    try {
        attacker?.onScreenDisplay?.setActionBar?.(`§cBerserk x${nextStacks}`);
    } catch { }

    return nextStacks;
}

function persistCombatProgress(attacker, expectedTypeId, amount, reason, forcePersist, levelFeedback) {
    const access = getLiveEquipmentItem(attacker, expectedTypeId, STATSCORE.slots.mainhand);
    const stack = access.item;
    if (!stack) return;

    const definition = getStatsCoreDefinition(stack);
    if (!definition) return;

    const result = grantStatsProgress(stack, definition, amount, reason, { forcePersist });
    if (result.changed) {
        persistEquipmentItem(attacker, STATSCORE.slots.mainhand, stack);
    }

    if (levelFeedback !== false) {
        showLevelUp(attacker, stack, result);
    }
}

function handleCombatHurt(event) {
    try {
        if (event?.cancel === true) return;

        const target = getTargetFromHurtEvent(event);
        if (!target || isProcDamageTarget(target)) return;

        const attacker = getAttackerFromHurtEvent(event);
        if (!attacker || target.id === attacker.id) return;

        const { item: weapon } = getEquipment(attacker, STATSCORE.slots.mainhand);
        if (!weapon) return;

        const definition = getStatsCoreDefinition(weapon);
        if (!canUseDefinitionForCombat(definition)) return;

        const baseDamage = Number(event.damage ?? 0);
        if (!Number.isFinite(baseDamage) || baseDamage <= 0) return;

        const state = readStatsState(weapon, definition);
        const attributes = resolveStatsAttributes(definition, state);
        const berserkEffect = getCombatEffect(attributes, "berserk");
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

        system.run(() => {
            applyLifeSteal(attacker, finalDamage, attributes, { crit: crit.active });
            applyCombatEffects({ attacker, target, attributes, crit, finalDamage });
            persistCombatProgress(attacker, weaponTypeId, combatXp, "combat", crit.active === true, true);
            showCombatFeedback(attacker, target, { crit, penetration, damage: finalDamage });
        });
    } catch (error) {
        console.warn("[StatsCore] combat hurt handler failed:", error);
    }
}

function handleEntityDie(event) {
    try {
        const attacker = event?.damageSource?.damagingEntity ?? event?.damagingEntity;
        if (!attacker) return;

        const { item: weapon } = getEquipment(attacker, STATSCORE.slots.mainhand);
        if (!weapon) return;

        const definition = getStatsCoreDefinition(weapon);
        if (!canUseDefinitionForCombat(definition)) return;

        const state = readStatsState(weapon, definition);
        const attributes = resolveStatsAttributes(definition, state);
        const berserkEffect = getCombatEffect(attributes, "berserk");
        const killXp = getProgressAmount(definition, "kill", 0);
        if (killXp <= 0 && !berserkEffect) return;

        system.run(() => {
            if (berserkEffect) {
                addBerserkStack(attacker, berserkEffect);
            }

            if (killXp > 0) {
                persistCombatProgress(attacker, weapon.typeId, killXp, "kill", true, true);
            }
        });
    } catch (error) {
        console.warn("[StatsCore] kill handler failed:", error);
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

    if (world.afterEvents?.entityDie?.subscribe) {
        world.afterEvents.entityDie.subscribe(handleEntityDie);
    }
}

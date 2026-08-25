import { system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { getEquipment, persistEquipmentItem } from "../core/equipment.js";
import { getReinforcementMaximum, getReinforcementPoints } from "../../enchanting/reinforcement.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showAbilityFeedback, showLevelUp } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { getCurrentTick, rollChance } from "../utils.js";
import { getEquipmentStatsContext, getHeldStatsContext } from "../shared/context.js";
import { getEntityHurtAttacker, getEntityHurtTarget, getEventDamageType, isStatsCoreOverrideDamage, matchesDamageType, normalizeDamageType, uniqueDamageTypes } from "../shared/damage.js";
import { repairItemDurability } from "../shared/durability.js";
import { filterEffectsByKind } from "../shared/effectSelectors.js";
import { applyEffectById } from "../shared/effects.js";
import { OFFENSIVE_ENTITY_CATEGORIES, effectAppliesToEntity } from "../shared/entityCategories.js";
import { getArmorComponentDefinition, resolveArmorComponentMitigation } from "./armorComponent.js";

const MAX_TOTAL_DAMAGE_REDUCTION = 0.9;
const PRESERVING_DAMAGE_TYPES = new Set([
    "entity_attack",
    "projectile",
    "block_explosion",
    "entity_explosion",
    "thorns",
    "ram_attack",
]);
const supportEffectCooldowns = new Map();

function combineNegationChances(chances) {
    if (!Array.isArray(chances) || chances.length <= 0) return 0;

    let remainingDamageChance = 1;
    for (const chance of chances) {
        const value = Math.min(1, Math.max(0, Number(chance) || 0));
        remainingDamageChance *= (1 - value);
    }

    return 1 - remainingDamageChance;
}

function getEffectKey(effect) {
    return String(effect?.key ?? effect?.label ?? effect?.kind ?? effect?.id ?? "effect");
}

function getCooldownKey(target, effect) {
    return `${String(target?.id ?? target?.name ?? "unknown")}:${getEffectKey(effect)}`;
}

function cleanupSupportCooldowns() {
    const now = getCurrentTick();
    for (const [key, value] of supportEffectCooldowns.entries()) {
        if (Number(value?.expiresAt ?? 0) <= now) {
            supportEffectCooldowns.delete(key);
        }
    }
}

function isSupportEffectOnCooldown(target, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!target || cooldownTicks <= 0) return false;

    const key = getCooldownKey(target, effect);
    const entry = supportEffectCooldowns.get(key);
    const now = getCurrentTick();
    if (Number(entry?.expiresAt ?? 0) > now) return true;
    if (entry) supportEffectCooldowns.delete(key);
    return false;
}

function setSupportEffectCooldown(target, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!target || cooldownTicks <= 0) return;

    supportEffectCooldowns.set(getCooldownKey(target, effect), {
        expiresAt: getCurrentTick() + cooldownTicks,
    });
    if (supportEffectCooldowns.size > STATSCORE.runtime.markCleanupSize) cleanupSupportCooldowns();
}

function getArmorSupportEntries(target) {
    const entries = [];

    for (const slotName of STATSCORE.slots.armor) {
        const access = getEquipment(target, slotName);
        const item = access?.item;
        if (!item) continue;

        const context = getEquipmentStatsContext(target, slotName);
        const statsActive = context?.definition?.type === ITEM_TYPES.support
            && context.attributes?.refinement?.active === true;
        const componentDefinition = getArmorComponentDefinition(item);
        if (!statsActive && !componentDefinition) continue;

        entries.push({
            slotName,
            item: context?.stack ?? item,
            definition: context?.definition ?? null,
            attributes: statsActive ? context.attributes : null,
            statsActive,
            componentDefinition,
        });
    }

    const offhandAccess = getEquipment(target, STATSCORE.slots.offhand);
    const offhandItem = offhandAccess?.item;
    if (offhandItem) {
        const offhandContext = getEquipmentStatsContext(target, STATSCORE.slots.offhand);
        const statsActive = offhandContext?.definition?.type === ITEM_TYPES.support
            && offhandContext.attributes?.refinement?.active === true;
        const componentDefinition = getArmorComponentDefinition(offhandItem);
        if (statsActive || componentDefinition) {
            entries.push({
                slotName: STATSCORE.slots.offhand,
                item: offhandContext?.stack ?? offhandItem,
                definition: offhandContext?.definition ?? null,
                attributes: statsActive ? offhandContext.attributes : null,
                statsActive,
                componentDefinition,
            });
        }
    }

    return entries;
}

function resolveEntryMitigation(entry, damageType) {
    const component = resolveArmorComponentMitigation(entry?.item, damageType);
    const support = entry?.statsActive ? entry.attributes?.support ?? {} : {};
    return {
        damageReduction: Math.max(0, Number(component?.damageReduction ?? 0) || 0)
            + Math.max(0, Number(support.damageReduction ?? 0) || 0),
        negationChances: [
            Number(component?.damageNegation ?? 0),
            Number(support.negateAllDamageChance ?? 0),
        ].filter(value => Number.isFinite(value) && value > 0),
    };
}

function getTotalDamageReduction(entries, damageType = "all") {
    if (!Array.isArray(entries) || entries.length <= 0) return 0;

    const reduction = entries.reduce((sum, entry) => {
        const isOffhandShield = entry.slotName === STATSCORE.slots.offhand
            && String(entry.definition?.branch ?? "").toLowerCase() === "shield";
        const resolved = resolveEntryMitigation(entry, damageType);
        const value = isOffhandShield && entry.statsActive
            ? Math.max(0.6, resolved.damageReduction)
            : resolved.damageReduction;
        return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
    return Math.min(MAX_TOTAL_DAMAGE_REDUCTION, reduction);
}

function getArmorMitigationProfile(entries, damageType) {
    const normalizedDamageType = normalizeDamageType(damageType);
    const reductionValues = [];
    const negationValues = [];
    let reinforcement = 0;
    let reinforcementMaximum = 0;

    for (const entry of entries ?? []) {
        const resolved = resolveEntryMitigation(entry, normalizedDamageType);
        if (resolved.damageReduction > 0) reductionValues.push(resolved.damageReduction);
        negationValues.push(...resolved.negationChances);
        reinforcement += getReinforcementPoints(entry.item);
        reinforcementMaximum += getReinforcementMaximum(entry.item);
    }

    return {
        damageType: normalizedDamageType,
        pieceCount: entries?.length ?? 0,
        reductionValues,
        negationValues,
        totalReduction: getTotalDamageReduction(entries, normalizedDamageType),
        totalNegation: combineNegationChances(negationValues),
        reinforcement,
        reinforcementMaximum,
    };
}

/**
 * Resolves the StatsCore mitigation currently equipped by a player.
 * Combat penetration uses this same profile so the retired DoriosCore armor
 * component cannot reduce the same hit a second time.
 */
export function getPlayerArmorMitigationProfile(target, damageType = "all") {
    const entries = getArmorSupportEntries(target);
    return getArmorMitigationProfile(entries, damageType);
}

function getSupportEffects(entries, kind) {
    const results = [];

    for (const entry of entries) {
        for (const effect of filterEffectsByKind(entry.attributes?.support?.effects, kind)) {
            results.push({ entry, effect });
        }
    }

    return results;
}

function applyKnockbackAway(attacker, target, effect) {
    if (!attacker?.applyKnockback || !attacker?.location || !target?.location) return false;

    const dx = Number(attacker.location.x ?? 0) - Number(target.location.x ?? 0);
    const dz = Number(attacker.location.z ?? 0) - Number(target.location.z ?? 0);
    const distance = Math.max(0.001, Math.hypot(dx, dz));
    const horizontal = Math.max(0.4, Number(effect?.knockbackHorizontal ?? 1.35) || 1.35);
    const vertical = Math.max(0.15, Number(effect?.knockbackVertical ?? 0.42) || 0.42);

    try {
        attacker.applyKnockback(dx / distance, dz / distance, horizontal, vertical);
        return true;
    } catch {
        return false;
    }
}

function pullNearbyTargets(target, attacker, effect) {
    if (!target?.dimension || !target?.location || !attacker?.location) return false;

    const radius = Math.max(0.5, Number(effect?.gatherRadius ?? 1.5) || 1.5);
    const strength = Math.max(0.1, Number(effect?.gatherStrength ?? 1.1) || 1.1);
    let moved = false;

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === target.id || entity.id === attacker.id) continue;
        if (!effectAppliesToEntity(effect, entity, OFFENSIVE_ENTITY_CATEGORIES)) continue;
        if (!entity.applyImpulse) continue;

        const dx = Number(attacker.location.x ?? 0) - Number(entity.location?.x ?? 0);
        const dy = Number(attacker.location.y ?? 0) - Number(entity.location?.y ?? 0);
        const dz = Number(attacker.location.z ?? 0) - Number(entity.location?.z ?? 0);
        const distance = Math.max(0.001, Math.hypot(dx, dz));

        try {
            entity.applyImpulse({
                x: (dx / distance) * strength,
                y: Math.max(-0.15, Math.min(0.35, dy * 0.05)),
                z: (dz / distance) * strength,
            });
            moved = true;
        } catch { }
    }

    return moved;
}

function applySupportEffects(event, entries) {
    if (!entries.length) return;

    const target = getEntityHurtTarget(event);
    const attacker = getEntityHurtAttacker(event);
    const damage = Math.max(0, Number(event?.damage ?? 0) || 0);
    if (!target || !attacker || damage <= 0) return;

    for (const { effect } of getSupportEffects(entries, "retaliate")) {
        if (String(effect.on ?? "hurt").toLowerCase() !== "hurt") continue;
        if (!effectAppliesToEntity(effect, attacker, OFFENSIVE_ENTITY_CATEGORIES)) continue;
        if (isSupportEffectOnCooldown(target, effect)) continue;
        if (!rollChance(effect.chance, 0)) continue;

        const reflectedDamage = Math.max(1, damage * Math.max(0.05, Number(effect.damageRatio ?? 0.15) || 0.15));
        try {
            attacker.applyDamage?.(reflectedDamage, {
                cause: "thorns",
                damagingEntity: target,
            });
            setSupportEffectCooldown(target, effect);
        } catch { }
    }

}

function applyArmorMitigation(event, entries) {
    if (!entries.length) return;

    const damage = Number(event?.damage ?? 0);
    if (!Number.isFinite(damage) || damage <= 0) return;

    const profile = getArmorMitigationProfile(entries, getEventDamageType(event));
    if (rollChance(profile.totalNegation, 0)) {
        event.damage = 0;
        event.cancel = true;
        return;
    }

    const mitigatedDamage = profile.totalReduction > 0 ? damage * (1 - profile.totalReduction) : damage;
    event.damage = Math.max(0, mitigatedDamage);
}

function applyCustomSupportAbilities(event, entries) {
    const target = getEntityHurtTarget(event);
    if (!target) return;

    const damageType = getEventDamageType(event);
    let nextDamage = Math.max(0, Number(event?.damage ?? 0) || 0);
    let fullyNegated = false;
    let suppressKnockback = false;
    if (nextDamage <= 0) return;

    for (const { effect } of getSupportEffects(entries, "featherstep")) {
        if (damageType !== "fall") continue;

        const multiplier = Math.max(0, Math.min(1, Number(effect.fallDamageMultiplier ?? 0.2) || 0.2));
        nextDamage *= multiplier;

        if (!isSupportEffectOnCooldown(target, effect)) {
            setSupportEffectCooldown(target, effect);
            system.run(() => {
                applyEffectById(
                    target,
                    "absorption",
                    Math.max(20, Math.floor(Number(effect.absorptionDurationTicks ?? 100) || 100)),
                    Math.max(0, Math.floor(Number(effect.absorptionAmplifier ?? 0) || 0)),
                    false
                );
            });
        }
    }

    for (const { effect } of getSupportEffects(entries, "tough")) {
        const supportedTypes = uniqueDamageTypes(effect.reducedDamageTypes);
        if (!matchesDamageType(supportedTypes, damageType)) continue;

        const reduction = Math.max(0, Math.min(0.95, Number(effect.damageReduction ?? 0.5) || 0.5));
        nextDamage *= (1 - reduction);
    }

    for (const { effect } of getSupportEffects(entries, "armored")) {
        const negatedTypes = uniqueDamageTypes(effect.negatedDamageTypes ?? ["projectile"]);
        if (matchesDamageType(negatedTypes, damageType)) {
            nextDamage = 0;
            fullyNegated = true;
            break;
        }

        const reducedTypes = uniqueDamageTypes(effect.reducedDamageTypes ?? ["block_explosion", "entity_explosion"]);
        if (!matchesDamageType(reducedTypes, damageType)) continue;

        const reduction = Math.max(0, Math.min(0.95, Number(effect.damageReduction ?? 0.5) || 0.5));
        nextDamage *= (1 - reduction);
        suppressKnockback = true;
    }

    event.damage = Math.max(0, nextDamage);
    if (fullyNegated) event.cancel = true;
    else if (suppressKnockback) {
        // Partial Armored mitigation keeps its reduced damage but removes the
        // explosion impulse that Bedrock applies after the before-event.
        system.run(() => {
            try {
                target.clearVelocity?.();
            } catch { }
        });
    }
}

function isPlayerInWater(player) {
    return player?.isInWater === true || player?.isSwimming === true || player?.isUnderwater === true;
}

function refreshPassiveSupportEffects() {
    for (const player of world.getPlayers?.() ?? []) {
        if (!player || player.typeId !== "minecraft:player") continue;

        const entries = getArmorSupportEntries(player);
        if (!entries.length) continue;

        const overworld = normalizeDamageType(player.dimension?.id ?? "") === "minecraft_overworld";
        const belowClarityDepth = Number(player.location?.y ?? 999) < 48;

        if (overworld && belowClarityDepth) {
            for (const { effect } of getSupportEffects(entries, "clarity")) {
                applyEffectById(player, "night_vision", Math.max(80, Math.floor(Number(effect.durationTicks ?? 250) || 250)), 0, false);
            }
        }

        if (isPlayerInWater(player)) {
            for (const { effect } of getSupportEffects(entries, "tough")) {
                applyEffectById(player, "conduit_power", Math.max(80, Math.floor(Number(effect.conduitDurationTicks ?? 600) || 600)), 0, false);
            }
        }
    }
}

function isEnemyDamageForPreserving(event, target) {
    if (!target || Number(event?.damage ?? 0) <= 0) return false;
    const damageType = getEventDamageType(event);
    if (!PRESERVING_DAMAGE_TYPES.has(damageType)) return false;

    const attacker = getEntityHurtAttacker(event);
    if (attacker) return attacker.id !== target.id;
    // Bedrock does not consistently expose an owner for explosions. The cause
    // itself is sufficiently specific to retain hostile Creeper/TNT damage.
    return damageType === "block_explosion" || damageType === "entity_explosion";
}

function processHeldPreserving(target) {
    const context = getHeldStatsContext(target);
    const chance = Math.max(0, Number(context?.attributes?.mining?.durabilitySaveChance ?? 0) || 0);
    if (!context || chance <= 0 || (chance < 1 && Math.random() > chance)) return false;

    const repaired = repairItemDurability(
        context.stack,
        context.attributes?.mining?.preservationRepairAmount ?? 1,
    );
    if (!repaired) return false;

    persistEquipmentItem(target, STATSCORE.slots.mainhand, context.stack);
    showAbilityFeedback(target, "§aTool Preserving", STATSCORE_ICONS.preservingTool);
    return true;
}

function processArmorProgress(target, allowPreserving = false) {
    if (!target || target.typeId !== "minecraft:player") return;

    const entries = getArmorSupportEntries(target);

    for (const entry of entries) {
        if (!entry.statsActive) continue;
        const { slotName, item, definition, attributes } = entry;

        const amount = getProgressAmount(definition, "armor", 1);
        if (amount <= 0) continue;

        const result = grantStatsProgress(item, definition, amount, "armor", { forcePersist: false });
        const preservationChance = allowPreserving
            ? Math.max(0, Number(attributes?.support?.durabilityPreserveChance ?? 0) || 0)
            : 0;
        const repaired = preservationChance > 0 && (preservationChance >= 1 || Math.random() <= preservationChance)
            ? repairItemDurability(item, attributes?.support?.preservationRepairAmount ?? 2)
            : false;

        if (result.changed || repaired) {
            persistEquipmentItem(target, slotName, item);
        }
        if (repaired) {
            showAbilityFeedback(target, "\u00A7aArmor Preserving", STATSCORE_ICONS.preservingArmor);
        }
        showLevelUp(target, item, result);
    }
}

export function initializeArmorSupportModule() {
    if (globalThis.__statsCoreArmorSupportInitialized) return;
    globalThis.__statsCoreArmorSupportInitialized = true;

    system.runInterval(refreshPassiveSupportEffects, 40);

    if (world.beforeEvents?.entityHurt?.subscribe) {
        world.beforeEvents.entityHurt.subscribe(event => {
            if (event?.cancel === true) return;
            if (isStatsCoreOverrideDamage(event)) return;

            const target = getEntityHurtTarget(event);
            if (!target || target.typeId !== "minecraft:player") return;

            const entries = getArmorSupportEntries(target);
            const allowPreserving = isEnemyDamageForPreserving(event, target);
            applyArmorMitigation(event, entries);
            if (event.cancel === true) return;
            applyCustomSupportAbilities(event, entries);
            if (event.cancel === true) return;
            system.run(() => {
                if (event.cancel !== true) applySupportEffects(event, entries);
                processArmorProgress(target, allowPreserving);
                if (allowPreserving) processHeldPreserving(target);
            });
        });
        return;
    }

    const hurtEvents = world.afterEvents?.entityHurt;
    if (!hurtEvents?.subscribe) return;

    hurtEvents.subscribe(event => {
        if (event?.cancel === true) return;

        const target = getEntityHurtTarget(event);
        if (!target || target.typeId !== "minecraft:player") return;

        const allowPreserving = isEnemyDamageForPreserving(event, target);
        system.run(() => {
            processArmorProgress(target, allowPreserving);
            if (allowPreserving) processHeldPreserving(target);
        });
    });
}

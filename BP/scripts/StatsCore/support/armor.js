import { system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { persistEquipmentItem } from "../core/equipment.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showLevelUp } from "../feedback/index.js";
import { getCurrentTick, rollChance } from "../utils.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { getEntityHurtAttacker, getEntityHurtTarget, getEventDamageType, matchesDamageType, normalizeDamageType, uniqueDamageTypes } from "../shared/damage.js";
import { repairItemDurability } from "../shared/durability.js";
import { filterEffectsByKind } from "../shared/effectSelectors.js";
import { applyEffectById } from "../shared/effects.js";

const MAX_TOTAL_DAMAGE_REDUCTION = 1.0;
const MAX_TOTAL_VULNERABILITY = 0.65;
const supportEffectCooldowns = new Map();

function combineNegationChances(chances) {
    if (!Array.isArray(chances) || chances.length <= 0) return 0;

    let remainingDamageChance = 1;
    for (const chance of chances) {
        const value = Math.min(0.9999, Math.max(0, Number(chance) || 0));
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

    cleanupSupportCooldowns();
    const entry = supportEffectCooldowns.get(getCooldownKey(target, effect));
    return Number(entry?.expiresAt ?? 0) > getCurrentTick();
}

function setSupportEffectCooldown(target, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!target || cooldownTicks <= 0) return;

    supportEffectCooldowns.set(getCooldownKey(target, effect), {
        expiresAt: getCurrentTick() + cooldownTicks,
    });
}

function getArmorSupportEntries(target) {
    const entries = [];

    for (const slotName of STATSCORE.slots.armor) {
        const context = getEquipmentStatsContext(target, slotName);
        if (!context || context.definition.type !== ITEM_TYPES.support) continue;

        entries.push({
            slotName,
            item: context.stack,
            definition: context.definition,
            attributes: context.attributes,
        });
    }

    const offhandContext = getEquipmentStatsContext(target, STATSCORE.slots.offhand);
    if (offhandContext?.definition?.type === ITEM_TYPES.support) {
            entries.push({
                slotName: STATSCORE.slots.offhand,
                item: offhandContext.stack,
                definition: offhandContext.definition,
                attributes: offhandContext.attributes,
            });
    }

    return entries;
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

function isMonsterEntity(entity) {
    try {
        return entity?.matches?.({ families: ["monster"] }) === true;
    } catch {
        return false;
    }
}

function pullNearbyMonsters(target, attacker, effect) {
    if (!target?.dimension || !target?.location || !attacker?.location) return false;

    const radius = Math.max(0.5, Number(effect?.gatherRadius ?? 1.5) || 1.5);
    const strength = Math.max(0.1, Number(effect?.gatherStrength ?? 1.1) || 1.1);
    let moved = false;

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === target.id || entity.id === attacker.id) continue;
        if (!isMonsterEntity(entity)) continue;
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

    for (const { effect } of getSupportEffects(entries, "spikes")) {
        const reflectedDamage = Math.max(1, damage * Math.max(0.08, Number(effect.damageRatio ?? 0.18) || 0.18));
        try {
            attacker.applyDamage?.(reflectedDamage, {
                cause: "thorns",
                damagingEntity: target,
            });
        } catch { }

        applyKnockbackAway(attacker, target, effect);
        pullNearbyMonsters(target, attacker, effect);
    }
}

function applyArmorMitigation(event, entries) {
    if (!entries.length) return;

    const damage = Number(event?.damage ?? 0);
    if (!Number.isFinite(damage) || damage <= 0) return;

    const damageType = getEventDamageType(event);
    const immunityTypes = new Set();
    const vulnerabilityMatches = [];
    const negationChances = [];

    const totalReduction = Math.min(MAX_TOTAL_DAMAGE_REDUCTION, entries.reduce((sum, entry) => {
        return sum + Math.max(0, Number(entry.attributes?.support?.damageReduction ?? 0) || 0);
    }, 0));

    for (const entry of entries) {
        const support = entry.attributes?.support ?? {};

        for (const immunityType of uniqueDamageTypes(support.damageImmunities)) {
            immunityTypes.add(immunityType);
        }

        const negateAllDamageChance = Math.max(0, Number(support.negateAllDamageChance ?? 0) || 0);
        if (negateAllDamageChance > 0) {
            negationChances.push(negateAllDamageChance);
        }

        const vulnerabilityPenalty = Math.max(0, Number(support.vulnerabilityPenalty ?? 0) || 0);
        if (vulnerabilityPenalty <= 0) continue;

        for (const vulnerabilityType of uniqueDamageTypes(support.vulnerabilities)) {
            if (vulnerabilityType === "all" || vulnerabilityType === damageType) {
                vulnerabilityMatches.push(vulnerabilityPenalty);
            }
        }
    }

    if (matchesDamageType([...immunityTypes], damageType)) {
        event.damage = 0;
        return;
    }

    const totalNegationChance = combineNegationChances(negationChances);
    if (rollChance(totalNegationChance, 0)) {
        event.damage = 0;
        return;
    }

    const totalVulnerability = Math.min(MAX_TOTAL_VULNERABILITY, vulnerabilityMatches.reduce((sum, value) => sum + value, 0));
    const mitigatedDamage = totalReduction > 0 ? damage * (1 - totalReduction) : damage;
    const finalDamage = totalVulnerability > 0
        ? mitigatedDamage * (1 + totalVulnerability)
        : mitigatedDamage;

    event.damage = Math.max(0, finalDamage);
}

function applyCustomSupportAbilities(event, entries) {
    const target = getEntityHurtTarget(event);
    if (!target) return;

    const damageType = getEventDamageType(event);
    let nextDamage = Math.max(0, Number(event?.damage ?? 0) || 0);
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

    event.damage = Math.max(0, nextDamage);
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

function processArmorProgress(target) {
    if (!target || target.typeId !== "minecraft:player") return;

    const entries = getArmorSupportEntries(target);

    for (const entry of entries) {
        const { slotName, item, definition, attributes } = entry;

        const amount = getProgressAmount(definition, "armor", 1);
        if (amount <= 0) continue;

        const result = grantStatsProgress(item, definition, amount, "armor", { forcePersist: false });
        const repaired = rollChance(attributes?.support?.durabilityPreserveChance, 0)
            ? repairItemDurability(item)
            : false;

        if (result.changed || repaired) {
            persistEquipmentItem(target, slotName, item);
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

            const target = getEntityHurtTarget(event);
            if (!target || target.typeId !== "minecraft:player") return;

            const entries = getArmorSupportEntries(target);
            applyArmorMitigation(event, entries);
            applyCustomSupportAbilities(event, entries);
            system.run(() => applySupportEffects(event, entries));
            system.run(() => processArmorProgress(target));
        });
        return;
    }

    const hurtEvents = world.afterEvents?.entityHurt;
    if (!hurtEvents?.subscribe) return;

    hurtEvents.subscribe(event => {
        if (event?.cancel === true) return;

        const target = getEntityHurtTarget(event);
        if (!target || target.typeId !== "minecraft:player") return;

        system.run(() => processArmorProgress(target));
    });
}

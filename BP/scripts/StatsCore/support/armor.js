import { EffectTypes, system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { getEquipment, persistEquipmentItem } from "../core/equipment.js";
import { getStatsCoreDefinition } from "../core/registry.js";
import { readStatsState } from "../core/state.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showLevelUp } from "../feedback/index.js";
import { getCurrentTick, rollChance } from "../utils.js";

const DAMAGE_TYPE_ALIASES = Object.freeze({
    all: "all",
    anvil: "anvil",
    blockexplosion: "block_explosion",
    charging: "charging",
    contact: "contact",
    drowning: "drowning",
    entityattack: "entity_attack",
    entityexplosion: "entity_explosion",
    fall: "fall",
    fallingblock: "falling_block",
    fire: "fire",
    firetick: "fire_tick",
    flyintowall: "fly_into_wall",
    freezing: "freezing",
    lava: "lava",
    lightning: "lightning",
    magic: "magic",
    magma: "magma",
    none: "none",
    override: "override",
    piston: "piston",
    projectile: "projectile",
    ramattack: "ram_attack",
    sonicboom: "sonic_boom",
    stalactite: "stalactite",
    stalagmite: "stalagmite",
    starve: "starve",
    suffocation: "suffocation",
    suicide: "suicide",
    temperature: "temperature",
    thorns: "thorns",
    void: "void",
    wither: "wither"
});

const MAX_TOTAL_DAMAGE_REDUCTION = 0.45;
const MAX_TOTAL_VULNERABILITY = 0.6;
const supportEffectCooldowns = new Map();

function getHurtTarget(event) {
    return event?.hurtEntity ?? event?.entity;
}

function resolveEffectType(id) {
    if (!id) return undefined;
    const normalized = String(id).includes(":") ? String(id) : `minecraft:${id}`;
    return EffectTypes?.get?.(normalized) ?? EffectTypes?.get?.(id) ?? normalized;
}

function applyEffectById(target, id, duration, amplifier = 0, showParticles = false) {
    const effectType = resolveEffectType(id);
    if (!target || !effectType) return false;

    try {
        target.addEffect?.(effectType, duration, {
            amplifier,
            showParticles,
        });
        return true;
    } catch {
        return false;
    }
}

function repairOneDurability(stack) {
    try {
        const durability = stack?.getComponent?.("minecraft:durability") ?? stack?.getComponent?.("durability");
        if (!durability) return false;

        const currentDamage = Math.max(0, Math.floor(Number(durability.damage ?? 0) || 0));
        if (currentDamage <= 0) return false;

        durability.damage = currentDamage - 1;
        return true;
    } catch {
        return false;
    }
}

function normalizeDamageType(value) {
    try {
        const raw = String(value ?? "all").trim().toLowerCase();
        if (!raw) return "all";

        const aliasKey = raw.replace(/[^a-z0-9]/g, "");
        return DAMAGE_TYPE_ALIASES[aliasKey] ?? raw.replace(/[\s:-]+/g, "_");
    } catch {
        return "all";
    }
}

function getDamageType(event) {
    return normalizeDamageType(event?.damageSource?.cause ?? event?.cause ?? "all");
}

function uniqueDamageTypes(values) {
    if (!Array.isArray(values) || values.length <= 0) return [];

    const normalized = [];
    const seen = new Set();
    for (const value of values) {
        const next = normalizeDamageType(value);
        if (!next || seen.has(next)) continue;

        seen.add(next);
        normalized.push(next);
    }

    return normalized;
}

function combineNegationChances(chances) {
    if (!Array.isArray(chances) || chances.length <= 0) return 0;

    let remainingDamageChance = 1;
    for (const chance of chances) {
        const value = Math.min(0.9999, Math.max(0, Number(chance) || 0));
        remainingDamageChance *= (1 - value);
    }

    return 1 - remainingDamageChance;
}

function matchesDamageType(values, damageType) {
    const normalizedDamageType = normalizeDamageType(damageType);
    return values.includes("all") || values.includes(normalizedDamageType);
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
        const { item } = getEquipment(target, slotName);
        if (!item) continue;

        const definition = getStatsCoreDefinition(item);
        if (!definition || definition.type !== ITEM_TYPES.support) continue;

        const state = readStatsState(item, definition);
        const attributes = resolveStatsAttributes(definition, state);
        entries.push({ slotName, item, definition, attributes });
    }

    const { item: offhandItem } = getEquipment(target, STATSCORE.slots.offhand);
    if (offhandItem) {
        const definition = getStatsCoreDefinition(offhandItem);
        if (definition && definition.type === ITEM_TYPES.support) {
            const state = readStatsState(offhandItem, definition);
            const attributes = resolveStatsAttributes(definition, state);
            entries.push({
                slotName: STATSCORE.slots.offhand,
                item: offhandItem,
                definition,
                attributes,
            });
        }
    }

    return entries;
}

function getSupportEffects(entries, kind) {
    const normalizedKind = String(kind ?? "").toLowerCase();
    const results = [];

    for (const entry of entries) {
        const effects = Array.isArray(entry.attributes?.support?.effects) ? entry.attributes.support.effects : [];
        for (const effect of effects) {
            if (String(effect?.kind ?? "").toLowerCase() !== normalizedKind) continue;
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

    const target = getHurtTarget(event);
    const attacker = event?.damageSource?.damagingEntity ?? event?.damagingEntity ?? event?.source ?? null;
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

    const damageType = getDamageType(event);
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
    const target = getHurtTarget(event);
    if (!target) return;

    const damageType = getDamageType(event);
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
                applyEffectById(player, "night_vision", Math.max(80, Math.floor(Number(effect.durationTicks ?? 220) || 220)), 0, false);
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
            ? repairOneDurability(item)
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

            const target = getHurtTarget(event);
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

        const target = getHurtTarget(event);
        if (!target || target.typeId !== "minecraft:player") return;

        system.run(() => processArmorProgress(target));
    });
}

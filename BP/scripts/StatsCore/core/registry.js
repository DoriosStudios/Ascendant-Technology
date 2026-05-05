import { STATSCORE } from "../constants.js";
import { clonePlain, deepMerge, isPlainObject, normalizeId } from "../utils.js";

const itemDefinitions = new Map();

const BASE_DEFINITION = Object.freeze({
    enabled: true,
    type: "hybrid",
    tier: "common",
    rarity: "common",
    affinity: "hybrid",
    branch: "hybrid",
    maxLevel: STATSCORE.progression.maxLevel,
    persistEveryXp: STATSCORE.progression.persistEveryXp,
    progression: Object.freeze({
        baseXp: STATSCORE.progression.baseXp,
        growth: STATSCORE.progression.growth,
        combatXp: 2,
        killXp: 10,
        blockXp: 1,
        oreXp: 4,
        armorXp: 2
    }),
    attributes: Object.freeze({
        damagePerLevel: 0,
        crit: Object.freeze({
            chance: 0,
            chancePerLevel: 0,
            maxChance: 0.35,
            multiplier: 1,
            multiplierPerLevel: 0,
            maxMultiplier: 2,
            openingBonus: 0,
            precisionBonus: 0
        }),
        penetration: Object.freeze({
            percent: 0,
            perLevel: 0,
            cap: 0.35,
            bossScalar: 0.5
        }),
        lifesteal: Object.freeze({
            percent: 0,
            perLevel: 0,
            cap: 0.08,
            critBonus: 0
        }),
        effects: Object.freeze([]),
        markedDamageBonus: 0
    }),
    mining: Object.freeze({
        bonusDropChance: 0,
        bonusDropChancePerLevel: 0,
        oreBonusChance: 0,
        oreBonusChancePerLevel: 0,
        durabilitySaveChance: 0,
        durabilitySaveChancePerLevel: 0,
        effects: Object.freeze([]),
        maxBonusDropChance: 0.32,
        maxDurabilitySaveChance: 0.35
    }),
    support: Object.freeze({
        damageReduction: 0,
        damageReductionPerLevel: 0,
        maxDamageReduction: 0.16,
        durabilityPreserveChance: 0,
        durabilityPreserveChancePerLevel: 0,
        maxDurabilityPreserveChance: 0.26,
        negateAllDamageChance: 0,
        negateAllDamageChancePerLevel: 0,
        maxNegateAllDamageChance: 0.2,
        damageImmunities: Object.freeze([]),
        vulnerabilities: Object.freeze([]),
        vulnerabilityPenalty: 0,
        effects: Object.freeze([])
    }),
    feedback: Object.freeze({
        combat: true,
        mining: true,
        levelUp: true
    })
});

function normalizeDefinition(itemId, definition) {
    const normalizedItemId = normalizeId(itemId ?? definition?.id ?? definition?.itemId ?? definition?.typeId);
    if (!normalizedItemId || !isPlainObject(definition)) return null;

    const { id, itemId: ignoredItemId, typeId, ...rest } = definition;
    const merged = deepMerge(BASE_DEFINITION, rest);
    merged.id = normalizedItemId;
    merged.enabled = merged.enabled !== false;
    merged.maxLevel = Math.max(1, Math.floor(Number(merged.maxLevel) || STATSCORE.progression.maxLevel));
    merged.persistEveryXp = Math.max(1, Math.floor(Number(merged.persistEveryXp) || STATSCORE.progression.persistEveryXp));

    if (!Array.isArray(merged.attributes.effects)) {
        merged.attributes.effects = [];
    }

    if (!Array.isArray(merged.mining.effects)) {
        merged.mining.effects = [];
    }

    if (!Array.isArray(merged.support.effects)) {
        merged.support.effects = [];
    }

    return merged;
}

export function registerStatsCoreDefinition(itemId, definition) {
    const normalized = normalizeDefinition(itemId, definition);
    if (!normalized) return false;

    itemDefinitions.set(normalized.id, normalized);
    return true;
}

export function registerStatsCoreDefinitions(payload) {
    if (!payload) return 0;

    if (Array.isArray(payload)) {
        let count = 0;
        for (const entry of payload) {
            if (!isPlainObject(entry)) continue;
            const id = entry.id ?? entry.itemId ?? entry.typeId;
            if (registerStatsCoreDefinition(id, entry)) count++;
        }
        return count;
    }

    if (!isPlainObject(payload)) return 0;

    const directId = payload.id ?? payload.itemId ?? payload.typeId;
    if (directId) {
        return registerStatsCoreDefinition(directId, payload) ? 1 : 0;
    }

    let count = 0;
    for (const [itemId, definition] of Object.entries(payload)) {
        if (registerStatsCoreDefinition(itemId, definition)) count++;
    }
    return count;
}

export function getStatsCoreDefinition(itemOrId) {
    const itemId = normalizeId(typeof itemOrId === "string" ? itemOrId : itemOrId?.typeId);
    if (!itemId) return undefined;

    const definition = itemDefinitions.get(itemId);
    return definition?.enabled ? definition : undefined;
}

export function getStatsCoreRegistrySnapshot() {
    const snapshot = {};
    for (const [itemId, definition] of itemDefinitions.entries()) {
        snapshot[itemId] = clonePlain(definition);
    }
    return snapshot;
}

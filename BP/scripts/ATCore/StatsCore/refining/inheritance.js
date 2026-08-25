import { inferDynamicDefinition } from "../defaults.js";
import { resolveStatsAbilityName } from "../core/abilities.js";
import { normalizeId, titleCaseIdentifier } from "../utils.js";

export const ADVANCED_INHERITANCE_CHANCE = 0.1;

const CATEGORY_CHANNEL = Object.freeze({
    combat: "attributes",
    mining: "mining",
    support: "support",
});

// Diamond definitions are the canonical ability donors. Using the receiver's
// material here made tier-gated abilities disappear from the pool on Iron and
// lower equipment even when an Advanced Runic Core was consumed.
const INHERITANCE_DONOR_IDS = Object.freeze({
    combat: Object.freeze([
        "statscore:diamond_sword",
        "statscore:diamond_axe",
        "statscore:diamond_aiot",
        "statscore:diamond_spear",
        "minecraft:mace",
        "minecraft:trident",
        "minecraft:bow",
        "minecraft:crossbow",
        "statscore:diamond_hoe",
        "statscore:diamond_knife",
    ]),
    mining: Object.freeze([
        "statscore:diamond_pickaxe",
        "statscore:diamond_shovel",
        "statscore:diamond_hoe",
        "statscore:diamond_hammer",
        "statscore:diamond_drill",
        "statscore:diamond_shears",
        "statscore:diamond_lighter",
        "statscore:diamond_axe",
        "statscore:diamond_aiot",
    ]),
    support: Object.freeze([
        "statscore:diamond_helmet",
        "statscore:diamond_chestplate",
        "statscore:diamond_leggings",
        "statscore:diamond_boots",
        "statscore:diamond_shield",
        "statscore:diamond_elytra",
    ]),
});

export function getInheritanceCategory(definition) {
    if (definition?.type === "support") return "support";
    if (definition?.type === "weapon" || definition?.type === "hybrid") return "combat";
    return "mining";
}

export function getDefinitionAbilityRecords(definition, channel = undefined) {
    const records = [];
    for (const [effectChannel, effects] of [
        ["attributes", definition?.attributes?.effects],
        ["mining", definition?.mining?.effects],
        ["support", definition?.support?.effects],
    ]) {
        if (channel && effectChannel !== channel) continue;
        for (const effect of Array.isArray(effects) ? effects : []) {
            const key = normalizeId(effect?.key ?? effect?.kind ?? effect?.id);
            if (!key) continue;
            records.push({
                key,
                name: resolveStatsAbilityName(effect) || titleCaseIdentifier(key),
                channel: effectChannel,
                effect: { ...effect },
            });
        }
    }
    return records;
}

export function getAdvancedInheritancePool(definition, inheritedAbilities = []) {
    if (!definition) return [];
    const category = getInheritanceCategory(definition);
    const channel = CATEGORY_CHANNEL[category];
    const owned = new Set([
        ...getDefinitionAbilityRecords(definition).map(entry => entry.key),
        ...(Array.isArray(inheritedAbilities) ? inheritedAbilities : []).map(entry => normalizeId(entry?.key)),
    ]);
    const pool = [];
    const seen = new Set(owned);

    for (const donorId of INHERITANCE_DONOR_IDS[category] ?? []) {
        const donor = inferDynamicDefinition(donorId);
        for (const entry of getDefinitionAbilityRecords(donor, channel)) {
            if (seen.has(entry.key)) continue;
            seen.add(entry.key);
            pool.push(entry);
        }
    }
    return pool;
}

export function getInheritableAbilityRecord(definition, abilityKey, inheritedAbilities = []) {
    const expected = normalizeId(abilityKey);
    if (!expected) return null;
    return getAdvancedInheritancePool(definition, inheritedAbilities).find(entry =>
        entry.key === expected
        || normalizeId(entry.effect?.kind) === expected
        || normalizeId(entry.name).replace(/[^a-z0-9]+/g, "_") === expected
    ) ?? null;
}

export function rollAdvancedInheritedAbilities(definition, inheritedAbilities = [], random = Math.random) {
    const pool = getAdvancedInheritancePool(definition, inheritedAbilities);
    const inherited = [];
    while (pool.length > 0 && random() < ADVANCED_INHERITANCE_CHANCE) {
        const index = Math.floor(random() * pool.length);
        inherited.push(pool.splice(index, 1)[0]);
    }
    return inherited;
}

import { ADVANCED_INHERITANCE_CHANCE } from "../config/values.js";
import { CATEGORY_CHANNEL, INHERITANCE_DONOR_IDS } from "../config/refinement.js";
export { ADVANCED_INHERITANCE_CHANCE } from "../config/values.js";
import { inferDynamicDefinition } from "../defaults.js";
import { resolveStatsAbilityName } from "../core/abilities.js";
import { normalizeId, titleCaseIdentifier } from "../utils.js";

export function getInheritanceCategory(definition) {
    if (definition?.type === "support") return "support";
    if (definition?.type === "weapon" || definition?.type === "hybrid") return "combat";
    return "mining";
}

function getInheritanceChannels(definition) {
    if (normalizeId(definition?.branch) === "aiot") {
        return [
            { category: "combat", channel: CATEGORY_CHANNEL.combat },
            { category: "mining", channel: CATEGORY_CHANNEL.mining },
        ];
    }

    const category = getInheritanceCategory(definition);
    return [{ category, channel: CATEGORY_CHANNEL[category] }];
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
    const owned = new Set([
        ...getDefinitionAbilityRecords(definition).map(entry => entry.key),
        ...(Array.isArray(inheritedAbilities) ? inheritedAbilities : []).map(entry => normalizeId(entry?.key)),
    ]);
    const pool = [];
    const seen = new Set(owned);

    for (const { category, channel } of getInheritanceChannels(definition)) {
        for (const donorId of INHERITANCE_DONOR_IDS[category] ?? []) {
            const donor = inferDynamicDefinition(donorId);
            for (const entry of getDefinitionAbilityRecords(donor, channel)) {
                if (seen.has(entry.key)) continue;
                seen.add(entry.key);
                pool.push(entry);
            }
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

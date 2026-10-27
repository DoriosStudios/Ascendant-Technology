import { world, EntityTypes, ItemStack } from "@minecraft/server";
import { FALLBACK_DROPS } from "./fallbackDrops.js";
import { weightedChoice, randomInt } from "./essences.js";

const apiFailures = new Set();
// Type-only API exposes no killer context. Conservatively use the local baseline
// for essential player-only pools until native tests prove that context works.
const playerContextProfiles = new Set(["blaze", "guardian", "spider", "wither_skeleton", "zombie"]);

export function fallbackLoot(profile, random = Math.random) {
    if (profile.mob === "slime" && profile.size !== 1) return [];
    if (profile.mob === "magma_cube" && profile.size === 1) return [];
    const pools = FALLBACK_DROPS[profile.mob];
    if (!pools) throw new Error(`Missing fallback: ${profile.mob}`);
    const result = [];
    for (const pool of pools) {
        if (pool.chance < 1 && random() >= pool.chance) continue;
        for (let roll = 0, rolls = randomInt(...pool.rolls, random); roll < rolls; roll++) {
            const entry = weightedChoice(pool.choices, random);
            if (!entry.id) continue;
            const amount = randomInt(entry.min, entry.max, random);
            if (amount > 0) result.push(new ItemStack(entry.id, amount));
        }
    }
    return result;
}

export function generateDeathLoot(profile, random = Math.random) {
    if (profile.size !== undefined || playerContextProfiles.has(profile.mob)) return fallbackLoot(profile, random);
    try {
        const entityType = EntityTypes.get(profile.entityId);
        const manager = world.getLootTableManager?.();
        const result = entityType && manager?.generateLootFromEntityType(entityType);
        // Empty arrays are legitimate rolls, never a reason to reroll locally.
        if (Array.isArray(result)) return result;
    } catch (error) {
        if (!apiFailures.has(profile.entityId)) {
            apiFailures.add(profile.entityId);
            console.warn(`[Mob Chamber] Loot API unavailable for ${profile.entityId}; using vanilla fallback: ${error}`);
        }
    }
    return fallbackLoot(profile, random);
}

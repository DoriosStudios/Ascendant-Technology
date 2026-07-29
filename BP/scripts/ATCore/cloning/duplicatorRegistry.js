// @ts-check

import { getClonerItemProfile } from "./duplicatorProfiles.js";
import { isSingularityInput } from "./singularityRegistry.js";

const LIQUIFIED_AETHERIUM = "liquified_aetherium";
const BASE_TIME_SECONDS = 30 * 60;
const BASE_ENERGY_COST = 1600000;
const FLUID_PER_CRAFT = 16;

const rarityProfiles = new Map([
    ["common", { timeMultiplier: 1, costMultiplier: 1 }],
    ["uncommon", { timeMultiplier: 1.75, costMultiplier: 2 }],
    ["rare", { timeMultiplier: 3.5, costMultiplier: 3.5 }],
    ["epic", { timeMultiplier: 6, costMultiplier: 5 }],
    ["legendary", { timeMultiplier: 8.25, costMultiplier: 10 }],
    ["mythic", { timeMultiplier: 10, costMultiplier: 15 }],
    ["transcendent", { timeMultiplier: 12.5, costMultiplier: 25 }],
]);

const explicitRarities = new Map();
const profileCache = new Map();
const recipeCache = new Map();
const restrictionCache = new Map();

const restrictedItems = new Map([
    ["utilitycraft:duplicator", "Cannot Duplicate Itself"],
]);

const restrictedPatterns = [
    { pattern: /^minecraft:(?:[a-z_]+_)?banner$/, message: "Cannot Duplicate Banners" },
    { pattern: /^minecraft:(?:splash_|lingering_)?potion$/, message: "Cannot Duplicate Potions" },
    { pattern: /^minecraft:(?:[a-z_]+_)?shulker_box$/, message: "Cannot Duplicate Shulker Boxes" },
];

/** @param {string} typeId */
export function getDuplicatorRecipe(typeId) {
    if (!typeId || getDuplicatorRestriction(typeId)) return undefined;

    const cached = recipeCache.get(typeId);
    if (cached) return cached;

    const profile = getDuplicatorProfile(typeId);
    const rarityConfig = rarityProfiles.get(profile.rarity) ?? rarityProfiles.get("common");
    const recipe = {
        id: `generic:${typeId}`,
        rarity: profile.rarity,
        declared: profile.declared,
        source: profile.source,
        input: { id: typeId, amount: 1 },
        output: { id: typeId, amount: 1 },
        timeSeconds: Math.max(1, Math.round(BASE_TIME_SECONDS * rarityConfig.timeMultiplier)),
        energyCost: Math.max(1, Math.round(BASE_ENERGY_COST * rarityConfig.costMultiplier)),
        fluid: { type: LIQUIFIED_AETHERIUM, amount: FLUID_PER_CRAFT },
    };
    recipeCache.set(typeId, recipe);
    return recipe;
}

/** @param {string} typeId */
export function getDuplicatorProfile(typeId) {
    const cached = profileCache.get(typeId);
    if (cached) return cached;

    const override = explicitRarities.get(typeId);
    const resolved = override
        ? { rarity: override, declared: true, source: "registered" }
        : getClonerItemProfile(typeId);
    const profile = {
        rarity: rarityProfiles.has(resolved.rarity) ? resolved.rarity : "common",
        declared: resolved.declared === true,
        source: resolved.source ?? "fallback",
    };
    profileCache.set(typeId, profile);
    return profile;
}

/** @param {string} typeId */
export function getDuplicatorRestriction(typeId) {
    if (!typeId) return "Invalid Template";
    if (isSingularityInput(typeId)) return "Use Singularity Fabricator";

    if (restrictionCache.has(typeId)) {
        return restrictionCache.get(typeId) || undefined;
    }

    let restriction = restrictedItems.get(typeId);
    if (!restriction) {
        for (const entry of restrictedPatterns) {
            if (!entry.pattern.test(typeId)) continue;
            restriction = entry.message;
            break;
        }
    }

    restrictionCache.set(typeId, restriction ?? false);
    return restriction;
}

/**
 * Allows AT integrations to classify addon items without creating per-item recipes.
 *
 * @param {Record<string, string> | Map<string, string>} entries
 */
export function registerDuplicatorRarities(entries) {
    const iterable = entries instanceof Map ? entries : Object.entries(entries ?? {});
    let registered = 0;
    for (const [typeId, rarityValue] of iterable) {
        const rarity = `${rarityValue}`.toLowerCase();
        if (!typeId || !rarityProfiles.has(rarity)) continue;
        explicitRarities.set(typeId, rarity);
        profileCache.delete(typeId);
        recipeCache.delete(typeId);
        registered++;
    }
    return registered;
}

export function getDuplicatorCachedRecipeCount() {
    return recipeCache.size;
}

export function clearDuplicatorCaches() {
    profileCache.clear();
    recipeCache.clear();
    restrictionCache.clear();
}

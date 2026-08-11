// @ts-check

import { getClonerItemProfile } from "./duplicatorProfiles.js";

/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {{ timeMultiplier: number, costMultiplier: number }} RarityProfile */
/** @typedef {{ rarity: string, declared: boolean, source: string }} DuplicatorProfile */
/** @typedef {{ type: string, amount: number }} FluidRequirement */
/** @typedef {{ id: string, amount: number }} ItemRequirement */
/**
 * @typedef {Object} DuplicatorRecipe
 * @property {string} id
 * @property {string} rarity
 * @property {boolean} declared
 * @property {string} source
 * @property {ItemRequirement} input
 * @property {ItemRequirement} output
 * @property {number} timeSeconds
 * @property {number} energyCost
 * @property {FluidRequirement} fluid
 */
/** @typedef {{ pattern: RegExp, message: string }} DuplicatorPatternExclusion */
/** @typedef {{ allowed: true, recipe: DuplicatorRecipe } | { allowed: false, restriction: string }} DuplicatorResolution */

export const DUPLICATOR_EXCLUSION_TAG = "ascendant:unclonnable";

const LIQUIFIED_AETHERIUM = "liquified_aetherium";
const BASE_TIME_SECONDS = 30 * 60;
const BASE_ENERGY_COST = 1600000;
const FLUID_PER_CRAFT = 1000; // 1000mb = 1 bucket

/** @type {ReadonlyMap<string, RarityProfile>} */
const rarityProfiles = new Map([
    ["common", { timeMultiplier: 1, costMultiplier: 1 }],
    ["uncommon", { timeMultiplier: 1.75, costMultiplier: 2 }],
    ["rare", { timeMultiplier: 3.5, costMultiplier: 3.5 }],
    ["epic", { timeMultiplier: 6, costMultiplier: 5 }],
    ["legendary", { timeMultiplier: 8.25, costMultiplier: 10 }],
    ["mythic", { timeMultiplier: 10, costMultiplier: 15 }],
    ["transcendent", { timeMultiplier: 12.5, costMultiplier: 25 }],
]);

/** @type {Map<string, string>} */
const explicitRarities = new Map();
/** @type {Map<string, DuplicatorProfile>} */
const profileCache = new Map();
/** @type {Map<string, DuplicatorRecipe>} */
const recipeCache = new Map();
/** @type {Map<string, string>} */
const exclusionsById = new Map();
/** @type {DuplicatorPatternExclusion[]} */
const patternExclusions = [];
/** @type {Map<string, string | false>} */
const exclusionCache = new Map();

/**
 * Returns a generated recipe only after the template passes every exclusion.
 * Passing an ItemStack also enables the `ascendant:unclonnable` tag check.
 *
 * @param {ItemStack | string} template
 * @returns {DuplicatorRecipe | undefined}
 */
export function getDuplicatorRecipe(template) {
    const resolution = resolveDuplicatorTemplate(template);
    return resolution.allowed ? resolution.recipe : undefined;
}

/**
 * Resolves eligibility and recipe in one pass for machine runtimes.
 *
 * @param {ItemStack | string} template
 * @returns {DuplicatorResolution}
 */
export function resolveDuplicatorTemplate(template) {
    const typeId = getTemplateTypeId(template);
    const restriction = getDuplicatorRestriction(template);
    if (!typeId || restriction) {
        return { allowed: false, restriction: restriction ?? "Invalid Template" };
    }

    const cached = recipeCache.get(typeId);
    if (cached) return { allowed: true, recipe: cached };

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
    return { allowed: true, recipe };
}

/** @param {string} typeId @returns {DuplicatorProfile} */
export function getDuplicatorProfile(typeId) {
    const normalizedId = normalizeTypeId(typeId);
    const cached = profileCache.get(normalizedId);
    if (cached) return cached;

    const override = explicitRarities.get(normalizedId);
    const resolved = override
        ? { rarity: override, declared: true, source: "registered" }
        : getClonerItemProfile(normalizedId);
    const profile = {
        rarity: rarityProfiles.has(resolved.rarity) ? resolved.rarity : "common",
        declared: resolved.declared === true,
        source: resolved.source ?? "fallback",
    };

    profileCache.set(normalizedId, profile);
    return profile;
}

/**
 * Resolves why a template cannot be cloned.
 * Item tags are checked per stack; ID and pattern results are cached.
 *
 * @param {ItemStack | string} template
 * @returns {string | undefined}
 */
export function getDuplicatorRestriction(template) {
    const typeId = getTemplateTypeId(template);
    if (!typeId) return "Invalid Template";

    if (typeof template !== "string" && template.hasTag(DUPLICATOR_EXCLUSION_TAG)) {
        return "Unclonnable";
    }

    const cached = exclusionCache.get(typeId);
    if (cached !== undefined) return cached || undefined;

    let restriction = exclusionsById.get(typeId);
    if (!restriction) {
        restriction = patternExclusions.find(({ pattern }) => pattern.test(typeId))?.message;
    }

    exclusionCache.set(typeId, restriction ?? false);
    return restriction;
}

/**
 * Registers or replaces one exact item exclusion.
 *
 * @param {string} typeId
 * @param {string} [message]
 * @returns {boolean}
 */
export function registerDuplicatorExclusion(typeId, message = "Template Cannot Be Duplicated") {
    const normalizedId = normalizeTypeId(typeId);
    if (!normalizedId) return false;

    exclusionsById.set(normalizedId, normalizeMessage(message));
    invalidateExclusion(normalizedId);
    return true;
}

/**
 * Bulk exclusion integration for configuration files and other addons.
 *
 * @param {ReadonlyMap<string, string> | Readonly<Record<string, string>>} entries
 * @returns {number}
 */
export function registerDuplicatorExclusions(entries) {
    const iterable = entries instanceof Map ? entries : Object.entries(entries ?? {});
    let registered = 0;

    for (const [typeId, message] of iterable) {
        if (registerDuplicatorExclusion(typeId, message)) registered++;
    }
    return registered;
}

/**
 * Registers a family exclusion such as banners or filled data containers.
 *
 * @param {RegExp} pattern
 * @param {string} [message]
 * @returns {boolean}
 */
export function registerDuplicatorPatternExclusion(pattern, message = "Template Cannot Be Duplicated") {
    if (!(pattern instanceof RegExp)) return false;
    patternExclusions.push({ pattern, message: normalizeMessage(message) });
    exclusionCache.clear();
    recipeCache.clear();
    return true;
}

/**
 * Allows integrations to classify addon items without creating per-item recipes.
 *
 * @param {Readonly<Record<string, string>> | ReadonlyMap<string, string>} entries
 * @returns {number}
 */
export function registerDuplicatorRarities(entries) {
    const iterable = entries instanceof Map ? entries : Object.entries(entries ?? {});
    let registered = 0;

    for (const [rawTypeId, rarityValue] of iterable) {
        const typeId = normalizeTypeId(rawTypeId);
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
    exclusionCache.clear();
}

/** @param {ItemStack | string} template */
function getTemplateTypeId(template) {
    return normalizeTypeId(typeof template === "string" ? template : template?.typeId);
}

/** @param {string} typeId */
function invalidateExclusion(typeId) {
    exclusionCache.delete(typeId);
    recipeCache.delete(typeId);
}

/** @param {unknown} value */
function normalizeTypeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** @param {unknown} value */
function normalizeMessage(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Template Cannot Be Duplicated";
}

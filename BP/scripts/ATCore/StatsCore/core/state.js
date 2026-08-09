import { STATSCORE } from "../constants.js";
import { createRuntimeUid, normalizeId, safeJsonParse, toPositiveInteger } from "../utils.js";
import { normalizeStatsRefinementData, parseStatsRefinementData, serializeStatsRefinementData } from "./refinement.js";
import { syncStatsCoreLore } from "./lore.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";
import { normalizeAttributeProgress } from "../progression/attributes.js";
import { normalizeAppliesTo } from "../shared/entityCategories.js";

const MAX_CACHED_STATES_PER_DEFINITION = 128;
const stateCacheByDefinition = new WeakMap();

function getProperty(stack, key) {
    try {
        return stack?.getDynamicProperty?.(key);
    } catch {
        return undefined;
    }
}

function setPropertyIfChanged(stack, key, value) {
    if (!stack || typeof stack.setDynamicProperty !== "function") return false;

    let current;
    try {
        current = stack.getDynamicProperty?.(key);
    } catch {
        current = undefined;
    }

    if (current === value) return false;

    try {
        stack.setDynamicProperty(key, value);
        return true;
    } catch {
        return false;
    }
}

function normalizeOperatorMode(value) {
    const normalized = normalizeId(value);
    if (normalized === "silky" || normalized === "greedy") {
        return normalized;
    }

    return "crushy";
}

function normalizeStatsAbilityData(value) {
    const source = value && typeof value === "object" ? value : {};
    const appliedSource = source.appliedAbilities && typeof source.appliedAbilities === "object"
        ? source.appliedAbilities
        : {};
    const appliedAbilities = {};
    for (const [rawKey, rawLevel] of Object.entries(appliedSource)) {
        const key = normalizeId(rawKey);
        const level = Math.min(5, toPositiveInteger(rawLevel, 0));
        if (key && level > 0) appliedAbilities[key] = level;
    }
    const targetSource = source.abilityTargets && typeof source.abilityTargets === "object"
        ? source.abilityTargets
        : {};
    const abilityTargets = {};
    for (const [rawKey, rawTargets] of Object.entries(targetSource)) {
        const key = normalizeId(rawKey);
        const targets = normalizeAppliesTo(rawTargets);
        if (key && targets.length > 0) abilityTargets[key] = targets;
    }

    return {
        uniqueUnlocked: source.uniqueUnlocked === true,
        advancedUnlocked: source.advancedUnlocked === true,
        operatorMode: normalizeOperatorMode(source.operatorMode),
        appliedAbilities,
        abilityTargets,
    };
}

function parseStatsAbilityData(raw) {
    if (typeof raw !== "string" || raw.length <= 0) {
        return normalizeStatsAbilityData(undefined);
    }

    try {
        return normalizeStatsAbilityData(JSON.parse(raw));
    } catch {
        return normalizeStatsAbilityData(undefined);
    }
}

function signatureValue(value) {
    const serialized = value === undefined ? "" : String(value);
    return `${typeof value}:${serialized.length}:${serialized}`;
}

function getRawStateSignature(raw) {
    return [
        raw.uid,
        raw.version,
        raw.progression,
        raw.attributeProgress,
        raw.affinity,
        raw.branch,
        raw.abilityData,
        raw.refined,
        raw.refinement,
    ].map(signatureValue).join("|");
}

function readCachedState(definition, cacheKey, signature) {
    if (!definition || typeof definition !== "object") return null;
    const cached = stateCacheByDefinition.get(definition)?.get(cacheKey);
    return cached?.signature === signature ? cached.state : null;
}

function cacheState(definition, cacheKey, signature, state) {
    if (!definition || typeof definition !== "object") return;
    let cache = stateCacheByDefinition.get(definition);
    if (!cache) {
        cache = new Map();
        stateCacheByDefinition.set(definition, cache);
    }

    cache.set(cacheKey, { signature, state });
    if (cache.size > MAX_CACHED_STATES_PER_DEFINITION) {
        cache.delete(cache.keys().next().value);
    }
}

export function getCategoryForReason(reason) {
    const normalized = normalizeId(reason);
    if (normalized === "combat" || normalized === "kill") return "offensive";
    if (normalized === "hurt" || normalized === "armor") return "defensive";
    if (normalized === "block" || normalized === "ore" || normalized === "tool") return "mining";
    if (normalized === "utility") return "utility";
    return null;
}

export function getCategoriesForDefinition(definition) {
    const categories = new Set();
    if (!definition) return categories;

    if (definition.progression?.combatXp > 0 || definition.progression?.killXp > 0) {
        categories.add("offensive");
    }
    if (definition.progression?.armorXp > 0) {
        categories.add("defensive");
    }
    if (definition.progression?.blockXp > 0 || definition.progression?.oreXp > 0 || definition.progression?.toolXp > 0) {
        categories.add("mining");
    }
    if (definition.type === "utility") {
        categories.add("utility");
    }

    return categories;
}

function normalizeProgressionState(value) {
    const source = value && typeof value === "object" ? value : {};
    const createCategory = (cat) => ({
        level: toPositiveInteger(source[cat]?.level, 1),
        xp: toPositiveInteger(source[cat]?.xp, 0),
    });

    return {
        offensive: createCategory("offensive"),
        defensive: createCategory("defensive"),
        mining: createCategory("mining"),
        utility: createCategory("utility"),
    };
}

function parseProgressionState(raw) {
    const parsed = safeJsonParse(raw);
    return normalizeProgressionState(parsed);
}

function parseAttributeProgressState(raw) {
    const parsed = safeJsonParse(raw);
    if (parsed && typeof parsed === "object") {
        return normalizeAttributeProgress(parsed);
    }

    return normalizeAttributeProgress(undefined);
}

/**
 * Reads the persistent StatsCore state stored directly on an item stack.
 *
 * This is the canonical read path for runtime modules before resolving attributes,
 * syncing lore, or applying refinement upgrades.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {object} definition
 * @returns {object}
 */
export function readStatsState(stack, definition) {
    const raw = {
        uid: getProperty(stack, STATSCORE.props.uid),
        version: getProperty(stack, STATSCORE.props.version),
        progression: getProperty(stack, STATSCORE.props.progression),
        attributeProgress: getProperty(stack, STATSCORE.props.attributeProgress),
        affinity: getProperty(stack, STATSCORE.props.affinity),
        branch: getProperty(stack, STATSCORE.props.branch),
        abilityData: getProperty(stack, STATSCORE.props.abilityData),
        refined: getProperty(stack, STATSCORE.props.refined),
        refinement: getProperty(stack, STATSCORE.props.refinement),
    };
    const uid = String(raw.uid ?? "");
    const signature = getRawStateSignature(raw);
    const cacheKey = uid || `uninitialized:${String(stack?.typeId ?? definition?.id ?? "item")}`;
    const cached = readCachedState(definition, cacheKey, signature);
    if (cached) return cached;

    const state = {
        uid,
        version: toPositiveInteger(raw.version, 0),
        progression: parseProgressionState(raw.progression),
        attributeProgress: parseAttributeProgressState(raw.attributeProgress),
        affinity: normalizeId(raw.affinity) || definition?.affinity || "hybrid",
        branch: normalizeId(raw.branch) || definition?.branch || definition?.type || "hybrid",
        abilityData: parseStatsAbilityData(raw.abilityData),
        refined: raw.refined === true,
        refinement: parseStatsRefinementData(raw.refinement)
    };
    cacheState(definition, cacheKey, signature, state);
    return state;
}

export function resetStatsState(stack) {
    if (!stack || typeof stack.setDynamicProperty !== "function") return false;

    let changed = false;
    for (const key of Object.values(STATSCORE.props)) {
        try {
            if (stack.getDynamicProperty?.(key) !== undefined) {
                stack.setDynamicProperty(key, undefined);
                changed = true;
            }
        } catch { }
    }
    return changed;
}

/**
 * Writes a normalized StatsCore state back into the item's dynamic properties.
 *
 * Dynamic properties are the source of truth. Lore is rebuilt only when explicitly
 * requested (normally by the shared progression path after a level increase).
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {object} definition
 * @param {object} state
 * @param {{ syncLore?: boolean, levelChanged?: boolean, forceLore?: boolean }} [options={}]
 * @returns {{ changed: boolean, state: object }}
 */
export function writeStatsState(stack, definition, state, options = {}) {
    if (!stack || !definition) return { changed: false, state };

    const nextState = {
        ...state,
        uid: state.uid || createRuntimeUid("statscore"),
        version: STATSCORE.version,
        progression: normalizeProgressionState(state.progression),
        attributeProgress: normalizeAttributeProgress(state.attributeProgress),
        affinity: state.affinity || definition.affinity || "hybrid",
        branch: state.branch || definition.branch || definition.type || "hybrid",
        abilityData: normalizeStatsAbilityData(state?.abilityData),
        refined: state?.refined === true,
        refinement: normalizeStatsRefinementData(state?.refinement)
    };

    let changed = false;
    changed = setPropertyIfChanged(stack, STATSCORE.props.uid, nextState.uid) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.version, nextState.version) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.progression, JSON.stringify(nextState.progression)) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.attributeProgress, JSON.stringify(nextState.attributeProgress)) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.affinity, nextState.affinity) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.branch, nextState.branch) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.abilityData, JSON.stringify(nextState.abilityData)) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.refined, nextState.refined ? true : undefined) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.refinement, serializeStatsRefinementData(nextState.refinement)) || changed;

    // Dynamic properties are authoritative. Lore is only a presentation
    // snapshot and must not be rewritten during ordinary state persistence.
    if (options.syncLore === true || options.levelChanged === true) {
        const attributes = resolveStatsAttributes(definition, nextState);
        changed = syncStatsCoreLore(stack, definition, nextState, attributes, options.forceLore === true) || changed;
    }

    return { changed, state: nextState };
}

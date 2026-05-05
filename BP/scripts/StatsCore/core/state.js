import { STATSCORE } from "../constants.js";
import { createRuntimeUid, normalizeId, toPositiveInteger } from "../utils.js";
import { normalizeStatsRefinementData, readStatsRefinementData, serializeStatsRefinementData } from "./refinement.js";
import { syncStatsCoreLore } from "./lore.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";

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

    return {
        uniqueUnlocked: source.uniqueUnlocked === true,
        operatorMode: normalizeOperatorMode(source.operatorMode)
    };
}

function readStatsAbilityData(stack) {
    const raw = getProperty(stack, STATSCORE.props.abilityData);
    if (typeof raw !== "string" || raw.length <= 0) {
        return normalizeStatsAbilityData(undefined);
    }

    try {
        return normalizeStatsAbilityData(JSON.parse(raw));
    } catch {
        return normalizeStatsAbilityData(undefined);
    }
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
    const maxLevel = Math.max(1, Math.floor(Number(definition?.maxLevel) || STATSCORE.progression.maxLevel));
    const level = Math.max(1, Math.min(maxLevel, toPositiveInteger(getProperty(stack, STATSCORE.props.level), 1)));
    const refinement = readStatsRefinementData(stack);

    return {
        uid: String(getProperty(stack, STATSCORE.props.uid) ?? ""),
        version: toPositiveInteger(getProperty(stack, STATSCORE.props.version), 0),
        level,
        xp: toPositiveInteger(getProperty(stack, STATSCORE.props.xp), 0),
        affinity: normalizeId(getProperty(stack, STATSCORE.props.affinity)) || definition?.affinity || "hybrid",
        branch: normalizeId(getProperty(stack, STATSCORE.props.branch)) || definition?.branch || definition?.type || "hybrid",
        abilityData: readStatsAbilityData(stack),
        refinement
    };
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
 * When `syncLore` is requested, this helper also rebuilds the item's visible lore so
 * gameplay-facing text stays in sync with the new internal state.
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
        level: Math.max(1, Math.min(definition.maxLevel ?? STATSCORE.progression.maxLevel, Math.floor(Number(state.level) || 1))),
        xp: Math.max(0, Math.floor(Number(state.xp) || 0)),
        affinity: state.affinity || definition.affinity || "hybrid",
        branch: state.branch || definition.branch || definition.type || "hybrid",
        abilityData: normalizeStatsAbilityData(state?.abilityData),
        refinement: normalizeStatsRefinementData(state?.refinement)
    };

    let changed = false;
    changed = setPropertyIfChanged(stack, STATSCORE.props.uid, nextState.uid) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.version, nextState.version) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.level, nextState.level) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.xp, nextState.xp) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.affinity, nextState.affinity) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.branch, nextState.branch) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.abilityData, JSON.stringify(nextState.abilityData)) || changed;
    changed = setPropertyIfChanged(stack, STATSCORE.props.refinement, serializeStatsRefinementData(nextState.refinement)) || changed;

    if (options.syncLore === true || options.levelChanged === true || nextState.version !== state.version) {
        const attributes = resolveStatsAttributes(definition, nextState);
        changed = syncStatsCoreLore(stack, definition, nextState, attributes, options.forceLore === true) || changed;
    }

    return { changed, state: nextState };
}

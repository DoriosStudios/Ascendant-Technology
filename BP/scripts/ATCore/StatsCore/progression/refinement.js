import { STATSCORE } from "../constants.js";
import { createRuntimeUid, toFiniteNumber, toPositiveInteger } from "../utils.js";
import { getCategoryForReason, readStatsState, writeStatsState } from "../core/state.js";
import { isStatsCoreEnabled } from "../runtime.js";

const xpBuffers = new Map();

/**
 * Resolves the arithmetic XP curve used by StatsCore.
 *
 * Preferred configuration:
 * progression: {
 *     baseXp: 100,
 *     growthPerLevel: 20
 * }
 *
 * Legacy `progression.growth` multipliers remain supported. A value such as
 * 1.2 is converted to an additive increase equal to 20% of `baseXp`.
 *
 * @param {object} definition
 * @returns {{ baseXp: number, growthPerLevel: number }}
 */
function getProgressionCurve(definition) {
    const progression = definition?.progression ?? {};
    const baseXp = Math.max(
        1,
        Math.floor(toFiniteNumber(progression.baseXp, STATSCORE.progression.baseXp))
    );

    const explicitGrowth = progression.growthPerLevel ?? progression.xpGrowthPerLevel;
    const legacyMultiplier = Math.max(
        1,
        toFiniteNumber(progression.growth, STATSCORE.progression.growth)
    );
    const legacyGrowthPerLevel = Math.max(
        0,
        Math.floor(baseXp * (legacyMultiplier - 1))
    );
    const growthPerLevel = Math.max(
        0,
        Math.floor(toFiniteNumber(explicitGrowth, legacyGrowthPerLevel))
    );

    return { baseXp, growthPerLevel };
}

/**
 * Returns the XP required to advance from `level` to `level + 1`.
 *
 * The cost follows an arithmetic progression instead of exponential growth:
 * baseXp + growthPerLevel * (level - 1).
 *
 * @param {number} level
 * @param {object} definition
 * @returns {number}
 */
export function getXpNeededForLevel(level, definition) {
    const { baseXp, growthPerLevel } = getProgressionCurve(definition);
    const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
    return baseXp + growthPerLevel * (currentLevel - 1);
}

/**
 * Returns the total accumulated XP required to reach `level`.
 *
 * @param {number} level
 * @param {object} definition
 * @returns {number}
 */
export function getTotalXpForLevel(level, definition) {
    return getTotalXpForLevelFromCurve(level, getProgressionCurve(definition));
}

function getTotalXpForLevelFromCurve(level, curve) {
    const { baseXp, growthPerLevel } = curve;
    const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
    const completedLevels = targetLevel - 1;

    return Math.floor(
        completedLevels * baseXp
        + growthPerLevel * completedLevels * (completedLevels - 1) / 2
    );
}

/**
 * Resolves a level from accumulated XP using the inverse arithmetic-series
 * formula, followed by a small precision correction around the threshold.
 *
 * @param {number} totalXp
 * @param {object} definition
 * @returns {number}
 */
export function getLevelFromXp(totalXp, definition) {
    const { baseXp, growthPerLevel } = getProgressionCurve(definition);
    const xp = Math.min(
        Number.MAX_SAFE_INTEGER,
        Math.max(0, Math.floor(Number(totalXp) || 0))
    );

    let completedLevels;

    if (growthPerLevel <= 0) {
        completedLevels = Math.floor(xp / baseXp);
    } else {
        const linearTerm = 2 * baseXp - growthPerLevel;
        const discriminant = linearTerm * linearTerm + 8 * growthPerLevel * xp;
        completedLevels = Math.max(
            0,
            Math.floor((-linearTerm + Math.sqrt(discriminant)) / (2 * growthPerLevel))
        );
    }

    let level = completedLevels + 1;

    const curve = { baseXp, growthPerLevel };
    while (xp >= getTotalXpForLevelFromCurve(level + 1, curve)) level++;
    while (level > 1 && xp < getTotalXpForLevelFromCurve(level, curve)) level--;

    return level;
}

/**
 * Reads the configured XP gain for a specific StatsCore progression reason.
 *
 * @param {object} definition
 * @param {"combat" | "kill" | "ore" | "armor" | "block" | string} reason
 * @param {number} [fallback=1]
 * @returns {number}
 */
export function getProgressAmount(definition, reason, fallback = 1) {
    const progression = definition?.progression ?? {};
    switch (reason) {
        case "combat":
            return Math.max(0, toFiniteNumber(progression.combatXp, fallback));
        case "kill":
            return Math.max(0, toFiniteNumber(progression.killXp, fallback));
        case "tool":
            return Math.max(0, toFiniteNumber(progression.toolXp, fallback));
        case "ore":
            return Math.max(0, toFiniteNumber(progression.oreXp, fallback));
        case "armor":
            return Math.max(0, toFiniteNumber(progression.armorXp, fallback));
        case "block":
        default:
            return Math.max(0, toFiniteNumber(progression.blockXp, fallback));
    }
}

function getBuffer(uid) {
    if (!uid) return 0;
    return toPositiveInteger(xpBuffers.get(uid), 0);
}

function setBuffer(uid, value) {
    if (!uid) return;
    const normalized = toPositiveInteger(value, 0);
    if (normalized <= 0) {
        xpBuffers.delete(uid);
    } else {
        xpBuffers.set(uid, normalized);
    }
}

/**
 * Grants StatsCore XP to an item and persists it when the configured buffer rules require.
 *
 * This is the shared progression write path used by combat, mining, and support modules.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {object} definition
 * @param {number} amount
 * @param {string} [reason="use"]
 * @param {{ forcePersist?: boolean, forceLore?: boolean, currentState?: object }} [options={}]
 * @returns {{ changed: boolean, levelUp: boolean, state: object | null, previousLevel?: number, level?: number, reason?: string, buffered?: number }}
 */
export function grantStatsProgress(stack, definition, amount, reason = "use", options = {}) {
    if (!stack || !definition || amount <= 0) {
        return { changed: false, levelUp: false, state: stack ? readStatsState(stack, definition) : null };
    }

    if (!isStatsCoreEnabled()) {
        return {
            changed: false,
            levelUp: false,
            state: readStatsState(stack, definition),
            reason,
            buffered: 0,
        };
    }

    const category = getCategoryForReason(reason);
    const currentState = options.currentState && typeof options.currentState === "object"
        ? options.currentState
        : readStatsState(stack, definition);
    if (currentState.refined !== true) {
        return { changed: false, levelUp: false, state: currentState, reason, buffered: 0 };
    }
    if (!category || !currentState.progression?.[category]) {
        return { changed: false, levelUp: false, state: currentState, reason, buffered: 0 };
    }

    const uid = currentState.uid || createRuntimeUid("statscore");
    const bufferKey = `${uid}:${category}`;
    const initialized = currentState.version >= STATSCORE.version && Boolean(currentState.uid);
    const currentProgress = currentState.progression[category];
    const buffered = getBuffer(bufferKey) + Math.max(0, Math.floor(Number(amount) || 0));
    const totalXp = currentProgress.xp + buffered;
    const nextLevel = getLevelFromXp(totalXp, definition);
    const levelUp = nextLevel > currentProgress.level;
    const configuredPersistEveryXp = definition?.progression?.persistEveryXp ?? definition.persistEveryXp;
    const persistEveryXp = Math.max(
        1,
        Math.floor(Number(configuredPersistEveryXp) || STATSCORE.progression.persistEveryXp)
    );
    const shouldPersist = options.forcePersist === true || !initialized || levelUp || buffered >= persistEveryXp;

    if (!shouldPersist) {
        setBuffer(bufferKey, buffered);
        if (!currentState.uid) {
            const result = writeStatsState(stack, definition, { ...currentState, uid }, { syncLore: false });
            return { ...result, levelUp: false, buffered };
        }
        return { changed: false, levelUp: false, state: currentState, buffered };
    }

    setBuffer(bufferKey, 0);

    const nextState = {
        ...currentState,
        uid,
        progression: {
            ...currentState.progression,
            [category]: {
                xp: totalXp,
                level: nextLevel,
            },
        },
    };

    const result = writeStatsState(stack, definition, nextState, {
        syncLore: levelUp,
        levelChanged: levelUp,
        forceLore: options.forceLore === true
    });

    return {
        ...result,
        levelUp,
        previousLevel: currentProgress.level,
        level: nextLevel,
        category,
        reason,
        buffered: 0
    };
}

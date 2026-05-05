import { STATSCORE } from "../constants.js";
import { createRuntimeUid, toFiniteNumber, toPositiveInteger } from "../utils.js";
import { readStatsState, writeStatsState } from "../core/state.js";

const xpBuffers = new Map();

export function getXpNeededForLevel(level, definition) {
    const progression = definition?.progression ?? {};
    const baseXp = Math.max(1, toFiniteNumber(progression.baseXp, STATSCORE.progression.baseXp));
    const growth = Math.max(1, toFiniteNumber(progression.growth, STATSCORE.progression.growth));
    return Math.max(1, Math.floor(baseXp * Math.pow(growth, Math.max(0, level - 1))));
}

export function getLevelFromXp(totalXp, definition) {
    const maxLevel = Math.max(1, Math.floor(Number(definition?.maxLevel) || STATSCORE.progression.maxLevel));
    let level = 1;
    let remaining = Math.max(0, Math.floor(Number(totalXp) || 0));

    while (level < maxLevel) {
        const needed = getXpNeededForLevel(level, definition);
        if (remaining < needed) break;
        remaining -= needed;
        level++;
    }

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
 * @param {{ forcePersist?: boolean, forceLore?: boolean }} [options={}]
 * @returns {{ changed: boolean, levelUp: boolean, state: object | null, previousLevel?: number, level?: number, reason?: string, buffered?: number }}
 */
export function grantStatsProgress(stack, definition, amount, reason = "use", options = {}) {
    if (!stack || !definition || amount <= 0) {
        return { changed: false, levelUp: false, state: stack ? readStatsState(stack, definition) : null };
    }

    const currentState = readStatsState(stack, definition);
    const uid = currentState.uid || createRuntimeUid("statscore");
    const initialized = currentState.version >= STATSCORE.version && Boolean(currentState.uid);
    const buffered = getBuffer(uid) + Math.max(0, Math.floor(Number(amount) || 0));
    const totalXp = currentState.xp + buffered;
    const nextLevel = getLevelFromXp(totalXp, definition);
    const levelUp = nextLevel > currentState.level;
    const persistEveryXp = Math.max(1, Math.floor(Number(definition.persistEveryXp) || STATSCORE.progression.persistEveryXp));
    const shouldPersist = options.forcePersist === true || !initialized || levelUp || buffered >= persistEveryXp;

    if (!shouldPersist) {
        setBuffer(uid, buffered);
        if (!currentState.uid) {
            const result = writeStatsState(stack, definition, { ...currentState, uid }, { syncLore: true });
            return { ...result, levelUp: false, buffered };
        }
        return { changed: false, levelUp: false, state: currentState, buffered };
    }

    setBuffer(uid, 0);

    const nextState = {
        ...currentState,
        uid,
        xp: totalXp,
        level: nextLevel
    };

    const result = writeStatsState(stack, definition, nextState, {
        syncLore: true,
        levelChanged: levelUp,
        forceLore: options.forceLore === true
    });

    return {
        ...result,
        levelUp,
        previousLevel: currentState.level,
        level: nextLevel,
        reason,
        buffered: 0
    };
}

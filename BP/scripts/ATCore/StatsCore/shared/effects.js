import { EffectTypes } from "@minecraft/server";

/**
 * Resolves a Bedrock effect identifier into the runtime effect type accepted by `addEffect`.
 *
 * Use this helper when a module stores effect ids as simple strings and needs a single,
 * consistent conversion point before applying them to entities.
 *
 * @param {string} id
 * @returns {string | undefined}
 */
export function resolveStatsEffectType(id) {
    if (!id) return undefined;

    const normalized = String(id).includes(":") ? String(id) : `minecraft:${id}`;
    return EffectTypes?.get?.(normalized) ?? EffectTypes?.get?.(id) ?? normalized;
}

/**
 * Applies an effect by id using the shared Bedrock-safe resolution path used across StatsCore.
 *
 * @param {import("@minecraft/server").Entity} target
 * @param {string} id
 * @param {number} duration
 * @param {number} [amplifier=0]
 * @param {boolean} [showParticles=false]
 * @returns {boolean}
 */
export function applyEffectById(target, id, duration, amplifier = 0, showParticles = false) {
    const effectType = resolveStatsEffectType(id);
    if (!target || !effectType) return false;

    try {
        target.addEffect?.(effectType, duration, {
            amplifier,
            showParticles,
        });
        return true;
    } catch {
        return false;
    }
}


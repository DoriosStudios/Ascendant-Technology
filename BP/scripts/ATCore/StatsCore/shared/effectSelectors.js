import { normalizeId } from "../utils.js";

/**
 * Normalizes a StatsCore effect kind for safe cross-module comparisons.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeEffectKind(value) {
    return normalizeId(value);
}

/**
 * Returns every declared StatsCore effect from combat, mining, and support sections.
 *
 * This is the shared effect pool used by lore, inspection, and other cross-cutting code.
 *
 * @param {object} attributes
 * @returns {object[]}
 */
export function collectStatsEffectPool(attributes) {
    return [
        ...(Array.isArray(attributes?.effects) ? attributes.effects : []),
        ...(Array.isArray(attributes?.mining?.effects) ? attributes.mining.effects : []),
        ...(Array.isArray(attributes?.support?.effects) ? attributes.support.effects : []),
    ].filter(effect => effect && typeof effect === "object");
}

/**
 * Finds the first effect of a given kind in a list.
 *
 * @param {object[]} list
 * @param {string} kind
 * @returns {object | null}
 */
export function findEffectByKind(list, kind) {
    const normalizedKind = normalizeEffectKind(kind);
    if (!normalizedKind || !Array.isArray(list)) return null;

    return list.find(effect => normalizeEffectKind(effect?.kind) === normalizedKind) ?? null;
}

/**
 * Returns every effect of a given kind in a list.
 *
 * @param {object[]} list
 * @param {string} kind
 * @returns {object[]}
 */
export function filterEffectsByKind(list, kind) {
    const normalizedKind = normalizeEffectKind(kind);
    if (!normalizedKind || !Array.isArray(list)) return [];

    return list.filter(effect => normalizeEffectKind(effect?.kind) === normalizedKind);
}

/**
 * Checks whether a list contains at least one effect of the requested kind.
 *
 * @param {object[]} list
 * @param {string} kind
 * @returns {boolean}
 */
export function hasEffectKind(list, kind) {
    return Boolean(findEffectByKind(list, kind));
}


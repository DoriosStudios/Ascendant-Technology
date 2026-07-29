import { normalizeId, toPositiveInteger } from "../utils.js";

const CATEGORIES = Object.freeze(["offensive", "defensive", "mining", "utility"]);

export function normalizeAttributeProgress(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};

    for (const category of CATEGORIES) {
        const entries = source[category] && typeof source[category] === "object" ? source[category] : {};
        result[category] = {};
        for (const [rawKey, rawValue] of Object.entries(entries)) {
            const key = normalizeId(rawKey);
            const amount = toPositiveInteger(rawValue, 0);
            if (key && amount > 0) result[category][key] = amount;
        }
    }
    return result;
}

export function getWeakAttributePoints(attributeProgress, category, key) {
    return toPositiveInteger(attributeProgress?.[category]?.[key], 0);
}

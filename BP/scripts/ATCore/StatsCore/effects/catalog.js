import { STATSCORE_EFFECT_CATALOG, EFFECT_ALIASES } from "../config/definitions.js";
export { STATSCORE_EFFECT_CATALOG, STATSCORE_EFFECT_IDS } from "../config/definitions.js";

export function normalizeStatsCoreEffectId(value) {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^.*:/, "")
        .replace(/[^a-z0-9_.-]+/g, "_")
        .slice(0, 64);
    return EFFECT_ALIASES[normalized] ?? normalized;
}

export function getStatsCoreEffectDefinition(effectId) {
    return STATSCORE_EFFECT_CATALOG[normalizeStatsCoreEffectId(effectId)];
}

import { inferDynamicDefinition } from "../defaults.js";
import { normalizeId } from "../utils.js";

const STATSCORE_REGISTRY = new Map();

/**
 * Registers a StatsCore definition for a given item ID.
 * @param {string} id The item's typeId.
 * @param {object} definition The StatsCore definition object.
 * @returns {boolean} True if the definition was registered, false otherwise.
 */
export function registerStatsCoreDefinition(id, definition) {
    const normalized = normalizeId(id);
    if (!normalized || typeof definition !== "object") return false;
    STATSCORE_REGISTRY.set(normalized, definition);
    return true;
}

/**
 * Registers multiple StatsCore definitions.
 * @param {Array<object>} definitions An array of definition objects, each with an 'id' property.
 * @returns {number} The number of definitions successfully registered.
 */
export function registerStatsCoreDefinitions(definitions) {
    if (!Array.isArray(definitions)) return 0;
    let count = 0;
    for (const definition of definitions) {
        if (registerStatsCoreDefinition(definition?.id, definition)) {
            count++;
        }
    }
    return count;
}

/**
 * Retrieves the StatsCore definition for a given item or item ID.
 * If not found, it attempts to dynamically infer a definition.
 * @param {string|import("@minecraft/server").ItemStack} itemOrId The item stack or its typeId.
 * @returns {object|null} The definition object or null if not found/inferred.
 */
export function getStatsCoreDefinition(itemOrId) {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.typeId;
    const normalized = normalizeId(id);
    if (!normalized) return null;

    if (STATSCORE_REGISTRY.has(normalized)) {
        return STATSCORE_REGISTRY.get(normalized);
    }

    // Attempt to dynamically generate and register a definition for future use.
    const dynamicDefinition = inferDynamicDefinition(normalized);
    if (dynamicDefinition) {
        registerStatsCoreDefinition(normalized, dynamicDefinition);
        return dynamicDefinition;
    }

    return null;
}

export function getStatsCoreRegistrySize() {
    return STATSCORE_REGISTRY.size;
}

export function getStatsCoreRegistrySnapshot() {
    return Object.fromEntries(STATSCORE_REGISTRY.entries());
}


// @ts-check

/** @type {Map<string, Record<string, any>>} */
const definitions = new Map();

/**
 * Registers exact block identifiers. Validation is performed once here rather
 * than while blocks are being broken.
 *
 * @param {Record<string, Record<string, any>>} entries
 */
export function registerDropDefinitions(entries) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new TypeError("Drop definitions must be an object keyed by block identifier");
  }

  for (const [blockTypeId, definition] of Object.entries(entries)) {
    if (!blockTypeId.includes(":") || !definition || typeof definition !== "object") {
      throw new TypeError(`Invalid drop definition: ${blockTypeId}`);
    }
    if (definitions.has(blockTypeId)) {
      throw new Error(`Drop definition ${blockTypeId} is already registered`);
    }
    definitions.set(blockTypeId, definition);
  }
}

/** @param {string} blockTypeId */
export function getDropDefinition(blockTypeId) {
  return definitions.get(blockTypeId);
}

/** @param {string} blockTypeId */
export function hasDropDefinition(blockTypeId) {
  return definitions.has(blockTypeId);
}

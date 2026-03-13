
/**
 * Default entity identifier used by machines.
 *
 * Machines spawn this entity to handle storage, processing,
 * and internal machine logic.
 *
 * @constant
 */
export const DEFAULT_ENTITY_ID = "utilitycraft:machine";

/**
 * Default machine processing interval.
 *
 * Represents the number of ticks between machine updates.
 * Minecraft runs at 20 ticks per second.
 *
 * @constant
 */
export const DEFAULT_TICK_SPEED = 10;

/**
 * Number of game ticks per second in Minecraft Bedrock.
 *
 * @constant
 */
export const TICKS_PER_SECOND = 20;

/**
 * Cardinal direction offsets as frozen vectors.
 *
 * @constant
 */
export const CARDINAL_DIRECTION_OFFSETS = Object.freeze({
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    down: { x: 0, y: -1, z: 0 }
});

/**
 * Maps each cardinal direction to its opposite.
 *
 * @constant
 */
export const OPPOSITE_DIRECTIONS = Object.freeze({
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up"
});

/**
 * Maps each horizontal direction to the one on its left.
 *
 * @constant
 */
export const LEFT_OF_DIRECTION = Object.freeze({
    north: "west",
    south: "east",
    east: "north",
    west: "south"
});

/**
 * Maps each horizontal direction to the one on its right.
 *
 * @constant
 */
export const RIGHT_OF_DIRECTION = Object.freeze({
    north: "east",
    south: "west",
    east: "south",
    west: "north"
});

/**
 * Valid relative direction strings for fluid transfer resolution.
 *
 * @constant
 */
export const VALID_RELATIVE_DIRECTIONS = new Set(["front", "back", "left", "right", "up", "down"]);

/**
 * Item used as a placeholder for label slots.
 *
 * @constant
 */
export const LABEL_PLACEHOLDER_ITEM = "utilitycraft:arrow_indicator_90";

/**
 * Character limit per label field (Minecraft name tag / lore line).
 *
 * @constant
 */
export const LABEL_CHAR_LIMIT = 255;

/**
 * Item used to fill hidden inventory slots so they can't be used by transfers.
 *
 * @constant
 */
export const HIDDEN_SLOT_FILLER_ITEM = "utilitycraft:container_filler";

/**
 * Dynamic property key for energy debug mode.
 *
 * @constant
 */
export const ENERGY_DEBUG_PROP = "utilitycraft:debug_energy";

/**
 * Block tag that identifies energy-connectable blocks.
 *
 * @constant
 */
export const ENERGY_GEOMETRY_TAG = "dorios:energy";

/**
 * Block types that should skip energy geometry updates.
 *
 * @constant
 */
export const ENERGY_GEOMETRY_SKIP_TYPES = new Set([
    "utilitycraft:reinforced_cable"
]);

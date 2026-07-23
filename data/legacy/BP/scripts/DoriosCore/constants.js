
export const CORE_CONSTANTS = Object.freeze({
    machine: Object.freeze({
        defaultEntityId: "utilitycraft:machine",
        defaultTickSpeed: 10,
        ticksPerSecond: 20
    }),
    directions: Object.freeze({
        cardinalOffsets: Object.freeze({
            north: { x: 0, y: 0, z: -1 },
            south: { x: 0, y: 0, z: 1 },
            east: { x: 1, y: 0, z: 0 },
            west: { x: -1, y: 0, z: 0 },
            up: { x: 0, y: 1, z: 0 },
            down: { x: 0, y: -1, z: 0 }
        }),
        opposite: Object.freeze({
            north: "south",
            south: "north",
            east: "west",
            west: "east",
            up: "down",
            down: "up"
        }),
        leftOf: Object.freeze({
            north: "west",
            south: "east",
            east: "north",
            west: "south"
        }),
        rightOf: Object.freeze({
            north: "east",
            south: "west",
            east: "south",
            west: "north"
        }),
        validRelative: new Set(["front", "back", "left", "right", "up", "down"])
    }),
    labels: Object.freeze({
        placeholderItem: "utilitycraft:arrow_indicator_90",
        charLimit: 255,
        hiddenSlotFillerItem: "utilitycraft:container_filler"
    }),
    energy: Object.freeze({
        debugProp: "utilitycraft:debug_energy",
        geometryTag: "dorios:energy",
        geometrySkipTypes: new Set([
            "utilitycraft:reinforced_cable"
        ])
    })
});

export const DEFAULT_ENTITY_ID = CORE_CONSTANTS.machine.defaultEntityId;
export const DEFAULT_TICK_SPEED = CORE_CONSTANTS.machine.defaultTickSpeed;
export const TICKS_PER_SECOND = CORE_CONSTANTS.machine.ticksPerSecond;
export const CARDINAL_DIRECTION_OFFSETS = CORE_CONSTANTS.directions.cardinalOffsets;
export const OPPOSITE_DIRECTIONS = CORE_CONSTANTS.directions.opposite;
export const LEFT_OF_DIRECTION = CORE_CONSTANTS.directions.leftOf;
export const RIGHT_OF_DIRECTION = CORE_CONSTANTS.directions.rightOf;
export const VALID_RELATIVE_DIRECTIONS = CORE_CONSTANTS.directions.validRelative;
export const LABEL_PLACEHOLDER_ITEM = CORE_CONSTANTS.labels.placeholderItem;
export const LABEL_CHAR_LIMIT = CORE_CONSTANTS.labels.charLimit;
export const HIDDEN_SLOT_FILLER_ITEM = CORE_CONSTANTS.labels.hiddenSlotFillerItem;
export const ENERGY_DEBUG_PROP = CORE_CONSTANTS.energy.debugProp;
export const ENERGY_GEOMETRY_TAG = CORE_CONSTANTS.energy.geometryTag;
export const ENERGY_GEOMETRY_SKIP_TYPES = CORE_CONSTANTS.energy.geometrySkipTypes;

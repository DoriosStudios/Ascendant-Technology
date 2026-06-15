import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { updatePipes, Energy } from "../../DoriosCore/main.js";
import { CARDINAL_DIRECTION_OFFSETS, LEFT_OF_DIRECTION, OPPOSITE_DIRECTIONS, RIGHT_OF_DIRECTION } from "../../DoriosCore/constants.js";
import { createPlainConveyors } from "./plain_conveyors.js";
import { createBridgeConveyors } from "./bridge_conveyors.js";
import { createSpecialConveyors } from "./special_conveyors.js";

// IDs and data keys.
const CONVEYOR_IDS = Object.freeze({
    tags: Object.freeze({
        conveyor: "dorios:conveyor",
        bridge: "dorios:conveyor_bridge"
    }),
    states: Object.freeze({
        bridgePathDirection: "utilitycraft:cardinal_direction",
        verticalDirection: "utilitycraft:vertical_direction"
    }),
    props: Object.freeze({
        itemMoveTick: "utilitycraft:conveyor_move_tick",
        itemMoveKey: "utilitycraft:conveyor_move_key",
        entityMoveTick: "utilitycraft:conveyor_entity_move_tick",
        entityMoveKey: "utilitycraft:conveyor_entity_move_key",
        persistChunkPrefix: "utilitycraft:conveyor_chunk",
        persistChunkIndexMetaPrefix: "utilitycraft:conveyor_chunk_index",
        persistChunkIndexPagePrefix: "utilitycraft:conveyor_chunk_index_page",
        upgradeKeyPrefix: "utilitycraft:conveyor_upgrade",
        upgradeTypeKeyPrefix: "utilitycraft:conveyor_upgrade_type",
        upgradeBlockKeyPrefix: "utilitycraft:conveyor_upgrade_block",
        globalUpgradeKey: "utilitycraft:conveyor_upgrade_global",
        smartRouterKeyPrefix: "smart_router",
        sorterFilterKeyPrefix: "conveyor_sorter_filter",
        itemJunctionDir: "utilitycraft:junction_dir",
        itemJunctionBlock: "utilitycraft:junction_block"
    })
});

// Bridge path data.
const CONVEYOR_BRIDGE = Object.freeze({
    legacyPathBlockId: "utilitycraft:conveyor_bridge_path",
    pathByTier: Object.freeze({
        copper: {
            id: "utilitycraft:copper_conveyor_bridge_path",
            tag: "dorios:conveyor_bridge_path_copper"
        },
        titanium: {
            id: "utilitycraft:titanium_conveyor_bridge_path",
            tag: "dorios:conveyor_bridge_path_titanium"
        },
        aetherium: {
            id: "utilitycraft:aetherium_conveyor_bridge_path",
            tag: "dorios:conveyor_bridge_path_aetherium"
        }
    }),
    airBlockIds: new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]),
    clearableBlocks: new Set([
        "minecraft:snow",
        "minecraft:snow_layer",
        "minecraft:torch",
        "minecraft:soul_torch",
        "minecraft:redstone_torch",
        "minecraft:wall_torch",
        "minecraft:soul_wall_torch",
        "minecraft:redstone_wall_torch",
        "minecraft:grass",
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:tall_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:deadbush",
        "minecraft:dandelion",
        "minecraft:poppy",
        "minecraft:blue_orchid",
        "minecraft:allium",
        "minecraft:azure_bluet",
        "minecraft:red_tulip",
        "minecraft:orange_tulip",
        "minecraft:white_tulip",
        "minecraft:pink_tulip",
        "minecraft:oxeye_daisy",
        "minecraft:cornflower",
        "minecraft:lily_of_the_valley",
        "minecraft:wither_rose",
        "minecraft:sunflower",
        "minecraft:lilac",
        "minecraft:rose_bush",
        "minecraft:peony",
        "minecraft:seagrass",
        "minecraft:tall_seagrass",
        "minecraft:kelp",
        "minecraft:kelp_plant",
        "minecraft:sea_pickle",
        "minecraft:waterlily",
        "minecraft:vine",
        "minecraft:glow_lichen",
        "minecraft:cave_vines",
        "minecraft:cave_vines_body_with_berries",
        "minecraft:cave_vines_head_with_berries",
        "minecraft:small_dripleaf",
        "minecraft:big_dripleaf",
        "minecraft:big_dripleaf_stem",
        "minecraft:spore_blossom",
        "minecraft:crimson_fungus",
        "minecraft:warped_fungus",
        "minecraft:crimson_roots",
        "minecraft:warped_roots",
        "minecraft:nether_sprouts",
        "minecraft:weeping_vines",
        "minecraft:twisting_vines",
        "minecraft:weeping_vines_plant",
        "minecraft:twisting_vines_plant",
        "minecraft:bamboo_sapling"
    ]),
    clearableSuffixes: Object.freeze(["_sapling", "_fungus", "_mushroom", "_flower", "_tulip"])
});

// Shared tuning values.
const CONVEYOR_DEFAULTS = Object.freeze({
    special: Object.freeze({
        tier: "universal",
        ips: 5,
        energyCost: 10
    }),
    timing: Object.freeze({
        routerCycleTicks: 10,
        processInterval: 2,
        networkUpdaterIntervalDefault: 80,
        networkUpdaterMaxScan: 4096,
        persistChunkPageSize: 200
    }),
    movement: Object.freeze({
        itemSpacing: 0.35,
        inclinedDetectionRadius: 0.75,
        baseIps: 5,
        baseSpeed: 0.05,
        baseVerticalSpeed: 0.12,
        maxSpeed: 0.2,
        maxVerticalSpeed: 0.3,
        aetheriumSpeedMultiplier: 5
    }),
    routing: Object.freeze({
        upgradeTypes: new Set([
            "energy",
            "filter",
            "hyper",
            "quantity",
            "range",
            "size",
            "speed",
            "ultimate"
        ]),
        smartRouterDefault: Object.freeze({ left: [], front: [], right: [] }),
        smartRouterDirs: Object.freeze(["left", "front", "right"]),
        upgradeMax: 64
    })
});

// Runtime caches.
const CONVEYOR_RUNTIME = {
    networkDirty: new Set(),
    networkCache: new Map(),
    registry: new Map(),
    bridgeCache: new Map(),
    routerDirectionCache: new Map(),
    sorterSideCycleCache: new Map(),
    overflowCycleCache: new Map(),
    underflowCycleCache: new Map(),
    metaByType: new Map()
};

// Derived shortcuts.
const CONVEYOR_TAG = CONVEYOR_IDS.tags.conveyor;
const BRIDGE_TAG = CONVEYOR_IDS.tags.bridge;
const LEGACY_BRIDGE_PATH_BLOCK_ID = CONVEYOR_BRIDGE.legacyPathBlockId;
const BRIDGE_PATH_BY_TIER = CONVEYOR_BRIDGE.pathByTier;
const AIR_BLOCK_IDS = CONVEYOR_BRIDGE.airBlockIds;
const BRIDGE_PATH_DIRECTION_STATE = CONVEYOR_IDS.states.bridgePathDirection;
const BRIDGE_CLEARABLE_BLOCKS = CONVEYOR_BRIDGE.clearableBlocks;
const BRIDGE_CLEARABLE_SUFFIXES = CONVEYOR_BRIDGE.clearableSuffixes;
const SPECIAL_CONVEYOR_TIER = CONVEYOR_DEFAULTS.special.tier;
const SPECIAL_CONVEYOR_IPS = CONVEYOR_DEFAULTS.special.ips;
const SPECIAL_CONVEYOR_ENERGY_COST = CONVEYOR_DEFAULTS.special.energyCost;
const ROUTER_CYCLE_TICKS = CONVEYOR_DEFAULTS.timing.routerCycleTicks;
const ITEM_SPACING = CONVEYOR_DEFAULTS.movement.itemSpacing;
const INCLINED_DETECTION_RADIUS = CONVEYOR_DEFAULTS.movement.inclinedDetectionRadius;
const ITEM_MOVE_TICK_PROP = CONVEYOR_IDS.props.itemMoveTick;
const ITEM_MOVE_KEY_PROP = CONVEYOR_IDS.props.itemMoveKey;
const ENTITY_MOVE_TICK_PROP = CONVEYOR_IDS.props.entityMoveTick;
const ENTITY_MOVE_KEY_PROP = CONVEYOR_IDS.props.entityMoveKey;
const CONVEYOR_PERSIST_CHUNK_PREFIX = CONVEYOR_IDS.props.persistChunkPrefix;
const CONVEYOR_PERSIST_CHUNK_INDEX_META_PREFIX = CONVEYOR_IDS.props.persistChunkIndexMetaPrefix;
const CONVEYOR_PERSIST_CHUNK_INDEX_PAGE_PREFIX = CONVEYOR_IDS.props.persistChunkIndexPagePrefix;
const CONVEYOR_PERSIST_CHUNK_PAGE_SIZE = CONVEYOR_DEFAULTS.timing.persistChunkPageSize;
const CONVEYOR_UPGRADE_TYPES = CONVEYOR_DEFAULTS.routing.upgradeTypes;
const CONVEYOR_NETWORK_DIRTY = CONVEYOR_RUNTIME.networkDirty;
const CONVEYOR_NETWORK_CACHE = CONVEYOR_RUNTIME.networkCache;
const CONVEYOR_NETWORK_UPDATER_INTERVAL_DEFAULT = CONVEYOR_DEFAULTS.timing.networkUpdaterIntervalDefault;
const CONVEYOR_NETWORK_UPDATER_MAX_SCAN = CONVEYOR_DEFAULTS.timing.networkUpdaterMaxScan;
const VERTICAL_DIRECTION_STATE = CONVEYOR_IDS.states.verticalDirection;
const CONVEYOR_UPGRADE_MAX = CONVEYOR_DEFAULTS.routing.upgradeMax;
const CONVEYOR_UPGRADE_KEY_PREFIX = CONVEYOR_IDS.props.upgradeKeyPrefix;
const CONVEYOR_UPGRADE_TYPE_KEY_PREFIX = CONVEYOR_IDS.props.upgradeTypeKeyPrefix;
const CONVEYOR_UPGRADE_BLOCK_KEY_PREFIX = CONVEYOR_IDS.props.upgradeBlockKeyPrefix;
const GLOBAL_CONVEYOR_UPGRADE_KEY = CONVEYOR_IDS.props.globalUpgradeKey;
const SMART_ROUTER_KEY_PREFIX = CONVEYOR_IDS.props.smartRouterKeyPrefix;
const SORTER_FILTER_KEY_PREFIX = CONVEYOR_IDS.props.sorterFilterKeyPrefix;
const SMART_ROUTER_DEFAULT = CONVEYOR_DEFAULTS.routing.smartRouterDefault;
const SMART_ROUTER_DIRS = CONVEYOR_DEFAULTS.routing.smartRouterDirs;
const ITEM_JUNCTION_DIR_PROP = CONVEYOR_IDS.props.itemJunctionDir;
const ITEM_JUNCTION_BLOCK_PROP = CONVEYOR_IDS.props.itemJunctionBlock;

const normalizeRawMessageArg = value => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return value;
    return String(value);
};

const tr = (key, withArgs = []) => ({
    translate: key,
    with: withArgs.map(normalizeRawMessageArg)
});

const BASE_IPS = CONVEYOR_DEFAULTS.movement.baseIps;
const BASE_SPEED = CONVEYOR_DEFAULTS.movement.baseSpeed;
const BASE_VERTICAL_SPEED = CONVEYOR_DEFAULTS.movement.baseVerticalSpeed;
const MAX_SPEED = CONVEYOR_DEFAULTS.movement.maxSpeed;
const MAX_VERTICAL_SPEED = CONVEYOR_DEFAULTS.movement.maxVerticalSpeed;
const AETHERIUM_SPEED_MULTIPLIER = CONVEYOR_DEFAULTS.movement.aetheriumSpeedMultiplier;
const CARDINAL_OFFSETS = CARDINAL_DIRECTION_OFFSETS;
const OPPOSITE_CARDINAL = OPPOSITE_DIRECTIONS;
const RIGHT_CARDINAL = RIGHT_OF_DIRECTION;
const LEFT_CARDINAL = LEFT_OF_DIRECTION;
const conveyorRegistry = CONVEYOR_RUNTIME.registry;
const bridgeCache = CONVEYOR_RUNTIME.bridgeCache;
const routerDirectionCache = CONVEYOR_RUNTIME.routerDirectionCache;
const sorterSideCycleCache = CONVEYOR_RUNTIME.sorterSideCycleCache;
const overflowCycleCache = CONVEYOR_RUNTIME.overflowCycleCache;
const underflowCycleCache = CONVEYOR_RUNTIME.underflowCycleCache;
const CONVEYOR_META_BY_TYPE = CONVEYOR_RUNTIME.metaByType;
const TIER_DEFS = [
    { tier: "copper", ips: 5, bridgeRange: 8 },
    { tier: "titanium", ips: 11, bridgeRange: 16 },
    { tier: "aetherium", ips: 128, bridgeRange: 32 }
];
const PLAIN_SHAPES = ["horizontal", "inclined", "declined", "vertical"];
const SPECIAL_TYPE_IDS = [
    "utilitycraft:conveyor_junction",
    "utilitycraft:conveyor_overflow",
    "utilitycraft:conveyor_router",
    "utilitycraft:conveyor_smart_router",
    "utilitycraft:conveyor_underflow",
    "utilitycraft:conveyor_sorter",
    "utilitycraft:conveyor_inverted_sorter"
];

function defineConveyorType(id, meta) {
    CONVEYOR_META_BY_TYPE.set(id, Object.freeze({ ...meta }));
}

const plainConveyors = createPlainConveyors({
    tierDefs: TIER_DEFS,
    plainShapes: PLAIN_SHAPES,
    defineConveyorType,
    baseIps: BASE_IPS,
    baseSpeed: BASE_SPEED,
    baseVerticalSpeed: BASE_VERTICAL_SPEED,
    maxSpeed: MAX_SPEED,
    maxVerticalSpeed: MAX_VERTICAL_SPEED,
    aetheriumSpeedMultiplier: AETHERIUM_SPEED_MULTIPLIER,
    cardinalOffsets: CARDINAL_OFFSETS,
    verticalDirectionState: VERTICAL_DIRECTION_STATE,
    itemMoveTickProp: ITEM_MOVE_TICK_PROP,
    itemMoveKeyProp: ITEM_MOVE_KEY_PROP,
    entityMoveTickProp: ENTITY_MOVE_TICK_PROP,
    entityMoveKeyProp: ENTITY_MOVE_KEY_PROP,
    itemSpacing: ITEM_SPACING,
    inclinedDetectionRadius: INCLINED_DETECTION_RADIUS,
    posKey
});

const {
    registerPlainConveyorTypes,
    getConveyorSpeed,
    getConveyorVerticalSpeed,
    resolveOutputOffset,
    getItemsNear,
    getCreaturesNear,
    getItemStackFromEntity,
    getConveyorTick,
    hasItemMovedThisTick,
    hasEntityMovedThisTick,
    markItemMoved,
    markEntityMoved,
    canMoveItemWithSpacing,
    shouldHoldAetheriumItem,
    tryInsertIntoContainer,
    moveItem,
    moveEntity,
    processStandardConveyor
} = plainConveyors;

const bridgeConveyors = createBridgeConveyors({
    tierDefs: TIER_DEFS,
    defineConveyorType,
    bridgeTag: BRIDGE_TAG,
    bridgePathByTier: BRIDGE_PATH_BY_TIER,
    legacyBridgePathBlockId: LEGACY_BRIDGE_PATH_BLOCK_ID,
    airBlockIds: AIR_BLOCK_IDS,
    bridgePathDirectionState: BRIDGE_PATH_DIRECTION_STATE,
    bridgeClearableBlocks: BRIDGE_CLEARABLE_BLOCKS,
    bridgeClearableSuffixes: BRIDGE_CLEARABLE_SUFFIXES,
    cardinalOffsets: CARDINAL_OFFSETS,
    oppositeCardinal: OPPOSITE_CARDINAL,
    bridgeCache,
    posKey,
    tr,
    system,
    updatePipes,
    markConveyorNetworkDirty,
    getConveyorMeta,
    getItemsNear,
    getCreaturesNear,
    getItemStackFromEntity,
    hasItemMovedThisTick,
    hasEntityMovedThisTick,
    markItemMoved,
    markEntityMoved,
    shouldHoldAetheriumItem,
    processStandardConveyor,
    conveyorTag: CONVEYOR_TAG
});

const {
    registerBridgeConveyorTypes,
    isAirLike,
    isLegacyBridgePathBlock,
    isBridgePathBlock,
    findBridgeTransmittersForReceiver,
    evaluateBridgeLink,
    clearBridgePath,
    refreshBridgePathFromTransmitter,
    refreshBridgePathsForReceiver,
    processBridgeTransmitter
} = bridgeConveyors;

const specialConveyors = createSpecialConveyors({
    world,
    ActionFormData,
    defineConveyorType,
    specialTypeIds: SPECIAL_TYPE_IDS,
    specialTier: SPECIAL_CONVEYOR_TIER,
    specialIps: SPECIAL_CONVEYOR_IPS,
    specialEnergyCost: SPECIAL_CONVEYOR_ENERGY_COST,
    smartRouterKeyPrefix: SMART_ROUTER_KEY_PREFIX,
    sorterFilterKeyPrefix: SORTER_FILTER_KEY_PREFIX,
    smartRouterDefault: SMART_ROUTER_DEFAULT,
    smartRouterDirs: SMART_ROUTER_DIRS,
    routerDirectionCache,
    sorterSideCycleCache,
    overflowCycleCache,
    underflowCycleCache,
    routerCycleTicks: ROUTER_CYCLE_TICKS,
    cardinalOffsets: CARDINAL_OFFSETS,
    oppositeCardinal: OPPOSITE_CARDINAL,
    rightCardinal: RIGHT_CARDINAL,
    leftCardinal: LEFT_CARDINAL,
    conveyorTag: CONVEYOR_TAG,
    itemMoveKeyProp: ITEM_MOVE_KEY_PROP,
    itemJunctionDirProp: ITEM_JUNCTION_DIR_PROP,
    itemJunctionBlockProp: ITEM_JUNCTION_BLOCK_PROP,
    posKey,
    parsePosKey,
    tr,
    getConveyorTick,
    getItemsNear,
    getItemStackFromEntity,
    hasItemMovedThisTick,
    markItemMoved,
    canMoveItemWithSpacing,
    shouldHoldAetheriumItem,
    tryInsertIntoContainer,
    resolveOutputOffset,
    consumeConveyorEnergy,
    canConsumeConveyorEnergy,
    isAirLike,
    isBridgePathBlock,
    isLegacyBridgePathBlock
});

const {
    registerSpecialConveyorTypes,
    getSmartRouterId,
    readSorterFilter,
    saveSorterFilter,
    clearSorterFilter,
    clearSorterFilterAt,
    getSmartRouterConfig,
    saveSmartRouterConfig,
    removeSmartRouterConfig,
    openSorterMenu,
    openSmartRouterMenu,
    processRouterConveyor,
    processSorterConveyor,
    processSmartRouterConveyor,
    processOverflowConveyor,
    processUnderflowConveyor,
    processJunctionConveyor
} = specialConveyors;

registerPlainConveyorTypes();
registerBridgeConveyorTypes();
registerSpecialConveyorTypes();

function posKey(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function parsePosKey(key) {
    if (typeof key !== "string" || key.length === 0) return null;
    const [xRaw, yRaw, zRaw] = key.split("|");
    const x = Number(xRaw);
    const y = Number(yRaw);
    const z = Number(zRaw);
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x, y, z };
}

function getConveyorChunkCoords(pos) {
    if (!pos) return { x: 0, z: 0 };
    const x = Math.floor(Number(pos.x) || 0);
    const z = Math.floor(Number(pos.z) || 0);
    return { x: Math.floor(x / 16), z: Math.floor(z / 16) };
}

function getConveyorChunkKey(coords) {
    if (!coords) return "0|0";
    return `${coords.x}|${coords.z}`;
}

function getConveyorChunkKeyFromPos(pos) {
    return getConveyorChunkKey(getConveyorChunkCoords(pos));
}

function getConveyorChunkDataKey(dimId, chunkKey) {
    return `${CONVEYOR_PERSIST_CHUNK_PREFIX}:${dimId}:${chunkKey}`;
}

function getConveyorChunkIndexMetaKey(dimId) {
    return `${CONVEYOR_PERSIST_CHUNK_INDEX_META_PREFIX}:${dimId}`;
}

function getConveyorChunkIndexPageKey(dimId, page) {
    return `${CONVEYOR_PERSIST_CHUNK_INDEX_PAGE_PREFIX}:${dimId}:${page}`;
}

function readWorldJsonProperty(key, fallback) {
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== "string" || raw.length === 0) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeWorldJsonProperty(key, value) {
    if (value === null || value === undefined) {
        world.setDynamicProperty(key, "");
        return;
    }
    world.setDynamicProperty(key, JSON.stringify(value));
}

function encodeConveyorPosKey(pos) {
    if (!pos) return "";
    const x = Math.floor(Number(pos.x) || 0);
    const y = Math.floor(Number(pos.y) || 0);
    const z = Math.floor(Number(pos.z) || 0);
    return `${x},${y},${z}`;
}

function decodeConveyorPosKey(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    const [xRaw, yRaw, zRaw] = value.split(",");
    const x = Number(xRaw);
    const y = Number(yRaw);
    const z = Number(zRaw);
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x, y, z };
}

function readConveyorChunkIndexMeta(dimId) {
    const meta = readWorldJsonProperty(getConveyorChunkIndexMetaKey(dimId), null);
    const pages = Math.max(0, Math.floor(Number(meta?.pages ?? 0)));
    return { pages };
}

function writeConveyorChunkIndexMeta(dimId, meta) {
    const pages = Math.max(0, Math.floor(Number(meta?.pages ?? 0)));
    writeWorldJsonProperty(getConveyorChunkIndexMetaKey(dimId), { pages });
}

function readConveyorChunkIndexPage(dimId, page) {
    const list = readWorldJsonProperty(getConveyorChunkIndexPageKey(dimId, page), null);
    if (!Array.isArray(list)) return [];
    return list.filter(entry => typeof entry === "string" && entry.length > 0);
}

function writeConveyorChunkIndexPage(dimId, page, list) {
    if (!Array.isArray(list) || list.length === 0) {
        world.setDynamicProperty(getConveyorChunkIndexPageKey(dimId, page), "");
        return;
    }
    writeWorldJsonProperty(getConveyorChunkIndexPageKey(dimId, page), list);
}

function findConveyorChunkIndexPage(dimId, chunkKey, meta) {
    const pages = Math.max(0, Math.floor(Number(meta?.pages ?? 0)));
    for (let page = 0; page < pages; page++) {
        const list = readConveyorChunkIndexPage(dimId, page);
        if (list.includes(chunkKey)) return page;
    }
    return -1;
}

function addConveyorChunkToIndex(dimId, chunkKey) {
    if (!dimId || !chunkKey) return;
    const meta = readConveyorChunkIndexMeta(dimId);
    if (findConveyorChunkIndexPage(dimId, chunkKey, meta) >= 0) return;

    for (let page = 0; page < meta.pages; page++) {
        const list = readConveyorChunkIndexPage(dimId, page);
        if (list.length >= CONVEYOR_PERSIST_CHUNK_PAGE_SIZE) continue;
        list.push(chunkKey);
        writeConveyorChunkIndexPage(dimId, page, list);
        return;
    }

    const newPage = meta.pages;
    writeConveyorChunkIndexPage(dimId, newPage, [chunkKey]);
    writeConveyorChunkIndexMeta(dimId, { pages: newPage + 1 });
}

function trimConveyorChunkIndex(dimId, meta) {
    let pages = Math.max(0, Math.floor(Number(meta?.pages ?? 0)));
    while (pages > 0) {
        const list = readConveyorChunkIndexPage(dimId, pages - 1);
        if (list.length > 0) break;
        world.setDynamicProperty(getConveyorChunkIndexPageKey(dimId, pages - 1), "");
        pages--;
    }
    writeConveyorChunkIndexMeta(dimId, { pages });
}

function removeConveyorChunkFromIndex(dimId, chunkKey) {
    if (!dimId || !chunkKey) return;
    const meta = readConveyorChunkIndexMeta(dimId);
    const page = findConveyorChunkIndexPage(dimId, chunkKey, meta);
    if (page < 0) return;
    const list = readConveyorChunkIndexPage(dimId, page).filter(entry => entry !== chunkKey);
    writeConveyorChunkIndexPage(dimId, page, list);
    trimConveyorChunkIndex(dimId, meta);
}

function readConveyorChunkData(dimId, chunkKey) {
    const list = readWorldJsonProperty(getConveyorChunkDataKey(dimId, chunkKey), null);
    if (!Array.isArray(list)) return [];
    return list.filter(entry => typeof entry === "string" && entry.length > 0);
}

function writeConveyorChunkData(dimId, chunkKey, list) {
    if (!Array.isArray(list) || list.length === 0) {
        world.setDynamicProperty(getConveyorChunkDataKey(dimId, chunkKey), "");
        return;
    }
    writeWorldJsonProperty(getConveyorChunkDataKey(dimId, chunkKey), list);
}

function persistConveyorPosition(block) {
    if (!block?.dimension || !block?.location) return;
    if (!block.hasTag?.(CONVEYOR_TAG)) return;
    const dimId = block.dimension.id;
    const chunkKey = getConveyorChunkKeyFromPos(block.location);
    const list = readConveyorChunkData(dimId, chunkKey);
    const encoded = encodeConveyorPosKey(block.location);
    if (!encoded) return;

    if (!list.includes(encoded)) {
        list.push(encoded);
        writeConveyorChunkData(dimId, chunkKey, list);
    }

    addConveyorChunkToIndex(dimId, chunkKey);
}

function unpersistConveyorPosition(dimId, pos) {
    if (!dimId || !pos) return;
    const chunkKey = getConveyorChunkKeyFromPos(pos);
    const list = readConveyorChunkData(dimId, chunkKey);
    if (!list.length) return;

    const encoded = encodeConveyorPosKey(pos);
    const next = list.filter(entry => entry !== encoded);
    writeConveyorChunkData(dimId, chunkKey, next);

    if (next.length === 0) {
        removeConveyorChunkFromIndex(dimId, chunkKey);
    }
}

function getRegistryForDimension(dimId) {
    if (!conveyorRegistry.has(dimId)) {
        conveyorRegistry.set(dimId, new Map());
    }
    return conveyorRegistry.get(dimId);
}

function markConveyorNetworkDirty(dimId) {
    if (!dimId) return;
    CONVEYOR_NETWORK_DIRTY.add(dimId);
}

function normalizeBlockPosition(pos) {
    if (!pos) return null;
    return {
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z)
    };
}

function resolveEnergyPortEntity(dim, pos) {
    if (!dim || !pos) return null;
    return dim.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0];
}

function isEnergyTubeBlock(block) {
    if (!block?.hasTag?.("dorios:energy")) return false;
    return block.hasTag?.("dorios:isTube") ?? false;
}

function getEnergySourceEntityAt(dim, pos) {
    if (!dim || !pos) return null;
    const block = dim.getBlock(pos);
    if (!block?.hasTag?.("dorios:energy")) return null;

    let entity = dim.getEntitiesAtBlockLocation(pos)[0];
    if (block.hasTag?.("dorios:multiblock.port")) {
        entity = resolveEnergyPortEntity(dim, pos);
    }

    const tf = entity?.getComponent?.("minecraft:type_family");
    if (!tf?.hasTypeFamily?.("dorios:energy_source")) return null;
    return entity;
}

function collectEnergySourcesFromNetwork(dim, startPos) {
    if (!dim || !startPos) return [];
    const origin = normalizeBlockPosition(startPos);
    if (!origin) return [];

    const queue = [origin];
    const visited = new Set();
    const sources = [];
    const sourceKeys = new Set();
    let steps = 0;

    while (queue.length && steps < 2048) {
        const pos = queue.shift();
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        const block = dim.getBlock(pos);
        if (!block?.hasTag?.("dorios:energy")) continue;

        if (isEnergyTubeBlock(block)) {
            for (const off of [
                { x: 1, y: 0, z: 0 },
                { x: -1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                { x: 0, y: -1, z: 0 },
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: -1 }
            ]) {
                queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
            }
            if (block.hasTag?.(BRIDGE_TAG)) {
                const meta = getConveyorMeta(block.typeId);
                if (meta?.shape === "bridge_transmitter") {
                    const facing = block.getState?.("minecraft:cardinal_direction") ?? null;
                    if (facing) {
                        const link = evaluateBridgeLink(block, meta, facing);
                        if (link.receiver && !link.obstructed) {
                            const linkedPos = normalizeBlockPosition(link.receiver.location);
                            if (linkedPos) queue.push(linkedPos);
                        }
                    }
                }
            }
            continue;
        }

        const entity = getEnergySourceEntityAt(dim, pos);
        if (!entity) continue;
        const sourceKey = entity.scoreboardIdentity?.id ?? key;
        if (sourceKeys.has(sourceKey)) continue;
        sourceKeys.add(sourceKey);
        sources.push({ pos: { ...pos } });
    }

    return sources;
}

function buildConveyorNetworkCache(dim, registry) {
    const byPos = new Map();
    const networks = new Map();
    if (!dim || !registry) return { byPos, networks };

    const bridgeEdges = new Map();
    const bridgeBackEdges = new Map();

    for (const [key, entry] of registry.entries()) {
        const block = dim.getBlock(entry.pos);
        if (!block?.hasTag?.(CONVEYOR_TAG)) continue;
        const meta = getConveyorMeta(block.typeId) ?? entry.meta;
        if (!meta) continue;

        if (meta.shape === "bridge_transmitter") {
            const facing = block.getState?.("minecraft:cardinal_direction") ?? null;
            if (!facing) continue;
            const link = evaluateBridgeLink(block, meta, facing);
            if (link.receiver && !link.obstructed) {
                const receiverKey = posKey(link.receiver.location);
                bridgeEdges.set(key, receiverKey);
                if (!bridgeBackEdges.has(receiverKey)) bridgeBackEdges.set(receiverKey, []);
                bridgeBackEdges.get(receiverKey).push(key);
            }
        }
    }

    const visited = new Set();

    for (const [key, entry] of registry.entries()) {
        if (visited.has(key)) continue;
        const nodeKeys = [];
        const nodes = [];
        const queue = [key];

        while (queue.length) {
            const currentKey = queue.shift();
            if (visited.has(currentKey)) continue;
            visited.add(currentKey);

            const currentEntry = registry.get(currentKey);
            if (!currentEntry) continue;

            nodeKeys.push(currentKey);
            nodes.push({ ...currentEntry.pos });

            const neighbors = [];
            for (const off of Object.values(CARDINAL_OFFSETS)) {
                const neighborKey = posKey({
                    x: currentEntry.pos.x + off.x,
                    y: currentEntry.pos.y + off.y,
                    z: currentEntry.pos.z + off.z
                });
                if (registry.has(neighborKey)) neighbors.push(neighborKey);
            }

            const bridgeTarget = bridgeEdges.get(currentKey);
            if (bridgeTarget) neighbors.push(bridgeTarget);

            const bridgeSources = bridgeBackEdges.get(currentKey);
            if (bridgeSources) neighbors.push(...bridgeSources);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) queue.push(neighbor);
            }
        }

        const anchorKey = resolveNetworkAnchorKey(nodeKeys) ?? key;
        const networkId = `${dim.id}:${anchorKey}`;
        for (const nodeKey of nodeKeys) {
            byPos.set(nodeKey, networkId);
        }

        const network = {
            id: networkId,
            dimId: dim.id,
            nodes,
            energySources: null,
            energyTick: -1,
            upgrades: null,
            upgradeKey: null
        };

        if (anchorKey !== key) {
            migrateConveyorNetworkUpgrades(dim.id, key, anchorKey, network);
        }

        const anchorUpgradeKey = getConveyorUpgradeKey(`${dim.id}:${anchorKey}`);
        const anchorRaw = world.getDynamicProperty(anchorUpgradeKey);
        if (!anchorRaw) {
            const legacyKey = nodeKeys.find(nodeKey => {
                if (!nodeKey || nodeKey === anchorKey) return false;
                const candidateKey = getConveyorUpgradeKey(`${dim.id}:${nodeKey}`);
                const raw = world.getDynamicProperty(candidateKey);
                return raw !== undefined && raw !== null && raw !== "";
            });
            if (legacyKey) {
                migrateConveyorNetworkUpgrades(dim.id, legacyKey, anchorKey, network);
            }
        }

        networks.set(networkId, network);
    }

    return { byPos, networks };
}

function getConveyorNetworkCache(dim, registry) {
    if (!dim) return { byPos: new Map(), networks: new Map() };
    const dimId = dim.id;
    const cached = CONVEYOR_NETWORK_CACHE.get(dimId);
    if (cached && !CONVEYOR_NETWORK_DIRTY.has(dimId)) return cached;

    const rebuilt = buildConveyorNetworkCache(dim, registry);
    CONVEYOR_NETWORK_CACHE.set(dimId, rebuilt);
    CONVEYOR_NETWORK_DIRTY.delete(dimId);
    return rebuilt;
}

let conveyorRestoreDone = false;
let conveyorRestoreScheduled = false;

function getConveyorRestoreDimensions() {
    const dims = DoriosAPI?.constants?.dimensions;
    if (dims && typeof dims === "object") {
        return Object.values(dims)
            .map(entry => entry?.id)
            .filter(id => typeof id === "string" && id.length > 0);
    }
    return ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
}

function restoreConveyorsFromPersistence() {
    if (conveyorRestoreDone) return;
    conveyorRestoreDone = true;

    const dimIds = getConveyorRestoreDimensions();

    for (const dimId of dimIds) {
        const dim = world.getDimension(dimId);
        if (!dim) continue;

        const meta = readConveyorChunkIndexMeta(dimId);
        if (!meta.pages) continue;

        const transmitters = [];
        const receivers = [];

        for (let page = 0; page < meta.pages; page++) {
            const chunkKeys = readConveyorChunkIndexPage(dimId, page);
            if (!chunkKeys.length) continue;

            for (const chunkKey of chunkKeys) {
                const stored = readConveyorChunkData(dimId, chunkKey);
                if (!stored.length) {
                    removeConveyorChunkFromIndex(dimId, chunkKey);
                    continue;
                }

                const next = [];
                const seen = new Set();

                for (const entry of stored) {
                    if (seen.has(entry)) continue;
                    seen.add(entry);

                    const pos = decodeConveyorPosKey(entry);
                    if (!pos) continue;

                    const block = dim.getBlock(pos);
                    if (!block?.hasTag?.(CONVEYOR_TAG)) continue;

                    registerConveyor(block, null, { persist: false });
                    next.push(entry);

                    const blockMeta = getConveyorMeta(block.typeId);
                    if (blockMeta?.shape === "bridge_transmitter") {
                        transmitters.push({ block, meta: blockMeta });
                    } else if (blockMeta?.shape === "bridge_receiver") {
                        receivers.push({ block, meta: blockMeta });
                    }
                }

                if (next.length !== stored.length) {
                    writeConveyorChunkData(dimId, chunkKey, next);
                }

                if (next.length === 0) {
                    removeConveyorChunkFromIndex(dimId, chunkKey);
                }
            }
        }

        for (const entry of transmitters) {
            refreshBridgePathFromTransmitter(entry.block, entry.meta, null);
        }

        for (const entry of receivers) {
            refreshBridgePathsForReceiver(dim, entry.block.location, entry.meta, null);
        }
    }
}

function scheduleConveyorRestore() {
    if (conveyorRestoreDone || conveyorRestoreScheduled) return;
    conveyorRestoreScheduled = true;
    let attempts = 0;

    const attemptRestore = () => {
        if (conveyorRestoreDone) return;
        if (!globalThis.worldLoaded && attempts < 25) {
            attempts++;
            system.runTimeout(attemptRestore, 20);
            return;
        }
        conveyorRestoreScheduled = false;
        restoreConveyorsFromPersistence();
    };

    system.runTimeout(attemptRestore, 20);
}

function getConveyorMeta(typeId, params) {
    if (CONVEYOR_META_BY_TYPE.has(typeId)) {
        return CONVEYOR_META_BY_TYPE.get(typeId);
    }

    if (!params || typeof params !== "object") return null;

    const shape = typeof params.shape === "string" ? params.shape : null;
    const tier = typeof params.tier === "string" ? params.tier : null;
    if (!shape || !tier) return null;

    const ips = Number(params.ips ?? BASE_IPS);
    const bridgeRange = Number(params.bridge_range ?? params.bridgeRange ?? 0);

    return {
        tier,
        shape,
        ips: Number.isFinite(ips) ? ips : BASE_IPS,
        bridgeRange: Number.isFinite(bridgeRange) ? bridgeRange : 0
    };
}

function getConveyorUpgradeKey(networkId) {
    if (networkId) return `${CONVEYOR_UPGRADE_KEY_PREFIX}:${networkId}`;
    return GLOBAL_CONVEYOR_UPGRADE_KEY;
}

function getConveyorTypeUpgradeKey(typeId, networkId = null) {
    if (!typeId) return null;
    if (networkId) return `${CONVEYOR_UPGRADE_TYPE_KEY_PREFIX}:${networkId}:${typeId}`;
    return `${CONVEYOR_UPGRADE_TYPE_KEY_PREFIX}:${typeId}`;
}

function getConveyorBlockUpgradeKey(block) {
    if (!block?.dimension || !block?.location) return null;
    const { x, y, z } = block.location;
    return `${CONVEYOR_UPGRADE_BLOCK_KEY_PREFIX}:${block.dimension.id}:${x}|${y}|${z}`;
}

function normalizeConveyorUpgrades(raw) {
    const levels = {};
    for (const type of CONVEYOR_UPGRADE_TYPES) {
        levels[type] = 0;
    }

    if (raw && typeof raw === "object") {
        for (const [type, value] of Object.entries(raw)) {
            if (!CONVEYOR_UPGRADE_TYPES.has(type)) continue;
            const numeric = Math.max(0, Math.floor(Number(value) || 0));
            levels[type] = Math.min(CONVEYOR_UPGRADE_MAX, numeric);
        }
    }

    return levels;
}

function mergeUpgradeLevels(...levels) {
    const merged = normalizeConveyorUpgrades(null);
    for (const entry of levels) {
        if (!entry || typeof entry !== "object") continue;
        for (const [type, value] of Object.entries(entry)) {
            if (!CONVEYOR_UPGRADE_TYPES.has(type)) continue;
            const add = Math.max(0, Math.floor(Number(value) || 0));
            if (add <= 0) continue;
            merged[type] = Math.min(CONVEYOR_UPGRADE_MAX, (merged[type] ?? 0) + add);
        }
    }
    return merged;
}

function resolveNetworkAnchorKey(nodeKeys) {
    if (!Array.isArray(nodeKeys) || nodeKeys.length === 0) return null;
    const sorted = [...nodeKeys].filter(Boolean).sort();
    return sorted[0] ?? null;
}

function migrateConveyorNetworkUpgrades(dimId, legacyKey, newKey, network) {
    if (!dimId || !legacyKey || !newKey || legacyKey === newKey) return null;
    const legacyUpgradeKey = getConveyorUpgradeKey(`${dimId}:${legacyKey}`);
    const newUpgradeKey = getConveyorUpgradeKey(`${dimId}:${newKey}`);
    if (!legacyUpgradeKey || !newUpgradeKey) return null;

    const legacyRaw = world.getDynamicProperty(legacyUpgradeKey);
    if (legacyRaw === undefined || legacyRaw === null || legacyRaw === "") return null;
    if (world.getDynamicProperty(newUpgradeKey)) return null;

    try {
        world.setDynamicProperty(newUpgradeKey, legacyRaw);
        world.setDynamicProperty(legacyUpgradeKey, "");
    } catch {
        return null;
    }

    if (network) {
        network.upgradeKey = newUpgradeKey;
        network.upgrades = getConveyorUpgradesForKey(newUpgradeKey);
    }

    return newUpgradeKey;
}

function getConveyorUpgradesForKey(key) {
    if (!key) return normalizeConveyorUpgrades(null);
    const raw = world.getDynamicProperty(key);
    let parsed = null;
    if (typeof raw === "string" && raw.length > 0) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
    }
    return normalizeConveyorUpgrades(parsed);
}

function getConveyorUpgrades(networkId, network = null) {
    const key = getConveyorUpgradeKey(networkId);
    if (!key) return normalizeConveyorUpgrades(null);
    if (network?.upgradeKey === key && network?.upgrades) return network.upgrades;

    const levels = getConveyorUpgradesForKey(key);
    if (network) {
        network.upgrades = levels;
        network.upgradeKey = key;
    }
    return levels;
}

function getConveyorEffectiveUpgrades(block, meta, networkId, network, networkUpgrades = null) {
    const typeId = block?.typeId ?? meta?.typeId ?? "";
    const globalUpgrades = getConveyorUpgradesForKey(GLOBAL_CONVEYOR_UPGRADE_KEY);
    const typeUpgrades = getConveyorUpgradesForKey(getConveyorTypeUpgradeKey(typeId));
    const networkLevels = networkUpgrades ?? getConveyorUpgrades(networkId, network);
    const networkTypeUpgrades = getConveyorUpgradesForKey(getConveyorTypeUpgradeKey(typeId, networkId));
    const blockUpgrades = getConveyorUpgradesForKey(getConveyorBlockUpgradeKey(block));

    return mergeUpgradeLevels(
        globalUpgrades,
        typeUpgrades,
        networkLevels,
        networkTypeUpgrades,
        blockUpgrades
    );
}

function calculateHyperSpeedMultiplier(level) {
    const hyperLevel = Math.min(8, Math.max(0, Number(level) || 0));
    if (hyperLevel <= 0) return 1;
    const theoretical = 1 + 0.075 * hyperLevel * (hyperLevel + 1);
    return 1 + (theoretical - 1) * 0.4;
}

function applyConveyorUpgrades(meta, upgrades) {
    if (!meta) return meta;
    const hyperLevel = upgrades?.hyper ?? 0;
    const speedMultiplier = calculateHyperSpeedMultiplier(hyperLevel);
    if (!Number.isFinite(speedMultiplier) || speedMultiplier === 1) return meta;
    return {
        ...meta,
        ips: meta.ips * speedMultiplier
    };
}

function registerConveyor(block, params, options = {}) {
    if (!block?.dimension) return;
    const meta = getConveyorMeta(block.typeId, params);
    if (!meta) return;

    const dimId = block.dimension.id;
    const registry = getRegistryForDimension(dimId);
    const key = posKey(block.location);
    registry.set(key, {
        pos: { ...block.location },
        typeId: block.typeId,
        meta
    });
    markConveyorNetworkDirty(dimId);

    if (options.persist === true) {
        persistConveyorPosition(block);
    }
}

function getNetworkUpdaterInterval(block) {
    const raw = Number(block?.getDynamicProperty?.("utilitycraft:conveyor_network_interval"));
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return CONVEYOR_NETWORK_UPDATER_INTERVAL_DEFAULT;
}

function getNetworkUpdaterMaxScan(block) {
    const raw = Number(block?.getDynamicProperty?.("utilitycraft:conveyor_network_max_scan"));
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return CONVEYOR_NETWORK_UPDATER_MAX_SCAN;
}

function getNetworkUpdaterOffset(pos, interval) {
    if (!pos || !interval) return 0;
    const sum = Math.abs((pos.x ?? 0) + (pos.y ?? 0) + (pos.z ?? 0));
    return sum % interval;
}

function shouldRunNetworkUpdater(block) {
    const interval = getNetworkUpdaterInterval(block);
    if (interval <= 0) return false;
    const tick = getConveyorTick();
    const offset = getNetworkUpdaterOffset(block.location, interval);
    return tick % interval === offset;
}

function getConveyorUpdaterSeeds(dim, pos) {
    if (!dim || !pos) return [];
    const seeds = [];
    for (const off of Object.values(CARDINAL_OFFSETS)) {
        const neighbor = dim.getBlock({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
        if (neighbor?.hasTag?.(CONVEYOR_TAG)) seeds.push(neighbor);
    }
    return seeds;
}

function collectConnectedConveyorsFromSeeds(dim, seeds, maxScan) {
    if (!dim || !Array.isArray(seeds) || !seeds.length) return [];
    const limit = Number.isFinite(maxScan) && maxScan > 0 ? maxScan : CONVEYOR_NETWORK_UPDATER_MAX_SCAN;
    const visited = new Set();
    const queue = [...seeds];
    let scanned = 0;

    while (queue.length && scanned < limit) {
        const current = queue.shift();
        if (!current?.location) continue;
        const key = posKey(current.location);
        if (visited.has(key)) continue;
        const block = dim.getBlock(current.location);
        if (!block?.hasTag?.(CONVEYOR_TAG)) continue;

        visited.add(key);
        scanned++;
        registerConveyor(block, null, { persist: false });

        const meta = getConveyorMeta(block.typeId);

        for (const off of Object.values(CARDINAL_OFFSETS)) {
            const neighbor = dim.getBlock({
                x: block.location.x + off.x,
                y: block.location.y + off.y,
                z: block.location.z + off.z
            });
            if (neighbor?.hasTag?.(CONVEYOR_TAG)) queue.push(neighbor);
        }

        if (meta?.shape === "bridge_transmitter") {
            const facing = block.getState?.("minecraft:cardinal_direction") ?? null;
            if (facing) {
                const link = evaluateBridgeLink(block, meta, facing);
                if (link.receiver && !link.obstructed) queue.push(link.receiver);
            }
        } else if (meta?.shape === "bridge_receiver") {
            const transmitters = findBridgeTransmittersForReceiver(dim, block, meta);
            for (const transmitter of transmitters) {
                queue.push(transmitter);
            }
        }
    }

    return Array.from(visited);
}

function syncConveyorRegistryFromBlocks(dim, seeds, maxScan) {
    if (!dim || !seeds?.length) return [];
    return collectConnectedConveyorsFromSeeds(dim, seeds, maxScan);
}

function runConveyorNetworkUpdater(block) {
    if (!block?.dimension) return;
    if (!shouldRunNetworkUpdater(block)) return;

    const seeds = getConveyorUpdaterSeeds(block.dimension, block.location);
    if (!seeds.length) return;

    syncConveyorRegistryFromBlocks(block.dimension, seeds, getNetworkUpdaterMaxScan(block));
}

function clearConveyorRuntimeCaches(key) {
    bridgeCache.delete(key);
    routerDirectionCache.delete(key);
    sorterSideCycleCache.delete(key);
    overflowCycleCache.delete(key);
    underflowCycleCache.delete(key);
}

function purgeConveyorEntry(registry, dimId, key, entry = null, dim = null) {
    registry?.delete?.(key);
    clearConveyorRuntimeCaches(key);
    if (isSorterShape(entry?.meta?.shape)) {
        clearSorterFilterAt(dimId, entry.pos);
    }
    if (entry?.meta?.shape === "smart_router" && dim) {
        removeSmartRouterConfig(getSmartRouterId({ location: entry.pos, dimension: dim }));
    }
    markConveyorNetworkDirty(dimId);
}

function unregisterConveyorAt(dimId, pos) {
    if (!dimId || !pos) return;
    const registry = conveyorRegistry.get(dimId);
    if (!registry) return;
    const key = posKey(pos);
    purgeConveyorEntry(registry, dimId, key);
}

function refreshEnergyAround(block) {
    if (!block?.dimension) return;
    const dim = block.dimension;
    const { x, y, z } = block.location;
    for (const off of [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
    ]) {
        const neighbor = dim.getBlock({ x: x + off.x, y: y + off.y, z: z + off.z });
        if (neighbor?.hasTag?.("dorios:energy")) {
            updatePipes(neighbor, "energy");
        }
    }
}

function getNetworkEnergySources(block, network) {
    if (!block?.dimension || !network) return [];
    const tick = getConveyorTick();
    if (network.energyTick === tick && Array.isArray(network.energySources)) {
        return network.energySources;
    }

    const startPos = network.nodes?.[0];
    const sources = startPos
        ? collectEnergySourcesFromNetwork(block.dimension, startPos)
        : [];

    network.energySources = sources;
    network.energyTick = tick;
    return sources;
}

function canConsumeConveyorEnergy(block, network, amount) {
    if (!amount || amount <= 0) return true;
    if (!block?.dimension || !network) return false;

    const sources = getNetworkEnergySources(block, network);
    if (!sources.length) return false;

    let total = 0;
    for (const source of sources) {
        const entity = getEnergySourceEntityAt(block.dimension, source.pos);
        if (!entity) continue;

        const energy = new Energy(entity);
        const available = energy.get();
        if (available > 0) total += available;
        if (total >= amount) return true;
    }

    return total >= amount;
}

function consumeConveyorEnergy(block, network, amount) {
    if (!amount || amount <= 0) return true;
    if (!block?.dimension || !network) return false;

    const sources = getNetworkEnergySources(block, network);
    if (!sources.length) return false;

    let remaining = amount;
    for (const source of sources) {
        if (remaining <= 0) break;
        const entity = getEnergySourceEntityAt(block.dimension, source.pos);
        if (!entity) continue;

        const energy = new Energy(entity);
        const available = energy.get();
        if (available <= 0) continue;

        const toConsume = Math.min(remaining, available);
        const consumed = energy.consume(toConsume);
        if (consumed > 0) remaining -= consumed;
    }

    return remaining <= 0;
}

function isSorterShape(shape) {
    return shape === "sorter" || shape === "inverted_sorter" || shape === "filter";
}

function processConveyor(block, meta, context = {}) {
    const facing = block.getState?.("minecraft:cardinal_direction") ?? null;
    if (!facing) return;

    switch (meta.shape) {
        case "bridge_transmitter":
            processBridgeTransmitter(block, meta, facing, context);
            return;
        case "router":
            processRouterConveyor(block, meta, facing, context);
            return;
        case "smart_router":
            processSmartRouterConveyor(block, meta, facing, context);
            return;
        case "sorter":
        case "inverted_sorter":
        case "filter":
            processSorterConveyor(block, meta, facing, context);
            return;
        case "overflow":
            processOverflowConveyor(block, meta, facing, context);
            return;
        case "underflow":
            processUnderflowConveyor(block, meta, facing, context);
            return;
        case "junction":
            processJunctionConveyor(block, meta, facing, context);
            return;
        default:
            processStandardConveyor(block, meta, facing, null, context);
    }
}

function processAllConveyors() {
    if (!globalThis.worldLoaded) return;

    for (const [dimId, registry] of conveyorRegistry.entries()) {
        const dim = world.getDimension(dimId);
        if (!dim) continue;

        const networkCache = getConveyorNetworkCache(dim, registry);

        for (const [key, entry] of registry.entries()) {
            const block = dim.getBlock(entry.pos);
            if (!block?.hasTag?.(CONVEYOR_TAG)) {
                purgeConveyorEntry(registry, dimId, key, entry, dim);
                continue;
            }

            const meta = getConveyorMeta(block.typeId) ?? entry.meta;
            if (!meta) {
                purgeConveyorEntry(registry, dimId, key, entry);
                continue;
            }

            const networkId = networkCache.byPos.get(key) ?? null;
            const network = networkId ? networkCache.networks.get(networkId) : null;
            const networkUpgrades = getConveyorUpgrades(networkId, network);
            const upgrades = getConveyorEffectiveUpgrades(block, meta, networkId, network, networkUpgrades);
            const effectiveMeta = applyConveyorUpgrades(meta, upgrades);

            processConveyor(block, effectiveMeta, { networkId, network, upgrades, networkUpgrades });
        }
    }
}

globalThis.utilitycraftConveyorUpgrades = globalThis.utilitycraftConveyorUpgrades ?? {};
globalThis.utilitycraftConveyorUpgrades.isConveyorBlock = block => block?.hasTag?.(CONVEYOR_TAG) ?? false;
globalThis.utilitycraftConveyorUpgrades.getUpgradeTypes = () => CONVEYOR_UPGRADE_TYPES;

DoriosAPI.register.blockComponent("conveyor", {
    beforeOnPlayerPlace(e, { params }) {
        system.run(() => {
            registerConveyor(e.block, params, { persist: true });
            updatePipes(e.block, "energy");
        });
    },
    onPlayerInteract(e, { params }) {
        if (!e?.player || !e.block) return;
        const held = e.player.getComponent("equippable")?.getEquipment("Mainhand") ?? null;
        const meta = getConveyorMeta(e.block.typeId, params);
        if (held?.typeId === "utilitycraft:wrench") {
            if (meta?.shape === "vertical") {
                system.run(() => {
                    try {
                        const current = e.block.getState?.(VERTICAL_DIRECTION_STATE);
                        const next = current === "down" ? "up" : "down";
                        e.block.setState?.(VERTICAL_DIRECTION_STATE, next);
                    } catch {
                        // ignore permutation errors
                    }
                });
                return;
            }
        }

        if (meta?.shape === "smart_router") {
            if (e.player.isSneaking) return;
            system.run(() => {
                openSmartRouterMenu(e.player, e.block);
            });
            return;
        }

        if (isSorterShape(meta?.shape)) {
            if (e.player.isSneaking) {
                system.run(() => {
                    clearSorterFilter(e.block);
                    e.player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.conveyor.sorter.filter_cleared"));
                });
                return;
            }
            system.run(() => {
                openSorterMenu(e.player, e.block, meta);
            });
            return;
        }
    },
    onPlayerBreak(e, { params }) {
        const dimId = e.block.dimension?.id;
        const meta = getConveyorMeta(e.block.typeId, params);
        if (isSorterShape(meta?.shape)) {
            clearSorterFilter(e.block);
        }
        if (dimId) {
            unregisterConveyorAt(dimId, e.block.location);
            unpersistConveyorPosition(dimId, e.block.location);
        }
        system.run(() => {
            refreshEnergyAround(e.block);
        });
    }
});

DoriosAPI.register.blockComponent("conveyor_network_updater", {
    onTick(e) {
        if (!globalThis.worldLoaded) return;
        runConveyorNetworkUpdater(e.block);
    }
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
    if (!block?.hasTag?.(CONVEYOR_TAG)) return;
    system.run(() => {
        registerConveyor(block, null, { persist: true });
        updatePipes(block, "energy");

        const meta = getConveyorMeta(block.typeId);
        if (!meta) return;

        if (meta.shape === "bridge_transmitter") {
            refreshBridgePathFromTransmitter(block, meta, player);
        } else if (meta.shape === "bridge_receiver") {
            refreshBridgePathsForReceiver(block.dimension, block.location, meta, player);
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player }) => {
    if (!brokenBlockPermutation?.hasTag?.(CONVEYOR_TAG)) return;
    unregisterConveyorAt(block.dimension?.id, block.location);
    if (block.dimension?.id) {
        unpersistConveyorPosition(block.dimension.id, block.location);
    }
    system.run(() => {
        const meta = getConveyorMeta(brokenBlockPermutation.type.id);
        let facing = null;
        try {
            facing = brokenBlockPermutation.getState("minecraft:cardinal_direction");
        } catch {
            facing = null;
        }

        if (meta?.shape === "bridge_transmitter" && facing) {
            clearBridgePath(block, meta.tier, facing, meta.bridgeRange);
        }

        if (meta?.shape === "bridge_receiver") {
            refreshBridgePathsForReceiver(block.dimension, block.location, meta, player);
        }

        if (meta?.shape === "smart_router") {
            removeSmartRouterConfig(getSmartRouterId(block));
        }

        if (isSorterShape(meta?.shape)) {
            clearSorterFilterAt(block.dimension?.id, block.location);
        }

        refreshEnergyAround(block);
    });
});

world.afterEvents.worldLoad.subscribe(() => {
    scheduleConveyorRestore();
});

world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    scheduleConveyorRestore();
});

system.runInterval(() => {
    processAllConveyors();
}, 2);

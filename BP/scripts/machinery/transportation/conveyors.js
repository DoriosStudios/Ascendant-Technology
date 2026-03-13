import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { updatePipes, Energy } from "../../DoriosCore/index.js";

const CONVEYOR_TAG = "dorios:conveyor";
const BRIDGE_TAG = "dorios:conveyor_bridge";
const LEGACY_BRIDGE_PATH_BLOCK_ID = "utilitycraft:conveyor_bridge_path";
const BRIDGE_PATH_BY_TIER = Object.freeze({
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
});
const AIR_BLOCK_IDS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);

const BRIDGE_PATH_DIRECTION_STATE = "utilitycraft:cardinal_direction";

const BRIDGE_CLEARABLE_BLOCKS = new Set([
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
]);

const BRIDGE_CLEARABLE_SUFFIXES = ["_sapling", "_fungus", "_mushroom", "_flower", "_tulip"];

const SPECIAL_CONVEYOR_TIER = "universal";
const SPECIAL_CONVEYOR_IPS = 5;
const SPECIAL_CONVEYOR_ENERGY_COST = 10;
const ITEM_SPACING = 0.35;
const INCLINED_DETECTION_RADIUS = 0.75;

const ITEM_MOVE_TICK_PROP = "utilitycraft:conveyor_move_tick";
const ITEM_MOVE_KEY_PROP = "utilitycraft:conveyor_move_key";
const ENTITY_MOVE_TICK_PROP = "utilitycraft:conveyor_entity_move_tick";
const ENTITY_MOVE_KEY_PROP = "utilitycraft:conveyor_entity_move_key";
const CONVEYOR_CREATURE_EXCLUDED_TYPES = [
    "minecraft:player",
    "minecraft:item",
    "minecraft:xp_orb",
    "minecraft:minecart",
    "minecraft:hopper_minecart",
    "minecraft:tnt_minecart",
    "minecraft:command_block_minecart",
    "minecraft:spawner_minecart",
    "minecraft:chest_minecart",
    "minecraft:boat",
    "minecraft:chest_boat",
    "minecraft:armor_stand",
    "minecraft:lightning_bolt",
    "minecraft:falling_block"
];
const CONVEYOR_CREATURE_EXCLUDED_FAMILIES = [
    "player",
    "inanimate",
    "projectile",
    "machine",
    "dorios:energy_container",
    "dorios:fluid_container",
    "dorios:battery"
];
const CONVEYOR_PERSIST_CHUNK_PREFIX = "utilitycraft:conveyor_chunk";
const CONVEYOR_PERSIST_CHUNK_INDEX_META_PREFIX = "utilitycraft:conveyor_chunk_index";
const CONVEYOR_PERSIST_CHUNK_INDEX_PAGE_PREFIX = "utilitycraft:conveyor_chunk_index_page";
const CONVEYOR_PERSIST_CHUNK_PAGE_SIZE = 200;
const MAX_CONVEYOR_ENERGY_SCAN = 2048;
const CONVEYOR_UPGRADE_TYPES = new Set([
    "energy",
    "filter",
    "hyper",
    "quantity",
    "range",
    "size",
    "speed",
    "ultimate"
]);
const CONVEYOR_NETWORK_DIRTY = new Set();
const CONVEYOR_NETWORK_CACHE = new Map();
const CONVEYOR_NETWORK_UPDATER_INTERVAL_DEFAULT = 80;
const CONVEYOR_NETWORK_UPDATER_MAX_SCAN = 4096;
const VERTICAL_DIRECTION_STATE = "utilitycraft:vertical_direction";
const WRENCH_ITEM_ID = "utilitycraft:wrench";

const CONVEYOR_UPGRADE_MAX = 64;
const CONVEYOR_UPGRADE_KEY_PREFIX = "utilitycraft:conveyor_upgrade";
const CONVEYOR_UPGRADE_TYPE_KEY_PREFIX = "utilitycraft:conveyor_upgrade_type";
const CONVEYOR_UPGRADE_BLOCK_KEY_PREFIX = "utilitycraft:conveyor_upgrade_block";
const GLOBAL_CONVEYOR_UPGRADE_KEY = "utilitycraft:conveyor_upgrade_global";
const SMART_ROUTER_KEY_PREFIX = "smart_router";
const SMART_ROUTER_DEFAULT = Object.freeze({ left: [], front: [], right: [] });
const SMART_ROUTER_DIRS = ["left", "front", "right"];

const ITEM_JUNCTION_DIR_PROP = "utilitycraft:junction_dir";
const ITEM_JUNCTION_BLOCK_PROP = "utilitycraft:junction_block";

const normalizeRawMessageArg = value => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return value;
    return String(value);
};

const tr = (key, withArgs = []) => ({
    translate: key,
    with: withArgs.map(normalizeRawMessageArg)
});

const PROCESS_INTERVAL = 2;
const BASE_IPS = 5;
const BASE_SPEED = 0.05;
const BASE_VERTICAL_SPEED = 0.12;
const MAX_SPEED = 0.2;
const MAX_VERTICAL_SPEED = 0.3;
const AETHERIUM_SPEED_MULTIPLIER = 5;
const ROUTER_DIRECTION_CHANGE_DELAY = 6;

const CARDINAL_OFFSETS = Object.freeze({
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    east: { x: 1, y: 0, z: 0 },
    west: { x: -1, y: 0, z: 0 }
});

const ENERGY_OFFSETS = Object.freeze([
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 }
]);

const OPPOSITE_CARDINAL = Object.freeze({
    north: "south",
    south: "north",
    east: "west",
    west: "east"
});

const RIGHT_CARDINAL = Object.freeze({
    north: "east",
    east: "south",
    south: "west",
    west: "north"
});

const LEFT_CARDINAL = Object.freeze({
    north: "west",
    west: "south",
    south: "east",
    east: "north"
});

const conveyorRegistry = new Map();
const bridgeCache = new Map();
const routerDirectionCache = new Map();
const overflowCycleCache = new Map();
const underflowCycleCache = new Map();
const CONVEYOR_META_BY_TYPE = new Map();

function defineConveyorType(id, meta) {
    CONVEYOR_META_BY_TYPE.set(id, Object.freeze({ ...meta }));
}

const TIERS = [
    { tier: "copper", ips: 5, bridgeRange: 8 },
    { tier: "titanium", ips: 11, bridgeRange: 16 },
    { tier: "aetherium", ips: 128, bridgeRange: 32 }
];

const SHAPES = ["horizontal", "inclined", "declined", "vertical"];

for (const tier of TIERS) {
    for (const shape of SHAPES) {
        defineConveyorType(`utilitycraft:${tier.tier}_conveyor_${shape}`, {
            tier: tier.tier,
            shape,
            ips: tier.ips,
            bridgeRange: tier.bridgeRange
        });
    }

    defineConveyorType(`utilitycraft:${tier.tier}_conveyor_bridge_transmitter`, {
        tier: tier.tier,
        shape: "bridge_transmitter",
        ips: tier.ips,
        bridgeRange: tier.bridgeRange
    });

    defineConveyorType(`utilitycraft:${tier.tier}_conveyor_bridge_receiver`, {
        tier: tier.tier,
        shape: "bridge_receiver",
        ips: tier.ips,
        bridgeRange: tier.bridgeRange
    });
}

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

    while (queue.length && steps < MAX_CONVEYOR_ENERGY_SCAN) {
        const pos = queue.shift();
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        const block = dim.getBlock(pos);
        if (!block?.hasTag?.("dorios:energy")) continue;

        if (isEnergyTubeBlock(block)) {
            for (const off of ENERGY_OFFSETS) {
                queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
            }
            if (block.hasTag?.(BRIDGE_TAG)) {
                const meta = getConveyorMeta(block.typeId);
                if (meta?.shape === "bridge_transmitter") {
                    const facing = getFacing(block);
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
            const facing = getFacing(block);
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

function notifyBridgeObstructed(player) {
    if (!player?.onScreenDisplay) return;
    try {
        player.onScreenDisplay.setActionBar(tr("ui.utilitycraft.conveyor.bridge_obstructed"));
    } catch {
        system.run(() => {
            player.onScreenDisplay.setActionBar(tr("ui.utilitycraft.conveyor.bridge_obstructed"));
        });
    }
}

function isAirLike(block) {
    if (!block) return false;
    if (block.isAir === true) return true;
    return AIR_BLOCK_IDS.has(block.typeId);
}

function isLegacyBridgePathBlock(block) {
    if (!block) return false;
    if (block.typeId === LEGACY_BRIDGE_PATH_BLOCK_ID) return true;
    return block.hasTag?.("dorios:conveyor_bridge_path") ?? false;
}

function getBridgePathDefinition(tier) {
    if (!tier) return null;
    return BRIDGE_PATH_BY_TIER[tier] ?? null;
}

function getBridgePathBlockId(tier) {
    const def = getBridgePathDefinition(tier);
    return def?.id ?? LEGACY_BRIDGE_PATH_BLOCK_ID;
}

function isBridgePathBlock(block, tier = null) {
    if (!block) return false;
    if (tier) {
        const def = getBridgePathDefinition(tier);
        if (!def) return false;
        if (block.typeId === def.id) return true;
        return block.hasTag?.(def.tag) ?? false;
    }

    if (isLegacyBridgePathBlock(block)) return true;

    for (const def of Object.values(BRIDGE_PATH_BY_TIER)) {
        if (block.typeId === def.id) return true;
        if (block.hasTag?.(def.tag)) return true;
    }
    return false;
}

function matchesClearableSuffix(typeId) {
    if (typeof typeId !== "string") return false;
    return BRIDGE_CLEARABLE_SUFFIXES.some(suffix => typeId.endsWith(suffix));
}

function isBridgeClearableBlock(block) {
    if (!block) return false;
    if (isAirLike(block)) return false;
    if (isBridgePathBlock(block)) return false;

    const typeId = block.typeId;
    const unbreakables = DoriosAPI?.constants?.unbreakableBlocks;
    if (Array.isArray(unbreakables) && unbreakables.includes(typeId)) return false;

    if (block.hasTag?.("minecraft:replaceable")) return true;
    if (block.hasTag?.("minecraft:replaceable_plants")) return true;
    if (block.hasTag?.("minecraft:plant")) return true;

    if (BRIDGE_CLEARABLE_BLOCKS.has(typeId)) return true;
    if (matchesClearableSuffix(typeId)) return true;

    return false;
}

function getSmartRouterId(block) {
    const { x, y, z } = block.location;
    const dimId = block.dimension?.id ?? "unknown";
    return `${SMART_ROUTER_KEY_PREFIX}_${dimId}_${x}_${y}_${z}`;
}

function getSmartRouterConfig(id) {
    const raw = world.getDynamicProperty(id);
    if (typeof raw !== "string" || raw.length === 0) {
        return { ...SMART_ROUTER_DEFAULT };
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            left: Array.isArray(parsed.left) ? parsed.left : [],
            front: Array.isArray(parsed.front) ? parsed.front : [],
            right: Array.isArray(parsed.right) ? parsed.right : []
        };
    } catch {
        return { ...SMART_ROUTER_DEFAULT };
    }
}

function saveSmartRouterConfig(id, config) {
    const normalizeList = list => Array.from(new Set((list ?? []).map(v => String(v).toLowerCase())));
    const payload = {
        left: normalizeList(config.left),
        front: normalizeList(config.front),
        right: normalizeList(config.right)
    };
    world.setDynamicProperty(id, JSON.stringify(payload));
}

function removeSmartRouterConfig(id) {
    world.setDynamicProperty(id, "");
}

function resolveSmartRouterOutput(config, itemId) {
    const normalized = String(itemId ?? "").toLowerCase();
    if (!normalized) return null;
    if (config.left.includes(normalized)) return "left";
    if (config.front.includes(normalized)) return "front";
    if (config.right.includes(normalized)) return "right";
    return null;
}

function assignSmartRouterItem(config, direction, itemId) {
    const normalized = String(itemId ?? "").toLowerCase();
    if (!normalized) return config;
    const next = {
        left: config.left.filter(id => id !== normalized),
        front: config.front.filter(id => id !== normalized),
        right: config.right.filter(id => id !== normalized)
    };
    if (SMART_ROUTER_DIRS.includes(direction)) {
        next[direction] = [...next[direction], normalized];
    }
    return next;
}

function removeSmartRouterItem(config, itemId) {
    const normalized = String(itemId ?? "").toLowerCase();
    if (!normalized) return config;
    return {
        left: config.left.filter(id => id !== normalized),
        front: config.front.filter(id => id !== normalized),
        right: config.right.filter(id => id !== normalized)
    };
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

function saveConveyorUpgrades(networkId, levels, network = null) {
    const key = getConveyorUpgradeKey(networkId);
    const normalized = normalizeConveyorUpgrades(levels);
    world.setDynamicProperty(key, JSON.stringify(normalized));
    if (network) {
        network.upgrades = normalized;
        network.upgradeKey = key;
    }
    return normalized;
}

function saveConveyorUpgradesForKey(key, levels) {
    if (!key) return normalizeConveyorUpgrades(levels);
    const normalized = normalizeConveyorUpgrades(levels);
    world.setDynamicProperty(key, JSON.stringify(normalized));
    return normalized;
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

function getPlayerHeldItem(player) {
    if (!player) return null;
    const inv = player.getComponent("inventory")?.container;
    if (!inv) return null;
    const slot = player.selectedSlot;
    if (slot === undefined || slot === null) return null;
    return inv.getItem(slot);
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

function getConveyorNetworkContext(block, params) {
    if (!block?.dimension) return { networkId: null, network: null, meta: null };
    const dimId = block.dimension.id;
    const registry = getRegistryForDimension(dimId);
    const key = posKey(block.location);

    if (!registry.has(key)) {
        registerConveyor(block, params, { persist: true });
    }

    const entry = registry.get(key);
    const meta = getConveyorMeta(block.typeId, params) ?? entry?.meta ?? null;
    const networkCache = getConveyorNetworkCache(block.dimension, registry);
    const networkId = networkCache.byPos.get(key) ?? null;
    const network = networkId ? networkCache.networks.get(networkId) : null;

    return { networkId, network, meta };
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

function findBridgeTransmittersForReceiver(dim, receiver, receiverMeta) {
    if (!dim || !receiver || !receiverMeta?.bridgeRange) return [];
    const transmitters = [];
    const pos = receiver.location;

    for (const [dir, offset] of Object.entries(CARDINAL_OFFSETS)) {
        for (let step = 1; step <= receiverMeta.bridgeRange; step++) {
            const targetPos = {
                x: pos.x + offset.x * step,
                y: pos.y,
                z: pos.z + offset.z * step
            };
            const candidate = dim.getBlock(targetPos);
            if (!candidate?.hasTag?.(BRIDGE_TAG)) continue;

            const candidateMeta = getConveyorMeta(candidate.typeId);
            if (!candidateMeta || candidateMeta.shape !== "bridge_transmitter") continue;
            if (candidateMeta.tier !== receiverMeta.tier) continue;

            const facing = getFacing(candidate);
            if (facing !== OPPOSITE_CARDINAL[dir]) continue;

            const link = evaluateBridgeLink(candidate, candidateMeta, facing);
            if (link.receiver && posKey(link.receiver.location) === posKey(receiver.location) && !link.obstructed) {
                transmitters.push(candidate);
            }
        }
    }

    return transmitters;
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
            const facing = getFacing(block);
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

function unregisterConveyorAt(dimId, pos) {
    if (!dimId || !pos) return;
    const registry = conveyorRegistry.get(dimId);
    if (!registry) return;
    const key = posKey(pos);
    registry.delete(key);
    bridgeCache.delete(key);
    routerDirectionCache.delete(key);
    overflowCycleCache.delete(key);
    underflowCycleCache.delete(key);
    markConveyorNetworkDirty(dimId);
}

function refreshEnergyAround(block) {
    if (!block?.dimension) return;
    const dim = block.dimension;
    const { x, y, z } = block.location;
    const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
    ];

    for (const off of offsets) {
        const neighbor = dim.getBlock({ x: x + off.x, y: y + off.y, z: z + off.z });
        if (neighbor?.hasTag?.("dorios:energy")) {
            updatePipes(neighbor, "energy");
        }
    }
}

function getFacing(block) {
    try {
        return block.permutation.getState("minecraft:cardinal_direction");
    } catch {
        return null;
    }
}

function getFacingFromPermutation(permutation) {
    try {
        return permutation.getState("minecraft:cardinal_direction");
    } catch {
        return null;
    }
}

function getVerticalDirection(block) {
    if (!block?.permutation) return "up";
    try {
        const state = block.permutation.getState(VERTICAL_DIRECTION_STATE);
        return state === "down" ? "down" : "up";
    } catch {
        return "up";
    }
}

function toggleVerticalDirection(block) {
    if (!block?.permutation) return false;
    const current = getVerticalDirection(block);
    const next = current === "down" ? "up" : "down";
    try {
        block.setPermutation(block.permutation.withState(VERTICAL_DIRECTION_STATE, next));
        return true;
    } catch {
        return false;
    }
}

function getSpeed(ips) {
    const normalized = Number.isFinite(ips) && ips > 0 ? ips : BASE_IPS;
    return Math.min(MAX_SPEED, BASE_SPEED * (normalized / BASE_IPS));
}

function getVerticalSpeed(ips) {
    const normalized = Number.isFinite(ips) && ips > 0 ? ips : BASE_IPS;
    return Math.min(MAX_VERTICAL_SPEED, BASE_VERTICAL_SPEED * (normalized / BASE_IPS));
}

function getConveyorSpeed(meta) {
    const base = getSpeed(meta?.ips);
    if (meta?.tier === "aetherium") return base * AETHERIUM_SPEED_MULTIPLIER;
    return base;
}

function getConveyorVerticalSpeed(meta) {
    const base = getVerticalSpeed(meta?.ips);
    if (meta?.tier === "aetherium") return base * AETHERIUM_SPEED_MULTIPLIER;
    return base;
}

function resolveOutputOffset(shape, facing) {
    if (shape === "vertical") return { x: 0, y: 1, z: 0 };

    const base = CARDINAL_OFFSETS[facing] ?? { x: 0, y: 0, z: 0 };

    if (shape === "inclined") return { x: base.x, y: 1, z: base.z };
    if (shape === "declined") return { x: base.x, y: -1, z: base.z };

    return base;
}

function getItemsNear(block, radius = 0.9) {
    const { x, y, z } = block.location;
    const center = { x: x + 0.5, y: y + 0.4, z: z + 0.5 };
    return block.dimension.getEntities({
        type: "minecraft:item",
        location: center,
        maxDistance: radius
    });
}

function getCreaturesNear(block, radius = 0.9) {
    const { x, y, z } = block.location;
    const center = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    return block.dimension.getEntities({
        location: center,
        maxDistance: radius,
        excludeTypes: CONVEYOR_CREATURE_EXCLUDED_TYPES,
        excludeFamilies: CONVEYOR_CREATURE_EXCLUDED_FAMILIES
    });
}

function getItemStackFromEntity(item) {
    if (!item) return null;
    return item.getComponent("minecraft:item")?.itemStack ?? null;
}

function getConveyorTick() {
    return Math.max(0, Math.floor(Number(globalThis.tickCount ?? 0)));
}

function hasItemMovedThisTick(item) {
    if (!item?.getDynamicProperty) return false;
    const lastTick = Number(item.getDynamicProperty(ITEM_MOVE_TICK_PROP) ?? -1);
    return lastTick === getConveyorTick();
}

function hasEntityMovedThisTick(entity) {
    if (!entity?.getDynamicProperty) return false;
    const lastTick = Number(entity.getDynamicProperty(ENTITY_MOVE_TICK_PROP) ?? -1);
    return lastTick === getConveyorTick();
}

function markItemMoved(item, blockKey) {
    if (!item?.setDynamicProperty) return;
    const tick = getConveyorTick();
    try {
        item.setDynamicProperty(ITEM_MOVE_TICK_PROP, tick);
        if (blockKey) item.setDynamicProperty(ITEM_MOVE_KEY_PROP, blockKey);
    } catch {
        // ignore dynamic property failures
    }
}

function markEntityMoved(entity, blockKey) {
    if (!entity?.setDynamicProperty) return;
    const tick = getConveyorTick();
    try {
        entity.setDynamicProperty(ENTITY_MOVE_TICK_PROP, tick);
        if (blockKey) entity.setDynamicProperty(ENTITY_MOVE_KEY_PROP, blockKey);
    } catch {
        // ignore dynamic property failures
    }
}

function getDirectionAxis(direction) {
    if (direction === "up" || direction === "down") return "y";
    if (direction === "east" || direction === "west") return "x";
    return "z";
}

function isDirectionPositive(direction) {
    return direction === "east" || direction === "south" || direction === "up";
}

function canMoveItemWithSpacing(item, items, direction) {
    if (!item || !Array.isArray(items) || items.length <= 1) return true;
    if (!direction) return true;

    const axis = getDirectionAxis(direction);
    const sign = isDirectionPositive(direction) ? 1 : -1;
    const value = item.location?.[axis] ?? 0;

    for (const other of items) {
        if (!other || other === item) continue;
        const otherValue = other.location?.[axis] ?? 0;
        const delta = (otherValue - value) * sign;
        if (delta > 0 && delta < ITEM_SPACING) {
            return false;
        }
    }

    return true;
}

function shouldHoldAetheriumItem(meta, item) {
    if (meta?.tier !== "aetherium") return false;
    const stack = getItemStackFromEntity(item);
    if (!stack) return false;
    if (stack.maxAmount < 64) return false;
    return stack.amount < stack.maxAmount;
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

function tryInsertIntoContainer(item, block, outputOffset) {
    if (!item || !block?.dimension || !outputOffset) return false;

    const target = {
        x: block.location.x + outputOffset.x,
        y: block.location.y + outputOffset.y,
        z: block.location.z + outputOffset.z
    };

    const itemComp = item.getComponent("minecraft:item");
    const stack = itemComp?.itemStack;
    if (!stack) return false;

    const result = DoriosAPI?.containers?.addItemAt?.(target, block.dimension, stack);

    if (result === true) {
        item.remove();
        return true;
    }

    if (typeof result === "number" && result > 0) {
        const remaining = stack.amount - result;
        const spawnLoc = item.location;
        item.remove();
        if (remaining > 0) {
            const leftover = typeof stack.clone === "function" ? stack.clone() : stack;
            leftover.amount = remaining;
            block.dimension.spawnItem(leftover, spawnLoc);
        }
        return true;
    }

    return false;
}

function moveItem(item, delta, block, centerStrength = 0) {
    if (!item || !delta) return;

    const current = item.location;
    const target = {
        x: current.x + delta.x,
        y: current.y + delta.y,
        z: current.z + delta.z
    };

    if (centerStrength > 0 && block) {
        const centerX = block.location.x + 0.5;
        const centerZ = block.location.z + 0.5;
        target.x += (centerX - target.x) * centerStrength;
        target.z += (centerZ - target.z) * centerStrength;
    }

    item.teleport(target);
}

function moveEntity(entity, delta, block, centerStrength = 0) {
    if (!entity || !delta) return;

    const current = entity.location;
    const target = {
        x: current.x + delta.x,
        y: current.y + delta.y,
        z: current.z + delta.z
    };

    if (centerStrength > 0 && block) {
        const centerX = block.location.x + 0.5;
        const centerZ = block.location.z + 0.5;
        target.x += (centerX - target.x) * centerStrength;
        target.z += (centerZ - target.z) * centerStrength;
    }

    try {
        entity.teleport(target);
    } catch {
        // ignore teleport errors
    }
}

function getRelativeDirections(facing) {
    return {
        front: facing,
        back: OPPOSITE_CARDINAL[facing],
        right: RIGHT_CARDINAL[facing],
        left: LEFT_CARDINAL[facing]
    };
}

function getTargetBlock(block, direction) {
    if (!block?.dimension || !direction) return null;
    const offset = CARDINAL_OFFSETS[direction];
    if (!offset) return null;
    const pos = {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    };
    return block.dimension.getBlock(pos);
}

function isOutputPassable(block, direction) {
    const target = getTargetBlock(block, direction);
    if (!target) return false;
    if (isAirLike(target)) return true;
    if (isBridgePathBlock(target) || isLegacyBridgePathBlock(target)) return true;
    if (target.hasTag?.(CONVEYOR_TAG)) return true;
    if (target.getComponent("minecraft:inventory")?.container) return true;

    const entities = block.dimension.getEntitiesAtBlockLocation(target.location);
    for (const entity of entities) {
        if (entity?.getComponent("minecraft:inventory")?.container) return true;
    }

    return false;
}

function hasContainerAt(block, direction) {
    const target = getTargetBlock(block, direction);
    if (!target) return false;
    if (target.getComponent("minecraft:inventory")?.container) return true;

    const entities = block.dimension.getEntitiesAtBlockLocation(target.location);
    for (const entity of entities) {
        if (entity?.getComponent("minecraft:inventory")?.container) return true;
    }

    return false;
}

function pickRandomDirection(options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    const index = Math.floor(Math.random() * options.length);
    return options[index] ?? null;
}

function resolveRouterDirection(block, key, options) {
    if (!block || !key || !Array.isArray(options) || options.length === 0) return null;
    const tick = getConveyorTick();
    const passableOptions = options.filter(dir => isOutputPassable(block, dir));
    if (passableOptions.length === 0) {
        routerDirectionCache.delete(key);
        return null;
    }
    const cached = routerDirectionCache.get(key);
    const cachedDir = cached?.dir ?? null;
    const shouldSwitch =
        !cached ||
        tick >= (cached?.nextSwitchTick ?? 0) ||
        (cachedDir && !passableOptions.includes(cachedDir));

    if (!shouldSwitch && cachedDir) return cachedDir;

    let nextDir = passableOptions[0] ?? null;
    if (cachedDir) {
        const idx = passableOptions.indexOf(cachedDir);
        if (idx >= 0) {
            nextDir = passableOptions[(idx + 1) % passableOptions.length] ?? nextDir;
        }
    }

    if (nextDir) {
        routerDirectionCache.set(key, {
            dir: nextDir,
            nextSwitchTick: tick + ROUTER_DIRECTION_CHANGE_DELAY
        });
    }

    return nextDir;
}

function moveItemInDirection(item, block, meta, direction) {
    const offset = CARDINAL_OFFSETS[direction];
    if (!offset) return;

    const speed = getConveyorSpeed(meta);
    const delta = { x: offset.x * speed, y: 0, z: offset.z * speed };
    const outputOffset = resolveOutputOffset("horizontal", direction);
    if (tryInsertIntoContainer(item, block, outputOffset)) return;
    moveItem(item, delta, block);
}

function teleportItemToDirection(item, block, direction) {
    if (!item || !block || !direction) return;
    const offset = CARDINAL_OFFSETS[direction];
    if (!offset) return;
    const target = {
        x: block.location.x + offset.x + 0.5,
        y: block.location.y + 0.1,
        z: block.location.z + offset.z + 0.5
    };
    item.teleport(target);
}

function trySendItemInstant(item, block, direction) {
    if (!item || !block || !direction) return false;
    const outputOffset = resolveOutputOffset("horizontal", direction);
    if (tryInsertIntoContainer(item, block, outputOffset)) return true;
    teleportItemToDirection(item, block, direction);
    return true;
}

function getCycleIndex(cache, key, max) {
    const stored = cache.get(key);
    const numeric = Number.isFinite(stored) ? stored : 0;
    return Math.max(0, Math.min(numeric, max));
}

function setCycleIndex(cache, key, value, max) {
    const numeric = Number.isFinite(value) ? value : 0;
    cache.set(key, Math.max(0, Math.min(numeric, max)));
}

function formatItemLabel(id) {
    if (!id) return "";
    if (DoriosAPI?.utils?.formatIdToText) return DoriosAPI.utils.formatIdToText(id);
    return String(id);
}

function openSmartRouterMenu(player, block) {
    if (!player || !block) return;
    const smartRouterId = getSmartRouterId(block);
    const config = getSmartRouterConfig(smartRouterId);
    const hand = player.getComponent("equippable")?.getEquipment("Mainhand");
    const heldId = hand?.typeId ?? "";
    const heldLabel = formatItemLabel(heldId);

    const form = new ActionFormData()
        .title(tr("ui.utilitycraft.smart_router.title"))
        .body(
            heldId
                ? tr("ui.utilitycraft.smart_router.body_held", [heldLabel])
                : tr("ui.utilitycraft.smart_router.body_empty")
        );

    const actions = [];

    if (heldId) {
        form.button(tr("ui.utilitycraft.smart_router.button.assign_left"));
        actions.push("assign_left");
        form.button(tr("ui.utilitycraft.smart_router.button.assign_front"));
        actions.push("assign_front");
        form.button(tr("ui.utilitycraft.smart_router.button.assign_right"));
        actions.push("assign_right");
        form.button(tr("ui.utilitycraft.smart_router.button.remove_item"));
        actions.push("remove_item");
    }

    form.button(tr("ui.utilitycraft.smart_router.button.view"));
    actions.push("view");
    form.button(tr("ui.utilitycraft.smart_router.button.clear_all"));
    actions.push("clear_all");
    form.button(tr("ui.utilitycraft.smart_router.button.close"));
    actions.push("close");

    form.show(player).then(response => {
        if (response.canceled || response.selection === undefined) return;
        const action = actions[response.selection];
        if (!action) return;

        if (action.startsWith("assign_")) {
            const direction = action.replace("assign_", "");
            const nextConfig = assignSmartRouterItem(config, direction, heldId);
            saveSmartRouterConfig(smartRouterId, nextConfig);
            player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.smart_router.saved"));
            return;
        }

        if (action === "remove_item") {
            const nextConfig = removeSmartRouterItem(config, heldId);
            saveSmartRouterConfig(smartRouterId, nextConfig);
            player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.smart_router.removed"));
            return;
        }

        if (action === "view") {
            const lines = [];
            for (const dir of SMART_ROUTER_DIRS) {
                const list = config[dir] ?? [];
                const label = dir.charAt(0).toUpperCase() + dir.slice(1);
                const items = list.length ? list.map(formatItemLabel).join(", ") : "-";
                lines.push(`${label}: ${items}`);
            }
            player.sendMessage(lines.join("\n"));
            return;
        }

        if (action === "clear_all") {
            saveSmartRouterConfig(smartRouterId, SMART_ROUTER_DEFAULT);
            player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.smart_router.cleared"));
            return;
        }
    });
}

function processRouterConveyor(block, meta, facing, context = {}) {
    const key = posKey(block.location);
    const dirs = getRelativeDirections(facing);
    const options = [dirs.front, dirs.right, dirs.left].filter(Boolean);
    const selected = resolveRouterDirection(block, key, options);
    if (!selected) return;

    const items = getItemsNear(block, 0.9);
    if (!items?.length && meta?.tier !== "aetherium") return;

    for (const item of items) {
        if (hasItemMovedThisTick(item)) continue;
        const stack = getItemStackFromEntity(item);
        if (!stack) continue;
        if (shouldHoldAetheriumItem(meta, item)) continue;
        if (!isOutputPassable(block, selected)) continue;
        if (!canMoveItemWithSpacing(item, items, selected)) continue;
        if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
        trySendItemInstant(item, block, selected);
        markItemMoved(item, key);
    }
}

function processSmartRouterConveyor(block, meta, facing, context = {}) {
    const smartRouterId = getSmartRouterId(block);
    const config = getSmartRouterConfig(smartRouterId);
    const dirs = getRelativeDirections(facing);
    const items = getItemsNear(block, 0.9);
    if (!items?.length) return;
    const key = posKey(block.location);

    for (const item of items) {
        if (hasItemMovedThisTick(item)) continue;
        const stack = getItemStackFromEntity(item);
        if (!stack) continue;
        if (shouldHoldAetheriumItem(meta, item)) continue;

        const preferred = resolveSmartRouterOutput(config, stack.typeId);
        const candidates = [];
        if (preferred && dirs[preferred]) candidates.push(dirs[preferred]);
        for (const dirKey of ["front", "right", "left"]) {
            const dir = dirs[dirKey];
            if (dir && !candidates.includes(dir)) candidates.push(dir);
        }

        const selected = candidates.find(dir => isOutputPassable(block, dir)) ?? dirs.front;
        if (!canMoveItemWithSpacing(item, items, selected)) continue;
        if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
        trySendItemInstant(item, block, selected);
        markItemMoved(item, key);
    }
}

function processOverflowConveyor(block, meta, facing, context = {}) {
    const key = posKey(block.location);
    const dirs = getRelativeDirections(facing);
    let cycleIndex = getCycleIndex(overflowCycleCache, key, 1);

    const items = getItemsNear(block, 0.9);
    if (!items?.length) return;

    for (const item of items) {
        if (hasItemMovedThisTick(item)) continue;
        const stack = getItemStackFromEntity(item);
        if (!stack) continue;
        if (shouldHoldAetheriumItem(meta, item)) continue;
        if (isOutputPassable(block, dirs.front)) {
            if (!canMoveItemWithSpacing(item, items, dirs.front)) continue;
            if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
            trySendItemInstant(item, block, dirs.front);
            markItemMoved(item, key);
            continue;
        }

        const primary = cycleIndex === 0 ? dirs.right : dirs.left;
        const secondary = cycleIndex === 0 ? dirs.left : dirs.right;
        let selected = null;

        if (primary && isOutputPassable(block, primary)) {
            selected = primary;
            cycleIndex = 1 - cycleIndex;
        } else if (secondary && isOutputPassable(block, secondary)) {
            selected = secondary;
            cycleIndex = 1 - cycleIndex;
        } else {
            selected = dirs.front;
        }

        if (!canMoveItemWithSpacing(item, items, selected)) continue;
        if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
        trySendItemInstant(item, block, selected);
        markItemMoved(item, key);
    }

    setCycleIndex(overflowCycleCache, key, cycleIndex, 1);
}

function processUnderflowConveyor(block, meta, facing, context = {}) {
    const key = posKey(block.location);
    const dirs = getRelativeDirections(facing);
    let cycleIndex = getCycleIndex(underflowCycleCache, key, 1);

    const items = getItemsNear(block, 0.9);
    if (!items?.length) return;

    for (const item of items) {
        if (hasItemMovedThisTick(item)) continue;
        const stack = getItemStackFromEntity(item);
        if (!stack) continue;
        if (shouldHoldAetheriumItem(meta, item)) continue;
        const primary = cycleIndex === 0 ? dirs.right : dirs.left;
        const secondary = cycleIndex === 0 ? dirs.left : dirs.right;
        let injected = false;

        if (primary && hasContainerAt(block, primary) && canConsumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) {
            const outputOffset = resolveOutputOffset("horizontal", primary);
            if (tryInsertIntoContainer(item, block, outputOffset)) {
                consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST);
                cycleIndex = 1 - cycleIndex;
                markItemMoved(item, key);
                injected = true;
            }
        }

        if (!injected && secondary && hasContainerAt(block, secondary) && canConsumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) {
            const outputOffset = resolveOutputOffset("horizontal", secondary);
            if (tryInsertIntoContainer(item, block, outputOffset)) {
                consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST);
                cycleIndex = 1 - cycleIndex;
                markItemMoved(item, key);
                injected = true;
            }
        }

        if (injected) continue;

        if (!dirs.front || !isOutputPassable(block, dirs.front)) continue;
        if (!canMoveItemWithSpacing(item, items, dirs.front)) continue;
        if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
        trySendItemInstant(item, block, dirs.front);
        markItemMoved(item, key);
    }

    setCycleIndex(underflowCycleCache, key, cycleIndex, 1);
}

function isItemInsideBlock(item, block) {
    const pos = item?.location;
    if (!pos || !block?.location) return false;
    return (
        Math.floor(pos.x) === block.location.x &&
        Math.floor(pos.y) === block.location.y &&
        Math.floor(pos.z) === block.location.z
    );
}

function resolveJunctionDirection(block, item, facing) {
    if (!item?.location || !block?.location) return facing;
    const lastKey = item?.getDynamicProperty?.(ITEM_MOVE_KEY_PROP);
    const lastPos = parsePosKey(lastKey);
    if (lastPos) {
        const dx = lastPos.x - block.location.x;
        const dy = lastPos.y - block.location.y;
        const dz = lastPos.z - block.location.z;
        if (dy === 0 && Math.abs(dx) + Math.abs(dz) === 1) {
            if (dx === 1) return "west";
            if (dx === -1) return "east";
            if (dz === 1) return "north";
            if (dz === -1) return "south";
        }
    }
    const centerX = block.location.x + 0.5;
    const centerZ = block.location.z + 0.5;
    const dx = item.location.x - centerX;
    const dz = item.location.z - centerZ;

    if (Math.abs(dx) >= Math.abs(dz)) {
        return dx >= 0 ? "west" : "east";
    }
    return dz >= 0 ? "north" : "south";
}

function clearJunctionItemCache(item) {
    try {
        item?.setDynamicProperty?.(ITEM_JUNCTION_BLOCK_PROP, "");
        item?.setDynamicProperty?.(ITEM_JUNCTION_DIR_PROP, "");
    } catch {
        // ignore
    }
}

function getJunctionDirectionForItem(block, item, facing) {
    const blockKey = posKey(block.location);
    const storedKey = item?.getDynamicProperty?.(ITEM_JUNCTION_BLOCK_PROP);
    const storedDir = item?.getDynamicProperty?.(ITEM_JUNCTION_DIR_PROP);

    if (storedKey === blockKey && typeof storedDir === "string" && storedDir.length > 0) {
        if (isOutputPassable(block, storedDir)) return storedDir;
        clearJunctionItemCache(item);
    }

    const resolved = resolveJunctionDirection(block, item, facing);
    if (!resolved) return null;

    let chosen = resolved;
    if (!isOutputPassable(block, chosen)) {
        const opposite = OPPOSITE_CARDINAL[chosen];
        chosen = opposite && isOutputPassable(block, opposite) ? opposite : null;
    }

    if (!chosen) return null;
    try {
        item?.setDynamicProperty?.(ITEM_JUNCTION_BLOCK_PROP, blockKey);
        item?.setDynamicProperty?.(ITEM_JUNCTION_DIR_PROP, chosen);
    } catch {
        // ignore dynamic property issues
    }
    return chosen;
}

function processJunctionConveyor(block, meta, facing, context = {}) {
    const items = getItemsNear(block, 0.9);
    if (!items?.length) return;
    const key = posKey(block.location);

    for (const item of items) {
        if (hasItemMovedThisTick(item)) continue;
        const stack = getItemStackFromEntity(item);
        if (!stack) continue;
        if (shouldHoldAetheriumItem(meta, item)) continue;
        if (!isItemInsideBlock(item, block)) {
            const blockKey = posKey(block.location);
            if (item?.getDynamicProperty?.(ITEM_JUNCTION_BLOCK_PROP) === blockKey) {
                clearJunctionItemCache(item);
            }
        }

        const direction = getJunctionDirectionForItem(block, item, facing);
        if (!direction) continue;
        if (!canMoveItemWithSpacing(item, items, direction)) continue;
        if (!consumeConveyorEnergy(block, context?.network, SPECIAL_CONVEYOR_ENERGY_COST)) continue;
        trySendItemInstant(item, block, direction);
        markItemMoved(item, key);
    }
}

function evaluateBridgeLink(block, meta, facing) {
    if (!block?.dimension || !meta?.bridgeRange) {
        return { receiver: null, obstructed: false, steps: 0 };
    }

    const offset = CARDINAL_OFFSETS[facing];
    if (!offset) {
        return { receiver: null, obstructed: false, steps: 0 };
    }

    let receiver = null;
    let receiverSteps = 0;
    let obstructed = false;

    for (let step = 1; step <= meta.bridgeRange; step++) {
        const targetPos = {
            x: block.location.x + offset.x * step,
            y: block.location.y,
            z: block.location.z + offset.z * step
        };

        const candidate = block.dimension.getBlock(targetPos);
        if (!candidate) continue;

        if (candidate.hasTag?.(BRIDGE_TAG)) {
            const candidateMeta = getConveyorMeta(candidate.typeId);
            if (candidateMeta?.shape === "bridge_receiver" && candidateMeta?.tier === meta.tier) {
                receiver = candidate;
                receiverSteps = step;
                break;
            }
        }

        if (isAirLike(candidate)) continue;
        if (isBridgePathBlock(candidate, meta.tier) || isLegacyBridgePathBlock(candidate)) continue;
        if (isBridgeClearableBlock(candidate)) continue;
        obstructed = true;
    }

    return { receiver, obstructed, steps: receiverSteps };
}

function clearBridgePath(block, tier, facing, range) {
    if (!block?.dimension || !facing || !range) return;
    const offset = CARDINAL_OFFSETS[facing];
    if (!offset) return;

    for (let step = 1; step <= range; step++) {
        const pos = {
            x: block.location.x + offset.x * step,
            y: block.location.y,
            z: block.location.z + offset.z * step
        };
        const target = block.dimension.getBlock(pos);
        if (!target) continue;
        if (target.hasTag?.(BRIDGE_TAG)) break;
        if (isBridgePathBlock(target, tier) || isLegacyBridgePathBlock(target)) {
            target.setType("minecraft:air");
        }
    }
}

function createBridgePath(block, tier, facing, steps) {
    if (!block?.dimension || !facing || !steps) return;
    const offset = CARDINAL_OFFSETS[facing];
    if (!offset) return;
    const pathId = getBridgePathBlockId(tier);

    const applyBridgePathDirection = target => {
        if (!target) return;
        try {
            if (target.permutation?.getState(BRIDGE_PATH_DIRECTION_STATE) !== undefined) {
                target.setPermutation(target.permutation.withState(BRIDGE_PATH_DIRECTION_STATE, facing));
            }
        } catch {
            // ignore permutation errors
        }
    };

    for (let step = 1; step < steps; step++) {
        const pos = {
            x: block.location.x + offset.x * step,
            y: block.location.y,
            z: block.location.z + offset.z * step
        };
        const target = block.dimension.getBlock(pos);
        if (!target) continue;
        if (target.hasTag?.(BRIDGE_TAG)) break;

        if (isBridgeClearableBlock(target)) {
            target.setType("minecraft:air");
        }

        if (isAirLike(target) || isBridgePathBlock(target, tier) || isLegacyBridgePathBlock(target)) {
            target.setType(pathId);
            applyBridgePathDirection(target);
        }
    }
}

function updateBridgeNetworkCache(block, receiver) {
    if (!block?.dimension) return;
    const key = posKey(block.location);
    const nextKey = receiver ? posKey(receiver.location) : null;
    const existing = bridgeCache.get(key);
    const existingKey = existing?.pos ? posKey(existing.pos) : null;

    if (existingKey === nextKey) return;

    if (receiver) {
        bridgeCache.set(key, { pos: { ...receiver.location } });
    } else {
        bridgeCache.delete(key);
    }

    markConveyorNetworkDirty(block.dimension.id);
}

function refreshBridgePathFromTransmitter(block, meta, player) {
    const facing = getFacing(block);
    if (!facing) return;

    clearBridgePath(block, meta.tier, facing, meta.bridgeRange);

    const link = evaluateBridgeLink(block, meta, facing);
    const key = posKey(block.location);

    if (link.receiver && !link.obstructed) {
        createBridgePath(block, meta.tier, facing, link.steps);
        updateBridgeNetworkCache(block, link.receiver);
        updatePipes(block, "energy");
        return;
    }

    updateBridgeNetworkCache(block, null);

    if (link.receiver && link.obstructed) {
        notifyBridgeObstructed(player);
    }

    updatePipes(block, "energy");
}

function refreshBridgePathsForReceiver(dim, pos, meta, player) {
    if (!dim || !pos || !meta?.bridgeRange) return;

    for (const [dir, offset] of Object.entries(CARDINAL_OFFSETS)) {
        for (let step = 1; step <= meta.bridgeRange; step++) {
            const targetPos = {
                x: pos.x + offset.x * step,
                y: pos.y,
                z: pos.z + offset.z * step
            };
            const candidate = dim.getBlock(targetPos);
            if (!candidate?.hasTag?.(BRIDGE_TAG)) continue;

            const candidateMeta = getConveyorMeta(candidate.typeId);
            if (!candidateMeta || candidateMeta.shape !== "bridge_transmitter") continue;
            if (candidateMeta.tier !== meta.tier) continue;

            const facing = getFacing(candidate);
            if (facing !== OPPOSITE_CARDINAL[dir]) continue;

            refreshBridgePathFromTransmitter(candidate, candidateMeta, player);
        }
    }
}

function processBridgeTransmitter(block, meta, facing, context = {}) {
    const link = evaluateBridgeLink(block, meta, facing);
    if (!link.receiver || link.obstructed) {
        updateBridgeNetworkCache(block, null);
        clearBridgePath(block, meta.tier, facing, meta.bridgeRange);
        processStandardConveyor(block, meta, facing, "horizontal", context);
        return;
    }

    updateBridgeNetworkCache(block, link.receiver);

    const items = getItemsNear(block, 0.9);
    if (!items?.length && meta?.tier !== "aetherium") return;

    const receiverCenter = {
        x: link.receiver.location.x + 0.5,
        y: link.receiver.location.y + 0.1,
        z: link.receiver.location.z + 0.5
    };

    const key = posKey(block.location);
    if (items?.length) {
        for (const item of items) {
            if (hasItemMovedThisTick(item)) continue;
            const stack = getItemStackFromEntity(item);
            if (!stack) continue;
            if (shouldHoldAetheriumItem(meta, item)) continue;
            item.teleport(receiverCenter);
            markItemMoved(item, key);
        }
    }

    if (meta?.tier === "aetherium") {
        const creatures = getCreaturesNear(block, 0.9);
        if (!creatures?.length) return;
        for (const entity of creatures) {
            if (entity?.isValid === false) continue;
            if (hasEntityMovedThisTick(entity)) continue;
            try {
                entity.teleport(receiverCenter);
            } catch {
                // ignore teleport errors
            }
            markEntityMoved(entity, key);
        }
    }
}

function processStandardConveyor(block, meta, facing, forcedShape = null, context = {}) {
    const shape = forcedShape ?? meta.shape;
    const baseOffset = CARDINAL_OFFSETS[facing] ?? { x: 0, y: 0, z: 0 };

    const speed = getConveyorSpeed(meta);
    const verticalSpeed = getConveyorVerticalSpeed(meta);
    const verticalDirection = shape === "vertical" ? getVerticalDirection(block) : "up";

    let delta = { x: 0, y: 0, z: 0 };
    let centerStrength = 0;

    switch (shape) {
        case "horizontal":
        case "bridge_receiver":
            delta = { x: baseOffset.x * speed, y: 0, z: baseOffset.z * speed };
            break;
        case "inclined":
            delta = { x: baseOffset.x * speed, y: verticalSpeed, z: baseOffset.z * speed };
            break;
        case "declined":
            delta = { x: baseOffset.x * speed, y: -verticalSpeed, z: baseOffset.z * speed };
            break;
        case "vertical":
            delta = { x: 0, y: verticalDirection === "down" ? -verticalSpeed : verticalSpeed, z: 0 };
            centerStrength = 0.35;
            break;
        default:
            return;
    }

    let outputOffset = resolveOutputOffset(shape, facing);
    if (shape === "vertical" && verticalDirection === "down") {
        outputOffset = { x: 0, y: -1, z: 0 };
    }
    const detectionRadius = shape === "inclined" || shape === "declined" ? INCLINED_DETECTION_RADIUS : 0.9;
    const items = getItemsNear(block, detectionRadius);

    const moveDirection = shape === "vertical" ? verticalDirection : facing;
    const blockKey = posKey(block.location);

    if (items?.length) {
        for (const item of items) {
            if (hasItemMovedThisTick(item)) continue;
            const stack = getItemStackFromEntity(item);
            if (!stack) continue;
            if (shouldHoldAetheriumItem(meta, item)) continue;
            if (!canMoveItemWithSpacing(item, items, moveDirection)) continue;
            if (tryInsertIntoContainer(item, block, outputOffset)) {
                markItemMoved(item, blockKey);
                continue;
            }
            moveItem(item, delta, block, centerStrength);
            markItemMoved(item, blockKey);
        }
    }

    if (meta?.tier === "aetherium") {
        const creatures = getCreaturesNear(block, detectionRadius);
        if (!creatures?.length) return;
        for (const entity of creatures) {
            if (entity?.isValid === false) continue;
            if (hasEntityMovedThisTick(entity)) continue;
            moveEntity(entity, delta, block, centerStrength);
            markEntityMoved(entity, blockKey);
        }
    }
}

function processConveyor(block, meta, context = {}) {
    const facing = getFacing(block);
    if (!facing) return;

    if (meta.shape === "bridge_transmitter") {
        processBridgeTransmitter(block, meta, facing, context);
        return;
    }

    if (meta.shape === "router") {
        processRouterConveyor(block, meta, facing, context);
        return;
    }

    if (meta.shape === "smart_router") {
        processSmartRouterConveyor(block, meta, facing, context);
        return;
    }

    if (meta.shape === "overflow") {
        processOverflowConveyor(block, meta, facing, context);
        return;
    }

    if (meta.shape === "underflow") {
        processUnderflowConveyor(block, meta, facing, context);
        return;
    }

    if (meta.shape === "junction") {
        processJunctionConveyor(block, meta, facing, context);
        return;
    }

    processStandardConveyor(block, meta, facing, null, context);
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
                registry.delete(key);
                bridgeCache.delete(key);
                routerDirectionCache.delete(key);
                overflowCycleCache.delete(key);
                underflowCycleCache.delete(key);
                if (entry.meta?.shape === "smart_router") {
                    removeSmartRouterConfig(getSmartRouterId({ location: entry.pos, dimension: dim }));
                }
                markConveyorNetworkDirty(dimId);
                continue;
            }

            const meta = getConveyorMeta(block.typeId) ?? entry.meta;
            if (!meta) {
                registry.delete(key);
                bridgeCache.delete(key);
                routerDirectionCache.delete(key);
                overflowCycleCache.delete(key);
                underflowCycleCache.delete(key);
                markConveyorNetworkDirty(dimId);
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
        const held = getPlayerHeldItem(e.player);
        if (held?.typeId === WRENCH_ITEM_ID) {
            const meta = getConveyorMeta(e.block.typeId, params);
            if (meta?.shape === "vertical") {
                system.run(() => {
                    toggleVerticalDirection(e.block);
                });
                return;
            }
        }
        if (params?.shape !== "smart_router") return;
        if (e.player.isSneaking) return;
        system.run(() => {
            openSmartRouterMenu(e.player, e.block);
        });
    },
    onPlayerBreak(e, { params }) {
        const dimId = e.block.dimension?.id;
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
        const facing = getFacingFromPermutation(brokenBlockPermutation);

        if (meta?.shape === "bridge_transmitter" && facing) {
            clearBridgePath(block, meta.tier, facing, meta.bridgeRange);
        }

        if (meta?.shape === "bridge_receiver") {
            refreshBridgePathsForReceiver(block.dimension, block.location, meta, player);
        }

        if (meta?.shape === "smart_router") {
            removeSmartRouterConfig(getSmartRouterId(block));
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
}, PROCESS_INTERVAL);
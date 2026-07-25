// @ts-check

import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage } from "DoriosCore/index.js";
import { createPlainConveyors } from "./plainConveyors.js";
import { createBridgeConveyors } from "./bridgeConveyors.js";
import { createSpecialConveyors } from "./specialConveyors.js";

export const CONVEYOR_COMPONENT_ID = "utilitycraft:conveyor";
export const CONVEYOR_UPDATER_COMPONENT_ID = "utilitycraft:conveyor_network_updater";

const CONVEYOR_TAG = "dorios:conveyor";
const BRIDGE_TAG = "dorios:conveyor_bridge";
const MOVEMENT_INTERVAL = 2;
const TOPOLOGY_DEBOUNCE_TICKS = 20;
const TOPOLOGY_BATCH_SIZE = 25;
const PERSIST_PAGE_SIZE = 200;
const ITEM_SPACING = 0.35;
const SPECIAL_ENERGY_COST = 10;
const SPECIAL_BLOCKS_PER_SECOND = 5;
const ROUTER_CYCLE_TICKS = 10;
const VERTICAL_DIRECTION_STATE = "utilitycraft:vertical_direction";
const BRIDGE_DIRECTION_STATE = "utilitycraft:cardinal_direction";
const LEGACY_BRIDGE_PATH_ID = "utilitycraft:conveyor_bridge_path";
const PERSIST_CHUNK_PREFIX = "utilitycraft:conveyor_chunk";
const PERSIST_INDEX_PREFIX = "utilitycraft:conveyor_chunk_index";
const PERSIST_INDEX_PAGE_PREFIX = "utilitycraft:conveyor_chunk_index_page";

const TIERS = [
    { id: "copper", blocksPerSecond: 1, bridgeRange: 8 },
    { id: "titanium", blocksPerSecond: 2, bridgeRange: 16 },
    { id: "aetherium", blocksPerSecond: 5, bridgeRange: 32 },
];
const PLAIN_SHAPES = ["horizontal", "inclined", "declined", "vertical"];
const SPECIAL_SHAPES = [
    "junction",
    "overflow",
    "router",
    "smart_router",
    "underflow",
    "sorter",
    "inverted_sorter",
];
const SPECIAL_SHAPE_SET = new Set(SPECIAL_SHAPES);
const HORIZONTAL_DIRECTIONS = ["north", "east", "south", "west"];
const DIRECTION_VECTORS = {
    north: { x: 0, y: 0, z: -1 },
    east: { x: 1, y: 0, z: 0 },
    south: { x: 0, y: 0, z: 1 },
    west: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    down: { x: 0, y: -1, z: 0 },
};
const OFFSETS = Object.values(DIRECTION_VECTORS);
const OPPOSITE_DIRECTIONS = {
    north: "south", south: "north", east: "west", west: "east", up: "down", down: "up",
};
const LEFT_DIRECTIONS = { north: "west", west: "south", south: "east", east: "north" };
const RIGHT_DIRECTIONS = { north: "east", east: "south", south: "west", west: "north" };
const BRIDGE_PATHS = {
    copper: { id: "utilitycraft:copper_conveyor_bridge_path", tag: "dorios:conveyor_bridge_path_copper" },
    titanium: { id: "utilitycraft:titanium_conveyor_bridge_path", tag: "dorios:conveyor_bridge_path_titanium" },
    aetherium: { id: "utilitycraft:aetherium_conveyor_bridge_path", tag: "dorios:conveyor_bridge_path_aetherium" },
};
const AIR_BLOCKS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const BRIDGE_CLEARABLE_BLOCKS = new Set([
    "minecraft:snow", "minecraft:snow_layer", "minecraft:torch", "minecraft:soul_torch",
    "minecraft:redstone_torch", "minecraft:wall_torch", "minecraft:soul_wall_torch",
    "minecraft:redstone_wall_torch", "minecraft:grass", "minecraft:tallgrass",
    "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern",
    "minecraft:deadbush", "minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid",
    "minecraft:allium", "minecraft:azure_bluet", "minecraft:red_tulip", "minecraft:orange_tulip",
    "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:oxeye_daisy",
    "minecraft:cornflower", "minecraft:lily_of_the_valley", "minecraft:wither_rose",
    "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony",
    "minecraft:seagrass", "minecraft:tall_seagrass", "minecraft:kelp", "minecraft:kelp_plant",
    "minecraft:sea_pickle", "minecraft:waterlily", "minecraft:vine", "minecraft:glow_lichen",
    "minecraft:cave_vines", "minecraft:cave_vines_body_with_berries",
    "minecraft:cave_vines_head_with_berries", "minecraft:small_dripleaf",
    "minecraft:big_dripleaf", "minecraft:big_dripleaf_stem", "minecraft:spore_blossom",
    "minecraft:crimson_fungus", "minecraft:warped_fungus", "minecraft:crimson_roots",
    "minecraft:warped_roots", "minecraft:nether_sprouts", "minecraft:weeping_vines",
    "minecraft:twisting_vines", "minecraft:weeping_vines_plant",
    "minecraft:twisting_vines_plant", "minecraft:bamboo_sapling",
]);
const BRIDGE_CLEARABLE_SUFFIXES = ["_sapling", "_fungus", "_mushroom", "_flower", "_tulip"];
const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const BLOCKED_PAYLOAD_TYPES = new Set([
    "minecraft:xp_orb", "minecraft:armor_stand", "minecraft:lightning_bolt",
    "minecraft:falling_block", "minecraft:boat", "minecraft:chest_boat",
    "minecraft:minecart", "minecraft:hopper_minecart", "minecraft:chest_minecart",
    "minecraft:tnt_minecart", "minecraft:command_block_minecart", "minecraft:spawner_minecart",
]);
const BLOCKED_PAYLOAD_FAMILIES = [
    "player", "inanimate", "painting", "projectile", "machine",
    "dorios:machine", "dorios:container", "dorios:energy_container",
    "dorios:fluid_container", "dorios:battery", "dorios:tank",
];

const metaByType = new Map();
const registryByDimension = new Map();
const topologyByDimension = new Map();
const topologyRequests = new Map();
const itemPayloads = new Map();
const creaturePayloads = new Map();
const lastMoveByEntity = new Map();
let topologyWorkerRunning = false;
let restoreStarted = false;
let installed = false;

function defineType(typeId, meta) {
    metaByType.set(typeId, { ...meta });
}

function getType(typeId) {
    return metaByType.get(typeId) ?? null;
}

export function positionKey(position) {
    return `${Math.floor(position.x)}|${Math.floor(position.y)}|${Math.floor(position.z)}`;
}

function parsePositionKey(value) {
    if (typeof value !== "string") return null;
    const values = value.split("|").map(Number);
    if (values.length !== 3 || values.some((entry) => !Number.isFinite(entry))) return null;
    return { x: values[0], y: values[1], z: values[2] };
}

function encodePersistedPosition(position) {
    return `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
}

function decodePersistedPosition(value) {
    if (typeof value !== "string") return null;
    const values = value.split(value.includes(",") ? "," : "|").map(Number);
    if (values.length !== 3 || values.some((entry) => !Number.isFinite(entry))) return null;
    return { x: values[0], y: values[1], z: values[2] };
}

function addPosition(position, offset) {
    return { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z };
}

function safeGetBlock(dimension, position) {
    try {
        return dimension?.getBlock(position) ?? null;
    } catch {
        return null;
    }
}

function isAir(block) {
    return Boolean(block && AIR_BLOCKS.has(block.typeId));
}

function isValid(entity) {
    try {
        return Boolean(entity?.isValid);
    } catch {
        return false;
    }
}

function getState(block, stateId) {
    try {
        return block?.permutation?.getState(stateId);
    } catch {
        return undefined;
    }
}

function setState(block, stateId, value) {
    try {
        block.setPermutation(block.permutation.withState(stateId, value));
        return true;
    } catch {
        return false;
    }
}

function translate(key, withArgs = []) {
    return { translate: key, with: withArgs.map((entry) => entry ?? "") };
}

function formatIdentifier(typeId) {
    try {
        return DoriosLib.text.formatIdentifier(typeId);
    } catch {
        return String(typeId ?? "").replace(/^.*:/, "").replaceAll("_", " ");
    }
}

function getHeldItem(player) {
    try {
        return player.getComponent("minecraft:equippable")?.getEquipment("Mainhand") ?? null;
    } catch {
        return null;
    }
}

function getItemStack(entity) {
    try {
        return entity.getComponent("minecraft:item")?.itemStack ?? null;
    } catch {
        return null;
    }
}

function teleport(entity, location) {
    try {
        entity.teleport(location, { dimension: entity.dimension, checkForBlocks: false });
        return true;
    } catch {
        return false;
    }
}

function rememberMove(entity, position) {
    if (entity?.id) lastMoveByEntity.set(entity.id, { ...position });
}

function getLastMove(entity) {
    return entity?.id ? lastMoveByEntity.get(entity.id) ?? null : null;
}

function resolveContainerAt(dimension, location) {
    return DoriosLib.container.resolveAt(dimension, location);
}

function tryInsert(itemEntity, sourceBlock, offset, targetFace) {
    const stack = getItemStack(itemEntity);
    if (!stack) return false;
    const location = addPosition(sourceBlock.location, offset);
    const target = resolveContainerAt(sourceBlock.dimension, location);
    if (!target) return false;

    let moved = 0;
    try {
        moved = DoriosLib.container.insert(target, { item: stack, face: targetFace });
    } catch {
        return false;
    }
    if (moved <= 0) return false;

    try {
        if (moved >= stack.amount) {
            itemEntity.remove();
        } else {
            const remainder = stack.clone();
            remainder.amount = stack.amount - moved;
            const dimension = itemEntity.dimension;
            const location = { ...itemEntity.location };
            itemEntity.remove();
            const replacement = dimension.spawnItem(remainder, location);
            trackPayload(replacement);
        }
    } catch {
        return false;
    }
    return true;
}

const plain = createPlainConveyors({
    tiers: TIERS,
    plainShapes: PLAIN_SHAPES,
    defineType,
    directionVectors: DIRECTION_VECTORS,
    zeroVector: { x: 0, y: 0, z: 0 },
    movementInterval: MOVEMENT_INTERVAL,
    clamp01: (value) => Math.max(0, Math.min(1, value)),
    getState,
    verticalDirectionState: VERTICAL_DIRECTION_STATE,
    oppositeDirections: OPPOSITE_DIRECTIONS,
    itemSpacing: ITEM_SPACING,
    tryInsert,
    rememberMove,
    teleport,
    isValid,
});

const bridge = createBridgeConveyors({
    tiers: TIERS,
    defineType,
    bridgePaths: BRIDGE_PATHS,
    legacyBridgePathId: LEGACY_BRIDGE_PATH_ID,
    bridgeClearableBlocks: BRIDGE_CLEARABLE_BLOCKS,
    bridgeClearableSuffixes: BRIDGE_CLEARABLE_SUFFIXES,
    isUnbreakable: (typeId) => DoriosLib.constants.isUnbreakableBlock(typeId),
    isAir,
    bridgeTag: BRIDGE_TAG,
    directionVectors: DIRECTION_VECTORS,
    oppositeDirections: OPPOSITE_DIRECTIONS,
    horizontalDirections: HORIZONTAL_DIRECTIONS,
    safeGetBlock,
    getType,
    getState,
    setState,
    bridgeDirectionState: BRIDGE_DIRECTION_STATE,
    positionKey,
    parsePositionKey,
    scheduleTopology,
    emitEnergyUpdate,
    translate,
    processPlain: plain.process,
    isValid,
    teleport,
    rememberMove,
});

const special = createSpecialConveyors({
    ActionFormData,
    world,
    specialShapes: SPECIAL_SHAPES,
    specialBlocksPerSecond: SPECIAL_BLOCKS_PER_SECOND,
    specialEnergyCost: SPECIAL_ENERGY_COST,
    routerCycleTicks: ROUTER_CYCLE_TICKS,
    conveyorTag: CONVEYOR_TAG,
    defineType,
    directionVectors: DIRECTION_VECTORS,
    oppositeDirections: OPPOSITE_DIRECTIONS,
    leftDirections: LEFT_DIRECTIONS,
    rightDirections: RIGHT_DIRECTIONS,
    safeGetBlock,
    getState,
    isAir,
    isBridgePath: bridge.isPath,
    resolveContainerAt,
    positionKey,
    currentTick: () => system.currentTick,
    getHeldItem,
    getItemStack,
    getLastMove,
    rememberMove,
    canMoveWithSpacing: plain.canMoveWithSpacing,
    canConsumeEnergy,
    consumeEnergy,
    tryInsert,
    teleport,
    translate,
    formatIdentifier,
});

plain.registerTypes();
bridge.registerTypes();
special.registerTypes();

function dimensionRegistry(dimensionId) {
    let registry = registryByDimension.get(dimensionId);
    if (!registry) {
        registry = new Map();
        registryByDimension.set(dimensionId, registry);
    }
    return registry;
}

function registerConveyor(block, persist = true) {
    const meta = getType(block?.typeId);
    if (!block?.dimension || !meta || !block.hasTag?.(CONVEYOR_TAG)) return false;
    const registry = dimensionRegistry(block.dimension.id);
    const key = positionKey(block.location);
    const previous = registry.get(key);
    registry.set(key, {
        pos: { ...block.location },
        typeId: block.typeId,
        meta,
        facing: getState(block, "minecraft:cardinal_direction"),
    });
    if (persist) persistConveyor(block);
    if (!previous || previous.typeId !== block.typeId) scheduleTopology(block.dimension);
    return true;
}

function unregisterConveyor(dimension, position, unpersist = true, clearConfiguration = true) {
    if (!dimension || !position) return false;
    const registry = registryByDimension.get(dimension.id);
    const key = positionKey(position);
    const entry = registry?.get(key);
    if (!entry) {
        if (unpersist) unpersistConveyor(dimension.id, position);
        return false;
    }
    registry.delete(key);
    if (unpersist) unpersistConveyor(dimension.id, position);
    if (clearConfiguration) special.clearConfiguration({ dimension, location: position }, entry.meta);
    scheduleTopology(dimension);
    return true;
}

function chunkKey(position) {
    return `${Math.floor(position.x / 16)}|${Math.floor(position.z / 16)}`;
}

function chunkDataKey(dimensionId, key) {
    return `${PERSIST_CHUNK_PREFIX}:${dimensionId}:${key}`;
}

function indexMetaKey(dimensionId) {
    return `${PERSIST_INDEX_PREFIX}:${dimensionId}`;
}

function indexPageKey(dimensionId, page) {
    return `${PERSIST_INDEX_PAGE_PREFIX}:${dimensionId}:${page}`;
}

function readJson(key, fallback) {
    try {
        const raw = world.getDynamicProperty(key);
        return typeof raw === "string" && raw.length > 0 ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        world.setDynamicProperty(key, value === null || value === undefined ? "" : JSON.stringify(value));
    } catch {
        // Persistence failure does not stop the live conveyor registry.
    }
}

function readIndexMeta(dimensionId) {
    const raw = readJson(indexMetaKey(dimensionId), null);
    return { pages: Math.max(0, Math.floor(Number(raw?.pages) || 0)) };
}

function readIndexPage(dimensionId, page) {
    const value = readJson(indexPageKey(dimensionId, page), []);
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function writeIndexPage(dimensionId, page, list) {
    writeJson(indexPageKey(dimensionId, page), list.length > 0 ? list : null);
}

function findIndexPage(dimensionId, key, meta) {
    for (let page = 0; page < meta.pages; page++) {
        if (readIndexPage(dimensionId, page).includes(key)) return page;
    }
    return -1;
}

function addChunkToIndex(dimensionId, key) {
    const meta = readIndexMeta(dimensionId);
    if (findIndexPage(dimensionId, key, meta) >= 0) return;
    for (let page = 0; page < meta.pages; page++) {
        const list = readIndexPage(dimensionId, page);
        if (list.length >= PERSIST_PAGE_SIZE) continue;
        list.push(key);
        writeIndexPage(dimensionId, page, list);
        return;
    }
    writeIndexPage(dimensionId, meta.pages, [key]);
    writeJson(indexMetaKey(dimensionId), { pages: meta.pages + 1 });
}

function removeChunkFromIndex(dimensionId, key) {
    const meta = readIndexMeta(dimensionId);
    const page = findIndexPage(dimensionId, key, meta);
    if (page < 0) return;
    writeIndexPage(dimensionId, page, readIndexPage(dimensionId, page).filter((entry) => entry !== key));
    let pages = meta.pages;
    while (pages > 0 && readIndexPage(dimensionId, pages - 1).length === 0) {
        writeIndexPage(dimensionId, pages - 1, []);
        pages--;
    }
    writeJson(indexMetaKey(dimensionId), { pages });
}

function readChunk(dimensionId, key) {
    const value = readJson(chunkDataKey(dimensionId, key), []);
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function persistConveyor(block) {
    const key = chunkKey(block.location);
    const encoded = encodePersistedPosition(block.location);
    const list = readChunk(block.dimension.id, key);
    if (!list.includes(encoded)) {
        list.push(encoded);
        writeJson(chunkDataKey(block.dimension.id, key), list);
    }
    addChunkToIndex(block.dimension.id, key);
}

function unpersistConveyor(dimensionId, position) {
    const key = chunkKey(position);
    const list = readChunk(dimensionId, key);
    if (list.length === 0) return;
    const encoded = encodePersistedPosition(position);
    const runtimeKey = positionKey(position);
    const next = list.filter((entry) => entry !== encoded && entry !== runtimeKey);
    writeJson(chunkDataKey(dimensionId, key), next.length > 0 ? next : null);
    if (next.length === 0) removeChunkFromIndex(dimensionId, key);
}

async function yieldTick() {
    await new Promise((resolve) => system.run(resolve));
}

async function restorePersistedConveyors() {
    if (restoreStarted) return;
    restoreStarted = true;
    let processed = 0;
    for (const dimensionId of DIMENSION_IDS) {
        const dimension = world.getDimension(dimensionId);
        const meta = readIndexMeta(dimensionId);
        for (let page = 0; page < meta.pages; page++) {
            for (const key of readIndexPage(dimensionId, page)) {
                for (const encoded of readChunk(dimensionId, key)) {
                    const position = decodePersistedPosition(encoded);
                    if (!position) continue;
                    const block = safeGetBlock(dimension, position);
                    if (!block) continue;
                    if (block.hasTag?.(CONVEYOR_TAG) && getType(block.typeId)) registerConveyor(block, false);
                    else unpersistConveyor(dimensionId, position);
                    processed++;
                    if (processed % TOPOLOGY_BATCH_SIZE === 0) await yieldTick();
                }
            }
        }
        await refreshAllBridges(dimension);
        scheduleTopology(dimension, 0);
    }
}

export function scheduleTopology(dimension, delay = TOPOLOGY_DEBOUNCE_TICKS) {
    if (!dimension?.id) return;
    const readyTick = system.currentTick + Math.max(0, delay);
    const previous = topologyRequests.get(dimension.id);
    topologyRequests.set(dimension.id, {
        dimension,
        readyTick: previous ? Math.min(previous.readyTick, readyTick) : readyTick,
    });
    if (!topologyWorkerRunning) {
        topologyWorkerRunning = true;
        system.run(processTopologyRequests);
    }
}

async function processTopologyRequests() {
    try {
        while (topologyRequests.size > 0) {
            let selectedId = null;
            let selected = null;
            for (const [dimensionId, request] of topologyRequests) {
                if (!selected || request.readyTick < selected.readyTick) {
                    selectedId = dimensionId;
                    selected = request;
                }
            }
            if (!selected || !selectedId) break;
            while (system.currentTick < selected.readyTick) await yieldTick();
            topologyRequests.delete(selectedId);
            await rebuildTopology(selected.dimension);
        }
    } finally {
        topologyWorkerRunning = false;
        if (topologyRequests.size > 0) scheduleTopology(topologyRequests.values().next().value.dimension, 0);
    }
}

async function rebuildTopology(dimension) {
    const registry = registryByDimension.get(dimension.id);
    const byPos = new Map();
    const networks = new Map();
    if (!registry || registry.size === 0) {
        topologyByDimension.set(dimension.id, { byPos, networks });
        return;
    }

    const reverseBridgeEdges = new Map();
    for (const [key, entry] of registry) {
        if (entry.meta.shape !== "bridge_transmitter") continue;
        const target = bridge.getVirtualEdge(dimension.id, key);
        if (!target) continue;
        let sources = reverseBridgeEdges.get(target);
        if (!sources) {
            sources = [];
            reverseBridgeEdges.set(target, sources);
        }
        sources.push(key);
    }

    const visited = new Set();
    let processed = 0;
    let networkIndex = 0;
    for (const rootKey of registry.keys()) {
        if (visited.has(rootKey)) continue;
        const queue = [rootKey];
        let queueIndex = 0;
        const nodeKeys = [];
        const nodes = [];
        while (queueIndex < queue.length) {
            const key = queue[queueIndex++];
            if (visited.has(key)) continue;
            const entry = registry.get(key);
            if (!entry) continue;
            const block = safeGetBlock(dimension, entry.pos);
            if (!block) continue;
            if (!block.hasTag?.(CONVEYOR_TAG) || !getType(block.typeId)) {
                registry.delete(key);
                unpersistConveyor(dimension.id, entry.pos);
                continue;
            }
            visited.add(key);
            nodeKeys.push(key);
            nodes.push({ ...entry.pos });
            for (const offset of OFFSETS) {
                const neighborKey = positionKey(addPosition(entry.pos, offset));
                if (registry.has(neighborKey) && !visited.has(neighborKey)) queue.push(neighborKey);
            }
            const bridgeTarget = bridge.getVirtualEdge(dimension.id, key);
            if (bridgeTarget && registry.has(bridgeTarget)) queue.push(bridgeTarget);
            for (const source of reverseBridgeEdges.get(key) ?? []) queue.push(source);
            processed++;
            if (processed % TOPOLOGY_BATCH_SIZE === 0) await yieldTick();
        }
        if (nodes.length === 0) continue;
        const id = `${dimension.id}:${networkIndex++}`;
        const energySources = await collectEnergySources(dimension, nodes[0]);
        const network = { id, nodes, energySources };
        networks.set(id, network);
        for (const key of nodeKeys) byPos.set(key, id);
    }
    topologyByDimension.set(dimension.id, { byPos, networks });
}

async function collectEnergySources(dimension, start) {
    const sources = [];
    const sourceIds = new Set();
    const visited = new Set();
    const queue = [{ x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) }];
    let queueIndex = 0;
    let processed = 0;
    while (queueIndex < queue.length) {
        const position = queue[queueIndex++];
        const key = positionKey(position);
        if (visited.has(key)) continue;
        visited.add(key);
        const block = safeGetBlock(dimension, position);
        if (!block?.hasTag?.("dorios:energy")) continue;
        const entity = getEnergySourceEntityAt(dimension, position, block);
        if (entity && !sourceIds.has(entity.id)) {
            sourceIds.add(entity.id);
            sources.push({ ...position });
        }
        if (block.hasTag?.("dorios:isTube")) {
            for (const offset of OFFSETS) queue.push(addPosition(position, offset));
        }
        processed++;
        if (processed % TOPOLOGY_BATCH_SIZE === 0) await yieldTick();
    }
    return sources;
}

function resolveEnergyPortEntity(dimension, position) {
    try {
        return dimension.getEntities({ tags: [`input:[${position.x},${position.y},${position.z}]`] })[0] ?? null;
    } catch {
        return null;
    }
}

function getEnergySourceEntityAt(dimension, position, block = safeGetBlock(dimension, position)) {
    if (!block?.hasTag?.("dorios:energy")) return null;
    let entities = [];
    try {
        entities = dimension.getEntitiesAtBlockLocation(position);
    } catch {
        return null;
    }
    let entity = entities.find((candidate) => hasFamily(candidate, "dorios:energy_source")) ?? null;
    if (!entity && block.hasTag?.("dorios:multiblock.port")) entity = resolveEnergyPortEntity(dimension, position);
    return entity && hasFamily(entity, "dorios:energy_source") ? entity : null;
}

function hasFamily(entity, family) {
    try {
        return Boolean(entity?.getComponent("minecraft:type_family")?.hasTypeFamily(family));
    } catch {
        return false;
    }
}

function getEnergyEntities(block, network) {
    if (!block?.dimension || !network) return [];
    const entities = [];
    for (const position of network.energySources ?? []) {
        const entity = getEnergySourceEntityAt(block.dimension, position);
        if (entity) entities.push(entity);
    }
    return entities;
}

function canConsumeEnergy(block, network, amount) {
    if (amount <= 0) return true;
    let total = 0;
    for (const entity of getEnergyEntities(block, network)) {
        total += Math.max(0, new EnergyStorage(entity).get());
        if (total >= amount) return true;
    }
    return false;
}

function consumeEnergy(block, network, amount) {
    if (amount <= 0) return true;
    if (!canConsumeEnergy(block, network, amount)) return false;
    let remaining = amount;
    for (const entity of getEnergyEntities(block, network)) {
        if (remaining <= 0) break;
        const storage = new EnergyStorage(entity);
        remaining -= storage.consume(Math.min(remaining, Math.max(0, storage.get())));
    }
    return remaining <= 0;
}

function isCreaturePayload(entity) {
    if (!entity || entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item") return false;
    if (BLOCKED_PAYLOAD_TYPES.has(entity.typeId)) return false;
    for (const family of BLOCKED_PAYLOAD_FAMILIES) {
        if (hasFamily(entity, family)) return false;
    }
    return true;
}

function trackPayload(entity) {
    if (!isValid(entity)) return;
    if (entity.typeId === "minecraft:item") itemPayloads.set(entity.id, entity);
    else if (isCreaturePayload(entity)) creaturePayloads.set(entity.id, entity);
}

function forgetPayload(entityId) {
    itemPayloads.delete(entityId);
    creaturePayloads.delete(entityId);
    lastMoveByEntity.delete(entityId);
}

function findConveyorUnder(entity) {
    const registry = registryByDimension.get(entity.dimension.id);
    if (!registry) return null;
    const x = Math.floor(entity.location.x);
    const y = Math.floor(entity.location.y);
    const z = Math.floor(entity.location.z);
    return registry.get(`${x}|${y}|${z}`) ?? registry.get(`${x}|${y - 1}|${z}`) ?? null;
}

function bucketPayloads() {
    const buckets = new Map();
    const add = (entity, creature) => {
        if (!isValid(entity)) {
            forgetPayload(entity?.id);
            return;
        }
        const entry = findConveyorUnder(entity);
        if (!entry || (creature && entry.meta.tier !== "aetherium")) return;
        const dimensionId = entity.dimension.id;
        const key = positionKey(entry.pos);
        const bucketKey = `${dimensionId}:${key}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
            const topology = topologyByDimension.get(dimensionId);
            const networkId = topology?.byPos.get(key);
            bucket = {
                entry,
                dimension: entity.dimension,
                items: [],
                creatures: [],
                network: networkId ? topology?.networks.get(networkId) ?? null : null,
            };
            buckets.set(bucketKey, bucket);
        }
        (creature ? bucket.creatures : bucket.items).push(entity);
    };
    for (const entity of itemPayloads.values()) add(entity, false);
    for (const entity of creaturePayloads.values()) add(entity, true);
    return buckets;
}

function processPayloads() {
    if (!globalThis.worldLoaded) return;
    for (const bucket of bucketPayloads().values()) {
        const block = safeGetBlock(bucket.dimension, bucket.entry.pos);
        if (!block) continue;
        const meta = getType(block.typeId);
        if (!meta || !block.hasTag?.(CONVEYOR_TAG)) {
            unregisterConveyor(bucket.dimension, bucket.entry.pos, true);
            continue;
        }
        if (meta.shape === "bridge_transmitter") bridge.process(block, meta, bucket);
        else if (SPECIAL_SHAPE_SET.has(meta.shape)) special.process(block, meta, bucket, bucket.network);
        else plain.process(block, meta, bucket);
    }
}

async function refreshAllBridges(dimension, player = null) {
    const registry = registryByDimension.get(dimension.id);
    if (!registry) return;
    let processed = 0;
    for (const entry of registry.values()) {
        if (entry.meta.shape !== "bridge_transmitter") continue;
        const block = safeGetBlock(dimension, entry.pos);
        if (block) bridge.refreshTransmitter(block, entry.meta, player);
        processed++;
        if (processed % TOPOLOGY_BATCH_SIZE === 0) await yieldTick();
    }
}

async function scanFromUpdater(block) {
    if (!block?.dimension) return;
    const queue = OFFSETS.map((offset) => addPosition(block.location, offset));
    const visited = new Set();
    let index = 0;
    let processed = 0;
    while (index < queue.length) {
        const position = queue[index++];
        const key = positionKey(position);
        if (visited.has(key)) continue;
        visited.add(key);
        const candidate = safeGetBlock(block.dimension, position);
        if (!candidate?.hasTag?.(CONVEYOR_TAG) || !getType(candidate.typeId)) continue;
        registerConveyor(candidate, true);
        for (const offset of OFFSETS) queue.push(addPosition(position, offset));
        const candidateMeta = getType(candidate.typeId);
        if (candidateMeta?.shape === "bridge_transmitter") {
            const facing = getState(candidate, "minecraft:cardinal_direction");
            const link = typeof facing === "string"
                ? bridge.evaluate(candidate, candidateMeta, facing)
                : null;
            if (link?.receiver && !link.obstructed) queue.push({ ...link.receiver.location });
        }
        processed++;
        if (processed % TOPOLOGY_BATCH_SIZE === 0) await yieldTick();
    }
    await refreshAllBridges(block.dimension);
    scheduleTopology(block.dimension, 0);
}

function emitEnergyUpdate(block, player = null) {
    if (!block?.dimension) return;
    const { x, y, z } = block.location;
    const command = `scriptevent dorios:updatePipes energy|[${x},${y},${z}]`;
    system.runTimeout(() => {
        try {
            if (player?.isValid) player.runCommand(command);
            else block.dimension.runCommand(`execute as @n run ${command}`);
        } catch {
            // No nearby source entity means there is no loaded energy network to notify.
        }
    }, 2);
}

function refreshPlacedConveyor(block, player = null) {
    if (!registerConveyor(block, true)) return;
    const meta = getType(block.typeId);
    if (meta?.shape === "bridge_transmitter") bridge.refreshTransmitter(block, meta, player);
    else if (meta?.shape === "bridge_receiver") bridge.refreshReceiver(block, meta, player);
    bridge.refreshPathOwner(block.dimension, block.location, player);
    emitEnergyUpdate(block, player);
}

function onConveyorBroken(block, permutation, player = null) {
    const typeId = permutation?.type?.id ?? permutation?.typeId;
    const meta = getType(typeId);
    const facing = (() => {
        try { return permutation?.getState("minecraft:cardinal_direction"); } catch { return null; }
    })();
    if (meta?.shape === "bridge_transmitter" && facing) {
        bridge.removeTransmitter(block.dimension, block.location, meta, facing);
    }
    unregisterConveyor(block.dimension, block.location, true);
    system.run(() => {
        bridge.refreshPathOwner(block.dimension, block.location, player);
        if (meta?.shape === "bridge_receiver") {
            const receiverLike = { dimension: block.dimension, location: block.location, typeId };
            bridge.refreshReceiver(receiverLike, meta, player);
        }
        emitEnergyUpdate(block, player);
    });
}

function isWrench(player) {
    return getHeldItem(player)?.typeId === "utilitycraft:wrench";
}

export const conveyorComponent = {
    beforeOnPlayerPlace({ block, player }) {
        system.run(() => refreshPlacedConveyor(block, player));
    },
    onPlayerInteract({ block, player }) {
        const meta = getType(block?.typeId);
        if (!meta || !player) return;
        if (meta.shape === "vertical" && isWrench(player)) {
            system.run(() => {
                const current = getState(block, VERTICAL_DIRECTION_STATE);
                setState(block, VERTICAL_DIRECTION_STATE, current === "down" ? "up" : "down");
            });
            return;
        }
        if (special.interact(player, block, meta)) return;
    },
    onPlayerBreak({ block, brokenBlockPermutation, player }) {
        onConveyorBroken(block, brokenBlockPermutation, player);
    },
};

export const conveyorUpdaterComponent = {
    beforeOnPlayerPlace({ block }) {
        system.run(() => scanFromUpdater(block));
    },
    onPlayerInteract({ block }) {
        system.run(() => scanFromUpdater(block));
    },
};

function pistonDirection(value) {
    if (value === 0) return DIRECTION_VECTORS.down;
    if (value === 1) return DIRECTION_VECTORS.up;
    if (value === 2) return DIRECTION_VECTORS.north;
    if (value === 3) return DIRECTION_VECTORS.south;
    if (value === 4) return DIRECTION_VECTORS.west;
    if (value === 5) return DIRECTION_VECTORS.east;
    return { x: 0, y: 0, z: 0 };
}

function reconcilePiston(piston, isExpanding, dimension) {
    const locations = piston.getAttachedBlocksLocations?.() ?? [];
    if (locations.length === 0) return;
    scheduleTopology(dimension);
    const direction = pistonDirection(Number(getState(piston.block, "facing_direction")));
    const sourceStep = isExpanding ? -1 : 1;
    system.runTimeout(async () => {
        let touched = false;
        for (const target of locations) {
            const source = {
                x: target.x + direction.x * sourceStep,
                y: target.y + direction.y * sourceStep,
                z: target.z + direction.z * sourceStep,
            };
            const targetBlock = safeGetBlock(dimension, target);
            const sourceEntry = registryByDimension.get(dimension.id)?.get(positionKey(source));
            if (targetBlock?.hasTag?.(CONVEYOR_TAG)) {
                if (sourceEntry?.meta?.shape === "bridge_transmitter" && typeof sourceEntry.facing === "string") {
                    bridge.removeTransmitter(dimension, source, sourceEntry.meta, sourceEntry.facing);
                }
                if (sourceEntry) special.moveConfiguration(dimension, source, target, sourceEntry.meta);
                unregisterConveyor(dimension, source, true, false);
                registerConveyor(targetBlock, true);
                touched = true;
            } else if (sourceEntry) {
                if (sourceEntry.meta?.shape === "bridge_transmitter" && typeof sourceEntry.facing === "string") {
                    bridge.removeTransmitter(dimension, source, sourceEntry.meta, sourceEntry.facing);
                }
                unregisterConveyor(dimension, source, true);
                touched = true;
            }
        }
        if (touched) {
            await refreshAllBridges(dimension);
            scheduleTopology(dimension, 0);
        }
    }, 2);
}

export function installTransportation() {
    if (installed) return;
    installed = true;

    world.afterEvents.entitySpawn.subscribe(({ entity }) => trackPayload(entity));
    world.afterEvents.entityLoad?.subscribe(({ entity }) => trackPayload(entity));
    world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => forgetPayload(removedEntityId));

    world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
        system.run(() => {
            if (block.hasTag?.(CONVEYOR_TAG)) return;
            bridge.refreshPathOwner(block.dimension, block.location, player);
            if (block.hasTag?.("dorios:energy")) scheduleTopology(block.dimension);
        });
    });

    world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player }) => {
        const wasConveyor = brokenBlockPermutation?.hasTag?.(CONVEYOR_TAG) ?? false;
        if (wasConveyor) return;
        system.run(() => bridge.refreshPathOwner(block.dimension, block.location, player));
        if (brokenBlockPermutation?.hasTag?.("dorios:energy")) scheduleTopology(block.dimension);
    });

    world.afterEvents.pistonActivate.subscribe(({ piston, isExpanding, dimension }) => {
        reconcilePiston(piston, isExpanding, dimension);
    });

    system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id === "dorios:updatePipes" && event.message.startsWith("energy|") && event.sourceEntity?.isValid) {
            scheduleTopology(event.sourceEntity.dimension);
        }
    }, { namespaces: ["dorios"] });

    world.afterEvents.worldLoad.subscribe(() => system.run(restorePersistedConveyors));
    world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
        if (initialSpawn) system.run(restorePersistedConveyors);
    });
    system.runInterval(processPayloads, MOVEMENT_INTERVAL);
}

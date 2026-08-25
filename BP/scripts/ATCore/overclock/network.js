// @ts-check

import { system } from "@minecraft/server";
import { createNetworkRescanScheduler } from "../networks/scheduler.js";
import {
    MAX_OVERCLOCK_LEVEL,
    NETWORK_OFFSETS,
    NETWORK_SCAN_BATCH_SIZE,
    OVERCLOCK_NETWORK_TAG,
    OVERCLOCK_PROPERTY,
    OVERCLOCK_RELAY_TAG,
    OVERCLOCK_SOURCE_TAG,
    OVERCLOCK_TARGET_POSITION_PREFIX,
    OVERCLOCK_TARGET_TAG,
} from "./constants.js";
import { isOverclockNetworkConnectionOpen } from "./pipeFaces.js";

const networksById = new Map();
const networksByRelayId = new Map();
const networkIdByTowerId = new Map();
const networkIdByNode = new Map();
const targetClaims = new Map();

/** Queues an event-driven rebuild around one changed position. */
export const scheduleOverclockNetworkRescan = createNetworkRescanScheduler(
    "overclock",
    rebuildNetworkBatch,
);

export function getOverclockLevel(entity) {
    if (!entity?.isValid) return 0;
    try {
        const value = Number(entity.getProperty(OVERCLOCK_PROPERTY) ?? 0);
        return Number.isFinite(value)
            ? Math.max(0, Math.min(MAX_OVERCLOCK_LEVEL, value))
            : 0;
    } catch {
        return 0;
    }
}

export function setOverclockLevel(entity, level) {
    if (!entity?.isValid) return false;
    const normalized = Math.max(0, Math.min(MAX_OVERCLOCK_LEVEL, Number(level) || 0));
    try {
        const current = Number(entity.getProperty(OVERCLOCK_PROPERTY) ?? 0);
        if (Math.abs(current - normalized) < 0.000001) return false;
        entity.setProperty(OVERCLOCK_PROPERTY, normalized);
        return true;
    } catch {
        return false;
    }
}

export function acceptsOverclock(block, entity) {
    if (!entity?.isValid || block?.hasTag?.(OVERCLOCK_NETWORK_TAG)) return false;

    try {
        if (entity.getProperty(OVERCLOCK_PROPERTY) === undefined) return false;
    } catch {
        return false;
    }

    const family = entity.getComponent("minecraft:type_family");
    return family?.hasTypeFamily("dorios:machine") === true
        || entity.hasTag(OVERCLOCK_TARGET_TAG);
}

export function ensureOverclockNetwork(block) {
    if (!block?.dimension) return;
    const key = dimensionPositionKey(block.dimension, block.location);
    if (networkIdByNode.has(key)) return;
    scheduleOverclockNetworkRescan(block.location, block.dimension);
}

export function invalidateOverclockNetwork(block) {
    if (!block?.dimension) return;
    scheduleOverclockNetworkRescan(block.location, block.dimension);
}

export function touchesOverclockNetwork(dimension, location) {
    for (const position of positionsAround(location)) {
        if (networkIdByNode.has(dimensionPositionKey(dimension, position))) return true;
        const block = safeGetBlock(dimension, position);
        if (block?.hasTag?.(OVERCLOCK_NETWORK_TAG)) return true;
    }
    return false;
}

export function getOverclockNetworkForTower(towerEntity) {
    const networkId = networkIdByTowerId.get(towerEntity?.id);
    return networkId ? networksById.get(networkId) : undefined;
}

export function getOverclockNetworkForRelay(relayEntity) {
    return networksByRelayId.get(relayEntity?.id);
}

export function getLoadedOverclockTargets(network) {
    if (!network?.dimension) return [];
    const entities = [];
    for (const position of network.targets) {
        const entity = findEligibleTargetAt(network.dimension, position);
        if (entity) entities.push(entity);
    }
    return entities;
}

/** Publishes one Tower's effective output and only walks targets if the network value changed. */
export function publishTowerOverclock(towerEntity, level) {
    setOverclockLevel(towerEntity, level);
    const network = getOverclockNetworkForTower(towerEntity);
    if (!network) return false;
    return refreshNetworkLevel(network);
}

async function rebuildNetworkBatch(changedLocations, dimension) {
    const affectedNetworkIds = new Set();
    for (const changedLocation of changedLocations) {
        for (const position of positionsAround(changedLocation)) {
            const networkId = networkIdByNode.get(dimensionPositionKey(dimension, position));
            if (networkId) affectedNetworkIds.add(networkId);
        }
    }

    for (const networkId of affectedNetworkIds) detachNetwork(networksById.get(networkId));

    const coveredNodes = new Set();
    for (const changedLocation of changedLocations) {
        for (const root of positionsAround(changedLocation)) {
            const rootKey = dimensionPositionKey(dimension, root);
            if (coveredNodes.has(rootKey)) continue;

            const block = safeGetBlock(dimension, root);
            if (!block?.hasTag?.(OVERCLOCK_NETWORK_TAG)) continue;

            const component = await scanComponent(root, dimension);
            for (const nodeKey of component.nodeKeys) coveredNodes.add(nodeKey);
            registerNetwork(component);
        }
    }
}

async function scanComponent(startPosition, dimension) {
    const queue = [normalizePosition(startPosition)];
    let queueHead = 0;
    let processed = 0;
    const visited = new Set();
    const nodeKeys = [];
    const nodePositions = [];
    const towersById = new Map();
    const relaysById = new Map();
    const targetsByKey = new Map();
    const checkedTargetKeys = new Set();
    const pipeFaceCache = new Map();

    while (queueHead < queue.length) {
        if (processed > 0 && processed % NETWORK_SCAN_BATCH_SIZE === 0) {
            await system.waitTicks(1);
        }
        processed++;

        const position = queue[queueHead++];
        const nodeKey = dimensionPositionKey(dimension, position);
        if (visited.has(nodeKey)) continue;
        visited.add(nodeKey);

        const block = safeGetBlock(dimension, position);
        if (!block?.hasTag?.(OVERCLOCK_NETWORK_TAG)) continue;

        nodeKeys.push(nodeKey);
        nodePositions.push(position);

        if (block.hasTag(OVERCLOCK_SOURCE_TAG)) {
            const entity = findNetworkEntityAt(dimension, position);
            if (entity) towersById.set(entity.id, entity);
        }
        if (block.hasTag(OVERCLOCK_RELAY_TAG)) {
            const entity = findNetworkEntityAt(dimension, position);
            if (entity) relaysById.set(entity.id, entity);
        }

        const isUniversalEndpoint = block.hasTag?.("dorios:universal_pipe")
            && (block.hasTag?.("dorios:isExporter") || block.hasTag?.("dorios:isImporter"));
        const isImporter = isUniversalEndpoint && block.hasTag?.("dorios:isImporter");
        const attachment = isUniversalEndpoint ? getEndpointAttachmentPosition(block) : undefined;

        for (const offset of NETWORK_OFFSETS) {
            const adjacent = offsetPosition(position, offset);
            const adjacentBlock = safeGetBlock(dimension, adjacent);
            if (!isOverclockNetworkConnectionOpen(block, offset, adjacentBlock, pipeFaceCache)) continue;
            const isAttachment = attachment && isSamePosition(attachment, adjacent);
            if (adjacentBlock?.hasTag?.(OVERCLOCK_NETWORK_TAG)) {
                if (isImporter && isAttachment) continue;
                queue.push(adjacent);
                continue;
            }
            if (!adjacentBlock) continue;
            if (isUniversalEndpoint && (!isImporter || !isAttachment)) continue;

            const targetKey = localPositionKey(adjacent);
            if (checkedTargetKeys.has(targetKey)) continue;
            checkedTargetKeys.add(targetKey);

            const target = findEligibleTargetAt(dimension, adjacent, adjacentBlock);
            if (target) targetsByKey.set(targetKey, { position: adjacent, entity: target });
        }
    }

    const towers = [...towersById.values()].sort(compareEntitiesByPosition);
    const relays = [...relaysById.values()].sort(compareEntitiesByPosition);
    const targetEntries = [...targetsByKey.values()]
        .sort((a, b) => comparePositions(a.position, b.position));
    const targets = targetEntries.map(({ position }) => position);
    const energyTargets = targetEntries.filter(({ entity }) => {
        const family = entity?.getComponent("minecraft:type_family");
        return family?.hasTypeFamily("dorios:energy_container") === true
            && family.hasTypeFamily("dorios:energy_source") !== true;
    }).map(({ position }) => position);
    nodeKeys.sort();

    return {
        dimension,
        nodeKeys,
        nodePositions,
        towers,
        relays,
        targets,
        energyTargets,
    };
}

function getEndpointAttachmentPosition(block) {
    let face;
    try {
        face = block.permutation.getState("minecraft:block_face");
    } catch {
        return undefined;
    }
    const offset = {
        down: { x: 0, y: 1, z: 0 },
        up: { x: 0, y: -1, z: 0 },
        south: { x: 0, y: 0, z: -1 },
        north: { x: 0, y: 0, z: 1 },
        east: { x: -1, y: 0, z: 0 },
        west: { x: 1, y: 0, z: 0 },
    }[face];
    return offset ? offsetPosition(block.location, offset) : undefined;
}

function isSamePosition(left, right) {
    return Math.floor(left.x) === Math.floor(right.x)
        && Math.floor(left.y) === Math.floor(right.y)
        && Math.floor(left.z) === Math.floor(right.z);
}

function registerNetwork(component) {
    if (component.nodeKeys.length === 0) return;

    const controller = component.relays[0];
    const id = controller?.id ?? `inactive:${component.nodeKeys[0]}`;
    const network = {
        id,
        dimension: component.dimension,
        nodeKeys: component.nodeKeys,
        nodePositions: component.nodePositions,
        towers: component.towers,
        relays: component.relays,
        controller,
        targets: component.targets,
        energyTargets: component.energyTargets,
        level: controller ? resolveSourceLevel(component.towers) : 0,
    };

    networksById.set(id, network);
    for (const nodeKey of network.nodeKeys) networkIdByNode.set(nodeKey, id);
    for (const tower of network.towers) networkIdByTowerId.set(tower.id, id);

    for (const relay of network.relays) {
        networksByRelayId.set(relay.id, network);
        setOverclockLevel(relay, network.level);
        clearPersistedTargets(relay);
        clearEnergyTargets(relay);
    }

    if (controller) persistTargets(controller, network.targets);
    if (controller) {
        for (const relay of network.relays) persistEnergyTargets(relay, network.energyTargets);
    }
    addNetworkClaims(network);
}

function detachNetwork(network) {
    if (!network) return;

    networksById.delete(network.id);
    for (const nodeKey of network.nodeKeys) {
        if (networkIdByNode.get(nodeKey) === network.id) networkIdByNode.delete(nodeKey);
    }
    for (const tower of network.towers) {
        if (networkIdByTowerId.get(tower.id) === network.id) networkIdByTowerId.delete(tower.id);
    }
    for (const relay of network.relays) {
        if (networksByRelayId.get(relay.id) === network) networksByRelayId.delete(relay.id);
        setOverclockLevel(relay, 0);
        clearPersistedTargets(relay);
        clearEnergyTargets(relay);
    }

    removeNetworkClaims(network);
}

function refreshNetworkLevel(network) {
    const nextLevel = network.controller ? resolveSourceLevel(network.towers) : 0;
    if (Math.abs(network.level - nextLevel) < 0.000001) return false;

    network.level = nextLevel;
    for (const relay of network.relays) setOverclockLevel(relay, nextLevel);

    for (const position of network.targets) {
        const key = dimensionPositionKey(network.dimension, position);
        let claims = targetClaims.get(key);
        if (!claims) {
            claims = new Map();
            targetClaims.set(key, claims);
        }
        claims.set(network.id, nextLevel);
        applyClaimedLevel(network.dimension, position, claims);
    }
    return true;
}

function resolveSourceLevel(towers) {
    let level = 0;
    for (const tower of towers) level = Math.max(level, getOverclockLevel(tower));
    return level;
}

function addNetworkClaims(network) {
    if (!network.controller) return;
    for (const position of network.targets) {
        const key = dimensionPositionKey(network.dimension, position);
        let claims = targetClaims.get(key);
        if (!claims) {
            claims = new Map();
            targetClaims.set(key, claims);
        }
        claims.set(network.id, network.level);
        applyClaimedLevel(network.dimension, position, claims);
    }
}

function removeNetworkClaims(network) {
    if (!network.controller) return;
    for (const position of network.targets) {
        const key = dimensionPositionKey(network.dimension, position);
        const claims = targetClaims.get(key);
        if (!claims) continue;
        claims.delete(network.id);
        if (claims.size === 0) targetClaims.delete(key);
        applyClaimedLevel(network.dimension, position, claims);
    }
}

function applyClaimedLevel(dimension, position, claims) {
    let level = 0;
    if (claims) {
        for (const claim of claims.values()) level = Math.max(level, Number(claim) || 0);
    }
    const entity = findEligibleTargetAt(dimension, position);
    if (entity) setOverclockLevel(entity, level);
}

function persistTargets(relay, targets) {
    if (!relay?.isValid) return;
    for (const position of targets) {
        try {
            relay.addTag(`${OVERCLOCK_TARGET_POSITION_PREFIX}${position.x},${position.y},${position.z}]`);
        } catch {}
    }
}

function clearPersistedTargets(relay) {
    if (!relay?.isValid) return;
    for (const tag of relay.getTags()) {
        if (!tag.startsWith(OVERCLOCK_TARGET_POSITION_PREFIX)) continue;
        try {
            relay.removeTag(tag);
        } catch {}
    }
}

function persistEnergyTargets(relay, targets) {
    if (!relay?.isValid) return;
    for (const position of targets) {
        try {
            relay.addTag(`net:[${position.x},${position.y},${position.z}]`);
        } catch {}
    }
    try {
        relay.addTag("updateNetwork");
    } catch {}
}

function clearEnergyTargets(relay) {
    if (!relay?.isValid) return;
    for (const tag of relay.getTags()) {
        if (!tag.startsWith("net:[")) continue;
        try {
            relay.removeTag(tag);
        } catch {}
    }
    try {
        relay.addTag("updateNetwork");
    } catch {}
}

function findNetworkEntityAt(dimension, position) {
    try {
        return dimension.getEntitiesAtBlockLocation(position).find((entity) => {
            if (!entity?.isValid) return false;
            try {
                return entity.getProperty(OVERCLOCK_PROPERTY) !== undefined;
            } catch {
                return false;
            }
        });
    } catch {
        return undefined;
    }
}

function findEligibleTargetAt(dimension, position, knownBlock) {
    const block = knownBlock ?? safeGetBlock(dimension, position);
    if (!block || block.hasTag?.(OVERCLOCK_NETWORK_TAG)) return undefined;
    try {
        return dimension.getEntitiesAtBlockLocation(position)
            .find((entity) => acceptsOverclock(block, entity));
    } catch {
        return undefined;
    }
}

function safeGetBlock(dimension, position) {
    try {
        return dimension.getBlock(position);
    } catch {
        return undefined;
    }
}

function positionsAround(location) {
    const center = normalizePosition(location);
    return [center, ...NETWORK_OFFSETS.map((offset) => offsetPosition(center, offset))];
}

function offsetPosition(position, offset) {
    return {
        x: position.x + offset.x,
        y: position.y + offset.y,
        z: position.z + offset.z,
    };
}

function normalizePosition(position) {
    return {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z),
    };
}

function localPositionKey(position) {
    return `${position.x},${position.y},${position.z}`;
}

function dimensionPositionKey(dimension, position) {
    return `${dimension.id}:${localPositionKey(position)}`;
}

function comparePositions(a, b) {
    return a.x - b.x || a.y - b.y || a.z - b.z;
}

function compareEntitiesByPosition(a, b) {
    return comparePositions(a.location, b.location);
}

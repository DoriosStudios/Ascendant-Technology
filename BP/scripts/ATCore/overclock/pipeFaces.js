// @ts-check

import { world } from "@minecraft/server";

const PIPE_FACE_PROPERTY_PREFIX = "utilitycraft:pf";
const UNIVERSAL_PIPE_TAG = "dorios:universal_pipe";

const OPPOSITE_DIRECTIONS = Object.freeze({
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
});

const ENDPOINT_STATE_DIRECTION_MAP = Object.freeze({
    north: Object.freeze({ north: "south", south: "north", east: "west", west: "east", up: "up", down: "down" }),
    south: Object.freeze({ north: "north", south: "south", east: "east", west: "west", up: "up", down: "down" }),
    east: Object.freeze({ north: "east", south: "west", east: "south", west: "north", up: "up", down: "down" }),
    west: Object.freeze({ north: "west", south: "east", east: "north", west: "south", up: "up", down: "down" }),
    up: Object.freeze({ north: "up", south: "down", east: "east", west: "west", up: "south", down: "north" }),
    down: Object.freeze({ north: "down", south: "up", east: "east", west: "west", up: "north", down: "south" }),
});

function normalizeDirection(value) {
    const direction = String(value ?? "").toLowerCase();
    return Object.hasOwn(OPPOSITE_DIRECTIONS, direction) ? direction : undefined;
}

function directionFromOffset(offset) {
    if (offset.x === 1 && offset.y === 0 && offset.z === 0) return "east";
    if (offset.x === -1 && offset.y === 0 && offset.z === 0) return "west";
    if (offset.x === 0 && offset.y === 1 && offset.z === 0) return "up";
    if (offset.x === 0 && offset.y === -1 && offset.z === 0) return "down";
    if (offset.x === 0 && offset.y === 0 && offset.z === 1) return "south";
    if (offset.x === 0 && offset.y === 0 && offset.z === -1) return "north";
    return undefined;
}

function dimensionStorageKey(dimensionId) {
    if (dimensionId === "minecraft:overworld") return "o";
    if (dimensionId === "minecraft:nether") return "n";
    if (dimensionId === "minecraft:the_end") return "e";
    return dimensionId.replaceAll(":", ".");
}

function pipeFacePropertyKey(block) {
    const { location } = block;
    return `${PIPE_FACE_PROPERTY_PREFIX}:${dimensionStorageKey(block.dimension.id)}:${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

function getDisabledFaceDocument(block, cache) {
    const key = pipeFacePropertyKey(block);
    if (cache?.has(key)) return cache.get(key);
    let document;
    try {
        const raw = world.getDynamicProperty(key);
        if (typeof raw === "string" && raw.length > 0) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) document = parsed;
        }
    } catch {}
    cache?.set(key, document);
    return document;
}

function isOverclockFaceDisabled(block, direction, cache) {
    if (!block?.hasTag?.("dorios:isTube")) return false;
    const document = getDisabledFaceDocument(block, cache);
    if (!document) return false;

    if (Array.isArray(document.disabled) && document.disabled.includes(direction)) return true;
    if (block.hasTag(UNIVERSAL_PIPE_TAG)) {
        const resources = document.resources?.[direction];
        return Array.isArray(resources) && resources.includes("overclock");
    }
    return false;
}

function getConnectionStateDirection(block, physicalDirection) {
    if (!block.hasTag("dorios:isExporter") && !block.hasTag("dorios:isImporter")) {
        return physicalDirection;
    }
    let facing;
    try {
        facing = normalizeDirection(block.permutation.getState("minecraft:block_face")) ?? "north";
    } catch {
        facing = "north";
    }
    return ENDPOINT_STATE_DIRECTION_MAP[facing]?.[physicalDirection] ?? physicalDirection;
}

function isPipeConnectionOpen(block, direction, cache) {
    if (!block?.hasTag?.("dorios:isTube")) return true;
    if (isOverclockFaceDisabled(block, direction, cache)) return false;
    // Universal topology is capability-driven. Its six visual states are a
    // derived union of all channels and may lag one tick behind placement.
    if (block.hasTag(UNIVERSAL_PIPE_TAG)) return true;
    try {
        const stateDirection = getConnectionStateDirection(block, direction);
        return block.permutation.getState(`utilitycraft:${stateDirection}`) === true;
    } catch {
        return false;
    }
}

/**
 * Applies the physical state union and the Universal Cable's dedicated
 * overclock toggle before the overclock graph crosses a pipe edge.
 */
export function isOverclockNetworkConnectionOpen(block, offset, neighbor, cache) {
    if (!block || !neighbor) return false;
    const direction = directionFromOffset(offset);
    if (!direction) return false;
    if (!isPipeConnectionOpen(block, direction, cache)) return false;
    return isPipeConnectionOpen(neighbor, OPPOSITE_DIRECTIONS[direction], cache);
}

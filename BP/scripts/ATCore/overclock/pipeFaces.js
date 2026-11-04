// @ts-check

const OPPOSITE_DIRECTIONS = Object.freeze({
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
});

// Endpoint bones rotate with block_face; ordinary cable states are world-facing.
const ENDPOINT_DIRECTIONS = {
    north: { north: "south", south: "north", east: "west", west: "east", up: "up", down: "down" },
    south: { north: "north", south: "south", east: "east", west: "west", up: "up", down: "down" },
    east: { north: "east", south: "west", east: "south", west: "north", up: "up", down: "down" },
    west: { north: "west", south: "east", east: "north", west: "south", up: "up", down: "down" },
    up: { north: "up", south: "down", east: "east", west: "west", up: "south", down: "north" },
    down: { north: "down", south: "up", east: "east", west: "west", up: "north", down: "south" },
};

function directionFromOffset(offset) {
    if (offset.x === 1 && offset.y === 0 && offset.z === 0) return "east";
    if (offset.x === -1 && offset.y === 0 && offset.z === 0) return "west";
    if (offset.x === 0 && offset.y === 1 && offset.z === 0) return "up";
    if (offset.x === 0 && offset.y === -1 && offset.z === 0) return "down";
    if (offset.x === 0 && offset.y === 0 && offset.z === 1) return "south";
    if (offset.x === 0 && offset.y === 0 && offset.z === -1) return "north";
    return undefined;
}

function isPipeConnectionOpen(block, direction) {
    if (!block.hasTag("dorios:isTube")) return true;
    try {
        if (block.hasTag("dorios:isExporter") || block.hasTag("dorios:isImporter")) {
            const facing = block.permutation.getState("minecraft:block_face");
            direction = ENDPOINT_DIRECTIONS[facing]?.[direction] ?? direction;
        }
        return block.permutation.getState(`utilitycraft:${direction}`) === true;
    } catch {
        return false;
    }
}

/**
 * UC owns the cable geometry, colors and wrench settings. Read its resulting
 * block states on both ends; AT owns only the independent overclock traversal.
 */
export function isOverclockNetworkConnectionOpen(block, offset, neighbor) {
    if (!block || !neighbor) return false;
    const direction = directionFromOffset(offset);
    if (!direction) return false;
    if (!isPipeConnectionOpen(block, direction)) return false;
    return isPipeConnectionOpen(neighbor, OPPOSITE_DIRECTIONS[direction]);
}

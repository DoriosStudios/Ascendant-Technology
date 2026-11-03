// @ts-check

const OPPOSITE_DIRECTIONS = Object.freeze({
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
});

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

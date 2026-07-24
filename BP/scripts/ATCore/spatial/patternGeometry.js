// @ts-check

const modes = new Map([
    ["single", {
        id: "single",
        title: "1x1",
        short: "1x1",
        description: "Places one block directly in front of the machine.",
    }],
    ["plane3x3", {
        id: "plane3x3",
        title: "3x3 Plane",
        short: "3x3",
        description: "Places a vertical 3x3 face in front of the machine.",
    }],
    ["cube3x3x3", {
        id: "cube3x3x3",
        title: "3x3x3 Cube",
        short: "CUBE",
        description: "Places a 3x3x3 volume in front of the machine.",
    }],
    ["line", {
        id: "line",
        title: "Line",
        short: "LINE",
        description: "Places a straight line of five blocks forward.",
    }],
]);

export const PATTERN_MODE_ORDER = ["single", "plane3x3", "cube3x3x3", "line"];

export function getPatternMode(modeId) {
    return modes.get(modeId) ?? modes.get("single");
}

export function getPatternDirection(block) {
    const direction = block?.permutation.getState("minecraft:cardinal_direction");
    return direction === "north"
        || direction === "south"
        || direction === "east"
        || direction === "west"
        ? direction
        : null;
}

export function getPatternForward(block) {
    const direction = getPatternDirection(block);
    if (direction === "north") return { x: 0, y: 0, z: -1 };
    if (direction === "south") return { x: 0, y: 0, z: 1 };
    if (direction === "east") return { x: 1, y: 0, z: 0 };
    if (direction === "west") return { x: -1, y: 0, z: 0 };
    return null;
}

export function getPatternConfigurationSignature(block, modeId) {
    return `${getPatternDirection(block) ?? "invalid"}|${getPatternMode(modeId).id}`;
}

export function buildPatternPositions(block, modeId) {
    const mode = getPatternMode(modeId);
    const forward = getPatternForward(block);
    if (!forward) return [];

    const origin = block.location;
    const anchor = {
        x: origin.x + forward.x,
        y: origin.y,
        z: origin.z + forward.z,
    };

    if (mode.id === "single") return [anchor];
    if (mode.id === "line") return buildLine(anchor, forward);
    if (mode.id === "cube3x3x3") return buildCube(anchor, forward);
    return buildPlane(anchor, forward);
}

function buildLine(anchor, forward) {
    const positions = new Array(5);
    for (let step = 0; step < positions.length; step++) {
        positions[step] = {
            x: anchor.x + forward.x * step,
            y: anchor.y,
            z: anchor.z + forward.z * step,
        };
    }
    return positions;
}

function buildPlane(anchor, forward) {
    const positions = new Array(9);
    let index = 0;

    if (forward.x !== 0) {
        for (let y = 0; y < 3; y++) {
            for (let z = -1; z <= 1; z++) {
                positions[index++] = { x: anchor.x, y: anchor.y + y, z: anchor.z + z };
            }
        }
        return positions;
    }

    for (let x = -1; x <= 1; x++) {
        for (let y = 0; y < 3; y++) {
            positions[index++] = { x: anchor.x + x, y: anchor.y + y, z: anchor.z };
        }
    }
    return positions;
}

function buildCube(anchor, forward) {
    const positions = new Array(27);
    let index = 0;

    if (forward.x !== 0) {
        for (let depth = 0; depth < 3; depth++) {
            for (let y = 0; y < 3; y++) {
                for (let z = -1; z <= 1; z++) {
                    positions[index++] = {
                        x: anchor.x + forward.x * depth,
                        y: anchor.y + y,
                        z: anchor.z + z,
                    };
                }
            }
        }
        return positions;
    }

    for (let depth = 0; depth < 3; depth++) {
        for (let x = -1; x <= 1; x++) {
            for (let y = 0; y < 3; y++) {
                positions[index++] = {
                    x: anchor.x + x,
                    y: anchor.y + y,
                    z: anchor.z + forward.z * depth,
                };
            }
        }
    }
    return positions;
}

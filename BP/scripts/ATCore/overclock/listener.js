// @ts-check

import { system, world } from "@minecraft/server";
import {
    scheduleOverclockNetworkRescan,
    touchesOverclockNetwork,
} from "./network.js";

const UNIVERSAL_PIPE_FACE_UPDATE_EVENT = "utilitycraft:universal_pipe_face_update";

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== UNIVERSAL_PIPE_FACE_UPDATE_EVENT) return;

    try {
        const update = JSON.parse(message);
        const location = update?.location;
        const dimensionId = update?.dimensionId;
        if (typeof dimensionId !== "string"
            || !location
            || ![location.x, location.y, location.z].every(Number.isFinite)) return;
        const dimension = world.getDimension(dimensionId);
        scheduleOverclockNetworkRescan(location, dimension);
    } catch {}
}, {
    namespaces: ["utilitycraft"],
});

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    const dimension = block.dimension;
    const location = { ...block.location };
    system.run(() => {
        if (touchesOverclockNetwork(dimension, location)) {
            scheduleOverclockNetworkRescan(location, dimension);
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe(({ block }) => {
    const dimension = block.dimension;
    const location = { ...block.location };
    system.run(() => {
        if (touchesOverclockNetwork(dimension, location)) {
            scheduleOverclockNetworkRescan(location, dimension);
        }
    });
});

world.afterEvents.pistonActivate.subscribe(({ piston, isExpanding, dimension }) => {
    const locations = piston.getAttachedBlocksLocations();
    if (!locations?.length) return;

    const direction = getPistonDirection(
        Number(piston.block.permutation.getState("facing_direction")),
    );
    const step = isExpanding ? -1 : 1;

    system.runTimeout(() => {
        for (const location of locations) {
            const pairedLocation = {
                x: location.x + direction.x * step,
                y: location.y + direction.y * step,
                z: location.z + direction.z * step,
            };
            queueIfConnected(dimension, location);
            queueIfConnected(dimension, pairedLocation);
        }
    }, 2);
});

function queueIfConnected(dimension, location) {
    if (touchesOverclockNetwork(dimension, location)) {
        scheduleOverclockNetworkRescan(location, dimension);
    }
}

function getPistonDirection(direction) {
    switch (direction) {
        case 0: return { x: 0, y: -1, z: 0 };
        case 1: return { x: 0, y: 1, z: 0 };
        case 2: return { x: 0, y: 0, z: -1 };
        case 3: return { x: 0, y: 0, z: 1 };
        case 4: return { x: -1, y: 0, z: 0 };
        case 5: return { x: 1, y: 0, z: 0 };
        default: return { x: 0, y: 0, z: 0 };
    }
}

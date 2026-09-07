// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

const COMMAND_ID = "sc:test_arrow_velocity";
const TARGET_RANGE = 64;
const VELOCITY = 2.5;
const IMPULSE = 0.15;

DoriosLib.registry.customCommand({
    name: COMMAND_ID,
    description: "Fires a test arrow at the nearest living target.",
    permissionLevel: "any",
    cheatsRequired: true,
    parameters: [{ name: "location", type: "location" }],
    callback(origin, location) {
        const source = origin.sourceEntity ?? origin.sourceBlock;
        if (!source) {
            console.warn(`[${COMMAND_ID}] A player or command block source is required.`);
            return;
        }

        const spawnLocation = /** @type {import("@minecraft/server").Vector3} */ (location);
        const target = findNearestLivingTarget(
            source.dimension,
            spawnLocation,
            origin.sourceEntity?.id,
        );
        if (!target) {
            sendFeedback(origin.sourceEntity, "§cNo living target found within 64 blocks.");
            return;
        }

        const arrow = source.dimension.spawnEntity("minecraft:arrow", spawnLocation);
        const direction = directionTo(spawnLocation, target.location);
        const velocity = scale(direction, VELOCITY);
        const impulse = scale(direction, IMPULSE);
        const motion = /** @type {ArrowMotionMethods} */ (arrow);

        let mode;
        if (typeof motion.setVelocity === "function" && typeof motion.addImpulse === "function") {
            motion.setVelocity(velocity);
            motion.addImpulse(impulse);
            mode = "setVelocity + addImpulse";
        } else {
            // Script API 2.9 exposes these names instead of setVelocity/addImpulse.
            arrow.clearVelocity();
            arrow.applyImpulse(scale(direction, VELOCITY + IMPULSE));
            mode = "clearVelocity + applyImpulse fallback";
        }

        sendFeedback(
            origin.sourceEntity,
            `§aArrow fired at ${target.typeId} using ${mode}.`,
        );
    },
});

/**
 * @typedef {import("@minecraft/server").Entity & {
 *   setVelocity?: (velocity: import("@minecraft/server").Vector3) => void,
 *   addImpulse?: (impulse: import("@minecraft/server").Vector3) => void,
 * }} ArrowMotionMethods
 */

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 * @param {string|undefined} sourceId
 */
function findNearestLivingTarget(dimension, location, sourceId) {
    return dimension.getEntities({ location, maxDistance: TARGET_RANGE })
        .filter((entity) => entity.id !== sourceId && entity.getComponent("minecraft:health"))
        .sort((left, right) => distanceSquared(location, left.location) - distanceSquared(location, right.location))[0];
}

/**
 * @param {import("@minecraft/server").Vector3} from
 * @param {import("@minecraft/server").Vector3} to
 */
function directionTo(from, to) {
    const x = to.x - from.x;
    const y = to.y + 0.9 - from.y;
    const z = to.z - from.z;
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
}

/** @param {import("@minecraft/server").Vector3} vector @param {number} amount */
function scale(vector, amount) {
    return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

/** @param {import("@minecraft/server").Vector3} left @param {import("@minecraft/server").Vector3} right */
function distanceSquared(left, right) {
    const x = left.x - right.x;
    const y = left.y - right.y;
    const z = left.z - right.z;
    return x * x + y * y + z * z;
}

/** @param {import("@minecraft/server").Entity|undefined} player @param {string} message */
function sendFeedback(player, message) {
    player?.sendMessage(message);
}

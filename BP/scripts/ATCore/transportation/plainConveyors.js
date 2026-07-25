// @ts-check

/**
 * Creates the plain conveyor behavior without owning any global listeners.
 * Movement speed is expressed in blocks per second and converted using the
 * shared two-tick payload scheduler.
 */
export function createPlainConveyors(ctx) {
    function registerTypes() {
        for (const tier of ctx.tiers) {
            for (const shape of ctx.plainShapes) {
                ctx.defineType(`utilitycraft:${tier.id}_conveyor_${shape}`, {
                    tier: tier.id,
                    shape,
                    blocksPerSecond: tier.blocksPerSecond,
                    bridgeRange: tier.bridgeRange,
                });
            }
        }
    }

    function resolveOutput(shape, facing, verticalDirection = "up") {
        if (shape === "vertical") return ctx.directionVectors[verticalDirection];
        const horizontal = ctx.directionVectors[facing] ?? ctx.zeroVector;
        if (shape === "inclined") return { x: horizontal.x, y: 1, z: horizontal.z };
        if (shape === "declined") return { x: horizontal.x, y: -1, z: horizontal.z };
        return horizontal;
    }

    function movementDelta(meta, facing, verticalDirection) {
        const blocksPerStep = Math.max(0, Number(meta?.blocksPerSecond) || 0)
            * ctx.movementInterval / 20;
        const horizontal = ctx.directionVectors[facing] ?? ctx.zeroVector;

        if (meta.shape === "vertical") {
            return {
                x: 0,
                y: verticalDirection === "down" ? -blocksPerStep : blocksPerStep,
                z: 0,
            };
        }
        if (meta.shape === "inclined") {
            return { x: horizontal.x * blocksPerStep, y: blocksPerStep, z: horizontal.z * blocksPerStep };
        }
        if (meta.shape === "declined") {
            return { x: horizontal.x * blocksPerStep, y: -blocksPerStep, z: horizontal.z * blocksPerStep };
        }
        return { x: horizontal.x * blocksPerStep, y: 0, z: horizontal.z * blocksPerStep };
    }

    function directionalProgress(location, block, facing) {
        const localX = ctx.clamp01(location.x - block.location.x);
        const localZ = ctx.clamp01(location.z - block.location.z);
        if (facing === "north") return 1 - localZ;
        if (facing === "south") return localZ;
        if (facing === "east") return localX;
        if (facing === "west") return 1 - localX;
        return 0;
    }

    function buildTarget(entity, delta, block, facing, shape, centerStrength = 0) {
        const target = {
            x: entity.location.x + delta.x,
            y: entity.location.y + delta.y,
            z: entity.location.z + delta.z,
        };

        if (centerStrength > 0) {
            const centerX = block.location.x + 0.5;
            const centerZ = block.location.z + 0.5;
            target.x += (centerX - target.x) * centerStrength;
            target.z += (centerZ - target.z) * centerStrength;
        }

        if (shape === "inclined" || shape === "declined") {
            const progress = directionalProgress(target, block, facing);
            const slopeProgress = shape === "inclined" ? progress : 1 - progress;
            const slopeY = block.location.y + 0.3 + slopeProgress * 0.85;
            target.y = shape === "inclined" ? Math.max(target.y, slopeY) : Math.min(target.y, slopeY);
        }
        return target;
    }

    function canMoveWithSpacing(entity, payloads, direction) {
        if (!entity || payloads.length <= 1 || !direction) return true;
        const axis = direction === "up" || direction === "down"
            ? "y"
            : direction === "east" || direction === "west" ? "x" : "z";
        const sign = direction === "east" || direction === "south" || direction === "up" ? 1 : -1;
        const value = entity.location[axis] ?? 0;

        for (const other of payloads) {
            if (!other || other.id === entity.id) continue;
            const delta = ((other.location[axis] ?? 0) - value) * sign;
            if (delta > 0 && delta < ctx.itemSpacing) return false;
        }
        return true;
    }

    function process(block, meta, bucket, forcedShape = null) {
        const facing = ctx.getState(block, "minecraft:cardinal_direction");
        if (typeof facing !== "string") return;

        const shape = forcedShape ?? meta.shape;
        const verticalDirection = shape === "vertical"
            && ctx.getState(block, ctx.verticalDirectionState) === "down" ? "down" : "up";
        const effectiveMeta = shape === meta.shape ? meta : { ...meta, shape };
        const delta = movementDelta(effectiveMeta, facing, verticalDirection);
        const direction = shape === "vertical" ? verticalDirection : facing;
        const outputOffset = resolveOutput(shape, facing, verticalDirection);
        const targetFace = shape === "vertical"
            ? ctx.oppositeDirections[verticalDirection]
            : ctx.oppositeDirections[facing];
        const centerStrength = shape === "vertical" ? 0.35 : 0;

        for (const item of bucket.items) {
            if (!ctx.isValid(item) || !canMoveWithSpacing(item, bucket.items, direction)) continue;
            if (ctx.tryInsert(item, block, outputOffset, targetFace)) {
                ctx.rememberMove(item, block.location);
                continue;
            }
            ctx.teleport(item, buildTarget(item, delta, block, facing, shape, centerStrength));
            ctx.rememberMove(item, block.location);
        }

        if (meta.tier !== "aetherium") return;
        for (const creature of bucket.creatures) {
            if (!ctx.isValid(creature)) continue;
            ctx.teleport(creature, buildTarget(creature, delta, block, facing, shape, centerStrength));
            ctx.rememberMove(creature, block.location);
        }
    }

    return {
        registerTypes,
        resolveOutput,
        canMoveWithSpacing,
        process,
    };
}

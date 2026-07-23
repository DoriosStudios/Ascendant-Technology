// Shared creature filters.
const CREATURE_EXCLUDED_TYPES = [
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

// Shared creature family filters.
const CREATURE_EXCLUDED_FAMILIES = [
    "player",
    "inanimate",
    "painting",
    "projectile",
    "machine",
    "dorios:energy_container",
    "dorios:fluid_container",
    "dorios:battery",
    "dorios:tank",
    "dorios:machine"
];

export function createPlainConveyors(ctx) {
    const clamp01 = value => Math.max(0, Math.min(1, value));

    // Register the tiered plain conveyor blocks.
    function registerPlainConveyorTypes() {
        for (const tier of ctx.tierDefs) {
            for (const shape of ctx.plainShapes) {
                ctx.defineConveyorType(`utilitycraft:${tier.tier}_conveyor_${shape}`, {
                    tier: tier.tier,
                    shape,
                    ips: tier.ips,
                    bridgeRange: tier.bridgeRange
                });
            }
        }
    }

    // Scale horizontal speed from IPS.
    function getSpeed(ips) {
        const normalized = Number.isFinite(ips) && ips > 0 ? ips : ctx.baseIps;
        return Math.min(ctx.maxSpeed, ctx.baseSpeed * (normalized / ctx.baseIps));
    }

    // Scale vertical speed from IPS.
    function getVerticalSpeed(ips) {
        const normalized = Number.isFinite(ips) && ips > 0 ? ips : ctx.baseIps;
        return Math.min(ctx.maxVerticalSpeed, ctx.baseVerticalSpeed * (normalized / ctx.baseIps));
    }

    // Resolve the final horizontal speed.
    function getConveyorSpeed(meta) {
        const base = getSpeed(meta?.ips);
        return meta?.tier === "aetherium" ? base * ctx.aetheriumSpeedMultiplier : base;
    }

    // Resolve the final vertical speed.
    function getConveyorVerticalSpeed(meta) {
        const base = getVerticalSpeed(meta?.ips);
        return meta?.tier === "aetherium" ? base * ctx.aetheriumSpeedMultiplier : base;
    }

    // Resolve the output block offset.
    function resolveOutputOffset(shape, facing) {
        if (shape === "vertical") return { ...ctx.cardinalOffsets.up };
        const base = ctx.cardinalOffsets[facing] ?? { x: 0, y: 0, z: 0 };
        if (shape === "inclined") return { x: base.x, y: 1, z: base.z };
        if (shape === "declined") return { x: base.x, y: -1, z: base.z };
        return base;
    }

    // Find item entities near the conveyor.
    function getItemsNear(block, radius = 0.9) {
        const { x, y, z } = block.location;
        return block.dimension.getEntities({
            type: "minecraft:item",
            location: { x: x + 0.5, y: y + 0.4, z: z + 0.5 },
            maxDistance: radius
        });
    }

    // Find living entities near the conveyor.
    function getCreaturesNear(block, radius = 0.9) {
        const { x, y, z } = block.location;
        return block.dimension.getEntities({
            location: { x: x + 0.5, y: y + 0.5, z: z + 0.5 },
            maxDistance: radius,
            excludeTypes: CREATURE_EXCLUDED_TYPES,
            excludeFamilies: CREATURE_EXCLUDED_FAMILIES
        });
    }

    // Read the stack carried by an item entity.
    function getItemStackFromEntity(item) {
        return item?.getComponent("minecraft:item")?.itemStack ?? null;
    }

    // Read the current conveyor tick.
    function getConveyorTick() {
        return Math.max(0, Math.floor(Number(globalThis.tickCount ?? 0)));
    }

    // Check whether an item already moved this tick.
    function hasItemMovedThisTick(item) {
        return Number(item?.getDynamicProperty?.(ctx.itemMoveTickProp) ?? -1) === getConveyorTick();
    }

    // Check whether an entity already moved this tick.
    function hasEntityMovedThisTick(entity) {
        return Number(entity?.getDynamicProperty?.(ctx.entityMoveTickProp) ?? -1) === getConveyorTick();
    }

    // Mark an item as moved this tick.
    function markItemMoved(item, blockKey) {
        if (!item?.setDynamicProperty) return;
        try {
            item.setDynamicProperty(ctx.itemMoveTickProp, getConveyorTick());
            if (blockKey) item.setDynamicProperty(ctx.itemMoveKeyProp, blockKey);
        } catch {
            // Ignore dynamic property failures.
        }
    }

    // Mark an entity as moved this tick.
    function markEntityMoved(entity, blockKey) {
        if (!entity?.setDynamicProperty) return;
        try {
            entity.setDynamicProperty(ctx.entityMoveTickProp, getConveyorTick());
            if (blockKey) entity.setDynamicProperty(ctx.entityMoveKeyProp, blockKey);
        } catch {
            // Ignore dynamic property failures.
        }
    }

    // Keep items spaced on the same axis.
    function canMoveItemWithSpacing(item, items, direction) {
        if (!item || !Array.isArray(items) || items.length <= 1 || !direction) return true;
        const axis = direction === "up" || direction === "down" ? "y" : direction === "east" || direction === "west" ? "x" : "z";
        const sign = direction === "east" || direction === "south" || direction === "up" ? 1 : -1;
        const value = item.location?.[axis] ?? 0;

        for (const other of items) {
            if (!other || other === item) continue;
            const delta = ((other.location?.[axis] ?? 0) - value) * sign;
            if (delta > 0 && delta < ctx.itemSpacing) return false;
        }

        return true;
    }

    // Hold stackable items on aetherium belts until they merge.
    function shouldHoldAetheriumItem(meta, item) {
        if (meta?.tier !== "aetherium") return false;
        const stack = getItemStackFromEntity(item);
        return Boolean(stack) && stack.maxAmount >= 64 && stack.amount < stack.maxAmount;
    }

    // Try to inject the item into a target inventory.
    function tryInsertIntoContainer(item, block, outputOffset) {
        if (!item || !block?.dimension || !outputOffset) return false;
        const stack = getItemStackFromEntity(item);
        if (!stack) return false;

        const target = {
            x: block.location.x + outputOffset.x,
            y: block.location.y + outputOffset.y,
            z: block.location.z + outputOffset.z
        };
        const result = DoriosAPI?.containers?.addItemAt?.(target, block.dimension, stack);

        if (result === true) {
            item.remove();
            return true;
        }

        if (typeof result !== "number" || result <= 0) return false;

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

    // Move an item along the belt.
    function getDirectionalProgress(location, block, facing) {
        if (!location || !block?.location) return 0;
        const localX = clamp01(location.x - block.location.x);
        const localZ = clamp01(location.z - block.location.z);

        switch (facing) {
            case "north": return 1 - localZ;
            case "south": return localZ;
            case "east": return localX;
            case "west": return 1 - localX;
            default: return 0;
        }
    }

    function applySlopeHeight(target, block, facing, shape) {
        if (!target || !block || (shape !== "inclined" && shape !== "declined")) return target;
        const progress = getDirectionalProgress(target, block, facing);
        const slopeProgress = shape === "inclined" ? progress : 1 - progress;
        const slopeY = block.location.y + 0.3 + slopeProgress * 0.85;

        target.y = shape === "inclined"
            ? Math.max(target.y, slopeY)
            : Math.min(target.y, slopeY);

        return target;
    }

    function buildMoveTarget(source, delta, block, centerStrength = 0, facing = null, shape = null) {
        const target = {
            x: source.location.x + delta.x,
            y: source.location.y + delta.y,
            z: source.location.z + delta.z
        };

        if (centerStrength > 0 && block) {
            const centerX = block.location.x + 0.5;
            const centerZ = block.location.z + 0.5;
            target.x += (centerX - target.x) * centerStrength;
            target.z += (centerZ - target.z) * centerStrength;
        }

        return applySlopeHeight(target, block, facing, shape);
    }

    function moveItem(item, delta, block, centerStrength = 0) {
        if (!item || !delta) return;
        const target = buildMoveTarget(item, delta, block, centerStrength);
        item.teleport(target);
    }

    // Move an entity along the belt.
    function moveEntity(entity, delta, block, centerStrength = 0) {
        if (!entity || !delta) return;
        const target = buildMoveTarget(entity, delta, block, centerStrength);
        try {
            entity.teleport(target);
        } catch {
            // Ignore teleport failures.
        }
    }

    // Process the regular belt movement shapes.
    function processStandardConveyor(block, meta, facing, forcedShape = null, context = {}) {
        const shape = forcedShape ?? meta.shape;
        const baseOffset = ctx.cardinalOffsets[facing] ?? { x: 0, y: 0, z: 0 };
        const speed = getConveyorSpeed(meta);
        const verticalSpeed = getConveyorVerticalSpeed(meta);
        const slopeSpeed = Math.min(speed, verticalSpeed);
        const verticalDirection = shape === "vertical" && block.getState?.(ctx.verticalDirectionState) === "down" ? "down" : "up";

        let delta = { x: 0, y: 0, z: 0 };
        let centerStrength = 0;

        switch (shape) {
            case "horizontal":
            case "bridge_receiver":
                delta = { x: baseOffset.x * speed, y: 0, z: baseOffset.z * speed };
                break;
            case "inclined":
                delta = { x: baseOffset.x * slopeSpeed, y: slopeSpeed, z: baseOffset.z * slopeSpeed };
                break;
            case "declined":
                delta = { x: baseOffset.x * slopeSpeed, y: -slopeSpeed, z: baseOffset.z * slopeSpeed };
                break;
            case "vertical":
                delta = { x: 0, y: verticalDirection === "down" ? -verticalSpeed : verticalSpeed, z: 0 };
                centerStrength = 0.35;
                break;
            default:
                return;
        }

        const outputOffset = shape === "vertical" && verticalDirection === "down"
            ? { ...ctx.cardinalOffsets.down }
            : resolveOutputOffset(shape, facing);
        const detectionRadius = shape === "inclined" || shape === "declined" ? ctx.inclinedDetectionRadius : 0.9;
        const items = getItemsNear(block, detectionRadius);
        const moveDirection = shape === "vertical" ? verticalDirection : facing;
        const blockKey = ctx.posKey(block.location);

        for (const item of items) {
            if (hasItemMovedThisTick(item)) continue;
            if (!getItemStackFromEntity(item)) continue;
            if (shouldHoldAetheriumItem(meta, item)) continue;
            if (!canMoveItemWithSpacing(item, items, moveDirection)) continue;
            if (tryInsertIntoContainer(item, block, outputOffset)) {
                markItemMoved(item, blockKey);
                continue;
            }

            const itemTarget = buildMoveTarget(item, delta, block, centerStrength, facing, shape);
            item.teleport(itemTarget);
            markItemMoved(item, blockKey);
        }

        if (meta?.tier !== "aetherium") return;

        for (const entity of getCreaturesNear(block, detectionRadius)) {
            if (entity?.isValid === false || hasEntityMovedThisTick(entity)) continue;

            const entityTarget = buildMoveTarget(entity, delta, block, centerStrength, facing, shape);
            try {
                entity.teleport(entityTarget);
            } catch {
                // Ignore teleport failures.
            }
            markEntityMoved(entity, blockKey);
        }
    }

    return {
        registerPlainConveyorTypes,
        getConveyorSpeed,
        getConveyorVerticalSpeed,
        resolveOutputOffset,
        getItemsNear,
        getCreaturesNear,
        getItemStackFromEntity,
        getConveyorTick,
        hasItemMovedThisTick,
        hasEntityMovedThisTick,
        markItemMoved,
        markEntityMoved,
        canMoveItemWithSpacing,
        shouldHoldAetheriumItem,
        tryInsertIntoContainer,
        moveItem,
        moveEntity,
        processStandardConveyor
    };
}

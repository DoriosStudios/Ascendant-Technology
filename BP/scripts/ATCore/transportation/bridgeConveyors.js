// @ts-check

/** Creates bridge path management and payload transfer behavior. */
export function createBridgeConveyors(ctx) {
    const linksByDimension = new Map();
    const pathsByTransmitter = new Map();
    const ownerByPath = new Map();

    function dimensionMap(root, dimensionId) {
        let map = root.get(dimensionId);
        if (!map) {
            map = new Map();
            root.set(dimensionId, map);
        }
        return map;
    }

    function registerTypes() {
        for (const tier of ctx.tiers) {
            ctx.defineType(`utilitycraft:${tier.id}_conveyor_bridge_transmitter`, {
                tier: tier.id,
                shape: "bridge_transmitter",
                blocksPerSecond: tier.blocksPerSecond,
                bridgeRange: tier.bridgeRange,
            });
            ctx.defineType(`utilitycraft:${tier.id}_conveyor_bridge_receiver`, {
                tier: tier.id,
                shape: "bridge_receiver",
                blocksPerSecond: tier.blocksPerSecond,
                bridgeRange: tier.bridgeRange,
            });
        }
    }

    function pathDefinition(tier) {
        return ctx.bridgePaths[tier] ?? null;
    }

    function isPath(block, tier = null) {
        if (!block) return false;
        if (block.typeId === ctx.legacyBridgePathId || block.hasTag?.("dorios:conveyor_bridge_path")) return true;
        if (tier) {
            const definition = pathDefinition(tier);
            return Boolean(definition)
                && (block.typeId === definition.id || block.hasTag?.(definition.tag));
        }
        return Object.values(ctx.bridgePaths).some((definition) =>
            block.typeId === definition.id || block.hasTag?.(definition.tag));
    }

    function isClearable(block) {
        if (!block || ctx.isAir(block) || isPath(block)) return false;
        if (ctx.isUnbreakable(block.typeId)) return false;
        if (block.hasTag?.("minecraft:replaceable")
            || block.hasTag?.("minecraft:replaceable_plants")
            || block.hasTag?.("minecraft:plant")) return true;
        return ctx.bridgeClearableBlocks.has(block.typeId)
            || ctx.bridgeClearableSuffixes.some((suffix) => block.typeId.endsWith(suffix));
    }

    function evaluate(block, meta, facing) {
        const offset = ctx.directionVectors[facing];
        if (!offset || !meta?.bridgeRange) return { receiver: null, obstructed: false, steps: 0 };
        let receiver = null;
        let steps = 0;
        let obstructed = false;

        for (let step = 1; step <= meta.bridgeRange; step++) {
            const candidate = ctx.safeGetBlock(block.dimension, {
                x: block.location.x + offset.x * step,
                y: block.location.y,
                z: block.location.z + offset.z * step,
            });
            if (!candidate) continue;
            if (candidate.hasTag?.(ctx.bridgeTag)) {
                const candidateMeta = ctx.getType(candidate.typeId);
                if (candidateMeta?.shape === "bridge_receiver" && candidateMeta.tier === meta.tier) {
                    receiver = candidate;
                    steps = step;
                    break;
                }
            }
            if (ctx.isAir(candidate) || isPath(candidate, meta.tier) || isClearable(candidate)) continue;
            obstructed = true;
        }
        return { receiver, obstructed, steps };
    }

    function clearOwnedPath(dimension, transmitterKey, fallback = null) {
        const pathMap = dimensionMap(pathsByTransmitter, dimension.id);
        const ownerMap = dimensionMap(ownerByPath, dimension.id);
        const stored = pathMap.get(transmitterKey);
        const keys = stored ? [...stored] : [];

        if (keys.length === 0 && fallback?.facing && fallback?.range) {
            const offset = ctx.directionVectors[fallback.facing];
            for (let step = 1; offset && step <= fallback.range; step++) {
                keys.push(ctx.positionKey({
                    x: fallback.location.x + offset.x * step,
                    y: fallback.location.y,
                    z: fallback.location.z + offset.z * step,
                }));
            }
        }

        for (const key of keys) {
            if (ownerMap.get(key) && ownerMap.get(key) !== transmitterKey) continue;
            const position = ctx.parsePositionKey(key);
            const block = position ? ctx.safeGetBlock(dimension, position) : null;
            if (block && isPath(block)) block.setType("minecraft:air");
            ownerMap.delete(key);
        }
        pathMap.delete(transmitterKey);
        dimensionMap(linksByDimension, dimension.id).delete(transmitterKey);
    }

    function createPath(transmitter, meta, facing, steps) {
        const definition = pathDefinition(meta.tier);
        const offset = ctx.directionVectors[facing];
        if (!definition || !offset || steps <= 1) return;
        const transmitterKey = ctx.positionKey(transmitter.location);
        const pathMap = dimensionMap(pathsByTransmitter, transmitter.dimension.id);
        const ownerMap = dimensionMap(ownerByPath, transmitter.dimension.id);
        const owned = new Set();

        for (let step = 1; step < steps; step++) {
            const position = {
                x: transmitter.location.x + offset.x * step,
                y: transmitter.location.y,
                z: transmitter.location.z + offset.z * step,
            };
            const target = ctx.safeGetBlock(transmitter.dimension, position);
            if (!target) continue;
            if (isClearable(target)) target.setType("minecraft:air");
            if (!ctx.isAir(target) && !isPath(target, meta.tier)) continue;
            target.setType(definition.id);
            ctx.setState(target, ctx.bridgeDirectionState, facing);
            const pathKey = ctx.positionKey(position);
            owned.add(pathKey);
            ownerMap.set(pathKey, transmitterKey);
        }
        pathMap.set(transmitterKey, owned);
    }

    function notifyObstructed(player) {
        try {
            player?.onScreenDisplay?.setActionBar(ctx.translate("ui.utilitycraft.conveyor.bridge_obstructed"));
        } catch {
            // The bridge remains disconnected if its owner is no longer valid.
        }
    }

    function refreshTransmitter(block, meta = ctx.getType(block?.typeId), player = null) {
        if (!block?.dimension || meta?.shape !== "bridge_transmitter") return null;
        const facing = ctx.getState(block, "minecraft:cardinal_direction");
        if (typeof facing !== "string") return null;
        const transmitterKey = ctx.positionKey(block.location);
        clearOwnedPath(block.dimension, transmitterKey, {
            location: block.location,
            facing,
            range: meta.bridgeRange,
        });

        const link = evaluate(block, meta, facing);
        if (!link.receiver || link.obstructed) {
            if (link.receiver && link.obstructed) notifyObstructed(player);
            ctx.scheduleTopology(block.dimension);
            ctx.emitEnergyUpdate(block, player);
            return null;
        }

        createPath(block, meta, facing, link.steps);
        dimensionMap(linksByDimension, block.dimension.id).set(transmitterKey, {
            receiver: { ...link.receiver.location },
            receiverKey: ctx.positionKey(link.receiver.location),
        });
        ctx.scheduleTopology(block.dimension);
        ctx.emitEnergyUpdate(block, player);
        return link.receiver;
    }

    function refreshReceiver(receiver, meta = ctx.getType(receiver?.typeId), player = null) {
        if (!receiver?.dimension || meta?.shape !== "bridge_receiver") return;
        const position = receiver.location;
        for (const direction of ctx.horizontalDirections) {
            const offset = ctx.directionVectors[direction];
            for (let step = 1; step <= meta.bridgeRange; step++) {
                const candidate = ctx.safeGetBlock(receiver.dimension, {
                    x: position.x + offset.x * step,
                    y: position.y,
                    z: position.z + offset.z * step,
                });
                const candidateMeta = ctx.getType(candidate?.typeId);
                if (candidateMeta?.shape !== "bridge_transmitter" || candidateMeta.tier !== meta.tier) continue;
                const facing = ctx.getState(candidate, "minecraft:cardinal_direction");
                if (facing === ctx.oppositeDirections[direction]) refreshTransmitter(candidate, candidateMeta, player);
            }
        }
    }

    function removeTransmitter(dimension, location, meta, facing) {
        const key = ctx.positionKey(location);
        clearOwnedPath(dimension, key, { location, facing, range: meta?.bridgeRange ?? 0 });
        ctx.scheduleTopology(dimension);
    }

    function getLinkedReceiver(block) {
        const link = dimensionMap(linksByDimension, block.dimension.id).get(ctx.positionKey(block.location));
        if (!link) return null;
        const receiver = ctx.safeGetBlock(block.dimension, link.receiver);
        const meta = ctx.getType(receiver?.typeId);
        if (meta?.shape === "bridge_receiver") return receiver;
        dimensionMap(linksByDimension, block.dimension.id).delete(ctx.positionKey(block.location));
        ctx.scheduleTopology(block.dimension);
        return null;
    }

    function getVirtualEdge(dimensionId, transmitterKey) {
        return dimensionMap(linksByDimension, dimensionId).get(transmitterKey)?.receiverKey ?? null;
    }

    function refreshPathOwner(dimension, location, player = null) {
        const ownerKey = dimensionMap(ownerByPath, dimension.id).get(ctx.positionKey(location));
        if (!ownerKey) return false;
        const ownerPosition = ctx.parsePositionKey(ownerKey);
        const transmitter = ownerPosition ? ctx.safeGetBlock(dimension, ownerPosition) : null;
        const meta = ctx.getType(transmitter?.typeId);
        if (meta?.shape === "bridge_transmitter") refreshTransmitter(transmitter, meta, player);
        return true;
    }

    function process(block, meta, bucket) {
        const receiver = getLinkedReceiver(block);
        if (!receiver) {
            ctx.processPlain(block, meta, bucket, "horizontal");
            return;
        }
        const target = {
            x: receiver.location.x + 0.5,
            y: receiver.location.y + 0.1,
            z: receiver.location.z + 0.5,
        };
        for (const item of bucket.items) {
            if (!ctx.isValid(item)) continue;
            ctx.teleport(item, target);
            ctx.rememberMove(item, block.location);
        }
        if (meta.tier !== "aetherium") return;
        for (const creature of bucket.creatures) {
            if (!ctx.isValid(creature)) continue;
            ctx.teleport(creature, target);
            ctx.rememberMove(creature, block.location);
        }
    }

    return {
        registerTypes,
        isPath,
        evaluate,
        refreshTransmitter,
        refreshReceiver,
        removeTransmitter,
        getLinkedReceiver,
        getVirtualEdge,
        refreshPathOwner,
        process,
    };
}

export function createBridgeConveyors(ctx) {
    // Register the bridge tiered conveyor blocks.
    function registerBridgeConveyorTypes() {
        for (const tier of ctx.tierDefs) {
            ctx.defineConveyorType(`utilitycraft:${tier.tier}_conveyor_bridge_transmitter`, {
                tier: tier.tier,
                shape: "bridge_transmitter",
                ips: tier.ips,
                bridgeRange: tier.bridgeRange
            });
            ctx.defineConveyorType(`utilitycraft:${tier.tier}_conveyor_bridge_receiver`, {
                tier: tier.tier,
                shape: "bridge_receiver",
                ips: tier.ips,
                bridgeRange: tier.bridgeRange
            });
        }
    }

    // Notify the player when the bridge line is blocked.
    function notifyBridgeObstructed(player) {
        if (!player?.onScreenDisplay) return;
        try {
            player.onScreenDisplay.setActionBar(ctx.tr("ui.utilitycraft.conveyor.bridge_obstructed"));
        } catch {
            ctx.system.run(() => {
                player.onScreenDisplay.setActionBar(ctx.tr("ui.utilitycraft.conveyor.bridge_obstructed"));
            });
        }
    }

    // Treat air variants as empty bridge space.
    function isAirLike(block) {
        return Boolean(block) && (block.isAir === true || ctx.airBlockIds.has(block.typeId));
    }

    // Match the old bridge path block too.
    function isLegacyBridgePathBlock(block) {
        return Boolean(block) && (block.typeId === ctx.legacyBridgePathBlockId || block.hasTag?.("dorios:conveyor_bridge_path") === true);
    }

    // Read the path definition for a tier.
    function getBridgePathDefinition(tier) {
        return tier ? ctx.bridgePathByTier[tier] ?? null : null;
    }

    // Resolve the path block identifier for a tier.
    function getBridgePathBlockId(tier) {
        return getBridgePathDefinition(tier)?.id ?? ctx.legacyBridgePathBlockId;
    }

    // Match any bridge path block.
    function isBridgePathBlock(block, tier = null) {
        if (!block) return false;
        if (tier) {
            const def = getBridgePathDefinition(tier);
            return Boolean(def) && (block.typeId === def.id || block.hasTag?.(def.tag) === true);
        }
        if (isLegacyBridgePathBlock(block)) return true;
        for (const def of Object.values(ctx.bridgePathByTier)) {
            if (block.typeId === def.id || block.hasTag?.(def.tag) === true) return true;
        }
        return false;
    }

    // Match tier-specific replaceable suffixes.
    function matchesClearableSuffix(typeId) {
        return typeof typeId === "string" && ctx.bridgeClearableSuffixes.some(suffix => typeId.endsWith(suffix));
    }

    // Decide whether the bridge can delete the block in front of it.
    function isBridgeClearableBlock(block) {
        if (!block || isAirLike(block) || isBridgePathBlock(block)) return false;
        const typeId = block.typeId;
        const unbreakables = DoriosAPI?.constants?.unbreakableBlocks;
        if (Array.isArray(unbreakables) && unbreakables.includes(typeId)) return false;
        if (block.hasTag?.("minecraft:replaceable") || block.hasTag?.("minecraft:replaceable_plants") || block.hasTag?.("minecraft:plant")) return true;
        return ctx.bridgeClearableBlocks.has(typeId) || matchesClearableSuffix(typeId);
    }

    // Find matching transmitters pointing into a receiver.
    function findBridgeTransmittersForReceiver(dim, receiver, receiverMeta) {
        if (!dim || !receiver || !receiverMeta?.bridgeRange) return [];
        const transmitters = [];
        const pos = receiver.location;

        for (const [dir, offset] of Object.entries(ctx.cardinalOffsets)) {
            for (let step = 1; step <= receiverMeta.bridgeRange; step++) {
                const candidate = dim.getBlock({
                    x: pos.x + offset.x * step,
                    y: pos.y,
                    z: pos.z + offset.z * step
                });
                if (!candidate?.hasTag?.(ctx.bridgeTag)) continue;

                const candidateMeta = ctx.getConveyorMeta(candidate.typeId);
                if (!candidateMeta || candidateMeta.shape !== "bridge_transmitter" || candidateMeta.tier !== receiverMeta.tier) continue;

                const facing = candidate.getState?.("minecraft:cardinal_direction") ?? null;
                if (facing !== ctx.oppositeCardinal[dir]) continue;

                const link = evaluateBridgeLink(candidate, candidateMeta, facing);
                if (link.receiver && ctx.posKey(link.receiver.location) === ctx.posKey(receiver.location) && !link.obstructed) {
                    transmitters.push(candidate);
                }
            }
        }

        return transmitters;
    }

    // Evaluate the receiver and obstruction state of a bridge link.
    function evaluateBridgeLink(block, meta, facing) {
        if (!block?.dimension || !meta?.bridgeRange) return { receiver: null, obstructed: false, steps: 0 };
        const offset = ctx.cardinalOffsets[facing];
        if (!offset) return { receiver: null, obstructed: false, steps: 0 };

        let receiver = null;
        let receiverSteps = 0;
        let obstructed = false;

        for (let step = 1; step <= meta.bridgeRange; step++) {
            const candidate = block.dimension.getBlock({
                x: block.location.x + offset.x * step,
                y: block.location.y,
                z: block.location.z + offset.z * step
            });
            if (!candidate) continue;

            if (candidate.hasTag?.(ctx.bridgeTag)) {
                const candidateMeta = ctx.getConveyorMeta(candidate.typeId);
                if (candidateMeta?.shape === "bridge_receiver" && candidateMeta?.tier === meta.tier) {
                    receiver = candidate;
                    receiverSteps = step;
                    break;
                }
            }

            if (isAirLike(candidate) || isBridgePathBlock(candidate, meta.tier) || isLegacyBridgePathBlock(candidate) || isBridgeClearableBlock(candidate)) continue;
            obstructed = true;
        }

        return { receiver, obstructed, steps: receiverSteps };
    }

    // Clear the generated path blocks between controller and target.
    function clearBridgePath(block, tier, facing, range) {
        if (!block?.dimension || !facing || !range) return;
        const offset = ctx.cardinalOffsets[facing];
        if (!offset) return;

        for (let step = 1; step <= range; step++) {
            const target = block.dimension.getBlock({
                x: block.location.x + offset.x * step,
                y: block.location.y,
                z: block.location.z + offset.z * step
            });
            if (!target) continue;
            if (target.hasTag?.(ctx.bridgeTag)) break;
            if (isBridgePathBlock(target, tier) || isLegacyBridgePathBlock(target)) {
                target.setType("minecraft:air");
            }
        }
    }

    // Create the generated path blocks between controller and target.
    function createBridgePath(block, tier, facing, steps) {
        if (!block?.dimension || !facing || !steps) return;
        const offset = ctx.cardinalOffsets[facing];
        if (!offset) return;
        const pathId = getBridgePathBlockId(tier);

        for (let step = 1; step < steps; step++) {
            const target = block.dimension.getBlock({
                x: block.location.x + offset.x * step,
                y: block.location.y,
                z: block.location.z + offset.z * step
            });
            if (!target) continue;
            if (target.hasTag?.(ctx.bridgeTag)) break;
            if (isBridgeClearableBlock(target)) target.setType("minecraft:air");
            if (!isAirLike(target) && !isBridgePathBlock(target, tier) && !isLegacyBridgePathBlock(target)) continue;
            target.setType(pathId);
            if (target.getState?.(ctx.bridgePathDirectionState) !== undefined) {
                target.setState?.(ctx.bridgePathDirectionState, facing);
            }
        }
    }

    // Keep the cached receiver in sync with the network cache.
    function updateBridgeNetworkCache(block, receiver) {
        if (!block?.dimension) return;
        const key = ctx.posKey(block.location);
        const nextKey = receiver ? ctx.posKey(receiver.location) : null;
        const existingKey = ctx.bridgeCache.get(key)?.pos ? ctx.posKey(ctx.bridgeCache.get(key).pos) : null;
        if (existingKey === nextKey) return;
        if (receiver) ctx.bridgeCache.set(key, { pos: { ...receiver.location } });
        else ctx.bridgeCache.delete(key);
        ctx.markConveyorNetworkDirty(block.dimension.id);
    }

    // Rebuild one transmitter path from scratch.
    function refreshBridgePathFromTransmitter(block, meta, player) {
        const facing = block.getState?.("minecraft:cardinal_direction") ?? null;
        if (!facing) return;

        clearBridgePath(block, meta.tier, facing, meta.bridgeRange);
        const link = evaluateBridgeLink(block, meta, facing);

        if (link.receiver && !link.obstructed) {
            createBridgePath(block, meta.tier, facing, link.steps);
            updateBridgeNetworkCache(block, link.receiver);
            ctx.updatePipes(block, "energy");
            return;
        }

        updateBridgeNetworkCache(block, null);
        if (link.receiver && link.obstructed) notifyBridgeObstructed(player);
        ctx.updatePipes(block, "energy");
    }

    // Rebuild every transmitter that points into the receiver.
    function refreshBridgePathsForReceiver(dim, pos, meta, player) {
        if (!dim || !pos || !meta?.bridgeRange) return;

        for (const [dir, offset] of Object.entries(ctx.cardinalOffsets)) {
            for (let step = 1; step <= meta.bridgeRange; step++) {
                const candidate = dim.getBlock({
                    x: pos.x + offset.x * step,
                    y: pos.y,
                    z: pos.z + offset.z * step
                });
                if (!candidate?.hasTag?.(ctx.bridgeTag)) continue;

                const candidateMeta = ctx.getConveyorMeta(candidate.typeId);
                if (!candidateMeta || candidateMeta.shape !== "bridge_transmitter" || candidateMeta.tier !== meta.tier) continue;

                const facing = candidate.getState?.("minecraft:cardinal_direction") ?? null;
                if (facing !== ctx.oppositeCardinal[dir]) continue;
                refreshBridgePathFromTransmitter(candidate, candidateMeta, player);
            }
        }
    }

    // Teleport payloads through a valid bridge link.
    function processBridgeTransmitter(block, meta, facing, context = {}) {
        const link = evaluateBridgeLink(block, meta, facing);
        if (!link.receiver || link.obstructed) {
            updateBridgeNetworkCache(block, null);
            clearBridgePath(block, meta.tier, facing, meta.bridgeRange);
            ctx.processStandardConveyor(block, meta, facing, "horizontal", context);
            return;
        }

        updateBridgeNetworkCache(block, link.receiver);

        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length && meta?.tier !== "aetherium") return;

        const receiverCenter = {
            x: link.receiver.location.x + 0.5,
            y: link.receiver.location.y + 0.1,
            z: link.receiver.location.z + 0.5
        };
        const blockKey = ctx.posKey(block.location);

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            if (!ctx.getItemStackFromEntity(item)) continue;
            if (ctx.shouldHoldAetheriumItem(meta, item)) continue;
            item.teleport(receiverCenter);
            ctx.markItemMoved(item, blockKey);
        }

        if (meta?.tier !== "aetherium") return;

        for (const entity of ctx.getCreaturesNear(block, 0.9)) {
            if (entity?.isValid === false || ctx.hasEntityMovedThisTick(entity)) continue;
            try {
                entity.teleport(receiverCenter);
            } catch {
                // Ignore teleport failures.
            }
            ctx.markEntityMoved(entity, blockKey);
        }
    }

    return {
        registerBridgeConveyorTypes,
        notifyBridgeObstructed,
        isAirLike,
        isLegacyBridgePathBlock,
        getBridgePathDefinition,
        getBridgePathBlockId,
        isBridgePathBlock,
        isBridgeClearableBlock,
        findBridgeTransmittersForReceiver,
        evaluateBridgeLink,
        clearBridgePath,
        createBridgePath,
        updateBridgeNetworkCache,
        refreshBridgePathFromTransmitter,
        refreshBridgePathsForReceiver,
        processBridgeTransmitter
    };
}

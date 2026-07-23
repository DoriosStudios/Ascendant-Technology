export function createSpecialConveyors(ctx) {
    // Register the universal special conveyor blocks.
    function registerSpecialConveyorTypes() {
        for (const typeId of ctx.specialTypeIds) {
            ctx.defineConveyorType(typeId, {
                tier: ctx.specialTier,
                shape: typeId.replace("utilitycraft:conveyor_", ""),
                ips: ctx.specialIps,
                bridgeRange: 0
            });
        }
    }

    // Build the smart-router save id.
    function getSmartRouterId(block) {
        const { x, y, z } = block.location;
        return `${ctx.smartRouterKeyPrefix}_${block.dimension?.id ?? "unknown"}_${x}_${y}_${z}`;
    }

    // Build the sorter save id.
    function getSorterFilterKey(block) {
        if (!block?.dimension || !block?.location) return null;
        const { x, y, z } = block.location;
        return `${ctx.sorterFilterKeyPrefix}_${block.dimension.id}_${x}_${y}_${z}`;
    }

    // Read the sorter filter item id.
    function readSorterFilter(block) {
        const raw = ctx.world.getDynamicProperty(getSorterFilterKey(block));
        return typeof raw === "string" ? raw.trim().toLowerCase() : "";
    }

    // Save the sorter filter item id.
    function saveSorterFilter(block, itemId) {
        const key = getSorterFilterKey(block);
        if (key) ctx.world.setDynamicProperty(key, String(itemId ?? "").trim().toLowerCase());
    }

    // Clear the sorter filter item id.
    function clearSorterFilter(block) {
        const key = getSorterFilterKey(block);
        if (key) ctx.world.setDynamicProperty(key, "");
    }

    // Clear the sorter filter by exact location.
    function clearSorterFilterAt(dimId, pos) {
        if (!dimId || !pos) return;
        ctx.world.setDynamicProperty(`${ctx.sorterFilterKeyPrefix}_${dimId}_${pos.x}_${pos.y}_${pos.z}`, "");
    }

    // Read the smart-router config payload.
    function getSmartRouterConfig(id) {
        const raw = ctx.world.getDynamicProperty(id);
        if (typeof raw !== "string" || raw.length === 0) return { ...ctx.smartRouterDefault };
        try {
            const parsed = JSON.parse(raw);
            return {
                left: Array.isArray(parsed.left) ? parsed.left : [],
                front: Array.isArray(parsed.front) ? parsed.front : [],
                right: Array.isArray(parsed.right) ? parsed.right : []
            };
        } catch {
            return { ...ctx.smartRouterDefault };
        }
    }

    // Save the smart-router config payload.
    function saveSmartRouterConfig(id, config) {
        const normalizeList = list => Array.from(new Set((list ?? []).map(value => String(value).toLowerCase())));
        ctx.world.setDynamicProperty(id, JSON.stringify({
            left: normalizeList(config.left),
            front: normalizeList(config.front),
            right: normalizeList(config.right)
        }));
    }

    // Delete the smart-router config payload.
    function removeSmartRouterConfig(id) {
        ctx.world.setDynamicProperty(id, "");
    }

    // Resolve the configured output side for an item id.
    function resolveSmartRouterOutput(config, itemId) {
        const normalized = String(itemId ?? "").toLowerCase();
        if (!normalized) return null;
        if (config.left.includes(normalized)) return "left";
        if (config.front.includes(normalized)) return "front";
        if (config.right.includes(normalized)) return "right";
        return null;
    }

    // Assign an item id to one smart-router side.
    function assignSmartRouterItem(config, direction, itemId) {
        const normalized = String(itemId ?? "").toLowerCase();
        if (!normalized) return config;
        const next = {
            left: config.left.filter(id => id !== normalized),
            front: config.front.filter(id => id !== normalized),
            right: config.right.filter(id => id !== normalized)
        };
        if (ctx.smartRouterDirs.includes(direction)) next[direction] = [...next[direction], normalized];
        return next;
    }

    // Remove an item id from the smart-router config.
    function removeSmartRouterItem(config, itemId) {
        const normalized = String(itemId ?? "").toLowerCase();
        if (!normalized) return config;
        return {
            left: config.left.filter(id => id !== normalized),
            front: config.front.filter(id => id !== normalized),
            right: config.right.filter(id => id !== normalized)
        };
    }

    // Build relative directions from the block facing.
    function getRelativeDirections(facing) {
        return {
            front: facing,
            back: ctx.oppositeCardinal[facing],
            right: ctx.rightCardinal[facing],
            left: ctx.leftCardinal[facing]
        };
    }

    // Resolve the block sitting in one direction.
    function getTargetBlock(block, direction) {
        if (!block?.dimension || !direction) return null;
        const offset = ctx.cardinalOffsets[direction];
        if (!offset) return null;
        return block.dimension.getBlock({
            x: block.location.x + offset.x,
            y: block.location.y + offset.y,
            z: block.location.z + offset.z
        });
    }

    // Check whether a side can receive conveyor output.
    function isOutputPassable(block, direction) {
        const target = getTargetBlock(block, direction);
        if (!target) return false;
        if (ctx.isAirLike(target) || ctx.isBridgePathBlock(target) || ctx.isLegacyBridgePathBlock(target) || target.hasTag?.(ctx.conveyorTag)) return true;
        if (target.getComponent("minecraft:inventory")?.container) return true;
        return block.dimension.getEntitiesAtBlockLocation(target.location).some(entity => entity?.getComponent("minecraft:inventory")?.container);
    }

    // Check whether a side has an inventory.
    function hasContainerAt(block, direction) {
        const target = getTargetBlock(block, direction);
        if (!target) return false;
        if (target.getComponent("minecraft:inventory")?.container) return true;
        return block.dimension.getEntitiesAtBlockLocation(target.location).some(entity => entity?.getComponent("minecraft:inventory")?.container);
    }

    // Pick the cached router direction.
    function resolveRouterDirection(block, key, options) {
        if (!block || !key || !Array.isArray(options) || options.length === 0) return null;
        const passable = options.filter(direction => isOutputPassable(block, direction));
        if (!passable.length) {
            ctx.routerDirectionCache.delete(key);
            return null;
        }

        const tick = ctx.getConveyorTick();
        const cached = ctx.routerDirectionCache.get(key);
        const cachedDirection = typeof cached?.direction === "string" ? cached.direction : null;
        if (cachedDirection && passable.includes(cachedDirection) && tick < Number(cached?.cycleEndTick ?? -1)) return cachedDirection;

        let nextIndex = 0;
        if (cachedDirection && passable.includes(cachedDirection)) {
            nextIndex = (passable.indexOf(cachedDirection) + 1) % passable.length;
        } else {
            const fallbackIndex = Number(cached?.nextIndex);
            if (Number.isFinite(fallbackIndex)) nextIndex = Math.max(0, Math.min(Math.floor(fallbackIndex), passable.length - 1));
        }

        const selected = passable[nextIndex] ?? passable[0] ?? null;
        if (!selected) return null;
        ctx.routerDirectionCache.set(key, {
            direction: selected,
            cycleEndTick: tick + ctx.routerCycleTicks,
            nextIndex: (passable.indexOf(selected) + 1) % passable.length
        });
        return selected;
    }

    // Teleport an item to the next block center.
    function teleportItemToDirection(item, block, direction) {
        if (!item || !block || !direction) return;
        const offset = ctx.cardinalOffsets[direction];
        if (!offset) return;
        item.teleport({
            x: block.location.x + offset.x + 0.5,
            y: block.location.y + 0.1,
            z: block.location.z + offset.z + 0.5
        });
    }

    // Send an item instantly through the side.
    function trySendItemInstant(item, block, direction) {
        if (!item || !block || !direction) return false;
        if (ctx.tryInsertIntoContainer(item, block, ctx.resolveOutputOffset("horizontal", direction))) return true;
        teleportItemToDirection(item, block, direction);
        return true;
    }

    // Read a two-state cycle value from a cache.
    function getCycleIndex(cache, key, max) {
        const numeric = Number.isFinite(cache.get(key)) ? cache.get(key) : 0;
        return Math.max(0, Math.min(numeric, max));
    }

    // Save a two-state cycle value to a cache.
    function setCycleIndex(cache, key, value, max) {
        const numeric = Number.isFinite(value) ? value : 0;
        cache.set(key, Math.max(0, Math.min(numeric, max)));
    }

    // Format item ids for the UI.
    function formatItemLabel(id) {
        return id && DoriosAPI?.utils?.formatIdToText ? DoriosAPI.utils.formatIdToText(id) : String(id ?? "");
    }

    // Open the sorter menu.
    function openSorterMenu(player, block, meta) {
        if (!player || !block || !meta) return;
        const heldId = player.getComponent("equippable")?.getEquipment("Mainhand")?.typeId ?? "";
        const currentFilter = readSorterFilter(block);
        const modeKey = meta.shape === "inverted_sorter"
            ? "ui.utilitycraft.conveyor.sorter.mode.inverted"
            : "ui.utilitycraft.conveyor.sorter.mode.standard";

        const bodyRawtext = [
            ctx.tr("ui.utilitycraft.conveyor.sorter.mode_label", [ctx.tr(modeKey)]),
            { text: "\n" },
            ctx.tr("ui.utilitycraft.conveyor.sorter.current_filter", [
                currentFilter ? formatItemLabel(currentFilter) : ctx.tr("ui.utilitycraft.conveyor.sorter.current_filter.none")
            ])
        ];
        if (heldId) {
            bodyRawtext.push({ text: "\n" });
            bodyRawtext.push(ctx.tr("ui.utilitycraft.conveyor.sorter.held_item", [formatItemLabel(heldId)]));
        }

        const form = new ctx.ActionFormData()
            .title(ctx.tr("ui.utilitycraft.conveyor.sorter.title"))
            .body({ rawtext: bodyRawtext });
        const actions = [];

        if (heldId) {
            form.button(ctx.tr("ui.utilitycraft.conveyor.sorter.button.set_filter", [formatItemLabel(heldId)]));
            actions.push("set");
        }
        if (currentFilter) {
            form.button(ctx.tr("ui.utilitycraft.conveyor.sorter.button.clear_filter"));
            actions.push("clear");
        }
        form.button(ctx.tr("ui.utilitycraft.conveyor.sorter.button.close"));
        actions.push("close");

        form.show(player).then(response => {
            if (response.canceled || response.selection === undefined) return;
            const action = actions[response.selection];
            if (action === "set" && heldId) {
                saveSorterFilter(block, heldId);
                player.onScreenDisplay?.setActionBar(ctx.tr("ui.utilitycraft.conveyor.sorter.filter_set", [formatItemLabel(heldId)]));
            } else if (action === "clear") {
                clearSorterFilter(block);
                player.onScreenDisplay?.setActionBar(ctx.tr("ui.utilitycraft.conveyor.sorter.filter_cleared"));
            }
        });
    }

    // Open the smart-router menu.
    function openSmartRouterMenu(player, block) {
        if (!player || !block) return;
        const smartRouterId = getSmartRouterId(block);
        const config = getSmartRouterConfig(smartRouterId);
        const heldId = player.getComponent("equippable")?.getEquipment("Mainhand")?.typeId ?? "";
        const heldLabel = formatItemLabel(heldId);
        const form = new ctx.ActionFormData()
            .title(ctx.tr("ui.utilitycraft.smart_router.title"))
            .body(heldId ? ctx.tr("ui.utilitycraft.smart_router.body_held", [heldLabel]) : ctx.tr("ui.utilitycraft.smart_router.body_empty"));
        const actions = [];

        if (heldId) {
            for (const direction of ctx.smartRouterDirs) {
                form.button(ctx.tr(`ui.utilitycraft.smart_router.button.assign_${direction}`));
                actions.push(`assign_${direction}`);
            }
            form.button(ctx.tr("ui.utilitycraft.smart_router.button.remove_item"));
            actions.push("remove_item");
        }

        form.button(ctx.tr("ui.utilitycraft.smart_router.button.view"));
        actions.push("view");
        form.button(ctx.tr("ui.utilitycraft.smart_router.button.clear_all"));
        actions.push("clear_all");
        form.button(ctx.tr("ui.utilitycraft.smart_router.button.close"));
        actions.push("close");

        form.show(player).then(response => {
            if (response.canceled || response.selection === undefined) return;
            const action = actions[response.selection];
            if (!action) return;

            if (action.startsWith("assign_")) {
                saveSmartRouterConfig(smartRouterId, assignSmartRouterItem(config, action.replace("assign_", ""), heldId));
                player.onScreenDisplay?.setActionBar(ctx.tr("ui.utilitycraft.smart_router.saved"));
                return;
            }

            if (action === "remove_item") {
                saveSmartRouterConfig(smartRouterId, removeSmartRouterItem(config, heldId));
                player.onScreenDisplay?.setActionBar(ctx.tr("ui.utilitycraft.smart_router.removed"));
                return;
            }

            if (action === "view") {
                player.sendMessage(ctx.smartRouterDirs.map(direction => {
                    const items = config[direction]?.length ? config[direction].map(formatItemLabel).join(", ") : "-";
                    return `${direction.charAt(0).toUpperCase() + direction.slice(1)}: ${items}`;
                }).join("\n"));
                return;
            }

            if (action === "clear_all") {
                saveSmartRouterConfig(smartRouterId, ctx.smartRouterDefault);
                player.onScreenDisplay?.setActionBar(ctx.tr("ui.utilitycraft.smart_router.cleared"));
            }
        });
    }

    // Process router outputs.
    function processRouterConveyor(block, meta, facing, context = {}) {
        const key = ctx.posKey(block.location);
        const dirs = getRelativeDirections(facing);
        const selected = resolveRouterDirection(block, key, [dirs.front, dirs.right, dirs.left].filter(Boolean));
        if (!selected) return;

        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length && meta?.tier !== "aetherium") return;

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            if (!ctx.getItemStackFromEntity(item)) continue;
            if (ctx.shouldHoldAetheriumItem(meta, item)) continue;
            if (!isOutputPassable(block, selected)) continue;
            if (!ctx.canMoveItemWithSpacing(item, items, selected)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
            trySendItemInstant(item, block, selected);
            ctx.markItemMoved(item, key);
        }
    }

    // Process sorter outputs.
    function processSorterConveyor(block, meta, facing, context = {}) {
        const key = ctx.posKey(block.location);
        const dirs = getRelativeDirections(facing);
        let sideCycle = getCycleIndex(ctx.sorterSideCycleCache, key, 1);
        const filterId = readSorterFilter(block);
        const hasFilter = filterId.length > 0;
        const inverted = meta.shape === "inverted_sorter";
        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length) return;

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            const stack = ctx.getItemStackFromEntity(item);
            if (!stack || ctx.shouldHoldAetheriumItem(meta, item)) continue;

            const matchesFilter = hasFilter && stack.typeId.toLowerCase() === filterId;
            const prioritizeSides = hasFilter && (inverted ? matchesFilter : !matchesFilter);
            const primarySide = sideCycle === 0 ? dirs.right : dirs.left;
            const secondarySide = sideCycle === 0 ? dirs.left : dirs.right;
            const selected = (prioritizeSides ? [primarySide, secondarySide, dirs.front] : [dirs.front, primarySide, secondarySide])
                .find(direction => direction && isOutputPassable(block, direction));
            if (!selected) continue;
            if (!ctx.canMoveItemWithSpacing(item, items, selected)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;

            trySendItemInstant(item, block, selected);
            ctx.markItemMoved(item, key);
            if (selected === dirs.right || selected === dirs.left) sideCycle = 1 - sideCycle;
        }

        setCycleIndex(ctx.sorterSideCycleCache, key, sideCycle, 1);
    }

    // Process smart-router outputs.
    function processSmartRouterConveyor(block, meta, facing, context = {}) {
        const smartRouterId = getSmartRouterId(block);
        const config = getSmartRouterConfig(smartRouterId);
        const dirs = getRelativeDirections(facing);
        const key = ctx.posKey(block.location);
        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length) return;

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            const stack = ctx.getItemStackFromEntity(item);
            if (!stack || ctx.shouldHoldAetheriumItem(meta, item)) continue;

            const preferred = resolveSmartRouterOutput(config, stack.typeId);
            const candidates = [];
            if (preferred && dirs[preferred]) candidates.push(dirs[preferred]);
            for (const directionKey of ["front", "right", "left"]) {
                const direction = dirs[directionKey];
                if (direction && !candidates.includes(direction)) candidates.push(direction);
            }

            const selected = candidates.find(direction => isOutputPassable(block, direction)) ?? dirs.front;
            if (!ctx.canMoveItemWithSpacing(item, items, selected)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
            trySendItemInstant(item, block, selected);
            ctx.markItemMoved(item, key);
        }
    }

    // Process overflow outputs.
    function processOverflowConveyor(block, meta, facing, context = {}) {
        const key = ctx.posKey(block.location);
        const dirs = getRelativeDirections(facing);
        let cycleIndex = getCycleIndex(ctx.overflowCycleCache, key, 1);
        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length) return;

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            if (!ctx.getItemStackFromEntity(item) || ctx.shouldHoldAetheriumItem(meta, item)) continue;

            if (isOutputPassable(block, dirs.front)) {
                if (!ctx.canMoveItemWithSpacing(item, items, dirs.front)) continue;
                if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
                trySendItemInstant(item, block, dirs.front);
                ctx.markItemMoved(item, key);
                continue;
            }

            const primary = cycleIndex === 0 ? dirs.right : dirs.left;
            const secondary = cycleIndex === 0 ? dirs.left : dirs.right;
            const selected = primary && isOutputPassable(block, primary)
                ? primary
                : secondary && isOutputPassable(block, secondary)
                    ? secondary
                    : dirs.front;
            if (selected === primary || selected === secondary) cycleIndex = 1 - cycleIndex;
            if (!ctx.canMoveItemWithSpacing(item, items, selected)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
            trySendItemInstant(item, block, selected);
            ctx.markItemMoved(item, key);
        }

        setCycleIndex(ctx.overflowCycleCache, key, cycleIndex, 1);
    }

    // Process underflow outputs.
    function processUnderflowConveyor(block, meta, facing, context = {}) {
        const key = ctx.posKey(block.location);
        const dirs = getRelativeDirections(facing);
        let cycleIndex = getCycleIndex(ctx.underflowCycleCache, key, 1);
        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length) return;

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            if (!ctx.getItemStackFromEntity(item) || ctx.shouldHoldAetheriumItem(meta, item)) continue;

            const primary = cycleIndex === 0 ? dirs.right : dirs.left;
            const secondary = cycleIndex === 0 ? dirs.left : dirs.right;
            let injected = false;

            for (const direction of [primary, secondary]) {
                if (injected || !direction || !hasContainerAt(block, direction) || !ctx.canConsumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
                if (!ctx.tryInsertIntoContainer(item, block, ctx.resolveOutputOffset("horizontal", direction))) continue;
                ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost);
                cycleIndex = 1 - cycleIndex;
                ctx.markItemMoved(item, key);
                injected = true;
            }

            if (injected) continue;
            if (!dirs.front || !isOutputPassable(block, dirs.front)) continue;
            if (!ctx.canMoveItemWithSpacing(item, items, dirs.front)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
            trySendItemInstant(item, block, dirs.front);
            ctx.markItemMoved(item, key);
        }

        setCycleIndex(ctx.underflowCycleCache, key, cycleIndex, 1);
    }

    // Check whether the item is still inside the block cell.
    function isItemInsideBlock(item, block) {
        const pos = item?.location;
        return Boolean(pos && block?.location)
            && Math.floor(pos.x) === block.location.x
            && Math.floor(pos.y) === block.location.y
            && Math.floor(pos.z) === block.location.z;
    }

    // Resolve the natural side for a junction item.
    function resolveJunctionDirection(block, item, facing) {
        if (!item?.location || !block?.location) return facing;
        const lastPos = ctx.parsePosKey(item?.getDynamicProperty?.(ctx.itemMoveKeyProp));
        if (lastPos) {
            const dx = lastPos.x - block.location.x;
            const dy = lastPos.y - block.location.y;
            const dz = lastPos.z - block.location.z;
            if (dy === 0 && Math.abs(dx) + Math.abs(dz) === 1) {
                if (dx === 1) return "west";
                if (dx === -1) return "east";
                if (dz === 1) return "north";
                if (dz === -1) return "south";
            }
        }

        const dx = item.location.x - (block.location.x + 0.5);
        const dz = item.location.z - (block.location.z + 0.5);
        return Math.abs(dx) >= Math.abs(dz)
            ? dx >= 0 ? "west" : "east"
            : dz >= 0 ? "north" : "south";
    }

    // Clear the junction cache stored on the item.
    function clearJunctionItemCache(item) {
        try {
            item?.setDynamicProperty?.(ctx.itemJunctionBlockProp, "");
            item?.setDynamicProperty?.(ctx.itemJunctionDirProp, "");
        } catch {
            // Ignore dynamic property failures.
        }
    }

    // Read or rebuild the chosen side for a junction item.
    function getJunctionDirectionForItem(block, item, facing) {
        const blockKey = ctx.posKey(block.location);
        const storedKey = item?.getDynamicProperty?.(ctx.itemJunctionBlockProp);
        const storedDir = item?.getDynamicProperty?.(ctx.itemJunctionDirProp);
        if (storedKey === blockKey && typeof storedDir === "string" && storedDir.length > 0) {
            if (isOutputPassable(block, storedDir)) return storedDir;
            clearJunctionItemCache(item);
        }

        let chosen = resolveJunctionDirection(block, item, facing);
        if (!chosen) return null;
        if (!isOutputPassable(block, chosen)) {
            const opposite = ctx.oppositeCardinal[chosen];
            chosen = opposite && isOutputPassable(block, opposite) ? opposite : null;
        }
        if (!chosen) return null;

        try {
            item?.setDynamicProperty?.(ctx.itemJunctionBlockProp, blockKey);
            item?.setDynamicProperty?.(ctx.itemJunctionDirProp, chosen);
        } catch {
            // Ignore dynamic property failures.
        }
        return chosen;
    }

    // Process junction outputs.
    function processJunctionConveyor(block, meta, facing, context = {}) {
        const items = ctx.getItemsNear(block, 0.9);
        if (!items.length) return;
        const key = ctx.posKey(block.location);

        for (const item of items) {
            if (ctx.hasItemMovedThisTick(item)) continue;
            if (!ctx.getItemStackFromEntity(item) || ctx.shouldHoldAetheriumItem(meta, item)) continue;
            if (!isItemInsideBlock(item, block) && item?.getDynamicProperty?.(ctx.itemJunctionBlockProp) === key) {
                clearJunctionItemCache(item);
            }

            const direction = getJunctionDirectionForItem(block, item, facing);
            if (!direction) continue;
            if (!ctx.canMoveItemWithSpacing(item, items, direction)) continue;
            if (!ctx.consumeConveyorEnergy(block, context?.network, ctx.specialEnergyCost)) continue;
            trySendItemInstant(item, block, direction);
            ctx.markItemMoved(item, key);
        }
    }

    return {
        registerSpecialConveyorTypes,
        getSmartRouterId,
        readSorterFilter,
        saveSorterFilter,
        clearSorterFilter,
        clearSorterFilterAt,
        getSmartRouterConfig,
        saveSmartRouterConfig,
        removeSmartRouterConfig,
        resolveSmartRouterOutput,
        assignSmartRouterItem,
        removeSmartRouterItem,
        openSorterMenu,
        openSmartRouterMenu,
        processRouterConveyor,
        processSorterConveyor,
        processSmartRouterConveyor,
        processOverflowConveyor,
        processUnderflowConveyor,
        processJunctionConveyor
    };
}

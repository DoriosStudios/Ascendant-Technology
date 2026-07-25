// @ts-check

/** Creates routing conveyors and their lightweight Action Form configuration. */
export function createSpecialConveyors(ctx) {
    const routerCycles = new Map();
    const sorterCycles = new Map();
    const overflowCycles = new Map();
    const underflowCycles = new Map();

    function runtimeKey(block) {
        return `${block.dimension.id}:${ctx.positionKey(block.location)}`;
    }

    function registerTypes() {
        for (const shape of ctx.specialShapes) {
            ctx.defineType(`utilitycraft:conveyor_${shape}`, {
                tier: "universal",
                shape,
                blocksPerSecond: ctx.specialBlocksPerSecond,
                bridgeRange: 0,
            });
        }
    }

    function relativeDirections(facing) {
        return {
            front: facing,
            back: ctx.oppositeDirections[facing],
            left: ctx.leftDirections[facing],
            right: ctx.rightDirections[facing],
        };
    }

    function targetBlock(block, direction) {
        const offset = ctx.directionVectors[direction];
        return offset ? ctx.safeGetBlock(block.dimension, {
            x: block.location.x + offset.x,
            y: block.location.y + offset.y,
            z: block.location.z + offset.z,
        }) : null;
    }

    function hasContainer(block, direction) {
        const target = targetBlock(block, direction);
        return Boolean(target && ctx.resolveContainerAt(target.dimension, target.location));
    }

    function isPassable(block, direction) {
        const target = targetBlock(block, direction);
        if (!target) return false;
        return ctx.isAir(target)
            || target.hasTag?.(ctx.conveyorTag)
            || ctx.isBridgePath(target)
            || Boolean(ctx.resolveContainerAt(target.dimension, target.location));
    }

    function send(item, block, direction) {
        const offset = ctx.directionVectors[direction];
        if (!offset) return false;
        if (ctx.tryInsert(item, block, offset, ctx.oppositeDirections[direction])) return true;
        ctx.teleport(item, {
            x: block.location.x + offset.x + 0.5,
            y: block.location.y + 0.1,
            z: block.location.z + offset.z + 0.5,
        });
        return true;
    }

    function cycleValue(cache, key, max) {
        const value = Number(cache.get(key) ?? 0);
        return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
    }

    function consumeForItem(block, network) {
        return ctx.consumeEnergy(block, network, ctx.specialEnergyCost);
    }

    function routerDirection(block, key, options) {
        const passable = options.filter((direction) => direction && isPassable(block, direction));
        if (passable.length === 0) {
            routerCycles.delete(key);
            return null;
        }
        const tick = ctx.currentTick();
        const cached = routerCycles.get(key);
        if (cached?.direction && passable.includes(cached.direction) && tick < cached.until) return cached.direction;
        const previousIndex = cached?.direction ? passable.indexOf(cached.direction) : -1;
        const direction = passable[(previousIndex + 1) % passable.length];
        routerCycles.set(key, { direction, until: tick + ctx.routerCycleTicks });
        return direction;
    }

    function sorterKey(block) {
        const { x, y, z } = block.location;
        return `conveyor_sorter_filter_${block.dimension.id}_${x}_${y}_${z}`;
    }

    function smartRouterKey(block) {
        const { x, y, z } = block.location;
        return `smart_router_${block.dimension.id}_${x}_${y}_${z}`;
    }

    function readFilter(block) {
        const value = ctx.world.getDynamicProperty(sorterKey(block));
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }

    function writeFilter(block, typeId) {
        ctx.world.setDynamicProperty(sorterKey(block), String(typeId ?? "").trim().toLowerCase());
    }

    function readRouter(block) {
        const raw = ctx.world.getDynamicProperty(smartRouterKey(block));
        if (typeof raw !== "string" || raw.length === 0) return { left: [], front: [], right: [] };
        try {
            const value = JSON.parse(raw);
            return {
                left: Array.isArray(value.left) ? value.left : [],
                front: Array.isArray(value.front) ? value.front : [],
                right: Array.isArray(value.right) ? value.right : [],
            };
        } catch {
            return { left: [], front: [], right: [] };
        }
    }

    function writeRouter(block, value) {
        const normalize = (list) => [...new Set((list ?? []).map((entry) => String(entry).toLowerCase()))];
        ctx.world.setDynamicProperty(smartRouterKey(block), JSON.stringify({
            left: normalize(value.left),
            front: normalize(value.front),
            right: normalize(value.right),
        }));
    }

    function clearConfiguration(block, meta) {
        if (meta?.shape === "sorter" || meta?.shape === "inverted_sorter") writeFilter(block, "");
        if (meta?.shape === "smart_router") ctx.world.setDynamicProperty(smartRouterKey(block), "");
        const key = runtimeKey(block);
        routerCycles.delete(key);
        sorterCycles.delete(key);
        overflowCycles.delete(key);
        underflowCycles.delete(key);
    }

    function moveConfiguration(dimension, source, target, meta) {
        const sourceBlock = { dimension, location: source };
        const targetBlock = { dimension, location: target };
        if (meta?.shape === "sorter" || meta?.shape === "inverted_sorter") {
            const value = readFilter(sourceBlock);
            writeFilter(targetBlock, value);
            writeFilter(sourceBlock, "");
        } else if (meta?.shape === "smart_router") {
            writeRouter(targetBlock, readRouter(sourceBlock));
            ctx.world.setDynamicProperty(smartRouterKey(sourceBlock), "");
        }
        const sourceKey = `${dimension.id}:${ctx.positionKey(source)}`;
        routerCycles.delete(sourceKey);
        sorterCycles.delete(sourceKey);
        overflowCycles.delete(sourceKey);
        underflowCycles.delete(sourceKey);
    }

    function formatItem(typeId) {
        return typeId ? ctx.formatIdentifier(typeId) : "";
    }

    function openSorterMenu(player, block, meta) {
        const heldId = ctx.getHeldItem(player)?.typeId ?? "";
        const filter = readFilter(block);
        const inverted = meta.shape === "inverted_sorter";
        const body = [
            ctx.translate("ui.utilitycraft.conveyor.sorter.mode_label", [
                ctx.translate(inverted
                    ? "ui.utilitycraft.conveyor.sorter.mode.inverted"
                    : "ui.utilitycraft.conveyor.sorter.mode.standard"),
            ]),
            { text: "\n" },
            ctx.translate("ui.utilitycraft.conveyor.sorter.current_filter", [
                filter ? formatItem(filter) : ctx.translate("ui.utilitycraft.conveyor.sorter.current_filter.none"),
            ]),
        ];
        const form = new ctx.ActionFormData()
            .title(ctx.translate("ui.utilitycraft.conveyor.sorter.title"))
            .body({ rawtext: body });
        const actions = [];
        if (heldId) {
            form.button(ctx.translate("ui.utilitycraft.conveyor.sorter.button.set_filter", [formatItem(heldId)]));
            actions.push("set");
        }
        if (filter) {
            form.button(ctx.translate("ui.utilitycraft.conveyor.sorter.button.clear_filter"));
            actions.push("clear");
        }
        form.button(ctx.translate("ui.utilitycraft.conveyor.sorter.button.close"));
        actions.push("close");

        form.show(player).then((response) => {
            const action = response.selection === undefined ? null : actions[response.selection];
            if (response.canceled || !action) return;
            if (action === "set") {
                writeFilter(block, heldId);
                player.onScreenDisplay?.setActionBar(ctx.translate(
                    "ui.utilitycraft.conveyor.sorter.filter_set",
                    [formatItem(heldId)],
                ));
            } else if (action === "clear") {
                writeFilter(block, "");
                player.onScreenDisplay?.setActionBar(ctx.translate(
                    "ui.utilitycraft.conveyor.sorter.filter_cleared",
                ));
            }
        }).catch(() => {});
    }

    function openSmartRouterMenu(player, block) {
        const heldId = ctx.getHeldItem(player)?.typeId ?? "";
        const config = readRouter(block);
        const form = new ctx.ActionFormData()
            .title(ctx.translate("ui.utilitycraft.smart_router.title"))
            .body(ctx.translate(heldId
                ? "ui.utilitycraft.smart_router.body_held"
                : "ui.utilitycraft.smart_router.body_empty", heldId ? [formatItem(heldId)] : []));
        const actions = [];
        if (heldId) {
            for (const direction of ["left", "front", "right"]) {
                form.button(ctx.translate(`ui.utilitycraft.smart_router.button.assign_${direction}`));
                actions.push(`assign:${direction}`);
            }
            form.button(ctx.translate("ui.utilitycraft.smart_router.button.remove_item"));
            actions.push("remove");
        }
        form.button(ctx.translate("ui.utilitycraft.smart_router.button.view"));
        actions.push("view");
        form.button(ctx.translate("ui.utilitycraft.smart_router.button.clear_all"));
        actions.push("clear");
        form.button(ctx.translate("ui.utilitycraft.smart_router.button.close"));
        actions.push("close");

        form.show(player).then((response) => {
            const action = response.selection === undefined ? null : actions[response.selection];
            if (response.canceled || !action) return;
            if (action.startsWith("assign:")) {
                const direction = action.slice(7);
                const next = {
                    left: config.left.filter((id) => id !== heldId),
                    front: config.front.filter((id) => id !== heldId),
                    right: config.right.filter((id) => id !== heldId),
                };
                next[direction].push(heldId.toLowerCase());
                writeRouter(block, next);
                player.onScreenDisplay?.setActionBar(ctx.translate("ui.utilitycraft.smart_router.saved"));
            } else if (action === "remove") {
                writeRouter(block, {
                    left: config.left.filter((id) => id !== heldId),
                    front: config.front.filter((id) => id !== heldId),
                    right: config.right.filter((id) => id !== heldId),
                });
                player.onScreenDisplay?.setActionBar(ctx.translate("ui.utilitycraft.smart_router.removed"));
            } else if (action === "clear") {
                writeRouter(block, { left: [], front: [], right: [] });
                player.onScreenDisplay?.setActionBar(ctx.translate("ui.utilitycraft.smart_router.cleared"));
            } else if (action === "view") {
                player.sendMessage(["left", "front", "right"].map((direction) =>
                    `${direction}: ${config[direction].map(formatItem).join(", ") || "-"}`).join("\n"));
            }
        }).catch(() => {});
    }

    function interact(player, block, meta) {
        if (meta?.shape === "sorter" || meta?.shape === "inverted_sorter") {
            if (player.isSneaking) writeFilter(block, "");
            else openSorterMenu(player, block, meta);
            return true;
        }
        if (meta?.shape === "smart_router" && !player.isSneaking) {
            openSmartRouterMenu(player, block);
            return true;
        }
        return false;
    }

    function processRouter(block, meta, bucket, network) {
        const facing = ctx.getState(block, "minecraft:cardinal_direction");
        const directions = relativeDirections(facing);
        const key = runtimeKey(block);
        const selected = routerDirection(block, key, [directions.front, directions.right, directions.left]);
        if (!selected) return;
        for (const item of bucket.items) {
            if (!ctx.canMoveWithSpacing(item, bucket.items, selected) || !consumeForItem(block, network)) continue;
            send(item, block, selected);
            ctx.rememberMove(item, block.location);
        }
    }

    function processSorter(block, meta, bucket, network) {
        const directions = relativeDirections(ctx.getState(block, "minecraft:cardinal_direction"));
        const key = runtimeKey(block);
        let cycle = cycleValue(sorterCycles, key, 1);
        const filter = readFilter(block);
        for (const item of bucket.items) {
            const stack = ctx.getItemStack(item);
            if (!stack) continue;
            const matches = filter.length > 0 && stack.typeId.toLowerCase() === filter;
            const sidesFirst = filter.length > 0 && (meta.shape === "inverted_sorter" ? matches : !matches);
            const primary = cycle === 0 ? directions.right : directions.left;
            const secondary = cycle === 0 ? directions.left : directions.right;
            const candidates = sidesFirst
                ? [primary, secondary, directions.front]
                : [directions.front, primary, secondary];
            const selected = candidates.find((direction) => direction && isPassable(block, direction));
            if (!selected || !ctx.canMoveWithSpacing(item, bucket.items, selected) || !consumeForItem(block, network)) continue;
            send(item, block, selected);
            ctx.rememberMove(item, block.location);
            if (selected === primary || selected === secondary) cycle = 1 - cycle;
        }
        sorterCycles.set(key, cycle);
    }

    function processSmartRouter(block, meta, bucket, network) {
        const directions = relativeDirections(ctx.getState(block, "minecraft:cardinal_direction"));
        const config = readRouter(block);
        for (const item of bucket.items) {
            const stack = ctx.getItemStack(item);
            if (!stack) continue;
            const typeId = stack.typeId.toLowerCase();
            const preferred = ["left", "front", "right"].find((direction) => config[direction].includes(typeId));
            const candidates = [];
            if (preferred) candidates.push(directions[preferred]);
            for (const direction of [directions.front, directions.right, directions.left]) {
                if (direction && !candidates.includes(direction)) candidates.push(direction);
            }
            const selected = candidates.find((direction) => isPassable(block, direction));
            if (!selected || !ctx.canMoveWithSpacing(item, bucket.items, selected) || !consumeForItem(block, network)) continue;
            send(item, block, selected);
            ctx.rememberMove(item, block.location);
        }
    }

    function processOverflow(block, meta, bucket, network) {
        const directions = relativeDirections(ctx.getState(block, "minecraft:cardinal_direction"));
        const key = runtimeKey(block);
        let cycle = cycleValue(overflowCycles, key, 1);
        for (const item of bucket.items) {
            let selected = isPassable(block, directions.front) ? directions.front : null;
            if (!selected) {
                const primary = cycle === 0 ? directions.right : directions.left;
                const secondary = cycle === 0 ? directions.left : directions.right;
                selected = isPassable(block, primary) ? primary : isPassable(block, secondary) ? secondary : null;
                if (selected) cycle = 1 - cycle;
            }
            if (!selected || !ctx.canMoveWithSpacing(item, bucket.items, selected) || !consumeForItem(block, network)) continue;
            send(item, block, selected);
            ctx.rememberMove(item, block.location);
        }
        overflowCycles.set(key, cycle);
    }

    function processUnderflow(block, meta, bucket, network) {
        const directions = relativeDirections(ctx.getState(block, "minecraft:cardinal_direction"));
        const key = runtimeKey(block);
        let cycle = cycleValue(underflowCycles, key, 1);
        for (const item of bucket.items) {
            const primary = cycle === 0 ? directions.right : directions.left;
            const secondary = cycle === 0 ? directions.left : directions.right;
            let moved = false;
            for (const direction of [primary, secondary]) {
                if (!direction || !hasContainer(block, direction)) continue;
                if (!ctx.canConsumeEnergy(block, network, ctx.specialEnergyCost)) continue;
                if (!ctx.tryInsert(item, block, ctx.directionVectors[direction], ctx.oppositeDirections[direction])) continue;
                ctx.consumeEnergy(block, network, ctx.specialEnergyCost);
                ctx.rememberMove(item, block.location);
                cycle = 1 - cycle;
                moved = true;
                break;
            }
            if (moved) continue;
            if (!directions.front || !isPassable(block, directions.front)
                || !ctx.canMoveWithSpacing(item, bucket.items, directions.front)
                || !consumeForItem(block, network)) continue;
            send(item, block, directions.front);
            ctx.rememberMove(item, block.location);
        }
        underflowCycles.set(key, cycle);
    }

    function processJunction(block, meta, bucket, network) {
        const facing = ctx.getState(block, "minecraft:cardinal_direction");
        for (const item of bucket.items) {
            const previous = ctx.getLastMove(item);
            let direction = facing;
            if (previous) {
                const dx = previous.x - block.location.x;
                const dz = previous.z - block.location.z;
                if (dx === 1) direction = "west";
                else if (dx === -1) direction = "east";
                else if (dz === 1) direction = "north";
                else if (dz === -1) direction = "south";
            } else {
                const dx = item.location.x - (block.location.x + 0.5);
                const dz = item.location.z - (block.location.z + 0.5);
                direction = Math.abs(dx) >= Math.abs(dz)
                    ? dx >= 0 ? "west" : "east"
                    : dz >= 0 ? "north" : "south";
            }
            if (!isPassable(block, direction)) direction = ctx.oppositeDirections[direction];
            if (!direction || !isPassable(block, direction)
                || !ctx.canMoveWithSpacing(item, bucket.items, direction)
                || !consumeForItem(block, network)) continue;
            send(item, block, direction);
            ctx.rememberMove(item, block.location);
        }
    }

    function process(block, meta, bucket, network) {
        if (meta.shape === "router") return processRouter(block, meta, bucket, network);
        if (meta.shape === "sorter" || meta.shape === "inverted_sorter") return processSorter(block, meta, bucket, network);
        if (meta.shape === "smart_router") return processSmartRouter(block, meta, bucket, network);
        if (meta.shape === "overflow") return processOverflow(block, meta, bucket, network);
        if (meta.shape === "underflow") return processUnderflow(block, meta, bucket, network);
        if (meta.shape === "junction") return processJunction(block, meta, bucket, network);
    }

    return {
        registerTypes,
        clearConfiguration,
        moveConfiguration,
        interact,
        process,
    };
}

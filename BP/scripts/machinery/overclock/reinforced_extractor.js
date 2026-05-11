import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
    FluidManager,
    Rotation,
    collectFluidNetworkNodes,
    canFluidNodeProvide,
    canFluidNodeReceive,
    isFluidNodeEnabled,
    fluidNodeMatchesType,
    updatePipes
} from "../../DoriosCore/main.js";

const REINFORCED_FLUID_IO = Object.freeze({
    defaults: Object.freeze({
        rate: 4000,
        maxScan: 256,
        mode: "nearest"
    }),
    sourceTankIndices: Object.freeze([0, 1]),
    targetTankIndices: Object.freeze([0, 1]),
    blockFaceOffsets: Object.freeze({
        down: { x: 0, y: 1, z: 0 },
        up: { x: 0, y: -1, z: 0 },
        south: { x: 0, y: 0, z: -1 },
        north: { x: 0, y: 0, z: 1 },
        east: { x: -1, y: 0, z: 0 },
        west: { x: 1, y: 0, z: 0 }
    }),
    axisOffsets: Object.freeze({
        north: { x: 0, y: 0, z: -1 },
        south: { x: 0, y: 0, z: 1 },
        east: { x: 1, y: 0, z: 0 },
        west: { x: -1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        down: { x: 0, y: -1, z: 0 }
    }),
    vanillaFluids: Object.freeze({
        "minecraft:water": "water",
        "minecraft:lava": "lava"
    }),
    configTag: "dorios:fluid_io",
    filterPrefix: "fluidFilter:"
});

const DEFAULT_RATE = REINFORCED_FLUID_IO.defaults.rate;
const DEFAULT_MODE = REINFORCED_FLUID_IO.defaults.mode;
const SOURCE_TANK_INDICES = REINFORCED_FLUID_IO.sourceTankIndices;
const TARGET_TANK_INDICES = REINFORCED_FLUID_IO.targetTankIndices;
const BLOCK_FACE_OFFSETS = REINFORCED_FLUID_IO.blockFaceOffsets;
const AXIS_OFFSETS = REINFORCED_FLUID_IO.axisOffsets;
const VANILLA_FLUIDS = REINFORCED_FLUID_IO.vanillaFluids;
const CONFIG_TAG = REINFORCED_FLUID_IO.configTag;
const FILTER_PREFIX = REINFORCED_FLUID_IO.filterPrefix;

function getBlockStateSafe(block, stateId) {
    try {
        return block?.getState?.(stateId);
    } catch {
        return undefined;
    }
}

function findFacingOffset(block) {
    const face = getBlockStateSafe(block, "minecraft:block_face");
    if (BLOCK_FACE_OFFSETS[face]) return BLOCK_FACE_OFFSETS[face];

    const axis = getBlockStateSafe(block, "utilitycraft:axis");
    return AXIS_OFFSETS[axis] ?? AXIS_OFFSETS.south;
}

function getFrontPosition(block) {
    const off = findFacingOffset(block);
    const { x, y, z } = block.location;
    return { x: x + off.x, y: y + off.y, z: z + off.z };
}

function posKey(pos) {
    return `${Math.floor(pos.x)}|${Math.floor(pos.y)}|${Math.floor(pos.z)}`;
}

function isSamePos(a, b) {
    if (!a || !b) return false;
    return Math.floor(a.x) === Math.floor(b.x)
        && Math.floor(a.y) === Math.floor(b.y)
        && Math.floor(a.z) === Math.floor(b.z);
}

function getConfigEntity(block, create = false) {
    if (!block?.dimension || !block?.location) return null;

    const entities = block.dimension.getEntitiesAtBlockLocation(block.location) ?? [];
    const existing = entities.find(entity => entity?.hasTag?.(CONFIG_TAG));
    if (existing?.isValid) return existing;
    if (!create) return null;

    const center = block.center();
    let entity = null;
    try {
        entity = block.dimension.spawnEntity("utilitycraft:pipe", {
            x: center.x,
            y: center.y - 0.25,
            z: center.z
        });
    } catch {
        return null;
    }

    entity.addTag?.(CONFIG_TAG);
    entity.setDynamicProperty?.("transferMode", DEFAULT_MODE);
    entity.setDynamicProperty?.("utilitycraft:whitelistOn", true);
    entity.setDynamicProperty?.("dorios:fluid_round_idx", 0);
    entity.nameTag = `entity.${block.typeId}.name`;
    return entity;
}

function removeConfigEntity(block) {
    const entities = block?.dimension?.getEntitiesAtBlockLocation(block.location) ?? [];
    for (const entity of entities) {
        if (entity?.hasTag?.(CONFIG_TAG)) {
            entity.remove();
        }
    }
}

function getFilterTypes(entity) {
    const tags = entity?.getTags?.() ?? [];
    const filters = [];
    for (const tag of tags) {
        if (!tag.startsWith(FILTER_PREFIX)) continue;
        const type = tag.slice(FILTER_PREFIX.length).trim().toLowerCase();
        if (type) filters.push(type);
    }
    return [...new Set(filters)].sort();
}

function getWhitelistState(entity) {
    return entity?.getDynamicProperty?.("utilitycraft:whitelistOn") !== false;
}

function ioAllowsFluid(entity, type) {
    if (!entity || !type || type === "empty") return true;
    const filters = getFilterTypes(entity);
    if (!filters.length) return true;
    const contains = filters.includes(type.toLowerCase());
    return getWhitelistState(entity) ? contains : !contains;
}

function addFilterType(entity, type, player) {
    const normalized = typeof type === "string" ? type.trim().toLowerCase() : "";
    if (!entity || !normalized || normalized === "empty") return false;

    const tag = `${FILTER_PREFIX}${normalized}`;
    if (!entity.getTags?.().includes(tag)) {
        entity.addTag?.(tag);
    }

    player?.onScreenDisplay?.setActionBar?.(`§7Added fluid filter: §b${DoriosAPI.utils.formatIdToText(normalized)}`);
    return true;
}

function resolveHeldFluidType(item) {
    if (!item?.typeId) return null;

    const containerData = FluidManager.getContainerData?.(item.typeId);
    if (containerData?.type) return containerData.type;

    const lore = typeof item.getLore === "function" ? item.getLore() : [];
    for (const line of lore) {
        const parsed = FluidManager.getFluidFromText?.(line);
        if (parsed?.type && parsed.type !== "empty" && parsed.amount > 0) {
            return parsed.type;
        }
    }

    return null;
}

function getEntitiesAtSameBlock(dim, pos) {
    const key = posKey(pos);
    const direct = dim.getEntitiesAtBlockLocation(pos) ?? [];
    const nearby = dim.getEntities({
        location: { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 },
        maxDistance: 1.25
    }) ?? [];

    const unique = new Map();
    for (const entity of [...direct, ...nearby]) {
        if (!entity?.isValid) continue;
        const entityPos = {
            x: Math.floor(entity.location.x),
            y: Math.floor(entity.location.y),
            z: Math.floor(entity.location.z)
        };
        if (posKey(entityPos) !== key) continue;
        const id = entity.scoreboardIdentity?.id ?? `${entity.typeId}:${unique.size}`;
        unique.set(id, entity);
    }

    return [...unique.values()];
}

function resolvePortEntity(block) {
    if (!block?.dimension || !block?.location) return null;
    const { x, y, z } = block.location;
    return block.dimension.getEntities({ tags: [`input:[${x},${y},${z}]`] })[0] ?? null;
}

function resolveSourceTank(entity) {
    if (!entity?.isValid) return null;
    if (entity.hasTag?.("dorios:fluid_input_only")) return null;

    const candidates = [];
    for (const index of SOURCE_TANK_INDICES) {
        const tank = FluidManager.findType(entity, index);
        if (!tank || tank.getCap() <= 0) continue;
        candidates.push(tank);
    }

    if (candidates.length === 0) return null;

    const withFluid = candidates.filter(tank => tank.get() > 0 && tank.getType() !== "empty");
    if (withFluid.length === 0) return candidates[0];

    const nonWater = withFluid.filter(tank => tank.getType() !== "water");
    const pool = nonWater.length ? nonWater : withFluid;

    let best = pool[0];
    for (let i = 1; i < pool.length; i++) {
        if (pool[i].get() > best.get()) best = pool[i];
    }

    return best;
}

function selectSourceFromEntities(entities) {
    let best = null;
    for (const entity of entities) {
        const tank = resolveSourceTank(entity);
        if (!tank || tank.getCap() <= 0) continue;

        const amount = tank.get();
        const type = tank.getType();
        const hasFluid = amount > 0 && type !== "empty";
        const score = (hasFluid ? amount : 0) + (type !== "water" ? 1_000_000 : 0);
        if (!best || score > best.score) {
            best = { entity, tank, score };
        }
    }

    return best;
}

function resolveFluidSourceAt(dim, sourcePos) {
    const sourceBlock = dim.getBlock(sourcePos);
    if (!sourceBlock) return null;

    let entities = getEntitiesAtSameBlock(dim, sourcePos);

    if (sourceBlock.hasTag?.("dorios:multiblock.port") && sourceBlock.hasTag?.("dorios:fluid")) {
        const portEntity = resolvePortEntity(sourceBlock);
        entities = portEntity ? [portEntity, ...entities] : entities;
    }

    const sourcePick = selectSourceFromEntities(entities);
    if (sourcePick?.tank) {
        const type = sourcePick.tank.getType();
        return {
            kind: "entity",
            pos: sourcePos,
            block: sourceBlock,
            tank: sourcePick.tank,
            type,
            amount: sourcePick.tank.get(),
            infinite: false
        };
    }

    if (VANILLA_FLUIDS[sourceBlock.typeId]) {
        if (sourceBlock.permutation.getState("liquid_depth") !== 0) return null;
        return {
            kind: "vanilla",
            pos: sourcePos,
            block: sourceBlock,
            type: VANILLA_FLUIDS[sourceBlock.typeId],
            amount: 1000,
            infinite: false
        };
    }

    if (sourceBlock.typeId === "utilitycraft:crucible") {
        const lavaLevel = sourceBlock.permutation.getState("utilitycraft:lava");
        if (lavaLevel < 1) return null;
        return {
            kind: "crucible",
            pos: sourcePos,
            block: sourceBlock,
            type: "lava",
            amount: 250 * lavaLevel,
            infinite: false
        };
    }

    if (sourceBlock.typeId === "utilitycraft:sink") {
        return {
            kind: "sink",
            pos: sourcePos,
            block: sourceBlock,
            type: "water",
            amount: Infinity,
            infinite: true
        };
    }

    return null;
}

function resolveFluidSource(block) {
    return resolveFluidSourceAt(block.dimension, getFrontPosition(block));
}

function selectTargetTank(entity, type) {
    if (!entity?.isValid || !type || type === "empty") return null;
    if (!FluidManager.findType(entity, 0) && !FluidManager.findType(entity, 1)) return null;

    for (const index of TARGET_TANK_INDICES) {
        const tank = FluidManager.findType(entity, index);
        if (!tank || tank.getCap() <= 0) continue;
        const targetType = tank.getType();
        if (targetType !== "empty" && targetType !== type) continue;
        if (tank.getFreeSpace() <= 0) continue;
        return tank;
    }

    return null;
}

function resolveFluidTargetAt(dim, targetPos, type) {
    const targetBlock = dim.getBlock(targetPos);
    if (!targetBlock?.hasTag?.("dorios:fluid")) return null;

    let entities = getEntitiesAtSameBlock(dim, targetPos);

    if (targetBlock.hasTag?.("dorios:multiblock.port") && targetBlock.hasTag?.("dorios:fluid")) {
        const portEntity = resolvePortEntity(targetBlock);
        entities = portEntity ? [portEntity, ...entities] : entities;
    }

    for (const entity of entities) {
        const tank = selectTargetTank(entity, type);
        if (tank) return { entity, tank, block: targetBlock, pos: targetPos };
    }

    if (targetBlock.typeId.includes("fluid_tank")) {
        const entity = FluidManager.addfluidToTank(targetBlock, type, 0);
        const tank = selectTargetTank(entity, type);
        if (tank) return { entity, tank, block: targetBlock, pos: targetPos };
    }

    return null;
}

function resolveDetectedTargetFluidType(block) {
    const targetPos = getFrontPosition(block);
    const targetBlock = block.dimension.getBlock(targetPos);
    if (!targetBlock) return null;

    const entities = getEntitiesAtSameBlock(block.dimension, targetPos);
    for (const entity of entities) {
        for (const index of TARGET_TANK_INDICES) {
            const tank = FluidManager.findType(entity, index);
            const type = tank?.getType?.();
            if (type && type !== "empty") return type;
        }
    }

    return null;
}

function orderNodes(nodes, origin, mode, roundIndex = 0) {
    let ordered = Array.isArray(nodes) ? [...nodes] : [];
    ordered.sort((a, b) => DoriosAPI.math.distanceBetween(origin, a) - DoriosAPI.math.distanceBetween(origin, b));

    if (mode === "farthest") {
        ordered.reverse();
    } else if (mode === "round" && ordered.length > 1) {
        const idx = Math.max(0, Number(roundIndex) || 0) % ordered.length;
        ordered = ordered.slice(idx).concat(ordered.slice(0, idx));
    }

    return ordered;
}

function transferBlockFluidToTarget(source, targetTank, amount) {
    if (!source || !targetTank || amount <= 0) return 0;

    const type = source.type;
    if (!type || type === "empty") return 0;

    let move = Math.min(amount, targetTank.getFreeSpace(), source.infinite ? amount : source.amount);
    if (source.kind === "crucible") {
        move = Math.floor(move / 250) * 250;
    }
    if (move <= 0) return 0;

    const inserted = targetTank.tryInsert(type, move);
    return inserted ? move : 0;
}

function drainFiniteBlockSource(source, moved) {
    if (!source || source.infinite || moved <= 0) return;

    if (source.kind === "vanilla") {
        source.block.setType("minecraft:air");
        return;
    }

    if (source.kind === "crucible") {
        const currentLava = source.block.permutation.getState("utilitycraft:lava");
        const drainedLevels = Math.min(currentLava, Math.floor(moved / 250));
        source.block.setPermutation(source.block.permutation.withState("utilitycraft:lava", Math.max(0, currentLava - drainedLevels)));
    }
}

function runExporter(block, settings) {
    const config = getConfigEntity(block, true);
    if (config?.getDynamicProperty?.("isOff")) return;

    const source = resolveFluidSource(block);
    if (!source || !source.type || source.type === "empty" || source.amount <= 0) return;
    if (!ioAllowsFluid(config, source.type)) return;

    const rate = settings?.machine?.fluid_rate ?? DEFAULT_RATE;
    const mode = config?.getDynamicProperty?.("transferMode") ?? DEFAULT_MODE;
    const nodes = collectFluidNetworkNodes(block)
        .filter(node => canFluidNodeReceive(node))
        .filter(node => isFluidNodeEnabled(node))
        .filter(node => fluidNodeMatchesType(node, source.type))
        .filter(node => !isSamePos(node, source.pos));

    if (!nodes.length) return;

    let transferred = 0;
    const roundIndex = config?.getDynamicProperty?.("dorios:fluid_round_idx") ?? 0;
    const orderedTargets = orderNodes(nodes, block.location, mode, roundIndex);

    if (source.tank) {
        transferred = source.tank.transferToNetwork(rate, mode, orderedTargets);
    } else {
        let remaining = Math.min(rate, source.infinite ? rate : source.amount);
        for (const node of orderedTargets) {
            if (remaining <= 0) break;
            const target = resolveFluidTargetAt(block.dimension, node, source.type);
            const moved = transferBlockFluidToTarget(source, target?.tank, remaining);
            if (moved <= 0) continue;
            remaining -= moved;
            transferred += moved;
        }
    }

    if (transferred > 0) {
        if (mode === "round") {
            config.setDynamicProperty?.("dorios:fluid_round_idx", (Number(roundIndex) + 1) % nodes.length);
        }
        drainFiniteBlockSource(source, transferred);
    }
}

function runImporter(block, settings) {
    const config = getConfigEntity(block, true);
    if (config?.getDynamicProperty?.("isOff")) return;

    const targetPos = getFrontPosition(block);
    const rate = settings?.machine?.fluid_rate ?? DEFAULT_RATE;
    const mode = config?.getDynamicProperty?.("transferMode") ?? DEFAULT_MODE;
    const nodes = collectFluidNetworkNodes(block)
        .filter(node => canFluidNodeProvide(node))
        .filter(node => isFluidNodeEnabled(node))
        .filter(node => !isSamePos(node, targetPos));

    if (!nodes.length) return;

    let remaining = rate;
    const roundIndex = config?.getDynamicProperty?.("dorios:fluid_round_idx") ?? 0;
    const orderedSources = orderNodes(nodes, block.location, mode, roundIndex);

    for (const node of orderedSources) {
        if (remaining <= 0) break;

        const source = resolveFluidSourceAt(block.dimension, node);
        if (!source || !source.type || source.type === "empty" || source.amount <= 0) continue;
        if (!ioAllowsFluid(config, source.type)) continue;
        if (!fluidNodeMatchesType(node, source.type)) continue;

        const target = resolveFluidTargetAt(block.dimension, targetPos, source.type);
        if (!target?.tank) continue;

        let moved = 0;
        if (source.tank) {
            moved = source.tank.transferTo(target.tank, remaining);
        } else {
            moved = transferBlockFluidToTarget(source, target.tank, remaining);
            drainFiniteBlockSource(source, moved);
        }

        if (moved > 0) {
            remaining -= moved;
        }
    }

    if (remaining < rate && mode === "round") {
        config.setDynamicProperty?.("dorios:fluid_round_idx", (Number(roundIndex) + 1) % nodes.length);
    }
}

function openFilterRemovalMenu(entity, player) {
    const filters = getFilterTypes(entity);
    if (!filters.length) {
        player.onScreenDisplay.setActionBar("§7No fluid filters configured");
        return;
    }

    const form = new ActionFormData()
        .title("Fluid Filters")
        .body("Select a fluid filter to remove.");

    for (const type of filters) {
        form.button(DoriosAPI.utils.formatIdToText(type));
    }

    form.show(player).then(result => {
        if (result.selection === undefined) return;
        const type = filters[result.selection];
        if (!type) return;
        entity.removeTag?.(`${FILTER_PREFIX}${type}`);
        player.onScreenDisplay.setActionBar(`§7Removed fluid filter: §b${DoriosAPI.utils.formatIdToText(type)}`);
    });
}

function showFilterContents(entity, player) {
    const filters = getFilterTypes(entity);
    const mode = getWhitelistState(entity) ? "Whitelist" : "Blacklist";
    const list = filters.length
        ? filters.map(type => `- ${DoriosAPI.utils.formatIdToText(type)}`).join("\n")
        : "§7(empty)";

    new ActionFormData()
        .title("Fluid Filters")
        .body(`§e${mode}\n\n${list}`)
        .button("Close")
        .show(player);
}

function openFluidIoMenu(block, player, role) {
    const entity = getConfigEntity(block, true);
    if (!entity) return;

    const isOff = entity.getDynamicProperty("isOff") === true;
    const mode = entity.getDynamicProperty("transferMode") ?? DEFAULT_MODE;
    const whitelist = getWhitelistState(entity);
    const filters = getFilterTypes(entity);
    const title = role === "importer" ? "Reinforced Importer" : "Reinforced Exporter";

    const form = new ActionFormData()
        .title(`${title} Settings`)
        .body(`Power: §e${isOff ? "Disabled" : "Enabled"}§r\nMode: §e${DoriosAPI.utils.capitalizeFirst(mode)}§r\nFilter: §e${whitelist ? "Whitelist" : "Blacklist"}§r\nEntries: §e${filters.length}`)
        .button(isOff ? "Enable" : "Disable")
        .button("Transfer Mode")
        .button(whitelist ? "Use Blacklist" : "Use Whitelist")
        .button("View Filters")
        .button("Add Held Fluid")
        .button("Add Detected Fluid")
        .button("Remove Filter");

    form.show(player).then(result => {
        switch (result.selection) {
            case 0:
                entity.setDynamicProperty("isOff", !isOff);
                player.onScreenDisplay.setActionBar(`§7${title} ${isOff ? "§aenabled" : "§cdisabled"}`);
                break;
            case 1: {
                const modes = ["nearest", "farthest", "round"];
                const next = modes[(modes.indexOf(mode) + 1) % modes.length] ?? DEFAULT_MODE;
                entity.setDynamicProperty("transferMode", next);
                player.onScreenDisplay.setActionBar(`§7Transfer mode: §e${DoriosAPI.utils.capitalizeFirst(next)}`);
                break;
            }
            case 2:
                entity.setDynamicProperty("utilitycraft:whitelistOn", !whitelist);
                player.onScreenDisplay.setActionBar(`§7Filter mode: §e${!whitelist ? "Whitelist" : "Blacklist"}`);
                break;
            case 3:
                showFilterContents(entity, player);
                break;
            case 4: {
                const item = player.getComponent("equippable")?.getEquipment("Mainhand");
                const type = resolveHeldFluidType(item);
                if (!addFilterType(entity, type, player)) {
                    player.onScreenDisplay.setActionBar("§7Hold a filled fluid item to add a filter");
                }
                break;
            }
            case 5: {
                const detected = role === "importer"
                    ? resolveDetectedTargetFluidType(block)
                    : resolveFluidSource(block)?.type;
                if (!addFilterType(entity, detected, player)) {
                    player.onScreenDisplay.setActionBar("§7No fluid detected in front");
                }
                break;
            }
            case 6:
                openFilterRemovalMenu(entity, player);
                break;
        }
    });
}

function scheduleFluidRefresh(block) {
    system.run(() => {
        try { updatePipes(block, "fluid"); } catch { /* ignore direct refresh failures */ }
        try { globalThis.refreshConnectedFluidNetwork?.(block); } catch { /* ignore connected refresh failures */ }
        try { globalThis.refreshOverclockNetwork?.(block); } catch { /* ignore geometry refresh failures */ }
    });
}

function createFluidIoComponent(role) {
    return {
        beforeOnPlayerPlace(e, { params }) {
            const { block, player, permutationToPlace } = e;

            try {
                if (params?.rotation) {
                    if (player?.isInSurvival?.()) {
                        system.run(() => player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`));
                    }
                    e.cancel = true;
                    Rotation.facing(player, block, permutationToPlace);
                    return;
                }
            } catch {
                // ignore rotation issues
            }

            system.run(() => {
                getConfigEntity(block, true);
                scheduleFluidRefresh(block);
            });
        },

        onPlayerInteract(e) {
            const { block, player } = e;
            if (!player || player.isSneaking) return;
            openFluidIoMenu(block, player, role);
            e.cancel = true;
        },

        onPlayerBreak(e) {
            removeConfigEntity(e.block);
            scheduleFluidRefresh(e.block);
        },

        onTick(e, { params: settings }) {
            if (!globalThis.worldLoaded) return;
            if (role === "importer") {
                runImporter(e.block, settings);
            } else {
                runExporter(e.block, settings);
            }
        }
    };
}

DoriosAPI.register.blockComponent("reinforced_extractor", createFluidIoComponent("exporter"));
DoriosAPI.register.blockComponent("reinforced_exporter", createFluidIoComponent("exporter"));
DoriosAPI.register.blockComponent("reinforced_importer", createFluidIoComponent("importer"));

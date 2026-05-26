import { updatePipes } from "../../DoriosCore/main.js";
import { system, world } from "@minecraft/server";

const REINFORCED_CABLE = Object.freeze({
    offsets: Object.freeze([
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ]),
    tube: Object.freeze({
        energyTypes: new Set([
            "utilitycraft:energy_cable",
            "utilitycraft:reinforced_cable",
        ]),
        geometryTypes: new Set([
            "utilitycraft:reinforced_cable",
            "utilitycraft:reinforced_importer",
            "utilitycraft:reinforced_exporter",
        ]),
        maxEnergyScan: 2048,
        maxFluidScan: 2048,
        energyDebugProp: "utilitycraft:debug_energy"
    })
});

const OFFSETS = REINFORCED_CABLE.offsets;
const ENERGY_TUBE_TYPES = REINFORCED_CABLE.tube.energyTypes;
const TUBE_GEOMETRY_TYPES = REINFORCED_CABLE.tube.geometryTypes;
const MAX_ENERGY_SCAN = REINFORCED_CABLE.tube.maxEnergyScan;
const MAX_FLUID_SCAN = REINFORCED_CABLE.tube.maxFluidScan;
const ENERGY_DEBUG_PROP = REINFORCED_CABLE.tube.energyDebugProp;

const PENDING_ENERGY_RESCAN = new Set();
const PENDING_FLUID_RESCAN = new Set();
const PENDING_GEOMETRY_REFRESH = new Set();
const PENDING_NEIGHBOR_GEOMETRY_REFRESH = new Set();

function energyDebugEnabled() {
    try {
        const value = world.getDynamicProperty(ENERGY_DEBUG_PROP);
        if (value !== undefined) return value === true;
    } catch {
        // ignore dynamic property errors
    }
    return globalThis.energyDebugEnabled === true;
}

function formatPos(pos) {
    if (!pos) return "?";
    return `${pos.x},${pos.y},${pos.z}`;
}

function logEnergyDebug(message, details) {
    if (!energyDebugEnabled()) return;
    const suffix = details
        ? ` ${typeof details === "string" ? details : JSON.stringify(details)}`
        : "";
    console.warn(`[EnergyDebug] ${message}${suffix}`);
}

function posKey(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function dimensionPosKey(dimension, pos) {
    return `${dimension?.id ?? "unknown"}:${posKey(pos)}`;
}

function isEnergyTube(block) {
    if (!block?.hasTag?.("dorios:energy")) return false;
    if (block.hasTag?.("dorios:isTube")) return true;
    return ENERGY_TUBE_TYPES.has(block.typeId);
}

function resolveEnergyPortEntity(dim, pos) {
    return dim.getEntities({ tags: [`input:[${pos.x},${pos.y},${pos.z}]`] })[0];
}

function collectEnergySources(startBlock) {
    if (!startBlock?.dimension) return [];

    const dim = startBlock.dimension;
    const queue = [startBlock.location];
    let queueIndex = 0;
    const visited = new Set();
    const sources = [];
    const sourceKeys = new Set();
    let steps = 0;

    while (queueIndex < queue.length && steps < MAX_ENERGY_SCAN) {
        const pos = queue[queueIndex++];
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        const block = dim.getBlock(pos);
        if (!block?.hasTag?.("dorios:energy")) continue;

        if (isEnergyTube(block)) {
            for (const off of OFFSETS) {
                queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
            }
            continue;
        }

        let entity = dim.getEntitiesAtBlockLocation(pos)[0];

        if (block.hasTag?.("dorios:multiblock.port")) {
            entity = resolveEnergyPortEntity(dim, pos);
        }

        const tf = entity?.getComponent?.("minecraft:type_family");
        if (!tf?.hasTypeFamily?.("dorios:energy_source")) continue;

        const keyId = entity.scoreboardIdentity?.id ?? posKey(pos);
        if (sourceKeys.has(keyId)) continue;

        sourceKeys.add(keyId);
        sources.push({ entity, startPos: pos });
    }

    return sources;
}

function collectEnergyTargets(startPos, sourceEntity) {
    if (!startPos || !sourceEntity?.dimension) return [];

    const dim = sourceEntity.dimension;
    const queue = [];
    let queueIndex = 0;
    const visited = new Set();
    const targets = [];
    const targetKeys = new Set();
    let steps = 0;

    for (const off of OFFSETS) {
        queue.push({ x: startPos.x + off.x, y: startPos.y + off.y, z: startPos.z + off.z });
    }

    while (queueIndex < queue.length && steps < MAX_ENERGY_SCAN) {
        const pos = queue[queueIndex++];
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        const block = dim.getBlock(pos);
        if (!block?.hasTag?.("dorios:energy")) continue;

        if (isEnergyTube(block)) {
            for (const off of OFFSETS) {
                queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
            }
            continue;
        }

        let entity = dim.getEntitiesAtBlockLocation(pos)[0];
        if (block.hasTag?.("dorios:multiblock.port")) {
            entity = resolveEnergyPortEntity(dim, pos);
            if (entity) {
                const loc = entity.location;
                const targetKey = posKey(loc);
                if (!targetKeys.has(targetKey)) {
                    targetKeys.add(targetKey);
                    targets.push(loc);
                }
            }
            continue;
        }

        const tf = entity?.getComponent?.("minecraft:type_family");
        if (!tf?.hasTypeFamily?.("dorios:energy_container")) continue;

        const isBattery = tf.hasTypeFamily?.("dorios:battery") ?? false;
        const isEnergySource = tf.hasTypeFamily?.("dorios:energy_source") ?? false;
        const isPowerBeacon = tf.hasTypeFamily?.("dorios:power_beacon") ?? false;

        // Allow batteries and the power beacon to receive from the cable
        // network while still excluding normal generators and other sources.
        if (isEnergySource && !isBattery && !isPowerBeacon) continue;

        if (!targetKeys.has(key)) {
            targetKeys.add(key);
            targets.push(pos);
        }
    }

    return targets;
}

function updateEnergySourceNetwork(source, startPos) {
    if (!source || !startPos) return;
    const targets = collectEnergyTargets(startPos, source);

    logEnergyDebug("updateEnergySourceNetwork", {
        source: formatPos(source.location),
        start: formatPos(startPos),
        targets: targets.length
    });

    try {
        const oldTags = source.getTags?.() ?? [];
        for (const tag of oldTags) {
            if (tag.startsWith("net:")) source.removeTag(tag);
        }

        for (const pos of targets) {
            source.addTag(`net:[${pos.x},${pos.y},${pos.z}]`);
        }
        source.addTag("updateNetwork");
    } catch {
        // Ignore tag update failures
    }
}

function refreshEnergyNetwork(block) {
    const sources = collectEnergySources(block);
    logEnergyDebug("refreshEnergyNetwork", {
        seed: formatPos(block?.location),
        sources: sources.length
    });
    for (const { entity, startPos } of sources) {
        updateEnergySourceNetwork(entity, startPos);
    }
}

function scheduleEnergyRescan(block) {
    if (!block?.dimension) return;
    const dim = block.dimension;
    const loc = block.location;
    const pendingKey = dimensionPosKey(dim, loc);
    if (PENDING_ENERGY_RESCAN.has(pendingKey)) return;
    PENDING_ENERGY_RESCAN.add(pendingKey);

    logEnergyDebug("scheduleEnergyRescan", {
        seed: formatPos(loc),
        type: block.typeId
    });

    system.run(() => {
        PENDING_ENERGY_RESCAN.delete(pendingKey);
        const liveBlock = dim.getBlock(loc);
        if (!liveBlock) return;
        refreshEnergyNetwork(liveBlock);
    });
}

function resolveEnergySeedEntity(block) {
    if (!block?.dimension) return null;
    if (block.hasTag?.("dorios:multiblock.port")) {
        return resolveEnergyPortEntity(block.dimension, block.location);
    }
    return block.dimension.getEntitiesAtBlockLocation(block.location)[0];
}

function isEnergySourceBlock(block) {
    const entity = resolveEnergySeedEntity(block);
    const tf = entity?.getComponent?.("minecraft:type_family");
    return tf?.hasTypeFamily?.("dorios:energy_source") ?? false;
}

function shouldSeedEnergyRescan(block) {
    if (!block?.hasTag?.("dorios:energy")) return false;
    return isEnergyTube(block) || isEnergySourceBlock(block);
}

function refreshGeometryOverclock(block) {
    if (!block?.permutation || !block?.dimension) return;

    const dim = block.dimension;
    const { x, y, z } = block.location;

    const neighbors = {
        up: dim.getBlock({ x, y: y + 1, z }),
        down: dim.getBlock({ x, y: y - 1, z }),
        north: dim.getBlock({ x, y, z: z - 1 }),
        south: dim.getBlock({ x, y, z: z + 1 }),
        east: dim.getBlock({ x: x + 1, y, z }),
        west: dim.getBlock({ x: x - 1, y, z }),
    };

    const shouldConnect = (neighbor) => {
        if (!neighbor) return false;
        // Do NOT connect to tower (visual rule requested)
        if (neighbor.typeId === "utilitycraft:overclock_tower") return false;
        if (neighbor.typeId === "utilitycraft:reinforced_cable" || neighbor.typeId === "utilitycraft:overclock_relay" || neighbor.typeId === "utilitycraft:overclock_injector") return true;
        if (neighbor.hasTag?.("dorios:overclock_network")) return true;
        if (neighbor.hasTag?.("dorios:machine")) return true;
        if (neighbor.hasTag?.("dorios:energy")) return true;
        if (neighbor.hasTag?.("dorios:fluid")) return true;
        return false;
    };

    for (const [dir, n] of Object.entries(neighbors)) {
        const connect = shouldConnect(n);
        if (block.getState(`utilitycraft:${dir}`) !== connect) {
            block.setState(`utilitycraft:${dir}`, connect);
        }
    }
}

function refreshNeighborCablesAround(block) {
    const dim = block?.dimension;
    if (!dim || !block?.location) return;
    for (const off of OFFSETS) {
        const pos = { x: block.location.x + off.x, y: block.location.y + off.y, z: block.location.z + off.z };
        const neighbor = dim.getBlock(pos);
        if (!neighbor) continue;
        if (TUBE_GEOMETRY_TYPES.has(neighbor.typeId)) {
            refreshGeometryOverclock(neighbor);
        }
    }
}

function scheduleGeometryRefresh(block) {
    if (!block?.dimension || !block?.location) return;

    const dim = block.dimension;
    const loc = block.location;
    const pendingKey = dimensionPosKey(dim, loc);
    if (PENDING_GEOMETRY_REFRESH.has(pendingKey)) return;

    PENDING_GEOMETRY_REFRESH.add(pendingKey);
    system.run(() => {
        PENDING_GEOMETRY_REFRESH.delete(pendingKey);
        const liveBlock = dim.getBlock(loc);
        if (!liveBlock) return;
        refreshGeometryOverclock(liveBlock);
    });
}

function scheduleNeighborCableRefresh(block) {
    if (!block?.dimension || !block?.location) return;

    const dim = block.dimension;
    const loc = block.location;
    const pendingKey = dimensionPosKey(dim, loc);
    if (PENDING_NEIGHBOR_GEOMETRY_REFRESH.has(pendingKey)) return;

    PENDING_NEIGHBOR_GEOMETRY_REFRESH.add(pendingKey);
    system.run(() => {
        PENDING_NEIGHBOR_GEOMETRY_REFRESH.delete(pendingKey);
        const liveBlock = dim.getBlock(loc);
        if (!liveBlock) return;
        refreshNeighborCablesAround(liveBlock);
    });
}

function refreshNeighbors(block) {
    const dim = block.dimension;
    let energySeed = null;
    let fluidSeed = block.hasTag?.("dorios:fluid") ? block : null;
    for (const off of OFFSETS) {
        const pos = { x: block.location.x + off.x, y: block.location.y + off.y, z: block.location.z + off.z };
        const neighbor = dim.getBlock(pos);
        if (!neighbor) continue;
        if (neighbor.hasTag("dorios:energy")) updatePipes(neighbor, "energy");
        if (neighbor.hasTag("dorios:fluid")) updatePipes(neighbor, "fluid");

        if (!energySeed && neighbor.hasTag?.("dorios:energy")) {
            energySeed = neighbor;
        }

        if (!fluidSeed && neighbor.hasTag?.("dorios:fluid")) {
            fluidSeed = neighbor;
        }

        // Update visual connections for overclock network
        if (neighbor.hasTag("dorios:overclock_network") || neighbor.typeId === "utilitycraft:overclock_relay") {
            refreshGeometryOverclock(neighbor);
        }
    }

    // Always refresh self geometry after touching neighbors
    refreshGeometryOverclock(block);

    if (!energySeed && block.hasTag?.("dorios:energy")) {
        energySeed = block;
    }

    if (energySeed) {
        scheduleEnergyRescan(energySeed);
    }

    if (fluidSeed) {
        scheduleFluidRescan(fluidSeed);
    }
}

function refreshOverclockAround(block) {
    if (!block?.dimension || !block?.location) return;
    scheduleNeighborCableRefresh(block);
    if (TUBE_GEOMETRY_TYPES.has(block.typeId)) {
        scheduleGeometryRefresh(block);
    }
}

globalThis.refreshOverclockNetwork = refreshOverclockAround;

function isFluidTube(block) {
    if (!block?.hasTag?.("dorios:fluid")) return false;
    if (block.hasTag?.("dorios:isTube")) return true;
    return TUBE_GEOMETRY_TYPES.has(block.typeId);
}

function collectConnectedFluidBlocks(seedBlock) {
    if (!seedBlock?.dimension || !seedBlock?.location) return [];

    const dim = seedBlock.dimension;
    const queue = [];
    const visited = new Set();
    const blocks = [];
    let queueIndex = 0;

    const enqueue = (pos) => {
        if (!pos) return;
        queue.push({ x: pos.x, y: pos.y, z: pos.z });
    };

    if (seedBlock.hasTag?.("dorios:fluid")) {
        enqueue(seedBlock.location);
    }

    for (const off of OFFSETS) {
        enqueue({
            x: seedBlock.location.x + off.x,
            y: seedBlock.location.y + off.y,
            z: seedBlock.location.z + off.z
        });
    }

    while (queueIndex < queue.length && visited.size < MAX_FLUID_SCAN) {
        const pos = queue[queueIndex++];
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);

        const block = dim.getBlock(pos);
        if (!block?.hasTag?.("dorios:fluid")) continue;

        blocks.push(block);

        if (!isFluidTube(block)) continue;

        for (const off of OFFSETS) {
            enqueue({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
        }
    }

    return blocks;
}

function refreshConnectedFluidNetwork(block) {
    const targets = collectConnectedFluidBlocks(block);
    for (const target of targets) {
        try { updatePipes(target, "fluid"); } catch { /* ignore fluid refresh failures */ }
    }
}

function scheduleFluidRescan(block) {
    if (!block?.dimension || !block?.location) return;

    const dim = block.dimension;
    const loc = block.location;
    const pendingKey = dimensionPosKey(dim, loc);
    if (PENDING_FLUID_RESCAN.has(pendingKey)) return;

    PENDING_FLUID_RESCAN.add(pendingKey);
    system.run(() => {
        PENDING_FLUID_RESCAN.delete(pendingKey);
        const liveBlock = dim.getBlock(loc);
        if (!liveBlock) return;
        refreshConnectedFluidNetwork(liveBlock);
    });
}

globalThis.refreshConnectedFluidNetwork = refreshConnectedFluidNetwork;

function refreshConnectedEnergy(block) {
    if (!block?.dimension) return;
    const dim = block.dimension;
    const seeds = new Set();

    const enqueueSeed = (candidate) => {
        if (!candidate) return;
        if (!shouldSeedEnergyRescan(candidate)) return;
        const key = posKey(candidate.location);
        if (seeds.has(key)) return;
        seeds.add(key);
        scheduleEnergyRescan(candidate);
    };

    enqueueSeed(block);

    for (const off of OFFSETS) {
        const neighbor = dim.getBlock({
            x: block.location.x + off.x,
            y: block.location.y + off.y,
            z: block.location.z + off.z
        });
        enqueueSeed(neighbor);
    }

    logEnergyDebug("refreshConnectedEnergy", {
        origin: formatPos(block.location),
        seeds: seeds.size
    });
}

globalThis.refreshConnectedEnergy = refreshConnectedEnergy;

DoriosAPI.register.blockComponent("reinforced_cable", {
    beforeOnPlayerPlace(e) {
        // After placement, refresh adjacent networks
        system.run(() => {
            refreshNeighbors(e.block);
        });
    },
    onPlayerBreak(e) {
        // On break, refresh neighbors to prune paths
        system.run(() => {
            refreshNeighbors(e.block);
        });
    }
});

// Keep cable geometry synced when placing/breaking relays (or other overclock network blocks)
world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    if (!block) return;
    if (
        block.typeId === "utilitycraft:reinforced_cable" ||
        block.hasTag?.("dorios:overclock_network") ||
        block.hasTag?.("dorios:machine") ||
        block.hasTag?.("dorios:energy") ||
        block.hasTag?.("dorios:fluid")
    ) {
        system.run(() => {
            if (TUBE_GEOMETRY_TYPES.has(block.typeId)) {
                scheduleGeometryRefresh(block);
            }
            scheduleNeighborCableRefresh(block);
            if (block.hasTag?.("dorios:energy")) {
                refreshConnectedEnergy(block);
            }
            if (block.hasTag?.("dorios:fluid")) {
                scheduleFluidRescan(block);
            }
        });
    }
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    const typeId = brokenBlockPermutation?.type?.id;
    if (!typeId) return;
    if (
        typeId === "utilitycraft:reinforced_cable" ||
        brokenBlockPermutation?.hasTag?.("dorios:overclock_network") ||
        brokenBlockPermutation?.hasTag?.("dorios:machine") ||
        brokenBlockPermutation?.hasTag?.("dorios:energy") ||
        brokenBlockPermutation?.hasTag?.("dorios:fluid")
    ) {
        system.run(() => {
            scheduleNeighborCableRefresh(block);
            if (brokenBlockPermutation?.hasTag?.("dorios:energy")) {
                refreshConnectedEnergy(block);
            }
            if (brokenBlockPermutation?.hasTag?.("dorios:fluid")) {
                scheduleFluidRescan(block);
            }
        });
    }
});

import { updatePipes } from "../managers_extra.js";
import { system, world } from "@minecraft/server";

const OFFSETS = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

const ENERGY_TUBE_TYPES = new Set([
    "utilitycraft:energy_cable",
    "utilitycraft:reinforced_cable",
]);

const MAX_ENERGY_SCAN = 2048;

function posKey(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
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
    const visited = new Set();
    const sources = [];
    const sourceKeys = new Set();
    let steps = 0;

    while (queue.length && steps < MAX_ENERGY_SCAN) {
        const pos = queue.shift();
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
    const visited = new Set();
    const targets = [];
    const targetKeys = new Set();
    let steps = 0;

    for (const off of OFFSETS) {
        queue.push({ x: startPos.x + off.x, y: startPos.y + off.y, z: startPos.z + off.z });
    }

    while (queue.length && steps < MAX_ENERGY_SCAN) {
        const pos = queue.shift();
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
        if (tf.hasTypeFamily?.("dorios:energy_source")) continue;

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
    for (const { entity, startPos } of sources) {
        updateEnergySourceNetwork(entity, startPos);
    }
}

function scheduleEnergyRescan(block) {
    if (!block?.dimension) return;
    system.run(() => {
        refreshEnergyNetwork(block);
    });
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
        if (neighbor.typeId === "utilitycraft:reinforced_cable") {
            refreshGeometryOverclock(neighbor);
        }
    }
}

function refreshNeighbors(block) {
    const dim = block.dimension;
    let energySeed = null;
    for (const off of OFFSETS) {
        const pos = { x: block.location.x + off.x, y: block.location.y + off.y, z: block.location.z + off.z };
        const neighbor = dim.getBlock(pos);
        if (!neighbor) continue;
        if (neighbor.hasTag("dorios:energy")) updatePipes(neighbor, "energy");
        if (neighbor.hasTag("dorios:fluid")) updatePipes(neighbor, "fluid");

        if (!energySeed && neighbor.hasTag?.("dorios:energy")) {
            energySeed = neighbor;
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
}

function refreshOverclockAround(block) {
    if (!block?.dimension || !block?.location) return;
    refreshNeighborCablesAround(block);
    if (block.typeId === "utilitycraft:reinforced_cable") {
        refreshGeometryOverclock(block);
    }
}

globalThis.refreshOverclockNetwork = refreshOverclockAround;

function refreshConnectedEnergy(block) {
    if (!block?.dimension) return;
    if (block.hasTag?.("dorios:energy")) {
        scheduleEnergyRescan(block);
        return;
    }

    const dim = block.dimension;
    for (const off of OFFSETS) {
        const neighbor = dim.getBlock({
            x: block.location.x + off.x,
            y: block.location.y + off.y,
            z: block.location.z + off.z
        });
        if (neighbor?.hasTag?.("dorios:energy")) {
            scheduleEnergyRescan(neighbor);
            return;
        }
    }
}

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
            refreshGeometryOverclock(block.typeId === "utilitycraft:reinforced_cable" ? block : null);
            refreshNeighborCablesAround(block);
            if (block.hasTag?.("dorios:energy")) {
                refreshConnectedEnergy(block);
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
            refreshNeighborCablesAround(block);
            if (brokenBlockPermutation?.hasTag?.("dorios:energy")) {
                refreshConnectedEnergy(block);
            }
        });
    }
});

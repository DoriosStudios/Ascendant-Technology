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
    for (const off of OFFSETS) {
        const pos = { x: block.location.x + off.x, y: block.location.y + off.y, z: block.location.z + off.z };
        const neighbor = dim.getBlock(pos);
        if (!neighbor) continue;
        if (neighbor.hasTag("dorios:fluid")) updatePipes(neighbor, "fluid");

        // Update visual connections for overclock network
        if (neighbor.hasTag("dorios:overclock_network") || neighbor.typeId === "utilitycraft:overclock_relay") {
            refreshGeometryOverclock(neighbor);
        }
    }

    // Always refresh self geometry after touching neighbors
    refreshGeometryOverclock(block);
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
    // Deprecated: energy rescan was used when cables were not tag-driven.
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
        });
    }
});

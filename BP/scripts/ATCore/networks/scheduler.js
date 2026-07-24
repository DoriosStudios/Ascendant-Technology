// @ts-check

import { system } from "@minecraft/server";

const DEFAULT_DEBOUNCE_TICKS = 20;

/**
 * Creates one serialized, debounced topology queue per dimension.
 * Repeated place/break events received during the debounce window collapse
 * into one rebuild batch.
 */
export function createNetworkRescanScheduler(name, processBatch, debounceTicks = DEFAULT_DEBOUNCE_TICKS) {
    const pendingDimensions = new Map();

    return (location, dimension) => {
        if (!location || !dimension) return;

        const normalized = normalizeLocation(location);
        const dimensionId = dimension.id;
        let pending = pendingDimensions.get(dimensionId);

        if (!pending) {
            pending = {
                dimension,
                locations: new Map(),
                readyTick: 0,
                running: false,
            };
            pendingDimensions.set(dimensionId, pending);
        }

        pending.dimension = dimension;
        const locationKey = coordinateKey(normalized);
        if (!pending.locations.has(locationKey)) {
            pending.locations.set(locationKey, normalized);
            pending.readyTick = system.currentTick + Math.max(0, Math.floor(debounceTicks));
        }

        if (pending.running) return;
        pending.running = true;
        system.run(() => void drainDimension(dimensionId, pending));
    };

    async function drainDimension(dimensionId, pending) {
        try {
            while (pending.locations.size > 0) {
                const remainingTicks = pending.readyTick - system.currentTick;
                if (remainingTicks > 0) {
                    await system.waitTicks(remainingTicks);
                    continue;
                }

                const locations = [...pending.locations.values()];
                pending.locations.clear();

                try {
                    await processBatch(locations, pending.dimension);
                } catch (error) {
                    console.warn(`[ATCore:${name}] Network rebuild failed`, error);
                }
            }
        } finally {
            pending.running = false;
            if (pending.locations.size === 0 && pendingDimensions.get(dimensionId) === pending) {
                pendingDimensions.delete(dimensionId);
            }
        }
    }
}

function normalizeLocation(location) {
    return {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    };
}

function coordinateKey(location) {
    return `${location.x},${location.y},${location.z}`;
}

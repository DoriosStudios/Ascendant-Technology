// AT owns port settings and upgrades. UC supplies only network topology.
import { system, world } from "@minecraft/server";

export const RESOURCES = ["item", "fluid", "gas"];
const cache = new Map();
const keyAt = (dimensionId, p) => `ascendant:port_settings:${dimensionId}:${p.x},${p.y},${p.z}`;

/** Reads AT's own settings once per position and caches the document. */
export function readPortSettings(dimensionId, location) {
    const key = keyAt(dimensionId, location);
    if (!cache.has(key)) {
        let data = {};
        try { data = JSON.parse(String(world.getDynamicProperty(key) ?? "{}")); } catch {}
        if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
        cache.set(key, data);
    }
    return cache.get(key);
}

/** Replaces the cached document so active ports can detect settings changes. */
export function writePortSettings(dimensionId, location, data) {
    const key = keyAt(dimensionId, location);
    world.setDynamicProperty(key, data === undefined ? undefined : JSON.stringify(data));
    cache.set(key, data ?? {});
}

/** Resolves resource defaults and the upgrades supported by the port's role. */
export function getPortSettings(port, resource) {
    const data = readPortSettings(port.dimension.id, port.location);
    const settings = data.resources?.[resource];
    return {
        enabled: settings?.enabled !== false,
        mode: settings?.mode ?? "nearest",
        filter: settings?.filter ?? { mode: "blacklist", values: [] },
        speedLevel: port.exporter ? data.upgrades?.speed ?? 0 : 0,
        filterEnabled: (data.upgrades?.filter ?? 0) > 0,
    };
}

export function setPortSettings(port, resource, settings) {
    const data = readPortSettings(port.dimension.id, port.location);
    writePortSettings(port.dimension.id, port.location, {
        ...data,
        resources: { ...data.resources, [resource]: settings },
    });
}

export function setPortUpgrade(block, upgrade, level) {
    const data = readPortSettings(block.dimension.id, block.location);
    writePortSettings(block.dimension.id, block.location, {
        ...data,
        upgrades: { ...data.upgrades, [upgrade]: level },
    });
}

/** Applies AT importer settings only; another addon's configuration stays private. */
export function getImporterSettings(dimension, location, resource) {
    if (!location) return undefined;
    if (!dimension.isChunkLoaded(location)) return { enabled: false };
    const block = dimension.getBlock(location);
    if (!block?.hasTag("dorios:isImporter")) return { enabled: false };
    if (block.typeId !== "utilitycraft:universal_importer") return undefined;
    return getPortSettings({ dimension, location, exporter: false }, resource);
}

// Move only AT's local settings/upgrades after the piston completes.
// Network routes continue to arrive from UC's normal rebuild.
function onPistonActivate({ piston, dimension, isExpanding }) {
    const locations = piston.getAttachedBlocksLocations();
    if (!locations?.length) return;
    const directions = [
        { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 },
        { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    ];
    const direction = directions[Number(piston.block.permutation.getState("facing_direction"))];
    if (!direction) return;
    const step = isExpanding ? -1 : 1;
    system.runTimeout(() => {
        const movements = locations.map(target => {
            const source = {
                x: target.x + direction.x * step,
                y: target.y + direction.y * step,
                z: target.z + direction.z * step,
            };
            return { source, target };
        });
        movePortSettings(dimension.id, movements);
    }, 2);
}

/** Snapshots every source before clearing overlapping positions in a piston chain. */
function movePortSettings(dimensionId, movements) {
    const snapshots = movements.map(({ source, target }) => ({
        source, target, data: readPortSettings(dimensionId, source),
    }));
    for (const { source, target } of snapshots) {
        writePortSettings(dimensionId, source, undefined);
        writePortSettings(dimensionId, target, undefined);
    }
    for (const { target, data } of snapshots) {
        if (Object.keys(data).length) writePortSettings(dimensionId, target, data);
    }
}

world.afterEvents.pistonActivate.subscribe(onPistonActivate);

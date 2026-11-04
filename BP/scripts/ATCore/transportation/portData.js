import { system, world } from "@minecraft/server";
import { readNetworkData, writeNetworkData } from "./networkStorage.js";
import { RESOURCES, readPortSettings, writePortSettings, getPortSettings, setPortSettings } from "./transportSettings.js";

export { RESOURCES };
const ports = new Map();
const keyAt = block => `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
const dimensionKey = id => ({ "minecraft:overworld": "o", "minecraft:nether": "n", "minecraft:the_end": "e" }[id] ?? id.replaceAll(":", "."));
function propertyKey(port, resource) {
    const { x, y, z } = port.location;
    return `utilitycraft:${resource[0]}${port.exporter ? "e" : "i"}:${dimensionKey(port.dimension.id)}:${x},${y},${z}`;
}

/** Combines UC's saved routes with AT's local settings for each resource. */
function loadPortData(port) {
    port.settingsDocument = readPortSettings(port.dimension.id, port.location);
    for (const resource of RESOURCES) {
        const data = readNetworkData(propertyKey(port, resource));
        port.channels.set(resource, {
            status: data || !port.exporter ? "ready" : "pending",
            payload: {
                ...data,
                settings: getPortSettings(port, resource),
                targets: data?.targets ?? [],
            },
        });
    }
}

/** Reuses transfer cursors and reloads settings only when their document changes. */
export function getUniversalPort(block) {
    const key = keyAt(block);
    let port = ports.get(key);
    if (!port || port.blockId !== block.typeId) {
        port = {
            dimension: block.dimension,
            location: { ...block.location },
            blockId: block.typeId,
            exporter: block.hasTag("dorios:isExporter"),
            channels: new Map(),
            transfer: new Map(),
        };
        ports.set(key, port);
    }
    if (port.settingsDocument !== readPortSettings(port.dimension.id, port.location)) loadPortData(port);
    port.lastSeen = system.currentTick;
    return port;
}

/** Prevents an open menu from modifying a removed or replaced port. */
export function isCurrentPort(port) {
    return ports.get(keyAt(port)) === port && port.dimension.isChunkLoaded(port.location)
        && port.dimension.getBlock(port.location)?.typeId === port.blockId;
}

/** Clears local persistence on placement/break; this does not request routes from UC. */
export function resetUniversalPort(block) {
    const port = { dimension: block.dimension, location: { ...block.location }, exporter: block.hasTag("dorios:isExporter") };
    // Clear both roles because break callbacks can already see air.
    for (const exporter of [true, false]) {
        for (const resource of RESOURCES) {
            const key = propertyKey({ ...port, exporter }, resource);
            writeNetworkData(key, undefined);
        }
    }
    writePortSettings(block.dimension.id, block.location, undefined);
    ports.delete(keyAt(block));
}

export function setUniversalPortSettings(port, resource, settings) {
    setPortSettings(port, resource, settings);
    loadPortData(port);
}

// UC sends the key, dimension, position and data explicitly; AT owns persistence.
function receiveNetworkData({ id, message }) {
    if (id !== "utilitycraft:network_data") return;
    const { key, dimensionId, location, data } = JSON.parse(message);
    const dimension = world.getDimension(dimensionId);
    if (!dimension.isChunkLoaded(location)) return;
    const block = dimension.getBlock(location);
    if (!["utilitycraft:universal_exporter", "utilitycraft:universal_importer"].includes(block?.typeId)) return;
    writeNetworkData(key, data);
    const port = ports.get(keyAt(block));
    if (port) loadPortData(port);
}

/** Releases idle runtime caches while preserving their saved DP records. */
function clearInactivePorts() {
    for (const [key, port] of ports) {
        if ((!port.uiOpen && system.currentTick - port.lastSeen > 200) || !isCurrentPort(port)) ports.delete(key);
    }
}

system.afterEvents.scriptEventReceive.subscribe(receiveNetworkData, { namespaces: ["utilitycraft"] });
system.runInterval(clearInactivePorts, 100);

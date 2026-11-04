// UC's existing DP format: exporter manifest + 24,000-character chunks;
// importer documents and other small properties are plain JSON.
import { world } from "@minecraft/server";
const CHUNK_SIZE = 24_000;
const MAX_CHUNKS = 128;
const formats = { i: "item", f: "fluid", g: "gas" };
function raw(key) {
    try { return JSON.parse(String(world.getDynamicProperty(key) ?? "null")); } catch { return null; }
}

/** Reads plain JSON or reconstructs the active generation of an exporter document. */
export function readNetworkData(key) {
    const data = raw(key);
    if (!data?.format) return data;
    if (![0, 1].includes(data.generation) || !Number.isInteger(data.chunks)
        || data.chunks < 1 || data.chunks > MAX_CHUNKS) return null;
    let serialized = "";
    for (let i = 0; i < data.chunks; i++) {
        const chunk = world.getDynamicProperty(`${key}:${data.generation}:${i}`);
        if (typeof chunk !== "string") return null;
        serialized += chunk;
    }
    try { return serialized.length === data.length ? JSON.parse(serialized) : null; } catch { return null; }
}

/** Removes only the chunks referenced by this manifest. */
function clearChunks(key, manifest) {
    if (!manifest?.format || !Number.isInteger(manifest.chunks) || manifest.chunks > MAX_CHUNKS) return;
    for (let i = 0; i < manifest.chunks; i++) world.setDynamicProperty(`${key}:${manifest.generation}:${i}`, undefined);
}

/** Uses UC's existing DP format; chunking here is local storage, not message transport. */
export function writeNetworkData(key, data) {
    const previous = raw(key);
    const exporter = /^utilitycraft:([ifg])e:[^:]+:[^:]+$/.exec(key);
    if (!exporter || data === undefined) {
        world.setDynamicProperty(key, data === undefined ? undefined : JSON.stringify(data));
        clearChunks(key, previous);
        return;
    }
    const serialized = JSON.stringify(data), chunks = Math.ceil(serialized.length / CHUNK_SIZE);
    if (chunks > MAX_CHUNKS) throw new RangeError(`Exporter topology is too large: ${key}`);

    // Write into the inactive generation, then publish its manifest after all chunks exist.
    const generation = previous?.generation === 0 ? 1 : 0;
    try {
        for (let i = 0; i < chunks; i++) {
            const chunk = serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            world.setDynamicProperty(`${key}:${generation}:${i}`, chunk);
        }
        world.setDynamicProperty(key, JSON.stringify({
            format: `utilitycraft:${formats[exporter[1]]}_exporter:v1`,
            generation,
            chunks,
            length: serialized.length,
        }));
    } catch (error) {
        // A failed write must not leave a root pointing at incomplete or stale routes.
        world.setDynamicProperty(key, undefined);
        clearChunks(key, { format: true, generation, chunks });
        clearChunks(key, previous);
        throw error;
    }
    clearChunks(key, previous);
}

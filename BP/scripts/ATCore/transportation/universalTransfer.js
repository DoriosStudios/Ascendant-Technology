import * as Items from "DoriosLib/containers/index.js";
import * as Fluids from "DoriosCore/machinery/fluidContainers.js";
import * as Gases from "DoriosCore/machinery/gasContainers.js";
import { isIOFaceDisabled } from "DoriosLib/containers/ioFaceState.js";
import { getImporterSettings } from "./transportSettings.js";

/** No filter upgrade means unrestricted types; a disabled resource always blocks. */
export function filterAllows(settings, type) {
    if (!settings) return true;
    if (!settings.enabled) return false;
    if (!settings.filterEnabled) return true;
    const listed = settings.filter.values.includes(type);
    return settings.filter.mode === "whitelist" ? listed : !listed;
}

function loaded(dimension, endpoint) {
    return endpoint?.location && dimension.isChunkLoaded(endpoint.location)
        && (!endpoint.importerLocation || dimension.isChunkLoaded(endpoint.importerLocation));
}

/** UC supplies nearest-first routes; reverse or rotate that order locally. */
function targetOrder(targets, state, mode) {
    const count = targets.length;
    return Array.from({ length: count }, (_, i) => {
        if (mode === "farthest") return count - 1 - i;
        if (mode === "round") return (state.targetCursor + i) % count;
        return i;
    });
}

/** Runs one item operation per speed level, moving up to 64 items per operation. */
function moveItems(port, data, state) {
    const dimension = port.dimension;
    const source = Items.resolveAt(dimension, data.source.location);
    if (!source) return;
    const slots = Items.getOutputSlots(source, { face: data.source.face });
    if (!slots.length) return;

    // Keep the source cursor between ticks; try at most three eligible stacks per operation.
    for (let operation = 0; operation <= data.settings.speedLevel; operation++) {
        let moved = false;
        let attempts = 0;
        for (let checked = 0; checked < slots.length && attempts < 3; checked++) {
            const slot = slots[state.sourceCursor % slots.length];
            state.sourceCursor = (state.sourceCursor + 1) % slots.length;
            const item = source.container.getItem(slot);
            if (!item || item.hasTag("utilitycraft:ui_element") || !filterAllows(data.settings, item.typeId)) continue;
            attempts++;

            // Check importer policy first, then let the container library enforce input slots/faces.
            for (const index of targetOrder(data.targets, state, data.settings.mode)) {
                const route = data.targets[index];
                if (!loaded(dimension, route) || !filterAllows(getImporterSettings(dimension, route.importerLocation, "item"), item.typeId)) continue;
                const target = Items.resolveAt(dimension, route.location);
                if (!target) continue;
                const amount = Items.transfer(source, { sourceSlot: slot, target, targetFace: route.face, maxAmount: 64 });
                if (amount <= 0) continue;
                state.targetCursor = (index + 1) % data.targets.length;
                moved = true;
                break;
            }
            if (moved) break;
        }
        if (!moved) break;
    }
}

const fluidAPI = {
    resolve: Fluids.resolveFluidContainerAt,
    outputs: Fluids.getFluidOutputIndices,
    inputs: Fluids.getFluidInputIndices,
    storage: Fluids.getFluidStorage,
    transfer: Fluids.transferFluid,
};
const gasAPI = {
    resolve: Gases.resolveGasContainerAt,
    outputs: Gases.getGasOutputIndices,
    inputs: Gases.getGasInputIndices,
    storage: Gases.getGasStorage,
    transfer: Gases.transferGas,
};

/** Shares the tank-transfer steps for liquids and gases, using their respective storage API. */
function moveResource(port, resource, data, state) {
    const dimension = port.dimension;
    const api = resource === "fluid" ? fluidAPI : gasAPI;
    const source = api.resolve(dimension, data.source.location);
    if (!source) {
        if (resource === "fluid") moveWorldFluid(port, data, state);
        return;
    }
    let indices = api.outputs(source, { face: data.source.face });
    // Match UC's filtered extraction of explicitly selected input tanks.
    if (data.settings.filterEnabled && data.settings.filter.mode === "whitelist" && data.settings.filter.values.length) {
        if (source.entity && source.via !== "link_node"
            && isIOFaceDisabled(source.entity, resource === "fluid" ? "liquids" : "gases", data.source.face)) return;
        indices = [...new Set([...api.outputs(source), ...api.inputs(source)])];
    }
    let remaining = 4000 * (1 + data.settings.speedLevel);
    let attempts = 0;

    // Spread one resource type across destinations until the limit is reached.
    // Once any amount moves, leave other source tank types for the next tick.
    for (const sourceIndex of indices) {
        const storage = api.storage(source, sourceIndex);
        const type = storage?.getType();
        if (!storage || storage.get() <= 0 || !type || type === "empty" || !filterAllows(data.settings, type)) continue;
        if (++attempts > 3) break;
        let moved = 0;
        for (const index of targetOrder(data.targets, state, data.settings.mode)) {
            const route = data.targets[index];
            if (!loaded(dimension, route) || !filterAllows(getImporterSettings(dimension, route.importerLocation, resource), type)) continue;
            const target = api.resolve(dimension, route.location);
            if (!target) continue;
            const amount = api.transfer(source, { sourceIndex, target, targetFace: route.face, maxAmount: remaining });
            if (amount <= 0) continue;
            remaining -= amount;
            moved += amount;
            state.targetCursor = (index + 1) % data.targets.length;
            if (remaining <= 0) break;
        }
        if (moved > 0) break;
    }
}

/** Extracts whole world-fluid units: 1,000 mB per source block or 250 mB per crucible level. */
function moveWorldFluid(port, data, state) {
    const block = port.dimension.getBlock(data.source.location);
    if (!block) return;
    let type, unit, amount;
    const vanilla = block.typeId === "minecraft:water" || block.typeId === "minecraft:lava";
    if (vanilla && block.permutation.getState("liquid_depth") === 0) {
        type = block.typeId.slice("minecraft:".length);
        unit = amount = 1000;
    } else if (block.typeId === "utilitycraft:crucible") {
        type = "lava";
        unit = 250;
        amount = Number(block.permutation.getState("utilitycraft:lava") ?? 0) * unit;
    } else return;
    if (amount <= 0 || !filterAllows(data.settings, type)) return;
    let remaining = Math.min(amount, 4000 * (1 + data.settings.speedLevel));
    for (const index of targetOrder(data.targets, state, data.settings.mode)) {
        const route = data.targets[index];
        if (!loaded(port.dimension, route) || !filterAllows(getImporterSettings(port.dimension, route.importerLocation, "fluid"), type)) continue;
        const target = Fluids.resolveFluidContainerAt(port.dimension, route.location);
        if (!target) continue;
        while (remaining >= unit) {
            // Remove the world source only after the destination accepts a complete unit.
            const moved = Fluids.insertFluid(target, { type, amount: unit, face: route.face, exact: true });
            if (moved !== unit) break;
            remaining -= unit;
            if (vanilla) block.setType("minecraft:air");
            else block.setPermutation(block.permutation.withState("utilitycraft:lava",
                Math.max(0, Number(block.permutation.getState("utilitycraft:lava")) - 1)));
            state.targetCursor = (index + 1) % data.targets.length;
        }
        if (remaining < unit) break;
    }
}

/** Processes each ready channel independently; UC owns the route discovery. */
export function transferUniversalPort(port) {
    for (const [resource, channel] of port.channels) {
        const data = channel.payload;
        if (channel.status !== "ready" || !data?.settings.enabled || !data.targets.length
            || !loaded(port.dimension, data.source)) continue;
        let state = port.transfer.get(resource);
        if (!state) {
            state = { sourceCursor: 0, targetCursor: 0 };
            port.transfer.set(resource, state);
        }
        try {
            if (resource === "item") moveItems(port, data, state);
            else moveResource(port, resource, data, state);
        } catch (error) {
            // One unloaded/invalid resource must not stop the other channels.
            console.warn(`[ATCore:transport:${resource}] Transfer interrupted`, error);
        }
    }
}

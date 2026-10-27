import { ID, CASE_TAG, SHELL_IDS, COMPONENT_ADAPTERS } from "./config.js";

const nativeShellIds = new Set(SHELL_IDS);
const externalRoles = new Set(["energy_cell", "fluid_cell", "processing_module", "speed_module", "efficiency_module"]);
const samePosition = (a, b) => ["x", "y", "z"].every(axis => a[axis] === b[axis]);
const invalid = (code, position) => ({ valid: false, code, position });

/** Strict, synchronous final scan after Dorios Core's yielding detection/effect.
 * The shared detector supplies variable rectangular bounds; this scan only
 * requires a closed shell and enough interior space for the four mandatory parts.
 * No resource/capacity/port is mutated by this function.
 */
export function validateChamberStructure(bounds, controller, getBlock, externalAdapters = {}, externalShellIds = []) {
    if (!bounds || !["x", "y", "z"].every(axis =>
        Number.isInteger(bounds.min?.[axis]) && Number.isInteger(bounds.max?.[axis])
        && bounds.max[axis] - bounds.min[axis] >= 2)) return invalid("size");

    const { min, max } = bounds;
    const interiorVolume = ["x", "y", "z"].reduce((volume, axis) => volume * (max[axis] - min[axis] - 1), 1);
    if (interiorVolume < 4) return invalid("size");
    const shellIds = new Set([...SHELL_IDS, ...externalShellIds]);
    const axes = ["x", "y", "z"];
    const inside = axes.every(axis => controller[axis] >= min[axis] && controller[axis] <= max[axis]);
    const onShell = axes.some(axis => controller[axis] === min[axis] || controller[axis] === max[axis]);
    if (!inside || !onShell) return invalid("controller_position");

    const components = {};
    const componentsById = {};
    const energyCapacityById = {};
    let xpCapacity = 0;
    const ports = [];
    const ventBlocks = [];
    const portCounts = { energy: 0, fluid: 0, item: 0 };
    for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) {
        const position = { x, y, z };
        let block;
        try { block = getBlock(position); } catch { return invalid("unloaded", position); }
        if (!block) return invalid("unloaded", position);
        if (samePosition(position, controller)) {
            if (block.typeId !== ID) return invalid("controller_missing", position);
            continue;
        }
        const outside = x === min.x || x === max.x || y === min.y || y === max.y || z === min.z || z === max.z;
        if (outside) {
            if (!shellIds.has(block.typeId) || !block.hasTag(CASE_TAG)) return invalid("shell", position);
            // A foreign link node cannot silently masquerade as a plain casing:
            // the Core activation protocol assumes a known active state and I/O tags.
            if (!nativeShellIds.has(block.typeId) && block.hasTag("dorios:link_node")) return invalid("port", position);
            const resource = Object.keys(portCounts).find(type => block.typeId === `utilitycraft:titanium_${type}_port`);
            if (resource) {
                if (!block.hasTag("dorios:link_node")) return invalid("port", position);
                ports.push(position);
                portCounts[resource]++;
            }
            if (block.typeId === "utilitycraft:titanium_vent_panel" && y === max.y) ventBlocks.push(position);
            continue;
        }
        if (block.typeId === "minecraft:air") continue;
        const ownAdapter = COMPONENT_ADAPTERS[block.typeId];
        const adapter = ownAdapter ?? externalAdapters[block.typeId];
        const role = adapter?.role;
        const units = adapter?.units ?? 1;
        if (!block.hasTag("dorios:multiblock_component") || !role ||
            (!ownAdapter && !externalRoles.has(role)) || !Number.isSafeInteger(units) || units < 1)
            return invalid("internal", position);
        if (role === "energy_cell") {
            if (!Number.isSafeInteger(adapter.energyCapacity) || adapter.energyCapacity < 1) return invalid("internal", position);
            energyCapacityById[block.typeId] = adapter.energyCapacity;
        }
        if (role === "fluid_cell") {
            if (!Number.isSafeInteger(adapter.xpCapacity) || adapter.xpCapacity < 1) return invalid("internal", position);
            xpCapacity += adapter.xpCapacity;
        }
        componentsById[block.typeId] = (componentsById[block.typeId] ?? 0) + 1;
        components[role] = (components[role] ?? 0) + units;
    }
    if (components.mob_chamber_core !== 1) return invalid("core_count");
    for (const name of ["energy_cell", "fluid_cell", "processing_module"]) {
        if (!(components[name] >= 1)) return invalid(name);
    }
    for (const [resource, count] of Object.entries(portCounts)) if (count === 0) return invalid(`${resource}_port`);
    return { valid: true, components, componentsById, energyCapacityById, xpCapacity, ports, ventBlocks, bounds };
}

export function structureFailureMessage(result) {
    const text = {
        size: "Build a closed titanium shell with room for the Core, Energy Cell, Fluid Cell and Processing Module.",
        controller_position: "Place the Controller anywhere on the titanium shell.",
        controller_missing: "The Controller changed during the scan. Scan again.",
        unloaded: "Part of the structure is not loaded. Scan again when all chunks are loaded.",
        shell: "The shell accepts only titanium casings, glass and ports, and one Controller.",
        port: "A titanium port is missing its link-node capability.",
        internal: "The interior accepts air, one Mob Chamber Core, Energy/Fluid Cells, Processing/Speed/Efficiency Modules and Essence Modules only.",
        core_count: "Exactly one Mob Chamber Core is required, anywhere inside.",
        energy_cell: "At least one Energy Cell is required.",
        fluid_cell: "At least one Fluid Cell is required.",
        processing_module: "At least one Processing Module is required.",
        energy_port: "At least one Titanium Energy Port is required.",
        fluid_port: "At least one Titanium Fluid Port is required.",
        item_port: "At least one Titanium Item Port is required (shared input/output or separate ports).",
    }[result.code] ?? "Invalid Mob Chamber structure.";
    const at = result.position ? ` (${result.position.x}, ${result.position.y}, ${result.position.z})` : "";
    return `§c[Mob Chamber] ${text}${at}`;
}

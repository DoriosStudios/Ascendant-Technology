// @ts-check
import { registerIOInterface as registerCoreIOInterface } from "DoriosCore/index.js";

/** Prioritize grouped operations once, when the interface is registered. */
export function prioritizeIOModes(config) {
    const ordered = { ...config };
    for (const resource of ["items", "liquids", "gases"]) {
        const definition = config[resource];
        if (!Array.isArray(definition?.modes)) continue;
        ordered[resource] = { ...definition, modes: [...definition.modes].sort((a, b) => rank(a, resource) - rank(b, resource) || (resource === "items" && rank(a, resource) === 3 ? (b.outputSlots?.length ?? 0) - (a.outputSlots?.length ?? 0) : 0)) };
    }
    return ordered;
}

function rank(mode, resource) {
    if (mode.id === "default") return 0;
    if (mode.id === "disabled") return 6;
    const inputs = mode.inputSlots ?? mode.inputIndices ?? [];
    const outputs = mode.outputSlots ?? mode.outputIndices ?? [];
    if (resource === "items") {
        if (mode.id === "input_1" && inputs.length) return 1;
        if (inputs.length > 1) return 2;
        if (outputs.length > 1) return 3;
        return 4;
    }
    return inputs.length > 1 || outputs.length > 1 || (inputs.length && outputs.length) ? 1 : 2;
}

export function registerIOInterface(blockTypeId, config = {}) {
    return registerCoreIOInterface(blockTypeId, prioritizeIOModes(config));
}

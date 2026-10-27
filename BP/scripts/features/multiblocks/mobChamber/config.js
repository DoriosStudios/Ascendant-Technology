// Mob Chamber owns its rules; generic factory square-root multipliers do not apply.
export const ID = "utilitycraft:mob_chamber_controller";
export const CORE_ID = "utilitycraft:mob_chamber_core";
export const ESSENCE_MODULE_ID = "utilitycraft:essence_module";
export const CASE_TAG = "dorios:multiblock.case.titanium";
export const STATS_KEY = "at:mob_chamber_stats";
export const INVENTORY_SIZE = 40;
export const MAX_ESSENCE_SLOTS = 8;
export const FLUID_PER_CELL = 256_000;
export const ENERGY_PER_CELL = 4_000_000;
export const BASE_ENERGY_PER_DEATH = 64_000;
export const SLOTS = Object.freeze({
    energy: 0, information: 1, timer: 2, placeholder: 3,
    // Append new inputs so existing XP/loot indices remain stable across upgrades.
    essences: Object.freeze([4, 5, 6, 7, 36, 37, 38, 39]), xp: 8,
    loot: Object.freeze(Array.from({ length: 27 }, (_, index) => index + 9)),
});

export const SHELL_IDS = Object.freeze([
    "titanium_case", "titanium_bricks", "tempered_titanium_glass",
    "reinforced_titanium_glass", "titanium_plated_block", "titanium_hazard_block",
    "titanium_vent_panel", "titanium_energy_port", "titanium_fluid_port", "titanium_item_port",
].map(id => `utilitycraft:${id}`));

// Exact block IDs are mapped to machine roles; a matching local name in another
// namespace never gains a role or capacity automatically.
export const COMPONENT_ADAPTERS = Object.freeze({
    [CORE_ID]: { role: "mob_chamber_core" },
    [ESSENCE_MODULE_ID]: { role: "essence_module" },
    "utilitycraft:energy_cell": { role: "energy_cell", energyCapacity: ENERGY_PER_CELL },
    "utilitycraft:fluid_cell": { role: "fluid_cell", xpCapacity: FLUID_PER_CELL },
    "utilitycraft:processing_module": { role: "processing_module" },
    "utilitycraft:speed_module": { role: "speed_module" },
    "utilitycraft:efficiency_module": { role: "efficiency_module" },
});

// Optional external blocks are added here only after their BP declares the
// multiblock component tag and the integration is tested in both pack sets.
// Example: "other:compact_energy_cell": { role: "energy_cell", energyCapacity: 2_000_000 }
export const EXTERNAL_COMPONENT_ADAPTERS = Object.freeze({});

// External plain casings may be allowlisted by exact ID and must also carry
// CASE_TAG. Ports are intentionally excluded until their I/O contract is known.
export const EXTERNAL_SHELL_IDS = Object.freeze([]);

export const CONFIG = {
    required_case: CASE_TAG,
    entity: {
        name: "mob_chamber", identifier: "at:mob_chamber_machine",
        type: "complex_machine_fluid", inventory_size: INVENTORY_SIZE,
    },
    machine: { energy_cap: 0, rate_speed_base: 0 },
};

export function computeChamberStats(components, capacities = {}) {
    const speedModules = components.speed_module ?? 0;
    const efficiencyModules = components.efficiency_module ?? 0;
    const operationSeconds = Math.max(Number.MIN_VALUE, 10 * 0.95 ** speedModules);
    return {
        version: 1,
        components: { ...components },
        essenceSlots: Math.min(MAX_ESSENCE_SLOTS, 1 + (components.essence_module ?? 0)),
        processingCapacity: components.processing_module ?? 0,
        operationSeconds,
        operationTicks: Math.max(1, Math.ceil(operationSeconds * 20)),
        efficiencyMultiplier: Math.max(Number.MIN_VALUE, 0.975 ** efficiencyModules),
        xpCapacity: capacities.xpCapacity ?? (components.fluid_cell ?? 0) * FLUID_PER_CELL,
        // No XP multiplier: every virtual death will roll its own vanilla reward.
    };
}

export function operationEnergyCost(deaths, efficiencyMultiplier = 1) {
    return deaths > 0 ? Math.max(1, Math.ceil(BASE_ENERGY_PER_DEATH * deaths * 2 ** (deaths - 1) * efficiencyMultiplier)) : 0;
}

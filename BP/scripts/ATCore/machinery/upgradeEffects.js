// AT-only definitions. These items are deliberately NOT broadcast to the shared registry.
export const UPGRADE_DEFINITIONS = Object.freeze({
    "utilitycraft:multi_processing_upgrade": { type: "multi_processing", perk: "parallel_operations" },
    "utilitycraft:energy_capacity_upgrade": { type: "energy_capacity", perk: "energy_capacity_multiplier" },
    "utilitycraft:liquid_capacity_upgrade": { type: "liquid_capacity", perk: "fluid_capacity_multiplier" },
    "utilitycraft:gas_capacity_upgrade": { type: "gas_capacity", perk: "gas_capacity_multiplier" },
    "utilitycraft:resource_efficiency_upgrade": { type: "resource_efficiency", perk: "resource_preservation_chance" },
});

export function supportsUpgrade(profile, type) {
    if (!profile?.slots?.length) return false;
    if (type === "multi_processing") return profile.parallel_slots > 1;
    if (type === "energy_capacity") return profile.energy_cap > 0;
    if (type === "liquid_capacity") return profile.fluid_cap > 0;
    if (type === "gas_capacity") return profile.gas_cap > 0;
    return type === "resource_efficiency" && profile.resource_efficiency === true;
}

export function resolveATBoosts(container, profile) {
    const boosts = {
        parallel_operations: 1,
        energy_capacity_multiplier: 1,
        fluid_capacity_multiplier: 1,
        gas_capacity_multiplier: 1,
        resource_preservation_chance: 0,
    };
    const seen = new Set();
    for (const slot of profile?.slots ?? []) {
        if (slot >= container.size) continue;
        const item = container.getItem(slot);
        const definition = UPGRADE_DEFINITIONS[item?.typeId];
        if (!definition || seen.has(definition.type) || !supportsUpgrade(profile, definition.type)) continue;
        seen.add(definition.type);
        const level = Math.min(8, Math.max(0, Math.floor(item.amount)));
        boosts[definition.perk] = definition.type === "multi_processing" ? 1 + level
            : definition.type === "resource_efficiency" ? level * 0.05 : 1 + level * 0.5;
    }
    return boosts;
}

/** One independent roll per recipe requirement per craft, never per mB. */
export function resourceCost(machine, total, perCraft = total, random = Math.random) {
    const chance = Math.min(1, Math.max(0, machine.boosts?.resource_preservation_chance ?? 0));
    if (!(total > 0) || !(perCraft > 0)) return 0;
    if (chance <= 0) return total;
    if (chance >= 1) return 0;
    let paid = 0;
    const crafts = Math.floor(total / perCraft);
    for (let craft = 0; craft < crafts; craft++) if (random() >= chance) paid += perCraft;
    const remainder = total - crafts * perCraft;
    if (remainder > 0 && random() >= chance) paid += remainder;
    return Number.isInteger(total) ? Math.min(total, Math.round(paid)) : paid;
}

export function parallelLimit(machine, size) {
    return Math.min(size, Math.max(1, Math.floor(machine.boosts?.parallel_operations ?? 1)));
}

export function capacityTarget(base, multiplier, stored) {
    return Math.max(Math.floor(base * multiplier), stored);
}

/** Prefer the already installed stack. Duplicate stacks never add levels. */
export function findUpgradeSlot(container, profile, itemId) {
    const slots = (profile?.slots ?? []).filter(slot => slot < container.size);
    return slots.find(slot => container.getItem(slot)?.typeId === itemId)
        ?? slots.find(slot => !container.getItem(slot));
}

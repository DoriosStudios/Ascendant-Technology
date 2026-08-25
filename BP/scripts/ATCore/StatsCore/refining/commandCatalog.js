import { ITEM_TYPES } from "../constants.js";

const COMBAT_TYPES = Object.freeze([
    ITEM_TYPES.weapon,
    ITEM_TYPES.tool,
    ITEM_TYPES.hybrid,
    ITEM_TYPES.utility,
]);
const MINING_TYPES = Object.freeze([
    ITEM_TYPES.tool,
    ITEM_TYPES.hybrid,
    ITEM_TYPES.utility,
]);
const SUPPORT_TYPES = Object.freeze([ITEM_TYPES.support]);

function attribute(key, property, label, max, itemTypes, description, valueHelp) {
    return Object.freeze({
        key,
        property,
        label,
        description,
        valueHelp,
        valueType: "float",
        min: 0,
        max,
        itemTypes,
    });
}

function ability(key, label, max = 1) {
    return Object.freeze({
        key,
        label,
        valueType: "int",
        min: 1,
        max,
        appliesToType: "string|string[]",
    });
}

export const REFINEMENT_ATTRIBUTE_CATALOG = Object.freeze({
    damage_multiplier: attribute("damage_multiplier", "damageMultiplier", "Bonus Damage", 1, COMBAT_TYPES, "Adds a percentage to eligible attack damage.", "0.25 means +25% damage"),
    extra_damage: attribute("extra_damage", "extraDamage", "Flat Extra Damage", 18, COMBAT_TYPES, "Adds a fixed amount of damage after the base hit is calculated.", "4 means +4 damage (2 hearts)"),
    critical_chance: attribute("critical_chance", "critChance", "Critical Hit Chance", 1, COMBAT_TYPES, "Adds a chance for an eligible hit to become critical.", "0.20 means +20 percentage points"),
    critical_damage: attribute("critical_damage", "critDamageBonus", "Critical Damage", 1, COMBAT_TYPES, "Raises the multiplier used when a critical hit succeeds.", "0.50 means +0.50x critical damage"),
    penetration: attribute("penetration", "penetration", "Armor Penetration", 1, COMBAT_TYPES, "Ignores part of the target's effective armor; bosses use a reduced value.", "0.15 means 15% penetration"),
    lifesteal: attribute("lifesteal", "lifesteal", "Lifesteal", 1, COMBAT_TYPES, "Heals the attacker from eligible damage dealt.", "0.08 means 8% lifesteal"),
    damage_reduction: attribute("damage_reduction", "damageReduction", "Damage Reduction", 1, SUPPORT_TYPES, "Reduces incoming damage while the armor is equipped.", "0.10 means 10% reduction"),
    negate_all_damage: attribute("negate_all_damage", "negateAllDamageChance", "Evasion", 1, SUPPORT_TYPES, "Adds a chance to cancel an eligible incoming hit completely.", "0.05 means 5% evasion"),
    bonus_loot_chance: attribute("bonus_loot_chance", "bonusLootChance", "Bonus Loot Chance", 1, MINING_TYPES, "Adds a chance to generate another eligible loot result.", "0.12 means 12% bonus-loot chance"),
    durability_save: attribute("durability_save", "durabilitySaveChance", "Tool Preserving", 1, MINING_TYPES, "Adds to the held tool's hostile-hit durability repair chance.", "0.10 means 10% chance"),
    durability_preserve: attribute("durability_preserve", "durabilityPreserveChance", "Armor Preserving", 1, SUPPORT_TYPES, "Adds to armor's hostile-hit durability repair chance.", "0.10 means 10% chance"),
});

export const REFINEMENT_ABILITY_CATALOG = Object.freeze({
    aftershock: ability("aftershock", "Aftershock"),
    armored: ability("armored", "Armored"),
    ballista: ability("ballista", "Ballista"),
    berserk: ability("berserk", "Berserk"),
    berserk_logging: ability("berserk_logging", "Berserk Logging"),
    bleeding: ability("bleeding", "Bleeding"),
    blast_ward: ability("blast_ward", "Blast Ward"),
    bulwark: ability("bulwark", "Bulwark"),
    clarity: ability("clarity", "Clarity"),
    crushing: ability("crushing", "Crushing"),
    featherstep: ability("featherstep", "Featherstep"),
    forger: ability("forger", "Forger"),
    gardener: ability("gardener", "Gardener"),
    harpoon: ability("harpoon", "Harpoon"),
    igniter: ability("igniter", "Igniter"),
    luck: ability("luck", "Luck"),
    operator: ability("operator", "Operator"),
    overcharge: ability("overcharge", "Overcharge"),
    perfect_guard: ability("perfect_guard", "Perfect Guard"),
    phase_step: ability("phase_step", "Phase Step"),
    pinning_shot: ability("pinning_shot", "Pinning Shot"),
    primal: ability("primal", "Primal"),
    reaper: ability("reaper", "Reaper"),
    retaliation: ability("retaliation", "Retaliation"),
    skewer: ability("skewer", "Skewer"),
    soul_collector: ability("soul_collector", "Soul Collector"),
    sweeping: ability("sweeping", "Sweeping"),
    tough: ability("tough", "Tough"),
    worm: ability("worm", "Guard Worm"),
});

export const REFINEMENT_ATTRIBUTE_KEYS = Object.freeze(Object.keys(REFINEMENT_ATTRIBUTE_CATALOG));
export const REFINEMENT_ABILITY_KEYS = Object.freeze(Object.keys(REFINEMENT_ABILITY_CATALOG));

export function getRefinementAttributeOption(value) {
    return REFINEMENT_ATTRIBUTE_CATALOG[String(value ?? "").trim().toLowerCase()] ?? null;
}

export function getRefinementAbilityOption(value) {
    return REFINEMENT_ABILITY_CATALOG[String(value ?? "").trim().toLowerCase()] ?? null;
}

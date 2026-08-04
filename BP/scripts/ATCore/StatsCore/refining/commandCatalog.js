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

function attribute(key, property, label, max, itemTypes) {
    return Object.freeze({
        key,
        property,
        label,
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
    damage_multiplier: attribute("damage_multiplier", "damageMultiplier", "Damage Multiplier", 1, COMBAT_TYPES),
    extra_damage: attribute("extra_damage", "extraDamage", "Extra Damage", 18, COMBAT_TYPES),
    critical_chance: attribute("critical_chance", "critChance", "Critical Chance", 1, COMBAT_TYPES),
    critical_damage: attribute("critical_damage", "critDamageBonus", "Critical Damage", 1, COMBAT_TYPES),
    penetration: attribute("penetration", "penetration", "Armor Penetration", 1, COMBAT_TYPES),
    lifesteal: attribute("lifesteal", "lifesteal", "Lifesteal", 1, COMBAT_TYPES),
    damage_reduction: attribute("damage_reduction", "damageReduction", "Damage Reduction", 1, SUPPORT_TYPES),
    negate_all_damage: attribute("negate_all_damage", "negateAllDamageChance", "Evasion", 1, SUPPORT_TYPES),
    bonus_loot_chance: attribute("bonus_loot_chance", "bonusLootChance", "Bonus Loot Chance", 1, MINING_TYPES),
    durability_save: attribute("durability_save", "durabilitySaveChance", "Tool Preserving", 1, MINING_TYPES),
    durability_preserve: attribute("durability_preserve", "durabilityPreserveChance", "Armor Preserving", 1, SUPPORT_TYPES),
});

export const REFINEMENT_ABILITY_CATALOG = Object.freeze({
    aftershock: ability("aftershock", "Aftershock"),
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

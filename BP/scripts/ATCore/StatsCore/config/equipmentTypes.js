export const ITEM_TYPES = Object.freeze({
    weapon: "weapon",
    tool: "tool",
    hybrid: "hybrid",
    support: "support",
    utility: "utility"
});

export const EQUIPMENT_SLOTS = Object.freeze({
    mainhand: "Mainhand",
    offhand: "Offhand",
    head: "Head",
    chest: "Chest",
    legs: "Legs",
    feet: "Feet",
});

// Keep the existing STATSCORE.slots object shape for public consumers.
export const STATSCORE_EQUIPMENT_SLOTS = Object.freeze({
    mainhand: EQUIPMENT_SLOTS.mainhand,
    offhand: EQUIPMENT_SLOTS.offhand,
    armor: Object.freeze([EQUIPMENT_SLOTS.head, EQUIPMENT_SLOTS.chest, EQUIPMENT_SLOTS.legs, EQUIPMENT_SLOTS.feet]),
});

export const BOOT_MOBILITY_MODES = Object.freeze(["dash", "bunny_jump", "none"]);

export const NON_COMBAT_TOOL_BRANCHES = new Set([
    "pickaxe",
    "shovel",
    "shears",
    "drill",
    "knife",
    "lighter"
]);

export const CANONICAL_TIER_TOKENS = Object.freeze({
    wooden: "wood",
    wood: "wood",
    stone: "stone",
    copper: "copper",
    iron: "iron",
    steel: "steel",
    gold: "golden",
    golden: "golden",
    diamond: "diamond",
    netherite: "netherite",
    titanium: "titanium",
    aetherium: "aetherium",
});

export const ADVANCED_ABILITY_TIERS = new Set(["diamond", "netherite", "titanium", "aetherium"]);

export const BRANCH_ITEM_TYPES = Object.freeze({
    drill: ITEM_TYPES.utility,
    knife: ITEM_TYPES.utility,
    lighter: ITEM_TYPES.utility,
    shears: ITEM_TYPES.utility,
    equipment: ITEM_TYPES.utility,
    helmet: ITEM_TYPES.support,
    chestplate: ITEM_TYPES.support,
    leggings: ITEM_TYPES.support,
    boots: ITEM_TYPES.support,
    shield: ITEM_TYPES.support,
    elytra: ITEM_TYPES.support,
    armor: ITEM_TYPES.support,
    sword: ITEM_TYPES.weapon,
    mace: ITEM_TYPES.weapon,
    trident: ITEM_TYPES.weapon,
    bow: ITEM_TYPES.weapon,
    crossbow: ITEM_TYPES.weapon,
    spear: ITEM_TYPES.weapon,
    weapon: ITEM_TYPES.weapon,
    stick: ITEM_TYPES.weapon,
    wand: ITEM_TYPES.weapon,
    axe: ITEM_TYPES.hybrid,
    paxel: ITEM_TYPES.hybrid,
    aiot: ITEM_TYPES.hybrid,
    pickaxe: ITEM_TYPES.tool,
    shovel: ITEM_TYPES.tool,
    hoe: ITEM_TYPES.tool,
    hammer: ITEM_TYPES.tool,
    tool: ITEM_TYPES.tool,
});

export const PROJECTILE_BRANCHES = Object.freeze(["bow", "crossbow", "trident"]);

export const COMBAT_TYPES = Object.freeze([
    ITEM_TYPES.weapon,
    ITEM_TYPES.tool,
    ITEM_TYPES.hybrid,
    ITEM_TYPES.utility,
]);
export const MINING_TYPES = Object.freeze([
    ITEM_TYPES.tool,
    ITEM_TYPES.hybrid,
    ITEM_TYPES.utility,
]);
export const SUPPORT_TYPES = Object.freeze([ITEM_TYPES.support]);

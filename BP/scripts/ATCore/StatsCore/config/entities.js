export const MINECRAFT_NAMESPACE = "minecraft:";

export const ENTITY_CATEGORIES = Object.freeze({
    ally: "ally",
    passive: "passive",
    neutral: "neutral",
    hostile: "hostile",
    boss: "boss",
});

export const OFFENSIVE_ENTITY_CATEGORIES = Object.freeze([
    ENTITY_CATEGORIES.neutral,
    ENTITY_CATEGORIES.hostile,
    ENTITY_CATEGORIES.boss,
]);

function qualifyEntityIds(values) {
    return Object.freeze(values.map(value => value.includes(":") ? value : `${MINECRAFT_NAMESPACE}${value}`));
}

export const ENTITY_CATEGORY_MEMBERS = Object.freeze({
    [ENTITY_CATEGORIES.ally]: qualifyEntityIds([
        "player",
        "allay",
        "bat",
        "copper_golem",
        "happy_ghast",
        "iron_golem",
        "npc",
        "sniffer",
        "snow_golem",
        "villager",
        "villager_v2",
        "wandering_trader",
    ]),
    [ENTITY_CATEGORIES.passive]: qualifyEntityIds([
        "armadillo",
        "axolotl",
        "bee",
        "camel",
        "cat",
        "chicken",
        "cod",
        "cow",
        "donkey",
        "fox",
        "frog",
        "glow_squid",
        "horse",
        "mooshroom",
        "mule",
        "nautilus",
        "ocelot",
        "parrot",
        "pig",
        "rabbit",
        "salmon",
        "sheep",
        "skeleton_horse",
        "squid",
        "strider",
        "tadpole",
        "tropicalfish",
        "turtle",
        "zombie_horse",
    ]),
    [ENTITY_CATEGORIES.neutral]: qualifyEntityIds([
        "cave_spider",
        "dolphin",
        "enderman",
        "goat",
        "llama",
        "panda",
        "piglin",
        "polar_bear",
        "pufferfish",
        "spider",
        "trader_llama",
        "wolf",
        "zombie_pigman",
        "zombified_piglin",
    ]),
    [ENTITY_CATEGORIES.hostile]: qualifyEntityIds([
        "blaze",
        "bogged",
        "breeze",
        "camel_husk",
        "creaking",
        "creeper",
        "drowned",
        "endermite",
        "evocation_illager",
        "ghast",
        "guardian",
        "hoglin",
        "husk",
        "magma_cube",
        "parched",
        "phantom",
        "piglin_brute",
        "pillager",
        "ravager",
        "shulker",
        "silverfish",
        "skeleton",
        "slime",
        "stray",
        "sulfur_cube",
        "vex",
        "vindicator",
        "witch",
        "wither_skeleton",
        "zoglin",
        "zombie",
        "zombie_nautilus",
        "zombie_villager",
        "zombie_villager_v2",
    ]),
    [ENTITY_CATEGORIES.boss]: qualifyEntityIds([
        "elder_guardian",
        "elder_guardian_ghost",
        "ender_dragon",
        "warden",
        "wither",
    ]),
});

export const ENTITY_TYPE_CATEGORY = Object.freeze(
    Object.fromEntries(
        Object.entries(ENTITY_CATEGORY_MEMBERS).flatMap(([category, ids]) => {
            return ids.map(id => [id, category]);
        })
    )
);

export const HOT_ENTITY_TOKENS = Object.freeze(["blaze", "magma", "strider", "ghast", "piglin", "hoglin", "zoglin", "wither_skeleton"]);
export const COLD_ENTITY_TOKENS = Object.freeze(["stray", "snow_golem", "breeze", "ice", "frozen", "frost"]);
export const DARK_RESISTANT_TOKENS = Object.freeze(["wither", "warden", "ender", "shulker"]);
export const UNDEAD_ENTITY_TOKENS = Object.freeze([
    "bogged", "drowned", "husk", "parched", "phantom", "skeleton", "stray",
    "wither", "zoglin", "zombie",
]);
export const SWEEP_ENTITY_CATEGORIES = Object.freeze([
    ...OFFENSIVE_ENTITY_CATEGORIES,
    ENTITY_CATEGORIES.passive,
]);
export const SWEEP_EXCLUDED_ENTITY_TYPES = ENTITY_CATEGORY_MEMBERS[ENTITY_CATEGORIES.ally];

const ASCENDANT_BLOCK_RARITIES = Object.freeze({
    "utilitycraft:duplicator": "legendary",
    "utilitycraft:enchantment_station": "epic",
    "utilitycraft:catalyst_weaver": "epic",
    "utilitycraft:cryo_chamber": "epic",
    "utilitycraft:energizer": "rare",
    "utilitycraft:liquifier": "rare",
    "utilitycraft:residue_processor": "rare",
    "utilitycraft:vaporworks_processor": "rare",
    "utilitycraft:network_center": "rare",
    "utilitycraft:laser_barrier": "rare",
    "utilitycraft:laser_barrier_field": "rare",
    "utilitycraft:mob_magnet": "rare",
    "utilitycraft:singularity_fabricator": "transcendent",

    "utilitycraft:conveyor_network_updater": "uncommon",
    "utilitycraft:conveyor_junction": "uncommon",
    "utilitycraft:conveyor_overflow": "uncommon",
    "utilitycraft:conveyor_underflow": "uncommon",
    "utilitycraft:conveyor_router": "rare",
    "utilitycraft:conveyor_sorter": "rare",
    "utilitycraft:conveyor_smart_router": "rare",
    "utilitycraft:conveyor_inverted_sorter": "rare",
    "utilitycraft:conveyor_bridge_path": "uncommon",

    "utilitycraft:copper_conveyor_horizontal": "uncommon",
    "utilitycraft:copper_conveyor_vertical": "uncommon",
    "utilitycraft:copper_conveyor_inclined": "uncommon",
    "utilitycraft:copper_conveyor_declined": "uncommon",
    "utilitycraft:copper_conveyor_bridge_transmitter": "uncommon",
    "utilitycraft:copper_conveyor_bridge_receiver": "uncommon",
    "utilitycraft:copper_conveyor_bridge_path": "uncommon",

    "utilitycraft:titanium_conveyor_horizontal": "rare",
    "utilitycraft:titanium_conveyor_vertical": "rare",
    "utilitycraft:titanium_conveyor_inclined": "rare",
    "utilitycraft:titanium_conveyor_declined": "rare",
    "utilitycraft:titanium_conveyor_bridge_transmitter": "rare",
    "utilitycraft:titanium_conveyor_bridge_receiver": "rare",
    "utilitycraft:titanium_conveyor_bridge_path": "rare",

    "utilitycraft:aetherium_conveyor_horizontal": "legendary",
    "utilitycraft:aetherium_conveyor_vertical": "legendary",
    "utilitycraft:aetherium_conveyor_inclined": "legendary",
    "utilitycraft:aetherium_conveyor_declined": "legendary",
    "utilitycraft:aetherium_conveyor_bridge_transmitter": "legendary",
    "utilitycraft:aetherium_conveyor_bridge_receiver": "legendary",
    "utilitycraft:aetherium_conveyor_bridge_path": "legendary",

    "utilitycraft:overclock_relay": "epic",
    "utilitycraft:overclock_tower": "legendary",
    "utilitycraft:reinforced_extractor": "rare",
    "utilitycraft:reinforced_cable": "rare",

    "utilitycraft:raw_titanium_block": "rare",
    "utilitycraft:titanium_block": "rare",
    "utilitycraft:aetherium_block": "mythic",
    "utilitycraft:deepslate_titanium_ore": "rare",
    "utilitycraft:deepslate_aetherium_ore": "legendary",
    "utilitycraft:end_aetherium_ore": "mythic",

    "utilitycraft:absolute_battery": "legendary",
    "utilitycraft:absolute_container": "legendary",
    "utilitycraft:absolute_furnator": "legendary",
    "utilitycraft:absolute_magmator": "legendary",
    "utilitycraft:absolute_solar_panel": "legendary",
    "utilitycraft:absolute_thermo_generator": "legendary",
    "utilitycraft:absolute_wind_turbine": "legendary"
});

// Ascendant items
const ASCENDANT_ITEM_RARITIES = Object.freeze({
    "utilitycraft:aetherium_shard": "legendary",
    "utilitycraft:refined_aetherium_shard": "mythic",
    "utilitycraft:aetherium_ingot": "mythic",
    "utilitycraft:aetherium_boots": "mythic",
    "utilitycraft:aetherium_leggings": "mythic",
    "utilitycraft:aetherium_chestplate": "mythic",
    "utilitycraft:aetherium_helmet": "mythic",
    "utilitycraft:aetherium_sword": "mythic",
    "utilitycraft:aetherium_pickaxe": "mythic",
    "utilitycraft:aetherium_axe": "mythic",
    "utilitycraft:aetherium_shovel": "mythic",
    "utilitycraft:aetherium_hoe": "mythic",

    "utilitycraft:void_essence": "legendary",
    "utilitycraft:enderling_tear": "mythic",
    "utilitycraft:pure_enderling_tear": "transcendent",
});

const GENERATOR_TIER_TO_RARITY = Object.freeze({
    basic: "common",
    advanced: "uncommon",
    expert: "rare",
    ultimate: "epic",
    absolute: "legendary"
});

const TIERED_GENERATOR_SUFFIXES = new Set([
    "battery",
    "solar_panel",
    "wind_turbine",
    "thermo_generator",
    "magmator",
    "furnator",
    "generator"
]);

// Vanilla items
const VANILLA_TRANSCENDENT_BLOCKS = new Set([
    "minecraft:barrier",
    "minecraft:bedrock",
    "minecraft:command_block",
    "minecraft:structure_block",
    "minecraft:jigsaw"
]);

const VANILLA_MYTHIC_BLOCKS = new Set([
    "minecraft:chain_command_block",
    "minecraft:dragon_egg",
    "minecraft:end_portal_frame",
    "minecraft:reinforced_deepslate",
    "minecraft:repeating_command_block",
    "minecraft:spawner"
]);

const VANILLA_LEGENDARY_BLOCKS = new Set([
    "minecraft:ancient_debris",
    "minecraft:beacon",
    "minecraft:conduit",
    "minecraft:end_gateway",
    "minecraft:lodestone",
    "minecraft:netherite_block",
    "minecraft:respawn_anchor"
]);

const VANILLA_EPIC_BLOCKS = new Set([
    "minecraft:diamond_block",
    "minecraft:diamond_ore",
    "minecraft:deepslate_diamond_ore",
    "minecraft:deepslate_emerald_ore",
    "minecraft:emerald_block",
    "minecraft:emerald_ore",
    "minecraft:enchanting_table",
    "minecraft:ender_chest"
]);

const VANILLA_RARE_BLOCKS = new Set([
    "minecraft:crying_obsidian",
    "minecraft:glowstone",
    "minecraft:gold_block",
    "minecraft:gold_ore",
    "minecraft:deepslate_gold_ore",
    "minecraft:obsidian",
    "minecraft:sculk",
    "minecraft:sculk_catalyst",
    "minecraft:sculk_sensor",
    "minecraft:sculk_shrieker",
    "minecraft:sea_lantern",
    "minecraft:spore_blossom"
]);

const VANILLA_UNCOMMON_BLOCKS = new Set([
    "minecraft:amethyst_block",
    "minecraft:budding_amethyst",
    "minecraft:calcite",
    "minecraft:coal_block",
    "minecraft:coal_ore",
    "minecraft:deepslate_coal_ore",
    "minecraft:copper_block",
    "minecraft:copper_ore",
    "minecraft:deepslate_copper_ore",
    "minecraft:cut_copper",
    "minecraft:exposed_copper",
    "minecraft:weathered_copper",
    "minecraft:oxidized_copper",
    "minecraft:iron_block",
    "minecraft:iron_ore",
    "minecraft:deepslate_iron_ore",
    "minecraft:lapis_block",
    "minecraft:lapis_ore",
    "minecraft:deepslate_lapis_ore",
    "minecraft:nether_gold_ore",
    "minecraft:nether_quartz_ore",
    "minecraft:raw_copper_block",
    "minecraft:raw_gold_block",
    "minecraft:raw_iron_block",
    "minecraft:redstone_block",
    "minecraft:redstone_ore",
    "minecraft:deepslate_redstone_ore",
    "minecraft:tuff",
    "minecraft:dripstone_block"
]);

const VANILLA_COMMON_BLOCKS = new Set([
    "minecraft:clay",
    "minecraft:cobblestone",
    "minecraft:coarse_dirt",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:gravel",
    "minecraft:ice",
    "minecraft:packed_ice",
    "minecraft:blue_ice",
    "minecraft:mycelium",
    "minecraft:rooted_dirt",
    "minecraft:sand",
    "minecraft:red_sand",
    "minecraft:snow_block",
    "minecraft:stone",
    "minecraft:glass"
]);

const VANILLA_TRANSCENDENT_ITEMS = new Set([
    "minecraft:command_block",
    "minecraft:structure_block",
    "minecraft:jigsaw",
    "minecraft:barrier",
    "minecraft:bedrock"
]);

const VANILLA_MYTHIC_ITEMS = new Set([
    "minecraft:dragon_egg",
    "minecraft:nether_star"
]);

const VANILLA_LEGENDARY_ITEMS = new Set([
    "minecraft:elytra",
    "minecraft:enchanted_golden_apple",
    "minecraft:totem_of_undying",
    "minecraft:netherite_upgrade_smithing_template",
    "minecraft:silence_armor_trim_smithing_template",
    "minecraft:ward_armor_trim_smithing_template",
    "minecraft:spire_armor_trim_smithing_template"
]);

const VANILLA_EPIC_ITEMS = new Set([
    "minecraft:wither_skeleton_skull",
    "minecraft:ancient_debris",
    "minecraft:blaze_rod",
    "minecraft:echo_shard",
    "minecraft:shulker_shell",
    "minecraft:trident",
    "minecraft:netherite_scrap",
    "minecraft:prismarine_shard",
    "minecraft:prismarine_crystals"
]);

const VANILLA_RARE_ITEMS = new Set([
    "minecraft:diamond",
    "minecraft:emerald",
    "minecraft:ghast_tear",
    "minecraft:ender_pearl",
    "minecraft:heart_of_the_sea",
    "minecraft:ender_eye",
    "minecraft:rabbit_foot",
    "minecraft:phantom_membrane",
    "minecraft:nautilus_shell",
    "minecraft:blaze_powder",
    "minecraft:experience_bottle",
    "minecraft:golden_apple",
    "minecraft:diamond_sword",
    "minecraft:diamond_pickaxe",
    "minecraft:diamond_axe",
    "minecraft:diamond_shovel",
    "minecraft:diamond_hoe",
    "minecraft:diamond_chestplate",
    "minecraft:diamond_leggings",
    "minecraft:diamond_helmet",
    "minecraft:diamond_boots"
]);

const VANILLA_UNCOMMON_ITEMS = new Set([
    "minecraft:amethyst_shard",
    "minecraft:lapis_lazuli",
    "minecraft:redstone",
    "minecraft:quartz",
    "minecraft:iron_ingot",
    "minecraft:gold_ingot",
    "minecraft:copper_ingot",
    "minecraft:slime_ball",
    "minecraft:glowstone_dust",
    "minecraft:ender_chest",
    "minecraft:book",
    "minecraft:enchanted_book",
    "minecraft:bucket",
    "minecraft:milk_bucket",
    "minecraft:water_bucket",
    "minecraft:lava_bucket"
]);

const VANILLA_COMMON_ITEMS = new Set([
    "minecraft:coal",
    "minecraft:charcoal",
    "minecraft:string",
    "minecraft:stick",
    "minecraft:bone",
    "minecraft:gunpowder",
    "minecraft:rotten_flesh",
    "minecraft:spider_eye",
    "minecraft:leather",
    "minecraft:paper",
    "minecraft:wheat",
    "minecraft:feather",
    "minecraft:flint",
    "minecraft:clay_ball",
    "minecraft:sugar",
    "minecraft:ink_sac"
]);

const VANILLA_COMMON_BLOCK_PATTERNS = [
    /^minecraft:.*_planks$/,
    /^minecraft:.*_log$/,
    /^minecraft:.*_wood$/,
    /^minecraft:stripped_.*_(log|wood)$/,
    /^minecraft:.*_stem$/,
    /^minecraft:.*_hyphae$/,
    /^minecraft:.*_slab$/,
    /^minecraft:.*_stairs$/,
    /^minecraft:.*_wall$/,
    /^minecraft:.*_fence$/,
    /^minecraft:.*_fence_gate$/,
    /^minecraft:.*_door$/,
    /^minecraft:.*_trapdoor$/,
    /^minecraft:.*_button$/,
    /^minecraft:.*_pressure_plate$/,
    /^minecraft:.*_sign$/,
    /^minecraft:.*_hanging_sign$/,
    /^minecraft:.*_carpet$/,
    /^minecraft:.*_wool$/,
    /^minecraft:.*_concrete$/,
    /^minecraft:.*_concrete_powder$/,
    /^minecraft:.*_terracotta$/,
    /^minecraft:.*_glazed_terracotta$/,
    /^minecraft:.*_glass_pane$/,
    /^minecraft:.*_glass$/,
    /^minecraft:.*_leaves$/,
    /^minecraft:.*_sapling$/,
    /^minecraft:.*_bricks$/,
    /^minecraft:.*_tiles$/,
    /^minecraft:.*_sandstone$/,
    /^minecraft:.*_stone$/,
    /^minecraft:.*_cobblestone$/,
    /^minecraft:.*_deepslate$/,
    /^minecraft:.*_basalt$/,
    /^minecraft:.*_blackstone$/,
    /^minecraft:.*_prismarine$/,
    /^minecraft:.*_purpur$/,
    /^minecraft:.*_quartz$/,
    /^minecraft:.*_mud$/,
    /^minecraft:.*_granite$/,
    /^minecraft:.*_diorite$/,
    /^minecraft:.*_andesite$/
];

const VANILLA_COMMON_ITEM_PATTERNS = [
    /^minecraft:.*_planks$/,
    /^minecraft:.*_log$/,
    /^minecraft:.*_wood$/,
    /^minecraft:.*_slab$/,
    /^minecraft:.*_stairs$/,
    /^minecraft:.*_fence$/,
    /^minecraft:.*_door$/,
    /^minecraft:.*_trapdoor$/,
    /^minecraft:.*_button$/,
    /^minecraft:.*_pressure_plate$/,
    /^minecraft:.*_carpet$/,
    /^minecraft:.*_wool$/,
    /^minecraft:.*_dye$/,
    /^minecraft:.*_seeds$/,
    /^minecraft:.*_sapling$/
];

function normalizeId(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

function isCommonConstructionBlock(id) {
    if (!id.startsWith("minecraft:")) return false;
    if (VANILLA_COMMON_BLOCKS.has(id)) return true;
    return VANILLA_COMMON_BLOCK_PATTERNS.some(pattern => pattern.test(id));
}

function resolveVanillaBlockRarity(id) {
    if (!id.startsWith("minecraft:")) return null;
    if (VANILLA_TRANSCENDENT_BLOCKS.has(id)) return "transcendent";
    if (VANILLA_MYTHIC_BLOCKS.has(id)) return "mythic";
    if (VANILLA_LEGENDARY_BLOCKS.has(id)) return "legendary";
    if (VANILLA_EPIC_BLOCKS.has(id)) return "epic";
    if (VANILLA_RARE_BLOCKS.has(id)) return "rare";
    if (VANILLA_UNCOMMON_BLOCKS.has(id)) return "uncommon";
    if (/_shulker_box$/.test(id)) return "rare";
    if (/_ore$/.test(id) || /:deepslate_.*_ore$/.test(id)) return "uncommon";
    if (/^minecraft:raw_.*_block$/.test(id)) return "uncommon";
    if (isCommonConstructionBlock(id)) return "common";
    return null;
}

function resolveVanillaItemRarity(id) {
    if (!id.startsWith("minecraft:")) return null;
    if (VANILLA_TRANSCENDENT_ITEMS.has(id)) return "transcendent";
    if (VANILLA_MYTHIC_ITEMS.has(id)) return "mythic";
    if (VANILLA_LEGENDARY_ITEMS.has(id)) return "legendary";
    if (VANILLA_EPIC_ITEMS.has(id)) return "epic";
    if (VANILLA_RARE_ITEMS.has(id)) return "rare";
    if (VANILLA_UNCOMMON_ITEMS.has(id)) return "uncommon";
    if (VANILLA_COMMON_ITEMS.has(id)) return "common";

    if (/_smithing_template$/.test(id)) return "legendary";
    if (/^minecraft:netherite_/.test(id)) return "legendary";
    if (/_spawn_egg$/.test(id)) return "rare";
    if (/_ingot$/.test(id)) return "uncommon";
    if (/_nugget$/.test(id)) return "common";
    if (/^minecraft:(diamond|netherite)_/.test(id)) return "rare";
    if (/^minecraft:(raw_|deepslate_).*_/.test(id)) return "uncommon";
    if (VANILLA_COMMON_ITEM_PATTERNS.some(pattern => pattern.test(id))) return "common";

    return null;
}

function resolveTieredGeneratorRarity(id) {
    const match = /^utilitycraft:(basic|advanced|expert|ultimate|absolute)_([a-z0-9_]+)$/.exec(id);
    if (!match) return null;

    const tier = match[1];
    const suffix = match[2];
    if (!TIERED_GENERATOR_SUFFIXES.has(suffix)) return null;

    return GENERATOR_TIER_TO_RARITY[tier] ?? null;
}

function addEntriesToMap(target, entries, rarity) {
    for (const id of entries) {
        target[id] = rarity;
    }
}

function buildClonerBlockRarityMap() {
    const map = {};
    addEntriesToMap(map, VANILLA_COMMON_BLOCKS, "common");
    addEntriesToMap(map, VANILLA_UNCOMMON_BLOCKS, "uncommon");
    addEntriesToMap(map, VANILLA_RARE_BLOCKS, "rare");
    addEntriesToMap(map, VANILLA_EPIC_BLOCKS, "epic");
    addEntriesToMap(map, VANILLA_LEGENDARY_BLOCKS, "legendary");
    addEntriesToMap(map, VANILLA_MYTHIC_BLOCKS, "mythic");
    addEntriesToMap(map, VANILLA_TRANSCENDENT_BLOCKS, "transcendent");
    Object.assign(map, ASCENDANT_BLOCK_RARITIES);
    return map;
}

export const CLONER_BLOCK_RARITY_MAP = Object.freeze(buildClonerBlockRarityMap());

export const CLONER_ITEM_RARITY_MAP = Object.freeze({
    // Ascendant items
    ...ASCENDANT_ITEM_RARITIES,
    // Vanilla items
    ...Object.fromEntries([...VANILLA_COMMON_ITEMS].map(id => [id, "common"])),
    ...Object.fromEntries([...VANILLA_UNCOMMON_ITEMS].map(id => [id, "uncommon"])),
    ...Object.fromEntries([...VANILLA_RARE_ITEMS].map(id => [id, "rare"])),
    ...Object.fromEntries([...VANILLA_EPIC_ITEMS].map(id => [id, "epic"])),
    ...Object.fromEntries([...VANILLA_LEGENDARY_ITEMS].map(id => [id, "legendary"])),
    ...Object.fromEntries([...VANILLA_MYTHIC_ITEMS].map(id => [id, "mythic"])),
    ...Object.fromEntries([...VANILLA_TRANSCENDENT_ITEMS].map(id => [id, "transcendent"]))
});

export const CLONER_RARITIES = Object.freeze([
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic",
    "transcendent"
]);

export function getClonerItemProfile(id) {
    const normalized = normalizeId(id);
    if (!normalized) {
        return {
            rarity: "common",
            declared: false,
            source: "fallback"
        };
    }

    const ascendantBlockRarity = ASCENDANT_BLOCK_RARITIES[normalized];
    if (ascendantBlockRarity) {
        return {
            rarity: ascendantBlockRarity,
            declared: true,
            source: "ascendant_block"
        };
    }

    const ascendantItemRarity = ASCENDANT_ITEM_RARITIES[normalized];
    if (ascendantItemRarity) {
        return {
            rarity: ascendantItemRarity,
            declared: true,
            source: "ascendant_item"
        };
    }

    const tieredGeneratorRarity = resolveTieredGeneratorRarity(normalized);
    if (tieredGeneratorRarity) {
        return {
            rarity: tieredGeneratorRarity,
            declared: true,
            source: "ascendant_generator_tier"
        };
    }

    const vanillaBlockRarity = resolveVanillaBlockRarity(normalized);
    if (vanillaBlockRarity) {
        return {
            rarity: vanillaBlockRarity,
            declared: true,
            source: "vanilla_block"
        };
    }

    const vanillaItemRarity = resolveVanillaItemRarity(normalized);
    if (vanillaItemRarity) {
        return {
            rarity: vanillaItemRarity,
            declared: true,
            source: "vanilla_item"
        };
    }

    return {
        rarity: "common",
        declared: false,
        source: "fallback"
    };
}

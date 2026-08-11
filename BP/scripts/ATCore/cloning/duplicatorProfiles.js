// @ts-check

// Classification data migrated from legacy. Runtime lookup is cached in duplicatorRegistry.js.
const CLONER_RARITY_DATA = ({
    ascendant: ({
        blocks: ({
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
        }),
        items: ({
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
            "utilitycraft:pure_enderling_tear": "transcendent"
        })
    }),
    generators: ({
        tierToRarity: ({
            basic: "common",
            advanced: "uncommon",
            expert: "rare",
            ultimate: "epic",
            absolute: "legendary"
        }),
        tieredSuffixes: new Set([
            "battery",
            "solar_panel",
            "wind_turbine",
            "thermo_generator",
            "magmator",
            "furnator",
            "generator"
        ])
    }),
    vanilla: ({
        blocks: ({
            transcendent: new Set([
                "minecraft:barrier",
                "minecraft:bedrock",
                "minecraft:command_block",
                "minecraft:structure_block",
                "minecraft:jigsaw"
            ]),
            mythic: new Set([
                "minecraft:chain_command_block",
                "minecraft:dragon_egg",
                "minecraft:end_portal_frame",
                "minecraft:reinforced_deepslate",
                "minecraft:repeating_command_block",
                "minecraft:spawner"
            ]),
            legendary: new Set([
                "minecraft:ancient_debris",
                "minecraft:beacon",
                "minecraft:conduit",
                "minecraft:end_gateway",
                "minecraft:lodestone",
                "minecraft:netherite_block",
                "minecraft:respawn_anchor"
            ]),
            epic: new Set([
                "minecraft:diamond_block",
                "minecraft:diamond_ore",
                "minecraft:deepslate_diamond_ore",
                "minecraft:deepslate_emerald_ore",
                "minecraft:emerald_block",
                "minecraft:emerald_ore",
                "minecraft:enchanting_table",
                "minecraft:ender_chest"
            ]),
            rare: new Set([
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
            ]),
            uncommon: new Set([
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
            ]),
            common: new Set([
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
            ])
        }),
        items: ({
            transcendent: new Set([
                "minecraft:command_block",
                "minecraft:structure_block",
                "minecraft:jigsaw",
                "minecraft:barrier",
                "minecraft:bedrock"
            ]),
            mythic: new Set([
                "minecraft:dragon_egg",
                "minecraft:nether_star"
            ]),
            legendary: new Set([
                "minecraft:elytra",
                "minecraft:enchanted_golden_apple",
                "minecraft:totem_of_undying",
                "minecraft:netherite_upgrade_smithing_template",
                "minecraft:silence_armor_trim_smithing_template",
                "minecraft:ward_armor_trim_smithing_template",
                "minecraft:spire_armor_trim_smithing_template"
            ]),
            epic: new Set([
                "minecraft:wither_skeleton_skull",
                "minecraft:ancient_debris",
                "minecraft:blaze_rod",
                "minecraft:echo_shard",
                "minecraft:shulker_shell",
                "minecraft:trident",
                "minecraft:netherite_scrap",
                "minecraft:prismarine_shard",
                "minecraft:prismarine_crystals"
            ]),
            rare: new Set([
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
            ]),
            uncommon: new Set([
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
            ]),
            common: new Set([
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
            ])
        }),
        patterns: ({
            commonBlocks: ([
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
            ]),
            commonItems: ([
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
            ])
        })
    }),
    rarities: ([
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary",
        "mythic",
        "transcendent"
    ])
});

function normalizeId(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

function isCommonConstructionBlock(id) {
    if (!id.startsWith("minecraft:")) return false;
    if (CLONER_RARITY_DATA.vanilla.blocks.common.has(id)) return true;
    return CLONER_RARITY_DATA.vanilla.patterns.commonBlocks.some(pattern => pattern.test(id));
}

function resolveVanillaBlockRarity(id) {
    if (!id.startsWith("minecraft:")) return null;
    if (CLONER_RARITY_DATA.vanilla.blocks.transcendent.has(id)) return "transcendent";
    if (CLONER_RARITY_DATA.vanilla.blocks.mythic.has(id)) return "mythic";
    if (CLONER_RARITY_DATA.vanilla.blocks.legendary.has(id)) return "legendary";
    if (CLONER_RARITY_DATA.vanilla.blocks.epic.has(id)) return "epic";
    if (CLONER_RARITY_DATA.vanilla.blocks.rare.has(id)) return "rare";
    if (CLONER_RARITY_DATA.vanilla.blocks.uncommon.has(id)) return "uncommon";
    if (/_shulker_box$/.test(id)) return "rare";
    if (/_ore$/.test(id) || /:deepslate_.*_ore$/.test(id)) return "uncommon";
    if (/^minecraft:raw_.*_block$/.test(id)) return "uncommon";
    if (isCommonConstructionBlock(id)) return "common";
    return null;
}

function resolveVanillaItemRarity(id) {
    if (!id.startsWith("minecraft:")) return null;
    if (CLONER_RARITY_DATA.vanilla.items.transcendent.has(id)) return "transcendent";
    if (CLONER_RARITY_DATA.vanilla.items.mythic.has(id)) return "mythic";
    if (CLONER_RARITY_DATA.vanilla.items.legendary.has(id)) return "legendary";
    if (CLONER_RARITY_DATA.vanilla.items.epic.has(id)) return "epic";
    if (CLONER_RARITY_DATA.vanilla.items.rare.has(id)) return "rare";
    if (CLONER_RARITY_DATA.vanilla.items.uncommon.has(id)) return "uncommon";
    if (CLONER_RARITY_DATA.vanilla.items.common.has(id)) return "common";

    if (/_smithing_template$/.test(id)) return "legendary";
    if (/^minecraft:netherite_/.test(id)) return "legendary";
    if (/_spawn_egg$/.test(id)) return "rare";
    if (/_ingot$/.test(id)) return "uncommon";
    if (/_nugget$/.test(id)) return "common";
    if (/^minecraft:(diamond|netherite)_/.test(id)) return "rare";
    if (/^minecraft:(raw_|deepslate_).*_/.test(id)) return "uncommon";
    if (CLONER_RARITY_DATA.vanilla.patterns.commonItems.some(pattern => pattern.test(id))) return "common";

    return null;
}

function resolveTieredGeneratorRarity(id) {
    const match = /^utilitycraft:(basic|advanced|expert|ultimate|absolute)_([a-z0-9_]+)$/.exec(id);
    if (!match) return null;

    const tier = match[1];
    const suffix = match[2];
    if (!CLONER_RARITY_DATA.generators.tieredSuffixes.has(suffix)) return null;

    return CLONER_RARITY_DATA.generators.tierToRarity[tier] ?? null;
}

export function getClonerItemProfile(id) {
    const normalized = normalizeId(id);
    if (!normalized) {
        return {
            rarity: "uncommon",
            declared: false,
            source: "fallback"
        };
    }

    const ascendantBlockRarity = CLONER_RARITY_DATA.ascendant.blocks[normalized];
    if (ascendantBlockRarity) {
        return {
            rarity: ascendantBlockRarity,
            declared: true,
            source: "ascendant_block"
        };
    }

    const ascendantItemRarity = CLONER_RARITY_DATA.ascendant.items[normalized];
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
        rarity: "uncommon",
        declared: false,
        source: "fallback"
    };
}


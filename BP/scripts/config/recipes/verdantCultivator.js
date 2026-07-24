// @ts-check

import { registerVerdantCrops } from "../../ATCore/agriculture/index.js";

const utilityProduce = {
    "utilitycraft:coal_seeds": ["minecraft:coal"],
    "utilitycraft:copper_seeds": ["minecraft:raw_copper"],
    "utilitycraft:dyes_seeds": ["minecraft:dye"],
    "utilitycraft:glass_seeds": ["minecraft:glass"],
    "utilitycraft:gunpowder_seeds": ["minecraft:gunpowder"],
    "utilitycraft:iron_seeds": ["minecraft:raw_iron"],
    "utilitycraft:leather_seeds": ["minecraft:leather"],
    "utilitycraft:prismarine_crystals_seeds": ["minecraft:prismarine_crystals"],
    "utilitycraft:prismarine_shards_seeds": ["minecraft:prismarine_shard"],
    "utilitycraft:water_seeds": ["utilitycraft:water_ball"],
    "utilitycraft:wool_seeds": ["minecraft:wool"],
    "utilitycraft:ghast_seeds": ["minecraft:ghast_tear"],
    "utilitycraft:glowstone_seeds": ["minecraft:glowstone_dust"],
    "utilitycraft:gold_seeds": ["minecraft:raw_gold"],
    "utilitycraft:honey_seeds": ["utilitycraft:honey_ball"],
    "utilitycraft:lapis_seeds": ["minecraft:lapis_lazuli"],
    "utilitycraft:lava_seeds": ["utilitycraft:lava_ball"],
    "utilitycraft:quartz_seeds": ["minecraft:quartz"],
    "utilitycraft:redstone_seeds": ["minecraft:redstone"],
    "utilitycraft:resin_seeds": ["minecraft:resin_clump"],
    "utilitycraft:slime_seeds": ["minecraft:slime_ball"],
    "utilitycraft:amethyst_seeds": ["minecraft:amethyst_shard"],
    "utilitycraft:blaze_seeds": ["minecraft:blaze_rod"],
    "utilitycraft:diamond_seeds": ["utilitycraft:diamond_shard"],
    "utilitycraft:emerald_seeds": ["utilitycraft:emerald_shard"],
    "utilitycraft:enderpearl_seeds": ["minecraft:ender_pearl"],
    "utilitycraft:obsidian_seeds": ["minecraft:obsidian"],
    "utilitycraft:netherite_seeds": ["utilitycraft:netherite_nugget"],
    "utilitycraft:nether_star_seeds": ["utilitycraft:nether_star_fragment"],
    "utilitycraft:shulker_seeds": ["utilitycraft:shulker_shell_shard"],
    "utilitycraft:totem_seeds": ["utilitycraft:totem_shard"],
    "utilitycraft:wither_seeds": ["utilitycraft:wither_skull_shard"],
};

const utilityTiers = {
    1: {
        soil: "utilitycraft:yellow_soil",
        seeds: [
            "coal", "copper", "dyes", "glass", "gunpowder", "iron", "leather",
            "prismarine_crystals", "prismarine_shards", "water", "wool",
        ],
    },
    2: {
        soil: "utilitycraft:red_soil",
        seeds: [
            "ghast", "glowstone", "gold", "honey", "lapis", "lava", "quartz",
            "redstone", "resin", "slime",
        ],
    },
    3: {
        soil: "utilitycraft:blue_soil",
        seeds: ["amethyst", "blaze", "diamond", "emerald", "enderpearl", "obsidian"],
    },
    4: {
        soil: "utilitycraft:black_soil",
        seeds: ["nether_star", "netherite", "shulker", "totem", "wither"],
    },
};

const cropNameOverrides = {
    prismarine_crystals: "prismarine_crystal_crop",
    nether_star: "netherstar_crop",
};

const biomeProfiles = {
    water: { tokens: ["ocean", "river", "beach"], title: "Tidal Surge" },
    prismarine_crystals: { tokens: ["ocean", "river", "beach"], title: "Tidal Surge" },
    prismarine_shards: { tokens: ["ocean", "river", "beach"], title: "Tidal Surge" },
    slime: { tokens: ["swamp", "mangrove"], title: "Bog Bloom" },
    resin: { tokens: ["swamp", "mangrove"], title: "Bog Bloom" },
    honey: { tokens: ["flower", "meadow", "sunflower"], title: "Flower Burst" },
    ghast: { tokens: ["nether"], title: "Nether Resonance" },
    glowstone: { tokens: ["nether"], title: "Nether Resonance" },
    quartz: { tokens: ["nether"], title: "Nether Resonance" },
    blaze: { tokens: ["nether"], title: "Nether Resonance" },
    netherite: { tokens: ["nether"], title: "Nether Resonance" },
    nether_star: { tokens: ["nether"], title: "Nether Resonance" },
    wither: { tokens: ["nether"], title: "Nether Resonance" },
};

export const verdantCropDefinitions = {
    "minecraft:wheat_seeds": {
        cropBlockId: "minecraft:wheat",
        ageState: "growth",
        maxAge: 7,
        validSoils: ["minecraft:farmland"],
        bonusExclusions: ["minecraft:wheat_seeds"],
        biomeTokens: ["plains", "meadow", "sunflower"],
        biomeTitle: "Plains Bloom",
        pickupItemIds: ["minecraft:wheat_seeds", "minecraft:wheat"],
    },
    "minecraft:carrot": {
        cropBlockId: "minecraft:carrots",
        ageState: "growth",
        maxAge: 7,
        validSoils: ["minecraft:farmland"],
        biomeTokens: ["plains", "meadow", "sunflower"],
        biomeTitle: "Plains Bloom",
        pickupItemIds: ["minecraft:carrot"],
    },
    "minecraft:potato": {
        cropBlockId: "minecraft:potatoes",
        ageState: "growth",
        maxAge: 7,
        validSoils: ["minecraft:farmland"],
        biomeTokens: ["plains", "meadow", "sunflower"],
        biomeTitle: "Plains Bloom",
        pickupItemIds: ["minecraft:potato"],
    },
    "minecraft:beetroot_seeds": {
        cropBlockId: "minecraft:beetroot",
        ageState: "growth",
        maxAge: 7,
        validSoils: ["minecraft:farmland"],
        bonusExclusions: ["minecraft:beetroot_seeds"],
        biomeTokens: ["plains", "meadow", "sunflower"],
        biomeTitle: "Plains Bloom",
        pickupItemIds: ["minecraft:beetroot_seeds", "minecraft:beetroot"],
    },
    "minecraft:nether_wart": {
        cropBlockId: "minecraft:nether_wart",
        ageState: "age",
        maxAge: 3,
        validSoils: ["minecraft:soul_sand"],
        biomeTokens: ["nether"],
        biomeTitle: "Nether Resonance",
        pickupItemIds: ["minecraft:nether_wart"],
    },
};

for (const tier of Object.values(utilityTiers)) {
    for (const rawName of tier.seeds) {
        const seedItemId = `utilitycraft:${rawName}_seeds`;
        const biome = biomeProfiles[rawName];
        verdantCropDefinitions[seedItemId] = {
            cropBlockId: `utilitycraft:${cropNameOverrides[rawName] ?? `${rawName}_crop`}`,
            ageState: "utilitycraft:age",
            maxAge: 5,
            validSoils: [tier.soil],
            bonusExclusions: [seedItemId],
            biomeTokens: biome?.tokens ?? [],
            biomeTitle: biome?.title ?? null,
            pickupItemIds: [seedItemId, ...(utilityProduce[seedItemId] ?? [])],
        };
    }
}

registerVerdantCrops(verdantCropDefinitions);

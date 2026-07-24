// @ts-check

import { registerAbyssalLootDefinitions } from "../../ATCore/fishing/index.js";

export const abyssalFisherConfig = {
    fishingCategories: {
        defaultCategory: "junk",
        baseWeights: { fish: 0.85, junk: 0.10, treasure: 0.05 },
        luckOfTheSea: {
            luckPerLevel: 10,
            maxEquivalentLevel: 3,
            fishDeltaPerLevel: -0.0015,
            junkDeltaPerLevel: -0.0195,
            treasureDeltaPerLevel: 0.021,
        },
    },
    luck: {
        default: 0,
        enchantChancePerLuck: 0.015,
        enchantCountPerLuck: 0.05,
        enchantQualityPerLuck: 0.025,
    },
    bookEnchant: {
        baseChance: 0.2,
        chancePerTier: 0.025,
        chancePerLuck: 0.018,
        maxChance: 0.92,
        guaranteedLuckThreshold: 24,
        guaranteedTierThreshold: 7,
        minCount: 1,
        maxCount: 3,
        countPerLuck: 0.08,
        minQuality: 0.18,
        qualityPerLuck: 0.03,
    },
    equipment: {
        durabilityDamageRange: [0.6, 0.95],
        enchantChance: 0.12,
        chancePerTier: 0.015,
        chancePerLuck: 0.05,
        maxChance: 1,
        guaranteedLuckThreshold: 30,
        enchantCount: [1, 2],
        countPerLuck: 0.04,
        minQuality: 0.12,
        qualityPerLuck: 0.05,
    },
};

export const abyssalFisherLootDefinitions = [
    { item: "minecraft:cod", amount: [1, 3], chance: 0.45, tier: 0, category: "fish" },
    { item: "minecraft:salmon", amount: [1, 2], chance: 0.25, tier: 0, category: "fish" },
    { item: "minecraft:tropical_fish", amount: 1, chance: 0.10, tier: 1, category: "fish" },
    { item: "minecraft:pufferfish", amount: 1, chance: 0.08, tier: 1, category: "fish" },
    { item: "minecraft:string", amount: [1, 4], chance: 0.12, tier: 0, category: "junk" },
    { item: "minecraft:bone", amount: [1, 3], chance: 0.10, tier: 0, category: "junk" },
    { item: "minecraft:waterlily", amount: 1, chance: 0.08, tier: 0, category: "junk" },
    { item: "minecraft:ink_sac", amount: [1, 3], chance: 0.06, tier: 1, category: "junk" },
    { item: "minecraft:glow_ink_sac", amount: [1, 2], chance: 0.05, tier: 2, category: "junk" },
    { item: "minecraft:prismarine_shard", amount: [1, 3], chance: 0.04, tier: 2, category: "treasure" },
    { item: "minecraft:prismarine_crystals", amount: [1, 3], chance: 0.03, tier: 2, category: "treasure" },
    { item: "minecraft:nautilus_shell", amount: 1, chance: 0.025, tier: 3, category: "treasure" },
    { item: "minecraft:experience_bottle", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:name_tag", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:saddle", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:emerald", amount: [1, 2], chance: 0.015, tier: 5, category: "treasure" },
    { item: "minecraft:potion", amount: 1, chance: 0.005, tier: 2, category: "junk" },
    { item: "minecraft:book", amount: 1, chance: 0.005, tier: 4, category: "treasure" },
    {
        item: "minecraft:fishing_rod",
        amount: 1,
        chance: 0.004,
        tier: 2,
        category: "treasure",
        durabilityDamageRange: abyssalFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abyssalFisherConfig.equipment.enchantChance,
            count: abyssalFisherConfig.equipment.enchantCount,
        },
    },
    {
        item: "minecraft:bow",
        amount: 1,
        chance: 0.0008,
        tier: 3,
        category: "treasure",
        durabilityDamageRange: abyssalFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abyssalFisherConfig.equipment.enchantChance,
            count: abyssalFisherConfig.equipment.enchantCount,
        },
    },
    { item: "minecraft:trident", amount: 1, chance: 0.0005, tier: 6, category: "treasure" },
    { item: "minecraft:heart_of_the_sea", amount: 1, chance: 0.001, tier: 6, category: "treasure" },
    { item: "minecraft:stick", amount: [0, 2], chance: 0.10, tier: 0, category: "junk" },
    {
        item: "minecraft:leather_boots",
        amount: 1,
        chance: 0.0008,
        tier: 2,
        category: "junk",
        durabilityDamageRange: abyssalFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abyssalFisherConfig.equipment.enchantChance,
            count: abyssalFisherConfig.equipment.enchantCount,
        },
    },
    { item: "utilitycraft:empty_liquid_capsule", amount: 1, chance: 0.004, tier: 5, category: "treasure" },
    { item: "utilitycraft:totem_shard", amount: 1, chance: 0.0002, tier: 7, category: "treasure" },
    { item: "utilitycraft:sand_handful", amount: [1, 6], chance: 0.02, tier: 0, category: "junk" },
];

registerAbyssalLootDefinitions(abyssalFisherLootDefinitions);

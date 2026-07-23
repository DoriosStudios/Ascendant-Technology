// @ts-check

/**
 * Liquifier recipes indexed by exact solid input id.
 *
 * @type {Record<string, {
 *   required: number,
 *   liquid: string,
 *   amount: number,
 *   cost: number,
 *   ticks: number,
 *   byproduct?: { item: string, amount: number, chance: number }
 * }>}
 */
export const liquifierRecipes = {
    "utilitycraft:aetherium": {
        required: 1,
        liquid: "liquified_aetherium",
        amount: 1000,
        cost: 9600,
        ticks: 300,
        byproduct: {
            item: "minecraft:obsidian",
            amount: 1,
            chance: 0.25,
        },
    },
    "utilitycraft:aetherium_shard": {
        required: 4,
        liquid: "liquified_aetherium",
        amount: 1000,
        cost: 5400,
        ticks: 200,
    },
    "minecraft:ancient_debris": {
        required: 2,
        liquid: "dark_matter",
        amount: 1000,
        cost: 12800,
        ticks: 400,
        byproduct: {
            item: "minecraft:netherrack",
            amount: 2,
            chance: 0.35,
        },
    },
    "utilitycraft:void_essence": {
        required: 3,
        liquid: "dark_matter",
        amount: 750,
        cost: 6400,
        ticks: 180,
        byproduct: {
            item: "minecraft:ender_pearl",
            amount: 1,
            chance: 0.2,
        },
    },
    "minecraft:obsidian": {
        required: 2,
        liquid: "dark_matter",
        amount: 500,
        cost: 5200,
        ticks: 160,
        byproduct: {
            item: "minecraft:crying_obsidian",
            amount: 1,
            chance: 0.1,
        },
    },
    "utilitycraft:stabilized_obsidian_dust": {
        required: 4,
        liquid: "dark_matter",
        amount: 1000,
        cost: 7600,
        ticks: 240,
        byproduct: {
            item: "minecraft:obsidian",
            amount: 1,
            chance: 0.35,
        },
    },
    "utilitycraft:compressed_obsidian": {
        required: 1,
        liquid: "dark_matter",
        amount: 9000,
        cost: 64000,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_2": {
        required: 1,
        liquid: "dark_matter",
        amount: 72000,
        cost: 560000,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_3": {
        required: 1,
        liquid: "dark_matter",
        amount: 576000,
        cost: 5000000,
        ticks: 120,
    },
};

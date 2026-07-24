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
        cost: 1600,
        ticks: 300,
    },
    "utilitycraft:aetherium_shard": {
        required: 4,
        liquid: "liquified_aetherium",
        amount: 1000,
        cost: 1600,
        ticks: 200,
    },
    "utilitycraft:void_essence": {
        required: 2,
        liquid: "dark_matter",
        amount: 1000,
        cost: 3200,
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
        amount: 250,
        cost: 1600,
        ticks: 160,
    },
    "utilitycraft:stabilized_obsidian_dust": {
        required: 4,
        liquid: "dark_matter",
        amount: 1000,
        cost: 1600,
        ticks: 240,
    },
    "utilitycraft:compressed_obsidian": {
        required: 1,
        liquid: "dark_matter",
        amount: 9000,
        cost: 21600,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_2": {
        required: 1,
        liquid: "dark_matter",
        amount: 72000,
        cost: 194000,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_3": {
        required: 1,
        liquid: "dark_matter",
        amount: 576000,
        cost: 1555200,
        ticks: 120,
    },
};

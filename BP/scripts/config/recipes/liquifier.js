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
        amount: 250,
        cost: 3200,
        ticks: 300,
    },
    "utilitycraft:aetherium_shard": {
        required: 4,
        liquid: "liquified_aetherium",
        amount: 25,
        cost: 3200,
        ticks: 200,
    },
    "utilitycraft:aetherium_dust": {
        required: 1,
        liquid: "liquified_aetherium",
        amount: 50,
        cost: 3200,
        ticks: 300,
    },
    "utilitycraft:void_essence": {
        required: 1,
        liquid: "dark_matter",
        amount: 500,
        cost: 1600,
        ticks: 180,
        byproduct: {
            item: "minecraft:ender_pearl",
            amount: 1,
            chance: 0.2,
        },
    },
    "minecraft:obsidian": {
        required: 4,
        liquid: "dark_matter",
        amount: 250,
        cost: 800,
        ticks: 160,
    },
    "utilitycraft:stabilized_obsidian_dust": {
        required: 4,
        liquid: "dark_matter",
        amount: 250,
        cost: 800,
        ticks: 240,
    },
    "utilitycraft:compressed_obsidian": {
        required: 1,
        liquid: "dark_matter",
        amount: 2250,
        cost: 21600,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_2": {
        required: 1,
        liquid: "dark_matter",
        amount: 20250,
        cost: 194000,
        ticks: 120,
    },
    "utilitycraft:compressed_obsidian_3": {
        required: 1,
        liquid: "dark_matter",
        amount: 182250,
        cost: 1555200,
        ticks: 120,
    },
};

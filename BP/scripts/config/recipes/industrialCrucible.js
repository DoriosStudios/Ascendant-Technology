// @ts-check

/**
 * Industrial Crucible recipes indexed by exact input item id.
 *
 * @type {Record<string, {
 *   input: { amount: number },
 *   output: { id: string | null, amount: number },
 *   energyCost: number,
 *   lavaGain: number
 * }>}
 */
export const industrialCrucibleRecipes = {
    "minecraft:cobblestone": {
        input: { amount: 1 },
        output: { id: "minecraft:stone", amount: 1 },
        energyCost: 1600,
        lavaGain: 250,
    },
    "minecraft:stone": {
        input: { amount: 1 },
        output: { id: "minecraft:smooth_stone", amount: 1 },
        energyCost: 1600,
        lavaGain: 250,
    },
    "minecraft:netherrack": {
        input: { amount: 1 },
        output: { id: "minecraft:nether_brick", amount: 1 },
        energyCost: 1600,
        lavaGain: 1000,
    },
    "minecraft:blackstone": {
        input: { amount: 1 },
        output: { id: "minecraft:polished_blackstone", amount: 1 },
        energyCost: 1600,
        lavaGain: 500,
    },
    "minecraft:basalt": {
        input: { amount: 1 },
        output: { id: "minecraft:polished_basalt", amount: 1 },
        energyCost: 1600,
        lavaGain: 500,
    },
    "minecraft:granite": {
        input: { amount: 1 },
        output: { id: "minecraft:polished_granite", amount: 1 },
        energyCost: 1600,
        lavaGain: 250,
    },
    "minecraft:diorite": {
        input: { amount: 1 },
        output: { id: "minecraft:polished_diorite", amount: 1 },
        energyCost: 1600,
        lavaGain: 250,
    },
    "minecraft:andesite": {
        input: { amount: 1 },
        output: { id: "minecraft:polished_andesite", amount: 1 },
        energyCost: 1600,
        lavaGain: 250,
    },
    "minecraft:magma": {
        input: { amount: 1 },
        output: { id: "minecraft:magma_cream", amount: 1 },
        energyCost: 1600,
        lavaGain: 1000,
    },
    "minecraft:magma_cream": {
        input: { amount: 1 },
        output: { id: "utilitycraft:crushed_kelp", amount: 1 },
        energyCost: 1600,
        lavaGain: 1000,
    },
};

/**
 * Resolves a recipe in O(1) by its exact input item identifier.
 *
 * @param {string} inputTypeId
 */
export function getIndustrialCrucibleRecipe(inputTypeId) {
    return industrialCrucibleRecipes[inputTypeId];
}

// @ts-check

/**
 * Magmatic Reactor Chamber recipes indexed by exact input item id.
 *
 * @type {Record<string, {
 *   input: { amount: number },
 *   output: { id: string, amount: number },
 *   energyCost: number,
 *   lavaGain: number
 * }>}
 */
export const magmaticReactorChamberRecipes = {
    "minecraft:cobblestone": {
        input: { amount: 1 },
        output: { id: "minecraft:stone", amount: 1 },
        energyCost: 4000,
        lavaGain: 400,
    },
    "minecraft:sand": {
        input: { amount: 1 },
        output: { id: "minecraft:glass", amount: 1 },
        energyCost: 4800,
        lavaGain: 500,
    },
    "minecraft:clay_ball": {
        input: { amount: 4 },
        output: { id: "minecraft:brick", amount: 4 },
        energyCost: 5200,
        lavaGain: 650,
    },
};

/**
 * Resolves a recipe in O(1) by its exact input item identifier.
 *
 * @param {string} inputTypeId
 */
export function getMagmaticReactorChamberRecipe(inputTypeId) {
    return magmaticReactorChamberRecipes[inputTypeId];
}

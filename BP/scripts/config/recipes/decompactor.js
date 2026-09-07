// @ts-check

import { getCompactorRecipes } from "./compactor.js";

/**
 * The Decompactor is intentionally derived from the Compactor's final recipe
 * registry. It cannot become a general reverse-crafting machine by accident.
 *
 * @typedef {{
 *   input: string,
 *   output: string,
 *   required: number,
 *   amount: number,
 *   cost: number,
 *   ticks: number,
 *   level: number,
 *   compacted: string,
 * }} DecompactorRecipe
 */

/** @type {Map<string, DecompactorRecipe[]>} */
const recipesByInput = new Map();

for (const compacting of getCompactorRecipes()) {
    const recipe = Object.freeze({
        input: compacting.output,
        output: compacting.input,
        required: compacting.amount,
        amount: compacting.required,
        cost: compacting.cost,
        ticks: compacting.ticks,
        level: compacting.level,
        compacted: compacting.output,
    });
    const recipes = recipesByInput.get(recipe.input) ?? [];
    if (!recipes.some((entry) => sameReverseRecipe(entry, recipe))) recipes.push(recipe);
    recipesByInput.set(recipe.input, recipes);
}

/**
 * Returns a recipe only when the compacted input has exactly one registered
 * predecessor. Future branch conflicts fail closed instead of guessing.
 *
 * @param {string} inputTypeId
 */
export function getDecompactorRecipe(inputTypeId) {
    const candidates = recipesByInput.get(inputTypeId);
    if (candidates?.length !== 1) return undefined;
    return candidates[0];
}

/** @param {string} inputTypeId */
export function getDecompactorRecipeCandidates(inputTypeId) {
    return Object.freeze([...(recipesByInput.get(inputTypeId) ?? [])]);
}

export function getDecompactorRecipeCount() {
    let count = 0;
    for (const recipes of recipesByInput.values()) count += recipes.length;
    return count;
}

export function getDecompactorConflictCount() {
    let count = 0;
    for (const recipes of recipesByInput.values()) {
        if (recipes.length > 1) count++;
    }
    return count;
}

/**
 * @param {DecompactorRecipe} left
 * @param {DecompactorRecipe} right
 */
function sameReverseRecipe(left, right) {
    return left.output === right.output
        && left.required === right.required
        && left.amount === right.amount;
}

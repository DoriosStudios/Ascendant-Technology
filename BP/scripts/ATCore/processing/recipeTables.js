// @ts-check

import { ItemStack, system } from "@minecraft/server";

/** @typedef {{output:string, required:number, amount:number, cost?:number, [key:string]:unknown}} CompiledRecipe */

/** Exact input item id -> compiled recipe. Hot lookups never scan a recipe array. */
export const crusherRecipes = Object.create(null);
/** @type {Record<string, CompiledRecipe>} */
export const furnaceRecipes = Object.create(null);
/** @type {Record<string, CompiledRecipe>} */
export const pressRecipes = Object.create(null);

const TABLES_BY_EVENT = Object.freeze(Object.assign(Object.create(null), {
    "utilitycraft:register_crusher_recipe": crusherRecipes,
    "utilitycraft:register_furnace_recipe": furnaceRecipes,
    "utilitycraft:register_press_recipe": pressRecipes,
}));

function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.max(1, Math.floor(number)) : fallback;
}

/**
 * Validates and compiles registrations once, outside every machine hot path.
 * Unknown recipe metadata is preserved for machine-specific behavior.
 */
function compileRecipe(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const output = typeof value.output === "string" ? value.output.trim() : "";
    if (!output) return undefined;

    const compiled = Object.assign(Object.create(null), value, {
        output,
        required: positiveInteger(value.required, 1),
        amount: positiveInteger(value.amount, 1),
    });

    try {
        compiled.outputMaxAmount = new ItemStack(output, 1).maxAmount;
    } catch {
        compiled.outputMaxAmount = 64;
    }

    const cost = Number(value.cost);
    if (Number.isFinite(cost) && cost > 0) compiled.cost = cost;
    else delete compiled.cost;

    return Object.freeze(compiled);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    const table = TABLES_BY_EVENT[id];
    if (!table) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

        for (const inputId in payload) {
            if (!Object.prototype.hasOwnProperty.call(payload, inputId) || !inputId) continue;
            const recipe = compileRecipe(payload[inputId]);
            if (recipe) table[inputId] = recipe;
        }
    } catch (error) {
        console.warn(`[AscendantTechnology] Invalid recipe registration for ${id}:`, error);
    }
});

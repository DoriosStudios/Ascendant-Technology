// @ts-check

import { system } from "@minecraft/server";

const DEFAULT_COST = 4000;
const DEFAULT_TICKS = 100;
const REGISTER_EVENT_ID = "utilitycraft:register_cryo_cooling_recipe";

/** @type {Map<string, any>} */
const recipesByInput = new Map();
/** @type {Map<string, any>} */
const recipesById = new Map();
const outputIds = new Set();

export const cryoCoolingRecipeDefinitions = {
    "utilitycraft:cool_cooked_beef": {
        input: { id: "minecraft:cooked_beef", amount: 1 },
        output: { id: "minecraft:beef", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_porkchop": {
        input: { id: "minecraft:cooked_porkchop", amount: 1 },
        output: { id: "minecraft:porkchop", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_chicken": {
        input: { id: "minecraft:cooked_chicken", amount: 1 },
        output: { id: "minecraft:chicken", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_mutton": {
        input: { id: "minecraft:cooked_mutton", amount: 1 },
        output: { id: "minecraft:mutton", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_rabbit": {
        input: { id: "minecraft:cooked_rabbit", amount: 1 },
        output: { id: "minecraft:rabbit", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_cod": {
        input: { id: "minecraft:cooked_cod", amount: 1 },
        output: { id: "minecraft:cod", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_cooked_salmon": {
        input: { id: "minecraft:cooked_salmon", amount: 1 },
        output: { id: "minecraft:salmon", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:cool_baked_potato": {
        input: { id: "minecraft:baked_potato", amount: 1 },
        output: { id: "minecraft:potato", amount: 1 },
        cost: 1600,
        ticks: 40,
    },
    "utilitycraft:quench_magma": {
        input: { id: "minecraft:magma", amount: 1 },
        output: { id: "minecraft:basalt", amount: 1 },
        fluid: { type: "water", amount: 250 },
        cost: 1600,
        ticks: 80,
    },
    "utilitycraft:cool_magma_cream": {
        input: { id: "minecraft:magma_cream", amount: 1 },
        output: { id: "minecraft:slime_ball", amount: 1 },
        fluid: { type: "water", amount: 100 },
        cost: 1600,
        ticks: 60,
    },
    "utilitycraft:snow_to_ice": {
        input: { id: "minecraft:snow", amount: 1 },
        output: { id: "minecraft:ice", amount: 1 },
        fluid: { type: "water", amount: 100 },
        cost: 4000,
        ticks: 60,
    },
    "utilitycraft:ice_to_packed_ice": {
        input: { id: "minecraft:ice", amount: 1 },
        output: { id: "minecraft:packed_ice", amount: 1 },
        cost: 8000,
        ticks: 100,
    },
    "utilitycraft:packed_ice_to_blue_ice": {
        input: { id: "minecraft:packed_ice", amount: 1 },
        output: { id: "minecraft:blue_ice", amount: 1 },
        cost: 16000,
        ticks: 300,
    },
    "utilitycraft:cool_rod": {
        input: { id: "minecraft:blaze_rod", amount: 1 },
        output: { id: "minecraft:breeze_rod", amount: 1 },
        cost: 1600,
        ticks: 100,
    }
};

for (const [id, definition] of Object.entries(cryoCoolingRecipeDefinitions)) {
    registerCryoCoolingRecipe(id, definition);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== REGISTER_EVENT_ID) return;

    let payload;
    try {
        payload = JSON.parse(message);
    } catch {
        return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

    for (const [recipeId, definition] of Object.entries(payload)) {
        registerCryoCoolingRecipe(recipeId, definition);
    }
});

export function getCryoCoolingRecipe(inputTypeId) {
    return recipesByInput.get(inputTypeId);
}

export function isCryoCoolingOutput(typeId) {
    return outputIds.has(typeId);
}

export function getCryoCoolingRecipeCount() {
    return recipesById.size;
}

export function registerCryoCoolingRecipe(id, definition) {
    const recipe = normalizeRecipe(id, definition);
    if (!recipe) return false;

    const previousById = recipesById.get(recipe.id);
    if (previousById && recipesByInput.get(previousById.input.id) === previousById) {
        recipesByInput.delete(previousById.input.id);
    }

    const previousByInput = recipesByInput.get(recipe.input.id);
    if (previousByInput && previousByInput.id !== recipe.id) {
        recipesById.delete(previousByInput.id);
    }

    recipesById.set(recipe.id, recipe);
    recipesByInput.set(recipe.input.id, recipe);
    rebuildOutputIndex();
    return true;
}

function rebuildOutputIndex() {
    outputIds.clear();
    for (const recipe of recipesById.values()) outputIds.add(recipe.output.id);
}

function normalizeRecipe(id, definition) {
    if (typeof id !== "string" || !id || !definition || typeof definition !== "object") {
        return undefined;
    }

    const input = normalizeStack(definition.input);
    const output = normalizeStack(definition.output);
    if (!input || !output) return undefined;

    /** @type {any} */
    const recipe = {
        id,
        input,
        output,
        cost: positiveInteger(definition.cost ?? definition.energyCost, DEFAULT_COST),
        ticks: positiveInteger(definition.ticks ?? definition.time, DEFAULT_TICKS),
    };

    const sourceFluid = definition.fluid ?? definition.fluids?.[0];
    if (sourceFluid?.type && positiveInteger(sourceFluid.amount, 0) > 0) {
        recipe.fluid = {
            type: String(sourceFluid.type),
            amount: positiveInteger(sourceFluid.amount, 0),
        };
    }
    return recipe;
}

function normalizeStack(stack) {
    if (typeof stack === "string" && stack) return { id: stack, amount: 1 };
    if (!stack || typeof stack !== "object" || typeof stack.id !== "string" || !stack.id) {
        return undefined;
    }
    return { id: stack.id, amount: positiveInteger(stack.amount, 1) };
}

function positiveInteger(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

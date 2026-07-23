// @ts-check

import { system } from "@minecraft/server";

const DEFAULT_COST = 4000;
const DEFAULT_TICKS = 100;
const REGISTER_EVENT_ID = "utilitycraft:register_cryo_stabilizer_recipe";

/** @type {Map<string, any>} */
const recipesByInput = new Map();
/** @type {Map<string, any>} */
const recipesById = new Map();

export const cryoStabilizerRecipeDefinitions = {
    "utilitycraft:stabilize_darloonite_crystal": {
        input: { id: "utilitycraft:charged_darloonite_crystal", amount: 1 },
        output: { id: "utilitycraft:darloonite_crystal", amount: 1 },
        cryofluid: 1600,
        cost: 24000,
        ticks: 200,
    },
    "utilitycraft:deenergize_iron_dust": {
        input: { id: "utilitycraft:energized_iron_dust", amount: 1 },
        output: { id: "utilitycraft:iron_dust", amount: 1 },
        cryofluid: 250,
        cost: 4000,
        ticks: 100,
    },
    "utilitycraft:deenergize_iron_ingot": {
        input: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
        output: { id: "minecraft:iron_ingot", amount: 1 },
        cryofluid: 500,
        cost: 8000,
        ticks: 200,
    },
    "utilitycraft:deenergize_raw_iron": {
        input: { id: "utilitycraft:raw_energized_iron", amount: 1 },
        output: { id: "minecraft:raw_iron", amount: 1 },
        cryofluid: 500,
        cost: 8000,
        ticks: 200,
    },
    "utilitycraft:deenergize_iron_block": {
        input: { id: "utilitycraft:energized_iron_block", amount: 1 },
        output: { id: "minecraft:iron_block", amount: 1 },
        cryofluid: 4000,
        cost: 64000,
        ticks: 1200,
    },
    "utilitycraft:deenergize_raw_iron_block": {
        input: { id: "utilitycraft:raw_energized_iron_block", amount: 1 },
        output: { id: "minecraft:raw_iron_block", amount: 1 },
        cryofluid: 4000,
        cost: 64000,
        ticks: 1200,
    },
    "utilitycraft:refined_aetherium_shard_cooling": {
        input: { id: "utilitycraft:refined_aetherium_shard", amount: 1 },
        output: { id: "utilitycraft:aetherium_shard", amount: 1 },
        cryofluid: 400,
        cost: 12000,
        ticks: 300,
    },
};

for (const [id, definition] of Object.entries(cryoStabilizerRecipeDefinitions)) {
    registerCryoStabilizerRecipe(id, definition);
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
        registerCryoStabilizerRecipe(recipeId, definition);
    }
});

/** Resolves one exact recipe without scanning the registry. */
export function getCryoStabilizerRecipe(inputTypeId) {
    return recipesByInput.get(inputTypeId);
}

export function getCryoStabilizerRecipeCount() {
    return recipesById.size;
}

export function registerCryoStabilizerRecipe(id, definition) {
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
    return true;
}

function normalizeRecipe(id, definition) {
    if (typeof id !== "string" || !id || !definition || typeof definition !== "object") {
        return undefined;
    }

    const input = normalizeStack(definition.input);
    const output = normalizeStack(definition.output);
    if (!input || !output) return undefined;

    const fluid = definition.fluid ?? definition.fluids?.[0];
    return {
        id,
        input,
        output,
        cryofluid: nonNegativeInteger(definition.cryofluid ?? fluid?.amount, 0),
        cost: positiveInteger(definition.cost ?? definition.energyCost, DEFAULT_COST),
        ticks: positiveInteger(definition.ticks ?? definition.time, DEFAULT_TICKS),
    };
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

function nonNegativeInteger(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// @ts-check

import { system } from "@minecraft/server";

const DEFAULT_COST = 9600;
const DEFAULT_TICKS = 100;
const REGISTER_EVENT_ID = "utilitycraft:register_energizer_recipe";

/** @type {Map<string, any>} */
const recipesByInput = new Map();
/** @type {Map<string, any>} */
const recipesById = new Map();

export const energizerRecipeDefinitions = {
    "utilitycraft:energized_iron_ingot": {
        input: { id: "minecraft:iron_ingot", amount: 1 },
        output: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
        cost: 96000,
        ticks: 80,
        preferredChannel: "primary",
    },
    "utilitycraft:raw_energized_iron": {
        input: { id: "minecraft:raw_iron", amount: 1 },
        output: { id: "utilitycraft:raw_energized_iron", amount: 1 },
        cost: 104000,
        ticks: 100,
        preferredChannel: "primary",
    },
    "utilitycraft:energized_iron_block": {
        input: { id: "minecraft:iron_block", amount: 1 },
        output: { id: "utilitycraft:energized_iron_block", amount: 1 },
        cost: 1820000,
        ticks: 360,
        preferredChannel: "primary",
    },
    "utilitycraft:energized_iron_dust": {
        input: { id: "utilitycraft:iron_dust", amount: 1 },
        output: { id: "utilitycraft:energized_iron_dust", amount: 1 },
        cost: 72000,
        ticks: 60,
        preferredChannel: "auxiliary",
    },
    "utilitycraft:energy_upgrade_charge": {
        input: { id: "minecraft:redstone_block", amount: 1 },
        output: { id: "utilitycraft:energy_upgrade", amount: 1 },
        cost: 2400000,
        ticks: 160,
        preferredChannel: "primary",
    },
    "utilitycraft:raw_energized_iron_block": {
        input: { id: "minecraft:raw_iron_block", amount: 1 },
        output: { id: "utilitycraft:raw_energized_iron_block", amount: 1 },
        cost: 1820000,
        ticks: 100,
        preferredChannel: "primary",
    },
};

for (const [id, definition] of Object.entries(energizerRecipeDefinitions)) {
    registerEnergizerRecipe(id, definition);
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
        registerEnergizerRecipe(recipeId, definition);
    }
});

/**
 * Resolves one exact recipe without scanning the registry.
 * @param {string} inputTypeId
 */
export function getEnergizerRecipe(inputTypeId) {
    return recipesByInput.get(inputTypeId);
}

export function getEnergizerRecipeCount() {
    return recipesById.size;
}

/**
 * Registers or replaces one recipe. An input can only resolve to one recipe;
 * a later definition for the same input replaces the previous owner.
 * @param {string} id
 * @param {any} definition
 */
export function registerEnergizerRecipe(id, definition) {
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

    const seconds = positiveNumber(definition.seconds, 0);
    return {
        id,
        input,
        output,
        cost: positiveNumber(definition.cost ?? definition.energyCost, DEFAULT_COST),
        ticks: positiveInteger(definition.ticks, seconds > 0 ? Math.ceil(seconds * 20) : DEFAULT_TICKS),
        preferredChannel: definition.preferredChannel === "auxiliary" || definition.preferredSlot === "aux"
            ? "auxiliary"
            : "primary",
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

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

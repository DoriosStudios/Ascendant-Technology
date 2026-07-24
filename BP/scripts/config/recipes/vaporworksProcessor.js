// @ts-check

import { system } from "@minecraft/server";

const DEFAULT_COST = 2400;
const DEFAULT_INPUT_AMOUNT = 1000;
const DEFAULT_OUTPUT_AMOUNT = 1000;
const DEFAULT_TICKS = 80;
const REGISTER_EVENT_ID = "utilitycraft:register_vaporworks_processor_recipe";

/** @type {Map<string, any>} */
const recipesByInput = new Map();
/** @type {Map<string, any>} */
const recipesById = new Map();

export const vaporworksRecipeDefinitions = {
    "utilitycraft:water_to_steam": {
        inputFluid: { type: "water", amount: 1000 },
        outputGas: { type: "steam", amount: 1000 },
        cost: 1600,
        ticks: 80,
    },
    "utilitycraft:cryofluid_to_steam": {
        inputFluid: { type: "cryofluid", amount: 1000 },
        outputGas: { type: "steam", amount: 1500 },
        cost: 2400,
        ticks: 120,
    },
    "utilitycraft:saline_coolant_to_steam": {
        inputFluid: { type: "saline_coolant", amount: 1000 },
        outputGas: { type: "steam", amount: 1500 },
        cost: 2000,
        ticks: 100,
    },
};

for (const [id, definition] of Object.entries(vaporworksRecipeDefinitions)) {
    registerVaporworksRecipe(id, definition);
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
        registerVaporworksRecipe(recipeId, definition);
    }
});

export function getVaporworksRecipe(inputFluidType) {
    return recipesByInput.get(inputFluidType);
}

export function getVaporworksRecipeCount() {
    return recipesById.size;
}

export function registerVaporworksRecipe(id, definition) {
    const recipe = normalizeRecipe(id, definition);
    if (!recipe) return false;

    const previousById = recipesById.get(recipe.id);
    if (previousById && recipesByInput.get(previousById.inputFluid.type) === previousById) {
        recipesByInput.delete(previousById.inputFluid.type);
    }

    const previousByInput = recipesByInput.get(recipe.inputFluid.type);
    if (previousByInput && previousByInput.id !== recipe.id) {
        recipesById.delete(previousByInput.id);
    }

    recipesById.set(recipe.id, recipe);
    recipesByInput.set(recipe.inputFluid.type, recipe);
    return true;
}

function normalizeRecipe(registrationKey, definition) {
    if (typeof registrationKey !== "string" || !registrationKey || !definition || typeof definition !== "object") {
        return undefined;
    }

    const inputFluid = normalizeResource(
        definition.inputFluid ?? {
            type: definition.inputType ?? registrationKey,
            amount: definition.inputAmount ?? definition.required,
        },
        DEFAULT_INPUT_AMOUNT,
    );
    const outputGas = normalizeResource(
        definition.outputGas ?? definition.outputFluid,
        DEFAULT_OUTPUT_AMOUNT,
    );
    if (!inputFluid || !outputGas) return undefined;

    const seconds = positiveNumber(definition.seconds, 0);
    return {
        id: typeof definition.id === "string" && definition.id ? definition.id : registrationKey,
        inputFluid,
        outputGas,
        cost: positiveNumber(definition.cost ?? definition.energyCost, DEFAULT_COST),
        ticks: positiveInteger(definition.ticks, seconds > 0 ? Math.ceil(seconds * 20) : DEFAULT_TICKS),
    };
}

function normalizeResource(resource, fallbackAmount) {
    if (!resource || typeof resource !== "object") return undefined;
    const type = typeof resource.type === "string" ? resource.type.trim().toLowerCase() : "";
    if (!type) return undefined;
    return { type, amount: positiveInteger(resource.amount, fallbackAmount) };
}

function positiveInteger(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

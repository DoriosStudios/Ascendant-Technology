import { system } from "@minecraft/server";

const VAPORWORKS_RECIPE_DEFAULTS = Object.freeze({
    energyCost: 2400,
    inputAmount: 1000,
    outputAmount: 500,
    ticksPerSecond: 20,
    processSeconds: 4
});

/**
 * Direct recipe registry for the Vaporworks Processor.
 * Keys represent the accepted input fluid type, matching the UtilityCraft lookup style.
 * Full `inputFluid` payloads are still supported for script-event registration.
 *
 * @type {Record<string, VaporworksRecipe>}
 */
export const vaporworksProcessorRecipes = {};

let vaporworksProcessorInputRate = VAPORWORKS_RECIPE_DEFAULTS.inputAmount;

const vaporworksProcessorRecipesRegister = {
    water: {
        id: "utilitycraft:water_to_steam",
        outputFluid: { type: "steam", amount: 1000 },
        energyCost: 2400,
        seconds: 4,
        description: "Converts water into pressurized steam for auxiliary processing."
    },
    cryofluid: {
        id: "utilitycraft:cryofluid_to_steam",
        outputFluid: { type: "steam", amount: 1500 },
        energyCost: 4800,
        seconds: 6,
        description: "Vaporizes cryofluid into high-pressure steam with increased yield."
    }
};

for (const [inputType, definition] of Object.entries(vaporworksProcessorRecipesRegister)) {
    upsertVaporworksRecipe(definition, inputType);
}

export function getVaporworksProcessorRecipes() {
    return vaporworksProcessorRecipes;
}

export function getVaporworksProcessorInputRate() {
    return vaporworksProcessorInputRate;
}

/**
 * @typedef {Object} VaporworksRecipeDefinition
 * @property {{ type: string, amount?: number }} [inputFluid] Optional fluid input; when omitted the registry key is used as the input type.
 * @property {number} [inputAmount] Optional shorthand input amount used with keyed registration.
 * @property {{ type: string, amount?: number }} outputFluid Required fluid output; amount defaults to 500 mB.
 * @property {string} [id] Optional identifier (defaults to the input type).
 * @property {number} [energyCost] Optional FE override per craft (defaults to 2 400).
 * @property {number} [seconds] Optional processing time in seconds (defaults to 4s).
 * @property {string} [description] Optional HUD description.
 */

/**
 * @typedef {Object} VaporworksRecipe
 * @property {string} id Unique identifier for the normalized recipe.
 * @property {{ type: string, amount: number }} inputFluid Sanitized input fluid definition.
 * @property {{ type: string, amount: number }} outputFluid Sanitized output fluid definition.
 * @property {number} energyCost Energy required to finish one craft.
 * @property {number} ticks Processing time expressed in game ticks.
 * @property {number} seconds Processing time expressed in seconds.
 * @property {string | null} description Short flavor text used by the HUD.
 */

/**
 * Normalizes a vaporworks processor recipe definition.
 * @param {VaporworksRecipeDefinition} recipe
 * @param {string} [registrationKey]
 * @returns {VaporworksRecipe}
 */
function defineVaporworksRecipe(recipe, registrationKey) {
    if (!recipe || typeof recipe !== "object") throw new TypeError("Invalid vaporworks recipe payload");

    const inputFluid = resolveInputFluid(recipe, registrationKey);
    const outputFluid = normalizeFluid(recipe.outputFluid, VAPORWORKS_RECIPE_DEFAULTS.outputAmount, "output fluid");

    const seconds = Math.max(1, Math.floor(recipe.seconds ?? VAPORWORKS_RECIPE_DEFAULTS.processSeconds));

    return {
        id: normalizeRecipeId(recipe.id, inputFluid.type),
        inputFluid,
        outputFluid,
        energyCost: Math.max(1, Math.floor(recipe.energyCost ?? VAPORWORKS_RECIPE_DEFAULTS.energyCost)),
        ticks: Math.max(1, seconds * VAPORWORKS_RECIPE_DEFAULTS.ticksPerSecond),
        seconds,
        description: typeof recipe.description === "string" ? recipe.description : null
    };
}

function resolveInputFluid(recipe, registrationKey) {
    if (recipe.inputFluid) {
        return normalizeFluid(recipe.inputFluid, VAPORWORKS_RECIPE_DEFAULTS.inputAmount, "input fluid");
    }

    const fallbackType = typeof registrationKey === "string"
        ? registrationKey.trim().toLowerCase()
        : "";
    if (!fallbackType) {
        throw new TypeError("Vaporworks recipe missing input fluid");
    }

    return normalizeFluid({
        type: fallbackType,
        amount: recipe.inputAmount ?? recipe.required ?? VAPORWORKS_RECIPE_DEFAULTS.inputAmount
    }, VAPORWORKS_RECIPE_DEFAULTS.inputAmount, "input fluid");
}

function normalizeRecipeId(value, fallback) {
    return typeof value === "string" && value.length ? value : fallback;
}

function normalizeFluid(fluid, fallbackAmount, label = "fluid") {
    if (!fluid || typeof fluid !== "object") {
        throw new TypeError(`Vaporworks recipe missing ${label} definition`);
    }

    const type = typeof fluid.type === "string" ? fluid.type.toLowerCase() : null;
    if (!type) throw new TypeError(`Vaporworks ${label} requires a type`);

    const amount = Math.max(1, Math.floor(fluid.amount ?? fallbackAmount));
    return { type, amount };
}

const VAPORWORKS_RECIPE_EVENTS = Object.freeze({
    register: "utilitycraft:register_vaporworks_processor_recipe"
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== VAPORWORKS_RECIPE_EVENTS.register) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeKey, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== "object") {
                console.warn(`[UtilityCraft] Ignored invalid vaporworks processor recipe '${recipeKey}'.`);
                continue;
            }

            try {
                const status = upsertVaporworksRecipe(definition, recipeKey);
                if (status === "replaced") replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register vaporworks processor recipe '${recipeKey}':`, err);
            }
        }

    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse vaporworks processor recipe payload:", err);
    }
});

function refreshVaporworksProcessorInputRate() {
    let nextRate = VAPORWORKS_RECIPE_DEFAULTS.inputAmount;
    for (const recipe of Object.values(vaporworksProcessorRecipes)) {
        nextRate = Math.max(nextRate, Math.max(1, Math.floor(recipe?.inputFluid?.amount ?? 0)));
    }
    vaporworksProcessorInputRate = nextRate;
}

function upsertVaporworksRecipe(definition, registrationKey) {
    const recipe = defineVaporworksRecipe(definition, registrationKey);
    const lookupKey = recipe.inputFluid.type;
    const status = Object.prototype.hasOwnProperty.call(vaporworksProcessorRecipes, lookupKey)
        ? "replaced"
        : "added";

    vaporworksProcessorRecipes[lookupKey] = recipe;
    refreshVaporworksProcessorInputRate();
    return status;
}

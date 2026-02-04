import { system } from "@minecraft/server";

const DEFAULT_ENERGY_COST = 2400;
const DEFAULT_FLUID_OUTPUT = 500;
const TICKS_PER_SECOND = 20;
const DEFAULT_PROCESS_SECONDS = 4;

/**
 * Native Vaporworks Processor recipes shipped with the add-on.
 * Each entry defines the fluid input, the amount of gas/steam produced,
 * and metadata that the machine script can use to describe the recipe to the player.
 *
 * @type {VaporworksRecipe[]}
 */
const nativeVaporworksRecipes = [
    defineVaporworksRecipe({
        id: "utilitycraft:water_to_steam",
        inputFluid: { type: "water", amount: 1000 },
        outputFluid: { type: "steam", amount: 1000 },
        energyCost: 2400,
        seconds: 4,
        description: "Converts water into pressurized steam for auxiliary processing."
    }),
    defineVaporworksRecipe({
        id: "utilitycraft:cryofluid_to_steam",
        inputFluid: { type: "cryofluid", amount: 1000 },
        outputFluid: { type: "steam", amount: 1500 },
        energyCost: 4800,
        seconds: 6,
        description: "Vaporizes cryofluid into high-pressure steam with increased yield."
    })
];

export const vaporworksProcessorRecipes = nativeVaporworksRecipes;

export function getVaporworksProcessorRecipes() {
    return vaporworksProcessorRecipes;
}

/**
 * @typedef {Object} VaporworksRecipeDefinition
 * @property {{ type: string, amount?: number }} inputFluid Required fluid input; amount defaults to 1000 mB.
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
 * @returns {VaporworksRecipe}
 */
function defineVaporworksRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") throw new TypeError("Invalid vaporworks recipe payload");

    const inputFluid = normalizeFluid(recipe.inputFluid, 1000);
    const outputFluid = normalizeFluid(recipe.outputFluid, DEFAULT_FLUID_OUTPUT);

    const seconds = Math.max(1, Math.floor(recipe.seconds ?? DEFAULT_PROCESS_SECONDS));

    return {
        id: typeof recipe.id === "string" && recipe.id.length ? recipe.id : inputFluid.type,
        inputFluid,
        outputFluid,
        energyCost: Math.max(1, Math.floor(recipe.energyCost ?? DEFAULT_ENERGY_COST)),
        ticks: Math.max(1, seconds * TICKS_PER_SECOND),
        seconds,
        description: typeof recipe.description === "string" ? recipe.description : null
    };
}

function normalizeFluid(fluid, fallbackAmount) {
    if (!fluid || typeof fluid !== "object") {
        throw new TypeError("Vaporworks recipe missing fluid definition");
    }

    const type = typeof fluid.type === "string" ? fluid.type.toLowerCase() : null;
    if (!type) throw new TypeError("Vaporworks fluid requires a type");

    const amount = Math.max(1, Math.floor(fluid.amount ?? fallbackAmount));
    return { type, amount };
}

const VAPORWORKS_EVENT_ID = "utilitycraft:register_vaporworks_processor_recipe";

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== VAPORWORKS_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== "object") {
                console.warn(`[UtilityCraft] Ignored invalid vaporworks processor recipe '${recipeId}'.`);
                continue;
            }

            try {
                const status = upsertVaporworksRecipe({ id: recipeId, ...definition });
                if (status === "replaced") replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register vaporworks processor recipe '${recipeId}':`, err);
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} vaporworks processor recipes.`);
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse vaporworks processor recipe payload:", err);
    }
});

function upsertVaporworksRecipe(definition) {
    const recipe = defineVaporworksRecipe(definition);
    const index = vaporworksProcessorRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        vaporworksProcessorRecipes[index] = recipe;
        return "replaced";
    }

    vaporworksProcessorRecipes.push(recipe);
    return "added";
}

import { system } from "@minecraft/server";

const LIQUIFIER_RECIPE_DEFAULTS = Object.freeze({
    energyCost: 3600,
    fluidAmount: 250,
    inputAmount: 1,
    ticksPerSecond: 20,
    processSeconds: 6
});

/**
 * Direct recipe registry for the Liquifier.
 * Keys represent the accepted item input, matching the UtilityCraft lookup style.
 * Full `input` payloads remain supported for script-event registration.
 *
 * @type {Record<string, LiquifierRecipe>}
 */
export const liquifierRecipes = {};

const liquifierRecipesRegister = {
    "utilitycraft:aetherium": {
        id: "utilitycraft:liquified_aetherium_from_ingot",
        fluid: { type: "liquified_aetherium", amount: 1000 },
        energyCost: 9600,
        seconds: 15,
        byproduct: {
            id: "minecraft:obsidian",
            amount: 1,
            chance: 0.25
        },
        description: "Melts refined ingots back into a full bucket of liquified aetherium."
    },
    "utilitycraft:aetherium_shard": {
        id: "utilitycraft:liquified_aetherium_from_shards",
        inputAmount: 4,
        fluid: { type: "liquified_aetherium", amount: 1000 },
        energyCost: 5400,
        seconds: 10,
        description: "Compresses loose shards into a usable batch of liquified aetherium."
    },
    "minecraft:ancient_debris": {
        id: "utilitycraft:liquified_aetherium_from_debris",
        inputAmount: 2,
        fluid: { type: "dark_matter", amount: 1000 },
        energyCost: 12800,
        seconds: 20,
        byproduct: {
            id: "minecraft:netherrack",
            amount: 2,
            chance: 0.35
        },
        description: "Breaks down ancient debris into a full batch of dark matter."
    },
    "utilitycraft:void_essence": {
        id: "utilitycraft:dark_matter_from_void_essence",
        inputAmount: 3,
        fluid: { type: "dark_matter", amount: 750 },
        energyCost: 6400,
        seconds: 9,
        byproduct: {
            id: "minecraft:ender_pearl",
            amount: 1,
            chance: 0.2
        },
        description: "Condenses volatile void essence into thick dark matter concentrate."
    },
    "minecraft:obsidian": {
        id: "utilitycraft:dark_matter_from_obsidian",
        inputAmount: 2,
        fluid: { type: "dark_matter", amount: 500 },
        energyCost: 5200,
        seconds: 8,
        byproduct: {
            id: "minecraft:crying_obsidian",
            amount: 1,
            chance: 0.1
        },
        description: "Melts obsidian down into a small batch of dark matter."
    },
    "utilitycraft:stabilized_obsidian_dust": {
        id: "utilitycraft:dark_matter_from_stabilized_obsidian_dust",
        inputAmount: 4,
        fluid: { type: "dark_matter", amount: 1000 },
        energyCost: 7600,
        seconds: 12,
        byproduct: {
            id: "minecraft:obsidian",
            amount: 1,
            chance: 0.35
        },
        description: "Liquifies refined obsidian dust into a full bucket of dark matter."
    },
    "utilitycraft:compressed_obsidian": {
        fluid: { type: "dark_matter", amount: 9000},
        energyCost: 64000
    },
    "utilitycraft:compressed_obsidian_2": {
        fluid: { type: "dark_matter", amount: 72000},
        energyCost: 560000
    },
    "utilitycraft:compressed_obsidian_3": {
        fluid: { type: "dark_matter", amount: 576000},
        energyCost: 5000000
    }
};

for (const [inputId, definition] of Object.entries(liquifierRecipesRegister)) {
    upsertLiquifierRecipe(definition, inputId);
}

export function getLiquifierRecipes() {
    return liquifierRecipes;
}

/**
 * @typedef {Object} LiquifierRecipeDefinition
 * @property {{ id: string, amount: number }} [input] Optional solid input stack; when omitted the registry key is used as the input identifier.
 * @property {number} [inputAmount] Optional shorthand amount used with keyed registration.
 * @property {{ type: string, amount?: number }} fluid Required fluid output block; amount defaults to 250 mB.
 * @property {string} [id] Optional identifier (defaults to the input identifier).
 * @property {number} [energyCost] Optional FE override per craft (defaults to 3 600).
 * @property {number} [seconds] Optional processing time in seconds (defaults to 6s).
 * @property {{ id: string, amount?: number, chance?: number }} [byproduct] Optional secondary output definition.
 * @property {string} [description] Optional HUD description.
 */

/**
 * @typedef {Object} LiquifierRecipe
 * @property {string} id Unique identifier for the normalized recipe.
 * @property {{ id: string, amount: number }} input Sanitized input stack definition.
 * @property {{ type: string, amount: number }} fluid Sanitized fluid output definition.
 * @property {number} energyCost Energy required to finish one craft.
 * @property {number} ticks Processing time expressed in game ticks.
 * @property {number} seconds Processing time expressed in seconds.
 * @property {{ id: string, amount: number, chance: number } | null} byproduct Optional residue output definition.
 * @property {string | null} description Short flavor text used by the HUD.
 */

/**
 * Normalizes a liquifier recipe definition.
 * @param {LiquifierRecipeDefinition} recipe
 * @param {string} [registrationKey]
 * @returns {LiquifierRecipe}
 */
function defineLiquifierRecipe(recipe, registrationKey) {
    if (!recipe || typeof recipe !== "object") throw new TypeError("Invalid liquifier recipe payload");

    const input = resolveInputStack(recipe, registrationKey);
    const fluid = normalizeFluid(recipe.fluid, LIQUIFIER_RECIPE_DEFAULTS.fluidAmount);

    const seconds = Math.max(1, Math.floor(recipe.seconds ?? LIQUIFIER_RECIPE_DEFAULTS.processSeconds));

    return {
        id: typeof recipe.id === "string" && recipe.id.length ? recipe.id : input.id,
        input,
        fluid,
        energyCost: Math.max(1, Math.floor(recipe.energyCost ?? LIQUIFIER_RECIPE_DEFAULTS.energyCost)),
        ticks: Math.max(1, seconds * LIQUIFIER_RECIPE_DEFAULTS.ticksPerSecond),
        seconds,
        byproduct: normalizeByproduct(recipe.byproduct),
        description: typeof recipe.description === "string" ? recipe.description : null
    };
}

function resolveInputStack(recipe, registrationKey) {
    if (recipe.input) {
        return normalizeStack(recipe.input, LIQUIFIER_RECIPE_DEFAULTS.inputAmount);
    }

    const fallbackId = typeof registrationKey === "string" ? registrationKey.trim() : "";
    if (!fallbackId) {
        throw new TypeError("Liquifier recipe missing input definition");
    }

    return normalizeStack({
        id: fallbackId,
        amount: recipe.inputAmount ?? recipe.required ?? LIQUIFIER_RECIPE_DEFAULTS.inputAmount
    }, LIQUIFIER_RECIPE_DEFAULTS.inputAmount);
}

function normalizeStack(stack, fallbackAmount) {
    if (!stack || typeof stack !== "object") {
        throw new TypeError("Liquifier recipe missing input definition");
    }

    if (typeof stack === "string") {
        return { id: stack, amount: fallbackAmount };
    }

    const id = typeof stack.id === "string" ? stack.id : null;
    if (!id) throw new TypeError("Liquifier stack requires an identifier");

    const amount = Math.max(1, Math.floor(stack.amount ?? fallbackAmount ?? 1));
    return { id, amount };
}

function normalizeFluid(fluid, fallbackAmount) {
    if (!fluid || typeof fluid !== "object") {
        throw new TypeError("Liquifier recipe missing fluid block");
    }

    const type = typeof fluid.type === "string" ? fluid.type.toLowerCase() : null;
    if (!type) throw new TypeError("Liquifier fluid output requires a type");

    const amount = Math.max(1, Math.floor(fluid.amount ?? fallbackAmount ?? LIQUIFIER_RECIPE_DEFAULTS.fluidAmount));
    return { type, amount };
}

function normalizeByproduct(byproduct) {
    if (!byproduct || typeof byproduct !== "object") return null;
    const id = typeof byproduct.id === "string" ? byproduct.id : null;
    if (!id) return null;

    const amount = Math.max(1, Math.floor(byproduct.amount ?? 1));
    const chance = clampChance(byproduct.chance ?? byproduct.probability ?? 1);
    return { id, amount, chance };
}

function clampChance(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(1, parsed));
}

const LIQUIFIER_EVENT_ID = "utilitycraft:register_liquifier_recipe";

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== LIQUIFIER_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeKey, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== "object") {
                console.warn(`[UtilityCraft] Ignored invalid liquifier recipe '${recipeKey}'.`);
                continue;
            }

            try {
                const status = upsertLiquifierRecipe(definition, recipeKey);
                if (status === "replaced") replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register liquifier recipe '${recipeKey}':`, err);
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} liquifier recipes.`);
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse liquifier recipe payload:", err);
    }
});

function upsertLiquifierRecipe(definition, registrationKey) {
    const recipe = defineLiquifierRecipe(definition, registrationKey);
    const lookupKey = recipe.input.id;
    const status = Object.prototype.hasOwnProperty.call(liquifierRecipes, lookupKey)
        ? "replaced"
        : "added";

    liquifierRecipes[lookupKey] = recipe;
    return status;
}

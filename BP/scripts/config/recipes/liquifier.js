import { system } from "@minecraft/server";

const DEFAULT_ENERGY_COST = 3600;
const DEFAULT_FLUID_AMOUNT = 250;
const DEFAULT_INPUT_AMOUNT = 1;
const TICKS_PER_SECOND = 20;
const DEFAULT_PROCESS_SECONDS = 6;

/**
 * Native Liquifier recipes shipped with the add-on.
 * Each entry defines the solid input, the amount of fluid produced,
 * optional byproducts, and metadata that the machine script can use to
 * describe the recipe to the player.
 *
 * @type {LiquifierRecipe[]}
 */
const nativeLiquifierRecipes = [
    defineLiquifierRecipe({
        id: "utilitycraft:liquified_aetherium_from_ingot",
        input: { id: "utilitycraft:aetherium", amount: 1 },
        fluid: { type: "liquified_aetherium", amount: 1000 },
        energyCost: 9600,
        seconds: 15,
        byproduct: {
            id: "minecraft:obsidian",
            amount: 1,
            chance: 0.25
        },
        description: "Melts refined ingots back into a full bucket of liquified aetherium."
    }),
    defineLiquifierRecipe({
        id: "utilitycraft:liquified_aetherium_from_shards",
        input: { id: "utilitycraft:aetherium_shard", amount: 4 },
        fluid: { type: "liquified_aetherium", amount: 1000 },
        energyCost: 5400,
        seconds: 10,
        description: "Compresses loose shards into a usable batch of liquified aetherium."
    }),
    defineLiquifierRecipe({
        id: "utilitycraft:liquified_aetherium_from_debris",
        input: { id: "minecraft:ancient_debris", amount: 2 },
        fluid: { type: "liquified_aetherium", amount: 1000 },
        energyCost: 12800,
        seconds: 20,
        byproduct: {
            id: "minecraft:netherrack",
            amount: 2,
            chance: 0.35
        },
        description: "Breaks down ancient debris to extract liquified alloys."
    }),
    defineLiquifierRecipe({
        id: "utilitycraft:dark_matter_from_void_essence",
        input: { id: "utilitycraft:void_essence", amount: 3 },
        fluid: { type: "dark_matter", amount: 750 },
        energyCost: 6400,
        seconds: 9,
        byproduct: {
            id: "minecraft:ender_pearl",
            amount: 1,
            chance: 0.2
        },
        description: "Condenses volatile void essence into thick dark matter concentrate."
    }),
    defineLiquifierRecipe({
        id: "utilitycraft:dark_matter_from_obsidian",
        input: { id: "minecraft:obsidian", amount: 2 },
        fluid: { type: "dark_matter", amount: 500 },
        energyCost: 5200,
        seconds: 8,
        byproduct: {
            id: "minecraft:crying_obsidian",
            amount: 1,
            chance: 0.1
        },
        description: "Melts obsidian down into a small batch of dark matter."
    }),
    defineLiquifierRecipe({
        id: "utilitycraft:dark_matter_from_refined_obsidian_dust",
        input: { id: "utilitycraft:refined_obsidian_dust", amount: 4 },
        fluid: { type: "dark_matter", amount: 1000 },
        energyCost: 7600,
        seconds: 12,
        byproduct: {
            id: "minecraft:obsidian",
            amount: 1,
            chance: 0.35
        },
        description: "Liquifies refined obsidian dust into a full bucket of dark matter."
    })
];

export const liquifierRecipes = nativeLiquifierRecipes;

export function getLiquifierRecipes() {
    return liquifierRecipes;
}

/**
 * @typedef {Object} LiquifierRecipeDefinition
 * @property {{ id: string, amount: number }} input Required solid input stack.
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
 * @returns {LiquifierRecipe}
 */
function defineLiquifierRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") throw new TypeError("Invalid liquifier recipe payload");

    const input = normalizeStack(recipe.input, DEFAULT_INPUT_AMOUNT);
    const fluid = normalizeFluid(recipe.fluid, DEFAULT_FLUID_AMOUNT);

    const seconds = Math.max(1, Math.floor(recipe.seconds ?? DEFAULT_PROCESS_SECONDS));

    return {
        id: typeof recipe.id === "string" && recipe.id.length ? recipe.id : input.id,
        input,
        fluid,
        energyCost: Math.max(1, Math.floor(recipe.energyCost ?? DEFAULT_ENERGY_COST)),
        ticks: Math.max(1, seconds * TICKS_PER_SECOND),
        seconds,
        byproduct: normalizeByproduct(recipe.byproduct),
        description: typeof recipe.description === "string" ? recipe.description : null
    };
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

    const amount = Math.max(1, Math.floor(fluid.amount ?? fallbackAmount ?? DEFAULT_FLUID_AMOUNT));
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

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== "object") {
                console.warn(`[UtilityCraft] Ignored invalid liquifier recipe '${recipeId}'.`);
                continue;
            }

            try {
                const status = upsertLiquifierRecipe({ id: recipeId, ...definition });
                if (status === "replaced") replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register liquifier recipe '${recipeId}':`, err);
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} liquifier recipes.`);
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse liquifier recipe payload:", err);
    }
});

function upsertLiquifierRecipe(definition) {
    const recipe = defineLiquifierRecipe(definition);
    const index = liquifierRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        liquifierRecipes[index] = recipe;
        return "replaced";
    }

    liquifierRecipes.push(recipe);
    return "added";
}

import { system } from "@minecraft/server";

const ENERGIZER_RECIPE_DEFAULTS = Object.freeze({
    energyCost: 9600,
    seconds: 5,
    ticksPerSecond: 20
});

/**
 * @typedef {Object} EnergizerRecipeDefinition
 * @property {{ id: string, amount: number } | string} input Required primary input stack.
 * @property {{ id: string, amount: number } | string} output Required output stack.
 * @property {string} [id] Optional unique recipe identifier (defaults to the input identifier).
 * @property {number} [energyCost] Optional energy override in FE (defaults to 9 600).
 * @property {number} [seconds] Optional processing time override in seconds (defaults to 5s).
 * @property {string} [description] Optional flavor text surfaced in HUD.
 * @property {('primary'|'aux')} [preferredSlot] Optional preferred input slot hint for the UI.
 */

/**
 * @typedef {Object} EnergizerRecipe
 * @property {string} id Normalized recipe identifier.
 * @property {{ id: string, amount: number }} input Input stack with sanitized amount.
 * @property {{ id: string, amount: number }} output Output stack with sanitized amount.
 * @property {number} energyCost Total FE cost per craft.
 * @property {number} ticks Processing time expressed in game ticks.
 * @property {number} seconds Processing time expressed in seconds.
 * @property {string | null} description Optional flavor text (null when omitted).
 * @property {('primary'|'aux')} preferredSlot Preferred slot target stored on the recipe.
 */

const nativeEnergizerRecipes = [
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_ingot",
        input: { id: "minecraft:iron_ingot", amount: 1 },
        output: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
        energyCost: 96000,
        seconds: 4,
        description: "Baseline conversion that unlocks energized metals early-game."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:raw_energized_iron",
        input: { id: "minecraft:raw_iron", amount: 1 },
        output: { id: "utilitycraft:raw_energized_iron", amount: 1 },
        energyCost: 104000,
        seconds: 5,
        description: "Raw ores get energized directly so furnaces output the good stuff."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_block",
        input: { id: "minecraft:iron_block", amount: 1 },
        output: { id: "utilitycraft:energized_iron_block", amount: 1 },
        energyCost: 1820000,
        seconds: 18,
        description: "Bulk recipe for automation lines feeding higher-tier machines."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_dust",
        input: { id: "utilitycraft:iron_dust", amount: 1 },
        output: { id: "utilitycraft:energized_iron_dust", amount: 1 },
        energyCost: 72000,
        seconds: 3,
        description: "Dust-tier conversion tuned for auxiliary slot batching.",
        preferredSlot: "aux"
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energy_upgrade_charge",
        input: { id: "minecraft:redstone_block", amount: 1 },
        output: { id: "utilitycraft:energy_upgrade", amount: 1 },
        energyCost: 2400000,
        seconds: 8,
        description: "Overcharges compacted redstone into an Energy Upgrade module."
    }),
    defineEnergizerRecipe({
        input: {id: "minecraft:raw_iron_block", amount: 1},
        output: {id: "utilitycraft:raw_energized_iron_block", amount: 1},
        energyCost: 1820000
    })
];

export const energizerRecipes = nativeEnergizerRecipes;

export function getEnergizerRecipes() {
    return energizerRecipes;
}

/**
 * Normalizes a recipe definition into an EnergizerRecipe object.
 * @param {EnergizerRecipeDefinition} payload
 * @returns {EnergizerRecipe}
 */
function defineEnergizerRecipe(payload) {
    if (!payload || typeof payload !== "object") {
        throw new TypeError("Invalid energizer recipe payload");
    }

    const input = normalizeStack(payload.input, 1);
    const output = normalizeStack(payload.output, 1);
    const seconds = clampSeconds(payload.seconds ?? ENERGIZER_RECIPE_DEFAULTS.seconds);

    return {
        id: typeof payload.id === "string" && payload.id.length ? payload.id : input.id,
        input,
        output,
        energyCost: Math.max(1, Math.floor(payload.energyCost ?? ENERGIZER_RECIPE_DEFAULTS.energyCost)),
        ticks: seconds * ENERGIZER_RECIPE_DEFAULTS.ticksPerSecond,
        seconds,
        description: typeof payload.description === "string" ? payload.description : null,
        preferredSlot: payload.preferredSlot === "aux" ? "aux" : "primary"
    };
}

function normalizeStack(stack, fallbackAmount = 1) {
    if (!stack) throw new TypeError("Energizer recipe missing stack definition");

    if (typeof stack === "string") {
        return { id: stack, amount: fallbackAmount };
    }

    if (typeof stack === "object" && typeof stack.id === "string") {
        const amount = Math.max(1, Math.floor(stack.amount ?? fallbackAmount));
        return { id: stack.id, amount };
    }

    throw new TypeError("Invalid stack entry for energizer recipe");
}

function clampSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return ENERGIZER_RECIPE_DEFAULTS.seconds;
    return Math.max(1, Math.floor(parsed));
}

const ENERGIZER_EVENT_ID = "utilitycraft:register_energizer_recipe";

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== ENERGIZER_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== "object") {
                console.warn(`[UtilityCraft] Ignored invalid energizer recipe entry for '${recipeId}'.`);
                continue;
            }

            try {
                const status = upsertEnergizerRecipe({ id: recipeId, ...definition });
                if (status === "replaced") replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register energizer recipe '${recipeId}':`, err);
            }
        }

    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse energizer recipe payload:", err);
    }
});

function upsertEnergizerRecipe(definition) {
    const recipe = defineEnergizerRecipe(definition);
    const index = energizerRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        energizerRecipes[index] = recipe;
        return "replaced";
    }

    energizerRecipes.push(recipe);
    return "added";
}

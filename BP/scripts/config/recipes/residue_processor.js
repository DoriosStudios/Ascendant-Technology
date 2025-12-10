import { system } from "@minecraft/server";

const DEFAULT_ENERGY_COST = 5200;
const DEFAULT_SECONDS = 5;
const TICKS_PER_SECOND = 20;

/**
 * @typedef {Object} ResidueRecipeDefinition
 * @property {{ id: string, amount: number } | string} input Required input stack.
 * @property {{ id: string, amount: number } | string} output Required primary output stack.
 * @property {string} [id] Optional identifier (defaults to the input identifier).
 * @property {number} [energyCost] Optional FE override per craft (defaults to 5 200).
 * @property {number} [seconds] Optional processing duration in seconds (defaults to 5s).
 * @property {{ id: string, amount?: number, chance?: number } | string} [byproduct] Optional byproduct definition.
 * @property {string} [description] Optional HUD description.
 */

/**
 * @typedef {Object} ResidueRecipe
 * @property {string} id Normalized recipe identifier.
 * @property {{ id: string, amount: number }} input Input stack definition.
 * @property {{ id: string, amount: number }} output Output stack definition.
 * @property {{ id: string, amount: number, chance: number } | null} byproduct Optional normalized byproduct.
 * @property {number} energyCost Energy required per craft.
 * @property {number} ticks Processing time expressed in ticks.
 * @property {number} seconds Processing time expressed in seconds.
 * @property {string | null} description Optional description for UI.
 */

const nativeResidueRecipes = [
    defineResidueRecipe({
        id: 'utilitycraft:residue_shards',
        input: { id: 'utilitycraft:void_essence', amount: 1 },
        output: { id: 'utilitycraft:aetherium_shard', amount: 2 },
        byproduct: { id: 'minecraft:iron_nugget', amount: 2, chance: 0.35 },
        energyCost: 5200,
        seconds: 5,
        description: 'Break down condensed void essence into usable shards with a chance to sift iron grit.'
    }),
    defineResidueRecipe({
        id: 'utilitycraft:residue_aetherium',
        input: { id: 'utilitycraft:void_essence', amount: 3 },
        output: { id: 'utilitycraft:aetherium', amount: 1 },
        byproduct: { id: 'utilitycraft:aetherium_shard', amount: 1, chance: 0.5 },
        energyCost: 7800,
        seconds: 7,
        description: 'Compress excess residue into aetherium with shard feedback for automation loops.'
    }),
    defineResidueRecipe({
        id: 'utilitycraft:void_reclaimer',
        input: { id: 'minecraft:rotten_flesh', amount: 3 },
        output: { id: 'utilitycraft:void_essence', amount: 1 },
        energyCost: 2600,
        seconds: 4,
        description: 'Reclaim trace void essence from organic scraps instead of trashing them.'
    }),
    defineResidueRecipe({
        id: 'utilitycraft:bone_block_pulp',
        input: { id: 'minecraft:bone_block', amount: 1 },
        output: { id: 'minecraft:bone_meal', amount: 9 },
        byproduct: { id: 'utilitycraft:void_essence', amount: 1, chance: 0.2 },
        energyCost: 2600,
        seconds: 4,
        description: 'Pulverizes bone blocks back into meal with a slim chance of void residue.'
    }),
    defineResidueRecipe({
        id: 'utilitycraft:ender_dust_reconstitution',
        input: { id: 'utilitycraft:ender_pearl_dust', amount: 2 },
        output: { id: 'minecraft:ender_pearl', amount: 1 },
        byproduct: { id: 'minecraft:gravel', amount: 1, chance: 0.5 },
        energyCost: 4200,
        seconds: 6,
        description: 'Refines loose ender dust back into a stable pearl.'
    })
];

export const residueProcessorRecipes = nativeResidueRecipes;

export function getResidueProcessorRecipes() {
    return residueProcessorRecipes;
}

/**
 * Normalizes a residue processor recipe definition.
 * @param {ResidueRecipeDefinition} payload
 * @returns {ResidueRecipe}
 */
function defineResidueRecipe(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new TypeError('Invalid residue recipe payload');
    }

    const input = normalizeStack(payload.input, 1);
    const output = normalizeStack(payload.output, 1);
    const seconds = clampSeconds(payload.seconds ?? DEFAULT_SECONDS);

    return {
        id: typeof payload.id === 'string' && payload.id.length ? payload.id : input.id,
        input,
        output,
        byproduct: normalizeByproduct(payload.byproduct ?? null),
        energyCost: Math.max(1, Math.floor(payload.energyCost ?? DEFAULT_ENERGY_COST)),
        ticks: seconds * TICKS_PER_SECOND,
        seconds,
        description: typeof payload.description === 'string' ? payload.description : null
    };
}

function normalizeStack(stack, fallbackAmount = 1) {
    if (!stack) throw new TypeError('Residue recipe missing stack definition');

    if (typeof stack === 'string') {
        return { id: stack, amount: fallbackAmount };
    }

    if (typeof stack === 'object' && typeof stack.id === 'string') {
        const amount = Math.max(1, Math.floor(stack.amount ?? fallbackAmount));
        return { id: stack.id, amount };
    }

    throw new TypeError('Invalid stack entry for residue recipe');
}

function normalizeByproduct(byproduct) {
    if (!byproduct) return null;
    if (typeof byproduct !== 'object' || typeof byproduct.id !== 'string') return null;

    const amount = Math.max(1, Math.floor(byproduct.amount ?? 1));
    const chance = clampChance(byproduct.chance ?? 1);

    return { id: byproduct.id, amount, chance };
}

function clampChance(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(1, Math.max(0, numeric));
}

function clampSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SECONDS;
    return Math.max(1, Math.floor(parsed));
}

const RESIDUE_EVENT_ID = "utilitycraft:register_residue_processor_recipe";

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== RESIDUE_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== 'object') return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== 'object') {
                console.warn(`[UtilityCraft] Ignored invalid residue processor recipe '${recipeId}'.`);
                continue;
            }

            try {
                const status = upsertResidueRecipe({ id: recipeId, ...definition });
                if (status === 'replaced') replaced++; else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register residue processor recipe '${recipeId}':`, err);
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} residue processor recipes.`);
    } catch (err) {
        console.warn('[UtilityCraft] Failed to parse residue processor recipe payload:', err);
    }
});

function upsertResidueRecipe(definition) {
    const recipe = defineResidueRecipe(definition);
    const index = residueProcessorRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        residueProcessorRecipes[index] = recipe;
        return 'replaced';
    }

    residueProcessorRecipes.push(recipe);
    return 'added';
}

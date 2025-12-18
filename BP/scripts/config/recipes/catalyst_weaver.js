import { system } from "@minecraft/server"
import { infuserRecipes } from './infuser.js'
import { defineClonerRecipe } from "./cloner.js"

const WEAVER_DEFAULT_ENERGY_COST = 6400
const WEAVER_RATE_PER_TICK = 180
const TICKS_PER_SECOND = 20
const INFUSER_SPEED_MULTIPLIER = 2.5
const MAX_CATALYST_SLOTS = 6
const ENERGY_PER_SECOND = WEAVER_RATE_PER_TICK * TICKS_PER_SECOND

/**
 * @typedef {Object} RecipeInput
 * @property {string} id Item identifier (e.g. "minecraft:iron_ingot").
 * @property {number} amount Quantity required per craft.
 */

/**
 * @typedef {Object} RecipeCatalyst
 * @property {string} id Catalyst item identifier (e.g. "minecraft:blaze_powder").
 * @property {number} amount Quantity consumed per craft.
 */

/**
 * @typedef {Object} RecipeFluid
 * @property {string} type Fluid type identifier (e.g. "lava", "water").
 * @property {number} amount Fluid volume consumed in millibuckets (mB).
 */

/**
 * @typedef {Object} RecipeOutput
 * @property {string} id Output item identifier.
 * @property {number} amount Quantity produced per craft.
 */

/**
 * @typedef {Object} RecipeByproduct
 * @property {string} id Byproduct item identifier (optional extra output).
 * @property {number|[number, number]} amount Byproduct quantity (single value or [min, max] range).
 * @property {number} chance Probability (0.0–1.0) of byproduct being produced.
 */

/**
 * @typedef {Object} CatalystWeaverRecipeDefinition
 * @property {RecipeInput} input Required primary input item and quantity.
 * @property {(RecipeCatalyst|null)[]} catalysts Required array of up to 6 catalyst slots. Missing slots are padded automatically with `null`.
 * @property {RecipeOutput} output Required primary output item and quantity.
 * @property {string} [id] Optional unique recipe identifier (defaults to the input identifier).
 * @property {RecipeFluid} [fluid] Optional fluid requirement.
 * @property {RecipeByproduct} [byproduct] Optional secondary output with drop chance.
 * @property {number} [cost] Optional DE override per craft (defaults to 6 400).
 * @property {number} [speedModifier] Optional processing speed multiplier (defaults to 1x).
 */

/**
 * @typedef {Object} CatalystWeaverRecipe
 * @property {string} id Unique recipe identifier (e.g. "utilitycraft:steel_ingot").
 * @property {RecipeInput} input Primary input item and quantity.
 * @property {(RecipeCatalyst|null)[]} catalysts Array of up to 6 catalyst slots with automatic `null` padding for unused entries.
 * @property {RecipeFluid | undefined} fluid Optional fluid requirement.
 * @property {RecipeOutput} output Primary output item and quantity.
 * @property {RecipeByproduct | undefined} byproduct Optional secondary output with drop chance.
 * @property {number} cost Energy cost in DE (Dorios Energy units).
 * @property {number} speedModifier Processing speed multiplier (higher = faster).
 * @property {number} processingTimeSeconds Derived processing time in seconds.
 */

/**
 * Catalyst Weaver native recipe registry.
 * 
 * ## How to add a custom recipe
 * 
 * Add a new entry to the `nativeCatalystWeaverRecipes` array using `defineWeaverRecipe()`:
 * 
 * defineWeaverRecipe({
 *   id: 'namespace:recipe_name',
 *   input: { id: 'namespace:item_id', amount: 1 },
 *   catalysts: [
 *     { id: 'namespace:catalyst_1', amount: 2 },
 *     { id: 'namespace:catalyst_2', amount: 1 }
 *     // Remaining slots are optional and padded automatically
 *   ],
 *   fluid: { type: 'lava', amount: 1000 },           // optional
 *   output: { id: 'minecraft:result_item', amount: 1 },
 *   byproduct: { id: 'minecraft:bonus', amount: 2, chance: 0.25 },  // optional
 *   cost: 3200,           // optional (defaults to 6400 DE)
 *   speedModifier: 1.5    // optional (defaults to 1.0)
 * })
 * 
 * 
 * @type {CatalystWeaverRecipe[]}
 */
const nativeCatalystWeaverRecipes = [
    defineWeaverRecipe({
        id: 'utilitycraft:netherite_helm_upgrade',
        input: { id: 'minecraft:skeleton_skull', amount: 1 },
        catalysts: [
            { id: 'minecraft:wither_rose', amount: 3 },
            { id: 'minecraft:soul_sand', amount: 4 },
            { id: 'minecraft:bone', amount: 3 },
            { id: 'minecraft:coal', amount: 4 },
            null,
            null
        ],
        output: { id: 'minecraft:wither_skeleton_skull', amount: 1 },
        fluid: { type: 'lava', amount: 2000 },
        byproduct: { id: 'minecraft:bone_meal', amount: 4, chance: 0.6 },
        cost: 6400,
        speedModifier: 1
    }),
    defineWeaverRecipe({
        id: 'utilitycraft:aetherium_ingot',
        input: { id: 'minecraft:gold_ingot', amount: 1 },
        "catalysts": [
            { id: "utilitycraft:steel_ingot", amount: 1 },
            { id: "utilitycraft:energized_iron_ingot", amount: 1 },
            { id: "utilitycraft:ender_pearl_dust", amount: 4 },
            { id: "utilitycraft:aetherium_shard", amount: 4 },
            null,
            null
        ],
        fluid: { type: 'lava', amount: 10000 },
        output: { id: 'utilitycraft:aetherium', amount: 1 },
        byproduct: { id: 'utilitycraft:refined_obsidian_dust', amount: [0, 2], chance: 0.05 },
        cost: 12000,
        speedModifier: 0.5
    }),
    defineWeaverRecipe({
        id: 'utilitycraft:aetherium_from_shards',
        input: { id: 'utilitycraft:aetherium_shard', amount: 4 },
        catalysts: [
            { id: 'utilitycraft:energized_iron_ingot', amount: 1 },
            { id: 'utilitycraft:steel_ingot', amount: 1 },
            { id: 'minecraft:quartz', amount: 2 },
            null,
            null,
            null
        ],
        output: { id: 'utilitycraft:aetherium', amount: 1 },
        byproduct: { id: 'minecraft:gold_nugget', amount: [1, 3], chance: 0.35 },
        cost: 6200,
        speedModifier: 1.2
    }),
    defineWeaverRecipe({
        id: 'utilitycraft:refined_obsidian_conversion',
        input: { id: 'utilitycraft:crying_obsidian_dust', amount: 4 },
        catalysts: [
            { id: 'minecraft:glowstone_dust', amount: 2 },
            { id: 'utilitycraft:energized_iron_dust', amount: 1 },
            null,
            null,
            null,
            null
        ],
        fluid: { type: 'liquified_aetherium', amount: 250 },
        output: { id: 'utilitycraft:refined_obsidian_dust', amount: 2 },
        byproduct: { id: 'minecraft:obsidian', amount: 1, chance: 0.001 },
        cost: 5400,
        speedModifier: 1
    }),
    defineWeaverRecipe({
        input: { id: 'minecraft:gold_ingot', amount: 1 },
        catalysts: [
            { id: 'utilitycraft:copper_dust', amount: 4 }
        ],
        output: { id: 'utilitycraft:bronze_ingot', amount: 1 }
    }),
    defineWeaverRecipe({
        input: {id: 'utilitycraft:speed_upgrade', amount: 1},
        catalysts: [
            {id: 'utilitycraft:energized_iron_dust', amount: 2},
            {id: 'utilitycraft:aetherium_shard', amount: 1},
            {id: 'utilitycraft:titanium', amount: 1},
        ],
        output: {id: 'utilitycraft:hyper_processing_upgrade', amount: 1},
        cost: 12800,
        speedModifier: 0.25
    }),
    defineWeaverRecipe({
        input: {id: 'utilitycraft:quadruple_compressed_cobblestone'},
        catalysts: [
            {id: 'utilitycraft:compressed_coal_block_4', amount: 1},
        ],
        output: {id: 'utilitycraft:compressed_blackstone_4', amount: 1},
        cost: 601600,
        speedModifier: 0.5
    }),
    defineWeaverRecipe({
        input: {id: 'minecraft:amethyst_shard', amount: 1},
        fluid: {type: 'dark_matter', amount: 800},
        output: {id: 'utilitycraft:refined_aetherium_shard', amount: 1}
    })
]

/**
 * Normalizes a Catalyst Weaver recipe definition.
 * @param {CatalystWeaverRecipeDefinition} recipe
 * @param {number} [overrideCost]
 * @returns {CatalystWeaverRecipe}
 */
function defineWeaverRecipe(recipe, overrideCost) {
    const cost = Math.max(1, overrideCost ?? recipe.cost ?? WEAVER_DEFAULT_ENERGY_COST)
    const speedModifier = normalizeSpeedModifier(recipe.speedModifier)
    const catalysts = normalizeCatalystSlots(recipe.catalysts)
    return {
        ...recipe,
        catalysts,
        cost,
        speedModifier,
        processingTimeSeconds: computeProcessingSeconds(cost)
    }
}

function computeProcessingSeconds(cost) {
    return Number((cost / ENERGY_PER_SECOND).toFixed(2))
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.floor(parsed)
}

function normalizeSpeedModifier(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1
    return parsed
}

function normalizeOutput(output, amountHint) {
    if (typeof output === 'string') {
        return { id: output, amount: normalizePositiveInteger(amountHint ?? 1) }
    }

    if (output && typeof output === 'object' && typeof output.id === 'string') {
        return {
            id: output.id,
            amount: normalizePositiveInteger(output.amount ?? amountHint ?? 1)
        }
    }

    return null
}

function normalizeCatalystSlots(rawSlots) {
    const slots = Array(MAX_CATALYST_SLOTS).fill(null)
    if (!Array.isArray(rawSlots)) return slots

    rawSlots.slice(0, MAX_CATALYST_SLOTS).forEach((entry, index) => {
        const normalized = normalizeCatalystEntry(entry)
        if (normalized) slots[index] = normalized
    })

    return slots
}

function normalizeCatalystEntry(entry) {
    if (!entry) return null
    if (typeof entry === 'string') {
        return { id: entry, amount: normalizePositiveInteger(1) }
    }

    if (typeof entry === 'object' && typeof entry.id === 'string') {
        return {
            id: entry.id,
            amount: normalizePositiveInteger(entry.amount ?? 1)
        }
    }

    return null
}

function translateInfuserRecipe(recipeKey, recipeDef) {
    if (!recipeKey || typeof recipeKey !== 'string') return null
    if (!recipeDef || typeof recipeDef !== 'object') return null

    const [catalystId, inputId] = recipeKey.split('|')
    if (!catalystId || !inputId) return null

    const output = normalizeOutput(recipeDef.output, recipeDef.outputAmount)
    if (!output) return null

    const catalysts = Array(MAX_CATALYST_SLOTS).fill(null)
    const catalystAmount = normalizePositiveInteger(recipeDef.required ?? recipeDef.catalystAmount ?? 1)
    catalysts[0] = { id: catalystId, amount: catalystAmount }

    const baseCost = recipeDef.cost ?? WEAVER_DEFAULT_ENERGY_COST
    const adjustedCost = Math.max(1, Math.round(baseCost / INFUSER_SPEED_MULTIPLIER))

    const translated = {
        id: `utilitycraft_infuser:${recipeKey}`,
        input: { id: inputId, amount: normalizePositiveInteger(recipeDef.inputAmount ?? 1) },
        catalysts,
        output,
        speedModifier: normalizeSpeedModifier(recipeDef.speedModifier ?? INFUSER_SPEED_MULTIPLIER)
    }

    if (recipeDef.fluid) {
        translated.fluid = typeof recipeDef.fluid === 'string'
            ? { type: recipeDef.fluid, amount: normalizePositiveInteger(recipeDef.fluidAmount ?? 0, 0) }
            : recipeDef.fluid
    }
    if (recipeDef.byproduct) translated.byproduct = recipeDef.byproduct

    return defineWeaverRecipe(translated, adjustedCost)
}

function buildInfuserWeaverRecipes() {
    return Object.entries(infuserRecipes)
        .map(([key, def]) => translateInfuserRecipe(key, def))
        .filter(Boolean)
}

const CATALYST_WEAVER_EVENT_ID = "utilitycraft:register_catalyst_weaver_recipe"

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== CATALYST_WEAVER_EVENT_ID) return

    try {
        const payload = JSON.parse(message)
        if (!payload || typeof payload !== 'object') return

        let added = 0
        let replaced = 0

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== 'object') {
                console.warn(`[UtilityCraft] Ignored invalid catalyst weaver recipe '${recipeId}'.`)
                continue
            }

            try {
                const status = upsertCatalystWeaverRecipe({ id: recipeId, ...definition })
                if (status === 'replaced') replaced++
                else added++
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register catalyst weaver recipe '${recipeId}':`, err)
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} catalyst weaver recipes.`)
    } catch (err) {
        console.warn('[UtilityCraft] Failed to parse catalyst weaver recipe payload:', err)
    }
})

function upsertCatalystWeaverRecipe(definition) {
    const recipe = defineWeaverRecipe(definition)
    const index = nativeCatalystWeaverRecipes.findIndex(entry => entry.id === recipe.id)

    if (index >= 0) {
        nativeCatalystWeaverRecipes[index] = recipe
        return 'replaced'
    }

    nativeCatalystWeaverRecipes.push(recipe)
    return 'added'
}

export function getCatalystWeaverRecipes() {
    return [
        ...nativeCatalystWeaverRecipes,
        ...buildInfuserWeaverRecipes()
    ]
}

export const catalystWeaverRecipes = getCatalystWeaverRecipes()

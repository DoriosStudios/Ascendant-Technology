import { infuserRecipes } from './infuser.js'

const WEAVER_DEFAULT_ENERGY_COST = 6400
const WEAVER_RATE_PER_TICK = 180
const TICKS_PER_SECOND = 20
const INFUSER_SPEED_MULTIPLIER = 2.5
const MAX_CATALYST_SLOTS = 6
const ENERGY_PER_SECOND = WEAVER_RATE_PER_TICK * TICKS_PER_SECOND

const nativeCatalystWeaverRecipes = [
    defineWeaverRecipe({
        id: 'utilitycraft:lavasteel_ingot',
        input: { id: 'minecraft:iron_ingot', amount: 2 },
        catalysts: [
            { id: 'minecraft:blaze_powder', amount: 1 },
            { id: 'minecraft:magma_cream', amount: 1 },
            null,
            null,
            null,
            null
        ],
        fluid: { type: 'lava', amount: 1000 },
        output: { id: 'minecraft:netherite_scrap', amount: 1 },
        byproduct: { id: 'minecraft:netherrack', amount: 1, chance: 0.35 },
        cost: 3600,
        speedModifier: 1
    }),
    defineWeaverRecipe({
        id: 'utilitycraft:netherite_helm_upgrade',
        input: { id: 'minecraft:skeleton_skull', amount: 1 },
        catalysts: [
            { id: 'minecraft:wither_rose', amount: 1 },
            { id: 'minecraft:soul_sand', amount: 1 },
            { id: 'minecraft:bone', amount: 2 },
            { id: 'minecraft:wither_rose', amount: 1 },
            { id: 'minecraft:soul_sand', amount: 1 },
            { id: 'minecraft:bone', amount: 2 }
        ],
        fluid: { type: 'lava', amount: 2000 },
        output: { id: 'minecraft:wither_skeleton_skull', amount: 1 },
        byproduct: { id: 'minecraft:bone_meal', amount: 4, chance: 0.5 },
        cost: 6400,
        speedModifier: 1
    })
]

function defineWeaverRecipe(recipe, overrideCost) {
    const cost = Math.max(1, overrideCost ?? recipe.cost ?? WEAVER_DEFAULT_ENERGY_COST)
    const speedModifier = normalizeSpeedModifier(recipe.speedModifier)
    return {
        ...recipe,
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
        id: `infuser:${recipeKey}`,
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

export function getCatalystWeaverRecipes() {
    return [
        ...nativeCatalystWeaverRecipes,
        ...buildInfuserWeaverRecipes()
    ]
}

export const catalystWeaverRecipes = getCatalystWeaverRecipes()

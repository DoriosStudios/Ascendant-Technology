// @ts-check

/** @typedef {{ id:string, amount:number }} ItemRequirement */
/** @typedef {{ type:string, amount:number }} FluidRequirement */
/**
 * @typedef {Object} SingularityRecipe
 * @property {string} id
 * @property {string} rarity
 * @property {ItemRequirement} input
 * @property {ItemRequirement} output
 * @property {number} timeSeconds
 * @property {number} energyCost
 * @property {FluidRequirement} fluid
 */
/**
 * @typedef {Object} SingularityRecipeDefinition
 * @property {string} [id]
 * @property {string} [rarity]
 * @property {string | Partial<ItemRequirement>} input
 * @property {string | Partial<ItemRequirement>} [output]
 * @property {number} [timeSeconds]
 * @property {number} [energyCost]
 * @property {Partial<FluidRequirement>} [fluid]
 */

/** @type {Map<string, SingularityRecipe>} */
const recipesByInput = new Map();
/** @type {Map<string, SingularityRecipe>} */
const recipesById = new Map();

/**
 * Registers or replaces one recipe. Inputs are unique so machine lookup stays O(1).
 *
 * @param {SingularityRecipeDefinition} definition
 * @returns {SingularityRecipe | undefined}
 */
export function registerSingularityRecipe(definition) {
    const recipe = normalizeRecipe(definition);
    if (!recipe) return undefined;

    const previousById = recipesById.get(recipe.id);
    if (previousById && previousById.input.id !== recipe.input.id) {
        recipesByInput.delete(previousById.input.id);
    }

    const previousByInput = recipesByInput.get(recipe.input.id);
    if (previousByInput && previousByInput.id !== recipe.id) {
        recipesById.delete(previousByInput.id);
    }

    recipesByInput.set(recipe.input.id, recipe);
    recipesById.set(recipe.id, recipe);
    return recipe;
}

/** @param {Iterable<SingularityRecipeDefinition>} definitions */
export function registerSingularityRecipes(definitions) {
    let registered = 0;
    for (const definition of definitions) {
        if (registerSingularityRecipe(definition)) registered++;
    }
    return registered;
}

/** @param {string} inputTypeId */
export function getSingularityRecipe(inputTypeId) {
    return recipesByInput.get(inputTypeId);
}

/** @param {string} inputTypeId */
export function isSingularityInput(inputTypeId) {
    return recipesByInput.has(inputTypeId);
}

export function getSingularityRecipeCount() {
    return recipesByInput.size;
}

/**
 * Returns the live registry for integrations that only need membership checks.
 * Callers must treat it as read-only.
 */
export function getSingularityRecipeMap() {
    return recipesByInput;
}

/** @param {SingularityRecipeDefinition} definition @returns {SingularityRecipe | undefined} */
function normalizeRecipe(definition) {
    if (!definition || typeof definition !== "object") return undefined;

    const input = normalizeItem(definition.input);
    if (!input) return undefined;

    const output = normalizeItem(definition.output ?? input.id);
    if (!output) return undefined;

    const timeSeconds = positiveNumber(definition.timeSeconds, 1);
    const energyCost = Math.max(1, Math.round(positiveNumber(definition.energyCost, 1)));
    const fluidDefinition = definition.fluid ?? {};
    const fluidType = typeof fluidDefinition.type === "string" && fluidDefinition.type.length > 0
        ? fluidDefinition.type
        : "dark_matter";
    const fluidAmount = Math.max(1, Math.round(positiveNumber(fluidDefinition.amount, timeSeconds * 80)));

    return {
        id: typeof definition.id === "string" && definition.id.length > 0
            ? definition.id
            : `${input.id}->${output.id}`,
        rarity: typeof definition.rarity === "string" ? definition.rarity.toLowerCase() : "common",
        input,
        output,
        timeSeconds,
        energyCost,
        fluid: { type: fluidType, amount: fluidAmount },
    };
}

/** @param {string | Partial<ItemRequirement>} value @returns {ItemRequirement | undefined} */
function normalizeItem(value) {
    if (typeof value === "string" && value.length > 0) {
        return { id: value, amount: 1 };
    }
    if (!value || typeof value !== "object" || typeof value.id !== "string" || value.id.length === 0) {
        return undefined;
    }
    return {
        id: value.id,
        amount: Math.max(1, Math.floor(positiveNumber(value.amount, 1))),
    };
}

/** @param {unknown} value @param {number} fallback */
function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

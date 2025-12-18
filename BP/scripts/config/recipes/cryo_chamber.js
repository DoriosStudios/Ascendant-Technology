/**
 * Cryo Chamber Recipes Configuration
 *
 * This registry follows the same ergonomics as the Catalyst Weaver recipes but
 * now offers additional customization points for datapack authors:
 *
 * - `input` accepts a single `CryoItemStack`, string id, or an array via `inputs`.
 * - `fluid`/`fluids` allow multiple optional fluid sources (cryofluid or water).
 * - The `ui` block customizes on-machine strings and indicator glyphs.
 * - `tags`, `description`, and other metadata assist external tooling.
 *
 * Example:
 * ```js
 * defineCryoRecipe({
 *   category: CATEGORY.COOLING,
 *   inputs: [
 *     { id: 'minecraft:snow', amount: 1 },
 *     { id: 'minecraft:snow_block', amount: 1 }
 *   ],
 *   output: 'minecraft:ice',
 *   fluids: [
 *     { type: 'water', amount: 100, source: 'water' },
 *     { type: 'cryofluid', amount: 50 }
 *   ],
 *   energyCost: 1600,
 *   ui: {
 *     name: 'Snow Compressor',
 *     processingMessage: 'Crystallizing {{input}} → {{output}}'
 *   },
 *   tags: ['ice_chain']
 * });
 * ```
 *
 * Template placeholders available inside `ui.processingMessage` and
 * `ui.completionMessage`:
 * - `{{input}}`, `{{inputAmount}}`
 * - `{{output}}`, `{{outputAmount}}`
 * - `{{energyCost}}`
 * - `{{fluid}}`, `{{fluidAmount}}`
 * - `{{category}}`
 */

const CATEGORY = Object.freeze({
    STABILIZATION: 'stabilization',
    COOLING: 'cooling'
});

const DEFAULT_INDICATOR = 'arrow_right';
const FLUID_SOURCE = Object.freeze({
    WATER: 'water',
    CRYOFLUID: 'cryofluid'
});

/**
 * @typedef {Object} CryoItemStack
 * @property {string} id Full item identifier (e.g. "minecraft:iron_ingot").
 * @property {number} amount Quantity required/produced per craft.
 */

/**
 * @typedef {Object} CryoFluidRequirement
 * @property {string} type Fluid identifier (e.g. "cryofluid").
 * @property {number} amount Millibuckets consumed per craft.
 * @property {'water'|'cryofluid'} [source] Internal tank to consume from
 * (defaults to `water` when type is `water`, otherwise cryofluid).
 * @property {string} [label] Friendly display label (e.g. "Cryofluid").
 */

/**
 * @typedef {Object} CryoRecipeUIHints
 * @property {string} [name] Display label for documentation.
 * @property {string} [description] Optional longer description.
 * @property {string} [indicator] Inventory indicator prefix (defaults to arrow_right).
 * @property {string} [processingMessage] Template used while processing.
 * @property {string} [completionMessage] Template used once craft finishes.
 */

/**
 * @typedef {Object} CryoRecipeDefinition
 * @property {string} [id] Optional unique recipe id (defaults to first input).
 * @property {CryoItemStack|string|(CryoItemStack|string)[]} input Primary input stack (string shorthand supported).
 * @property {(CryoItemStack|string)[]} [inputs] Additional acceptable input variants.
 * @property {CryoItemStack|string} output Result stack (string shorthand supported).
 * @property {CryoFluidRequirement|CryoFluidRequirement[]} [fluid] Optional fluid requirement (accepts single or array via `fluids`).
 * @property {CryoFluidRequirement[]} [fluids] Additional fluid options (first match wins).
 * @property {number} energyCost Dorios Energy cost per craft (DE/tick integration handled elsewhere).
 * @property {number} time Processing ticks used for UI flavor only.
 * @property {'stabilization'|'cooling'} category Recipe bucket used by the machine.
 * @property {string[]} [tags] Optional metadata tags for automation/filters.
 * @property {CryoRecipeUIHints} [ui] Optional UI overrides.
 */

/**
 * @typedef {CryoRecipeDefinition & {
 *   id: string,
 *   inputs: CryoItemStack[],
 *   fluids?: CryoFluidRequirement[],
 *   ui?: CryoRecipeUIHints,
 *   indicatorType?: string,
 *   tags?: string[]
 * }} CryoRecipe
 */

/**
 * Normalizes a Cryo Chamber recipe definition ensuring positive integers and sane defaults.
 * @param {CryoRecipeDefinition} recipe
 * @returns {CryoRecipe}
 */
function defineCryoRecipe(recipe) {
    if (!recipe) {
        throw new Error('Cryo recipe definition is required.');
    }

    const inputs = normalizeInputs(recipe);
    if (!inputs.length) {
        throw new Error('Cryo recipe requires at least one input stack.');
    }

    const output = normalizeStack(recipe.output, 1);
    const id = recipe.id ?? output.id ?? inputs[0].id;
    const fluids = normalizeFluidOptions(recipe);
    const energyCost = normalizePositiveInteger(recipe.energyCost, 1000);
    const time = normalizePositiveInteger(recipe.time, 20);
    const ui = normalizeRecipeUI(recipe.ui);
    const tags = normalizeStringArray(recipe.tags);

    return {
        ...recipe,
        id,
        input: inputs[0],
        inputs,
        output,
        fluid: fluids[0],
        fluids,
        energyCost,
        time,
        ui,
        indicatorType: ui.indicator ?? DEFAULT_INDICATOR,
        tags
    };
}

function normalizeInputs(recipe) {
    const normalized = [];
    const addEntry = (stack) => {
        const entry = normalizeStack(stack, 1);
        if (!normalized.some(existing => existing.id === entry.id && existing.amount === entry.amount)) {
            normalized.push(entry);
        }
    };

    if (recipe.input !== undefined) {
        const baseInput = Array.isArray(recipe.input) ? recipe.input : [recipe.input];
        baseInput.forEach(addEntry);
    }

    if (Array.isArray(recipe.inputs)) {
        recipe.inputs.forEach(addEntry);
    }

    return normalized;
}

function normalizeStack(stack, fallbackAmount = 1) {
    if (typeof stack === 'string') {
        return { id: stack, amount: normalizePositiveInteger(fallbackAmount, 1) };
    }

    if (!stack || typeof stack.id !== 'string') {
        throw new Error('Invalid Cryo recipe stack definition.');
    }

    return {
        id: stack.id,
        amount: normalizePositiveInteger(stack.amount, fallbackAmount)
    };
}

function normalizeFluidOptions(recipe) {
    const options = [];
    const pushOption = (entry) => {
        const normalized = normalizeFluid(entry);
        if (normalized) {
            options.push(normalized);
        }
    };

    if (recipe.fluid) {
        pushOption(recipe.fluid);
    }

    if (Array.isArray(recipe.fluids)) {
        recipe.fluids.forEach(pushOption);
    }

    return options;
}

function normalizeFluid(fluid) {
    if (!fluid) return undefined;

    const base = typeof fluid === 'string'
        ? { type: fluid, amount: 1 }
        : fluid;

    if (typeof base.type !== 'string') {
        throw new Error('Invalid Cryo recipe fluid definition.');
    }

    const amount = normalizePositiveInteger(base.amount, 1);
    const source = normalizeFluidSource(base.source, base.type);
    const label = typeof base.label === 'string' && base.label.length > 0 ? base.label : undefined;

    return {
        type: base.type,
        amount,
        source,
        label
    };
}

function normalizeFluidSource(source, typeHint) {
    if (typeof source === 'string') {
        const normalized = source.toLowerCase();
        if (normalized === FLUID_SOURCE.WATER) return FLUID_SOURCE.WATER;
        if (normalized === FLUID_SOURCE.CRYOFLUID) return FLUID_SOURCE.CRYOFLUID;
    }
    return typeHint === 'water' ? FLUID_SOURCE.WATER : FLUID_SOURCE.CRYOFLUID;
}

function normalizeRecipeUI(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }

    return {
        name: stringOrUndefined(raw.name),
        description: stringOrUndefined(raw.description),
        indicator: stringOrUndefined(raw.indicator) ?? undefined,
        processingMessage: stringOrUndefined(raw.processingMessage),
        completionMessage: stringOrUndefined(raw.completionMessage)
    };
}

function stringOrUndefined(value) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value) {
    if (!value) return undefined;
    const array = Array.isArray(value) ? value : [value];
    const filtered = array
        .map(entry => typeof entry === 'string' ? entry.trim() : '')
        .filter(Boolean);
    const unique = [...new Set(filtered)];
    return unique.length ? unique : undefined;
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

/**
 * Stabilization recipes for volatile materials.
 * These require cryofluid to maintain stable temperatures.
 * @type {CryoRecipe[]}
 */
const stabilizationRecipes = [
    defineCryoRecipe({
        id: 'utilitycraft:unstable_aetherium_stabilization',
        category: CATEGORY.STABILIZATION,
        input: { id: 'utilitycraft:unstable_aetherium_ingot', amount: 1 },
        output: { id: 'utilitycraft:stable_aetherium_ingot', amount: 1 },
        fluid: { type: 'cryofluid', amount: 500, label: 'Cryofluid' },
        energyCost: 8000,
        time: 200,
        tags: ['aetherium', 'stabilization'],
        ui: {
            name: 'Stable Aetherium',
            description: 'Locks unstable ingots using a cryogenic bath.',
            processingMessage: 'Stabilizing {{input}}',
            completionMessage: '{{output}} secured'
        }
    }),
    defineCryoRecipe({
        id: 'utilitycraft:volatile_alloy_stabilization',
        category: CATEGORY.STABILIZATION,
        input: { id: 'utilitycraft:volatile_alloy_dust', amount: 1 },
        output: { id: 'utilitycraft:stabilized_alloy_dust', amount: 1 },
        fluid: { type: 'cryofluid', amount: 250, label: 'Cryofluid' },
        energyCost: 4000,
        time: 100,
        tags: ['alloy', 'stabilization'],
        ui: {
            processingMessage: 'Cooling {{input}} dust',
            completionMessage: 'Alloy stabilized'
        }
    }),
    defineCryoRecipe({
        id: 'utilitycraft:reactive_crystal_stabilization',
        category: CATEGORY.STABILIZATION,
        input: { id: 'utilitycraft:reactive_crystal', amount: 1 },
        output: { id: 'utilitycraft:inert_crystal', amount: 1 },
        fluid: { type: 'cryofluid', amount: 1000, label: 'Cryofluid' },
        energyCost: 12000,
        time: 300,
        tags: ['crystal'],
        ui: {
            indicator: 'arrow_diag',
            processingMessage: 'Neutralizing {{input}}',
            completionMessage: '{{output}} ready'
        }
    })
];

/**
 * Cooling recipes for items and food.
 * Converts heated/normal items to their cold variants using energy only.
 * @type {CryoRecipe[]}
 */
const coolingRecipes = [
    // Food cooling
    defineCryoRecipe({
        id: 'utilitycraft:frozen_beef',
        category: CATEGORY.COOLING,
        inputs: [
            { id: 'minecraft:cooked_beef', amount: 1 },
            { id: 'minecraft:beef', amount: 1 }
        ],
        output: { id: 'utilitycraft:frozen_beef', amount: 1 },
        energyCost: 2400,
        time: 40,
        tags: ['food'],
        ui: {
            processingMessage: 'Blast freezing {{input}}',
            completionMessage: '{{output}} packed'
        }
    }),
    defineCryoRecipe({
        id: 'utilitycraft:frozen_porkchop',
        category: CATEGORY.COOLING,
        inputs: [
            { id: 'minecraft:cooked_porkchop', amount: 1 },
            { id: 'minecraft:porkchop', amount: 1 }
        ],
        output: { id: 'utilitycraft:frozen_porkchop', amount: 1 },
        energyCost: 2400,
        time: 40,
        tags: ['food']
    }),
    defineCryoRecipe({
        id: 'utilitycraft:frozen_chicken',
        category: CATEGORY.COOLING,
        inputs: [
            { id: 'minecraft:cooked_chicken', amount: 1 },
            { id: 'minecraft:chicken', amount: 1 }
        ],
        output: { id: 'utilitycraft:frozen_chicken', amount: 1 },
        energyCost: 2400,
        time: 40,
        tags: ['food']
    }),
    // Tool cooling
    defineCryoRecipe({
        id: 'utilitycraft:cooled_tool_core',
        category: CATEGORY.COOLING,
        input: { id: 'utilitycraft:overheated_tool_core', amount: 1 },
        output: { id: 'utilitycraft:cooled_tool_core', amount: 1 },
        energyCost: 12000,
        time: 120,
        ui: {
            processingMessage: 'Reinforcing tool core',
            completionMessage: 'Tool core stabilized'
        }
    }),
    // Material cooling
    defineCryoRecipe({
        id: 'utilitycraft:cooled_ingot',
        category: CATEGORY.COOLING,
        inputs: [
            { id: 'utilitycraft:heated_ingot', amount: 1 },
            { id: 'utilitycraft:molten_ingot', amount: 1 }
        ],
        output: { id: 'utilitycraft:cooled_ingot', amount: 1 },
        energyCost: 4800,
        time: 60,
        ui: {
            indicator: 'arrow_split',
            processingMessage: 'Tempering {{input}}'
        }
    }),
    // Ice production chain
    defineCryoRecipe({
        id: 'utilitycraft:snow_to_ice',
        category: CATEGORY.COOLING,
        inputs: [
            { id: 'minecraft:snow', amount: 1 },
            { id: 'minecraft:snow_block', amount: 1 }
        ],
        output: { id: 'minecraft:ice', amount: 1 },
        fluid: { type: 'water', amount: 100, source: 'water', label: 'Water' },
        energyCost: 1600,
        time: 20,
        tags: ['ice_chain'],
        ui: {
            processingMessage: 'Crystallizing {{input}}',
            completionMessage: '{{output}} formed'
        }
    }),
    defineCryoRecipe({
        id: 'utilitycraft:ice_to_packed',
        category: CATEGORY.COOLING,
        input: { id: 'minecraft:ice', amount: 1 },
        output: { id: 'minecraft:packed_ice', amount: 1 },
        energyCost: 4000,
        time: 60,
        ui: {
            processingMessage: 'Compressing ice layers'
        }
    }),
    defineCryoRecipe({
        id: 'utilitycraft:packed_to_blue',
        category: CATEGORY.COOLING,
        input: { id: 'minecraft:packed_ice', amount: 1 },
        output: { id: 'minecraft:blue_ice', amount: 1 },
        energyCost: 8000,
        time: 100,
        ui: {
            processingMessage: 'Forging {{output}}',
            completionMessage: 'Blue Ice ready'
        }
    })
];

/**
 * Cryofluid generation conversion rate definition.
 * @typedef {Object} CryofluidGenerationConfig
 * @property {string} inputFluid Source fluid identifier.
 * @property {string} outputFluid Result fluid identifier.
 * @property {number} conversionRate Ratio applied per millibucket (0.8 = 80%).
 * @property {number} energyCostPer1000mB Energy required to convert 1000 mB of input.
 * @property {number} processTime Baseline ticks for 1000 mB conversions.
 * @property {number} [minInput] Minimum millibuckets of input fluid required per process.
 * @property {number} [minOutput] Minimum millibuckets of output room required per process.
 * @property {number} [maxProcessPerTick] Max millibuckets processed per tick.
 * @property {CryofluidCatalystRequirement} [catalyst] Optional legacy single catalyst definition.
 * @property {CryofluidCatalystRequirement[]} [catalysts] Optional array of catalysts (first matching item is used).
 */

/**
 * @typedef {Object} CryofluidCatalystRequirement
 * @property {string} itemId Item identifier that acts as catalyst (e.g. "utilitycraft:titanium").
 * @property {number} itemsPerProcess Item count consumed per catalyst cycle.
 * @property {number} waterPerItem Millibuckets of input fluid processed per catalyst cycle.
 * @property {number} [cryoPerItem] Millibuckets of cryofluid produced per catalyst item (defaults to waterPerItem * conversionRate).
 * @property {string} [label] Optional display label used in UI messages.
 */

/** @type {CryofluidGenerationConfig} */
const defaultTitaniumCatalyst = {
    itemId: 'utilitycraft:titanium',
    label: 'Titanium',
    itemsPerProcess: 1,
    waterPerItem: 1000,
    cryoPerItem: 800
};

const cryofluidGeneration = {
    inputFluid: 'water',
    outputFluid: 'cryofluid',
    conversionRate: 0.8, // 1000 mB water → 800 mB cryofluid
    energyCostPer1000mB: 32000,
    processTime: 80, // ticks per 1000 mB
    minInput: 100,
    minOutput: 50,
    maxProcessPerTick: 1000,
    catalyst: defaultTitaniumCatalyst,
    catalysts: [
        defaultTitaniumCatalyst,
        {
            itemId: 'utilitycraft:raw_titanium',
            label: 'Raw Titanium',
            itemsPerProcess: 1,
            waterPerItem: 1000,
            cryoPerItem: 1600
        }
    ]
};

/**
 * Returns all stabilization recipes.
 * @returns {Array} Stabilization recipe list
 */
export function getStabilizationRecipes() {
    return stabilizationRecipes;
}

/**
 * Returns all cooling recipes.
 * @returns {Array} Cooling recipe list
 */
export function getCoolingRecipes() {
    return coolingRecipes;
}

/**
 * Returns the cryofluid generation configuration.
 * @returns {Object} Cryofluid generation config
 */
export function getCryofluidGenerationConfig() {
    return cryofluidGeneration;
}

/**
 * Returns all recipes combined for the Cryo Chamber.
 * @returns {Object} Object with all recipe categories
 */
export function getCryoChamberRecipes() {
    return {
        stabilization: stabilizationRecipes,
        cooling: coolingRecipes,
        generation: cryofluidGeneration
    };
}

// @ts-check

import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

const DEFAULT_COST = 3200;
const INFUSER_SPEED = 2.5;
const SIGNATURE_SEPARATOR = "\u0001";

/** @type {Map<string, Map<string, object | object[]>>} */
const recipesByInput = new Map();
/** @type {Map<string, any>} */
const recipesById = new Map();

export const catalystWeaverRecipeDefinitions = {
    "utilitycraft:aetherium_ingot": {
        input: { id: "minecraft:gold_ingot", amount: 1 },
        catalysts: [
            { id: "utilitycraft:steel_ingot", amount: 1 },
            { id: "utilitycraft:energized_iron_ingot", amount: 1 },
            { id: "utilitycraft:ender_pearl_dust", amount: 4 },
            { id: "utilitycraft:aetherium_shard", amount: 4 },
        ],
        fluid: { type: "lava", amount: 8000 },
        output: { id: "utilitycraft:aetherium", amount: 1 },
        byproduct: {
            id: "utilitycraft:stabilized_obsidian_dust",
            amount: [0, 2],
            chance: 0.05,
        },
        cost: 12000,
        speed: 0.5,
    },
    "utilitycraft:hyper_processing_upgrade": {
        input: { id: "utilitycraft:speed_upgrade", amount: 1 },
        catalysts: [
            { id: "utilitycraft:energized_iron_dust", amount: 2 },
            { id: "utilitycraft:aetherium_dust", amount: 1 },
            { id: "utilitycraft:titanium_dust", amount: 1 },
        ],
        output: { id: "utilitycraft:hyper_processing_upgrade", amount: 1 },
        cost: 12800,
        speed: 0.25,
    },
    "utilitycraft:refined_aetherium_shard": {
        input: { id: "utilitycraft:aetherium_shard", amount: 1 },
        catalysts: [{ id: "minecraft:amethyst_shard", amount: 1 }],
        fluid: { type: "dark_matter", amount: 800 },
        output: { id: "utilitycraft:refined_aetherium_shard", amount: 1 },
        speed: 1,
    },
    "at:easter_egg": {
        input: { id: "minecraft:redstone_block", amount: 1 },
        catalysts: [
            { id: "minecraft:obsidian", amount: 1 },
            { id: "minecraft:crying_obsidian", amount: 1 },
            { id: "minecraft:amethyst_block", amount: 1 },
            { id: "utilitycraft:aetherium_shard", amount: 4 },
            { id: "utilitycraft:bag_of_purple_dye", amount: 1 },
            { id: "utilitycraft:bag_of_blue_dye", amount: 1 },
        ],
        fluid: { type: "dark_matter", amount: 1000 },
        output: { id: "utilitycraft:compressed_block", amount: 1 },
        cost: 1,
        speed: 20,
    },
    "utilitycraft:diamond_recovery": {
        input: { id: "utilitycraft:diamond_dust", amount: 2 },
        catalysts: [{ id: "minecraft:iron_ingot", amount: 1 }],
        fluid: { type: "lava", amount: 100 },
        output: { id: "minecraft:diamond", amount: 1 },
        speed: 1,
    },
    "utilitycraft:emerald_recovery": {
        input: { id: "utilitycraft:emerald_dust", amount: 2 },
        catalysts: [{ id: "minecraft:iron_ingot", amount: 1 }],
        fluid: { type: "lava", amount: 100 },
        output: { id: "minecraft:emerald", amount: 1 },
        cost: 3200,
        speed: 1,
    },
    "utilitycraft:quartz_recovery": {
        input: { id: "utilitycraft:quartz_dust", amount: 2 },
        catalysts: [{ id: "minecraft:iron_ingot", amount: 1 }],
        fluid: { type: "lava", amount: 100 },
        output: { id: "minecraft:quartz", amount: 1 },
        cost: 3200,
        speed: 1,
    },
    "utilitycraft:amethyst_recovery": {
        input: { id: "utilitycraft:amethyst_dust", amount: 2 },
        catalysts: [{ id: "minecraft:iron_ingot", amount: 1 }],
        fluid: { type: "lava", amount: 100 },
        output: { id: "minecraft:amethyst_shard", amount: 1 },
        cost: 3200,
        speed: 1,
    },
    "utilitycraft:void_essence": {
        input: { id: "minecraft:glass_bottle", amount: 1 },
        catalysts: [{ id: "utilitycraft:crushed_endstone", amount: 1 }],
        fluid: { type: "dark_matter", amount: 100 },
        output: { id: "utilitycraft:void_essence", amount: 1 },
        cost: 32000,
        speed: 0.5,
    }
};

for (const [id, definition] of Object.entries(catalystWeaverRecipeDefinitions)) {
    upsertRecipe(id, definition);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== DoriosLib.registry.REGISTRATION_EVENT_IDS.INFUSER_RECIPE) return;

    let payload;
    try {
        payload = JSON.parse(message);
    } catch {
        return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

    for (const [key, definition] of Object.entries(payload)) {
        const converted = convertInfuserRecipe(key, definition);
        if (converted) upsertRecipe(`infuser:${key}`, converted);
    }
});

export function getCatalystWeaverRecipe(inputTypeId, inputAmount, catalystTotals) {
    const signatureIndex = recipesByInput.get(inputTypeId);
    if (!signatureIndex) return undefined;

    const indexed = signatureIndex.get(createCatalystSignature(catalystTotals.keys()));
    if (!indexed) return undefined;
    if (!Array.isArray(indexed)) return indexed;

    for (let index = 0; index < indexed.length; index++) {
        const recipe = indexed[index];
        if (hasRequiredAmounts(recipe, inputAmount, catalystTotals)) return recipe;
    }
    return indexed[0];
}

export function createCatalystSignature(typeIds) {
    return Array.from(typeIds).sort().join(SIGNATURE_SEPARATOR);
}

export function getCatalystWeaverRecipeCount() {
    return recipesById.size;
}

function upsertRecipe(id, definition) {
    const recipe = normalizeRecipe(id, definition);
    if (!recipe) return false;

    const previous = recipesById.get(id);
    if (previous) removeIndexedRecipe(previous);

    let signatureIndex = recipesByInput.get(recipe.input.id);
    if (!signatureIndex) {
        signatureIndex = new Map();
        recipesByInput.set(recipe.input.id, signatureIndex);
    }

    const indexed = signatureIndex.get(recipe.signature);
    if (!indexed) signatureIndex.set(recipe.signature, recipe);
    else if (Array.isArray(indexed)) indexed.push(recipe);
    else signatureIndex.set(recipe.signature, [indexed, recipe]);

    recipesById.set(id, recipe);
    return true;
}

function removeIndexedRecipe(recipe) {
    const signatureIndex = recipesByInput.get(recipe.input.id);
    if (!signatureIndex) return;

    const indexed = signatureIndex.get(recipe.signature);
    if (Array.isArray(indexed)) {
        const position = indexed.indexOf(recipe);
        if (position >= 0) indexed.splice(position, 1);
        if (indexed.length === 1) signatureIndex.set(recipe.signature, indexed[0]);
        else if (indexed.length === 0) signatureIndex.delete(recipe.signature);
    } else if (indexed === recipe) {
        signatureIndex.delete(recipe.signature);
    }

    if (signatureIndex.size === 0) recipesByInput.delete(recipe.input.id);
}

function normalizeRecipe(id, definition) {
    if (!definition || typeof definition !== "object") return undefined;
    const inputId = definition.input?.id;
    const outputId = definition.output?.id;
    if (typeof inputId !== "string" || typeof outputId !== "string") return undefined;

    const catalystAmounts = new Map();
    const sourceCatalysts = Array.isArray(definition.catalysts) ? definition.catalysts : [];
    for (let index = 0; index < sourceCatalysts.length && index < 6; index++) {
        const catalyst = sourceCatalysts[index];
        if (!catalyst || typeof catalyst.id !== "string") continue;
        const amount = positiveInteger(catalyst.amount, 1);
        catalystAmounts.set(catalyst.id, (catalystAmounts.get(catalyst.id) ?? 0) + amount);
    }

    const catalysts = [];
    for (const [catalystId, amount] of catalystAmounts) {
        catalysts.push({ id: catalystId, amount });
    }

    /** @type {any} */
    const recipe = {
        id,
        input: { id: inputId, amount: positiveInteger(definition.input.amount, 1) },
        catalysts,
        signature: createCatalystSignature(catalystAmounts.keys()),
        output: { id: outputId, amount: positiveInteger(definition.output.amount, 1) },
        cost: positiveNumber(definition.cost, DEFAULT_COST),
        speed: positiveNumber(definition.speed ?? definition.speedModifier, 1),
    };

    if (definition.fluid?.type && positiveInteger(definition.fluid.amount, 0) > 0) {
        recipe.fluid = {
            type: String(definition.fluid.type),
            amount: positiveInteger(definition.fluid.amount, 0),
        };
    }

    if (definition.byproduct?.id) {
        recipe.byproduct = {
            id: String(definition.byproduct.id),
            amount: normalizeByproductAmount(definition.byproduct.amount),
            chance: clampChance(definition.byproduct.chance),
        };
    }
    return recipe;
}

function convertInfuserRecipe(key, definition) {
    if (typeof key !== "string" || !definition || typeof definition !== "object") return undefined;
    const separator = key.indexOf("|");
    if (separator <= 0 || separator >= key.length - 1 || typeof definition.output !== "string") {
        return undefined;
    }

    const catalystId = key.slice(0, separator);
    const inputId = key.slice(separator + 1);
    /** @type {any} */
    const recipe = {
        input: { id: inputId, amount: positiveInteger(definition.input_required ?? definition.inputAmount, 1) },
        catalysts: [{ id: catalystId, amount: positiveInteger(definition.required ?? definition.catalystAmount, 1) }],
        output: { id: definition.output, amount: positiveInteger(definition.amount ?? definition.outputAmount, 1) },
        cost: positiveNumber(definition.cost, DEFAULT_COST) / INFUSER_SPEED,
        speed: positiveNumber(definition.speedModifier, INFUSER_SPEED),
    };
    if (definition.fluid?.type && definition.fluid?.amount) recipe.fluid = definition.fluid;
    return recipe;
}

function hasRequiredAmounts(recipe, inputAmount, catalystTotals) {
    if (inputAmount < recipe.input.amount) return false;
    for (let index = 0; index < recipe.catalysts.length; index++) {
        const catalyst = recipe.catalysts[index];
        if ((catalystTotals.get(catalyst.id) ?? 0) < catalyst.amount) return false;
    }
    return true;
}

function normalizeByproductAmount(value) {
    if (Array.isArray(value)) {
        const minimum = Math.max(0, Math.floor(Number(value[0]) || 0));
        const maximum = Math.max(minimum, Math.floor(Number(value[1]) || minimum));
        return [minimum, maximum];
    }
    return positiveInteger(value, 1);
}

function positiveInteger(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampChance(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(1, parsed));
}

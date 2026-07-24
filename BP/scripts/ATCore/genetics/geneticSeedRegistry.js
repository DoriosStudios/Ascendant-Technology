// @ts-check

import { system } from "@minecraft/server";

const recipes = new Map();
const soils = new Map();
const dropOverridesByInput = new Map();

/** Registers or replaces accepted soil cost multipliers. */
export function registerGeneticSoils(definitions) {
    if (!definitions || typeof definitions !== "object") return 0;

    let registered = 0;
    for (const [typeId, definition] of Object.entries(definitions)) {
        const cost = Number(definition?.cost);
        if (!typeId || !Number.isFinite(cost) || cost <= 0) continue;
        soils.set(typeId, { typeId, cost });
        registered++;
    }
    return registered;
}

/**
 * Registers plant recipes in an O(1) runtime index. Drop overrides are applied
 * once here, never while a machine is ticking.
 */
export function registerGeneticSeedRecipes(definitions, dropOverrides = {}) {
    if (!definitions || typeof definitions !== "object") return 0;

    let registered = 0;
    for (const [inputTypeId, definition] of Object.entries(definitions)) {
        const incomingOverrides = dropOverrides[inputTypeId];
        if (incomingOverrides && typeof incomingOverrides === "object") {
            dropOverridesByInput.set(inputTypeId, incomingOverrides);
        }
        const recipe = normalizeRecipe(
            inputTypeId,
            definition,
            dropOverridesByInput.get(inputTypeId),
        );
        if (!recipe) continue;
        recipes.set(inputTypeId, recipe);
        registered++;
    }
    return registered;
}

export function getGeneticSeedRecipe(inputTypeId) {
    return recipes.get(inputTypeId) ?? null;
}

export function getGeneticSoil(typeId) {
    return soils.get(typeId) ?? null;
}

export function getGeneticSeedRecipeCount() {
    return recipes.size;
}

function normalizeRecipe(inputTypeId, definition, overrides) {
    if (!inputTypeId || !definition || !Array.isArray(definition.drops)) return null;

    const drops = [];
    const outputTypeIds = new Set();
    let expectedBase = 0;
    let expectedBonus = 0;

    for (const rawDrop of definition.drops) {
        if (!rawDrop || typeof rawDrop.item !== "string" || rawDrop.item.length === 0) continue;
        const item = overrides?.[rawDrop.item] ?? rawDrop.item;
        const chance = clamp(Number(rawDrop.chance), 0, 1);
        if (chance <= 0) continue;

        const amount = normalizeAmount(rawDrop.amount);
        const reproductive = isReproductiveDrop(item, inputTypeId);
        const average = Array.isArray(amount) ? (amount[0] + amount[1]) / 2 : amount;
        drops.push({ item, amount, chance, reproductive });
        outputTypeIds.add(item);
        expectedBase += average * chance;
        if (!reproductive) expectedBonus += average * chance;
    }

    if (drops.length === 0) return null;
    const cost = Math.max(1, Number(definition.cost) || 8000);
    const tier = Math.max(0, Math.log2(cost / 8000));

    return {
        id: inputTypeId,
        cost,
        drops,
        outputTypeIds,
        expectedBase,
        expectedBonus,
        cycleSeconds: 2.6 + tier * 0.55,
    };
}

function normalizeAmount(value) {
    if (Array.isArray(value)) {
        const minimum = Math.max(0, Math.floor(Number(value[0]) || 0));
        const maximum = Math.max(minimum, Math.floor(Number(value[1]) || minimum));
        return [minimum, maximum];
    }
    return Math.max(1, Math.floor(Number(value) || 1));
}

function isReproductiveDrop(itemTypeId, inputTypeId) {
    return itemTypeId === inputTypeId
        || itemTypeId.endsWith("_seeds")
        || itemTypeId.endsWith("_sapling")
        || itemTypeId.endsWith("_propagule")
        || itemTypeId.endsWith("_fungus")
        || itemTypeId === "minecraft:wheat_seeds"
        || itemTypeId === "minecraft:beetroot_seeds"
        || itemTypeId === "minecraft:melon_seeds"
        || itemTypeId === "minecraft:pumpkin_seeds";
}

function clamp(value, minimum, maximum) {
    if (!Number.isFinite(value)) return minimum;
    return Math.max(minimum, Math.min(maximum, value));
}

function registerPlantPayload(payload) {
    registerGeneticSeedRecipes(payload);
}

function registerLegacyBonsaiPayload(payload) {
    if (!payload || typeof payload !== "object") return;
    const definitions = {};
    for (const entry of Object.values(payload)) {
        if (!entry || typeof entry.sapling !== "string") continue;
        definitions[entry.sapling] = entry;
    }
    registerGeneticSeedRecipes(definitions);
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_plant" && id !== "utilitycraft:register_bonsai") return;
    try {
        const payload = JSON.parse(message);
        if (id === "utilitycraft:register_plant") registerPlantPayload(payload);
        else registerLegacyBonsaiPayload(payload);
    } catch (error) {
        console.warn(`[Ascendant Technology] Invalid genetic plant registration: ${error}`);
    }
});

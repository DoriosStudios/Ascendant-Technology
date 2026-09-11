// @ts-check

const catalystsByInput = new Map();
const lapisSourcesByInput = new Map();

const cryogenTitaniumValues = Object.freeze({
    "utilitycraft:titanium_nugget": 1,
    "utilitycraft:titanium_dust": 4,
    "utilitycraft:titanium_chunk": 4,
    "utilitycraft:raw_titanium": 16,
    "utilitycraft:titanium": 8,
    "utilitycraft:titanium_plate": 8,
    "utilitycraft:raw_titanium_block": 144,
    "utilitycraft:titanium_block": 72,
    "utilitycraft:compressed_raw_titanium_block": 1_296,
    "utilitycraft:compressed_titanium_block": 648,
    "utilitycraft:compressed_raw_titanium_block_2": 11_664,
    "utilitycraft:compressed_titanium_block_2": 5_832,
    "utilitycraft:compressed_raw_titanium_block_3": 104_976,
    "utilitycraft:compressed_titanium_block_3": 52_488,
    "utilitycraft:compressed_raw_titanium_block_4": 944_784,
    "utilitycraft:compressed_titanium_block_4": 472_392,
});

const cryogenLapisValues = Object.freeze({
    "minecraft:lapis_lazuli": 1,
    "minecraft:lapis_ore": 2,
    "minecraft:deepslate_lapis_ore": 5,
    "minecraft:lapis_block": 9,
    "utilitycraft:compressed_lapislazuli_block": 81,
    "utilitycraft:compressed_lapislazuli_block_2": 729,
    "utilitycraft:compressed_lapislazuli_block_3": 6_561,
    "utilitycraft:compressed_lapislazuli_block_4": 59_049,
});

export const cryogenGeneration = {
    lapis: { id: "minecraft:lapis_lazuli", amount: 8 },
    cost: 1600,
    ticks: 80,
};

export const cryogenLapisDefinitions = {
    ...createLapisDefinitions(cryogenLapisValues),
    "minecraft:lapis_ore": {
        input: { id: "minecraft:lapis_ore", amount: 4 },
        yieldMultiplier: 0.75,
    },
    "minecraft:deepslate_lapis_ore": {
        input: { id: "minecraft:deepslate_lapis_ore", amount: 3 },
        yieldMultiplier: 0.75,
    },
};

export const cryogenCatalystDefinitions = {
    ...createTitaniumDefinitions(cryogenTitaniumValues),
    "utilitycraft:raw_titanium": {
        input: { id: "utilitycraft:raw_titanium", amount: 1 },
        water: 1000,
        cryofluid: 1600,
    },
    "utilitycraft:raw_titanium_block": {
        input: { id: "utilitycraft:raw_titanium_block", amount: 1 },
        water: 8000,
        cryofluid: 25600,
    },
    "utilitycraft:titanium_block": {
        input: { id: "utilitycraft:titanium_block", amount: 1 },
        water: 8000,
        cryofluid: 12800,
    },
};

for (const definition of Object.values(cryogenCatalystDefinitions)) {
    catalystsByInput.set(definition.input.id, definition);
}

for (const definition of Object.values(cryogenLapisDefinitions)) {
    lapisSourcesByInput.set(definition.input.id, definition);
}

export function getCryogenCatalyst(inputTypeId) {
    return catalystsByInput.get(inputTypeId);
}

export function getCryogenLapisSource(inputTypeId) {
    return lapisSourcesByInput.get(inputTypeId);
}

export const cryogenSynthesisRecipe = Object.freeze({
    energyCost: 6_000,
    water: 1_000,
    cryofluid: 1_000,
    inputs: Object.freeze({
        titanium: Object.freeze({
            requiredValue: 4,
            alternatives: cryogenTitaniumValues,
        }),
        lapis: Object.freeze({
            requiredValue: 8,
            alternatives: cryogenLapisValues,
        }),
    }),
});

export function getCryogenSynthesisInputValue(group, typeId) {
    return Math.max(0, Number(group?.alternatives?.[typeId]) || 0);
}

function createTitaniumDefinitions(values) {
    return Object.fromEntries(Object.entries(values).map(([id, value]) => {
        const batches = Math.max(1, value / 8);
        return [id, {
            input: { id, amount: Math.max(1, Math.ceil(8 / value)) },
            water: Math.round(1_000 * batches),
            cryofluid: Math.round(800 * batches),
        }];
    }));
}

function createLapisDefinitions(values) {
    return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, {
        input: { id, amount: Math.max(1, Math.ceil(8 / value)) },
        yieldMultiplier: Math.max(1, value / 8),
    }]));
}

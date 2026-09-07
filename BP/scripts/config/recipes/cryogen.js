// @ts-check

const catalystsByInput = new Map();
const lapisSourcesByInput = new Map();

export const cryogenGeneration = {
    lapis: { id: "minecraft:lapis_lazuli", amount: 8 },
    cost: 1600,
    ticks: 80,
};

export const cryogenLapisDefinitions = {
    "minecraft:lapis_lazuli": {
        input: { id: "minecraft:lapis_lazuli", amount: 8 },
        yieldMultiplier: 1,
    },
    "minecraft:lapis_block": {
        input: { id: "minecraft:lapis_block", amount: 1 },
        yieldMultiplier: 1.125,
    },
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
    "utilitycraft:titanium": {
        input: { id: "utilitycraft:titanium", amount: 1 },
        water: 1000,
        cryofluid: 800,
    },
    "utilitycraft:raw_titanium": {
        input: { id: "utilitycraft:raw_titanium", amount: 1 },
        water: 1000,
        cryofluid: 1600,
    },
    "utilitycraft:raw_titanium_block": {
        input: { id: "utilitycraft:raw_titanium_block", amount: 1 },
        water: 8000,
        cryofluid: 12800,
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
            requiredValue: 8,
            alternatives: Object.freeze({
                "utilitycraft:titanium": 8,
                "utilitycraft:titanium_plate": 8,
                "utilitycraft:raw_titanium": 4,
                "utilitycraft:titanium_dust": 2,
                "utilitycraft:titanium_chunk": 2,
                "utilitycraft:titanium_nugget": 1,
            }),
        }),
        lapis: Object.freeze({
            requiredValue: 1,
            alternatives: Object.freeze({
                "minecraft:lapis_lazuli": 1,
                "minecraft:lapis_block": 9,
            }),
        }),
    }),
});

export function getCryogenSynthesisInputValue(group, typeId) {
    return Math.max(0, Number(group?.alternatives?.[typeId]) || 0);
}


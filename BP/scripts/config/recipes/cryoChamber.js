// @ts-check

const catalystsByInput = new Map();
const lapisSourcesByInput = new Map();

export const cryoChamberGeneration = {
    lapis: { id: "minecraft:lapis_lazuli", amount: 8 },
    cost: 1600,
    ticks: 80,
};

export const cryoChamberLapisDefinitions = {
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

export const cryoChamberCatalystDefinitions = {
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

for (const definition of Object.values(cryoChamberCatalystDefinitions)) {
    catalystsByInput.set(definition.input.id, definition);
}

for (const definition of Object.values(cryoChamberLapisDefinitions)) {
    lapisSourcesByInput.set(definition.input.id, definition);
}

export function getCryoChamberCatalyst(inputTypeId) {
    return catalystsByInput.get(inputTypeId);
}

export function getCryoChamberLapisSource(inputTypeId) {
    return lapisSourcesByInput.get(inputTypeId);
}

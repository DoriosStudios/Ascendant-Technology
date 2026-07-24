// @ts-check

const catalystsByInput = new Map();

export const cryoChamberGeneration = {
    lapis: { id: "minecraft:lapis_lazuli", amount: 8 },
    cost: 32000,
    ticks: 80,
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
};

for (const definition of Object.values(cryoChamberCatalystDefinitions)) {
    catalystsByInput.set(definition.input.id, definition);
}

export function getCryoChamberCatalyst(inputTypeId) {
    return catalystsByInput.get(inputTypeId);
}

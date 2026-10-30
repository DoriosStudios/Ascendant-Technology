// The legacy processor remains registered so placed blocks and resource lore survive.
// All three machines deliberately share the 31-slot container contract.
export const STEAM_MACHINES = {
    "utilitycraft:steam_boiler": {
        slots: [5, 6], energyCapacity: 128000, tankCapacity: 32000,
        baseRate: 80, recipeType: "steam_boiler", legacy: false,
    },
    "utilitycraft:vaporizer": {
        slots: [5, 6, 7, 8], energyCapacity: 1024000, tankCapacity: 128000,
        baseRate: 640, recipeType: "vaporizer", legacy: false,
    },
    "utilitycraft:vaporworks_processor": {
        slots: [5, 6, 7, 8], energyCapacity: 512000, tankCapacity: 128000,
        baseRate: 640, recipeType: "vaporworks_processor", legacy: true,
    },
};

export const STEAM_BOILER_RECIPE = {
    id: "utilitycraft:boiler_water_to_steam",
    inputFluid: { type: "water", amount: 1000 },
    outputGas: { type: "steam", amount: 1000 },
    cost: 2400,
    ticks: 160,
};

export const VAPORIZER_RECIPES = {
    "utilitycraft:water_to_steam": {
        inputFluid: { type: "water", amount: 1000 },
        outputGas: { type: "steam", amount: 1000 }, cost: 1600, ticks: 80,
    },
    "utilitycraft:cryofluid_to_steam": {
        inputFluid: { type: "cryofluid", amount: 1000 },
        outputGas: { type: "steam", amount: 1500 }, cost: 2400, ticks: 120,
    },
    "utilitycraft:saline_coolant_to_steam": {
        inputFluid: { type: "saline_coolant", amount: 1000 },
        outputGas: { type: "steam", amount: 1500 }, cost: 2000, ticks: 100,
    },
};

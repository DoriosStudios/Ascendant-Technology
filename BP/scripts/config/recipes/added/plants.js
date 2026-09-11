import * as DoriosLib from "DoriosLib/index.js";

export const plantAdditions = {
    "utilitycraft:titanium_seeds": {
        tier: 3,
        cost: 512000,
        drops: [
            {
                item: "utilitycraft:raw_titanium",
                amount: [2, 4],
                chance: 1,
            },
            {
                item: "utilitycraft:titanium_seeds",
                amount: 1,
                chance: 0.08,
            },
        ],
    },

    "utilitycraft:tungsten_seeds": {
        tier: 3,
        cost: 512000,
        drops: [
            {
                item: "utilitycraft:raw_tungsten",
                amount: [2, 4],
                chance: 1,
            },
            {
                item: "utilitycraft:tungsten_seeds",
                amount: 1,
                chance: 0.08,
            },
        ],
    },

    "utilitycraft:aetherium_crystal_seeds": {
        tier: 5,
        cost: 4096000,
        drops: [
            {
                item: "utilitycraft:aetherium_crystal",
                amount: [1, 2],
                chance: 1,
            },
            {
                item: "utilitycraft:aetherium_crystal_seeds",
                amount: 1,
                chance: 0.04,
            },
        ],
    },
};

DoriosLib.registry.registerPlant(plantAdditions);

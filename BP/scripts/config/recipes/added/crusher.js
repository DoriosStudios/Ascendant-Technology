import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string, amount: number, cost: number, tier: number }>} */
export const crusherRecipeAdditions = {
    "utilitycraft:titanium_chunk": {
        output: "utilitycraft:raw_titanium",
        amount: 1,
        cost: 1600,
        tier: 5,
    },
    "utilitycraft:titanium": {
        output: "utilitycraft:titanium_dust",
        amount: 1,
        cost: 1600,
        tier: 5,
    },
    "utilitycraft:titanium_plate": {
        output: "utilitycraft:titanium_dust",
        amount: 1,
        cost: 1600,
        tier: 5,
    },
    "utilitycraft:raw_titanium": {
        output: "utilitycraft:titanium_dust",
        amount: 2,
        cost: 1600,
        tier: 5,
    },
    "utilitycraft:titanium_block": {
        output: "utilitycraft:titanium_dust",
        amount: 6,
        cost: 14400,
        tier: 5,
    },
    "utilitycraft:raw_titanium_block": {
        output: "utilitycraft:titanium_dust",
        amount: 12,
        cost: 14400,
        tier: 5,
    },
    "utilitycraft:aetherium": {
        output: "utilitycraft:aetherium_dust",
        amount: 1,
        cost: 2400,
        tier: 6
    },
    "utilitycraft:aetherium_shard": {
        output: "utilitycraft:aetherium_dust",
        amount: 2,
        cost: 2400,
        tier: 6
    },
    "utilitycraft:aetherium_block": {
        output: "utilitycraft:aetherium_dust",
        amount: 6,
        cost: 21600,
        tier: 6
    },
};

DoriosLib.registry.registerCrusherRecipe(crusherRecipeAdditions);

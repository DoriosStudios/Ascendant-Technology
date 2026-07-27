import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string }>} */
export const furnaceRecipeAdditions = {
    "utilitycraft:raw_tungsten": {
        output: "utilitycraft:tungsten_ingot",
    },
    "utilitycraft:raw_tungsten_block": {
        output: "utilitycraft:tungsten_block",
    },
    "utilitycraft:deepslate_tungsten_ore": {
        output: "utilitycraft:tungsten_ingot",
    },
    "utilitycraft:nether_tungsten_ore": {
        output: "utilitycraft:tungsten_ingot",
    },
    "utilitycraft:raw_titanium": {
        output: "utilitycraft:titanium",
    },
    "utilitycraft:raw_titanium_block": {
        output: "utilitycraft:titanium_block",
    },
    "utilitycraft:deepslate_titanium_ore": {
        output: "utilitycraft:titanium",
    },
};

DoriosLib.registry.registerFurnaceRecipe(furnaceRecipeAdditions);

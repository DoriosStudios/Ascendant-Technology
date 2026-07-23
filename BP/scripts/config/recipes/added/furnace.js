import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string }>} */
export const furnaceRecipeAdditions = {
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

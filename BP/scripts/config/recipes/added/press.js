import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string, required: number }>} */
export const pressRecipeAdditions = {
    "utilitycraft:titanium": {
        output: "utilitycraft:titanium_plate",
        required: 2,
    },
};

DoriosLib.registry.registerPressRecipe(pressRecipeAdditions);

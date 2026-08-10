import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string, required: number }>} */
export const pressRecipeAdditions = {
    "utilitycraft:tungsten": {
        output: "utilitycraft:tungsten_plate"
    },
    "utilitycraft:titanium": {
        output: "utilitycraft:titanium_plate"
    },
    "utilitycraft:titanium_chunk": {
        output: "utilitycraft:deepslate_titanium_ore",
        required: 4
    },
    "utilitycraft:deepslate_tungsten_chunk": {
        output: "utilitycraft:deepslate_tungsten_ore",
        required: 4
    },
    "utilitycraft:nether_tungsten_chunk": {
        output: "utilitycraft:nether_tungsten_ore",
        required: 4
    }
};

DoriosLib.registry.registerPressRecipe(pressRecipeAdditions);

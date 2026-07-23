import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, { output: string, required: number }>} */
export const infuserRecipeAdditions = {
    "minecraft:glowstone_dust|utilitycraft:crying_obsidian_dust": {
        output: "utilitycraft:stabilized_obsidian_dust",
        required: 4,
    },
    "minecraft:blaze_powder|minecraft:obsidian": {
        output: "minecraft:crying_obsidian",
        required: 1,
    },
    "minecraft:ender_eye|utilitycraft:chip": {
        output: "utilitycraft:way_chip",
        required: 1,
    },
};

DoriosLib.registry.registerInfuserRecipe(infuserRecipeAdditions);

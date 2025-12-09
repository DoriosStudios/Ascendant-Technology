import { system, world } from "@minecraft/server";
// Additional Infuser recipes to be registered.

world.afterEvents.worldLoad.subscribe(() => {
    const addedRecipes = {
        "minecraft:glowstone_dust|utilitycraft:crying_obsidian_dust": { 
            output: "utilitycraft:refined_obsidian_dust", 
            required: 4 
        },
        "minecraft:blaze_powder|minecraft:obsidian": {
            output: "minecraft:crying_obsidian",
            required: 1
        },
        "utilitycraft:void_essence|minecraft:ender_pearl": {
            output: "utilitycraft:ender_pearl_dust",
            required: 2
        },
        "minecraft:ender_eye|utilitycraft:chip": {
            output: "utilitycraft:way_chip",
            required: 1
        }
    };

    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(addedRecipes));
});
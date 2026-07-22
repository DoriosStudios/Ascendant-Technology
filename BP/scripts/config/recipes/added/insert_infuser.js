import { system, world } from "@minecraft/server";
// Additional Infuser recipes to be registered.

world.afterEvents.worldLoad.subscribe(() => {
    const addedRecipes = {
        "minecraft:glowstone_dust|utilitycraft:crying_obsidian_dust": { 
            output: "utilitycraft:stabilized_obsidian_dust", 
            required: 4 
        },
        "minecraft:blaze_powder|minecraft:obsidian": {
            output: "minecraft:crying_obsidian",
            required: 1
        },
        "minecraft:ender_eye|utilitycraft:chip": {
            output: "utilitycraft:way_chip",
            required: 1
        },
        "utilitycraft:aetherium|minecraft:netheite_ingot": {
            output: "utilitycraft:netherite_aetherium_ingot",
            required: 8,
            cost: 512000
        },
    };

    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(addedRecipes));
});
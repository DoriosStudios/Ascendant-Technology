import { system, world } from "@minecraft/server";
// Additional Infuser recipes to be registered.

world.afterEvents.worldLoad.subscribe(() => {
    const addedRecipes = {
        "minecraft:glowstone_dust|utilitycraft:crying_obsidian_dust": { output: "utilitycraft:refined_obsidian_dust", required: 4 }
    };

    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(addedRecipes));
});
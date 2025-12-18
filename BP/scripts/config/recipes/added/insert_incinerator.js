import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newRecipes = {
        "utilitycraft:raw_titanium": { output: "utilitycraft:titanium" }
    };
    system.sendScriptEvent("utilitycraft:register_furnace_recipe", JSON.stringify(newRecipes));
})
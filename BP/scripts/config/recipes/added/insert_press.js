import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newRecipes = {
        "utilitycraft:titanium" : { output: "utilitycraft:titanium_plate" }
    };

    system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(newRecipes));
});
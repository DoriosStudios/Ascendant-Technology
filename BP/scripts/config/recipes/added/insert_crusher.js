import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newRecipes = {
        "utilitycraft:titanium_chunk": { output: "utilitycraft:raw_titanium", amount: 1, cost: 2400, tier: 5 }
    };

    system.sendScriptEvent("utilitycraft:register_crusher_recipe", JSON.stringify(newRecipes));
});
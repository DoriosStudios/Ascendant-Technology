import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newRecipes = {
        "utilitycraft:titanium_chunk": { output: "utilitycraft:raw_titanium", amount: 1, cost: 2400, tier: 5 },
        "utilitycraft:titanium": { output: "utilitycraft:titanium_dust", amount: 1, cost: 2400, tier: 5 },
        "utilitycraft:raw_titanium": { output: "utilitycraft:titanium_dust", amount: 2, cost: 2400, tier: 5 },
        "utilitycraft:raw_titanium_block": { output: "utilitycraft:titanium_dust", amount: 6, cost: 21600, tier: 5 }
    };

    system.sendScriptEvent("utilitycraft:register_crusher_recipe", JSON.stringify(newRecipes));
});
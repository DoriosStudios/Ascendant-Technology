import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newRecipes = {
        "utilitycraft:raw_titanium": { output: "utilitycraft:titanium" },
        "utilitycraft:raw_titanium_block": { output: "utilitycraft:titanium_block" },
        "utilitycraft:deepslate_titanium_ore": { output: "utilitycraft:titanium" }
    };
    system.sendScriptEvent("utilitycraft:register_furnace_recipe", JSON.stringify(newRecipes));
})
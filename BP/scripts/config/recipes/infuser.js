import { system, world } from "@minecraft/server";
import { infuserRecipesData } from "./data/infuser_recipes.js";

/**
 * Registers Ascendant Technology's infuser recipes to UtilityCraft
 * using the new scriptevent-based registration system.
 * 
 * This follows UtilityCraft's standard pattern where the listener
 * is in the main UtilityCraft addon, and expansions register their
 * recipes via scriptevent.
 */
world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(infuserRecipesData));
    console.warn("[Ascendant Technology] Registered infuser recipes to UtilityCraft.");
});
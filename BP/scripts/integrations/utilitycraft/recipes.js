import { system, world } from "@minecraft/server";
import {
    crusherRecipeAdditions,
    furnaceRecipeAdditions,
    infuserRecipeAdditions,
    pressRecipeAdditions,
    sieveDropAdditions,
} from "../../config/recipes/index.js";

const RECIPE_REGISTRATIONS = Object.freeze([
    ["utilitycraft:register_crusher_recipe", crusherRecipeAdditions],
    ["utilitycraft:register_furnace_recipe", furnaceRecipeAdditions],
    ["utilitycraft:register_infuser_recipe", infuserRecipeAdditions],
    ["utilitycraft:register_press_recipe", pressRecipeAdditions],
    ["utilitycraft:register_sieve_drop", sieveDropAdditions],
]);

let registered = false;

/**
 * Sends AT's recipe additions through UtilityCraft's public script-event contracts.
 * This adapter owns all runtime side effects; recipe definition modules remain data-only.
 */
export function registerUtilityCraftRecipeAdditions() {
    if (registered) return;
    registered = true;

    for (const [eventId, recipes] of RECIPE_REGISTRATIONS) {
        system.sendScriptEvent(eventId, JSON.stringify(recipes));
    }
}

world.afterEvents.worldLoad.subscribe(registerUtilityCraftRecipeAdditions);

// @ts-check

import {
    registerDuplicatorExclusions,
    registerDuplicatorPatternExclusion,
} from "../../ATCore/cloning/index.js";
import { singularityFabricatorRecipeDefinitions } from "./singularityFabricator.js";

/**
 * Exact templates that the standard Duplicator must reject.
 * Integrations can add their own entries through registerDuplicatorExclusion(s),
 * or put `ascendant:unclonnable` on an item.
 *
 * @type {Map<string, string>}
 */
export const duplicatorExclusions = new Map([
    ["utilitycraft:duplicator", "Cannot Duplicate Itself"],
    ["utilitycraft:singularity_fabricator", "Cannot Duplicate Singularity Machinery"],
    ["utilitycraft:lucky_sword", "Cannot Duplicate Lucky Tools"],
    ["utilitycraft:lucky_pickaxe", "Cannot Duplicate Lucky Tools"],
    ["utilitycraft:lucky_aiot", "Cannot Duplicate Lucky Tools"],
    ["minecraft:bedrock", "Cannot Duplicate Unobtainable Blocks"],
    ["minecraft:barrier", "Cannot Duplicate Unobtainable Blocks"],
    ["minecraft:command_block", "Cannot Duplicate Command Blocks"],
    ["minecraft:chain_command_block", "Cannot Duplicate Command Blocks"],
    ["minecraft:repeating_command_block", "Cannot Duplicate Command Blocks"],
    ["minecraft:structure_block", "Cannot Duplicate Technical Blocks"],
    ["minecraft:structure_void", "Cannot Duplicate Technical Blocks"],
    ["minecraft:jigsaw", "Cannot Duplicate Technical Blocks"],
]);

for (const recipe of singularityFabricatorRecipeDefinitions) {
    duplicatorExclusions.set(recipe.input, "Use Singularity Fabricator");
}

registerDuplicatorExclusions(duplicatorExclusions);

registerDuplicatorPatternExclusion(
    /^minecraft:(?:[a-z_]+_)?banner$/,
    "Cannot Duplicate Banners",
);
registerDuplicatorPatternExclusion(
    /^minecraft:(?:splash_|lingering_)?potion$/,
    "Cannot Duplicate Potions",
);
registerDuplicatorPatternExclusion(
    /^minecraft:(?:[a-z_]+_)?shulker_box$/,
    "Cannot Duplicate Shulker Boxes",
);

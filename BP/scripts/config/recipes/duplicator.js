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
    ["utilitycraft:singularity_fabricator", "Cannot Duplicate \nSingularity Machinery"],
    ["utilitycraft:lucky_sword", "Cannot Duplicate \nLucky Tools"],
    ["utilitycraft:lucky_pickaxe", "Cannot Duplicate \nLucky Tools"],
    ["utilitycraft:lucky_aiot", "Cannot Duplicate \nLucky Tools"],
    ["minecraft:bedrock", "Cannot Duplicate \nUnobtainable Blocks"],
    ["minecraft:barrier", "Cannot Duplicate \nUnobtainable Blocks"],
    ["minecraft:command_block", "Cannot Duplicate \nCommand Blocks"],
    ["minecraft:chain_command_block", "Cannot Duplicate \nCommand Blocks"],
    ["minecraft:repeating_command_block", "Cannot Duplicate \nCommand Blocks"],
    ["minecraft:structure_block", "Cannot Duplicate \nTechnical Blocks"],
    ["minecraft:structure_void", "Cannot Duplicate \nTechnical Blocks"],
    ["minecraft:jigsaw", "Cannot Duplicate \nTechnical Blocks"],
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
registerDuplicatorPatternExclusion(
    /^(?:minecraft|utilitycraft):(?:raw_)?(?:iron|gold|copper|netherite|diamond|emerald|lapis|redstone|coal|quartz|amethyst|titanium|tungsten|aetherium|steel|energized_iron)_block$/,
    "Cannot Duplicate \nMineral Blocks",
);
registerDuplicatorPatternExclusion(
    /^[a-z0-9_.-]+:(?:[a-z0-9_]*_)?compressed(?:_[a-z0-9_]+)*$/,
    "Cannot Duplicate \nCompressed Variants",
);

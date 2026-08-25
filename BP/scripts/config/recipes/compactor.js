// @ts-check

import { UTILITYCRAFT_COMPRESSED_BLOCK_RECIPES } from "./compactorCompressedBlocks.js";
import { UTILITYCRAFT_COMPRESSED_ITEM_RECIPES } from "./compactorCompressedItems.js";

/**
 * Experimental Compactor configuration.
 *
 * Every entry is an actual 3x3-or-smaller material compaction available in
 * this pack. `chains` cover nugget/ingot/block progression and every shipped
 * compressed-block tier; `materialCompactions` covers the remaining vanilla
 * material-to-block conversions from UtilityCraft's press reference.
 * `fragmentCompactions` mirrors every solid-form consolidation recipe from
 * UtilityCraft's pebbles collection and this pack's chunk recipes.
 */
export const COMPACTOR_CONFIG = Object.freeze({
    defaults: Object.freeze({
        ratio: 9,
        ingotCost: 800,
        costMultiplierPerLevel: 9,
        ticks: 80,
    }),
    chains: Object.freeze([
        ["minecraft:iron_nugget", "minecraft:iron_ingot", "minecraft:iron_block"],
        ["minecraft:gold_nugget", "minecraft:gold_ingot", "minecraft:gold_block"],
        ["minecraft:copper_ingot", "minecraft:copper_block"],
        ["minecraft:netherite_ingot", "minecraft:netherite_block"],
        ["minecraft:raw_iron", "minecraft:raw_iron_block"],
        ["minecraft:raw_gold", "minecraft:raw_gold_block"],
        ["minecraft:raw_copper", "minecraft:raw_copper_block"],
        ["utilitycraft:titanium_nugget", "utilitycraft:titanium", "utilitycraft:titanium_block", "utilitycraft:compressed_titanium_block", "utilitycraft:compressed_titanium_block_2", "utilitycraft:compressed_titanium_block_3", "utilitycraft:compressed_titanium_block_4"],
        ["utilitycraft:tungsten_nugget", "utilitycraft:tungsten", "utilitycraft:tungsten_block", "utilitycraft:compressed_tungsten_block", "utilitycraft:compressed_tungsten_block_2", "utilitycraft:compressed_tungsten_block_3", "utilitycraft:compressed_tungsten_block_4"],
        ["utilitycraft:aetherium", "utilitycraft:aetherium_block", "utilitycraft:compressed_aetherium_block", "utilitycraft:compressed_aetherium_block_2", "utilitycraft:compressed_aetherium_block_3", "utilitycraft:compressed_aetherium_block_4"],
        ["utilitycraft:raw_titanium", "utilitycraft:raw_titanium_block", "utilitycraft:compressed_raw_titanium_block", "utilitycraft:compressed_raw_titanium_block_2", "utilitycraft:compressed_raw_titanium_block_3", "utilitycraft:compressed_raw_titanium_block_4"],
        ["utilitycraft:raw_tungsten", "utilitycraft:raw_tungsten_block", "utilitycraft:compressed_raw_tungsten_block", "utilitycraft:compressed_raw_tungsten_block_2", "utilitycraft:compressed_raw_tungsten_block_3", "utilitycraft:compressed_raw_tungsten_block_4"],
    ]),
    materialCompactions: Object.freeze([
        ["minecraft:coal", "minecraft:coal_block", 9],
        ["minecraft:diamond", "minecraft:diamond_block", 9],
        ["minecraft:emerald", "minecraft:emerald_block", 9],
        ["minecraft:redstone", "minecraft:redstone_block", 9],
        ["minecraft:lapis_lazuli", "minecraft:lapis_block", 9],
        ["minecraft:bone_meal", "minecraft:bone_block", 9],
        ["minecraft:dried_kelp", "minecraft:dried_kelp_block", 9],
        ["minecraft:wheat", "minecraft:hay_block", 9],
        ["minecraft:slime_ball", "minecraft:slime", 9],
        ["minecraft:ice", "minecraft:packed_ice", 9],
        ["minecraft:packed_ice", "minecraft:blue_ice", 9],
        ["minecraft:quartz", "minecraft:quartz_block", 4],
        ["minecraft:amethyst_shard", "minecraft:amethyst_block", 4],
        ["minecraft:clay_ball", "minecraft:clay", 4],
        ["minecraft:brick", "minecraft:brick_block", 4],
        ["minecraft:netherbrick", "minecraft:nether_brick", 4],
        ["minecraft:glowstone_dust", "minecraft:glowstone", 4],
        ["minecraft:snowball", "minecraft:snow", 4],
        ["minecraft:nether_wart", "minecraft:nether_wart_block", 4],
        ["minecraft:magma_cream", "minecraft:magma", 4],
        ["minecraft:string", "minecraft:wool", 4],
    ]),
    fragmentCompactions: Object.freeze([
        ["utilitycraft:mud_ball", "minecraft:mud", 4],
        ["utilitycraft:ancient_debris_chunk", "minecraft:ancient_debris", 4],
        ["utilitycraft:coal_chunk", "minecraft:coal_ore", 4],
        ["utilitycraft:copper_chunk", "minecraft:copper_ore", 4],
        ["utilitycraft:gold_chunk", "minecraft:gold_ore", 4],
        ["utilitycraft:iron_chunk", "minecraft:iron_ore", 4],
        ["utilitycraft:nether_gold_chunk", "minecraft:nether_gold_ore", 4],
        ["utilitycraft:nether_quartz_chunk", "minecraft:quartz_ore", 4],
        ["utilitycraft:deepslate_coal_chunk", "minecraft:deepslate_coal_ore", 4],
        ["utilitycraft:deepslate_gold_chunk", "minecraft:deepslate_gold_ore", 4],
        ["utilitycraft:deepslate_iron_chunk", "minecraft:deepslate_iron_ore", 4],
        ["utilitycraft:gravel_fragments", "minecraft:gravel", 4],
        ["utilitycraft:nether_star_fragment", "minecraft:nether_star", 9],
        ["utilitycraft:dirt_handful", "minecraft:dirt", 4],
        ["utilitycraft:red_sand_handful", "minecraft:red_sand", 4],
        ["utilitycraft:sand_handful", "minecraft:sand", 4],
        ["utilitycraft:andesite_pebble", "minecraft:andesite", 4],
        ["utilitycraft:basalt_pebble", "minecraft:basalt", 4],
        ["utilitycraft:blackstone_pebble", "minecraft:blackstone", 4],
        ["utilitycraft:calcite_pebble", "minecraft:calcite", 4],
        ["utilitycraft:stone_pebble", "minecraft:cobblestone", 4],
        ["utilitycraft:diorite_pebble", "minecraft:diorite", 4],
        ["utilitycraft:dripstone_pebble", "minecraft:dripstone_block", 4],
        ["utilitycraft:gilded_blackstone_pebble", "minecraft:gilded_blackstone", 4],
        ["utilitycraft:granite_pebble", "minecraft:granite", 4],
        ["utilitycraft:tuff_pebble", "minecraft:tuff", 4],
        ["utilitycraft:diamond_shard", "minecraft:diamond", 4],
        ["utilitycraft:emerald_shard", "minecraft:emerald", 4],
        ["utilitycraft:shulker_shell_shard", "minecraft:shulker_shell", 9],
        ["utilitycraft:totem_shard", "minecraft:totem_of_undying", 9],
        ["utilitycraft:wither_skull_shard", "minecraft:wither_skeleton_skull", 9],
        ["utilitycraft:titanium_chunk", "utilitycraft:deepslate_titanium_ore", 4],
        ["utilitycraft:deepslate_tungsten_chunk", "utilitycraft:deepslate_tungsten_ore", 4],
        ["utilitycraft:nether_tungsten_chunk", "utilitycraft:nether_tungsten_ore", 4],
    ]),
});

/** @type {Map<string, Array<{ input: string, output: string, required: number, amount: number, cost: number, ticks: number, level: number, final: string }>>} */
const recipesByInput = new Map();

for (const chain of COMPACTOR_CONFIG.chains) {
    const final = chain.at(-1);
    for (let stage = 0; stage < chain.length - 1; stage++) {
        registerRecipe(chain[stage], chain[stage + 1], COMPACTOR_CONFIG.defaults.ratio, stage, final);
    }
}

for (const [input, output, required] of COMPACTOR_CONFIG.materialCompactions) {
    registerRecipe(input, output, required, 1, output);
}

for (const [input, output, required] of COMPACTOR_CONFIG.fragmentCompactions) {
    registerRecipe(input, output, required, 1, output);
}

const compressedNextByInput = new Map(UTILITYCRAFT_COMPRESSED_BLOCK_RECIPES);
const compressedParentByOutput = new Map(
    UTILITYCRAFT_COMPRESSED_BLOCK_RECIPES.map(([input, output]) => [output, input]),
);
const compressedLevelCache = new Map();
const compressedFinalCache = new Map();

for (const [input, output] of UTILITYCRAFT_COMPRESSED_BLOCK_RECIPES) {
    registerRecipe(input, output, COMPACTOR_CONFIG.defaults.ratio, getCompressedBlockLevel(input), getCompressedBlockFinal(output));
}

for (const [input, output, required, amount] of UTILITYCRAFT_COMPRESSED_ITEM_RECIPES) {
    registerRecipe(input, output, required, 1, output, amount);
}

function registerRecipe(input, output, required, level, final, amount = 1) {
    const recipe = Object.freeze({
        input,
        output,
        required,
        amount,
        cost: Math.ceil(COMPACTOR_CONFIG.defaults.ingotCost * (
            COMPACTOR_CONFIG.defaults.costMultiplierPerLevel ** level
        )),
        ticks: COMPACTOR_CONFIG.defaults.ticks,
        level,
        final,
    });
    const recipes = recipesByInput.get(input) ?? [];
    const existingIndex = recipes.findIndex((entry) => (
        entry.output === output && entry.required === required && entry.amount === amount
    ));
    if (existingIndex >= 0) recipes[existingIndex] = recipe;
    else recipes.push(recipe);
    recipes.sort((left, right) => right.required - left.required);
    recipesByInput.set(input, recipes);
}

function getCompressedBlockLevel(input) {
    const cached = compressedLevelCache.get(input);
    if (cached !== undefined) return cached;

    // A base block is two compactions above the nugget-to-ingot baseline:
    // nugget -> ingot (800), ingot -> block (7,200), block -> compressed (64,800).
    const parent = compressedParentByOutput.get(input);
    const level = parent ? getCompressedBlockLevel(parent) + 1 : 2;
    compressedLevelCache.set(input, level);
    return level;
}

function getCompressedBlockFinal(input) {
    const cached = compressedFinalCache.get(input);
    if (cached) return cached;

    let current = input;
    const visited = new Set();
    while (compressedNextByInput.has(current) && !visited.has(current)) {
        visited.add(current);
        current = compressedNextByInput.get(current);
    }
    compressedFinalCache.set(input, current);
    return current;
}

/** @param {string} inputTypeId */
export function getCompactorRecipe(inputTypeId, availableAmount = 0) {
    const recipes = recipesByInput.get(inputTypeId);
    if (!recipes?.length) return undefined;

    const available = Math.max(0, Math.floor(Number(availableAmount) || 0));
    return recipes.find((recipe) => recipe.required <= available) ?? recipes.at(-1);
}

export function getCompactorRecipeCount() {
    let count = 0;
    for (const recipes of recipesByInput.values()) count += recipes.length;
    return count;
}

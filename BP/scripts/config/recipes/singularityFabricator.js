// @ts-check

import { registerSingularityRecipes } from "../../ATCore/cloning/index.js";

const rarityEnergyPerSecond = {
    common: 10000,
    uncommon: 48000,
    rare: 240000,
    epic: 1200000,
    legendary: 6000000,
    mythic: 30000000,
    transcendent: 150000000,
};

/** @type {Array<{id:string, rarity:string, timeSeconds:number, input:string}>} */
export const singularityFabricatorRecipeDefinitions = [
    { id: "utilitycraft:clone_slime_core", rarity: "common", timeSeconds: 3, input: "minecraft:slime_ball" },
    { id: "utilitycraft:clone_ender_pearl", rarity: "uncommon", timeSeconds: 60, input: "minecraft:ender_pearl" },
    { id: "utilitycraft:clone_ancient_debris", rarity: "rare", timeSeconds: 150, input: "minecraft:ancient_debris" },
    { id: "utilitycraft:clone_totem", rarity: "epic", timeSeconds: 600, input: "minecraft:totem_of_undying" },
    { id: "utilitycraft:clone_nether_star", rarity: "legendary", timeSeconds: 1200, input: "minecraft:nether_star" },
    { id: "utilitycraft:clone_dragon_egg", rarity: "mythic", timeSeconds: 2400, input: "minecraft:dragon_egg" },
    { id: "utilitycraft:clone_aetherium_shard", rarity: "uncommon", timeSeconds: 80, input: "utilitycraft:aetherium_shard" },
    { id: "utilitycraft:clone_void_essence", rarity: "rare", timeSeconds: 160, input: "utilitycraft:void_essence" },
    { id: "utilitycraft:clone_shulker_shell", rarity: "rare", timeSeconds: 200, input: "minecraft:shulker_shell" },
    { id: "utilitycraft:clone_wither_skull", rarity: "epic", timeSeconds: 900, input: "minecraft:wither_skeleton_skull" },
];

registerSingularityRecipes(singularityFabricatorRecipeDefinitions.map((definition) => ({
    ...definition,
    output: definition.input,
    energyCost: rarityEnergyPerSecond[definition.rarity] * definition.timeSeconds,
    fluid: {
        type: "dark_matter",
        amount: definition.timeSeconds * 80,
    },
})));

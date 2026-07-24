// @ts-check

import { registerDropDefinitions } from "../../ATCore/drops/index.js";

const HAMMER_SOUND = { id: "dig.netherrack", volume: 1, pitch: 0.5 };

const vanillaHammerDrops = {
  "minecraft:coal_ore": ["minecraft:coal", "utilitycraft:coal_dust", [2, 4], [1, 2]],
  "minecraft:deepslate_coal_ore": ["minecraft:coal", "utilitycraft:coal_dust", [2, 3], [1, 1]],
  "minecraft:copper_ore": ["minecraft:raw_copper", "utilitycraft:copper_dust", [2, 5], [1, 2]],
  "minecraft:deepslate_copper_ore": ["minecraft:raw_copper", "utilitycraft:copper_dust", [2, 6], [1, 1]],
  "minecraft:iron_ore": ["minecraft:raw_iron", "utilitycraft:iron_dust", [2, 3], [1, 1]],
  "minecraft:deepslate_iron_ore": ["minecraft:raw_iron", "utilitycraft:iron_dust", [2, 4], [1, 1]],
  "minecraft:gold_ore": ["minecraft:raw_gold", "utilitycraft:gold_dust", [2, 3], [1, 1]],
  "minecraft:deepslate_gold_ore": ["minecraft:raw_gold", "utilitycraft:gold_dust", [2, 5], [1, 1]],
  "minecraft:diamond_ore": ["minecraft:diamond", "utilitycraft:diamond_dust", [1, 2], [0.5, 1]],
  "minecraft:deepslate_diamond_ore": ["minecraft:diamond", "utilitycraft:diamond_dust", [1, 3], [0.5, 1]],
  "minecraft:emerald_ore": ["minecraft:emerald", "utilitycraft:emerald_dust", [1, 1], [0.5, 1]],
  "minecraft:deepslate_emerald_ore": ["minecraft:emerald", "utilitycraft:emerald_dust", [1, 1], [0.5, 1]],
  "minecraft:lapis_ore": ["minecraft:lapis_lazuli", "utilitycraft:lapislazuli_chunk", [1, 2], [0, 1]],
  "minecraft:deepslate_lapis_ore": ["minecraft:lapis_lazuli", "utilitycraft:deepslate_lapislazuli_chunk", [1, 2], [0, 1]],
  "minecraft:redstone_ore": ["minecraft:redstone", "utilitycraft:redstone_chunk", [1, 2], [0, 1]],
  "minecraft:lit_redstone_ore": ["minecraft:redstone", "utilitycraft:redstone_chunk", [1, 2], [0, 1]],
  "minecraft:deepslate_redstone_ore": ["minecraft:redstone", "utilitycraft:deepslate_redstone_chunk", [1, 2], [0, 1]],
  "minecraft:lit_deepslate_redstone_ore": ["minecraft:redstone", "utilitycraft:deepslate_redstone_chunk", [1, 2], [0, 1]],
  "minecraft:nether_quartz_ore": ["minecraft:quartz", "utilitycraft:quartz_dust", [2, 4], [1, 2]],
  "minecraft:nether_gold_ore": ["minecraft:gold_nugget", "utilitycraft:nether_gold_chunk", [1, 2], [0, 1]],
  "minecraft:amethyst_cluster": ["minecraft:amethyst_shard", "utilitycraft:amethyst_shard", [1, 4], [0, 1]],
  "minecraft:amethyst_block": ["minecraft:amethyst_shard", "utilitycraft:amethyst_shard", [3, 6], [1, 2]],
};

/** @type {Record<string, Record<string, any>>} */
const definitions = {
  "utilitycraft:deepslate_aetherium_ore": {
    dropId: "utilitycraft:aetherium_shard",
    silkDropId: "utilitycraft:deepslate_aetherium_ore",
    baseRange: [1, 1],
    dropMode: "vanilla",
    originalDropId: "utilitycraft:aetherium_shard",
    replaceDropId: "utilitycraft:aetherium_shard",
    fortuneMath: { mode: "multiplier", perLevel: [0.2, 0.5] },
  },
  "utilitycraft:end_aetherium_ore": {
    dropId: "utilitycraft:aetherium_shard",
    silkDropId: "utilitycraft:end_aetherium_ore",
    baseRange: [1, 1],
    dropMode: "vanilla",
    originalDropId: "utilitycraft:aetherium_shard",
    replaceDropId: "utilitycraft:aetherium_shard",
    fortuneMath: { mode: "multiplier", perLevel: [0.5, 0.75] },
  },
  "utilitycraft:deepslate_titanium_ore": {
    dropId: "utilitycraft:raw_titanium",
    silkDropId: "utilitycraft:deepslate_titanium_ore",
    baseRange: [1, 1],
    dropMode: "vanilla",
    originalDropId: "utilitycraft:raw_titanium",
    replaceDropId: "utilitycraft:raw_titanium",
    fortuneMath: { mode: "bonus", perLevel: [0.6, 1] },
    baseSound: { id: "dig.deepslate", volume: 1, pitch: 1 },
    specialTools: [
      {
        toolId: "utilitycraft:smelting_pickaxe",
        dropId: "utilitycraft:titanium",
        originalDropId: "utilitycraft:raw_titanium",
        replaceDropId: "utilitycraft:titanium",
        baseRange: [1, 1],
        fortuneMath: { mode: "multiplier", perLevel: [0.25, 2] },
        sound: { id: "random.fizz", volume: 0.65, pitch: 1.5 },
        xp: [2, 5],
      },
      {
        toolType: "utilitycraft:is_hammer",
        dropId: "utilitycraft:titanium_dust",
        originalDropId: "utilitycraft:raw_titanium",
        replaceDropId: "utilitycraft:titanium_dust",
        baseRange: [5, 12],
        fortuneMath: { mode: "bonus", perLevel: [1, 3] },
        sound: HAMMER_SOUND,
      },
    ],
  },
  "utilitycraft:raw_titanium_block": {
    specialTools: [
      {
        toolId: "utilitycraft:smelting_pickaxe",
        dropId: "utilitycraft:titanium_block",
        silkDropId: "utilitycraft:raw_titanium_block",
        dropMode: "vanilla",
        originalDropId: "utilitycraft:raw_titanium_block",
        replaceDropId: "utilitycraft:titanium_block",
        baseRange: [1, 1],
        sound: { id: "random.fizz", volume: 0.65, pitch: 1.5 },
      },
    ],
  },
  "minecraft:ancient_debris": {
    specialTools: [{
      toolType: "utilitycraft:is_hammer",
      dropMode: "vanilla",
      originalDropId: "minecraft:ancient_debris",
      replaceDropId: "utilitycraft:netherite_scrap_dust",
      baseRange: [1, 1],
      fortuneMath: { mode: "multiplier", perLevel: [1.2, 1.5] },
      sound: HAMMER_SOUND,
    }],
  },
};

for (const [blockTypeId, [originalDropId, replaceDropId, baseRange, perLevel]] of Object.entries(vanillaHammerDrops)) {
  definitions[blockTypeId] = {
    specialTools: [{
      toolType: "utilitycraft:is_hammer",
      dropMode: "vanilla",
      originalDropId,
      replaceDropId,
      baseRange,
      fortuneMath: { mode: "bonus", perLevel },
      sound: HAMMER_SOUND,
    }],
  };
}

registerDropDefinitions(definitions);

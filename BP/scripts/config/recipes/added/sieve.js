import * as DoriosLib from "DoriosLib/index.js";

/** @type {Record<string, Array<{ item: string, amount: number, chance: number, tier: number }>>} */
export const sieveDropAdditions = {
    "utilitycraft:crushed_cobbled_deepslate": [
        { item: "utilitycraft:aetherium_shard", amount: 1, chance: 0.005, tier: 7 },
        { item: "utilitycraft:titanium_chunk", amount: 1, chance: 0.1, tier: 4 },
    ],
    "utilitycraft:compressed_crushed_cobbled_deepslate": [
        { item: "utilitycraft:aetherium_shard", amount: 9, chance: 0.005, tier: 7 },
        { item: "utilitycraft:titanium_chunk", amount: 9, chance: 0.1, tier: 4 },
    ],
    "utilitycraft:crushed_endstone": [
        { item: "utilitycraft:aetherium_shard", amount: 1, chance: 0.1, tier: 5 },
    ],
    "utilitycraft:compressed_crushed_endstone": [
        { item: "utilitycraft:aetherium_shard", amount: 9, chance: 0.1, tier: 5 },
    ],
};

DoriosLib.registry.registerSieveDrop(sieveDropAdditions);

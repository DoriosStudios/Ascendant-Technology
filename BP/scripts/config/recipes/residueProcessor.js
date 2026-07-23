// @ts-check

/**
 * Residue Processor recipes indexed by exact input item id.
 *
 * The machine performs one property lookup per processing pass. Every input
 * intentionally owns one recipe so selection never scans or resolves an
 * ambiguous list.
 *
 * @type {Record<string, {
 *   required: number,
 *   output: string,
 *   amount: number,
 *   cost: number,
 *   byproduct?: { item: string, amount: number, chance: number }
 * }>}
 */
export const residueProcessorRecipes = {
    "utilitycraft:void_essence": {
        required: 1,
        output: "utilitycraft:aetherium_shard",
        amount: 2,
        cost: 6400,
        byproduct: {
            item: "minecraft:iron_nugget",
            amount: 2,
            chance: 0.35,
        },
    },
    "minecraft:podzol": {
        required: 1,
        output: "minecraft:bone_meal",
        amount: 2,
        cost: 2200,
        byproduct: {
            item: "minecraft:rotten_flesh",
            amount: 1,
            chance: 0.65,
        },
    },
    "minecraft:bone_block": {
        required: 1,
        output: "minecraft:bone_meal",
        amount: 9,
        cost: 2600,
    },
    "minecraft:rotten_flesh": {
        required: 4,
        output: "minecraft:leather",
        amount: 1,
        cost: 3400,
        byproduct: {
            item: "minecraft:bone_meal",
            amount: 1,
            chance: 0.35,
        },
    },
    "utilitycraft:ender_pearl_dust": {
        required: 2,
        output: "minecraft:ender_pearl",
        amount: 1,
        cost: 4200,
        byproduct: {
            item: "minecraft:gravel",
            amount: 1,
            chance: 0.5,
        },
    },
};

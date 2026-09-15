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
 *   byproduct?: { item: string, amount: number, chance: number },
 *   extraOutputs?: { item: string, amount: number, chance: number }[],
 *   outputs?: { item: string, amount: number, chance: number }[]
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

// Recovery recipes use one guaranteed product and up to three secondary products.
residueProcessorRecipes["minecraft:string"] = {
    required: 9, output: "minecraft:web", amount: 1, cost: 6400,
};
residueProcessorRecipes["minecraft:hardened_clay"] = {
    required: 4, output: "minecraft:clay_ball", amount: 8, cost: 4800,
    byproduct: { item: "minecraft:brick", amount: 1, chance: 0.5 },
    extraOutputs: [
        { item: "minecraft:miner_pottery_sherd", amount: 1, chance: 0.04 },
        { item: "minecraft:explorer_pottery_sherd", amount: 1, chance: 0.04 },
    ],
};
for (const coral of ["tube", "brain", "bubble", "fire", "horn"]) {
    residueProcessorRecipes[`minecraft:dead_${coral}_coral_block`] = {
        required: 4, output: "utilitycraft:calcite_pebble", amount: 4, cost: 4800,
        byproduct: { item: "minecraft:sand", amount: 1, chance: 1 },
        extraOutputs: [{ item: "minecraft:sponge", amount: 1, chance: 0.05 }],
    };
}
residueProcessorRecipes["minecraft:dirt_with_roots"] = {
    required: 1, output: "minecraft:dirt", amount: 1, cost: 2400,
    byproduct: { item: "minecraft:hanging_roots", amount: 1, chance: 0.5 },
    extraOutputs: [{ item: "minecraft:bone_meal", amount: 1, chance: 0.25 }],
};
residueProcessorRecipes["minecraft:muddy_mangrove_roots"] = {
    required: 1, output: "minecraft:mud", amount: 1, cost: 2400,
    byproduct: { item: "minecraft:mangrove_roots", amount: 1, chance: 1 },
};

// Normalize once at load time, keeping the hot path a direct input lookup.
for (const recipe of Object.values(residueProcessorRecipes)) {
    recipe.outputs = [
        { item: recipe.output, amount: recipe.amount, chance: 1 },
        ...(recipe.byproduct ? [recipe.byproduct] : []),
        ...(recipe.extraOutputs ?? []),
    ];
}

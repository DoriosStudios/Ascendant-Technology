import { system } from "@minecraft/server";

export const GENETIC_ACCEPTED_SOILS = Object.freeze({
	"minecraft:dirt": Object.freeze({ cost: 2 }),
	"minecraft:grass_block": Object.freeze({ cost: 1.5 }),
	"utilitycraft:yellow_soil": Object.freeze({ cost: 1 }),
	"utilitycraft:red_soil": Object.freeze({ cost: 0.75 }),
	"utilitycraft:blue_soil": Object.freeze({ cost: 0.5 }),
	"utilitycraft:black_soil": Object.freeze({ cost: 0.25 })
});

const GENETIC_DROP_ITEM_OVERRIDES = Object.freeze({
	"utilitycraft:diamond_seeds": Object.freeze({
		"minecraft:diamond": "utilitycraft:diamond_shard"
	}),
	"utilitycraft:emerald_seeds": Object.freeze({
		"minecraft:emerald": "utilitycraft:emerald_shard"
	}),
	"utilitycraft:netherite_seeds": Object.freeze({
		"minecraft:netherite_scrap": "utilitycraft:netherite_nugget"
	}),
	"utilitycraft:nether_star_seeds": Object.freeze({
		"minecraft:nether_star": "utilitycraft:nether_star_fragment"
	}),
	"utilitycraft:shulker_seeds": Object.freeze({
		"minecraft:shulker_shell": "utilitycraft:shulker_shell_shard"
	}),
	"utilitycraft:totem_seeds": Object.freeze({
		"minecraft:totem_of_undying": "utilitycraft:totem_shard"
	}),
	"utilitycraft:wither_seeds": Object.freeze({
		"minecraft:wither_skeleton_skull": "utilitycraft:wither_skull_shard"
	})
});

export const plantsData = {
	"minecraft:acacia_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:acacia_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:acacia_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [6, 10], chance: 1 },
			{ item: "minecraft:acacia_sapling", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:apple_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [6, 10], chance: 1 },
			{ item: "utilitycraft:apple_sapling", amount: 1, chance: 0.05 },
			{ item: "minecraft:apple", amount: [1, 4], chance: 1 },
			{ item: "minecraft:enchanted_golden_apple", amount: 1, chance: 0.0001 },
			{ item: "minecraft:golden_apple", amount: 1, chance: 0.1 }
		]
	},
	"minecraft:bamboo": {
		cost: 8000,
		drops: [
			{ item: "minecraft:bamboo", amount: [4, 8], chance: 1 }
		]
	},
	"minecraft:beetroot_seeds": {
		cost: 8000,
		drops: [
			{ item: "minecraft:beetroot", amount: [2, 4], chance: 1 },
			{ item: "minecraft:beetroot_seeds", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:birch_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:birch_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:birch_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:birch_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:cactus": {
		cost: 8000,
		drops: [
			{ item: "minecraft:cactus", amount: [2, 4], chance: 1 }
		]
	},
	"minecraft:carrot": {
		cost: 8000,
		drops: [
			{ item: "minecraft:carrot", amount: [2, 4], chance: 1 },
			{ item: "minecraft:golden_carrot", amount: 1, chance: 0.1 }
		]
	},
	"minecraft:cherry_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:cherry_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:cherry_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:cherry_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:chorus_flower": {
		cost: 8000,
		drops: [
			{ item: "minecraft:chorus_fruit", amount: [1, 2], chance: 1 },
			{ item: "minecraft:chorus_flower", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:crimson_fungus": {
		cost: 8000,
		drops: [
			{ item: "minecraft:crimson_stem", amount: [6, 10], chance: 1 },
			{ item: "minecraft:nether_wart_block", amount: [0, 4], chance: 1 },
			{ item: "minecraft:shroomlight", amount: [1, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:crimson_fungus", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:dark_oak_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:dark_oak_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:dark_oak_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:dark_oak_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:jungle_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:jungle_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:jungle_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:cocoa_beans", amount: [1, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:jungle_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:kelp": {
		cost: 8000,
		drops: [
			{ item: "minecraft:kelp", amount: [4, 8], chance: 1 }
		]
	},
	"minecraft:mangrove_propagule": {
		cost: 8000,
		drops: [
			{ item: "minecraft:mangrove_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:mangrove_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:mangrove_propagule", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:melon_seeds": {
		cost: 8000,
		drops: [
			{ item: "minecraft:melon_slice", amount: [2, 4], chance: 1 },
			{ item: "minecraft:melon_block", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:red_mushroom": {
		cost: 8000,
		drops: [
			{ item: "minecraft:red_mushroom", amount: [2, 4], chance: 1 }
		]
	},
	"minecraft:brown_mushroom": {
		cost: 8000,
		drops: [
			{ item: "minecraft:brown_mushroom", amount: [2, 4], chance: 1 }
		]
	},
	"minecraft:nether_wart": {
		cost: 8000,
		drops: [
			{ item: "minecraft:nether_wart", amount: [4, 8], chance: 1 }
		]
	},
	"minecraft:oak_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:oak_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:pale_oak_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:pale_oak_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:pale_oak_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:pale_oak_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:potato": {
		cost: 8000,
		drops: [
			{ item: "minecraft:potato", amount: [2, 4], chance: 1 },
			{ item: "minecraft:poisonous_potato", amount: 1, chance: 0.10 }
		]
	},
	"minecraft:pumpkin_seeds": {
		cost: 8000,
		drops: [
			{ item: "minecraft:pumpkin", amount: [2, 4], chance: 1 },
			{ item: "minecraft:pumpkin_pie", amount: 1, chance: 0.1 }
		]
	},
	"minecraft:spruce_sapling": {
		cost: 8000,
		drops: [
			{ item: "minecraft:spruce_log", amount: [6, 10], chance: 1 },
			{ item: "minecraft:spruce_leaves", amount: [0, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:spruce_sapling", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:sugar_cane": {
		cost: 8000,
		drops: [
			{ item: "minecraft:sugar_cane", amount: [4, 8], chance: 1 }
		]
	},
	"minecraft:sweet_berries": {
		cost: 8000,
		drops: [
			{ item: "minecraft:sweet_berries", amount: [2, 4], chance: 1 }
		]
	},
	"minecraft:warped_fungus": {
		cost: 8000,
		drops: [
			{ item: "minecraft:warped_stem", amount: [6, 10], chance: 1 },
			{ item: "minecraft:warped_wart_block", amount: [0, 4], chance: 1 },
			{ item: "minecraft:shroomlight", amount: [1, 4], chance: 1 },
			{ item: "minecraft:stick", amount: [0, 6], chance: 1 },
			{ item: "minecraft:warped_fungus", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:wheat_seeds": {
		cost: 8000,
		drops: [
			{ item: "minecraft:wheat", amount: [2, 4], chance: 1 },
			{ item: "minecraft:wheat_seeds", amount: 1, chance: 0.05 },
			{ item: "minecraft:bread", amount: 1, chance: 0.1 }
		]
	},
	"utilitycraft:coal_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:coal", amount: [2, 4], chance: 1 },
			{ item: "utilitycraft:coal_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:copper_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:raw_copper", amount: [2, 4], chance: 1 },
			{ item: "utilitycraft:copper_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:dyes_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:black_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:blue_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:brown_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:cyan_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:gray_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:green_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:light_blue_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:light_gray_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:lime_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:magenta_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:orange_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:pink_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:purple_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:red_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:white_dye", amount: 1, chance: 0.05 },
			{ item: "minecraft:yellow_dye", amount: 1, chance: 0.05 },
			{ item: "utilitycraft:dyes_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:glass_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:glass", amount: [8, 16], chance: 1 },
			{ item: "utilitycraft:glass_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:gunpowder_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:gunpowder", amount: [4, 8], chance: 1 },
			{ item: "utilitycraft:gunpowder_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:iron_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:raw_iron", amount: [1, 3], chance: 1 },
			{ item: "utilitycraft:iron_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:leather_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:leather", amount: [4, 8], chance: 1 },
			{ item: "utilitycraft:leather_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:prismarine_crystals_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:prismarine_crystals", amount: [8, 12], chance: 1 },
			{ item: "utilitycraft:prismarine_crystals_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:prismarine_shards_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:prismarine_shard", amount: [8, 12], chance: 1 },
			{ item: "utilitycraft:prismarine_shards_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:water_seeds": {
		cost: 64000,
		drops: [
			{ item: "utilitycraft:water_ball", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:water_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:wool_seeds": {
		cost: 64000,
		drops: [
			{ item: "minecraft:wool", amount: [2, 4], chance: 1 },
			{ item: "utilitycraft:wool_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:ghast_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:ghast_tear", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:ghast_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:glowstone_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:glowstone_dust", amount: [2, 4], chance: 1 },
			{ item: "utilitycraft:glowstone_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:gold_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:raw_gold", amount: [1, 3], chance: 1 },
			{ item: "utilitycraft:gold_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:honey_seeds": {
		cost: 128000,
		drops: [
			{ item: "utilitycraft:honey_ball", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:honey_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:lapis_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:lapis_lazuli", amount: [4, 9], chance: 1 },
			{ item: "utilitycraft:lapis_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:lava_seeds": {
		cost: 128000,
		drops: [
			{ item: "utilitycraft:lava_ball", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:lava_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:quartz_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:quartz", amount: [4, 8], chance: 1 },
			{ item: "utilitycraft:quartz_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:redstone_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:redstone", amount: [3, 8], chance: 1 },
			{ item: "utilitycraft:redstone_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:slime_seeds": {
		cost: 128000,
		drops: [
			{ item: "minecraft:slime_ball", amount: [1, 3], chance: 1 },
			{ item: "utilitycraft:slime_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:amethyst_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:amethyst_shard", amount: [2, 4], chance: 1 },
			{ item: "utilitycraft:amethyst_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:blaze_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:blaze_rod", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:blaze_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:diamond_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:diamond", amount: 1, chance: 1 },
			{ item: "utilitycraft:diamond_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:emerald_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:emerald", amount: 1, chance: 1 },
			{ item: "utilitycraft:emerald_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:enderpearl_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:ender_pearl", amount: 1, chance: 1 },
			{ item: "utilitycraft:enderpearl_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:obsidian_seeds": {
		cost: 512000,
		drops: [
			{ item: "minecraft:obsidian", amount: [1, 2], chance: 1 },
			{ item: "utilitycraft:obsidian_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:netherite_seeds": {
		cost: 1024000,
		drops: [
			{ item: "minecraft:netherite_scrap", amount: 1, chance: 1 },
			{ item: "utilitycraft:netherite_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:nether_star_seeds": {
		cost: 1024000,
		drops: [
			{ item: "minecraft:nether_star", amount: 1, chance: 1 },
			{ item: "utilitycraft:nether_star_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:shulker_seeds": {
		cost: 1024000,
		drops: [
			{ item: "minecraft:shulker_shell", amount: 1, chance: 1 },
			{ item: "utilitycraft:shulker_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:totem_seeds": {
		cost: 1024000,
		drops: [
			{ item: "minecraft:totem_of_undying", amount: 1, chance: 1 },
			{ item: "utilitycraft:totem_seeds", amount: 1, chance: 0.05 }
		]
	},
	"utilitycraft:wither_seeds": {
		cost: 1024000,
		drops: [
			{ item: "minecraft:wither_skeleton_skull", amount: 1, chance: 1 },
			{ item: "utilitycraft:wither_seeds", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:poppy": {
		cost: 64000,
		drops: [
			{ item: "minecraft:dandelion", amount: 1, chance: 0.05 },
			{ item: "minecraft:poppy", amount: 1, chance: 0.05 },
			{ item: "minecraft:blue_orchid", amount: 1, chance: 0.05 },
			{ item: "minecraft:allium", amount: 1, chance: 0.05 },
			{ item: "minecraft:azure_bluet", amount: 1, chance: 0.05 },
			{ item: "minecraft:red_tulip", amount: 1, chance: 0.05 },
			{ item: "minecraft:orange_tulip", amount: 1, chance: 0.05 },
			{ item: "minecraft:white_tulip", amount: 1, chance: 0.05 },
			{ item: "minecraft:pink_tulip", amount: 1, chance: 0.05 },
			{ item: "minecraft:oxeye_daisy", amount: 1, chance: 0.05 },
			{ item: "minecraft:cornflower", amount: 1, chance: 0.05 },
			{ item: "minecraft:lily_of_the_valley", amount: 1, chance: 0.05 },
			{ item: "minecraft:sunflower", amount: 1, chance: 0.05 },
			{ item: "minecraft:lilac", amount: 1, chance: 0.05 },
			{ item: "minecraft:rose_bush", amount: 1, chance: 0.05 },
			{ item: "minecraft:peony", amount: 1, chance: 0.05 },
			{ item: "minecraft:pitcher_plant", amount: 1, chance: 0.05 },
			{ item: "minecraft:torchflower", amount: 1, chance: 0.05 },
			{ item: "minecraft:cactus_flower", amount: 1, chance: 0.05 }
		]
	},
	"minecraft:glow_berries": {
		cost: 8000,
		drops: [
			{ item: "minecraft:glow_berries", amount: [1, 16], chance: 1 }
		]
	}
};

function applyGeneticRecipeOverrides(plantId, recipe) {
	if (!recipe?.drops?.length) return recipe ?? null;

	const itemOverrides = GENETIC_DROP_ITEM_OVERRIDES[plantId];
	if (!itemOverrides) return recipe;

	let changed = false;
	const drops = recipe.drops.map(drop => {
		const replacementItemId = itemOverrides[drop.item];
		if (!replacementItemId) return drop;

		changed = true;
		return {
			...drop,
			item: replacementItemId
		};
	});

	if (!changed) return recipe;

	return {
		...recipe,
		drops
	};
}

export function getGeneticSeedPlantRecipe(itemId) {
	if (!itemId) return null;

	const recipe = plantsData[itemId] ?? null;
	return applyGeneticRecipeOverrides(itemId, recipe);
}

function normalizePlantEntry(entry) {
	if (!entry || typeof entry !== "object" || !Array.isArray(entry.drops) || entry.drops.length === 0) {
		return null;
	}

	return {
		cost: Math.max(1, Number(entry.cost) || 8000),
		drops: entry.drops
			.filter(drop => drop && typeof drop.item === "string" && drop.item.length > 0)
			.map(drop => ({
				item: drop.item,
				amount: Array.isArray(drop.amount) ? [...drop.amount] : Math.max(1, Number(drop.amount) || 1),
				chance: Math.max(0, Math.min(1, Number(drop.chance) || 0))
			}))
	};
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
	if (id !== "utilitycraft:register_plant") return;

	try {
		const payload = JSON.parse(message);
		if (!payload || typeof payload !== "object") return;

		for (const [plantId, plantData] of Object.entries(payload)) {
			const normalized = normalizePlantEntry(plantData);
			if (!normalized || typeof plantId !== "string" || plantId.length === 0) continue;
			plantsData[plantId] = normalized;
		}
	} catch {
		// Ignore malformed registration payloads to keep the machine registry stable.
	}
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
	if (id !== "utilitycraft:register_bonsai") return;

	try {
		const payload = JSON.parse(message);
		if (!payload || typeof payload !== "object") return;

		for (const bonsaiData of Object.values(payload)) {
			if (!bonsaiData || typeof bonsaiData !== "object" || typeof bonsaiData.sapling !== "string") continue;

			const normalized = normalizePlantEntry(bonsaiData);
			if (!normalized) continue;
			plantsData[bonsaiData.sapling] = normalized;
		}
	} catch {
		// Ignore malformed bonsai payloads to keep the machine registry stable.
	}
});

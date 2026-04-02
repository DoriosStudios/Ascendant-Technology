import { system } from "@minecraft/server";

const PULVERIZER_DEFAULTS = Object.freeze({
    energyCost: 1600,
    seconds: 3,
    ticksPerSecond: 20
});

const PULVERIZER_EVENT_ID = "utilitycraft:register_crusher_recipe";

const nativePulverizerRecipeDefinitions = Object.freeze({
    "minecraft:cobblestone": { output: "minecraft:gravel", amount: 1, tier: 0 },
    "utilitycraft:compressed_cobblestone": { output: "utilitycraft:compressed_gravel", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:double_compressed_cobblestone": { output: "utilitycraft:compressed_gravel_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:triple_compressed_cobblestone": { output: "utilitycraft:compressed_gravel_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:quadruple_compressed_cobblestone": { output: "utilitycraft:compressed_gravel_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:gravel": { output: "minecraft:dirt", amount: 1, tier: 0 },
    "utilitycraft:compressed_gravel": { output: "utilitycraft:compressed_dirt", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_gravel_2": { output: "utilitycraft:compressed_dirt_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_gravel_3": { output: "utilitycraft:compressed_dirt_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_gravel_4": { output: "utilitycraft:compressed_dirt_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:dirt": { output: "minecraft:sand", amount: 1, tier: 0 },
    "utilitycraft:compressed_dirt": { output: "utilitycraft:compressed_sand", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_dirt_2": { output: "utilitycraft:compressed_sand_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_dirt_3": { output: "utilitycraft:compressed_sand_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_dirt_4": { output: "utilitycraft:compressed_sand_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:netherrack": { output: "utilitycraft:crushed_netherrack", amount: 1, tier: 0 },
    "utilitycraft:compressed_netherrack": { output: "utilitycraft:compressed_crushed_netherrack", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_netherrack_2": { output: "utilitycraft:compressed_crushed_netherrack_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_netherrack_3": { output: "utilitycraft:compressed_crushed_netherrack_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_netherrack_4": { output: "utilitycraft:compressed_crushed_netherrack_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:end_stone": { output: "utilitycraft:crushed_endstone", amount: 1, tier: 0 },
    "utilitycraft:compressed_endstone": { output: "utilitycraft:compressed_crushed_endstone", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_endstone_2": { output: "utilitycraft:compressed_crushed_endstone_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_endstone_3": { output: "utilitycraft:compressed_crushed_endstone_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_endstone_4": { output: "utilitycraft:compressed_crushed_endstone_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:cobbled_deepslate": { output: "utilitycraft:crushed_cobbled_deepslate", amount: 1, tier: 0 },
    "utilitycraft:compressed_cobbled_deepslate": { output: "utilitycraft:compressed_crushed_cobbled_deepslate", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_cobbled_deepslate_2": { output: "utilitycraft:compressed_crushed_cobbled_deepslate_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_cobbled_deepslate_3": { output: "utilitycraft:compressed_crushed_cobbled_deepslate_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_cobbled_deepslate_4": { output: "utilitycraft:compressed_crushed_cobbled_deepslate_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:deepslate": { output: "minecraft:cobbled_deepslate", amount: 1, tier: 0 },
    "utilitycraft:compressed_deepslate": { output: "utilitycraft:compressed_cobbled_deepslate", amount: 1, cost: 7200, tier: 1 },
    "utilitycraft:compressed_deepslate_2": { output: "utilitycraft:compressed_cobbled_deepslate_2", amount: 1, cost: 64800, tier: 2 },
    "utilitycraft:compressed_deepslate_3": { output: "utilitycraft:compressed_cobbled_deepslate_3", amount: 1, cost: 583200, tier: 3 },
    "utilitycraft:compressed_deepslate_4": { output: "utilitycraft:compressed_cobbled_deepslate_4", amount: 1, cost: 5248800, tier: 4 },

    "minecraft:coal_block": { output: "utilitycraft:coal_dust", amount: 6 },
    "minecraft:copper_block": { output: "utilitycraft:copper_dust", amount: 6 },
    "minecraft:iron_block": { output: "utilitycraft:iron_dust", amount: 6 },
    "utilitycraft:energized_iron_block": { output: "utilitycraft:energized_iron_dust", amount: 6 },
    "minecraft:gold_block": { output: "utilitycraft:gold_dust", amount: 6 },
    "utilitycraft:steel_block": { output: "utilitycraft:steel_dust", amount: 6 },
    "minecraft:diamond_block": { output: "utilitycraft:diamond_dust", amount: 6 },
    "minecraft:emerald_block": { output: "utilitycraft:emerald_dust", amount: 6 },
    "minecraft:netherite_block": { output: "utilitycraft:netherite_dust", amount: 6 },

    "minecraft:raw_copper_block": { output: "utilitycraft:copper_dust", amount: 12, cost: 1600 },
    "minecraft:raw_iron_block": { output: "utilitycraft:iron_dust", amount: 12, cost: 1600 },
    "utilitycraft:raw_energized_iron_block": { output: "utilitycraft:energized_iron_dust", amount: 12, cost: 1600 },
    "minecraft:raw_gold_block": { output: "utilitycraft:gold_dust", amount: 12, cost: 1600 },
    "utilitycraft:raw_steel_block": { output: "utilitycraft:steel_dust", amount: 12, cost: 1600 },

    "minecraft:calcite": { output: "utilitycraft:calcite_pebble", amount: 4 },

    "utilitycraft:copper_chunk": { output: "minecraft:raw_copper", amount: 1 },
    "utilitycraft:gold_chunk": { output: "minecraft:raw_gold", amount: 1 },
    "utilitycraft:iron_chunk": { output: "minecraft:raw_iron", amount: 1 },
    "utilitycraft:coal_chunk": { output: "minecraft:coal", amount: 1 },
    "utilitycraft:diamond_chunk": { output: "minecraft:diamond", amount: 1 },
    "utilitycraft:emerald_chunk": { output: "minecraft:emerald", amount: 1 },
    "utilitycraft:lapislazuli_chunk": { output: "minecraft:lapis_lazuli", amount: 3 },
    "utilitycraft:redstone_chunk": { output: "minecraft:redstone", amount: 4 },
    "utilitycraft:nether_quartz_chunk": { output: "minecraft:quartz", amount: 3 },
    "utilitycraft:nether_gold_chunk": { output: "minecraft:raw_gold", amount: 1 },

    "utilitycraft:deepslate_copper_chunk": { output: "minecraft:raw_copper", amount: 1 },
    "utilitycraft:deepslate_gold_chunk": { output: "minecraft:raw_gold", amount: 1 },
    "utilitycraft:deepslate_iron_chunk": { output: "minecraft:raw_iron", amount: 1 },
    "utilitycraft:deepslate_coal_chunk": { output: "minecraft:coal", amount: 1 },
    "utilitycraft:deepslate_diamond_chunk": { output: "minecraft:diamond", amount: 1 },
    "utilitycraft:deepslate_emerald_chunk": { output: "minecraft:emerald", amount: 1 },
    "utilitycraft:deepslate_lapislazuli_chunk": { output: "minecraft:lapis_lazuli", amount: 3 },
    "utilitycraft:deepslate_redstone_chunk": { output: "minecraft:redstone", amount: 4 },

    "minecraft:netherite_ingot": { output: "utilitycraft:netherite_dust", amount: 1 },
    "minecraft:iron_ingot": { output: "utilitycraft:iron_dust", amount: 1 },
    "minecraft:gold_ingot": { output: "utilitycraft:gold_dust", amount: 1 },
    "minecraft:copper_ingot": { output: "utilitycraft:copper_dust", amount: 1 },
    "utilitycraft:energized_iron_ingot": { output: "utilitycraft:energized_iron_dust", amount: 1 },
    "utilitycraft:steel_ingot": { output: "utilitycraft:steel_dust", amount: 1 },
    "minecraft:netherite_scrap": { output: "utilitycraft:netherite_scrap_dust", amount: 1 },
    "utilitycraft:ancient_debris_chunk": { output: "utilitycraft:netherite_scrap_dust", amount: 1 },

    "utilitycraft:netherite_plate": { output: "utilitycraft:netherite_dust", amount: 1 },
    "utilitycraft:iron_plate": { output: "utilitycraft:iron_dust", amount: 1 },
    "utilitycraft:gold_plate": { output: "utilitycraft:gold_dust", amount: 1 },
    "utilitycraft:copper_plate": { output: "utilitycraft:copper_dust", amount: 1 },
    "utilitycraft:energized_iron_plate": { output: "utilitycraft:energized_iron_dust", amount: 1 },
    "utilitycraft:steel_plate": { output: "utilitycraft:steel_dust", amount: 1 },

    "utilitycraft:raw_energized_iron": { output: "utilitycraft:energized_iron_dust", amount: 2 },
    "minecraft:raw_iron": { output: "utilitycraft:iron_dust", amount: 2 },
    "minecraft:raw_gold": { output: "utilitycraft:gold_dust", amount: 2 },
    "minecraft:raw_copper": { output: "utilitycraft:copper_dust", amount: 2 },
    "utilitycraft:raw_steel": { output: "utilitycraft:steel_dust", amount: 2 },
    "minecraft:coal": { output: "utilitycraft:coal_dust", amount: 2 },
    "minecraft:charcoal": { output: "utilitycraft:charcoal_dust", amount: 2 },

    "minecraft:emerald": { output: "utilitycraft:emerald_dust", amount: 2 },
    "minecraft:diamond": { output: "utilitycraft:diamond_dust", amount: 2 },
    "minecraft:quartz": { output: "utilitycraft:quartz_dust", amount: 2 },
    "minecraft:amethyst_shard": { output: "utilitycraft:amethyst_dust", amount: 2 },
    "minecraft:ender_pearl": { output: "utilitycraft:ender_pearl_dust", amount: 2 },
    "minecraft:obsidian": { output: "utilitycraft:obsidian_dust", amount: 4 },
    "minecraft:crying_obsidian": { output: "utilitycraft:crying_obsidian_dust", amount: 4 },

    "minecraft:kelp": { output: "utilitycraft:crushed_kelp", amount: 1 },
    "minecraft:blue_ice": { output: "minecraft:packed_ice", amount: 9 },
    "minecraft:packed_ice": { output: "minecraft:ice", amount: 9 },
    "minecraft:nether_wart_block": { output: "minecraft:nether_wart", amount: 4 },
    "minecraft:magma_block": { output: "minecraft:magma_cream", amount: 4 },
    "minecraft:slime_block": { output: "minecraft:slime_ball", amount: 9 },
    "minecraft:bone": { output: "minecraft:bone_meal", amount: 3 },
    "minecraft:bone_block": { output: "minecraft:bone_meal", amount: 9 },
    "minecraft:blaze_rod": { output: "minecraft:blaze_powder", amount: 2 },

    "minecraft:black_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:blue_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:brown_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:cyan_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:gray_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:green_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:light_blue_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:light_gray_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:lime_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:magenta_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:orange_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:pink_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:purple_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:red_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:white_wool": { output: "minecraft:string", amount: 4 },
    "minecraft:yellow_wool": { output: "minecraft:string", amount: 4 },

    "ae2be:certus_quartz_crystal": { output: "ae2be:certus_quartz_dust", amount: 1 },
    "ae2be:charged_certus_quartz_crystal": { output: "ae2be:certus_quartz_dust", amount: 1 },
    "ae2be:fluix_crystal": { output: "ae2be:fluix_dust", amount: 1 },
    "ae2be:sky_stone": { output: "ae2be:sky_stone_dust", amount: 1 }
});

const nativePulverizerRecipes = Object.entries(nativePulverizerRecipeDefinitions).map(([recipeId, payload]) =>
    definePulverizerRecipe(recipeId, payload)
);

export const pulverizerRecipes = [...nativePulverizerRecipes];

export function getPulverizerRecipes() {
    return pulverizerRecipes;
}

function definePulverizerRecipe(recipeId, payload) {
    if (!recipeId || typeof recipeId !== "string") {
        throw new TypeError("Pulverizer recipe id must be a non-empty string");
    }

    if (!payload || typeof payload !== "object") {
        throw new TypeError(`Pulverizer recipe '${recipeId}' is invalid`);
    }

    const energyCost = normalizePositiveInteger(payload.energyCost ?? payload.cost, PULVERIZER_DEFAULTS.energyCost);
    const input = normalizeStack(payload.input ?? { id: recipeId, amount: payload.required }, {
        fallbackId: recipeId,
        fallbackAmount: payload.required ?? 1
    });
    const output = normalizeStack(payload.output ?? { id: payload.output, amount: payload.outputAmount ?? payload.amount ?? 1 }, {
        fallbackAmount: payload.outputAmount ?? payload.amount ?? 1
    });
    const { ticks, seconds } = normalizeDuration(payload, energyCost);

    return {
        id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : recipeId,
        input,
        output,
        energyCost,
        ticks,
        seconds,
        description: typeof payload.description === "string" && payload.description.length > 0
            ? payload.description
            : null
    };
}

function normalizeStack(stack, options = {}) {
    const fallbackId = typeof options.fallbackId === "string" ? options.fallbackId : "";
    const fallbackAmount = normalizePositiveInteger(options.fallbackAmount, 1);

    if (typeof stack === "string") {
        return {
            id: stack,
            amount: fallbackAmount
        };
    }

    if (stack && typeof stack === "object") {
        const id = typeof stack.id === "string" && stack.id.length > 0
            ? stack.id
            : fallbackId;
        if (!id) {
            throw new TypeError("Pulverizer stack is missing an item id");
        }

        return {
            id,
            amount: normalizePositiveInteger(
                stack.amount ?? stack.required ?? stack.count,
                fallbackAmount
            )
        };
    }

    if (!fallbackId) {
        throw new TypeError("Pulverizer stack is invalid");
    }

    return {
        id: fallbackId,
        amount: fallbackAmount
    };
}

function normalizeDuration(payload, energyCost) {
    const explicitTicks = Number(payload.ticks ?? payload.timeTicks ?? payload.processingTicks);
    if (Number.isFinite(explicitTicks) && explicitTicks > 0) {
        const ticks = Math.max(1, Math.floor(explicitTicks));
        return {
            ticks,
            seconds: Number((ticks / PULVERIZER_DEFAULTS.ticksPerSecond).toFixed(2))
        };
    }

    const explicitSeconds = Number(payload.seconds ?? payload.time ?? payload.processingTimeSeconds);
    if (Number.isFinite(explicitSeconds) && explicitSeconds > 0) {
        const seconds = Number(explicitSeconds.toFixed(2));
        return {
            seconds,
            ticks: Math.max(1, Math.round(seconds * PULVERIZER_DEFAULTS.ticksPerSecond))
        };
    }

    const scaledSeconds = PULVERIZER_DEFAULTS.seconds * (energyCost / PULVERIZER_DEFAULTS.energyCost);
    const seconds = Number(Math.max(PULVERIZER_DEFAULTS.seconds, scaledSeconds).toFixed(2));
    return {
        seconds,
        ticks: Math.max(1, Math.round(seconds * PULVERIZER_DEFAULTS.ticksPerSecond))
    };
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function upsertPulverizerRecipe(recipeId, payload) {
    const recipe = definePulverizerRecipe(recipeId, payload);
    const index = pulverizerRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        pulverizerRecipes[index] = recipe;
        return "replaced";
    }

    pulverizerRecipes.push(recipe);
    return "added";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== PULVERIZER_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            try {
                const status = upsertPulverizerRecipe(recipeId, definition);
                if (status === "replaced") replaced++;
                else added++;
            } catch (error) {
                console.warn(`[Pulverizer] Failed to register crusher recipe '${recipeId}':`, error);
            }
        }

        console.warn(`[Pulverizer] Registered ${added} new and replaced ${replaced} crusher recipes.`);
    } catch (error) {
        console.warn("[Pulverizer] Failed to parse crusher recipe payload:", error);
    }
});

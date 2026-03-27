import { system } from "@minecraft/server";

const INDUSTRIAL_BURNER_DEFAULTS = Object.freeze({
    energyCost: 800,
    seconds: 4,
    ticksPerSecond: 20,
    lavaPerCraft: 250
});

const INDUSTRIAL_BURNER_EVENT_ID = "utilitycraft:register_furnace_recipe";

const nativeIndustrialBurnerRecipes = [
    defineIndustrialBurnerRecipe("utilitycraft:raw_titanium", {
        output: "utilitycraft:titanium",
        energyCost: 1600,
        seconds: 5
    }),
    defineIndustrialBurnerRecipe("utilitycraft:raw_titanium_block", {
        output: "utilitycraft:titanium_block",
        energyCost: 12000,
        seconds: 10
    }),
    defineIndustrialBurnerRecipe("utilitycraft:deepslate_titanium_ore", {
        output: "utilitycraft:titanium",
        energyCost: 2200,
        seconds: 6
    }),
    defineIndustrialBurnerRecipe("minecraft:raw_iron", {
        output: "minecraft:iron_ingot"
    }),
    defineIndustrialBurnerRecipe("minecraft:raw_gold", {
        output: "minecraft:gold_ingot"
    }),
    defineIndustrialBurnerRecipe("minecraft:raw_copper", {
        output: "minecraft:copper_ingot"
    }),
    defineIndustrialBurnerRecipe("minecraft:iron_ore", {
        output: "minecraft:iron_ingot",
        energyCost: 1200
    }),
    defineIndustrialBurnerRecipe("minecraft:gold_ore", {
        output: "minecraft:gold_ingot",
        energyCost: 1200
    }),
    defineIndustrialBurnerRecipe("minecraft:copper_ore", {
        output: "minecraft:copper_ingot",
        energyCost: 1200
    }),
    defineIndustrialBurnerRecipe("minecraft:sand", {
        output: "minecraft:glass"
    }),
    defineIndustrialBurnerRecipe("minecraft:cobblestone", {
        output: "minecraft:stone"
    }),
    defineIndustrialBurnerRecipe("minecraft:porkchop", {
        output: "minecraft:cooked_porkchop"
    }),
    defineIndustrialBurnerRecipe("minecraft:beef", {
        output: "minecraft:cooked_beef"
    }),
    defineIndustrialBurnerRecipe("minecraft:chicken", {
        output: "minecraft:cooked_chicken"
    }),
    defineIndustrialBurnerRecipe("minecraft:cod", {
        output: "minecraft:cooked_cod"
    }),
    defineIndustrialBurnerRecipe("minecraft:salmon", {
        output: "minecraft:cooked_salmon"
    }),
    defineIndustrialBurnerRecipe("minecraft:potato", {
        output: "minecraft:baked_potato"
    }),
    defineIndustrialBurnerRecipe("minecraft:kelp", {
        output: "minecraft:dried_kelp"
    })
];

export const industrialBurnerRecipes = nativeIndustrialBurnerRecipes;

export function getIndustrialBurnerRecipes() {
    return industrialBurnerRecipes;
}

function defineIndustrialBurnerRecipe(recipeId, payload) {
    if (!recipeId || typeof recipeId !== "string") {
        throw new TypeError("Industrial Burner recipe id must be a non-empty string");
    }

    if (!payload || typeof payload !== "object") {
        throw new TypeError(`Industrial Burner recipe '${recipeId}' is invalid`);
    }

    const input = normalizeStack(payload.input ?? { id: recipeId, amount: payload.required }, {
        fallbackId: recipeId,
        fallbackAmount: payload.required ?? 1
    });
    const output = normalizeStack(payload.output, {
        fallbackAmount: payload.outputAmount ?? payload.amount ?? 1
    });
    const { ticks, seconds } = normalizeDuration(payload);

    return {
        id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : recipeId,
        input,
        output,
        energyCost: normalizePositiveInteger(payload.energyCost ?? payload.cost, INDUSTRIAL_BURNER_DEFAULTS.energyCost),
        lavaPerCraft: normalizePositiveInteger(payload.lavaPerCraft ?? payload.heatCost ?? payload.fluidCost, INDUSTRIAL_BURNER_DEFAULTS.lavaPerCraft),
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
            throw new TypeError("Industrial Burner stack is missing an item id");
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
        throw new TypeError("Industrial Burner stack is invalid");
    }

    return {
        id: fallbackId,
        amount: fallbackAmount
    };
}

function normalizeDuration(payload) {
    const explicitTicks = Number(payload.ticks ?? payload.timeTicks ?? payload.processingTicks);
    if (Number.isFinite(explicitTicks) && explicitTicks > 0) {
        const ticks = Math.max(1, Math.floor(explicitTicks));
        return {
            ticks,
            seconds: Number((ticks / INDUSTRIAL_BURNER_DEFAULTS.ticksPerSecond).toFixed(2))
        };
    }

    const explicitSeconds = Number(payload.seconds ?? payload.time ?? payload.processingTimeSeconds);
    const seconds = Number.isFinite(explicitSeconds) && explicitSeconds > 0
        ? explicitSeconds
        : INDUSTRIAL_BURNER_DEFAULTS.seconds;
    const normalizedSeconds = Number(seconds.toFixed(2));

    return {
        seconds: normalizedSeconds,
        ticks: Math.max(1, Math.round(normalizedSeconds * INDUSTRIAL_BURNER_DEFAULTS.ticksPerSecond))
    };
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function upsertIndustrialBurnerRecipe(recipeId, payload) {
    const recipe = defineIndustrialBurnerRecipe(recipeId, payload);
    const index = industrialBurnerRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        industrialBurnerRecipes[index] = recipe;
        return "replaced";
    }

    industrialBurnerRecipes.push(recipe);
    return "added";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== INDUSTRIAL_BURNER_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            try {
                const status = upsertIndustrialBurnerRecipe(recipeId, definition);
                if (status === "replaced") replaced++;
                else added++;
            } catch (error) {
                console.warn(`[Industrial Burner] Failed to register furnace recipe '${recipeId}':`, error);
            }
        }

        console.warn(`[Industrial Burner] Registered ${added} new and replaced ${replaced} furnace recipes.`);
    } catch (error) {
        console.warn("[Industrial Burner] Failed to parse furnace recipe payload:", error);
    }
});

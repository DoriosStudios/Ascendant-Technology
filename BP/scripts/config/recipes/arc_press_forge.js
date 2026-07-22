import { system } from "@minecraft/server";

const ARC_PRESS_FORGE_DEFAULTS = Object.freeze({
    energyCost: 6400,
    seconds: 4,
    ticksPerSecond: 20
});

const ARC_PRESS_EVENT_ID = "utilitycraft:register_press_recipe";

/**
 * @typedef {{ id: string, amount: number }} ArcPressStack
 * @typedef {{
 *   id: string,
 *   input: ArcPressStack,
 *   output: ArcPressStack,
 *   energyCost: number,
 *   seconds: number,
 *   ticks: number,
 *   description: string | null
 * }} ArcPressForgeRecipe
 */

const nativeArcPressForgeRecipes = [];

export const arcPressForgeRecipes = nativeArcPressForgeRecipes;

export function getArcPressForgeRecipes() {
    return arcPressForgeRecipes;
}

function defineArcPressForgeRecipe(recipeId, payload) {
    if (!recipeId || typeof recipeId !== "string") {
        throw new TypeError("Arc-Press Forge recipe id must be a non-empty string");
    }

    if (!payload || typeof payload !== "object") {
        throw new TypeError(`Arc-Press Forge recipe '${recipeId}' is invalid`);
    }

    const inputDefinition = payload.input ?? { id: recipeId, amount: payload.required };
    const outputDefinition = payload.output;
    if (!outputDefinition) {
        throw new TypeError(`Arc-Press Forge recipe '${recipeId}' is missing output`);
    }

    const input = normalizeStack(inputDefinition, {
        fallbackId: recipeId,
        fallbackAmount: payload.required ?? 1
    });
    const output = normalizeStack(outputDefinition, {
        fallbackAmount: payload.outputAmount ?? payload.amount ?? 1
    });

    const { ticks, seconds } = normalizeDuration(payload);

    return {
        id: payload.id ?? recipeId,
        input,
        output,
        energyCost: normalizePositiveInteger(payload.energyCost ?? payload.cost, ARC_PRESS_FORGE_DEFAULTS.energyCost),
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
            throw new TypeError("Arc-Press Forge stack is missing an item id");
        }

        return {
            id,
            amount: normalizePositiveInteger(
                stack.amount ?? stack.required ?? stack.count,
                fallbackAmount
            )
        };
    }

    throw new TypeError("Arc-Press Forge stack is invalid");
}

function normalizeDuration(payload) {
    const explicitTicks = Number(payload.ticks ?? payload.timeTicks ?? payload.processingTicks);
    if (Number.isFinite(explicitTicks) && explicitTicks > 0) {
        const ticks = Math.max(1, Math.floor(explicitTicks));
        return {
            ticks,
            seconds: Number((ticks / ARC_PRESS_FORGE_DEFAULTS.ticksPerSecond).toFixed(2))
        };
    }

    const explicitSeconds = Number(payload.seconds ?? payload.time ?? payload.processingTimeSeconds);
    const seconds = Number.isFinite(explicitSeconds) && explicitSeconds > 0
        ? explicitSeconds
        : ARC_PRESS_FORGE_DEFAULTS.seconds;
    const normalizedSeconds = Number(seconds.toFixed(2));

    return {
        seconds: normalizedSeconds,
        ticks: Math.max(1, Math.round(normalizedSeconds * ARC_PRESS_FORGE_DEFAULTS.ticksPerSecond))
    };
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function upsertArcPressForgeRecipe(recipeId, payload) {
    const recipe = defineArcPressForgeRecipe(recipeId, payload);
    const index = arcPressForgeRecipes.findIndex(entry => entry.id === recipe.id);

    if (index >= 0) {
        arcPressForgeRecipes[index] = recipe;
        return "replaced";
    }

    arcPressForgeRecipes.push(recipe);
    return "added";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== ARC_PRESS_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            try {
                const status = upsertArcPressForgeRecipe(recipeId, definition);
                if (status === "replaced") replaced++;
                else added++;
            } catch (error) {
                console.warn(`[Arc-Press Forge] Failed to register press recipe '${recipeId}':`, error);
            }
        }

    } catch (error) {
        console.warn("[Arc-Press Forge] Failed to parse press recipe payload:", error);
    }
});

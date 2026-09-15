// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage } from "DoriosCore/index.js";
import {
    createCatalystSignature,
    getCatalystWeaverCandidates,
    getCatalystWeaverRecipe,
    getCatalystWeaverRecipeRevision,
} from "../../config/recipes/catalystWeaver.js";

// Bounded by machine count, not by the number of inventory combinations seen.
const states = new Map();
const MAX_CACHED_MACHINES = 256;
const PREVIEW_LIMIT = 5;

export function resolveCatalystWeaver(entityId, container, input, fluidType) {
    let state = states.get(entityId);
    if (!state) {
        if (states.size >= MAX_CACHED_MACHINES) states.delete(states.keys().next().value);
        state = {
            types: new Array(6), amounts: new Array(6), totals: new Map(),
            inputId: undefined, inputAmount: 0, fluidType: undefined, revision: -1,
            signature: "", recipe: undefined, hints: undefined,
        };
        states.set(entityId, state);
    }
    const revision = getCatalystWeaverRecipeRevision();
    let changed = state.inputId !== input?.typeId || state.inputAmount !== (input?.amount ?? 0)
        || state.fluidType !== fluidType || state.revision !== revision;
    let catalystsChanged = false;
    let typesChanged = false;
    // These six reads also detect hopper/duct/player changes; no global inventory scan.
    if (input) {
        for (let index = 0; index < 6; index++) {
            const item = container.getItem(index + 4);
            const type = item?.typeId;
            const amount = item?.amount ?? 0;
            if (state.types[index] !== type) typesChanged = true;
            if (state.types[index] !== type || state.amounts[index] !== amount) catalystsChanged = true;
            state.types[index] = type;
            state.amounts[index] = amount;
        }
    }
    if (catalystsChanged) {
        state.totals.clear();
        for (let index = 0; index < 6; index++) {
            const type = state.types[index];
            if (type) state.totals.set(type, (state.totals.get(type) ?? 0) + state.amounts[index]);
        }
        if (typesChanged) state.signature = createCatalystSignature(state.totals.keys());
        changed = true;
    }
    if (changed) {
        state.inputId = input?.typeId;
        state.inputAmount = input?.amount ?? 0;
        state.fluidType = fluidType;
        state.revision = revision;
        state.recipe = input ? getCatalystWeaverRecipe(
            input.typeId, input.amount, state.totals, fluidType, state.signature,
        ) : undefined;
        state.hints = undefined;
    }
    return state;
}

/** Called only for an open UI. Stable inputs reuse the same sections and strings. */
export function getCatalystWeaverHints(entityId) {
    const state = states.get(entityId);
    if (!state?.inputId) return [];
    if (state.hints) return state.hints;
    const candidates = getCatalystWeaverCandidates(state.inputId);
    const sections = [];
    const previews = new Map();
    const options = new Map();
    const compatible = [];
    let deficits;
    let inputDeficit;
    for (const recipe of candidates) {
        const key = `${recipe.output.id}|${recipe.output.amount}|${recipe.output.name ?? ""}`;
        const preview = previews.get(key);
        if (preview) preview.variants++;
        else previews.set(key, { recipe, variants: 1 });
        if (!inputDeficit && state.inputAmount < recipe.input.amount) inputDeficit = recipe;
        if (!deficits) {
            const missing = recipe.catalysts.filter(catalyst => {
                const have = state.totals.get(catalyst.id) ?? 0;
                return have > 0 && have < catalyst.amount;
            });
            if (missing.length) deficits = missing;
        }
        let acceptsInserted = true;
        for (const type of state.totals.keys()) {
            if (!recipe.catalystAmounts.has(type)) { acceptsInserted = false; break; }
        }
        if (!acceptsInserted) continue;
        compatible.push(recipe);
        const next = nextCatalyst(recipe, state.totals);
        if (next && !options.has(next.id)) options.set(next.id, next);
    }
    if (previews.size) {
        const lines = [];
        for (const { recipe, variants } of previews.values()) {
            if (lines.length === PREVIEW_LIMIT) break;
            const name = recipe.output.name ?? itemName(recipe.output.id);
            const amount = recipe.output.amount > 1 ? ` x${recipe.output.amount}` : "";
            lines.push(`§7${name}${amount}${variants > 1 ? ` (+${variants - 1} alt)` : ""}`);
        }
        if (previews.size > PREVIEW_LIMIT) lines.push("§7...");
        sections.push({ title: `${previews.size} Potential Recipes`, lines });
    }
    if (options.size) {
        const lines = [];
        for (const option of options.values()) {
            if (lines.length === PREVIEW_LIMIT) break;
            lines.push(`§7- ${itemName(option.id)}`);
        }
        if (options.size > PREVIEW_LIMIT) lines.push("§7...");
        if (compatible.length === 1) {
            const next = nextCatalyst(compatible[0], state.totals);
            if (next) {
                lines.push(`§eNext: §f${itemName(next.id)} x${next.amount}`);
                if (next.hasFollowing) lines.push("§eFollowing: §f...???");
            }
        }
        sections.push({ title: "Catalyst Options", lines });
    }
    if (inputDeficit || deficits) {
        const lines = [];
        if (inputDeficit) lines.push(`§7Input: ${itemName(state.inputId)} ${state.inputAmount}/${inputDeficit.input.amount}`);
        for (const catalyst of (deficits ?? []).slice(0, PREVIEW_LIMIT)) {
            lines.push(`§7${itemName(catalyst.id)} ${state.totals.get(catalyst.id)}/${catalyst.amount}`);
        }
        if (deficits?.length > PREVIEW_LIMIT) lines.push("§7...");
        sections.push({ title: "Insufficient Amount", lines });
    }
    const fluids = state.recipe ? [state.recipe] : candidates;
    const fluidRecipes = fluids.filter(recipe => recipe.fluid);
    const first = fluidRecipes[0]?.fluid;
    let fluidLines = ["§7None"];
    if (first) {
        if (fluidRecipes.some(recipe => recipe.fluid.type !== first.type)) fluidLines = ["§7Varies"];
        else {
            fluidLines = [`§7${itemName(first.type)}`];
            if (fluidRecipes.every(recipe => recipe.fluid.amount === first.amount)) {
                fluidLines.push(`§7Amount: ${FluidStorage.formatFluid(first.amount)}`);
            }
        }
    }
    sections.push({ title: "Catalyst Fluid", lines: fluidLines });
    state.hints = sections;
    return sections;
}

function nextCatalyst(recipe, totals) {
    const available = new Map(totals);
    for (let index = 0; index < recipe.catalystSteps.length; index++) {
        const catalyst = recipe.catalystSteps[index];
        const have = available.get(catalyst.id) ?? 0;
        if (have >= catalyst.amount) {
            available.set(catalyst.id, have - catalyst.amount);
            continue;
        }
        return { id: catalyst.id, amount: catalyst.amount - have, hasFollowing: index + 1 < recipe.catalystSteps.length };
    }
    return undefined;
}

function itemName(id) {
    return DoriosLib.text.formatIdentifier(id);
}

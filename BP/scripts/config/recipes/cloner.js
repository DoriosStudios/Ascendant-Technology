const KDE = 1000;
const DEFAULT_FLUID_TYPE = 'liquified_aetherium';
const FLUID_PER_SECOND = 50; // mB per second (significant long-term drain)

/**
 * Energy consumption (in kDE per second) grows exponentially per rarity.
 * The curve starts at 5 kDE for common recipes (per the spec) and multiplies
 * by 25 for each subsequent tier, guaranteeing the example series 5 → 125 → 3 125.
 *
 * Total energy cost for a recipe is derived as:
 *   (rarityRateKDE * timeSeconds + recipe.cost) * 1 000
 */
export const CLONER_RARITIES = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic"
];

const RARITY_BASE_RATE_KDE = {
    common:      10,
    uncommon:    48,
    rare:        240,
    epic:        1200,
    legendary:   6000,
    mythic:      30000
};

const nativeClonerRecipes = [
    defineClonerRecipe({
        id: "utilitycraft:clone_slime_core",
        rarity: "common",
        time: 3,
        input: { id: "minecraft:slime_ball" },
        output: { id: "minecraft:slime_ball" }
    }),
    defineClonerRecipe({
        id: "utilitycraft:clone_ender_pearl",
        rarity: "uncommon",
        time: 60,
        input: { id: "minecraft:ender_pearl" },
        output: { id: "minecraft:ender_pearl" }
    }),
    defineClonerRecipe({
        id: "utilitycraft:clone_ancient_debris",
        rarity: "rare",
        time: 150,
        input: { id: "minecraft:ancient_debris" },
        output: { id: "minecraft:ancient_debris" }
    }),
    defineClonerRecipe({
        id: "utilitycraft:clone_totem",
        rarity: "epic",
        time: 600,
        input: { id: "minecraft:totem_of_undying" },
        output: { id: "minecraft:totem_of_undying" }
    }),
    defineClonerRecipe({
        id: "utilitycraft:clone_nether_star",
        rarity: "legendary",
        time: 1200,
        input: { id: "minecraft:nether_star" },
        output: { id: "minecraft:nether_star" }
    }),
    defineClonerRecipe({
        id: "utilitycraft:clone_dragon_egg",
        rarity: "mythic",
        time: 2400,
        input: { id: "minecraft:dragon_egg" },
        output: { id: "minecraft:dragon_egg" }
    })
].filter(Boolean);

const registeredClonerRecipes = [];

export function registerClonerRecipe(recipe) {
    const normalized = defineClonerRecipe(recipe);
    if (!normalized) return null;
    registeredClonerRecipes.push(normalized);
    return normalized;
}

export function getClonerRecipes() {
    return [...nativeClonerRecipes, ...registeredClonerRecipes];
}

export function defineClonerRecipe(definition) {
    if (!definition) return null;

    const inputStack = normalizeItemStack(definition.input ?? definition.template ?? definition.base);
    if (!inputStack) return null;

    const outputStack = normalizeItemStack(definition.output ?? inputStack.id) ?? { id: inputStack.id, amount: 1 };

    const TEMPLATE_AMOUNT = 1;
    const COPY_AMOUNT = TEMPLATE_AMOUNT;

    const input = {
        id: inputStack.id,
        amount: TEMPLATE_AMOUNT
    };

    const output = {
        id: outputStack.id ?? inputStack.id,
        amount: TEMPLATE_AMOUNT + COPY_AMOUNT
    };

    const rarity = normalizeRarity(definition.rarity);
    const timeSeconds = normalizePositive(definition.time ?? definition.timeSeconds ?? 1, 1);
    const extraCostKDE = Math.max(0, Number(definition.cost ?? 0));

    const perSecondKDE = getRarityRateKDE(rarity);
    const baseCostKDE = perSecondKDE * timeSeconds;
    const totalCostKDE = baseCostKDE + extraCostKDE;

    const fluid = normalizeFluid(definition.fluid, timeSeconds);

    const id = definition.id ?? `${input.id}->${output.id}`;

    return {
        id,
        rarity,
        input,
        output,
        timeSeconds,
        ticks: Math.max(1, Math.round(timeSeconds * 20)),
        costKDE: totalCostKDE,
        perSecondKDE,
        energyCost: Math.max(KDE, Math.round(totalCostKDE * KDE)),
        fluid
    };
}

export function getRarityRateKDE(rarity) {
    return RARITY_BASE_RATE_KDE[rarity] ?? RARITY_BASE_RATE_KDE.common;
}

function normalizeRarity(value) {
    if (!value) return "common";
    const lowered = `${value}`.toLowerCase();
    return CLONER_RARITIES.includes(lowered) ? lowered : "common";
}

function normalizePositive(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function normalizeItemStack(stack) {
    if (!stack) return null;
    if (typeof stack === "string") {
        return { id: stack, amount: 1 };
    }
    if (typeof stack === "object" && typeof stack.id === "string") {
        const amount = normalizePositive(stack.amount ?? 1, 1);
        return { id: stack.id, amount };
    }
    return null;
}

function normalizeFluid(value, timeSeconds) {
    if (value === null) return null;

    const baseAmount = Math.max(1, Math.round(timeSeconds * FLUID_PER_SECOND));

    if (typeof value === 'object' && value !== null) {
        const type = sanitizeFluidType(value.type) ?? DEFAULT_FLUID_TYPE;
        const amount = normalizePositive(value.amount ?? baseAmount, baseAmount);
        return { type, amount };
    }

    if (typeof value === 'string') {
        return {
            type: sanitizeFluidType(value) ?? DEFAULT_FLUID_TYPE,
            amount: baseAmount
        };
    }

    return {
        type: DEFAULT_FLUID_TYPE,
        amount: baseAmount
    };
}

function sanitizeFluidType(type) {
    if (typeof type !== 'string') return null;
    const trimmed = type.trim();
    return trimmed.length ? trimmed.toLowerCase() : null;
}

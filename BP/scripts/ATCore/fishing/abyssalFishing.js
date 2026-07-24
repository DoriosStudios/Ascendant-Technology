// @ts-check

import { EnchantmentTypes, ItemStack, system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

const CATEGORY_KEYS = ["fish", "junk", "treasure"];
const ITEM_ID_FIXES = new Map([
    ["minecraft:lily_pad", "minecraft:waterlily"],
]);
const STACK_MULTIPLIER_LOCKS = new Set([
    "minecraft:book",
    "minecraft:enchanted_book",
    "minecraft:saddle",
]);
const REGISTRATION_EVENTS = new Set([
    "utilitycraft:register_autofisher_drop",
    "utilitycraft:register_abyssal_fisher_drop",
]);

const definitionsBySignature = new Map();
const tablesByTier = new Map();
const itemMaximums = new Map();
const compatibleEnchantmentsByItem = new Map();
let enchantmentTypes;

/**
 * Registers normalized loot definitions once. Runtime tier resolution is
 * cached, so the full catalog is never filtered from a machine tick.
 *
 * @param {unknown[]} definitions
 * @returns {number}
 */
export function registerAbyssalLootDefinitions(definitions) {
    if (!Array.isArray(definitions)) return 0;
    let added = 0;

    for (let index = 0; index < definitions.length; index++) {
        const definition = normalizeDefinition(definitions[index]);
        if (!definition) continue;
        const signature = definitionSignature(definition);
        if (definitionsBySignature.has(signature)) continue;
        definitionsBySignature.set(signature, definition);
        added++;
    }

    if (added > 0) tablesByTier.clear();
    return added;
}

/**
 * Returns a precompiled tier table through an exact O(1) cache lookup.
 * The first request for a previously unseen tier compiles it once.
 *
 * @param {number} requestedTier
 */
export function getAbyssalLootTable(requestedTier) {
    const tier = Math.max(0, Math.floor(Number(requestedTier) || 0));
    const cached = tablesByTier.get(tier);
    if (cached) return cached;

    const grouped = new Map(CATEGORY_KEYS.map((key) => [key, []]));
    let totalChance = 0;
    for (const definition of definitionsBySignature.values()) {
        if (definition.tier > tier) continue;
        grouped.get(definition.category).push(definition);
        totalChance += definition.chance;
    }

    const categories = new Map();
    for (let index = 0; index < CATEGORY_KEYS.length; index++) {
        const key = CATEGORY_KEYS[index];
        categories.set(key, compileWeightedPool(grouped.get(key)));
    }

    const table = {
        tier,
        totalChance,
        categories,
        empty: totalChance <= 0,
    };
    tablesByTier.set(tier, table);
    return table;
}

/**
 * Rolls one complete machine operation. Weighted pools are already compiled;
 * only the actual random results allocate ItemStacks.
 *
 * @param {{
 *   table: ReturnType<typeof getAbyssalLootTable>,
 *   totalRolls: number,
 *   chanceMultiplier: number,
 *   amountMultiplier: number,
 *   effectiveTier: number,
 *   effectiveLuck: number,
 *   config: any,
 * }} operation
 * @returns {ItemStack[]}
 */
export function rollAbyssalDrops(operation) {
    const simpleDrops = new Map();
    const customStacks = [];
    const categoryWeights = resolveCategoryWeights(
        operation.table,
        operation.effectiveLuck,
        operation.config?.fishingCategories,
    );
    const floatAttempts = Math.max(
        0,
        operation.table.totalChance * Math.max(0, Number(operation.chanceMultiplier) || 0),
    );

    for (let roll = 0; roll < operation.totalRolls; roll++) {
        const attempts = Math.floor(floatAttempts)
            + (Math.random() < floatAttempts % 1 ? 1 : 0);
        for (let attempt = 0; attempt < attempts; attempt++) {
            const category = pickCategory(categoryWeights);
            const definition = pickWeighted(operation.table.categories.get(category));
            if (!definition) continue;

            const baseAmount = randomAmount(definition.amount);
            const amount = isMultiplierLocked(definition)
                ? baseAmount
                : Math.ceil(baseAmount * Math.max(0, operation.amountMultiplier));
            if (amount <= 0) continue;

            if (definition.item === "minecraft:book") {
                customStacks.push(...createBookDrops(
                    amount,
                    operation.effectiveTier,
                    operation.effectiveLuck,
                    operation.config,
                ));
            } else if (definition.randomEnchant || definition.durabilityDamageRange) {
                customStacks.push(...createEquipmentDrops(
                    definition,
                    amount,
                    operation.effectiveTier,
                    operation.effectiveLuck,
                    operation.config,
                ));
            } else {
                simpleDrops.set(
                    definition.item,
                    (simpleDrops.get(definition.item) ?? 0) + amount,
                );
            }
        }
    }

    const result = [];
    for (const [typeId, amount] of simpleDrops) {
        result.push(...createPlainStacks(typeId, amount));
    }
    result.push(...customStacks);
    return result;
}

/** @param {unknown} value */
function normalizeDefinition(value) {
    if (!value || typeof value !== "object") return null;
    const raw = /** @type {any} */ (value);
    if (typeof raw.item !== "string" || raw.item.length === 0) return null;

    const item = ITEM_ID_FIXES.get(raw.item) ?? raw.item;
    const chance = Math.max(0, Number(raw.chance ?? 0.1) || 0);
    const tier = Math.max(0, Math.floor(Number(raw.tier) || 0));
    return {
        item,
        amount: normalizeAmount(raw.amount ?? 1),
        chance,
        tier,
        category: normalizeCategory(raw.category, item),
        durabilityDamageRange: normalizeRange(raw.durabilityDamageRange),
        randomEnchant: normalizeEnchantConfig(raw.randomEnchant),
    };
}

function normalizeAmount(value) {
    if (!Array.isArray(value)) return Math.max(0, Math.floor(Number(value) || 0));
    const first = Math.max(0, Math.floor(Number(value[0]) || 0));
    const second = Math.max(0, Math.floor(Number(value[1]) || first));
    return [Math.min(first, second), Math.max(first, second)];
}

function normalizeRange(value) {
    if (!Array.isArray(value) || value.length < 2) return undefined;
    const first = Math.max(0, Number(value[0]) || 0);
    const second = Math.max(first, Number(value[1]) || first);
    return [first, second];
}

function normalizeEnchantConfig(value) {
    if (!value || typeof value !== "object") return undefined;
    const raw = /** @type {any} */ (value);
    const result = {};
    if (raw.count !== undefined) result.count = raw.count;
    const numericKeys = [
        "chance",
        "chancePerTier",
        "chancePerLuck",
        "maxChance",
        "countPerTier",
        "countPerLuck",
        "qualityPerTier",
        "qualityPerLuck",
        "minQuality",
        "guaranteedTierThreshold",
        "guaranteedLuckThreshold",
    ];
    for (let index = 0; index < numericKeys.length; index++) {
        const key = numericKeys[index];
        const parsed = Number(raw[key]);
        if (Number.isFinite(parsed)) result[key] = parsed;
    }
    return result;
}

function normalizeCategory(value, itemId) {
    const category = String(value ?? "").trim().toLowerCase();
    if (CATEGORY_KEYS.includes(category)) return category;
    if (itemId === "minecraft:cod"
        || itemId === "minecraft:salmon"
        || itemId === "minecraft:tropical_fish"
        || itemId === "minecraft:pufferfish") return "fish";
    if (itemId === "minecraft:string"
        || itemId === "minecraft:bone"
        || itemId === "minecraft:waterlily"
        || itemId === "minecraft:ink_sac"
        || itemId === "minecraft:glow_ink_sac"
        || itemId === "minecraft:potion"
        || itemId === "minecraft:stick"
        || itemId === "minecraft:leather_boots"
        || itemId === "utilitycraft:sand_handful") return "junk";
    return "treasure";
}

function definitionSignature(definition) {
    return JSON.stringify([
        definition.item,
        definition.amount,
        definition.chance,
        definition.tier,
        definition.category,
        definition.durabilityDamageRange ?? null,
        definition.randomEnchant ?? null,
    ]);
}

function compileWeightedPool(entries) {
    const cumulative = [];
    let totalWeight = 0;
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (entry.chance <= 0) continue;
        totalWeight += entry.chance;
        cumulative.push({ entry, ceiling: totalWeight });
    }
    return { cumulative, totalWeight };
}

function pickWeighted(pool) {
    if (!pool || pool.totalWeight <= 0 || pool.cumulative.length === 0) return null;
    const roll = Math.random() * pool.totalWeight;
    let low = 0;
    let high = pool.cumulative.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (roll < pool.cumulative[middle].ceiling) high = middle;
        else low = middle + 1;
    }
    return pool.cumulative[low].entry;
}

function resolveCategoryWeights(table, luck, config) {
    const equivalent = clamp(
        Math.max(0, luck) / Math.max(1, Number(config?.luckOfTheSea?.luckPerLevel) || 10),
        0,
        Math.max(0, Number(config?.luckOfTheSea?.maxEquivalentLevel) || 3),
    );
    const base = config?.baseWeights ?? {};
    const deltas = config?.luckOfTheSea ?? {};
    const values = {
        fish: Math.max(0, (Number(base.fish) || 0.85) + equivalent * (Number(deltas.fishDeltaPerLevel) || -0.0015)),
        junk: Math.max(0, (Number(base.junk) || 0.10) + equivalent * (Number(deltas.junkDeltaPerLevel) || -0.0195)),
        treasure: Math.max(0, (Number(base.treasure) || 0.05) + equivalent * (Number(deltas.treasureDeltaPerLevel) || 0.021)),
    };

    let total = 0;
    for (let index = 0; index < CATEGORY_KEYS.length; index++) {
        const key = CATEGORY_KEYS[index];
        if ((table.categories.get(key)?.totalWeight ?? 0) <= 0) values[key] = 0;
        total += values[key];
    }
    if (total <= 0) return { fish: 1, junk: 0, treasure: 0 };
    return {
        fish: values.fish / total,
        junk: values.junk / total,
        treasure: values.treasure / total,
    };
}

function pickCategory(weights) {
    const roll = Math.random();
    if (roll < weights.fish) return "fish";
    if (roll < weights.fish + weights.junk) return "junk";
    return "treasure";
}

function randomAmount(amount) {
    return Array.isArray(amount)
        ? DoriosLib.math.randomInt(amount[0], amount[1])
        : Math.max(0, Math.floor(Number(amount) || 0));
}

function isMultiplierLocked(definition) {
    return STACK_MULTIPLIER_LOCKS.has(definition.item)
        || Boolean(definition.randomEnchant)
        || Boolean(definition.durabilityDamageRange)
        || getItemMaximum(definition.item) <= 1;
}

function createPlainStacks(typeId, requestedAmount) {
    const maximum = getItemMaximum(typeId);
    if (maximum <= 0) return [];
    const result = [];
    let amount = Math.max(0, Math.floor(requestedAmount));
    while (amount > 0) {
        const moved = Math.min(amount, maximum);
        result.push(new ItemStack(typeId, moved));
        amount -= moved;
    }
    return result;
}

function createBookDrops(amount, tier, luck, config) {
    const bookConfig = config?.bookEnchant ?? {};
    const chance = resolveEnchantChance({
        ...bookConfig,
        chance: bookConfig.baseChance,
    }, tier, luck, config?.luck);
    const countRange = resolveEnchantCount(bookConfig, tier, luck, config?.luck);
    const quality = resolveEnchantQuality(bookConfig, tier, luck, config?.luck);
    const result = [];

    for (let index = 0; index < amount; index++) {
        if (Math.random() > chance) {
            result.push(new ItemStack("minecraft:book", 1));
            continue;
        }
        const book = new ItemStack("minecraft:enchanted_book", 1);
        const count = DoriosLib.math.randomInt(countRange[0], countRange[1]);
        if (applyRandomEnchantments(book, count, quality)) result.push(book);
        else result.push(new ItemStack("minecraft:book", 1));
    }
    return result;
}

function createEquipmentDrops(definition, amount, tier, luck, config) {
    const defaults = config?.equipment ?? {};
    const enchantConfig = { ...defaults, ...(definition.randomEnchant ?? {}) };
    const chance = resolveEnchantChance(enchantConfig, tier, luck, config?.luck);
    const countRange = resolveEnchantCount(enchantConfig, tier, luck, config?.luck);
    const quality = resolveEnchantQuality(enchantConfig, tier, luck, config?.luck);
    const damageRange = definition.durabilityDamageRange ?? defaults.durabilityDamageRange;
    const result = [];

    for (let index = 0; index < amount; index++) {
        const stack = new ItemStack(definition.item, 1);
        applyRandomDurability(stack, damageRange);
        if (Math.random() <= chance) {
            applyRandomEnchantments(
                stack,
                DoriosLib.math.randomInt(countRange[0], countRange[1]),
                quality,
            );
        }
        result.push(stack);
    }
    return result;
}

function applyRandomEnchantments(stack, count, quality) {
    const enchantable = getEnchantable(stack);
    if (!enchantable) return false;
    const candidates = getCompatibleEnchantments(stack.typeId, enchantable).slice();
    let applied = 0;

    while (applied < count && candidates.length > 0) {
        const index = Math.floor(Math.random() * candidates.length);
        const type = candidates[index];
        candidates[index] = candidates[candidates.length - 1];
        candidates.pop();

        const minimum = Math.max(1, Number(type.minLevel) || 1);
        const maximum = Math.max(minimum, Number(type.maxLevel) || minimum);
        const adjustedMinimum = Math.min(
            maximum,
            Math.floor(minimum + (maximum - minimum) * clamp(quality, 0, 1)),
        );
        const level = DoriosLib.math.randomInt(adjustedMinimum, maximum);
        try {
            if (!enchantable.canAddEnchantment({ type, level })) continue;
            enchantable.addEnchantment({ type, level });
            applied++;
        } catch {}
    }
    return applied > 0;
}

function getCompatibleEnchantments(typeId, enchantable) {
    const cached = compatibleEnchantmentsByItem.get(typeId);
    if (cached) return cached;
    const result = [];
    const all = getEnchantmentTypes();
    for (let index = 0; index < all.length; index++) {
        const type = all[index];
        try {
            if (enchantable.canAddEnchantment({ type, level: 1 })) result.push(type);
        } catch {}
    }
    compatibleEnchantmentsByItem.set(typeId, result);
    return result;
}

function getEnchantmentTypes() {
    if (enchantmentTypes) return enchantmentTypes;
    try {
        enchantmentTypes = EnchantmentTypes.getAll() ?? [];
    } catch {
        enchantmentTypes = [];
    }
    return enchantmentTypes;
}

function getEnchantable(stack) {
    try {
        return stack.getComponent("minecraft:enchantable");
    } catch {
        return undefined;
    }
}

function resolveEnchantChance(config, tier, luck, luckConfig) {
    if ((Number.isFinite(config?.guaranteedTierThreshold) && tier >= config.guaranteedTierThreshold)
        || (Number.isFinite(config?.guaranteedLuckThreshold) && luck >= config.guaranteedLuckThreshold)) return 1;
    return clamp(
        (Number(config?.chance ?? config?.baseChance) || 0)
        + tier * (Number(config?.chancePerTier) || 0)
        + luck * (Number(config?.chancePerLuck ?? luckConfig?.enchantChancePerLuck) || 0),
        0,
        Number(config?.maxChance) || 1,
    );
}

function resolveEnchantCount(config, tier, luck, luckConfig) {
    const base = Array.isArray(config?.count)
        ? config.count
        : [config?.minCount ?? config?.count ?? 1, config?.maxCount ?? config?.count ?? 1];
    const bonus = Math.max(0, Math.floor(
        tier * (Number(config?.countPerTier) || 0)
        + luck * (Number(config?.countPerLuck ?? luckConfig?.enchantCountPerLuck) || 0),
    ));
    const minimum = Math.max(1, Math.floor(Number(base[0]) || 1));
    const maximum = Math.max(minimum, Math.floor(Number(base[1]) || minimum) + bonus);
    return [Math.min(maximum, minimum + Math.floor(bonus / 2)), maximum];
}

function resolveEnchantQuality(config, tier, luck, luckConfig) {
    return clamp(
        (Number(config?.minQuality) || 0)
        + tier * (Number(config?.qualityPerTier) || 0)
        + luck * (Number(config?.qualityPerLuck ?? luckConfig?.enchantQualityPerLuck) || 0),
        0,
        1,
    );
}

function applyRandomDurability(stack, range) {
    if (!Array.isArray(range)) return;
    try {
        const durability = stack.getComponent("minecraft:durability");
        if (!durability) return;
        const minimum = clamp(Number(range[0]) || 0, 0, 1);
        const maximum = clamp(Number(range[1]) || minimum, minimum, 1);
        const fraction = minimum + (maximum - minimum) * Math.random();
        durability.damage = Math.min(
            durability.maxDurability,
            Math.floor(durability.maxDurability * fraction),
        );
    } catch {}
}

function getItemMaximum(typeId) {
    const cached = itemMaximums.get(typeId);
    if (cached !== undefined) return cached;
    let maximum = 0;
    try {
        maximum = new ItemStack(typeId, 1).maxAmount;
    } catch {}
    itemMaximums.set(typeId, maximum);
    return maximum;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (!REGISTRATION_EVENTS.has(id)) return;
    try {
        const payload = JSON.parse(message);
        registerAbyssalLootDefinitions(Array.isArray(payload) ? payload : [payload]);
    } catch (error) {
        console.warn(`[Abyssal Fisher] Ignored invalid loot registration: ${error?.message ?? error}`);
    }
});

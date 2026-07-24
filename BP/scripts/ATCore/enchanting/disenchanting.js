// @ts-check

import { EnchantmentTypes, ItemStack } from "@minecraft/server";

const ENCHANTABLE_COMPONENT_ID = "minecraft:enchantable";
const maxLevelCache = new Map();

/**
 * Reads the source enchantments once and keeps the native enchantment types
 * needed to rebuild the item or create an enchanted book.
 *
 * @param {import("@minecraft/server").ItemStack | undefined} stack
 * @returns {DisenchantmentEntry[]}
 */
export function readDisenchantments(stack) {
    if (!stack) return [];

    const enchantable = getEnchantableComponent(stack);
    if (!enchantable) return [];

    try {
        const enchantments = enchantable.getEnchantments();
        const entries = new Array(enchantments.length);

        for (let index = 0; index < enchantments.length; index++) {
            const enchantment = enchantments[index];
            const id = normalizeEnchantmentId(enchantment.type?.id);
            entries[index] = {
                id,
                level: Math.max(1, Math.floor(Number(enchantment.level) || 1)),
                maxLevel: resolveMaxLevel(id, enchantment.type),
                type: enchantment.type,
            };
        }

        return entries.filter((entry) => entry.id.length > 0);
    } catch {
        return [];
    }
}

/**
 * Creates the minimal signature used to invalidate progress when the source,
 * its enchantments or the selected mode changes.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {string} mode
 * @param {DisenchantmentEntry[]} enchantments
 */
export function createDisenchantSignature(stack, mode, enchantments) {
    let signature = `${stack.typeId}|${mode}`;
    for (let index = 0; index < enchantments.length; index++) {
        const entry = enchantments[index];
        signature += `|${entry.id}@${entry.level}`;
    }
    return signature;
}

/** @param {DisenchantmentEntry[]} enchantments */
export function getAbsorbedXp(enchantments) {
    let total = 0;

    for (let index = 0; index < enchantments.length; index++) {
        const entry = enchantments[index];
        total += entry.level * getXpPerLevel(entry.maxLevel);
    }

    return total;
}

/**
 * Removes the first enchantment and returns both updated source and book.
 *
 * @param {import("@minecraft/server").ItemStack} source
 * @param {DisenchantmentEntry[]} enchantments
 * @returns {{ source: import("@minecraft/server").ItemStack, book: import("@minecraft/server").ItemStack } | undefined}
 */
export function extractFirstEnchantment(source, enchantments) {
    const extracted = enchantments[0];
    if (!extracted?.type) return undefined;

    const updatedSource = rebuildSource(source, enchantments.slice(1));
    if (!updatedSource) return undefined;

    const book = new ItemStack("minecraft:enchanted_book", 1);
    const enchantable = getEnchantableComponent(book);
    if (!enchantable) return undefined;

    try {
        enchantable.addEnchantment({
            type: extracted.type,
            level: extracted.level,
        });
        return { source: updatedSource, book };
    } catch {
        return undefined;
    }
}

/**
 * Removes every enchantment while preserving the source item's other data.
 * Enchanted books become normal books when emptied.
 *
 * @param {import("@minecraft/server").ItemStack} source
 */
export function removeAllDisenchantments(source) {
    return rebuildSource(source, []);
}

/**
 * @param {import("@minecraft/server").ItemStack} source
 * @param {DisenchantmentEntry[]} remaining
 */
function rebuildSource(source, remaining) {
    const result = source.clone();
    const enchantable = getEnchantableComponent(result);
    if (!enchantable) return undefined;

    try {
        enchantable.removeAllEnchantments();

        if (remaining.length > 0) {
            enchantable.addEnchantments(remaining.map((entry) => ({
                type: entry.type,
                level: entry.level,
            })));
            return result;
        }

        return source.typeId === "minecraft:enchanted_book"
            ? new ItemStack("minecraft:book", 1)
            : result;
    } catch {
        return undefined;
    }
}

/** @param {number} maxLevel */
function getXpPerLevel(maxLevel) {
    if (maxLevel >= 5) return 1000;
    if (maxLevel === 4) return 1250;
    if (maxLevel === 3) return 1666;
    if (maxLevel === 2) return 2500;
    return 5000;
}

/**
 * @param {string} id
 * @param {import("@minecraft/server").EnchantmentType | undefined} directType
 */
function resolveMaxLevel(id, directType) {
    const direct = Number(directType?.maxLevel);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

    const cached = maxLevelCache.get(id);
    if (cached !== undefined) return cached;

    let maxLevel = 1;
    try {
        const resolved = EnchantmentTypes.get(id);
        const value = Number(resolved?.maxLevel);
        if (Number.isFinite(value) && value > 0) maxLevel = Math.floor(value);
    } catch {}

    maxLevelCache.set(id, maxLevel);
    return maxLevel;
}

/** @param {import("@minecraft/server").ItemStack} stack */
function getEnchantableComponent(stack) {
    try {
        return /** @type {import("@minecraft/server").ItemEnchantableComponent | undefined} */ (
            stack.getComponent(ENCHANTABLE_COMPONENT_ID)
        );
    } catch {
        return undefined;
    }
}

/** @param {unknown} value */
function normalizeEnchantmentId(value) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * @typedef {{
 *   id: string,
 *   level: number,
 *   maxLevel: number,
 *   type: import("@minecraft/server").EnchantmentType
 * }} DisenchantmentEntry
 */

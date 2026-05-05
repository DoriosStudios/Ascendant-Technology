import { normalizeId } from "../utils.js";

/**
 * Checks whether an item has an enchantment whose identifier contains the requested token.
 *
 * This keeps Bedrock enchantment component differences in one place so combat, mining,
 * and utility handlers do not need to reimplement the same scan logic.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {string} token
 * @returns {boolean}
 */
export function hasEnchantmentToken(stack, token) {
    const expectedToken = normalizeId(token);
    if (!expectedToken) return false;

    try {
        const enchantable = stack?.getComponent?.("minecraft:enchantable")
            ?? stack?.getComponent?.("minecraft:enchantments")
            ?? stack?.getComponent?.("enchantments");

        const enchantments = enchantable?.getEnchantments?.() ?? enchantable?.enchantments;
        if (!enchantments) return false;

        const matches = entry => normalizeId(entry?.type?.id ?? entry?.id ?? entry?.typeId).includes(expectedToken);
        if (Array.isArray(enchantments)) {
            return enchantments.some(matches);
        }

        if (typeof enchantments[Symbol.iterator] === "function") {
            for (const entry of enchantments) {
                if (matches(entry)) return true;
            }
        }
    } catch { }

    return false;
}

/**
 * Convenience helper for Bedrock's Silk Touch enchantment.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {boolean}
 */
export function hasSilkTouch(stack) {
    return hasEnchantmentToken(stack, "silk_touch");
}

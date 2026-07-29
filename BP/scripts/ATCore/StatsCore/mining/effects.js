import { hasEnchantmentToken } from "../shared/enchantments.js";

export function hasSilkTouch(stack) {
    return hasEnchantmentToken(stack, "silk_touch");
}


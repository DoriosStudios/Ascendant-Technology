import { hasEnchantmentToken } from "../shared/enchantments.js";

export function createDoubleTroubleEffect(overrides = {}) {
    return {
        key: "double_trouble",
        kind: "double_trouble",
        label: "Double Trouble",
        baseChance: 0.001,
        chancePer10Levels: 0.001,
        maxChance: 0.01,
        ...overrides,
    };
}

export function hasSilkTouch(stack) {
    return hasEnchantmentToken(stack, "silk_touch");
}


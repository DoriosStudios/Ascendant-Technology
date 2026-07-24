/**
 * Repairs durability on a stack in-place.
 *
 * Uses the native durability component directly. StatsCore must not depend on
 * prototype patches or DoriosAPI compatibility shims.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {number} [amount=1]
 * @returns {boolean}
 */
export function repairItemDurability(stack, amount = 1) {
    if (!stack) return false;

    const repairAmount = Math.max(1, Math.floor(Number(amount) || 1));

    try {
        const durability = stack.getComponent?.("minecraft:durability") ?? stack.getComponent?.("durability");
        if (!durability) return false;

        const currentDamage = Math.max(0, Math.floor(Number(durability.damage ?? 0) || 0));
        if (currentDamage <= 0) return false;

        durability.damage = Math.max(0, currentDamage - repairAmount);
        return true;
    } catch {
        return false;
    }
}

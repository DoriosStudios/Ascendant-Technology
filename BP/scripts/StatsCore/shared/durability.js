/**
 * Repairs durability on a stack in-place.
 *
 * If DoriosAPI's `item.durability.repair()` patch is available, this helper uses it first.
 * Otherwise it falls back to the vanilla durability component so StatsCore keeps working
 * even when the shared prototype patch is not available yet.
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

        const durabilityApi = stack?.durability;
        if (durabilityApi && typeof durabilityApi.repair === "function") {
            durabilityApi.repair(repairAmount);
            return Math.max(0, Math.floor(Number(durability.damage ?? 0) || 0)) < currentDamage;
        }

        durability.damage = Math.max(0, currentDamage - repairAmount);
        return true;
    } catch {
        return false;
    }
}

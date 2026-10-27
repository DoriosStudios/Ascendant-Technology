/** Pure insertion simulation; ItemStack.clone/isStackableWith preserve metadata. */
export function planLootInsertion(container, slots, loot) {
    const original = slots.map(slot => container.getItem(slot));
    const items = original.map(item => item?.clone());
    for (const drop of loot) {
        let remaining = drop.amount;
        for (const item of items) {
            if (!item || !item.isStackableWith(drop)) continue;
            const moved = Math.min(remaining, item.maxAmount - item.amount);
            if (moved > 0) { item.amount += moved; remaining -= moved; }
            if (remaining === 0) break;
        }
        for (let index = 0; index < items.length && remaining > 0; index++) {
            if (items[index]) continue;
            const stack = drop.clone();
            stack.amount = Math.min(stack.maxAmount, remaining);
            items[index] = stack;
            remaining -= stack.amount;
        }
        if (remaining > 0) return undefined;
    }
    return { slots, original, items };
}

/** One synchronous commit; exceptions restore the snapshots and retain pending loot.
 * No awaits, network transfers or random rolls are allowed inside this function.
 */
export function commitOperation(container, plan, energy, xp, cost, xpAmount) {
    const beforeEnergy = energy.get(), beforeXp = xp.get();
    if (beforeEnergy < cost) return false;
    if (beforeXp + xpAmount > xp.getCap()) return false;
    try {
        if (energy.consume(cost) !== cost) return false;
        for (let index = 0; index < plan.slots.length; index++) container.setItem(plan.slots[index], plan.items[index]);
        xp.set(beforeXp + xpAmount);
        return true;
    } catch (error) {
        for (let index = 0; index < plan.slots.length; index++) container.setItem(plan.slots[index], plan.original[index]);
        energy.set(beforeEnergy);
        xp.set(beforeXp);
        throw error;
    }
}

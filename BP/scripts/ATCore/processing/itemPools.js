// @ts-check

import { ItemStack } from "@minecraft/server";

/** Finds the first valid input and resolves its recipe in O(slot count). */
export function selectPooledRecipe(container, inputSlots, recipes) {
    for (let index = 0; index < inputSlots.length; index++) {
        const item = container.getItem(inputSlots[index]);
        if (!item) continue;
        const recipe = recipes[item.typeId];
        if (recipe) return { inputTypeId: item.typeId, recipe };
    }
    return undefined;
}

export function countPooledInput(container, slots, typeId) {
    let amount = 0;
    for (let index = 0; index < slots.length; index++) {
        const item = container.getItem(slots[index]);
        if (item?.typeId === typeId) amount += item.amount;
    }
    return amount;
}

/** Returns output item capacity, not craft count. */
export function getPooledOutputCapacity(container, slots, outputTypeId, emptyStackSize = 64) {
    let capacity = 0;
    for (let index = 0; index < slots.length; index++) {
        const item = container.getItem(slots[index]);
        if (!item) capacity += emptyStackSize;
        else if (item.typeId === outputTypeId) capacity += Math.max(0, item.maxAmount - item.amount);
    }
    return capacity;
}

export function consumePooledInput(container, slots, typeId, requested) {
    let remaining = Math.max(0, Math.floor(requested));
    for (let index = 0; index < slots.length && remaining > 0; index++) {
        const slot = slots[index];
        const item = container.getItem(slot);
        if (item?.typeId !== typeId) continue;

        const removed = Math.min(item.amount, remaining);
        remaining -= removed;
        if (removed === item.amount) container.setItem(slot, undefined);
        else {
            item.amount -= removed;
            container.setItem(slot, item);
        }
    }
    return requested - remaining;
}

export function insertPooledOutput(container, slots, typeId, requested) {
    let remaining = Math.max(0, Math.floor(requested));

    for (let index = 0; index < slots.length && remaining > 0; index++) {
        const slot = slots[index];
        const item = container.getItem(slot);
        if (!item || item.typeId !== typeId || item.amount >= item.maxAmount) continue;
        const added = Math.min(remaining, item.maxAmount - item.amount);
        item.amount += added;
        remaining -= added;
        container.setItem(slot, item);
    }

    for (let index = 0; index < slots.length && remaining > 0; index++) {
        const slot = slots[index];
        if (container.getItem(slot)) continue;
        const item = new ItemStack(typeId, 1);
        item.amount = Math.min(remaining, item.maxAmount);
        remaining -= item.amount;
        container.setItem(slot, item);
    }

    return requested - remaining;
}

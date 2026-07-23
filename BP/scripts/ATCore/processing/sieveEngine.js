// @ts-check

import { ItemStack } from "@minecraft/server";
import { sieveRecipes } from "./recipeTables.js";

const meshProfiles = new Map();
const eligibleDropCache = new WeakMap();
const maxStackSizes = new Map();

/** Resolves static mesh component data once per exact item id. */
export function resolveMeshProfile(item) {
    if (!item) return undefined;
    if (meshProfiles.has(item.typeId)) return meshProfiles.get(item.typeId) ?? undefined;

    let profile;
    try {
        const params = item.getComponent("utilitycraft:mesh")?.customComponentParameters?.params;
        if (params && typeof params === "object") {
            profile = Object.freeze({
                itemTypeId: item.typeId,
                tier: Math.max(0, Math.floor(Number(params.tier) || 0)),
                multiplier: Math.max(0, Number(params.multiplier) || 1),
                amountMultiplier: Math.max(0, Number(params.amount_multiplier) || 1),
            });
        }
    } catch {
        profile = undefined;
    }

    meshProfiles.set(item.typeId, profile ?? null);
    return profile;
}

export function selectSieveRecipe(container, slots, lockedTypeId) {
    if (lockedTypeId) {
        const recipe = sieveRecipes.get(lockedTypeId);
        if (!recipe) return undefined;
        for (let index = 0; index < slots.length; index++) {
            const item = container.getItem(slots[index]);
            if (item?.typeId === lockedTypeId) return { inputTypeId: lockedTypeId, recipe };
        }
        return undefined;
    }

    for (let index = 0; index < slots.length; index++) {
        const item = container.getItem(slots[index]);
        if (!item) continue;
        const recipe = sieveRecipes.get(item.typeId);
        if (recipe) return { inputTypeId: item.typeId, recipe };
    }
    return undefined;
}

/** Cached mesh-tier filtering; registration replaces recipe arrays and invalidates naturally. */
export function getEligibleSieveDrops(recipe, mesh) {
    if (!recipe || !mesh) return Object.freeze([]);
    let byMesh = eligibleDropCache.get(recipe);
    if (!byMesh) {
        byMesh = new Map();
        eligibleDropCache.set(recipe, byMesh);
    }
    const key = `${mesh.tier}:${mesh.tier >= 7 ? 1 : 0}`;
    const cached = byMesh.get(key);
    if (cached) return cached;

    const drops = Object.freeze(recipe.filter((drop) => (
        mesh.tier >= drop.tier
        && !(drop.item === "minecraft:flint" && mesh.tier >= 7)
    )));
    byMesh.set(key, drops);
    return drops;
}

/** One snapshot answers whether at least one eligible output can fit. */
export function hasSieveOutputCapacity(container, slots, drops) {
    let hasEmpty = false;
    const spareByType = new Map();
    for (let index = 0; index < slots.length; index++) {
        const item = container.getItem(slots[index]);
        if (!item) {
            hasEmpty = true;
            continue;
        }
        const spare = Math.max(0, item.maxAmount - item.amount);
        if (spare > 0) spareByType.set(item.typeId, (spareByType.get(item.typeId) ?? 0) + spare);
    }
    if (hasEmpty) return drops.length > 0;
    for (let index = 0; index < drops.length; index++) {
        if ((spareByType.get(drops[index].item) ?? 0) > 0) return true;
    }
    return false;
}

function randomAmount(amount) {
    if (!Array.isArray(amount)) return amount;
    return amount[0] + Math.floor(Math.random() * (amount[1] - amount[0] + 1));
}

/** Rolls only when a paid cycle completes and aggregates identical drops in a Map. */
export function rollSieveDrops(drops, craftCount, mesh) {
    const rolled = new Map();
    const crafts = Math.max(0, Math.floor(craftCount));
    for (let craft = 0; craft < crafts; craft++) {
        for (let index = 0; index < drops.length; index++) {
            const drop = drops[index];
            if (Math.random() > Math.min(1, drop.chance * mesh.multiplier)) continue;
            const amount = Math.max(1, Math.ceil(randomAmount(drop.amount) * mesh.amountMultiplier));
            rolled.set(drop.item, (rolled.get(drop.item) ?? 0) + amount);
        }
    }
    return rolled;
}

function maxStackSize(typeId) {
    const cached = maxStackSizes.get(typeId);
    if (cached) return cached;
    let maximum = 64;
    try {
        maximum = new ItemStack(typeId, 1).maxAmount;
    } catch { }
    maxStackSizes.set(typeId, maximum);
    return maximum;
}

/** Inserts deterministic Map order, merging first and then claiming empty slots. */
export function insertSieveOutputs(container, slots, outputs) {
    let insertedTotal = 0;
    let insertedTypes = 0;

    for (const [typeId, requestedValue] of outputs) {
        let remaining = Math.max(0, Math.floor(requestedValue));
        const requested = remaining;
        if (!typeId || remaining <= 0) continue;

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
            try {
                const item = new ItemStack(typeId, 1);
                item.amount = Math.min(remaining, maxStackSize(typeId));
                remaining -= item.amount;
                container.setItem(slot, item);
            } catch {
                break;
            }
        }

        const inserted = requested - remaining;
        if (inserted > 0) {
            insertedTotal += inserted;
            insertedTypes++;
        }
    }

    return { insertedTotal, insertedTypes };
}

// @ts-check

import { ItemStack, system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

const EMPTY_CAPSULE = "utilitycraft:empty_liquid_capsule";
const CAPSULE_CAPACITY_BUCKETS = 8;

const recentCollectionTick = new WeakMap();
const collectionFluids = new Map(
    ["water", "lava"].map((fluid) => [`minecraft:${fluid}`, {
        fluid,
        sound: `bucket.fill_${fluid}`,
    }]),
);
const DIAGONAL_OFFSETS = Object.freeze([
    { x: 1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: -1, z: -1 },
]);

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.isFirstEvent) return;

    tryCollectSource(
        event.player,
        event.beforeItemStack ?? event.itemStack,
        event.block,
    );
});

world.afterEvents.itemUse.subscribe((event) => {
    const hit = event.source.getBlockFromViewDirection({
        maxDistance: 6,
        includeLiquidBlocks: true,
    });

    tryCollectSource(event.source, event.itemStack, hit?.block);
});

function tryCollectSource(player, usedItem, block) {
    if (!block || recentCollectionTick.get(player) === system.currentTick) return false;

    const collection = collectionFluids.get(block.typeId);
    if (!collection) return false;

    const capsule = getCapsuleCollectionState(usedItem?.typeId, collection.fluid);
    if (!capsule || !isSourceBlock(block)) return false;

    const sources = findCollectableSources(block, capsule.remaining);
    if (sources.length === 0) return false;

    const removedSources = removeSources(sources);
    if (removedSources.length === 0) return false;

    const nextItemId = `utilitycraft:${collection.fluid}_capsule_${capsule.tier + removedSources.length}`;
    if (!replaceSelectedCapsule(player, usedItem.typeId, nextItemId)) {
        restoreSources(removedSources);
        return false;
    }

    recentCollectionTick.set(player, system.currentTick);

    try {
        player.playSound(collection.sound);
    } catch {
        // Sound failure must not undo a completed collection.
    }

    return true;
}

function getCapsuleCollectionState(itemId, fluid) {
    if (itemId === EMPTY_CAPSULE) return { tier: 0, remaining: CAPSULE_CAPACITY_BUCKETS };

    const match = new RegExp(`^utilitycraft:${fluid}_capsule_([1-8])$`).exec(itemId ?? "");
    if (!match) return undefined;

    const tier = Number(match[1]);
    if (tier >= CAPSULE_CAPACITY_BUCKETS) return undefined;
    return { tier, remaining: CAPSULE_CAPACITY_BUCKETS - tier };
}

/** Collects the target, its four horizontal neighbors, then its diagonals. */
function findCollectableSources(origin, limit) {
    const candidates = [
        origin,
        ...DoriosLib.block.getAdjacentBlocks(origin).filter((block) => block.location.y === origin.location.y),
        ...DIAGONAL_OFFSETS.map(({ x, z }) => safeGetBlock(origin.dimension, {
            x: origin.location.x + x,
            y: origin.location.y,
            z: origin.location.z + z,
        })),
    ];
    const sources = [];
    const seenLocations = new Set();

    for (const block of candidates) {
        if (!block || block.typeId !== origin.typeId || !isSourceBlock(block)) continue;
        const { x, y, z } = block.location;
        const locationKey = `${x},${y},${z}`;
        if (seenLocations.has(locationKey)) continue;
        seenLocations.add(locationKey);
        sources.push(block);
        if (sources.length >= limit) break;
    }

    return sources;
}

function safeGetBlock(dimension, location) {
    try {
        return dimension.getBlock(location);
    } catch {
        return undefined;
    }
}

function removeSources(sources) {
    const removed = [];
    for (const block of sources) {
        const permutation = block.permutation;
        try {
            block.setType("minecraft:air");
            removed.push({ block, permutation });
        } catch {
            // Continue with other sources; only successfully removed sources fill the capsule.
        }
    }
    return removed;
}

function restoreSources(sources) {
    for (const { block, permutation } of sources) {
        try {
            block.setPermutation(permutation);
        } catch {
            // Best-effort rollback if a block became invalid during the event.
        }
    }
}

function isSourceBlock(block) {
    try {
        const depth = block.permutation.getState("liquid_depth");
        return depth === undefined || depth === 0;
    } catch {
        return false;
    }
}

function replaceSelectedCapsule(player, expectedItemId, nextItemId) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const slot = player.selectedSlotIndex;
    const selected = inventory.getItem(slot);
    if (!selected || selected.typeId !== expectedItemId) return false;

    try {
        if (mergeCompletedCapsule(inventory, slot, selected, nextItemId)) return true;

        if (selected.amount === 1) {
            inventory.setItem(slot, new ItemStack(nextItemId, 1));
            return true;
        }

        selected.amount -= 1;
        inventory.setItem(slot, selected);

        const overflow = inventory.addItem(new ItemStack(nextItemId, 1));
        if (overflow) player.dimension.spawnItem(overflow, player.location);
        return true;
    } catch {
        return false;
    }
}

/** Adds a completed capsule to a matching partial stack before using a new slot. */
function mergeCompletedCapsule(inventory, selectedSlot, selected, nextItemId) {
    for (let slot = 0; slot < inventory.size; slot++) {
        if (slot === selectedSlot) continue;
        const stack = inventory.getItem(slot);
        if (!stack || stack.typeId !== nextItemId || stack.amount >= stack.maxAmount) continue;

        stack.amount++;
        inventory.setItem(slot, stack);
        if (selected.amount === 1) inventory.setItem(selectedSlot, undefined);
        else {
            selected.amount--;
            inventory.setItem(selectedSlot, selected);
        }
        return true;
    }
    return false;
}

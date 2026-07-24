// @ts-check

import { ItemStack, system, world } from "@minecraft/server";

const EMPTY_CAPSULE = "utilitycraft:empty_liquid_capsule";

const collectionTransitions = new Map();
const recentCollectionTick = new WeakMap();

for (const fluid of ["water", "lava"]) {
    const transitions = new Map();
    transitions.set(EMPTY_CAPSULE, `utilitycraft:${fluid}_capsule_1`);

    for (let tier = 1; tier < 8; tier++) {
        transitions.set(
            `utilitycraft:${fluid}_capsule_${tier}`,
            `utilitycraft:${fluid}_capsule_${tier + 1}`,
        );
    }

    collectionTransitions.set(`minecraft:${fluid}`, {
        sound: `bucket.fill_${fluid}`,
        transitions,
    });
}

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

    const collection = collectionTransitions.get(block.typeId);
    if (!collection) return false;

    const nextItemId = collection.transitions.get(usedItem?.typeId);
    if (!nextItemId || !isSourceBlock(block)) return false;

    const previousPermutation = block.permutation;
    try {
        block.setType("minecraft:air");
    } catch {
        return false;
    }

    if (!replaceSelectedCapsule(player, usedItem.typeId, nextItemId)) {
        try {
            block.setPermutation(previousPermutation);
        } catch {
            // Best-effort rollback if the block became invalid during the event.
        }
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

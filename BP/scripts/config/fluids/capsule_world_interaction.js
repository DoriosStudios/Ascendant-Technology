import { ItemStack, world } from "@minecraft/server";

const EMPTY_CAPSULE_ID = "utilitycraft:empty_liquid_capsule";
const CAPSULE_MIN_TIER = 1;
const CAPSULE_MAX_TIER = 8;

const AIR_BLOCK_IDS = new Set([
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air"
]);

const CAPSULE_FLUID_BLOCK_BY_TYPE = Object.freeze({
    water: "minecraft:water",
    lava: "minecraft:lava",
    // Future-ready mapping:
    // dark_matter: "utilitycraft:dark_matter_fluid_block"
});

const CAPSULE_FLUID_TYPE_BY_BLOCK = Object.freeze({
    "minecraft:water": "water",
    "minecraft:lava": "lava"
    // Future-ready mapping:
    // "utilitycraft:dark_matter_fluid_block": "dark_matter"
});

const CAPSULE_FLUID_TYPES = Object.freeze(Object.keys(CAPSULE_FLUID_BLOCK_BY_TYPE));
const FLUID_CAPSULE_REGEX = new RegExp(
    `^utilitycraft:(${CAPSULE_FLUID_TYPES.join("|")})_capsule_([${CAPSULE_MIN_TIER}-${CAPSULE_MAX_TIER}])$`
);

const FACE_OFFSETS = Object.freeze({
    down: { x: 0, y: -1, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    west: { x: -1, y: 0, z: 0 },
    east: { x: 1, y: 0, z: 0 }
});

function isCreativePlayer(player) {
    if (!player) return false;
    if (player.isInCreative?.() === true) return true;

    const mode = player.getGameMode?.();
    return typeof mode === "string" && mode.toLowerCase() === "creative";
}

function parseCapsule(itemId) {
    if (!itemId) return null;

    if (itemId === EMPTY_CAPSULE_ID) {
        return { fluidType: null, tier: 0 };
    }

    const match = itemId.match(FLUID_CAPSULE_REGEX);
    if (!match) return null;

    const tier = Number(match[2]);
    if (!Number.isFinite(tier)) return null;

    return { fluidType: match[1], tier };
}

function clampTier(tier) {
    const value = Number(tier);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(CAPSULE_MAX_TIER, Math.floor(value)));
}

function getCapsuleId(fluidType, tier) {
    const normalizedTier = clampTier(tier);
    if (normalizedTier <= 0) return EMPTY_CAPSULE_ID;
    return `utilitycraft:${fluidType}_capsule_${normalizedTier}`;
}

function isFullFluidSourceBlock(block) {
    if (!block) return false;

    const fluidType = CAPSULE_FLUID_TYPE_BY_BLOCK[block.typeId];
    if (!fluidType) return false;

    try {
        const depth = block.permutation?.getState?.("liquid_depth");
        if (depth === undefined) return true;
        return depth === 0;
    } catch {
        return false;
    }
}

function resolveOffset(face) {
    if (face === undefined || face === null) return null;

    const key = String(face).toLowerCase();
    return FACE_OFFSETS[key] ?? null;
}

function resolveOffsetFromViewDirection(player) {
    const view = player?.getViewDirection?.();
    if (!view) return null;

    const absX = Math.abs(view.x ?? 0);
    const absY = Math.abs(view.y ?? 0);
    const absZ = Math.abs(view.z ?? 0);

    if (absY >= absX && absY >= absZ) {
        return view.y >= 0 ? FACE_OFFSETS.up : FACE_OFFSETS.down;
    }

    if (absX >= absZ) {
        return view.x >= 0 ? FACE_OFFSETS.east : FACE_OFFSETS.west;
    }

    return view.z >= 0 ? FACE_OFFSETS.south : FACE_OFFSETS.north;
}

function getPlacementBlock(clickedBlock, blockFace, player) {
    if (!clickedBlock) return null;

    const offset = resolveOffset(blockFace) ?? resolveOffsetFromViewDirection(player);
    if (!offset) return null;

    const targetLocation = {
        x: clickedBlock.location.x + offset.x,
        y: clickedBlock.location.y + offset.y,
        z: clickedBlock.location.z + offset.z
    };

    try {
        return clickedBlock.dimension.getBlock(targetLocation);
    } catch {
        return null;
    }
}

function isValidPlacementTarget(block) {
    if (!block) return false;
    return AIR_BLOCK_IDS.has(block.typeId);
}

function getSelectedInventoryItem(player) {
    const slot = player?.selectedSlotIndex ?? 0;
    const inventory = player?.getComponent("minecraft:inventory")?.container;
    if (!inventory) return null;

    return {
        slot,
        inventory,
        item: inventory.getItem(slot)
    };
}

function canTransformHeldCapsule(player, expectedTypeId) {
    if (!player || !expectedTypeId) return false;
    if (isCreativePlayer(player)) return true;

    const selected = getSelectedInventoryItem(player);
    if (!selected?.item) return false;

    return selected.item.typeId === expectedTypeId;
}

function transformHeldCapsule(player, expectedTypeId, nextTypeId) {
    if (!player || !expectedTypeId || !nextTypeId) return false;
    if (isCreativePlayer(player)) return true;

    const selected = getSelectedInventoryItem(player);
    if (!selected) return false;

    const { slot, inventory } = selected;
    const current = inventory.getItem(slot);
    if (!current || current.typeId !== expectedTypeId) return false;

    if (current.amount > 1) {
        current.amount -= 1;
        inventory.setItem(slot, current);

        if (typeof player.addItem === "function") {
            player.addItem(nextTypeId, 1, true);
        } else {
            const overflow = inventory.addItem(new ItemStack(nextTypeId, 1));
            if (overflow) {
                player.dimension?.spawnItem?.(overflow, player.location);
            }
        }
        return true;
    }

    inventory.setItem(slot, new ItemStack(nextTypeId, 1));
    return true;
}

function safePlaySound(player, soundId) {
    try {
        player?.playSound?.(soundId);
    } catch {
        // no-op
    }
}

function setBlockTypeSafe(block, typeId) {
    if (!block || !typeId) return false;
    try {
        block.setType(typeId);
        return true;
    } catch {
        return false;
    }
}

function tryPickupFluid(event, player, itemId, capsuleInfo, clickedBlock) {
    const clickedFluidType = CAPSULE_FLUID_TYPE_BY_BLOCK[clickedBlock?.typeId];
    if (!clickedFluidType) return false;
    if (!isFullFluidSourceBlock(clickedBlock)) return false;

    const isEmptyCapsule = capsuleInfo.tier === 0;
    const isSameFluidCapsule = capsuleInfo.fluidType === clickedFluidType;
    const canUpgrade = capsuleInfo.tier < CAPSULE_MAX_TIER;

    if (!isEmptyCapsule && (!isSameFluidCapsule || !canUpgrade)) {
        return false;
    }

    const nextTier = isEmptyCapsule ? 1 : capsuleInfo.tier + 1;
    const nextItemId = getCapsuleId(clickedFluidType, nextTier);
    if (!canTransformHeldCapsule(player, itemId)) return false;

    const previousTypeId = clickedBlock.typeId;
    if (!setBlockTypeSafe(clickedBlock, "minecraft:air")) return false;

    if (!transformHeldCapsule(player, itemId, nextItemId)) {
        setBlockTypeSafe(clickedBlock, previousTypeId);
        return false;
    }

    if (clickedFluidType === "water") safePlaySound(player, "bucket.fill_water");
    if (clickedFluidType === "lava") safePlaySound(player, "bucket.fill_lava");

    if (event && "cancel" in event) event.cancel = true;
    return true;
}

function tryPlaceFluid(event, player, itemId, capsuleInfo, clickedBlock, blockFace) {
    const fluidType = capsuleInfo.fluidType;
    if (!fluidType || capsuleInfo.tier <= 0) return false;

    if (AIR_BLOCK_IDS.has(clickedBlock?.typeId)) return false;

    const fluidBlockId = CAPSULE_FLUID_BLOCK_BY_TYPE[fluidType];
    if (!fluidBlockId) return false;

    const placementBlock = getPlacementBlock(clickedBlock, blockFace, player);
    if (!isValidPlacementTarget(placementBlock)) return false;

    if (!canTransformHeldCapsule(player, itemId)) return false;

    const previousTypeId = placementBlock.typeId;
    if (!setBlockTypeSafe(placementBlock, fluidBlockId)) return false;

    const nextItemId = getCapsuleId(fluidType, capsuleInfo.tier - 1);
    if (!transformHeldCapsule(player, itemId, nextItemId)) {
        setBlockTypeSafe(placementBlock, previousTypeId);
        return false;
    }

    if (fluidType === "water") safePlaySound(player, "bucket.empty_water");
    if (fluidType === "lava") safePlaySound(player, "bucket.empty_lava");

    if (event && "cancel" in event) event.cancel = true;
    return true;
}

function getUseTarget(player) {
    if (!player?.getBlockFromViewDirection) return null;

    const target = player.getBlockFromViewDirection({
        maxDistance: 15,
        includeLiquidBlocks: true
    });

    const block = target?.block;
    if (!block?.isValid) return null;

    return {
        block,
        face: target?.face
    };
}

function onCapsuleUse(event) {
    const player = event?.source;
    if (!player || player.typeId !== "minecraft:player") return;

    const itemId = event?.itemStack?.typeId;
    if (!itemId) return;

    const capsuleInfo = parseCapsule(itemId);
    if (!capsuleInfo) return;

    const target = getUseTarget(player);
    if (!target) return;
    const clickedBlock = target.block;

    if (tryPickupFluid(event, player, itemId, capsuleInfo, clickedBlock)) return;
    const clickedFace = target.face ?? event?.blockFace ?? event?.face;
    tryPlaceFluid(event, player, itemId, capsuleInfo, clickedBlock, clickedFace);
}

// Bucket-like behavior parity: raycast target + face from itemUse event.
const capsuleUseEvent = world.afterEvents?.itemUse ?? world.beforeEvents?.itemUse;

if (capsuleUseEvent?.subscribe) {
    capsuleUseEvent.subscribe(onCapsuleUse);
} else {
    console.warn("[Ascendant Technology] itemUse event is unavailable; capsule world interaction is disabled.");
}

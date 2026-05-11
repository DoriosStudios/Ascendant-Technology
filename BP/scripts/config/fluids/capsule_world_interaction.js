import { ItemStack, world } from "@minecraft/server";
import { FluidManager } from "../../DoriosCore/machinery/fluidStorage.js";

const CAPSULE = Object.freeze({
    ids: Object.freeze({
        empty: "utilitycraft:empty_liquid_capsule"
    }),
    tiers: Object.freeze({
        min: 1,
        max: 8
    }),
    world: Object.freeze({
        maxDistance: 6,
        airBlockIds: new Set([
            "minecraft:air",
            "minecraft:cave_air",
            "minecraft:void_air"
        ]),
        faceOffsets: Object.freeze({
            down: { x: 0, y: -1, z: 0 },
            up: { x: 0, y: 1, z: 0 },
            north: { x: 0, y: 0, z: -1 },
            south: { x: 0, y: 0, z: 1 },
            west: { x: -1, y: 0, z: 0 },
            east: { x: 1, y: 0, z: 0 }
        })
    }),
    fluids: Object.freeze({
        blockByType: Object.freeze({
            water: "minecraft:water",
            lava: "minecraft:lava",
            // Future-ready mapping:
            // dark_matter: "utilitycraft:dark_matter_fluid_block"
        }),
        typeByBlock: Object.freeze({
            "minecraft:water": "water",
            "minecraft:lava": "lava"
            // Future-ready mapping:
            // "utilitycraft:dark_matter_fluid_block": "dark_matter"
        }),
        infiniteByItem: Object.freeze({
            "utilitycraft:water_capsule_infinite": "water",
            "utilitycraft:lava_capsule_infinite": "lava"
        }),
        types: Object.freeze(["water", "lava"])
    }),
    genericCapsuleRegex: /^utilitycraft:[a-z0-9_]+_capsule_(?:[1-8]|infinite)$/i,
    regex: new RegExp(
        `^utilitycraft:(${["water", "lava"].join("|")})_capsule_([${1}-${8}])$`
    )
});

function isCreativePlayer(player) {
    if (!player) return false;
    if (player.isInCreative?.() === true) return true;

    const mode = player.getGameMode?.();
    return typeof mode === "string" && mode.toLowerCase() === "creative";
}

function parseCapsule(itemId) {
    if (!itemId) return null;

    if (itemId === CAPSULE.ids.empty) {
        return { fluidType: null, tier: 0, infinite: false };
    }

    const infiniteFluidType = CAPSULE.fluids.infiniteByItem[itemId];
    if (infiniteFluidType) {
        return {
            fluidType: infiniteFluidType,
            tier: CAPSULE.tiers.max,
            infinite: true
        };
    }

    const match = itemId.match(CAPSULE.regex);
    if (!match) return null;

    const tier = Number(match[2]);
    if (!Number.isFinite(tier)) return null;

    return {
        fluidType: match[1],
        tier,
        infinite: false
    };
}

function isCapsuleItemId(itemId) {
    if (!itemId) return false;
    if (itemId === CAPSULE.ids.empty) return true;
    return CAPSULE.genericCapsuleRegex.test(itemId);
}

function clampTier(tier) {
    const value = Number(tier);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(CAPSULE.tiers.max, Math.floor(value)));
}

function getCapsuleId(fluidType, tier) {
    const normalizedTier = clampTier(tier);
    if (normalizedTier <= 0) return CAPSULE.ids.empty;
    return `utilitycraft:${fluidType}_capsule_${normalizedTier}`;
}

function isFullFluidSourceBlock(block) {
    if (!block) return false;

    const fluidType = CAPSULE.fluids.typeByBlock[block.typeId];
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
    return CAPSULE.world.faceOffsets[key] ?? null;
}

function resolveOffsetFromViewDirection(player) {
    const view = player?.getViewDirection?.();
    if (!view) return null;

    const absX = Math.abs(view.x ?? 0);
    const absY = Math.abs(view.y ?? 0);
    const absZ = Math.abs(view.z ?? 0);

    if (absY >= absX && absY >= absZ) {
        return view.y >= 0 ? CAPSULE.world.faceOffsets.up : CAPSULE.world.faceOffsets.down;
    }

    if (absX >= absZ) {
        return view.x >= 0 ? CAPSULE.world.faceOffsets.east : CAPSULE.world.faceOffsets.west;
    }

    return view.z >= 0 ? CAPSULE.world.faceOffsets.south : CAPSULE.world.faceOffsets.north;
}

function getPlacementBlock(clickedBlock, blockFace, player) {
    if (!clickedBlock) return null;

    if (isValidPlacementTarget(clickedBlock)) {
        return clickedBlock;
    }

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
    return CAPSULE.world.airBlockIds.has(block.typeId);
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

function addItemToInventoryOrDrop(player, itemId) {
    if (!player || !itemId) return false;

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const overflow = inventory.addItem(new ItemStack(itemId, 1));
    if (overflow) {
        player.dimension?.spawnItem?.(overflow, player.location);
    }

    return true;
}

function transformHeldCapsule(player, expectedTypeId, nextTypeId) {
    if (!player || !expectedTypeId || !nextTypeId) return false;
    if (isCreativePlayer(player)) return true;
    if (expectedTypeId === nextTypeId) return true;

    const selected = getSelectedInventoryItem(player);
    if (!selected) return false;

    const { slot, inventory } = selected;
    const current = inventory.getItem(slot);
    if (!current || current.typeId !== expectedTypeId) return false;

    if (current.amount > 1) {
        current.amount -= 1;
        inventory.setItem(slot, current);

        return addItemToInventoryOrDrop(player, nextTypeId);
    }

    inventory.setItem(slot, new ItemStack(nextTypeId, 1));
    return true;
}

function resolvePortFluidEntity(block) {
    if (!block?.hasTag?.("dorios:multiblock.port") || !block?.dimension || !block?.location) return null;

    const { x, y, z } = block.location;
    return block.dimension.getEntities({ tags: [`input:[${x},${y},${z}]`] })[0] ?? null;
}

function resolveFluidStorageEntity(block, preferredFluidType) {
    if (!block?.hasTag?.("dorios:fluid") || !block?.dimension || !block?.location) return null;

    const portEntity = resolvePortFluidEntity(block);
    if (portEntity) return portEntity;

    const entitiesAtBlock = block.dimension.getEntitiesAtBlockLocation(block.location) ?? [];
    const directEntity = entitiesAtBlock.find(entity => {
        try {
            return FluidManager.findType?.(entity, 0)?.getCap?.() > 0;
        } catch {
            return false;
        }
    });

    if (directEntity) return directEntity;

    if (block.typeId?.includes("fluid_tank") && preferredFluidType) {
        return FluidManager.addfluidToTank(block, preferredFluidType, 0);
    }

    return null;
}

function formatFluidTypeLabel(fluidType) {
    if (!fluidType || fluidType === "empty") return "Empty";

    return String(fluidType)
        .split("_")
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function showFluidInteractionFeedback(player, tank) {
    if (!player?.onScreenDisplay?.setActionBar || !tank) return;

    const type = tank.getType?.() ?? "empty";
    const stored = Math.max(0, tank.get?.() ?? 0);
    const cap = Math.max(0, tank.getCap?.() ?? 0);
    const percent = cap > 0 ? ((stored / cap) * 100).toFixed(2) : "0.00";

    player.onScreenDisplay.setActionBar(
        `§b${formatFluidTypeLabel(type)}: §f${FluidManager.formatFluid(stored)}§7 / §f${FluidManager.formatFluid(cap)} §7(${percent}%)`
    );
}

function tryInsertCapsuleIntoFluidTarget(event, player, itemId, clickedBlock) {
    if (!player || !itemId || !clickedBlock || !isCapsuleItemId(itemId)) return false;

    const containerData = FluidManager.getContainerData?.(itemId);
    if (!containerData?.type) return false;

    const targetEntity = resolveFluidStorageEntity(clickedBlock, containerData.type);
    if (!targetEntity) return false;

    let tank = null;
    try {
        tank = FluidManager.findType?.(targetEntity, 0) ?? new FluidManager(targetEntity, 0);
    } catch {
        return false;
    }

    if (!tank) return false;

    const resultItemId = tank.fluidItem(itemId);
    if (resultItemId === false) return false;

    if (!transformHeldCapsule(player, itemId, resultItemId || itemId)) {
        return false;
    }

    showFluidInteractionFeedback(player, tank);
    if (event && "cancel" in event) event.cancel = true;
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
    if (capsuleInfo?.infinite) return false;

    const clickedFluidType = CAPSULE.fluids.typeByBlock[clickedBlock?.typeId];
    if (!clickedFluidType) return false;
    if (!isFullFluidSourceBlock(clickedBlock)) return false;

    const isEmptyCapsule = capsuleInfo.tier === 0;
    const isSameFluidCapsule = capsuleInfo.fluidType === clickedFluidType;
    const canUpgrade = capsuleInfo.tier < CAPSULE.tiers.max;

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

    const fluidBlockId = CAPSULE.fluids.blockByType[fluidType];
    if (!fluidBlockId) return false;

    const placementBlock = getPlacementBlock(clickedBlock, blockFace, player);
    if (!isValidPlacementTarget(placementBlock)) return false;

    if (!canTransformHeldCapsule(player, itemId)) return false;

    const previousTypeId = placementBlock.typeId;
    if (!setBlockTypeSafe(placementBlock, fluidBlockId)) return false;

    const nextItemId = capsuleInfo.infinite
        ? itemId
        : getCapsuleId(fluidType, capsuleInfo.tier - 1);

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
        maxDistance: CAPSULE.world.maxDistance,
        includeLiquidBlocks: true
    });

    const block = target?.block;
    if (!block?.isValid) return null;

    return {
        block,
        face: target?.face
    };
}

function getEventTarget(event, player) {
    const block = event?.block;
    if (block?.isValid) {
        return {
            block,
            face: event?.blockFace ?? event?.face
        };
    }

    return getUseTarget(player);
}

function onCapsuleUse(event) {
    const player = event?.source;
    if (!player || player.typeId !== "minecraft:player") return;

    const itemId = event?.itemStack?.typeId;
    if (!itemId || !isCapsuleItemId(itemId)) return;

    const capsuleInfo = parseCapsule(itemId);

    const target = getEventTarget(event, player);
    if (!target) return;
    const clickedBlock = target.block;

    if (tryInsertCapsuleIntoFluidTarget(event, player, itemId, clickedBlock)) return;

    if (!capsuleInfo) return;

    if (tryPickupFluid(event, player, itemId, capsuleInfo, clickedBlock)) return;
    const clickedFace = target.face ?? event?.blockFace ?? event?.face;
    tryPlaceFluid(event, player, itemId, capsuleInfo, clickedBlock, clickedFace);
}

const capsuleUseOnEvent = world.beforeEvents?.itemUseOn;
const capsuleUseEvent = world.beforeEvents?.itemUse ?? world.afterEvents?.itemUse;

if (capsuleUseOnEvent?.subscribe) {
    capsuleUseOnEvent.subscribe(onCapsuleUse);
} else if (capsuleUseEvent?.subscribe) {
    capsuleUseEvent.subscribe(onCapsuleUse);
} else {
    console.warn("[Ascendant Technology] itemUse event is unavailable; capsule world interaction is disabled.");
}

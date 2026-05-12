import { ItemStack, system } from "@minecraft/server";
import { FluidManager } from "../../DoriosCore/machinery/fluidStorage.js";
import {
    FLUID_CAPSULE_COMPONENT_ID,
    FLUID_CAPSULE_EMPTY_FLUID,
    FLUID_CAPSULE_MAX_AMOUNT,
    FLUID_CAPSULE_STEP_AMOUNT,
    getFluidCapsuleDefinitionById,
    getFluidCapsuleFluidBlockId,
    getFluidCapsuleFluidTypeFromBlockId,
    getFluidCapsuleItemId,
    normalizeFluidCapsuleParams
} from "./capsule_registry.js";

const CAPSULE_USE = Object.freeze({
    maxDistance: 6,
    probeDistance: 0.6,
    airBlockIds: new Set([
        "minecraft:air"
    ]),
    faceOffsets: Object.freeze({
        down: { x: 0, y: -1, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        north: { x: 0, y: 0, z: -1 },
        south: { x: 0, y: 0, z: 1 },
        west: { x: -1, y: 0, z: 0 },
        east: { x: 1, y: 0, z: 0 }
    }),
    fillSoundByFluid: Object.freeze({
        water: "bucket.fill_water",
        lava: "bucket.fill_lava"
    }),
    emptySoundByFluid: Object.freeze({
        water: "bucket.empty_water",
        lava: "bucket.empty_lava"
    })
});

const recentCapsuleUses = new Map();

function getPlayer(source) {
    return source?.typeId === "minecraft:player" ? source : null;
}

function isCreativePlayer(player) {
    if (!player) return false;
    if (player.isInCreative?.() === true) return true;

    const mode = player.getGameMode?.();
    return typeof mode === "string" && mode.toLowerCase() === "creative";
}

function getSelectedInventoryState(player) {
    const slot = player?.selectedSlotIndex ?? 0;
    const inventory = player?.getComponent("minecraft:inventory")?.container;
    if (!inventory) return null;

    return {
        slot,
        inventory,
        item: inventory.getItem(slot)
    };
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

    const selected = getSelectedInventoryState(player);
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

function getVectorLength(vector) {
    if (!vector) return 0;
    const x = Number(vector.x) || 0;
    const y = Number(vector.y) || 0;
    const z = Number(vector.z) || 0;
    return Math.sqrt((x * x) + (y * y) + (z * z));
}

function normalizeVector(vector) {
    const length = getVectorLength(vector);
    if (length <= 0) return null;

    return {
        x: (Number(vector.x) || 0) / length,
        y: (Number(vector.y) || 0) / length,
        z: (Number(vector.z) || 0) / length
    };
}

function floorLocation(location) {
    if (!location) return null;

    return {
        x: Math.floor(Number(location.x) || 0),
        y: Math.floor(Number(location.y) || 0),
        z: Math.floor(Number(location.z) || 0)
    };
}

function getLocationKey(location) {
    if (!location) return "";
    return `${location.x},${location.y},${location.z}`;
}

function getBlockKey(block) {
    return getLocationKey(block?.location);
}

function getBlockCenter(block) {
    if (!block?.location) return null;

    return {
        x: block.location.x + 0.5,
        y: block.location.y + 0.5,
        z: block.location.z + 0.5
    };
}

function getDistanceSquared(from, to) {
    if (!from || !to) return Number.POSITIVE_INFINITY;

    const dx = (Number(from.x) || 0) - (Number(to.x) || 0);
    const dy = (Number(from.y) || 0) - (Number(to.y) || 0);
    const dz = (Number(from.z) || 0) - (Number(to.z) || 0);
    return (dx * dx) + (dy * dy) + (dz * dz);
}

function getEyeLocation(player) {
    if (!player) return null;
    return player.getHeadLocation?.() ?? {
        x: player.location?.x ?? 0,
        y: (player.location?.y ?? 0) + 1.62,
        z: player.location?.z ?? 0
    };
}

function getBlockSafe(dimension, location) {
    if (!dimension || !location) return null;

    try {
        return dimension.getBlock(location);
    } catch {
        return null;
    }
}

function addUniqueBlock(collection, seen, block) {
    if (!block?.isValid) return;

    const key = getBlockKey(block);
    if (!key || seen.has(key)) return;

    seen.add(key);
    collection.push(block);
}

function addUniqueLocation(collection, seen, location) {
    const normalized = floorLocation(location);
    if (!normalized) return;

    const key = getLocationKey(normalized);
    if (!key || seen.has(key)) return;

    seen.add(key);
    collection.push(normalized);
}

function resolveOffset(face) {
    if (face === undefined || face === null) return null;

    const key = String(face).toLowerCase();
    return CAPSULE_USE.faceOffsets[key] ?? null;
}

function resolveOffsetFromViewDirection(player) {
    const viewDirection = normalizeVector(player?.getViewDirection?.());
    if (!viewDirection) return null;

    const absX = Math.abs(viewDirection.x);
    const absY = Math.abs(viewDirection.y);
    const absZ = Math.abs(viewDirection.z);

    if (absY >= absX && absY >= absZ) {
        return viewDirection.y >= 0 ? CAPSULE_USE.faceOffsets.up : CAPSULE_USE.faceOffsets.down;
    }

    if (absX >= absZ) {
        return viewDirection.x >= 0 ? CAPSULE_USE.faceOffsets.east : CAPSULE_USE.faceOffsets.west;
    }

    return viewDirection.z >= 0 ? CAPSULE_USE.faceOffsets.south : CAPSULE_USE.faceOffsets.north;
}

function getRaycastTarget(player) {
    if (!player?.getBlockFromViewDirection) return null;

    const target = player.getBlockFromViewDirection({
        maxDistance: CAPSULE_USE.maxDistance,
        includeLiquidBlocks: true
    });

    if (!target?.block?.isValid) return null;

    return {
        block: target.block,
        face: target.face ?? null
    };
}

function getEventTarget(event, player) {
    const raycastTarget = getRaycastTarget(player);
    if (event?.block?.isValid) {
        return {
            block: event.block,
            face: event.blockFace ?? event.face ?? null,
            raycastBlock: raycastTarget?.block ?? null,
            raycastFace: raycastTarget?.face ?? null
        };
    }

    if (!raycastTarget) return null;

    return {
        block: raycastTarget.block,
        face: raycastTarget.face,
        raycastBlock: raycastTarget.block,
        raycastFace: raycastTarget.face
    };
}

function isFluidBlock(block) {
    return Boolean(getFluidCapsuleFluidTypeFromBlockId(block?.typeId));
}

function isFullFluidSourceBlock(block) {
    if (!isFluidBlock(block)) return false;

    try {
        const depth = block.permutation?.getState?.("liquid_depth");
        return depth === undefined || depth === 0;
    } catch {
        return false;
    }
}

function isValidPlacementTarget(block) {
    return Boolean(block && CAPSULE_USE.airBlockIds.has(block.typeId));
}

function getAdjacentBlock(block, offset) {
    if (!block?.location || !block?.dimension || !offset) return null;
    return getBlockSafe(block.dimension, {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    });
}

function getPlayerProbeBlocks(player) {
    if (!player?.dimension) return [];

    const blocks = [];
    const seenBlocks = new Set();
    const eyeLocation = getEyeLocation(player);
    const viewDirection = normalizeVector(player.getViewDirection?.());

    addUniqueBlock(blocks, seenBlocks, getBlockSafe(player.dimension, eyeLocation));

    if (eyeLocation && viewDirection) {
        addUniqueBlock(blocks, seenBlocks, getBlockSafe(player.dimension, {
            x: eyeLocation.x + (viewDirection.x * CAPSULE_USE.probeDistance),
            y: eyeLocation.y + (viewDirection.y * CAPSULE_USE.probeDistance),
            z: eyeLocation.z + (viewDirection.z * CAPSULE_USE.probeDistance)
        }));
    }

    return blocks;
}

function canPickupWorldFluid(capsule, fluidType) {
    if (!capsule || !fluidType || capsule.infinite) return false;
    if (capsule.fluid === FLUID_CAPSULE_EMPTY_FLUID || capsule.amount <= 0) return true;
    if (capsule.fluid !== fluidType) return false;
    return capsule.amount < FLUID_CAPSULE_MAX_AMOUNT;
}

function isValidPickupCandidate(block, capsule) {
    const fluidType = getFluidCapsuleFluidTypeFromBlockId(block?.typeId);
    return Boolean(fluidType && isFullFluidSourceBlock(block) && canPickupWorldFluid(capsule, fluidType));
}

function resolvePickupBlock(player, target, capsule) {
    const candidates = [];
    const seenCandidates = new Set();

    addUniqueBlock(candidates, seenCandidates, target?.raycastBlock);
    addUniqueBlock(candidates, seenCandidates, target?.block);

    for (const playerBlock of getPlayerProbeBlocks(player)) {
        addUniqueBlock(candidates, seenCandidates, playerBlock);
    }

    for (const candidate of candidates) {
        if (isValidPickupCandidate(candidate, capsule)) {
            return candidate;
        }
    }

    return null;
}

function getPlacementAnchors(target) {
    return [
        { block: target?.raycastBlock ?? null, face: target?.raycastFace ?? null },
        { block: target?.block ?? null, face: target?.face ?? null }
    ];
}

function resolvePlacementBlock(target, player) {
    const viewOffset = resolveOffsetFromViewDirection(player);
    const candidates = [];
    const seenCandidates = new Set();

    for (const anchor of getPlacementAnchors(target)) {
        if (!anchor.block) continue;

        const faceOffset = resolveOffset(anchor.face);
        addUniqueBlock(candidates, seenCandidates, anchor.block);
        addUniqueBlock(candidates, seenCandidates, getAdjacentBlock(anchor.block, faceOffset));

        if (viewOffset && (
            !faceOffset ||
            faceOffset.x !== viewOffset.x ||
            faceOffset.y !== viewOffset.y ||
            faceOffset.z !== viewOffset.z
        )) {
            addUniqueBlock(candidates, seenCandidates, getAdjacentBlock(anchor.block, viewOffset));
        }
    }

    for (const candidate of candidates) {
        if (isValidPlacementTarget(candidate)) {
            return candidate;
        }
    }

    return null;
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

    const directEntity = (block.dimension.getEntitiesAtBlockLocation(block.location) ?? []).find(entity => {
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
    if (!fluidType || fluidType === FLUID_CAPSULE_EMPTY_FLUID) return "Empty";
    return String(fluidType)
        .split("_")
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function showFluidInteractionFeedback(player, tank) {
    if (!player?.onScreenDisplay?.setActionBar || !tank) return;

    const type = tank.getType?.() ?? FLUID_CAPSULE_EMPTY_FLUID;
    const stored = Math.max(0, tank.get?.() ?? 0);
    const cap = Math.max(0, tank.getCap?.() ?? 0);
    const percent = cap > 0 ? ((stored / cap) * 100).toFixed(2) : "0.00";

    player.onScreenDisplay.setActionBar(
        `§b${formatFluidTypeLabel(type)}: §f${FluidManager.formatFluid(stored)}§7 / §f${FluidManager.formatFluid(cap)} §7(${percent}%)`
    );
}

function safePlaySound(player, soundId) {
    if (!soundId) return;

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

function shouldSkipDuplicateUse(player, target) {
    const playerKey = player?.name;
    if (!playerKey) return false;

    const targetKey = getLocationKey((target?.block ?? target?.raycastBlock)?.location) || "none";
    const useKey = `${system.currentTick}:${player.selectedSlotIndex ?? 0}:${targetKey}`;

    if (recentCapsuleUses.get(playerKey) === useKey) return true;
    recentCapsuleUses.set(playerKey, useKey);
    return false;
}

function tryInteractWithFluidStorage(player, itemId, capsule, clickedBlock) {
    if (!player || !itemId || !clickedBlock) return false;

    const preferredFluidType = capsule.fluid !== FLUID_CAPSULE_EMPTY_FLUID ? capsule.fluid : null;
    const targetEntity = resolveFluidStorageEntity(clickedBlock, preferredFluidType);
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
    if (!transformHeldCapsule(player, itemId, resultItemId || itemId)) return false;

    showFluidInteractionFeedback(player, tank);
    return true;
}

function tryPickupFromWorld(player, itemId, capsule, target) {
    const pickupBlock = resolvePickupBlock(player, target, capsule);
    const pickedFluidType = getFluidCapsuleFluidTypeFromBlockId(pickupBlock?.typeId);
    if (!pickupBlock || !pickedFluidType) return false;

    const nextAmount = capsule.amount <= 0
        ? FLUID_CAPSULE_STEP_AMOUNT
        : Math.min(FLUID_CAPSULE_MAX_AMOUNT, capsule.amount + FLUID_CAPSULE_STEP_AMOUNT);
    const nextItemId = getFluidCapsuleItemId(pickedFluidType, nextAmount);
    if (!nextItemId) return false;

    const previousTypeId = pickupBlock.typeId;
    if (!setBlockTypeSafe(pickupBlock, "minecraft:air")) return false;

    if (!transformHeldCapsule(player, itemId, nextItemId)) {
        setBlockTypeSafe(pickupBlock, previousTypeId);
        return false;
    }

    safePlaySound(player, CAPSULE_USE.fillSoundByFluid[pickedFluidType]);
    return true;
}

function tryPlaceIntoWorld(player, itemId, capsule, target) {
    if (!capsule || capsule.fluid === FLUID_CAPSULE_EMPTY_FLUID || capsule.amount <= 0) return false;

    const fluidBlockId = getFluidCapsuleFluidBlockId(capsule.fluid);
    if (!fluidBlockId) return false;

    const placementBlock = resolvePlacementBlock(target, player);
    if (!placementBlock) return false;

    const nextItemId = capsule.infinite
        ? itemId
        : getFluidCapsuleItemId(capsule.fluid, capsule.amount - FLUID_CAPSULE_STEP_AMOUNT);
    if (!nextItemId) return false;

    const previousTypeId = placementBlock.typeId;
    if (!setBlockTypeSafe(placementBlock, fluidBlockId)) return false;

    if (!transformHeldCapsule(player, itemId, nextItemId)) {
        setBlockTypeSafe(placementBlock, previousTypeId);
        return false;
    }

    safePlaySound(player, CAPSULE_USE.emptySoundByFluid[capsule.fluid]);
    return true;
}

function getCapsuleState(itemStack, rawParameters) {
    const itemId = itemStack?.typeId;
    const fallbackDefinition = getFluidCapsuleDefinitionById(itemId);
    if (!itemId || !fallbackDefinition) return null;

    return Object.freeze({
        itemId,
        ...normalizeFluidCapsuleParams(rawParameters?.params, itemId)
    });
}

function handleFluidCapsuleUse(event, rawParameters) {
    try {
        const player = getPlayer(event?.source);
        if (!player) return;

        const capsule = getCapsuleState(event?.itemStack, rawParameters);
        if (!capsule) return;

        const target = getEventTarget(event, player);
        if (shouldSkipDuplicateUse(player, target)) return;

        if (target?.block && tryInteractWithFluidStorage(player, capsule.itemId, capsule, target.block)) return;
        if (tryPickupFromWorld(player, capsule.itemId, capsule, target)) return;
        tryPlaceIntoWorld(player, capsule.itemId, capsule, target);
    } catch (error) {
        console.warn("[Ascendant Technology] fluid_capsule use failed.", error);
    }
}

const registerItemComponent = globalThis.DoriosAPI?.register?.itemComponent;

if (typeof registerItemComponent === "function") {
    registerItemComponent("fluid_capsule", {
        onUse(event, parameters) {
            handleFluidCapsuleUse(event, parameters);
        },
        onUseOn(event, parameters) {
            handleFluidCapsuleUse(event, parameters);
        }
    });
} else {
    console.warn(`[Ascendant Technology] ${FLUID_CAPSULE_COMPONENT_ID} could not be registered because DoriosAPI is unavailable.`);
}

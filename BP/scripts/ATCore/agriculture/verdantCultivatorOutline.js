// @ts-check

import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import * as DoriosLib from "DoriosLib/index.js";

const VERDANT_CULTIVATOR_ID = "utilitycraft:verdant_cultivator";
const MACHINE_ENTITY_ID = "utilitycraft:machine_entity";
const OUTLINE_ENTITY_ID = "utilitycraft:machine_area_outline";
const WRENCH_ITEM_ID = "utilitycraft:wrench";
const MAX_RANGE_LEVEL = 4;

const OUTLINE_ENABLED_PROPERTY = "utilitycraft:outline_enabled";
const OUTLINE_COLOR_PROPERTY = "utilitycraft:outline_color";
const OUTLINE_SIZE_PROPERTY = "utilitycraft:outline_size";
const OUTLINE_OFFSET_PROPERTIES = {
    x: "utilitycraft:outline_offset_x",
    y: "utilitycraft:outline_offset_y",
    z: "utilitycraft:outline_offset_z",
};

function translate(key) {
    return { translate: key };
}

function getOutlineLocation(block) {
    const { x, y, z } = block.location;
    return { x: x + 0.5, y: y + 0.25, z: z + 0.5 };
}

function getEntitiesAtMachine(block) {
    return block?.dimension.getEntitiesAtBlockLocation(block.location) ?? [];
}

export function findVerdantOutline(block) {
    return getEntitiesAtMachine(block)
        .find((entity) => entity.typeId === OUTLINE_ENTITY_ID);
}

function findMachineEntity(block) {
    return getEntitiesAtMachine(block)
        .find((entity) => entity.typeId === MACHINE_ENTITY_ID);
}

export function removeVerdantOutline(block) {
    for (const entity of getEntitiesAtMachine(block)) {
        if (entity.typeId !== OUTLINE_ENTITY_ID) continue;
        try {
            entity.remove();
        } catch {}
    }
}

function normalizeRangeLevel(value) {
    return Math.max(0, Math.min(MAX_RANGE_LEVEL, Math.floor(Number(value) || 0)));
}

function getOutlineTransform(block, rangeLevel) {
    const sideLength = 3 + normalizeRangeLevel(rangeLevel) * 2;
    const forwardCenter = (sideLength + 1) / 2;
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    // The shared outline model uses entity-model coordinates, whose horizontal
    // offsets are inverted relative to block-world directions.
    const offsets = {
        north: { x: 0, y: 0, z: forwardCenter },
        south: { x: 0, y: 0, z: -forwardCenter },
        east: { x: -forwardCenter, y: 0, z: 0 },
        west: { x: forwardCenter, y: 0, z: 0 },
    };
    return {
        size: sideLength,
        offset: offsets[direction] ?? { x: 0, y: 0, z: 0 },
    };
}

function setPropertyIfChanged(entity, propertyId, value) {
    if (entity.getProperty(propertyId) === value) return false;
    entity.setProperty(propertyId, value);
    return true;
}

export function syncVerdantOutline(block, outline, machineEntity, rangeLevel) {
    if (
        block?.typeId !== VERDANT_CULTIVATOR_ID
        || !outline?.isValid
        || !machineEntity?.isValid
    ) return false;

    const transform = getOutlineTransform(block, rangeLevel);
    setPropertyIfChanged(outline, OUTLINE_ENABLED_PROPERTY, true);
    setPropertyIfChanged(outline, OUTLINE_COLOR_PROPERTY, 0);
    setPropertyIfChanged(outline, OUTLINE_SIZE_PROPERTY, transform.size);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.x, transform.offset.x);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.y, transform.offset.y);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.z, transform.offset.z);
    return true;
}

function ensureVerdantOutline(block, machineEntity, rangeLevel) {
    let outline = findVerdantOutline(block);
    if (!outline) {
        try {
            outline = block.dimension.spawnEntity(OUTLINE_ENTITY_ID, getOutlineLocation(block));
        } catch (error) {
            console.warn(`[Verdant Cultivator] Could not spawn outline: ${error?.message ?? error}`);
            return undefined;
        }
    }
    syncVerdantOutline(block, outline, machineEntity, rangeLevel);
    return outline;
}

export function initializeVerdantOutline(block, player) {
    removeVerdantOutline(block);
    player?.onScreenDisplay.setActionBar(
        translate("message.utilitycraft.machine_outline.wrench_hint"),
    );
}

export function syncVerdantOutlineIfNeeded(machine, rangeLevel) {
    const outline = findVerdantOutline(machine?.block);
    if (!outline || !machine?.entity) return;

    const transform = getOutlineTransform(machine.block, rangeLevel);
    if (
        outline.getProperty(OUTLINE_SIZE_PROPERTY) === transform.size
        && outline.getProperty(OUTLINE_OFFSET_PROPERTIES.x) === transform.offset.x
        && outline.getProperty(OUTLINE_OFFSET_PROPERTIES.z) === transform.offset.z
    ) return;

    syncVerdantOutline(machine.block, outline, machine.entity, rangeLevel);
}

async function openOutlineMenu(block, player, machineEntity, rangeLevel) {
    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:machine_outline.title"))
        .toggle(translate("ui.utilitycraft:machine_outline.enabled"), {
            defaultValue: findVerdantOutline(block) !== undefined,
        })
        .submitButton(translate("ui.utilitycraft:machine_outline.save"));

    try {
        const result = await form.show(player);
        if (result.canceled || !machineEntity.isValid || block.typeId !== VERDANT_CULTIVATOR_ID) return;

        if (result.formValues?.[0] === true) {
            ensureVerdantOutline(block, machineEntity, rangeLevel);
        } else {
            removeVerdantOutline(block);
        }
    } catch (error) {
        console.warn(`[Verdant Cultivator] Outline menu failed: ${error?.message ?? error}`);
    }
}

export function handleVerdantOutlineInteract({ block, player }, rangeLevel = 0) {
    const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");
    if (mainHand?.typeId !== WRENCH_ITEM_ID) return false;

    const machineEntity = findMachineEntity(block);
    if (!machineEntity) return false;

    if (player.isSneaking) {
        system.run(() => {
            const outline = findVerdantOutline(block);
            if (outline?.isValid && machineEntity.isValid && block.typeId === VERDANT_CULTIVATOR_ID) {
                syncVerdantOutline(block, outline, machineEntity, rangeLevel);
            }
        });
        return true;
    }

    void openOutlineMenu(block, player, machineEntity, rangeLevel);
    return true;
}

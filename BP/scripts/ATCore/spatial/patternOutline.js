// @ts-check

import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import * as DoriosLib from "DoriosLib/index.js";
import {
    buildPatternPositions,
    getPatternConfigurationSignature,
} from "./patternGeometry.js";

const PATTERN_PLACER_ID = "utilitycraft:pattern_placer";
const MACHINE_ENTITY_ID = "utilitycraft:machine_entity";
const OUTLINE_ENTITY_ID = "utilitycraft:machine_area_outline";
const WRENCH_ITEM_ID = "utilitycraft:wrench";
const OUTLINE_ENABLED_KEY = "ascendant:pattern_outline_enabled";
const OUTLINE_SIGNATURE_KEY = "ascendant:pattern_outline_signature";

const OUTLINE_ENABLED_PROPERTY = "utilitycraft:outline_enabled";
const OUTLINE_COLOR_PROPERTY = "utilitycraft:outline_color";
const OUTLINE_SIZE_PROPERTY = "utilitycraft:outline_size";
const OUTLINE_DIMENSION_PROPERTIES = {
    width: "utilitycraft:outline_width",
    height: "utilitycraft:outline_height",
    depth: "utilitycraft:outline_depth",
};
const OUTLINE_OFFSET_PROPERTIES = {
    x: "utilitycraft:outline_offset_x",
    y: "utilitycraft:outline_offset_y",
    z: "utilitycraft:outline_offset_z",
};

function translate(key) {
    return { translate: key };
}

function getEntitiesAtMachine(block) {
    return block?.dimension.getEntitiesAtBlockLocation(block.location) ?? [];
}

function findMachineEntity(block) {
    return getEntitiesAtMachine(block)
        .find((entity) => entity.typeId === MACHINE_ENTITY_ID);
}

function getPatternOutlines(block) {
    return getEntitiesAtMachine(block)
        .filter((entity) => entity.typeId === OUTLINE_ENTITY_ID);
}

function getOutlineLocation(block) {
    const { x, y, z } = block.location;
    return { x: x + 0.5, y: y + 0.25, z: z + 0.5 };
}

function setPropertyIfChanged(entity, propertyId, value) {
    if (entity.getProperty(propertyId) === value) return false;
    entity.setProperty(propertyId, value);
    return true;
}

function setOutlineState(machineEntity, enabled, signature = "") {
    machineEntity.setDynamicProperty(OUTLINE_ENABLED_KEY, enabled);
    machineEntity.setDynamicProperty(OUTLINE_SIGNATURE_KEY, signature);
}

function getOutlineSignature(block, modeId) {
    return `box|${getPatternConfigurationSignature(block, modeId)}`;
}

export function removePatternOutline(block, machineEntity = findMachineEntity(block)) {
    for (const outline of getPatternOutlines(block)) {
        try {
            outline.remove();
        } catch {}
    }
    if (machineEntity?.isValid) setOutlineState(machineEntity, false);
}

function getPatternBounds(positions) {
    let minX = positions[0].x;
    let maxX = minX;
    let minY = positions[0].y;
    let maxY = minY;
    let minZ = positions[0].z;
    let maxZ = minZ;

    for (let index = 1; index < positions.length; index++) {
        const position = positions[index];
        minX = Math.min(minX, position.x);
        maxX = Math.max(maxX, position.x);
        minY = Math.min(minY, position.y);
        maxY = Math.max(maxY, position.y);
        minZ = Math.min(minZ, position.z);
        maxZ = Math.max(maxZ, position.z);
    }
    return { minX, maxX, minY, maxY, minZ, maxZ };
}

function configureOutline(outline, blockLocation, positions) {
    const bounds = getPatternBounds(positions);
    const dimensions = {
        width: bounds.maxX - bounds.minX + 1,
        height: bounds.maxY - bounds.minY + 1,
        depth: bounds.maxZ - bounds.minZ + 1,
    };
    const worldOffset = {
        x: (bounds.minX + bounds.maxX) / 2 - blockLocation.x,
        y: (bounds.minY + bounds.maxY) / 2 - blockLocation.y,
        z: (bounds.minZ + bounds.maxZ) / 2 - blockLocation.z,
    };
    setPropertyIfChanged(outline, OUTLINE_ENABLED_PROPERTY, true);
    setPropertyIfChanged(outline, OUTLINE_COLOR_PROPERTY, 0);
    setPropertyIfChanged(outline, OUTLINE_SIZE_PROPERTY, Math.max(dimensions.width, dimensions.depth));
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.width, dimensions.width);
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.height, dimensions.height);
    setPropertyIfChanged(outline, OUTLINE_DIMENSION_PROPERTIES.depth, dimensions.depth);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.x, worldOffset.x);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.y, worldOffset.y);
    setPropertyIfChanged(outline, OUTLINE_OFFSET_PROPERTIES.z, -worldOffset.z);
}

function rebuildPatternOutline(block, machineEntity, modeId) {
    for (const outline of getPatternOutlines(block)) {
        try {
            outline.remove();
        } catch {}
    }

    const positions = buildPatternPositions(block, modeId);
    if (positions.length === 0) {
        setOutlineState(machineEntity, false);
        return false;
    }

    let outline;
    try {
        outline = block.dimension.spawnEntity(OUTLINE_ENTITY_ID, getOutlineLocation(block));
        configureOutline(outline, block.location, positions);
    } catch (error) {
        try {
            outline?.remove();
        } catch {}
        setOutlineState(machineEntity, false);
        console.warn(`[Pattern Placer] Could not build outline: ${error?.message ?? error}`);
        return false;
    }

    setOutlineState(
        machineEntity,
        true,
        getOutlineSignature(block, modeId),
    );
    return true;
}

export function initializePatternOutline(block, machineEntity, player) {
    removePatternOutline(block, machineEntity);
    player?.onScreenDisplay.setActionBar(
        translate("message.utilitycraft.machine_outline.wrench_hint"),
    );
}

export function syncPatternOutlineIfNeeded(machine, modeId) {
    if (machine.entity.getDynamicProperty(OUTLINE_ENABLED_KEY) !== true) return;

    const signature = getOutlineSignature(machine.block, modeId);
    if (machine.entity.getDynamicProperty(OUTLINE_SIGNATURE_KEY) === signature) return;

    rebuildPatternOutline(machine.block, machine.entity, modeId);
}

async function openOutlineMenu(block, player, machineEntity, modeId) {
    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:machine_outline.title"))
        .toggle(translate("ui.utilitycraft:machine_outline.enabled"), {
            defaultValue: machineEntity.getDynamicProperty(OUTLINE_ENABLED_KEY) === true,
        })
        .submitButton(translate("ui.utilitycraft:machine_outline.save"));

    try {
        const result = await form.show(player);
        if (result.canceled || !machineEntity.isValid || block.typeId !== PATTERN_PLACER_ID) return;

        if (result.formValues?.[0] === true) {
            rebuildPatternOutline(block, machineEntity, modeId);
        } else {
            removePatternOutline(block, machineEntity);
        }
    } catch (error) {
        console.warn(`[Pattern Placer] Outline menu failed: ${error?.message ?? error}`);
    }
}

export function handlePatternOutlineInteract({ block, player }, modeId) {
    const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");
    if (mainHand?.typeId !== WRENCH_ITEM_ID) return false;

    const machineEntity = findMachineEntity(block);
    if (!machineEntity) return false;

    if (player.isSneaking) {
        if (machineEntity.getDynamicProperty(OUTLINE_ENABLED_KEY) !== true) return true;
        system.run(() => {
            if (machineEntity.isValid && block.typeId === PATTERN_PLACER_ID) {
                rebuildPatternOutline(block, machineEntity, modeId);
            }
        });
        return true;
    }

    void openOutlineMenu(block, player, machineEntity, modeId);
    return true;
}

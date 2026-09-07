// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    Generator,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    POWER_BEACON_ENTITY_ID,
    ensurePowerBeacon,
    maintainPowerBeacon,
    transferPowerBeaconEnergy,
    unregisterPowerBeacon,
} from "../../ATCore/networks/index.js";

const ID = "utilitycraft:power_beacon";
const TRANSMISSION_BUTTON_SLOT = 2;
const TRANSMISSION_PROPERTY = "ascendant:power_beacon_transmission";

// All inventory slots are UI controls; cables provide the stored energy.
for (const tier of ["basic", "advanced", "expert", "ultimate", "absolute"]) {
    registerIOInterface(`utilitycraft:${tier}_power_beacon`, {
        items: { anyInputSlots: [], anyOutputSlots: [], modes: [{ id: "disabled" }] },
    });
}

function isTransmissionEnabled(entity) {
    const value = entity.getDynamicProperty(TRANSMISSION_PROPERTY);
    return value !== "false" && value !== false;
}

function setTransmissionEnabled(entity, enabled) {
    entity.setDynamicProperty(TRANSMISSION_PROPERTY, enabled ? "true" : "false");
}

function syncTransmissionButton(entity) {
    const container = entity.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const nameTag = transmissionButtonName(entity);
    const current = container.getItem(TRANSMISSION_BUTTON_SLOT);
    // Let the watcher consume a pending click before restoring the button.
    if (ButtonManager.activeWatchers.has(entity.id) && current?.typeId !== "utilitycraft:ui_filler") return;
    if (current?.typeId === "utilitycraft:ui_filler" && current.nameTag === nameTag) return;

    const item = new ItemStack("utilitycraft:ui_filler", 1);
    item.nameTag = nameTag;
    item.setLore(["§r§7Toggle wireless energy transmission."]);
    container.setItem(TRANSMISSION_BUTTON_SLOT, item);
}

function transmissionButtonName(entity) {
    return `§r§7Transmission: ${isTransmissionEnabled(entity) ? "§aEnabled" : "§cDisabled"}`;
}

ButtonManager.registerMachineButton(ID, TRANSMISSION_BUTTON_SLOT, ({ entity, block }) => {
    const enabled = !isTransmissionEnabled(entity);
    setTransmissionEnabled(entity, enabled);
    if (!enabled && block) DoriosLib.block.setState(block, "utilitycraft:on", false);
    return transmissionButtonName(entity);
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Generator.spawnEntity(event, settings, (entity) => {
            setTransmissionEnabled(entity, true);
            syncTransmissionButton(entity);
            ensurePowerBeacon(entity, settings.generator.range);
        });
    },

    onTick(event, { params: settings }) {
        const generator = new Generator(event.block, settings);
        if (!generator.valid) return;

        const record = maintainPowerBeacon(generator.entity, settings.generator.range);
        if (!record) return;

        if (generator.shouldUpdateUI) {
            syncTransmissionButton(generator.entity);
            ButtonManager.ensureWatching(generator.entity, ID);
        }
        else ButtonManager.unwatchEntity(generator.entity);

        const enabled = isTransmissionEnabled(generator.entity);
        const result = enabled
            ? transferPowerBeaconEnergy(record, generator.energy, generator.rate)
            : { transferred: 0, targetCount: 0 };

        const running = enabled && result.transferred > 0;
        if (DoriosLib.block.getState(generator.block, "utilitycraft:on") !== running) {
            DoriosLib.block.setState(generator.block, "utilitycraft:on", running);
        }

        if (!generator.shouldUpdateUI) return;
        generator.energy.display(0);

        const interval = Math.max(1, generator.processingInterval);
        const sentPerTick = Math.floor(result.transferred / interval);
        generator.setLabel([
            "\u00A7r\u00A7dPower Beacon",
            `\u00A7r\u00A77Transmission: \u00A7f${enabled ? "Enabled" : "Disabled"}`,
            `\u00A7r\u00A77Range: \u00A7f${record.range} blocks`,
            `\u00A7r\u00A77Targets: \u00A7f${record.targets.size}`,
            `\u00A7r\u00A77Receiving: \u00A7f${result.targetCount}`,
            `\u00A7r\u00A77Rate: \u00A7f${EnergyStorage.formatEnergyToText(generator.baseRate)}/t`,
            `\u00A7r\u00A77Sent: \u00A7f${EnergyStorage.formatEnergyToText(sentPerTick)}/t`,
        ], 1);
    },

    onPlayerBreak(event) {
        const entity = findPowerBeaconEntity(event.block);
        if (entity) {
            ButtonManager.unwatchEntity(entity);
            unregisterPowerBeacon(entity.id);
        }
        Generator.onDestroy(event);
    },
});

function findPowerBeaconEntity(block) {
    const entities = block.dimension.getEntitiesAtBlockLocation(block.location);
    return entities.find((entity) => entity.typeId === POWER_BEACON_ENTITY_ID);
}

// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    Generator,
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

function isTransmissionEnabled(entity) {
    return entity.getDynamicProperty(TRANSMISSION_PROPERTY) !== "false";
}

function setTransmissionEnabled(entity, enabled) {
    entity.setDynamicProperty(TRANSMISSION_PROPERTY, enabled ? "true" : "false");
}

function syncTransmissionButton(entity) {
    const container = entity.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const nameTag = " ";
    const current = container.getItem(TRANSMISSION_BUTTON_SLOT);
    if (current?.typeId === "utilitycraft:ui_filler" && current.nameTag === nameTag) return;

    const item = new ItemStack("utilitycraft:ui_filler", 1);
    item.nameTag = nameTag;
    container.setItem(TRANSMISSION_BUTTON_SLOT, item);
}

ButtonManager.registerMachineButton(ID, TRANSMISSION_BUTTON_SLOT, ({ entity }) => {
    const enabled = !isTransmissionEnabled(entity);
    setTransmissionEnabled(entity, enabled);
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

        if (enabled && result.transferred > 0) generator.on();
        else generator.off();

        if (!generator.shouldUpdateUI) return;
        generator.energy.display(0);

        const interval = Math.max(1, generator.processingInterval);
        const sentPerTick = Math.floor(result.transferred / interval);
        generator.setLabel([
            "\u00A7r\u00A7dPower Beacon",
            `\u00A7r\u00A77Transmission: \u00A7f${enabled ? "Enabled" : "Disabled"}`,
            `\u00A7r\u00A77Range: \u00A7f${record.range} blocks`,
            `\u00A7r\u00A77Targets: \u00A7f${record.targets.size}`,
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

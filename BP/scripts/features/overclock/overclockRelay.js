// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine } from "DoriosCore/index.js";
import {
    ensureOverclockNetwork,
    getOverclockLevel,
    getOverclockNetworkForRelay,
    invalidateOverclockNetwork,
    setOverclockLevel,
} from "../../ATCore/overclock/index.js";
import { displayOverclock, formatLevel } from "./display.js";

const ID = "utilitycraft:overclock_relay";
const INVENTORY_SIZE = 3;
const LEGACY_SLOT_LAYOUT = [0, 1, 2];
const OVERCLOCK_DISPLAY_SLOT = 2;

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, (entity) => {
            setOverclockLevel(entity, 0);
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            displayOverclock(machine, 0, OVERCLOCK_DISPLAY_SLOT);
            ensureOverclockNetwork(event.block);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        ensureOverclockNetwork(event.block);
        const network = getOverclockNetworkForRelay(machine.entity);
        const level = getOverclockLevel(machine.entity);
        const transferRate = Math.max(0, Number(settings.machine.energy_transfer) || 0);
        const transferred = machine.energy.transferToNetwork(transferRate, "nearest");

        if (level > 0) machine.on();
        else machine.off();

        if (machine.shouldUpdateUI) {
            machine.energy.display(0);
            displayOverclock(machine, level, OVERCLOCK_DISPLAY_SLOT);
            machine.setLabel([
                `\u00A7r${level > 0 ? "\u00A7aNetwork Online" : "\u00A7eNetwork Offline"}`,
                `\u00A7r\u00A77Level: \u00A7f${formatLevel(level)}`,
                `\u00A7r\u00A77Towers: \u00A7f${network?.towers.length ?? 0}`,
                `\u00A7r\u00A77Relays: \u00A7f${network?.relays.length ?? 0}`,
                `\u00A7r\u00A77Targets: \u00A7f${network?.targets.length ?? 0}`,
                `\u00A7r\u00A77Energy Targets: \u00A7f${network?.energyTargets.length ?? 0}`,
                `\u00A7r\u00A77Energy Output: \u00A7f${EnergyStorage.formatEnergyToText(transferred)} / cycle`,
                `\u00A7r\u00A77Controller: \u00A7f${network?.controller?.id === machine.entity.id ? "Yes" : "No"}`,
            ]);
        }
    },

    onPlayerBreak(event) {
        const entity = findEntity(event.block);
        if (entity) setOverclockLevel(entity, 0);
        invalidateOverclockNetwork(event.block);
        Machine.onDestroy(event);
    },
});

function findEntity(block) {
    return block.dimension.getEntitiesAtBlockLocation(block.location)
        .find((entity) => entity.getProperty?.("utilitycraft:overclock") !== undefined);
}

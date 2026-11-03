// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { world } from "@minecraft/server";
import { EnergyStorage, Machine } from "DoriosCore/index.js";
import { updateAdjacentNetwork } from "DoriosCore/utils/entity.js";
import {
    ensureOverclockNetwork,
    getOverclockLevel,
    getOverclockNetworkForRelay,
    invalidateOverclockNetwork,
    OVERCLOCK_NETWORK_TAG,
    setOverclockLevel,
} from "../../ATCore/overclock/index.js";
import { displayOverclock, formatLevel } from "./display.js";

const ID = "utilitycraft:overclock_relay";
const INVENTORY_SIZE = 3;
const LEGACY_SLOT_LAYOUT = [0, 1, 2];
const OVERCLOCK_DISPLAY_SLOT = 2;
const energySources = new Set();
const energyTargets = new Map();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    energySources.delete(removedEntityId);
    energyTargets.delete(removedEntityId);
});

function ensureEnergySource(machine) {
    const entity = machine.entity;
    if (energySources.has(entity.id)) return;
    // Upgrade existing helpers in place, keeping their inventory and buffer.
    if (!entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_source")) {
        entity.triggerEvent("utilitycraft:energy_relay");
    }
    energySources.add(entity.id);
    // UC rebuilds this source's destinations, including branches of normal cable.
    updateAdjacentNetwork(machine.block);
}

function getEnergyTargets(machine) {
    const entity = machine.entity;
    let targets = energyTargets.get(entity.id);
    if (targets && !entity.hasTag("updateNetwork")) return targets;

    // Consume UC's refresh signal like EnergyStorage.transferToNetwork does.
    // UC alone creates/removes net: destinations; this cache only reads them.
    targets = entity.getTags()
        .filter(tag => tag.startsWith("net:["))
        .map(tag => tag.slice(5, -1).split(",").map(Number))
        .filter(values => values.length === 3 && values.every(Number.isFinite))
        .map(([x, y, z]) => ({ x, y, z }));
    const origin = machine.block.location;
    const distance = p => (p.x - origin.x) ** 2 + (p.y - origin.y) ** 2 + (p.z - origin.z) ** 2;
    targets.sort((a, b) => distance(a) - distance(b));
    energyTargets.set(entity.id, targets);
    entity.removeTag("updateNetwork");
    return targets;
}

function transferRelayEnergy(machine, limit) {
    let transferred = 0;
    for (const position of getEnergyTargets(machine)) {
        if (transferred >= limit || machine.energy.get() <= 0) break;
        try {
            const block = machine.dimension.getBlock(position);
            // Preserve the Relay's distribution role: never feed the Tower
            // back or circulate its buffer through other overclock Relays.
            if (!block || block.hasTag(OVERCLOCK_NETWORK_TAG)) continue;
            const target = machine.dimension.getEntitiesAtBlockLocation(position)
                .find(entity => entity.id !== machine.entity.id
                    && entity.getComponent("minecraft:type_family")?.hasTypeFamily("dorios:energy_container"));
            if (target) transferred += machine.energy.transferToEntity(target, limit - transferred);
        } catch {
            // Unloaded destinations remain in UC's list for their next load.
        }
    }
    return transferred;
}

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

        ensureEnergySource(machine);
        ensureOverclockNetwork(event.block);
        const network = getOverclockNetworkForRelay(machine.entity);
        const level = getOverclockLevel(machine.entity);
        const transferRate = Math.max(0, Number(settings.machine.energy_transfer) || 0);
        const transferred = transferRelayEnergy(machine, transferRate);

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
                `\u00A7r\u00A77Energy Network Nodes: \u00A7f${getEnergyTargets(machine).length}`,
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

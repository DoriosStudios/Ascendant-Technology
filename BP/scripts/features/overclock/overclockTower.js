// @ts-check

import { world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine } from "DoriosCore/index.js";
import {
    ensureOverclockNetwork,
    getOverclockFuel,
    getOverclockFuels,
    getOverclockNetworkForTower,
    invalidateOverclockNetwork,
    publishTowerOverclock,
    setOverclockLevel,
} from "../../ATCore/overclock/index.js";
import { displayOverclock, formatLevel } from "./display.js";

const ID = "utilitycraft:overclock_tower";
const FUEL_SLOTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const OVERCLOCK_DISPLAY_SLOT = 11;
const BURN_STATE_PROPERTY = "ascendant:overclock_burns";
const burnStates = new Map();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    burnStates.delete(removedEntityId);
});

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

        ensureOverclockNetwork(event.block);
        const fuelState = processFuelSlots(machine);
        const energyCost = Math.ceil(
            Math.max(1, Number(settings.machine.energy_cost) || 1)
            * Math.max(1, fuelState.totalPower / 2),
        );

        let level = 0;
        let status = "Insert Overclock Fuel";
        let running = false;

        if (fuelState.activeCount > 0) {
            if (machine.energy.get() >= energyCost) {
                machine.energy.consume(energyCost);
                level = Math.min(100, fuelState.totalPower * fuelState.maxEffectiveness);
                status = "Generating Overclock";
                running = level > 0;
            } else {
                status = "Insufficient Energy";
            }
        }

        publishTowerOverclock(machine.entity, level);
        const network = getOverclockNetworkForTower(machine.entity);
        if (running && !network?.controller) status = "Overclock Ready - Relay Required";

        let transferred = 0;
        if (running && network?.controller) {
            const perRelay = Math.max(0, Number(settings.machine.energy_transfer) || 0);
            for (const relay of network.relays) {
                transferred += machine.energy.transferToEntity(relay, perRelay);
            }
        }

        if (running) machine.on();
        else machine.off();

        if (machine.shouldUpdateUI) {
            machine.energy.display(0);
            displayOverclock(machine, level, OVERCLOCK_DISPLAY_SLOT);
            machine.setLabel(buildTowerLabel(
                status,
                level,
                energyCost,
                transferred,
                fuelState,
                network,
            ));
        }
    },

    onPlayerBreak(event) {
        const entity = findEntity(event.block);
        if (entity) {
            publishTowerOverclock(entity, 0);
            burnStates.delete(entity.id);
        }
        invalidateOverclockNetwork(event.block);
        Machine.onDestroy(event);
    },
});

function processFuelSlots(machine) {
    const burns = getBurnState(machine.entity);
    let totalPower = 0;
    let maxEffectiveness = 0;
    let activeCount = 0;
    const activeFuels = new Map();

    for (const slot of FUEL_SLOTS) {
        let burn = burns.get(slot);
        let expiredThisCycle = false;
        if (burn) {
            const fuel = getOverclockFuel(burn.itemTypeId);
            if (!fuel) {
                burns.delete(slot);
                burn = undefined;
            } else {
                burn.remaining--;
                if (burn.remaining <= 0) {
                    burns.delete(slot);
                    burn = undefined;
                    expiredThisCycle = true;
                }
            }
        }

        // Legacy waits one machine cycle after a burn expires before loading
        // the next item from that slot.
        if (!burn && !expiredThisCycle) {
            const stack = machine.container.getItem(slot);
            const fuel = stack ? getOverclockFuel(stack.typeId) : undefined;
            if (stack && fuel) {
                burn = {
                    itemTypeId: stack.typeId,
                    remaining: fuel.duration,
                };
                burns.set(slot, burn);
                consumeOne(machine.container, slot, stack);
            }
        }

        if (!burn) continue;
        const fuel = getOverclockFuel(burn.itemTypeId);
        if (!fuel) continue;

        totalPower += fuel.power;
        maxEffectiveness = Math.max(maxEffectiveness, fuel.effectiveness);
        activeCount++;

        const existing = activeFuels.get(burn.itemTypeId) ?? { count: 0, remaining: burn.remaining };
        existing.count++;
        existing.remaining = Math.max(existing.remaining, burn.remaining);
        activeFuels.set(burn.itemTypeId, existing);
    }

    persistBurnState(machine.entity, burns);
    return { totalPower, maxEffectiveness, activeCount, activeFuels };
}

function getBurnState(entity) {
    const cached = burnStates.get(entity.id);
    if (cached) return cached;

    const burns = new Map();
    const raw = entity.getDynamicProperty(BURN_STATE_PROPERTY);
    if (typeof raw === "string" && raw.length > 0) {
        try {
            const entries = JSON.parse(raw);
            if (Array.isArray(entries)) {
                for (const entry of entries) {
                    const slot = Math.floor(Number(entry?.[0]));
                    const itemTypeId = typeof entry?.[1] === "string" ? entry[1] : "";
                    const remaining = Math.max(0, Math.floor(Number(entry?.[2]) || 0));
                    if (!FUEL_SLOTS.includes(slot) || !itemTypeId || remaining <= 0) continue;
                    burns.set(slot, { itemTypeId, remaining });
                }
            }
        } catch {}
    }

    burnStates.set(entity.id, burns);
    return burns;
}

function persistBurnState(entity, burns) {
    const entries = [...burns.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([slot, burn]) => [slot, burn.itemTypeId, burn.remaining]);
    const serialized = JSON.stringify(entries);
    if (entity.getDynamicProperty(BURN_STATE_PROPERTY) !== serialized) {
        entity.setDynamicProperty(BURN_STATE_PROPERTY, serialized);
    }
}

function consumeOne(container, slot, stack) {
    if (stack.amount <= 1) {
        container.setItem(slot, undefined);
        return;
    }
    stack.amount--;
    container.setItem(slot, stack);
}

function buildTowerLabel(status, level, energyCost, transferred, fuelState, network) {
    const lines = [
        `\u00A7r${level > 0 ? "\u00A7a" : "\u00A7e"}${status}`,
        `\u00A7r\u00A77Level: \u00A7f${formatLevel(level)}`,
        `\u00A7r\u00A77Energy: \u00A7f${EnergyStorage.formatEnergyToText(energyCost)} / cycle`,
        `\u00A7r\u00A77Network Output: \u00A7f${EnergyStorage.formatEnergyToText(transferred)} / cycle`,
        `\u00A7r\u00A77Relays: \u00A7f${network?.relays.length ?? 0}`,
        `\u00A7r\u00A77Targets: \u00A7f${network?.targets.length ?? 0}`,
    ];

    if (fuelState.activeFuels.size > 0) {
        lines.push("\u00A7r\u00A78Active Fuels:");
        for (const [itemTypeId, state] of fuelState.activeFuels) {
            lines.push(`\u00A7r\u00A77${itemTypeId} x${state.count} (${state.remaining})`);
        }
    } else {
        lines.push("\u00A7r\u00A78Accepted Fuels:");
        for (const fuel of getOverclockFuels().values()) {
            lines.push(`\u00A7r\u00A77${fuel.itemTypeId}: ${formatLevel(fuel.power * fuel.effectiveness)}`);
        }
    }
    return lines;
}

function findEntity(block) {
    return block.dimension.getEntitiesAtBlockLocation(block.location)
        .find((entity) => entity.getProperty?.("utilitycraft:overclock") !== undefined);
}

// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export function setDynamicNumber(entity, key, value) {
    const normalized = Math.max(0, Number(value) || 0);
    if (entity.getDynamicProperty(key) === normalized) return false;
    entity.setDynamicProperty(key, normalized);
    return true;
}

export function setDynamicString(entity, key, value) {
    if (entity.getDynamicProperty(key) === value) return false;
    entity.setDynamicProperty(key, value);
    return true;
}

export function setRunning(machine, running) {
    if (DoriosLib.block.getState(machine.block, "utilitycraft:on") === running) return;
    DoriosLib.block.setState(machine.block, "utilitycraft:on", running);
}

export function setUiItem(container, slot, typeId, nameTag = " ") {
    const item = new ItemStack(typeId, 1);
    item.nameTag = nameTag;
    container.setItem(slot, item);
}

export function displayProgress(machine, cost, slot = 2, index = 0) {
    if (!machine.shouldUpdateUI) return;
    machine.displayProgress(cost, {
        slot,
        index,
    });
}

export function displayTemperature(machine, heat, maxHeat, slot = 2) {
    if (!machine.shouldUpdateUI) return;
    const frame = Math.max(0, Math.min(31, Math.floor((heat / maxHeat) * 31)));
    setUiItem(machine.container, slot, `utilitycraft:temperature_${String(frame).padStart(2, "0")}`);
}

export function renderStatus(machine, running, title, lines = []) {
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;
    machine.energy.display(0);
    machine.setLabel([
        `§r${running ? "§a" : "§e"}${title}`,
        ...lines,
        `§r§7Batch x${Math.max(1, Math.floor(machine.boosts.process_batch ?? 1))}`,
    ]);
}

export function halveStack(container, slot) {
    const item = container.getItem(slot);
    if (!item) return;
    const next = Math.floor(item.amount / 2);
    if (next <= 0) container.setItem(slot, undefined);
    else {
        item.amount = next;
        container.setItem(slot, item);
    }
}

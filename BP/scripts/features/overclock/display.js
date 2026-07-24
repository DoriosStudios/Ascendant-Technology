// @ts-check

import { ItemStack } from "@minecraft/server";

export function displayOverclock(machine, level, slot) {
    if (!machine?.shouldUpdateUI || !machine.container) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= machine.container.size) return;

    const normalizedLevel = Math.max(0, Number(level) || 0);
    const clock = 1 + 0.35 * normalizedLevel;
    const frameClock = Math.min(clock, 3);
    const frame = Math.max(0, Math.min(48, Math.floor(((frameClock - 1) / 2) * 48)));
    const frameName = frame.toString().padStart(2, "0");
    const item = new ItemStack(`utilitycraft:overclock_${frameName}`, 1);
    item.nameTag = `\u00A7r\u00A75Overclock`;
    item.setLore([
        `\u00A7r\u00A77Level: \u00A7f${formatLevel(normalizedLevel)}`,
        `\u00A7r\u00A77Clock: \u00A7f${clock.toFixed(2)}x`,
    ]);

    const current = machine.container.getItem(slot);
    const lore = item.getLore();
    const currentLore = current?.getLore?.() ?? [];
    if (
        current?.typeId === item.typeId
        && current.nameTag === item.nameTag
        && currentLore.length === lore.length
        && currentLore.every((line, index) => line === lore[index])
    ) return;
    machine.container.setItem(slot, item);
}

export function formatLevel(level) {
    const value = Math.max(0, Number(level) || 0);
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

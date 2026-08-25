// @ts-check

import { ItemStack } from "@minecraft/server";
import { EnergyStorage } from "DoriosCore/index.js";
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

export function setUiItem(container, slot, typeId, nameTag = " ", lore = []) {
    const item = new ItemStack(typeId, 1);
    item.nameTag = nameTag;
    item.setLore(Array.isArray(lore) ? lore : []);
    container.setItem(slot, item);
}

export function displayProgress(machine, cost, slot = 2, index = 0) {
    if (!machine.shouldUpdateUI) return;
    machine.displayProgress(cost, {
        slot,
        index,
    });
}

export function displayTemperature(machine, heat, maxHeat, slot = 2, nameTag = " ", lore = []) {
    if (!machine.shouldUpdateUI) return;
    const frame = Math.max(0, Math.min(31, Math.floor((heat / maxHeat) * 31)));
    setUiItem(machine.container, slot, `utilitycraft:temperature_${String(frame).padStart(2, "0")}`, nameTag, lore);
}

/**
 * Renders the shared superior-machine information panel. Its section layout
 * mirrors the Thermo Reactor: status and machine stats first, energy in its
 * own block, then state that is specific to the current machine.
 *
 * @param {import("DoriosCore/index.js").Machine} machine
 * @param {boolean} running
 * @param {string} title
 * @param {Array<string | { title: string, lines: string[] }>} [sections]
 * @param {{ energyCost?: number, rateMultiplier?: number, batch?: number, sectionTitle?: string }} [options]
 */
export function renderMachineInfo(machine, running, title, sections = [], options = {}) {
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);

    const consumption = Math.max(Number.EPSILON, Number(machine.boosts?.consumption) || 1);
    const speed = Math.max(0, Number(machine.boosts?.speed) || 1);
    const efficiency = 1 / consumption;
    const batch = Math.max(1, Math.floor(options.batch ?? machine.boosts?.process_batch ?? 1));
    const stored = machine.energy.get();
    const capacity = machine.energy.getCap();
    const percent = Number(machine.energy.getPercent()) || 0;
    const progressCost = resolveEnergyCost(machine, options.energyCost);
    const cycleCost = progressCost * consumption;
    const rateMultiplier = Math.max(0, Number(options.rateMultiplier) || 1);
    const drawRate = Math.max(0, (Number(machine.baseRate) || 0) * rateMultiplier);

    const normalizedSections = normalizeSections(sections, options.sectionTitle);
    machine.setLabel([
        `§r§7Status: ${running ? "§a" : "§e"}${title}\n\n§r§eMachine Information`,
        `\n§r§aSpeed §fx${speed.toFixed(2)}\n§r§aEfficiency §fx${efficiency.toFixed(2)}\n§r§aRecipe Batch §fx${batch}\n§r§aCycle Cost §f${EnergyStorage.formatEnergyToText(cycleCost)}`,
        `\n§r§eEnergy Information\n\n§r§bCapacity §f${percent.toFixed(2)}%%\n§r§bStored §f${EnergyStorage.formatEnergyToText(stored)} / ${EnergyStorage.formatEnergyToText(capacity)}\n§r§bRate §f${EnergyStorage.formatEnergyToText(drawRate)}/t`,
        ...normalizedSections.map(({ title: sectionTitle, lines }) => (
            `\n§r§e${sectionTitle}\n\n${lines.join("\n")}`
        )),
    ]);
}

/**
 * Backwards-compatible status helper used by the existing machine loops.
 * Plain strings are grouped under one machine-specific state section.
 */
export function renderStatus(machine, running, title, lines = [], options = {}) {
    renderMachineInfo(machine, running, title, lines, options);
}

/**
 * Applies both legacy inventory resizing and a one-time same-size slot
 * permutation. New placements should write `version` during initialization.
 *
 * @param {import("DoriosCore/index.js").Machine} machine
 * @param {number} targetSize
 * @param {number[]} legacySlots Target-to-source map for resized inventories.
 * @param {string} versionKey Dynamic-property key used as the migration marker.
 * @param {string} version Current layout version.
 * @param {number[]} previousSlots Target-to-source map for the previous same-size layout.
 */
export function ensureMachineInventoryLayout(
    machine,
    targetSize,
    legacySlots,
    versionKey,
    version,
    previousSlots,
) {
    const resizeMarker = `resizing:${version}`;
    if (machine.container.size !== targetSize) {
        setDynamicString(machine.entity, versionKey, resizeMarker);
        return machine.ensureInventoryLayout(targetSize, legacySlots);
    }

    const storedVersion = String(machine.entity.getDynamicProperty(versionKey) ?? "");
    if (storedVersion === version) return true;
    if (storedVersion === resizeMarker) {
        setDynamicString(machine.entity, versionKey, version);
        return true;
    }

    if (!isInventoryPermutation(previousSlots, targetSize)) return false;
    const migrated = previousSlots.map((sourceSlot) => machine.container.getItem(sourceSlot)?.clone());
    for (let slot = 0; slot < targetSize; slot++) machine.container.setItem(slot, undefined);
    for (let slot = 0; slot < migrated.length; slot++) {
        if (migrated[slot]) machine.container.setItem(slot, migrated[slot]);
    }
    setDynamicString(machine.entity, versionKey, version);
    // Rebuild Machine on the next tick so upgrade boosts use their new slots.
    return false;
}

function resolveEnergyCost(machine, explicitCost) {
    const cost = Number(
        explicitCost
        ?? machine.entity.getDynamicProperty("dorios:energy_cost_0")
        ?? machine.settings?.machine?.energy_cost
        ?? machine.getEnergyCost?.(),
    );
    return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

function normalizeSections(sections, fallbackTitle = "Machine State") {
    if (!Array.isArray(sections) || sections.length === 0) return [];
    if (sections.every((entry) => typeof entry === "string")) {
        return [{ title: fallbackTitle, lines: sections.filter(Boolean) }];
    }

    return sections
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
            title: String(entry.title || fallbackTitle),
            lines: Array.isArray(entry.lines) ? entry.lines.filter(Boolean).map(String) : [],
        }))
        .filter((entry) => entry.lines.length > 0);
}

function isInventoryPermutation(sourceSlots, size) {
    if (!Array.isArray(sourceSlots) || sourceSlots.length !== size) return false;
    const normalized = sourceSlots.map(Number);
    return normalized.every((slot) => Number.isInteger(slot) && slot >= 0 && slot < size)
        && new Set(normalized).size === size;
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

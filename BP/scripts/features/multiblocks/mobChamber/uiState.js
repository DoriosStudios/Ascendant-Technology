import { ItemStack, ItemLockMode } from "@minecraft/server";
import { SLOTS, INVENTORY_SIZE } from "./config.js";
import { hasOpenUI } from "DoriosCore/utils/entity.js";
import { EnergyStorage, FluidStorage } from "DoriosCore/index.js";

export const PLACEHOLDER_ID = "utilitycraft:ui_filler";
export const UI_STATE_PREFIX = "at:mob_chamber:v1";

// Slot 3 selects the essence layout. No ButtonManager button is replaced for routing.
export function uiStateMarker(stats) {
    return `${UI_STATE_PREFIX}|e${stats.essenceSlots}|p${String(stats.processingCapacity).padStart(2, "0")}`;
}

// Presentation only: the timer keeps its existing item type and inventory index.
// Fixed 0..22 frames let JSON UI draw tinted bars without parsing numeric strings.
export function meterFrame(amount, capacity) {
    if (!Number.isFinite(amount) || !Number.isFinite(capacity) || capacity <= 0) return 0;
    return Math.max(0, Math.min(22, Math.floor(22 * amount / capacity)));
}

export function chamberDisplayState(status = "") {
    if (status === "Processing") return "processing";
    if (status.startsWith("Completed ")) return "completed";
    return ({
        "Waiting for essences": "empty",
        "Not enough energy": "energy",
        "Clog: loot output full": "loot",
        "Clog: XP tank full": "xp",
        "Wrong fluid in XP tank": "fluid",
        "Restore pending essences/capacity": "restore",
        "Waiting for pending storage": "storage",
        "Waiting for resources": "resources",
        "Error: pending batch preserved": "error",
    })[status] ?? "resources";
}

export function meterStateMarker(stats, energy, xp, result) {
    return `at:mob_chamber:meters:v1|t${meterFrame(result.progress, stats.operationTicks)}|e${meterFrame(energy.get(), energy.getCap())}|x${meterFrame(xp.get(), xp.getCap())}|s${chamberDisplayState(result.status)}|`;
}

export function canWriteUiState(container) {
    if (container?.size !== INVENTORY_SIZE) return false;
    const item = container.getItem(SLOTS.placeholder);
    return !item || item.typeId === PLACEHOLDER_ID;
}

export function writeUiState(container, stats) {
    // Never silently replace a real item, even in the dedicated protocol slot.
    if (!canWriteUiState(container)) return false;
    const marker = uiStateMarker(stats);
    const previous = container.getItem(SLOTS.placeholder);
    if (previous?.typeId === PLACEHOLDER_ID && previous.nameTag === marker) return true;
    const placeholder = new ItemStack(PLACEHOLDER_ID);
    placeholder.nameTag = marker;
    placeholder.lockMode = ItemLockMode.slot;
    placeholder.keepOnDeath = true;
    container.setItem(SLOTS.placeholder, placeholder);
    return true;
}

function lockedItem(typeId, nameTag = " ", lore = []) {
    const item = new ItemStack(typeId);
    item.nameTag = nameTag;
    item.setLore(lore);
    item.lockMode = ItemLockMode.slot;
    item.keepOnDeath = true;
    return item;
}

export function canPrepareInventory(container, stats) {
    if (!canWriteUiState(container)) return false;
    for (const slot of [SLOTS.energy, SLOTS.information, SLOTS.timer, SLOTS.xp]) {
        const item = container.getItem(slot);
        if (item && !/utilitycraft:(energy_\d+|xp_\d+|progress_right_big_bar_\d+|arrow_indicator_90|ui_filler|empty_fluid_bar)$/.test(item.typeId)) return false;
    }
    return SLOTS.essences.slice(stats.essenceSlots).every(slot => {
        const item = container.getItem(slot);
        return !item || item.typeId === PLACEHOLDER_ID;
    });
}

export function prepareInventory(container, stats) {
    if (!canPrepareInventory(container, stats)) return false;
    for (let index = 0; index < SLOTS.essences.length; index++) {
        const slot = SLOTS.essences[index], item = container.getItem(slot);
        if (index >= stats.essenceSlots) container.setItem(slot, lockedItem(PLACEHOLDER_ID, "§8Locked: add an Essence Module"));
        else if (item?.typeId === PLACEHOLDER_ID) container.setItem(slot, undefined);
    }
    if (!container.getItem(0)) container.setItem(0, lockedItem("utilitycraft:energy_00"));
    if (!container.getItem(1)) container.setItem(1, lockedItem("utilitycraft:arrow_indicator_90", "Mob Chamber"));
    if (!container.getItem(2)) container.setItem(2, lockedItem("utilitycraft:progress_right_big_bar_00"));
    if (!container.getItem(SLOTS.xp)) container.setItem(SLOTS.xp, lockedItem("utilitycraft:xp_00"));
    return writeUiState(container, stats);
}

export function renderChamberUI(entity, container, stats, energy, xp, result) {
    if (!hasOpenUI(entity)) return;
    writeUiState(container, stats);
    energy.display(SLOTS.energy);
    xp.display(SLOTS.xp);
    const frame = meterFrame(result.progress, stats.operationTicks);
    container.setItem(SLOTS.timer, lockedItem(`utilitycraft:progress_right_big_bar_${String(frame).padStart(2, "0")}`, meterStateMarker(stats, energy, xp, result)));
    const statusColor = ["loot", "xp", "energy", "fluid", "error", "storage", "restore"].includes(chamberDisplayState(result.status)) ? "§c" : "§f";
    const display = [
        `§r§7Status: ${statusColor}${result.status}`,
        "", "§r§eMachine Information", "",
        `§r§aEssence Slots §f${stats.essenceSlots}`,
        `§r§aParallel §f${stats.processingCapacity}`,
        `§r§aInterval §f${stats.operationSeconds.toFixed(2)} s`,
        `§r§aEfficiency cost §f${(stats.efficiencyMultiplier * 100).toFixed(1)}%`,
        `§r§aOperation §f${result.cost == null ? "-" : EnergyStorage.formatEnergyToText(result.cost)}`,
        "", "§r§eEnergy Information", "",
        `§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())}`,
        `§r§bCapacity §f${EnergyStorage.formatEnergyToText(energy.getCap())}`,
        "", "§r§eXP Tank", "",
        `§r§bStored §f${FluidStorage.formatFluid(xp.get())}`,
        `§r§bCapacity §f${FluidStorage.formatFluid(xp.getCap())}`,
    ];
    // Same string-array contract as BasicMachine.setLabel (Catalyst Weaver):
    // only the short first line belongs in nameTag, whose limit is 255 chars.
    const [nameTag, ...lore] = display;
    container.setItem(SLOTS.information, lockedItem("utilitycraft:arrow_indicator_90", nameTag, lore));
}

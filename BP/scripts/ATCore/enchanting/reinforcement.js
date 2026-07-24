// @ts-check

import { system, world } from "@minecraft/server";

const POINTS_KEY = "utilitycraft:reinforcement";
const MAX_KEY = "utilitycraft:reinforcement_max";
const SYNC_KEY = "utilitycraft:reinforcement_sync_version";
const SYNC_VERSION = 1;
const LORE_PATTERN = /Reinforcement\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i;
const LORE_PREFIX = "\u00A7r\u00A79Reinforcement: ";
const REINFORCEMENT_RATIOS = [0, 0.25, 0.5, 1];
const ARMOR_SLOTS = ["Head", "Chest", "Legs", "Feet"];
const pendingRepairs = new Set();

let runtimeInstalled = false;

/** @param {import("@minecraft/server").ItemStack | undefined} stack */
export function getReinforcementPoints(stack) {
    if (!stack) return 0;
    try {
        const raw = stack.getDynamicProperty(POINTS_KEY);
        const value = Number(raw);
        if (raw !== undefined && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    } catch {}

    const lore = safeLore(stack);
    for (let index = 0; index < lore.length; index++) {
        const match = lore[index].match(LORE_PATTERN);
        if (match) return Math.max(0, Math.floor(Number(match[1]) || 0));
    }
    return 0;
}

/** @param {import("@minecraft/server").ItemStack} stack */
export function getReinforcementMaximum(stack) {
    try {
        const raw = stack.getDynamicProperty(MAX_KEY);
        const value = Number(raw);
        if (raw !== undefined && Number.isFinite(value) && value > 0) return Math.floor(value);
    } catch {}

    const lore = safeLore(stack);
    for (let index = 0; index < lore.length; index++) {
        const match = lore[index].match(LORE_PATTERN);
        const value = Number(match?.[2]);
        if (Number.isFinite(value) && value > 0) return Math.floor(value);
    }
    return getReinforcementPoints(stack);
}

/**
 * @param {import("@minecraft/server").ItemStack} stack
 * @param {number} points
 * @param {number} [maximum]
 */
export function setReinforcementPoints(stack, points, maximum) {
    const existingMaximum = getReinforcementMaximum(stack);
    const cap = Math.max(0, Math.floor(Number(maximum) || existingMaximum || points || 0));
    const current = Math.max(0, Math.min(cap, Math.floor(Number(points) || 0)));

    try {
        stack.setDynamicProperty(POINTS_KEY, current);
        stack.setDynamicProperty(MAX_KEY, cap);
        stack.setDynamicProperty(SYNC_KEY, SYNC_VERSION);
    } catch {}

    const lore = safeLore(stack).filter((line) => !LORE_PATTERN.test(line));
    if (cap > 0) lore.push(`${LORE_PREFIX}${current} / ${cap}`);
    try {
        stack.setLore(lore);
    } catch {}
}

/**
 * @param {import("@minecraft/server").ItemDurabilityComponent} durability
 * @param {number} moduleLevel
 */
export function getReinforcementTarget(durability, moduleLevel) {
    const tier = Math.max(0, Math.min(3, Math.floor(Number(moduleLevel) || 0)));
    return Math.max(0, Math.floor(durability.maxDurability * REINFORCEMENT_RATIOS[tier]));
}

/**
 * Repairs all currently missing durability within the remaining reinforcement
 * budget and consumes points one-for-one.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 */
export function consumeReinforcement(stack) {
    const durability = getDurability(stack);
    const points = getReinforcementPoints(stack);
    const damage = Math.max(0, Math.floor(Number(durability?.damage) || 0));
    if (!durability || points <= 0 || damage <= 0) return 0;

    const spent = Math.min(points, damage);
    durability.damage = Math.max(0, damage - spent);
    setReinforcementPoints(stack, points - spent, getReinforcementMaximum(stack));
    return spent;
}

/**
 * Installs one event-only runtime. Events perform a cheap property check before
 * scheduling, and repeated triggers for the same entity/slot are coalesced.
 */
export function installReinforcementRuntime() {
    if (runtimeInstalled) return;
    runtimeInstalled = true;

    world.afterEvents.entityHurt.subscribe((event) => {
        const entity = event.hurtEntity;
        for (let index = 0; index < ARMOR_SLOTS.length; index++) {
            queueRepairIfReinforced(entity, ARMOR_SLOTS[index]);
        }
    });

    world.afterEvents.entityHitEntity.subscribe((event) => {
        queueRepairIfReinforced(event.damagingEntity, "Mainhand");
    });

    world.afterEvents.playerBreakBlock.subscribe((event) => {
        queueRepairIfReinforced(event.player, "Mainhand");
    });

    world.afterEvents.itemUse.subscribe((event) => {
        queueRepairIfReinforced(event.source, "Mainhand");
    });
}

/** @param {import("@minecraft/server").Entity} entity @param {string} slot */
function queueRepairIfReinforced(entity, slot) {
    const equippable = getEquippable(entity);
    const item = safeGetEquipment(equippable, slot);
    if (!item || getReinforcementPoints(item) <= 0) return;

    const key = `${entity.id}|${slot}`;
    if (pendingRepairs.has(key)) return;
    pendingRepairs.add(key);

    system.runTimeout(() => {
        pendingRepairs.delete(key);
        if (!entity.isValid) return;

        const currentEquippable = getEquippable(entity);
        const current = safeGetEquipment(currentEquippable, slot);
        if (!current || consumeReinforcement(current) <= 0) return;
        try {
            currentEquippable?.setEquipment(/** @type {import("@minecraft/server").EquipmentSlot} */ (slot), current);
        } catch {}
    }, 3);
}

/** @param {import("@minecraft/server").Entity} entity */
function getEquippable(entity) {
    try {
        return /** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */ (
            entity.getComponent("minecraft:equippable") ?? entity.getComponent("equippable")
        );
    } catch {
        return undefined;
    }
}

/** @param {import("@minecraft/server").EntityEquippableComponent | undefined} equippable @param {string} slot */
function safeGetEquipment(equippable, slot) {
    try {
        return equippable?.getEquipment(/** @type {import("@minecraft/server").EquipmentSlot} */ (slot));
    } catch {
        return undefined;
    }
}

/** @param {import("@minecraft/server").ItemStack} stack */
function getDurability(stack) {
    try {
        return /** @type {import("@minecraft/server").ItemDurabilityComponent | undefined} */ (
            stack.getComponent("minecraft:durability") ?? stack.getComponent("durability")
        );
    } catch {
        return undefined;
    }
}

/** @param {import("@minecraft/server").ItemStack} stack */
function safeLore(stack) {
    try {
        return stack.getLore().slice();
    } catch {
        return [];
    }
}

// @ts-check

import { system, world } from "@minecraft/server";

const POINTS_KEY = "utilitycraft:reinforcement";
const MAX_KEY = "utilitycraft:reinforcement_max";
const SYNC_KEY = "utilitycraft:reinforcement_sync_version";
const STATSCORE_LORE_SIGNATURE_KEY = "utilitycraft:statscore_lore_signature";
const SYNC_VERSION = 1;
const LORE_PATTERN = /Reinforcement\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i;
const LORE_PREFIX = "\u00A7r\u00A79Reinforcement: ";
const REINFORCEMENT_RATIOS = [0, 0.25, 0.5, 1];
const REINFORCEMENT_MODULE_LEVELS = new Map([
    ["utilitycraft:reinforcement_module", 1],
    ["utilitycraft:reinforcement_module_2", 2],
    ["utilitycraft:reinforcement_module_3", 3],
]);
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

    const statsLore = readLoreSignature(stack, STATSCORE_LORE_SIGNATURE_KEY);
    const lore = stripLoreSequence(safeLore(stack), statsLore)
        .filter((line) => !LORE_PATTERN.test(line));
    if (cap > 0) lore.push(`${LORE_PREFIX}${current} / ${cap}`);
    if (statsLore.length > 0) lore.push(...statsLore);
    try {
        stack.setLore(lore);
    } catch {}
}

/**
 * Removes every exact occurrence of a generated lore sequence. This repairs
 * items that were already duplicated while preserving unrelated custom lore.
 *
 * @param {string[]} lore
 * @param {string[]} sequence
 */
function stripLoreSequence(lore, sequence) {
    if (!Array.isArray(sequence) || sequence.length === 0) return [...lore];

    const result = [];
    for (let index = 0; index < lore.length;) {
        let matches = index + sequence.length <= lore.length;
        for (let offset = 0; matches && offset < sequence.length; offset++) {
            matches = lore[index + offset] === sequence[offset];
        }
        if (matches) {
            index += sequence.length;
            continue;
        }
        result.push(lore[index]);
        index++;
    }
    return result;
}

/** @param {import("@minecraft/server").ItemStack} stack @param {string} key */
function readLoreSignature(stack, key) {
    try {
        const raw = stack.getDynamicProperty(key);
        if (typeof raw !== "string" || raw.length === 0) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(line => typeof line === "string") : [];
    } catch {
        return [];
    }
}

/**
 * @param {import("@minecraft/server").ItemDurabilityComponent} durability
 * @param {number} moduleLevel
 */
export function getReinforcementTarget(durability, moduleLevel) {
    const tier = Math.max(0, Math.min(3, Math.floor(Number(moduleLevel) || 0)));
    return Math.max(0, Math.floor(durability.maxDurability * REINFORCEMENT_RATIOS[tier]));
}

/** @param {import("@minecraft/server").ItemStack | undefined} module */
export function getReinforcementModuleLevel(module) {
    return REINFORCEMENT_MODULE_LEVELS.get(module?.typeId) ?? 0;
}

/**
 * Clones one damageable item and restores a fraction of its maximum
 * durability. The source stack is never mutated.
 *
 * @param {import("@minecraft/server").ItemStack} source
 * @param {number} [fraction=0.25]
 */
export function applyDurabilityRepair(source, fraction = 0.25) {
    const stack = source?.clone();
    const durability = stack ? getDurability(stack) : undefined;
    if (!stack || !durability) return undefined;

    const before = Math.max(0, Math.floor(Number(durability.damage) || 0));
    if (before <= 0) return undefined;

    const maximum = Math.max(1, Math.floor(Number(durability.maxDurability) || 1));
    const restored = Math.max(1, Math.floor(maximum * Math.max(0, Number(fraction) || 0)));
    durability.damage = Math.max(0, before - restored);
    return { stack, before, after: durability.damage, restored: before - durability.damage };
}

/**
 * Clones one damageable item and fills its reinforcement reserve to the
 * selected module target. The module is a reusable catalyst.
 *
 * @param {import("@minecraft/server").ItemStack} source
 * @param {number} moduleLevel
 */
export function applyReinforcement(source, moduleLevel) {
    const stack = source?.clone();
    const durability = stack ? getDurability(stack) : undefined;
    if (!stack || !durability) return undefined;

    const target = getReinforcementTarget(durability, moduleLevel);
    const before = getReinforcementPoints(stack);
    if (target <= 0 || before >= target) return undefined;

    setReinforcementPoints(stack, target, target);
    return { stack, before, after: target, target };
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

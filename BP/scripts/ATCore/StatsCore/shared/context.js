import { STATSCORE } from "../constants.js";
import { system } from "@minecraft/server";
import { getEquipment, getLiveEquipmentItem } from "../core/equipment.js";
import { getStatsCoreDefinition } from "../core/registry.js";
import { readStatsState } from "../core/state.js";
import { isStatsCoreEnabled } from "../runtime.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";
import { readEquipmentContextCache, writeEquipmentContextCache } from "./contextCache.js";

/**
 * Builds the full StatsCore runtime context for an already resolved item stack.
 *
 * This is the shared entry point for modules that need `definition + state + attributes`
 * without reimplementing the same resolution pipeline in each runtime handler.
 *
 * @param {import("@minecraft/server").ItemStack} stack
 * @returns {{ stack: import("@minecraft/server").ItemStack, definition: object, state: object, attributes: object } | null}
 */
export function readStatsItemContext(stack) {
    const definition = getStatsCoreDefinition(stack);
    if (!definition) return null;

    const state = readStatsState(stack, definition);
    const attributes = resolveStatsAttributes(definition, state);

    return { stack, definition, state, attributes };
}

/**
 * Reads the live StatsCore context from an equipment slot.
 *
 * Use this helper whenever a module needs to read a player's equipped StatsCore item and
 * also wants an optional `expectedTypeId` guard to avoid acting on a stale or swapped stack.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} [slotName=STATSCORE.slots.mainhand]
 * @param {string} [expectedTypeId]
 * @returns {{ stack: import("@minecraft/server").ItemStack, definition: object, state: object, attributes: object, slotName: string, equippable: object } | null}
 */
export function getEquipmentStatsContext(entity, slotName = STATSCORE.slots.mainhand, expectedTypeId = undefined) {
    if (!isStatsCoreEnabled()) return null;

    const currentTick = Number(system.currentTick ?? 0) || 0;
    const cached = readEquipmentContextCache(entity, slotName, currentTick);
    if (cached) {
        if (expectedTypeId && cached.typeId !== expectedTypeId) return null;
        return cached.context;
    }

    const access = expectedTypeId
        ? getLiveEquipmentItem(entity, expectedTypeId, slotName)
        : getEquipment(entity, slotName);

    if (!access?.item) {
        // A failed expected-type guard does not mean that the slot is empty.
        // Avoid caching that transient result for callers without the guard.
        if (!expectedTypeId) {
            writeEquipmentContextCache(entity, slotName, currentTick, "", null);
        }
        return null;
    }

    const itemContext = readStatsItemContext(access.item);
    if (!itemContext) {
        writeEquipmentContextCache(entity, slotName, currentTick, access.item.typeId, null);
        return null;
    }

    const context = {
        ...itemContext,
        slotName: access.slotName,
        equippable: access.equippable,
    };
    writeEquipmentContextCache(entity, slotName, currentTick, access.item.typeId, context);
    return context;
}

/**
 * Shortcut for the mainhand StatsCore context used by combat, mining, utility, and script tools.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {string} [expectedTypeId]
 * @returns {{ stack: import("@minecraft/server").ItemStack, definition: object, state: object, attributes: object, slotName: string, equippable: object } | null}
 */
export function getHeldStatsContext(player, expectedTypeId = undefined) {
    return getEquipmentStatsContext(player, STATSCORE.slots.mainhand, expectedTypeId);
}


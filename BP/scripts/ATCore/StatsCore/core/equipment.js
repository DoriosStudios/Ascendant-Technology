import { STATSCORE } from "../constants.js";
import { invalidateEquipmentContextCache } from "../shared/contextCache.js";

export function getEquippable(entity) {
    try {
        return entity?.getComponent?.("equippable");
    } catch {
        return undefined;
    }
}

/**
 * Reads an equipped item from a Bedrock equippable slot.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} [slotName=STATSCORE.slots.mainhand]
 * @returns {{ item: import("@minecraft/server").ItemStack | undefined, equippable: object | undefined, slotName: string }}
 */
export function getEquipment(entity, slotName = STATSCORE.slots.mainhand) {
    const equippable = getEquippable(entity);
    if (!equippable) return { item: undefined, equippable: undefined, slotName };

    try {
        return {
            item: equippable.getEquipment(slotName),
            equippable,
            slotName
        };
    } catch {
        return { item: undefined, equippable, slotName };
    }
}

export function setEquipment(entity, slotName, item) {
    const equippable = getEquippable(entity);
    if (!equippable) return false;

    try {
        equippable.setEquipment(slotName, item);
        invalidateEquipmentContextCache(entity, slotName);
        return true;
    } catch {
        return false;
    }
}

export function getSelectedSlot(player) {
    const selectedSlotIndex = Number(player?.selectedSlotIndex);
    if (Number.isInteger(selectedSlotIndex) && selectedSlotIndex >= 0) return selectedSlotIndex;

    const selectedSlot = Number(player?.selectedSlot);
    if (Number.isInteger(selectedSlot) && selectedSlot >= 0) return selectedSlot;

    return 0;
}

export function setSelectedInventoryItem(player, item) {
    try {
        const inventory = player?.getComponent?.("inventory")?.container;
        if (!inventory) return false;
        inventory.setItem(getSelectedSlot(player), item);
        invalidateEquipmentContextCache(player, STATSCORE.slots.mainhand);
        return true;
    } catch {
        return false;
    }
}

/**
 * Persists a mutated equipment item back to the entity.
 *
 * For the mainhand slot this helper also falls back to the selected inventory slot so
 * Bedrock keeps the runtime stack synchronized with what the player is actually holding.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} slotName
 * @param {import("@minecraft/server").ItemStack} item
 * @returns {boolean}
 */
export function persistEquipmentItem(entity, slotName, item) {
    return setEquipment(entity, slotName, item)
        || (slotName === STATSCORE.slots.mainhand && setSelectedInventoryItem(entity, item));
}

/**
 * Reads an equipped item while also validating the expected type id when needed.
 *
 * Use this when delayed handlers might run after the player swapped items.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} expectedTypeId
 * @param {string} [slotName=STATSCORE.slots.mainhand]
 * @returns {{ item: import("@minecraft/server").ItemStack | undefined, equippable: object | undefined, slotName: string }}
 */
export function getLiveEquipmentItem(entity, expectedTypeId, slotName = STATSCORE.slots.mainhand) {
    const access = getEquipment(entity, slotName);
    if (!access.item) return access;
    if (expectedTypeId && access.item.typeId !== expectedTypeId) {
        return { ...access, item: undefined };
    }
    return access;
}


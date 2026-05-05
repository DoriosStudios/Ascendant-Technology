import { STATSCORE } from "../constants.js";

export function getEquippable(entity) {
    try {
        return entity?.getComponent?.("equippable");
    } catch {
        return undefined;
    }
}

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
        return true;
    } catch {
        return false;
    }
}

export function persistEquipmentItem(entity, slotName, item) {
    return setEquipment(entity, slotName, item)
        || (slotName === STATSCORE.slots.mainhand && setSelectedInventoryItem(entity, item));
}

export function getLiveEquipmentItem(entity, expectedTypeId, slotName = STATSCORE.slots.mainhand) {
    const access = getEquipment(entity, slotName);
    if (!access.item) return access;
    if (expectedTypeId && access.item.typeId !== expectedTypeId) {
        return { ...access, item: undefined };
    }
    return access;
}

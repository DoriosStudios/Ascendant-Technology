const equipmentContextCache = new Map();

function getEntityCacheKey(entity, slotName) {
    const entityId = String(entity?.id ?? "");
    if (!entityId || !slotName) return "";
    return `${entityId}:${slotName}`;
}

function getMainhandSelection(entity, slotName) {
    if (slotName !== "Mainhand") return -1;
    const selectedSlotIndex = Number(entity?.selectedSlotIndex ?? entity?.selectedSlot);
    return Number.isInteger(selectedSlotIndex) ? selectedSlotIndex : -1;
}

function trimContextCache(currentTick) {
    if (equipmentContextCache.size <= 128) return;

    for (const [key, entry] of equipmentContextCache) {
        if (entry.tick !== currentTick) equipmentContextCache.delete(key);
    }
}

export function readEquipmentContextCache(entity, slotName, currentTick) {
    const key = getEntityCacheKey(entity, slotName);
    if (!key) return undefined;

    const entry = equipmentContextCache.get(key);
    if (!entry || entry.tick !== currentTick) return undefined;
    if (entry.mainhandSelection !== getMainhandSelection(entity, slotName)) {
        equipmentContextCache.delete(key);
        return undefined;
    }
    return entry;
}

export function writeEquipmentContextCache(entity, slotName, currentTick, typeId, context) {
    const key = getEntityCacheKey(entity, slotName);
    if (!key) return;

    equipmentContextCache.set(key, {
        tick: currentTick,
        typeId: String(typeId ?? ""),
        context: context ?? null,
        mainhandSelection: getMainhandSelection(entity, slotName),
    });
    trimContextCache(currentTick);
}

export function invalidateEquipmentContextCache(entity, slotName = undefined) {
    const entityId = String(entity?.id ?? "");
    if (!entityId) return;

    if (slotName) {
        equipmentContextCache.delete(`${entityId}:${slotName}`);
        return;
    }

    const prefix = `${entityId}:`;
    for (const key of equipmentContextCache.keys()) {
        if (key.startsWith(prefix)) equipmentContextCache.delete(key);
    }
}

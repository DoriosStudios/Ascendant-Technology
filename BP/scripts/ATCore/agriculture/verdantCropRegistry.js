// @ts-check

import { system } from "@minecraft/server";

export const VERDANT_CROP_REGISTRATION_EVENT = "utilitycraft:register_verdant_crop";

const cropsBySeed = new Map();
const cropsByBlock = new Map();

/** Registers one crop in both exact O(1) indexes. */
export function registerVerdantCrop(seedItemId, definition) {
    const normalized = normalizeCrop(seedItemId, definition);
    if (!normalized) return false;

    const previous = cropsBySeed.get(seedItemId);
    if (previous?.cropBlockId && previous.cropBlockId !== normalized.cropBlockId) {
        cropsByBlock.delete(previous.cropBlockId);
    }

    cropsBySeed.set(seedItemId, normalized);
    cropsByBlock.set(normalized.cropBlockId, normalized);
    return true;
}

/** Accepts keyed objects, one definition, or an array of definitions. */
export function registerVerdantCrops(payload) {
    if (!payload || typeof payload !== "object") return 0;
    let count = 0;

    if (Array.isArray(payload)) {
        for (const definition of payload) {
            if (registerVerdantCrop(definition?.seedItemId, definition)) count++;
        }
        return count;
    }

    if (typeof payload.seedItemId === "string") {
        return registerVerdantCrop(payload.seedItemId, payload) ? 1 : 0;
    }

    for (const [seedItemId, definition] of Object.entries(payload)) {
        if (registerVerdantCrop(seedItemId, definition)) count++;
    }
    return count;
}

export function getVerdantCropBySeed(seedItemId) {
    return cropsBySeed.get(seedItemId) ?? null;
}

export function getVerdantCropByBlock(blockTypeId) {
    return cropsByBlock.get(blockTypeId) ?? null;
}

export function getVerdantCropCount() {
    return cropsBySeed.size;
}

function normalizeCrop(seedItemId, definition) {
    if (typeof seedItemId !== "string" || seedItemId.length === 0 || !definition) return null;
    if (typeof definition.cropBlockId !== "string" || definition.cropBlockId.length === 0) return null;

    const validSoils = normalizeStrings(definition.validSoils);
    if (validSoils.length === 0) return null;

    const pickupItemIds = normalizeStrings(definition.pickupItemIds, [seedItemId]);
    return {
        seedItemId,
        cropBlockId: definition.cropBlockId,
        ageState: typeof definition.ageState === "string" && definition.ageState.length > 0
            ? definition.ageState
            : "growth",
        maxAge: Math.max(1, Math.floor(Number(definition.maxAge) || 1)),
        validSoils,
        validSoilIds: new Set(validSoils),
        bonusExclusions: new Set(normalizeStrings(definition.bonusExclusions, [seedItemId])),
        biomeTokens: normalizeStrings(definition.biomeTokens),
        biomeTitle: typeof definition.biomeTitle === "string" && definition.biomeTitle.length > 0
            ? definition.biomeTitle
            : null,
        pickupItemIds,
        pickupItemIdSet: new Set(pickupItemIds),
    };
}

function normalizeStrings(value, fallback = []) {
    const source = Array.isArray(value) && value.length > 0 ? value : fallback;
    const result = [];
    const seen = new Set();
    for (const entry of source) {
        if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) continue;
        seen.add(entry);
        result.push(entry);
    }
    return result;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== VERDANT_CROP_REGISTRATION_EVENT) return;
    try {
        registerVerdantCrops(JSON.parse(message));
    } catch (error) {
        console.warn(`[Ascendant Technology] Invalid Verdant crop registration: ${error}`);
    }
});

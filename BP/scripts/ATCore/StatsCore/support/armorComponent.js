import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { matchesDamageType, normalizeDamageType } from "../shared/damage.js";

export const ARMOR_COMPONENT_ID = "utilitycraft:armor";
export const REGISTER_ARMOR_MITIGATION_EVENT_ID = "utilitycraft:register_armor_mitigation";

const DEFAULT_DAMAGE_REDUCTION = 0.05;
const DEFAULT_DAMAGE_NEGATION = 0.025;
const MAX_COMPONENT_REDUCTION = 0.9;
const externalArmorProfiles = new Map();

// Registration makes custom component parameters readable through
// ItemStack.getComponent(). Runtime behavior is deliberately centralized in
// StatsCore's hurt pipeline so armor, refinement and penetration share one hit.
DoriosLib.registry.itemComponent(ARMOR_COMPONENT_ID, {});

function normalizeItemId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cloneProfile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return {
        ...value,
        ...(value.cases && typeof value.cases === "object" && !Array.isArray(value.cases)
            ? { cases: { ...value.cases } }
            : {}),
    };
}

function extractItemId(entry) {
    if (!entry || typeof entry !== "object") return "";
    return normalizeItemId(entry.id ?? entry.itemId ?? entry.typeId ?? entry.item ?? entry.target);
}

export function registerArmorMitigationDefinition(itemId, definition) {
    const id = normalizeItemId(itemId);
    const profile = cloneProfile(definition);
    if (!id || !profile) return false;
    externalArmorProfiles.set(id, profile);
    return true;
}

export function registerArmorMitigationDefinitions(payload) {
    if (!payload || typeof payload !== "object") return 0;

    if (Array.isArray(payload)) {
        let count = 0;
        for (const entry of payload) {
            const id = extractItemId(entry);
            if (!id) continue;
            const { id: ignoredId, itemId, typeId, item, target, ...profile } = entry;
            count += registerArmorMitigationDefinition(id, profile) ? 1 : 0;
        }
        return count;
    }

    const directId = extractItemId(payload);
    if (directId) {
        const { id, itemId, typeId, item, target, ...profile } = payload;
        return registerArmorMitigationDefinition(directId, profile) ? 1 : 0;
    }

    let count = 0;
    for (const [id, profile] of Object.entries(payload)) {
        count += registerArmorMitigationDefinition(id, profile) ? 1 : 0;
    }
    return count;
}

export function getArmorComponentDefinition(stack) {
    if (!stack) return null;

    const registered = externalArmorProfiles.get(normalizeItemId(stack.typeId));
    if (registered) return cloneProfile(registered);

    try {
        const component = stack.getComponent?.(ARMOR_COMPONENT_ID);
        return cloneProfile(component?.customComponentParameters?.params);
    } catch {
        return null;
    }
}

function toFraction(value, fallback) {
    if (value === undefined || value === null || value === false) return 0;
    if (value === true) return fallback;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.min(MAX_COMPONENT_REDUCTION, numeric > 1 ? numeric / 100 : numeric);
}

function getDamageCase(profile, damageType) {
    if (!profile?.cases || typeof profile.cases !== "object" || Array.isArray(profile.cases)) return null;
    const expected = normalizeDamageType(damageType);
    for (const [rawType, value] of Object.entries(profile.cases)) {
        if (normalizeDamageType(rawType) === expected && value && typeof value === "object") return value;
    }
    return null;
}

function profileMatchesDamageType(profile, damageType) {
    const reduces = profile?.reduces
        ?? (profile?.damage_reduction || profile?.damage_negation ? "all" : "none");
    if (Array.isArray(reduces)) {
        const allowed = reduces.filter(value => normalizeDamageType(value) !== "none");
        return allowed.length > 0 && matchesDamageType(allowed, damageType);
    }
    if (normalizeDamageType(reduces) === "none") return false;
    return matchesDamageType([String(reduces)], damageType);
}

export function resolveArmorComponentMitigation(stack, damageType = "all") {
    const base = getArmorComponentDefinition(stack);
    if (!base) return null;

    const profile = { ...base, ...(getDamageCase(base, damageType) ?? {}) };
    if (!profileMatchesDamageType(profile, damageType)) return null;

    const damageReduction = toFraction(profile.damage_reduction, DEFAULT_DAMAGE_REDUCTION);
    const damageNegation = toFraction(profile.damage_negation, DEFAULT_DAMAGE_NEGATION);
    if (damageReduction <= 0 && damageNegation <= 0) return null;

    return { damageReduction, damageNegation };
}

export function initializeArmorComponentRegistry() {
    if (globalThis.__statsCoreArmorComponentRegistryInitialized) return;
    globalThis.__statsCoreArmorComponentRegistryInitialized = true;

    system.afterEvents?.scriptEventReceive?.subscribe?.(event => {
        if (event?.id !== REGISTER_ARMOR_MITIGATION_EVENT_ID) return;
        try {
            const payload = JSON.parse(String(event.message ?? ""));
            registerArmorMitigationDefinitions(payload);
        } catch (error) {
            console.warn("[StatsCore] Invalid armor mitigation registration:", error);
        }
    });
}

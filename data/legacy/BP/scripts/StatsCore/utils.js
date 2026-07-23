import { system } from "@minecraft/server";

export function clamp(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
}

export function clamp01(value) {
    return clamp(value, 0, 1);
}

export function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function toPositiveInteger(value, fallback = 0) {
    const numeric = Math.floor(toFiniteNumber(value, fallback));
    return Math.max(0, numeric);
}

export function normalizeChance(value, fallback = 0) {
    if (value === undefined || value === null) return clamp01(fallback);
    const numeric = toFiniteNumber(value, fallback);
    return clamp01(numeric > 1 ? numeric / 100 : numeric);
}

export function rollChance(value, fallback = 0) {
    const chance = normalizeChance(value, fallback);
    if (chance <= 0) return false;
    if (chance >= 1) return true;
    return Math.random() <= chance;
}

export function normalizeId(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

export function safeJsonParse(value) {
    if (typeof value !== "string" || value.length <= 0) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

export function deepMerge(base, override) {
    if (Array.isArray(base)) {
        return Array.isArray(override) ? [...override] : [...base];
    }

    if (!isPlainObject(base)) {
        return override === undefined ? base : override;
    }

    const result = { ...base };
    if (!isPlainObject(override)) return result;

    for (const [key, overrideValue] of Object.entries(override)) {
        const baseValue = base[key];
        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            result[key] = deepMerge(baseValue, overrideValue);
            continue;
        }

        if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
            result[key] = [...overrideValue];
            continue;
        }

        result[key] = overrideValue;
    }

    return result;
}

export function clonePlain(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(clonePlain);

    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        result[key] = clonePlain(entry);
    }
    return result;
}

export function getCurrentTick() {
    const systemTick = system?.currentTick;
    if (Number.isFinite(Number(systemTick))) {
        return Math.max(0, Math.floor(Number(systemTick)));
    }

    return Math.floor(Date.now() / 50);
}

export function createRuntimeUid(prefix = "sc") {
    const random = Math.floor(Math.random() * 0xFFFFFF).toString(36);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function formatPercent(value) {
    return `${Math.round(clamp01(value) * 100)}%`;
}

export function titleCaseIdentifier(value) {
    const raw = String(value ?? "").includes(":")
        ? String(value).split(":").pop()
        : String(value ?? "");

    return raw
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

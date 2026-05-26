import { system } from "@minecraft/server";

const UI_REFRESH_CACHE = new Map();

function normalizeChannel(channel) {
    const normalized = String(channel ?? "ui")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]/g, "_");
    return normalized.length > 0 ? normalized : "ui";
}

export function getMachineUiRefreshSpeed() {
    const raw = Math.floor(Number(globalThis.tickSpeed ?? 2) || 2);
    return Math.max(1, raw);
}

export function resolveMachineUiRefreshInterval(interval) {
    const numeric = Math.floor(Number(interval) || 0);
    if (numeric <= 0) return getMachineUiRefreshSpeed();
    return Math.max(1, numeric);
}

export function shouldRefreshEntityUi(entity, channel = "ui", interval, force = false) {
    if (!entity?.id) return true;

    const currentTick = Math.max(0, Math.floor(Number(system.currentTick ?? globalThis.tickCount ?? 0)));
    const normalizedChannel = normalizeChannel(channel);
    const cacheKey = `${entity.id}:${normalizedChannel}`;

    if (force === true) {
        UI_REFRESH_CACHE.set(cacheKey, currentTick);
        return true;
    }

    const refreshInterval = resolveMachineUiRefreshInterval(interval);
    const lastTick = UI_REFRESH_CACHE.get(cacheKey);

    if (typeof lastTick !== "number" || currentTick - lastTick >= refreshInterval) {
        UI_REFRESH_CACHE.set(cacheKey, currentTick);
        return true;
    }

    return false;
}

import { world } from "@minecraft/server";
import { STATSCORE } from "./constants.js";

const STATSCORE_ENABLED_CACHE_KEY = "__statsCoreEnabled";

function cacheStatsCoreEnabled(value) {
    const normalized = value === true;
    globalThis[STATSCORE_ENABLED_CACHE_KEY] = normalized;
    return normalized;
}

function readStoredStatsCoreState() {
    try {
        const stored = world.getDynamicProperty(STATSCORE.worldProperties.enabled);
        return typeof stored === "boolean" ? stored : null;
    } catch {
        return null;
    }
}

export function isStatsCoreEnabled() {
    return globalThis[STATSCORE_ENABLED_CACHE_KEY] === true;
}

export function setStatsCoreEnabled(value, options = {}) {
    const nextState = cacheStatsCoreEnabled(value);

    if (options.persist === false) {
        return nextState;
    }

    try {
        world.setDynamicProperty(STATSCORE.worldProperties.enabled, nextState);
    } catch {
        // Ignore early-world write failures; the cached state is still valid for this runtime.
    }

    return nextState;
}

function refreshStatsCoreEnabledFromWorld() {
    const stored = readStoredStatsCoreState();
    if (typeof stored === "boolean") {
        cacheStatsCoreEnabled(stored);
        return stored;
    }

    cacheStatsCoreEnabled(false);
    return false;
}

export function initializeStatsCoreRuntime() {
    if (globalThis.__statsCoreRuntimeInitialized) return;
    globalThis.__statsCoreRuntimeInitialized = true;

    refreshStatsCoreEnabledFromWorld();

    world.afterEvents?.worldLoad?.subscribe?.(() => {
        const stored = readStoredStatsCoreState();
        if (typeof stored === "boolean") {
            cacheStatsCoreEnabled(stored);
            return;
        }

        setStatsCoreEnabled(false);
    });
}

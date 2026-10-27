import {
    EFFECTS_NAMESPACE,
    EFFECTS_DISCOVER_EVENT,
    EFFECTS_READY_EVENT,
    EFFECTS_SEND_EVENT,
    LEGACY_DISCOVER_EVENT,
    LEGACY_READY_EVENT,
    LEGACY_SEND_EVENT,
} from "../config/definitions.js";
import { EFFECT_STATE_VALUES } from "../config/values.js";
import { system, world } from "@minecraft/server";

let initialized = false;
let outboundEventId = EFFECTS_SEND_EVENT;
let modernBridgeReady = false;
let remoteBridgeReady = false;
let startupCheckStarted = false;
let startupCheckCompleted = false;
const warnedPlayers = new Set();
const MISSING_INSIGHT_WARNING = "at.integration.insight.missing";

function isEntity(target) {
    return Boolean(target?.id);
}

function getInsightEffectsApi() {
    return globalThis.DoriosAPI?.insight?.effects ?? globalThis.DoriosAPI?.insight?.customEffects;
}

/** Optional runtime dependency: require the effects bridge, not an unrelated Insight API. */
export function isInsightEffectsAvailable() {
    return remoteBridgeReady || typeof getInsightEffectsApi()?.replace === "function";
}

function discoverInsightEffects() {
    for (const eventId of [EFFECTS_DISCOVER_EVENT, LEGACY_DISCOVER_EVENT]) {
        try {
            system.sendScriptEvent(eventId, JSON.stringify({ namespace: EFFECTS_NAMESPACE, version: 2 }));
        } catch {
            // Dorios' Insight is optional; discovery must not interrupt startup.
        }
    }
}

function warnPlayerIfMissing(player) {
    if (!startupCheckCompleted || isInsightEffectsAvailable() || !player?.id || warnedPlayers.has(player.id)) return;
    try {
        player.sendMessage({ translate: MISSING_INSIGHT_WARNING });
        warnedPlayers.add(player.id);
    } catch {
        // A player may leave before the deferred startup notification.
    }
}

function checkOptionalInsightDependency() {
    if (startupCheckStarted) return;
    startupCheckStarted = true;
    discoverInsightEffects();
    for (let delay = EFFECT_STATE_VALUES.insightDiscoveryRetryTicks;
        delay < EFFECT_STATE_VALUES.insightStartupGraceTicks;
        delay += EFFECT_STATE_VALUES.insightDiscoveryRetryTicks) {
        system.runTimeout(() => {
            if (!isInsightEffectsAvailable()) discoverInsightEffects();
        }, delay);
    }
    system.runTimeout(() => {
        startupCheckCompleted = true;
        if (isInsightEffectsAvailable()) return;
        console.warn("[Ascendant Technology] Optional dependency Dorios' Insight was not detected. Custom StatsCore effects remain active, but their HUD icons, levels, timers and charges require Dorios' Insight.");
        for (const player of world.getAllPlayers()) warnPlayerIfMissing(player);
    }, EFFECT_STATE_VALUES.insightStartupGraceTicks);
}

/**
 * Replaces the complete StatsCore snapshot for an entity. Insight uses player
 * snapshots for the HUD and every entity snapshot for WAILA.
 */
export function publishStatsCoreEffects(target, effects) {
    if (!isEntity(target)) return false;

    const list = Array.isArray(effects) ? effects : [];
    const api = getInsightEffectsApi();
    if (typeof api?.replace === "function") {
        try {
            if (api.replace(target, list, EFFECTS_NAMESPACE) !== false) {
                return true;
            }
        } catch {
            // Fall through to the cross-behavior-pack script event.
        }
    }

    try {
        system.sendScriptEvent(
            outboundEventId,
            JSON.stringify({
                targetId: target.id,
                playerId: target.typeId === "minecraft:player" ? target.id : undefined,
                namespace: EFFECTS_NAMESPACE,
                action: "replace",
                effects: list,
            }),
        );
        return true;
    } catch {
        return false;
    }
}

export function initializeStatsCoreEffectsBridge() {
    if (initialized) return;
    initialized = true;

    system.afterEvents?.scriptEventReceive?.subscribe?.((event) => {
        if (event.id === EFFECTS_READY_EVENT) {
            remoteBridgeReady = true;
            modernBridgeReady = true;
            outboundEventId = EFFECTS_SEND_EVENT;
        } else if (event.id === LEGACY_READY_EVENT && !modernBridgeReady) {
            remoteBridgeReady = true;
            outboundEventId = LEGACY_SEND_EVENT;
        }
    });

    // Subscribe during early execution; perform the dependency check only after world load.
    world.afterEvents.worldLoad.subscribe(() => {
        system.run(checkOptionalInsightDependency);
    });
    world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
        if (!initialSpawn) return;
        system.runTimeout(() => warnPlayerIfMissing(player), EFFECT_STATE_VALUES.insightStartupGraceTicks);
    });
    system.run(discoverInsightEffects);
}

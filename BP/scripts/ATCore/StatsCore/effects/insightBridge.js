import { system } from "@minecraft/server";

const EFFECTS_NAMESPACE = "ascendant.statscore";
const EFFECTS_DISCOVER_EVENT = "insight:effects_discover_v1";
const EFFECTS_READY_EVENT = "insight:effects_ready_v1";
const EFFECTS_SEND_EVENT = "insight:effects_send_v1";
const LEGACY_DISCOVER_EVENT = "insight:custom_effects_discover_v1";
const LEGACY_READY_EVENT = "insight:custom_effects_ready_v1";
const LEGACY_SEND_EVENT = "insight:custom_effects_send_v1";

let initialized = false;
let outboundEventId = EFFECTS_SEND_EVENT;
let modernBridgeReady = false;

function isEntity(target) {
    return Boolean(target?.id);
}

function getInsightEffectsApi() {
    return globalThis.DoriosAPI?.insight?.effects
        ?? globalThis.DoriosAPI?.insight?.customEffects;
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
        system.sendScriptEvent(outboundEventId, JSON.stringify({
            targetId: target.id,
            playerId: target.typeId === "minecraft:player" ? target.id : undefined,
            namespace: EFFECTS_NAMESPACE,
            action: "replace",
            effects: list,
        }));
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
            modernBridgeReady = true;
            outboundEventId = EFFECTS_SEND_EVENT;
        } else if (event.id === LEGACY_READY_EVENT && !modernBridgeReady) {
            outboundEventId = LEGACY_SEND_EVENT;
        }
    });

    system.run(() => {
        for (const eventId of [EFFECTS_DISCOVER_EVENT, LEGACY_DISCOVER_EVENT]) {
            try {
                system.sendScriptEvent(eventId, JSON.stringify({
                    namespace: EFFECTS_NAMESPACE,
                    version: 2,
                }));
            } catch {
                // Dorios' Insight is optional.
            }
        }
    });
}

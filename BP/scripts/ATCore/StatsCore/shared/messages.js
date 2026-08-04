import { system } from "@minecraft/server";
import { actionBar } from "../../../DoriosLib/messages/index.js";

const INSIGHT_ACTIONBAR_NAMESPACE = "ascendant.statscore";
const INSIGHT_NAMESPACE_NAME = "Ascendant Technology · StatsCore";
const ACTIONBAR_LIFETIME_TICKS = 100;
const INSIGHT_QUEUE_DISCOVER_EVENT = "insight:actionbar_queue_discover_v1";
const INSIGHT_QUEUE_READY_EVENT = "insight:actionbar_queue_ready_v1";
const INSIGHT_QUEUE_SEND_EVENT = "insight:actionbar_queue_send_v1";
const INSIGHT_READY_GRACE_TICKS = 60;

let registeredInsightApi;
let remoteInsightReadyUntil = -Infinity;
let initialized = false;

function getInsightApi() {
    return globalThis.DoriosAPI?.insight;
}

function registerInsightNamespace(insightApi) {
    if (!insightApi || registeredInsightApi === insightApi) return;
    if (typeof insightApi.setNamespaceName !== "function") return;

    try {
        insightApi.setNamespaceName(
            INSIGHT_ACTIONBAR_NAMESPACE,
            INSIGHT_NAMESPACE_NAME,
        );
        registeredInsightApi = insightApi;
    } catch {
        // Namespace labels are optional and must never block HUD feedback.
    }
}

export function isInsightActionbarQueueAvailable() {
    const actionbarQueue = getInsightApi()?.actionbarQueue;
    return (
        actionbarQueue?.supportsSlots === true &&
        typeof actionbarQueue.send === "function"
    ) || system.currentTick <= remoteInsightReadyUntil;
}

export function initializeStatsCoreActionbarBridge() {
    if (initialized) return;
    initialized = true;

    system.afterEvents?.scriptEventReceive?.subscribe?.((event) => {
        if (event?.id !== INSIGHT_QUEUE_READY_EVENT) return;

        try {
            const details = JSON.parse(String(event.message ?? "{}"));
            if (details?.supportsSlots !== true) return;
            remoteInsightReadyUntil = system.currentTick + INSIGHT_READY_GRACE_TICKS;
        } catch {
            // Ignore malformed or older bridge announcements.
        }
    });

    system.run(() => {
        try {
            system.sendScriptEvent(INSIGHT_QUEUE_DISCOVER_EVENT, "statscore");
        } catch {
            // Dorios' Insight is optional.
        }
    });
}

function sendToInsightSecondary(target, message) {
    const insightApi = getInsightApi();
    if (
        insightApi?.actionbarQueue?.supportsSlots === true &&
        typeof insightApi.actionbarQueue.send === "function"
    ) {
        registerInsightNamespace(insightApi);

        try {
            return insightApi.actionbarQueue.send(
                target,
                INSIGHT_ACTIONBAR_NAMESPACE,
                message,
                {
                    slot: "secondary",
                    lifetimeTicks: ACTIONBAR_LIFETIME_TICKS,
                },
            ) !== false;
        } catch {
            // Try the cross-addon bridge below.
        }
    }

    if (system.currentTick > remoteInsightReadyUntil || !target?.id) return false;

    try {
        system.sendScriptEvent(INSIGHT_QUEUE_SEND_EVENT, JSON.stringify({
            playerId: target.id,
            namespace: INSIGHT_ACTIONBAR_NAMESPACE,
            namespaceName: INSIGHT_NAMESPACE_NAME,
            payload: message,
            options: {
                slot: "secondary",
                lifetimeTicks: ACTIONBAR_LIFETIME_TICKS,
            },
        }));
        return true;
    } catch {
        return false;
    }
}

/**
 * Routes StatsCore feedback through Insight's secondary actionbar slot when
 * available, falling back to Ascendant Technology's regular actionbar helper.
 *
 * @param {import("@minecraft/server").Entity | import("@minecraft/server").Player} target
 * @param {import("@minecraft/server").RawMessage|string} message
 * @returns {boolean}
 */
export function setActionBarSafe(target, message) {
    if (!message) return false;
    if (sendToInsightSecondary(target, message)) return true;

    try {
        actionBar(target, message);
        return true;
    } catch {
        return false;
    }
}


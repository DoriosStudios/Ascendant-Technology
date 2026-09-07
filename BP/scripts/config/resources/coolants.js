import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export const coolantAdditions = {
    cryofluid: {
        efficiency: 1.75,
        tier: 2,
    },
};

// Known coolant owned by Heavy Machinery. It is kept local so Ascendant
// machines remain compatible even if the remote registration is dispatched
// after their first processing tick.
export const compatibleCoolants = {
    saline_coolant: {
        efficiency: 1.25,
        tier: 1,
    },
};

// Keep this map event-driven, matching UtilityCraft and Heavy Machinery.
// UtilityCraft publishes Water, Heavy Machinery publishes Saline Coolant, and
// this pack publishes Cryofluid; every loaded pack receives the same registry.
export const coolants = {
    ...coolantAdditions,
    ...compatibleCoolants,
};

DoriosLib.registry.registerCoolant(coolantAdditions);

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== DoriosLib.registry.REGISTRATION_EVENT_IDS.COOLANT) return;
    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
        for (const [fluidType, data] of Object.entries(payload)) {
            if (!data || typeof data !== "object" || Array.isArray(data)) continue;
            const efficiency = Number(data.efficiency);
            if (!Number.isFinite(efficiency) || efficiency <= 0) continue;
            coolants[fluidType] = {
                efficiency,
                tier: Number.isFinite(data.tier) ? Number(data.tier) : 0,
            };
        }
    } catch (error) {
        console.warn("[Ascendant Technology] Failed to parse coolant registration:", error);
    }
});

import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export const coolantAdditions = {
    cryofluid: {
        efficiency: 1.75,
        tier: 2,
    },
};

// Keep this map event-driven, matching UtilityCraft and Heavy Machinery.
// UtilityCraft publishes Water, Heavy Machinery publishes Saline Coolant, and
// this pack publishes Cryofluid; every loaded pack receives the same registry.
export const coolants = {};

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

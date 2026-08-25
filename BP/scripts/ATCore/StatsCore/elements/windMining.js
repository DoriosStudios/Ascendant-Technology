import { system, world } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { applyEffectById } from "../shared/effects.js";

const HASTE_STEP_TICKS = 24;
const MAX_HASTE_LEVEL = 5;
const sessions = new Map();
let initialized = false;

function playerKey(player) {
    return String(player?.id ?? "");
}

function hasWindElement(player) {
    const context = getEquipmentStatsContext(player, STATSCORE.slots.mainhand);
    return (context?.attributes?.elemental ?? []).some((element) =>
        String(element?.id ?? "").trim().toLowerCase() === "wind"
    );
}

function beginBreaking(event) {
    const player = event?.player;
    if (!player || !hasWindElement(player)) return;
    sessions.set(playerKey(player), {
        player,
        startedAt: system.currentTick,
    });
}

function stopBreaking(event) {
    sessions.delete(playerKey(event?.player));
}

function refreshWindHaste() {
    const now = system.currentTick;
    for (const [key, session] of sessions) {
        const player = session?.player;
        if (!player || !hasWindElement(player)) {
            sessions.delete(key);
            continue;
        }

        const level = Math.min(
            MAX_HASTE_LEVEL,
            Math.floor((now - Number(session.startedAt ?? now)) / HASTE_STEP_TICKS),
        );
        if (level <= 0) continue;
        applyEffectById(player, "haste", 10, level - 1, false);
    }
}

export function initializeWindMiningElement() {
    if (initialized) return;
    initialized = true;

    const startSignal = world.afterEvents?.playerStartBreakingBlock;
    const cancelSignal = world.afterEvents?.playerCancelBreakingBlock;
    if (!startSignal?.subscribe || !cancelSignal?.subscribe) {
        console.warn("[StatsCore] continuous block-breaking events unavailable; Wind haste disabled.");
        return;
    }

    startSignal.subscribe(beginBreaking);
    cancelSignal.subscribe(stopBreaking);
    world.afterEvents?.playerBreakBlock?.subscribe?.(stopBreaking);
    world.afterEvents?.playerLeave?.subscribe?.((event) => sessions.delete(event.playerId));
    system.runInterval(refreshWindHaste, 4);
}

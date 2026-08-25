import { ButtonState, InputButton, world } from "@minecraft/server";
import { showAbilityFeedback } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { getCurrentTick } from "../utils.js";

const jumpPresses = new Map();
const cooldowns = new Map();

function playerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function getDashEffect(player) {
    const context = getEquipmentStatsContext(player, "Feet");
    return findEffectByKind(context?.attributes?.support?.effects, "dash");
}

function dashOnCooldown(player) {
    return Number(cooldowns.get(playerKey(player)) ?? 0) > getCurrentTick();
}

function performDash(player, effect) {
    if (!player || dashOnCooldown(player)) return false;
    try {
        const direction = player.getViewDirection?.();
        if (!direction) return false;
        const horizontalLength = Math.max(0.001, Math.hypot(Number(direction.x ?? 0), Number(direction.z ?? 0)));
        const strength = Math.max(0.4, Number(effect?.strength ?? 1.5) || 1.5);
        player.applyImpulse?.({
            x: (Number(direction.x ?? 0) / horizontalLength) * strength,
            y: Math.max(0.06, Number(effect?.verticalBoost ?? 0.12) || 0.12),
            z: (Number(direction.z ?? 0) / horizontalLength) * strength,
        });
        cooldowns.set(playerKey(player), getCurrentTick() + Math.max(10, Number(effect?.cooldownTicks ?? 40) || 40));
        showAbilityFeedback(player, "Boot Dash", STATSCORE_ICONS.walkingSpeed);
        return true;
    } catch {
        return false;
    }
}

function handleJumpInput(event) {
    const player = event?.player;
    if (!player || event?.button !== InputButton.Jump || event?.newButtonState !== ButtonState.Pressed) return;
    const effect = getDashEffect(player);
    if (!effect || dashOnCooldown(player)) return;

    const now = getCurrentTick();
    const key = playerKey(player);
    const previous = Number(jumpPresses.get(key) ?? -1000);
    jumpPresses.set(key, now);
    if (now - previous > 6) return;

    jumpPresses.delete(key);
    performDash(player, effect);
}

export function initializeBootDashModule() {
    if (globalThis.__statsCoreBootDashInitialized) return;
    globalThis.__statsCoreBootDashInitialized = true;
    world.afterEvents?.playerButtonInput?.subscribe?.(handleJumpInput);
}

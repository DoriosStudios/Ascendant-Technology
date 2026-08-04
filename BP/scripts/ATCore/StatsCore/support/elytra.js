import { ButtonState, InputButton, world } from "@minecraft/server";
import { showAbilityFeedback } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { getCurrentTick } from "../utils.js";

const launchCooldowns = new Map();
const primedLaunches = new Map();
const DOUBLE_JUMP_WINDOW_TICKS = 12;

function playerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function getWindLaunchEffect(player) {
    const context = getEquipmentStatsContext(player, "Chest", "minecraft:elytra");
    if (!context || context.attributes?.refinement?.active !== true) return null;
    return findEffectByKind(context.attributes?.support?.effects, "elytra_wind_launch");
}

function isLaunchOnCooldown(player) {
    return Number(launchCooldowns.get(playerKey(player)) ?? 0) > getCurrentTick();
}

function spawnWindChargeBelow(player) {
    if (!player?.dimension || !player?.location) return false;

    const location = {
        x: Number(player.location.x ?? 0),
        // This is inside the lower edge of the player's hitbox, so the Wind
        // Charge detonates immediately underneath them rather than falling
        // away before it can produce its launch burst.
        y: Number(player.location.y ?? 0) - 0.15,
        z: Number(player.location.z ?? 0),
    };
    try {
        const charge = player.dimension.spawnEntity?.("minecraft:wind_charge", location);
        if (!charge) return false;

        // This is the native Wind Charge projectile, not a simulated blast.
        // Launch it through the player from below so Bedrock performs its own
        // Wind Charge impact and explosion.
        charge.getComponent?.("minecraft:projectile")?.shoot?.({ x: 0, y: 0.75, z: 0 });
        return true;
    } catch {
        return false;
    }
}

function performWindLaunch(player, effect) {
    if (!player || player.isOnGround === true || isLaunchOnCooldown(player)) return false;

    try {
        const direction = player.getViewDirection?.();
        if (!direction) return false;

        const horizontalLength = Math.max(0.001, Math.hypot(Number(direction.x ?? 0), Number(direction.z ?? 0)));
        const horizontalBoost = Math.max(0.25, Number(effect?.horizontalBoost ?? 0.9) || 0.9);
        const verticalBoost = Math.max(0.3, Number(effect?.verticalBoost ?? 0.82) || 0.82);
        spawnWindChargeBelow(player);
        try {
            player.dimension?.playSound?.("ascendant.statscore.wind_launch", player.location, { volume: 0.75, pitch: 1.08 });
        } catch { }
        player.applyImpulse?.({
            x: (Number(direction.x ?? 0) / horizontalLength) * horizontalBoost,
            y: verticalBoost,
            z: (Number(direction.z ?? 0) / horizontalLength) * horizontalBoost,
        });
        launchCooldowns.set(playerKey(player), getCurrentTick() + Math.max(10, Number(effect?.cooldownTicks ?? 45) || 45));
        showAbilityFeedback(player, "Wind Launch", STATSCORE_ICONS.walkingSpeed);
        return true;
    } catch {
        return false;
    }
}

function handleJumpInput(event) {
    const player = event?.player;
    if (!player || event?.button !== InputButton.Jump || event?.newButtonState !== ButtonState.Pressed) return;

    const effect = getWindLaunchEffect(player);
    if (!effect) return;

    const now = getCurrentTick();
    const key = playerKey(player);
    if (player.isOnGround === true) {
        // The first press is an ordinary jump. Only a second press while the
        // player is airborne can consume this primed Wind Launch.
        primedLaunches.set(key, { expiresAt: now + DOUBLE_JUMP_WINDOW_TICKS });
        return;
    }

    const primed = primedLaunches.get(key);
    if (!primed || Number(primed.expiresAt ?? 0) < now) {
        primedLaunches.delete(key);
        return;
    }

    primedLaunches.delete(key);
    performWindLaunch(player, effect);
}

export function initializeElytraSupportModule() {
    if (globalThis.__statsCoreElytraSupportInitialized) return;
    globalThis.__statsCoreElytraSupportInitialized = true;
    world.afterEvents?.playerButtonInput?.subscribe?.(handleJumpInput);
}

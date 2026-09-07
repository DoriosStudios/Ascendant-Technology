import { EQUIPMENT_SLOTS } from "../config/equipmentTypes.js";
import { MOBILITY_VALUES } from "../config/values.js";
import { ButtonState, EntitySwingSource, InputButton, system, world } from "@minecraft/server";
import { showAbilityFeedback } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { getCurrentTick } from "../utils.js";

const launchCooldowns = new Map();
const primedLaunches = new Map();
const recentAttackHits = new Map();
const DOUBLE_JUMP_WINDOW_TICKS = MOBILITY_VALUES.elytraDoubleJumpWindowTicks;
const AIR_PUNCH_FALL_SPEED = MOBILITY_VALUES.airPunchFallSpeed;
const HEIGHT_RAY_DISTANCE = MOBILITY_VALUES.heightRayDistance;

function playerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function getWindLaunchEffect(player) {
    const context = getEquipmentStatsContext(player, EQUIPMENT_SLOTS.chest, "minecraft:elytra");
    if (!context || context.attributes?.refinement?.active !== true) return null;
    return findEffectByKind(context.attributes?.support?.effects, "elytra_wind_launch");
}

function isLaunchOnCooldown(player) {
    return Number(launchCooldowns.get(playerKey(player)) ?? 0) > getCurrentTick();
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function getVelocity(player) {
    try {
        const velocity = player?.getVelocity?.();
        return {
            x: Number(velocity?.x ?? 0),
            y: Number(velocity?.y ?? 0),
            z: Number(velocity?.z ?? 0),
        };
    } catch {
        return { x: 0, y: 0, z: 0 };
    }
}

function getMovementMagnitude(player) {
    try {
        const movement = player?.inputInfo?.getMovementVector?.();
        return Math.hypot(Number(movement?.x ?? 0), Number(movement?.y ?? 0));
    } catch {
        return 0;
    }
}

function getHeightAboveGround(player) {
    try {
        const location = player?.location;
        const hit = player?.dimension?.getBlockFromRay?.(
            { x: Number(location?.x ?? 0), y: Number(location?.y ?? 0) + 0.1, z: Number(location?.z ?? 0) },
            { x: 0, y: -1, z: 0 },
            { includeLiquidBlocks: true, includePassableBlocks: false, maxDistance: HEIGHT_RAY_DISTANCE },
        );
        if (!hit?.block?.location) return HEIGHT_RAY_DISTANCE + 1;
        return Math.max(0, Number(location?.y ?? 0) - (Number(hit.block.location.y ?? 0) + 1));
    } catch {
        return HEIGHT_RAY_DISTANCE + 1;
    }
}

function getNormalizedViewDirection(player) {
    try {
        const view = player?.getViewDirection?.();
        const x = Number(view?.x ?? 0);
        const y = Number(view?.y ?? 0);
        const z = Number(view?.z ?? 0);
        const length = Math.hypot(x, y, z);
        if (length < 0.001) return null;
        return { x: x / length, y: y / length, z: z / length };
    } catch {
        return null;
    }
}

function getDirectionalImpulse(player, effect, direction) {
    const velocity = getVelocity(player);
    const movementMagnitude = getMovementMagnitude(player);
    const height = getHeightAboveGround(player);
    const horizontalBoost = Math.max(0.25, Number(effect?.horizontalBoost ?? 0.9) || 0.9);
    const verticalBoost = Math.max(0.3, Number(effect?.verticalBoost ?? 0.82) || 0.82);
    const baseStrength = Math.hypot(horizontalBoost, verticalBoost);
    const currentForwardSpeed = (velocity.x * direction.x) + (velocity.y * direction.y) + (velocity.z * direction.z);

    let strength = baseStrength;
    if (movementMagnitude > 0.12) strength *= 1.08;
    if (player?.isGliding === true) strength *= 1.15;
    if (height > 16) strength *= 1.08;
    strength -= Math.min(0.35, Math.max(0, currentForwardSpeed) * 0.12);
    strength = clamp(strength, 0.55, baseStrength * 1.4);

    return {
        x: direction.x * strength,
        y: direction.y * strength,
        z: direction.z * strength,
    };
}

function spawnWindParticles(player, direction) {
    if (!player?.dimension || !player?.location) return;

    const center = {
        x: Number(player.location.x ?? 0),
        y: Number(player.location.y ?? 0) + 0.8,
        z: Number(player.location.z ?? 0),
    };
    const bursts = [
        { particle: "minecraft:wind_explosion_emitter", distance: 0.3 },
        { particle: "minecraft:breeze_wind_explosion_emitter", distance: 0.75 },
        { particle: "minecraft:breeze_wind_explosion_emitter", distance: 1.15 },
    ];
    for (const burst of bursts) {
        try {
            player.dimension.spawnParticle?.(burst.particle, {
                x: center.x - (direction.x * burst.distance),
                y: center.y - (direction.y * burst.distance),
                z: center.z - (direction.z * burst.distance),
            });
        } catch { }
    }
}

function performWindLaunch(player, effect) {
    if (!player || player.isOnGround === true || isLaunchOnCooldown(player)) return false;

    try {
        const direction = getNormalizedViewDirection(player);
        if (!direction || !player.applyImpulse) return false;
        const impulse = getDirectionalImpulse(player, effect, direction);
        spawnWindParticles(player, direction);
        try {
            player.dimension?.playSound?.("ascendant.statscore.wind_launch", player.location, { volume: 0.75, pitch: 1.08 });
        } catch { }
        player.applyImpulse(impulse);
        launchCooldowns.set(playerKey(player), getCurrentTick() + Math.max(10, Number(effect?.cooldownTicks ?? 45) || 45));
        showAbilityFeedback(player, "Wind Launch", STATSCORE_ICONS.wind);
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

function handleEntityHit(event) {
    const player = event?.damagingEntity;
    if (!player || player.typeId !== "minecraft:player") return;
    recentAttackHits.set(playerKey(player), getCurrentTick());
}

function handleSwingStart(event) {
    const player = event?.player;
    if (!player || event?.swingSource !== EntitySwingSource.Attack || player.isOnGround === true) return;

    const swingTick = getCurrentTick();
    const key = playerKey(player);
    system.run(() => {
        try {
            // Entity hits and arm swings are separate after-events. Waiting
            // one tick lets a real hit veto the relaunch, leaving only punches
            // in air.
            const lastHitTick = Number(recentAttackHits.get(key) ?? -1000);
            recentAttackHits.delete(key);
            if (lastHitTick >= swingTick || player?.isValid !== true || player.isOnGround === true) return;

            const effect = getWindLaunchEffect(player);
            if (!effect) return;
            const velocity = getVelocity(player);
            if (player.isGliding !== true && velocity.y >= AIR_PUNCH_FALL_SPEED) return;
            performWindLaunch(player, effect);
        } catch {
            recentAttackHits.delete(key);
        }
    });
}

export function hasWindLaunchPriority(player) {
    return Boolean(getWindLaunchEffect(player));
}

export function initializeElytraSupportModule() {
    if (globalThis.__statsCoreElytraSupportInitialized) return;
    globalThis.__statsCoreElytraSupportInitialized = true;
    world.afterEvents?.playerButtonInput?.subscribe?.(handleJumpInput);
    world.afterEvents?.entityHitEntity?.subscribe?.(handleEntityHit);
    world.afterEvents?.playerSwingStart?.subscribe?.(handleSwingStart);
}

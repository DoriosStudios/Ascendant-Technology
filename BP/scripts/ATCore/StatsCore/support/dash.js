import { MOBILITY_VALUES } from "../config/values.js";
import { BOOT_MOBILITY_MODES, EQUIPMENT_SLOTS } from "../config/equipmentTypes.js";
import { BOOT_MOBILITY_LABELS } from "../config/presentation.js";
import { ButtonState, InputButton, world } from "@minecraft/server";
import { showAbilityFeedback } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { persistEquipmentItem } from "../core/equipment.js";
import { writeStatsState } from "../core/state.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { getCurrentTick } from "../utils.js";
import { hasWindLaunchPriority } from "./elytra.js";

const jumpPresses = new Map();
const cooldowns = new Map();
const sneakPresses = new Map();
const bunnyJumps = new Set();
const DOUBLE_INPUT_WINDOW_TICKS = MOBILITY_VALUES.bootDoubleInputWindowTicks;


function playerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function getBootMobilityContext(player) {
    const context = getEquipmentStatsContext(player, EQUIPMENT_SLOTS.feet);
    const effect = findEffectByKind(context?.attributes?.support?.effects, "dash");
    return context && effect ? { context, effect } : null;
}

function getBootMobilityMode(context) {
    const mode = String(context?.state?.abilityData?.bootMobilityMode ?? "dash").toLowerCase();
    return BOOT_MOBILITY_MODES.includes(mode) ? mode : "dash";
}

function getNextBootMobilityMode(mode) {
    const currentIndex = BOOT_MOBILITY_MODES.indexOf(mode);
    return BOOT_MOBILITY_MODES[(currentIndex + 1) % BOOT_MOBILITY_MODES.length];
}

function showBootMobilityStatus(player, mode, prefix = "Boot Mobility") {
    try {
        player?.sendMessage?.(`§b${prefix} §7» §f${BOOT_MOBILITY_LABELS[mode] ?? BOOT_MOBILITY_LABELS.dash}`);
    } catch { }
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

function performBunnyJump(player) {
    if (!player || player.isOnGround === true) return false;

    try {
        const direction = player.getViewDirection?.() ?? { x: 0, z: 0 };
        const horizontalLength = Math.max(0.001, Math.hypot(Number(direction.x ?? 0), Number(direction.z ?? 0)));
        player.applyImpulse?.({
            x: (Number(direction.x ?? 0) / horizontalLength) * 0.24,
            y: 0.72,
            z: (Number(direction.z ?? 0) / horizontalLength) * 0.24,
        });
        showAbilityFeedback(player, "Bunny Jump", STATSCORE_ICONS.walkingSpeed);
        return true;
    } catch {
        return false;
    }
}

function handleJumpInput(event) {
    const player = event?.player;
    if (!player || event?.button !== InputButton.Jump || event?.newButtonState !== ButtonState.Pressed) return;
    const mobility = getBootMobilityContext(player);
    if (!mobility) return;

    const key = playerKey(player);
    if (hasWindLaunchPriority(player)) {
        // Wind Launch owns the jump sequence while a refined Elytra and
        // mobility boots are equipped together. Clear partial boot inputs so
        // they cannot fire immediately after the Elytra is removed.
        jumpPresses.delete(key);
        bunnyJumps.delete(key);
        return;
    }

    const mode = getBootMobilityMode(mobility.context);
    if (mode === "none") return;

    if (mode === "bunny_jump") {
        if (player.isOnGround === true) {
            bunnyJumps.delete(key);
            return;
        }
        if (!bunnyJumps.has(key) && performBunnyJump(player)) bunnyJumps.add(key);
        return;
    }

    if (dashOnCooldown(player)) return;

    const now = getCurrentTick();
    const previous = Number(jumpPresses.get(key) ?? -1000);
    jumpPresses.set(key, now);
    if (now - previous > DOUBLE_INPUT_WINDOW_TICKS) return;

    jumpPresses.delete(key);
    performDash(player, mobility.effect);
}

function handleSneakInput(event) {
    const player = event?.player;
    if (!player || event?.button !== InputButton.Sneak || event?.newButtonState !== ButtonState.Pressed) return;

    const mobility = getBootMobilityContext(player);
    if (!mobility) return;

    const now = getCurrentTick();
    const key = playerKey(player);
    const previous = Number(sneakPresses.get(key) ?? -1000);
    sneakPresses.set(key, now);
    if (now - previous > DOUBLE_INPUT_WINDOW_TICKS) return;

    sneakPresses.delete(key);
    const nextMode = getNextBootMobilityMode(getBootMobilityMode(mobility.context));
    const result = writeStatsState(mobility.context.stack, mobility.context.definition, {
        ...mobility.context.state,
        abilityData: {
            ...mobility.context.state.abilityData,
            bootMobilityMode: nextMode,
        },
    });
    if (!result.changed || !persistEquipmentItem(player, mobility.context.slotName, mobility.context.stack)) return;

    jumpPresses.delete(key);
    bunnyJumps.delete(key);
    showBootMobilityStatus(player, nextMode, "Modo de mobilidade");
}

function handleSwingStart(event) {
    const player = event?.player;
    const heldItem = event?.heldItemStack;
    if (!player || !heldItem) return;

    const context = getEquipmentStatsContext(player, EQUIPMENT_SLOTS.mainhand, heldItem.typeId);
    const effect = findEffectByKind(context?.attributes?.support?.effects, "dash");
    if (!effect) return;

    showBootMobilityStatus(player, getBootMobilityMode(context), "Estado do Boot Dash");
}

export function initializeBootDashModule() {
    if (globalThis.__statsCoreBootDashInitialized) return;
    globalThis.__statsCoreBootDashInitialized = true;
    world.afterEvents?.playerButtonInput?.subscribe?.(handleJumpInput);
    world.afterEvents?.playerButtonInput?.subscribe?.(handleSneakInput);
    world.afterEvents?.playerSwingStart?.subscribe?.(handleSwingStart);
}

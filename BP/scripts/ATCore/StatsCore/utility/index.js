import { ItemStack, system, world } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { persistEquipmentItem } from "../core/equipment.js";
import { writeStatsState } from "../core/state.js";
import { getHeldStatsContext } from "../shared/context.js";
import { applyEffectById } from "../shared/effects.js";
import { hasEnchantmentToken } from "../shared/enchantments.js";
import { findEffectByKind, hasEffectKind } from "../shared/effectSelectors.js";
import { showAbilityFeedback } from "../feedback/index.js";
import { resolveStatsAbilityName } from "../core/abilities.js";
import { normalizeOperatorMode } from "../core/state.js";
import { normalizeId } from "../utils.js";
import { isStatsCoreOverrideDamage } from "../shared/damage.js";

const operatorToggleTicks = new Map();
const WORM_SOIL_CYCLE = Object.freeze([
    "minecraft:dirt",
    "minecraft:grass_path",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:coarse_dirt",
    "minecraft:rooted_dirt",
]);
const WORM_DIG_DROPS = Object.freeze([
    "minecraft:wheat_seeds",
    "minecraft:beetroot_seeds",
    "minecraft:melon_seeds",
    "minecraft:pumpkin_seeds",
    "minecraft:torchflower_seeds",
]);

function canToggleOperator(player) {
    const key = String(player?.id ?? "operator");
    const tick = Number(system.currentTick ?? 0) || 0;
    const previousTick = Number(operatorToggleTicks.get(key) ?? -1);
    if (previousTick === tick) return false;

    operatorToggleTicks.set(key, tick);
    return true;
}

function cycleOperatorMode(player, context) {
    if (!player?.isSneaking) return false;
    const operatorEffect = findEffectByKind(context?.attributes?.mining?.effects, "operator");
    if (!operatorEffect) return false;
    if (!canToggleOperator(player)) return false;

    const current = normalizeOperatorMode(context?.state?.abilityData?.operatorMode);
    const next = current === "crushy"
        ? "silky"
        : current === "silky"
            ? "greedy"
            : "crushy";

    const result = writeStatsState(context.stack, context.definition, {
        ...context.state,
        abilityData: {
            ...(context.state?.abilityData ?? {}),
            operatorMode: next,
        }
    }, {
        syncLore: true,
    });

    if (result.changed) {
        persistEquipmentItem(player, STATSCORE.slots.mainhand, context.stack);
    }

    showAbilityFeedback(player, resolveStatsAbilityName(operatorEffect, { state: result.state }));
    return true;
}

function handleCreeperIgnition(player, context) {
    if (!hasEffectKind(context?.attributes?.effects, "igniter")) return false;

    const target = player?.getEntitiesFromViewDirection?.({ maxDistance: 3 })?.[0]?.entity;
    if (!target || normalizeId(target.typeId) !== "minecraft:creeper") return false;

    try {
        target.triggerEvent?.("minecraft:start_exploding_forced");
    } catch {
        try {
            target.setOnFire?.(4, true);
        } catch {
            return false;
        }
    }

    showAbilityFeedback(player, "Igniter");
    return true;
}

function handleHarpoonLaunch(player, context) {
    if (!hasEffectKind(context?.attributes?.effects, "harpoon")) return false;
    if (!hasEnchantmentToken(context?.stack, "loyalty")) return false;

    const view = player?.getViewDirection?.();
    if (!view) return false;

    try {
        player.applyImpulse?.({
            x: Number(view.x ?? 0) * 2.15,
            y: Math.max(0.55, Number(view.y ?? 0) * 1.6 + 0.55),
            z: Number(view.z ?? 0) * 2.15,
        });
        applyEffectById(player, "slow_falling", 60, 0, false);
        showAbilityFeedback(player, "Harpoon");
        return true;
    } catch {
        return false;
    }
}

function handleTntIgnition(event) {
    const player = event?.source;
    const block = event?.block;
    const itemStack = event?.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !block || !itemStack) return;

    const context = getHeldStatsContext(player, itemStack.typeId);
    if (!context || !hasEffectKind(context.attributes?.effects, "igniter")) return;
    if (normalizeId(block.typeId) !== "minecraft:tnt") return;

    const location = {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
    };
    const dimension = block.dimension ?? player.dimension;
    if (!dimension) return;

    system.run(() => {
        try {
            const currentBlock = dimension.getBlock(location);
            if (currentBlock?.typeId === "minecraft:air") {
                dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} tnt`);
                showAbilityFeedback(player, "Igniter");
            }
        } catch { }
    });
}

function spawnRandomWormSeed(block) {
    const itemId = WORM_DIG_DROPS[Math.floor(Math.random() * WORM_DIG_DROPS.length)] ?? null;
    if (!block?.dimension || !itemId) return false;

    try {
        block.dimension.spawnItem(new ItemStack(itemId, 1), {
            x: block.location.x + 0.5,
            y: block.location.y + 1,
            z: block.location.z + 0.5,
        });
        return true;
    } catch {
        return false;
    }
}

function handleWormUseOn(event, context) {
    const player = event?.source;
    const block = event?.block;
    if (!player || !block) return false;
    if (!hasEffectKind(context?.attributes?.mining?.effects, "worm")) return false;

    const currentSoilId = normalizeId(block.typeId);
    if (!WORM_SOIL_CYCLE.includes(currentSoilId)) return false;

    event.cancel = true;

    if (player.isSneaking) {
        const applied = spawnRandomWormSeed(block);
        if (applied) {
            showAbilityFeedback(player, "Worm");
        }
        return applied;
    }

    const soilIndex = WORM_SOIL_CYCLE.indexOf(currentSoilId);
    if (soilIndex < 0) return false;

    const nextSoilId = WORM_SOIL_CYCLE[(soilIndex + 1) % WORM_SOIL_CYCLE.length];

    try {
        block.setType(nextSoilId);
        showAbilityFeedback(player, "Worm");
        return true;
    } catch {
        return false;
    }
}

function handleWormEvasion(event) {
    if (event?.cancel === true) return;
    if (isStatsCoreOverrideDamage(event)) return;

    const player = event?.hurtEntity ?? event?.entity;
    if (!player || player.typeId !== "minecraft:player") return;
    if (Number(event?.damage ?? 0) <= 0) return;

    const context = getHeldStatsContext(player);
    if (!context || !hasEffectKind(context.attributes?.mining?.effects, "worm")) return;

    if (Math.random() > 0.5) return;
    event.damage = 0;
    event.cancel = true;
    showAbilityFeedback(player, "Worm");
}

function handleItemUse(event) {
    const player = event?.source;
    const itemStack = event?.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !itemStack) return;

    const context = getHeldStatsContext(player, itemStack.typeId);
    if (!context) return;

    if (cycleOperatorMode(player, context)) {
        return;
    }

    if (handleHarpoonLaunch(player, context)) {
        return;
    }

    handleCreeperIgnition(player, context);
}

function handleItemUseOn(event) {
    const player = event?.source;
    const itemStack = event?.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !itemStack) return;

    const context = getHeldStatsContext(player, itemStack.typeId);
    if (!context) return;

    if (cycleOperatorMode(player, context)) {
        return;
    }

    if (handleWormUseOn(event, context)) {
        return;
    }

    handleTntIgnition(event);
}

export function initializeUtilityInteractionModule() {
    if (globalThis.__statsCoreUtilityInteractionInitialized) return;
    globalThis.__statsCoreUtilityInteractionInitialized = true;

    world.afterEvents?.itemUse?.subscribe?.(handleItemUse);
    world.beforeEvents?.itemUseOn?.subscribe?.(handleItemUseOn);
    world.beforeEvents?.entityHurt?.subscribe?.(handleWormEvasion);
}

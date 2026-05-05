import { EffectTypes, ItemStack, system, world } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { resolveStatsAttributes } from "../attributes/resolve.js";
import { getEquipment, persistEquipmentItem } from "../core/equipment.js";
import { getStatsCoreDefinition } from "../core/registry.js";
import { readStatsState, writeStatsState } from "../core/state.js";

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

function normalizeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveEffectType(id) {
    if (!id) return undefined;
    const normalized = String(id).includes(":") ? String(id) : `minecraft:${id}`;
    return EffectTypes?.get?.(normalized) ?? EffectTypes?.get?.(id) ?? normalized;
}

function setActionBar(player, message) {
    try {
        player?.onScreenDisplay?.setActionBar?.(message);
    } catch { }
}

function getHeldStatsContext(player, expectedTypeId) {
    const { item: stack } = getEquipment(player, STATSCORE.slots.mainhand);
    if (!stack || (expectedTypeId && stack.typeId !== expectedTypeId)) return null;

    const definition = getStatsCoreDefinition(stack);
    if (!definition) return null;

    const state = readStatsState(stack, definition);
    const attributes = resolveStatsAttributes(definition, state);

    return { stack, definition, state, attributes };
}

function hasEffectOfKind(list, kind) {
    return Array.isArray(list) && list.some(effect => normalizeId(effect?.kind) === normalizeId(kind));
}

function hasEnchantment(stack, token) {
    try {
        const enchantable = stack?.getComponent?.("minecraft:enchantable")
            ?? stack?.getComponent?.("minecraft:enchantments")
            ?? stack?.getComponent?.("enchantments");

        const enchantments = enchantable?.getEnchantments?.() ?? enchantable?.enchantments;
        if (!enchantments) return false;

        const matcher = entry => normalizeId(entry?.type?.id ?? entry?.id ?? entry?.typeId).includes(normalizeId(token));
        if (Array.isArray(enchantments)) {
            return enchantments.some(matcher);
        }

        if (typeof enchantments[Symbol.iterator] === "function") {
            for (const entry of enchantments) {
                if (matcher(entry)) return true;
            }
        }
    } catch { }

    return false;
}

function applyEffectById(target, id, duration, amplifier = 0, showParticles = false) {
    const effectType = resolveEffectType(id);
    if (!target || !effectType) return false;

    try {
        target.addEffect?.(effectType, duration, {
            amplifier,
            showParticles,
        });
        return true;
    } catch {
        return false;
    }
}

function canToggleOperator(player) {
    const key = String(player?.id ?? "operator");
    const tick = Number(system.currentTick ?? 0) || 0;
    const previousTick = Number(operatorToggleTicks.get(key) ?? -1);
    if (previousTick === tick) return false;

    operatorToggleTicks.set(key, tick);
    return true;
}

function formatOperatorMode(mode) {
    if (mode === "silky") return "Silky";
    if (mode === "greedy") return "Greedy";
    return "Crushy";
}

function cycleOperatorMode(player, context) {
    if (!player?.isSneaking || !canToggleOperator(player)) return false;
    if (!hasEffectOfKind(context?.attributes?.mining?.effects, "operator")) return false;

    const current = normalizeId(context?.state?.abilityData?.operatorMode ?? "crushy");
    const next = current === "crushy"
        ? "silky"
        : current === "silky"
            ? "greedy"
            : "crushy";

    const result = writeStatsState(context.stack, context.definition, {
        ...context.state,
        abilityData: {
            ...(context.state?.abilityData ?? {}),
            uniqueUnlocked: true,
            operatorMode: next,
        }
    }, {
        syncLore: true,
        forceLore: true,
    });

    if (result.changed) {
        persistEquipmentItem(player, STATSCORE.slots.mainhand, context.stack);
    }

    setActionBar(player, `§g${formatOperatorMode(next)} Operator`);
    return true;
}

function handleCreeperIgnition(player, context) {
    if (!hasEffectOfKind(context?.attributes?.effects, "igniter")) return false;

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

    setActionBar(player, "§gIngniter");
    return true;
}

function handleHarpoonLaunch(player, context) {
    if (!hasEffectOfKind(context?.attributes?.effects, "harpoon")) return false;
    if (!hasEnchantment(context?.stack, "loyalty")) return false;

    const view = player?.getViewDirection?.();
    if (!view) return false;

    try {
        player.applyImpulse?.({
            x: Number(view.x ?? 0) * 2.15,
            y: Math.max(0.55, Number(view.y ?? 0) * 1.6 + 0.55),
            z: Number(view.z ?? 0) * 2.15,
        });
        applyEffectById(player, "slow_falling", 60, 0, false);
        setActionBar(player, "§gHarpoon");
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
    if (!context || !hasEffectOfKind(context.attributes?.effects, "igniter")) return;
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
                setActionBar(player, "§gIngniter");
            }
        } catch { }
    });
}

function isWormSoilBlockId(blockId) {
    return WORM_SOIL_CYCLE.includes(normalizeId(blockId));
}

function resolveNextWormSoilId(blockId) {
    const normalized = normalizeId(blockId);
    const index = WORM_SOIL_CYCLE.indexOf(normalized);
    if (index < 0) return null;
    return WORM_SOIL_CYCLE[(index + 1) % WORM_SOIL_CYCLE.length];
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
    if (!hasEffectOfKind(context?.attributes?.mining?.effects, "worm")) return false;
    if (!isWormSoilBlockId(block.typeId)) return false;

    event.cancel = true;

    if (player.isSneaking) {
        const applied = spawnRandomWormSeed(block);
        if (applied) {
            setActionBar(player, "§gWorm");
        }
        return applied;
    }

    const nextSoilId = resolveNextWormSoilId(block.typeId);
    if (!nextSoilId) return false;

    try {
        block.setType(nextSoilId);
        setActionBar(player, "§gWorm");
        return true;
    } catch {
        return false;
    }
}

function handleWormEvasion(event) {
    if (event?.cancel === true) return;

    const player = event?.hurtEntity ?? event?.entity;
    if (!player || player.typeId !== "minecraft:player") return;
    if (Number(event?.damage ?? 0) <= 0) return;

    const context = getHeldStatsContext(player);
    if (!context || !hasEffectOfKind(context.attributes?.mining?.effects, "worm")) return;

    if (Math.random() > 0.5) return;
    event.damage = 0;
    setActionBar(player, "§gWorm");
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
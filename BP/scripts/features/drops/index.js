// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { EffectTypes, ItemStack, system, world } from "@minecraft/server";
import { resolveBlockDrops } from "../../ATCore/drops/index.js";
import { DROP_SETTINGS } from "../../config/drops/index.js";

const EXCAVATE_ID = "dorios_excavate";
const EXCAVATE_EVENTS = new Set(["dorios:blockloot", "dorios:hammerblock"]);
const XP_MODES = new Set(["auto", "player", "orb", "none"]);

function isCreative(player) {
  return player?.isInCreative?.() === true
    || String(player?.getGameMode?.() ?? "").toLowerCase() === "creative";
}

function getEnchantData(tool) {
  if (!tool) return { fortuneLevel: 0, hasSilkTouch: false };
  let enchantments;
  try {
    const enchantable = tool.getComponent?.("minecraft:enchantable");
    enchantments = enchantable?.getEnchantments?.();
  } catch {
    enchantments = undefined;
  }

  let fortuneLevel = 0;
  let hasSilkTouch = false;
  for (const enchantment of enchantments ?? []) {
    const typeId = String(enchantment?.type?.id ?? enchantment?.typeId ?? enchantment?.id ?? "")
      .replace("minecraft:", "");
    const level = Number(enchantment?.level ?? 0);
    if (typeId === "fortune") fortuneLevel = Math.max(fortuneLevel, level);
    if (typeId === "silk_touch" && level > 0) hasSilkTouch = true;
  }
  return { fortuneLevel, hasSilkTouch };
}

function getMainHand(player) {
  try {
    return DoriosLib.entity.getEquipment(player, "Mainhand")
      ?? player?.getComponent?.("inventory")?.container?.getItem?.(player.selectedSlotIndex ?? player.selectedSlot ?? 0);
  } catch {
    return undefined;
  }
}

function getSpawnPosition(location) {
  const offset = DROP_SETTINGS.spawnOffset;
  return {
    x: location.x + Number(offset?.x ?? 0.5),
    y: location.y + Number(offset?.y ?? 0.5),
    z: location.z + Number(offset?.z ?? 0.5),
  };
}

function getSearchRadius() {
  const radius = Number(DROP_SETTINGS.replaceSearchRadius);
  return Number.isFinite(radius) && radius > 0 ? radius : 1.25;
}

function nearbyItemEntities(dimension, location) {
  try {
    return dimension.getEntities({
      type: "minecraft:item",
      location,
      maxDistance: getSearchRadius(),
    });
  } catch {
    return [];
  }
}

function snapshotNearbyItems(dimension, location) {
  const ids = new Set();
  for (const entity of nearbyItemEntities(dimension, location)) {
    if (entity?.id) ids.add(entity.id);
  }
  return ids;
}

function resolveXpMode(value) {
  const mode = String(value ?? DROP_SETTINGS.xpMode ?? "auto").toLowerCase();
  return XP_MODES.has(mode) ? mode : "auto";
}

function awardXp(player, dimension, location, amount, mode) {
  if (!Number.isFinite(amount) || amount <= 0 || mode === "none") return;
  if (mode !== "orb" && typeof player?.addExperience === "function") {
    player.addExperience(amount);
    return;
  }
  dimension.spawnExperienceOrb?.(location, amount);
}

function normalizeChance(value) {
  const chance = Number(value ?? 1);
  if (!Number.isFinite(chance)) return 1;
  if (chance <= 0) return 0;
  return chance > 1 ? chance / 100 : chance;
}

function rollChance(value) {
  const chance = normalizeChance(value);
  return chance >= 1 || (chance > 0 && Math.random() <= chance);
}

function resolveEffectType(typeId) {
  const normalized = String(typeId ?? "").includes(":")
    ? String(typeId)
    : `minecraft:${typeId}`;
  return EffectTypes.get?.(normalized) ?? normalized;
}

function setBlockToAir(block, dimension, location) {
  try {
    if (typeof dimension.setBlockType === "function") dimension.setBlockType(location, "minecraft:air");
    else block?.setType?.("minecraft:air");
    return true;
  } catch (error) {
    console.warn(`[AT Drops] Failed removing ${block?.typeId}:`, error);
    return false;
  }
}

function playResultSound(result, dimension, location) {
  const selected = result.omitSpecialSound ? result.baseSound : (result.sound ?? result.baseSound);
  const soundId = typeof selected === "string" ? selected : selected?.id;
  if (!soundId) return;
  try {
    const options = typeof selected === "object"
      ? { volume: selected.volume, pitch: selected.pitch }
      : undefined;
    if (options) dimension.playSound(soundId, location, options);
    else dimension.playSound(soundId, location);
  } catch (error) {
    console.warn(`[AT Drops] Failed playing ${soundId}:`, error);
  }
}

function runResultEffects(result, player, dimension, location) {
  playResultSound(result, dimension, location);
  awardXp(player, dimension, location, result.xp, resolveXpMode(result.xpMode));

  for (const effect of result.statusEffects ?? []) {
    if (!effect?.id || !rollChance(effect.chance)) continue;
    const duration = Math.max(1, Math.floor(Number(effect.duration ?? 1)));
    try {
      player.addEffect(resolveEffectType(effect.id), duration, {
        amplifier: Math.max(0, Math.floor(Number(effect.amplifier ?? 0))),
        showParticles: effect.showParticles !== false,
      });
    } catch (error) {
      console.warn(`[AT Drops] Failed applying ${effect.id}:`, error);
    }
  }

  for (const particle of result.particles ?? []) {
    if (!particle?.id || !rollChance(particle.chance)) continue;
    const count = Math.max(1, Math.floor(Number(particle.count ?? 1)));
    const spread = Math.max(0, Number(particle.spread ?? 0));
    const offset = particle.offset ?? {};
    for (let index = 0; index < count; index++) {
      try {
        dimension.spawnParticle(particle.id, {
          x: location.x + Number(offset.x ?? 0) + (Math.random() * 2 - 1) * spread,
          y: location.y + Number(offset.y ?? 0) + (Math.random() * 2 - 1) * spread,
          z: location.z + Number(offset.z ?? 0) + (Math.random() * 2 - 1) * spread,
        });
      } catch (error) {
        console.warn(`[AT Drops] Failed spawning ${particle.id}:`, error);
        break;
      }
    }
  }

  const runner = result.commandTarget === "player"
    ? player?.runCommand?.bind(player)
    : dimension?.runCommand?.bind(dimension);
  for (const command of result.commands ?? []) {
    if (typeof command !== "string" || typeof runner !== "function") continue;
    try {
      runner(command);
    } catch (error) {
      console.warn(`[AT Drops] Failed command ${command}:`, error);
    }
  }
}

function spawnStacks(dimension, location, stacks) {
  for (const stack of stacks ?? []) {
    if (!stack) continue;
    try {
      dimension.spawnItem(stack, location);
    } catch (error) {
      console.warn(`[AT Drops] Failed spawning ${stack.typeId}:`, error);
    }
  }
}

function replaceNewVanillaDrop(result, dimension, location, knownIds) {
  if (!result.replaceOriginalId || result.replaceDrops.length === 0) return;
  let replaced = false;
  for (const entity of nearbyItemEntities(dimension, location)) {
    if (knownIds?.has(entity.id)) continue;
    const stack = entity.getComponent?.("minecraft:item")?.itemStack;
    if (stack?.typeId !== result.replaceOriginalId) continue;
    try {
      entity.remove();
      replaced = true;
    } catch {
      // The entity may already have merged or despawned.
    }
  }
  if (replaced) spawnStacks(dimension, location, result.replaceDrops);
}

function executePlayerBreakResult({ result, block, player, dimension, location, knownIds }) {
  const spawnLocation = getSpawnPosition(location);
  if (result.replaceVanilla) {
    setBlockToAir(block, dimension, location);
    if (!result.sound && !result.baseSound && !result.suppressVanillaSound) {
      try { dimension.playSound("dig.deepslate", spawnLocation); } catch { /* optional sound */ }
    }
  }
  runResultEffects(result, player, dimension, spawnLocation);
  replaceNewVanillaDrop(result, dimension, spawnLocation, knownIds);
  spawnStacks(dimension, spawnLocation, result.drops);
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const { block, player, dimension } = event;
  if (!block || !player || isCreative(player)) return;

  const tool = event.itemStack ?? getMainHand(player);
  const enchantments = getEnchantData(tool);
  const result = resolveBlockDrops({
    block,
    player,
    dimension,
    tool,
    ...enchantments,
  });
  if (!result) return;

  const location = { ...block.location };
  const spawnLocation = getSpawnPosition(location);
  const knownIds = result.mode === "vanilla" && result.replaceOriginalId
    ? snapshotNearbyItems(dimension, spawnLocation)
    : undefined;

  if (result.replaceVanilla) event.cancel = true;
  system.run(() => executePlayerBreakResult({
    result,
    block,
    player,
    dimension,
    location,
    knownIds,
  }));
});

function parseLocation(message) {
  const values = String(message ?? "").split(",").map((value) => Number(value.trim()));
  if (values.length < 3 || values.some((value) => !Number.isFinite(value))) return undefined;
  return { x: Math.floor(values[0]), y: Math.floor(values[1]), z: Math.floor(values[2]) };
}

function generateVanillaDrops(block, permutation, tool) {
  try {
    const manager = world.getLootTableManager?.();
    const drops = manager?.generateLootFromBlockPermutation?.(permutation, tool)
      ?? manager?.generateLootFromBlock?.(block, tool);
    if (Array.isArray(drops) && drops.length > 0) return drops.filter(Boolean);
  } catch (error) {
    console.warn(`[AT Drops] Loot generation failed for ${block?.typeId}:`, error);
  }
  if (DROP_SETTINGS.excavate?.lootFallback !== "block_item" || !block?.typeId) return [];
  try {
    return [new ItemStack(block.typeId, 1)];
  } catch {
    return [];
  }
}

function applyReplacement(stacks, result) {
  if (!result?.replaceOriginalId || result.replaceDrops.length === 0) return stacks;
  let replaced = false;
  const output = [];
  for (const stack of stacks) {
    if (!replaced && stack?.typeId === result.replaceOriginalId) {
      output.push(...result.replaceDrops);
      replaced = true;
    } else if (stack) {
      output.push(stack);
    }
  }
  return output;
}

function handleExcavateEvent(event) {
  if (DROP_SETTINGS.excavate?.enabled === false) return;
  if (!DoriosLib.dependencies.get(EXCAVATE_ID)) return;
  const eventId = String(event?.id ?? "").toLowerCase();
  if (!EXCAVATE_EVENTS.has(eventId)) return;

  const player = event.sourceEntity;
  const location = parseLocation(event.message);
  if (!player?.dimension || !location || isCreative(player)) return;

  const dimension = player.dimension;
  let block;
  try {
    block = dimension.getBlock(location);
  } catch {
    return;
  }
  if (!block || block.isAir || DoriosLib.constants.isUnbreakableBlock(block.typeId)) return;

  const tool = getMainHand(player);
  const enchantments = getEnchantData(tool);
  const bridgeContext = {
    eventId,
    toolIdHints: tool?.typeId ? [tool.typeId] : [],
    toolTypeHints: eventId === "dorios:hammerblock" ? ["utilitycraft:is_hammer"] : [],
  };
  const result = resolveBlockDrops({
    block,
    player,
    dimension,
    tool,
    bridgeContext,
    ...enchantments,
  });

  let permutation;
  try { permutation = block.permutation; } catch { permutation = undefined; }
  let drops = result?.replaceVanilla ? [] : generateVanillaDrops(block, permutation, tool);
  if (result?.mode === "vanilla") drops = applyReplacement(drops, result);
  if (result?.drops?.length) drops.push(...result.drops);

  const blockLocation = { ...block.location };
  const spawnLocation = getSpawnPosition(blockLocation);
  setBlockToAir(block, dimension, blockLocation);
  if (result) runResultEffects(result, player, dimension, spawnLocation);
  spawnStacks(dimension, spawnLocation, drops);
}

system.afterEvents.scriptEventReceive.subscribe(handleExcavateEvent);

// @ts-check

import { ItemStack, world } from "@minecraft/server";
import { getDropDefinition } from "./registry.js";

const VALID_DROP_MODES = new Set(["replace", "supplement", "vanilla"]);
const toolTagCache = new Map();

function randomInteger(min, max) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function normalizeRange(value, fallback = [1, 1]) {
  if (Array.isArray(value)) {
    const min = Number(value[0]);
    const max = Number(value[1] ?? value[0]);
    if (Number.isFinite(min) && Number.isFinite(max)) return [Math.min(min, max), Math.max(min, max)];
  }
  if (Number.isFinite(value)) return [Number(value), Number(value)];
  if (value && typeof value === "object") {
    const min = Number(value.min ?? value.minimum ?? value[0]);
    const max = Number(value.max ?? value.maximum ?? value[1] ?? min);
    if (Number.isFinite(min) && Number.isFinite(max)) return [Math.min(min, max), Math.max(min, max)];
  }
  return fallback;
}

function normalizeChance(value, fallback = 1) {
  if (value === undefined || value === null) return fallback;
  const chance = Number(value);
  if (!Number.isFinite(chance)) return fallback;
  if (chance <= 0) return 0;
  return chance > 1 ? chance / 100 : chance;
}

function rollChance(value, fallback = 1) {
  const chance = normalizeChance(value, fallback);
  return chance >= 1 || (chance > 0 && Math.random() <= chance);
}

function resolveAmount(definition, fortuneLevel) {
  const level = Number.isFinite(fortuneLevel) ? fortuneLevel : 0;
  const tiers = definition.fortuneTiers;

  if (Array.isArray(tiers) && tiers.length > 0) {
    const exact = tiers.find((tier) => tier.level === level);
    if (!exact && level < tiers[0].level) {
      const [min, max] = normalizeRange(definition.baseRange);
      return randomInteger(min, max);
    }
    const tier = exact ?? tiers[tiers.length - 1];
    const [min, max] = normalizeRange(tier?.range, normalizeRange(definition.baseRange));
    return randomInteger(min, max);
  }

  const [baseMin, baseMax] = normalizeRange(definition.baseRange);
  const fortune = definition.fortuneMath;
  if (!fortune) return randomInteger(baseMin, baseMax);

  const [minPerLevel, maxPerLevel] = normalizeRange(fortune.perLevel, [0, 0]);
  let min = baseMin;
  let max = baseMax;
  if (fortune.mode === "multiplier") {
    min *= 1 + minPerLevel * level;
    max *= 1 + maxPerLevel * level;
  } else if (fortune.mode === "bonus") {
    min += minPerLevel * level;
    max += maxPerLevel * level;
  }

  if (fortune.cap) {
    const [capMin, capMax] = normalizeRange(fortune.cap, [min, max]);
    min = Math.min(min, capMin);
    max = Math.min(max, capMax);
  }
  return randomInteger(Math.max(1, Math.floor(min)), Math.max(1, Math.floor(max)));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function getToolTags(tool) {
  if (!tool?.typeId) return [];
  let tags = toolTagCache.get(tool.typeId);
  if (tags) return tags;
  try {
    tags = tool.getTags?.() ?? [];
  } catch {
    tags = [];
  }
  toolTagCache.set(tool.typeId, tags);
  return tags;
}

function matchesToolId(tool, requiredId, context) {
  if (!requiredId) return true;
  if (tool?.typeId === requiredId) return true;
  return normalizeList(context?.bridgeContext?.toolIdHints).includes(requiredId);
}

function matchesToolType(tool, requiredTypes, context) {
  if (!requiredTypes) return true;
  const required = normalizeList(requiredTypes);
  const hints = normalizeList(context?.bridgeContext?.toolTypeHints);
  if (required.some((tag) => hints.includes(tag))) return true;
  const tags = getToolTags(tool);
  return required.some((tag) => tags.includes(tag));
}

function findToolOverride(tool, overrides, context) {
  if (!Array.isArray(overrides)) return undefined;
  return overrides.find((override) =>
    matchesToolId(tool, override.toolId, context)
    && matchesToolType(tool, override.toolType, context));
}

function normalizeDimensionId(value) {
  return String(value ?? "").toLowerCase().replace("minecraft:", "");
}

function matchesConditions(context, conditions) {
  if (!conditions) return true;
  if (conditions.dimension) {
    const current = normalizeDimensionId(context.dimension?.id);
    const allowed = normalizeList(conditions.dimension).map(normalizeDimensionId);
    if (!allowed.includes(current)) return false;
  }
  if (conditions.timeRange) {
    const [min, max] = normalizeRange(conditions.timeRange, [0, 23999]);
    const time = world.getTimeOfDay?.();
    if (Number.isFinite(time)) {
      const current = ((time % 24000) + 24000) % 24000;
      if (!(min <= max ? current >= min && current <= max : current >= min || current <= max)) return false;
    }
  }
  if (conditions.playerSneaking !== undefined
    && Boolean(context.player?.isSneaking) !== Boolean(conditions.playerSneaking)) return false;
  if (conditions.playerGameMode) {
    const modes = normalizeList(conditions.playerGameMode).map((mode) => mode.toLowerCase());
    if (!modes.includes(String(context.player?.getGameMode?.() ?? "").toLowerCase())) return false;
  }
  if (conditions.toolType && !matchesToolType(context.tool, conditions.toolType, context)) return false;
  if (conditions.blockStates) {
    for (const [state, expected] of Object.entries(conditions.blockStates)) {
      try {
        if (context.block?.permutation?.getState(state) !== expected) return false;
      } catch {
        return false;
      }
    }
  }
  return true;
}

function resolveExtraDrops(definition, fortuneLevel) {
  const drops = [];
  for (const entry of definition.extraDrops ?? []) {
    if (!entry?.dropId || !rollChance(entry.chance)) continue;
    const amount = resolveAmount({
      baseRange: normalizeRange(entry.amountRange ?? entry.amount),
      fortuneMath: entry.fortuneMath,
      fortuneTiers: entry.fortuneTiers,
    }, fortuneLevel);
    if (amount > 0) drops.push(new ItemStack(entry.dropId, amount));
  }
  return drops;
}

function resolveXp(value) {
  if (value === undefined || value === null) return undefined;
  const [min, max] = normalizeRange(value, [0, 0]);
  const amount = randomInteger(min, max);
  return amount > 0 ? amount : undefined;
}

function resolveDropMode(definition, usedOverride) {
  const explicit = String(definition.dropMode ?? "").toLowerCase();
  if (VALID_DROP_MODES.has(explicit)) return explicit;
  if (definition.replaceVanilla === false) return "supplement";
  if (definition.replaceVanilla === true || usedOverride) return "replace";
  return "replace";
}

function resolveReplacement(definition, fortuneLevel) {
  if (!definition.originalDropId || !definition.replaceDropId) return undefined;
  return {
    originalDropId: definition.originalDropId,
    drops: [new ItemStack(definition.replaceDropId, resolveAmount(definition, fortuneLevel))],
  };
}

/**
 * Resolves one exact registered block definition. Unregistered blocks perform
 * one Map lookup and return immediately.
 *
 * @param {Record<string, any>} context
 */
export function resolveBlockDrops(context) {
  const baseDefinition = getDropDefinition(context?.block?.typeId);
  if (!baseDefinition || !matchesConditions(context, baseDefinition.conditions)) return null;
  if (baseDefinition.toolType && !matchesToolType(context.tool, baseDefinition.toolType, context)) return null;

  const override = findToolOverride(context.tool, baseDefinition.specialTools, context);
  if (override && !matchesConditions(context, override.conditions)) return null;
  const definition = override ? { ...baseDefinition, ...override } : baseDefinition;
  const mode = resolveDropMode(definition, Boolean(override));
  const replaceVanilla = mode === "replace";
  const replacement = replaceVanilla ? undefined : resolveReplacement(definition, context.fortuneLevel);
  const drops = [];

  if (context.hasSilkTouch) {
    if (replaceVanilla && definition.silkDropId) drops.push(new ItemStack(definition.silkDropId, 1));
  } else if (replaceVanilla && definition.dropId && definition.baseRange) {
    drops.push(new ItemStack(definition.dropId, resolveAmount(definition, context.fortuneLevel)));
  }
  drops.push(...resolveExtraDrops(definition, context.fortuneLevel));

  const hasEffects = Boolean(
    definition.baseSound || definition.sound || definition.particles?.length
    || definition.statusEffects?.length || definition.commands?.length
    || definition.xp !== undefined || replacement?.drops?.length
  );
  if (drops.length === 0 && !override && !hasEffects) return null;

  return {
    mode,
    drops,
    replaceVanilla,
    replaceOriginalId: replacement?.originalDropId,
    replaceDrops: replacement?.drops ?? [],
    sound: override ? override.sound : undefined,
    baseSound: definition.baseSound,
    omitSpecialSound: Boolean(definition.omitSpecialSound),
    suppressVanillaSound: Boolean(definition.suppressVanillaSound),
    particles: definition.particles ?? [],
    statusEffects: definition.statusEffects ?? [],
    xp: resolveXp(definition.xp),
    xpMode: definition.xpMode,
    commands: definition.commands ?? [],
    commandTarget: definition.commandTarget ?? "dimension",
  };
}

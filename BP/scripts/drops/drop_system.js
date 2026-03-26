import { world, system, EffectTypes, ItemStack } from '@minecraft/server';
import './drops.js'; // ensures DoriosAPI is available globally when main.js loads
import { DROPS_SETTINGS, getDropsForBlock } from './drops.js';

/**
 * Extract fortune and silk touch levels from the breaking tool.
 * @param {import('@minecraft/server').ItemStack | undefined} tool
 */
function getEnchantData(tool) {
  if (!tool) return { fortuneLevel: 0, hasSilkTouch: false };

  const compEnch = tool.getComponent?.('minecraft:enchantments') ?? tool.getComponent?.('enchantments');
  const compEnchantable = tool.getComponent?.('minecraft:enchantable');

  let list = compEnch?.getEnchantments?.() ?? compEnch?.enchantments;
  if (!list) list = compEnchantable?.getEnchantments?.();

  const scanLevels = (src) => {
    let fortune = 0;
    let silk = 0;
    const scanEntry = (e) => {
      const id = e?.type?.id ?? e?.id ?? e?.typeId ?? e?.identifier ?? e?.name;
      const lvl = e?.level ?? e?.lvl ?? e?.amount ?? 0;
      if (!id) return;
      const norm = String(id).replace('minecraft:', '');
      if (norm.includes('fortune')) fortune = Math.max(fortune, lvl);
      if (norm.includes('silk_touch')) silk = Math.max(silk, lvl);
    };

    const iterable = src?.enchantments ?? src;
    if (!iterable) return { fortune, silk };

    if (Array.isArray(iterable)) {
      iterable.forEach(scanEntry);
    } else if (typeof iterable[Symbol.iterator] === 'function') {
      for (const e of iterable) scanEntry(e);
    } else if (typeof iterable === 'object') {
      Object.values(iterable).forEach(scanEntry);
    }
    return { fortune, silk };
  };

  const { fortune, silk } = scanLevels(list);
  return { fortuneLevel: fortune, hasSilkTouch: silk > 0 };
}

function damageHeldTool(player, tool, slot) {
  if (!tool || typeof slot !== 'number') return;

  try {
    if (tool?.durability?.damage) {
      tool.durability.damage(1);
    } else {
      const durability = tool.getComponent?.('minecraft:durability') ?? tool.getComponent?.('durability');
      if (durability) {
        durability.damage = Math.min(durability.damage + 1, durability.maxDurability);
      }
    }

    const inv = player.getComponent('inventory')?.container;
    if (!inv) return;

    const durability = tool.getComponent?.('minecraft:durability') ?? tool.getComponent?.('durability');
    if (durability && durability.damage >= durability.maxDurability) {
      inv.setItem(slot, undefined);
      return;
    }

    inv.setItem(slot, tool);
  } catch {
    return;
  }
}

const DROP_SYSTEM_RULES = Object.freeze({
  xpModes: new Set(['auto', 'player', 'orb', 'none']),
  resultModes: new Set(['replace', 'supplement', 'vanilla']),
  vanillaDropModes: Object.freeze({
    LOOT_TABLE: 'loot_table',
    DESTROY_COMMAND: 'destroy_command',
    BREAK_THEN_REGEN_LOOT_TABLE: 'break_then_regen_loot_table'
  }),
  lootFallbackModes: Object.freeze({
    BLOCK_ITEM: 'block_item',
    DESTROY_COMMAND: 'destroy_command',
    NONE: 'none'
  }),
  defaults: Object.freeze({
    replaceSearchRadius: 1.25,
    dropSpawnOffset: Object.freeze({
      x: 0.5,
      y: 0.5,
      z: 0.5
    })
  }),
  excavateEventIds: new Set(['dorios:blockloot', 'dorios:hammerblock'])
});

const XP_MODES = DROP_SYSTEM_RULES.xpModes;
const RESULT_MODES = DROP_SYSTEM_RULES.resultModes;
const VANILLA_DROP_MODES = DROP_SYSTEM_RULES.vanillaDropModes;
const VALID_VANILLA_DROP_MODES = new Set(Object.values(VANILLA_DROP_MODES));
const VANILLA_LOOT_FALLBACK_MODES = DROP_SYSTEM_RULES.lootFallbackModes;
const VALID_VANILLA_LOOT_FALLBACK_MODES = new Set(Object.values(VANILLA_LOOT_FALLBACK_MODES));

function resolveXpMode(explicitMode) {
  const raw = typeof explicitMode === 'string'
    ? explicitMode
    : (typeof DROPS_SETTINGS?.xpMode === 'string' ? DROPS_SETTINGS.xpMode : 'auto');
  const mode = raw.toLowerCase();
  return XP_MODES.has(mode) ? mode : 'auto';
}

function awardXp(player, dimension, pos, xp, mode) {
  if (!Number.isFinite(xp) || xp <= 0) return;
  if (mode === 'none') return;

  if (mode === 'orb') {
    dimension?.spawnExperienceOrb?.(pos, xp);
    return;
  }

  if (mode === 'player') {
    if (typeof player?.addExperience === 'function') {
      player.addExperience(xp);
      return;
    }
    dimension?.spawnExperienceOrb?.(pos, xp);
    return;
  }

  if (typeof player?.addExperience === 'function') {
    player.addExperience(xp);
  } else {
    dimension?.spawnExperienceOrb?.(pos, xp);
  }
}

const randFloat = (min = 0, max = 1) => Math.random() * (max - min) + min;

const normalizeChance = (chance, fallback = 1) => {
  if (chance === undefined || chance === null) return fallback;
  const num = Number(chance);
  if (!Number.isFinite(num)) return fallback;
  if (num <= 0) return 0;
  return num > 1 ? num / 100 : num;
};

const rollChance = (chance, fallback = 1) => {
  const normalized = normalizeChance(chance, fallback);
  if (normalized <= 0) return false;
  if (normalized >= 1) return true;
  return randFloat(0, 1) <= normalized;
};

const normalizeEffectId = (id) => {
  if (!id) return '';
  const raw = String(id).trim();
  if (!raw) return '';
  return raw.includes(':') ? raw : `minecraft:${raw}`;
};

const resolveEffectType = (id) => {
  const normalized = normalizeEffectId(id);
  if (!normalized) return undefined;
  return EffectTypes?.get?.(normalized) ?? EffectTypes?.get?.(id) ?? normalized;
};

function getPlayerTool(player) {
  if (!player) return undefined;
  try {
    const equippable = player.getComponent?.('equippable');
    const equipped = equippable?.getEquipment?.('Mainhand');
    if (equipped) return equipped;
  } catch {
    // ignore
  }

  try {
    const inv = player.getComponent?.('inventory')?.container;
    const slot = player.selectedSlot ?? 0;
    return inv?.getItem?.(slot);
  } catch {
    return undefined;
  }
}

function parseScriptEventLocation(message) {
  if (!message || typeof message !== 'string') return null;
  const parts = message.split(',').map(part => Number(part.trim()));
  if (parts.length < 3) return null;
  const [x, y, z] = parts;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
}

function isUnbreakableBlock(block) {
  const unbreakables = globalThis?.DoriosAPI?.constants?.unbreakableBlocks;
  if (!block?.typeId || !Array.isArray(unbreakables)) return false;
  return unbreakables.includes(block.typeId);
}

function destroyBlockWithDrops(dimension, loc) {
  if (!dimension || !loc) return false;
  const x = Math.floor(loc.x);
  const y = Math.floor(loc.y);
  const z = Math.floor(loc.z);
  const command = `setblock ${x} ${y} ${z} air destroy`;
  try {
    if (typeof dimension.runCommand === 'function') {
      dimension.runCommand(command);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function resolveVanillaDropMode(bridgeSettings) {
  const rawMode = typeof bridgeSettings?.vanillaDropMode === 'string'
    ? bridgeSettings.vanillaDropMode.toLowerCase()
    : '';

  if (VALID_VANILLA_DROP_MODES.has(rawMode)) {
    return rawMode;
  }

  // Legacy fallback path
  if (bridgeSettings?.useLootTables === false) {
    return VANILLA_DROP_MODES.DESTROY_COMMAND;
  }

  return VANILLA_DROP_MODES.LOOT_TABLE;
}

function resolveVanillaLootFallbackMode(bridgeSettings) {
  const rawMode = typeof bridgeSettings?.lootTableFallback === 'string'
    ? bridgeSettings.lootTableFallback.toLowerCase()
    : '';

  if (VALID_VANILLA_LOOT_FALLBACK_MODES.has(rawMode)) {
    return rawMode;
  }

  return VANILLA_LOOT_FALLBACK_MODES.BLOCK_ITEM;
}

function resolveDropSearchRadius() {
  const configured = Number(DROPS_SETTINGS?.replaceSearchRadius);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DROP_SYSTEM_RULES.defaults.replaceSearchRadius;
}

function resolveDropSpawnOffset() {
  const configured = DROPS_SETTINGS?.dropSpawnOffset;
  const defaults = DROP_SYSTEM_RULES.defaults.dropSpawnOffset;
  const x = Number(configured?.x);
  const y = Number(configured?.y);
  const z = Number(configured?.z);
  return {
    x: Number.isFinite(x) ? x : defaults.x,
    y: Number.isFinite(y) ? y : defaults.y,
    z: Number.isFinite(z) ? z : defaults.z
  };
}

function toDropSpawnPos(loc) {
  const offset = resolveDropSpawnOffset();
  return {
    x: loc.x + offset.x,
    y: loc.y + offset.y,
    z: loc.z + offset.z
  };
}

function getNearbyItemEntities(dimension, location, maxDistance) {
  try {
    return dimension.getEntities({
      type: 'item',
      location,
      maxDistance
    });
  } catch {
    return [];
  }
}

function snapshotNearbyItemEntityIds(dimension, location, maxDistance) {
  const ids = new Set();
  for (const entity of getNearbyItemEntities(dimension, location, maxDistance)) {
    const id = entity?.id;
    if (typeof id === 'string' && id.length) {
      ids.add(id);
    }
  }
  return ids;
}

function removeNewNearbyItemEntities(dimension, location, maxDistance, knownIds) {
  let removedCount = 0;
  for (const entity of getNearbyItemEntities(dimension, location, maxDistance)) {
    const id = entity?.id;
    if (typeof id === 'string' && knownIds?.has(id)) {
      continue;
    }

    try {
      entity.remove();
      removedCount++;
    } catch {
      // ignore entity races
    }
  }
  return removedCount;
}

function buildBlockItemFallbackDrops(block) {
  if (!block?.typeId) return [];
  try {
    return [new ItemStack(block.typeId, 1)];
  } catch {
    return [];
  }
}

function generateLootTableDropsDetailed(block, blockPermutation, tool) {
  const result = {
    drops: [],
    source: 'none'
  };

  try {
    const lootManager = world.getLootTableManager?.();
    if (!lootManager) return result;

    if (blockPermutation && typeof lootManager.generateLootFromBlockPermutation === 'function') {
      const fromPermutation = lootManager.generateLootFromBlockPermutation(blockPermutation, tool);
      if (Array.isArray(fromPermutation)) {
        return {
          drops: fromPermutation.filter(Boolean),
          source: 'block_permutation'
        };
      }
    }

    if (block && typeof lootManager.generateLootFromBlock === 'function') {
      const fromBlock = lootManager.generateLootFromBlock(block, tool);
      if (Array.isArray(fromBlock)) {
        return {
          drops: fromBlock.filter(Boolean),
          source: 'block'
        };
      }
    }
  } catch (error) {
    console.warn('[drops] Failed generating loot table drops for', block?.typeId, error);
  }

  return result;
}

function normalizeDropResult(dropResult) {
  if (!dropResult) return null;

  const resolved = Array.isArray(dropResult)
    ? { mode: 'supplement', drops: dropResult, replaceVanilla: false }
    : dropResult;

  const explicitMode = typeof resolved?.mode === 'string' ? resolved.mode.toLowerCase() : '';
  const mode = RESULT_MODES.has(explicitMode)
    ? explicitMode
    : (resolved?.replaceVanilla === true
      ? 'replace'
      : (resolved?.replaceOriginalId && Array.isArray(resolved?.replaceDrops) && resolved.replaceDrops.length > 0
        ? 'vanilla'
        : 'supplement'));

  return {
    ...resolved,
    mode,
    drops: Array.isArray(resolved?.drops) ? resolved.drops.filter(Boolean) : [],
    replaceVanilla: mode === 'replace',
    replaceDrops: Array.isArray(resolved?.replaceDrops) ? resolved.replaceDrops.filter(Boolean) : []
  };
}

function wantsVanillaFlow(mode) {
  return mode === 'supplement' || mode === 'vanilla';
}

function applyReplacementToDrops(drops, replaceOriginalId, replaceDrops) {
  if (!replaceOriginalId || !replaceDrops?.length) {
    return Array.isArray(drops) ? drops.filter(Boolean) : [];
  }

  let replaced = false;
  const nextDrops = [];
  for (const stack of drops ?? []) {
    if (!stack) continue;
    if (!replaced && stack.typeId === replaceOriginalId) {
      nextDrops.push(...replaceDrops.filter(Boolean));
      replaced = true;
      continue;
    }
    nextDrops.push(stack);
  }

  return nextDrops;
}

function resolveManualVanillaDrops({ block, blockPermutation, tool, fallbackMode }) {
  const lootTableResult = generateLootTableDropsDetailed(block, blockPermutation, tool);
  if (lootTableResult.drops.length) {
    return lootTableResult;
  }

  if (fallbackMode === VANILLA_LOOT_FALLBACK_MODES.BLOCK_ITEM) {
    return {
      drops: buildBlockItemFallbackDrops(block),
      source: 'block_item_fallback'
    };
  }

  return {
    drops: [],
    source: fallbackMode === VANILLA_LOOT_FALLBACK_MODES.DESTROY_COMMAND
      ? 'destroy_command_fallback'
      : 'none'
  };
}

function resolveExcavateVanillaPlan({ block, blockPermutation, tool, dimension, loc, bridgeSettings }) {
  const fallbackMode = resolveVanillaLootFallbackMode(bridgeSettings);
  const dropSearchRadius = resolveDropSearchRadius();
  const blockCenter = toDropSpawnPos(loc);
  const manualDrops = resolveManualVanillaDrops({ block, blockPermutation, tool, fallbackMode });
  const vanillaDropMode = resolveVanillaDropMode(bridgeSettings);

  if (vanillaDropMode === VANILLA_DROP_MODES.DESTROY_COMMAND) {
    const knownNearbyItemIds = snapshotNearbyItemEntityIds(dimension, blockCenter, dropSearchRadius);
    return {
      drops: [],
      blockDestroyed: destroyBlockWithDrops(dimension, loc),
      removeBlock: false,
      removeFreshVanillaEntities: false,
      knownNearbyItemIds,
      source: 'destroy_command'
    };
  }

  if (vanillaDropMode === VANILLA_DROP_MODES.LOOT_TABLE) {
    if (manualDrops.drops.length) {
      return {
        drops: manualDrops.drops,
        blockDestroyed: false,
        removeBlock: true,
        removeFreshVanillaEntities: false,
        knownNearbyItemIds: undefined,
        source: manualDrops.source
      };
    }

    if (fallbackMode === VANILLA_LOOT_FALLBACK_MODES.DESTROY_COMMAND) {
      const knownNearbyItemIds = snapshotNearbyItemEntityIds(dimension, blockCenter, dropSearchRadius);
      return {
        drops: [],
        blockDestroyed: destroyBlockWithDrops(dimension, loc),
        removeBlock: false,
        removeFreshVanillaEntities: false,
        knownNearbyItemIds,
        source: 'destroy_command_fallback'
      };
    }

    return {
      drops: [],
      blockDestroyed: false,
      removeBlock: true,
      removeFreshVanillaEntities: false,
      knownNearbyItemIds: undefined,
      source: manualDrops.source
    };
  }

  const knownNearbyItemIds = snapshotNearbyItemEntityIds(dimension, blockCenter, dropSearchRadius);
  const blockDestroyed = destroyBlockWithDrops(dimension, loc);
  if (!blockDestroyed) {
    return {
      drops: manualDrops.drops,
      blockDestroyed: false,
      removeBlock: true,
      removeFreshVanillaEntities: false,
      knownNearbyItemIds: undefined,
      source: manualDrops.source
    };
  }

  return {
    drops: manualDrops.drops,
    blockDestroyed: true,
    removeBlock: false,
    removeFreshVanillaEntities: manualDrops.drops.length > 0 && bridgeSettings?.removeFreshVanillaDrops !== false,
    knownNearbyItemIds,
    source: manualDrops.source
  };
}

function executeDropActions({
  block,
  blockId,
  dimension,
  player,
  loc,
  drops,
  replaceVanilla,
  removeBlock,
  sound,
  baseSound,
  omitSpecialSound,
  suppressVanillaSound,
  particles,
  statusEffects,
  xp,
  xpMode,
  commands,
  commandTarget,
  replaceOriginalId,
  replaceDrops,
  removeFreshVanillaEntities,
  removeVanillaEntities,
  knownNearbyItemIds
}) {
  if (!dimension || !loc) return;

  system.run(() => {
    const resolvedSound = omitSpecialSound ? baseSound : (sound ?? baseSound);

    if (removeBlock) {
      try {
        if (typeof dimension.setBlockType === 'function') {
          dimension.setBlockType(loc, 'minecraft:air');
        } else if (block?.setType) {
          block.setType('minecraft:air');
        } else {
          const fallback = dimension.getBlock?.(loc);
          fallback?.setType?.('minecraft:air');
        }
      } catch (error) {
        console.warn('[drops] Failed setting block to air for', blockId, error);
      }

      if (replaceVanilla && !resolvedSound && !suppressVanillaSound) {
        dimension.playSound?.('dig.deepslate', loc);
      }
    }

    const pos = toDropSpawnPos(loc);
    if (resolvedSound) {
      const soundId = typeof resolvedSound === 'string' ? resolvedSound : resolvedSound?.id;
      const hasOptions = typeof resolvedSound === 'object' && resolvedSound !== null;
      const options = hasOptions ? { volume: resolvedSound.volume, pitch: resolvedSound.pitch } : undefined;

      if (soundId) {
        try {
          if (options) {
            dimension.playSound?.(soundId, pos, options);
          } else {
            dimension.playSound?.(soundId, pos);
          }
        } catch (error) {
          console.warn('[drops] Failed playing sound for', blockId, error);
        }
      }
    }

    if (Number.isFinite(xp) && xp > 0) {
      try {
        awardXp(player, dimension, pos, xp, xpMode);
      } catch (error) {
        console.warn('[drops] Failed awarding XP for', blockId, error);
      }
    }

    if (statusEffects?.length) {
      for (const effect of statusEffects) {
        if (!effect?.id) continue;
        if (!rollChance(effect.chance, 1)) continue;
        const duration = Math.max(1, Math.floor(effect.duration ?? 0));
        if (duration <= 0) continue;

        const amp = Math.max(0, Math.floor(effect.amplifier ?? 0));
        const effectType = resolveEffectType(effect.id);
        if (!effectType) continue;
        try {
          player.addEffect(effectType, duration, {
            amplifier: amp,
            showParticles: effect.showParticles !== false
          });
        } catch (error) {
          console.warn('[drops] Failed applying effect for', blockId, error);
        }
      }
    }

    if (particles?.length && typeof dimension.spawnParticle === 'function') {
      for (const particle of particles) {
        if (!particle?.id) continue;
        if (!rollChance(particle.chance, 1)) continue;

        const count = Math.max(1, Math.floor(particle.count ?? 1));
        const offset = particle.offset ?? { x: 0, y: 0, z: 0 };
        const spread = Math.max(0, Number(particle.spread ?? 0));

        for (let i = 0; i < count; i++) {
          const fx = spread ? randFloat(-spread, spread) : 0;
          const fy = spread ? randFloat(-spread, spread) : 0;
          const fz = spread ? randFloat(-spread, spread) : 0;
          const spawnPos = {
            x: pos.x + (offset.x ?? 0) + fx,
            y: pos.y + (offset.y ?? 0) + fy,
            z: pos.z + (offset.z ?? 0) + fz
          };

          try {
            dimension.spawnParticle(particle.id, spawnPos);
          } catch (error) {
            console.warn('[drops] Failed spawning particle for', blockId, error);
            break;
          }
        }
      }
    }

    if (commands?.length) {
      const runner = commandTarget === 'player'
        ? player?.runCommand?.bind(player)
        : dimension?.runCommand?.bind(dimension);

      if (typeof runner === 'function') {
        for (const cmd of commands) {
          if (!cmd || typeof cmd !== 'string') continue;
          try {
            runner(cmd);
          } catch (error) {
            console.warn('[drops] Failed running command for', blockId, error);
          }
        }
      }
    }

    const maxDistance = resolveDropSearchRadius();

    if (removeFreshVanillaEntities && knownNearbyItemIds?.size) {
      try {
        removeNewNearbyItemEntities(dimension, pos, maxDistance, knownNearbyItemIds);
      } catch (error) {
        console.warn('[drops] Failed clearing transient vanilla drops for', blockId, error);
      }
    }

    if (removeVanillaEntities && replaceOriginalId && replaceDrops?.length) {
      let removedOriginalDrop = false;
      try {
        const candidates = dimension.getEntities({
          type: 'item',
          maxDistance,
          location: pos
        });
        for (const entity of candidates) {
          const entityId = entity?.id;
          if (typeof entityId === 'string' && knownNearbyItemIds?.has(entityId)) {
            continue;
          }

          const item = entity?.getComponent('minecraft:item')?.itemStack;
          if (item?.typeId === replaceOriginalId) {
            entity.remove();
            removedOriginalDrop = true;
          }
        }
      } catch (error) {
        console.warn('[drops] Failed replacing vanilla drops for', blockId, error);
      }

      if (removedOriginalDrop) {
        for (const stack of replaceDrops) {
          if (!stack) continue;
          try {
            dimension.spawnItem(stack, pos);
          } catch (error) {
            console.warn('[drops] Failed spawning replacement drop for', blockId, error);
          }
        }
      }
    }

    for (const stack of drops ?? []) {
      if (!stack) continue;
      try {
        dimension.spawnItem(stack, pos);
      } catch (error) {
        console.warn('[drops] Failed spawning drop for', blockId, error);
      }
    }
  });
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const { block, player, dimension, itemStack } = event;
  if (!block || !player) {
    console.warn('[drops] Missing block or player in event:', event);
    return;
  }
  if (player.isInCreative?.() === true || player.getGameMode?.()?.toLowerCase() === 'creative') {
    return; // No drops in Creative mode
  }

  
  const blockId = block.typeId;
  const inv = player.getComponent('inventory')?.container;
  const slot = player.selectedSlot ?? 0;
  const tool = itemStack ?? inv?.getItem(slot);
  // if there's no tag on the tool, it's likely hand/mining without tool

  const { fortuneLevel, hasSilkTouch } = getEnchantData(tool);

  const dropResult = getDropsForBlock({
    block,
    player,
    dimension,
    tool,
    fortuneLevel,
    hasSilkTouch,
  });

  if (!dropResult) {
    return; // Not a managed block
  }

  const resolved = normalizeDropResult(dropResult);

  const drops = resolved?.drops ?? [];
  const mode = resolved?.mode ?? 'supplement';
  const replaceVanilla = Boolean(resolved?.replaceVanilla);
  const replaceOriginalId = resolved?.replaceOriginalId;
  const replaceDrops = resolved?.replaceDrops ?? [];
  const sound = resolved?.sound;
  const baseSound = resolved?.baseSound;
  const omitSpecialSound = Boolean(resolved?.omitSpecialSound);
  const suppressVanillaSound = Boolean(resolved?.suppressVanillaSound);
  const particles = resolved?.particles ?? [];
  const statusEffects = resolved?.statusEffects ?? [];
  const xp = resolved?.xp;
  const xpMode = resolveXpMode(resolved?.xpMode);
  const commands = resolved?.commands ?? [];
  const commandTarget = resolved?.commandTarget ?? 'dimension';

  const hasDrops = drops.length > 0;
  const shouldReplaceOriginal = mode === 'vanilla' && Boolean(replaceOriginalId) && replaceDrops.length > 0;
  const dropSearchRadius = resolveDropSearchRadius();
  const blockCenter = toDropSpawnPos(block.location);
  const knownItemEntityIds = shouldReplaceOriginal
    ? snapshotNearbyItemEntityIds(dimension, blockCenter, dropSearchRadius)
    : undefined;
  const hasExtras = Boolean(
    baseSound || sound ||
    particles.length ||
    statusEffects.length ||
    commands.length ||
    (Number.isFinite(xp) && xp > 0)
  );

  if (!hasDrops && !hasExtras && !shouldReplaceOriginal) {
    return;
  }

  if (replaceVanilla) {
    event.cancel = true;
  }

  executeDropActions({
    block,
    blockId,
    dimension,
    player,
    loc: { ...block.location },
    drops,
    replaceVanilla,
    removeBlock: replaceVanilla,
    sound,
    baseSound,
    omitSpecialSound,
    suppressVanillaSound,
    particles,
    statusEffects,
    xp,
    xpMode,
    commands,
    commandTarget,
    replaceOriginalId,
    replaceDrops,
    removeFreshVanillaEntities: false,
    removeVanillaEntities: shouldReplaceOriginal,
    knownNearbyItemIds: knownItemEntityIds
  });
});

const EXCAVATE_EVENT_IDS = DROP_SYSTEM_RULES.excavateEventIds;

const scriptEventSignal =
  world.afterEvents?.scriptEventReceive ??
  world.afterEvents?.scriptEventReceived ??
  world.afterEvents?.scriptEvent;

if (!scriptEventSignal?.subscribe) {
  console.warn('[drops] ScriptEventReceive not available; Excavate bridge disabled.');
} else scriptEventSignal.subscribe((event) => {
  const bridgeSettings = DROPS_SETTINGS?.excavateBridge;
  if (bridgeSettings?.enabled === false) return;

  const eventId = String(event?.id ?? '').toLowerCase();
  if (!EXCAVATE_EVENT_IDS.has(eventId)) return;

  const player = event?.sourceEntity;
  if (!player) return;

  if (player.isInCreative?.() === true || player.getGameMode?.()?.toLowerCase() === 'creative') {
    return;
  }

  const loc = parseScriptEventLocation(event?.message);
  if (!loc) return;

  const dimension = player?.dimension;
  if (!dimension) return;

  let block;
  try {
    block = dimension.getBlock(loc);
  } catch {
    return;
  }

  if (!block || block.typeId === 'minecraft:air') return;
  if (isUnbreakableBlock(block)) return;

  const blockId = block.typeId;
  const blockLoc = { ...block.location };
  let blockPermutation;
  try {
    blockPermutation = block.permutation;
  } catch {
    blockPermutation = undefined;
  }

  const tool = getPlayerTool(player);
  const { fortuneLevel, hasSilkTouch } = getEnchantData(tool);

  const dropResult = getDropsForBlock({
    block,
    player,
    dimension,
    tool,
    fortuneLevel,
    hasSilkTouch,
  });

  const resolved = normalizeDropResult(dropResult);
  const mode = resolved?.mode ?? 'supplement';
  const replaceVanilla = Boolean(resolved?.replaceVanilla);
  const replaceOriginalId = resolved?.replaceOriginalId;
  const replaceDrops = resolved?.replaceDrops ?? [];
  const sound = resolved?.sound;
  const baseSound = resolved?.baseSound;
  const omitSpecialSound = Boolean(resolved?.omitSpecialSound);
  const suppressVanillaSound = Boolean(resolved?.suppressVanillaSound);
  const particles = resolved?.particles ?? [];
  const statusEffects = resolved?.statusEffects ?? [];
  const xp = resolved?.xp;
  const xpMode = resolveXpMode(resolved?.xpMode);
  const commands = resolved?.commands ?? [];
  const commandTarget = resolved?.commandTarget ?? 'dimension';

  const hasReplacement = mode === 'vanilla' && Boolean(replaceOriginalId) && replaceDrops.length > 0;
  const shouldRunVanillaFlow = !resolved || wantsVanillaFlow(mode);
  const vanillaPlan = shouldRunVanillaFlow
    ? resolveExcavateVanillaPlan({ block, blockPermutation, tool, dimension, loc, bridgeSettings })
    : {
        drops: [],
        blockDestroyed: false,
        removeBlock: false,
        removeFreshVanillaEntities: false,
        knownNearbyItemIds: undefined,
        source: 'none'
      };

  if (!resolved) {
    if (vanillaPlan.drops.length || vanillaPlan.removeBlock || vanillaPlan.removeFreshVanillaEntities) {
      executeDropActions({
        block,
        blockId,
        dimension,
        player,
        loc: blockLoc,
        drops: vanillaPlan.drops.filter(Boolean),
        replaceVanilla: false,
        removeBlock: vanillaPlan.removeBlock,
        sound: undefined,
        baseSound: undefined,
        omitSpecialSound: false,
        suppressVanillaSound: false,
        particles: [],
        statusEffects: [],
        xp: undefined,
        xpMode,
        commands: [],
        commandTarget: 'dimension',
        replaceOriginalId: undefined,
        replaceDrops: [],
        removeFreshVanillaEntities: vanillaPlan.removeFreshVanillaEntities,
        removeVanillaEntities: false,
        knownNearbyItemIds: vanillaPlan.knownNearbyItemIds
      });
    } else if (!vanillaPlan.blockDestroyed) {
      destroyBlockWithDrops(dimension, loc);
    }
    return;
  }

  let drops = [];
  const vanillaDrops = hasReplacement
    ? applyReplacementToDrops(vanillaPlan.drops, replaceOriginalId, replaceDrops)
    : vanillaPlan.drops;
  if (vanillaDrops.length) drops.push(...vanillaDrops);
  if (resolved?.drops?.length) drops.push(...resolved.drops);
  drops = drops.filter(Boolean);
  const shouldReplaceVanillaEntities = hasReplacement && vanillaPlan.blockDestroyed && vanillaDrops.length === 0;

  executeDropActions({
    block,
    blockId,
    dimension,
    player,
    loc: blockLoc,
    drops,
    replaceVanilla,
    removeBlock: replaceVanilla ? true : vanillaPlan.removeBlock,
    sound,
    baseSound,
    omitSpecialSound,
    suppressVanillaSound,
    particles,
    statusEffects,
    xp,
    xpMode,
    commands,
    commandTarget,
    replaceOriginalId,
    replaceDrops,
    removeFreshVanillaEntities: vanillaPlan.removeFreshVanillaEntities,
    removeVanillaEntities: shouldReplaceVanillaEntities,
    knownNearbyItemIds: vanillaPlan.knownNearbyItemIds
  });
});

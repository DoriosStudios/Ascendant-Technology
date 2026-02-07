import { world, system, EffectTypes } from '@minecraft/server';
import './drops.js'; // ensures DoriosAPI is available globally when main.js loads
import { getDropsForBlock } from './drops.js';

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

  const resolved = Array.isArray(dropResult)
    ? { drops: dropResult, replaceVanilla: false }
    : dropResult;

  const drops = resolved?.drops ?? [];
  const replaceVanilla = Boolean(resolved?.replaceVanilla);
  const replaceOriginalId = resolved?.replaceOriginalId;
  const replaceDrops = Array.isArray(resolved?.replaceDrops) ? resolved.replaceDrops : [];
  const sound = resolved?.sound;
  const baseSound = resolved?.baseSound;
  const omitSpecialSound = Boolean(resolved?.omitSpecialSound);
  const suppressVanillaSound = Boolean(resolved?.suppressVanillaSound);
  const particles = resolved?.particles ?? [];
  const statusEffects = resolved?.statusEffects ?? [];
  const xp = resolved?.xp;
  const commands = resolved?.commands ?? [];
  const commandTarget = resolved?.commandTarget ?? 'dimension';

  const hasDrops = drops.length > 0;
  const shouldReplaceOriginal = !replaceVanilla && Boolean(replaceOriginalId) && replaceDrops.length > 0;
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

  // Inject custom drops, optionally replacing vanilla drops.
  const loc = { ...block.location };
  system.run(() => {
    const resolvedSound = omitSpecialSound ? baseSound : (sound ?? baseSound);

    if (replaceVanilla) {
      dimension.setBlockType(loc, 'minecraft:air');
      if (!resolvedSound && !suppressVanillaSound) {
        dimension.playSound('dig.deepslate', loc);
      }
    }

    const pos = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
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
        if (typeof player.addExperience === 'function') {
          player.addExperience(xp);
        } else if (typeof dimension.spawnExperienceOrb === 'function') {
          dimension.spawnExperienceOrb(pos, xp);
        }
      } catch (error) {
        console.warn('[drops] Failed awarding XP for', blockId, error);
      }
    }

    if (statusEffects.length) {
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

    if (particles.length && typeof dimension.spawnParticle === 'function') {
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

    if (commands.length) {
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

    if (shouldReplaceOriginal) {
      try {
        const candidates = dimension.getEntities({
          type: 'item',
          maxDistance: 2.5,
          location: pos
        });
        for (const entity of candidates) {
          const item = entity?.getComponent('minecraft:item')?.itemStack;
          if (item?.typeId === replaceOriginalId) {
            entity.remove();
          }
        }
      } catch (error) {
        console.warn('[drops] Failed replacing vanilla drops for', blockId, error);
      }

      for (const stack of replaceDrops) {
        if (!stack) continue;
        try {
          dimension.spawnItem(stack, pos);
        } catch (error) {
          console.warn('[drops] Failed spawning replacement drop for', blockId, error);
        }
      }
    }

    for (const stack of drops) {
      if (!stack) continue;
      try {
        dimension.spawnItem(stack, pos);
      } catch (error) {
        console.warn('[drops] Failed spawning drop for', blockId, error);
      }
    }
  });
});

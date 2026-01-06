import { world, system } from '@minecraft/server';
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

  const drops = getDropsForBlock({
    block,
    player,
    dimension,
    tool,
    fortuneLevel,
    hasSilkTouch,
  });

  if (!drops || drops.length === 0) {
    return; // Not a managed block
  }

  // Let the block break naturally (do not cancel). Just inject custom drops.
  const loc = { ...block.location };
  system.run(() => {
    const pos = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
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

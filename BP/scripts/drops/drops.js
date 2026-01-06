import { ItemStack } from '@minecraft/server';


/**
 * Registry of custom drop behaviors by block identifier.
 *
 * Each entry receives a DropContext and returns an array of ItemStacks to spawn.
 */
export const DROPS_LIBRARY = {
  /** Deepslate Aetherium Ore (drops reduced to roughly half). */
  'utilitycraft:deepslate_aetherium_ore': (ctx) => computeDrops(ctx, {
    dropId: 'utilitycraft:aetherium_shard',
    silkDropId: 'utilitycraft:deepslate_aetherium_ore',
    baseRange: [1, 1],
    fortuneMath: { mode: 'multiplier', perLevel: [0.2, 0.4] },
  }),

  /** End Aetherium Ore (higher yield). */
  'utilitycraft:end_aetherium_ore': (ctx) => computeDrops(ctx, {
    dropId: 'utilitycraft:aetherium_shard',
    silkDropId: 'utilitycraft:end_aetherium_ore',
    baseRange: [1, 1],
    // Use math-based scaling here for a smoother curve
    fortuneMath: { mode: 'multiplier', perLevel: [0.5, 0.6] }
  }),

  /** Deepslate Titanium Ore. */
  'utilitycraft:deepslate_titanium_ore': (ctx) => computeDrops(ctx, {
    dropId: 'utilitycraft:raw_titanium',
    silkDropId: 'utilitycraft:deepslate_titanium_ore',
    baseRange: [1, 1],
    fortuneMath: { mode: 'bonus', perLevel: [0.6, 1], cap: [10, 14] },
    specialTools: [
      {
        toolId: 'utilitycraft:smelting_pickaxe',
        dropId: 'utilitycraft:titanium',
        fortuneMath: { mode: 'multiplier', perLevel: [0.2, 0.25], cap: [12, 16] },
        baseRange: [1, 1],
      },
      {
        toolType: 'utilitycraft:is_hammer',
        dropId: 'utilitycraft:titanium_nugget',
        fortuneMath: { mode: 'bonus', perLevel: [1, 1.5], cap: [12, 16] },
        baseRange: [1, 1],
      }
    ],
  }),
};

const toolFetchedTags = new Set([
  'minecraft:is_pickaxe',
  'minecraft:is_axe',
  'minecraft:is_shovel',
  'minecraft:is_hoe',
  'minecraft:is_sword',
  'utilitycraft:is_aiot',
  'utilitycraft:is_hammer',
  'utilitycraft:is_paxel'
]);

// Safe random helper: uses DoriosAPI.randomInterval when available, else a local inclusive random int.
const randInt = (min, max) => {
  const apiRand = globalThis?.DoriosAPI?.randomInterval;
  if (typeof apiRand === 'function') return apiRand(min, max);
  const minCeil = Math.ceil(min);
  const maxFloor = Math.floor(max);
  return Math.floor(Math.random() * (maxFloor - minCeil + 1)) + minCeil;
};

/**
 * @typedef {Object} DropContext
 * @property {import('@minecraft/server').Block} block - Block being broken.
 * @property {import('@minecraft/server').Player} player - Player who broke the block.
 * @property {import('@minecraft/server').Dimension} dimension - Dimension where the block exists.
 * @property {import('@minecraft/server').ItemStack | undefined} tool - Tool used to break.
 * @property {number} fortuneLevel - Fortune level on the tool (0 if none).
 * @property {boolean} hasSilkTouch - Whether the tool has Silk Touch.
 */

/**
 * @typedef {Object} FortuneTier
 * @property {number} level - Exact fortune level this tier covers (falls through if above max defined).
 * @property {[number, number]} range - Inclusive min/max drop range for this level.
 */

/**
 * @typedef {Object} DropEntry
 * @property {string} dropId - Item identifier to drop when not silk touch.
 * @property {string} silkDropId - Item identifier to drop when silk touch is present (usually the block itself).
 * @property {[number, number]} baseRange - Drop range when Fortune = 0.
 * @property {string|string[]=} toolType - Optional required tool tag (or tags) to allow the drop. If defined and the tool doesn't have the tag, no drop is produced.
 * @property {FortuneTier[]=} fortuneTiers - Ordered list of fortune tiers. If omitted, fortuneMath is used.\
 * Each entry defines (`level`, `min`, `max`) drops for the exact fortune level.
 * Only recommended for sparse or highly custom tiers. For smoother scaling, use fortuneMath instead. 
 * - Example:
 * ```JS
 * 
 *    fortuneTiers:{
 *      tier(1, 1, 2), // Fortune I gives 1-2 drops
 *    }
 * 
 * ```

 * @property {FortuneMath=} fortuneMath - Dynamic formula when tiers are omitted.
 * @property {SpecialToolOverride[]=} specialTools - Per-tool override configs.
 */

/**
 * @typedef {Object} FortuneMath
 * @property {'multiplier'|'bonus'} mode - How to scale drops.
 * @property {[number, number]} perLevel - For mode multiplier: factor added per level (e.g., 0.25 adds +25% per level). For bonus: flat added per level.
 * @property {[number, number]=} cap - Optional cap for [min, max] after scaling.
 */

/**
 * @typedef {Object} SpecialToolOverride
 * @property {string} toolId - Item typeId to match (exact).
 * @property {string=} dropId - Override dropId for the block when using this tool.
 * @property {string=} silkDropId - Override silkDropId for the block when using this tool.
 * @property {[number, number]=} baseRange - Override baseRange for the special tool. Default = [1,1].
 * @property {FortuneTier[]=} fortuneTiers - Override fortuneTiers for the special tool. If omitted, `fortuneMath` is used. \
 * Follows [`min`, `max`, `level`] structure.
 * @property {FortuneMath=} fortuneMath - Override fortuneMath. 
 * @property {string|string[]=} toolType - Optional tag requirement for this override. When provided, the tool must match BOTH toolId (if set) and toolType.
 */

/**
 * Resolve how many items to drop based on fortune tiers.
 * @param {DropEntry} config
 * @param {number} fortuneLevel
 * @returns {number}
 */
function resolveAmount(config, fortuneLevel) {
  const lvl = Number.isFinite(fortuneLevel) ? fortuneLevel : 0;

  if (!config?.fortuneTiers?.length) {
    // Use dynamic fortune math if provided
    if (config?.fortuneMath) {
      const [baseMin, baseMax] = config.baseRange;
      const { mode, perLevel, cap } = config.fortuneMath;
      const [dMin, dMax] = perLevel ?? [0, 0];
      let min = baseMin;
      let max = baseMax;
      if (mode === 'multiplier') {
        min = baseMin * (1 + dMin * lvl);
        max = baseMax * (1 + dMax * lvl);
      } else if (mode === 'bonus') {
        min = baseMin + dMin * lvl;
        max = baseMax + dMax * lvl;
      }
      if (cap) {
        const [cMin, cMax] = cap;
        min = Math.min(min, cMin ?? min);
        max = Math.min(max, cMax ?? max);
      }
      return randInt(Math.max(1, Math.floor(min)), Math.max(1, Math.floor(max)));
    }

    const [min, max] = config.baseRange;
    return randInt(min, max);
  }

  const tiers = config.fortuneTiers;
  const exact = tiers.find(t => t.level === lvl);

  // Fortune below first defined tier → use baseRange
  if (!exact && lvl < tiers[0].level) {
    const [min, max] = config.baseRange;
    return randInt(min, max);
  }

  // Above max defined → clamp to last tier
  const tier = exact ?? tiers[tiers.length - 1];
  const [min, max] = tier?.range ?? config.baseRange;
  return randInt(min, max);
}

/**
 * Compute drops for a block using the provided config.
 * @param {DropContext} ctx
 * @param {DropEntry} config
 * @returns {ItemStack[]}
 */
function computeDrops(ctx, config) {
  // If the base config demands a specific tool type, enforce it before anything else
  if (config.toolType && !toolMatchesType(ctx.tool, config.toolType)) {
    return [];
  }

  // Apply special tool override if present
  if (ctx.tool && config.specialTools?.length) {
    const match = findSpecialToolOverride(ctx.tool, config.specialTools);
    if (match) {
      config = { ...config, ...match };
    }
  }

  if (ctx.hasSilkTouch) {
    return [new ItemStack(config.silkDropId, 1)];
  }

  const amount = resolveAmount(config, ctx.fortuneLevel);
  return [new ItemStack(config.dropId, amount)];
}

// Shared fortune table helper
function tier(level, min, max) {
  return { level, range: [min, max] };
}

function getTagsFromTool(tool) {
  if (!tool) return [];
  try {
    const rawToolTags = tool.getTags?.() ?? [];
    return rawToolTags.filter(t => toolFetchedTags.has(t));
  } catch {
    return [];
  }
}

/**
 * Checks whether the provided tool satisfies a required tool type (tag).
 * Accepts a single string tag or an array of tags; matches if ANY required tag is present.
 * @param {import('@minecraft/server').ItemStack | undefined} tool
 * @param {string|string[]=} requiredType
 * @returns {boolean}
 */
function toolMatchesType(tool, requiredType) {
  if (!requiredType) return true;
  const toolTags = getTagsFromTool(tool);
  if (!toolTags.length) return false;

  if (Array.isArray(requiredType)) {
    return requiredType.some(tag => toolTags.includes(tag));
  }
  return toolTags.includes(requiredType);
}

/**
 * Finds a matching special tool override by toolId and/or toolType.
 * If both are present on an override, both must match.
 * @param {import('@minecraft/server').ItemStack | undefined} tool
 * @param {SpecialToolOverride[]=} overrides
 * @returns {SpecialToolOverride | undefined}
 */
function findSpecialToolOverride(tool, overrides) {
  if (!tool || !overrides?.length) return undefined;
  return overrides.find((override) => {
    if (override.toolId && override.toolId !== tool.typeId) return false;
    if (override.toolType && !toolMatchesType(tool, override.toolType)) return false;
    return true;
  });
}

/**
 * Attempts to get an ItemStack array for the given block id.
 * @param {DropContext} ctx
 * @returns {ItemStack[] | null}
 */
export function getDropsForBlock(ctx) {
  const handler = DROPS_LIBRARY[ctx.block.typeId];
  if (!handler) return null;
  return handler(ctx) ?? null;
}

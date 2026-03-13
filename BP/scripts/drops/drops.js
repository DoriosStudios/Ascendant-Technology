/// <reference path="./drops_guide.js" />
import { ItemStack, world } from '@minecraft/server';
export { DROPS_PARTICLES, particle } from './particle_catalog.js';

export const DROPS_SETTINGS = {
	xpMode: 'auto',
	replaceSearchRadius: 2.5,
	excavateBridge: {
		enabled: true,
		// Modes: 'loot_table' | 'destroy_command' | 'break_then_regen_loot_table'
		vanillaDropMode: 'loot_table',
		// Legacy compatibility fallback.
		useLootTables: true
	}
};

/**
 * Registry of custom drop behaviors by block identifier.
 *
 * Each entry receives a DropContext and returns an array of ItemStacks to spawn.
 */
/** @type {Record<string, DropHandler>} */
export const DROPS_LIBRARY = {
	/** Deepslate Aetherium Ore (drops reduced to roughly half). */
	'utilitycraft:deepslate_aetherium_ore': (context) => computeDrops(context, {
		dropId: 'utilitycraft:aetherium_shard',
		silkDropId: 'utilitycraft:deepslate_aetherium_ore',
		baseRange: [1, 1],
		dropMode: 'vanilla',
		originalDropId: 'utilitycraft:aetherium_shard', // translating from loot_tables to custom drop
		replaceDropId: 'utilitycraft:aetherium_shard',
		fortuneMath: { mode: 'multiplier', perLevel: [0.2, 0.5] },
	}),

	/** End Aetherium Ore (higher yield). */
	'utilitycraft:end_aetherium_ore': (context) => computeDrops(context, {
		dropId: 'utilitycraft:aetherium_shard',
		silkDropId: 'utilitycraft:end_aetherium_ore',
		baseRange: [1, 1],
		dropMode: 'vanilla',
		originalDropId: 'utilitycraft:aetherium_shard', // translating from loot_tables to custom drop
		replaceDropId: 'utilitycraft:aetherium_shard',
		// Use math-based scaling here for a smoother curve
		fortuneMath: { mode: 'multiplier', perLevel: [0.5, 0.75] }
	}),

	/** Deepslate Titanium Ore. */
	'utilitycraft:deepslate_titanium_ore': (context) => computeDrops(context, {
		dropId: 'utilitycraft:raw_titanium',
		silkDropId: 'utilitycraft:deepslate_titanium_ore',
		baseSound: { id: 'dig.deepslate', volume: 1, pitch: 1 },
		suppressVanillaSound: false,
		baseRange: [1, 1],
		dropMode: 'vanilla',
		originalDropId: 'utilitycraft:raw_titanium', // translating from loot_tables to custom drop
		replaceDropId: 'utilitycraft:raw_titanium',
		fortuneMath: { mode: 'bonus', perLevel: [0.6, 1] },
		specialTools: [
			{
				toolId: 'utilitycraft:smelting_pickaxe',
				dropId: 'utilitycraft:titanium',
				dropMode: 'vanilla',
				originalDropId: 'utilitycraft:raw_titanium',
				replaceDropId: 'utilitycraft:titanium',
				fortuneMath: { mode: 'multiplier', perLevel: [0.25, 2] },
				baseRange: [1, 1],
				sound: { id: 'random.fizz', volume: 0.65, pitch: 1.5 },
				xp: [2, 5],
			},
			{
				toolType: 'utilitycraft:is_hammer',
				dropId: 'utilitycraft:titanium_nugget',
				dropMode: 'vanilla',
				originalDropId: 'utilitycraft:raw_titanium',
				replaceDropId: 'utilitycraft:titanium_nugget',
				fortuneMath: { mode: 'bonus', perLevel: [1, 3] },
				baseRange: [5, 12],
				sound: { id: 'dig.netherrack', volume: 1, pitch: 0.5 },
			}
		],
	}),
	'utilitycraft:raw_titanium_block': (context) => computeDrops(context, {
		specialTools: [
			{
				toolId: 'utilitycraft:smelting_pickaxe',
				dropId: 'utilitycraft:titanium_block',
				silkDropId: 'utilitycraft:raw_titanium_block',
				dropMode: 'vanilla',
				originalDropId: 'utilitycraft:raw_titanium_block',
				replaceDropId: 'utilitycraft:titanium_block',
				baseRange: [1, 1],
				sound: { id: 'random.fizz', volume: 0.65, pitch: 1.5 },
			}
		]
	})
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

const toolTagCache = new Map();

const normalizeRequiredTags = (requiredType) => {
	if (!requiredType) return [];
	if (Array.isArray(requiredType)) return requiredType.map(tag => String(tag));
	return [String(requiredType)];
};

// Safe random helper: uses DoriosAPI.randomInterval when available, else a local inclusive random int.
const randInt = (min, max) => {
	const apiRand = globalThis?.DoriosAPI?.randomInterval;
	if (typeof apiRand === 'function') return apiRand(min, max);
	const minCeil = Math.ceil(min);
	const maxFloor = Math.floor(max);
	return Math.floor(Math.random() * (maxFloor - minCeil + 1)) + minCeil;
};

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

const normalizeRange = (value, fallback = [1, 1]) => {
	if (Array.isArray(value)) {
		const min = Number(value[0]);
		const max = Number(value[1] ?? value[0]);
		if (Number.isFinite(min) && Number.isFinite(max)) {
			return [Math.min(min, max), Math.max(min, max)];
		}
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return [value, value];
	}

	if (value && typeof value === 'object') {
		const min = Number(value.min ?? value.minimum ?? value[0]);
		const max = Number(value.max ?? value.maximum ?? value[1] ?? min);
		if (Number.isFinite(min) && Number.isFinite(max)) {
			return [Math.min(min, max), Math.max(min, max)];
		}
	}

	return fallback;
};

// Tipos movidos para drops_guide.js (IntelliSense).

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

function resolveExtraDrops(config, fortuneLevel) {
	if (!config?.extraDrops?.length) return [];

	const drops = [];
	for (const entry of config.extraDrops) {
		if (!entry?.dropId) continue;
		if (!rollChance(entry.chance, 1)) continue;

		const baseRange = normalizeRange(entry.amountRange ?? entry.amount ?? [1, 1]);
		const amount = resolveAmount({
			baseRange,
			fortuneMath: entry.fortuneMath,
			fortuneTiers: entry.fortuneTiers
		}, fortuneLevel);

		if (amount <= 0) continue;
		drops.push(new ItemStack(entry.dropId, amount));
	}

	return drops;
}

function resolveXpAmount(xp) {
	if (xp === undefined || xp === null) return undefined;
	const range = normalizeRange(xp, [0, 0]);
	const amount = randInt(range[0], range[1]);
	return amount > 0 ? amount : undefined;
}

const normalizeList = (value) => {
	if (Array.isArray(value)) return value.map(v => String(v).toLowerCase());
	if (value === undefined || value === null) return [];
	return [String(value).toLowerCase()];
};

const normalizeDimensionId = (id) => {
	if (!id) return '';
	const raw = String(id).toLowerCase();
	return raw.replace('minecraft:', '');
};

function getBiomeId(dimension, location) {
	if (!dimension || !location) return '';
	try {
		const biome = dimension.getBiome?.(location);
		const id = biome?.id ?? biome?.typeId ?? biome?.identifier;
		return id ? String(id).toLowerCase() : '';
	} catch {
		return '';
	}
}

function matchesConditions(ctx, conditions) {
	if (!conditions) return true;

	const block = ctx.block;
	const player = ctx.player;
	const dimension = ctx.dimension;

	if (conditions.dimension) {
		const allowed = normalizeList(conditions.dimension).map(normalizeDimensionId);
		const current = normalizeDimensionId(dimension?.id ?? dimension?.typeId ?? dimension?.dimensionId);
		if (allowed.length && !allowed.includes(current)) return false;
	}

	if (conditions.timeRange && typeof world?.getTimeOfDay === 'function') {
		const [min, max] = normalizeRange(conditions.timeRange, [0, 23999]);
		const time = world.getTimeOfDay();
		if (Number.isFinite(time)) {
			const t = ((time % 24000) + 24000) % 24000;
			const inRange = min <= max ? (t >= min && t <= max) : (t >= min || t <= max);
			if (!inRange) return false;
		}
	}

	if (conditions.biome) {
		const biomeId = getBiomeId(dimension, block?.location);
		const allowed = normalizeList(conditions.biome);
		if (!biomeId || !allowed.includes(biomeId)) return false;
	}

	if (conditions.playerSneaking !== undefined) {
		const sneaking = Boolean(player?.isSneaking);
		if (sneaking !== Boolean(conditions.playerSneaking)) return false;
	}

	if (conditions.playerGameMode) {
		const modes = normalizeList(conditions.playerGameMode);
		const mode = player?.getGameMode?.()?.toLowerCase?.() ?? '';
		if (modes.length && !modes.includes(mode)) return false;
	}

	if (conditions.toolType) {
		if (!toolMatchesType(ctx.tool, conditions.toolType)) return false;
	}

	if (conditions.blockStates && block?.permutation) {
		for (const [key, expected] of Object.entries(conditions.blockStates)) {
			try {
				const value = block.permutation.getState(key);
				if (value !== expected) return false;
			} catch {
				return false;
			}
		}
	}

	return true;
}

const DROP_MODES = new Set(["replace", "supplement", "vanilla"]);

function resolveDropMode(config, usedSpecialOverride) {
	const rawMode = typeof config?.dropMode === "string" ? config.dropMode.toLowerCase() : null;
	if (rawMode && DROP_MODES.has(rawMode)) {
		return rawMode;
	}

	if (config?.replaceVanilla === false) return "supplement";
	if (config?.replaceVanilla === true) return "replace";
	if (usedSpecialOverride) return "replace";
	return "replace";
}

function resolveReplacement(config, fortuneLevel) {
	const originalDropId = config?.originalDropId;
	const replaceDropId = config?.replaceDropId;
	if (!originalDropId || !replaceDropId) return null;

	const baseRange = Array.isArray(config?.baseRange) ? config.baseRange : [1, 1];
	const amount = resolveAmount({
		baseRange,
		fortuneMath: config?.fortuneMath,
		fortuneTiers: config?.fortuneTiers
	}, fortuneLevel);
	const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));

	return {
		originalDropId,
		drops: [new ItemStack(replaceDropId, safeAmount)]
	};
}

/**
 * Compute drops for a block using the provided config.
 * @param {DropContext} context
 * @param {DropEntry} config
 * @returns {DropResult | null}
 */
function computeDrops(context, config) {
	if (!matchesConditions(context, config.conditions)) {
		return null;
	}

	// If the base config demands a specific tool type, enforce it before anything else
	if (config.toolType && !toolMatchesType(context.tool, config.toolType)) {
		return null;
	}

	let usedSpecialOverride = false;
	let specialSound;

	// Apply special tool override if present
	if (context.tool && config.specialTools?.length) {
		const match = findSpecialToolOverride(context.tool, config.specialTools);
		if (match) {
			if (!matchesConditions(context, match.conditions)) return null;
			specialSound = match.sound;
			config = { ...config, ...match };
			usedSpecialOverride = true;
		}
	}

	const dropMode = resolveDropMode(config, usedSpecialOverride);
	const baseDropEnabled = dropMode === "replace";
	const replacement = dropMode === "replace" ? null : resolveReplacement(config, context.fortuneLevel);
	const hasReplacement = Boolean(replacement?.drops?.length);
	const hasBaseDrop = Boolean(baseDropEnabled && config.dropId && Array.isArray(config.baseRange));
	const extraDrops = resolveExtraDrops(config, context.fortuneLevel);
	const hasExtras = Boolean(
		extraDrops.length ||
		config.baseSound ||
		config.particles?.length ||
		config.statusEffects?.length ||
		config.commands?.length ||
		config.xp !== undefined ||
		hasReplacement
	);
	const replaceVanilla = dropMode === "replace";
	const sound = usedSpecialOverride ? specialSound : undefined;

	if (!hasBaseDrop && !usedSpecialOverride && !hasExtras) {
		return null;
	}

	const baseSound = config.baseSound;
	const omitSpecialSound = Boolean(config.omitSpecialSound);
	const suppressVanillaSound = Boolean(config.suppressVanillaSound);
	const xp = resolveXpAmount(config.xp);
	const xpMode = config.xpMode;

	if (context.hasSilkTouch) {
		const drops = [];
		if (baseDropEnabled && config.silkDropId) {
			drops.push(new ItemStack(config.silkDropId, 1));
		}

		if (extraDrops.length) {
			drops.push(...extraDrops);
		}

		if (!drops.length && !hasExtras && !usedSpecialOverride) return null;

		return {
			drops,
			replaceVanilla,
			sound,
			baseSound,
			omitSpecialSound,
			suppressVanillaSound,
			particles: config.particles,
			statusEffects: config.statusEffects,
			xp,
			xpMode,
			commands: config.commands,
			commandTarget: config.commandTarget,
			replaceOriginalId: replacement?.originalDropId,
			replaceDrops: replacement?.drops
		};
	}

	if (!baseDropEnabled || !config.dropId || !config.baseRange) {
		if (!extraDrops.length && !hasExtras && !usedSpecialOverride) return null;
		return {
			drops: extraDrops,
			replaceVanilla,
			sound,
			baseSound,
			omitSpecialSound,
			suppressVanillaSound,
			particles: config.particles,
			statusEffects: config.statusEffects,
			xp,
			xpMode,
			commands: config.commands,
			commandTarget: config.commandTarget,
			replaceOriginalId: replacement?.originalDropId,
			replaceDrops: replacement?.drops
		};
	}

	const amount = resolveAmount(config, context.fortuneLevel);
	const drops = [new ItemStack(config.dropId, amount), ...extraDrops];
	return {
		drops,
		replaceVanilla,
		sound,
		baseSound,
		omitSpecialSound,
		suppressVanillaSound,
		particles: config.particles,
		statusEffects: config.statusEffects,
		xp,
		xpMode,
		commands: config.commands,
		commandTarget: config.commandTarget,
		replaceOriginalId: replacement?.originalDropId,
		replaceDrops: replacement?.drops
	};
}

// Shared fortune table helper
function tier(level, min, max) {
	return { level, range: [min, max] };
}

function getTagsFromTool(tool, requiredType) {
	if (!tool) return [];
	try {
		const cacheKey = tool?.typeId;
		let rawToolTags = cacheKey ? toolTagCache.get(cacheKey) : undefined;
		if (!rawToolTags) {
			rawToolTags = tool.getTags?.() ?? [];
			if (cacheKey) toolTagCache.set(cacheKey, rawToolTags);
		}
		if (!rawToolTags.length) return [];
		const requiredTags = normalizeRequiredTags(requiredType);
		if (!requiredTags.length) return rawToolTags;
		const requiredSet = new Set(requiredTags);
		return rawToolTags.filter(tag => toolFetchedTags.has(tag) || requiredSet.has(tag));
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
	const toolTags = getTagsFromTool(tool, requiredType);
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
 * @param {DropContext} context
 * @returns {DropResult | ItemStack[] | null}
 */
export function getDropsForBlock(context) {
	const handler = DROPS_LIBRARY[context.block.typeId];
	if (!handler) return null;
	return handler(context) ?? null;
}

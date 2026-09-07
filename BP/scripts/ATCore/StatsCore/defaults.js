import { ARMOR_COMPONENT_ID } from "./config/definitions.js";
import {
    ABILITY_DEFAULTS,
    BLEED_TIER_PRESETS,
    BLEED_FALLBACK,
    LUCK_TIER_PRESETS,
    LUCK_FALLBACK,
    RETALIATE_TIER_PRESETS,
    RETALIATE_FALLBACK,
    MARK_TIER_PRESETS,
    MARK_FALLBACK,
    FIRE_TIER_PRESETS,
    FIRE_FALLBACK,
    AFTERSHOCK_TIER_PRESETS,
    AFTERSHOCK_FALLBACK,
    HARPOON_TIER_PRESETS,
    HARPOON_FALLBACK,
    BALLISTA_TIER_PRESETS,
    BALLISTA_FALLBACK,
} from "./config/abilities.js";
import { AFFINITIES, ITEM_TYPES } from "./constants.js";
import { deepMerge } from "./utils.js";
import {
    TIER_PRESET_VALUES,
    TIER_MULTIPLIERS,
    MATERIAL_DURABILITY_LIMITS,
    WEAK_ATTRIBUTE_GROWTH,
    EVENT_TIER_POWER,
} from "./config/materials.js";
import {
    ADVANCED_ABILITY_TIERS,
    BRANCH_ITEM_TYPES,
    CANONICAL_TIER_TOKENS,
    NON_COMBAT_TOOL_BRANCHES,
    PROJECTILE_BRANCHES,
} from "./config/equipmentTypes.js";
import { PROGRESSION_DEFAULTS, TIER_SCALING, ARMOR_VALUES } from "./config/values.js";

function buildTierPreset(values, tierMultiplier) {
    const multiplier = tierMultiplier === 1 ? TIER_SCALING.firstTierMultiplier : tierMultiplier;
    const scaled = Object.entries(values).reduce((acc, [key, value]) => {
        let next = value;
        if (typeof next === "number" && key.endsWith("Level")) {
            next = next * TIER_SCALING.perLevelMultiplier;
        }
        acc[key] = typeof next === "number" ? Number((next * multiplier).toFixed(6)) : next;
        return acc;
    }, {});

    return Object.freeze(scaled);
}

const GOLDEN_PRESET = buildTierPreset(TIER_PRESET_VALUES.golden, TIER_MULTIPLIERS.golden);
const TIER_PRESETS = Object.freeze({
    wood: buildTierPreset(TIER_PRESET_VALUES.wood, TIER_MULTIPLIERS.wood),
    stone: buildTierPreset(TIER_PRESET_VALUES.stone, TIER_MULTIPLIERS.stone),
    copper: buildTierPreset(TIER_PRESET_VALUES.copper, TIER_MULTIPLIERS.copper),
    iron: buildTierPreset(TIER_PRESET_VALUES.iron, TIER_MULTIPLIERS.iron),
    steel: buildTierPreset(TIER_PRESET_VALUES.steel, TIER_MULTIPLIERS.steel),
    gold: GOLDEN_PRESET,
    golden: GOLDEN_PRESET,
    diamond: buildTierPreset(TIER_PRESET_VALUES.diamond, TIER_MULTIPLIERS.diamond),
    netherite: buildTierPreset(TIER_PRESET_VALUES.netherite, TIER_MULTIPLIERS.netherite),
    titanium: buildTierPreset(TIER_PRESET_VALUES.titanium, TIER_MULTIPLIERS.titanium),
    aetherium: buildTierPreset(TIER_PRESET_VALUES.aetherium, TIER_MULTIPLIERS.aetherium),
});

function getWeakAttributeGrowth(tierName) {
    return WEAK_ATTRIBUTE_GROWTH[tierName] ?? WEAK_ATTRIBUTE_GROWTH.titanium;
}

function getArmorSlotName(id) {
    const normalizedId = String(id ?? "").toLowerCase();
    if (normalizedId === "minecraft:elytra") return "elytra";
    if (normalizedId.endsWith("_helmet")) return "helmet";
    if (normalizedId.endsWith("_chestplate")) return "chestplate";
    if (normalizedId.endsWith("_leggings")) return "leggings";
    if (normalizedId.endsWith("_boots")) return "boots";
    if (normalizedId.endsWith("shield")) return "shield";
    return "generic";
}

function getSupportNegationConfig(id) {
    if (getArmorSlotName(id) === "shield") {
        return { chance: 0.05, perLevel: 0, cap: 0.05 };
    }

    // Evasion is no longer tier- or slot-exclusive. Every armor piece follows
    // the same Defense-level progression, with no per-piece level cap.
    return { chance: 0.01, perLevel: 0.01, cap: Number.POSITIVE_INFINITY };
}

function createEffectKey(label, fallback = "effect") {
    const raw = String(label ?? fallback)
        .trim()
        .toLowerCase();
    return raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function getItemTags(stack) {
    if (!stack || typeof stack.getTags !== "function") return [];
    try {
        return (stack.getTags() ?? []).map((tag) => String(tag).toLowerCase());
    } catch {
        return [];
    }
}

function hasItemComponent(stack, componentId) {
    if (!stack || typeof stack.getComponent !== "function") return false;
    try {
        return Boolean(stack.getComponent(componentId));
    } catch {
        return false;
    }
}

function hasEquipmentTag(tags, ...tokens) {
    return tokens.some((token) =>
        tags.some(
            (tag) =>
                tag === token ||
                tag === `minecraft:${token}` ||
                tag === `minecraft:is_${token}` ||
                tag.endsWith(`:${token}`) ||
                tag.endsWith(`:is_${token}`),
        ),
    );
}

function inferBranch(id, type, stack = undefined) {
    const normalizedId = String(id ?? "").toLowerCase();
    const path = getItemPath(normalizedId);
    const tags = getItemTags(stack);

    if (normalizedId === "minecraft:elytra") return "elytra";
    if (path.includes("aiot") || hasEquipmentTag(tags, "aiot")) return "aiot";
    if (path.includes("paxel") || hasEquipmentTag(tags, "paxel")) return "paxel";
    if (path.includes("pickaxe") || hasEquipmentTag(tags, "pickaxe")) return "pickaxe";
    if (path.includes("shovel") || path.includes("spade") || hasEquipmentTag(tags, "shovel"))
        return "shovel";
    if (/(^|_)hoe($|_)/.test(path) || hasEquipmentTag(tags, "hoe")) return "hoe";
    if (
        path.includes("shears") ||
        path.includes("scissors") ||
        path.includes("tesoura") ||
        hasEquipmentTag(tags, "shears")
    )
        return "shears";
    if (
        path.includes("flint_and_steel") ||
        path.includes("fire_starter") ||
        path.includes("lighter") ||
        path.includes("isqueiro") ||
        hasEquipmentTag(tags, "lighter")
    )
        return "lighter";
    if (path.includes("drill") || path.includes("excavator") || hasEquipmentTag(tags, "drill"))
        return "drill";
    if (path.includes("hammer") || path.includes("sledge") || hasEquipmentTag(tags, "hammer"))
        return "hammer";
    if (
        path.includes("wrench") ||
        path.includes("chisel") ||
        path.includes("saw") ||
        path.includes("sickle")
    )
        return "tool";

    if (normalizedId === "minecraft:stick") return "stick";
    if (/(^|_)(wand|staff)(_|$)/.test(path)) return "wand";

    if (path.includes("crossbow") || hasEquipmentTag(tags, "crossbow")) return "crossbow";
    if (/(^|_)bow($|_)/.test(path) || hasEquipmentTag(tags, "bow")) return "bow";
    if (path.includes("trident") || path.includes("harpoon") || hasEquipmentTag(tags, "trident"))
        return "trident";
    if (path.includes("spear") || path.includes("lance") || hasEquipmentTag(tags, "spear"))
        return "spear";
    if (path.includes("mace") || path.includes("club") || hasEquipmentTag(tags, "mace"))
        return "mace";
    if (
        path.includes("dagger") ||
        path.includes("knife") ||
        hasEquipmentTag(tags, "dagger", "knife")
    )
        return "knife";
    if (
        path.includes("sword") ||
        path.includes("katana") ||
        path.includes("blade") ||
        hasEquipmentTag(tags, "sword")
    )
        return "sword";
    if (/(^|_)(gun|rifle|pistol|musket|blaster|cannon|launcher|scythe|claw)(_|$)/.test(path))
        return "weapon";
    if (path.endsWith("axe") || /(^|_)axe($|_)/.test(path) || hasEquipmentTag(tags, "axe"))
        return "axe";
    if (hasEquipmentTag(tags, "weapon")) return "weapon";
    if (hasEquipmentTag(tags, "tool")) return "tool";

    if (path.includes("helmet") || path.includes("headpiece") || hasEquipmentTag(tags, "helmet"))
        return "helmet";
    if (
        path.includes("chestplate") ||
        path.includes("chestpiece") ||
        path.includes("cuirass") ||
        hasEquipmentTag(tags, "chestplate")
    )
        return "chestplate";
    if (
        path.includes("leggings") ||
        path.includes("legguards") ||
        hasEquipmentTag(tags, "leggings")
    )
        return "leggings";
    if (path.includes("boots") || path.includes("greaves") || hasEquipmentTag(tags, "boots"))
        return "boots";
    if (path.includes("shield") || hasEquipmentTag(tags, "shield")) return "shield";
    if (
        path.includes("armor") ||
        hasEquipmentTag(tags, "armor", "wearable") ||
        hasItemComponent(stack, ARMOR_COMPONENT_ID)
    )
        return "armor";

    // Data-driven equipment from unknown add-ons often has no conventional
    // suffix or vanilla tool tag. A single, damageable stack is still a safe
    // equipment signal and receives the neutral utility profile.
    if (hasItemComponent(stack, "minecraft:durability") && Number(stack?.maxAmount ?? 1) === 1) {
        return "equipment";
    }
    return type;
}

function createPassiveEffect(label, overrides = {}) {
    return {
        key: createEffectKey(label, "passive"),
        kind: "passive",
        label,
        ...overrides,
    };
}

function createBleedEffect(tierName, overrides = {}) {
    const preset = BLEED_TIER_PRESETS[tierName] ?? BLEED_FALLBACK;

    return {
        key: "bleeding",
        kind: "bleed",
        label: "Bleeding",
        on: "hit",
        tickInterval: 20,
        refresh: true,
        ...preset,
        chance: 1,
        durationTicks: 100,
        damageRatio: 0.14,
        maxStacks: 1,
        ...overrides,
    };
}

function createSweepEffect(tierName, overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.sweep,
        ...overrides,
    };
}

function createLuckEffect(tierName, label = "Luck", overrides = {}) {
    const preset = LUCK_TIER_PRESETS[tierName] ?? LUCK_FALLBACK;

    return {
        key: createEffectKey(label, "luck"),
        kind: "xp_orb",
        label,
        on: "ore_break",
        requireOre: true,
        ...preset,
        ...overrides,
    };
}

function createRetaliateEffect(tierName, label = "Retaliation", overrides = {}) {
    const preset = RETALIATE_TIER_PRESETS[tierName] ?? RETALIATE_FALLBACK;

    return {
        key: createEffectKey(label, "retaliation"),
        kind: "retaliate",
        label,
        on: "hurt",
        ...preset,
        ...overrides,
    };
}

function createMarkEffect(tierName, label = "Mark", overrides = {}) {
    const preset = MARK_TIER_PRESETS[tierName] ?? MARK_FALLBACK;

    return {
        key: createEffectKey(label, "mark"),
        kind: "mark",
        label,
        on: "hit",
        ...preset,
        ...overrides,
    };
}

function createFireEffect(tierName, label = "Fire", overrides = {}) {
    const preset = FIRE_TIER_PRESETS[tierName] ?? FIRE_FALLBACK;

    return {
        key: createEffectKey(label, "fire"),
        kind: "fire",
        label,
        on: "hit",
        ...preset,
        ...overrides,
    };
}

function createOperatorEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.operator,
        ...overrides,
    };
}

function createCrushingEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.crushing,
        ...overrides,
    };
}

function createGardenerEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.gardener,
        ...overrides,
    };
}

function createPrimalEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.primal,
        ...overrides,
    };
}

function createForgerEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.forger,
        ...overrides,
    };
}

function createIgniterEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.igniter,
        ...overrides,
    };
}

function createAftershockEffect(tierName, overrides = {}) {
    const preset = AFTERSHOCK_TIER_PRESETS[tierName] ?? AFTERSHOCK_FALLBACK;

    return {
        key: "aftershock",
        kind: "aftershock",
        label: "Aftershock",
        on: "hit",
        radius: 7.5,
        maxTargets: 12,
        levitationDurationTicks: 40,
        levitationAmplifier: 4,
        slownessDurationTicks: 100,
        slownessAmplifier: 3,
        ...preset,
        ...overrides,
    };
}

function createHarpoonEffect(tierName, overrides = {}) {
    const preset = HARPOON_TIER_PRESETS[tierName] ?? HARPOON_FALLBACK;

    return {
        key: "harpoon",
        kind: "harpoon",
        label: "Harpoon",
        on: "hit",
        loyaltyBoostStrength: 2.15,
        fallGraceTicks: 60,
        ...preset,
        ...overrides,
    };
}

function createPinningShotEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.pinningShot,
        ...overrides,
    };
}

function createBallistaEffect(tierName, overrides = {}) {
    const preset = BALLISTA_TIER_PRESETS[tierName] ?? BALLISTA_FALLBACK;

    return {
        key: "ballista",
        kind: "ballista",
        label: "Ballista",
        on: "hit",
        chainRange: 5,
        maxChains: 3,
        markDurationTicks: 90,
        damageBonus: 0.08,
        ...preset,
        ...overrides,
    };
}

function createArrowVolleyEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.arrowVolley,
        ...overrides,
    };
}

function createReaperEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.reaper,
        ...overrides,
    };
}

function createWormEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.worm,
        ...overrides,
    };
}

function createBerserkEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.berserk,
        ...overrides,
    };
}

function createBerserkLoggingEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.berserkLogging,
        ...overrides,
    };
}

function createClarityEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.clarity,
        ...overrides,
    };
}

function createFeatherstepEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.featherstep,
        ...overrides,
    };
}

function createToughEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.tough,
        reducedDamageTypes: [...ABILITY_DEFAULTS.tough.reducedDamageTypes],
        ...overrides,
    };
}

function createArmoredEffect(overrides = {}) {
    return {
        ...ABILITY_DEFAULTS.armored,
        negatedDamageTypes: [...ABILITY_DEFAULTS.armored.negatedDamageTypes],
        reducedDamageTypes: [...ABILITY_DEFAULTS.armored.reducedDamageTypes],
        ...overrides,
    };
}

function getEventTierPower(tierName) {
    return EVENT_TIER_POWER[tierName] ?? EVENT_TIER_POWER.iron;
}

function createEventDrivenAttributeProfile(type, branch, tierName) {
    const power = getEventTierPower(tierName);
    const support = type === ITEM_TYPES.support;
    const projectile = PROJECTILE_BRANCHES.includes(branch);
    const scavenger =
        type === ITEM_TYPES.tool || type === ITEM_TYPES.hybrid || type === ITEM_TYPES.utility;

    return {
        adaptiveResilience: support
            ? {
                  reductionPerStack: 0.008 * power,
                  reductionPerLevel: 0.00018 * power,
                  maxReductionPerStack: 0.025,
                  maxStacks: 3,
                  durationTicks: 100,
              }
            : null,
        healingEfficiency: support
            ? {
                  bonus: 0.012 * power,
                  bonusPerLevel: 0.00025 * power,
                  maxBonus: 0.25,
              }
            : null,
        chargeMastery: projectile
            ? {
                  maxDamageBonus: 0.08 * power,
                  damageBonusPerLevel: 0.0015 * power,
                  cap: 0.4,
                  fullChargeTicks: branch === "crossbow" ? 25 : 20,
              }
            : null,
        persistence: projectile
            ? {
                  bonusPerHit: 0.025,
                  maxBonus: 0.5,
                  resetTicks: 200,
              }
            : null,
        dimensionalAttunement: support
            ? {
                  durationTicks: Math.floor(80 + power * 30),
                  amplifier: 0,
              }
            : null,
        scavenging: scavenger
            ? {
                  chance: 0.035 * power,
                  chancePerLevel: 0.00075 * power,
                  maxChance: 0.3,
                  xpAmount: Math.max(1, Math.floor(power * 2)),
                  healAmount: 0.5 + power * 0.35,
              }
            : null,
    };
}

function createPerfectGuardEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "perfect_guard",
        kind: "perfect_guard",
        label: "Perfect Guard",
        windowTicks: 8,
        cooldownTicks: Math.max(35, Math.floor(90 - power * 18)),
        damageMultiplier: Math.max(0.08, 0.32 - power * 0.1),
        cancelChance: Math.min(0.45, 0.08 * power),
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createOverchargeEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "overcharge",
        kind: "overcharge",
        label: "Overcharge",
        radius: 2.5 + power,
        damageScale: Math.min(0.65, 0.28 + power * 0.14),
        fireSeconds: Math.max(2, Math.floor(1 + power)),
        cooldownTicks: Math.max(20, Math.floor(55 - power * 12)),
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createSoulCollectorEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "soul_collector",
        kind: "soul_collector",
        label: "Soul Collector",
        maxCharges: 5,
        requiresFullCharge: true,
        durationTicks: 600,
        damagePerCharge: Math.min(0.15, 0.055 + power * 0.025),
        healPerCharge: 0.35 + power * 0.2,
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createBlastWardEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "blast_ward",
        kind: "blast_ward",
        label: "Blast Ward",
        damageReduction: Math.min(0.75, 0.3 + power * 0.16),
        protectionRadius: 3.5 + power,
        cooldownTicks: Math.max(45, Math.floor(110 - power * 25)),
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createPhaseStepEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "phase_step",
        kind: "phase_step",
        label: "Phase Step",
        durationTicks: Math.floor(70 + power * 35),
        speedAmplifier: 0,
        resistanceAmplifier: 0,
        cooldownTicks: Math.max(80, Math.floor(260 - power * 70)),
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createDashEffect() {
    return {
        ...ABILITY_DEFAULTS.dash,
    };
}

function createElytraWindLaunchEffect() {
    return {
        ...ABILITY_DEFAULTS.elytraWindLaunch,
    };
}

function createEventDrivenAbilitySet(type, branch, tierName, hasCombatProfile) {
    const attributes = [];
    const support = [];

    if (hasCombatProfile) {
        attributes.push(createSoulCollectorEffect(tierName));
    }
    if (PROJECTILE_BRANCHES.includes(branch)) {
        attributes.push(createOverchargeEffect(tierName));
    }
    if (branch === "leggings" || branch === "shield") {
        support.push(createPerfectGuardEffect(tierName));
    }
    if (branch === "chestplate" || branch === "shield") {
        support.push(createBlastWardEffect(tierName));
    }
    if (branch === "boots") {
        support.push(createPhaseStepEffect(tierName), createDashEffect());
    }

    return { attributes, support };
}

function createArmorAbilitySet(id, slot, tierName) {
    const slotKey = String(slot ?? "generic").toLowerCase();
    const normalizedId = String(id ?? "").toLowerCase();

    if (slotKey === "helmet") {
        if (normalizedId === "minecraft:turtle_helmet") {
            return [createToughEffect()];
        }
        return [createClarityEffect()];
    }

    if (slotKey === "chestplate") {
        return [createArmoredEffect(), createRetaliateEffect(tierName)];
    }

    if (slotKey === "leggings") {
        return [createPassiveEffect("Bulwark")];
    }

    if (slotKey === "boots") {
        return [createFeatherstepEffect()];
    }

    // Spikes remains deliberately disabled: EntityHurt is not delivered for
    // blocked shield hits reliably enough in the current Bedrock API.
    if (slotKey === "shield") return [];

    return [];
}

function baseDefinition(id, tierName, type, affinity, overrides = {}) {
    const tier = TIER_PRESETS[tierName] ?? TIER_PRESETS.titanium;
    const isTool = type === ITEM_TYPES.tool;
    const isHybrid = type === ITEM_TYPES.hybrid;
    const isWeapon = type === ITEM_TYPES.weapon;
    const isSupport = type === ITEM_TYPES.support;
    const supportsMiningTrouble = isTool || isHybrid || type === ITEM_TYPES.utility;
    const branch = inferBranch(id, type);
    const hasCombatProfile = !isSupport && !(isTool && NON_COMBAT_TOOL_BRANCHES.has(branch));
    const supportNegation = getSupportNegationConfig(id);
    const weakGrowth = getWeakAttributeGrowth(tierName);

    const definition = {
        id,
        type,
        tier: tierName,
        rarity: tier.rarity,
        affinity,
        branch,
        persistEveryXp: isWeapon ? 18 : isTool || isHybrid ? 12 : 24,
        progression: {
            combatXp: hasCombatProfile ? (isTool ? 1 : tier.combatXp) : 0,
            killXp: hasCombatProfile ? (isTool ? 6 : 12) : 0,
            blockXp: isWeapon || isSupport ? 0 : isTool || isHybrid ? 0 : tier.blockXp,
            oreXp: isWeapon || isSupport ? 0 : isTool || isHybrid ? 0 : tier.oreXp,
            toolXp: isTool || isHybrid ? tier.toolXp : 0,
            // Defense belongs exclusively to worn support equipment. Tool
            // Preserving scales from Mining and must not create a hidden DEF
            // track on weapons, tools, hybrids, or utility equipment.
            armorXp: isSupport ? 2 : 0,
            baseXp: PROGRESSION_DEFAULTS.baseXp,
            growth: PROGRESSION_DEFAULTS.growth,
        },
        attributes: {
            damagePerLevel: hasCombatProfile ? weakGrowth : 0,
            flatDamageBonus: 0,
            markedDamageBonus: hasCombatProfile ? 0.04 : 0,
            crit: {
                chance: hasCombatProfile ? (isTool ? tier.critChance * 0.45 : tier.critChance) : 0,
                chancePerLevel: hasCombatProfile ? weakGrowth : 0,
                maxChance: hasCombatProfile ? 0.45 : 0,
                multiplier: hasCombatProfile ? 1.5 : 1,
                multiplierPerLevel: hasCombatProfile ? tier.critMultiplierLevel : 0,
                maxMultiplier: hasCombatProfile ? 2.25 : 1,
                openingBonus: hasCombatProfile ? (isWeapon ? 0.045 : 0.02) : 0,
                precisionBonus: hasCombatProfile ? (isWeapon ? 0.025 : 0.01) : 0,
            },
            penetration: {
                percent: hasCombatProfile
                    ? isTool
                        ? tier.penetration * 0.35
                        : tier.penetration
                    : 0,
                perLevel: hasCombatProfile ? weakGrowth : 0,
                cap: hasCombatProfile ? Math.max(0.45, tier.penetrationCap) : 0,
                bossScalar: 0.55,
                bossCap: 0.2,
            },
            lifesteal: {
                percent: hasCombatProfile && !isTool ? tier.lifesteal : 0,
                perLevel: hasCombatProfile && !isTool ? weakGrowth : 0,
                cap: hasCombatProfile ? 0.25 : 0,
                critBonus: hasCombatProfile ? (isWeapon ? 0.01 : 0.004) : 0,
            },
            effects: [],
        },
        support: {
            // Keep existing material base values; tier-specific caps and
            // Aetherium-only overrides are intentionally gone.
            damageReduction: isSupport
                ? tierName === "netherite"
                    ? 0.01
                    : tierName === "diamond"
                      ? 0.007
                      : 0.009
                : 0,
            damageReductionPerLevel: isSupport ? weakGrowth : 0,
            maxDamageReduction: 0.12,
            durabilityPreserveChance: isSupport ? 0.01 : 0,
            durabilityPreserveChancePerLevel: isSupport ? 0.01 : 0,
            maxDurabilityPreserveChance: Number.POSITIVE_INFINITY,
            negateAllDamageChance: isSupport ? supportNegation.chance : 0,
            negateAllDamageChancePerLevel: isSupport ? supportNegation.perLevel : 0,
            maxNegateAllDamageChance: isSupport ? supportNegation.cap : 0,
            effects: isSupport ? createArmorAbilitySet(id, branch, tierName) : [],
        },
        mining: {
            bonusLootChance: isWeapon || isSupport ? 0 : tier.miningBonus + tier.oreBonus,
            bonusLootChancePerLevel: isWeapon || isSupport ? 0 : weakGrowth,
            durabilitySaveChance: isSupport ? 0 : 0.01,
            durabilitySaveChancePerLevel: isSupport ? 0 : 0.01,
            strongAttributes: supportsMiningTrouble
                ? {
                      doubleTrouble: {
                          baseChance: 0.01,
                          chancePer10Levels: 0.01,
                          maxChance: 0.2,
                      },
                      tripleTrouble: {
                          chanceScale: 0.1,
                      },
                  }
                : {},
            effects: [],
            // Weak chance attributes are intentionally only bounded by 100%.
        },
        eventDriven: createEventDrivenAttributeProfile(type, branch, tierName),
    };

    if (overrides.progression) {
        definition.progression = { ...definition.progression, ...overrides.progression };
        delete overrides.progression;
    }
    const merged = deepMerge(definition, overrides);
    const eventAbilities = createEventDrivenAbilitySet(type, branch, tierName, hasCombatProfile);
    merged.attributes.effects = [
        ...(Array.isArray(merged?.attributes?.effects) ? merged.attributes.effects : []),
        ...eventAbilities.attributes,
    ];
    merged.support.effects = [
        ...(Array.isArray(merged?.support?.effects) ? merged.support.effects : []),
        ...eventAbilities.support,
    ];
    const hasUniqueEffects = [
        merged?.attributes?.effects,
        merged?.mining?.effects,
        merged?.support?.effects,
    ].some((value) => Array.isArray(value) && value.length > 0);

    if (merged.uniqueAbilityUnlock === undefined && hasUniqueEffects) {
        merged.uniqueAbilityUnlock = "totem";
    }

    return merged;
}

function getItemPath(id) {
    return (
        String(id ?? "")
            .toLowerCase()
            .split(":")
            .pop() ?? ""
    );
}

function inferItemType(branch) {
    return Object.hasOwn(BRANCH_ITEM_TYPES, branch)
        ? BRANCH_ITEM_TYPES[branch]
        : ITEM_TYPES.utility;
}

function getMaximumDurability(stack) {
    if (!stack || typeof stack.getComponent !== "function") return 0;
    try {
        const durability =
            stack.getComponent("minecraft:durability") ?? stack.getComponent("durability");
        return Math.max(0, Math.floor(Number(durability?.maxDurability ?? 0) || 0));
    } catch {
        return 0;
    }
}

function inferTierFromItemProperties(stack) {
    const durability = getMaximumDurability(stack);
    if (durability <= 0) return null;
    if (durability <= MATERIAL_DURABILITY_LIMITS.wood) return "wood";
    if (durability <= MATERIAL_DURABILITY_LIMITS.stone) return "stone";
    if (durability <= MATERIAL_DURABILITY_LIMITS.iron) return "iron";
    if (durability <= MATERIAL_DURABILITY_LIMITS.diamond) return "diamond";
    if (durability <= MATERIAL_DURABILITY_LIMITS.netherite) return "netherite";
    if (durability <= MATERIAL_DURABILITY_LIMITS.titanium) return "titanium";
    return "aetherium";
}

function inferTierName(id, branch) {
    const path = getItemPath(id);
    const tokens = path.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const token of tokens) {
        if (CANONICAL_TIER_TOKENS[token]) return CANONICAL_TIER_TOKENS[token];
    }

    if (path.includes("heavy_drill") || path.includes("smelting")) return "netherite";
    if (
        path.includes("flint_knife") ||
        branch === "shears" ||
        branch === "shield" ||
        branch === "elytra" ||
        path.includes("turtle")
    )
        return "diamond";
    if (branch === "lighter") return "iron";
    if (branch === "mace" || branch === "trident" || branch === "crossbow") return "netherite";
    if (branch === "bow") return "diamond";
    return null;
}

function inferAffinity(type, branch, tierName) {
    if (branch === "spear") return AFFINITIES.control;
    if (branch === "bow" || branch === "trident") return AFFINITIES.precision;
    if (branch === "crossbow" || branch === "axe") return AFFINITIES.technique;
    if (branch === "sword") return AFFINITIES.aggression;
    if (branch === "lighter") return AFFINITIES.control;

    return (
        {
            [ITEM_TYPES.weapon]: AFFINITIES.aggression,
            [ITEM_TYPES.hybrid]: AFFINITIES.technique,
            [ITEM_TYPES.tool]: AFFINITIES.mining,
            [ITEM_TYPES.support]: AFFINITIES.survival,
            [ITEM_TYPES.utility]: AFFINITIES.hybrid,
        }[type] ?? AFFINITIES.hybrid
    );
}

function getInferredSpecialOverrides(id, tierName, type, branch) {
    const path = getItemPath(id);
    const advanced = ADVANCED_ABILITY_TIERS.has(tierName);

    if (path.includes("smelting") && branch === "pickaxe") {
        return {
            rarity: "tool",
            progression: { toolXp: 4, oreXp: 5, combatXp: 0 },
            attributes: {
                effects: [createFireEffect("netherite", "Forger", { chance: 1, seconds: 4 })],
            },
            mining: { effects: [createForgerEffect()] },
        };
    }

    if (branch === "lighter") {
        return {
            rarity: "utility",
            progression: { combatXp: 0, killXp: 0, blockXp: 0, oreXp: 0 },
            mining: { bonusLootChance: 0, durabilitySaveChance: 0, effects: [] },
            attributes: {
                damagePerLevel: 0,
                flatDamageBonus: 0,
                markedDamageBonus: 0,
                crit: {
                    chance: 0,
                    chancePerLevel: 0,
                    maxChance: 0,
                    multiplier: 1,
                    multiplierPerLevel: 0,
                    maxMultiplier: 1,
                    openingBonus: 0,
                    precisionBonus: 0,
                },
                penetration: { percent: 0, perLevel: 0, cap: 0, bossScalar: 0 },
                lifesteal: { percent: 0, perLevel: 0, cap: 0, critBonus: 0 },
                effects: [createIgniterEffect()],
            },
        };
    }

    if (branch === "drill") {
        const heavy = path.includes("heavy");
        const absolute = path.includes("absolute");

        return {
            rarity: "utility",
            mining: {
                bonusLootChance: absolute ? 0.18 : heavy ? 0.15 : 0.12,
                ...(heavy || absolute ? { durabilitySaveChance: absolute ? 0.05 : 0.035 } : {}),
                effects: [createOperatorEffect({ size: absolute ? 7 : heavy ? 5 : 3 })],
            },
        };
    }

    if (branch === "knife") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            attributes: {
                flatDamageBonus: 4,
                effects: [
                    createBleedEffect("diamond", {
                        label: "Primal",
                        durationTicks: 100,
                        damageRatio: 0.14,
                    }),
                ],
            },
            mining: {
                bonusLootChance: 0.035,
                durabilitySaveChance: 0.01,
                effects: [createPrimalEffect()],
            },
        };
    }

    if (branch === "shears") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            mining: {
                bonusLootChance: 0.02,
                durabilitySaveChance: 0.01,
                effects: [createGardenerEffect()],
            },
        };
    }

    if (branch === "shield") {
        return {
            rarity: "utility",
            progression: { armorXp: 1 },
            support: {
                damageReduction: ARMOR_VALUES.offhandShieldReduction,
                damageReductionPerLevel: 0,
                maxDamageReduction: ARMOR_VALUES.offhandShieldReduction,
                durabilityPreserveChance: 0.01,
                durabilityPreserveChancePerLevel: 0,
                maxDurabilityPreserveChance: Number.POSITIVE_INFINITY,
                negateAllDamageChance: 0.05,
                negateAllDamageChancePerLevel: 0,
                maxNegateAllDamageChance: 0.05,
                effects: createArmorAbilitySet(id, "shield", tierName),
            },
        };
    }

    if (branch === "elytra") {
        return {
            rarity: "utility",
            progression: { armorXp: 2 },
            support: {
                damageReduction: 0.45,
                damageReductionPerLevel: 0,
                maxDamageReduction: 0.45,
                effects: [createElytraWindLaunchEffect()],
            },
        };
    }

    if (branch === "spear") {
        return {
            attributes: {
                effects: [
                    createMarkEffect(tierName, "Skewer", { kind: "skewer", damageBonus: 0.1 }),
                ],
            },
        };
    }
    if (branch === "mace") return { attributes: { effects: [createAftershockEffect(tierName)] } };
    if (branch === "trident") return { attributes: { effects: [createHarpoonEffect(tierName)] } };
    if (branch === "bow") {
        return {
            attributes: {
                crit: {
                    chance: 0.08,
                    chancePerLevel: 0.0032,
                    maxChance: 0.4,
                    multiplier: 1.5,
                    multiplierPerLevel: 0.005,
                    maxMultiplier: 2.15,
                    openingBonus: 0.05,
                    precisionBonus: 0.06,
                },
                effects: [createPinningShotEffect(), createArrowVolleyEffect()],
            },
        };
    }
    if (branch === "crossbow") {
        return {
            attributes: {
                penetration: {
                    percent: 0.08,
                    perLevel: 0.004,
                    cap: 0.34,
                    bossScalar: 0.65,
                    bossCap: 0.2,
                },
                effects: [createBallistaEffect(tierName)],
            },
        };
    }

    if (branch === "axe")
        return {
            attributes: { effects: [createBerserkEffect()] },
            mining: { effects: [createBerserkLoggingEffect()] },
        };
    if (!advanced) return {};
    if (branch === "sword")
        return {
            attributes: { effects: [createBleedEffect(tierName), createSweepEffect(tierName)] },
        };
    if (branch === "pickaxe") return { mining: { effects: [createLuckEffect(tierName)] } };
    if (branch === "shovel") return { mining: { effects: [createWormEffect()] } };
    if (branch === "hoe")
        return {
            attributes: { flatDamageBonus: 2, effects: [createReaperEffect()] },
            mining: { effects: [createReaperEffect()] },
        };
    if (branch === "hammer") return { mining: { effects: [createCrushingEffect()] } };
    if (branch === "aiot") {
        return {
            progression: { armorXp: 0 },
            attributes: { effects: [createSweepEffect(tierName)] },
            mining: {},
        };
    }

    return {};
}

/**
 * Generates StatsCore configuration from a typeId's material and equipment suffix.
 * Explicit registrations remain available for third-party extensions, but built-in
 * equipment no longer needs a per-item definition list.
 */
export function inferDynamicDefinition(itemOrId) {
    const stack = typeof itemOrId === "string" ? undefined : itemOrId;
    const normalizedId = String(
        typeof itemOrId === "string" ? itemOrId : (itemOrId?.typeId ?? ""),
    ).toLowerCase();
    const branch = inferBranch(normalizedId, null, stack);
    if (!branch) return null;

    const type = inferItemType(branch);
    // Runtime item properties are more reliable than a closed material list.
    // Identifier-only lookups still receive a conservative iron fallback once
    // the path has identified a real equipment family.
    const tierName =
        inferTierName(normalizedId, branch) ?? inferTierFromItemProperties(stack) ?? "iron";

    const affinity = inferAffinity(type, branch, tierName);
    return baseDefinition(normalizedId, tierName, type, affinity, {
        ...getInferredSpecialOverrides(normalizedId, tierName, type, branch),
        branch,
    });
}

// Built-in equipment is inferred from its typeId. Third-party addons can still
// register explicit definitions through the public registry API when needed.

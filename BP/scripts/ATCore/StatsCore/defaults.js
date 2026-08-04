import { AFFINITIES, ITEM_TYPES } from "./constants.js";
import { deepMerge } from "./utils.js";
import { OFFENSIVE_ENTITY_CATEGORIES } from "./shared/entityCategories.js";

function buildTierPreset(values, tierMultiplier) {
    const multiplier = tierMultiplier === 1 ? 1.5 : tierMultiplier;
    const scaled = Object.entries(values).reduce((acc, [key, value]) => {
        let next = value;
        if (typeof next === "number" && key.endsWith("Level")) {
            next = next * 4;
        }
        acc[key] = typeof next === "number" ? Number((next * multiplier).toFixed(6)) : next;
        return acc;
    }, {});

    return Object.freeze(scaled);
}

const GOLDEN_PRESET = buildTierPreset({
    rarity: "gleaming",
    combatXp: 1.5,
    blockXp: 1,
    oreXp: 3,
    toolXp: 3.4,
    critChance: 0.04,
    critLevel: 0.0018,
    critMultiplier: 1.22,
    critMultiplierLevel: 0.0055,
    penetration: 0.018,
    penetrationLevel: 0.0014,
    penetrationCap: 0.12,
    lifesteal: 0.002,
    lifestealLevel: 0.0001,
    miningBonus: 0.03,
    miningLevel: 0.0015,
    oreBonus: 0.05,
    oreLevel: 0.0018,
    durabilitySave: 0.014,
    durabilitySaveLevel: 0.0009
}, 3);

const TIER_PRESETS = Object.freeze({
    wood: buildTierPreset({
        rarity: "common",
        combatXp: 1,
        blockXp: 1,
        oreXp: 2,
        toolXp: 2,
        critChance: 0.015,
        critLevel: 0.001,
        critMultiplier: 1.12,
        critMultiplierLevel: 0.004,
        penetration: 0.01,
        penetrationLevel: 0.001,
        penetrationCap: 0.08,
        lifesteal: 0,
        lifestealLevel: 0,
        miningBonus: 0.012,
        miningLevel: 0.0008,
        oreBonus: 0.02,
        oreLevel: 0.001,
        durabilitySave: 0.006,
        durabilitySaveLevel: 0.0004
    }, 1),
    stone: buildTierPreset({
        rarity: "sturdy",
        combatXp: 1.2,
        blockXp: 1,
        oreXp: 3,
        toolXp: 2.25,
        critChance: 0.02,
        critLevel: 0.0012,
        critMultiplier: 1.15,
        critMultiplierLevel: 0.0045,
        penetration: 0.016,
        penetrationLevel: 0.0012,
        penetrationCap: 0.1,
        lifesteal: 0,
        lifestealLevel: 0,
        miningBonus: 0.016,
        miningLevel: 0.001,
        oreBonus: 0.028,
        oreLevel: 0.0012,
        durabilitySave: 0.009,
        durabilitySaveLevel: 0.0005
    }, 2),
    copper: buildTierPreset({
        rarity: "bright",
        combatXp: 1.35,
        blockXp: 1,
        oreXp: 3.2,
        toolXp: 2.8,
        critChance: 0.024,
        critLevel: 0.0013,
        critMultiplier: 1.16,
        critMultiplierLevel: 0.0048,
        penetration: 0.02,
        penetrationLevel: 0.0014,
        penetrationCap: 0.11,
        lifesteal: 0.001,
        lifestealLevel: 0.00008,
        miningBonus: 0.018,
        miningLevel: 0.001,
        oreBonus: 0.03,
        oreLevel: 0.0013,
        durabilitySave: 0.011,
        durabilitySaveLevel: 0.0006
    }, 2.5),
    iron: buildTierPreset({
        rarity: "tempered",
        combatXp: 1.6,
        blockXp: 1,
        oreXp: 3.5,
        toolXp: 3.2,
        critChance: 0.028,
        critLevel: 0.0015,
        critMultiplier: 1.18,
        critMultiplierLevel: 0.005,
        penetration: 0.024,
        penetrationLevel: 0.0018,
        penetrationCap: 0.14,
        lifesteal: 0.002,
        lifestealLevel: 0.0001,
        miningBonus: 0.022,
        miningLevel: 0.0012,
        oreBonus: 0.04,
        oreLevel: 0.0015,
        durabilitySave: 0.013,
        durabilitySaveLevel: 0.0008
    }, 3),
    steel: buildTierPreset({
        rarity: "fortified",
        combatXp: 1.7,
        blockXp: 1,
        oreXp: 3.8,
        toolXp: 3.6,
        critChance: 0.033,
        critLevel: 0.0017,
        critMultiplier: 1.2,
        critMultiplierLevel: 0.0052,
        penetration: 0.028,
        penetrationLevel: 0.0021,
        penetrationCap: 0.16,
        lifesteal: 0.003,
        lifestealLevel: 0.0002,
        miningBonus: 0.026,
        miningLevel: 0.0014,
        oreBonus: 0.045,
        oreLevel: 0.0017,
        durabilitySave: 0.015,
        durabilitySaveLevel: 0.0009
    }, 3.5),
    gold: GOLDEN_PRESET,
    golden: GOLDEN_PRESET,
    diamond: buildTierPreset({
        rarity: "advanced",
        combatXp: 2,
        blockXp: 1,
        oreXp: 4,
        toolXp: 4,
        critChance: 0.045,
        critLevel: 0.002,
        critMultiplier: 1.24,
        critMultiplierLevel: 0.006,
        penetration: 0.035,
        penetrationLevel: 0.0025,
        penetrationCap: 0.18,
        lifesteal: 0.004,
        lifestealLevel: 0.0003,
        miningBonus: 0.028,
        miningLevel: 0.0015,
        oreBonus: 0.052,
        oreLevel: 0.002,
        durabilitySave: 0.018,
        durabilitySaveLevel: 0.0012
    }, 4),
    netherite: buildTierPreset({
        rarity: "elite",
        combatXp: 2.5,
        blockXp: 1,
        oreXp: 5,
        toolXp: 4.8,
        critChance: 0.062,
        critLevel: 0.0028,
        critMultiplier: 1.34,
        critMultiplierLevel: 0.0075,
        penetration: 0.062,
        penetrationLevel: 0.0038,
        penetrationCap: 0.26,
        lifesteal: 0.008,
        lifestealLevel: 0.0005,
        miningBonus: 0.04,
        miningLevel: 0.002,
        oreBonus: 0.072,
        oreLevel: 0.0028,
        durabilitySave: 0.03,
        durabilitySaveLevel: 0.0018
    }, 5),
    titanium: buildTierPreset({
        rarity: "refined",
        combatXp: 2,
        blockXp: 1,
        oreXp: 5,
        toolXp: 4.2,
        critChance: 0.055,
        critLevel: 0.0025,
        critMultiplier: 1.32,
        critMultiplierLevel: 0.007,
        penetration: 0.055,
        penetrationLevel: 0.0035,
        penetrationCap: 0.22,
        lifesteal: 0.006,
        lifestealLevel: 0.0004,
        miningBonus: 0.035,
        miningLevel: 0.0018,
        oreBonus: 0.065,
        oreLevel: 0.0025,
        durabilitySave: 0.025,
        durabilitySaveLevel: 0.0015
    }, 4.5),
    aetherium: buildTierPreset({
        rarity: "ascendant",
        combatXp: 3,
        blockXp: 1,
        oreXp: 6,
        toolXp: 5.4,
        critChance: 0.075,
        critLevel: 0.003,
        critMultiplier: 1.38,
        critMultiplierLevel: 0.009,
        penetration: 0.095,
        penetrationLevel: 0.0045,
        penetrationCap: 0.32,
        lifesteal: 0.012,
        lifestealLevel: 0.0007,
        miningBonus: 0.055,
        miningLevel: 0.0025,
        oreBonus: 0.095,
        oreLevel: 0.0035,
        durabilitySave: 0.04,
        durabilitySaveLevel: 0.002
    }, 6),
});

const NON_COMBAT_TOOL_BRANCHES = new Set([
    "pickaxe",
    "shovel",
    "shears",
    "drill",
    "knife",
    "lighter"
]);

const SUPPORT_SLOT_SCALARS = Object.freeze({
    helmet: 0.8,
    chestplate: 1,
    elytra: 1,
    leggings: 0.75,
    boots: 0.65,
    generic: 0.7
});

// Every weak attribute receives the same point value for its material tier.
// The random attribute allocation decides *where* a level goes; the tier decides
// how valuable that point is. Strong effects keep their own configuration.
const WEAK_ATTRIBUTE_GROWTH = Object.freeze({
    wood: 0.006,
    stone: 0.008,
    copper: 0.01,
    iron: 0.012,
    golden: 0.018,
    diamond: 0.02,
    netherite: 0.024,
    titanium: 0.024,
    aetherium: 0.03,
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
    const raw = String(label ?? fallback).trim().toLowerCase();
    return raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function inferBranch(id, type) {
    const normalizedId = String(id ?? "").toLowerCase();

    if (normalizedId === "minecraft:elytra") return "elytra";
    if (normalizedId.includes("aiot")) return "aiot";
    if (normalizedId.includes("paxel")) return "paxel";
    if (normalizedId.includes("hammer")) return "hammer";
    if (normalizedId.endsWith("_sword")) return "sword";
    if (normalizedId.endsWith("_axe")) return "axe";
    if (normalizedId.endsWith("_spear")) return "spear";
    if (normalizedId.endsWith(":mace") || normalizedId.endsWith("_mace") || normalizedId === "minecraft:mace") return "mace";
    if (normalizedId.endsWith(":trident") || normalizedId.endsWith("_trident")) return "trident";
    if (normalizedId.endsWith(":bow") || normalizedId.endsWith("_bow")) return "bow";
    if (normalizedId.endsWith("crossbow")) return "crossbow";
    if (normalizedId.endsWith("_pickaxe")) return "pickaxe";
    if (normalizedId.endsWith("_shovel")) return "shovel";
    if (normalizedId.endsWith("_hoe")) return "hoe";
    if (normalizedId.endsWith("_helmet")) return "helmet";
    if (normalizedId.endsWith("_chestplate")) return "chestplate";
    if (normalizedId.endsWith("_leggings")) return "leggings";
    if (normalizedId.endsWith("_boots")) return "boots";
    if (normalizedId.endsWith("shears")) return "shears";
    if (normalizedId.endsWith("shield")) return "shield";
    if (normalizedId.includes("heavy_drill") || normalizedId.endsWith(":drill") || normalizedId.includes("_drill")) return "drill";
    if (normalizedId.endsWith("flint_knife") || normalizedId.endsWith("_knife")) return "knife";
    if (normalizedId.includes("flint_and_steel")) return "lighter";
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
    const preset = {
        diamond: { chance: 0.18, durationTicks: 80, damageRatio: 0.12, maxStacks: 1 },
        netherite: { chance: 0.22, durationTicks: 90, damageRatio: 0.14, maxStacks: 1 },
        titanium: { chance: 0.21, durationTicks: 90, damageRatio: 0.14, maxStacks: 1 },
    }[tierName] ?? { chance: 0.18, durationTicks: 80, damageRatio: 0.12, maxStacks: 1 };

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
        key: "sweeping",
        kind: "sweep",
        label: "Sweeping",
        on: "hit",
        radius: 2.5,
        radiusPer5Levels: 0.5,
        maxRadiusLevel: 25,
        damageScale: 0.5,
        damageScalePer5Levels: 0.05,
        maxDamageScale: 1,
        chance: 1,
        cooldownTicks: 12,
        requiresUniqueUnlock: false,
        alwaysActive: true,
        ...overrides,
    };
}

function createLuckEffect(tierName, label = "Luck", overrides = {}) {
    const preset = {
        diamond: { chance: 1, xpAmount: 3 },
        netherite: { chance: 1, xpAmount: 4 },
        titanium: { chance: 1, xpAmount: 4 },
    }[tierName] ?? { chance: 1, xpAmount: 3 };

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
    const preset = {
        diamond: { chance: 0.18, damageRatio: 0.18, cooldownTicks: 18 },
        netherite: { chance: 0.22, damageRatio: 0.22, cooldownTicks: 16 },
        titanium: { chance: 0.21, damageRatio: 0.2, cooldownTicks: 16 },
    }[tierName] ?? { chance: 0.18, damageRatio: 0.18, cooldownTicks: 18 };

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
    const preset = {
        wood: { chance: 0.16, durationTicks: 70, damageBonus: 0.05 },
        stone: { chance: 0.18, durationTicks: 80, damageBonus: 0.06 },
        iron: { chance: 0.2, durationTicks: 90, damageBonus: 0.07 },
        golden: { chance: 0.24, durationTicks: 90, damageBonus: 0.08 },
        diamond: { chance: 0.22, durationTicks: 100, damageBonus: 0.08 },
        netherite: { chance: 0.26, durationTicks: 110, damageBonus: 0.1 },
        titanium: { chance: 0.25, durationTicks: 110, damageBonus: 0.1 },
    }[tierName] ?? { chance: 0.18, durationTicks: 80, damageBonus: 0.06 };

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
    const preset = {
        iron: { chance: 0.16, seconds: 3 },
        golden: { chance: 0.18, seconds: 3 },
        diamond: { chance: 0.2, seconds: 4 },
        netherite: { chance: 0.24, seconds: 4 },
        titanium: { chance: 0.24, seconds: 4 },
    }[tierName] ?? { chance: 0.18, seconds: 3 };

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
        key: "operator",
        kind: "operator",
        label: "Operator",
        ...overrides,
    };
}

function createCrushingEffect(overrides = {}) {
    return {
        key: "crushing",
        kind: "crushing",
        label: "Crushing",
        ...overrides,
    };
}

function createGardenerEffect(overrides = {}) {
    return {
        key: "gardener",
        kind: "gardener",
        label: "Gardener",
        ...overrides,
    };
}

function createPrimalEffect(overrides = {}) {
    return {
        key: "primal",
        kind: "primal",
        label: "Primal",
        ...overrides,
    };
}

function createForgerEffect(overrides = {}) {
    return {
        key: "forger",
        kind: "forger",
        label: "Forger",
        ...overrides,
    };
}

function createIgniterEffect(overrides = {}) {
    return {
        key: "igniter",
        kind: "igniter",
        label: "Igniter",
        ...overrides,
    };
}

function createAftershockEffect(tierName, overrides = {}) {
    const preset = {
        iron: { chance: 0.2, damageScale: 0.48, cooldownTicks: 24 },
        diamond: { chance: 0.22, damageScale: 0.52, cooldownTicks: 22 },
        netherite: { chance: 0.26, damageScale: 0.58, cooldownTicks: 20 },
        titanium: { chance: 0.26, damageScale: 0.56, cooldownTicks: 20 },
    }[tierName] ?? { chance: 0.22, damageScale: 0.52, cooldownTicks: 22 };

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
    const preset = {
        wood: { chance: 0.16, durationTicks: 70, damageBonus: 0.05 },
        stone: { chance: 0.18, durationTicks: 80, damageBonus: 0.06 },
        iron: { chance: 0.2, durationTicks: 90, damageBonus: 0.07 },
        golden: { chance: 0.24, durationTicks: 90, damageBonus: 0.08 },
        diamond: { chance: 0.22, durationTicks: 100, damageBonus: 0.08 },
        netherite: { chance: 0.3, durationTicks: 110, damageBonus: 0.11 },
        titanium: { chance: 0.28, durationTicks: 110, damageBonus: 0.1 },
    }[tierName] ?? { chance: 0.22, durationTicks: 100, damageBonus: 0.08 };

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
        key: "pinning_shot",
        kind: "pinning_shot",
        label: "Pinning Shot",
        on: "hit",
        chance: 1,
        requiresProjectile: true,
        durationTicks: 80,
        slownessAmplifier: 1,
        weaknessAmplifier: 0,
        damageBonus: 0.06,
        cooldownTicks: 24,
        ...overrides,
    };
}

function createBallistaEffect(tierName, overrides = {}) {
    const preset = {
        diamond: { chance: 0.18, damageScale: 0.44, cooldownTicks: 16 },
        netherite: { chance: 0.22, damageScale: 0.48, cooldownTicks: 14 },
        titanium: { chance: 0.22, damageScale: 0.47, cooldownTicks: 14 },
    }[tierName] ?? { chance: 0.2, damageScale: 0.45, cooldownTicks: 16 };

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

function createReaperEffect(overrides = {}) {
    return {
        key: "reaper",
        kind: "reaper",
        label: "Reaper",
        on: "hit",
        radius: 4.5,
        damageScale: 0.55,
        ...overrides,
    };
}

function createWormEffect(overrides = {}) {
    return {
        key: "worm",
        kind: "worm",
        label: "Guard Worm",
        damageReduction: 0.4,
        ...overrides,
    };
}

function createBerserkEffect(overrides = {}) {
    return {
        key: "berserk",
        kind: "berserk",
        label: "Berserk",
        durationTicks: 300,
        maxStacks: 10,
        damagePerStack: 1,
        extraPlanksMin: 1,
        extraPlanksMax: 4,
        ...overrides,
    };
}

function createBerserkLoggingEffect(overrides = {}) {
    return {
        key: "berserk_logging",
        kind: "berserk_logging",
        requiresUniqueUnlock: false,
        alwaysActive: true,
        extraPlanksMin: 1,
        extraPlanksMax: 4,
        ...overrides,
    };
}

function createClarityEffect(overrides = {}) {
    return {
        key: "clarity",
        kind: "clarity",
        label: "Clarity",
        ...overrides,
    };
}

function createFeatherstepEffect(overrides = {}) {
    return {
        key: "featherstep",
        kind: "featherstep",
        label: "Featherstep",
        fallDamageMultiplier: 0.2,
        absorptionDurationTicks: 100,
        absorptionAmplifier: 0,
        cooldownTicks: 1200,
        ...overrides,
    };
}

function createToughEffect(overrides = {}) {
    return {
        key: "tough",
        kind: "tough",
        label: "Tough",
        conduitDurationTicks: 600,
        refreshTicks: 200,
        damageReduction: 0.5,
        reducedDamageTypes: ["falling_block", "suffocation", "lightning", "stalactite"],
        ...overrides,
    };
}

const EVENT_TIER_POWER = Object.freeze({
    wood: 0.65,
    stone: 0.75,
    copper: 0.85,
    iron: 1,
    steel: 1.08,
    golden: 1.12,
    diamond: 1.2,
    netherite: 1.4,
    titanium: 1.35,
    aetherium: 1.6,
});

function getEventTierPower(tierName) {
    return EVENT_TIER_POWER[tierName] ?? EVENT_TIER_POWER.iron;
}

function createEventDrivenAttributeProfile(type, branch, tierName) {
    const power = getEventTierPower(tierName);
    const support = type === ITEM_TYPES.support;
    const projectile = ["bow", "crossbow", "trident"].includes(branch);
    const scavenger = type === ITEM_TYPES.tool || type === ITEM_TYPES.hybrid || type === ITEM_TYPES.utility;

    return {
        adaptiveResilience: support ? {
            reductionPerStack: 0.008 * power,
            reductionPerLevel: 0.00018 * power,
            maxReductionPerStack: 0.025,
            maxStacks: 3,
            durationTicks: 100,
        } : null,
        healingEfficiency: support ? {
            bonus: 0.012 * power,
            bonusPerLevel: 0.00025 * power,
            maxBonus: 0.25,
            overhealAbsorptionDurationTicks: 100,
        } : null,
        chargeMastery: projectile ? {
            maxDamageBonus: 0.08 * power,
            damageBonusPerLevel: 0.0015 * power,
            cap: 0.4,
            fullChargeTicks: branch === "crossbow" ? 25 : 20,
        } : null,
        persistence: projectile ? {
            bonusPerHit: 0.025,
            maxBonus: 0.5,
            resetTicks: 200,
        } : null,
        dimensionalAttunement: support ? {
            durationTicks: Math.floor(80 + (power * 30)),
            amplifier: 0,
        } : null,
        scavenging: scavenger ? {
            chance: 0.035 * power,
            chancePerLevel: 0.00075 * power,
            maxChance: 0.3,
            xpAmount: Math.max(1, Math.floor(power * 2)),
            healAmount: 0.5 + (power * 0.35),
        } : null,
    };
}

function createPerfectGuardEffect(tierName) {
    const power = getEventTierPower(tierName);
    return {
        key: "perfect_guard",
        kind: "perfect_guard",
        label: "Perfect Guard",
        windowTicks: 8,
        cooldownTicks: Math.max(35, Math.floor(90 - (power * 18))),
        damageMultiplier: Math.max(0.08, 0.32 - (power * 0.1)),
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
        damageScale: Math.min(0.65, 0.28 + (power * 0.14)),
        fireSeconds: Math.max(2, Math.floor(1 + power)),
        cooldownTicks: Math.max(20, Math.floor(55 - (power * 12))),
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
        damagePerCharge: Math.min(0.15, 0.055 + (power * 0.025)),
        healPerCharge: 0.35 + (power * 0.2),
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
        damageReduction: Math.min(0.75, 0.3 + (power * 0.16)),
        protectionRadius: 3.5 + power,
        cooldownTicks: Math.max(45, Math.floor(110 - (power * 25))),
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
        durationTicks: Math.floor(70 + (power * 35)),
        speedAmplifier: 0,
        resistanceAmplifier: 0,
        cooldownTicks: Math.max(80, Math.floor(260 - (power * 70))),
        unlockTier: "advanced",
        requiresAdvancedUnlock: true,
    };
}

function createDashEffect() {
    return {
        key: "dash",
        kind: "dash",
        label: "Boot Dash",
        strength: 1.35,
        verticalBoost: 0.12,
        cooldownTicks: 70,
        requiresUniqueUnlock: false,
        alwaysActive: true,
    };
}

function createElytraWindLaunchEffect() {
    return {
        key: "elytra_wind_launch",
        kind: "elytra_wind_launch",
        label: "Wind Launch",
        horizontalBoost: 0.9,
        verticalBoost: 0.82,
        cooldownTicks: 45,
        requiresUniqueUnlock: false,
        alwaysActive: true,
    };
}

function createEventDrivenAbilitySet(type, branch, tierName, hasCombatProfile) {
    const attributes = [];
    const support = [];

    if (hasCombatProfile) {
        attributes.push(createSoulCollectorEffect(tierName));
    }
    if (["bow", "crossbow", "trident"].includes(branch)) {
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
        return [createRetaliateEffect(tierName)];
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
            blockXp: isWeapon || isSupport ? 0 : (isTool || isHybrid ? 0 : tier.blockXp),
            oreXp: isWeapon || isSupport ? 0 : (isTool || isHybrid ? 0 : tier.oreXp),
            toolXp: isTool || isHybrid ? tier.toolXp : 0,
            // Preservation is tied to Defense for both armor and compatible
            // mining equipment, so both categories need a real Defense track.
            armorXp: isSupport || supportsMiningTrouble ? 2 : 0,
            baseXp: 60,
            growth: 1.22
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
                precisionBonus: hasCombatProfile ? (isWeapon ? 0.025 : 0.01) : 0
            },
            penetration: {
                percent: hasCombatProfile ? (isTool ? tier.penetration * 0.35 : tier.penetration) : 0,
                perLevel: hasCombatProfile ? weakGrowth : 0,
                cap: hasCombatProfile ? Math.max(0.45, tier.penetrationCap) : 0,
                bossScalar: 0.55,
                bossCap: 0.2
            },
            lifesteal: {
                percent: hasCombatProfile && !isTool ? tier.lifesteal : 0,
                perLevel: hasCombatProfile && !isTool ? weakGrowth : 0,
                cap: hasCombatProfile ? 0.25 : 0,
                critBonus: hasCombatProfile ? (isWeapon ? 0.01 : 0.004) : 0
            },
            effects: []
        },
        support: {
            // Keep existing material base values; tier-specific caps and
            // Aetherium-only overrides are intentionally gone.
            damageReduction: isSupport ? (tierName === "netherite" ? 0.01 : tierName === "diamond" ? 0.007 : 0.009) : 0,
            damageReductionPerLevel: isSupport ? weakGrowth : 0,
            maxDamageReduction: 0.12,
            durabilityPreserveChance: isSupport ? 0.01 : 0,
            durabilityPreserveChancePerLevel: isSupport ? 0.01 : 0,
            maxDurabilityPreserveChance: Number.POSITIVE_INFINITY,
            negateAllDamageChance: isSupport ? supportNegation.chance : 0,
            negateAllDamageChancePerLevel: isSupport ? supportNegation.perLevel : 0,
            maxNegateAllDamageChance: isSupport ? supportNegation.cap : 0,
            effects: isSupport ? createArmorAbilitySet(id, branch, tierName) : []
        },
        mining: {
            bonusLootChance: isWeapon || isSupport ? 0 : tier.miningBonus + tier.oreBonus,
            bonusLootChancePerLevel: isWeapon || isSupport ? 0 : weakGrowth,
            durabilitySaveChance: isSupport ? 0 : 0.01,
            durabilitySaveChancePerLevel: isSupport ? 0 : 0.01,
            strongAttributes: supportsMiningTrouble ? {
                doubleTrouble: {
                    baseChance: 0.01,
                    chancePer10Levels: 0.01,
                    maxChance: 0.2,
                },
                tripleTrouble: {
                    chanceScale: 0.1,
                },
            } : {},
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
        merged?.support?.effects
    ].some(value => Array.isArray(value) && value.length > 0);

    if (merged.uniqueAbilityUnlock === undefined && hasUniqueEffects) {
        merged.uniqueAbilityUnlock = "totem";
    }

    return merged;
}

const CANONICAL_TIER_TOKENS = Object.freeze({
    wooden: "wood",
    wood: "wood",
    stone: "stone",
    copper: "copper",
    iron: "iron",
    steel: "steel",
    gold: "golden",
    golden: "golden",
    diamond: "diamond",
    netherite: "netherite",
    titanium: "titanium",
    aetherium: "aetherium",
});

const ADVANCED_ABILITY_TIERS = new Set(["diamond", "netherite", "titanium", "aetherium"]);

function getItemPath(id) {
    return String(id ?? "").toLowerCase().split(":").pop() ?? "";
}

function inferItemType(branch) {
    if (["drill", "knife", "lighter", "shears"].includes(branch)) return ITEM_TYPES.utility;
    if (["helmet", "chestplate", "leggings", "boots", "shield", "elytra"].includes(branch)) return ITEM_TYPES.support;
    if (["sword", "mace", "trident", "bow", "crossbow", "spear"].includes(branch)) return ITEM_TYPES.weapon;
    if (["axe", "paxel", "aiot"].includes(branch)) return ITEM_TYPES.hybrid;
    if (["pickaxe", "shovel", "hoe", "hammer"].includes(branch)) return ITEM_TYPES.tool;
    return ITEM_TYPES.utility;
}

function inferTierName(id, branch) {
    const path = getItemPath(id);
    const tokens = path.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const token of tokens) {
        if (CANONICAL_TIER_TOKENS[token]) return CANONICAL_TIER_TOKENS[token];
    }

    if (path.includes("heavy_drill") || path.includes("smelting")) return "netherite";
    if (path.includes("flint_knife") || branch === "shears" || branch === "shield" || branch === "elytra" || path.includes("turtle")) return "diamond";
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

    return {
        [ITEM_TYPES.weapon]: AFFINITIES.aggression,
        [ITEM_TYPES.hybrid]: AFFINITIES.technique,
        [ITEM_TYPES.tool]: AFFINITIES.mining,
        [ITEM_TYPES.support]: AFFINITIES.survival,
        [ITEM_TYPES.utility]: AFFINITIES.hybrid,
    }[type] ?? AFFINITIES.hybrid;
}

function getInferredSpecialOverrides(id, tierName, type, branch) {
    const path = getItemPath(id);
    const advanced = ADVANCED_ABILITY_TIERS.has(tierName);

    if (path.includes("smelting") && branch === "pickaxe") {
        return {
            rarity: "tool",
            progression: { toolXp: 4, oreXp: 5, combatXp: 0 },
            attributes: { effects: [createFireEffect("netherite", "Forger", { chance: 1, seconds: 4 })] },
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
                crit: { chance: 0, chancePerLevel: 0, maxChance: 0, multiplier: 1, multiplierPerLevel: 0, maxMultiplier: 1, openingBonus: 0, precisionBonus: 0 },
                penetration: { percent: 0, perLevel: 0, cap: 0, bossScalar: 0 },
                lifesteal: { percent: 0, perLevel: 0, cap: 0, critBonus: 0 },
                effects: [createIgniterEffect()],
            },
        };
    }

    if (branch === "drill") {
        const heavy = path.includes("heavy");
        return {
            rarity: "utility",
            mining: {
                bonusLootChance: heavy ? 0.15 : 0.12,
                ...(heavy ? { durabilitySaveChance: 0.035 } : {}),
                effects: [createOperatorEffect({ size: heavy ? 5 : 3 })],
            },
        };
    }

    if (branch === "knife") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            attributes: { flatDamageBonus: 4, effects: [createBleedEffect("diamond", { label: "Primal", durationTicks: 100, damageRatio: 0.14 })] },
            mining: { bonusLootChance: 0.035, durabilitySaveChance: 0.01, effects: [createPrimalEffect()] },
        };
    }

    if (branch === "shears") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            mining: { bonusLootChance: 0.02, durabilitySaveChance: 0.01, effects: [createGardenerEffect()] },
        };
    }

    if (branch === "shield") {
        return {
            rarity: "utility",
            progression: { armorXp: 1 },
            support: {
                damageReduction: 0.60,
                damageReductionPerLevel: 0,
                maxDamageReduction: 0.60,
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
        return { attributes: { effects: [createMarkEffect(tierName, "Skewer", { kind: "skewer", damageBonus: 0.1 })] } };
    }
    if (branch === "mace") return { attributes: { effects: [createAftershockEffect(tierName)] } };
    if (branch === "trident") return { attributes: { effects: [createHarpoonEffect(tierName)] } };
    if (branch === "bow") {
        return {
            attributes: {
                crit: { chance: 0.08, chancePerLevel: 0.0032, maxChance: 0.4, multiplier: 1.5, multiplierPerLevel: 0.005, maxMultiplier: 2.15, openingBonus: 0.05, precisionBonus: 0.06 },
                effects: [createPinningShotEffect()],
            },
        };
    }
    if (branch === "crossbow") {
        return { attributes: { penetration: { percent: 0.08, perLevel: 0.004, cap: 0.34, bossScalar: 0.65, bossCap: 0.2 }, effects: [createBallistaEffect(tierName)] } };
    }

    if (branch === "axe") return { attributes: { effects: [createBerserkEffect()] }, mining: { effects: [createBerserkLoggingEffect()] } };
    if (!advanced) return {};
    if (branch === "sword") return { attributes: { effects: [createBleedEffect(tierName), createSweepEffect(tierName)] } };
    if (branch === "pickaxe") return { mining: { effects: [createLuckEffect(tierName)] } };
    if (branch === "shovel") return { mining: { effects: [createWormEffect()] } };
    if (branch === "hoe") return { attributes: { flatDamageBonus: 2, effects: [createReaperEffect()] }, mining: { effects: [createReaperEffect()] } };
    if (branch === "hammer") return { mining: { effects: [createCrushingEffect()] } };
    if (branch === "aiot") {
        return {
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
export function inferDynamicDefinition(id) {
    const normalizedId = String(id ?? "").toLowerCase();
    const branch = inferBranch(normalizedId, null);
    if (!branch) return null;

    const type = inferItemType(branch);
    // Third-party axes are eligible for Berserk as long as their identifier
    // ends in _axe, even when the addon uses an unknown material token.
    const tierName = inferTierName(normalizedId, branch) ?? (branch === "axe" ? "iron" : null);
    if (!tierName) return null;

    const affinity = inferAffinity(type, branch, tierName);
    return baseDefinition(normalizedId, tierName, type, affinity, getInferredSpecialOverrides(normalizedId, tierName, type, branch));
}

// Built-in equipment is inferred from its typeId. Third-party addons can still
// register explicit definitions through the public registry API when needed.

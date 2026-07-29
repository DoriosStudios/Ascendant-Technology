import { AFFINITIES, ITEM_TYPES } from "./constants.js";
import { deepMerge } from "./utils.js";

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
    lucky: buildTierPreset({
        rarity: "unique",
        combatXp: 3,
        blockXp: 2,
        oreXp: 7,
        toolXp: 6,
        critChance: 0.11,
        critLevel: 0.0035,
        critMultiplier: 1.42,
        critMultiplierLevel: 0.008,
        penetration: 0.08,
        penetrationLevel: 0.0035,
        penetrationCap: 0.28,
        lifesteal: 0.01,
        lifestealLevel: 0.0005,
        miningBonus: 0.08,
        miningLevel: 0.003,
        oreBonus: 0.13,
        oreLevel: 0.004,
        durabilitySave: 0.055,
        durabilitySaveLevel: 0.0025
    }, 5)
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
    lucky: 0.036,
});

function getWeakAttributeGrowth(tierName) {
    return WEAK_ATTRIBUTE_GROWTH[tierName] ?? WEAK_ATTRIBUTE_GROWTH.titanium;
}

function getArmorSlotName(id) {
    const normalizedId = String(id ?? "").toLowerCase();
    if (normalizedId.endsWith("_helmet")) return "helmet";
    if (normalizedId.endsWith("_chestplate")) return "chestplate";
    if (normalizedId.endsWith("_leggings")) return "leggings";
    if (normalizedId.endsWith("_boots")) return "boots";
    return "generic";
}

function getSupportNegationConfig(id, tierName) {
    const slot = getArmorSlotName(id);
    const scalar = SUPPORT_SLOT_SCALARS[slot] ?? SUPPORT_SLOT_SCALARS.generic;

    const tierBase = {
        diamond: { chance: 0.006, perLevel: 0.00025, cap: 0.02 },
        netherite: { chance: 0.009, perLevel: 0.0003, cap: 0.028 },
        titanium: { chance: 0.008, perLevel: 0.00028, cap: 0.026 },
        aetherium: { chance: 0.012, perLevel: 0.00036, cap: 0.038 },
        lucky: { chance: 0.014, perLevel: 0.00042, cap: 0.044 }
    }[tierName] ?? { chance: 0.006, perLevel: 0.00025, cap: 0.02 };

    return {
        chance: tierBase.chance * scalar,
        perLevel: tierBase.perLevel * scalar,
        cap: tierBase.cap * scalar
    };
}

function getSupportDamageImmunities(id, tierName) {
    const normalizedId = String(id ?? "").toLowerCase();
    const slot = getArmorSlotName(id);

    if (normalizedId === "minecraft:turtle_helmet") return [];

    if (slot === "helmet") {
        return ["suffocation"];
    }

    if (slot === "chestplate") {
        if (tierName === "aetherium") return ["fire", "fire_tick", "lava"];
        if (tierName === "netherite") return ["fire", "lava"];
        if (tierName === "titanium") return ["contact"];
    }

    if (slot === "leggings" && (tierName === "titanium" || tierName === "aetherium")) {
        return ["freezing"];
    }

    return [];
}

function getSupportVulnerabilities(tierName) {
    if (tierName === "diamond") return ["magic"];
    if (tierName === "netherite") return ["freezing"];
    if (tierName === "titanium") return ["lightning"];
    if (tierName === "aetherium") return ["void"];
    return [];
}

function getSupportVulnerabilityPenalty(tierName) {
    if (tierName === "diamond") return 0.06;
    if (tierName === "netherite") return 0.04;
    if (tierName === "titanium") return 0.05;
    if (tierName === "aetherium") return 0.03;
    return 0;
}

function createEffectKey(label, fallback = "effect") {
    const raw = String(label ?? fallback).trim().toLowerCase();
    return raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function inferBranch(id, type) {
    const normalizedId = String(id ?? "").toLowerCase();

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
        aetherium: { chance: 0.28, durationTicks: 110, damageRatio: 0.17, maxStacks: 2 },
        lucky: { chance: 0.30, durationTicks: 120, damageRatio: 0.18, maxStacks: 2 },
    }[tierName] ?? { chance: 0.18, durationTicks: 80, damageRatio: 0.12, maxStacks: 1 };

    return {
        key: "bleeding",
        kind: "bleed",
        label: "Bleeding",
        on: "hit",
        tickInterval: 20,
        refresh: true,
        ...preset,
        ...overrides,
    };
}

function createSweepEffect(tierName, overrides = {}) {
    const preset = {
        diamond: { chance: 1, cooldownTicks: 18 },
        netherite: { chance: 1, cooldownTicks: 16 },
        titanium: { chance: 1, cooldownTicks: 16 },
        aetherium: { chance: 1, cooldownTicks: 14 },
        lucky: { chance: 1, cooldownTicks: 12 },
    }[tierName] ?? { chance: 1, cooldownTicks: 18 };

    return {
        key: "sweeping",
        kind: "sweep",
        label: "Sweeping",
        on: "hit",
        ...preset,
        radius: 2.5,
        radiusPer5Levels: 0.5,
        maxRadiusLevel: 25,
        damageScale: 0.5,
        damageScalePer5Levels: 0.05,
        maxDamageScale: 1,
        chance: 1,
        cooldownTicks: 0,
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
        aetherium: { chance: 1, xpAmount: 5 },
        lucky: { chance: 1, xpAmount: 6 },
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
        aetherium: { chance: 0.26, damageRatio: 0.26, cooldownTicks: 14 },
        lucky: { chance: 0.3, damageRatio: 0.3, cooldownTicks: 12 },
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
        aetherium: { chance: 0.3, durationTicks: 120, damageBonus: 0.12 },
        lucky: { chance: 0.32, durationTicks: 130, damageBonus: 0.13 },
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
        aetherium: { chance: 0.28, seconds: 5 },
        lucky: { chance: 0.32, seconds: 5 },
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
        key: "ingniter",
        kind: "igniter",
        label: "Ingniter",
        ...overrides,
    };
}

function createAftershockEffect(tierName, overrides = {}) {
    const preset = {
        iron: { chance: 0.2, damageScale: 0.48, cooldownTicks: 24 },
        diamond: { chance: 0.22, damageScale: 0.52, cooldownTicks: 22 },
        netherite: { chance: 0.26, damageScale: 0.58, cooldownTicks: 20 },
        titanium: { chance: 0.26, damageScale: 0.56, cooldownTicks: 20 },
        aetherium: { chance: 0.3, damageScale: 0.64, cooldownTicks: 18 },
        lucky: { chance: 0.34, damageScale: 0.7, cooldownTicks: 16 },
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
        aetherium: { chance: 0.32, durationTicks: 120, damageBonus: 0.13 },
        lucky: { chance: 0.34, durationTicks: 130, damageBonus: 0.14 },
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

function createDeadeyeEffect(overrides = {}) {
    return {
        key: "deadeye",
        kind: "deadeye",
        label: "Deadeye",
        on: "hit",
        chance: 1,
        ...overrides,
    };
}

function createBallistaEffect(tierName, overrides = {}) {
    const preset = {
        diamond: { chance: 0.18, damageScale: 0.44, cooldownTicks: 16 },
        netherite: { chance: 0.22, damageScale: 0.48, cooldownTicks: 14 },
        titanium: { chance: 0.22, damageScale: 0.47, cooldownTicks: 14 },
        aetherium: { chance: 0.26, damageScale: 0.54, cooldownTicks: 12 },
        lucky: { chance: 0.3, damageScale: 0.58, cooldownTicks: 10 },
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
        label: "Worm",
        evadeChance: 0.5,
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

function createSpikesEffect(tierName, overrides = {}) {
    const preset = {
        diamond: { damageRatio: 0.18 },
        netherite: { damageRatio: 0.22 },
        titanium: { damageRatio: 0.2 },
        aetherium: { damageRatio: 0.26 },
        lucky: { damageRatio: 0.3 },
    }[tierName] ?? { damageRatio: 0.18 };

    return {
        key: "spikes",
        kind: "spikes",
        label: "Spikes",
        on: "hurt",
        knockbackHorizontal: 1.35,
        knockbackVertical: 0.42,
        gatherRadius: 1.5,
        gatherStrength: 1.1,
        ...preset,
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

    if (slotKey === "shield") {
        return [createSpikesEffect(tierName)];
    }

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
    const supportNegation = getSupportNegationConfig(id, tierName);
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
            armorXp: tierName === "aetherium" ? 3 : 2,
            baseXp: tierName === "lucky" ? 70 : 60,
            growth: tierName === "aetherium" ? 1.24 : 1.22
        },
        attributes: {
            damagePerLevel: hasCombatProfile ? weakGrowth : 0,
            flatDamageBonus: 0,
            markedDamageBonus: hasCombatProfile ? (tierName === "aetherium" ? 0.08 : 0.04) : 0,
            crit: {
                chance: hasCombatProfile ? (isTool ? tier.critChance * 0.45 : tier.critChance) : 0,
                chancePerLevel: hasCombatProfile ? weakGrowth : 0,
                maxChance: hasCombatProfile ? (tierName === "lucky" ? 0.5 : 0.45) : 0,
                multiplier: hasCombatProfile ? (isTool ? 1.18 : tier.critMultiplier) : 1,
                multiplierPerLevel: hasCombatProfile ? weakGrowth : 0,
                maxMultiplier: hasCombatProfile ? (tierName === "aetherium" ? 2.5 : 2.35) : 1,
                openingBonus: hasCombatProfile ? (isWeapon ? 0.045 : 0.02) : 0,
                precisionBonus: hasCombatProfile ? (isWeapon ? 0.025 : 0.01) : 0
            },
            penetration: {
                percent: hasCombatProfile ? (isTool ? tier.penetration * 0.35 : tier.penetration) : 0,
                perLevel: hasCombatProfile ? weakGrowth : 0,
                cap: hasCombatProfile ? Math.max(0.45, tier.penetrationCap) : 0,
                bossScalar: 0.55
            },
            lifesteal: {
                percent: hasCombatProfile && !isTool ? tier.lifesteal : 0,
                perLevel: hasCombatProfile && !isTool ? weakGrowth : 0,
                cap: hasCombatProfile ? (tierName === "aetherium" ? 0.12 : 0.1) : 0,
                critBonus: hasCombatProfile ? (isWeapon ? 0.01 : 0.004) : 0
            },
            effects: []
        },
        support: {
            damageReduction: isSupport ? (tierName === "aetherium" ? 0.012 : tierName === "netherite" ? 0.01 : tierName === "diamond" ? 0.007 : 0.009) : 0,
            damageReductionPerLevel: isSupport ? weakGrowth : 0,
            maxDamageReduction: tierName === "aetherium" ? 0.16 : tierName === "netherite" ? 0.14 : 0.12,
            durabilityPreserveChance: isSupport ? (tierName === "aetherium" ? 0.035 : tierName === "netherite" ? 0.028 : tierName === "diamond" ? 0.02 : 0.024) : 0,
            durabilityPreserveChancePerLevel: isSupport ? weakGrowth : 0,
            maxDurabilityPreserveChance: tierName === "aetherium" ? 0.26 : 0.22,
            negateAllDamageChance: isSupport ? supportNegation.chance : 0,
            negateAllDamageChancePerLevel: isSupport ? supportNegation.perLevel : 0,
            maxNegateAllDamageChance: isSupport ? supportNegation.cap : 0,
            damageImmunities: isSupport ? getSupportDamageImmunities(id, tierName) : [],
            vulnerabilities: isSupport ? getSupportVulnerabilities(tierName) : [],
            vulnerabilityPenalty: isSupport ? getSupportVulnerabilityPenalty(tierName) : 0,
            effects: isSupport ? createArmorAbilitySet(id, branch, tierName) : []
        },
        mining: {
            bonusDropChance: isWeapon || isSupport ? 0 : tier.miningBonus,
            bonusDropChancePerLevel: isWeapon || isSupport ? 0 : weakGrowth,
            oreBonusChance: isWeapon || isSupport ? 0 : tier.oreBonus,
            oreBonusChancePerLevel: isWeapon || isSupport ? 0 : weakGrowth,
            durabilitySaveChance: isSupport ? 0 : (isWeapon ? 0.01 : tier.durabilitySave),
            durabilitySaveChancePerLevel: isSupport ? 0 : weakGrowth,
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
        }
    };

    if (overrides.progression) {
        definition.progression = { ...definition.progression, ...overrides.progression };
        delete overrides.progression;
    }
    const merged = deepMerge(definition, overrides);
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
    lucky: "lucky",
});

const ADVANCED_ABILITY_TIERS = new Set(["diamond", "netherite", "titanium", "aetherium", "lucky"]);

function getItemPath(id) {
    return String(id ?? "").toLowerCase().split(":").pop() ?? "";
}

function inferItemType(branch) {
    if (["drill", "knife", "lighter", "shears"].includes(branch)) return ITEM_TYPES.utility;
    if (["helmet", "chestplate", "leggings", "boots", "shield"].includes(branch)) return ITEM_TYPES.support;
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
    if (path.includes("flint_knife") || branch === "shears" || branch === "shield" || path.includes("turtle")) return "diamond";
    if (branch === "lighter") return "iron";
    if (branch === "mace" || branch === "trident" || branch === "crossbow") return "netherite";
    if (branch === "bow") return "diamond";
    return null;
}

function inferAffinity(type, branch, tierName) {
    if (branch === "spear") return AFFINITIES.control;
    if (branch === "bow" || branch === "trident") return AFFINITIES.precision;
    if (branch === "crossbow" || branch === "axe") return AFFINITIES.technique;
    if (branch === "sword") return tierName === "diamond" || tierName === "aetherium"
        ? AFFINITIES.precision
        : AFFINITIES.aggression;
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
            mining: { bonusDropChance: 0, oreBonusChance: 0, durabilitySaveChance: 0, effects: [] },
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
                oreBonusChance: heavy ? 0.10 : 0.08,
                bonusDropChance: heavy ? 0.05 : 0.04,
                ...(heavy ? { durabilitySaveChance: 0.035 } : {}),
                effects: [createOperatorEffect({ size: heavy ? 5 : 3 })],
            },
        };
    }

    if (branch === "knife") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            attributes: { flatDamageBonus: 4, effects: [createBleedEffect("diamond", { label: "Primal", chance: 0.34, durationTicks: 100, damageRatio: 0.14 })] },
            mining: { bonusDropChance: 0.035, oreBonusChance: 0, durabilitySaveChance: 0.012, effects: [createPrimalEffect()] },
        };
    }

    if (branch === "shears") {
        return {
            rarity: "utility",
            progression: { oreXp: 0 },
            mining: { bonusDropChance: 0.02, oreBonusChance: 0, durabilitySaveChance: 0.014, effects: [createGardenerEffect()] },
        };
    }

    if (branch === "shield") {
        return {
            rarity: "utility",
            progression: { armorXp: 1 },
            support: {
                damageReduction: 0.006,
                damageReductionPerLevel: 0.00035,
                maxDamageReduction: 0.08,
                durabilityPreserveChance: 0.016,
                durabilityPreserveChancePerLevel: 0.0008,
                maxDurabilityPreserveChance: 0.14,
                negateAllDamageChance: 0.004,
                negateAllDamageChancePerLevel: 0.00014,
                maxNegateAllDamageChance: 0.012,
                damageImmunities: [],
                vulnerabilities: [],
                effects: createArmorAbilitySet(id, "shield", tierName),
            },
        };
    }

    if (type === ITEM_TYPES.support && tierName === "aetherium") {
        return { support: { damageReduction: 0.075, negateAllDamageChance: 0.025 } };
    }

    if (branch === "spear") {
        return { attributes: { effects: [createMarkEffect(tierName, "Skewer", tierName === "netherite" ? { damageBonus: 0.12 } : {})] } };
    }
    if (branch === "mace") return { attributes: { effects: [createAftershockEffect(tierName)] } };
    if (branch === "trident") return { attributes: { effects: [createHarpoonEffect(tierName)] } };
    if (branch === "bow") {
        return {
            attributes: {
                crit: { chance: 0.08, chancePerLevel: 0.0032, maxChance: 0.4, multiplier: 1.28, multiplierPerLevel: 0.007, maxMultiplier: 1.95, openingBonus: 0.05, precisionBonus: 0.06 },
                effects: [createDeadeyeEffect()],
            },
        };
    }
    if (branch === "crossbow") {
        return { attributes: { penetration: { percent: 0.08, perLevel: 0.004, cap: 0.34, bossScalar: 0.65 }, effects: [createBallistaEffect(tierName)] } };
    }

    if (!advanced) return {};
    if (branch === "sword") return { attributes: { effects: [createBleedEffect(tierName)] } };
    if (branch === "axe") return { attributes: { effects: [createBerserkEffect()] }, mining: { effects: [createBerserkLoggingEffect()] } };
    if (branch === "pickaxe") return { mining: { effects: [createLuckEffect(tierName)] } };
    if (branch === "shovel") return { mining: { effects: [createWormEffect()] } };
    if (branch === "hoe") return { attributes: { flatDamageBonus: 2, effects: [createReaperEffect()] }, mining: { effects: [createReaperEffect()] } };
    if (branch === "hammer") return { mining: { effects: [createCrushingEffect()] } };
    if (branch === "aiot") {
        return {
            attributes: { effects: [createSweepEffect(tierName)] },
            mining: tierName === "lucky" ? { effects: [createLuckEffect(tierName)] } : {},
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
    const tierName = inferTierName(normalizedId, branch);
    if (!tierName) return null;

    const affinity = inferAffinity(type, branch, tierName);
    return baseDefinition(normalizedId, tierName, type, affinity, getInferredSpecialOverrides(normalizedId, tierName, type, branch));
}

// Built-in equipment is inferred from its typeId. Third-party addons can still
// register explicit definitions through the public registry API when needed.

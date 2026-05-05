import { AFFINITIES, ITEM_TYPES } from "./constants.js";
import { registerStatsCoreDefinition } from "./core/registry.js";
import { deepMerge } from "./utils.js";

const TIER_PRESETS = Object.freeze({
    wood: Object.freeze({
        rarity: "common",
        combatXp: 1,
        blockXp: 1,
        oreXp: 2,
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
    }),
    stone: Object.freeze({
        rarity: "sturdy",
        combatXp: 1.2,
        blockXp: 1,
        oreXp: 3,
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
    }),
    iron: Object.freeze({
        rarity: "tempered",
        combatXp: 1.6,
        blockXp: 1,
        oreXp: 3.5,
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
    }),
    golden: Object.freeze({
        rarity: "gleaming",
        combatXp: 1.5,
        blockXp: 1,
        oreXp: 3,
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
    }),
    diamond: Object.freeze({
        rarity: "advanced",
        combatXp: 2,
        blockXp: 1,
        oreXp: 4,
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
    }),
    netherite: Object.freeze({
        rarity: "elite",
        combatXp: 2.5,
        blockXp: 1,
        oreXp: 5,
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
    }),
    titanium: Object.freeze({
        rarity: "refined",
        combatXp: 2,
        blockXp: 1,
        oreXp: 5,
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
    }),
    aetherium: Object.freeze({
        rarity: "ascendant",
        combatXp: 3,
        blockXp: 1,
        oreXp: 6,
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
    }),
    lucky: Object.freeze({
        rarity: "unique",
        combatXp: 3,
        blockXp: 2,
        oreXp: 7,
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
    })
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
        diamond: { chance: 0.18, radius: 2.4, maxTargets: 2, damageScale: 0.36, cooldownTicks: 18 },
        netherite: { chance: 0.22, radius: 2.6, maxTargets: 3, damageScale: 0.42, cooldownTicks: 16 },
        titanium: { chance: 0.21, radius: 2.6, maxTargets: 3, damageScale: 0.40, cooldownTicks: 16 },
        aetherium: { chance: 0.26, radius: 2.9, maxTargets: 4, damageScale: 0.48, cooldownTicks: 14 },
        lucky: { chance: 0.30, radius: 3.2, maxTargets: 4, damageScale: 0.52, cooldownTicks: 12 },
    }[tierName] ?? { chance: 0.18, radius: 2.4, maxTargets: 2, damageScale: 0.36, cooldownTicks: 18 };

    return {
        key: "sweeping",
        kind: "sweep",
        label: "Sweeping",
        on: "hit",
        ...preset,
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
    const branch = inferBranch(id, type);
    const hasCombatProfile = !isSupport && !(isTool && NON_COMBAT_TOOL_BRANCHES.has(branch));
    const supportNegation = getSupportNegationConfig(id, tierName);

    const definition = {
        id,
        type,
        tier: tierName,
        rarity: tier.rarity,
        affinity,
        branch,
        maxLevel: tierName === "lucky" ? 35 : 30,
        persistEveryXp: isWeapon ? 18 : 24,
        progression: {
            combatXp: hasCombatProfile ? (isTool ? 1 : tier.combatXp) : 0,
            killXp: hasCombatProfile ? (isTool ? 6 : 12) : 0,
            blockXp: isWeapon || isSupport ? 0 : tier.blockXp,
            oreXp: isWeapon || isSupport ? 0 : tier.oreXp,
            armorXp: tierName === "aetherium" ? 3 : 2,
            baseXp: tierName === "lucky" ? 70 : 60,
            growth: tierName === "aetherium" ? 1.24 : 1.22
        },
        attributes: {
            damagePerLevel: hasCombatProfile ? (isTool ? 0.001 : (isHybrid ? 0.004 : 0.006)) : 0,
            flatDamageBonus: 0,
            markedDamageBonus: hasCombatProfile ? (tierName === "aetherium" ? 0.08 : 0.04) : 0,
            crit: {
                chance: hasCombatProfile ? (isTool ? tier.critChance * 0.45 : tier.critChance) : 0,
                chancePerLevel: hasCombatProfile ? tier.critLevel : 0,
                maxChance: hasCombatProfile ? (tierName === "lucky" ? 0.38 : 0.32) : 0,
                multiplier: hasCombatProfile ? (isTool ? 1.18 : tier.critMultiplier) : 1,
                multiplierPerLevel: hasCombatProfile ? tier.critMultiplierLevel : 0,
                maxMultiplier: hasCombatProfile ? (tierName === "aetherium" ? 1.95 : 1.85) : 1,
                openingBonus: hasCombatProfile ? (isWeapon ? 0.045 : 0.02) : 0,
                precisionBonus: hasCombatProfile ? (isWeapon ? 0.025 : 0.01) : 0
            },
            penetration: {
                percent: hasCombatProfile ? (isTool ? tier.penetration * 0.35 : tier.penetration) : 0,
                perLevel: hasCombatProfile ? tier.penetrationLevel : 0,
                cap: hasCombatProfile ? tier.penetrationCap : 0,
                bossScalar: 0.55
            },
            lifesteal: {
                percent: hasCombatProfile && !isTool ? tier.lifesteal : 0,
                perLevel: hasCombatProfile && !isTool ? tier.lifestealLevel : 0,
                cap: hasCombatProfile ? (tierName === "aetherium" ? 0.065 : 0.045) : 0,
                critBonus: hasCombatProfile ? (isWeapon ? 0.01 : 0.004) : 0
            },
            effects: []
        },
        support: {
            damageReduction: isSupport ? (tierName === "aetherium" ? 0.012 : tierName === "netherite" ? 0.01 : tierName === "diamond" ? 0.007 : 0.009) : 0,
            damageReductionPerLevel: isSupport ? (tierName === "aetherium" ? 0.00075 : 0.0005) : 0,
            maxDamageReduction: tierName === "aetherium" ? 0.16 : tierName === "netherite" ? 0.14 : 0.12,
            durabilityPreserveChance: isSupport ? (tierName === "aetherium" ? 0.035 : tierName === "netherite" ? 0.028 : tierName === "diamond" ? 0.02 : 0.024) : 0,
            durabilityPreserveChancePerLevel: isSupport ? (tierName === "aetherium" ? 0.0018 : 0.0014) : 0,
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
            bonusDropChancePerLevel: isWeapon || isSupport ? 0 : tier.miningLevel,
            oreBonusChance: isWeapon || isSupport ? 0 : tier.oreBonus,
            oreBonusChancePerLevel: isWeapon || isSupport ? 0 : tier.oreLevel,
            durabilitySaveChance: isSupport ? 0 : (isWeapon ? 0.01 : tier.durabilitySave),
            durabilitySaveChancePerLevel: isSupport ? 0 : tier.durabilitySaveLevel,
            effects: [],
            maxBonusDropChance: tierName === "lucky" ? 0.42 : 0.32,
            maxDurabilitySaveChance: tierName === "lucky" ? 0.42 : 0.34
        }
    };

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

const DEFAULT_DEFINITIONS = [
    baseDefinition("minecraft:diamond_sword", "diamond", ITEM_TYPES.weapon, AFFINITIES.precision, {
        attributes: { effects: [createBleedEffect("diamond")] }
    }),
    baseDefinition("minecraft:diamond_axe", "diamond", ITEM_TYPES.hybrid, AFFINITIES.technique, {
        attributes: { effects: [createBerserkEffect()] },
        mining: { effects: [createBerserkLoggingEffect()] }
    }),
    baseDefinition("minecraft:diamond_pickaxe", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createLuckEffect("diamond")] }
    }),
    baseDefinition("minecraft:diamond_shovel", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createWormEffect()] }
    }),
    baseDefinition("minecraft:diamond_hoe", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        attributes: {
            flatDamageBonus: 2,
            effects: [createReaperEffect()]
        },
        mining: { effects: [createReaperEffect()] }
    }),
    baseDefinition("minecraft:diamond_spear", "diamond", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("diamond", "Skewer")] }
    }),
    baseDefinition("minecraft:shears", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        rarity: "utility",
        progression: { oreXp: 0 },
        mining: {
            bonusDropChance: 0.02,
            oreBonusChance: 0,
            durabilitySaveChance: 0.014,
            effects: [createGardenerEffect()],
        }
    }),
    baseDefinition("minecraft:shield", "diamond", ITEM_TYPES.support, AFFINITIES.survival, {
        rarity: "utility",
        progression: { armorXp: 1 },
        branch: "shield",
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
            effects: createArmorAbilitySet("minecraft:shield", "shield", "diamond")
        }
    }),
    baseDefinition("minecraft:diamond_helmet", "diamond", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:turtle_helmet", "diamond", ITEM_TYPES.support, AFFINITIES.survival, {
        rarity: "utility",
        progression: { armorXp: 1 },
        support: {
            damageImmunities: [],
            effects: createArmorAbilitySet("minecraft:turtle_helmet", "helmet", "diamond")
        }
    }),
    baseDefinition("minecraft:diamond_chestplate", "diamond", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:diamond_leggings", "diamond", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:diamond_boots", "diamond", ITEM_TYPES.support, AFFINITIES.survival),

    baseDefinition("minecraft:netherite_sword", "netherite", ITEM_TYPES.weapon, AFFINITIES.aggression, {
        attributes: { effects: [createBleedEffect("netherite")] }
    }),
    baseDefinition("minecraft:netherite_axe", "netherite", ITEM_TYPES.hybrid, AFFINITIES.technique, {
        attributes: { effects: [createBerserkEffect()] },
        mining: { effects: [createBerserkLoggingEffect()] }
    }),
    baseDefinition("minecraft:netherite_pickaxe", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createLuckEffect("netherite")] }
    }),
    baseDefinition("minecraft:netherite_shovel", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createWormEffect()] }
    }),
    baseDefinition("minecraft:netherite_hoe", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        attributes: {
            flatDamageBonus: 2,
            effects: [createReaperEffect()]
        },
        mining: { effects: [createReaperEffect()] }
    }),
    baseDefinition("minecraft:netherite_spear", "netherite", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("netherite", "Skewer", { damageBonus: 0.12 })] }
    }),
    baseDefinition("minecraft:wooden_spear", "wood", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("wood", "Skewer")] }
    }),
    baseDefinition("minecraft:stone_spear", "stone", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("stone", "Skewer")] }
    }),
    baseDefinition("minecraft:iron_spear", "iron", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("iron", "Skewer")] }
    }),
    baseDefinition("minecraft:golden_spear", "golden", ITEM_TYPES.weapon, AFFINITIES.control, {
        attributes: { effects: [createMarkEffect("golden", "Skewer", { chance: 0.28 })] }
    }),
    baseDefinition("minecraft:mace", "netherite", ITEM_TYPES.weapon, AFFINITIES.aggression, {
        attributes: {
            effects: [createAftershockEffect("netherite")]
        }
    }),
    baseDefinition("minecraft:trident", "netherite", ITEM_TYPES.weapon, AFFINITIES.precision, {
        attributes: {
            effects: [createHarpoonEffect("netherite")]
        }
    }),
    baseDefinition("minecraft:bow", "diamond", ITEM_TYPES.weapon, AFFINITIES.precision, {
        attributes: {
            crit: {
                chance: 0.08,
                chancePerLevel: 0.0032,
                maxChance: 0.4,
                multiplier: 1.28,
                multiplierPerLevel: 0.007,
                maxMultiplier: 1.95,
                openingBonus: 0.05,
                precisionBonus: 0.06
            },
            effects: [createDeadeyeEffect()]
        }
    }),
    baseDefinition("minecraft:crossbow", "netherite", ITEM_TYPES.weapon, AFFINITIES.technique, {
        attributes: {
            penetration: {
                percent: 0.08,
                perLevel: 0.004,
                cap: 0.34,
                bossScalar: 0.65
            },
            effects: [createBallistaEffect("netherite")]
        }
    }),
    baseDefinition("minecraft:flint_and_steel", "iron", ITEM_TYPES.tool, AFFINITIES.control, {
        rarity: "utility",
        progression: {
            combatXp: 0,
            killXp: 0,
            blockXp: 0,
            oreXp: 0,
        },
        mining: {
            bonusDropChance: 0,
            oreBonusChance: 0,
            durabilitySaveChance: 0,
            effects: []
        },
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
                precisionBonus: 0
            },
            penetration: {
                percent: 0,
                perLevel: 0,
                cap: 0,
                bossScalar: 0
            },
            lifesteal: {
                percent: 0,
                perLevel: 0,
                cap: 0,
                critBonus: 0
            },
            effects: [createIgniterEffect()]
        }
    }),
    baseDefinition("minecraft:netherite_helmet", "netherite", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:netherite_chestplate", "netherite", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:netherite_leggings", "netherite", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("minecraft:netherite_boots", "netherite", ITEM_TYPES.support, AFFINITIES.survival),

    baseDefinition("utilitycraft:diamond_hammer", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { oreBonusChance: 0.08, bonusDropChance: 0.04, effects: [createCrushingEffect()] }
    }),
    baseDefinition("utilitycraft:diamond_paxel", "diamond", ITEM_TYPES.hybrid, AFFINITIES.hybrid),
    baseDefinition("utilitycraft:diamond_aiot", "diamond", ITEM_TYPES.hybrid, AFFINITIES.hybrid, {
        attributes: { effects: [createSweepEffect("diamond")] }
    }),

    baseDefinition("utilitycraft:netherite_hammer", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { oreBonusChance: 0.11, bonusDropChance: 0.06, effects: [createCrushingEffect()] }
    }),
    baseDefinition("utilitycraft:netherite_paxel", "netherite", ITEM_TYPES.hybrid, AFFINITIES.hybrid),
    baseDefinition("utilitycraft:netherite_aiot", "netherite", ITEM_TYPES.hybrid, AFFINITIES.hybrid, {
        attributes: { effects: [createSweepEffect("netherite")] }
    }),

    baseDefinition("utilitycraft:titanium_sword", "titanium", ITEM_TYPES.weapon, AFFINITIES.aggression, {
        attributes: { effects: [createBleedEffect("titanium")] }
    }),
    baseDefinition("utilitycraft:titanium_axe", "titanium", ITEM_TYPES.hybrid, AFFINITIES.technique, {
        attributes: { effects: [createBerserkEffect()] },
        mining: { effects: [createBerserkLoggingEffect()] }
    }),
    baseDefinition("utilitycraft:titanium_pickaxe", "titanium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createLuckEffect("titanium")] }
    }),
    baseDefinition("utilitycraft:titanium_shovel", "titanium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createWormEffect()] }
    }),
    baseDefinition("utilitycraft:titanium_hoe", "titanium", ITEM_TYPES.tool, AFFINITIES.mining, {
        attributes: {
            flatDamageBonus: 2,
            effects: [createReaperEffect()]
        },
        mining: { effects: [createReaperEffect()] }
    }),
    baseDefinition("utilitycraft:titanium_hammer", "titanium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { oreBonusChance: 0.09, bonusDropChance: 0.045, effects: [createCrushingEffect()] }
    }),
    baseDefinition("utilitycraft:titanium_paxel", "titanium", ITEM_TYPES.hybrid, AFFINITIES.hybrid),
    baseDefinition("utilitycraft:titanium_aiot", "titanium", ITEM_TYPES.hybrid, AFFINITIES.hybrid, {
        attributes: { effects: [createSweepEffect("titanium")] }
    }),

    baseDefinition("utilitycraft:aetherium_sword", "aetherium", ITEM_TYPES.weapon, AFFINITIES.precision, {
        attributes: { effects: [createBleedEffect("aetherium")] }
    }),
    baseDefinition("utilitycraft:aetherium_axe", "aetherium", ITEM_TYPES.hybrid, AFFINITIES.technique, {
        attributes: { effects: [createBerserkEffect()] },
        mining: { effects: [createBerserkLoggingEffect()] }
    }),
    baseDefinition("utilitycraft:aetherium_pickaxe", "aetherium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createLuckEffect("aetherium")] }
    }),
    baseDefinition("utilitycraft:aetherium_shovel", "aetherium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createWormEffect()] }
    }),
    baseDefinition("utilitycraft:aetherium_hoe", "aetherium", ITEM_TYPES.tool, AFFINITIES.mining, {
        attributes: {
            flatDamageBonus: 2,
            effects: [createReaperEffect()]
        },
        mining: { effects: [createReaperEffect()] }
    }),
    baseDefinition("utilitycraft:aetherium_hammer", "aetherium", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { oreBonusChance: 0.13, bonusDropChance: 0.075, effects: [createCrushingEffect()] }
    }),
    baseDefinition("utilitycraft:aetherium_paxel", "aetherium", ITEM_TYPES.hybrid, AFFINITIES.hybrid),
    baseDefinition("utilitycraft:aetherium_aiot", "aetherium", ITEM_TYPES.hybrid, AFFINITIES.hybrid, {
        attributes: { effects: [createSweepEffect("aetherium")] }
    }),

    baseDefinition("utilitycraft:drill", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        rarity: "utility",
        mining: {
            oreBonusChance: 0.08,
            bonusDropChance: 0.04,
            effects: [createOperatorEffect({ size: 3 })]
        }
    }),
    baseDefinition("utilitycraft:heavy_drill", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        rarity: "utility",
        mining: {
            oreBonusChance: 0.10,
            bonusDropChance: 0.05,
            durabilitySaveChance: 0.035,
            effects: [createOperatorEffect({ size: 5 })]
        }
    }),
    baseDefinition("utilitycraft:flint_knife", "diamond", ITEM_TYPES.tool, AFFINITIES.mining, {
        rarity: "utility",
        progression: { oreXp: 0 },
        attributes: {
            flatDamageBonus: 4,
            effects: [createBleedEffect("diamond", { label: "Primal", chance: 0.34, durationTicks: 100, damageRatio: 0.14 })]
        },
        mining: {
            bonusDropChance: 0.035,
            oreBonusChance: 0,
            durabilitySaveChance: 0.012,
            effects: [createPrimalEffect()]
        }
    }),
    baseDefinition("utilitycraft:smelting_pickaxe", "netherite", ITEM_TYPES.tool, AFFINITIES.mining, {
        rarity: "utility",
        attributes: {
            effects: [createFireEffect("netherite", "Forger", { chance: 1, seconds: 4 })]
        },
        mining: {
            effects: [createForgerEffect()]
        }
    }),

    baseDefinition("utilitycraft:lucky_sword", "lucky", ITEM_TYPES.weapon, AFFINITIES.aggression, {
        attributes: { effects: [createBleedEffect("lucky")] }
    }),
    baseDefinition("utilitycraft:lucky_pickaxe", "lucky", ITEM_TYPES.tool, AFFINITIES.mining, {
        mining: { effects: [createLuckEffect("lucky")] }
    }),

    baseDefinition("utilitycraft:lucky_aiot", "lucky", ITEM_TYPES.hybrid, AFFINITIES.hybrid, {
        attributes: {
            effects: [createSweepEffect("lucky")]
        },
        mining: {
            effects: [createLuckEffect("lucky")]
        }
    }),

    baseDefinition("utilitycraft:titanium_helmet", "titanium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:titanium_chestplate", "titanium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:titanium_leggings", "titanium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:titanium_boots", "titanium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:aetherium_helmet", "aetherium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:aetherium_chestplate", "aetherium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:aetherium_leggings", "aetherium", ITEM_TYPES.support, AFFINITIES.survival),
    baseDefinition("utilitycraft:aetherium_boots", "aetherium", ITEM_TYPES.support, AFFINITIES.survival)
];

export function registerDefaultStatsCoreDefinitions() {
    let count = 0;
    for (const definition of DEFAULT_DEFINITIONS) {
        if (registerStatsCoreDefinition(definition.id, definition)) count++;
    }
    return count;
}

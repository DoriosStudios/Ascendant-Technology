// Static defaults only. Formulas, scheduling and mutable state belong to runtime modules.
export const RUNTIME_DEFAULTS = Object.freeze({
    openingWindowTicks: 80,
    feedbackCooldownTicks: 12,
    markCleanupSize: 96,
});

export const PROGRESSION_DEFAULTS = Object.freeze({
    baseXp: 60,
    growth: 1.22,
    persistEveryXp: 24,
});

export const REFINEMENT_LIMITS = Object.freeze({
    directDamage: 18,
    appliedAbilityLevel: 5,
    inheritedAbilityNameLength: 80,
});

export const ADVANCED_INHERITANCE_CHANCE = 0.1;

export const TIER_SCALING = Object.freeze({
    firstTierMultiplier: 1.5,
    perLevelMultiplier: 4,
});

export const ATTRIBUTE_DEFAULTS = Object.freeze({
    critMaxChance: 0.35,
    critMaxMultiplier: 2.25,
    penetrationCap: 0.35,
    bossPenetrationScalar: 0.55,
    bossPenetrationCap: 0.2,
    lifestealCap: 0.08,
    maxDamageMultiplier: 3.25,
});

export const REFINEMENT_ROLL_VALUES = Object.freeze({
    steadyThreshold: 0.32,
    minQualityPerIngotPower: 0.012,
    maxQualityPerIngotPower: 0.018,
    normalMinQualityCap: 0.98,
    advancedMinQualityCap: 0.99,
    normalMaxQualityCap: 0.99,
    advancedMaxQualityCap: 1,
    varianceBase: 0.92,
    varianceSpread: 0.16,
    normalDirectDamageCap: 12,
    chanceCap: 0.99,
});

export const AFFINITY_MODIFIERS = Object.freeze({
    aggression: Object.freeze({ damage: 0.03, critChance: 0.012, lifesteal: 0 }),
    sustain: Object.freeze({ damage: 0, critChance: 0, lifesteal: 0.008 }),
    precision: Object.freeze({ damage: 0, critChance: 0.018, lifesteal: 0, precisionBonus: 0.04 }),
    control: Object.freeze({ damage: 0, critChance: 0.006, lifesteal: 0, effectChance: 0.02 }),
    mining: Object.freeze({ damage: 0, critChance: 0, lifesteal: 0, miningChance: 0.018 }),
    default: Object.freeze({ damage: 0.01, critChance: 0.004, lifesteal: 0.002, miningChance: 0.006 }),
});

// Separate names retain the independent contracts of each cache.
export const CACHE_LIMITS = Object.freeze({
    statesPerDefinition: 128,
    equipmentContexts: 128,
    feedbackPreferences: 128,
    feedbackCooldowns: 256,
    recentCombatContacts: 512,
});

export const ARMOR_VALUES = Object.freeze({
    totalDamageReduction: 0.9,
    totalKnockbackResistance: 1,
    componentDamageReduction: 0.05,
    componentDamageNegation: 0.025,
    componentKnockbackResistance: 0.1,
    maxComponentReduction: 0.9,
    maxComponentKnockbackResistance: 1,
    offhandShieldReduction: 0.6,
});

export const PRESERVATION_VALUES = Object.freeze({
    perLevel: 0.005,
    baseCap: 0.35,
    earthCap: 0.55,
    earthBonus: 0.08,
    earthQualityBonus: 0.12,
    repairAmount: 1,
    earthRepairAmount: 2,
    earthReductionBonus: 0.04,
    earthQualityReductionBonus: 0.08,
});

export const EFFECT_STATE_VALUES = Object.freeze({
    cleanupIntervalTicks: 20,
    insightResyncIntervalTicks: 40,
    maxEffectLevel: 20,
});

export const PRESENTATION_VALUES = Object.freeze({
    maxVisibleLoreAttributes: 3,
    actionbarLifetimeTicks: 100,
    insightReadyGraceTicks: 60,
});

export const MOBILITY_VALUES = Object.freeze({
    bootDoubleInputWindowTicks: 5,
    elytraDoubleJumpWindowTicks: 12,
    airPunchFallSpeed: -0.08,
    heightRayDistance: 48,
    windMiningHasteStepTicks: 24,
    windMiningMaxHasteLevel: 5,
});

export const DEFAULT_REFINEMENT_BONUSES = Object.freeze({
    damageMultiplier: 0,
    extraDamage: 0,
    flatDamageBonus: 0,
    critChance: 0,
    critMultiplier: 0,
    critDamageBonus: 0,
    penetration: 0,
    lifesteal: 0,
    elementalChance: 0,
    elementalDamage: 0,
    elemental: Object.freeze({
        id: "",
        label: "",
        chance: 0,
        damage: 0,
        damageScale: 0,
        durationTicks: 0,
        amplifier: 0,
        seconds: 0,
        quality: 0
    }),
    damageReduction: 0,
    negateAllDamageChance: 0,
    bonusLootChance: 0,
    durabilitySaveChance: 0,
    durabilityPreserveChance: 0
});

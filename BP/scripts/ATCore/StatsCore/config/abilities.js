// Static ability templates and tier presets. Runtime factories create fresh mutable effects.
export const BLEED_TIER_PRESETS = Object.freeze({
    diamond: { chance: 0.18, durationTicks: 80, damageRatio: 0.12, maxStacks: 1 },
    netherite: { chance: 0.22, durationTicks: 90, damageRatio: 0.14, maxStacks: 1 },
    titanium: { chance: 0.21, durationTicks: 90, damageRatio: 0.14, maxStacks: 1 },
});
export const BLEED_FALLBACK = Object.freeze({ chance: 0.18, durationTicks: 80, damageRatio: 0.12, maxStacks: 1 });

export const LUCK_TIER_PRESETS = Object.freeze({
    diamond: { chance: 1, xpAmount: 3 },
    netherite: { chance: 1, xpAmount: 4 },
    titanium: { chance: 1, xpAmount: 4 },
});
export const LUCK_FALLBACK = Object.freeze({ chance: 1, xpAmount: 3 });

export const RETALIATE_TIER_PRESETS = Object.freeze({
    diamond: { chance: 0.18, damageRatio: 0.18, cooldownTicks: 18 },
    netherite: { chance: 0.22, damageRatio: 0.22, cooldownTicks: 16 },
    titanium: { chance: 0.21, damageRatio: 0.2, cooldownTicks: 16 },
});
export const RETALIATE_FALLBACK = Object.freeze({ chance: 0.18, damageRatio: 0.18, cooldownTicks: 18 });

export const MARK_TIER_PRESETS = Object.freeze({
    wood: { chance: 0.16, durationTicks: 70, damageBonus: 0.05 },
    stone: { chance: 0.18, durationTicks: 80, damageBonus: 0.06 },
    iron: { chance: 0.2, durationTicks: 90, damageBonus: 0.07 },
    golden: { chance: 0.24, durationTicks: 90, damageBonus: 0.08 },
    diamond: { chance: 0.22, durationTicks: 100, damageBonus: 0.08 },
    netherite: { chance: 0.26, durationTicks: 110, damageBonus: 0.1 },
    titanium: { chance: 0.25, durationTicks: 110, damageBonus: 0.1 },
});
export const MARK_FALLBACK = Object.freeze({ chance: 0.18, durationTicks: 80, damageBonus: 0.06 });

export const FIRE_TIER_PRESETS = Object.freeze({
    iron: { chance: 0.16, seconds: 3 },
    golden: { chance: 0.18, seconds: 3 },
    diamond: { chance: 0.2, seconds: 4 },
    netherite: { chance: 0.24, seconds: 4 },
    titanium: { chance: 0.24, seconds: 4 },
});
export const FIRE_FALLBACK = Object.freeze({ chance: 0.18, seconds: 3 });

export const AFTERSHOCK_TIER_PRESETS = Object.freeze({
    iron: { chance: 0.2, damageScale: 0.48, cooldownTicks: 24 },
    diamond: { chance: 0.22, damageScale: 0.52, cooldownTicks: 22 },
    netherite: { chance: 0.26, damageScale: 0.58, cooldownTicks: 20 },
    titanium: { chance: 0.26, damageScale: 0.56, cooldownTicks: 20 },
});
export const AFTERSHOCK_FALLBACK = Object.freeze({ chance: 0.22, damageScale: 0.52, cooldownTicks: 22 });

export const HARPOON_TIER_PRESETS = Object.freeze({
    wood: { chance: 0.16, durationTicks: 70, damageBonus: 0.05 },
    stone: { chance: 0.18, durationTicks: 80, damageBonus: 0.06 },
    iron: { chance: 0.2, durationTicks: 90, damageBonus: 0.07 },
    golden: { chance: 0.24, durationTicks: 90, damageBonus: 0.08 },
    diamond: { chance: 0.22, durationTicks: 100, damageBonus: 0.08 },
    netherite: { chance: 0.3, durationTicks: 110, damageBonus: 0.11 },
    titanium: { chance: 0.28, durationTicks: 110, damageBonus: 0.1 },
});
export const HARPOON_FALLBACK = Object.freeze({ chance: 0.22, durationTicks: 100, damageBonus: 0.08 });

export const BALLISTA_TIER_PRESETS = Object.freeze({
    diamond: { chance: 0.18, damageScale: 0.44, cooldownTicks: 16 },
    netherite: { chance: 0.22, damageScale: 0.48, cooldownTicks: 14 },
    titanium: { chance: 0.22, damageScale: 0.47, cooldownTicks: 14 },
});
export const BALLISTA_FALLBACK = Object.freeze({ chance: 0.2, damageScale: 0.45, cooldownTicks: 16 });

export const ABILITY_DEFAULTS = Object.freeze({
    sweep: Object.freeze({
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
    }),
    operator: Object.freeze({
        key: "operator",
        kind: "operator",
        label: "Operator",
    }),
    crushing: Object.freeze({
        key: "crushing",
        kind: "crushing",
        label: "Crushing",
    }),
    gardener: Object.freeze({
        key: "gardener",
        kind: "gardener",
        label: "Gardener",
    }),
    primal: Object.freeze({
        key: "primal",
        kind: "primal",
        label: "Primal",
    }),
    forger: Object.freeze({
        key: "forger",
        kind: "forger",
        label: "Forger",
    }),
    igniter: Object.freeze({
        key: "igniter",
        kind: "igniter",
        label: "Igniter",
    }),
    pinningShot: Object.freeze({
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
    }),
    arrowVolley: Object.freeze({
        key: "arrow_volley",
        kind: "arrow_volley",
        label: "Arrow Volley",
        on: "hit",
        requiresProjectile: true,
        chance: 0.2,
        range: 8,
        maxTargets: 4,
        arrowSpeed: 2.5,
        arrowImpulse: 0.15,
        cooldownTicks: 30,
    }),
    reaper: Object.freeze({
        key: "reaper",
        kind: "reaper",
        label: "Reaper",
        on: "hit",
        radius: 4.5,
        damageScale: 0.55,
    }),
    worm: Object.freeze({
        key: "worm",
        kind: "worm",
        label: "Guard Worm",
        damageReduction: 0.4,
    }),
    berserk: Object.freeze({
        key: "berserk",
        kind: "berserk",
        label: "Berserk",
        durationTicks: 300,
        maxStacks: 5,
        damagePerStack: 1,
        extraPlanksMin: 1,
        extraPlanksMax: 4,
    }),
    berserkLogging: Object.freeze({
        key: "berserk_logging",
        kind: "berserk_logging",
        requiresUniqueUnlock: false,
        alwaysActive: true,
        extraPlanksMin: 1,
        extraPlanksMax: 4,
    }),
    clarity: Object.freeze({
        key: "clarity",
        kind: "clarity",
        label: "Clarity",
    }),
    featherstep: Object.freeze({
        key: "featherstep",
        kind: "featherstep",
        label: "Featherstep",
        fallDamageMultiplier: 0.2,
        absorptionDurationTicks: 100,
        absorptionAmplifier: 0,
        cooldownTicks: 1200,
    }),
    tough: Object.freeze({
        key: "tough",
        kind: "tough",
        label: "Tough",
        conduitDurationTicks: 600,
        refreshTicks: 200,
        damageReduction: 0.5,
        reducedDamageTypes: Object.freeze(["falling_block", "suffocation", "lightning", "stalactite"]),
    }),
    armored: Object.freeze({
        key: "armored",
        kind: "armored",
        label: "Armored",
        negatedDamageTypes: Object.freeze(["projectile"]),
        reducedDamageTypes: Object.freeze(["block_explosion", "entity_explosion"]),
        damageReduction: 0.5,
    }),
    dash: Object.freeze({
        key: "dash",
        kind: "dash",
        label: "Boot Dash",
        strength: 1.35,
        verticalBoost: 0.12,
        cooldownTicks: 70,
        requiresUniqueUnlock: false,
        alwaysActive: true,
    }),
    elytraWindLaunch: Object.freeze({
        key: "elytra_wind_launch",
        kind: "elytra_wind_launch",
        label: "Wind Launch",
        horizontalBoost: 0.9,
        verticalBoost: 0.82,
        cooldownTicks: 45,
        requiresUniqueUnlock: false,
        alwaysActive: true,
    }),
});

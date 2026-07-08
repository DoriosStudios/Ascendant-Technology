import { AFFINITIES } from "../constants.js";
import { clamp01, normalizeChance, toFiniteNumber } from "../utils.js";
import { getCategoriesForDefinition } from "../core/state.js";
import { getStatsRefinementReserveXp, hasStatsRefinementBonuses, normalizeStatsRefinementData } from "../core/refinement.js";

function scaleValue(base, perLevel, level, cap = Number.POSITIVE_INFINITY) {
    const scaled = toFiniteNumber(base, 0) + Math.max(0, level - 1) * toFiniteNumber(perLevel, 0);
    return Math.min(cap, Math.max(0, scaled));
}

function normalizeDamageTypeList(values) {
    if (!Array.isArray(values)) return [];

    const normalized = [];
    const seen = new Set();
    for (const value of values) {
        if (typeof value !== "string") continue;

        const next = value.trim().toLowerCase();
        if (!next || seen.has(next)) continue;

        seen.add(next);
        normalized.push(next);
    }

    return normalized;
}

function normalizeEffectList(values) {
    if (!Array.isArray(values)) return [];

    return values
        .filter(value => value && typeof value === "object")
        .map(value => ({ ...value }));
}

function normalizeElementalList(values) {
    if (!Array.isArray(values)) return [];

    return values
        .filter(value => value && typeof value === "object")
        .map(value => ({
            ...value,
            id: String(value.id ?? value.key ?? value.type ?? "").trim().toLowerCase(),
            label: typeof value.label === "string" ? value.label : "",
            chance: normalizeChance(value.chance, 0),
            damage: Math.max(0, toFiniteNumber(value.damage, 0)),
            damageScale: Math.max(0, toFiniteNumber(value.damageScale, 0)),
            durationTicks: Math.max(0, Math.floor(toFiniteNumber(value.durationTicks, 0))),
            amplifier: Math.max(0, Math.floor(toFiniteNumber(value.amplifier, 0))),
            seconds: Math.max(0, Math.floor(toFiniteNumber(value.seconds, 0)))
        }))
        .filter(value => value.id && (value.chance > 0 || value.damage > 0 || value.damageScale > 0));
}

function resolveUnlockedEffects(values, abilitiesUnlocked) {
    const effects = normalizeEffectList(values);
    if (abilitiesUnlocked) {
        return effects;
    }

    return effects.filter(effect => effect?.requiresUniqueUnlock === false || effect?.alwaysActive === true);
}

function areUniqueAbilitiesUnlocked(definition, state) {
    if (String(definition?.uniqueAbilityUnlock ?? "").toLowerCase() !== "totem") {
        return true;
    }

    return state?.abilityData?.uniqueUnlocked === true;
}

function affinityModifiers(affinity) {
    switch (affinity) {
        case AFFINITIES.aggression:
            return { damage: 0.03, critChance: 0.012, lifesteal: 0 };
        case AFFINITIES.sustain:
        case AFFINITIES.survival:
            return { damage: 0, critChance: 0, lifesteal: 0.008 };
        case AFFINITIES.precision:
            return { damage: 0, critChance: 0.018, lifesteal: 0, precisionBonus: 0.04 };
        case AFFINITIES.control:
            return { damage: 0, critChance: 0.006, lifesteal: 0, effectChance: 0.02 };
        case AFFINITIES.mining:
            return { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0.018 };
        default:
            return { damage: 0.01, critChance: 0.004, lifesteal: 0.002, miningChance: 0.006 };
    }
}

/**
 * Resolves the fully effective StatsCore attributes for an item definition + saved state.
 *
 * Runtime modules should use this function instead of reading raw definition values directly,
 * because it already merges level scaling, affinity bonuses, refinement bonuses, and
 * unique-ability gating in one place.
 *
 * @param {object} definition
 * @param {object} state
 * @returns {object}
 */
export function resolveStatsAttributes(definition, state) {
    const categories = getCategoriesForDefinition(definition);
    const offensiveLevel = categories.has("offensive") ? state.progression.offensive.level : 1;
    const defensiveLevel = categories.has("defensive") ? state.progression.defensive.level : 1;
    const miningLevel = categories.has("mining") ? state.progression.mining.level : 1;
    const utilityLevel = categories.has("utility") ? state.progression.utility.level : 1;

    // Use the highest level for general purpose scaling, or specific levels for specific stats.
    const combatLevel = offensiveLevel;
    const supportLevel = defensiveLevel;
    const toolLevel = miningLevel;

    const attributes = definition?.attributes ?? {};
    const mining = definition?.mining ?? {};
    const supportBase = definition?.support ?? {};
    const isSupport = definition?.type === "support";
    const abilitiesUnlocked = areUniqueAbilitiesUnlocked(definition, state);
    const refinement = normalizeStatsRefinementData(state?.refinement);
    const refinementBonuses = refinement.bonuses;
    const mods = isSupport
        ? { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0, precisionBonus: 0 }
        : affinityModifiers(state?.affinity ?? definition?.affinity);

    const critBase = attributes.crit ?? {};
    const penetrationBase = attributes.penetration ?? {};
    const lifestealBase = attributes.lifesteal ?? {};
    const refinementCritDamage = toFiniteNumber(refinementBonuses.critMultiplier, 0)
        + toFiniteNumber(refinementBonuses.critDamageBonus, 0);
    const refinementFlatDamage = toFiniteNumber(refinementBonuses.extraDamage, 0)
        + toFiniteNumber(refinementBonuses.flatDamageBonus, 0);
    const refinementElement = refinementBonuses.elemental ?? {};
    const elemental = isSupport ? [] : [
        ...normalizeElementalList(attributes.elemental),
        ...normalizeElementalList(refinementElement.id ? [refinementElement] : [])
    ];

    const critChance = isSupport ? 0 : normalizeChance(
        scaleValue(critBase.chance, critBase.chancePerLevel, combatLevel, critBase.maxChance ?? 0.35)
        + (mods.critChance ?? 0)
    );
    const lifesteal = isSupport ? 0 : normalizeChance(
        scaleValue(lifestealBase.percent, lifestealBase.perLevel, combatLevel, lifestealBase.cap ?? 0.08)
        + (mods.lifesteal ?? 0)
        + toFiniteNumber(refinementBonuses.lifesteal, 0)
    );

    const critMultiplier = isSupport ? 1 : scaleValue(critBase.multiplier, critBase.multiplierPerLevel, combatLevel, critBase.maxMultiplier ?? 2)
        + refinementCritDamage;
    const damageMultiplier = isSupport ? 1 : 1
        + scaleValue(0, attributes.damagePerLevel, combatLevel)
        + (mods.damage ?? 0)
        + toFiniteNumber(refinementBonuses.damageMultiplier, 0);
    const penetrationPercent = isSupport ? 0 : normalizeChance(
        scaleValue(penetrationBase.percent, penetrationBase.perLevel, combatLevel, penetrationBase.cap ?? 0.35)
        + toFiniteNumber(refinementBonuses.penetration, 0)
    );
    const bonusDropChance = isSupport ? 0 : normalizeChance(
        scaleValue(mining.bonusDropChance, mining.bonusDropChancePerLevel, toolLevel, mining.maxBonusDropChance ?? 0.32)
        + (mods.miningChance ?? 0)
        + toFiniteNumber(refinementBonuses.bonusDropChance, 0)
    );
    const oreBonusChance = isSupport ? 0 : normalizeChance(
        scaleValue(mining.oreBonusChance, mining.oreBonusChancePerLevel, toolLevel, mining.maxBonusDropChance ?? 0.32)
        + (mods.miningChance ?? 0)
        + toFiniteNumber(refinementBonuses.oreBonusChance, 0)
    );
    const durabilitySaveChance = isSupport ? 0 : normalizeChance(
        scaleValue(mining.durabilitySaveChance, mining.durabilitySaveChancePerLevel, toolLevel, mining.maxDurabilitySaveChance ?? 0.35)
        + toFiniteNumber(refinementBonuses.durabilitySaveChance, 0)
    );
    const supportDamageReduction = isSupport ? normalizeChance(
        scaleValue(supportBase.damageReduction, supportBase.damageReductionPerLevel, supportLevel, supportBase.maxDamageReduction ?? 0.16)
        + toFiniteNumber(refinementBonuses.damageReduction, 0)
    ) : 0;
    const supportDurabilityPreserveChance = isSupport ? normalizeChance(
        scaleValue(supportBase.durabilityPreserveChance, supportBase.durabilityPreserveChancePerLevel, supportLevel, supportBase.maxDurabilityPreserveChance ?? 0.26)
        + toFiniteNumber(refinementBonuses.durabilityPreserveChance, 0)
    ) : 0;
    const supportNegateAllDamageChance = isSupport ? normalizeChance(
        scaleValue(supportBase.negateAllDamageChance, supportBase.negateAllDamageChancePerLevel, supportLevel, supportBase.maxNegateAllDamageChance ?? 0.2)
        + toFiniteNumber(refinementBonuses.negateAllDamageChance, 0)
    ) : 0;
    const supportDamageImmunities = isSupport ? normalizeDamageTypeList(supportBase.damageImmunities) : [];
    const supportVulnerabilities = isSupport ? normalizeDamageTypeList(supportBase.vulnerabilities) : [];
    const supportVulnerabilityPenalty = isSupport ? normalizeChance(supportBase.vulnerabilityPenalty, 0) : 0;
    const supportEffects = isSupport ? resolveUnlockedEffects(supportBase.effects, abilitiesUnlocked) : [];

    return {
        levels: {
            offensive: offensiveLevel,
            mining: miningLevel
        },
        damageMultiplier,
        flatDamageBonus: isSupport ? 0 : Math.max(0, toFiniteNumber(attributes.flatDamageBonus, 0) + refinementFlatDamage),
        markedDamageBonus: isSupport ? 0 : clamp01(toFiniteNumber(attributes.markedDamageBonus, 0)),
        crit: {
            chance: isSupport ? 0 : normalizeChance(critChance + toFiniteNumber(refinementBonuses.critChance, 0)),
            multiplier: critMultiplier,
            openingBonus: normalizeChance(critBase.openingBonus, 0),
            precisionBonus: normalizeChance((critBase.precisionBonus ?? 0) + (mods.precisionBonus ?? 0), 0),
            maxChance: normalizeChance(critBase.maxChance, 0.35)
        },
        penetration: {
            percent: penetrationPercent,
            cap: normalizeChance(penetrationBase.cap, 0.35),
            bossScalar: clamp01(toFiniteNumber(penetrationBase.bossScalar, 0.5))
        },
        lifesteal: {
            percent: lifesteal,
            critBonus: normalizeChance(lifestealBase.critBonus, 0),
            cap: normalizeChance(lifestealBase.cap, 0.08)
        },
        elemental,
        effects: isSupport ? [] : resolveUnlockedEffects(attributes.effects, abilitiesUnlocked),
        mining: {
            bonusDropChance,
            oreBonusChance,
            durabilitySaveChance,
            effects: isSupport ? [] : resolveUnlockedEffects(mining.effects, abilitiesUnlocked)
        },
        refinement: {
            active: hasStatsRefinementBonuses(refinement),
            grade: refinement.grade,
            quality: refinement.quality,
            minQuality: refinement.minQuality,
            maxQuality: refinement.maxQuality,
            spentXp: refinement.spentXp,
            reserveXp: getStatsRefinementReserveXp(state),
            rerolls: refinement.rerolls,
            chipId: refinement.chipId,
            chipLabel: refinement.chipLabel,
            ingotId: refinement.ingotId,
            ingotAmount: refinement.ingotAmount,
            bonuses: {
                damageMultiplier: toFiniteNumber(refinementBonuses.damageMultiplier, 0),
                extraDamage: toFiniteNumber(refinementBonuses.extraDamage, 0),
                flatDamageBonus: toFiniteNumber(refinementBonuses.flatDamageBonus, 0),
                critChance: toFiniteNumber(refinementBonuses.critChance, 0),
                critMultiplier: toFiniteNumber(refinementBonuses.critMultiplier, 0),
                critDamageBonus: toFiniteNumber(refinementBonuses.critDamageBonus, 0),
                penetration: toFiniteNumber(refinementBonuses.penetration, 0),
                lifesteal: toFiniteNumber(refinementBonuses.lifesteal, 0),
                elementalChance: toFiniteNumber(refinementBonuses.elementalChance, 0),
                elementalDamage: toFiniteNumber(refinementBonuses.elementalDamage, 0),
                elemental: { ...refinementBonuses.elemental },
                damageReduction: toFiniteNumber(refinementBonuses.damageReduction, 0),
                negateAllDamageChance: toFiniteNumber(refinementBonuses.negateAllDamageChance, 0),
                bonusDropChance: toFiniteNumber(refinementBonuses.bonusDropChance, 0),
                oreBonusChance: toFiniteNumber(refinementBonuses.oreBonusChance, 0),
                durabilitySaveChance: toFiniteNumber(refinementBonuses.durabilitySaveChance, 0),
                durabilityPreserveChance: toFiniteNumber(refinementBonuses.durabilityPreserveChance, 0)
            }
        },
        support: {
            damageReduction: supportDamageReduction,
            durabilityPreserveChance: supportDurabilityPreserveChance,
            damageImmunities: supportDamageImmunities,
            negateAllDamageChance: supportNegateAllDamageChance,
            vulnerabilities: supportVulnerabilities,
            vulnerabilityPenalty: supportVulnerabilityPenalty,
            effects: supportEffects
        }
    };
}

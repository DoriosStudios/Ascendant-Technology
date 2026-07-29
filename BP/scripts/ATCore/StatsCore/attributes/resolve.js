import { AFFINITIES } from "../constants.js";
import { clamp01, normalizeChance, toFiniteNumber } from "../utils.js";
import { getCategoriesForDefinition } from "../core/state.js";
import { getStatsRefinementReserveXp, normalizeStatsRefinementData } from "../core/refinement.js";
import { getWeakAttributePoints } from "../progression/attributes.js";

function scaleValue(base, perLevel, level, cap = Number.POSITIVE_INFINITY) {
    const scaled = toFiniteNumber(base, 0) + Math.max(0, level - 1) * toFiniteNumber(perLevel, 0);
    return Math.min(cap, Math.max(0, scaled));
}

function scaleAttributePoints(base, perPoint, points, cap = Number.POSITIVE_INFINITY) {
    const scaled = toFiniteNumber(base, 0) + Math.max(0, points) * toFiniteNumber(perPoint, 0);
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

function normalizeTroubleAttribute(value, kind) {
    const source = value && typeof value === "object" ? value : {};
    if (kind === "double") {
        const baseChance = normalizeChance(source.baseChance ?? source.chance, 0);
        return baseChance > 0 ? {
            baseChance,
            chancePer10Levels: normalizeChance(source.chancePer10Levels, 0),
            maxChance: Math.max(baseChance, normalizeChance(source.maxChance, baseChance)),
        } : null;
    }

    const chanceScale = Math.max(0, toFiniteNumber(source.chanceScale, 0.01));
    return chanceScale > 0 ? { chanceScale } : null;
}

function resolveUnlockedEffects(values, abilitiesUnlocked, refinementActive) {
    if (!refinementActive) return [];

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

    const isSupport = definition?.type === "support";
    const refinement = normalizeStatsRefinementData(state?.refinement);
    // This is the gameplay gate. A type being supported by StatsCore must never
    // alter vanilla behavior until the Refining Table or test command activates it.
    const refinementActive = state?.refined === true;
    const attributes = refinementActive ? definition?.attributes ?? {} : {};
    const mining = refinementActive ? definition?.mining ?? {} : {};
    const supportBase = refinementActive ? definition?.support ?? {} : {};
    const attributeProgress = refinementActive ? state?.attributeProgress ?? {} : {};
    const abilitiesUnlocked = refinementActive && areUniqueAbilitiesUnlocked(definition, state);
    const refinementBonuses = refinementActive ? refinement.bonuses : normalizeStatsRefinementData().bonuses;
    const mods = isSupport
        ? { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0, precisionBonus: 0 }
        : refinementActive ? affinityModifiers(state?.affinity ?? definition?.affinity) : { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0, precisionBonus: 0 };

    const critBase = attributes.crit ?? {};
    const penetrationBase = attributes.penetration ?? {};
    const lifestealBase = attributes.lifesteal ?? {};
    const bonusDamagePoints = getWeakAttributePoints(attributeProgress, "offensive", "bonus_damage");
    const criticalChancePoints = getWeakAttributePoints(attributeProgress, "offensive", "critical_chance");
    const criticalDamagePoints = getWeakAttributePoints(attributeProgress, "offensive", "critical_damage");
    const penetrationPoints = getWeakAttributePoints(attributeProgress, "offensive", "armor_penetration");
    const lifestealPoints = getWeakAttributePoints(attributeProgress, "offensive", "lifesteal");
    const bonusYieldPoints = getWeakAttributePoints(attributeProgress, "mining", "bonus_yield");
    const oreYieldPoints = getWeakAttributePoints(attributeProgress, "mining", "ore_yield");
    const miningPreservingPoints = getWeakAttributePoints(attributeProgress, "mining", "preserving");
    const damageReductionPoints = getWeakAttributePoints(attributeProgress, "defensive", "damage_reduction");
    const supportPreservingPoints = getWeakAttributePoints(attributeProgress, "defensive", "preserving");
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
        scaleAttributePoints(critBase.chance, critBase.chancePerLevel, criticalChancePoints, critBase.maxChance ?? 0.35)
        + (mods.critChance ?? 0)
    );
    const lifesteal = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(lifestealBase.percent, lifestealBase.perLevel, lifestealPoints, lifestealBase.cap ?? 0.08)
        + (mods.lifesteal ?? 0)
        + toFiniteNumber(refinementBonuses.lifesteal, 0)
    );

    const critMultiplier = isSupport ? 1 : scaleAttributePoints(critBase.multiplier, critBase.multiplierPerLevel, criticalDamagePoints, critBase.maxMultiplier ?? 2)
        + refinementCritDamage;
    const damageMultiplier = isSupport ? 1 : 1
        + scaleAttributePoints(0, attributes.damagePerLevel, bonusDamagePoints)
        + (mods.damage ?? 0)
        + toFiniteNumber(refinementBonuses.damageMultiplier, 0);
    const penetrationPercent = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(penetrationBase.percent, penetrationBase.perLevel, penetrationPoints, penetrationBase.cap ?? 0.35)
        + toFiniteNumber(refinementBonuses.penetration, 0)
    );
    const bonusDropChance = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(mining.bonusDropChance, mining.bonusDropChancePerLevel, bonusYieldPoints)
        + (mods.miningChance ?? 0)
        + toFiniteNumber(refinementBonuses.bonusDropChance, 0)
    );
    const oreBonusChance = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(mining.oreBonusChance, mining.oreBonusChancePerLevel, oreYieldPoints)
        + (mods.miningChance ?? 0)
        + toFiniteNumber(refinementBonuses.oreBonusChance, 0)
    );
    const durabilitySaveChance = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(mining.durabilitySaveChance, mining.durabilitySaveChancePerLevel, miningPreservingPoints)
        + toFiniteNumber(refinementBonuses.durabilitySaveChance, 0)
    );
    const supportDamageReduction = isSupport ? normalizeChance(
        scaleAttributePoints(supportBase.damageReduction, supportBase.damageReductionPerLevel, damageReductionPoints)
        + toFiniteNumber(refinementBonuses.damageReduction, 0)
    ) : 0;
    const supportDurabilityPreserveChance = isSupport ? normalizeChance(
        scaleAttributePoints(supportBase.durabilityPreserveChance, supportBase.durabilityPreserveChancePerLevel, supportPreservingPoints)
        + toFiniteNumber(refinementBonuses.durabilityPreserveChance, 0)
    ) : 0;
    const supportNegateAllDamageChance = isSupport ? normalizeChance(
        scaleValue(supportBase.negateAllDamageChance, supportBase.negateAllDamageChancePerLevel, supportLevel, supportBase.maxNegateAllDamageChance ?? 0.2)
        + toFiniteNumber(refinementBonuses.negateAllDamageChance, 0)
    ) : 0;
    const supportDamageImmunities = isSupport ? normalizeDamageTypeList(supportBase.damageImmunities) : [];
    const supportVulnerabilities = isSupport ? normalizeDamageTypeList(supportBase.vulnerabilities) : [];
    const supportVulnerabilityPenalty = isSupport ? normalizeChance(supportBase.vulnerabilityPenalty, 0) : 0;
    const supportEffects = isSupport ? resolveUnlockedEffects(supportBase.effects, abilitiesUnlocked, refinementActive) : [];
    const strongMiningAttributes = mining.strongAttributes ?? {};
    const doubleTrouble = refinementActive && !isSupport
        ? normalizeTroubleAttribute(strongMiningAttributes.doubleTrouble, "double")
        : null;
    const tripleTrouble = refinementActive && doubleTrouble && !isSupport
        ? normalizeTroubleAttribute(strongMiningAttributes.tripleTrouble, "triple")
        : null;

    return {
        levels: {
            offensive: offensiveLevel,
            defensive: defensiveLevel,
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
        effects: isSupport ? [] : resolveUnlockedEffects(attributes.effects, abilitiesUnlocked, refinementActive),
        mining: {
            bonusDropChance,
            oreBonusChance,
            durabilitySaveChance,
            doubleTrouble,
            tripleTrouble,
            effects: isSupport ? [] : resolveUnlockedEffects(mining.effects, abilitiesUnlocked, refinementActive)
        },
        refinement: {
            active: refinementActive,
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


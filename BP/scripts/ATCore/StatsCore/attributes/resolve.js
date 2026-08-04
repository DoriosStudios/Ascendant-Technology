import { AFFINITIES } from "../constants.js";
import { clamp01, normalizeChance, toFiniteNumber } from "../utils.js";
import { getCategoriesForDefinition } from "../core/state.js";
import { getStatsRefinementReserveXp, normalizeStatsRefinementData } from "../core/refinement.js";
import { getWeakAttributePoints } from "../progression/attributes.js";

const resolvedAttributesByState = new WeakMap();

function scaleValue(base, perLevel, level, cap = Number.POSITIVE_INFINITY) {
    const scaled = toFiniteNumber(base, 0) + Math.max(0, level - 1) * toFiniteNumber(perLevel, 0);
    return Math.min(cap, Math.max(0, scaled));
}

function scaleAttributePoints(base, perPoint, points, cap = Number.POSITIVE_INFINITY) {
    const scaled = toFiniteNumber(base, 0) + Math.max(0, points) * toFiniteNumber(perPoint, 0);
    return Math.min(cap, Math.max(0, scaled));
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

function boostAdvancedEffect(effect) {
    const boosted = { ...effect };
    const multiply = (key, scalar, cap = Number.POSITIVE_INFINITY) => {
        if (!Number.isFinite(Number(boosted[key]))) return;
        boosted[key] = Math.min(cap, Math.max(0, Number(boosted[key]) * scalar));
    };

    multiply("chance", 1.15, 1);
    multiply("damageBonus", 1.15, 0.5);
    multiply("damageScale", 1.15, 0.95);
    multiply("range", 1.15);
    multiply("radius", 1.15);
    multiply("protectionRadius", 1.15);
    multiply("cancelChance", 1.15, 0.65);
    multiply("damageReduction", 1.15, 0.9);
    multiply("damagePerCharge", 1.15, 0.25);
    multiply("healPerCharge", 1.15);
    multiply("durationTicks", 1.15);
    multiply("cooldownTicks", 0.85);

    if (Number.isFinite(Number(boosted.damageMultiplier))) {
        boosted.damageMultiplier = Math.max(0.05, Number(boosted.damageMultiplier) * 0.85);
    }
    if (Number.isFinite(Number(boosted.maxChains))) {
        boosted.maxChains = Math.max(1, Math.floor(Number(boosted.maxChains)) + 1);
    }
    if (Number.isFinite(Number(boosted.maxTargets))) {
        boosted.maxTargets = Math.max(1, Math.floor(Number(boosted.maxTargets)) + 1);
    }
    if (Number.isFinite(Number(boosted.maxCharges))) {
        boosted.maxCharges = Math.max(1, Math.floor(Number(boosted.maxCharges)) + 1);
    }

    return boosted;
}

function resolveUnlockedEffects(values, unlocks, refinementActive, offensiveLevel = 1) {
    if (!refinementActive) return [];

    const effects = normalizeEffectList(values);
    return effects.flatMap(effect => {
        const effectKey = String(effect?.key ?? effect?.kind ?? "").trim().toLowerCase();
        const effectKind = String(effect?.kind ?? "").trim().toLowerCase();
        const forcedLevel = Math.max(
            0,
            Number(unlocks.appliedAbilities?.[effectKey] ?? unlocks.appliedAbilities?.[effectKind] ?? 0) || 0,
        );
        const forcedTargets = unlocks.abilityTargets?.[effectKey]
            ?? unlocks.abilityTargets?.[effectKind]
            ?? null;
        const targetedEffect = Array.isArray(forcedTargets) && forcedTargets.length > 0
            ? { ...effect, appliesTo: [...forcedTargets] }
            : effect;
        const advanced = effect?.requiresAdvancedUnlock === true
            || String(effect?.unlockTier ?? "").trim().toLowerCase() === "advanced";
        if (forcedLevel > 0) {
            return [unlocks.advanced ? boostAdvancedEffect(targetedEffect) : targetedEffect];
        }
        if (advanced) {
            return unlocks.advanced
                ? [boostAdvancedEffect(targetedEffect)]
                : [];
        }
        if (unlocks.unique || effect?.requiresUniqueUnlock === false || effect?.alwaysActive === true) {
            const resolved = unlocks.advanced ? boostAdvancedEffect(targetedEffect) : targetedEffect;
            return [resolved];
        }
        return [];
    });
}

function getAbilityUnlocks(definition, state) {
    const requiresCore = String(definition?.uniqueAbilityUnlock ?? "").toLowerCase() === "totem";
    return {
        unique: !requiresCore || state?.abilityData?.uniqueUnlocked === true,
        advanced: state?.abilityData?.advancedUnlocked === true,
        appliedAbilities: state?.abilityData?.appliedAbilities ?? {},
        abilityTargets: state?.abilityData?.abilityTargets ?? {},
    };
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

function resolveEventDrivenAttributes(source, levels) {
    const config = source && typeof source === "object" ? source : {};
    const offensiveLevel = Math.max(1, Number(levels?.offensive ?? 1) || 1);
    const defensiveLevel = Math.max(1, Number(levels?.defensive ?? 1) || 1);
    const utilityLevel = Math.max(
        1,
        Number(levels?.utility ?? 1) || 1,
        Number(levels?.mining ?? 1) || 1
    );

    const adaptive = config.adaptiveResilience ?? {};
    const healing = config.healingEfficiency ?? {};
    const charge = config.chargeMastery ?? {};
    const persistence = config.persistence ?? {};
    const attunement = config.dimensionalAttunement ?? {};
    const scavenging = config.scavenging ?? {};

    return {
        adaptiveResilience: adaptive && typeof adaptive === "object" && Number(adaptive.reductionPerStack ?? 0) > 0 ? {
            reductionPerStack: normalizeChance(scaleValue(
                adaptive.reductionPerStack,
                adaptive.reductionPerLevel,
                defensiveLevel,
                adaptive.maxReductionPerStack ?? 0.025
            )),
            maxStacks: Math.max(1, Math.floor(toFiniteNumber(adaptive.maxStacks, 3))),
            durationTicks: Math.max(20, Math.floor(toFiniteNumber(adaptive.durationTicks, 100))),
        } : null,
        healingEfficiency: healing && typeof healing === "object" && Number(healing.bonus ?? 0) > 0 ? {
            bonus: normalizeChance(scaleValue(
                healing.bonus,
                healing.bonusPerLevel,
                defensiveLevel,
                healing.maxBonus ?? 0.05
            )),
            overhealAbsorptionDurationTicks: Math.max(
                20,
                Math.floor(toFiniteNumber(healing.overhealAbsorptionDurationTicks, 100))
            ),
        } : null,
        chargeMastery: charge && typeof charge === "object" && Number(charge.maxDamageBonus ?? 0) > 0 ? {
            maxDamageBonus: normalizeChance(scaleValue(
                charge.maxDamageBonus,
                charge.damageBonusPerLevel,
                offensiveLevel,
                charge.cap ?? 0.4
            )),
            fullChargeTicks: Math.max(1, Math.floor(toFiniteNumber(charge.fullChargeTicks, 20))),
        } : null,
        persistence: persistence && typeof persistence === "object" && Number(persistence.bonusPerHit ?? 0) > 0 ? {
            bonusPerHit: normalizeChance(persistence.bonusPerHit, 0.025),
            maxBonus: normalizeChance(persistence.maxBonus, 0.5),
            resetTicks: Math.max(20, Math.floor(toFiniteNumber(persistence.resetTicks, 200))),
        } : null,
        dimensionalAttunement: attunement && typeof attunement === "object" && Number(attunement.durationTicks ?? 0) > 0 ? {
            durationTicks: Math.max(20, Math.floor(toFiniteNumber(attunement.durationTicks, 100))),
            amplifier: Math.max(0, Math.floor(toFiniteNumber(attunement.amplifier, 0))),
        } : null,
        scavenging: scavenging && typeof scavenging === "object" && Number(scavenging.chance ?? 0) > 0 ? {
            chance: normalizeChance(scaleValue(
                scavenging.chance,
                scavenging.chancePerLevel,
                utilityLevel,
                scavenging.maxChance ?? 0.3
            )),
            xpAmount: Math.max(1, Math.floor(toFiniteNumber(scavenging.xpAmount, 1))),
            healAmount: Math.max(0, toFiniteNumber(scavenging.healAmount, 0)),
        } : null,
    };
}

function boostAdvancedEventDrivenAttributes(values, advancedUnlocked) {
    if (!advancedUnlocked) return values;

    const result = { ...values };
    if (result.adaptiveResilience) {
        result.adaptiveResilience = {
            ...result.adaptiveResilience,
            reductionPerStack: Math.min(0.04, result.adaptiveResilience.reductionPerStack * 1.2),
            maxStacks: result.adaptiveResilience.maxStacks + 1,
        };
    }
    if (result.healingEfficiency) {
        result.healingEfficiency = {
            ...result.healingEfficiency,
            bonus: Math.min(0.25, result.healingEfficiency.bonus * 1.2),
        };
    }
    if (result.chargeMastery) {
        result.chargeMastery = {
            ...result.chargeMastery,
            maxDamageBonus: Math.min(0.55, result.chargeMastery.maxDamageBonus * 1.2),
        };
    }
    if (result.dimensionalAttunement) {
        result.dimensionalAttunement = {
            ...result.dimensionalAttunement,
            durationTicks: Math.floor(result.dimensionalAttunement.durationTicks * 1.2),
        };
    }
    if (result.scavenging) {
        result.scavenging = {
            ...result.scavenging,
            chance: Math.min(0.45, result.scavenging.chance * 1.2),
            xpAmount: result.scavenging.xpAmount + 1,
            healAmount: result.scavenging.healAmount * 1.2,
        };
    }

    return result;
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
    if (definition && state && typeof state === "object") {
        const cached = resolvedAttributesByState.get(state);
        if (cached?.definition === definition) return cached.attributes;
    }

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
    const abilityUnlocks = refinementActive
        ? getAbilityUnlocks(definition, state)
        : { unique: false, advanced: false, appliedAbilities: {}, abilityTargets: {} };
    const refinementBonuses = refinementActive ? refinement.bonuses : normalizeStatsRefinementData().bonuses;
    const mods = isSupport
        ? { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0, precisionBonus: 0 }
        : refinementActive ? affinityModifiers(state?.affinity ?? definition?.affinity) : { damage: 0, critChance: 0, lifesteal: 0, miningChance: 0, precisionBonus: 0 };

    const critBase = attributes.crit ?? {};
    const penetrationBase = attributes.penetration ?? {};
    const lifestealBase = attributes.lifesteal ?? {};
    const bonusDamagePoints = getWeakAttributePoints(attributeProgress, "offensive", "bonus_damage");
    const criticalChancePoints = getWeakAttributePoints(attributeProgress, "offensive", "critical_chance");
    const penetrationPoints = getWeakAttributePoints(attributeProgress, "offensive", "armor_penetration");
    const lifestealPoints = getWeakAttributePoints(attributeProgress, "offensive", "lifesteal");
    const bonusLootPoints =
        getWeakAttributePoints(attributeProgress, "mining", "bonus_loot")
        + getWeakAttributePoints(attributeProgress, "mining", "bonus_yield")
        + getWeakAttributePoints(attributeProgress, "mining", "ore_yield");
    const damageReductionPoints = getWeakAttributePoints(attributeProgress, "defensive", "damage_reduction");
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
    const lifestealCap = normalizeChance(lifestealBase.cap, 0.08);
    const lifesteal = isSupport ? 0 : Math.min(lifestealCap, normalizeChance(
        scaleAttributePoints(lifestealBase.percent, lifestealBase.perLevel, lifestealPoints, lifestealCap)
        + (mods.lifesteal ?? 0)
        + toFiniteNumber(refinementBonuses.lifesteal, 0)
    ));

    const critMultiplier = isSupport
        ? 1
        : Math.min(
            Math.max(1, toFiniteNumber(critBase.maxMultiplier, 2.25)),
            scaleValue(
                critBase.multiplier,
                critBase.multiplierPerLevel,
                offensiveLevel,
                critBase.maxMultiplier ?? 2.25
            ) + refinementCritDamage
        );
    const damageMultiplier = isSupport ? 1 : 1
        + scaleAttributePoints(0, attributes.damagePerLevel, bonusDamagePoints)
        + (mods.damage ?? 0)
        + toFiniteNumber(refinementBonuses.damageMultiplier, 0);
    const penetrationPercent = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(penetrationBase.percent, penetrationBase.perLevel, penetrationPoints, penetrationBase.cap ?? 0.35)
        + toFiniteNumber(refinementBonuses.penetration, 0)
    );
    const bonusLootChance = isSupport ? 0 : normalizeChance(
        scaleAttributePoints(mining.bonusLootChance, mining.bonusLootChancePerLevel, bonusLootPoints)
        + (mods.miningChance ?? 0)
        + toFiniteNumber(refinementBonuses.bonusLootChance, 0)
    );
    const supportDamageReduction = isSupport ? normalizeChance(Math.min(
        Math.max(0, toFiniteNumber(supportBase.maxDamageReduction, 1)),
        scaleAttributePoints(supportBase.damageReduction, supportBase.damageReductionPerLevel, damageReductionPoints)
            + toFiniteNumber(refinementBonuses.damageReduction, 0)
    )) : 0;
    // Both preservation systems are tied to Defense level: 1% at level one,
    // then +1% per level. Keep the raw value above 100% to determine how many
    // durability points a successful preservation repairs.
    const preservationChance = Math.max(0, defensiveLevel * 0.01);
    const supportDurabilityPreserveChance = isSupport ? preservationChance : 0;
    const durabilitySaveChance = isSupport ? 0 : preservationChance;
    const supportNegateAllDamageChance = isSupport ? Math.max(0,
        scaleValue(supportBase.negateAllDamageChance, supportBase.negateAllDamageChancePerLevel, supportLevel, supportBase.maxNegateAllDamageChance ?? 0.2)
        + toFiniteNumber(refinementBonuses.negateAllDamageChance, 0)
    ) : 0;
    const supportEffects = isSupport ? resolveUnlockedEffects(supportBase.effects, abilityUnlocks, refinementActive, offensiveLevel) : [];
    const strongMiningAttributes = mining.strongAttributes ?? {};
    const baseDoubleTrouble = refinementActive && !isSupport
        ? normalizeTroubleAttribute(strongMiningAttributes.doubleTrouble, "double")
        : null;
    const baseTripleTrouble = refinementActive && baseDoubleTrouble && !isSupport
        ? normalizeTroubleAttribute(strongMiningAttributes.tripleTrouble, "triple")
        : null;
    const doubleTrouble = baseDoubleTrouble && abilityUnlocks.advanced ? {
        baseChance: Math.min(1, baseDoubleTrouble.baseChance * 1.2),
        chancePer10Levels: Math.min(1, baseDoubleTrouble.chancePer10Levels * 1.2),
        maxChance: Math.min(0.25, baseDoubleTrouble.maxChance * 1.25),
    } : baseDoubleTrouble;
    const tripleTrouble = baseTripleTrouble && abilityUnlocks.advanced ? {
        chanceScale: Math.min(0.125, baseTripleTrouble.chanceScale * 1.25),
    } : baseTripleTrouble;
    const eventDriven = refinementActive
        ? boostAdvancedEventDrivenAttributes(resolveEventDrivenAttributes(definition?.eventDriven, {
            offensive: offensiveLevel,
            defensive: defensiveLevel,
            mining: miningLevel,
            utility: utilityLevel,
        }), abilityUnlocks.advanced)
        : resolveEventDrivenAttributes({}, {});

    const resolved = {
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
            bossScalar: clamp01(toFiniteNumber(penetrationBase.bossScalar, 0.55)),
            bossCap: normalizeChance(penetrationBase.bossCap, 0.2)
        },
        lifesteal: {
            percent: lifesteal,
            critBonus: normalizeChance(lifestealBase.critBonus, 0),
            cap: lifestealCap
        },
        elemental,
        effects: isSupport ? [] : resolveUnlockedEffects(attributes.effects, abilityUnlocks, refinementActive, offensiveLevel),
        mining: {
            bonusLootChance,
            durabilitySaveChance,
            preservationRepairAmount: 2 + Math.floor(Math.max(0, preservationChance - 0.000001)),
            doubleTrouble,
            tripleTrouble,
            effects: isSupport ? [] : resolveUnlockedEffects(mining.effects, abilityUnlocks, refinementActive, offensiveLevel)
        },
        eventDriven,
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
                bonusLootChance: toFiniteNumber(refinementBonuses.bonusLootChance, 0),
                durabilitySaveChance: toFiniteNumber(refinementBonuses.durabilitySaveChance, 0),
                durabilityPreserveChance: toFiniteNumber(refinementBonuses.durabilityPreserveChance, 0)
            }
        },
        support: {
            damageReduction: supportDamageReduction,
            durabilityPreserveChance: supportDurabilityPreserveChance,
            preservationRepairAmount: 2 + Math.floor(Math.max(0, preservationChance - 0.000001)),
            negateAllDamageChance: supportNegateAllDamageChance,
            effects: supportEffects
        }
    };

    if (definition && state && typeof state === "object") {
        resolvedAttributesByState.set(state, { definition, attributes: resolved });
    }
    return resolved;
}


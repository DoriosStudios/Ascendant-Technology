import { STATSCORE } from "../constants.js";
import { clamp01, normalizeId, safeJsonParse, titleCaseIdentifier, toFiniteNumber, toPositiveInteger } from "../utils.js";

const DEFAULT_REFINEMENT_BONUSES = Object.freeze({
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
    bonusDropChance: 0,
    oreBonusChance: 0,
    durabilitySaveChance: 0,
    durabilityPreserveChance: 0
});

export function createDefaultStatsRefinementData() {
    return {
        version: 1,
        grade: "unrefined",
        quality: 0,
        minQuality: 0,
        maxQuality: 0,
        spentXp: 0,
        rerolls: 0,
        chipId: "",
        chipLabel: "",
        ingotId: "",
        ingotAmount: 0,
        bonuses: { ...DEFAULT_REFINEMENT_BONUSES }
    };
}

function clampPositive(value, max) {
    const numeric = toFiniteNumber(value, 0);
    return Math.min(max, Math.max(0, numeric));
}

function normalizeRefinementElement(value, fallbackChance, fallbackDamage) {
    const element = value && typeof value === "object" ? value : {};
    const id = normalizeId(element.id ?? element.key ?? element.type);
    const label = typeof element.label === "string" && element.label.trim().length > 0
        ? element.label.trim()
        : titleCaseIdentifier(id);

    return {
        id,
        label: id ? label : "",
        chance: clamp01(toFiniteNumber(element.chance, fallbackChance)),
        damage: clampPositive(toFiniteNumber(element.damage, fallbackDamage), 12),
        damageScale: clampPositive(element.damageScale, 1),
        durationTicks: toPositiveInteger(element.durationTicks, 0),
        amplifier: toPositiveInteger(element.amplifier, 0),
        seconds: toPositiveInteger(element.seconds, 0),
        quality: clamp01(toFiniteNumber(element.quality, 0))
    };
}

function normalizeRefinementBonuses(value) {
    const bonuses = value && typeof value === "object" ? value : {};
    const elementalChance = clamp01(toFiniteNumber(bonuses.elementalChance, bonuses.elemental?.chance ?? 0));
    const elementalDamage = clampPositive(toFiniteNumber(bonuses.elementalDamage, bonuses.elemental?.damage ?? 0), 12);
    const elemental = normalizeRefinementElement(bonuses.elemental, elementalChance, elementalDamage);

    return {
        damageMultiplier: clamp01(toFiniteNumber(bonuses.damageMultiplier, 0)),
        extraDamage: clampPositive(toFiniteNumber(bonuses.extraDamage, bonuses.flatDamageBonus ?? 0), 12),
        flatDamageBonus: clampPositive(toFiniteNumber(bonuses.flatDamageBonus, 0), 12),
        critChance: clamp01(toFiniteNumber(bonuses.critChance, 0)),
        critMultiplier: clamp01(toFiniteNumber(bonuses.critMultiplier, 0)),
        critDamageBonus: clamp01(toFiniteNumber(bonuses.critDamageBonus, 0)),
        penetration: clamp01(toFiniteNumber(bonuses.penetration, 0)),
        lifesteal: clamp01(toFiniteNumber(bonuses.lifesteal, 0)),
        elementalChance,
        elementalDamage,
        elemental,
        damageReduction: clamp01(toFiniteNumber(bonuses.damageReduction, 0)),
        negateAllDamageChance: clamp01(toFiniteNumber(bonuses.negateAllDamageChance, 0)),
        bonusDropChance: clamp01(toFiniteNumber(bonuses.bonusDropChance, 0)),
        oreBonusChance: clamp01(toFiniteNumber(bonuses.oreBonusChance, 0)),
        durabilitySaveChance: clamp01(toFiniteNumber(bonuses.durabilitySaveChance, 0)),
        durabilityPreserveChance: clamp01(toFiniteNumber(bonuses.durabilityPreserveChance, 0))
    };
}

export function normalizeStatsRefinementData(value) {
    const refinement = value && typeof value === "object" ? value : {};
    const normalized = createDefaultStatsRefinementData();

    normalized.version = Math.max(1, toPositiveInteger(refinement.version, 1));
    normalized.grade = normalizeId(refinement.grade) || "unrefined";
    normalized.quality = clamp01(toFiniteNumber(refinement.quality, 0));
    normalized.minQuality = clamp01(toFiniteNumber(refinement.minQuality, 0));
    normalized.maxQuality = clamp01(toFiniteNumber(refinement.maxQuality, 0));
    normalized.spentXp = toPositiveInteger(refinement.spentXp, 0);
    normalized.rerolls = toPositiveInteger(refinement.rerolls, 0);
    normalized.chipId = normalizeId(refinement.chipId);
    normalized.chipLabel = typeof refinement.chipLabel === "string" && refinement.chipLabel.trim().length > 0
        ? refinement.chipLabel.trim()
        : titleCaseIdentifier(normalized.chipId || "chip");
    normalized.ingotId = normalizeId(refinement.ingotId);
    normalized.ingotAmount = toPositiveInteger(refinement.ingotAmount, 0);
    normalized.bonuses = normalizeRefinementBonuses(refinement.bonuses);

    if (normalized.maxQuality < normalized.minQuality) {
        normalized.maxQuality = normalized.minQuality;
    }

    return normalized;
}

export function readStatsRefinementData(stack) {
    if (!stack || typeof stack.getDynamicProperty !== "function") {
        return createDefaultStatsRefinementData();
    }

    let rawValue;
    try {
        rawValue = stack.getDynamicProperty(STATSCORE.props.refinement);
    } catch {
        rawValue = undefined;
    }

    return normalizeStatsRefinementData(safeJsonParse(rawValue));
}

export function hasStatsRefinementBonuses(refinement) {
    const normalized = normalizeStatsRefinementData(refinement);
    const bonuses = normalized.bonuses;
    const elemental = bonuses.elemental;
    return normalized.spentXp > 0
        || normalized.rerolls > 0
        || normalized.quality > 0
        || normalized.minQuality > 0
        || normalized.maxQuality > 0
        || normalized.ingotAmount > 0
        || normalized.chipId.length > 0
        || (elemental.id.length > 0 && (elemental.chance > 0 || elemental.damage > 0))
        || Object.values(bonuses).some(value => toFiniteNumber(value, 0) > 0);
}

export function serializeStatsRefinementData(refinement) {
    const normalized = normalizeStatsRefinementData(refinement);
    if (!hasStatsRefinementBonuses(normalized)) {
        return undefined;
    }
    return JSON.stringify(normalized);
}

export function getStatsRefinementReserveXp(state) {
    const totalXp = toPositiveInteger(state?.xp, 0);
    const spentXp = toPositiveInteger(state?.refinement?.spentXp, 0);
    return Math.max(0, totalXp - spentXp);
}

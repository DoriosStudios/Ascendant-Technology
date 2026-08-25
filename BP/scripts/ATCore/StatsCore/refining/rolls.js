import { REFINING_TABLE_CONFIG as CONFIG } from "../../../config/recipes/refiningTable.js";

function normalizeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function roundBonus(value) {
    return Math.round((Number(value) || 0) * 10000) / 10000;
}

function gradeFromQuality(quality) {
    if (quality >= CONFIG.defaults.transcendentThreshold) return "transcendent";
    if (quality >= CONFIG.defaults.masterworkThreshold) return "masterwork";
    if (quality >= CONFIG.defaults.strongThreshold) return "exceptional";
    if (quality >= 0.32) return "steady";
    return "rough";
}

function canRollElement(element, definitionType, coreMode) {
    const allowedTypes = Array.isArray(element?.allowedTypes) ? element.allowedTypes : undefined;
    if (allowedTypes && !allowedTypes.includes(definitionType)) return false;
    if (!allowedTypes && definitionType === "support") return false;

    const requirement = normalizeId(element?.coreRequirement);
    if (requirement === "advanced") return coreMode === "advanced";
    if (requirement === "runic") return coreMode === "normal" || coreMode === "advanced";
    return true;
}

function pickElement(definitionType, coreMode) {
    const candidates = CONFIG.elements.filter((element) =>
        canRollElement(element, definitionType, coreMode)
    );
    if (!candidates.length) return undefined;

    const totalWeight = candidates.reduce((sum, element) => sum + Math.max(0, element.weight), 0);
    let roll = Math.random() * Math.max(1, totalWeight);
    for (const element of candidates) {
        roll -= Math.max(0, element.weight);
        if (roll <= 0) return element;
    }
    return candidates[0];
}

export function computeRefinementRollRange(chip, ingot, amount, options = {}) {
    const advanced = options?.advanced === true;
    const power = Number(ingot?.power ?? 0);
    const maxIngots = advanced
        ? CONFIG.defaults.advancedMaxIngotsPerRoll
        : CONFIG.defaults.maxIngotsPerRoll;
    const safeAmount = Math.min(maxIngots, Math.max(0, Math.floor(Number(amount) || 0)));
    const min = Math.min(advanced ? 0.99 : 0.98, chip.minQuality + safeAmount * 0.012 * power);
    const max = Math.min(
        advanced ? 1 : 0.99,
        Math.max(min + CONFIG.defaults.minRollSpread, chip.maxQuality + safeAmount * 0.018 * power),
    );
    return { min, max };
}

/** Rolls the same StatsCore refinement data used by the Refining Table. */
export function rollStatsRefinement({ definition, state, chip, ingot, amount, range, xpCost = 0, tier = undefined, advanced = false, coreMode = "none" }) {
    const maxIngots = advanced
        ? CONFIG.defaults.advancedMaxIngotsPerRoll
        : CONFIG.defaults.maxIngotsPerRoll;
    const safeAmount = Math.min(maxIngots, Math.max(0, Math.floor(Number(amount) || 0)));
    const rollRange = range ?? computeRefinementRollRange(chip, ingot, safeAmount, { advanced });
    const quality = rollRange.min + Math.random() * Math.max(0, rollRange.max - rollRange.min);
    const template = CONFIG.templates[definition?.type];
    if (!template) return null;

    const tierScale = CONFIG.tierScales[normalizeId(tier ?? definition?.tier)] ?? 1;
    const bonuses = {};
    for (const [key, maxValue] of Object.entries(template)) {
        const variance = 0.92 + Math.random() * 0.16;
        const directDamage = key === "extraDamage" || key === "elementalDamage";
        const cap = directDamage
            ? (advanced ? CONFIG.defaults.advancedDirectDamageCap : 12)
            : 0.99;
        const ceiling = advanced ? CONFIG.defaults.advancedStrongMultiplier : 1;
        bonuses[key] = roundBonus(Math.min(cap, Number(maxValue) * ceiling * quality * tierScale * variance));
    }

    const normalizedCoreMode = normalizeId(coreMode);
    const canAwakenElement = (bonuses.elementalChance ?? 0) > 0
        && ((bonuses.elementalDamage ?? 0) > 0 || definition?.type === "support");
    if (canAwakenElement) {
        const element = pickElement(definition?.type, normalizedCoreMode);
        if (element) {
            bonuses.elemental = {
                ...element,
                chance: element.id === "light" ? 1 : bonuses.elementalChance,
                // Blessing has a fixed holy-damage contract; other elements
                // continue scaling from the refinement roll.
                damage: element.id === "light"
                    ? Math.max(1, Number(element.blessingDamage ?? 8) || 8)
                    : bonuses.elementalDamage,
                quality: roundBonus(quality),
            };
        }
    }

    return {
        version: 1,
        grade: gradeFromQuality(quality),
        quality: roundBonus(quality),
        minQuality: roundBonus(rollRange.min),
        maxQuality: roundBonus(rollRange.max),
        spentXp: Math.max(0, Number(state?.refinement?.spentXp ?? 0)) + Math.max(0, Math.floor(Number(xpCost) || 0)),
        rerolls: Math.max(0, Number(state?.refinement?.rerolls ?? 0)) + 1,
        chipId: chip.id,
        chipLabel: chip.label,
        ingotId: ingot?.id ?? "",
        ingotAmount: safeAmount,
        advanced: advanced === true,
        bonuses,
    };
}

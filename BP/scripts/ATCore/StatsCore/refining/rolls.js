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

function pickElement() {
    const totalWeight = CONFIG.elements.reduce((sum, element) => sum + Math.max(0, element.weight), 0);
    let roll = Math.random() * Math.max(1, totalWeight);
    for (const element of CONFIG.elements) {
        roll -= Math.max(0, element.weight);
        if (roll <= 0) return element;
    }
    return CONFIG.elements[0];
}

export function computeRefinementRollRange(chip, ingot, amount) {
    const power = Number(ingot?.power ?? 0);
    const safeAmount = Math.min(CONFIG.defaults.maxIngotsPerRoll, Math.max(0, Math.floor(Number(amount) || 0)));
    const min = Math.min(0.98, chip.minQuality + safeAmount * 0.012 * power);
    const max = Math.min(
        0.99,
        Math.max(min + CONFIG.defaults.minRollSpread, chip.maxQuality + safeAmount * 0.018 * power),
    );
    return { min, max };
}

/** Rolls the same StatsCore refinement data used by the Refining Table. */
export function rollStatsRefinement({ definition, state, chip, ingot, amount, range, xpCost = 0, tier = undefined }) {
    const safeAmount = Math.min(CONFIG.defaults.maxIngotsPerRoll, Math.max(0, Math.floor(Number(amount) || 0)));
    const rollRange = range ?? computeRefinementRollRange(chip, ingot, safeAmount);
    const quality = rollRange.min + Math.random() * Math.max(0, rollRange.max - rollRange.min);
    const template = CONFIG.templates[definition?.type];
    if (!template) return null;

    const tierScale = CONFIG.tierScales[normalizeId(tier ?? definition?.tier)] ?? 1;
    const bonuses = {};
    for (const [key, maxValue] of Object.entries(template)) {
        const variance = 0.92 + Math.random() * 0.16;
        const cap = key === "extraDamage" || key === "elementalDamage" ? 12 : 0.99;
        bonuses[key] = roundBonus(Math.min(cap, Number(maxValue) * quality * tierScale * variance));
    }

    if ((bonuses.elementalChance ?? 0) > 0 && (bonuses.elementalDamage ?? 0) > 0) {
        const element = pickElement();
        if (element) {
            bonuses.elemental = {
                ...element,
                chance: bonuses.elementalChance,
                damage: bonuses.elementalDamage,
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
        bonuses,
    };
}

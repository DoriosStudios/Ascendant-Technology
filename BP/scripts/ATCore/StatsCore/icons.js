/**
 * StatsCore glyph allowlist.
 *
 * Every value in this file is declared in root_extras/emojis.lang. Keeping the
 * mapping centralized prevents system Unicode symbols or unsupported glyphs
 * from leaking into lore and action-bar feedback.
 */
export const STATSCORE_ICONS = Object.freeze({
    attackDamage: "",
    damageReduction: "",
    walkingSpeed: "",
    swimmingSpeed: "",
    evasion: "",
    luck: "",
    doubleTrouble: "",
    tripleTrouble: "",
    sweeping: "",
    criticalMultiplier: "",
    criticalDamage: "",
    criticalChance: "",
    preservingTool: "",
    preservingArmor: "",
    blood: "",
    death: "",
    scavenger: "",
    random: "",
    soul: "",
    newItem: "",
    miningLevelUp: "",
    defensiveLevelUp: "",
    offensiveLevelUp: "",
    abilityLevelUp: "",
    oreYield: "",
    fire: "",
    poison: "",
    ice: "",
    darkness: "",
    lightning: "",
    healedHeart: "",
    fullHeart: "",
    emptyHeart: "",
    fullArmor: "",
    hunger: "",
    waterBubble: "",
    sword: "",
    pickaxe: "",
    unknown: "",
});

function normalizeLabel(label) {
    return String(label ?? "")
        .replace(/§./g, "")
        .trim()
        .toLowerCase();
}

export function getElementIcon(elementId) {
    switch (normalizeLabel(elementId)) {
        case "plant":
        case "poison":
            return STATSCORE_ICONS.poison;
        case "frost":
        case "ice":
            return STATSCORE_ICONS.ice;
        case "fire":
            return STATSCORE_ICONS.fire;
        case "lightning":
        case "shock":
            return STATSCORE_ICONS.lightning;
        case "darkness":
        case "dark":
            return STATSCORE_ICONS.darkness;
        default:
            return STATSCORE_ICONS.unknown;
    }
}

export function getAttributeIcon(label, context = "") {
    const normalized = normalizeLabel(label);
    const normalizedContext = normalizeLabel(context);

    if (normalized.includes("critical multiplier")) return STATSCORE_ICONS.criticalMultiplier;
    if (normalized.includes("critical chance")) return STATSCORE_ICONS.criticalChance;
    if (normalized.includes("critical damage")) return STATSCORE_ICONS.criticalDamage;
    if (normalized.includes("damage reduction") || normalized.includes("resilience")) return STATSCORE_ICONS.damageReduction;
    if (normalized.includes("attack damage") || normalized.includes("bonus damage") || normalized.includes("extra damage")) {
        return STATSCORE_ICONS.attackDamage;
    }
    if (normalized.includes("preserv")) {
        return normalizedContext === "support" ? STATSCORE_ICONS.preservingArmor : STATSCORE_ICONS.preservingTool;
    }
    if (normalized.includes("evasion") || normalized.includes("negate")) return STATSCORE_ICONS.evasion;
    if (normalized.includes("scaveng")) return STATSCORE_ICONS.scavenger;
    if (normalized.includes("luck") || normalized.includes("xp")) return STATSCORE_ICONS.luck;
    if (normalized.includes("ore") || normalized.includes("yield") || normalized.includes("drop")) return STATSCORE_ICONS.oreYield;
    if (normalized.includes("lifesteal") || normalized.includes("heal")) return STATSCORE_ICONS.healedHeart;
    if (normalized.includes("penetration") || normalized.includes("armor")) return STATSCORE_ICONS.fullArmor;
    if (normalized.includes("walk") || normalized.includes("feather")) return STATSCORE_ICONS.walkingSpeed;
    if (normalized.includes("swim") || normalized.includes("water")) return STATSCORE_ICONS.swimmingSpeed;
    if (normalized.includes("sweep")) return STATSCORE_ICONS.sweeping;
    if (normalized.includes("charge") || normalized.includes("projectile")) return STATSCORE_ICONS.unknown;
    if (normalized.includes("dimension")) return STATSCORE_ICONS.darkness;
    return STATSCORE_ICONS.unknown;
}

export function getAbilityIcon(label) {
    const normalized = normalizeLabel(label);

    if (normalized.includes("ingniter") || normalized.includes("igniter") || normalized.includes("fire")) {
        return STATSCORE_ICONS.fire;
    }
    if (normalized.includes("sweep")) return STATSCORE_ICONS.sweeping;
    if (normalized.includes("bleed")) return STATSCORE_ICONS.blood;
    if (normalized.includes("poison")) return STATSCORE_ICONS.poison;
    if (normalized.includes("feather") || normalized.includes("dash")) return STATSCORE_ICONS.walkingSpeed;
    if (normalized.includes("tough") || normalized.includes("spikes")) return STATSCORE_ICONS.fullArmor;
    if (normalized.includes("clarity")) return STATSCORE_ICONS.healedHeart;
    if (normalized.includes("perfect guard") || normalized.includes("blast ward")) return STATSCORE_ICONS.fullArmor;
    if (normalized.includes("overcharge")) return STATSCORE_ICONS.lightning;
    if (normalized.includes("soul collector")) return STATSCORE_ICONS.soul;
    if (normalized.includes("dimensional")) return STATSCORE_ICONS.darkness;
    if (normalized.includes("phase step")) return STATSCORE_ICONS.walkingSpeed;
    if (normalized.includes("scaveng")) return STATSCORE_ICONS.scavenger;
    if (normalized.includes("reaper")) return STATSCORE_ICONS.death;
    if (
        normalized.includes("operator")
        || normalized.includes("crush")
        || normalized.includes("gardener")
        || normalized.includes("forger")
        || normalized.includes("aftershock")
        || normalized.includes("worm")
    ) {
        return STATSCORE_ICONS.pickaxe;
    }
    if (
        normalized.includes("harpoon")
        || normalized.includes("pinning shot")
        || normalized.includes("ballista")
        || normalized.includes("berserk")
        || normalized.includes("primal")
    ) {
        return STATSCORE_ICONS.sword;
    }
    return STATSCORE_ICONS.unknown;
}

export function getProgressionIcon(category) {
    switch (normalizeLabel(category)) {
        case "offensive":
            return STATSCORE_ICONS.offensiveLevelUp;
        case "mining":
            return STATSCORE_ICONS.miningLevelUp;
        case "defensive":
            return STATSCORE_ICONS.defensiveLevelUp;
        case "utility":
            return STATSCORE_ICONS.abilityLevelUp;
        default:
            return STATSCORE_ICONS.unknown;
    }
}

export function uniqueIcons(values) {
    return [...new Set((values ?? []).map(value => String(value ?? "").trim()).filter(Boolean))].join(" ");
}

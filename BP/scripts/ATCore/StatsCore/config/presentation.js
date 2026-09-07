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
    wind: "",
    void: "",
    curse: "",
    retaliation: "",
    rage: "",
    earth: "",
    holy: "",
    plant: "",
    mark: "",
    operator: "",
    blessedHeart: "",
    water: "",
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

export const MINING_ABILITY_TOKENS = Object.freeze([
    "double trouble",
    "triple trouble",
    "green thumb",
    "primal",
    "forger",
    "crushing",
    "berserk",
    "worm",
]);

/**
 * The canonical names make the presentation choice explicit. Legacy values are
 * accepted on read so players do not lose their saved preference after updating.
 */
export const STATSCORE_FEEDBACK_STYLES = Object.freeze([
    "only_text",
    "only_icons",
    "text_and_icons",
    "both_partial",
    "text",
    "emoji",
    "both",
]);

export const FEEDBACK_STYLE_ALIASES = Object.freeze({
    text: "only_text",
    emoji: "only_icons",
    both: "text_and_icons",
});

export const BOOT_MOBILITY_LABELS = Object.freeze({
    dash: "Boot Dash",
    bunny_jump: "Bunny Jump",
    none: "Nenhum",
});

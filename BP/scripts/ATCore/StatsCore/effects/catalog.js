import { STATSCORE_ICONS } from "../icons.js";

export const STATSCORE_EFFECT_CATALOG = Object.freeze({
    marked: Object.freeze({
        id: "marked",
        name: "Marked",
        polarity: "debuff",
        icon: "marked",
        glyph: STATSCORE_ICONS.mark,
        order: 10,
    }),
    bleeding: Object.freeze({
        id: "bleeding",
        name: "Bleeding",
        polarity: "debuff",
        icon: "bleeding",
        glyph: STATSCORE_ICONS.blood,
        order: 20,
    }),
    blessed: Object.freeze({
        id: "blessed",
        name: "Blessing",
        polarity: "buff",
        icon: "blessed",
        glyph: STATSCORE_ICONS.blessedHeart,
        order: 30,
    }),
    cursed: Object.freeze({
        id: "cursed",
        name: "Curse",
        polarity: "debuff",
        icon: "cursed",
        glyph: STATSCORE_ICONS.curse,
        order: 35,
    }),
    berserk: Object.freeze({
        id: "berserk",
        name: "Berserk",
        polarity: "buff",
        icon: "berserk",
        glyph: STATSCORE_ICONS.rage,
        order: 40,
    }),
    adaptive_resilience: Object.freeze({
        id: "adaptive_resilience",
        name: "Adaptive Resilience",
        polarity: "buff",
        icon: "adaptive_resilience",
        glyph: STATSCORE_ICONS.fullArmor,
        order: 50,
    }),
    soul_collector: Object.freeze({
        id: "soul_collector",
        name: "Soul Collector",
        polarity: "buff",
        icon: "soul_collector",
        glyph: STATSCORE_ICONS.soul,
        displayMode: "charges",
        maxCharges: 5,
        order: 60,
    }),
});

export const STATSCORE_EFFECT_IDS = Object.freeze(
    Object.keys(STATSCORE_EFFECT_CATALOG),
);

const EFFECT_ALIASES = Object.freeze({
    mark: "marked",
    bleed: "bleeding",
    blessing: "blessed",
    light: "blessed",
    curse: "cursed",
    adaptive: "adaptive_resilience",
    resilience: "adaptive_resilience",
    soul: "soul_collector",
});

export function normalizeStatsCoreEffectId(value) {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^.*:/, "")
        .replace(/[^a-z0-9_.-]+/g, "_")
        .slice(0, 64);
    return EFFECT_ALIASES[normalized] ?? normalized;
}

export function getStatsCoreEffectDefinition(effectId) {
    return STATSCORE_EFFECT_CATALOG[normalizeStatsCoreEffectId(effectId)];
}

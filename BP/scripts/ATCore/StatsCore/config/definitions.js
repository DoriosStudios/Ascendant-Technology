import { STATSCORE_ICONS } from "./presentation.js";
import { RUNTIME_DEFAULTS, PROGRESSION_DEFAULTS } from "./values.js";
import { STATSCORE_EQUIPMENT_SLOTS } from "./equipmentTypes.js";

export const STATSCORE = Object.freeze({
    namespace: "utilitycraft",
    name: "StatsCore",
    version: 3,
    props: Object.freeze({
        uid: "utilitycraft:statscore_uid",
        version: "utilitycraft:statscore_version",
        progression: "utilitycraft:statscore_progression",
        attributeProgress: "utilitycraft:statscore_attribute_progress",
        affinity: "utilitycraft:statscore_affinity",
        branch: "utilitycraft:statscore_branch",
        refinement: "utilitycraft:statscore_refinement",
        refined: "utilitycraft:statscore_refined",
        abilityData: "utilitycraft:statscore_ability_data",
        loreSignature: "utilitycraft:statscore_lore_signature"
    }),
    playerProperties: Object.freeze({
        feedbackStyle: "utilitycraft:statscore_feedback_style",
        insightBridge: "utilitycraft:statscore_insight_bridge",
    }),
    lore: Object.freeze({
        start: "\u00A7r\u00A78[StatsCore]",
        end: "\u00A7r\u00A78[/StatsCore]"
    }),
    slots: STATSCORE_EQUIPMENT_SLOTS,
    scriptEvents: Object.freeze({
        register: "utilitycraft:register_statscore",
        inspect: "utilitycraft:statscore_inspect",
        reset: "utilitycraft:statscore_reset"
    }),
    worldProperties: Object.freeze({
        enabled: "utilitycraft:statscore_enabled"
    }),
    runtime: RUNTIME_DEFAULTS,
    progression: PROGRESSION_DEFAULTS
});

export const AFFINITIES = Object.freeze({
    aggression: "aggression",
    sustain: "sustain",
    mining: "mining",
    control: "control",
    precision: "precision",
    technique: "technique",
    survival: "survival",
    hybrid: "hybrid"
});

export const ARMOR_COMPONENT_ID = "utilitycraft:armor";
export const REGISTER_ARMOR_MITIGATION_EVENT_ID = "utilitycraft:register_armor_mitigation";

export const PROGRESSION_CATEGORIES = Object.freeze(["offensive", "defensive", "mining", "utility"]);
export const PROGRESSION_REASON_CATEGORIES = Object.freeze({
    combat: "offensive", kill: "offensive",
    hurt: "defensive", armor: "defensive",
    block: "mining", ore: "mining", tool: "mining",
    utility: "utility",
});
export const PROGRESSION_XP_FIELDS = Object.freeze({
    offensive: Object.freeze(["combatXp", "killXp"]),
    defensive: Object.freeze(["armorXp"]),
    mining: Object.freeze(["blockXp", "oreXp", "toolXp"]),
    utility: Object.freeze([]),
});
export const ABILITY_CHANNELS = Object.freeze(["attributes", "mining", "support"]);

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

export const EFFECT_ALIASES = Object.freeze({
    mark: "marked",
    bleed: "bleeding",
    blessing: "blessed",
    light: "blessed",
    curse: "cursed",
    adaptive: "adaptive_resilience",
    resilience: "adaptive_resilience",
    soul: "soul_collector",
});

export const DAMAGE_TYPE_ALIASES = Object.freeze({
    all: "all",
    anvil: "anvil",
    blockexplosion: "block_explosion",
    charging: "charging",
    contact: "contact",
    drowning: "drowning",
    entityattack: "entity_attack",
    entityexplosion: "entity_explosion",
    fall: "fall",
    fallingblock: "falling_block",
    fire: "fire",
    firetick: "fire_tick",
    flyintowall: "fly_into_wall",
    freezing: "freezing",
    lava: "lava",
    lightning: "lightning",
    magic: "magic",
    magma: "magma",
    none: "none",
    override: "override",
    piston: "piston",
    projectile: "projectile",
    ramattack: "ram_attack",
    sonicboom: "sonic_boom",
    stalactite: "stalactite",
    stalagmite: "stalagmite",
    starve: "starve",
    suffocation: "suffocation",
    suicide: "suicide",
    temperature: "temperature",
    thorns: "thorns",
    void: "void",
    wither: "wither"
});

export const PRESERVING_DAMAGE_TYPES = new Set([
    "entity_attack",
    "projectile",
    "block_explosion",
    "entity_explosion",
    "thorns",
    "ram_attack",
]);
export const KNOCKBACK_DAMAGE_TYPES = new Set([
    "anvil",
    "block_explosion",
    "entity_attack",
    "entity_explosion",
    "falling_block",
    "fireworks",
    "mace_smash",
    "macesmash",
    "piston",
    "projectile",
    "ram_attack",
    "sonic_boom",
    "stalactite",
]);

export const INSIGHT_ACTIONBAR_NAMESPACE = "ascendant.statscore";
export const INSIGHT_NAMESPACE_NAME = "Ascendant Technology · StatsCore";
export const INSIGHT_QUEUE_DISCOVER_EVENT = "insight:actionbar_queue_discover_v1";
export const INSIGHT_QUEUE_READY_EVENT = "insight:actionbar_queue_ready_v1";
export const INSIGHT_QUEUE_SEND_EVENT = "insight:actionbar_queue_send_v1";

export const EFFECTS_NAMESPACE = INSIGHT_ACTIONBAR_NAMESPACE;
export const EFFECTS_DISCOVER_EVENT = "insight:effects_discover_v1";
export const EFFECTS_READY_EVENT = "insight:effects_ready_v1";
export const EFFECTS_SEND_EVENT = "insight:effects_send_v1";
export const LEGACY_DISCOVER_EVENT = "insight:custom_effects_discover_v1";
export const LEGACY_READY_EVENT = "insight:custom_effects_ready_v1";
export const LEGACY_SEND_EVENT = "insight:custom_effects_send_v1";

export const INSIGHT_ACTIVITY_EVENT = "insight:statscore_activity_v1";

export const DEFAULT_EFFECT_SOURCE = "gameplay";

export const STATSCORE_ENABLED_CACHE_KEY = "__statsCoreEnabled";

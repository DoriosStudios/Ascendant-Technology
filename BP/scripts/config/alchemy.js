// Potion durations are seconds; amplifiers are zero-based at the API boundary.
// Native IDs come from @minecraft/vanilla-data, including Bedrock's nightvision spelling.
export const ALCHEMY_POTION_COMPONENTS = {
    drink: "ascendant:alchemical_potion",
    throwable: "ascendant:alchemical_throwable_potion",
};

export const ALCHEMY_UI = { blazeFrames: 52, blazeItemPrefix: "utilitycraft:alchemical_blaze_" };

const family = (id, effect, normal, long, ingredient, options = {}) => ({
    id, effect, normal, long, ingredient, maxLevel: 3, native: id, ...options,
});

export const POTION_FAMILIES = [
    family("swiftness", "speed", 180, 480, "minecraft:sugar", { strong: 90, icon: "moveSpeed" }),
    family("slowness", "slowness", 90, 240, null, { strong: 20, strongLevel: 4, maxLevel: 5, icon: "moveSlowdown" }),
    family("leaping", "jump_boost", 180, 480, "minecraft:rabbit_foot", { strong: 90, icon: "jump" }),
    family("strength", "strength", 180, 480, "minecraft:blaze_powder", { strong: 90, icon: "damageBoost" }),
    family("healing", "instant_health", 0, 0, "minecraft:glistering_melon_slice", { strong: 0, instant: true, icon: "heal" }),
    family("harming", "instant_damage", 0, 0, null, { strong: 0, instant: true, icon: "harm" }),
    family("poison", "poison", 45, 120, "minecraft:spider_eye", { strong: 22.5 }),
    family("regeneration", "regeneration", 45, 120, "minecraft:ghast_tear", { strong: 22.5 }),
    family("nightvision", "night_vision", 180, 480, "minecraft:golden_carrot", { maxLevel: 1, icon: "nightVision" }),
    family("invisibility", "invisibility", 180, 480, null, { maxLevel: 1 }),
    family("fire_resistance", "fire_resistance", 180, 480, "minecraft:magma_cream", { maxLevel: 1, icon: "fireResistance" }),
    family("water_breathing", "water_breathing", 180, 480, "minecraft:pufferfish", { maxLevel: 1, icon: "waterBreathing" }),
    family("weakness", "weakness", 90, 240, "minecraft:fermented_spider_eye"),
    family("slow_falling", "slow_falling", 90, 240, "minecraft:phantom_membrane", { maxLevel: 1, icon: "slowFall" }),
    family("turtle_master", "resistance", 20, 40, "minecraft:turtle_helmet", { strong: 20, maxLevel: 2, icon: "turtleMaster" }),
    family("wind_charged", "wind_charged", 180, 480, "minecraft:breeze_rod", { nativeLong: false, maxLevel: 1, icon: "windCharged" }),
    family("weaving", "weaving", 180, 480, "minecraft:web", { nativeLong: false, maxLevel: 1 }),
    family("oozing", "oozing", 180, 480, "minecraft:slime", { nativeLong: false, maxLevel: 1 }),
    family("infested", "infested", 180, 480, "minecraft:stone", { nativeLong: false, maxLevel: 1 }),
    // New brewable effect families. No education-only effects or omen/raid triggers.
    family("haste", "haste", 180, 480, "utilitycraft:titanium_dust", { native: null, icon: "digSpeed" }),
    family("resistance", "resistance", 180, 480, "utilitycraft:aetherium_dust", { native: null }),
    family("absorption", "absorption", 120, 300, "minecraft:golden_apple", { native: null }),
    family("health_boost", "health_boost", 180, 480, "utilitycraft:refined_aetherium_crystal", { native: null, icon: "healthBoost" }),
    family("wither", "wither", 30, 90, "minecraft:wither_rose", { native: null }),
    family("levitation", "levitation", 15, 45, "minecraft:shulker_shell", { native: null }),
    family("blindness", "blindness", 30, 90, "minecraft:ink_sac", { native: null, maxLevel: 1 }),
    family("darkness", "darkness", 30, 90, "minecraft:echo_shard", { native: null, maxLevel: 1, icon: "blindness" }),
    family("saturation", "saturation", 0, 0, "minecraft:golden_apple", { native: null, instant: true }),
    // StatsCore statuses use their gameplay processors, never Entity.addEffect.
    family("marked", "marked", 30, 90, "minecraft:ender_eye", { native: null, statsCore: true, paletteGlyph: "mark" }),
    family("bleeding", "bleeding", 15, 45, "minecraft:sweet_berries", { native: null, statsCore: true, paletteGlyph: "blood" }),
    family("blessed", "blessed", 120, 300, "minecraft:glow_berries", { native: null, statsCore: true, paletteGlyph: "blessedHeart" }),
    family("cursed", "cursed", 30, 90, "utilitycraft:void_essence", { native: null, statsCore: true, paletteGlyph: "curse" }),
    family("berserk", "berserk", 60, 180, "minecraft:fire_charge", { native: null, statsCore: true, paletteGlyph: "rage" }),
    family("adaptive_resilience", "adaptive_resilience", 60, 180, "utilitycraft:titanium_plate", { native: null, statsCore: true, paletteGlyph: "fullArmor" }),
    family("soul_collector", "soul_collector", 60, 180, "utilitycraft:enderling_tear", { native: null, statsCore: true, paletteGlyph: "soul" }),
];

export const ALCHEMY = {
    energyCapacity: 2048000,
    brewEnergy: 12000,
    upgradeEnergy: 16000,
    brewTicks: 400,
    upgradeTicks: 200,
    blazeCapacity: 64000,
    aetheriumCapacity: 128000,
    blazePerPowder: 1000,
    blazePerBrew: 250,
    amplifyCost: 1000,
    extendCost: 750,
};

export const ALCHEMY_SLOTS = {
    energy: 0, status: 1, progress: 2, ingredient: 3,
    bottles: [4, 5, 6, 7, 8, 9], fuel: 10, blaze: 11, aetherium: 12,
    amplify: 13, extend: 14, amplifyButton: 15, extendButton: 16,
    amplifyProgress: 17, speed: 18, efficiency: 19, extendProgress: 20,
    itemIO: [21, 22, 23, 24, 25, 26], fluidIO: [27, 28, 29, 30, 31, 32],
    size: 34,
};

export const POTION_FORMS = ["drink", "splash", "lingering"];
export const POTION_EXTENTS = ["normal", "long", "maximum"];
export const potionItemId = (p) => `utilitycraft:alchemical_${p.family}_${p.level}_${p.extent}_${p.form}`;

export function potionEffects(p) {
    const f = POTION_FAMILIES.find(f => f.id === p.family);
    if (!f) return [];
    const duration = p.duration ?? (p.extent === "maximum" ? f.long * 4 : p.extent === "long" ? f.long : f.normal);
    if (f.id === "turtle_master") return [
        { id: "resistance", amplifier: p.level + 1, duration },
        { id: "slowness", amplifier: p.level === 2 ? 5 : 3, duration },
    ];
    return [{ id: f.effect, amplifier: p.level - 1, duration, ...(f.statsCore ? { statsCore: true } : {}) }];
}

// Tooltip estimates match the delivered effect, including a lingering cloud's quarter duration.
export function potionDescriptionEffects(p) {
    const factor = p.form === "lingering" ? 0.25 : 1;
    return potionEffects(p).map(effect => ({ ...effect, duration: effect.duration * factor }));
}

export function formatPotionDuration(seconds) {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export const potionLevelLabel = level => ["", "I", "II", "III", "IV", "V", "VI"][level] ?? String(level);

// Trial effects and StatsCore debuffs follow the same negative tooltip color as vanilla.
const NEGATIVE_POTION_EFFECTS = new Set([
    "slowness", "instant_damage", "poison", "weakness", "wither", "levitation", "blindness", "darkness",
    "wind_charged", "weaving", "oozing", "infested", "marked", "bleeding", "cursed",
]);
export const potionEffectColor = id => NEGATIVE_POTION_EFFECTS.has(id) ? "§c" : "§9";

// Canonical items can also carry an exact duration when upgrading a shorter native II.
export const CUSTOM_POTIONS = Object.fromEntries(POTION_FAMILIES.flatMap(f =>
    Array.from({ length: f.maxLevel }, (_, i) => i + 1).flatMap(level =>
        (f.instant ? ["normal"] : POTION_EXTENTS).flatMap(extent => POTION_FORMS.map(form => {
            const p = { family: f.id, level, extent, form };
            return [potionItemId(p), p];
        })),
    ),
));

export const NATIVE_POTIONS = Object.fromEntries(POTION_FAMILIES.flatMap(f => {
    if (!f.native) return f.id === "wither" ? [["minecraft:wither", { family: f.id, level: 1, extent: "normal" }]] : [];
    const list = [[`minecraft:${f.native}`, { family: f.id, level: 1, extent: "normal" }]];
    if (!f.instant && f.nativeLong !== false) list.push([`minecraft:long_${f.native}`, { family: f.id, level: 1, extent: "long" }]);
    if (f.strong !== undefined) list.push([`minecraft:strong_${f.native}`, {
        family: f.id, level: f.strongLevel ?? 2, extent: "normal", duration: f.strong,
    }]);
    return list;
}));

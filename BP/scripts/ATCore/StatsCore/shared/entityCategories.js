const MINECRAFT_NAMESPACE = "minecraft:";

export const ENTITY_CATEGORIES = Object.freeze({
    ally: "ally",
    passive: "passive",
    neutral: "neutral",
    hostile: "hostile",
    boss: "boss",
});

export const OFFENSIVE_ENTITY_CATEGORIES = Object.freeze([
    ENTITY_CATEGORIES.neutral,
    ENTITY_CATEGORIES.hostile,
    ENTITY_CATEGORIES.boss,
]);
const ENTITY_CATEGORY_SET = new Set(Object.values(ENTITY_CATEGORIES));
const normalizedFilterCache = new WeakMap();

function qualifyEntityIds(values) {
    return Object.freeze(values.map(value => value.includes(":") ? value : `${MINECRAFT_NAMESPACE}${value}`));
}

export const ENTITY_CATEGORY_MEMBERS = Object.freeze({
    [ENTITY_CATEGORIES.ally]: qualifyEntityIds([
        "player",
        "allay",
        "bat",
        "copper_golem",
        "happy_ghast",
        "iron_golem",
        "npc",
        "sniffer",
        "snow_golem",
        "villager",
        "villager_v2",
        "wandering_trader",
    ]),
    [ENTITY_CATEGORIES.passive]: qualifyEntityIds([
        "armadillo",
        "axolotl",
        "camel",
        "cat",
        "chicken",
        "cod",
        "cow",
        "donkey",
        "fox",
        "frog",
        "glow_squid",
        "horse",
        "mooshroom",
        "mule",
        "nautilus",
        "ocelot",
        "parrot",
        "pig",
        "rabbit",
        "salmon",
        "sheep",
        "skeleton_horse",
        "squid",
        "strider",
        "tadpole",
        "tropicalfish",
        "turtle",
        "zombie_horse",
    ]),
    [ENTITY_CATEGORIES.neutral]: qualifyEntityIds([
        "bee",
        "cave_spider",
        "dolphin",
        "enderman",
        "goat",
        "llama",
        "panda",
        "piglin",
        "polar_bear",
        "pufferfish",
        "spider",
        "trader_llama",
        "wolf",
        "zombie_pigman",
        "zombified_piglin",
    ]),
    [ENTITY_CATEGORIES.hostile]: qualifyEntityIds([
        "blaze",
        "bogged",
        "breeze",
        "camel_husk",
        "creaking",
        "creeper",
        "drowned",
        "endermite",
        "evocation_illager",
        "ghast",
        "guardian",
        "hoglin",
        "husk",
        "magma_cube",
        "parched",
        "phantom",
        "piglin_brute",
        "pillager",
        "ravager",
        "shulker",
        "silverfish",
        "skeleton",
        "slime",
        "stray",
        "sulfur_cube",
        "vex",
        "vindicator",
        "witch",
        "wither_skeleton",
        "zoglin",
        "zombie",
        "zombie_nautilus",
        "zombie_villager",
        "zombie_villager_v2",
    ]),
    [ENTITY_CATEGORIES.boss]: qualifyEntityIds([
        "elder_guardian",
        "elder_guardian_ghost",
        "ender_dragon",
        "warden",
        "wither",
    ]),
});

export const ENTITY_TYPE_CATEGORY = Object.freeze(
    Object.fromEntries(
        Object.entries(ENTITY_CATEGORY_MEMBERS).flatMap(([category, ids]) => {
            return ids.map(id => [id, category]);
        })
    )
);

function normalizeEntityId(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "";
    return normalized.includes(":") ? normalized : `${MINECRAFT_NAMESPACE}${normalized}`;
}

function matchesFamily(entity, family) {
    try {
        return entity?.matches?.({ families: [family] }) === true;
    } catch {
        return false;
    }
}

export function isTamedEntity(entity) {
    if (!entity) return false;
    if (entity.isTamed === true || matchesFamily(entity, "tamed")) return true;

    try {
        const tameable = entity.getComponent?.("minecraft:tameable")
            ?? entity.getComponent?.("tameable");
        return tameable?.isTamed === true
            || Boolean(tameable?.tamedToPlayerId)
            || Boolean(tameable?.tamedToPlayer);
    } catch {
        return false;
    }
}

export function normalizeEntityCategory(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ENTITY_CATEGORY_SET.has(normalized) ? normalized : "";
}

/**
 * Resolves a stable combat category for vanilla and third-party entities.
 * Dynamic ally checks take precedence over the static vanilla table.
 */
export function getEntityCategory(entity) {
    const typeId = normalizeEntityId(entity?.typeId ?? entity?.id);
    if (typeId === "minecraft:player" || isTamedEntity(entity)) {
        return ENTITY_CATEGORIES.ally;
    }

    const explicit = ENTITY_TYPE_CATEGORY[typeId];
    if (explicit) return explicit;

    if (matchesFamily(entity, "boss")) return ENTITY_CATEGORIES.boss;
    if (matchesFamily(entity, "monster") || matchesFamily(entity, "illager")) {
        return ENTITY_CATEGORIES.hostile;
    }
    if (matchesFamily(entity, "animal")) return ENTITY_CATEGORIES.passive;

    // Unknown living entities are treated conservatively instead of being
    // assumed hostile. Addon authors can still target their exact typeId.
    return ENTITY_CATEGORIES.neutral;
}

export function normalizeAppliesTo(value, fallback = undefined) {
    const source = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(/[,\s|]+/)
            : Array.isArray(fallback)
                ? fallback
                : typeof fallback === "string"
                    ? [fallback]
                    : [];
    const normalized = [];
    const seen = new Set();

    for (const entry of source) {
        const raw = String(entry ?? "").trim().toLowerCase();
        if (!raw) continue;

        const next = raw === "all" || raw === "any"
            ? "all"
            : normalizeEntityCategory(raw) || normalizeEntityId(raw);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        normalized.push(next);
    }

    return normalized;
}

/**
 * Supports category names (`hostile`, `boss`, ...), exact entity identifiers,
 * a single string, or an array of both.
 */
export function entityMatchesAppliesTo(entity, appliesTo, fallback = undefined) {
    let filters;
    let filterSet;
    const arraySource = Array.isArray(appliesTo)
        ? appliesTo
        : typeof appliesTo !== "string" && Array.isArray(fallback)
            ? fallback
            : null;
    if (arraySource) {
        const signature = arraySource.map(value => String(value ?? "")).join("\u001f");
        const cached = normalizedFilterCache.get(arraySource);
        if (cached?.signature === signature) {
            filters = cached.filters;
            filterSet = cached.filterSet;
        } else {
            filters = normalizeAppliesTo(appliesTo, fallback);
            filterSet = new Set(filters);
            normalizedFilterCache.set(arraySource, { signature, filters, filterSet });
        }
    } else {
        filters = normalizeAppliesTo(appliesTo, fallback);
        filterSet = new Set(filters);
    }
    if (filters.length <= 0 || filterSet.has("all")) return true;

    const typeId = normalizeEntityId(entity?.typeId ?? entity?.id);
    const category = getEntityCategory(entity);
    return filterSet.has(category) || filterSet.has(typeId);
}

export function effectAppliesToEntity(effect, entity, fallback = undefined) {
    return entityMatchesAppliesTo(entity, effect?.appliesTo, fallback);
}

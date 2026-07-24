const DAMAGE_TYPE_ALIASES = Object.freeze({
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

/**
 * Normalizes Bedrock damage causes into a stable snake_case identifier used across StatsCore.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeDamageType(value) {
    try {
        const raw = String(value ?? "all").trim().toLowerCase();
        if (!raw) return "all";

        const aliasKey = raw.replace(/[^a-z0-9]/g, "");
        return DAMAGE_TYPE_ALIASES[aliasKey] ?? raw.replace(/[\s:-]+/g, "_");
    } catch {
        return "all";
    }
}

/**
 * Extracts the normalized damage type from a Bedrock hurt event.
 *
 * @param {object} event
 * @returns {string}
 */
export function getEventDamageType(event) {
    return normalizeDamageType(event?.damageSource?.cause ?? event?.cause ?? "all");
}

/**
 * Resolves the victim entity from a Bedrock `entityHurt` event.
 *
 * @param {object} event
 * @returns {import("@minecraft/server").Entity | null}
 */
export function getEntityHurtTarget(event) {
    return event?.hurtEntity ?? event?.entity ?? null;
}

/**
 * Resolves the attacking entity from a Bedrock `entityHurt` event, including projectile owners.
 *
 * @param {object} event
 * @returns {import("@minecraft/server").Entity | null}
 */
export function getEntityHurtAttacker(event) {
    const projectile = event?.damageSource?.damagingProjectile ?? event?.damagingProjectile ?? null;
    return event?.damageSource?.damagingEntity
        ?? projectile?.owner
        ?? projectile?.source
        ?? projectile?.damagingEntity
        ?? event?.damagingEntity
        ?? event?.source
        ?? event?.sourceEntity
        ?? null;
}

/**
 * Deduplicates and normalizes a list of supported damage types.
 *
 * @param {string[]} values
 * @returns {string[]}
 */
export function uniqueDamageTypes(values) {
    if (!Array.isArray(values) || values.length <= 0) return [];

    const normalized = [];
    const seen = new Set();
    for (const value of values) {
        const next = normalizeDamageType(value);
        if (!next || seen.has(next)) continue;

        seen.add(next);
        normalized.push(next);
    }

    return normalized;
}

/**
 * Checks whether a normalized damage type is matched by a whitelist.
 *
 * @param {string[]} values
 * @param {string} damageType
 * @returns {boolean}
 */
export function matchesDamageType(values, damageType) {
    const normalizedValues = uniqueDamageTypes(values);
    const normalizedDamageType = normalizeDamageType(damageType);
    return normalizedValues.includes("all") || normalizedValues.includes(normalizedDamageType);
}

/**
 * Simple boss-like detection used by penetration scaling.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @returns {boolean}
 */
export function isBossLikeEntity(entity) {
    const id = String(entity?.typeId ?? "").toLowerCase();
    return id.includes("wither") || id.includes("ender_dragon") || id.includes("boss");
}


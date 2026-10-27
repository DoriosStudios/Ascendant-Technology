// Bonus XP is half of the Bedrock player-kill reward, before any native orb drop.
// Source: Mojang/bedrock-samples, behavior_pack/entities/*/minecraft:experience_reward.
// The special dragon reward is handled conservatively as the 500 XP repeat kill.
const HALF_REWARDS = Object.freeze({
    // Passive mobs: Math.Random(1, 3).
    ...Object.fromEntries([
        "armadillo", "axolotl", "bee", "camel", "camel_husk", "cat", "chicken", "cod",
        "cow", "dolphin", "donkey", "fox", "frog", "glow_squid", "goat", "happy_ghast",
        "horse", "llama", "mooshroom", "mule", "nautilus", "ocelot", "panda", "parrot",
        "pig", "polar_bear", "pufferfish", "rabbit", "salmon", "sheep", "skeleton_horse",
        "sniffer", "squid", "strider", "trader_llama", "tropicalfish", "turtle", "wolf",
        "zombie_horse", "zombie_nautilus",
    ].map(name => [`minecraft:${name}`, [0.5, 1.5]])),
    // Fixed 5 XP.
    ...Object.fromEntries([
        "cave_spider", "creeper", "enderman", "hoglin", "phantom", "shulker",
        "silverfish", "spider", "warden", "zoglin",
    ].map(name => [`minecraft:${name}`, [2.5, 2.5]])),
    ...Object.fromEntries(["blaze", "breeze", "elder_guardian", "guardian"].map(name => [`minecraft:${name}`, [5, 5]])),
    "minecraft:endermite": [1.5, 1.5],
    "minecraft:piglin_brute": [10, 10],
    "minecraft:ravager": [10, 10],
    "minecraft:wither": [25, 25],
    "minecraft:ender_dragon": [250, 250],
    // Source expressions use an equipment-count bonus; added below.
    ...Object.fromEntries([
        "bogged", "drowned", "ghast", "husk", "parched", "pillager", "skeleton",
        "stray", "vex", "vindicator", "witch", "wither_skeleton", "zombie",
        "zombie_pigman", "zombified_piglin", "zombie_villager",
    ].map(name => [`minecraft:${name}`, [2.5, 2.5]])),
    "minecraft:piglin": [2.5, 2.5],
    // These vanilla entities have no on-death XP reward in the sample entity.
    ...Object.fromEntries([
        "allay", "bat", "copper_golem", "creaking", "iron_golem", "snow_golem",
        "villager", "wandering_trader", "tadpole",
    ].map(name => [`minecraft:${name}`, [0, 0]])),
});
const GEARED = new Set([
    "minecraft:bogged", "minecraft:drowned", "minecraft:ghast", "minecraft:husk",
    "minecraft:parched", "minecraft:pillager", "minecraft:skeleton", "minecraft:stray",
    "minecraft:vex", "minecraft:vindicator", "minecraft:witch", "minecraft:wither_skeleton",
    "minecraft:zombie", "minecraft:zombie_pigman", "minecraft:zombified_piglin",
    "minecraft:zombie_villager", "minecraft:piglin",
]);
function equipmentCount(entity) {
    const equipment = entity.getComponent("minecraft:equippable");
    if (!equipment) return 0;
    let count = 0;
    for (const slot of ["Mainhand", "Offhand", "Head", "Chest", "Legs", "Feet"]) {
        try { if (equipment.getEquipment(slot)) count++; } catch {}
    }
    return count;
}
export function bonusXpRange(entity) {
    if (entity.typeId === "minecraft:slime" || entity.typeId === "minecraft:magma_cube") {
        const variant = Number(entity.getComponent("minecraft:variant")?.value ?? 0);
        const reward = Number.isFinite(variant) ? Math.max(0, variant) / 2 : 0;
        return [reward, reward];
    }
    const known = HALF_REWARDS[entity.typeId];
    if (known) {
        if (entity.getComponent("minecraft:is_baby")) {
            if (["minecraft:zombie", "minecraft:drowned", "minecraft:husk", "minecraft:zombie_villager", "minecraft:zombie_pigman", "minecraft:zombified_piglin"].includes(entity.typeId)) {
                const count = equipmentCount(entity);
                return [6 + count * 0.5, 6 + count * 1.5];
            }
            if (known[0] === 0.5 && known[1] === 1.5) return [0, 0];
        }
        if (!GEARED.has(entity.typeId)) return known;
        const count = equipmentCount(entity);
        const babyPiglin = entity.typeId === "minecraft:piglin" && !!entity.getComponent("minecraft:is_baby");
        const base = babyPiglin ? 0.5 : known[0];
        return [base + count * 0.5, base + count * (babyPiglin ? 1 : 1.5)];
    }
    if (entity.typeId.startsWith("minecraft:")) return [0, 0];
    const health = entity.getComponent("minecraft:health");
    const maxHealth = Number(health?.effectiveMax ?? health?.defaultValue ?? 16);
    const tiers = Math.max(1, Math.ceil((Number.isFinite(maxHealth) ? maxHealth : 16) / 16));
    return [2 * tiers, 5 * tiers];
}
export function rollBonusXp(entity, random = Math.random) {
    const [min, max] = bonusXpRange(entity);
    const value = min + (max - min) * random();
    const whole = Math.floor(value);
    return whole + (random() < value - whole ? 1 : 0);
}

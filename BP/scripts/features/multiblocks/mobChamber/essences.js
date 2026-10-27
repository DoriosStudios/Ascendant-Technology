import { SLOTS } from "./config.js";

export const ESSENCE_NAMES = Object.freeze([
    "blaze", "chicken", "cow", "creeper", "enderman", "guardian", "hoglin", "illager",
    "magma_cube", "mooshroom", "pig", "piglin", "sheep", "skeleton", "slime", "spider", "wither_skeleton", "zombie",
]);
export const ESSENCE_IDS = Object.freeze(ESSENCE_NAMES.map(name => `utilitycraft:${name}_essence`));
const allowed = new Set(ESSENCE_IDS);
export const isEssence = item => allowed.has(item?.typeId);
export const randomInt = (min, max, random = Math.random) => min + Math.floor(random() * (max - min + 1));

export function weightedChoice(entries, random = Math.random) {
    let roll = random() * entries.reduce((sum, entry) => sum + entry.weight, 0);
    for (const entry of entries) if ((roll -= entry.weight) < 0) return entry;
    return entries.at(-1);
}

export function deathProfile(essenceId, random = Math.random) {
    if (!allowed.has(essenceId)) throw new Error("Unsupported essence");
    let mob = essenceId.slice("utilitycraft:".length, -"_essence".length);
    if (mob === "illager") mob = weightedChoice([
        { mob: "pillager", weight: 45 }, { mob: "vindicator", weight: 35 },
        { mob: "witch", weight: 15 }, { mob: "evoker", weight: 1 },
    ], random).mob;
    const size = mob === "slime" || mob === "magma_cube"
        ? weightedChoice([{ size: 1, weight: 50 }, { size: 2, weight: 30 }, { size: 4, weight: 20 }], random).size : undefined;
    return { mob, entityId: `minecraft:${mob === "evoker" ? "evocation_illager" : mob}`, size };
}

// Adult profiles, no simulated equipment or babies. Equipment XP bonuses are not
// invented from a separate random gear roll; vanilla base reward is used.
// Source: Mojang/bedrock-samples behavior_pack/entities (see implementation doc).
export const XP_RANGES = Object.freeze({
    blaze: [10, 10], chicken: [1, 3], cow: [1, 3], creeper: [5, 5],
    enderman: [5, 5], guardian: [10, 10], hoglin: [5, 5], mooshroom: [1, 3],
    pig: [1, 3], piglin: [5, 5], sheep: [1, 3], skeleton: [5, 5], spider: [5, 5],
    wither_skeleton: [5, 5], zombie: [5, 5], pillager: [5, 5], vindicator: [5, 5],
    witch: [5, 5], evoker: [10, 10],
});
export function deathXp(profile, random = Math.random) {
    if (profile.size !== undefined) return profile.size;
    const [min, max] = XP_RANGES[profile.mob];
    return randomInt(min, max, random);
}

export function selectEssences(container, stats, cursor = 0) {
    const selected = [];
    let nextCursor = cursor % stats.essenceSlots;
    for (let offset = 0; offset < stats.essenceSlots && selected.length < stats.processingCapacity; offset++) {
        const index = (cursor + offset) % stats.essenceSlots;
        const slot = SLOTS.essences[index], item = container.getItem(slot);
        if (!isEssence(item)) continue;
        selected.push({ slot, typeId: item.typeId });
        nextCursor = (index + 1) % stats.essenceSlots;
    }
    return { selected, nextCursor };
}

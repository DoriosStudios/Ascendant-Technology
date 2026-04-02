import { system } from "@minecraft/server";

const REGISTER_FISHER_DROP_EVENT_IDS = Object.freeze([
    "utilitycraft:register_autofisher_drop",
    "utilitycraft:register_abysall_fisher_drop"
]);

/**
 * Main configuration of Abyssal Fisher loot and enchantment mechanics.
 * Includes parameters for luck effects, book enchantments, and equipment enchantments.
 */
export const abysallFisherConfig = Object.freeze({
    fishingCategories: Object.freeze({
        defaultCategory: "junk",
        baseWeights: Object.freeze({
            fish: 0.85,
            junk: 0.10,
            treasure: 0.05
        }),
        luckOfTheSea: Object.freeze({
            luckPerLevel: 10,
            maxEquivalentLevel: 3,
            fishDeltaPerLevel: -0.0015,
            junkDeltaPerLevel: -0.0195,
            treasureDeltaPerLevel: 0.021
        })
    }),
    luck: Object.freeze({
        default: 0,
        enchantChancePerLuck: 0.015,
        enchantCountPerLuck: 0.05,
        enchantQualityPerLuck: 0.025
    }),
    bookEnchant: Object.freeze({
        baseChance: 0.2,
        chancePerTier: 0.025,
        chancePerLuck: 0.018,
        maxChance: 0.92,
        guaranteedLuckThreshold: 24,
        guaranteedTierThreshold: 7,
        minCount: 1,
        maxCount: 3,
        countPerLuck: 0.08,
        minQuality: 0.18,
        qualityPerLuck: 0.03
    }),
    equipment: Object.freeze({
        durabilityDamageRange: Object.freeze([0.6, 0.95]),
        enchantChance: 0.12,
        chancePerTier: 0.015,
        chancePerLuck: 0.05, // 5% extra chance per luck level
        maxChance: 1,
        guaranteedLuckThreshold: 30, // At 30 luck, the drop is guaranteed to have enchantments
        enchantCount: Object.freeze([1, 2]),
        countPerLuck: 0.04,
        minQuality: 0.12,
        qualityPerLuck: 0.05
    })
});

export const abysallFisherLoot = [
    { item: "minecraft:cod", amount: [1, 3], chance: 0.45, tier: 0, category: "fish" },
    { item: "minecraft:salmon", amount: [1, 2], chance: 0.25, tier: 0, category: "fish" },
    { item: "minecraft:tropical_fish", amount: 1, chance: 0.10, tier: 1, category: "fish" },
    { item: "minecraft:pufferfish", amount: 1, chance: 0.08, tier: 1, category: "fish" },
    { item: "minecraft:string", amount: [1, 4], chance: 0.12, tier: 0, category: "junk" },
    { item: "minecraft:bone", amount: [1, 3], chance: 0.10, tier: 0, category: "junk" },
    { item: "minecraft:waterlily", amount: 1, chance: 0.08, tier: 0, category: "junk" },
    { item: "minecraft:ink_sac", amount: [1, 3], chance: 0.06, tier: 1, category: "junk" },
    { item: "minecraft:glow_ink_sac", amount: [1, 2], chance: 0.05, tier: 2, category: "junk" },
    { item: "minecraft:prismarine_shard", amount: [1, 3], chance: 0.04, tier: 2, category: "treasure" },
    { item: "minecraft:prismarine_crystals", amount: [1, 3], chance: 0.03, tier: 2, category: "treasure" },
    { item: "minecraft:nautilus_shell", amount: 1, chance: 0.025, tier: 3, category: "treasure" },
    { item: "minecraft:experience_bottle", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:name_tag", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:saddle", amount: 1, chance: 0.02, tier: 4, category: "treasure" },
    { item: "minecraft:emerald", amount: [1, 2], chance: 0.015, tier: 5, category: "treasure" },
    { item: "minecraft:potion", amount: 1, chance: 0.005, tier: 2, category: "junk" },
    { item: "minecraft:book", amount: 1, chance: 0.005, tier: 4, category: "treasure" },
    {
        item: "minecraft:fishing_rod",
        amount: 1,
        chance: 0.004,
        tier: 2,
        category: "treasure",
        durabilityDamageRange: abysallFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abysallFisherConfig.equipment.enchantChance,
            count: abysallFisherConfig.equipment.enchantCount
        }
    },
    {
        item: "minecraft:bow",
        amount: 1,
        chance: 0.0008,
        tier: 3,
        category: "treasure",
        durabilityDamageRange: abysallFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abysallFisherConfig.equipment.enchantChance,
            count: abysallFisherConfig.equipment.enchantCount
        }
    },
    { item: "minecraft:trident", amount: 1, chance: 0.0005, tier: 6, category: "treasure" },
    { item: "minecraft:heart_of_the_sea", amount: 1, chance: 0.001, tier: 6, category: "treasure" },
    { item: "minecraft:stick", amount: [0, 2], chance: 0.10, tier: 0, category: "junk" },
    {
        item: "minecraft:leather_boots",
        amount: 1,
        chance: 0.0008,
        tier: 2,
        category: "junk",
        durabilityDamageRange: abysallFisherConfig.equipment.durabilityDamageRange,
        randomEnchant: {
            chance: abysallFisherConfig.equipment.enchantChance,
            count: abysallFisherConfig.equipment.enchantCount
        }
    },
    { item: "utilitycraft:empty_liquid_capsule", amount: 1, chance: 0.004, tier: 5, category: "treasure" },
    { item: "utilitycraft:totem_shard", amount: 1, chance: 0.0002, tier: 7, category: "treasure" },
    { item: "utilitycraft:sand_handful", amount: [1, 6], chance: 0.02, tier: 0, category: "junk" }
];

function normalizeLootEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (typeof entry.item !== "string" || entry.item.length <= 0) return null;

    const chance = Number(entry.chance);
    const tier = Number(entry.tier);

    return {
        item: entry.item,
        amount: normalizeAmount(entry.amount ?? 1),
        chance: Number.isFinite(chance) ? Math.max(0, chance) : 0.1,
        tier: Number.isFinite(tier) ? Math.max(0, Math.floor(tier)) : 0,
        category: normalizeLootCategory(entry.category, entry.item),
        durabilityDamageRange: normalizeOptionalRange(entry.durabilityDamageRange),
        randomEnchant: normalizeRandomEnchant(entry.randomEnchant)
    };
}

function normalizeLootCategory(value, itemId = "") {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["fish", "junk", "treasure"].includes(normalized)) {
            return normalized;
        }
    }

    const normalizedItemId = typeof itemId === "string" ? itemId.toLowerCase() : "";
    if (["minecraft:cod", "minecraft:salmon", "minecraft:tropical_fish", "minecraft:pufferfish"].includes(normalizedItemId)) {
        return "fish";
    }

    if ([
        "minecraft:string",
        "minecraft:bone",
        "minecraft:waterlily",
        "minecraft:ink_sac",
        "minecraft:glow_ink_sac",
        "minecraft:potion",
        "minecraft:stick",
        "minecraft:leather_boots",
        "utilitycraft:sand_handful"
    ].includes(normalizedItemId)) {
        return "junk";
    }

    return "treasure";
}

function normalizeAmount(value) {
    if (Array.isArray(value) && value.length >= 2) {
        const min = normalizeNonNegativeInteger(value[0], 0);
        const max = normalizeNonNegativeInteger(value[1], min);
        return [Math.min(min, max), Math.max(min, max)];
    }

    return normalizeNonNegativeInteger(value, 1);
}

function normalizeOptionalRange(value) {
    if (!Array.isArray(value) || value.length < 2) return undefined;
    const min = Number(value[0]);
    const max = Number(value[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    return [Math.max(0, min), Math.max(min, max)];
}

function normalizeRandomEnchant(value) {
    if (!value || typeof value !== "object") return undefined;

    return {
        chance: Number.isFinite(Number(value.chance)) ? Math.max(0, Number(value.chance)) : undefined,
        count: normalizeCount(value.count),
        chancePerLuck: Number.isFinite(Number(value.chancePerLuck)) ? Math.max(0, Number(value.chancePerLuck)) : undefined,
        chancePerTier: Number.isFinite(Number(value.chancePerTier)) ? Math.max(0, Number(value.chancePerTier)) : undefined,
        maxChance: Number.isFinite(Number(value.maxChance)) ? Math.max(0, Number(value.maxChance)) : undefined,
        countPerLuck: Number.isFinite(Number(value.countPerLuck)) ? Math.max(0, Number(value.countPerLuck)) : undefined,
        countPerTier: Number.isFinite(Number(value.countPerTier)) ? Math.max(0, Number(value.countPerTier)) : undefined,
        qualityPerLuck: Number.isFinite(Number(value.qualityPerLuck)) ? Math.max(0, Number(value.qualityPerLuck)) : undefined,
        qualityPerTier: Number.isFinite(Number(value.qualityPerTier)) ? Math.max(0, Number(value.qualityPerTier)) : undefined,
        minQuality: Number.isFinite(Number(value.minQuality)) ? Math.max(0, Number(value.minQuality)) : undefined,
        guaranteedLuckThreshold: Number.isFinite(Number(value.guaranteedLuckThreshold)) ? Math.max(0, Number(value.guaranteedLuckThreshold)) : undefined,
        guaranteedTierThreshold: Number.isFinite(Number(value.guaranteedTierThreshold)) ? Math.max(0, Number(value.guaranteedTierThreshold)) : undefined
    };
}

function normalizeCount(value) {
    if (Array.isArray(value) && value.length >= 2) {
        const min = normalizePositiveInteger(value[0], 1);
        const max = normalizePositiveInteger(value[1], min);
        return [Math.min(min, max), Math.max(min, max)];
    }

    if (Number.isFinite(Number(value))) {
        return normalizePositiveInteger(value, 1);
    }

    return undefined;
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function normalizeNonNegativeInteger(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.max(0, Math.floor(parsed));
}

function makeLootSignature(entry) {
    return JSON.stringify([
        entry.item,
        entry.amount,
        entry.chance,
        entry.tier,
        entry.category ?? null,
        entry.durabilityDamageRange ?? null,
        entry.randomEnchant ?? null
    ]);
}

function appendLootEntries(entries) {
    const currentSignatures = new Set(abysallFisherLoot.map(makeLootSignature));
    let added = 0;

    for (const rawEntry of entries) {
        const entry = normalizeLootEntry(rawEntry);
        if (!entry) continue;

        const signature = makeLootSignature(entry);
        if (currentSignatures.has(signature)) continue;

        currentSignatures.add(signature);
        abysallFisherLoot.push(entry);
        added += 1;
    }

    return added;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (!REGISTER_FISHER_DROP_EVENT_IDS.includes(id)) return;

    try {
        const payload = JSON.parse(message);
        const entries = Array.isArray(payload) ? payload : [payload];
        const added = appendLootEntries(entries);

        if (added > 0) {
            console.warn(`[Abysall Fisher] Registered ${added} extra fishing loot entries.`);
        }
    } catch (error) {
        console.warn("[Abysall Fisher] Failed to parse fisher loot payload:", error);
    }
});

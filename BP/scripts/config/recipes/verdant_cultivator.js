import { system } from "@minecraft/server";

const VERDANT_CULTIVATOR_EVENT_ID = "utilitycraft:register_verdant_crop";

const UTILITY_PRODUCE_ITEM_IDS = Object.freeze({
    "utilitycraft:coal_seeds": Object.freeze(["minecraft:coal"]),
    "utilitycraft:copper_seeds": Object.freeze(["minecraft:raw_copper"]),
    "utilitycraft:dyes_seeds": Object.freeze(["minecraft:dye"]),
    "utilitycraft:glass_seeds": Object.freeze(["minecraft:glass"]),
    "utilitycraft:gunpowder_seeds": Object.freeze(["minecraft:gunpowder"]),
    "utilitycraft:iron_seeds": Object.freeze(["minecraft:raw_iron"]),
    "utilitycraft:leather_seeds": Object.freeze(["minecraft:leather"]),
    "utilitycraft:prismarine_crystals_seeds": Object.freeze(["minecraft:prismarine_crystals"]),
    "utilitycraft:prismarine_shards_seeds": Object.freeze(["minecraft:prismarine_shard"]),
    "utilitycraft:water_seeds": Object.freeze(["utilitycraft:water_ball"]),
    "utilitycraft:wool_seeds": Object.freeze(["minecraft:wool"]),
    "utilitycraft:ghast_seeds": Object.freeze(["minecraft:ghast_tear"]),
    "utilitycraft:glowstone_seeds": Object.freeze(["minecraft:glowstone_dust"]),
    "utilitycraft:gold_seeds": Object.freeze(["minecraft:raw_gold"]),
    "utilitycraft:honey_seeds": Object.freeze(["utilitycraft:honey_ball"]),
    "utilitycraft:lapis_seeds": Object.freeze(["minecraft:lapis_lazuli"]),
    "utilitycraft:lava_seeds": Object.freeze(["utilitycraft:lava_ball"]),
    "utilitycraft:quartz_seeds": Object.freeze(["minecraft:quartz"]),
    "utilitycraft:redstone_seeds": Object.freeze(["minecraft:redstone"]),
    "utilitycraft:resin_seeds": Object.freeze(["minecraft:resin_clump"]),
    "utilitycraft:slime_seeds": Object.freeze(["minecraft:slime_ball"]),
    "utilitycraft:amethyst_seeds": Object.freeze(["minecraft:amethyst_shard"]),
    "utilitycraft:blaze_seeds": Object.freeze(["minecraft:blaze_rod"]),
    "utilitycraft:diamond_seeds": Object.freeze(["utilitycraft:diamond_shard"]),
    "utilitycraft:emerald_seeds": Object.freeze(["utilitycraft:emerald_shard"]),
    "utilitycraft:enderpearl_seeds": Object.freeze(["minecraft:ender_pearl"]),
    "utilitycraft:obsidian_seeds": Object.freeze(["minecraft:obsidian"]),
    "utilitycraft:netherite_seeds": Object.freeze(["utilitycraft:netherite_nugget"]),
    "utilitycraft:nether_star_seeds": Object.freeze(["utilitycraft:nether_star_fragment"]),
    "utilitycraft:shulker_seeds": Object.freeze(["utilitycraft:shulker_shell_shard"]),
    "utilitycraft:totem_seeds": Object.freeze(["utilitycraft:totem_shard"]),
    "utilitycraft:wither_seeds": Object.freeze(["utilitycraft:wither_skull_shard"])
});

const UTILITY_TIER_SOILS = Object.freeze({
    1: "utilitycraft:yellow_soil",
    2: "utilitycraft:red_soil",
    3: "utilitycraft:blue_soil",
    4: "utilitycraft:black_soil"
});

const UTILITY_TIER_SEEDS = Object.freeze({
    1: Object.freeze([
        "utilitycraft:coal_seeds",
        "utilitycraft:copper_seeds",
        "utilitycraft:dyes_seeds",
        "utilitycraft:glass_seeds",
        "utilitycraft:gunpowder_seeds",
        "utilitycraft:iron_seeds",
        "utilitycraft:leather_seeds",
        "utilitycraft:prismarine_crystals_seeds",
        "utilitycraft:prismarine_shards_seeds",
        "utilitycraft:water_seeds",
        "utilitycraft:wool_seeds"
    ]),
    2: Object.freeze([
        "utilitycraft:ghast_seeds",
        "utilitycraft:glowstone_seeds",
        "utilitycraft:gold_seeds",
        "utilitycraft:honey_seeds",
        "utilitycraft:lapis_seeds",
        "utilitycraft:lava_seeds",
        "utilitycraft:quartz_seeds",
        "utilitycraft:redstone_seeds",
        "utilitycraft:resin_seeds",
        "utilitycraft:slime_seeds"
    ]),
    3: Object.freeze([
        "utilitycraft:amethyst_seeds",
        "utilitycraft:blaze_seeds",
        "utilitycraft:diamond_seeds",
        "utilitycraft:emerald_seeds",
        "utilitycraft:enderpearl_seeds",
        "utilitycraft:obsidian_seeds"
    ]),
    4: Object.freeze([
        "utilitycraft:nether_star_seeds",
        "utilitycraft:netherite_seeds",
        "utilitycraft:shulker_seeds",
        "utilitycraft:totem_seeds",
        "utilitycraft:wither_seeds"
    ])
});

const UTILITY_CROP_NAME_OVERRIDES = Object.freeze({
    prismarine_crystals: "prismarine_crystal_crop",
    nether_star: "netherstar_crop"
});

const UTILITY_BIOME_CONFIG = Object.freeze({
    water: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    prismarine_crystals: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    prismarine_shards: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    slime: Object.freeze({
        tokens: Object.freeze(["swamp", "mangrove"]),
        title: "Bog Bloom"
    }),
    resin: Object.freeze({
        tokens: Object.freeze(["swamp", "mangrove"]),
        title: "Bog Bloom"
    }),
    honey: Object.freeze({
        tokens: Object.freeze(["flower", "meadow", "sunflower"]),
        title: "Flower Burst"
    }),
    ghast: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    glowstone: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    quartz: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    blaze: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    netherite: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    nether_star: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    wither: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    })
});

const nativeVerdantCropDefinitions = Object.freeze({
    "minecraft:wheat_seeds": Object.freeze({
        seedItemId: "minecraft:wheat_seeds",
        cropBlockId: "minecraft:wheat",
        commandBlockId: "wheat",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze(["minecraft:wheat_seeds"]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom",
        pickupItemIds: Object.freeze(["minecraft:wheat_seeds", "minecraft:wheat"])
    }),
    "minecraft:carrot": Object.freeze({
        seedItemId: "minecraft:carrot",
        cropBlockId: "minecraft:carrots",
        commandBlockId: "carrots",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom",
        pickupItemIds: Object.freeze(["minecraft:carrot"])
    }),
    "minecraft:potato": Object.freeze({
        seedItemId: "minecraft:potato",
        cropBlockId: "minecraft:potatoes",
        commandBlockId: "potatoes",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom",
        pickupItemIds: Object.freeze(["minecraft:potato"])
    }),
    "minecraft:beetroot_seeds": Object.freeze({
        seedItemId: "minecraft:beetroot_seeds",
        cropBlockId: "minecraft:beetroot",
        commandBlockId: "beetroot",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze(["minecraft:beetroot_seeds"]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom",
        pickupItemIds: Object.freeze(["minecraft:beetroot_seeds", "minecraft:beetroot"])
    }),
    "minecraft:nether_wart": Object.freeze({
        seedItemId: "minecraft:nether_wart",
        cropBlockId: "minecraft:nether_wart",
        commandBlockId: "nether_wart",
        ageState: "age",
        maxAge: 3,
        validSoils: Object.freeze(["minecraft:soul_sand"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["nether"]),
        biomeTitle: "Nether Resonance",
        pickupItemIds: Object.freeze(["minecraft:nether_wart"])
    }),
    ...buildUtilityCropDefinitions()
});

const verdantCropDefinitionsBySeedItemId = Object.create(null);
const verdantCropDefinitionsByBlockId = Object.create(null);

seedNativeVerdantCropDefinitions();

export function getVerdantCultivatorCropSpec(seedItemId) {
    if (!seedItemId) return null;
    return verdantCropDefinitionsBySeedItemId[seedItemId] ?? null;
}

export function getVerdantCultivatorCropSpecByBlockId(blockId) {
    if (!blockId) return null;
    return verdantCropDefinitionsByBlockId[blockId] ?? null;
}

export function isVerdantCultivatorSeedItem(itemOrTypeId) {
    const typeId = typeof itemOrTypeId === "string"
        ? itemOrTypeId
        : itemOrTypeId?.typeId;

    return Boolean(getVerdantCultivatorCropSpec(typeId));
}

export function getVerdantCultivatorTrackedDropIds(specs = []) {
    const trackedIds = [];
    const seen = new Set();

    for (const spec of specs) {
        for (const itemId of spec?.pickupItemIds ?? []) {
            if (seen.has(itemId)) continue;
            seen.add(itemId);
            trackedIds.push(itemId);
        }
    }

    return trackedIds;
}

export function registerVerdantCultivatorCrop(seedItemId, definition) {
    const normalized = normalizeVerdantCropEntry(seedItemId, definition);
    if (!normalized) return false;

    const existing = verdantCropDefinitionsBySeedItemId[seedItemId];
    if (existing?.cropBlockId && existing.cropBlockId !== normalized.cropBlockId) {
        delete verdantCropDefinitionsByBlockId[existing.cropBlockId];
    }

    verdantCropDefinitionsBySeedItemId[seedItemId] = normalized;
    verdantCropDefinitionsByBlockId[normalized.cropBlockId] = normalized;
    return true;
}

function seedNativeVerdantCropDefinitions() {
    for (const [seedItemId, definition] of Object.entries(nativeVerdantCropDefinitions)) {
        registerVerdantCultivatorCrop(seedItemId, definition);
    }
}

function buildUtilityCropDefinitions() {
    const definitions = {};

    for (const [tierKey, seedIds] of Object.entries(UTILITY_TIER_SEEDS)) {
        const tier = Number(tierKey);
        const soilId = UTILITY_TIER_SOILS[tier];
        if (!soilId) continue;

        for (const seedItemId of seedIds) {
            const rawName = seedItemId.split(":")[1]?.replace(/_seeds$/, "") ?? "";
            if (!rawName) continue;

            const cropName = UTILITY_CROP_NAME_OVERRIDES[rawName] ?? `${rawName}_crop`;
            const biomeConfig = UTILITY_BIOME_CONFIG[rawName] ?? null;

            definitions[seedItemId] = Object.freeze({
                seedItemId,
                cropBlockId: `utilitycraft:${cropName}`,
                commandBlockId: `utilitycraft:${cropName}`,
                ageState: "utilitycraft:age",
                maxAge: 5,
                validSoils: Object.freeze([soilId]),
                bonusExclusions: Object.freeze([seedItemId]),
                biomeTokens: Object.freeze([...(biomeConfig?.tokens ?? [])]),
                biomeTitle: biomeConfig?.title ?? null,
                pickupItemIds: Object.freeze([
                    seedItemId,
                    ...(UTILITY_PRODUCE_ITEM_IDS[seedItemId] ?? [])
                ])
            });
        }
    }

    return definitions;
}

function normalizeVerdantCropEntry(seedItemId, definition) {
    if (!seedItemId || typeof seedItemId !== "string" || !definition || typeof definition !== "object") {
        return null;
    }

    const cropBlockId = typeof definition.cropBlockId === "string" && definition.cropBlockId.length > 0
        ? definition.cropBlockId
        : null;
    if (!cropBlockId) return null;

    const validSoils = normalizeStringArray(definition.validSoils);
    if (validSoils.length <= 0) return null;

    const pickupItemIds = normalizeStringArray(definition.pickupItemIds);
    const normalized = {
        seedItemId,
        cropBlockId,
        commandBlockId: typeof definition.commandBlockId === "string" && definition.commandBlockId.length > 0
            ? definition.commandBlockId
            : cropBlockId,
        ageState: typeof definition.ageState === "string" && definition.ageState.length > 0
            ? definition.ageState
            : "growth",
        maxAge: Math.max(1, Number(definition.maxAge) || 1),
        validSoils: Object.freeze(validSoils),
        bonusExclusions: Object.freeze(normalizeStringArray(definition.bonusExclusions, [seedItemId])),
        biomeTokens: Object.freeze(normalizeStringArray(definition.biomeTokens)),
        biomeTitle: typeof definition.biomeTitle === "string" && definition.biomeTitle.length > 0
            ? definition.biomeTitle
            : null,
        pickupItemIds: Object.freeze(pickupItemIds.length > 0 ? pickupItemIds : [seedItemId])
    };

    return Object.freeze(normalized);
}

function normalizeStringArray(value, fallback = []) {
    if (!Array.isArray(value)) return [...fallback];

    const seen = new Set();
    const normalized = [];
    for (const entry of value) {
        if (typeof entry !== "string" || entry.length <= 0 || seen.has(entry)) continue;
        seen.add(entry);
        normalized.push(entry);
    }

    return normalized.length > 0 ? normalized : [...fallback];
}

function registerVerdantCropsFromPayload(payload) {
    let added = 0;

    const registerEntry = (seedItemId, definition) => {
        if (registerVerdantCultivatorCrop(seedItemId, definition)) {
            added += 1;
        }
    };

    if (Array.isArray(payload)) {
        for (const entry of payload) {
            const seedItemId = typeof entry?.seedItemId === "string" ? entry.seedItemId : null;
            if (!seedItemId) continue;
            registerEntry(seedItemId, entry);
        }
        return added;
    }

    if (!payload || typeof payload !== "object") return 0;

    if (typeof payload.seedItemId === "string") {
        registerEntry(payload.seedItemId, payload);
        return added;
    }

    for (const [seedItemId, definition] of Object.entries(payload)) {
        registerEntry(seedItemId, definition);
    }

    return added;
}

/*
Registration payloads accepted by `utilitycraft:register_verdant_crop`:

1) Object keyed by seed id
{
    "example:my_seed": {
        "cropBlockId": "example:my_crop",
        "commandBlockId": "example:my_crop",
        "ageState": "example:age",
        "maxAge": 5,
        "validSoils": ["minecraft:farmland"],
        "bonusExclusions": ["example:my_seed"],
        "pickupItemIds": ["example:my_seed", "example:my_output"]
    }
}

2) Single entry object or array of entry objects with `seedItemId`
*/

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== VERDANT_CULTIVATOR_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        registerVerdantCropsFromPayload(payload);
    } catch {
        // Ignore malformed registration payloads to keep Verdant crop support stable.
    }
});

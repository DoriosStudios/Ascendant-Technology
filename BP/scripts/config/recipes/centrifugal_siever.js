import { system } from '@minecraft/server'

const CENTRIFUGAL_SIEVE_EVENT_ID = 'utilitycraft:register_sieve_drop'

const nativeCentrifugalSieveRecipeDefinitions = Object.freeze({
    'minecraft:gravel': [
        { item: 'minecraft:flint', amount: 1, chance: 0.20, tier: 0 },
        { item: 'utilitycraft:iron_chunk', amount: 1, chance: 0.15, tier: 1 },
        { item: 'utilitycraft:coal_chunk', amount: 1, chance: 0.25, tier: 0 },
        { item: 'utilitycraft:gold_chunk', amount: 1, chance: 0.05, tier: 3 },
        { item: 'utilitycraft:lapislazuli_chunk', amount: 1, chance: 0.025, tier: 3 },
        { item: 'utilitycraft:emerald_chunk', amount: 1, chance: 0.02, tier: 4 },
        { item: 'utilitycraft:diamond_chunk', amount: 1, chance: 0.01, tier: 4 }
    ],
    'minecraft:dirt': [
        { item: 'minecraft:carrot', amount: 1, chance: 0.10 },
        { item: 'minecraft:potato', amount: 1, chance: 0.10 },
        { item: 'minecraft:wheat_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:pumpkin_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:beetroot_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:melon_seeds', amount: 1, chance: 0.10 },
        { item: 'minecraft:sugar_cane', amount: 1, chance: 0.10 },
        { item: 'minecraft:bamboo', amount: 1, chance: 0.10 },
        { item: 'minecraft:acacia_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:birch_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:dark_oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:jungle_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:mangrove_propagule', amount: 1, chance: 0.10 },
        { item: 'minecraft:oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:pale_oak_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:spruce_sapling', amount: 1, chance: 0.10 },
        { item: 'minecraft:cherry_sapling', amount: 1, chance: 0.10 }
    ],
    'minecraft:grass_block': [
        { item: 'minecraft:red_flower', amount: 1, chance: 0.20 },
        { item: 'minecraft:yellow_flower', amount: 1, chance: 0.20 },
        { item: 'minecraft:double_plant', amount: 1, chance: 0.20 },
        { item: 'minecraft:torchflower', amount: 1, chance: 0.20 },
        { item: 'minecraft:pitcher_plant', amount: 1, chance: 0.20 },
        { item: 'minecraft:pink_petals', amount: 1, chance: 0.20 }
    ],
    'utilitycraft:crushed_netherrack': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 1, chance: 0.33, tier: 1 },
        { item: 'minecraft:gold_nugget', amount: 1, chance: 0.20, tier: 3 },
        { item: 'utilitycraft:nether_gold_chunk', amount: 1, chance: 0.33, tier: 3 },
        { item: 'utilitycraft:ancient_debris_chunk', amount: 1, chance: 0.025, tier: 5 }
    ],
    'minecraft:sand': [
        { item: 'minecraft:prismarine_shard', amount: 1, chance: 0.10, tier: 2 },
        { item: 'minecraft:prismarine_crystals', amount: 1, chance: 0.10, tier: 2 },
        { item: 'utilitycraft:copper_chunk', amount: 1, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:redstone_chunk', amount: 1, chance: 0.20, tier: 2 },
        { item: 'minecraft:bone_meal', amount: 1, chance: 0.25 },
        { item: 'minecraft:gunpowder', amount: 1, chance: 0.12 },
        { item: 'minecraft:glowstone_dust', amount: 1, chance: 0.08 },
        { item: 'minecraft:blaze_powder', amount: 1, chance: 0.10, tier: 3 },
        { item: 'minecraft:cactus', amount: 1, chance: 0.10 },
        { item: 'minecraft:kelp', amount: 1, chance: 0.10 },
        { item: 'minecraft:clay_ball', amount: 1, chance: 0.10, tier: 2 },
        { item: 'minecraft:cocoa_beans', amount: 1, chance: 0.01 },
        { item: 'minecraft:conduit', amount: 1, chance: 0.005, tier: 4 },
        { item: 'ae2be:certus_quartz_crystal', amount: 1, chance: 0.17, tier: 3 },
        { item: 'ae2be:charged_certus_quartz_crystal', amount: 1, chance: 0.01, tier: 4 }
    ],
    'minecraft:soul_sand': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 1, chance: 0.33, tier: 1 },
        { item: 'utilitycraft:nether_quartz_chunk', amount: 3, chance: 0.10, tier: 1 },
        { item: 'minecraft:bone', amount: 1, chance: 0.15 },
        { item: 'minecraft:ghast_tear', amount: 1, chance: 0.08, tier: 4 },
        { item: 'minecraft:nether_wart', amount: 1, chance: 0.12 },
        { item: 'minecraft:warped_fungus', amount: 1, chance: 0.10 },
        { item: 'minecraft:crimson_fungus', amount: 1, chance: 0.10 }
    ],
    'utilitycraft:crushed_endstone': [
        { item: 'minecraft:chorus_flower', amount: 1, chance: 0.01, tier: 4 },
        { item: 'minecraft:chorus_fruit', amount: 1, chance: 0.80, tier: 4 },
        { item: 'minecraft:ender_pearl', amount: 1, chance: 0.16, tier: 4 }
    ],
    'utilitycraft:crushed_cobbled_deepslate': [
        { item: 'minecraft:echo_shard', amount: 1, chance: 0.05, tier: 5 },
        { item: 'minecraft:sculk_catalyst', amount: 1, chance: 0.005, tier: 5 },
        { item: 'minecraft:amethyst_shard', amount: 1, chance: 0.01, tier: 5 },
        { item: 'utilitycraft:deepslate_diamond_chunk', amount: 1, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_emerald_chunk', amount: 1, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_gold_chunk', amount: 1, chance: 0.20, tier: 4 },
        { item: 'utilitycraft:deepslate_iron_chunk', amount: 1, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:deepslate_lapislazuli_chunk', amount: 1, chance: 0.15, tier: 3 },
        { item: 'utilitycraft:deepslate_coal_chunk', amount: 1, chance: 0.30, tier: 0 }
    ],
    'utilitycraft:compressed_gravel': [
        { item: 'minecraft:flint', amount: 9, chance: 0.20, tier: 0 },
        { item: 'utilitycraft:iron_chunk', amount: 9, chance: 0.15, tier: 1 },
        { item: 'utilitycraft:coal_chunk', amount: 9, chance: 0.25, tier: 0 },
        { item: 'utilitycraft:gold_chunk', amount: 9, chance: 0.05, tier: 3 },
        { item: 'utilitycraft:lapislazuli_chunk', amount: 9, chance: 0.025, tier: 3 },
        { item: 'utilitycraft:emerald_chunk', amount: 9, chance: 0.02, tier: 4 },
        { item: 'utilitycraft:diamond_chunk', amount: 9, chance: 0.01, tier: 4 }
    ],
    'utilitycraft:compressed_dirt': [
        { item: 'minecraft:carrot', amount: 9, chance: 0.10 },
        { item: 'minecraft:potato', amount: 9, chance: 0.10 },
        { item: 'minecraft:wheat_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:pumpkin_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:beetroot_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:melon_seeds', amount: 9, chance: 0.10 },
        { item: 'minecraft:sugar_cane', amount: 9, chance: 0.10 },
        { item: 'minecraft:bamboo', amount: 9, chance: 0.10 },
        { item: 'minecraft:acacia_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:birch_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:dark_oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:jungle_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:mangrove_propagule', amount: 9, chance: 0.10 },
        { item: 'minecraft:oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:pale_oak_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:spruce_sapling', amount: 9, chance: 0.10 },
        { item: 'minecraft:cherry_sapling', amount: 9, chance: 0.10 }
    ],
    'utilitycraft:compressed_sand': [
        { item: 'minecraft:prismarine_shard', amount: 9, chance: 0.10, tier: 2 },
        { item: 'minecraft:prismarine_crystals', amount: 9, chance: 0.10, tier: 2 },
        { item: 'utilitycraft:copper_chunk', amount: 9, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:redstone_chunk', amount: 9, chance: 0.20, tier: 2 },
        { item: 'minecraft:bone_meal', amount: 9, chance: 0.25 },
        { item: 'minecraft:gunpowder', amount: 9, chance: 0.12 },
        { item: 'minecraft:glowstone_dust', amount: 9, chance: 0.08 },
        { item: 'minecraft:blaze_powder', amount: 9, chance: 0.10, tier: 3 },
        { item: 'minecraft:cactus', amount: 9, chance: 0.10 },
        { item: 'minecraft:kelp', amount: 9, chance: 0.10 },
        { item: 'minecraft:clay_ball', amount: 9, chance: 0.10, tier: 2 },
        { item: 'minecraft:cocoa_beans', amount: 9, chance: 0.01 },
        { item: 'minecraft:conduit', amount: 9, chance: 0.005, tier: 4 },
        { item: 'ae2be:certus_quartz_crystal', amount: 9, chance: 0.17, tier: 3 },
        { item: 'ae2be:charged_certus_quartz_crystal', amount: 9, chance: 0.01, tier: 4 }
    ],
    'utilitycraft:compressed_crushed_netherrack': [
        { item: 'utilitycraft:nether_quartz_chunk', amount: 9, chance: 0.33, tier: 1 },
        { item: 'minecraft:gold_nugget', amount: 9, chance: 0.20, tier: 3 },
        { item: 'utilitycraft:nether_gold_chunk', amount: 9, chance: 0.33, tier: 3 },
        { item: 'utilitycraft:ancient_debris_chunk', amount: 9, chance: 0.025, tier: 5 }
    ],
    'utilitycraft:compressed_crushed_cobbled_deepslate': [
        { item: 'minecraft:echo_shard', amount: 9, chance: 0.05, tier: 5 },
        { item: 'minecraft:sculk_catalyst', amount: 9, chance: 0.005, tier: 5 },
        { item: 'minecraft:amethyst_shard', amount: 9, chance: 0.01, tier: 5 },
        { item: 'utilitycraft:deepslate_diamond_chunk', amount: 9, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_emerald_chunk', amount: 9, chance: 0.05, tier: 4 },
        { item: 'utilitycraft:deepslate_gold_chunk', amount: 9, chance: 0.20, tier: 4 },
        { item: 'utilitycraft:deepslate_iron_chunk', amount: 9, chance: 0.25, tier: 1 },
        { item: 'utilitycraft:deepslate_lapislazuli_chunk', amount: 9, chance: 0.15, tier: 3 },
        { item: 'utilitycraft:deepslate_coal_chunk', amount: 9, chance: 0.30, tier: 0 }
    ],
    'utilitycraft:compressed_crushed_endstone': [
        { item: 'minecraft:chorus_flower', amount: 9, chance: 0.01, tier: 4 },
        { item: 'minecraft:chorus_fruit', amount: 9, chance: 0.80, tier: 4 },
        { item: 'minecraft:ender_pearl', amount: 9, chance: 0.16, tier: 4 }
    ]
})

const centrifugalSieveRecipes = new Map()

seedNativeRecipes()

export function getCentrifugalSieveRecipes() {
    return centrifugalSieveRecipes
}

export function getCentrifugalSieveRecipe(inputId) {
    if (!inputId) return null
    return centrifugalSieveRecipes.get(inputId) ?? null
}

function seedNativeRecipes() {
    for (const [inputId, entries] of Object.entries(nativeCentrifugalSieveRecipeDefinitions)) {
        centrifugalSieveRecipes.set(inputId, normalizeLootEntries(entries))
    }
}

function normalizeLootEntries(entries = []) {
    if (!Array.isArray(entries)) return []

    return entries
        .map(normalizeLootEntry)
        .filter(Boolean)
}

function normalizeLootEntry(entry) {
    if (!entry || typeof entry !== 'object') return null
    if (!entry.item || typeof entry.item !== 'string') return null

    const amount = normalizeAmount(entry.amount ?? 1)
    const chance = Number.isFinite(Number(entry.chance)) ? Number(entry.chance) : 0.1
    const tier = Number.isFinite(Number(entry.tier)) ? Math.max(0, Number(entry.tier)) : 0

    return {
        item: entry.item,
        amount,
        chance,
        tier
    }
}

function normalizeAmount(value) {
    if (Array.isArray(value) && value.length >= 2) {
        const min = normalizePositiveInteger(value[0], 1)
        const max = normalizePositiveInteger(value[1], min)
        return [Math.min(min, max), Math.max(min, max)]
    }

    return normalizePositiveInteger(value, 1)
}

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.max(1, Math.floor(parsed))
}

function makeLootSignature(entry) {
    const amount = Array.isArray(entry.amount)
        ? `${entry.amount[0]}-${entry.amount[1]}`
        : `${entry.amount}`
    return `${entry.item}|${amount}|${entry.chance}|${entry.tier}`
}

function appendLootEntries(inputId, entries) {
    const normalized = normalizeLootEntries(entries)
    if (!normalized.length) return 0

    const current = centrifugalSieveRecipes.get(inputId) ?? []
    const signatures = new Set(current.map(makeLootSignature))
    let added = 0

    for (const entry of normalized) {
        const signature = makeLootSignature(entry)
        if (signatures.has(signature)) continue
        signatures.add(signature)
        current.push(entry)
        added += 1
    }

    centrifugalSieveRecipes.set(inputId, current)
    return added
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== CENTRIFUGAL_SIEVE_EVENT_ID) return

    try {
        const payload = JSON.parse(message)
        if (!payload || typeof payload !== 'object') return

        let added = 0
        for (const [inputId, entries] of Object.entries(payload)) {
            if (!inputId || typeof inputId !== 'string') continue
            added += appendLootEntries(inputId, entries)
        }

        if (added > 0) {
            console.warn(`[Centrifugal Siever] Registered ${added} extra sieve loot entries.`)
        }
    } catch (error) {
        console.warn('[Centrifugal Siever] Failed to parse sieve recipe payload:', error)
    }
})

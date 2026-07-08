import { system } from '@minecraft/server'

const CENTRIFUGAL_SIEVE_EVENT_ID = 'utilitycraft:register_sieve_drop'

const nativeCentrifugalSieveRecipeDefinitions = {}

const centrifugalSieveRecipes = new Map()

export function getCentrifugalSieveRecipe(inputId) {
    if (!inputId) return null
    return centrifugalSieveRecipes.get(inputId) ?? null
}

function seedNativeRecipes() {
    for (const [inputId, entries] of Object.entries(nativeCentrifugalSieveRecipeDefinitions)) {
        centrifugalSieveRecipes.set(inputId, normalizeLootEntries(entries))
    }
    // Dual Siever inherits all recipes from Centrifugal Siever by default.
    // No separate logic is needed unless exclusive recipes are added later.
}

seedNativeRecipes()

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

function normalizeLootEntries(entries = []) {
    if (!Array.isArray(entries)) return []

    return entries
        .map(normalizeLootEntry)
        .filter(Boolean)
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

    } catch (error) {
        console.warn('[Centrifugal Siever] Failed to parse sieve recipe payload:', error)
    }
})

/**
 * Gets recipes for the Centrifugal Siever.
 * @returns {Map<string, any[]>}
 */
export function getCentrifugalSieveRecipes() {
    return centrifugalSieveRecipes
}

// Dual Siever uses the same recipe map.
export const getDualSieverRecipes = getCentrifugalSieveRecipes

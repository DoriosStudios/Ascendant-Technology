// DoriosCore/machinery/helpers.js
// Shared utility functions used across multiple machine files.
// Extracted to avoid duplication and centralize maintenance.

import { FluidManager } from './fluidStorage.js'
import { TICKS_PER_SECOND } from '../constants.js'

const RECIPE_LOOKUP_CACHE = new WeakMap()
const FLUID_RECIPE_LOOKUP_CACHE = new WeakMap()
const ADAPTIVE_CHECK_STATE = new WeakMap()
const ENTITY_JSON_ARRAY_CACHE = new WeakMap()
const ENTITY_RENDER_SIGNATURE_CACHE = new WeakMap()

export const ADAPTIVE_CHECK_RESULT = Object.freeze({
    moved: 'moved',
    idle: 'idle',
    stalled: 'stalled'
})

const ADAPTIVE_CHECK_DEFAULTS = Object.freeze({
    interval: 4,
    idleBackoffTicks: 6,
    stallBackoffTicks: 12,
    failureEscalationThreshold: 2,
    drasticBackoffTicks: 40
})

// ──────────────────────────────────────────────────────
// COOLDOWN / TICK GATE
// ──────────────────────────────────────────────────────

/**
 * Entity-based cooldown gate using dynamic properties.
 * Returns `true` once every `interval` ticks, `false` otherwise.
 */
export function tickGate(entity, key, interval) {
    const normalizedInterval = Math.max(0, Math.floor(Number(interval) || 0))
    if (normalizedInterval <= 0) return true

    const tickCount = Number(globalThis.tickCount ?? 0)
    const tickStep = Math.floor(tickCount / 2)
    const tickStepCycle = 500
    const lastTriggeredStep = Number(entity.getDynamicProperty(key))

    if (!Number.isFinite(lastTriggeredStep)) {
        entity.setDynamicProperty(key, tickStep)
        return true
    }

    const elapsedSteps = tickStep >= lastTriggeredStep
        ? tickStep - lastTriggeredStep
        : (tickStepCycle - lastTriggeredStep) + tickStep

    if (elapsedSteps <= normalizedInterval) {
        return false
    }

    entity.setDynamicProperty(key, tickStep)
    return true
}

function normalizeAdaptiveCheckResult(value) {
    if (value === ADAPTIVE_CHECK_RESULT.moved || value === true) {
        return ADAPTIVE_CHECK_RESULT.moved
    }

    if (value === ADAPTIVE_CHECK_RESULT.idle) {
        return ADAPTIVE_CHECK_RESULT.idle
    }

    return ADAPTIVE_CHECK_RESULT.stalled
}

function resolveAdaptiveCheckOptions(options = {}) {
    const interval = Math.max(0, Math.floor(Number(options.interval) || ADAPTIVE_CHECK_DEFAULTS.interval))
    const idleBackoffTicks = Math.max(0, Math.floor(Number(options.idleBackoffTicks) || ADAPTIVE_CHECK_DEFAULTS.idleBackoffTicks))
    const stallBackoffTicks = Math.max(0, Math.floor(Number(options.stallBackoffTicks) || ADAPTIVE_CHECK_DEFAULTS.stallBackoffTicks))
    const failureEscalationThreshold = Math.max(1, Math.floor(Number(options.failureEscalationThreshold) || ADAPTIVE_CHECK_DEFAULTS.failureEscalationThreshold))
    const drasticBackoffTicks = Math.max(0, Math.floor(Number(options.drasticBackoffTicks) || ADAPTIVE_CHECK_DEFAULTS.drasticBackoffTicks))

    return {
        interval,
        idleBackoffTicks,
        stallBackoffTicks,
        failureEscalationThreshold,
        drasticBackoffTicks
    }
}

function getAdaptiveCheckChannelState(entity, channel) {
    let entityState = ADAPTIVE_CHECK_STATE.get(entity)
    if (!entityState) {
        entityState = new Map()
        ADAPTIVE_CHECK_STATE.set(entity, entityState)
    }

    let channelState = entityState.get(channel)
    if (!channelState) {
        channelState = {
            backoff: 0,
            failStreak: 0
        }
        entityState.set(channel, channelState)
    }

    return channelState
}

export function runAdaptiveTickGate(entity, channel, options, evaluate) {
    if (!entity || typeof channel !== 'string' || channel.length <= 0) return null

    const settings = resolveAdaptiveCheckOptions(options)
    const state = getAdaptiveCheckChannelState(entity, channel)

    if (state.backoff > 0) {
        state.backoff--
        return null
    }

    const gateKey = `${channel}:gate`
    if (!tickGate(entity, gateKey, settings.interval)) {
        return null
    }

    const rawResult = typeof evaluate === 'function'
        ? evaluate()
        : ADAPTIVE_CHECK_RESULT.stalled
    const result = normalizeAdaptiveCheckResult(rawResult)

    if (result === ADAPTIVE_CHECK_RESULT.moved) {
        state.failStreak = 0
        state.backoff = 0
        return result
    }

    if (result === ADAPTIVE_CHECK_RESULT.idle) {
        state.failStreak = 0
        state.backoff = settings.idleBackoffTicks
        return result
    }

    state.failStreak = Math.max(0, state.failStreak + 1)
    state.backoff = state.failStreak >= settings.failureEscalationThreshold
        ? settings.drasticBackoffTicks
        : settings.stallBackoffTicks

    return ADAPTIVE_CHECK_RESULT.stalled
}

export function resetAdaptiveTickGate(entity, channel) {
    if (!entity) return

    const entityState = ADAPTIVE_CHECK_STATE.get(entity)
    if (!entityState) return

    if (typeof channel !== 'string' || channel.length <= 0) {
        entityState.clear()
        ADAPTIVE_CHECK_STATE.delete(entity)
        return
    }

    entityState.delete(channel)
    if (entityState.size <= 0) {
        ADAPTIVE_CHECK_STATE.delete(entity)
    }
}

function hasOwnEntry(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key)
}

function isRecipeMap(recipes) {
    return Boolean(recipes)
        && typeof recipes === 'object'
        && !Array.isArray(recipes)
        && !hasOwnEntry(recipes, 'type')
}

function matchesRegistryType(componentType, registryType) {
    if (Array.isArray(registryType)) {
        return registryType.includes(componentType)
    }

    return componentType === registryType
}

export function hasRecipes(recipes) {
    if (Array.isArray(recipes)) {
        return recipes.length > 0
    }

    if (isRecipeMap(recipes)) {
        return Object.keys(recipes).length > 0
    }

    return false
}

export function listRecipes(recipes) {
    if (Array.isArray(recipes)) {
        return recipes
    }

    if (isRecipeMap(recipes)) {
        return Object.values(recipes)
    }

    return []
}

export function resolveMachineRecipes(block, settings, registryType, fallbackRecipes) {
    const component = block?.getComponent?.('utilitycraft:machine_recipes')?.customComponentParameters?.params
    if (isRecipeMap(component) || Array.isArray(component)) {
        return component
    }

    if (matchesRegistryType(component?.type, registryType)) {
        return fallbackRecipes
    }

    const configured = settings?.machine?.recipes
    if (isRecipeMap(configured) || Array.isArray(configured)) {
        return configured
    }

    return fallbackRecipes
}

export function resolveMachineRecipeList(block, settings, registryType, fallbackRecipes) {
    return listRecipes(resolveMachineRecipes(block, settings, registryType, fallbackRecipes))
}

/**
 * Resolves the first recipe that matches a direct `recipe.input.id` lookup.
 * Memoizes the lookup table by recipe-array identity to avoid repeated scans.
 */
export function findRecipeByInputId(recipes, inputId) {
    if (!recipes || !inputId) return null

    if (isRecipeMap(recipes)) {
        return hasOwnEntry(recipes, inputId) ? recipes[inputId] ?? null : null
    }

    if (!Array.isArray(recipes)) return null

    let lookupState = RECIPE_LOOKUP_CACHE.get(recipes)
    if (!lookupState || lookupState.size !== recipes.length) {
        const lookup = new Map()
        for (const recipe of recipes) {
            const recipeInputId = recipe?.input?.id
            if (!recipeInputId || lookup.has(recipeInputId)) continue
            lookup.set(recipeInputId, recipe)
        }
        lookupState = {
            size: recipes.length,
            lookup
        }
        RECIPE_LOOKUP_CACHE.set(recipes, lookupState)
    }

    return lookupState.lookup.get(inputId) ?? null
}

export function findRecipeByFluidInputType(recipes, fluidType) {
    if (!recipes || !fluidType) return null

    if (isRecipeMap(recipes)) {
        return hasOwnEntry(recipes, fluidType) ? recipes[fluidType] ?? null : null
    }

    if (!Array.isArray(recipes)) return null

    let lookupState = FLUID_RECIPE_LOOKUP_CACHE.get(recipes)
    if (!lookupState || lookupState.size !== recipes.length) {
        const lookup = new Map()
        for (const recipe of recipes) {
            const inputType = recipe?.inputFluid?.type
            if (!inputType || lookup.has(inputType)) continue
            lookup.set(inputType, recipe)
        }
        lookupState = {
            size: recipes.length,
            lookup
        }
        FLUID_RECIPE_LOOKUP_CACHE.set(recipes, lookupState)
    }

    return lookupState.lookup.get(fluidType) ?? null
}

function getEntityScopedCache(store, entity) {
    let cache = store.get(entity)
    if (!cache) {
        cache = new Map()
        store.set(entity, cache)
    }
    return cache
}

function parseJsonArray(raw) {
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export function resolveCachedLocationList(entity, propertyId, origin, refresh) {
    if (!entity || typeof propertyId !== 'string' || propertyId.length <= 0) return []

    const entityCache = getEntityScopedCache(ENTITY_JSON_ARRAY_CACHE, entity)
    const readRaw = () => {
        try {
            const cached = entity.getDynamicProperty(propertyId)
            return typeof cached === 'string' ? cached : ''
        } catch {
            return null
        }
    }

    const buildState = raw => ({
        raw,
        nodes: parseJsonArray(raw),
        ordered: new Map()
    })

    let raw = readRaw()
    if (raw === null) return []

    let state = entityCache.get(propertyId)
    if (!state || state.raw !== raw) {
        state = buildState(raw)
        entityCache.set(propertyId, state)
    }

    if (!state.nodes.length && typeof refresh === 'function') {
        refresh()
        raw = readRaw()
        if (raw === null) return []

        if (state.raw !== raw) {
            state = buildState(raw)
            entityCache.set(propertyId, state)
        }
    }

    if (!origin || state.nodes.length <= 1) {
        return state.nodes
    }

    const originKey = `${origin.x},${origin.y},${origin.z}`
    const cachedOrdered = state.ordered.get(originKey)
    if (Array.isArray(cachedOrdered)) {
        return cachedOrdered
    }

    const orderedNodes = [...state.nodes].sort((a, b) =>
        DoriosAPI.math.distanceBetween(origin, a) - DoriosAPI.math.distanceBetween(origin, b)
    )

    state.ordered.set(originKey, orderedNodes)
    return orderedNodes
}

export function buildTankSnapshot(tank) {
    const amount = tank?.get?.() ?? 0
    const cap = tank?.getCap?.() ?? 0

    return {
        amount,
        cap,
        free: Math.max(0, cap - amount),
        type: tank?.getType?.() ?? 'empty'
    }
}

export function buildSingleTankMachineState(machine, tank) {
    return {
        tank: buildTankSnapshot(tank),
        energy: machine?.energy?.get?.() ?? 0,
        progress: machine?.getProgress?.() ?? 0,
        energyCost: machine?.getEnergyCost?.() ?? 0
    }
}

export function buildDualTankMachineState(machine, inputTank, outputTank) {
    return {
        input: buildTankSnapshot(inputTank),
        output: buildTankSnapshot(outputTank),
        energy: machine?.energy?.get?.() ?? 0,
        progress: machine?.getProgress?.() ?? 0,
        energyCost: machine?.getEnergyCost?.() ?? 0
    }
}

export function buildStateSignature(parts = []) {
    return (Array.isArray(parts) ? parts : [parts]).join('|')
}

export function shouldRefreshMachineUi(entity, channel, signature, interval = 4, force = false) {
    if (!entity) return force === true

    const entityCache = getEntityScopedCache(ENTITY_RENDER_SIGNATURE_CACHE, entity)
    const normalizedChannel = typeof channel === 'string' && channel.length > 0
        ? channel
        : 'ui'
    const previous = entityCache.get(normalizedChannel)
    const gateKey = `${normalizedChannel}:refresh`
    const periodicRefresh = tickGate(entity, gateKey, interval)

    if (force || periodicRefresh || previous !== signature) {
        entityCache.set(normalizedChannel, signature)
        return true
    }

    return false
}

export function resetMachineRuntimeState(machine, resetProgress = true, progressSlot = 2, progressType = 'arrow_right') {
    if (!machine) return

    if (resetProgress) {
        machine.setProgress(0, progressSlot, progressType, false)
    }

    machine.off()
}

// ──────────────────────────────────────────────────────
// TEXT FORMATTING
// ──────────────────────────────────────────────────────

/**
 * Converts a namespaced identifier to a human-readable name.
 *   "minecraft:iron_sword" → "Iron Sword"
 *   "custom_item_name"     → "Custom Item Name"
 */
export function formatItemName(id) {
    if (typeof id !== 'string' || id.length === 0) return 'Unknown'
    const [, raw = id] = id.split(':')
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

/**
 * Capitalizes the first character of a string (preserves rest).
 */
export function capitalize(text) {
    if (!text) return ''
    return text[0].toUpperCase() + text.slice(1)
}

function normalizeLoreValue(value, fallback = '---') {
    if (value === null || value === undefined) return fallback

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return fallback
        return String(value)
    }

    const text = String(value).trim()
    return text.length ? text : fallback
}

/**
 * Formats a single metric line for machine lore.
 * Example: "  §7Energy: §f12.4kDE / 64kDE"
 */
export function formatLoreMetric(label, value, options = {}) {
    const indent = typeof options.indent === 'string' ? options.indent : '  '
    const labelColor = typeof options.labelColor === 'string' ? options.labelColor : '§7'
    const valueColor = typeof options.valueColor === 'string' ? options.valueColor : '§f'
    const suffix = typeof options.suffix === 'string' ? options.suffix : ''
    const emptyValue = typeof options.emptyValue === 'string' ? options.emptyValue : '---'

    const safeLabel = typeof label === 'string' && label.trim().length
        ? label.trim()
        : 'Info'
    const safeValue = normalizeLoreValue(value, emptyValue)

    return `${indent}${labelColor}${safeLabel}: ${valueColor}${safeValue}${suffix}`
}

/**
 * Appends a visual lore section with an optional list of metric/text rows.
 */
export function appendLoreSection(lines, title, entries = [], options = {}) {
    if (!Array.isArray(lines)) return lines

    const safeTitle = typeof title === 'string' ? title.trim() : ''
    if (!safeTitle.length) return lines

    const headerColor = typeof options.headerColor === 'string' ? options.headerColor : '§b'
    const rowPrefix = typeof options.rowPrefix === 'string' ? options.rowPrefix : '  '
    const rowColor = typeof options.rowColor === 'string' ? options.rowColor : '§7'
    const addSpacing = options.spacing !== false

    if (addSpacing && lines.length > 0) {
        lines.push(' ')
    }

    lines.push(`${headerColor}${safeTitle}`)

    const normalizedEntries = Array.isArray(entries)
        ? entries
        : [entries]

    for (const entry of normalizedEntries) {
        if (entry === null || entry === undefined || entry === false) continue

        if (typeof entry === 'string') {
            const text = entry.trim()
            if (!text.length) continue

            lines.push(
                text.startsWith('§')
                    ? `${rowPrefix}${text}`
                    : `${rowPrefix}${rowColor}${text}`
            )
            continue
        }

        if (typeof entry === 'object') {
            lines.push(formatLoreMetric(entry.label, entry.value, {
                indent: rowPrefix,
                labelColor: entry.labelColor ?? options.labelColor,
                valueColor: entry.valueColor ?? options.valueColor,
                emptyValue: entry.emptyValue
            }))
        }
    }

    return lines
}

/**
 * Formats a fluid type identifier for display, stripping "Liquified " prefix.
 */
export function formatFluidDisplayName(type) {
    if (!type || type === 'empty') return 'Empty'
    const pretty = formatItemName(type)
    const cleaned = pretty
        .replace(/Liquified\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    return cleaned.length ? cleaned : pretty
}

// ──────────────────────────────────────────────────────
// NUMERIC HELPERS
// ──────────────────────────────────────────────────────

/**
 * Clamps a probability value between 0 and 1.
 * Returns 1 when the input is not a valid number.
 */
export function clampChance(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 1
    return Math.max(0, Math.min(1, parsed))
}

function getEnchantableComponent(stack) {
    if (!stack || typeof stack.getComponent !== 'function') return null
    return stack.getComponent('minecraft:enchantable')
        ?? stack.getComponent('minecraft:enchantments')
        ?? stack.getComponent('enchantments')
        ?? null
}

/**
 * Reads enchantments from an item stack (normalized shape).
 */
export function extractEnchantments(stack) {
    const comp = getEnchantableComponent(stack)
    if (!comp) return []

    let list = []
    try {
        if (typeof comp.getEnchantments === 'function') {
            list = comp.getEnchantments()
        } else if (Array.isArray(comp.enchantments)) {
            list = comp.enchantments
        }
    } catch {
        return []
    }

    if (!Array.isArray(list)) return []

    return list
        .map(entry => {
            if (!entry?.type) return null
            const level = Number(entry.level ?? entry.lvl ?? entry.amount ?? 0)
            if (!Number.isFinite(level) || level <= 0) return null
            return { type: entry.type, level: Math.floor(level) }
        })
        .filter(Boolean)
}

/**
 * Applies enchantments to an item stack.
 */
export function applyEnchantmentsToStack(targetStack, enchantments) {
    if (!targetStack || !Array.isArray(enchantments) || enchantments.length === 0) return false
    const comp = getEnchantableComponent(targetStack)
    if (!comp || typeof comp.addEnchantments !== 'function') return false

    const sanitized = enchantments
        .map(entry => {
            const level = Number(entry?.level) || 0
            if (!entry?.type || level <= 0) return null
            return { type: entry.type, level: Math.floor(level) }
        })
        .filter(Boolean)

    if (!sanitized.length) return false

    try {
        comp.removeAllEnchantments?.()
    } catch { }

    try {
        comp.addEnchantments(sanitized)
        return true
    } catch {
        return false
    }
}

/**
 * Captures as much item metadata as possible from a stack.
 */
export function captureItemMetadata(stack, options = {}) {
    if (!stack) return null

    const meta = {
        typeId: stack.typeId
    }

    if (typeof stack.nameTag === 'string' && stack.nameTag.length > 0) {
        meta.nameTag = stack.nameTag
    }

    if (typeof stack.getLore === 'function') {
        const lore = stack.getLore()
        if (Array.isArray(lore) && lore.length) {
            meta.lore = [...lore]
        }
    }

    if (typeof stack.getCanPlaceOn === 'function') {
        const canPlaceOn = stack.getCanPlaceOn()
        if (Array.isArray(canPlaceOn) && canPlaceOn.length) {
            meta.canPlaceOn = [...canPlaceOn]
        }
    }

    if (typeof stack.getCanDestroy === 'function') {
        const canDestroy = stack.getCanDestroy()
        if (Array.isArray(canDestroy) && canDestroy.length) {
            meta.canDestroy = [...canDestroy]
        }
    }

    if (typeof stack.keepOnDeath === 'boolean') {
        meta.keepOnDeath = stack.keepOnDeath
    }

    if (stack.lockMode !== undefined) {
        meta.lockMode = stack.lockMode
    }

    const durability = stack.getComponent?.('minecraft:durability')
    if (durability && Number.isFinite(Number(durability.damage))) {
        meta.damage = Math.max(0, Math.floor(Number(durability.damage)))
    }

    const enchantments = extractEnchantments(stack)
    if (enchantments.length) {
        meta.enchantments = enchantments
    }

    if (options.includeDynamicProperties !== false
        && typeof stack.getDynamicPropertyIds === 'function'
        && typeof stack.getDynamicProperty === 'function') {
        const ids = stack.getDynamicPropertyIds()
        if (Array.isArray(ids) && ids.length) {
            const dynamicProperties = {}
            for (const id of ids) {
                try {
                    const value = stack.getDynamicProperty(id)
                    if (value !== undefined) dynamicProperties[id] = value
                } catch { }
            }
            if (Object.keys(dynamicProperties).length) {
                meta.dynamicProperties = dynamicProperties
            }
        }
    }

    return meta
}

/**
 * Applies captured metadata to a target stack.
 */
export function applyItemMetadata(targetStack, metadata, options = {}) {
    if (!targetStack || !metadata || typeof metadata !== 'object') return false

    if (!options.allowTypeMismatch && metadata.typeId && targetStack.typeId !== metadata.typeId) {
        return false
    }

    if (typeof metadata.nameTag === 'string') {
        targetStack.nameTag = metadata.nameTag
    }

    if (Array.isArray(metadata.lore) && typeof targetStack.setLore === 'function') {
        targetStack.setLore(metadata.lore)
    }

    if (Array.isArray(metadata.canPlaceOn) && typeof targetStack.setCanPlaceOn === 'function') {
        targetStack.setCanPlaceOn(metadata.canPlaceOn)
    }

    if (Array.isArray(metadata.canDestroy) && typeof targetStack.setCanDestroy === 'function') {
        targetStack.setCanDestroy(metadata.canDestroy)
    }

    if (typeof metadata.keepOnDeath === 'boolean' && 'keepOnDeath' in targetStack) {
        targetStack.keepOnDeath = metadata.keepOnDeath
    }

    if (metadata.lockMode !== undefined && 'lockMode' in targetStack) {
        targetStack.lockMode = metadata.lockMode
    }

    if (Number.isFinite(Number(metadata.damage))) {
        const durability = targetStack.getComponent?.('minecraft:durability')
        if (durability) {
            durability.damage = Math.max(0, Math.floor(Number(metadata.damage)))
        }
    }

    if (Array.isArray(metadata.enchantments)) {
        applyEnchantmentsToStack(targetStack, metadata.enchantments)
    }

    if (metadata.dynamicProperties
        && typeof metadata.dynamicProperties === 'object'
        && typeof targetStack.setDynamicProperty === 'function') {
        for (const [key, value] of Object.entries(metadata.dynamicProperties)) {
            try {
                targetStack.setDynamicProperty(key, value)
            } catch { }
        }
    }

    return true
}

function applyMetadataToSlot(machine, slotIndex, itemId, metadata, options = {}) {
    if (!metadata || !machine?.inv) return
    const stack = machine.inv.getItem(slotIndex)
    if (!stack || stack.typeId !== itemId) return

    const applied = applyItemMetadata(stack, metadata, {
        allowTypeMismatch: options.allowTypeMismatchMetadata === true
    })
    if (!applied) return
    machine.inv.setItem(slotIndex, stack)
}

// ──────────────────────────────────────────────────────
// INVENTORY HELPERS
// ──────────────────────────────────────────────────────

/**
 * Adds items to an inventory slot, stacking when possible.
 *
 * Optional metadata handling:
 * - options.metadata: pre-captured metadata object
 * - options.sourceStack: source stack used to capture metadata automatically
 * - options.captureOptions: extra capture options
 * - options.applyMetadataOnMerge: apply metadata even when stacking (default true)
 * - options.allowTypeMismatchMetadata: force metadata apply on different typeId
 */
export function addItemsToSlot(machine, slotIndex, itemId, amount, options = {}) {
    if (!itemId || amount <= 0) return
    const metadata = options.metadata ?? (options.sourceStack
        ? captureItemMetadata(options.sourceStack, options.captureOptions)
        : null)

    const existing = machine.inv.getItem(slotIndex)
    if (!existing) {
        machine.entity.setItem(slotIndex, itemId, amount)
        applyMetadataToSlot(machine, slotIndex, itemId, metadata, options)
    } else if (existing.typeId === itemId) {
        machine.entity.changeItemAmount(slotIndex, amount)
        if (options.applyMetadataOnMerge !== false) {
            applyMetadataToSlot(machine, slotIndex, itemId, metadata, options)
        }
    } else {
        machine.entity.setItem(slotIndex, itemId, amount)
        applyMetadataToSlot(machine, slotIndex, itemId, metadata, options)
    }
}

/**
 * Drains a fluid container item (e.g. bucket/capsule) from `slotIndex` into `tank`.
 * Skip items that are fillable (empty containers) to keep input-only semantics.
 */
export function feedFluidSlot(machine, tank, slotIndex) {
    const slotItem = machine.inv.getItem(slotIndex)
    if (!slotItem) return

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId)
    if (fillDefinition) return

    const result = tank.fluidItem(slotItem.typeId)
    if (result === false) return

    machine.entity.changeItemAmount(slotIndex, -1)

    if (!result) return

    const updated = machine.inv.getItem(slotIndex)
    if (!updated) {
        machine.entity.setItem(slotIndex, result, 1)
        return
    }

    if (updated.typeId === result && updated.amount < updated.maxAmount) {
        machine.entity.changeItemAmount(slotIndex, 1)
    } else {
        machine.entity.tryAddItem(result, 1)
    }
}

/**
 * Fills a container item from `tank` using the item in `slotIndex`.
 * Intended for output slots that accept empty capsules or buckets.
 */
export function fillFluidSlot(machine, tank, slotIndex) {
    const slotItem = machine.inv.getItem(slotIndex)
    if (!slotItem) return

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId)
    if (!fillDefinition) return

    const result = tank.fluidItem(slotItem.typeId)
    if (result === false) return

    machine.entity.changeItemAmount(slotIndex, -1)

    if (!result) return

    const updated = machine.inv.getItem(slotIndex)
    if (!updated) {
        machine.entity.setItem(slotIndex, result, 1)
        return
    }

    if (updated.typeId === result && updated.amount < updated.maxAmount) {
        machine.entity.changeItemAmount(slotIndex, 1)
    } else {
        machine.entity.tryAddItem(result, 1)
    }
}

/**
 * Computes how many crafts a slot can accept for a given item ID and per-craft amount.
 */
export function computeSlotCapacity(slot, expectedId, perCraft) {
    if (perCraft <= 0) return Number.MAX_SAFE_INTEGER
    if (!expectedId) return 0

    if (!slot) {
        return Math.floor(64 / perCraft)
    }

    if (slot.typeId !== expectedId) return 0
    const remaining = (slot.maxAmount ?? 64) - slot.amount
    return Math.floor(Math.max(0, remaining) / perCraft)
}

/**
 * Returns the number of crafts an output slot can accept, accounting for yield boost.
 */
export function getOutputCapacity(slot, perCraft, yieldBoost = 1) {
    const space = slot ? (slot.maxAmount ?? 64) - slot.amount : 64
    if (space <= 0) return 0
    const effectivePerCraft = Math.max(1, perCraft * yieldBoost)
    return Math.floor(space / effectivePerCraft)
}

// ──────────────────────────────────────────────────────
// CRAFTING HELPERS
// ──────────────────────────────────────────────────────

/**
 * Rolls byproduct production across multiple crafts using the configured chance.
 */
export function rollByproduct(byproduct, crafts) {
    const chance = clampChance(byproduct.chance ?? 1)
    let total = 0
    for (let i = 0; i < crafts; i++) {
        if (Math.random() <= chance) {
            total += Math.max(1, byproduct.amount ?? 1)
        }
    }
    return total
}

// ──────────────────────────────────────────────────────
// TIME / ETA HELPERS
// ──────────────────────────────────────────────────────

/**
 * Formats a total number of seconds into a human-readable string (e.g. "2h 15m 30s").
 */
export function formatSeconds(totalSeconds = 0) {
    const seconds = Math.floor(totalSeconds)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remaining = seconds % 60

    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${remaining}s`)
    return parts.join(' ')
}

/**
 * Estimates the machine's effective progress per second using sampling.
 * Falls back to a theoretical calculation when no sample data is available.
 */
export function getProgressPerSecond(machine) {
    const progress = machine.getProgress()
    const tickCount = globalThis.tickCount ?? 0

    const lastProgress = machine.entity.getDynamicProperty('dorios:last_progress_sample')
    const lastTick = machine.entity.getDynamicProperty('dorios:last_progress_tick')

    let perSecond = 0
    if (typeof lastProgress === 'number' && typeof lastTick === 'number' && tickCount > lastTick) {
        const deltaProgress = progress - lastProgress
        const deltaTicks = Math.max(1, tickCount - lastTick)
        if (deltaProgress > 0) {
            perSecond = (deltaProgress * TICKS_PER_SECOND) / deltaTicks
        }
    }

    machine.entity.setDynamicProperty('dorios:last_progress_sample', progress)
    machine.entity.setDynamicProperty('dorios:last_progress_tick', tickCount)

    if (perSecond > 0) return perSecond

    const tickSpeed = Math.max(1, globalThis.tickSpeed ?? 1)
    const updatesPerSecond = TICKS_PER_SECOND / Math.max(1, tickSpeed)
    const theoreticalPerUpdate = machine.rate / Math.max(machine.boosts.consumption, Number.EPSILON)

    if (theoreticalPerUpdate <= 0 || updatesPerSecond <= 0) return 0

    return theoreticalPerUpdate * updatesPerSecond
}

/**
 * Calculates the remaining time in seconds until a recipe completes.
 */
export function calculateEtaSeconds(machine, recipe) {
    const cost = recipe?.energyCost ?? machine.getEnergyCost()
    if (!cost || cost <= 0) return null

    const remaining = Math.max(0, cost - machine.getProgress())
    if (remaining <= 0) return 0

    const progressPerSecond = getProgressPerSecond(machine)
    if (progressPerSecond <= 0) return null

    return remaining / progressPerSecond
}

/**
 * Formats the ETA for a recipe as a human-readable string.
 */
export function formatEta(machine, recipe) {
    const seconds = calculateEtaSeconds(machine, recipe)
    if (seconds === null || !isFinite(seconds)) {
        if (typeof recipe?.timeSeconds === 'number') {
            return formatSeconds(recipe.timeSeconds)
        }
        return '---'
    }
    return formatSeconds(seconds)
}

import { system } from '@minecraft/server'
import {
    Energy,
    FluidManager,
    formatFluidDisplayName,
    getTickSpeed,
    syncButtonPanel
} from '../../../DoriosCore/main.js'

const superiorUiRefreshCache = new Map()

/**
 * Converts unknown numeric input to a finite number.
 *
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Converts unknown numeric input to an integer.
 *
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function toInteger(value, fallback = 0) {
    return Math.floor(toFiniteNumber(value, fallback))
}

/**
 * Formats the machine energy buffer as "current / cap".
 *
 * @param {{ energy?: { get?: () => number, getCap?: () => number } } | null | undefined} machine
 * @returns {string}
 */
export function formatMachineEnergyBuffer(machine) {
    const current = Math.max(0, toFiniteNumber(machine?.energy?.get?.(), 0))
    const cap = Math.max(0, toFiniteNumber(machine?.energy?.getCap?.(), 0))
    return `${Energy.formatEnergyToText(current)} / ${Energy.formatEnergyToText(cap)}`
}

/**
 * Formats a fluid tank buffer using a display fluid name.
 *
 * Example: "Steam 4kB / 32kB".
 *
 * @param {{ get?: () => number, getCap?: () => number } | null | undefined} tank
 * @param {string} fluidType
 * @returns {string}
 */
export function formatFluidTankBuffer(tank, fluidType) {
    const current = FluidManager.formatFluid(Math.max(0, toFiniteNumber(tank?.get?.(), 0)))
    const cap = FluidManager.formatFluid(Math.max(0, toFiniteNumber(tank?.getCap?.(), 0)))
    return `${formatFluidDisplayName(fluidType)} ${current} / ${cap}`
}

/**
 * Formats batch size with quantity level marker.
 *
 * Example: "8 (Q3)".
 *
 * @param {number} batchSize
 * @param {number} quantityLevel
 * @returns {string}
 */
export function formatBatchWithQuantity(batchSize, quantityLevel) {
    const batch = Math.max(0, toInteger(batchSize, 0))
    const quantity = Math.max(0, toInteger(quantityLevel, 0))
    return `${batch} (Q${quantity})`
}

/**
 * Formats seconds as a fixed-duration label.
 *
 * Example: "2.50s".
 *
 * @param {number} seconds
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatSecondsLabel(seconds, decimals = 2) {
    const safeDecimals = Math.max(0, Math.min(6, toInteger(decimals, 2)))
    return `${toFiniteNumber(seconds, 0).toFixed(safeDecimals)}s`
}

/**
 * Formats a decimal ratio as percentage text.
 *
 * Example: 0.25 -> "25%".
 *
 * @param {number} ratio
 * @param {number} [decimals=0]
 * @returns {string}
 */
export function formatPercentFromRatio(ratio, decimals = 0) {
    const safeDecimals = Math.max(0, Math.min(4, toInteger(decimals, 0)))
    const percent = Math.max(0, toFiniteNumber(ratio, 0)) * 100
    return `${percent.toFixed(safeDecimals)}%`
}

/**
 * Formats an absolute percent value.
 *
 * Example: 85 -> "85%".
 *
 * @param {number} percent
 * @param {number} [decimals=0]
 * @returns {string}
 */
export function formatPercentValue(percent, decimals = 0) {
    const safeDecimals = Math.max(0, Math.min(4, toInteger(decimals, 0)))
    const safePercent = Math.max(0, toFiniteNumber(percent, 0))
    return `${safePercent.toFixed(safeDecimals)}%`
}

/**
 * Formats energy cost only.
 *
 * @param {number} energyCost
 * @returns {string}
 */
export function formatEnergyCost(energyCost) {
    return Energy.formatEnergyToText(Math.max(0, toFiniteNumber(energyCost, 0)))
}

/**
 * Formats a mixed energy + fluid cost label.
 *
 * Example: "12kDE + 500mB Steam".
 *
 * @param {number} energyCost
 * @param {number} fluidAmount
 * @param {string} [fluidLabel='Fluid']
 * @returns {string}
 */
export function formatEnergyWithFluidCost(energyCost, fluidAmount, fluidLabel = 'Fluid') {
    const energyText = formatEnergyCost(energyCost)
    const fluidText = FluidManager.formatFluid(Math.max(0, toFiniteNumber(fluidAmount, 0)))
    return `${energyText} + ${fluidText} ${fluidLabel}`
}

/**
 * Formats an optional fluid cost suffix that can be concatenated to an energy string.
 *
 * @param {boolean} isActive
 * @param {number} fluidAmount
 * @param {string} [fluidLabel='Fluid']
 * @returns {string}
 */
export function formatOptionalFluidSuffix(isActive, fluidAmount, fluidLabel = 'Fluid') {
    if (!isActive) return ''
    const fluidText = FluidManager.formatFluid(Math.max(0, toFiniteNumber(fluidAmount, 0)))
    return ` + ${fluidText} ${fluidLabel}`
}

/**
 * Formats a shortage value for "Need X" rows.
 *
 * @param {number} shortage
 * @returns {string}
 */
export function formatFluidNeedValue(shortage) {
    return FluidManager.formatFluid(Math.max(0, toFiniteNumber(shortage, 0)))
}

/**
 * Returns the world-configured UI refresh speed used by superior machines.
 *
 * @returns {number}
 */
export function getSuperiorUiRefreshSpeed() {
    return Math.max(1, toInteger(getTickSpeed(), 1))
}

/**
 * Determines whether a superior machine UI surface should refresh on this tick.
 *
 * @param {{ entity?: { id?: string } } | { id?: string } | null | undefined} machineOrEntity
 * @param {string} [channel='ui']
 * @param {boolean} [force=false]
 * @returns {boolean}
 */
export function shouldRefreshSuperiorUi(machineOrEntity, channel = 'ui', force = false) {
    if (force === true) return true

    const entityId = machineOrEntity?.entity?.id ?? machineOrEntity?.id
    if (!entityId) return true

    const currentTick = Math.max(0, toInteger(system.currentTick, 0))
    const refreshSpeed = getSuperiorUiRefreshSpeed()
    const normalizedChannel = typeof channel === 'string' && channel.length > 0
        ? channel
        : 'ui'
    const cacheKey = `${entityId}:${normalizedChannel}`
    const lastTick = superiorUiRefreshCache.get(cacheKey)

    if (typeof lastTick !== 'number' || currentTick - lastTick >= refreshSpeed) {
        superiorUiRefreshCache.set(cacheKey, currentTick)
        return true
    }

    return false
}

/**
 * Synchronizes a superior-machine button panel while allowing render throttling.
 *
 * @param {unknown} machine
 * @param {unknown} panelDefinition
 * @param {Record<string, unknown>} [options={}]
 * @returns {Record<string, unknown>}
 */
export function syncSuperiorButtonPanel(machine, panelDefinition, options = {}) {
    const shouldRender = options.forceRender === true
        ? true
        : options.render === false
            ? false
            : shouldRefreshSuperiorUi(machine, options.refreshKey ?? 'button_panel')

    return syncButtonPanel(machine, panelDefinition, {
        ...options,
        render: shouldRender
    })
}

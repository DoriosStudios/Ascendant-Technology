import { ItemStack, EnchantmentTypes, world, system } from '@minecraft/server'
import {
    Machine,
    Energy,
    FluidManager,
    normalizeEnchantmentId,
    normalizeEnchantmentList
} from '../../DoriosCore/main.js'

// ==================== SLOT LAYOUT (32 total) ====================
// Fixed slots: 0=Energy, 1=Status, 2=Progress
// Main grid: 3-11 (9 slots)
// Module slots: 12-14 (3 slots)
// Disenchant section: 15-18 (source, catalyst, book storage, progress)
// Upgrade slots: 19-21
// Disenchant outputs: 22-30 (9 slots - expanded from 7)
// Disenchant status: 31 (for HUD updates)
const DEFAULT_STATION_SLOTS = Object.freeze({
    energy: 0,
    status: 1,
    progress: 2,
    upgrades: Object.freeze([19, 20, 21]),
    grid: Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11]),
    modules: Object.freeze([12, 13, 14]),
    disenchant: Object.freeze({
        source: 15,
        catalyst: 16,
        books: 17,
        progress: 18,
        outputs: Object.freeze([22, 23, 24, 25, 26, 27, 28, 29, 30]),
        status: 31
    })
})

// Station configuration is centralized in `config` below.

const ENCHANTMENT_DEFAULTS = Object.freeze({
    sources: Object.freeze([
        { kind: 'group', entries: ['minecraft:protection', 'minecraft:fire_protection', 'minecraft:blast_protection', 'minecraft:projectile_protection'] },
        { kind: 'group', entries: ['minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods', 'minecraft:density'] },
        { kind: 'group', entries: ['minecraft:silk_touch', 'minecraft:fortune'] },
        { kind: 'group', entries: ['minecraft:depth_strider', 'minecraft:frost_walker'] },
        { kind: 'group', entries: ['minecraft:multishot', 'minecraft:piercing', 'minecraft:breach'] },
        { kind: 'group', entries: ['minecraft:loyalty', 'minecraft:riptide'] },
        { kind: 'single', entries: ['minecraft:unbreaking'] },
        { kind: 'single', entries: ['minecraft:mending'] },
        { kind: 'single', entries: ['minecraft:efficiency'] },
        { kind: 'single', entries: ['minecraft:respiration'] },
        { kind: 'single', entries: ['minecraft:aqua_affinity'] },
        { kind: 'single', entries: ['minecraft:thorns'] },
        { kind: 'single', entries: ['minecraft:feather_falling'] },
        { kind: 'single', entries: ['minecraft:fire_aspect'] },
        { kind: 'single', entries: ['minecraft:knockback'] },
        { kind: 'single', entries: ['minecraft:looting'] },
        { kind: 'single', entries: ['minecraft:power'] },
        { kind: 'single', entries: ['minecraft:punch'] },
        { kind: 'single', entries: ['minecraft:flame'] },
        { kind: 'single', entries: ['minecraft:infinity'] },
        { kind: 'single', entries: ['minecraft:quick_charge'] },
        { kind: 'single', entries: ['minecraft:impaling'] },
        { kind: 'single', entries: ['minecraft:channeling'] },
        { kind: 'single', entries: ['minecraft:lure'] },
        { kind: 'single', entries: ['minecraft:luck_of_the_sea'] },
        { kind: 'single', entries: ['minecraft:soul_speed'] },
        { kind: 'single', entries: ['minecraft:swift_sneak'] },
        { kind: 'single', entries: ['minecraft:wind_burst'] },
        { kind: 'single', entries: ['minecraft:lunge'] }
    ])
})

const REINFORCEMENT_DEFAULTS = Object.freeze({
    props: Object.freeze({
        syncVersion: 'utilitycraft:reinforcement_sync_version',
        max: 'utilitycraft:reinforcement_max'
    }),
    syncVersion: 1,
    delayTicks: 3
})

/**
 * @description Unified nested default configuration object for the enchantment station.
 * This keeps all tunables in one place, including time scaling through `station.time.full_time`.
 * Runtime overrides can be provided via `settings.machine.station`.
 */
const config = Object.freeze({
    curse: Object.freeze({
        chance_base: 0.15,
        chance_per_enchant: 0.01,
        enchant_ids: ['minecraft:binding', 'minecraft:vanishing'],
        protection_modifier: 0
    }),
    disenchant: Object.freeze({
        catalyst_ids: [
            'utilitycraft:refined_aetherium_shard'
        ],
        delay_ticks: 100, // 5 seconds
        pending_property: 'utilitycraft:ascane_absorb_pending',
        token_property: 'utilitycraft:ascane_absorb_token',
        uses_property: 'utilitycraft:ascane_absorb_uses',
        xp_total_property: 'utilitycraft:ascane_absorb_xp_total',
        book_cap: 64,
    }),
    enchant: Object.freeze({
        plan_prop: 'utilitycraft:ascane_enchant_plan',
        signature_prop: 'utilitycraft:ascane_enchant_signature',
        sources: ENCHANTMENT_DEFAULTS.sources
    }),
    energy: Object.freeze({
        base_cost: 8000,
        enchant_operation_cost: 8000,
        inflation: Object.freeze({
            base: 8,
            curse_protection_module_per_level: 12,
            disenchant_per_enchant: 10,
            enchant_change: 16,
            enchantability_module_per_level: 10,
            reinforcement_module_per_level: 8
        }),
        limits: Object.freeze({
            min_cost: 1
        }),
        repair: Object.freeze({
            induction_anvil_divisor: 10,
            multiplier: 2.5
        })
    }),
    modules: Object.freeze({
        enchant_targets: Object.freeze({
            levels: [5, 4, 3, 2, 1],
            matrix: [
                [1, 1, 1, 0, 0],
                [2, 2, 1, 0, 0],
                [3, 2, 2, 1, 0],
                [4, 3, 2, 2, 0],
                [5, 4, 3, 2, 1]
            ],
            modules: [1, 2, 3, 4, 5]
        }),
        ids: Object.freeze({
            base: 'utilitycraft:ascane_module_base',
            curseProtection: [
                'utilitycraft:curse_protection_module'
            ],
            enchantability: [
                null,
                'utilitycraft:enchantability_module',
                'utilitycraft:enchantability_module_2',
                'utilitycraft:enchantability_module_3',
                'utilitycraft:enchantability_module_4',
                'utilitycraft:enchantability_module_5'
            ],
            reinforcement: [
                null,
                'utilitycraft:reinforcement_module',
                'utilitycraft:reinforcement_module_2',
                'utilitycraft:reinforcement_module_3'
            ]
        })
    }),
    progress: Object.freeze({
        color: null,
        frame_count: 16,
        type: 'arcane'
    }),
    reinforcement: Object.freeze({
        pattern: /Reinforcement\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i,
        prefix: '§r§9Reinforcement: ',
        property: 'utilitycraft:reinforcement',
        RATIOS: [0, 0.25, 0.5, 1]
    }),
    slots: DEFAULT_STATION_SLOTS,
    time: Object.freeze({
        enchant_seconds_per_change: 5,
        full_time: 10,
        min_process_seconds: 3,
        repair_seconds: 3,
        reinforcement_seconds: 10,
        ticks_per_second: 20
    }),
    xp: Object.freeze({
        per_enchant: 1000,
        tank_cap: 128000,
        tank_type: 'xp'
    })
})

let station = config
let stationSettingsCacheKey = ''

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]'
}

function deepMergeObjects(base, override) {
    if (Array.isArray(base)) {
        return Array.isArray(override) ? [...override] : [...base]
    }

    if (!isPlainObject(base)) {
        return override
    }

    const result = { ...base }
    if (!isPlainObject(override)) return result

    for (const [key, overrideValue] of Object.entries(override)) {
        const baseValue = base[key]
        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            result[key] = deepMergeObjects(baseValue, overrideValue)
            continue
        }

        if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
            result[key] = [...overrideValue]
            continue
        }

        result[key] = overrideValue
    }

    return result
}

function resolveStationConfig(settings) {
    const stationOverride = settings?.machine?.station ?? settings?.machine?.config?.station
    if (!isPlainObject(stationOverride)) {
        station = config
        stationSettingsCacheKey = ''
        return station
    }

    let nextKey = ''
    try {
        nextKey = JSON.stringify(stationOverride)
    } catch {
        nextKey = ''
    }

    if (nextKey && nextKey === stationSettingsCacheKey) {
        return station
    }

    station = deepMergeObjects(config, stationOverride)
    stationSettingsCacheKey = nextKey
    return station
}

DoriosAPI.register.blockComponent('enchantment_station', {
    beforeOnPlayerPlace(e, { params: settings }) {
        resolveStationConfig(settings)
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(getBaseOperationCost())
            machine.displayEnergy()
            displayProgress(machine, 0, 1)
            getAscaneXpTank(machine, settings)

            machine.setLabel({
                title: '§r§6Ascane Engine',
                lore: [
                    '§7Insert tools or armor into the grid.',
                    '§7Modules control enchanting and reinforcement.'
                ]
            }, station.slots.status)

            // Initialize disenchant status slot
            machine.setLabel({
                title: '',
                lore: ['§7Waiting for item...']
            }, station.slots.disenchant.status)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return
        resolveStationConfig(settings)

        const { block } = e
        const machine = new Machine(block, settings, true)
        if (!machine?.entity || !machine.inv) return

        const tickSpeed = Math.max(1, Number(globalThis.tickSpeed ?? 1))
        const moduleSlots = resolveAvailableSlots(machine.inv, station.slots.modules)
        const gridSlots = resolveAvailableSlots(machine.inv, station.slots.grid)
        const disenchantSlots = station.slots.disenchant
        const canUseDisenchantSlot = isSlotAvailable(machine.inv, disenchantSlots.source)
            && isSlotAvailable(machine.inv, disenchantSlots.catalyst)
            && isSlotAvailable(machine.inv, disenchantSlots.books)
            && disenchantSlots.outputs.some(slot => isSlotAvailable(machine.inv, slot))

        const modules = getModuleLevels(machine.inv, moduleSlots)
        const xpTank = getAscaneXpTank(machine, settings)
        const results = []

        if (canUseDisenchantSlot) {
            const disenchantResult = processDisenchantSlot(machine, settings, tickSpeed, xpTank)
            results.push(disenchantResult)
            updateDisenchantHud(machine, disenchantResult, modules, xpTank)
        }

        for (const slot of gridSlots) {
            results.push(processSlot(machine, slot, modules, settings, tickSpeed, xpTank))
        }

        updateHud(machine, results, modules, xpTank)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getModuleLevels(inv, slots = station.slots.modules) {
    const levels = {
        enchantability: 0,
        reinforcement: 0,
        curseProtection: 0
    }

    for (const slot of slots) {
        const stack = safeGetItem(inv, slot)
        if (!stack) continue
        const resolved = resolveModuleLevel(stack.typeId)
        if (!resolved?.type) continue
        if (resolved.type === 'enchantability') {
            levels.enchantability = Math.max(levels.enchantability, resolved.level)
        } else if (resolved.type === 'reinforcement') {
            levels.reinforcement = Math.max(levels.reinforcement, resolved.level)
        } else if (resolved.type === 'curseProtection') {
            levels.curseProtection = Math.max(levels.curseProtection, resolved.level)
        }
    }

    return levels
}

function resolveInventorySize(inv) {
    const raw = Number(inv?.size ?? inv?.containerSize ?? inv?.inventorySize ?? NaN)
    if (!Number.isFinite(raw) || raw <= 0) return null
    return Math.floor(raw)
}

function isSlotAvailable(inv, slot) {
    if (!inv || !Number.isInteger(slot) || slot < 0) return false

    const size = resolveInventorySize(inv)
    if (size !== null) {
        return slot < size
    }

    try {
        inv.getItem(slot)
        return true
    } catch {
        return false
    }
}

function resolveAvailableSlots(inv, slots) {
    if (!Array.isArray(slots) || slots.length === 0) return []
    return slots.filter(slot => isSlotAvailable(inv, slot))
}

function safeGetItem(inv, slot) {
    if (!isSlotAvailable(inv, slot)) return undefined
    try {
        return inv.getItem(slot)
    } catch {
        return undefined
    }
}

function resolveModuleLevel(typeId) {
    if (!typeId) return null

    const enchantIndex = station.modules.ids.enchantability.indexOf(typeId)
    if (enchantIndex > 0) {
        return { type: 'enchantability', level: enchantIndex }
    }

    const reinforceIndex = station.modules.ids.reinforcement.indexOf(typeId)
    if (reinforceIndex > 0) {
        return { type: 'reinforcement', level: reinforceIndex }
    }

    if (station.modules.ids.curseProtection.includes(typeId)) {
        return { type: 'curseProtection', level: 1 }
    }

    if (typeId === station.modules.ids.base) {
        return { type: 'base', level: 1 }
    }

    return null
}

function getAscaneXpTank(machine, settings) {
    if (!machine?.entity) return null
    if (!settings?.machine?.fluid_cap) return null

    const tank = FluidManager.initializeSingle(machine.entity)
    const cap = Number(settings?.machine?.fluid_cap ?? station.xp.tank_cap)
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap)
    }
    if (tank.getType() === 'empty') {
        tank.setType(station.xp.tank_type)
    }
    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', station.xp.tank_type)
    } catch { }
    return tank
}

function processDisenchantSlot(machine, settings, tickSpeed, xpTank) {
    const slot = station.slots.disenchant.source
    const stack = safeGetItem(machine.inv, slot)
    const catalyst = safeGetItem(machine.inv, station.slots.disenchant.catalyst)
    const bookStorage = safeGetItem(machine.inv, station.slots.disenchant.books)
    const outputSlots = resolveDisenchantOutputSlots(machine.inv)

    const fail = (state, message, resetProgress = true, details = null) => {
        if (resetProgress) setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, state, message, 0, getSlotEnergyCost(machine, slot), {
            slotType: 'disenchant',
            disenchantExtracting: false,
            disenchantAbsorbing: false,
            ...(details && typeof details === 'object' ? details : {})
        })
    }

    if (!stack) {
        setDisenchantAbsorbPending(machine.entity, false)
        return fail('empty', 'Empty')
    }

    if (stack.amount > 1) {
        return fail('error', 'Split Stack')
    }

    const enchantComp = getEnchantableComponent(stack)
    if (!enchantComp) {
        return fail('error', 'Invalid Item')
    }

    const current = readEnchantments(stack)
    const enchantCount = current.length

    if (enchantCount <= 0) {
        setDisenchantAbsorbPending(machine.entity, false)
        return fail('ready', 'No Enchantments Detected')
    }

    const catalystAmount = getCatalystAmount(catalyst)
    const bookAmount = getDisenchantBookAmount(bookStorage)

    const hasCatalyst = catalystAmount > 0
    const hasBooks = bookAmount > 0
    const useStandardDisenchant = hasCatalyst && hasBooks

    if (!useStandardDisenchant) {
        return processDisenchantAbsorbMode({
            machine,
            settings,
            sourceSlot: slot,
            sourceStack: stack,
            enchantments: current,
            xpTank,
            hasCatalyst,
            hasBooks
        })
    }

    if (isDisenchantAbsorbPending(machine.entity)) {
        setDisenchantAbsorbPending(machine.entity, false)
    }

    if (outputSlots.length <= 0) {
        return fail('waiting', 'No Output Space', true, {
            disenchantExtracting: true,
            disenchantAbsorbing: false,
            absorbMode: false,
            absorbPending: false
        })
    }

    const extractCount = Math.min(enchantCount, outputSlots.length, catalystAmount, bookAmount)
    if (extractCount <= 0) {
        return fail('waiting', 'No Output Space', true, {
            disenchantExtracting: true,
            disenchantAbsorbing: false,
            absorbMode: false,
            absorbPending: false
        })
    }

    const energyCost = computeDisenchantCost(extractCount)
    const timeSeconds = computeDisenchantTime(extractCount)

    setSlotEnergyCost(machine, slot, energyCost)
    const progress = getSlotProgress(machine, slot)
    const consumption = Math.max(Number.EPSILON, Number(machine.boosts?.consumption ?? 1))
    const resolvedRate = resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) ?? machine.rate
    const rate = Math.max(0, Number(resolvedRate) || 0)
    const progressPerTick = rate / consumption

    if (machine.energy.get() <= 0) {
        return buildSlotResult(slot, 'waiting', 'No Energy', progress, energyCost, {
            slotType: 'disenchant',
            disenchantExtracting: true,
            disenchantAbsorbing: false,
            absorbMode: false,
            absorbPending: false,
            rate,
            consumption,
            progressPerTick,
            timeSeconds
        })
    }

    if (progress >= energyCost) {
        const applied = applyDisenchantOperation({
            machine,
            sourceStack: stack,
            sourceSlot: slot,
            catalystSlot: station.slots.disenchant.catalyst,
            bookStorageSlot: station.slots.disenchant.books,
            outputSlots,
            extractCount,
            catalystStack: catalyst,
            bookStorageStack: bookStorage
        })

        if (!applied.ok) {
            return fail('error', applied.message ?? 'Cannot Disenchant')
        }

        setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, 'processing', 'Updated', 0, energyCost, {
            slotType: 'disenchant',
            disenchantExtracting: true,
            disenchantAbsorbing: false,
            absorbMode: false,
            absorbPending: false,
            rate,
            consumption,
            progressPerTick,
            timeSeconds
        })
    }

    const needed = energyCost - progress
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption)

    if (spendable > 0) {
        machine.energy.consume(spendable)
        addSlotProgress(machine, slot, spendable / Math.max(consumption, Number.EPSILON))
    }

    const updatedProgress = getSlotProgress(machine, slot)
    return buildSlotResult(slot, 'processing', 'Processing', updatedProgress, energyCost, {
        slotType: 'disenchant',
        disenchantExtracting: true,
        disenchantAbsorbing: false,
        absorbMode: false,
        absorbPending: false,
        rate,
        consumption,
        progressPerTick,
        timeSeconds
    })
}

function processDisenchantAbsorbMode({ machine, settings, sourceSlot, sourceStack, enchantments, xpTank, hasCatalyst, hasBooks }) {
    const enchantCount = Array.isArray(enchantments) ? enchantments.length : 0
    const estimatedXpGain = computeAbsorbXpGain(enchantments)
    const resultCost = getSlotEnergyCost(machine, sourceSlot)

    if (!xpTank || xpTank.getType() !== station.xp.tank_type) {
        setSlotProgress(machine, sourceSlot, 0)
        return buildSlotResult(sourceSlot, 'waiting', 'Need XP Tank', 0, resultCost, {
            slotType: 'disenchant',
            disenchantExtracting: false,
            disenchantAbsorbing: true,
            absorbMode: true,
            absorbPending: false,
            xpGainEstimate: estimatedXpGain
        })
    }

    const freeSpace = Math.max(0, Number(xpTank.getCap?.() ?? 0) - Number(xpTank.get?.() ?? 0))
    if (freeSpace <= 0) {
        setSlotProgress(machine, sourceSlot, 0)
        return buildSlotResult(sourceSlot, 'waiting', 'XP Tank Full', 0, resultCost, {
            slotType: 'disenchant',
            disenchantExtracting: false,
            disenchantAbsorbing: true,
            absorbMode: true,
            absorbPending: false,
            xpGainEstimate: estimatedXpGain
        })
    }

    if (enchantCount <= 0) {
        setDisenchantAbsorbPending(machine.entity, false)
        setSlotProgress(machine, sourceSlot, 0)
        return buildSlotResult(sourceSlot, 'ready', 'Ready', 0, resultCost, {
            slotType: 'disenchant',
            disenchantExtracting: false,
            disenchantAbsorbing: false,
            absorbMode: true,
            absorbPending: false,
            xpGainEstimate: 0
        })
    }

    if (hasCatalyst && hasBooks) {
        setDisenchantAbsorbPending(machine.entity, false)
        return buildSlotResult(sourceSlot, 'waiting', 'Standard Mode Available', 0, resultCost, {
            slotType: 'disenchant',
            disenchantExtracting: true,
            disenchantAbsorbing: false,
            absorbMode: false,
            absorbPending: false,
            xpGainEstimate: estimatedXpGain
        })
    }

    if (!isDisenchantAbsorbPending(machine.entity)) {
        queueDisenchantAbsorb(machine, settings)
    }

    setSlotProgress(machine, sourceSlot, 0)
    return buildSlotResult(sourceSlot, 'waiting', 'Absorb Pending', 0, resultCost, {
        slotType: 'disenchant',
        disenchantExtracting: false,
        disenchantAbsorbing: true,
        absorbMode: true,
        absorbPending: true,
        xpGainEstimate: Math.min(estimatedXpGain, freeSpace)
    })
}

function isDisenchantAbsorbPending(entity) {
    const key = getDisenchantPendingPropertyKey()
    try {
        return Number(entity?.getDynamicProperty?.(key) ?? 0) === 1
    } catch {
        return false
    }
}

function setDisenchantAbsorbPending(entity, value) {
    if (!entity || typeof entity.setDynamicProperty !== 'function') return
    const key = getDisenchantPendingPropertyKey()
    try {
        entity.setDynamicProperty(key, value ? 1 : 0)
    } catch { }
}

function nextDisenchantAbsorbToken(entity) {
    const key = getDisenchantTokenPropertyKey()
    try {
        const current = Number(entity?.getDynamicProperty?.(key) ?? 0)
        const next = Number.isFinite(current) ? current + 1 : 1
        entity?.setDynamicProperty?.(key, next)
        return next
    } catch {
        return Date.now()
    }
}

function queueDisenchantAbsorb(machine, settings) {
    if (!machine?.entity) return false
    const entity = machine.entity
    const tokenKey = getDisenchantTokenPropertyKey()
    if (isDisenchantAbsorbPending(entity)) return true

    setDisenchantAbsorbPending(entity, true)
    const token = nextDisenchantAbsorbToken(entity)

    system.runTimeout(() => {
        try {
            const currentToken = Number(entity?.getDynamicProperty?.(tokenKey) ?? 0)
            if (currentToken !== token) return
            executeDisenchantAbsorb(entity, settings)
        } finally {
            try {
                const latest = Number(entity?.getDynamicProperty?.(tokenKey) ?? 0)
                if (latest === token) {
                    setDisenchantAbsorbPending(entity, false)
                }
            } catch {
                setDisenchantAbsorbPending(entity, false)
            }
        }
    }, getDisenchantDelayTicks())

    return true
}

function ensureDisenchantXpTank(entity, settings) {
    if (!entity) return null
    const tank = FluidManager.initializeSingle(entity)
    const cap = Number(settings?.machine?.fluid_cap ?? station.xp.tank_cap)
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap)
    }
    if (tank.getType() === 'empty') {
        tank.setType(station.xp.tank_type)
    }
    try {
        entity.setDynamicProperty('dorios:fluid_whitelist', station.xp.tank_type)
    } catch { }
    return tank
}

function computeAbsorbXpGain(enchantments) {
    if (!Array.isArray(enchantments) || enchantments.length <= 0) return 0

    const validLevels = enchantments
        .map(entry => Math.max(0, Math.floor(Number(entry?.level ?? 0))))
        .filter(level => level > 0)

    if (validLevels.length <= 0) return 0

    const count = validLevels.length
    const sumLevels = validLevels.reduce((sum, level) => sum + level, 0)
    const averageLevel = sumLevels / count
    const avgRecipeXp = Number(station?.xp?.per_enchant ?? 1000) * averageLevel
    return Math.max(1, Math.floor(avgRecipeXp * count))
}

function registerDisenchantAbsorbUsage(entity, gainedXp) {
    if (!entity || typeof entity.setDynamicProperty !== 'function') return
    const usesKey = getDisenchantUsesPropertyKey()
    const xpTotalKey = getDisenchantXpTotalPropertyKey()
    try {
        const uses = Number(entity.getDynamicProperty(usesKey) ?? 0)
        const totalXp = Number(entity.getDynamicProperty(xpTotalKey) ?? 0)
        entity.setDynamicProperty(usesKey, Math.max(0, Math.floor(uses) + 1))
        entity.setDynamicProperty(xpTotalKey, Math.max(0, Math.floor(totalXp + Math.max(0, gainedXp))))
    } catch { }
}

function executeDisenchantAbsorb(entity, settings) {
    const inv = entity?.getComponent?.('inventory')?.container
    if (!inv) return false

    const sourceStack = safeGetItem(inv, station.slots.disenchant.source)
    if (!sourceStack || sourceStack.amount !== 1) return false
    if (!getEnchantableComponent(sourceStack)) return false

    const enchantments = readEnchantments(sourceStack)
    if (!Array.isArray(enchantments) || enchantments.length <= 0) return false

    const catalyst = safeGetItem(inv, station.slots.disenchant.catalyst)
    const books = safeGetItem(inv, station.slots.disenchant.books)
    if (getCatalystAmount(catalyst) > 0 && getDisenchantBookAmount(books) > 0) {
        return false
    }

    const xpTank = ensureDisenchantXpTank(entity, settings)
    if (!xpTank || xpTank.getType() !== station.xp.tank_type) return false

    const xpGain = computeAbsorbXpGain(enchantments)
    const freeSpace = Math.max(0, Number(xpTank.getCap?.() ?? 0) - Number(xpTank.get?.() ?? 0))
    const finalGain = Math.max(0, Math.min(xpGain, freeSpace))
    if (finalGain <= 0) return false

    const updatedSource = rebuildDisenchantSourceStack(sourceStack, [])
    if (!updatedSource) return false

    setStoredEnchantPlan(updatedSource, null)
    setStoredEnchantSignature(updatedSource, '')
    inv.setItem(station.slots.disenchant.source, updatedSource)
    xpTank.add(finalGain)
    registerDisenchantAbsorbUsage(entity, finalGain)

    try {
        const pos = entity.location ?? entity.getHeadLocation?.() ?? null
        if (pos) {
            entity.dimension?.playSound?.('random.levelup', pos, { volume: 0.6, pitch: 1.2 })
        }
    } catch { }

    return true
}

function resolveDisenchantOutputSlots(inv) {
    const available = []
    for (const slot of station.slots.disenchant.outputs) {
        if (!isSlotAvailable(inv, slot)) continue
        const current = safeGetItem(inv, slot)
        if (!current) {
            available.push(slot)
        }
    }
    return available
}

function isDisenchantCatalyst(stack) {
    if (!stack?.typeId) return false
    return station.disenchant.catalyst_ids.includes(stack.typeId)
}

function getCatalystAmount(stack) {
    if (!isDisenchantCatalyst(stack)) return 0
    return Math.max(0, Math.floor(Number(stack.amount) || 0))
}

function isDisenchantBookFuel(stack) {
    return stack?.typeId === 'minecraft:book'
}

function getDisenchantBookAmount(stack) {
    if (!isDisenchantBookFuel(stack)) return 0
    const rawAmount = Math.max(0, Math.floor(Number(stack.amount) || 0))
    const cap = Math.max(1, Math.floor(Number(station?.disenchant?.book_cap ?? 64) || 64))
    return Math.min(rawAmount, cap)
}

function resolveDisenchantSettingString(key, fallback) {
    const value = station?.disenchant?.[key]
    return typeof value === 'string' && value.length > 0 ? value : fallback
}

function resolveDisenchantSettingNumber(key, fallback) {
    const value = Number(station?.disenchant?.[key])
    if (!Number.isFinite(value)) return fallback
    return value
}

function getDisenchantPendingPropertyKey() {
    return resolveDisenchantSettingString('pending_property', 'utilitycraft:ascane_absorb_pending')
}

function getDisenchantTokenPropertyKey() {
    return resolveDisenchantSettingString('token_property', 'utilitycraft:ascane_absorb_token')
}

function getDisenchantUsesPropertyKey() {
    return resolveDisenchantSettingString('uses_property', 'utilitycraft:ascane_absorb_uses')
}

function getDisenchantXpTotalPropertyKey() {
    return resolveDisenchantSettingString('xp_total_property', 'utilitycraft:ascane_absorb_xp_total')
}

function getDisenchantDelayTicks() {
    return Math.max(1, Math.floor(resolveDisenchantSettingNumber('delay_ticks', 60)))
}

function applyDisenchantOperation({ machine, sourceStack, sourceSlot, catalystSlot, bookStorageSlot, outputSlots, extractCount, catalystStack, bookStorageStack }) {
    if (!sourceStack || !Array.isArray(outputSlots) || outputSlots.length <= 0 || extractCount <= 0) {
        return { ok: false, message: 'Invalid State' }
    }

    const currentEnchantments = readEnchantments(sourceStack)
    if (!Array.isArray(currentEnchantments) || currentEnchantments.length <= 0) {
        return { ok: false, message: 'No Enchantments' }
    }

    const selected = currentEnchantments.slice(0, extractCount)
    if (selected.length <= 0) {
        return { ok: false, message: 'No Enchantments' }
    }

    const bookStacks = []
    for (const enchantment of selected) {
        const bookStack = createEnchantedBookFromEnchantment(enchantment)
        if (!bookStack) {
            return { ok: false, message: 'Book Build Failed' }
        }
        bookStacks.push(bookStack)
    }

    const remaining = currentEnchantments.slice(selected.length)
    const updatedSource = rebuildDisenchantSourceStack(sourceStack, remaining)
    if (!updatedSource) {
        return { ok: false, message: 'Source Update Failed' }
    }

    for (let i = 0; i < bookStacks.length; i += 1) {
        const outputSlot = outputSlots[i]
        if (!Number.isInteger(outputSlot)) {
            return { ok: false, message: 'Output Invalid' }
        }
        machine.inv.setItem(outputSlot, bookStacks[i])
    }

    const spent = bookStacks.length
    const catalystAmount = getCatalystAmount(catalystStack)
    if (catalystAmount < spent) {
        return { ok: false, message: 'Catalyst Missing' }
    }

    const bookAmount = getDisenchantBookAmount(bookStorageStack)
    if (bookAmount < spent) {
        return { ok: false, message: 'Books Missing' }
    }

    if (catalystAmount === spent) {
        machine.inv.setItem(catalystSlot, undefined)
    } else {
        catalystStack.amount = catalystAmount - spent
        machine.inv.setItem(catalystSlot, catalystStack)
    }

    if (bookAmount === spent) {
        machine.inv.setItem(bookStorageSlot, undefined)
    } else {
        bookStorageStack.amount = bookAmount - spent
        machine.inv.setItem(bookStorageSlot, bookStorageStack)
    }

    setStoredEnchantPlan(updatedSource, null)
    setStoredEnchantSignature(updatedSource, '')
    machine.inv.setItem(sourceSlot, updatedSource)
    playMachineSound(machine, 'random.levelup', { volume: 0.65, pitch: 1.2 })
    return { ok: true }
}

function createEnchantedBookFromEnchantment(enchantment) {
    const level = Math.max(1, Math.floor(Number(enchantment?.level ?? 0)))
    const type = enchantment?.type
    if (!type || level <= 0) return null

    const bookStack = new ItemStack('minecraft:enchanted_book', 1)
    const applied = applyEnchantmentsToStack(bookStack, [{ type, level }])
    if (!applied) return null
    return bookStack
}

function rebuildDisenchantSourceStack(stack, remainingEnchantments) {
    if (!stack) return null
    const removed = removeAllEnchantmentsFromStack(stack)
    if (!removed) return null

    if (Array.isArray(remainingEnchantments) && remainingEnchantments.length > 0) {
        const reapplied = applyEnchantmentsToStack(stack, remainingEnchantments)
        if (!reapplied) return null
        return stack
    }

    if (stack.typeId === 'minecraft:enchanted_book') {
        return new ItemStack('minecraft:book', 1)
    }

    return stack
}

function processSlot(machine, slot, modules, settings, tickSpeed, xpTank) {
    const stack = safeGetItem(machine.inv, slot)
    const key = slotKey(slot)

    const safeModules = {
        enchantability: Math.max(0, Number(modules?.enchantability ?? 0)),
        reinforcement: Math.max(0, Number(modules?.reinforcement ?? 0)),
        curseProtection: Math.max(0, Number(modules?.curseProtection ?? 0))
    }

    const fail = (state, message, resetProgress = true) => {
        if (resetProgress) setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, state, message, 0, getSlotEnergyCost(machine, slot), {
            slotType: 'main',
            enchantingNeeded: false,
            curatingNeeded: false,
            repairingNeeded: false,
            reinforcingNeeded: false
        })
    }

    if (!stack) {
        return fail('empty', 'Empty')
    }

    if (stack.amount > 1) {
        return fail('error', 'Split Stack')
    }

    const durability = stack.getComponent('minecraft:durability')
    if (!durability) {
        return fail('error', 'Invalid Item')
    }

    const legacySync = reconcileLegacyReinforcementDurability(stack, durability)
    if (legacySync.updated) {
        machine.inv.setItem(slot, stack)
    }

    const enchantComp = getEnchantableComponent(stack)
    const repairNeeded = durability.damage > 0

    const reinforcementTarget = resolveReinforcementTarget(durability, safeModules.reinforcement)
    const reinforcementCurrent = getReinforcementPoints(stack)
    const reinforcementNeeded = reinforcementTarget > reinforcementCurrent

    const enchantPlan = buildEnchantPlan(stack, enchantComp, safeModules)
    const enchantOperationNeeded = Boolean(enchantPlan.changed)
    const enchantNeeded = Boolean(enchantPlan.enchantingChanged)
    const curatingNeeded = Boolean(enchantPlan.curatingChanged)
    const enchantChangeCount = Math.max(0, Math.floor(enchantPlan.changeCount ?? 0))
    const xpNeeded = enchantNeeded ? (station.xp.per_enchant * Math.max(1, enchantChangeCount)) : 0
    const operationDetails = {
        slotType: 'main',
        enchantingNeeded: enchantNeeded,
        curatingNeeded,
        repairingNeeded: repairNeeded,
        reinforcingNeeded: reinforcementNeeded
    }

    if (!repairNeeded && !enchantOperationNeeded && !reinforcementNeeded) {
        const alreadyEnchanted = safeModules.enchantability > 0
            && Boolean(enchantComp)
            && enchantNeeded === false
            && curatingNeeded === false
        return buildSlotResult(
            slot,
            'ready',
            alreadyEnchanted ? 'Already Enchanted' : 'Ready',
            0,
            getSlotEnergyCost(machine, slot),
            operationDetails
        )
    }

    if (xpNeeded > 0) {
        if (!xpTank || xpTank.getType() !== station.xp.tank_type) {
            return buildSlotResult(slot, 'waiting', 'Need XP', getSlotProgress(machine, slot), getSlotEnergyCost(machine, slot), operationDetails)
        }
        if (xpTank.get() < xpNeeded) {
            return buildSlotResult(slot, 'waiting', 'Need XP', getSlotProgress(machine, slot), getSlotEnergyCost(machine, slot), operationDetails)
        }
    }

    const energyCost = computeEnergyCost({
        enchantNeeded: enchantOperationNeeded,
        reinforcementNeeded,
        modules: safeModules,
        enchantChangeCount,
        curatingNeeded
    })

    const timeSeconds = computeTimeSeconds({
        enchantChangeCount,
        reinforcementNeeded,
        repairNeeded
    })

    setSlotEnergyCost(machine, slot, energyCost)
    const progress = getSlotProgress(machine, slot)
    const consumption = Math.max(Number.EPSILON, Number(machine.boosts?.consumption ?? 1))
    const resolvedRate = resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) ?? machine.rate
    const rate = Math.max(0, Number(resolvedRate) || 0)
    const progressPerTick = rate / consumption

    if (machine.energy.get() <= 0) {
        return buildSlotResult(slot, 'waiting', 'No Energy', progress, energyCost, {
            ...operationDetails,
            rate,
            consumption,
            progressPerTick,
            timeSeconds
        })
    }

    if (progress >= energyCost) {
        applySlotOperations({
            machine,
            slot,
            stack,
            durability,
            repairNeeded,
            reinforcementTarget,
            reinforcementNeeded,
            enchantPlan,
            xpTank,
            xpNeeded
        })

        setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, 'processing', 'Updated', 0, energyCost, {
            ...operationDetails,
            rate,
            consumption,
            progressPerTick,
            timeSeconds
        })
    }

    const needed = energyCost - progress
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption)

    if (spendable > 0) {
        machine.energy.consume(spendable)
        addSlotProgress(machine, slot, spendable / Math.max(consumption, Number.EPSILON))
    }

    const updatedProgress = getSlotProgress(machine, slot)
    return buildSlotResult(slot, 'processing', 'Processing', updatedProgress, energyCost, {
        ...operationDetails,
        rate,
        consumption,
        progressPerTick,
        timeSeconds
    })
}

function normalizeEnergyCost(value) {
    return Math.max(station.energy.limits.min_cost, Math.floor(Number(value) || 0))
}

function clampUnitInterval(value) {
    return Math.max(0, Math.min(1, Number(value) || 0))
}

function getBaseOperationCost() {
    return normalizeEnergyCost(station.energy.base_cost * station.energy.inflation.base)
}

function computeEnergyCost({ enchantNeeded, reinforcementNeeded, modules, enchantChangeCount, curatingNeeded = false }) {
    const baseCost = getBaseOperationCost()
    let cost = baseCost

    if (enchantNeeded && modules.enchantability > 0) {
        cost += baseCost
            * station.energy.inflation.enchantability_module_per_level
            * modules.enchantability
        cost += station.energy.enchant_operation_cost
            * station.energy.inflation.enchant_change
            * Math.max(1, enchantChangeCount || 0)
    }

    if (reinforcementNeeded && modules.reinforcement > 0) {
        cost += baseCost
            * station.energy.inflation.reinforcement_module_per_level
            * modules.reinforcement
    }

    if ((enchantNeeded || curatingNeeded) && modules.curseProtection > 0) {
        cost += baseCost
            * station.energy.inflation.curse_protection_module_per_level
            * modules.curseProtection
    }

    return normalizeEnergyCost(cost)
}

function computeDisenchantCost(enchantCount) {
    const count = Math.max(1, Math.floor(Number(enchantCount) || 0))
    return normalizeEnergyCost(getBaseOperationCost() * station.energy.inflation.disenchant_per_enchant * count)
}

function computeTimeSeconds({ enchantChangeCount, reinforcementNeeded, repairNeeded }) {
    let total = 0
    if (repairNeeded) total += station.time.repair_seconds
    if (reinforcementNeeded) total += station.time.reinforcement_seconds
    if (enchantChangeCount > 0) total += station.time.enchant_seconds_per_change * enchantChangeCount
    const scaled = total * Math.max(Number.EPSILON, Number(station.time.full_time) || 1)
    return Math.max(station.time.min_process_seconds, scaled)
}

function computeDisenchantTime(enchantCount) {
    const count = Math.max(1, Math.floor(Number(enchantCount) || 0))
    const total = station.time.enchant_seconds_per_change * count
    const scaled = total * Math.max(Number.EPSILON, Number(station.time.full_time) || 1)
    return Math.max(station.time.min_process_seconds, scaled)
}

function resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) {
    if (!settings?.machine?.dynamic_rate) return null
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return null
    if (!Number.isFinite(energyCost) || energyCost <= 0) return null

    const speedMultiplier = Number(machine.boosts?.speed ?? 1)
    const consumptionMultiplier = Math.max(Number.EPSILON, Number(machine.boosts?.consumption ?? 1))
    const progressPerSecond = (energyCost / timeSeconds) * (Number.isFinite(speedMultiplier) ? speedMultiplier : 1)
    const energyPerSecond = progressPerSecond * consumptionMultiplier
    const baseRate = Math.max(1, energyPerSecond / Math.max(1, Number(station.time.ticks_per_second) || 20))
    const tickRate = Math.max(1, Number(tickSpeed) || 1)
    return baseRate * tickRate
}

function applySlotOperations({ machine, slot, stack, durability, repairNeeded, reinforcementTarget, reinforcementNeeded, enchantPlan, xpTank, xpNeeded }) {
    const repairAmount = Math.max(1, Math.floor((station.energy.base_cost / station.energy.repair.induction_anvil_divisor) * station.energy.repair.multiplier))

    if (repairNeeded && stack?.durability?.repair) {
        stack.durability.repair(repairAmount)
    } else if (repairNeeded && durability) {
        durability.damage = Math.max(durability.damage - repairAmount, 0)
    }

    if (enchantPlan.changed && Array.isArray(enchantPlan.enchantments)) {
        const applied = applyEnchantmentPlanToStack(stack, enchantPlan.enchantments)
        if (applied) {
            if (xpTank && xpNeeded > 0 && typeof xpTank.add === 'function') {
                xpTank.add(-xpNeeded)
            }
            playMachineSound(machine, 'block.enchanting_table.use', { volume: 0.9, pitch: 1.1 })
        }
    }

    if (reinforcementNeeded && reinforcementTarget > 0) {
        setReinforcementPoints(stack, reinforcementTarget, reinforcementTarget)
    }

    machine.inv.setItem(slot, stack)
}

function playMachineSound(machine, soundId, options) {
    if (!machine?.dim || !soundId) return
    let pos = null
    try {
        pos = typeof machine.block?.center === 'function'
            ? machine.block.center()
            : machine.block?.location ?? machine.entity?.location ?? null
    } catch {
        pos = machine.entity?.location ?? null
    }
    if (!pos) return
    try {
        machine.dim.playSound?.(soundId, pos, options)
    } catch { }
}

function buildEnchantPlan(stack, enchantComp, modules) {
    const level = Math.max(0, modules.enchantability)
    if (!enchantComp || !canWriteEnchantments(enchantComp)) {
        return {
            changed: false,
            enchantingChanged: false,
            curatingChanged: false,
            curatedCount: 0,
            enchantments: null,
            changeCount: 0
        }
    }

    const current = readEnchantments(stack)
    const curation = curateCursedEnchantments(current, modules)
    const curatedEnchantments = curation.enchantments
    const curatingChanged = curation.removedCount > 0

    if (level <= 0) {
        const changed = hasEnchantmentsChanged(current, curatedEnchantments)
        return {
            changed,
            enchantingChanged: false,
            curatingChanged,
            curatedCount: curation.removedCount,
            enchantments: curatedEnchantments,
            changeCount: 0
        }
    }

    const existingIds = new Set(curatedEnchantments.map(entry => normalizeEnchantmentId(entry?.type)).filter(Boolean))
    const planIds = resolveEnchantPlanIds(stack, enchantComp, level, existingIds)
    const upgraded = upgradeEnchantments(curatedEnchantments, level)
    const withAdditions = addMissingEnchantments(enchantComp, upgraded, level, planIds)
    const withCurses = applyCurseChance(enchantComp, withAdditions, modules)

    const enchantingChangeCount = countEnchantmentChanges(curatedEnchantments, withCurses)
    const enchantingChanged = enchantingChangeCount > 0
    const changed = hasEnchantmentsChanged(current, withCurses)
    return {
        changed,
        enchantingChanged,
        curatingChanged,
        curatedCount: curation.removedCount,
        enchantments: withCurses,
        changeCount: enchantingChangeCount
    }
}

function curateCursedEnchantments(enchantments, modules) {
    const list = Array.isArray(enchantments) ? [...enchantments] : []
    const protectionLevel = Math.max(0, Number(modules?.curseProtection ?? 0))
    if (protectionLevel <= 0 || list.length <= 0) {
        return { enchantments: list, removedCount: 0 }
    }

    const curseIds = new Set(
        (Array.isArray(station?.curse?.enchant_ids) ? station.curse.enchant_ids : [])
            .map(id => String(id ?? '').toLowerCase())
            .filter(Boolean)
    )

    if (!curseIds.size) {
        return { enchantments: list, removedCount: 0 }
    }

    const curated = []
    let removedCount = 0
    for (const enchantment of list) {
        const id = normalizeEnchantmentId(enchantment?.type)
        if (id && curseIds.has(id)) {
            removedCount += 1
            continue
        }
        curated.push(enchantment)
    }

    return { enchantments: curated, removedCount }
}

function clampLevel(value, min, max) {
    const numeric = Math.floor(Number(value) || 0)
    return Math.max(min, Math.min(max, numeric))
}

function resolveModuleEnchantTarget(moduleLevel, enchantMaxLevel) {
    const moduleLevels = station.modules.enchant_targets.modules
    const enchantLevels = station.modules.enchant_targets.levels
    const targetTable = station.modules.enchant_targets.matrix
    const moduleKey = clampLevel(moduleLevel, 1, moduleLevels.length)
    const maxKey = clampLevel(enchantMaxLevel, 1, enchantLevels.length)
    const moduleIndex = moduleLevels.indexOf(moduleKey)
    const levelIndex = enchantLevels.indexOf(maxKey)
    if (moduleIndex < 0 || levelIndex < 0) return 0
    const target = targetTable[moduleIndex]?.[levelIndex] ?? 0
    return Math.max(0, Math.min(target, maxKey))
}

function upgradeEnchantments(list, level) {
    if (!Array.isArray(list) || list.length === 0) return []
    return list.map(entry => {
        const maxLevel = Number(entry?.type?.maxLevel)
        const current = Number(entry?.level ?? 0)
        const typeMax = Number.isFinite(maxLevel) && maxLevel > 0 ? maxLevel : 1
        const target = resolveModuleEnchantTarget(level, typeMax)
        if (target <= 0) {
            return { type: entry.type, level: Math.max(1, Math.min(current, typeMax)) }
        }
        const finalLevel = Math.max(current, target)
        return { type: entry.type, level: Math.max(1, Math.min(finalLevel, typeMax)) }
    })
}

function addMissingEnchantments(enchantComp, existing, level, planIds = []) {
    const result = Array.isArray(existing) ? [...existing] : []
    const existingIds = new Set(result.map(entry => normalizeEnchantmentId(entry?.type)))
    const ids = Array.isArray(planIds) ? planIds : []

    for (const id of ids) {
        if (!id) continue
        const type = resolveEnchantmentType(id)
        if (!type) continue
        if (!canApplyEnchantment(enchantComp, type)) continue
        const normalized = normalizeEnchantmentId(type)
        if (!normalized || existingIds.has(normalized)) continue

        const candidateMax = Number(type?.maxLevel ?? 1)
        const target = resolveModuleEnchantTarget(level, candidateMax)
        if (target > 0) {
            result.push({ type, level: Math.max(1, target) })
            existingIds.add(normalized)
        }
    }

    return result
}

function applyCurseChance(enchantComp, existing, modules) {
    const result = Array.isArray(existing) ? [...existing] : []
    const curseChance = resolveCurseChance(modules)

    if (curseChance <= 0 || !rollChance(curseChance)) {
        return result
    }

    const existingIds = new Set(result.map(entry => normalizeEnchantmentId(entry?.type)))
    const curseCandidates = resolveCurseCandidates(enchantComp)
    for (const candidate of curseCandidates) {
        const id = normalizeEnchantmentId(candidate)
        if (!id || existingIds.has(id)) continue
        result.push({ type: candidate, level: 1 })
        break
    }

    return result
}

function resolveCurseChance(modules) {
    const enchantLevel = Math.max(0, modules.enchantability)
    const protectionLevel = Math.max(0, modules.curseProtection)
    const baseChance = station.curse.chance_base - (station.curse.chance_per_enchant * enchantLevel)
    const protectionModifier = clampUnitInterval(station.curse.protection_modifier)
    const protectedChance = baseChance * Math.pow(protectionModifier, protectionLevel)
    return clampUnitInterval(protectedChance)
}

function buildEnchantCandidatePool(enchantComp) {
    const pool = []

    for (const source of station.enchant.sources) {
        if (!source?.entries?.length) continue

        const options = source.entries
            .map(id => resolveEnchantmentType(id))
            .filter(type => type && canApplyEnchantment(enchantComp, type))

        if (!options.length) continue

        pool.push({
            options,
            weight: Number(source.weight ?? 1) || 1
        })
    }

    return pool
}

function pickCandidateFromPool(pool, existingIds) {
    let guard = 0
    while (pool.length > 0 && guard < 64) {
        guard += 1
        const source = pickWeightedSource(pool)
        if (!source) return null

        const available = source.options.filter(option => {
            const id = normalizeEnchantmentId(option)
            return id && !existingIds.has(id)
        })

        if (!available.length) {
            pool.splice(pool.indexOf(source), 1)
            continue
        }

        const choice = available[Math.floor(Math.random() * available.length)]
        return choice ?? null
    }

    return null
}

function pickWeightedSource(pool) {
    const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight ?? 1), 0)
    if (total <= 0) return pool[0] ?? null

    let roll = Math.random() * total
    for (const entry of pool) {
        const weight = Math.max(0, entry.weight ?? 1)
        roll -= weight
        if (roll <= 0) return entry
    }

    return pool[pool.length - 1] ?? null
}

function resolveCurseCandidates(enchantComp) {
    const resolved = []
    for (const id of station.curse.enchant_ids) {
        const type = resolveEnchantmentType(id)
        if (!type) continue
        if (canApplyEnchantment(enchantComp, type)) {
            resolved.push(type)
        }
    }
    return resolved
}

function resolveEnchantmentType(id) {
    if (!id) return null
    if (EnchantmentTypes?.get) {
        try {
            return EnchantmentTypes.get(id)
        } catch {
            return null
        }
    }
    return id
}

function canApplyEnchantment(enchantComp, type) {
    if (!enchantComp) return false
    if (typeof enchantComp.canAddEnchantment === 'function') {
        let can = null
        try {
            can = enchantComp.canAddEnchantment({ type, level: 1 })
        } catch { }
        if (can === true) return true
        try {
            can = enchantComp.canAddEnchantment(type)
        } catch { }
        if (can === true) return true
        if (can === false) return false
        return false
    }
    return true
}

function canWriteEnchantments(enchantComp) {
    if (!enchantComp) return false
    if (typeof enchantComp.addEnchantments === 'function') return true
    if (typeof enchantComp.addEnchantment === 'function') return true
    if ('enchantments' in enchantComp) return true
    return false
}

function readEnchantments(stack) {
    if (!stack || typeof stack.getComponent !== 'function') return []
    const compEnchantments = stack.getComponent('minecraft:enchantments')
        ?? stack.getComponent('enchantments')
        ?? null
    const compEnchantable = stack.getComponent('minecraft:enchantable')
        ?? null

    let list = []
    try {
        if (compEnchantments && typeof compEnchantments.getEnchantments === 'function') {
            list = compEnchantments.getEnchantments()
        } else if (compEnchantable && typeof compEnchantable.getEnchantments === 'function') {
            list = compEnchantable.getEnchantments()
        } else if (Array.isArray(compEnchantments?.enchantments)) {
            list = compEnchantments.enchantments
        } else if (Array.isArray(compEnchantable?.enchantments)) {
            list = compEnchantable.enchantments
        }
    } catch {
        return []
    }

    if (!Array.isArray(list)) return []
    return list
        .map(entry => {
            if (!entry?.type) return null
            const level = Number(entry.level ?? entry.lvl ?? entry.amount ?? 0)
            if (level <= 0) return null
            return { type: entry.type, level }
        })
        .filter(Boolean)
}

function hasEnchantmentsChanged(before, after) {
    const beforeNormalized = normalizeEnchantmentList(before)
    const afterNormalized = normalizeEnchantmentList(after)

    if (beforeNormalized.length !== afterNormalized.length) {
        return true
    }

    for (let i = 0; i < beforeNormalized.length; i += 1) {
        const previous = beforeNormalized[i]
        const next = afterNormalized[i]
        if (previous?.id !== next?.id) return true
        if (Number(previous?.level ?? 0) !== Number(next?.level ?? 0)) return true
    }

    return false
}

function countEnchantmentChanges(before, after) {
    if (!Array.isArray(after) || after.length === 0) return 0
    if (!Array.isArray(before) || before.length === 0) return after.length

    let changes = 0
    const beforeMap = new Map(before.map(entry => [normalizeEnchantmentId(entry?.type), entry?.level]))
    for (const entry of after) {
        const id = normalizeEnchantmentId(entry?.type)
        const nextLevel = Number(entry?.level ?? 0)
        const prevLevel = Number(beforeMap.get(id) ?? 0)
        if (!id) continue
        if (!beforeMap.has(id)) {
            changes += 1
            continue
        }
        if (nextLevel > prevLevel) {
            changes += 1
        }
    }
    return changes
}

function getEnchantmentAdditions(before, after) {
    if (!Array.isArray(after) || after.length === 0) return []
    const existingIds = new Set((before ?? []).map(entry => normalizeEnchantmentId(entry?.type)).filter(Boolean))
    return after.filter(entry => {
        const id = normalizeEnchantmentId(entry?.type)
        return id && !existingIds.has(id)
    })
}

function buildEnchantmentSignature(list) {
    const normalized = normalizeEnchantmentList(list)
    if (!normalized.length) return ''
    return normalized.map(entry => `${entry.id}:${entry.level}`).join('|')
}

function getStoredEnchantSignature(stack) {
    try {
        const stored = stack?.getDynamicProperty?.(station.enchant.signature_prop)
        return typeof stored === 'string' ? stored : ''
    } catch {
        return ''
    }
}

function setStoredEnchantSignature(stack, signature) {
    if (!stack || typeof stack.setDynamicProperty !== 'function') return
    try {
        const value = typeof signature === 'string' ? signature : ''
        stack.setDynamicProperty(station.enchant.signature_prop, value)
    } catch { }
}

function getStoredEnchantPlan(stack) {
    try {
        const raw = stack?.getDynamicProperty?.(station.enchant.plan_prop)
        if (!raw || typeof raw !== 'string') return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
        return null
    }
}

function setStoredEnchantPlan(stack, plan) {
    if (!stack || typeof stack.setDynamicProperty !== 'function') return
    try {
        if (!plan) {
            stack.setDynamicProperty(station.enchant.plan_prop, '')
            return
        }
        stack.setDynamicProperty(station.enchant.plan_prop, JSON.stringify(plan))
    } catch { }
}

function resolveEnchantPlanIds(stack, enchantComp, level, existingIds = new Set()) {
    const desiredCount = Math.max(0, Math.floor(level))
    if (!stack || !enchantComp || desiredCount <= 0) {
        setStoredEnchantPlan(stack, null)
        return []
    }

    const stored = getStoredEnchantPlan(stack)
    const storedLevel = Number(stored?.moduleLevel ?? 0)
    let ids = Array.isArray(stored?.ids) ? stored.ids.filter(id => typeof id === 'string') : []
    if (!ids.length && existingIds.size) {
        ids = [...existingIds].filter(id => typeof id === 'string')
    }
    let updated = storedLevel !== desiredCount

    const unique = []
    const seen = new Set()
    for (const raw of ids) {
        const norm = String(raw).toLowerCase()
        if (!norm || seen.has(norm)) continue
        seen.add(norm)
        unique.push(norm)
    }
    ids = unique

    ids = ids.filter(id => {
        const type = resolveEnchantmentType(id)
        return type && canApplyEnchantment(enchantComp, type)
    })

    if (ids.length < desiredCount) {
        const pool = buildEnchantCandidatePool(enchantComp)
        const blocked = new Set([...existingIds, ...ids])

        while (ids.length < desiredCount && pool.length > 0) {
            const candidate = pickCandidateFromPool(pool, blocked)
            if (!candidate) break
            const id = normalizeEnchantmentId(candidate)
            if (!id || blocked.has(id)) continue
            ids.push(id)
            blocked.add(id)
        }

        updated = true
    }

    if (updated) {
        setStoredEnchantPlan(stack, { moduleLevel: desiredCount, ids })
    }

    return ids
}

function applyEnchantmentsToStack(targetStack, enchantments) {
    if (!Array.isArray(enchantments) || enchantments.length === 0) return false
    const comp = getEnchantableComponent(targetStack)
    if (!comp) return false

    const sanitized = enchantments
        .map(entry => {
            const level = Number(entry?.level) || 0
            if (!entry?.type || level <= 0) return null
            return { type: entry.type, level }
        })
        .filter(entry => entry && canApplyEnchantment(comp, entry.type))

    if (!sanitized.length) return false

    const tryApply = () => {
        if (typeof comp.addEnchantments === 'function') {
            comp.addEnchantments(sanitized)
            return true
        }
        if (typeof comp.addEnchantment === 'function') {
            for (const entry of sanitized) {
                try {
                    comp.addEnchantment(entry)
                } catch { }
            }
            return true
        }
        return false
    }

    try {
        if (!tryApply()) return false
        const signature = buildEnchantmentSignature(sanitized)
        setStoredEnchantSignature(targetStack, signature)
        return true
    } catch (error) {
        console.warn('[enchantment_station] Failed to apply enchantments:', error)
        return false
    }
}

function applyEnchantmentPlanToStack(targetStack, enchantments) {
    if (!targetStack || !Array.isArray(enchantments)) return false

    const current = readEnchantments(targetStack)
    if (!hasEnchantmentsChanged(current, enchantments)) {
        return false
    }

    const removed = removeAllEnchantmentsFromStack(targetStack)
    if (!removed) {
        if (enchantments.length === 0) {
            return false
        }
        // Fallback for components that do not expose bulk removal.
        return applyEnchantmentsToStack(targetStack, enchantments)
    }

    if (enchantments.length === 0) {
        setStoredEnchantSignature(targetStack, '')
        return true
    }

    return applyEnchantmentsToStack(targetStack, enchantments)
}

function removeAllEnchantmentsFromStack(targetStack) {
    const comp = getEnchantableComponent(targetStack)
    if (!comp) return false

    try {
        if (typeof comp.removeAllEnchantments === 'function') {
            comp.removeAllEnchantments()
            return true
        }
    } catch { }

    if (typeof comp.removeEnchantment === 'function') {
        const current = readEnchantments(targetStack)
        for (const entry of current) {
            try {
                comp.removeEnchantment(entry.type)
            } catch { }
        }
        return true
    }

    return false
}

function getEnchantableComponent(stack) {
    if (!stack || typeof stack.getComponent !== 'function') return null
    return stack.getComponent('minecraft:enchantable')
        ?? stack.getComponent('minecraft:enchantments')
        ?? stack.getComponent('enchantments')
        ?? null
}

function getReinforcementPoints(stack) {
    if (!stack) return 0

    try {
        if (typeof stack.getDynamicProperty === 'function') {
            const value = Number(stack.getDynamicProperty(station.reinforcement.property) ?? 0)
            if (Number.isFinite(value)) return Math.max(0, value)
        }
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    if (!Array.isArray(lore)) return 0

    for (const line of lore) {
        const match = typeof line === 'string' ? line.match(station.reinforcement.pattern) : null
        if (match) {
            return Math.max(0, Number(match[1]) || 0)
        }
    }

    return 0
}

function getReinforcementMaxPoints(stack) {
    if (!stack) return 0

    try {
        if (typeof stack.getDynamicProperty === 'function') {
            const value = Number(stack.getDynamicProperty(REINFORCEMENT_DEFAULTS.props.max) ?? 0)
            if (Number.isFinite(value) && value > 0) return Math.max(0, Math.floor(value))
        }
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    if (Array.isArray(lore)) {
        for (const line of lore) {
            const match = typeof line === 'string' ? line.match(station.reinforcement.pattern) : null
            if (!match) continue
            const maxValue = Number(match[2] ?? NaN)
            if (Number.isFinite(maxValue) && maxValue > 0) {
                return Math.max(0, Math.floor(maxValue))
            }
        }
    }

    return Math.max(0, Math.floor(getReinforcementPoints(stack)))
}

function getReinforcementSyncVersion(stack) {
    if (!stack || typeof stack.getDynamicProperty !== 'function') return 0
    try {
        const value = Number(stack.getDynamicProperty(REINFORCEMENT_DEFAULTS.props.syncVersion) ?? 0)
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
    } catch {
        return 0
    }
}

function markReinforcementSyncVersion(stack, version = REINFORCEMENT_DEFAULTS.syncVersion) {
    if (!stack || typeof stack.setDynamicProperty !== 'function') return
    try {
        stack.setDynamicProperty(REINFORCEMENT_DEFAULTS.props.syncVersion, Math.max(0, Math.floor(Number(version) || 0)))
    } catch { }
}

function repairDurabilityWithRemainingReinforcement(stack, durability, requestedAmount = Number.POSITIVE_INFINITY) {
    if (!stack || !durability) {
        return { repaired: 0, spent: 0, remaining: 0 }
    }

    const points = getReinforcementPoints(stack)
    if (points <= 0) {
        return { repaired: 0, spent: 0, remaining: 0 }
    }

    const damage = Math.max(0, Math.floor(Number(durability.damage ?? 0) || 0))
    if (damage <= 0) {
        return { repaired: 0, spent: 0, remaining: points }
    }

    const cap = Number.isFinite(requestedAmount)
        ? Math.max(0, Math.floor(Number(requestedAmount) || 0))
        : damage

    if (cap <= 0) {
        return { repaired: 0, spent: 0, remaining: points }
    }

    const spent = Math.min(points, damage, cap)
    if (spent <= 0) {
        return { repaired: 0, spent: 0, remaining: points }
    }

    if (stack?.durability?.repair) {
        stack.durability.repair(spent)
    } else {
        durability.damage = Math.max(damage - spent, 0)
    }

    const remaining = Math.max(0, points - spent)
    setReinforcementPoints(stack, remaining)

    return {
        repaired: spent,
        spent,
        remaining
    }
}

function reconcileLegacyReinforcementDurability(stack, durability) {
    if (!stack || !durability) {
        return { repaired: 0, spent: 0, remaining: getReinforcementPoints(stack), updated: false }
    }

    const syncVersion = getReinforcementSyncVersion(stack)
    if (syncVersion >= REINFORCEMENT_DEFAULTS.syncVersion) {
        return { repaired: 0, spent: 0, remaining: getReinforcementPoints(stack), updated: false }
    }

    const result = repairDurabilityWithRemainingReinforcement(stack, durability)
    markReinforcementSyncVersion(stack, REINFORCEMENT_DEFAULTS.syncVersion)
    return {
        ...result,
        updated: true
    }
}

function setReinforcementPoints(stack, points, maxPoints = null) {
    if (!stack) return
    const currentValue = Math.max(0, Math.floor(points))
    const existingMax = getReinforcementMaxPoints(stack)
    const requestedMax = Number(maxPoints)

    const capacity = Number.isFinite(requestedMax) && requestedMax > 0
        ? Math.max(0, Math.floor(requestedMax))
        : Math.max(existingMax, currentValue)

    const clamped = Math.min(currentValue, Math.max(0, capacity))

    try {
        if (typeof stack.setDynamicProperty === 'function') {
            stack.setDynamicProperty(station.reinforcement.property, clamped)
            stack.setDynamicProperty(REINFORCEMENT_DEFAULTS.props.max, Math.max(0, capacity))
        }
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    const updated = Array.isArray(lore)
        ? lore.filter(line => typeof line !== 'string' || !station.reinforcement.pattern.test(line))
        : []

    if (capacity > 0) {
        updated.push(`${station.reinforcement.prefix}${clamped} / ${capacity}`)
    }

    if (typeof stack.setLore === 'function') {
        stack.setLore(updated)
    }

    markReinforcementSyncVersion(stack, REINFORCEMENT_DEFAULTS.syncVersion)
}

function resolveReinforcementTarget(durability, level) {
    const ratios = station.reinforcement.RATIOS
    const ratioIndex = Math.max(0, Math.min(ratios.length - 1, Math.floor(level)))
    const ratio = Number(ratios[ratioIndex]) || 0
    const maxDurability = Number(durability?.maxDurability ?? 0)
    if (!Number.isFinite(maxDurability) || maxDurability <= 0) return 0
    return Math.max(0, Math.floor(maxDurability * ratio))
}

function slotKey(slot) {
    return `ascane:${slot}`
}

function getSlotProgress(machine, slot) {
    return Number(machine.entity.getDynamicProperty(`${slotKey(slot)}:progress`)) || 0
}

function setSlotProgress(machine, slot, value) {
    machine.entity.setDynamicProperty(`${slotKey(slot)}:progress`, Math.max(0, Number(value) || 0))
}

function addSlotProgress(machine, slot, delta) {
    if (!delta) return
    const current = getSlotProgress(machine, slot)
    setSlotProgress(machine, slot, current + delta)
}

function getSlotEnergyCost(machine, slot) {
    return Number(machine.entity.getDynamicProperty(`${slotKey(slot)}:energy_cost`)) || getBaseOperationCost()
}

function setSlotEnergyCost(machine, slot, value) {
    machine.entity.setDynamicProperty(`${slotKey(slot)}:energy_cost`, normalizeEnergyCost(value))
}

function buildSlotResult(slot, state, message, progress, energyCost, details = null) {
    const result = { slot, state, message, progress, energyCost }
    if (details && typeof details === 'object') {
        Object.assign(result, details)
    }
    return result
}

function updateDisenchantHud(machine, result, modules = { enchantability: 0, reinforcement: 0, curseProtection: 0 }, xpTank = null) {
    if (!machine?.inv || !result) return
    
    const stack = safeGetItem(machine.inv, station.slots.disenchant.source)
    const catalyst = safeGetItem(machine.inv, station.slots.disenchant.catalyst)
    const books = safeGetItem(machine.inv, station.slots.disenchant.books)

    const itemName = stack ? formatIdentifier(stack.typeId) : 'None'
    const enchantments = stack ? readEnchantments(stack) : []
    const enchantCount = enchantments.length
    const catalystAmount = getCatalystAmount(catalyst)
    const bookAmount = getDisenchantBookAmount(books)
    const energyCost = result.energyCost || 0
    const energyNow = Energy.formatEnergyToText(Math.max(0, Number(machine?.energy?.get?.() ?? 0)))
    const energyCap = Energy.formatEnergyToText(Math.max(0, Number(machine?.energy?.getCap?.() ?? 0)))
    const statusLabel = resolveDisenchantHudStatus(result)
    const catalystLabel = resolveDisenchantCatalystLabel(catalyst)
    const absorbModeHint = shouldShowAbsorbModeHint({
        hasSource: Boolean(stack),
        enchantCount,
        catalystAmount,
        bookAmount
    })
    const pendingHelpers = buildDisenchantPendingHelpers({
        stack,
        enchantCount,
        catalyst,
        catalystAmount,
        catalystLabel,
        books,
        bookAmount,
        freeOutputs: resolveDisenchantOutputSlots(machine.inv).length,
        hasEnergy: Number(machine?.energy?.get?.() ?? 0) > 0
    })

    const statusHeaderColor = statusLabel.kind === 'error'
        ? '§c'
        : statusLabel.kind === 'waiting'
            ? '§e'
            : statusLabel.kind === 'ready'
                ? '§b'
                : statusLabel.kind === 'processing'
                    ? '§a'
                    : statusLabel.kind === 'absorbing'
                        ? '§d'
                        : '§2'

    const labelText = `
§r${statusHeaderColor}${statusLabel.title}

§r§aDisenchant Section
§r§aCost ${Energy.formatEnergyToText(Math.max(0, Number(energyCost) || 0))}
     
`.trim()
    
    const lore = []
    lore.push(`§fItem: ${itemName}`)
    lore.push(`§7Enchantments: §b${enchantCount}`)
    lore.push(`§7Catalyst: §e${catalystLabel} §7x${catalystAmount}`)
    lore.push(`§7Books: §6${bookAmount}x`)
    lore.push('§bOperation:')
    lore.push(`§7State: §f${statusLabel.title}`)
    lore.push(`§7Mode: §f${statusLabel.mode}`)
    if (statusLabel.subtitle) {
        lore.push(`§7Detail: §f${statusLabel.subtitle}`)
    }
    lore.push('§bNetwork:')
    lore.push(`§7Power: §f${energyNow} §7/ §f${energyCap}`)
    lore.push(`§7XP Tank: §f${formatXpTankText(xpTank)}`)
    lore.push(`§7Modules: §fE${modules.enchantability ?? 0} §7R${modules.reinforcement ?? 0} §7C${modules.curseProtection ?? 0}`)

    if (absorbModeHint) {
        lore.push('§7---')
        lore.push('§cWarning!')
        lore.push('- §fUsing the "Absorb" mode. Gaining XP instead.')
        lore.push('§7---')
    }

    for (const item of pendingHelpers) {
        lore.push(item)
    }

    machine.setLabel({
        rawText: labelText,
        lore
    }, station.slots.disenchant.status)
}

function resolveDisenchantHudStatus(result) {
    const state = String(result?.state ?? '').toLowerCase()
    const message = String(result?.message ?? '').trim()
    const absorbMode = result?.absorbMode === true || result?.disenchantAbsorbing === true
    const absorbPending = result?.absorbPending === true

    if (state === 'empty') {
        return { title: 'Waiting for Item', mode: 'Idle', subtitle: 'Insert an enchanted source item', kind: 'ready' }
    }

    if (state === 'error') {
        return {
            title: 'Error',
            mode: 'Error',
            subtitle: message || 'Check input and resources',
            kind: 'error'
        }
    }

    if (absorbMode && (absorbPending || state === 'processing')) {
        return {
            title: 'Disenchanting & Absorbing',
            mode: 'Absorbing',
            subtitle: absorbPending ? 'Queued absorb release (3s)' : 'Converting enchantments into XP',
            kind: 'absorbing'
        }
    }

    if (state === 'processing') {
        return {
            title: 'Disenchanting & Extracting',
            mode: 'Extracting',
            subtitle: 'Extracting enchantments into books',
            kind: 'processing'
        }
    }

    if (state === 'ready') {
        if (message === 'No Enchantments Detected') {
            return {
                title: 'No Enchantments Detected',
                mode: 'Ready',
                subtitle: 'Source has no removable enchantments',
                kind: 'ready'
            }
        }
        return { title: 'Waiting for Item', mode: 'Idle', subtitle: 'Insert an enchanted source item', kind: 'ready' }
    }

    if (state === 'waiting') {
        if (absorbMode) {
            return {
                title: 'Disenchanting & Absorbing',
                mode: absorbPending ? 'Absorbing' : 'Absorb Ready',
                subtitle: absorbPending
                    ? 'Queue running'
                    : (message || 'Missing catalyst/books: XP absorb mode'),
                kind: 'absorbing'
            }
        }
        if (message === 'No Output Space') {
            return {
                title: 'Disenchanting & Extracting',
                mode: 'Extract Ready',
                subtitle: 'No output space available',
                kind: 'waiting'
            }
        }
        return {
            title: 'Disenchanting & Extracting',
            mode: 'Extract Ready',
            subtitle: message || 'Awaiting catalyst/books/output',
            kind: 'waiting'
        }
    }

    return { title: 'Idle', mode: 'Idle', subtitle: '', kind: 'idle' }
}

function resolveDisenchantCatalystCandidates() {
    const ids = Array.isArray(station?.disenchant?.catalyst_ids)
        ? station.disenchant.catalyst_ids
        : []
    const labels = ids
        .map(id => formatIdentifier(id))
        .filter(Boolean)
    return labels.length ? labels : ['Refined Aetherium Shard']
}

function resolveDisenchantCatalystLabel(catalystStack) {
    if (catalystStack?.typeId) {
        return formatIdentifier(catalystStack.typeId)
    }
    return resolveDisenchantCatalystCandidates().join(' / ')
}

function shouldShowAbsorbModeHint({ hasSource, enchantCount, catalystAmount, bookAmount }) {
    if (!hasSource) return false
    if (!Number.isFinite(enchantCount) || enchantCount <= 0) return false
    const hasCatalyst = (Number(catalystAmount) || 0) > 0
    const hasBooks = (Number(bookAmount) || 0) > 0
    return !(hasCatalyst && hasBooks)
}

function buildDisenchantPendingHelpers({
    stack,
    enchantCount,
    catalyst,
    catalystAmount,
    catalystLabel,
    books,
    bookAmount,
    freeOutputs,
    hasEnergy
}) {
    const missing = []

    if (!stack) {
        missing.push(`- §fItem §7(Enchanted item/book in slot ${station.slots.disenchant.source})`)
    } else if (Number(stack.amount ?? 0) > 1) {
        missing.push(`- §fSingle Item §7(Use one item only)`)
    } else if (!getEnchantableComponent(stack) || enchantCount <= 0) {
        missing.push('- §fEnchantments §7(At least one required)')
    }

    const hasCatalyst = isDisenchantCatalyst(catalyst) && catalystAmount > 0
    const hasBooks = isDisenchantBookFuel(books) && bookAmount > 0
    const standardMode = hasCatalyst && hasBooks

    if (!hasCatalyst) {
        missing.push(`- §fCatalyst §7(${catalystLabel})`)
    }

    if (!hasBooks) {
        missing.push('- §fBooks §7')
    }

    if (standardMode && (Number(freeOutputs) || 0) <= 0) {
        missing.push(`- §fOutput Space §7(${station.slots.disenchant.outputs[0]}-${station.slots.disenchant.outputs[station.slots.disenchant.outputs.length - 1]})`)
    }

    if (!hasEnergy) {
        missing.push('- §fEnergy §7')
    }

    if (!missing.length) {
        return ['§aMissing §7(None)']
    }

    return ['§cMissing', ...missing.slice(0, 4)]
}

function updateHud(machine, results, modules, xpTank) {
    const visualResults = getMainSectionResults(results)
    const summary = summarizeResults(visualResults)
    const active = pickActiveProgress(visualResults)
    const allSummary = summarizeResults(results)

    if ((allSummary.processing ?? 0) > 0) {
        machine.on()
    } else {
        machine.off()
    }

    if (active) {
        machine.setEnergyCost(active.energyCost)
        displayProgress(machine, active.progress, active.energyCost)
    } else {
        displayProgress(machine, 0, 1)
    }

    machine.displayEnergy()

    const costText = active
        ? Energy.formatEnergyToText(active.energyCost)
        : Energy.formatEnergyToText(getBaseOperationCost())

    const lore = buildDiagnosticLore(machine, visualResults, modules, xpTank, active, summary, costText)

    const alert = resolveAlertDisplay(summary, visualResults)
    if (alert.mode === 'warning') {
        machine.showWarning(alert.message, false, lore, { footerLines: alert.footerLines })
    } else {
        machine.showStatus(alert.message, lore, { footerLines: alert.footerLines })
    }
}

function getMainSectionResults(results) {
    return (results ?? []).filter(result => {
        if (!result || typeof result !== 'object') return false
        if (result.slotType === 'main') return true
        return station.slots.grid.includes(Number(result.slot))
    })
}

function getReadyHighlights(results) {
    const ignored = new Set(['Ready', 'Empty'])
    const entries = new Set(
        (results ?? [])
            .filter(result => String(result?.state ?? '').toLowerCase() === 'ready')
            .map(result => typeof result?.message === 'string' ? result.message.trim() : '')
            .filter(message => message.length > 0 && !ignored.has(message))
    )
    return [...entries]
}

function resolveAlertDisplay(summary, results = []) {
    const waitingCount = summary.waiting ?? 0
    const errorCount = summary.error ?? 0
    const operationSummary = summarizeOperationStates(results, false)
    const runningHighlights = buildOperationHighlights(operationSummary, 'running', false)
    const pendingHighlights = buildOperationHighlights(operationSummary, 'pending', false)
    const readyHighlights = getReadyHighlights(results)

    if ((summary.processing ?? 0) > 0) {
        const header = runningHighlights.length > 0
            ? `Running: ${runningHighlights[0]}`
            : 'Running Operations'
        const extra = runningHighlights.slice(1, 3)
        return {
            mode: 'status',
            message: header,
            footerLines: [
                `Active: ${summary.processing}`,
                `Ready: ${summary.ready ?? 0} | Waiting: ${waitingCount} | Errors: ${errorCount}`,
                ...extra.map(line => `Also: ${line}`)
            ]
        }
    }

    if (errorCount > 0) {
        return {
            mode: 'warning',
            message: 'Attention Required',
            footerLines: [
                `Errors: ${errorCount}`,
                `Ready: ${summary.ready ?? 0} | Waiting: ${waitingCount}`
            ]
        }
    }

    if (waitingCount > 0) {
        const header = pendingHighlights.length > 0
            ? `Standby: ${pendingHighlights[0]}`
            : 'Standby - Awaiting Resources'
        return {
            mode: 'status',
            message: header,
            footerLines: [
                `Waiting slots: ${waitingCount}`,
                `Ready: ${summary.ready ?? 0}`,
                ...pendingHighlights.slice(1, 3).map(line => `Queued: ${line}`)
            ]
        }
    }

    if ((summary.ready ?? 0) > 0) {
        const header = readyHighlights.length > 0
            ? `Ready: ${readyHighlights[0]}`
            : 'Ready - Buffered'
        return {
            mode: 'status',
            message: header,
            footerLines: [`Ready slots: ${summary.ready}`, ...readyHighlights.slice(1, 3)]
        }
    }

    return {
        mode: 'status',
        message: 'Idle - Awaiting Input',
        footerLines: ['Insert item(s) to start processing']
    }
}

function buildDiagnosticLore(machine, results, modules, xpTank, active, summary, costText) {
    const lore = []

    const energyNow = Energy.formatEnergyToText(Math.max(0, Number(machine?.energy?.get?.() ?? 0)))
    const energyCap = Energy.formatEnergyToText(Math.max(0, Number(machine?.energy?.getCap?.() ?? 0)))

    lore.push('§bDiagnostics:')
    lore.push(`§7- Power: §f${energyNow} §7/ §f${energyCap}`)
    lore.push(`§7- XP Tank: §f${formatXpTankText(xpTank)}`)
    lore.push(`§7- Modules: §fE${modules.enchantability} §7R${modules.reinforcement} §7C${modules.curseProtection}`)
    lore.push(...buildOperationStateLore(results, false))

    const helperLines = buildMainPendingHelpers(results, modules, summary)
    lore.push(...helperLines)

    return lore
}

function summarizeOperationStates(results, includeDisenchant = true) {
    const makeBucket = () => ({ running: 0, pending: 0 })
    const summary = {
        enchanting: makeBucket(),
        repairing: makeBucket(),
        reinforcing: makeBucket(),
        curating: makeBucket(),
        disenchantExtracting: makeBucket(),
        disenchantAbsorbing: makeBucket()
    }

    const track = (bucket, result, treatPendingAsRunning = false) => {
        if (!bucket || !result) return
        const state = String(result.state ?? '').toLowerCase()
        const pending = state === 'waiting' || state === 'ready'
        const running = state === 'processing' || (treatPendingAsRunning && result?.absorbPending === true)
        if (running) {
            bucket.running += 1
            return
        }
        if (pending) {
            bucket.pending += 1
        }
    }

    for (const result of results ?? []) {
        if (!result || typeof result !== 'object') continue

        if (includeDisenchant) {
            if (result.disenchantExtracting === true) {
                track(summary.disenchantExtracting, result)
            }
            if (result.disenchantAbsorbing === true) {
                track(summary.disenchantAbsorbing, result, true)
            }
        }

        if (result.enchantingNeeded === true) {
            track(summary.enchanting, result)
        }
        if (result.repairingNeeded === true) {
            track(summary.repairing, result)
        }
        if (result.reinforcingNeeded === true) {
            track(summary.reinforcing, result)
        }
        if (result.curatingNeeded === true) {
            track(summary.curating, result)
        }
    }

    return summary
}

function formatOperationBucket(bucket) {
    const running = Math.max(0, Number(bucket?.running ?? 0))
    const pending = Math.max(0, Number(bucket?.pending ?? 0))

    if (running > 0 && pending > 0) {
        return `§aRunning §7(${running}) §8/ §eQueued §7(${pending})`
    }
    if (running > 0) {
        return `§aRunning §7(${running})`
    }
    if (pending > 0) {
        return `§eQueued §7(${pending})`
    }
    return '§8Idle'
}

function buildOperationStateLore(results, includeDisenchant = true) {
    const summary = summarizeOperationStates(results, includeDisenchant)
    const lines = [
        '§bOperation States:',
        `§7- Enchanting: ${formatOperationBucket(summary.enchanting)}`,
        `§7- Repairing: ${formatOperationBucket(summary.repairing)}`,
        `§7- Reinforcing: ${formatOperationBucket(summary.reinforcing)}`,
        `§7- Curating: ${formatOperationBucket(summary.curating)}`
    ]

    if (includeDisenchant) {
        lines.push(`§7- Disenchant & Extract: ${formatOperationBucket(summary.disenchantExtracting)}`)
        lines.push(`§7- Disenchant & Absorb: ${formatOperationBucket(summary.disenchantAbsorbing)}`)
    }

    return lines
}

function buildOperationHighlights(summary, mode = 'running', includeDisenchant = true) {
    const entries = [
        ['Enchanting', summary?.enchanting],
        ['Repairing', summary?.repairing],
        ['Reinforcing', summary?.reinforcing],
        ['Curating', summary?.curating]
    ]

    if (includeDisenchant) {
        entries.push(['Disenchant & Extract', summary?.disenchantExtracting])
        entries.push(['Disenchant & Absorb', summary?.disenchantAbsorbing])
    }

    return entries
        .map(([name, bucket]) => {
            const running = Math.max(0, Number(bucket?.running ?? 0))
            const pending = Math.max(0, Number(bucket?.pending ?? 0))
            if (mode === 'running') {
                if (running <= 0) return null
                return pending > 0 ? `${name} (${running} active, ${pending} queued)` : `${name} (${running} active)`
            }
            if (pending <= 0) return null
            return running > 0 ? `${name} (${pending} queued, ${running} active)` : `${name} (${pending} queued)`
        })
        .filter(Boolean)
}

function buildMainPendingHelpers(results, modules, summary) {
    const messages = new Set(
        (results ?? [])
            .map(result => typeof result?.message === 'string' ? result.message.trim() : '')
            .filter(Boolean)
    )

    const missing = []

    if (messages.has('No Energy')) {
        missing.push('- §fEnergy §7')
    }

    if (messages.has('Need XP')) {
        missing.push('- §fXP §7')
    }

    if (messages.has('Split Stack')) {
        missing.push('- §fSingle Item §7')
    }

    if (messages.has('Invalid Item')) {
        missing.push('- §fValid Item §7')
    }

    if ((modules?.enchantability ?? 0) <= 0) {
        missing.push('- §fEnchantability Module §7')
    }

    if ((summary?.waiting ?? 0) > 0 && missing.length <= 0) {
        missing.push('- §fResources §7')
    }

    if (!missing.length) {
        return ['§aMissing §7(None)']
    }

    return ['§cMissing', ...missing.slice(0, 4)]
}

function getDisenchantDiagnostics(inv) {
    const source = safeGetItem(inv, station.slots.disenchant.source)
    const catalyst = safeGetItem(inv, station.slots.disenchant.catalyst)
    const books = safeGetItem(inv, station.slots.disenchant.books)
    const freeOutputs = resolveDisenchantOutputSlots(inv).length

    const sourceText = source
        ? formatIdentifier(source.typeId)
        : 'None'

    let catalystText = 'None'
    if (catalyst) {
        const base = formatIdentifier(catalyst.typeId)
        const amount = Math.max(0, Math.floor(Number(catalyst.amount) || 0))
        catalystText = `${base} x${amount}`
    }

    const booksAmount = getDisenchantBookAmount(books)
    const booksText = booksAmount > 0
        ? `Book x${booksAmount}`
        : 'None'

    return {
        source: sourceText,
        catalyst: catalystText,
        books: booksText,
        freeOutputs
    }
}

function formatIdentifier(id) {
    if (typeof id !== 'string' || id.length === 0) return 'Unknown'
    const [, raw = id] = id.split(':')
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function estimateActiveEtaSeconds(active, machine, consumption) {
    const remaining = Math.max(0, Number(active?.energyCost ?? 0) - Number(active?.progress ?? 0))
    if (remaining <= 0) return 0

    const ticksPerSecond = Math.max(1, Number(station.time.ticks_per_second) || 20)
    const resultProgressPerTick = Math.max(0, Number(active?.progressPerTick ?? 0))
    if (resultProgressPerTick > 0) {
        const ticks = remaining / resultProgressPerTick
        return Math.max(0, ticks / ticksPerSecond)
    }

    const resultConsumption = Math.max(Number.EPSILON, Number(active?.consumption ?? consumption ?? 1))
    const resultRateProgressPerTick = Math.max(0, Number(active?.rate ?? 0)) / resultConsumption
    if (resultRateProgressPerTick > 0) {
        const ticks = remaining / resultRateProgressPerTick
        return Math.max(0, ticks / ticksPerSecond)
    }

    const machineProgressPerTick = Math.max(0, Number(machine?.rate ?? 0)) / Math.max(Number.EPSILON, Number(consumption ?? 1))
    if (machineProgressPerTick <= 0) return null
    const ticks = remaining / machineProgressPerTick
    return Math.max(0, ticks / ticksPerSecond)
}

function formatDuration(seconds) {
    if (seconds === null || !Number.isFinite(seconds)) return 'Unknown'
    const total = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(total / 60)
    const secs = total % 60
    if (minutes <= 0) return `${secs}s`
    return `${minutes}m ${secs}s`
}

function formatXpTankText(xpTank) {
    if (!xpTank) return 'N/A'
    const current = FluidManager.formatFluid(Math.max(0, xpTank.get?.() ?? 0))
    const capacity = FluidManager.formatFluid(Math.max(0, xpTank.getCap?.() ?? 0))
    return `${current} / ${capacity}`
}

function summarizeResults(results) {
    const summary = { processing: 0, waiting: 0, ready: 0, error: 0 }
    for (const result of results ?? []) {
        if (!result?.state) continue
        summary[result.state] = (summary[result.state] ?? 0) + 1
    }
    return summary
}

function pickActiveProgress(results) {
    const active = (results ?? []).filter(result => result && result.energyCost > 0)
    if (!active.length) return null
    active.sort((a, b) => {
        const ratioA = a.energyCost > 0 ? (a.progress / a.energyCost) : 0
        const ratioB = b.energyCost > 0 ? (b.progress / b.energyCost) : 0
        return ratioB - ratioA
    })
    return active[0]
}

function displayProgress(machine, progress, energyCost) {
    const frames = Math.max(1, Math.floor(Number(station.progress.frame_count) || 16))
    const normalized = energyCost > 0 ? Math.min(frames, Math.floor((progress / energyCost) * frames)) : 0
    const frame = normalized.toString().padStart(2, '0')
    const itemId = resolveProgressItemId(frame)
    machine.inv.setItem(station.slots.progress, new ItemStack(itemId, 1))
}

function resolveProgressItemId(frame) {
    const type = station.progress.type
    const color = station.progress.color
    if (color) {
        return `utilitycraft:${type}_${color}_${frame}`
    }
    return `utilitycraft:${type}_${frame}`
}

function queueReinforcementUsageBuffer(entity, slotName, usageAmount = 1) {
    if (!entity) return
    const normalizedUsage = Math.max(1, Math.floor(Number(usageAmount) || 0))
    system.runTimeout(() => {
        applyReinforcementUsageBuffer(entity, slotName, normalizedUsage)
    }, REINFORCEMENT_DEFAULTS.delayTicks)
}

function queueReinforcementArmorBuffer(entity, usageAmount = 1) {
    if (!entity) return
    const normalizedUsage = Math.max(1, Math.floor(Number(usageAmount) || 0))
    system.runTimeout(() => {
        applyReinforcementBuffer(entity, normalizedUsage)
    }, REINFORCEMENT_DEFAULTS.delayTicks)
}

function applyReinforcementBuffer(entity, usageAmount = 1) {
    if (!entity?.getComponent) return
    const equip = entity.getComponent('equippable')
    if (!equip) return

    const normalizedUsage = Math.max(1, Math.floor(Number(usageAmount) || 0))
    const slots = ['Head', 'Chest', 'Legs', 'Feet']

    let depleted = false
    for (const slot of slots) {
        const result = applyReinforcementUsageBuffer(entity, slot, normalizedUsage)
        if (result?.depleted) {
            depleted = true
        }
    }

    if (depleted) {
        try {
            const pos = entity.location ?? entity.getHeadLocation?.() ?? null
            if (pos) {
                entity.dimension?.playSound?.('random.anvil_break', pos, { volume: 1, pitch: 0.8 })
            }
        } catch { }
    }
}

function applyReinforcementUsageBuffer(entity, slotName, usageAmount = 1) {
    if (!entity?.getComponent) {
        return { applied: false, spent: 0, depleted: false }
    }
    const equip = entity.getComponent('equippable')
    if (!equip) {
        return { applied: false, spent: 0, depleted: false }
    }

    const item = equip.getEquipment(slotName)
    if (!item) {
        return { applied: false, spent: 0, depleted: false }
    }

    const durability = item.getComponent?.('minecraft:durability') ?? item.getComponent?.('durability')
    if (!durability) {
        return { applied: false, spent: 0, depleted: false }
    }

    const pointsBefore = getReinforcementPoints(item)

    const legacySync = reconcileLegacyReinforcementDurability(item, durability)

    const result = repairDurabilityWithRemainingReinforcement(item, durability)
    if (result.spent <= 0 && !legacySync.updated) {
        return { applied: false, spent: 0, depleted: false }
    }

    try {
        equip.setEquipment(slotName, item)
    } catch { }

    const pointsAfter = getReinforcementPoints(item)
    return {
        applied: true,
        spent: Math.max(0, Number(result.spent) || 0),
        depleted: pointsBefore > 0 && pointsAfter <= 0
    }
}

if (!globalThis.__ascaneReinforcementHooked) {
    globalThis.__ascaneReinforcementHooked = true
    const hurtEvents = world?.afterEvents?.entityHurt ?? world?.beforeEvents?.entityHurt
    if (hurtEvents?.subscribe) {
        hurtEvents.subscribe(event => {
            const target = event?.hurtEntity ?? event?.entity
            if (!target) return
            queueReinforcementArmorBuffer(target, 1)
        })
    }

    const hitEvents = world?.afterEvents?.entityHitEntity ?? world?.beforeEvents?.entityHitEntity
    if (hitEvents?.subscribe) {
        hitEvents.subscribe(event => {
            const attacker = event?.damagingEntity ?? event?.entity
            if (!attacker) return
            queueReinforcementUsageBuffer(attacker, 'Mainhand', 1)
        })
    }

    const breakEvents = world?.afterEvents?.playerBreakBlock ?? world?.beforeEvents?.playerBreakBlock
    if (breakEvents?.subscribe) {
        breakEvents.subscribe(event => {
            const player = event?.player
            if (!player) return
            queueReinforcementUsageBuffer(player, 'Mainhand', 1)
        })
    }

    const itemUseEvents = world?.afterEvents?.itemUse ?? world?.beforeEvents?.itemUse
    if (itemUseEvents?.subscribe) {
        itemUseEvents.subscribe(event => {
            const player = event?.source ?? event?.player
            if (!player) return
            queueReinforcementUsageBuffer(player, 'Mainhand', 1)
        })
    }
}

/*
Future hook for API 2.6.0+ (pre-release): reinforce can also reduce incoming damage.
Reference:
https://learn.microsoft.com/pt-br/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent?view=minecraft-bedrock-experimental

Behavior idea (including shield): each reinforced equipped piece reduces damage by X%.
Keep this block commented until the API is stable on the target runtime.

if (!globalThis.__ascaneReinforcementMitigationHooked && world?.beforeEvents?.entityHurt?.subscribe) {
    globalThis.__ascaneReinforcementMitigationHooked = true

    const mitigationPerPiece = 0.04 // 4% per reinforced piece
    const maxMitigation = 0.60     // cap at 60%

    world.beforeEvents.entityHurt.subscribe(event => {
        const target = event?.hurtEntity
        if (!target?.getComponent) return

        const equip = target.getComponent('equippable')
        if (!equip) return

        const slots = ['Head', 'Chest', 'Legs', 'Feet', 'Offhand'] // include shield in Offhand
        let reinforcedPieces = 0

        for (const slot of slots) {
            const item = equip.getEquipment(slot)
            if (!item) continue
            if (getReinforcementPoints(item) > 0) {
                reinforcedPieces += 1
            }
        }

        if (reinforcedPieces <= 0) return

        const reduction = Math.min(maxMitigation, reinforcedPieces * mitigationPerPiece)
        event.damage = Math.max(0, event.damage * (1 - reduction))
    })
}
*/

function rollChance(chance) {
    const normalized = clampUnitInterval(chance)
    if (normalized <= 0) return false
    if (normalized >= 1) return true
    return Math.random() <= normalized
}

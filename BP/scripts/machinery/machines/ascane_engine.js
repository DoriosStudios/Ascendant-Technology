import { ItemStack, EnchantmentTypes, world } from '@minecraft/server'
import { Machine, Energy, FluidManager, buildOverclockLoreLine } from '../AscendantMachinery/core.js'

const ENERGY_SLOT = 0
const STATUS_SLOT = 1
const PROGRESS_SLOT = 2
const GRID_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11]
const DISENCHANT_SLOT = 12
const MODULE_SLOTS = [13, 14, 15]
const UPGRADE_SLOTS = [16, 17]

const BASE_COST = 8000
const INDUCTION_ANVIL_DIVISOR = 10
const REPAIR_MULTIPLIER = 2.5

const MODULE_LEVELS = Object.freeze({
    base: 'utilitycraft:ascane_module_base',
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
    ],
    curseProtection: [
        'utilitycraft:curse_protection_module'
    ]
})

const REINFORCEMENT_RATIOS = [0, 0.25, 0.5, 1]
const REINFORCEMENT_PROP = 'utilitycraft:reinforcement'
const REINFORCEMENT_LORE_PATTERN = /Reinforcement\s*:\s*(\d+)/i
const REINFORCEMENT_LORE_PREFIX = '§r§9Reinforcement: '
const ENCHANT_SIGNATURE_PROP = 'utilitycraft:ascane_enchant_signature'
const ENCHANT_PLAN_PROP = 'utilitycraft:ascane_enchant_plan'

const CURSE_ENCHANT_IDS = ['minecraft:binding', 'minecraft:vanishing']
const CURSE_CHANCE_BASE = 0.15
const CURSE_CHANCE_PER_ENCHANT = 0.01
const CURSE_CHANCE_PER_PROTECTION = 0.05
const CURSE_PROTECTION_COST_MULTIPLIER = 8

const ENCHANT_SECONDS_PER_CHANGE = 2
const REPAIR_SECONDS = 1
const REINFORCEMENT_SECONDS = 1
const MIN_PROCESS_SECONDS = 1
const ENCHANT_OPERATION_COST = BASE_COST

const XP_TANK_TYPE = 'xp'
const XP_TANK_CAP_DEFAULT = 128000
const XP_PER_ENCHANT = 1000
const XP_DISPLAY_SLOT = 18

/**
 * Module-tier target levels for enchant upgrades (array-based mapping).
 * - MODULE_ENCHANT_LEVELS: enchantment maxLevel buckets.
 * - MODULE_ENCHANT_MODULES: module tier indices.
 * - MODULE_ENCHANT_TARGETS: matrix[ moduleIndex ][ levelIndex ] => target level (0 = not allowed).
 */
const MODULE_ENCHANT_LEVELS = Object.freeze([5, 4, 3, 2, 1])
const MODULE_ENCHANT_MODULES = Object.freeze([1, 2, 3, 4, 5])
const MODULE_ENCHANT_TARGETS = Object.freeze([
    [1, 1, 1, 0, 0], // Module 1: 5/4/3 -> 1
    [2, 2, 0, 0, 0], // Module 2: 5/4 -> 2
    [3, 3, 2, 1, 0], // Module 3: 5/4 -> 3, 3 -> 2, 2 -> 1
    [4, 0, 0, 0, 0], // Module 4: 5 -> 4
    [5, 4, 3, 2, 1]  // Module 5: max level for all
])

const ENCHANTMENT_SOURCES = [
    { kind: 'group', entries: [
        'minecraft:protection', 'minecraft:fire_protection', 'minecraft:blast_protection', 'minecraft:projectile_protection'
    ] },
    { kind: 'group', entries: [
        'minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods'
    ] },
    { kind: 'group', entries: [
        'minecraft:silk_touch', 'minecraft:fortune'
    ] },
    { kind: 'group', entries: [
        'minecraft:depth_strider', 'minecraft:frost_walker'
    ] },
    { kind: 'group', entries: [
        'minecraft:multishot', 'minecraft:piercing'
    ] },
    { kind: 'group', entries: [
        'minecraft:loyalty', 'minecraft:riptide'
    ] },
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
    { kind: 'single', entries: ['minecraft:swift_sneak'] }
]

const PROGRESS_STYLE = {
    type: 'arcane',
    color: null
}

DoriosAPI.register.blockComponent('enchantment_station', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(BASE_COST)
            machine.displayEnergy()
            displayProgress(machine, 0, 1)
            getAscaneXpTank(machine, settings)

            machine.setLabel({
                title: '§r§6Ascane Engine',
                lore: [
                    '§7Insert tools or armor into the grid.',
                    '§7Modules control enchanting and reinforcement.'
                ]
            }, STATUS_SLOT)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const { block } = e
        const machine = new Machine(block, settings, true)
        if (!machine?.entity || !machine.inv) return

        const tickSpeed = Math.max(1, Number(globalThis.tickSpeed ?? 1))
        const modules = getModuleLevels(machine.inv)
        const xpTank = getAscaneXpTank(machine, settings)
        const results = []

        results.push(processDisenchantSlot(machine, DISENCHANT_SLOT, settings, tickSpeed))

        for (const slot of GRID_SLOTS) {
            results.push(processSlot(machine, slot, modules, settings, tickSpeed, xpTank))
        }

        updateHud(machine, results, modules)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getModuleLevels(inv) {
    const levels = {
        enchantability: 0,
        reinforcement: 0,
        curseProtection: 0
    }

    for (const slot of MODULE_SLOTS) {
        const stack = inv.getItem(slot)
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

function resolveModuleLevel(typeId) {
    if (!typeId) return null

    const enchantIndex = MODULE_LEVELS.enchantability.indexOf(typeId)
    if (enchantIndex > 0) {
        return { type: 'enchantability', level: enchantIndex }
    }

    const reinforceIndex = MODULE_LEVELS.reinforcement.indexOf(typeId)
    if (reinforceIndex > 0) {
        return { type: 'reinforcement', level: reinforceIndex }
    }

    if (MODULE_LEVELS.curseProtection.includes(typeId)) {
        return { type: 'curseProtection', level: 1 }
    }

    if (typeId === MODULE_LEVELS.base) {
        return { type: 'base', level: 1 }
    }

    return null
}

function getAscaneXpTank(machine, settings) {
    if (!machine?.entity) return null
    if (!settings?.machine?.fluid_cap) return null

    const tank = FluidManager.initializeSingle(machine.entity)
    const cap = Number(settings?.machine?.fluid_cap ?? XP_TANK_CAP_DEFAULT)
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap)
    }
    if (tank.getType() === 'empty') {
        tank.setType(XP_TANK_TYPE)
    }
    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', XP_TANK_TYPE)
    } catch { }
    try {
        tank.display(XP_DISPLAY_SLOT)
    } catch { }
    return tank
}

function processDisenchantSlot(machine, slot, settings, tickSpeed) {
    const stack = machine.inv.getItem(slot)

    const fail = (state, message, resetProgress = true) => {
        if (resetProgress) setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, state, message, 0, getSlotEnergyCost(machine, slot))
    }

    if (!stack) {
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
        return fail('ready', 'Ready')
    }

    const energyCost = computeDisenchantCost(enchantCount)
    const timeSeconds = computeDisenchantTime(enchantCount)

    setSlotEnergyCost(machine, slot, energyCost)
    const progress = getSlotProgress(machine, slot)

    if (machine.energy.get() <= 0) {
        return buildSlotResult(slot, 'waiting', 'No Energy', progress, energyCost)
    }

    if (progress >= energyCost) {
        const removed = removeAllEnchantmentsFromStack(stack)
        if (!removed) {
            return fail('error', 'Cannot Disenchant')
        }

        setStoredEnchantPlan(stack, null)
        setStoredEnchantSignature(stack, '')
        machine.inv.setItem(slot, stack)

        setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, 'processing', 'Updated', 0, energyCost)
    }

    const consumption = machine.boosts.consumption
    const needed = energyCost - progress
    const rate = resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) ?? machine.rate
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption)

    if (spendable > 0) {
        machine.energy.consume(spendable)
        addSlotProgress(machine, slot, spendable / Math.max(consumption, Number.EPSILON))
    }

    const updatedProgress = getSlotProgress(machine, slot)
    return buildSlotResult(slot, 'processing', 'Processing', updatedProgress, energyCost)
}

function processSlot(machine, slot, modules, settings, tickSpeed, xpTank) {
    const stack = machine.inv.getItem(slot)
    const key = slotKey(slot)

    const fail = (state, message, resetProgress = true) => {
        if (resetProgress) setSlotProgress(machine, slot, 0)
        return buildSlotResult(slot, state, message, 0, getSlotEnergyCost(machine, slot))
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

    const enchantComp = getEnchantableComponent(stack)
    const repairNeeded = durability.damage > 0

    const reinforcementTarget = resolveReinforcementTarget(durability, modules.reinforcement)
    const reinforcementCurrent = getReinforcementPoints(stack)
    const reinforcementNeeded = reinforcementTarget > reinforcementCurrent

    const enchantPlan = buildEnchantPlan(stack, enchantComp, modules)
    const enchantNeeded = enchantPlan.changed
    const enchantChangeCount = Math.max(0, Math.floor(enchantPlan.changeCount ?? 0))
    const xpNeeded = enchantNeeded ? (XP_PER_ENCHANT * Math.max(1, enchantChangeCount)) : 0

    if (!repairNeeded && !enchantNeeded && !reinforcementNeeded) {
        return fail('ready', 'Ready')
    }

    if (xpNeeded > 0) {
        if (!xpTank || xpTank.getType() !== XP_TANK_TYPE) {
            return buildSlotResult(slot, 'waiting', 'Need XP', getSlotProgress(machine, slot), getSlotEnergyCost(machine, slot))
        }
        if (xpTank.get() < xpNeeded) {
            return buildSlotResult(slot, 'waiting', 'Need XP', getSlotProgress(machine, slot), getSlotEnergyCost(machine, slot))
        }
    }

    const energyCost = computeEnergyCost({
        enchantNeeded,
        reinforcementNeeded,
        modules,
        enchantChangeCount
    })

    const timeSeconds = computeTimeSeconds({
        enchantChangeCount,
        reinforcementNeeded,
        repairNeeded
    })

    setSlotEnergyCost(machine, slot, energyCost)
    const progress = getSlotProgress(machine, slot)

    if (machine.energy.get() <= 0) {
        return buildSlotResult(slot, 'waiting', 'No Energy', progress, energyCost)
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
        return buildSlotResult(slot, 'processing', 'Updated', 0, energyCost)
    }

    const consumption = machine.boosts.consumption
    const needed = energyCost - progress
    const rate = resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) ?? machine.rate
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption)

    if (spendable > 0) {
        machine.energy.consume(spendable)
        addSlotProgress(machine, slot, spendable / Math.max(consumption, Number.EPSILON))
    }

    const updatedProgress = getSlotProgress(machine, slot)
    return buildSlotResult(slot, 'processing', 'Processing', updatedProgress, energyCost)
}

function computeEnergyCost({ enchantNeeded, reinforcementNeeded, modules, enchantChangeCount }) {
    let cost = BASE_COST

    if (enchantNeeded && modules.enchantability > 0) {
        cost += BASE_COST * modules.enchantability
        cost += ENCHANT_OPERATION_COST * Math.max(1, enchantChangeCount || 0)
    }

    if (reinforcementNeeded && modules.reinforcement > 0) {
        cost += BASE_COST * modules.reinforcement
    }

    if (enchantNeeded && modules.curseProtection > 0) {
        cost += BASE_COST * CURSE_PROTECTION_COST_MULTIPLIER * modules.curseProtection
    }

    return Math.max(1, Math.floor(cost))
}

function computeDisenchantCost(enchantCount) {
    const count = Math.max(1, Math.floor(Number(enchantCount) || 0))
    return Math.max(1, Math.floor(BASE_COST * count))
}

function computeTimeSeconds({ enchantChangeCount, reinforcementNeeded, repairNeeded }) {
    let total = 0
    if (repairNeeded) total += REPAIR_SECONDS
    if (reinforcementNeeded) total += REINFORCEMENT_SECONDS
    if (enchantChangeCount > 0) total += ENCHANT_SECONDS_PER_CHANGE * enchantChangeCount
    return Math.max(MIN_PROCESS_SECONDS, Math.floor(total) || 0)
}

function computeDisenchantTime(enchantCount) {
    const count = Math.max(1, Math.floor(Number(enchantCount) || 0))
    const total = ENCHANT_SECONDS_PER_CHANGE * count
    return Math.max(MIN_PROCESS_SECONDS, Math.floor(total) || 0)
}

function resolveSlotRate(machine, energyCost, timeSeconds, settings, tickSpeed) {
    if (!settings?.machine?.dynamic_rate) return null
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return null
    if (!Number.isFinite(energyCost) || energyCost <= 0) return null

    const speedMultiplier = Number(machine.boosts?.speed ?? 1)
    const consumptionMultiplier = Math.max(Number.EPSILON, Number(machine.boosts?.consumption ?? 1))
    const progressPerSecond = (energyCost / timeSeconds) * (Number.isFinite(speedMultiplier) ? speedMultiplier : 1)
    const energyPerSecond = progressPerSecond * consumptionMultiplier
    const baseRate = Math.max(1, energyPerSecond / 20)
    const tickRate = Math.max(1, Number(tickSpeed) || 1)
    return baseRate * tickRate
}

function applySlotOperations({ machine, slot, stack, durability, repairNeeded, reinforcementTarget, reinforcementNeeded, enchantPlan, xpTank, xpNeeded }) {
    const repairAmount = Math.max(1, Math.floor((BASE_COST / INDUCTION_ANVIL_DIVISOR) * REPAIR_MULTIPLIER))

    if (repairNeeded && stack?.durability?.repair) {
        stack.durability.repair(repairAmount)
    } else if (repairNeeded && durability) {
        durability.damage = Math.max(durability.damage - repairAmount, 0)
    }

    if (enchantPlan.changed && Array.isArray(enchantPlan.enchantments)) {
        applyEnchantmentsToStack(stack, enchantPlan.enchantments)
        if (xpTank && xpNeeded > 0 && typeof xpTank.add === 'function') {
            xpTank.add(-xpNeeded)
        }
        playMachineSound(machine, 'enchanting_table.use', { volume: 0.9, pitch: 1.1 })
    }

    if (reinforcementNeeded && reinforcementTarget > 0) {
        setReinforcementPoints(stack, reinforcementTarget)
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
    if (!enchantComp || level <= 0 || !canWriteEnchantments(enchantComp)) {
        return { changed: false, enchantments: null, changeCount: 0 }
    }

    const current = readEnchantments(stack)
    const existingIds = new Set(current.map(entry => normalizeEnchantmentId(entry?.type)).filter(Boolean))
    const planIds = resolveEnchantPlanIds(stack, enchantComp, level, existingIds)
    const withAdditions = addMissingEnchantments(enchantComp, current, level, planIds)
    const withCurses = applyCurseChance(enchantComp, withAdditions, modules)

    const additions = getEnchantmentAdditions(current, withCurses)
    const changeCount = additions.length
    const changed = changeCount > 0
    return { changed, enchantments: additions, changeCount }
}

function clampLevel(value, min, max) {
    const numeric = Math.floor(Number(value) || 0)
    return Math.max(min, Math.min(max, numeric))
}

function resolveModuleEnchantTarget(moduleLevel, enchantMaxLevel) {
    const moduleKey = clampLevel(moduleLevel, 1, MODULE_ENCHANT_MODULES.length)
    const maxKey = clampLevel(enchantMaxLevel, 1, MODULE_ENCHANT_LEVELS.length)
    const moduleIndex = MODULE_ENCHANT_MODULES.indexOf(moduleKey)
    const levelIndex = MODULE_ENCHANT_LEVELS.indexOf(maxKey)
    if (moduleIndex < 0 || levelIndex < 0) return 0
    const target = MODULE_ENCHANT_TARGETS[moduleIndex]?.[levelIndex] ?? 0
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
    const protectionLevel = Math.max(0, modules.curseProtection)
    if (protectionLevel > 0) return 0

    const enchantLevel = Math.max(0, modules.enchantability)
    const reduced = CURSE_CHANCE_BASE - (CURSE_CHANCE_PER_ENCHANT * enchantLevel)
    return Math.max(0, Math.min(1, reduced))
}

function buildEnchantCandidatePool(enchantComp) {
    const pool = []

    for (const source of ENCHANTMENT_SOURCES) {
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
    for (const id of CURSE_ENCHANT_IDS) {
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
    if (!Array.isArray(after) || after.length === 0) return false
    if (!Array.isArray(before) || before.length === 0) return true

    const beforeMap = new Map(before.map(entry => [normalizeEnchantmentId(entry?.type), entry?.level]))
    for (const entry of after) {
        const id = normalizeEnchantmentId(entry?.type)
        const beforeLevel = beforeMap.get(id)
        if (!beforeMap.has(id)) return true
        if (Number(entry?.level ?? 0) !== Number(beforeLevel ?? 0)) return true
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

function normalizeEnchantmentId(type) {
    if (!type) return ''
    const id = type.id ?? type.identifier ?? type.typeId ?? type.name ?? ''
    return typeof id === 'string' ? id.toLowerCase() : ''
}

function normalizeEnchantmentList(list) {
    if (!Array.isArray(list)) return []
    return list
        .map(entry => {
            const id = normalizeEnchantmentId(entry?.type)
            const level = Math.floor(Number(entry?.level ?? 0))
            if (!id || level <= 0) return null
            return { id, level }
        })
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level)
}

function buildEnchantmentSignature(list) {
    const normalized = normalizeEnchantmentList(list)
    if (!normalized.length) return ''
    return normalized.map(entry => `${entry.id}:${entry.level}`).join('|')
}

function getStoredEnchantSignature(stack) {
    try {
        const stored = stack?.getDynamicProperty?.(ENCHANT_SIGNATURE_PROP)
        return typeof stored === 'string' ? stored : ''
    } catch {
        return ''
    }
}

function setStoredEnchantSignature(stack, signature) {
    if (!stack || typeof stack.setDynamicProperty !== 'function') return
    try {
        const value = typeof signature === 'string' ? signature : ''
        stack.setDynamicProperty(ENCHANT_SIGNATURE_PROP, value)
    } catch { }
}

function getStoredEnchantPlan(stack) {
    try {
        const raw = stack?.getDynamicProperty?.(ENCHANT_PLAN_PROP)
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
            stack.setDynamicProperty(ENCHANT_PLAN_PROP, '')
            return
        }
        stack.setDynamicProperty(ENCHANT_PLAN_PROP, JSON.stringify(plan))
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
    if (!Array.isArray(enchantments) || enchantments.length === 0) return
    const comp = getEnchantableComponent(targetStack)
    if (!comp) return

    const sanitized = enchantments
        .map(entry => {
            const level = Number(entry?.level) || 0
            if (!entry?.type || level <= 0) return null
            return { type: entry.type, level }
        })
        .filter(entry => entry && canApplyEnchantment(comp, entry.type))

    if (!sanitized.length) return

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
        if (!tryApply()) return
        const signature = buildEnchantmentSignature(sanitized)
        setStoredEnchantSignature(targetStack, signature)
    } catch (error) {
        console.warn('[enchantment_station] Failed to apply enchantments:', error)
    }
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
            const value = Number(stack.getDynamicProperty(REINFORCEMENT_PROP) ?? 0)
            if (Number.isFinite(value)) return Math.max(0, value)
        }
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    if (!Array.isArray(lore)) return 0

    for (const line of lore) {
        const match = typeof line === 'string' ? line.match(REINFORCEMENT_LORE_PATTERN) : null
        if (match) {
            return Math.max(0, Number(match[1]) || 0)
        }
    }

    return 0
}

function setReinforcementPoints(stack, points) {
    if (!stack) return
    const clamped = Math.max(0, Math.floor(points))

    try {
        if (typeof stack.setDynamicProperty === 'function') {
            stack.setDynamicProperty(REINFORCEMENT_PROP, clamped)
        }
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    const updated = Array.isArray(lore)
        ? lore.filter(line => typeof line !== 'string' || !REINFORCEMENT_LORE_PATTERN.test(line))
        : []

    if (clamped > 0) {
        updated.push(`${REINFORCEMENT_LORE_PREFIX}${clamped}`)
    }

    if (typeof stack.setLore === 'function') {
        stack.setLore(updated)
    }
}

function resolveReinforcementTarget(durability, level) {
    const ratioIndex = Math.max(0, Math.min(REINFORCEMENT_RATIOS.length - 1, Math.floor(level)))
    const ratio = Number(REINFORCEMENT_RATIOS[ratioIndex]) || 0
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
    return Number(machine.entity.getDynamicProperty(`${slotKey(slot)}:energy_cost`)) || BASE_COST
}

function setSlotEnergyCost(machine, slot, value) {
    machine.entity.setDynamicProperty(`${slotKey(slot)}:energy_cost`, Math.max(1, Number(value) || 1))
}

function buildSlotResult(slot, state, message, progress, energyCost) {
    return { slot, state, message, progress, energyCost }
}

function updateHud(machine, results, modules) {
    const summary = summarizeResults(results)
    const active = pickActiveProgress(results)

    if (summary.processing > 0) {
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
        : Energy.formatEnergyToText(BASE_COST)

    const lore = [
        `§bSlots: `,
        `§i- ${summary.processing} active`, 
        `§i- ${summary.ready} ready`, 
        `§i- ${summary.error} blocked`,
        `§bModules: `,
        `§i- Enchant ${modules.enchantability}`,
        `§i- Reinforce ${modules.reinforcement}`,
        `§i- Curse ${modules.curseProtection}`,
        `§aCost: ${costText}`
    ]

    const overclockLine = buildOverclockLoreLine(machine)
    if (overclockLine) lore.push(overclockLine)

    machine.setLabel({
        title: '§r§6Ascane Engine',
        lore
    }, STATUS_SLOT)
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
    const normalized = energyCost > 0 ? Math.min(16, Math.floor((progress / energyCost) * 16)) : 0
    const frame = normalized.toString().padStart(2, '0')
    const itemId = resolveProgressItemId(frame)
    machine.inv.setItem(PROGRESS_SLOT, new ItemStack(itemId, 1))
}

function resolveProgressItemId(frame) {
    const type = PROGRESS_STYLE.type
    const color = PROGRESS_STYLE.color
    if (color) {
        return `utilitycraft:${type}_${color}_${frame}`
    }
    return `utilitycraft:${type}_${frame}`
}

function applyReinforcementBuffer(entity, damageValue) {
    if (!entity?.getComponent) return
    const equip = entity.getComponent('equippable')
    if (!equip) return

    const rawDamage = Number(damageValue)
    if (!Number.isFinite(rawDamage) || rawDamage <= 0) return
    const damagePoints = Math.max(1, Math.ceil(rawDamage))

    const slots = ['Head', 'Chest', 'Legs', 'Feet']
    const entries = []

    for (const slot of slots) {
        const item = equip.getEquipment(slot)
        if (!item) continue

        const points = getReinforcementPoints(item)
        if (points <= 0) continue

        const durability = item.getComponent?.('minecraft:durability') ?? item.getComponent?.('durability')
        if (!durability) continue

        entries.push({ slot, item, points, durability, startPoints: points })
    }

    if (!entries.length) return

    for (let i = 0; i < damagePoints; i += 1) {
        let applied = false
        for (const entry of entries) {
            if (entry.points <= 0) continue

            if (entry.item?.durability?.repair) {
                entry.item.durability.repair(1)
            } else {
                entry.durability.damage = Math.max(entry.durability.damage - 1, 0)
            }
            entry.points -= 1
            applied = true
        }

        if (!applied) break
    }

    for (const entry of entries) {
        setReinforcementPoints(entry.item, entry.points)
        try {
            equip.setEquipment(entry.slot, entry.item)
        } catch { }
    }

    const depleted = entries.some(entry => entry.startPoints > 0 && entry.points <= 0)
    if (depleted) {
        try {
            const pos = entity.location ?? entity.getHeadLocation?.() ?? null
            if (pos) {
                entity.dimension?.playSound?.('random.anvil_break', pos, { volume: 1, pitch: 0.8 })
            }
        } catch { }
    }
}

if (!globalThis.__ascaneReinforcementHooked) {
    globalThis.__ascaneReinforcementHooked = true
    const hurtEvents = world?.afterEvents?.entityHurt ?? world?.beforeEvents?.entityHurt
    if (hurtEvents?.subscribe) {
        hurtEvents.subscribe(event => {
            const target = event?.hurtEntity ?? event?.entity
            if (!target) return
            applyReinforcementBuffer(target, event?.damage)
        })
    }
}

function rollChance(chance) {
    const normalized = Math.max(0, Math.min(1, Number(chance) || 0))
    if (normalized <= 0) return false
    if (normalized >= 1) return true
    return Math.random() <= normalized
}

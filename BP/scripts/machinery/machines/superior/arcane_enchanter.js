import { EnchantmentTypes } from '@minecraft/server'
import {
    Machine,
    FluidManager,
    applyDynamicRecipeRate,
    applyEnchantmentsToStack as applyCoreEnchantmentsToStack,
    buildOverclockLoreLine,
    appendLoreSection,
    extractEnchantments,
    formatItemName,
    getEnchantableComponent,
    normalizeEnchantmentId,
    tickGate
} from '../../../DoriosCore/main.js'
import { shouldRefreshSuperiorUi } from './utils.js'

const ARCANE_ENCHANTER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        input: 3,
        lapis: 4,
        module: 5,
        output: 6,
        xpDisplay: 11,
        upgrades: Object.freeze([8, 9, 10])
    }),
    defaults: Object.freeze({
        energyCost: 12000,
        minEnergyCost: 4000,
        seconds: 6,
        xpPerEnchantChange: 1000,
        xpType: 'xp',
        xpTankCap: 128000
    }),
    transfer: Object.freeze({
        ioIntervalTicks: 4
    }),
    enchantTargets: Object.freeze({
        levels: Object.freeze([5, 4, 3, 2, 1]),
        matrix: Object.freeze([
            Object.freeze([1, 1, 1, 0, 0]),
            Object.freeze([2, 2, 1, 0, 0]),
            Object.freeze([3, 2, 2, 1, 0]),
            Object.freeze([4, 3, 2, 2, 0]),
            Object.freeze([5, 4, 3, 2, 1])
        ]),
        modules: Object.freeze([1, 2, 3, 4, 5])
    }),
    modules: Object.freeze({
        enchantability: Object.freeze([
            'utilitycraft:enchantability_module',
            'utilitycraft:enchantability_module_2',
            'utilitycraft:enchantability_module_3',
            'utilitycraft:enchantability_module_4',
            'utilitycraft:enchantability_module_5'
        ])
    })
})

let cachedEnchantmentTypes = null

DoriosAPI.register.blockComponent('arcane_enchanter', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost)
            machine.displayEnergy(ARCANE_ENCHANTER.slots.energy)
            machine.displayProgress(ARCANE_ENCHANTER.slots.progress)
            machine.entity.setItem(ARCANE_ENCHANTER.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')
            const xpTank = getArcaneXpTank(machine, settings)
            xpTank?.display(ARCANE_ENCHANTER.slots.xpDisplay)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'arcane_enchanter:ui')

        if (tickGate(machine.entity, 'arcane_enchanter:io_cd', ARCANE_ENCHANTER.transfer.ioIntervalTicks)) {
            machine.transferItems()
            machine.pullItemsFromAbove(ARCANE_ENCHANTER.slots.input)
            machine.pullItemsFromAbove(ARCANE_ENCHANTER.slots.lapis)
            machine.pullItemsFromAbove(ARCANE_ENCHANTER.slots.module)
        }

        const input = machine.inv.getItem(ARCANE_ENCHANTER.slots.input)
        const lapis = machine.inv.getItem(ARCANE_ENCHANTER.slots.lapis)
        const module = machine.inv.getItem(ARCANE_ENCHANTER.slots.module)
        const output = machine.inv.getItem(ARCANE_ENCHANTER.slots.output)
        const moduleLevel = getEnchantabilityModuleLevel(module)
        const xpTank = getArcaneXpTank(machine, settings)
        xpTank?.display(ARCANE_ENCHANTER.slots.xpDisplay)

        if (!input) {
            showMachineWarning(machine, 'Insert Item', {
                moduleLevel,
                inputName: '—',
                targetName: '—',
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, true, shouldRefreshUi)
            return
        }

        if ((input.amount ?? 1) > 1) {
            showMachineWarning(machine, 'Split Stack', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: '—',
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, true, shouldRefreshUi)
            return
        }

        if (moduleLevel <= 0) {
            showMachineWarning(machine, 'Need Enchant Module', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: 'Insert enchantability module',
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, true, shouldRefreshUi)
            return
        }

        if (!lapis || lapis.typeId !== 'minecraft:lapis_lazuli' || lapis.amount <= 0) {
            showMachineWarning(machine, 'Need Lapis', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: '—',
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, false, shouldRefreshUi)
            return
        }

        if (output) {
            showMachineWarning(machine, 'Output Full', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: formatItemName(output.typeId),
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, false, shouldRefreshUi)
            return
        }

        const plan = buildEnchantPlan(input, moduleLevel)
        if (!plan?.ready) {
            showMachineWarning(machine, plan?.message ?? 'Invalid Item', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: plan?.targetSummary ?? '—',
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, true, shouldRefreshUi)
            return
        }

        if (!plan.changed) {
            machine.setProgress(0, ARCANE_ENCHANTER.slots.progress)
            showMachineStatus(machine, 'Already Enchanted', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: plan.targetSummary,
                energyCost: settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost,
                xpCost: 0,
                xpTankText: formatXpTankText(xpTank)
            }, shouldRefreshUi)
            return
        }

        const configuredCost = settings?.machine?.energy_cost ?? ARCANE_ENCHANTER.defaults.energyCost
        const moduleDiscount = Math.max(0.5, 1 - (moduleLevel * 0.08))
        const changeMultiplier = 1 + (Math.max(1, plan.changeCount) - 1) * 0.25
        const energyCost = Math.max(
            ARCANE_ENCHANTER.defaults.minEnergyCost,
            Math.ceil(configuredCost * moduleDiscount * changeMultiplier)
        )
        const xpCost = Math.max(1, plan.changeCount) * ARCANE_ENCHANTER.defaults.xpPerEnchantChange
        machine.setEnergyCost(energyCost)

        applyDynamicRecipeRate(machine, {
            energyCost,
            seconds: ARCANE_ENCHANTER.defaults.seconds,
            ticks: Math.round(ARCANE_ENCHANTER.defaults.seconds * 20)
        }, {
            energyCost,
            speedMultiplier: machine.boosts?.speed ?? 1
        })

        if (!xpTank || xpTank.getType() !== ARCANE_ENCHANTER.defaults.xpType) {
            showMachineWarning(machine, 'Need XP Tank', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: plan.targetSummary,
                energyCost,
                xpCost,
                xpTankText: formatXpTankText(xpTank)
            }, false, shouldRefreshUi)
            return
        }

        if (xpTank.get() < xpCost) {
            showMachineWarning(machine, 'Need XP', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: plan.targetSummary,
                energyCost,
                xpCost,
                xpTankText: formatXpTankText(xpTank)
            }, false, shouldRefreshUi)
            return
        }

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, 'No Energy', {
                moduleLevel,
                inputName: formatItemName(input.typeId),
                targetName: plan.targetSummary,
                energyCost,
                xpCost,
                xpTankText: formatXpTankText(xpTank)
            }, false, shouldRefreshUi)
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const enchanted = applyEnchantPlanToStack(input, plan)
            if (!enchanted) {
                showMachineWarning(machine, 'Enchant Failed', {
                    moduleLevel,
                    inputName: formatItemName(input.typeId),
                    targetName: plan.targetSummary,
                    energyCost,
                    xpCost,
                    xpTankText: formatXpTankText(xpTank)
                }, true, shouldRefreshUi)
                machine.setProgress(0, ARCANE_ENCHANTER.slots.progress)
                return
            }

            machine.entity.changeItemAmount(ARCANE_ENCHANTER.slots.input, -1)
            machine.entity.changeItemAmount(ARCANE_ENCHANTER.slots.lapis, -1)
            xpTank.add(-xpCost)
            machine.inv.setItem(ARCANE_ENCHANTER.slots.output, enchanted)
            machine.setProgress(0, ARCANE_ENCHANTER.slots.progress)

            showMachineStatus(machine, 'Enchanted', {
                moduleLevel,
                inputName: formatItemName(enchanted.typeId),
                targetName: plan.targetSummary,
                energyCost,
                xpCost,
                xpTankText: formatXpTankText(xpTank)
            }, shouldRefreshUi)
            return
        }

        const consumption = Math.max(1, machine.boosts?.consumption ?? 1)
        const energyToConsume = Math.min(
            machine.energy.get(),
            machine.rate,
            Math.max(0, energyCost - progress) * consumption
        )

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume)
            machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON))
        }

        showMachineStatus(machine, 'Enchanting', {
            moduleLevel,
            inputName: formatItemName(input.typeId),
            targetName: plan.targetSummary,
            energyCost,
            xpCost,
            xpTankText: formatXpTankText(xpTank)
        }, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getEnchantabilityModuleLevel(moduleStack) {
    const typeId = moduleStack?.typeId
    if (!typeId) return 0

    const index = ARCANE_ENCHANTER.modules.enchantability.indexOf(typeId)
    return index >= 0 ? index + 1 : 0
}

function buildEnchantPlan(stack, moduleLevel) {
    const enchantComp = getEnchantableComponent(stack)
    if (!enchantComp) {
        return {
            ready: false,
            message: 'Invalid Item'
        }
    }

    const current = normalizeEnchantments(extractEnchantments(stack))
    const allTypes = getAllEnchantmentTypes()
    const compatible = allTypes.filter(type => canApplyEnchantment(enchantComp, type))
    if (!compatible.length) {
        return {
            ready: false,
            message: 'Not Enchantable'
        }
    }

    const desiredCount = Math.max(1, Math.floor(moduleLevel))
    const compatibleById = new Map(
        compatible
            .map(type => [normalizeEnchantmentId(type), type])
            .filter(([id, type]) => Boolean(id && type))
    )

    const nextList = [...current]
    const nextIndexById = new Map(
        nextList
            .map((entry, index) => [normalizeEnchantmentId(entry.type), index])
            .filter(([id]) => Boolean(id))
    )

    let upgradedCount = 0
    for (const [id, index] of nextIndexById.entries()) {
        const type = compatibleById.get(id)
        if (!type) continue

        const maxLevel = Math.max(1, Number(type?.maxLevel) || 1)
        const currentLevel = Math.max(1, Number(nextList[index]?.level) || 1)
        const targetLevel = resolveModuleEnchantTarget(desiredCount, maxLevel)
        const finalLevel = Math.max(currentLevel, targetLevel)

        if (finalLevel > currentLevel) {
            upgradedCount += 1
        }

        nextList[index] = {
            type,
            level: Math.max(1, Math.min(finalLevel, maxLevel))
        }
    }

    const candidates = shuffleArray(
        compatible.filter(type => !nextIndexById.has(normalizeEnchantmentId(type)))
    )

    let addedCount = 0
    while (nextList.length < desiredCount && candidates.length > 0) {
        const type = candidates.pop()
        if (!type) continue

        const id = normalizeEnchantmentId(type)
        if (!id || nextIndexById.has(id)) continue

        const maxLevel = Math.max(1, Number(type?.maxLevel) || 1)
        const targetLevel = resolveModuleEnchantTarget(desiredCount, maxLevel)
        if (targetLevel <= 0) continue

        nextList.push({ type, level: targetLevel })
        nextIndexById.set(id, nextList.length - 1)
        addedCount += 1
    }

    const changeCount = countPlanChanges(current, nextList)
    const changed = changeCount > 0
    const targetSummary = changed
        ? `${nextList.length} enchants (${addedCount} new, ${upgradedCount} upgraded)`
        : `${nextList.length} enchants (stable)`

    return {
        ready: true,
        changed,
        changeCount,
        targetSummary,
        enchantments: nextList
    }
}

function applyEnchantPlanToStack(inputStack, plan) {
    if (!inputStack?.typeId || !Array.isArray(plan?.enchantments)) return null

    const clone = typeof inputStack.clone === 'function'
        ? inputStack.clone()
        : inputStack

    if (!applyCoreEnchantmentsToStack(clone, plan.enchantments)) return null
    return clone
}

function getAllEnchantmentTypes() {
    if (cachedEnchantmentTypes) return cachedEnchantmentTypes
    try {
        cachedEnchantmentTypes = EnchantmentTypes.getAll() ?? []
    } catch {
        cachedEnchantmentTypes = []
    }
    return cachedEnchantmentTypes
}

function normalizeEnchantments(list) {
    if (!Array.isArray(list)) return []
    return list
        .map(entry => {
            const level = Math.max(1, Math.floor(Number(entry?.level) || 0))
            if (!entry?.type || level <= 0) return null
            return {
                type: entry.type,
                level
            }
        })
        .filter(Boolean)
}

function canApplyEnchantment(enchantComp, type) {
    if (!enchantComp || !type) return false

    if (typeof enchantComp.canAddEnchantment === 'function') {
        try {
            if (enchantComp.canAddEnchantment({ type, level: 1 }) === true) return true
        } catch { }

        try {
            if (enchantComp.canAddEnchantment(type) === true) return true
        } catch { }

        return false
    }

    return true
}

function resolveModuleEnchantTarget(moduleLevel, enchantMaxLevel) {
    const levels = ARCANE_ENCHANTER.enchantTargets.levels
    const modules = ARCANE_ENCHANTER.enchantTargets.modules
    const matrix = ARCANE_ENCHANTER.enchantTargets.matrix

    const moduleKey = clampNumber(moduleLevel, 1, modules.length)
    const maxKey = clampNumber(enchantMaxLevel, 1, levels.length)
    const moduleIndex = modules.indexOf(moduleKey)
    const levelIndex = levels.indexOf(maxKey)
    if (moduleIndex < 0 || levelIndex < 0) return 0

    const target = matrix[moduleIndex]?.[levelIndex] ?? 0
    return Math.max(0, Math.min(target, maxKey))
}

function clampNumber(value, min, max) {
    const numeric = Math.floor(Number(value) || 0)
    return Math.max(min, Math.min(max, numeric))
}

function countPlanChanges(before, after) {
    const beforeMap = new Map(
        normalizeEnchantments(before)
            .map(entry => [normalizeEnchantmentId(entry.type), entry.level])
            .filter(([id]) => Boolean(id))
    )

    let changes = 0
    for (const entry of normalizeEnchantments(after)) {
        const id = normalizeEnchantmentId(entry.type)
        if (!id) continue
        const nextLevel = Math.max(1, Number(entry.level) || 1)
        const previousLevel = Number(beforeMap.get(id) ?? 0)
        if (previousLevel <= 0 || nextLevel > previousLevel) {
            changes += 1
        }
    }

    return changes
}

function shuffleArray(source) {
    const list = Array.isArray(source) ? [...source] : []
    for (let i = list.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1))
        const tmp = list[i]
        list[i] = list[randomIndex]
        list[randomIndex] = tmp
    }
    return list
}

function getArcaneXpTank(machine, settings) {
    if (!machine?.entity) return null

    const tank = FluidManager.initializeSingle(machine.entity)
    const cap = Number(settings?.machine?.fluid_cap ?? ARCANE_ENCHANTER.defaults.xpTankCap)
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap)
    }

    if (tank.getType() === 'empty') {
        tank.setType(ARCANE_ENCHANTER.defaults.xpType)
    }

    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', ARCANE_ENCHANTER.defaults.xpType)
    } catch { }

    return tank
}

function formatXpTankText(tank) {
    if (!tank) return 'N/A'
    const current = Math.max(0, Math.floor(Number(tank.get?.() ?? 0)))
    const cap = Math.max(0, Math.floor(Number(tank.getCap?.() ?? 0)))
    return `${current}/${cap}`
}

function buildLore(machine, context = {}) {
    const lines = []
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    appendLoreSection(lines, 'Machine Information', [
        {
            label: 'Input',
            value: context.inputName ?? '—'
        },
        {
            label: 'Target',
            value: context.targetName ?? '—'
        },
        {
            label: 'Module',
            value: `Lv.${context.moduleLevel ?? 0}`
        },
        {
            label: 'Cost',
            value: context.energyCost ?? ARCANE_ENCHANTER.defaults.energyCost
        },
        {
            label: 'XP Cost',
            value: context.xpCost ?? 0
        },
        {
            label: 'XP Tank',
            value: context.xpTankText ?? 'N/A'
        }
    ], {
        spacing: false
    })

    if (overclockLine) {
        appendLoreSection(lines, 'Overclock', [overclockLine])
    }

    return lines
}

function showMachineWarning(machine, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(
        message,
        resetProgress,
        buildLore(machine, context),
        {
            footerLines: [
                `Module: Lv.${context.moduleLevel ?? 0}`,
                `Cost: ${context.energyCost ?? ARCANE_ENCHANTER.defaults.energyCost}`,
                `XP: ${context.xpTankText ?? 'N/A'}`
            ],
            displayModel: 'minimal'
        }
    )
    machine.displayEnergy(ARCANE_ENCHANTER.slots.energy)
    machine.displayProgress(ARCANE_ENCHANTER.slots.progress)
}

function showMachineStatus(machine, message, context = {}, refreshUi = true) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(
        message,
        buildLore(machine, context),
        {
            footerLines: [
                `Module: Lv.${context.moduleLevel ?? 0}`,
                `Target: ${context.targetName ?? '—'}`,
                `XP: ${context.xpTankText ?? 'N/A'}`
            ],
            displayModel: 'minimal'
        }
    )
    machine.displayEnergy(ARCANE_ENCHANTER.slots.energy)
    machine.displayProgress(ARCANE_ENCHANTER.slots.progress)
}
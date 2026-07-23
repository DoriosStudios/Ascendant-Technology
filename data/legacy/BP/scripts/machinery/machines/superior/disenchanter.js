import { ItemStack, EnchantmentTypes } from '@minecraft/server'
import {
    Machine,
    FluidManager,
    appendLoreSection,
    applyEnchantmentsToStack as applyCoreEnchantmentsToStack,
    buildOverclockLoreLine,
    extractEnchantments,
    formatItemName,
    normalizeEnchantmentId,
    tickGate
} from '../../../DoriosCore/main.js'
import {
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from './utils.js'

const DISENCHANTER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        source: 4,
        catalyst: 5,
        output: 6,
        xpDisplay: 7,
        upgrades: Object.freeze([8, 9, 10, 11])
    }),
    defaults: Object.freeze({
        energyCostExtraction: 10000,
        energyCostAbsorption: 7000,
        xpCap: 128000,
        xpPerLevel: 500
    }),
    transfer: Object.freeze({
        ioIntervalTicks: 4
    }),
    modes: Object.freeze({
        extraction: Object.freeze({
            id: 'extraction',
            title: 'Extraction'
        }),
        absorption: Object.freeze({
            id: 'absorption',
            title: 'Absorption'
        })
    })
})

const MODE_LIST = Object.freeze(Object.values(DISENCHANTER.modes))

const DISENCHANTER_PANEL = Object.freeze({
    id: 'disenchanter_mode',
    namespace: 'ascendant:disenchanter',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: DISENCHANTER.modes.extraction.id
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_cycle',
            property: 'mode',
            slot: DISENCHANTER.slots.modeButton,
            type: 'cycle',
            values: Object.freeze(MODE_LIST.map(mode => mode.id)),
            defaultValue: DISENCHANTER.modes.extraction.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeLore(getMode(state.mode)),
            pressHint: 'Press to cycle disenchant profile.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => machine?.setProgress?.(0, DISENCHANTER.slots.progress)
        })
    ])
})

DoriosAPI.register.blockComponent('disenchanter', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(DISENCHANTER.defaults.energyCostExtraction)
            machine.displayEnergy(DISENCHANTER.slots.energy)
            machine.displayProgress(DISENCHANTER.slots.progress)
            machine.blockSlots([DISENCHANTER.slots.xpDisplay])

            const tank = getXpTank(machine, settings)
            tank.display(DISENCHANTER.slots.xpDisplay)
            machine.entity.setItem(DISENCHANTER.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')

            syncSuperiorButtonPanel(machine, DISENCHANTER_PANEL, {
                detectPresses: false,
                forceRender: true
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'disenchanter:ui')
        const panelState = syncSuperiorButtonPanel(machine, DISENCHANTER_PANEL, {
            forceRender: shouldRefreshUi
        })
        const mode = getMode(panelState.mode)
        const tank = getXpTank(machine, settings)

        if (tickGate(machine.entity, 'disenchanter:io_cd', DISENCHANTER.transfer.ioIntervalTicks)) {
            machine.transferItems()
            machine.pullItemsFromAbove(DISENCHANTER.slots.source)
            machine.pullItemsFromAbove(DISENCHANTER.slots.catalyst)
            tank.transferFluids(machine.block, Number(settings?.machine?.fluid_rate) || 32000, {
                relative: 'back',
                requireTube: false
            })
        }

        const source = machine.inv.getItem(DISENCHANTER.slots.source)
        const catalyst = machine.inv.getItem(DISENCHANTER.slots.catalyst)
        const output = machine.inv.getItem(DISENCHANTER.slots.output)
        const enchants = extractEnchantments(source)
        const energyCost = mode.id === DISENCHANTER.modes.absorption.id
            ? DISENCHANTER.defaults.energyCostAbsorption
            : DISENCHANTER.defaults.energyCostExtraction

        if (!source) {
            showWarning(machine, tank, 'Insert Item', {
                mode,
                energyCost,
                sourceName: '—',
                enchantCount: 0
            }, true, shouldRefreshUi)
            return
        }

        if ((source.amount ?? 1) > 1) {
            showWarning(machine, tank, 'Split Stack', {
                mode,
                energyCost,
                sourceName: formatItemName(source.typeId),
                enchantCount: enchants.length
            }, true, shouldRefreshUi)
            return
        }

        if (!Array.isArray(enchants) || enchants.length <= 0) {
            showWarning(machine, tank, 'No Enchants', {
                mode,
                energyCost,
                sourceName: formatItemName(source.typeId),
                enchantCount: 0
            }, true, shouldRefreshUi)
            return
        }

        if (mode.id === DISENCHANTER.modes.extraction.id) {
            if (!catalyst || catalyst.typeId !== 'minecraft:book' || catalyst.amount <= 0) {
                showWarning(machine, tank, 'Need Book', {
                    mode,
                    energyCost,
                    sourceName: formatItemName(source.typeId),
                    enchantCount: enchants.length
                }, false, shouldRefreshUi)
                return
            }

            if (output) {
                showWarning(machine, tank, 'Output Full', {
                    mode,
                    energyCost,
                    sourceName: formatItemName(source.typeId),
                    enchantCount: enchants.length
                }, false, shouldRefreshUi)
                return
            }
        } else {
            const xpGain = resolveXpGain(enchants)
            if (tank.getFreeSpace() < xpGain) {
                showWarning(machine, tank, 'XP Tank Full', {
                    mode,
                    energyCost,
                    sourceName: formatItemName(source.typeId),
                    enchantCount: enchants.length
                }, false, shouldRefreshUi)
                return
            }
        }

        machine.setEnergyCost(energyCost)

        if (machine.energy.get() <= 0) {
            showWarning(machine, tank, 'No Energy', {
                mode,
                energyCost,
                sourceName: formatItemName(source.typeId),
                enchantCount: enchants.length
            }, false, shouldRefreshUi)
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const result = mode.id === DISENCHANTER.modes.extraction.id
                ? applyExtraction(machine, source, enchants)
                : applyAbsorption(machine, tank, source, enchants)

            if (!result.ok) {
                showWarning(machine, tank, result.message ?? 'Failed', {
                    mode,
                    energyCost,
                    sourceName: formatItemName(source.typeId),
                    enchantCount: enchants.length
                }, true, shouldRefreshUi)
                machine.setProgress(0, DISENCHANTER.slots.progress)
                return
            }

            machine.setProgress(0, DISENCHANTER.slots.progress)
            showStatus(machine, tank, result.message ?? 'Done', {
                mode,
                energyCost,
                sourceName: formatItemName(source.typeId),
                enchantCount: Math.max(0, enchants.length - (mode.id === DISENCHANTER.modes.extraction.id ? 1 : enchants.length))
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

        showStatus(machine, tank, mode.id === DISENCHANTER.modes.extraction.id ? 'Extracting' : 'Absorbing', {
            mode,
            energyCost,
            sourceName: formatItemName(source.typeId),
            enchantCount: enchants.length
        }, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getMode(modeId) {
    return MODE_LIST.find(mode => mode.id === modeId) ?? DISENCHANTER.modes.extraction
}

function getXpTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity)
    const cap = Number(settings?.machine?.fluid_cap)
    if (tank.getCap() <= 0) {
        tank.setCap(Number.isFinite(cap) && cap > 0 ? cap : DISENCHANTER.defaults.xpCap)
    }
    if (tank.getType() === 'empty' && tank.get() <= 0) {
        tank.setType('xp')
    }
    return tank
}

function resolveXpGain(enchantments) {
    return enchantments.reduce((sum, entry) => {
        const level = Math.max(1, Number(entry?.level) || 1)
        const maxLevel = resolveEnchantmentMaxLevel(entry)
        const perLevel = resolveXpPerLevelFromMax(maxLevel)
        return sum + (level * perLevel)
    }, 0)
}

function resolveEnchantmentMaxLevel(enchantment) {
    const directMax = Number(enchantment?.type?.maxLevel)
    if (Number.isFinite(directMax) && directMax > 0) {
        return Math.floor(directMax)
    }

    const enchantmentId = normalizeEnchantmentId(enchantment?.type)
    if (enchantmentId && EnchantmentTypes?.get) {
        try {
            const resolvedType = EnchantmentTypes.get(enchantmentId)
            const resolvedMax = Number(resolvedType?.maxLevel)
            if (Number.isFinite(resolvedMax) && resolvedMax > 0) {
                return Math.floor(resolvedMax)
            }
        } catch { }
    }

    return 1
}

function resolveXpPerLevelFromMax(maxLevel) {
    const value = Math.max(1, Math.floor(Number(maxLevel) || 1))
    if (value >= 5) return 1000
    if (value === 4) return 1250
    if (value === 3) return 1666
    if (value === 2) return 2500
    return 5000
}

function applyExtraction(machine, source, enchantments) {
    const first = enchantments[0]
    if (!first?.type) {
        return { ok: false, message: 'Invalid Enchant' }
    }

    const book = new ItemStack('minecraft:enchanted_book', 1)
    const applied = applyCoreEnchantmentsToStack(book, [{
        type: first.type,
        level: Math.max(1, Number(first.level) || 1)
    }])
    if (!applied) {
        return { ok: false, message: 'Book Enchant Failed' }
    }

    const remaining = enchantments.slice(1)
    const updated = rebuildSource(source, remaining)
    if (!updated) {
        return { ok: false, message: 'Source Update Failed' }
    }

    machine.inv.setItem(DISENCHANTER.slots.source, updated)
    machine.entity.changeItemAmount(DISENCHANTER.slots.catalyst, -1)
    machine.inv.setItem(DISENCHANTER.slots.output, book)
    return { ok: true, message: 'Extracted' }
}

function applyAbsorption(machine, tank, source, enchantments) {
    const xpGain = resolveXpGain(enchantments)
    const updated = rebuildSource(source, [])
    if (!updated) {
        return { ok: false, message: 'Source Update Failed' }
    }

    machine.inv.setItem(DISENCHANTER.slots.source, updated)
    tank.add(xpGain)
    return { ok: true, message: 'Absorbed' }
}

function rebuildSource(source, remainingEnchantments) {
    const clone = typeof source?.clone === 'function' ? source.clone() : source
    if (!clone) return null

    const comp = clone.getComponent('minecraft:enchantable')
        ?? clone.getComponent('minecraft:enchantments')
        ?? clone.getComponent('enchantments')

    try {
        if (typeof comp?.removeAllEnchantments === 'function') {
            comp.removeAllEnchantments()
        } else if (typeof comp?.removeEnchantment === 'function') {
            const current = extractEnchantments(clone)
            for (const entry of current) {
                comp.removeEnchantment(entry.type)
            }
        }
    } catch {
        return null
    }

    if (remainingEnchantments.length > 0) {
        const applied = applyCoreEnchantmentsToStack(clone, remainingEnchantments.map(entry => ({
            type: entry.type,
            level: Math.max(1, Number(entry.level) || 1)
        })))
        if (!applied) {
            return null
        }
        return clone
    }

    if (clone.typeId === 'minecraft:enchanted_book') {
        return new ItemStack('minecraft:book', 1)
    }

    return clone
}

function buildModeLore(mode) {
    if (mode.id === DISENCHANTER.modes.extraction.id) {
        return [
            '§7Extract one enchantment into a book.',
            '§7Consumes: §f1x Book'
        ]
    }

    return [
        '§7Convert enchantments into XP fluid.',
        '§7No book required.'
    ]
}

function buildLore(machine, tank, context = {}) {
    const lines = []
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    appendLoreSection(lines, 'Machine Information', [
        {
            label: 'Mode',
            value: context.mode?.title ?? DISENCHANTER.modes.extraction.title
        },
        {
            label: 'Source',
            value: context.sourceName ?? '—'
        },
        {
            label: 'Enchants',
            value: context.enchantCount ?? 0
        },
        {
            label: 'Cost',
            value: context.energyCost ?? DISENCHANTER.defaults.energyCostExtraction
        },
        {
            label: 'XP Tank',
            value: `${FluidManager.formatFluid(tank.get())}/${FluidManager.formatFluid(tank.getCap())}`
        }
    ], {
        spacing: false
    })

    if (overclockLine) {
        appendLoreSection(lines, 'Overclock', [overclockLine])
    }

    return lines
}

function showWarning(machine, tank, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(
        message,
        resetProgress,
        buildLore(machine, tank, context),
        {
            footerLines: [
                `Mode: ${context.mode?.title ?? DISENCHANTER.modes.extraction.title}`,
                `Enchants: ${context.enchantCount ?? 0}`
            ],
            displayModel: 'minimal'
        }
    )
    tank.display(DISENCHANTER.slots.xpDisplay)
    machine.displayEnergy(DISENCHANTER.slots.energy)
    machine.displayProgress(DISENCHANTER.slots.progress)
}

function showStatus(machine, tank, message, context = {}, refreshUi = true) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(
        message,
        buildLore(machine, tank, context),
        {
            footerLines: [
                `Mode: ${context.mode?.title ?? DISENCHANTER.modes.extraction.title}`,
                `XP: ${FluidManager.formatFluid(tank.get())}`
            ],
            displayModel: 'minimal'
        }
    )
    tank.display(DISENCHANTER.slots.xpDisplay)
    machine.displayEnergy(DISENCHANTER.slots.energy)
    machine.displayProgress(DISENCHANTER.slots.progress)
}
import {
    Machine,
    appendLoreSection,
    buildOverclockLoreLine,
    formatItemName,
    tickGate
} from '../../../DoriosCore/main.js'
import {
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from './utils.js'

const REINFORCEMENT_ANVIL = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        input: 4,
        module: 5,
        output: 6,
        upgrades: Object.freeze([7, 8, 9])
    }),
    defaults: Object.freeze({
        energyCostRepair: 8000,
        energyCostReinforce: 14000
    }),
    transfer: Object.freeze({
        ioIntervalTicks: 4
    }),
    properties: Object.freeze({
        reinforcement: 'utilitycraft:reinforcement',
        reinforcementMax: 'utilitycraft:reinforcement_max'
    }),
    modes: Object.freeze({
        repair: Object.freeze({
            id: 'repair',
            title: 'Repair'
        }),
        reinforce: Object.freeze({
            id: 'reinforce',
            title: 'Reinforce'
        })
    }),
    moduleTargets: Object.freeze({
        'utilitycraft:reinforcement_module': 0.25,
        'utilitycraft:reinforcement_module_2': 0.5,
        'utilitycraft:reinforcement_module_3': 1,
        'utilitycraft:reinforcement_module_4': 1.5,
        'utilitycraft:reinforcement_module_5': 2
    })
})

const MODE_LIST = Object.freeze(Object.values(REINFORCEMENT_ANVIL.modes))

const ANVIL_PANEL = Object.freeze({
    id: 'reinforcement_anvil_mode',
    namespace: 'ascendant:reinforcement_anvil',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: REINFORCEMENT_ANVIL.modes.repair.id
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_cycle',
            property: 'mode',
            slot: REINFORCEMENT_ANVIL.slots.modeButton,
            type: 'cycle',
            values: Object.freeze(MODE_LIST.map(mode => mode.id)),
            defaultValue: REINFORCEMENT_ANVIL.modes.repair.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeLore(getMode(state.mode)),
            pressHint: 'Press to cycle anvil profile.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => machine?.setProgress?.(0, REINFORCEMENT_ANVIL.slots.progress)
        })
    ])
})

DoriosAPI.register.blockComponent('reinforcement_anvil', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(REINFORCEMENT_ANVIL.defaults.energyCostRepair)
            machine.displayEnergy(REINFORCEMENT_ANVIL.slots.energy)
            machine.displayProgress(REINFORCEMENT_ANVIL.slots.progress)
            machine.entity.setItem(REINFORCEMENT_ANVIL.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')

            syncSuperiorButtonPanel(machine, ANVIL_PANEL, {
                detectPresses: false,
                forceRender: true
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'reinforcement_anvil:ui')
        const panelState = syncSuperiorButtonPanel(machine, ANVIL_PANEL, {
            forceRender: shouldRefreshUi
        })
        const mode = getMode(panelState.mode)

        if (tickGate(machine.entity, 'reinforcement_anvil:io_cd', REINFORCEMENT_ANVIL.transfer.ioIntervalTicks)) {
            machine.transferItems()
            machine.pullItemsFromAbove(REINFORCEMENT_ANVIL.slots.input)
            machine.pullItemsFromAbove(REINFORCEMENT_ANVIL.slots.module)
        }

        const input = machine.inv.getItem(REINFORCEMENT_ANVIL.slots.input)
        const module = machine.inv.getItem(REINFORCEMENT_ANVIL.slots.module)
        const output = machine.inv.getItem(REINFORCEMENT_ANVIL.slots.output)
        const durability = input?.getComponent?.('minecraft:durability')

        if (!input) {
            showWarning(machine, 'Insert Item', {
                mode,
                itemName: '—',
                targetText: '—'
            }, true, shouldRefreshUi)
            return
        }

        if ((input.amount ?? 1) > 1) {
            showWarning(machine, 'Split Stack', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: '—'
            }, true, shouldRefreshUi)
            return
        }

        if (output) {
            showWarning(machine, 'Output Full', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: '—'
            }, false, shouldRefreshUi)
            return
        }

        if (!durability) {
            showWarning(machine, 'Invalid Item', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: '—'
            }, true, shouldRefreshUi)
            return
        }

        const energyCost = mode.id === REINFORCEMENT_ANVIL.modes.repair.id
            ? REINFORCEMENT_ANVIL.defaults.energyCostRepair
            : REINFORCEMENT_ANVIL.defaults.energyCostReinforce

        if (mode.id === REINFORCEMENT_ANVIL.modes.repair.id && Number(durability.damage ?? 0) <= 0) {
            showWarning(machine, 'Already Repaired', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: 'No damage',
                energyCost
            }, true, shouldRefreshUi)
            return
        }

        if (mode.id === REINFORCEMENT_ANVIL.modes.reinforce.id) {
            const target = resolveReinforcementTarget(module, durability)
            if (target <= 0) {
                showWarning(machine, 'Need Reinforce Module', {
                    mode,
                    itemName: formatItemName(input.typeId),
                    targetText: 'Install module IV/V supported',
                    energyCost
                }, true, shouldRefreshUi)
                return
            }

            const current = getReinforcement(input)
            if (current >= target) {
                showWarning(machine, 'Target Already Reached', {
                    mode,
                    itemName: formatItemName(input.typeId),
                    targetText: `${current}/${target}`,
                    energyCost
                }, true, shouldRefreshUi)
                return
            }
        }

        machine.setEnergyCost(energyCost)
        if (machine.energy.get() <= 0) {
            showWarning(machine, 'No Energy', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: '—',
                energyCost
            }, false, shouldRefreshUi)
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const result = mode.id === REINFORCEMENT_ANVIL.modes.repair.id
                ? applyRepair(input)
                : applyReinforcement(input, module)

            if (!result.ok) {
                showWarning(machine, result.message ?? 'Failed', {
                    mode,
                    itemName: formatItemName(input.typeId),
                    targetText: result.targetText ?? '—',
                    energyCost
                }, true, shouldRefreshUi)
                machine.setProgress(0, REINFORCEMENT_ANVIL.slots.progress)
                return
            }

            machine.entity.changeItemAmount(REINFORCEMENT_ANVIL.slots.input, -1)
            machine.inv.setItem(REINFORCEMENT_ANVIL.slots.output, result.stack)
            machine.setProgress(0, REINFORCEMENT_ANVIL.slots.progress)

            showStatus(machine, result.message ?? 'Completed', {
                mode,
                itemName: formatItemName(input.typeId),
                targetText: result.targetText ?? '—',
                energyCost
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

        showStatus(machine, mode.id === REINFORCEMENT_ANVIL.modes.repair.id ? 'Repairing' : 'Reinforcing', {
            mode,
            itemName: formatItemName(input.typeId),
            targetText: mode.id === REINFORCEMENT_ANVIL.modes.repair.id
                ? 'Durability restore'
                : 'Reinforcement ladder',
            energyCost
        }, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getMode(modeId) {
    return MODE_LIST.find(mode => mode.id === modeId) ?? REINFORCEMENT_ANVIL.modes.repair
}

function resolveReinforcementTarget(module, durability) {
    const ratio = REINFORCEMENT_ANVIL.moduleTargets[module?.typeId] ?? 0
    if (ratio <= 0) return 0
    const maxDurability = Number(durability?.maxDurability ?? 0)
    if (!Number.isFinite(maxDurability) || maxDurability <= 0) return 0
    return Math.max(1, Math.floor(maxDurability * ratio))
}

function getReinforcement(stack) {
    const dynamic = Number(stack?.getDynamicProperty?.(REINFORCEMENT_ANVIL.properties.reinforcement) ?? 0)
    if (Number.isFinite(dynamic) && dynamic > 0) return dynamic

    const lore = typeof stack?.getLore === 'function' ? stack.getLore() : []
    if (!Array.isArray(lore)) return 0

    for (const line of lore) {
        const match = typeof line === 'string' ? line.match(/Reinforcement:\s*(\d+)/i) : null
        if (match) return Math.max(0, Number(match[1]) || 0)
    }

    return 0
}

function applyRepair(input) {
    const stack = typeof input?.clone === 'function' ? input.clone() : input
    const durability = stack?.getComponent?.('minecraft:durability')
    if (!stack || !durability) {
        return { ok: false, message: 'Invalid Item' }
    }

    const damage = Math.max(0, Number(durability.damage) || 0)
    if (damage <= 0) {
        return { ok: false, message: 'Already Repaired' }
    }

    const repairAmount = Math.max(1, Math.floor((Number(durability.maxDurability) || 1) * 0.25))
    durability.damage = Math.max(0, damage - repairAmount)
    return {
        ok: true,
        message: 'Repaired',
        targetText: `${damage} -> ${durability.damage}`,
        stack
    }
}

function applyReinforcement(input, module) {
    const stack = typeof input?.clone === 'function' ? input.clone() : input
    const durability = stack?.getComponent?.('minecraft:durability')
    if (!stack || !durability) {
        return { ok: false, message: 'Invalid Item' }
    }

    const target = resolveReinforcementTarget(module, durability)
    if (target <= 0) {
        return { ok: false, message: 'Need Reinforce Module' }
    }

    const current = getReinforcement(stack)
    if (current >= target) {
        return { ok: false, message: 'Target Reached', targetText: `${current}/${target}` }
    }

    try {
        stack.setDynamicProperty?.(REINFORCEMENT_ANVIL.properties.reinforcement, target)
        stack.setDynamicProperty?.(REINFORCEMENT_ANVIL.properties.reinforcementMax, target)
    } catch { }

    const lore = typeof stack.getLore === 'function' ? stack.getLore() : []
    const cleaned = Array.isArray(lore)
        ? lore.filter(line => typeof line !== 'string' || !/Reinforcement:/i.test(line))
        : []
    cleaned.push(`§r§9Reinforcement: ${target} / ${target}`)
    stack.setLore?.(cleaned)

    return {
        ok: true,
        message: 'Reinforced',
        targetText: `${current} -> ${target}`,
        stack
    }
}

function buildModeLore(mode) {
    if (mode.id === REINFORCEMENT_ANVIL.modes.repair.id) {
        return [
            '§7Repairs durability with one material item.',
            '§7Focused on recovery throughput.'
        ]
    }

    return [
        '§7Applies reinforcement target from module tier.',
        '§7Supports module IV/V ladder extension.'
    ]
}

function buildLore(machine, context = {}) {
    const lines = []
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    appendLoreSection(lines, 'Machine Information', [
        {
            label: 'Mode',
            value: context.mode?.title ?? REINFORCEMENT_ANVIL.modes.repair.title
        },
        {
            label: 'Item',
            value: context.itemName ?? '—'
        },
        {
            label: 'Target',
            value: context.targetText ?? '—'
        },
        {
            label: 'Cost',
            value: context.energyCost ?? REINFORCEMENT_ANVIL.defaults.energyCostRepair
        }
    ], {
        spacing: false
    })

    if (overclockLine) {
        appendLoreSection(lines, 'Overclock', [overclockLine])
    }

    return lines
}

function showWarning(machine, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(message, resetProgress, buildLore(machine, context), {
        footerLines: [
            `Mode: ${context.mode?.title ?? REINFORCEMENT_ANVIL.modes.repair.title}`,
            `Target: ${context.targetText ?? '—'}`
        ],
        displayModel: 'minimal'
    })
    machine.displayEnergy(REINFORCEMENT_ANVIL.slots.energy)
    machine.displayProgress(REINFORCEMENT_ANVIL.slots.progress)
}

function showStatus(machine, message, context = {}, refreshUi = true) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(message, buildLore(machine, context), {
        footerLines: [
            `Mode: ${context.mode?.title ?? REINFORCEMENT_ANVIL.modes.repair.title}`,
            `Item: ${context.itemName ?? '—'}`
        ],
        displayModel: 'minimal'
    })
    machine.displayEnergy(REINFORCEMENT_ANVIL.slots.energy)
    machine.displayProgress(REINFORCEMENT_ANVIL.slots.progress)
}
import {
    Machine,
    FluidManager,
    buildOverclockLoreLine,
    appendLoreSection,
    tickGate
} from '../../../DoriosCore/main.js'
import {
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from './utils.js'

const CRYOFLUID_SYNTHESIZER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        titaniumInputs: Object.freeze([4, 5, 6, 7]),
        lapisInputs: Object.freeze([8, 9, 10, 11]),
        allInputs: Object.freeze([4, 5, 6, 7, 8, 9, 10, 11]),
        waterDisplay: 12,
        cryofluidDisplay: 13,
        upgrades: Object.freeze([14, 15, 16, 17])
    }),
    defaults: Object.freeze({
        energyCost: 6000,
        fluidCap: 128000
    }),
    transfer: Object.freeze({
        ioIntervalTicks: 4
    }),
    modes: Object.freeze({
        stable: Object.freeze({
            id: 'stable',
            title: 'Stable',
            energyCost: 6000,
            outputMb: 1000,
            titaniumCost: 1,
            lapisCost: 1,
            waterCostMb: 1000,
            ignoreSpeed: false,
            speedLocked: false
        }),
        impulse: Object.freeze({
            id: 'impulse',
            title: 'Impulse',
            energyCost: 18000,
            outputMb: 4000,
            titaniumCost: 4,
            lapisCost: 2,
            waterCostMb: 4000,
            ignoreSpeed: true,
            speedLocked: true
        })
    })
})

const MODE_LIST = Object.freeze(Object.values(CRYOFLUID_SYNTHESIZER.modes))

const CRYOFLUID_PANEL = Object.freeze({
    id: 'cryofluid_synthesizer_mode',
    namespace: 'ascendant:cryofluid_synthesizer',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: CRYOFLUID_SYNTHESIZER.modes.stable.id
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_cycle',
            property: 'mode',
            slot: CRYOFLUID_SYNTHESIZER.slots.modeButton,
            type: 'cycle',
            values: Object.freeze(MODE_LIST.map(mode => mode.id)),
            defaultValue: CRYOFLUID_SYNTHESIZER.modes.stable.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeLore(getMode(state.mode)),
            pressHint: 'Press to cycle synthesis profile.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, CRYOFLUID_SYNTHESIZER.slots.progress)
            }
        })
    ])
})

DoriosAPI.register.blockComponent('cryofluid_synthesizer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings?.machine?.energy_cost ?? CRYOFLUID_SYNTHESIZER.defaults.energyCost)
            machine.displayEnergy(CRYOFLUID_SYNTHESIZER.slots.energy)
            machine.displayProgress(CRYOFLUID_SYNTHESIZER.slots.progress)
            machine.blockSlots([CRYOFLUID_SYNTHESIZER.slots.waterDisplay, CRYOFLUID_SYNTHESIZER.slots.cryofluidDisplay])

            const { waterTank, cryofluidTank } = getCryofluidTanks(machine, settings)
            waterTank.display(CRYOFLUID_SYNTHESIZER.slots.waterDisplay)
            cryofluidTank.display(CRYOFLUID_SYNTHESIZER.slots.cryofluidDisplay)
            machine.entity.setItem(CRYOFLUID_SYNTHESIZER.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')

            syncSuperiorButtonPanel(machine, CRYOFLUID_PANEL, {
                detectPresses: false,
                forceRender: true
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const { waterTank, cryofluidTank } = getCryofluidTanks(machine, settings)
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'cryofluid_synthesizer:ui')
        const panelState = syncSuperiorButtonPanel(machine, CRYOFLUID_PANEL, {
            forceRender: shouldRefreshUi
        })
        const mode = getMode(panelState.mode)

        if (tickGate(machine.entity, 'cryofluid_synth:io_cd', CRYOFLUID_SYNTHESIZER.transfer.ioIntervalTicks)) {
            machine.transferItems()
            for (const slot of CRYOFLUID_SYNTHESIZER.slots.allInputs) {
                machine.pullItemsFromAbove(slot)
            }
            waterTank.transferFluids(machine.block, Number(settings?.machine?.fluid_rate) || 64000, {
                relative: 'back',
                requireTube: false
            })
            cryofluidTank.transferFluids(machine.block, Number(settings?.machine?.fluid_rate) || 64000, {
                relative: 'front',
                requireTube: false
            })
        }

        const catalystAmount = sumItemsInSlots(machine.inv, CRYOFLUID_SYNTHESIZER.slots.titaniumInputs, isTitaniumInput)
        const lapisAmount = sumItemsInSlots(machine.inv, CRYOFLUID_SYNTHESIZER.slots.lapisInputs, isLapisInput)
        const inputReady = catalystAmount >= mode.titaniumCost && lapisAmount >= mode.lapisCost
        const hasWater = waterTank.getType() === 'water' && waterTank.get() >= mode.waterCostMb

        const hasTankSpace = cryofluidTank.getFreeSpace() >= mode.outputMb
        if (!inputReady) {
            showMachineWarning(machine, waterTank, cryofluidTank, 'Need Titanium + Lapis', {
                mode,
                energyCost: mode.energyCost,
                outputMb: mode.outputMb,
                waterCostMb: mode.waterCostMb,
                titaniumCost: mode.titaniumCost,
                lapisCost: mode.lapisCost,
                inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
            }, true, shouldRefreshUi)
            return
        }

        if (!hasWater) {
            showMachineWarning(machine, waterTank, cryofluidTank, 'Need Water', {
                mode,
                energyCost: mode.energyCost,
                outputMb: mode.outputMb,
                waterCostMb: mode.waterCostMb,
                titaniumCost: mode.titaniumCost,
                lapisCost: mode.lapisCost,
                inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
            }, false, shouldRefreshUi)
            return
        }

        if (!hasTankSpace) {
            showMachineWarning(machine, waterTank, cryofluidTank, 'Tank Full', {
                mode,
                energyCost: mode.energyCost,
                outputMb: mode.outputMb,
                waterCostMb: mode.waterCostMb,
                titaniumCost: mode.titaniumCost,
                lapisCost: mode.lapisCost,
                inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
            }, false, shouldRefreshUi)
            return
        }

        machine.setEnergyCost(mode.energyCost)

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, waterTank, cryofluidTank, 'No Energy', {
                mode,
                energyCost: mode.energyCost,
                outputMb: mode.outputMb,
                waterCostMb: mode.waterCostMb,
                titaniumCost: mode.titaniumCost,
                lapisCost: mode.lapisCost,
                inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
            }, false, shouldRefreshUi)
            return
        }

        const progress = machine.getProgress()
        if (progress >= mode.energyCost) {
            consumeItemsFromSlots(machine, CRYOFLUID_SYNTHESIZER.slots.titaniumInputs, isTitaniumInput, mode.titaniumCost)
            consumeItemsFromSlots(machine, CRYOFLUID_SYNTHESIZER.slots.lapisInputs, isLapisInput, mode.lapisCost)
            waterTank.consume(mode.waterCostMb)
            if (waterTank.get() <= 0) {
                waterTank.setType('empty')
            }
            if (cryofluidTank.getType() === 'empty') {
                cryofluidTank.setType('cryofluid')
            }
            cryofluidTank.add(mode.outputMb)
            machine.setProgress(0, CRYOFLUID_SYNTHESIZER.slots.progress)

            showMachineStatus(machine, waterTank, cryofluidTank, 'Synthesized', {
                mode,
                energyCost: mode.energyCost,
                outputMb: mode.outputMb,
                waterCostMb: mode.waterCostMb,
                titaniumCost: mode.titaniumCost,
                lapisCost: mode.lapisCost,
                inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
            }, shouldRefreshUi)
            return
        }

        const consumption = Math.max(1, machine.boosts?.consumption ?? 1)
        const activeRate = mode.ignoreSpeed === true
            ? Math.max(1, Number(machine.baseRate) || Number(machine.rate) || 1)
            : Math.max(1, Number(machine.rate) || 1)

        const energyToConsume = Math.min(
            machine.energy.get(),
            activeRate,
            Math.max(0, mode.energyCost - progress) * consumption
        )

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume)
            machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON))
        }

        showMachineStatus(machine, waterTank, cryofluidTank, 'Synthesizing', {
            mode,
            energyCost: mode.energyCost,
            outputMb: mode.outputMb,
            waterCostMb: mode.waterCostMb,
            titaniumCost: mode.titaniumCost,
            lapisCost: mode.lapisCost,
            inputName: `Titanium (${catalystAmount}) + Lapis (${lapisAmount})`
        }, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getCryofluidTanks(machine, settings) {
    const [waterTank, cryofluidTank] = FluidManager.initializeMultiple(machine.entity, 2)
    const configuredCap = Number(settings?.machine?.fluid_cap)
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : CRYOFLUID_SYNTHESIZER.defaults.fluidCap

    if (waterTank.getCap() <= 0) {
        waterTank.setCap(cap)
    }
    if (cryofluidTank.getCap() <= 0) {
        cryofluidTank.setCap(cap)
    }

    if (waterTank.getType() === 'empty' && waterTank.get() <= 0) {
        waterTank.setType('water')
    }
    if (cryofluidTank.getType() === 'empty' && cryofluidTank.get() > 0) {
        cryofluidTank.setType('cryofluid')
    }

    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', 'water,cryofluid')
    } catch { }

    return { waterTank, cryofluidTank }
}

function sumItemsInSlots(inv, slots, predicate) {
    let total = 0
    for (const slot of slots) {
        const stack = inv.getItem(slot)
        if (!predicate?.(stack)) continue
        total += Math.max(0, Number(stack.amount) || 0)
    }
    return total
}

function consumeItemsFromSlots(machine, slots, predicate, requiredAmount) {
    let remaining = Math.max(0, Number(requiredAmount) || 0)
    if (remaining <= 0) return

    for (const slot of slots) {
        if (remaining <= 0) break
        const stack = machine.inv.getItem(slot)
        if (!predicate?.(stack)) continue

        const stackAmount = Math.max(0, Number(stack.amount) || 0)
        if (stackAmount <= 0) continue

        const toConsume = Math.min(stackAmount, remaining)
        machine.entity.changeItemAmount(slot, -toConsume)
        remaining -= toConsume
    }
}

function getMode(modeId) {
    return MODE_LIST.find(mode => mode.id === modeId) ?? CRYOFLUID_SYNTHESIZER.modes.stable
}

function isTitaniumInput(stack) {
    if (!stack?.typeId) return false
    return stack.typeId === 'utilitycraft:titanium' || stack.typeId === 'utilitycraft:raw_titanium'
}

function isLapisInput(stack) {
    return stack?.typeId === 'minecraft:lapis_lazuli'
}

function buildModeLore(mode) {
    return [
        `§7Output: §f${FluidManager.formatFluid(mode.outputMb)} Cryofluid`,
        `§7Water: §f${FluidManager.formatFluid(mode.waterCostMb)}`,
        `§7Input: §f${mode.titaniumCost} Titanium + ${mode.lapisCost} Lapis`,
        `§7Energy: §f${mode.energyCost}`,
        mode.speedLocked ? '§7Impulse ignores speed boosts.' : '§7Stable scales with speed boosts.'
    ]
}

function buildLore(machine, waterTank, cryofluidTank, context = {}) {
    const lines = []
    const mode = context.mode ?? CRYOFLUID_SYNTHESIZER.modes.stable
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    appendLoreSection(lines, 'Machine Information', [
        {
            label: 'Mode',
            value: mode.title
        },
        {
            label: 'Input',
            value: context.inputName ?? '—'
        },
        {
            label: 'Cost',
            value: context.energyCost ?? mode.energyCost
        },
        {
            label: 'Output',
            value: `${FluidManager.formatFluid(context.outputMb ?? mode.outputMb)} Cryofluid`
        },
        {
            label: 'Water',
            value: `${FluidManager.formatFluid(waterTank?.get?.() ?? 0)}/${FluidManager.formatFluid(waterTank?.getCap?.() ?? 0)}`
        },
        {
            label: 'Cryofluid',
            value: `${FluidManager.formatFluid(cryofluidTank?.get?.() ?? 0)}/${FluidManager.formatFluid(cryofluidTank?.getCap?.() ?? 0)}`
        }
    ], {
        spacing: false
    })

    if (overclockLine) {
        appendLoreSection(lines, 'Overclock', [overclockLine])
    }

    return lines
}

function showMachineWarning(machine, waterTank, cryofluidTank, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(
        message,
        resetProgress,
        buildLore(machine, waterTank, cryofluidTank, context),
        {
            footerLines: [
                `Mode: ${context.mode?.title ?? 'Stable'}`,
                `Water: ${FluidManager.formatFluid(context.waterCostMb ?? 0)}`
            ],
            displayModel: 'minimal'
        }
    )
    waterTank.display(CRYOFLUID_SYNTHESIZER.slots.waterDisplay)
    cryofluidTank.display(CRYOFLUID_SYNTHESIZER.slots.cryofluidDisplay)
    machine.displayEnergy(CRYOFLUID_SYNTHESIZER.slots.energy)
    machine.displayProgress(CRYOFLUID_SYNTHESIZER.slots.progress)
}

function showMachineStatus(machine, waterTank, cryofluidTank, message, context = {}, refreshUi = true) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(
        message,
        buildLore(machine, waterTank, cryofluidTank, context),
        {
            footerLines: [
                `Mode: ${context.mode?.title ?? 'Stable'}`,
                `Input: ${context.inputName ?? '—'}`
            ],
            displayModel: 'minimal'
        }
    )
    waterTank.display(CRYOFLUID_SYNTHESIZER.slots.waterDisplay)
    cryofluidTank.display(CRYOFLUID_SYNTHESIZER.slots.cryofluidDisplay)
    machine.displayEnergy(CRYOFLUID_SYNTHESIZER.slots.energy)
    machine.displayProgress(CRYOFLUID_SYNTHESIZER.slots.progress)
}
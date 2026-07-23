import {
    Machine,
    Energy,
    FluidManager,
    appendLoreSection,
    buildOverclockLoreLine,
    formatItemName,
    tickGate
} from '../../../DoriosCore/main.js'
import { shouldRefreshSuperiorUi } from './utils.js'

const MAGMATIC_CHAMBER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5, 6, 7, 8]),
        output: 9,
        upgrades: Object.freeze([10, 11, 12, 13]),
        fluidDisplay: 15
    }),
    defaults: Object.freeze({
        tankCap: 128000,
        ioIntervalTicks: 4
    }),
    fluids: Object.freeze({
        type: 'lava'
    })
})

const RECIPES = Object.freeze([
    Object.freeze({
        input: Object.freeze({ id: 'minecraft:cobblestone', amount: 1 }),
        output: Object.freeze({ id: 'minecraft:stone', amount: 1 }),
        energyCost: 4000,
        lavaGain: 400
    }),
    Object.freeze({
        input: Object.freeze({ id: 'minecraft:sand', amount: 1 }),
        output: Object.freeze({ id: 'minecraft:glass', amount: 1 }),
        energyCost: 4800,
        lavaGain: 500
    }),
    Object.freeze({
        input: Object.freeze({ id: 'minecraft:clay_ball', amount: 4 }),
        output: Object.freeze({ id: 'minecraft:brick', amount: 4 }),
        energyCost: 5200,
        lavaGain: 650
    })
])

DoriosAPI.register.blockComponent('magmatic_reactor_chamber', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(4000)
            machine.displayEnergy(MAGMATIC_CHAMBER.slots.energy)
            machine.displayProgress(MAGMATIC_CHAMBER.slots.progress)
            machine.entity.setItem(MAGMATIC_CHAMBER.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')

            const tank = getLavaTank(machine, settings)
            tank?.display(MAGMATIC_CHAMBER.slots.fluidDisplay)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'magmatic_reactor_chamber:ui')
        const tank = getLavaTank(machine, settings)

        if (tickGate(machine.entity, 'magmatic:io_cd', MAGMATIC_CHAMBER.defaults.ioIntervalTicks)) {
            transferOutputToFacing(machine)
            for (const inputSlot of MAGMATIC_CHAMBER.slots.inputs) {
                machine.pullItemsFromAbove(inputSlot)
            }
        }

        const candidate = findRecipeCandidate(machine)
        if (!candidate) {
            showWarning(machine, 'Insert Process Item', {
                recipe: null,
                lava: tank?.get() ?? 0,
                lavaCap: tank?.getCap() ?? 0,
                lavaGain: 0,
                inputName: '—'
            }, true, shouldRefreshUi, tank)
            machine.off()
            return
        }

        const { slot: recipeSlot, recipe, stack } = candidate

        if (!canOutput(machine, recipe.output.id, recipe.output.amount)) {
            showWarning(machine, 'Output Full', {
                recipe,
                lava: tank?.get() ?? 0,
                lavaCap: tank?.getCap() ?? 0,
                lavaGain: recipe.lavaGain ?? 0,
                inputName: formatItemName(stack.typeId)
            }, false, shouldRefreshUi, tank)
            machine.off()
            return
        }

        const energyCost = Math.max(1, Math.ceil(recipe.energyCost))
        const lavaGain = Math.max(0, Math.floor(recipe.lavaGain ?? 0))
        machine.setEnergyCost(energyCost)

        if (tank.getFreeSpace() < lavaGain) {
            showWarning(machine, 'Lava Tank Full', {
                recipe,
                lava: tank?.get() ?? 0,
                lavaCap: tank?.getCap() ?? 0,
                lavaGain,
                inputName: formatItemName(stack.typeId),
                energyCost
            }, false, shouldRefreshUi, tank)
            machine.off()
            return
        }

        if (machine.energy.get() <= 0) {
            showWarning(machine, 'No Energy', {
                recipe,
                energyCost,
                lava: tank?.get() ?? 0,
                lavaCap: tank?.getCap() ?? 0,
                lavaGain,
                inputName: formatItemName(stack.typeId)
            }, false, shouldRefreshUi, tank)
            machine.off()
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            machine.entity.changeItemAmount(recipeSlot, -recipe.input.amount)
            insertOutput(machine, recipe.output.id, recipe.output.amount)
            if (tank.getType() === 'empty') {
                tank.setType(MAGMATIC_CHAMBER.fluids.type)
            }
            tank.add(lavaGain)
            machine.setProgress(0, MAGMATIC_CHAMBER.slots.progress)

            showStatus(machine, 'Processed', {
                recipe,
                energyCost,
                lava: tank?.get() ?? 0,
                lavaCap: tank?.getCap() ?? 0,
                lavaGain,
                inputName: formatItemName(stack.typeId)
            }, shouldRefreshUi, tank)
            machine.on()
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

        showStatus(machine, 'Processing', {
            recipe,
            energyCost,
            lava: tank?.get() ?? 0,
            lavaCap: tank?.getCap() ?? 0,
            lavaGain,
            inputName: formatItemName(stack.typeId)
        }, shouldRefreshUi, tank)
        machine.on()
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function matchRecipe(stack) {
    if (!stack?.typeId) return null
    return RECIPES.find(recipe => stack.typeId === recipe.input.id && stack.amount >= recipe.input.amount) ?? null
}

function findRecipeCandidate(machine) {
    for (const slot of MAGMATIC_CHAMBER.slots.inputs) {
        const stack = machine.inv.getItem(slot)
        const recipe = matchRecipe(stack)
        if (!recipe) continue
        return { slot, stack, recipe }
    }

    return null
}

function canOutput(machine, itemId, amount) {
    const output = machine.inv.getItem(MAGMATIC_CHAMBER.slots.output)
    if (!output) return true
    if (output.typeId !== itemId) return false
    const max = output.maxAmount ?? 64
    return (output.amount + amount) <= max
}

function insertOutput(machine, itemId, amount) {
    const output = machine.inv.getItem(MAGMATIC_CHAMBER.slots.output)
    if (!output) {
        machine.entity.setItem(MAGMATIC_CHAMBER.slots.output, itemId, amount)
        return
    }

    machine.entity.changeItemAmount(MAGMATIC_CHAMBER.slots.output, amount)
}

function getLavaTank(machine, settings) {
    if (!machine?.entity) return null

    const tank = FluidManager.initializeSingle(machine.entity)
    const cap = Number(settings?.machine?.fluid_cap ?? MAGMATIC_CHAMBER.defaults.tankCap)
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap)
    }

    try {
        machine.entity.setDynamicProperty('dorios:fluid_whitelist', MAGMATIC_CHAMBER.fluids.type)
    } catch { }

    return tank
}

function transferOutputToFacing(machine) {
    const facing = machine.block.getState('utilitycraft:axis')
    if (!facing) return false

    const offsetByFacing = {
        east: [-1, 0, 0],
        west: [1, 0, 0],
        north: [0, 0, 1],
        south: [0, 0, -1],
        up: [0, -1, 0],
        down: [0, 1, 0]
    }

    const offset = offsetByFacing[facing]
    if (!offset) return false

    const before = machine.inv.getItem(MAGMATIC_CHAMBER.slots.output)
    const beforeSignature = before ? `${before.typeId}:${before.amount}` : ''

    const targetLoc = {
        x: machine.block.location.x + offset[0],
        y: machine.block.location.y + offset[1],
        z: machine.block.location.z + offset[2]
    }

    DoriosAPI.containers.transferItemsAt(
        machine.inv,
        targetLoc,
        machine.dim,
        [MAGMATIC_CHAMBER.slots.output, MAGMATIC_CHAMBER.slots.output]
    )

    const after = machine.inv.getItem(MAGMATIC_CHAMBER.slots.output)
    const afterSignature = after ? `${after.typeId}:${after.amount}` : ''
    return beforeSignature !== afterSignature
}

function buildLore(machine, context = {}) {
    const lines = []
    const recipe = context.recipe
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    appendLoreSection(lines, 'Reactor Core', [
        {
            label: 'Input',
            value: context.inputName ?? '—'
        },
        {
            label: 'Recipe',
            value: recipe ? `${formatItemName(recipe.input.id)} -> ${formatItemName(recipe.output.id)}` : '—'
        },
        {
            label: 'Lava Gain',
            value: `${Math.floor(context.lavaGain ?? 0)} mB`
        },
        {
            label: 'Lava Tank',
            value: `${FluidManager.formatFluid(context.lava ?? 0)}/${FluidManager.formatFluid(context.lavaCap ?? 0)}`
        },
        {
            label: 'Energy Cost',
            value: Energy.formatEnergyToText(context.energyCost ?? 0)
        }
    ], {
        spacing: false
    })

    if (overclockLine) {
        appendLoreSection(lines, 'Overclock', [overclockLine])
    }

    return lines
}

function showWarning(machine, message, context = {}, resetProgress = true, refreshUi = true, tank = null) {
    tank?.display(MAGMATIC_CHAMBER.slots.fluidDisplay)
    if (!refreshUi) return
    machine.showWarning(message, resetProgress, buildLore(machine, context), {
        footerLines: [
            `Lava: ${Math.floor(context.lava ?? 0)} mB`,
            `Gain: ${Math.floor(context.lavaGain ?? 0)} mB`
        ],
        displayModel: 'minimal'
    })
    machine.displayEnergy(MAGMATIC_CHAMBER.slots.energy)
    machine.displayProgress(MAGMATIC_CHAMBER.slots.progress)
}

function showStatus(machine, message, context = {}, refreshUi = true, tank = null) {
    tank?.display(MAGMATIC_CHAMBER.slots.fluidDisplay)
    if (!refreshUi) return
    machine.showStatus(message, buildLore(machine, context), {
        footerLines: [
            `Lava: ${Math.floor(context.lava ?? 0)} mB`,
            `Input: ${context.inputName ?? '—'}`
        ],
        displayModel: 'minimal'
    })
    machine.displayEnergy(MAGMATIC_CHAMBER.slots.energy)
    machine.displayProgress(MAGMATIC_CHAMBER.slots.progress)
}
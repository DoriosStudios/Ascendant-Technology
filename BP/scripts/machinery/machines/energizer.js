import { Machine, Energy } from '../managers_extra.js'
import { getEnergizerRecipes } from '../../config/recipes/energizer.js'

const INPUT_SLOTS = [3, 4]
const OUTPUT_SLOT = 19
const STATUS_SLOT = 1
const SLOT_TITLES = {
    3: 'Primary',
    4: 'Auxiliary'
}

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (STATUS_SLOT).
- [3] Input primário (INPUT_SLOTS[0]).
- [4] Input auxiliar (INPUT_SLOTS[1]).
- [6,7] Slots de upgrades (conforme settings.machine.upgrades).
- [19] Saída (OUTPUT_SLOT).
Slots escondidos: [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] (preenchimento/UI, não utilizáveis pelo jogador).
*/

DoriosAPI.register.blockComponent('energizer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            const defaultCost = settings?.machine?.energy_cost ?? 9600
            machine.setEnergyCost(defaultCost)
            machine.displayEnergy()
            machine.displayProgress()
            machine.entity.setItem(STATUS_SLOT, 'utilitycraft:arrow_indicator_90', 1, '')
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const { block } = e
        const machine = new Machine(block, settings)
        if (!machine.valid) return

        machine.transferItems()

        const recipes = resolveRecipes(block, settings)
        if (!recipes.length) {
            machine.showWarning('No Recipes')
            return
        }

        const channel = pickActiveChannel(machine.inv, recipes)
        if (!channel.stack) {
            machine.showWarning('Insert Item')
            return
        }

        if (!channel.recipe) {
            machine.showWarning(`${slotTitle(channel.slot)} Input Invalid`)
            return
        }

        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false)
            return
        }

        const outputSlot = machine.inv.getItem(OUTPUT_SLOT)
        const expectedId = channel.recipe.output.id
        if (outputSlot && outputSlot.typeId !== expectedId) {
            machine.showWarning('Output Conflict')
            return
        }

        const maxCrafts = computeMaxCrafts(channel, outputSlot)
        if (maxCrafts <= 0) {
            const capacity = getOutputCapacity(outputSlot, channel.recipe.output.amount)
            if (capacity <= 0) {
                machine.showWarning('Output Full', false)
            } else {
                machine.showWarning('Missing Items')
            }
            return
        }

        const energyCost = channel.recipe.energyCost ?? settings.machine.energy_cost ?? 9600
        machine.setEnergyCost(energyCost)

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const crafts = Math.min(maxCrafts, Math.floor(progress / energyCost))
            if (crafts > 0) {
                processCraft(machine, channel, crafts)
                machine.addProgress(-(crafts * energyCost))
            }
        } else {
            const consumption = machine.boosts.consumption
            const needed = energyCost - progress
            const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption)
            if (spendable > 0) {
                machine.energy.consume(spendable)
                machine.addProgress(spendable / Math.max(consumption, Number.EPSILON))
            }
        }

        updateHud(machine, channel)
        machine.displayEnergy()
        machine.displayProgress()
        machine.on()
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function resolveRecipes(block, settings) {
    const component = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params
    if (component?.type === 'energizer') return getEnergizerRecipes()
    if (Array.isArray(component)) return component
    if (Array.isArray(settings?.machine?.recipes)) return settings.machine.recipes
    return getEnergizerRecipes()
}

function pickActiveChannel(inv, recipes) {
    let fallback = null
    for (const slot of INPUT_SLOTS) {
        const stack = inv.getItem(slot)
        if (!stack) continue
        if (!fallback) fallback = { slot, stack }
        const recipe = matchRecipe(recipes, stack)
        if (recipe) return { slot, stack, recipe }
    }
    if (fallback) return { ...fallback, recipe: null }
    return { slot: null, stack: null, recipe: null }
}

function matchRecipe(recipes, stack) {
    if (!stack) return null
    return recipes.find(recipe => recipe?.input?.id === stack.typeId && stack.amount >= (recipe.input.amount ?? 1)) ?? null
}

function computeMaxCrafts(channel, outputSlot) {
    const inputPer = channel.recipe.input.amount ?? 1
    const outputPer = channel.recipe.output.amount ?? 1
    const inputCrafts = Math.floor(channel.stack.amount / inputPer)
    const outputCrafts = getOutputCapacity(outputSlot, outputPer)
    return Math.max(0, Math.min(inputCrafts, outputCrafts))
}

function getOutputCapacity(slot, perCraft) {
    const space = slot ? (slot.maxAmount ?? 64) - slot.amount : 64
    if (space <= 0) return 0
    return Math.floor(space / Math.max(1, perCraft))
}

function processCraft(machine, channel, crafts) {
    const totalInput = (channel.recipe.input.amount ?? 1) * crafts
    machine.entity.changeItemAmount(channel.slot, -totalInput)

    const totalOutput = (channel.recipe.output.amount ?? 1) * crafts
    const existing = machine.inv.getItem(OUTPUT_SLOT)
    if (!existing) {
        machine.entity.setItem(OUTPUT_SLOT, channel.recipe.output.id, totalOutput)
    } else {
        machine.entity.changeItemAmount(OUTPUT_SLOT, totalOutput)
    }
}

function updateHud(machine, channel) {
    const recipe = channel.recipe
    const slotName = slotTitle(channel.slot)
    const costText = Energy.formatEnergyToText(machine.getEnergyCost())
    const inputName = formatName(recipe.input.id)
    const outputName = formatName(recipe.output.id)
    const desc = recipe.description ? `\n§7${recipe.description}` : ''

    machine.setLabel({
        title: `§6${slotName} Channel`,
        lore: [
            `§bInput: §f${inputName}`,
            `§dOutput: §f${outputName}`,
            `§cCost: §f${costText}`,
            `§7Cycle: §f${recipe.seconds}s`
        ],
        description: desc ? desc : undefined
    })
}

function slotTitle(slot) {
    return SLOT_TITLES[slot] ?? 'Primary'
}

function formatName(id) {
    const [, raw = id] = id.split(':')
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

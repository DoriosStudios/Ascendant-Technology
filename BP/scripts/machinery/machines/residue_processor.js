import { Machine, Energy } from '../managers_extra.js'
import { getResidueProcessorRecipes } from '../../config/recipes/residue_processor.js'

const INPUT_SLOT = 3
const OUTPUT_SLOT = 19
const BYPRODUCT_SLOT = 18
const STATUS_SLOT = 1

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (STATUS_SLOT).
- [3] Input de resíduo (INPUT_SLOT).
- [18] Saída de resíduo secundário (BYPRODUCT_SLOT).
- [19] Saída principal (OUTPUT_SLOT).
- [6,7] Espaços livres/atualizações conforme UI (não escondidos).
Slots escondidos: [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] (preenchimento/UI, não utilizáveis pelo jogador).
*/

DoriosAPI.register.blockComponent('residue_processor', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            const defaultCost = settings?.machine?.energy_cost ?? 5200
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

        if (tickGate(machine.entity, 'rp:items_cd', 4)) {
            machine.transferItems()
        }

        const recipes = resolveRecipes(block, settings)
        if (!recipes.length) {
            machine.showWarning('No Recipes')
            return
        }

        const inputStack = machine.inv.getItem(INPUT_SLOT)
        if (!inputStack) {
            machine.showWarning('Insert Residue')
            return
        }

        const recipe = matchRecipe(recipes, inputStack)
        if (!recipe) {
            machine.showWarning('Invalid Input')
            return
        }

        const outputSlot = machine.inv.getItem(OUTPUT_SLOT)
        if (outputSlot && outputSlot.typeId !== recipe.output.id) {
            machine.showWarning('Output Conflict')
            return
        }

        const byproductSlot = machine.inv.getItem(BYPRODUCT_SLOT)
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            machine.showWarning('Residue Slot Busy')
            return
        }

        const crafts = computeMaxCrafts(recipe, inputStack, outputSlot, byproductSlot)
        if (crafts.max <= 0) {
            machine.showWarning(crafts.reason ?? 'Missing Items')
            return
        }

        const energyCost = recipe.energyCost ?? settings.machine.energy_cost ?? 5200
        machine.setEnergyCost(energyCost)

        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false)
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const craftRuns = Math.min(crafts.max, Math.floor(progress / energyCost))
            if (craftRuns > 0) {
                processCraft(machine, recipe, craftRuns)
                machine.addProgress(-(craftRuns * energyCost))
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

        updateHud(machine, recipe, crafts.max)
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
    if (component?.type === 'residue_processor') return getResidueProcessorRecipes()
    if (Array.isArray(component)) return component
    if (Array.isArray(settings?.machine?.recipes)) return settings.machine.recipes
    return getResidueProcessorRecipes()
}

function matchRecipe(recipes, stack) {
    return recipes.find(recipe => recipe.input?.id === stack.typeId && stack.amount >= (recipe.input.amount ?? 1))
}

function computeMaxCrafts(recipe, inputSlot, outputSlot, byproductSlot) {
    const inputPer = Math.max(1, recipe.input.amount ?? 1)
    const outputPer = Math.max(1, recipe.output.amount ?? 1)

    const availableInput = Math.floor(inputSlot.amount / inputPer)
    const outputSpace = getOutputCapacity(outputSlot, outputPer)

    let byproductSpace = Number.MAX_SAFE_INTEGER
    if (recipe.byproduct) {
        const bpAmount = Math.max(1, recipe.byproduct.amount ?? 1)
        if (!byproductSlot) {
            byproductSpace = Math.floor(64 / bpAmount)
        } else if (byproductSlot.typeId === recipe.byproduct.id) {
            const free = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount
            byproductSpace = Math.floor(free / bpAmount)
        } else {
            return { max: 0, reason: 'Residue Slot Busy' }
        }
    }

    const max = Math.min(availableInput, outputSpace, byproductSpace)
    if (max <= 0) {
        if (availableInput <= 0) return { max: 0, reason: 'Missing Items' }
        if (outputSpace <= 0) return { max: 0, reason: 'Output Full' }
        if (byproductSpace <= 0) return { max: 0, reason: 'Residue Full' }
    }

    return { max }
}

function getOutputCapacity(slot, perCraft) {
    const space = slot ? (slot.maxAmount ?? 64) - slot.amount : 64
    if (space <= 0) return 0
    return Math.floor(space / Math.max(1, perCraft))
}

function processCraft(machine, recipe, crafts) {
    const inputPer = Math.max(1, recipe.input.amount ?? 1)
    const totalInput = inputPer * crafts
    machine.entity.changeItemAmount(INPUT_SLOT, -totalInput)

    const outputPer = Math.max(1, recipe.output.amount ?? 1)
    const totalOutput = outputPer * crafts
    addItemsToSlot(machine, OUTPUT_SLOT, recipe.output.id, totalOutput)

    if (recipe.byproduct) {
        const rolled = rollByproduct(recipe.byproduct, crafts)
        if (rolled > 0) {
            addItemsToSlot(machine, BYPRODUCT_SLOT, recipe.byproduct.id, rolled)
        }
    }
}

function rollByproduct(byproduct, crafts) {
    const chance = clampChance(byproduct.chance ?? 1)
    let total = 0
    for (let i = 0; i < crafts; i++) {
        if (Math.random() <= chance) total += Math.max(1, byproduct.amount ?? 1)
    }
    return total
}

function tickGate(entity, key, interval) {
    const cd = Number(entity.getDynamicProperty(key)) || 0
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1)
        return false
    }
    entity.setDynamicProperty(key, interval)
    return true
}

function addItemsToSlot(machine, slot, id, amount) {
    const existing = machine.inv.getItem(slot)
    if (!existing) {
        machine.entity.setItem(slot, id, amount)
    } else {
        machine.entity.changeItemAmount(slot, amount)
    }
}

function updateHud(machine, recipe, maxCrafts) {
    const costText = Energy.formatEnergyToText(machine.getEnergyCost())
    const inputName = formatName(recipe.input.id)
    const outputName = formatName(recipe.output.id)
    const desc = recipe.description ? `§7${recipe.description}` : null

    const lore = [
        `§bInput: §f${inputName}`,
        `§dOutput: §f${outputName}`,
    ]

    if (recipe.byproduct) {
        const chancePct = Math.round(clampChance(recipe.byproduct.chance ?? 1) * 100)
        lore.push(`§7Residue: §f${formatName(recipe.byproduct.id)} (${chancePct}% chance)`) 
    } else {
        lore.push('§7Residue: §fNone')
    }

    lore.push(
        `§cCost: §f${costText}`,
        `§7Cycle: §f${recipe.seconds}s`,
        `§7Batch Ready: §f${maxCrafts}`
    )

    if (desc) lore.push(desc)

    machine.setLabel({
        title: '§6Residue Processor',
        lore
    })
}

function formatName(id) {
    const [, raw = id] = id.split(':')
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function clampChance(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.min(1, Math.max(0, numeric))
}

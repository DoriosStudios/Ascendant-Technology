import { Machine, Energy, buildOverclockLoreLine, applyDynamicRecipeRate, tickGate, rollByproduct, clampChance, addItemsToSlot, getOutputCapacity, formatItemName } from '../../DoriosCore/main.js'
import { getResidueProcessorRecipes } from '../../config/recipes/residue_processor.js'

const RESIDUE_PROCESSOR = Object.freeze({
    slots: Object.freeze({
        input: 3,
        output: 19,
        byproduct: 18,
        status: 1
    })
})

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
            machine.entity.setItem(RESIDUE_PROCESSOR.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')
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

        const inputStack = machine.inv.getItem(RESIDUE_PROCESSOR.slots.input)
        if (!inputStack) {
            machine.showWarning('Insert Residue')
            return
        }

        const recipe = matchRecipe(recipes, inputStack)
        if (!recipe) {
            machine.showWarning('Invalid Input')
            return
        }

        const outputSlot = machine.inv.getItem(RESIDUE_PROCESSOR.slots.output)
        if (outputSlot && outputSlot.typeId !== recipe.output.id) {
            machine.showWarning('Output Conflict')
            return
        }

        const byproductSlot = machine.inv.getItem(RESIDUE_PROCESSOR.slots.byproduct)
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            machine.showWarning('Residue Slot Busy')
            return
        }

        const yieldBoost = machine.boosts.overclockYield ?? 1
        const crafts = computeMaxCrafts(recipe, inputStack, outputSlot, byproductSlot, yieldBoost)
        if (crafts.max <= 0) {
            machine.showWarning(crafts.reason ?? 'Missing Items')
            return
        }

        const energyCost = recipe.energyCost ?? settings.machine.energy_cost ?? 5200
        machine.setEnergyCost(energyCost)

        if (settings?.machine?.dynamic_rate === true) {
            applyDynamicRecipeRate(machine, recipe, { energyCost })
        }

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

function computeMaxCrafts(recipe, inputSlot, outputSlot, byproductSlot, yieldBoost = 1) {
    const inputPer = Math.max(1, recipe.input.amount ?? 1)
    const outputPer = Math.max(1, recipe.output.amount ?? 1)

    const availableInput = Math.floor(inputSlot.amount / inputPer)
    const outputSpace = getOutputCapacity(outputSlot, outputPer, yieldBoost)

    let byproductSpace = Number.MAX_SAFE_INTEGER
    if (recipe.byproduct) {
        const bpAmount = Math.max(1, recipe.byproduct.amount ?? 1)
        if (!byproductSlot) {
            byproductSpace = Math.floor(64 / (bpAmount * yieldBoost))
        } else if (byproductSlot.typeId === recipe.byproduct.id) {
            const free = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount
            byproductSpace = Math.floor(free / (bpAmount * yieldBoost))
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

function processCraft(machine, recipe, crafts) {
    const inputPer = Math.max(1, recipe.input.amount ?? 1)
    const totalInput = inputPer * crafts
    machine.entity.changeItemAmount(RESIDUE_PROCESSOR.slots.input, -totalInput)

    const yieldBoost = machine.boosts.overclockYield ?? 1
    const outputPer = Math.max(1, recipe.output.amount ?? 1)
    const totalOutputRaw = outputPer * crafts * yieldBoost
    
    // Handle fractional output with accumulator
    const totalOutput = machine.addFractionalItem(recipe.output.id, totalOutputRaw)
    if (totalOutput > 0) {
        addItemsToSlot(machine, RESIDUE_PROCESSOR.slots.output, recipe.output.id, totalOutput)
    }

    if (recipe.byproduct) {
        const rolled = rollByproduct(recipe.byproduct, crafts)
        if (rolled > 0) {
            const byproductRaw = Math.floor(rolled * yieldBoost)
            const byproductFinal = machine.addFractionalItem(recipe.byproduct.id, byproductRaw)
            if (byproductFinal > 0) {
                addItemsToSlot(machine, RESIDUE_PROCESSOR.slots.byproduct, recipe.byproduct.id, byproductFinal)
            }
        }
    }
}

function updateHud(machine, recipe, maxCrafts) {
    const costText = Energy.formatEnergyToText(machine.getEnergyCost())
    const inputName = formatItemName(recipe.input.id)
    const outputName = formatItemName(recipe.output.id)
    const desc = recipe.description ? `§7${recipe.description}` : null

    const lore = [
        `§bInput: §f${inputName}`,
        `§dOutput: §f${outputName}`,
    ]

    if (recipe.byproduct) {
        const chancePct = Math.round(clampChance(recipe.byproduct.chance ?? 1) * 100)
        lore.push(`§7Residue: §f${formatItemName(recipe.byproduct.id)} (${chancePct}% chance)`) 
    } else {
        lore.push('§7Residue: §fNone')
    }

    lore.push(
        `§cCost: §f${costText}`,
        `§7Cycle: §f${recipe.seconds}s`,
        `§7Batch Ready: §f${maxCrafts}`
    )

    const overclockLine = buildOverclockLoreLine(machine)
    if (overclockLine) lore.push(overclockLine)

    if (desc) lore.push(desc)

    machine.setLabel({
        title: '§6Residue Processor',
        lore
    })
}

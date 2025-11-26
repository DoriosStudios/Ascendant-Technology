import { Machine, FluidManager } from '../managers_extra.js'
import { getCatalystWeaverRecipes } from '../../config/recipes/catalyst_weaver.js'

const INPUT_SLOT = 3
const CATALYST_SLOTS = [4, 5, 6, 7, 8, 9]
const FLUID_SLOT = 10
const FLUID_DISPLAY_SLOT = 11
const BYPRODUCT_SLOT = 18
const OUTPUT_SLOT_INDEX = 19

DoriosAPI.register.blockComponent('catalyst_weaver', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            machine.setEnergyCost(settings.machine.energy_cost)
            machine.displayProgress()
            machine.blockSlots([FLUID_DISPLAY_SLOT])
            machine.entity.setItem(1, 'utilitycraft:arrow_indicator_90', 1, '')

            const tank = FluidManager.initializeSingle(machine.entity)
            tank.display(FLUID_DISPLAY_SLOT)

            const blockedSlot = machine.inv.getItem(4)
            if (blockedSlot?.typeId === 'utilitycraft:empty_fluid_bar') {
                machine.inv.setItem(4)
            }
        })
    },

    onTick(e, { params: settings }) {
        if (!worldLoaded) return

        const { block } = e
        const machine = new Machine(block, settings)
        if (!machine.valid) return

        machine.transferItems()
        transferSlotForward(machine, BYPRODUCT_SLOT)
        CATALYST_SLOTS.forEach(slot => machine.pullItemsFromAbove(slot))

        const tank = FluidManager.initializeSingle(machine.entity)
        tank.transferFluids(block)
        feedFluidSlot(machine, tank)

        const inv = machine.inv
        
        // Priority 1: Check energy first
        const hasEnergy = machine.energy.get() > 0
        if (!hasEnergy) {
            machine.showWarning('No Energy', false)
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }
        
        // Priority 2: Basic validation
        const recipes = resolveRecipes(block)
        if (!recipes || recipes.length === 0) {
            machine.showWarning('No Recipes')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        const inputStack = inv.getItem(INPUT_SLOT)
        if (!inputStack) {
            machine.showWarning('No Base Item')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        // Priority 3: Try to match recipe
        const potentialCount = countPotentialRecipes(recipes, inputStack)
        const catalystStacks = CATALYST_SLOTS.map(slot => inv.getItem(slot))
        const recipe = matchRecipe(recipes, inputStack, catalystStacks, tank)
        
        // Priority 4: Check fluid requirements with specific messages
        if (recipe && recipe.fluid?.type) {
            const tankType = tank.getType()
            const fluidName = DoriosAPI.utils.capitalizeFirst(recipe.fluid.type)
            
            if (tankType !== 'empty' && tankType !== recipe.fluid.type) {
                machine.showWarning(`Wrong Fluid\n§7Need ${fluidName}`)
                tank.display(FLUID_DISPLAY_SLOT)
                return
            }
            
            const needFluid = recipe.fluid.amount ?? 0
            if (tank.get() < needFluid) {
                machine.showWarning(`Not Enough ${fluidName}\n§7Need ${needFluid}mB`)
                tank.display(FLUID_DISPLAY_SLOT)
                return
            }
            
            if (tankType === 'empty') tank.setType(recipe.fluid.type)
        }
        
        // Priority 5: Invalid recipe (last resort)
        if (!recipe) {
            const catalystStatus = recipes.some(r => matchesStack(r.input, inputStack)) 
                ? analyzeCatalystStatus(recipes.find(r => matchesStack(r.input, inputStack)), catalystStacks)
                : 'invalid'
            
            if (catalystStatus === 'missing_all') {
                machine.showWarning(`Missing Catalysts\n§7${potentialCount} potential recipe${potentialCount !== 1 ? 's' : ''}`)
            } else if (catalystStatus === 'missing_catalysts') {
                machine.showWarning(`Missing Some Catalysts\n§7${potentialCount} potential recipe${potentialCount !== 1 ? 's' : ''}`)
            } else if (catalystStatus === 'insufficient_catalysts') {
                machine.showWarning(`Insufficient Catalysts\n§7${potentialCount} potential recipe${potentialCount !== 1 ? 's' : ''}`)
            } else if (catalystStatus === 'wrong_catalysts' || catalystStatus === 'extra_catalysts') {
                machine.showWarning(`Wrong Catalysts\n§7${potentialCount} potential recipe${potentialCount !== 1 ? 's' : ''}`)
            } else {
                machine.showWarning(`Invalid Recipe\n§7${potentialCount} potential recipe${potentialCount !== 1 ? 's' : ''}`)
            }
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        const outputSlot = inv.getItem(OUTPUT_SLOT_INDEX)
        if (outputSlot && outputSlot.typeId !== recipe.output?.id) {
            machine.showWarning('Recipe Conflict')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        const outputSpace = (outputSlot?.maxAmount ?? 64) - (outputSlot?.amount ?? 0)
        if (outputSpace < (recipe.output?.amount ?? 1)) {
            machine.showWarning('Output Full')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        const byproductSlot = recipe.byproduct ? inv.getItem(BYPRODUCT_SLOT) : null
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            machine.showWarning('Byproduct Full')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        if (recipe.byproduct && byproductSlot && byproductSlot.typeId === recipe.byproduct.id) {
            let requiredSpace = recipe.byproduct.amount ?? 1
            if (Array.isArray(requiredSpace)) {
                requiredSpace = requiredSpace[1] // Use max value for space check
            }
            const availableSpace = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount
            if (availableSpace < requiredSpace) {
                machine.showWarning('Byproduct Slot Full')
                tank.display(FLUID_DISPLAY_SLOT)
                return
            }
        }

        const energyCost = recipe.cost ?? settings.machine.energy_cost
        machine.setEnergyCost(energyCost)

        const maxBatches = calculateMaxBatches({
            inputStack,
            catalystStacks,
            recipe,
            outputSpace,
            tank,
            byproductSlot
        })
        if (maxBatches <= 0) {
            machine.showWarning('Missing Materials')
            tank.display(FLUID_DISPLAY_SLOT)
            return
        }

        const progress = machine.getProgress()
        if (progress >= energyCost) {
            const crafts = Math.min(Math.floor(progress / energyCost), maxBatches)
            if (crafts > 0) {
                applyCraft(machine, recipe, crafts, tank)
                machine.addProgress(-crafts * energyCost)
            }
        } else {
            const consumption = machine.boosts.consumption
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, maxBatches * energyCost * consumption)
            machine.energy.consume(energyToConsume)
            machine.addProgress(energyToConsume / consumption)
        }

        tank.display(FLUID_DISPLAY_SLOT)
        machine.on()
        machine.displayEnergy()
        machine.displayProgress()
        machine.showStatus('Running')
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function resolveRecipes(block) {
    const component = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params
    if (component?.type === 'catalyst_weaver') return getCatalystWeaverRecipes()
    if (Array.isArray(component)) return component
    return []
}

function matchRecipe(recipes, inputStack, catalystStacks, tank) {
    for (const recipe of recipes) {
        if (!recipe?.input || !recipe.output) continue
        if (!matchesStack(recipe.input, inputStack)) continue
        if (!matchesCatalysts(recipe.catalysts, catalystStacks)) continue
        
        // Check fluid type compatibility
        if (recipe.fluid?.type) {
            const tankType = tank.getType()
            if (tankType !== 'empty' && tankType !== recipe.fluid.type) continue
        }
        
        return recipe
    }
    return null
}

function matchesStack(requirement, stack) {
    if (!stack) return false
    return stack.typeId === requirement.id && stack.amount >= (requirement.amount ?? 1)
}

function countPotentialRecipes(recipes, inputStack) {
    if (!inputStack) return 0
    let count = 0
    for (const recipe of recipes) {
        if (!recipe?.input || !recipe.output) continue
        if (matchesStack(recipe.input, inputStack)) count++
    }
    return count
}

function analyzeCatalystStatus(recipe, catalystStacks) {
    const requirementTotals = getCatalystRequirementTotals(recipe.catalysts)
    const stackTotals = getCatalystStackTotals(catalystStacks)
    
    if (requirementTotals.size === 0) {
        if (stackTotals.size > 0) return 'extra_catalysts'
        return 'ok'
    }
    
    if (stackTotals.size === 0) return 'missing_all'
    
    const missingTypes = []
    const insufficientTypes = []
    
    for (const [type, needed] of requirementTotals.entries()) {
        const available = stackTotals.get(type) ?? 0
        if (available === 0) {
            missingTypes.push(type)
        } else if (available < needed) {
            insufficientTypes.push(type)
        }
    }
    
    for (const type of stackTotals.keys()) {
        if (!requirementTotals.has(type)) {
            return 'wrong_catalysts'
        }
    }
    
    if (missingTypes.length > 0) return 'missing_catalysts'
    if (insufficientTypes.length > 0) return 'insufficient_catalysts'
    return 'ok'
}

function matchesCatalysts(requirements = [], stacks) {
    const requirementTotals = getCatalystRequirementTotals(requirements)
    const stackTotals = getCatalystStackTotals(stacks)

    if (requirementTotals.size === 0) return stackTotals.size === 0
    if (stackTotals.size === 0) return false

    for (const [type, available] of stackTotals.entries()) {
        if (!requirementTotals.has(type)) return false
        if (available <= 0) return false
    }

    for (const [type, needed] of requirementTotals.entries()) {
        if ((stackTotals.get(type) ?? 0) < needed) return false
    }

    return true
}


function calculateMaxBatches({ inputStack, catalystStacks, recipe, outputSpace, tank, byproductSlot }) {
    let max = Infinity
    const inputRequired = recipe.input.amount ?? 1
    max = Math.min(max, Math.floor(inputStack.amount / inputRequired))

    const requirementTotals = getCatalystRequirementTotals(recipe.catalysts)
    const stackTotals = getCatalystStackTotals(catalystStacks)

    if (requirementTotals.size === 0) {
        if (stackTotals.size > 0) return 0
    } else {
        if (stackTotals.size === 0) return 0
        for (const [type, needed] of requirementTotals.entries()) {
            const available = stackTotals.get(type) ?? 0
            if (available <= 0) return 0
            max = Math.min(max, Math.floor(available / needed))
        }
        for (const type of stackTotals.keys()) {
            if (!requirementTotals.has(type)) return 0
        }
    }

    if (recipe.fluid?.amount) {
        max = Math.min(max, Math.floor(tank.get() / recipe.fluid.amount))
    }

    if (recipe.output?.amount) {
        max = Math.min(max, Math.floor(outputSpace / recipe.output.amount))
    }

    if (recipe.byproduct) {
        const slot = byproductSlot
        let amount = recipe.byproduct.amount ?? 1
        if (Array.isArray(amount)) {
            amount = amount[1] // Use max value for capacity check
        }
        if (!slot) {
            // ok, empty slot -> can accept at least one craft
        } else if (slot.typeId !== recipe.byproduct.id) {
            return 0
        } else {
            max = Math.min(max, Math.floor((slot.maxAmount - slot.amount) / amount))
        }
    }

    return Math.max(0, max)
}

function applyCraft(machine, recipe, crafts, tank) {
    const inputQty = (recipe.input.amount ?? 1) * crafts
    machine.entity.changeItemAmount(INPUT_SLOT, -inputQty)

    consumeCatalysts(machine, recipe, crafts)

    if (recipe.fluid?.amount) {
        tank.add(-(recipe.fluid.amount * crafts))
        if (tank.get() <= 0) tank.setType('empty')
    }

    const outputAmount = (recipe.output?.amount ?? 1) * crafts
    const outputSlot = machine.inv.getItem(OUTPUT_SLOT_INDEX)
    if (!outputSlot) {
        machine.entity.setItem(OUTPUT_SLOT_INDEX, recipe.output.id, outputAmount)
    } else {
        machine.entity.changeItemAmount(OUTPUT_SLOT_INDEX, outputAmount)
    }

    if (recipe.byproduct) {
        const chance = recipe.byproduct.chance ?? 1
        for (let i = 0; i < crafts; i++) {
            if (Math.random() > chance) continue
            addByproduct(machine, recipe.byproduct)
        }
    }
}

function addByproduct(machine, byproduct) {
    const slot = machine.inv.getItem(BYPRODUCT_SLOT)
    
    // Normalize amount to support [min, max] ranges
    let amount = byproduct.amount ?? 1
    if (Array.isArray(amount)) {
        const [min, max] = amount
        amount = Math.floor(Math.random() * (max - min + 1)) + min
    }
    
    if (!slot) {
        machine.entity.setItem(BYPRODUCT_SLOT, byproduct.id, amount)
    } else if (slot.typeId === byproduct.id) {
        machine.entity.changeItemAmount(BYPRODUCT_SLOT, amount)
    } else {
        machine.entity.addItem(byproduct.id, amount)
    }
}

function feedFluidSlot(machine, tank) {
    const slotItem = machine.inv.getItem(FLUID_SLOT)
    if (!slotItem) return

    // Prevent empty containers from draining the tank (input-only behavior)
    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId)
    if (fillDefinition) return

    // Allow any fluid-type container to be inserted into the tank

    const result = tank.fluidItem(slotItem.typeId)
    if (result === false) return

    machine.entity.changeItemAmount(FLUID_SLOT, -1)

    if (!result) return

    const updated = machine.inv.getItem(FLUID_SLOT)
    if (!updated) {
        machine.entity.setItem(FLUID_SLOT, result, 1)
        return
    }

    if (updated.typeId === result && updated.amount < updated.maxAmount) {
        machine.entity.changeItemAmount(FLUID_SLOT, 1)
    } else {
        machine.entity.addItem(result, 1)
    }
}

function getCatalystRequirementTotals(requirements = []) {
    return aggregateCatalystEntries(requirements?.filter(Boolean) ?? [], req => req.id, req => req.amount ?? 1)
}

function getCatalystStackTotals(stacks = []) {
    return aggregateCatalystEntries(stacks?.filter(Boolean) ?? [], stack => stack.typeId, stack => stack.amount ?? 0)
}

function aggregateCatalystEntries(entries, idSelector, amountSelector) {
    const totals = new Map()
    for (const entry of entries) {
        const id = idSelector(entry)
        if (!id) continue
        const amount = amountSelector(entry)
        if (!amount || amount <= 0) continue
        totals.set(id, (totals.get(id) ?? 0) + amount)
    }
    return totals
}

function consumeCatalysts(machine, recipe, crafts) {
    const requirementTotals = getCatalystRequirementTotals(recipe.catalysts)
    if (requirementTotals.size === 0) return

    for (const [type, amountPerCraft] of requirementTotals.entries()) {
        let remaining = amountPerCraft * crafts
        if (remaining <= 0) continue
        for (const slot of CATALYST_SLOTS) {
            if (remaining <= 0) break
            const stack = machine.inv.getItem(slot)
            if (!stack || stack.typeId !== type) continue
            const toRemove = Math.min(remaining, stack.amount)
            machine.entity.changeItemAmount(slot, -toRemove)
            remaining -= toRemove
        }
    }
}

function transferSlotForward(machine, slotIndex) {
    if (!machine?.inv) return false

    const facing = machine.block.getState('utilitycraft:axis')
    if (!facing) return false

    const offsets = {
        east: [-1, 0, 0],
        west: [1, 0, 0],
        north: [0, 0, 1],
        south: [0, 0, -1],
        up: [0, -1, 0],
        down: [0, 1, 0]
    }

    const offset = offsets[facing]
    if (!offset) return false

    const { x, y, z } = machine.block.location
    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] }

    DoriosAPI.containers.transferItemsAt(machine.inv, targetLoc, machine.dim, slotIndex)
    return true
}

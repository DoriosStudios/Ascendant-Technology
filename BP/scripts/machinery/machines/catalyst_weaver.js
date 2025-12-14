import { Machine, FluidManager } from '../managers_extra.js'
import { getCatalystWeaverRecipes } from '../../config/recipes/catalyst_weaver.js'

const INPUT_SLOT = 3
const CATALYST_SLOTS = [4, 5, 6, 7, 8, 9]
const FLUID_SLOT = 10
const FLUID_DISPLAY_SLOT = 11
const FLUID_INFO_SLOT = 12
const UPGRADE_SLOTS = [16, 17]
const BYPRODUCT_SLOT = 18
const OUTPUT_SLOT_INDEX = 19

const RECIPE_PREVIEW_DEFAULT_LIMIT = 5
const RECIPE_PREVIEW_CHAR_BUDGET = 240
const RECIPE_PREVIEW_MAX_LENGTH = 24
const HELPER_MAX_POOL_ENTRIES = 5

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão → energy_bar@machineryCommon.vertical_single).
- [1] Indicador de status/seta (machine.showStatus/machine.showWarning → machineryCommon.item_label).
- [3] Input base (INPUT_SLOT) exibido em container_item índice 3.
- [4-9] Catalisadores (CATALYST_SLOTS) vinculados aos container_item das laterais.
- [10] Entrada de fluido (FLUID_SLOT) — container_item índice 10.
- [11] Display do tanque (FLUID_DISPLAY_SLOT) — preenchido automaticamente pelo FluidManager.
- [12] Slot oculto para o label “Catalyst Fluid” (machineryCommon.item_label → collection_index 12).
- [16,17] Slots de upgrades (UPGRADE_SLOTS) → machineryCommon.vertical_interactive.
- [18] Saída de subproduto (BYPRODUCT_SLOT) → container_item índice 18.
- [19] Saída principal (OUTPUT_SLOT_INDEX) → container_item índice 19.
Slots escondidos: [12, 13, 14, 15] (usados como placeholders invisíveis para UI/fluxos internos/labels).
*/

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

        if (tickGate(machine.entity, 'cw:items_cd', 4)) {
            machine.transferItems()
            transferSlotForward(machine, BYPRODUCT_SLOT)
            CATALYST_SLOTS.forEach(slot => machine.pullItemsFromAbove(slot))
        }

        const tank = FluidManager.initializeSingle(machine.entity)
        if (tickGate(machine.entity, 'cw:fluids_cd', 4)) {
            tank.transferFluids(block)
            feedFluidSlot(machine, tank)
        }

        const inv = machine.inv
        const catalystFluidFallbackLore = buildCatalystFluidLore(null, null, null)
        const updateFluidLabel = (lines = catalystFluidFallbackLore) =>
            machine.setLabel(buildCatalystFluidLabelContent(lines), FLUID_INFO_SLOT)
        updateFluidLabel()
        
        // Priority 1: Check energy first
        const hasEnergy = machine.energy.get() > 0
        if (!hasEnergy) {
            showMachineWarning(machine, tank, 'No Energy', { resetProgress: false, lore: catalystFluidFallbackLore })
            return
        }
        
        // Priority 2: Basic validation
        const recipes = resolveRecipes(block)
        if (!recipes || recipes.length === 0) {
            showMachineWarning(machine, tank, 'No Recipes', { lore: catalystFluidFallbackLore })
            return
        }

        const inputStack = inv.getItem(INPUT_SLOT)
        if (!inputStack) {
            showMachineWarning(machine, tank, 'No Base Item', { lore: catalystFluidFallbackLore })
            return
        }

        // Priority 3: Try to match recipe
        const potentialCount = countPotentialRecipes(recipes, inputStack)
        const catalystStacks = CATALYST_SLOTS.map(slot => inv.getItem(slot))
        const recipePreviewLore = potentialCount > 0
            ? buildRecipePreviewLore(recipes, inputStack, catalystStacks)
            : []
        const recipe = matchRecipe(recipes, inputStack, catalystStacks, tank)
        const helperLore = buildCatalystHelperLore(recipes, inputStack, catalystStacks)
        const catalystFluidLore = buildCatalystFluidLore(recipe, recipes, inputStack)
        const sharedLore = mergeLore(recipePreviewLore, helperLore, catalystFluidLore)
        updateFluidLabel(catalystFluidLore)
        
        // Priority 4: Check fluid requirements with specific messages
        if (recipe && recipe.fluid?.type) {
            const tankType = tank.getType()
            const fluidName = DoriosAPI.utils.capitalizeFirst(recipe.fluid.type)
            
            if (tankType !== 'empty' && tankType !== recipe.fluid.type) {
                showMachineWarning(machine, tank, `Wrong Fluid\n§7Need ${fluidName}`, { lore: sharedLore })
                return
            }
            
            const needFluid = recipe.fluid.amount ?? 0
            if (tank.get() < needFluid) {
                showMachineWarning(machine, tank, `Not Enough ${fluidName}`, { lore: sharedLore })
                return
            }
            
            if (tankType === 'empty') tank.setType(recipe.fluid.type)
        }
        
        // Priority 5: Invalid recipe (last resort)
        if (!recipe) {
            const catalystStatus = recipes.some(r => matchesStack(r.input, inputStack)) 
                ? analyzeCatalystStatus(recipes.find(r => matchesStack(r.input, inputStack)), catalystStacks)
                : 'invalid'

            let warningMessage = 'Invalid Recipe'
            if (catalystStatus === 'missing_all') {
                warningMessage = 'Missing Catalysts'
            } else if (catalystStatus === 'missing_catalysts') {
                warningMessage = 'Missing Some Catalysts'
            } else if (catalystStatus === 'insufficient_catalysts') {
                warningMessage = 'Insufficient Catalysts'
            } else if (catalystStatus === 'wrong_catalysts' || catalystStatus === 'extra_catalysts') {
                warningMessage = 'Wrong Catalysts'
            }

            showMachineWarning(machine, tank, warningMessage, { lore: sharedLore })
            return
        }

        const outputSlot = inv.getItem(OUTPUT_SLOT_INDEX)
        if (outputSlot && outputSlot.typeId !== recipe.output?.id) {
            showMachineWarning(machine, tank, 'Recipe Conflict', { lore: sharedLore })
            return
        }

        const outputSpace = (outputSlot?.maxAmount ?? 64) - (outputSlot?.amount ?? 0)
        if (outputSpace < (recipe.output?.amount ?? 1)) {
            showMachineWarning(machine, tank, 'Output Full', { lore: sharedLore })
            return
        }

        const byproductSlot = recipe.byproduct ? inv.getItem(BYPRODUCT_SLOT) : null
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            showMachineWarning(machine, tank, 'Byproduct Full', { lore: sharedLore })
            return
        }

        if (recipe.byproduct && byproductSlot && byproductSlot.typeId === recipe.byproduct.id) {
            let requiredSpace = recipe.byproduct.amount ?? 1
            if (Array.isArray(requiredSpace)) {
                requiredSpace = requiredSpace[1] // Use max value for space check
            }
            const availableSpace = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount
            if (availableSpace < requiredSpace) {
                showMachineWarning(machine, tank, 'Byproduct Slot Full', { lore: sharedLore })
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
            showMachineWarning(machine, tank, 'Missing Materials', { lore: sharedLore })
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

        showRunningDisplays(machine, tank, sharedLore)
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

function buildRecipePreviewLore(
    recipes,
    inputStack,
    catalystStacks,
    limit = RECIPE_PREVIEW_DEFAULT_LIMIT,
    maxLength = RECIPE_PREVIEW_MAX_LENGTH,
    charBudget = RECIPE_PREVIEW_CHAR_BUDGET
) {
    if (!Array.isArray(recipes) || recipes.length === 0) return []
    if (!inputStack) return []

    const candidateMap = new Map()
    for (const recipe of recipes) {
        if (!recipe?.input || !recipe.output) continue
        if (!matchesStack(recipe.input, inputStack)) continue

        const key = getRecipePreviewKey(recipe)
        const score = getCatalystMatchScore(recipe.catalysts, catalystStacks)
        const existing = candidateMap.get(key)
        if (existing) {
            existing.score = Math.max(existing.score, score)
            existing.variants++
        } else {
            candidateMap.set(key, {
                name: formatRecipePreviewName(recipe),
                score,
                variants: 1
            })
        }
    }

    const candidates = Array.from(candidateMap.values())
    if (candidates.length === 0) return []

    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.name.localeCompare(b.name)
    })

    const colors = DoriosAPI?.constants?.textColors ?? {}
    const gray = colors.gray ?? '§7'
    const reset = colors.reset ?? '§r'
    const totalText = `${candidates.length} §mPotential Recipe${candidates.length === 1 ? '' : 's'}:`

    const lines = [`${reset}${gray}${totalText}`]
    let currentLength = lines[0].length
    let added = 0
    const maxPreview = Math.max(0, limit)

    for (const entry of candidates) {
        if (added >= maxPreview) break

        const truncated = truncatePreviewText(entry.name, maxLength)
        const variantSuffix = entry.variants > 1 ? ` (+${entry.variants - 1} alt)` : ''
        const lineText = `${truncated}`
        const line = `${reset}${gray}  ${lineText}`
        const potentialLength = currentLength + line.length

        if (potentialLength > charBudget) break

        lines.push(line)
        currentLength = potentialLength
        added++
    }

    const hasHiddenEntries = candidates.length > added
    if (hasHiddenEntries) {
        const ellipsisLine = `${reset}${gray}  ...`
        if (currentLength + ellipsisLine.length <= charBudget) {
            lines.push(ellipsisLine)
        } else if (lines.length > 1) {
            const lastLine = lines[lines.length - 1]
            const withoutLast = currentLength - lastLine.length
            if (withoutLast + ellipsisLine.length <= charBudget) {
                lines[lines.length - 1] = ellipsisLine
            }
        }
    }

    return lines
}

function buildCatalystHelperLore(recipes, inputStack, catalystStacks) {
    if (!Array.isArray(recipes) || recipes.length === 0) return []
    if (!inputStack) return []

    const compatibleRecipes = getCompatibleRecipes(recipes, inputStack, catalystStacks)
    if (compatibleRecipes.length === 0) return []

    const insertedTotals = getCatalystStackTotals(catalystStacks)
    const lore = []
    const catalystOptions = collectFirstCatalystOptions(compatibleRecipes, insertedTotals)

    if (catalystOptions.length) {
        lore.push('§bCatalyst Options:')
        const limited = catalystOptions.slice(0, HELPER_MAX_POOL_ENTRIES)
        for (const entry of limited) {
            lore.push(`§7- ${entry.name}`)
        }
        if (catalystOptions.length > limited.length) {
            lore.push('§7- ...')
        }
    }

    if (compatibleRecipes.length === 1) {
        const hint = findNextCatalystHint(compatibleRecipes[0], insertedTotals)
        if (hint?.next) {
            if (!catalystOptions.length) lore.push('§bCatalyst Options:')
            const amountText = hint.next.amount > 1 ? ` x${hint.next.amount}` : ''
            lore.push(`§eNext: §f${hint.next.name}${amountText}`)
            if (hint.hasFollowing) {
                lore.push('§eFollowing: §f...???')
            }
        }
    }

    return lore
}

function getCompatibleRecipes(recipes, inputStack, catalystStacks) {
    const insertedTotals = getCatalystStackTotals(catalystStacks)
    return recipes.filter(recipe => {
        if (!matchesStack(recipe.input, inputStack)) return false
        return isCatalystPrefixCompatible(recipe, insertedTotals)
    })
}

function isCatalystPrefixCompatible(recipe, insertedTotals) {
    const requirements = getCatalystRequirementTotals(recipe.catalysts)
    if (insertedTotals.size === 0) return true
    if (requirements.size === 0) return false

    for (const [type, amount] of insertedTotals.entries()) {
        const needed = requirements.get(type)
        if (!needed) return false
        if (amount <= 0) return false
    }

    return true
}

function collectFirstCatalystOptions(recipes, insertedTotals) {
    const pool = new Map()
    for (const recipe of recipes) {
        const hint = findNextCatalystHint(recipe, insertedTotals)
        const next = hint?.next
        if (!next?.id) continue
        const amount = Math.max(1, next.amount ?? 1)
        const existing = pool.get(next.id)
        if (existing) {
            existing.amount = Math.max(existing.amount, amount)
        } else {
            pool.set(next.id, {
                id: next.id,
                name: next.name ?? humanizeIdentifier(next.id),
                amount
            })
        }
    }
    return Array.from(pool.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function findNextCatalystHint(recipe, insertedTotals) {
    const catalysts = Array.isArray(recipe?.catalysts) ? recipe.catalysts.filter(Boolean) : []
    if (!catalysts.length) return null

    const available = new Map(insertedTotals)

    for (let i = 0; i < catalysts.length; i++) {
        const entry = catalysts[i]
        if (!entry) continue
        const have = available.get(entry.id) ?? 0
        if (have >= entry.amount) {
            available.set(entry.id, have - entry.amount)
            continue
        }

        const missing = entry.amount - have
        const hasFollowing = catalysts.slice(i + 1).some(Boolean)
        return {
            next: {
                id: entry.id,
                name: humanizeIdentifier(entry.id),
                amount: missing
            },
            hasFollowing
        }
    }

    return null
}

function mergeLore(...sections) {
    const result = []
    for (const section of sections) {
        if (Array.isArray(section) && section.length) {
            result.push(...section)
        }
    }
    return result
}

function buildCatalystFluidLore(recipe, recipes, inputStack) {
    const header = '§dCatalyst Fluid:'
    const bulletNone = '§7- None'

    if (recipe) {
        const type = recipe?.fluid?.type
        if (!type) return [header, bulletNone]

        const name = humanizeIdentifier(type)
        const amount = recipe?.fluid?.amount
        if (amount === undefined || amount === null) return [header, `§7- ${name}`]
        return [header, `§7- ${name}`, `§7   Amount: ${amount}mB`]
    }

    if (!inputStack || !Array.isArray(recipes) || recipes.length === 0) {
        return [header, bulletNone]
    }

    const candidates = recipes.filter(r => r?.input && matchesStack(r.input, inputStack))
    if (!candidates.length) return [header, bulletNone]

    const fluidDefs = candidates
        .map(r => (r?.fluid?.type ? { type: r.fluid.type, amount: r.fluid.amount } : null))
        .filter(Boolean)

    if (!fluidDefs.length) return [header, bulletNone]

    const firstType = fluidDefs[0].type
    const sameType = fluidDefs.every(f => f.type === firstType)
    if (!sameType) return [header, '§7- Varies']

    const firstAmount = fluidDefs[0].amount
    const sameAmount = fluidDefs.every(f => (f.amount ?? null) === (firstAmount ?? null))

    const lines = [header, `§7- ${humanizeIdentifier(firstType)}`]
    if (sameAmount && firstAmount !== undefined && firstAmount !== null) {
        lines.push(`§7   Amount: ${firstAmount}mB`)
    }
    return lines
}

function buildCatalystFluidLabelContent(lines) {
    const fallback = ['§dCatalyst Fluid:', '§7- None']
    const entries = Array.isArray(lines) && lines.length ? lines : fallback
    const [title, ...rest] = entries
    const lore = rest.length ? rest : ['§7- None']
    return {
        rawText: title ?? '§dCatalyst Fluid:',
        lore
    }
}

/**
 * Centraliza as atualizações dos displays de aviso para que seja fácil descobrir
 * quais elementos são atualizados sempre que a máquina precisa pausar.
 * - Restaura o display do tanque (slot 11 / fluid_bar).
 * - Propaga a mensagem para o item_label principal (slot 1).
 */
function showMachineWarning(machine, tank, message, { resetProgress = true, lore = [] } = {}) {
    machine.showWarning(message, resetProgress, lore)
    tank.display(FLUID_DISPLAY_SLOT)
}

/**
 * Mantém em um único local a lista de displays acionados enquanto a máquina roda.
 * Atualiza o tanque visual, energia HUD, barra de progresso e rótulo principal.
 */
function showRunningDisplays(machine, tank, lore = []) {
    tank.display(FLUID_DISPLAY_SLOT)
    machine.on()
    machine.displayEnergy()
    machine.displayProgress()
    machine.showStatus('Running', lore)
}

function formatRecipePreviewName(recipe) {
    if (recipe?.output?.name) return recipe.output.name
    const amount = recipe?.output?.amount ?? 1
    const baseId = recipe?.output?.id ?? recipe?.id
    const readable = humanizeIdentifier(baseId)
    return amount > 1 ? `${readable} x${amount}` : readable
}

function getRecipePreviewKey(recipe) {
    const id = recipe?.output?.id ?? recipe?.id ?? 'unknown'
    const amount = recipe?.output?.amount ?? 1
    const name = recipe?.output?.name ?? ''
    return `${id}|${amount}|${name}`
}

function humanizeIdentifier(identifier) {
    if (typeof identifier !== 'string' || identifier.length === 0) return 'Unknown'
    const [, raw = identifier] = identifier.split(':')
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function truncatePreviewText(text, limit = 32) {
    if (typeof text !== 'string') return ''
    if (limit <= 0) return ''
    if (text.length <= limit) return text
    if (limit <= 1) return text.slice(0, limit)
    return `${text.slice(0, limit - 1)}...`
}

function getCatalystMatchScore(requirements = [], stacks = []) {
    if (!Array.isArray(requirements) || !Array.isArray(stacks)) return 0
    let score = 0
    for (const requirement of requirements) {
        if (!requirement?.id) continue
        if (stacks.some(stack => stack?.typeId === requirement.id)) {
            score++
        }
    }
    return score
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

function tickGate(entity, key, interval) {
    const cd = Number(entity.getDynamicProperty(key)) || 0
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1)
        return false
    }
    entity.setDynamicProperty(key, interval)
    return true
}

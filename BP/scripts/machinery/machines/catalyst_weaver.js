import { ItemStack } from '@minecraft/server'
import { Machine, FluidManager, applyDynamicRecipeRate, tickGate, formatItemName, feedFluidSlot } from '../../DoriosCore/index.js'
import { getCatalystWeaverRecipes } from '../../config/recipes/catalyst_weaver.js'

const CATALYST_WEAVER_LAYOUT = Object.freeze({
    slots: Object.freeze({
        input: 3,
        catalysts: Object.freeze([4, 5, 6, 7, 8, 9]),
        fluid: 10,
        fluidDisplay: 11,
        fluidInfo: 12,
        outputProbe: 13,
        upgrades: Object.freeze([15, 16, 17]),
        byproduct: 18,
        output: 19
    })
})

const INPUT_SLOT = CATALYST_WEAVER_LAYOUT.slots.input
const CATALYST_SLOTS = CATALYST_WEAVER_LAYOUT.slots.catalysts
const FLUID_SLOT = CATALYST_WEAVER_LAYOUT.slots.fluid
const FLUID_DISPLAY_SLOT = CATALYST_WEAVER_LAYOUT.slots.fluidDisplay
const FLUID_INFO_SLOT = CATALYST_WEAVER_LAYOUT.slots.fluidInfo
const OUTPUT_PROBE_SLOT = CATALYST_WEAVER_LAYOUT.slots.outputProbe
const UPGRADE_SLOTS = CATALYST_WEAVER_LAYOUT.slots.upgrades
const BYPRODUCT_SLOT = CATALYST_WEAVER_LAYOUT.slots.byproduct
const OUTPUT_SLOT_INDEX = CATALYST_WEAVER_LAYOUT.slots.output

const config = Object.freeze({
    preview: Object.freeze({
        limit: 5,
        charBudget: 240,
        maxLength: 24
    }),
    helper: Object.freeze({
        maxPoolEntries: 5
    })
})

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão → energy_bar@machineryCommon.vertical_single).
- [1] Indicador de status/seta (machine.showStatus/machine.showWarning → machineryCommon.item_label).
- [3] Input base (INPUT_SLOT) exibido em container_item índice 3.
- [4-9] Catalisadores (CATALYST_SLOTS) vinculados aos container_item das laterais.
- [10] Entrada de fluido (FLUID_SLOT) — container_item índice 10.
- [11] Display do tanque (FLUID_DISPLAY_SLOT) — preenchido automaticamente pelo FluidManager.
- [12] Slot oculto para o label “Catalyst Fluid” (machineryCommon.item_label → collection_index 12).
- [15, 16, 17] Slots de upgrades (UPGRADE_SLOTS) → machineryCommon.vertical_interactive.
- [18] Saída de subproduto (BYPRODUCT_SLOT) → container_item índice 18.
- [19] Saída principal (OUTPUT_SLOT_INDEX) → container_item índice 19.
Slots escondidos: [12, 13, 14] (usados como placeholders invisíveis para UI/fluxos internos/labels).
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
        if (!globalThis.worldLoaded) return

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
            feedFluidSlot(machine, tank, FLUID_SLOT)
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
        const quantityHelperLore = buildInsufficientQuantityLore(recipes, inputStack, catalystStacks)
        const catalystFluidLore = buildCatalystFluidLore(recipe, recipes, inputStack)
        const sharedLore = mergeLore(recipePreviewLore, helperLore, quantityHelperLore, catalystFluidLore)
        updateFluidLabel(catalystFluidLore)

        const outputId = recipe?.output?.id
        if (recipe && !isValidItemId(outputId)) {
            showMachineWarning(machine, tank, 'Output item not found', { lore: sharedLore })
            return
        }
        const byproductId = recipe?.byproduct?.id
        if (recipe?.byproduct && !isValidItemId(byproductId)) {
            showMachineWarning(machine, tank, 'Byproduct item not found', { lore: sharedLore })
            return
        }
        
        // Priority 4: Check fluid requirements with specific messages
        if (recipe && recipe.fluid?.type) {
            const tankType = tank.getType()
            const fluidName = DoriosAPI.utils.formatIdToText(recipe.fluid.type)
            
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
            const recipesForInput = getRecipesByInputType(recipes, inputStack)
            const warningMessage = (() => {
                if (recipesForInput.length === 0) return 'No Recipes Available'

                const hasAvailableOutput = recipesForInput.some(candidate =>
                    canProbeOutputInHiddenSlot(machine, candidate?.output?.id)
                )

                if (!hasAvailableOutput) return "Couldn't Find Output"
                return 'Missing Materials'
            })()

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

        const energyCost = recipe.cost ?? settings.machine.energy_cost
        machine.setEnergyCost(energyCost)

        if (settings?.machine?.dynamic_rate === true) {
            const recipeSpeed = Number(recipe.speedModifier ?? 1)
            const normalizedRecipeSpeed = Number.isFinite(recipeSpeed) && recipeSpeed > 0 ? recipeSpeed : 1
            const machineSpeed = machine.boosts?.speed ?? 1
            const combinedSpeed = machineSpeed * normalizedRecipeSpeed
            applyDynamicRecipeRate(machine, recipe, { energyCost, speedMultiplier: combinedSpeed })
        }

        const maxBatches = calculateMaxBatches({
            inputStack,
            catalystStacks,
            recipe,
            outputSpace,
            tank
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

function matchesInputType(requirement, stack) {
    if (!requirement?.id || !stack) return false
    return stack.typeId === requirement.id
}

function matchesStack(requirement, stack) {
    if (!stack) return false
    return stack.typeId === requirement.id && stack.amount >= (requirement.amount ?? 1)
}

function getRecipesByInputType(recipes, inputStack) {
    if (!Array.isArray(recipes) || !inputStack) return []
    return recipes.filter(recipe => {
        if (!recipe?.input || !recipe.output) return false
        return matchesInputType(recipe.input, inputStack)
    })
}

function countPotentialRecipes(recipes, inputStack) {
    return getRecipesByInputType(recipes, inputStack).length
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
    limit = config.preview.limit,
    maxLength = config.preview.maxLength,
    charBudget = config.preview.charBudget
) {
    if (!Array.isArray(recipes) || recipes.length === 0) return []
    if (!inputStack) return []

    const candidateMap = new Map()
    for (const recipe of recipes) {
        if (!recipe?.input || !recipe.output) continue
        if (!matchesInputType(recipe.input, inputStack)) continue

        const key = getRecipePreviewKey(recipe)
        const existing = candidateMap.get(key)
        if (existing) {
            existing.variants++
        } else {
            candidateMap.set(key, {
                name: formatRecipePreviewName(recipe),
                variants: 1
            })
        }
    }

    const candidates = Array.from(candidateMap.values())
    if (candidates.length === 0) return []

    const colors = DoriosAPI?.constants?.textColors ?? {}
    const gray = colors.gray ?? '§7'
    const reset = colors.reset ?? '§r'
    const totalText = `${candidates.length} Potential Recipe${candidates.length === 1 ? '' : 's'}:`

    const lines = [`${reset}${gray}${totalText}`]
    let currentLength = lines[0].length
    let added = 0
    const maxPreview = Math.max(0, limit)

    for (const entry of candidates) {
        if (added >= maxPreview) break

        const truncated = truncatePreviewText(entry.name, maxLength)
        const variantSuffix = entry.variants > 1 ? ` (+${entry.variants - 1} alt)` : ''
        const lineText = `${truncated}${variantSuffix}`
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
        const limited = catalystOptions.slice(0, config.helper.maxPoolEntries)
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
        if (!matchesInputType(recipe.input, inputStack)) return false
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
                name: next.name ?? formatItemName(next.id),
                amount
            })
        }
    }
    return Array.from(pool.values())
}

function buildInsufficientQuantityLore(recipes, inputStack, catalystStacks) {
    if (!Array.isArray(recipes) || recipes.length === 0) return []
    if (!inputStack) return []

    const recipesForInput = getRecipesByInputType(recipes, inputStack)
    if (recipesForInput.length === 0) return []

    const lore = []

    const insufficientInputRecipe = recipesForInput.find(recipe => {
        const required = recipe?.input?.amount ?? 1
        return inputStack.amount < required
    })

    if (insufficientInputRecipe) {
        const required = insufficientInputRecipe.input?.amount ?? 1
        lore.push(`§7- Input: ${formatItemName(inputStack.typeId)} ${inputStack.amount}/${required}`)
    }

    const catalystTotals = getCatalystStackTotals(catalystStacks)
    const catalystDeficits = findInsufficientCatalystEntries(recipesForInput, catalystTotals)
    if (catalystDeficits.length > 0) {
        const limitedDeficits = catalystDeficits.slice(0, config.helper.maxPoolEntries)
        for (const deficit of limitedDeficits) {
            lore.push(`§7- Catalyst: ${formatItemName(deficit.id)} ${deficit.have}/${deficit.need}`)
        }
        if (catalystDeficits.length > limitedDeficits.length) {
            lore.push('§7- ...')
        }
    }

    if (!lore.length) return []
    return ['§6Insufficient Amount:', ...lore]
}

function findInsufficientCatalystEntries(recipesForInput, catalystTotals) {
    for (const recipe of recipesForInput) {
        const requirements = getCatalystRequirementTotals(recipe.catalysts)
        const deficits = []

        for (const [id, need] of requirements.entries()) {
            const have = catalystTotals.get(id) ?? 0
            if (have > 0 && have < need) {
                deficits.push({ id, have, need })
            }
        }

        if (deficits.length > 0) {
            return deficits
        }
    }

    return []
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
                name: formatItemName(entry.id),
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

        const name = formatItemName(type)
        const amount = recipe?.fluid?.amount
        if (amount === undefined || amount === null) return [header, `§7- ${name}`]
        return [header, `§7- ${name}`, `§7   Amount: ${amount}mB`]
    }

    if (!inputStack || !Array.isArray(recipes) || recipes.length === 0) {
        return [header, bulletNone]
    }

    const candidates = recipes.filter(r => r?.input && matchesInputType(r.input, inputStack))
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

    const lines = [header, `§7- ${formatItemName(firstType)}`]
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

function canProbeOutputInHiddenSlot(machine, itemId, slotIndex = OUTPUT_PROBE_SLOT) {
    if (!machine?.entity || !machine?.inv || !itemId || typeof itemId !== 'string') return false

    try {
        machine.entity.setItem(slotIndex, itemId, 1, '')
        const probe = machine.inv.getItem(slotIndex)
        machine.inv.setItem(slotIndex)
        return probe?.typeId === itemId
    } catch {
        try {
            machine.inv.setItem(slotIndex)
        } catch {
            // no-op: keep failure isolated to probing
        }
        return false
    }
}

/**
 * Mantém em um único local a lista de displays acionados enquanto a máquina roda.
 * Atualiza o tanque visual, energia HUD, barra de progresso e rótulo principal.
 */
function showRunningDisplays(machine, tank, lore = [], statusMessage = 'Running') {
    tank.display(FLUID_DISPLAY_SLOT)
    machine.on()
    machine.displayEnergy()
    machine.displayProgress()
    machine.showStatus(statusMessage, lore)
}

function formatRecipePreviewName(recipe) {
    if (recipe?.output?.name) return recipe.output.name
    const amount = recipe?.output?.amount ?? 1
    const baseId = recipe?.output?.id ?? recipe?.id
    const readable = formatItemName(baseId)
    return amount > 1 ? `${readable} x${amount}` : readable
}

function getRecipePreviewKey(recipe) {
    const id = recipe?.output?.id ?? recipe?.id ?? 'unknown'
    const amount = recipe?.output?.amount ?? 1
    const name = recipe?.output?.name ?? ''
    return `${id}|${amount}|${name}`
}

function truncatePreviewText(text, limit = 32) {
    if (typeof text !== 'string') return ''
    if (limit <= 0) return ''
    if (text.length <= limit) return text
    if (limit <= 1) return text.slice(0, limit)
    return `${text.slice(0, limit - 1)}...`
}

function calculateMaxBatches({ inputStack, catalystStacks, recipe, outputSpace, tank }) {
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
        let skippedByproduct = 0

        for (let i = 0; i < crafts; i++) {
            if (Math.random() > chance) continue

            try {
                const added = addByproduct(machine, recipe.byproduct)
                if (!added) skippedByproduct++
            } catch (error) {
                skippedByproduct++
                console.warn(
                    `[Catalyst Weaver] Failed to add byproduct '${recipe.byproduct.id}'.`,
                    error
                )
            }
        }

        if (skippedByproduct > 0) {
            console.warn(
                `[Catalyst Weaver] Skipped ${skippedByproduct} byproduct drop(s) for '${recipe.byproduct.id}' because the byproduct slot was unavailable.`
            )
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
        return true
    } else if (slot.typeId === byproduct.id) {
        const availableSpace = (slot.maxAmount ?? 64) - slot.amount
        if (availableSpace < amount) return false
        machine.entity.changeItemAmount(BYPRODUCT_SLOT, amount)
        return true
    } else {
        return false
    }
}

function isValidItemId(id) {
    if (!id || typeof id !== 'string') return false
    try {
        // Attempt to instantiate an ItemStack; throws if the id is invalid/unregistered.
        new ItemStack(id, 1)
        return true
    } catch {
        return false
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



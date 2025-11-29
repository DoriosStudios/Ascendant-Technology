import { Machine, Energy, FluidManager } from '../managers_extra.js'
import { getClonerRecipes } from '../../config/recipes/cloner.js'

const COMPONENT_ID = 'singularity_fabricator'
const INPUT_SLOT = 3
const STATUS_SLOT = 1
const FLUID_SLOT = 10
const FLUID_DISPLAY_SLOT = 11
const OUTPUT_SLOT_ORIGINAL = 18
const OUTPUT_SLOT_COPY = 19
const DEFAULT_FLUID_TYPE = 'dark_matter'
const FLUID_PER_SECOND = 80
const TICKS_PER_SECOND = 20
const UPGRADE_SLOTS = [4, 5]
const LEGACY_UPGRADE_SLOTS = [16, 17]
const FABRICATOR_RATE_SPEED_BASE = 80
const ENERGY_USAGE_MULTIPLIER = 6
const MAX_RUNTIME_SECONDS = 24 * 60 * 60
const FABRICATOR_PROGRESS_PER_SECOND = FABRICATOR_RATE_SPEED_BASE * TICKS_PER_SECOND * ENERGY_USAGE_MULTIPLIER
const KDE = 1000
const MAX_TOTAL_KDE = Math.floor((MAX_RUNTIME_SECONDS * FABRICATOR_PROGRESS_PER_SECOND) / KDE)

doriosRegister()

function doriosRegister() {
    DoriosAPI.register.blockComponent(COMPONENT_ID, {
        beforeOnPlayerPlace(e, { params: settings }) {
            Machine.spawnMachineEntity(e, settings, () => {
                const machine = new Machine(e.block, settings, true)
                if (!machine?.entity) return
                machine.setEnergyCost(settings.machine.energy_cost ?? 64000)
                machine.displayProgress()
                machine.displayEnergy()
                machine.entity.setItem(STATUS_SLOT, 'utilitycraft:arrow_indicator_90', 1, '')
                machine.blockSlots([FLUID_DISPLAY_SLOT])
                migrateLegacyUpgradeSlots(machine)

                const tank = FluidManager.initializeSingle(machine.entity)
                tank.display(FLUID_DISPLAY_SLOT)
            })
        },

        onTick(e, { params: settings }) {
            if (!globalThis.worldLoaded) return
            const { block } = e
            const machine = new Machine(block, settings)
            if (!machine.valid) return

            boostFabricatorThroughput(machine)

            migrateLegacyUpgradeSlots(machine)
            machine.transferItems()

            const tank = FluidManager.initializeSingle(machine.entity)
            tank.transferFluids(block)
            feedFluidSlot(machine, tank)

            const fail = (message, reset = true) => {
                machine.showWarning(message, reset)
                tank.display(FLUID_DISPLAY_SLOT)
            }

            const { recipes } = resolveFabricatorRecipes(block)
            if (!recipes.length) {
                fail('No Recipes')
                return
            }

            const inputStack = machine.inv.getItem(INPUT_SLOT)
            if (!inputStack) {
                fail('Insert Template')
                return
            }

            const recipe = normalizeRecipe(matchRecipe(recipes, inputStack))
            if (!recipe) {
                fail('Invalid Template')
                return
            }

            const requiredFluid = getRecipeFluid(recipe)
            if (requiredFluid) {
                const tankType = tank.getType()
                const neededType = requiredFluid.type ?? DEFAULT_FLUID_TYPE
                const fluidName = formatFluidDisplayName(neededType)

                if (tankType !== 'empty' && tankType !== neededType) {
                    fail(`Wrong Fluid\n§7Need ${fluidName}`)
                    return
                }

                if (tank.get() < requiredFluid.amount) {
                    fail(`Need ${FluidManager.formatFluid(requiredFluid.amount)}\n§7${fluidName}`)
                    return
                }

                if (tankType === 'empty') {
                    tank.setType(neededType)
                }
            }

            const originalSlot = machine.inv.getItem(OUTPUT_SLOT_ORIGINAL)
            const copySlot = machine.inv.getItem(OUTPUT_SLOT_COPY)
            const copyPerCraft = getCopyAmountPerCraft(recipe)

            if (!canAcceptSlotItem(originalSlot, recipe.input?.id)) {
                fail('Original Slot Busy')
                return
            }

            if (copyPerCraft > 0 && !canAcceptSlotItem(copySlot, recipe.output?.id)) {
                fail('Copy Slot Busy')
                return
            }

            const originalCapacity = computeSlotCapacity(originalSlot, recipe.input?.id, getOriginalAmountPerCraft(recipe))
            if (originalCapacity <= 0) {
                fail('Original Slot Full', false)
                return
            }

            if (copyPerCraft > 0) {
                const copyCapacity = computeSlotCapacity(copySlot, recipe.output?.id, copyPerCraft)
                if (copyCapacity <= 0) {
                    fail('Copy Slot Full', false)
                    return
                }
            }

            const maxCrafts = calculateMaxCrafts(inputStack, originalSlot, copySlot, recipe, tank)
            if (maxCrafts <= 0) {
                if (inputStack.amount < (recipe.input.amount ?? 1)) {
                    fail('Missing Input')
                } else {
                    fail('Output Full', false)
                }
                return
            }

            machine.setEnergyCost(recipe.energyCost)

            if (machine.energy.get() <= 0) {
                fail('No Energy', false)
                return
            }

            const crafts = handleProgress(machine, recipe, maxCrafts, tank)
            if (crafts > 0) {
                updateHud(machine, recipe, tank, true)
                return
            }

            updateHud(machine, recipe, tank, false)
        },

        onPlayerBreak(e) {
            Machine.onDestroy(e)
        }
    })
}

function resolveFabricatorRecipes(block) {
    const component = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params

    if (!component || component.type === COMPONENT_ID || component.type === 'cloner') {
        return { recipes: toRecipeArray(getClonerRecipes()) }
    }

    if (Array.isArray(component)) {
        return { recipes: component }
    }

    if (Array.isArray(component.recipes)) {
        return { recipes: component.recipes }
    }

    return { recipes: toRecipeArray(getClonerRecipes()) }
}

function toRecipeArray(value) {
    return Array.isArray(value) ? value : []
}

function matchRecipe(recipes, stack) {
    return recipes.find(recipe =>
        recipe?.input?.id === stack?.typeId && stack?.amount >= (recipe.input.amount ?? 1)
    ) ?? null
}

function normalizeRecipe(recipe) {
    if (!recipe) return null

    const normalized = { ...recipe }
    normalized.input = { ...recipe.input, amount: Math.max(1, recipe.input?.amount ?? 1) }
    normalized.output = {
        ...recipe.output,
        amount: Math.max(normalized.input.amount + 1, recipe.output?.amount ?? normalized.input.amount + 1)
    }
    normalized.rarity = recipe.rarity ?? 'common'

    normalized.timeSeconds = clampTimeSeconds(normalized.timeSeconds ?? normalized.time ?? 1)
    normalized.ticks = Math.max(1, Math.round(normalized.timeSeconds * TICKS_PER_SECOND))
    const fallbackCostKDE = normalized.costKDE ?? ((normalized.energyCost ?? 0) / KDE)
    const derivedCost = fallbackCostKDE || (normalized.timeSeconds * FLUID_PER_SECOND) / 10
    normalized.costKDE = clampTotalCostKDE(derivedCost)
    normalized.energyCost = Math.max(KDE, Math.round(normalized.costKDE * KDE))

    return normalized
}

function clampTimeSeconds(value) {
    const seconds = Math.max(1, Number(value) || 1)
    return Math.min(MAX_RUNTIME_SECONDS, seconds)
}

function getRecipeFluid(recipe) {
    if (!recipe) return null
    if (recipe.fluid && typeof recipe.fluid === 'object') {
        recipe.fluid.type = DEFAULT_FLUID_TYPE
        recipe.fluid.amount = Math.max(1, Math.round(recipe.fluid.amount ?? 0))
        return recipe.fluid
    }

    const timeSeconds = recipe.timeSeconds ?? 60
    recipe.fluid = {
        type: DEFAULT_FLUID_TYPE,
        amount: Math.max(1, Math.round(timeSeconds * FLUID_PER_SECOND))
    }
    return recipe.fluid
}

function calculateMaxCrafts(inputStack, originalSlot, copySlot, recipe, tank) {
    const perInput = Math.max(1, recipe.input.amount ?? 1)
    const inputAvailable = Math.floor(inputStack.amount / perInput)
    const originalCapacity = computeSlotCapacity(originalSlot, recipe.input?.id, getOriginalAmountPerCraft(recipe))
    const copyPerCraft = getCopyAmountPerCraft(recipe)
    const copyCapacity = copyPerCraft > 0
        ? computeSlotCapacity(copySlot, recipe.output?.id, copyPerCraft)
        : Number.MAX_SAFE_INTEGER

    let max = Math.min(inputAvailable, originalCapacity, copyCapacity)

    if (recipe?.fluid?.amount && tank) {
        const perCraft = Math.max(1, recipe.fluid.amount)
        const tankCapacity = Math.floor(tank.get() / perCraft)
        max = Math.min(max, tankCapacity)
    }

    return Math.max(0, max)
}

function handleProgress(machine, recipe, maxCrafts, tank) {
    const energyCost = recipe.energyCost
    const progress = machine.getProgress()

    if (progress >= energyCost) {
        const crafts = Math.min(maxCrafts, Math.floor(progress / energyCost))
        applyCraft(machine, recipe, crafts, tank)
        machine.addProgress(-(crafts * energyCost))
        return crafts
    }

    const consumption = machine.boosts.consumption
    const needed = energyCost - progress
    const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption)
    if (spendable > 0) {
        machine.energy.consume(spendable)
        machine.addProgress(spendable / Math.max(consumption, Number.EPSILON))
    }
    return 0
}

function applyCraft(machine, recipe, crafts, tank) {
    if (crafts <= 0) return

    const inputQty = (recipe.input.amount ?? 1) * crafts
    machine.entity.changeItemAmount(INPUT_SLOT, -inputQty)

    if (recipe?.fluid?.amount && tank) {
        const totalFluid = recipe.fluid.amount * crafts
        tank.add(-totalFluid)
        if (tank.get() <= 0) tank.setType('empty')
    }

    const originalAmount = getOriginalAmountPerCraft(recipe) * crafts
    addItemsToSlot(machine, OUTPUT_SLOT_ORIGINAL, recipe.input.id, originalAmount)

    const copyAmount = getCopyAmountPerCraft(recipe) * crafts
    if (copyAmount > 0) {
        addItemsToSlot(machine, OUTPUT_SLOT_COPY, recipe.output.id, copyAmount)
    }
}

function updateHud(machine, recipe, tank, crafted) {
    machine.displayEnergy()
    machine.displayProgress()
    tank?.display(FLUID_DISPLAY_SLOT)

    machine.on()

    const action = crafted ? 'Replication Complete' : 'Replicating'
    const etaDisplay = formatEta(machine, recipe)
    const fluidBlock = formatFluidBlock(recipe?.fluid, tank)
    machine.setLabel(`
§r§5${action}
§r§7Blueprint:
    §b${formatName(recipe.input.id)}
§r§7Rarity: §d${capitalize(recipe.rarity ?? 'unknown')}
§r§7ETA: §f${etaDisplay}
§r§cCost: §f${Energy.formatEnergyToText(recipe.energyCost)}
${fluidBlock}
    `)
}

function formatName(id) {
    const [, name = id] = id.split(':')
    return name.split('_').map(capitalize).join(' ')
}

function capitalize(text) {
    if (!text) return ''
    return text[0].toUpperCase() + text.slice(1)
}

function formatSeconds(totalSeconds = 0) {
    const seconds = Math.floor(totalSeconds)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remaining = seconds % 60

    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${remaining}s`)
    return parts.join(' ')
}

function formatEta(machine, recipe) {
    const seconds = calculateEtaSeconds(machine, recipe)
    if (seconds === null || !isFinite(seconds)) {
        if (typeof recipe?.timeSeconds === 'number') {
            return formatSeconds(recipe.timeSeconds)
        }
        return '---'
    }
    return formatSeconds(seconds)
}

function calculateEtaSeconds(machine, recipe) {
    const cost = recipe?.energyCost ?? machine.getEnergyCost()
    if (!cost || cost <= 0) return null

    const remaining = Math.max(0, cost - machine.getProgress())
    if (remaining <= 0) return 0

    const progressPerSecond = getProgressPerSecond(machine)
    if (progressPerSecond <= 0) return null

    return remaining / progressPerSecond
}

function getProgressPerSecond(machine) {
    const progress = machine.getProgress()
    const tickCount = globalThis.tickCount ?? 0

    const lastProgress = machine.entity.getDynamicProperty('dorios:last_progress_sample')
    const lastTick = machine.entity.getDynamicProperty('dorios:last_progress_tick')

    let perSecond = 0
    if (typeof lastProgress === 'number' && typeof lastTick === 'number' && tickCount > lastTick) {
        const deltaProgress = progress - lastProgress
        const deltaTicks = Math.max(1, tickCount - lastTick)
        if (deltaProgress > 0) {
            perSecond = (deltaProgress * TICKS_PER_SECOND) / deltaTicks
        }
    }

    machine.entity.setDynamicProperty('dorios:last_progress_sample', progress)
    machine.entity.setDynamicProperty('dorios:last_progress_tick', tickCount)

    if (perSecond > 0) {
        return perSecond
    }

    const tickSpeed = Math.max(1, globalThis.tickSpeed ?? 1)
    const updatesPerSecond = TICKS_PER_SECOND / Math.max(1, tickSpeed)
    const theoreticalPerUpdate = machine.rate / Math.max(machine.boosts.consumption, Number.EPSILON)

    if (theoreticalPerUpdate <= 0 || updatesPerSecond <= 0) return 0

    return theoreticalPerUpdate * updatesPerSecond
}

function formatFluidBlock(fluid, tank) {
    const indent = '  '
    if (!fluid) {
        return `§r§3Fluid:\n§r${indent}§7None`
    }

    const perCraft = FluidManager.formatFluid(Math.max(1, fluid.amount ?? 0))
    const tankAmount = FluidManager.formatFluid(Math.max(0, tank?.get?.() ?? 0))
    const fluidName = formatFluidDisplayName(fluid.type)

    return [
        '§r§3Fluid:',
        `§r${indent}§7${fluidName}`,
        `§r${indent}§f${perCraft} §7per craft`,
        `§r${indent}§f${tankAmount} §7in tank`
    ].join('\n')
}

function formatFluidDisplayName(type) {
    if (!type || type === 'empty') return 'Empty'
    const pretty = formatName(type)
    const cleaned = pretty.replace(/Liquified\s*/i, '').replace(/\s{2,}/g, ' ').trim()
    return cleaned.length ? cleaned : pretty
}

function addItemsToSlot(machine, slotIndex, itemId, amount) {
    if (!amount || amount <= 0 || !itemId) return
    const slot = machine.inv.getItem(slotIndex)
    if (!slot) {
        machine.entity.setItem(slotIndex, itemId, amount)
        return
    }

    if (slot.typeId !== itemId) {
        machine.entity.setItem(slotIndex, itemId, amount)
        return
    }

    machine.entity.changeItemAmount(slotIndex, amount)
}

function computeSlotCapacity(slot, expectedId, perCraft) {
    if (perCraft <= 0) return Number.MAX_SAFE_INTEGER
    if (!expectedId) return 0

    if (!slot) {
        return Math.floor(64 / perCraft)
    }

    if (slot.typeId !== expectedId) return 0
    const remaining = (slot.maxAmount ?? 64) - slot.amount
    return Math.floor(Math.max(0, remaining) / perCraft)
}

function getOriginalAmountPerCraft(recipe) {
    return Math.max(1, recipe?.input?.amount ?? 1)
}

function getCopyAmountPerCraft(recipe) {
    const outputAmount = Math.max(0, recipe?.output?.amount ?? 0)
    const originalAmount = getOriginalAmountPerCraft(recipe)
    const copy = outputAmount - originalAmount
    return copy > 0 ? copy : 0
}

function canAcceptSlotItem(slot, expectedId) {
    if (!expectedId) return false
    return !slot || slot.typeId === expectedId
}

function feedFluidSlot(machine, tank) {
    const slotItem = machine.inv.getItem(FLUID_SLOT)
    if (!slotItem) return

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId)
    if (fillDefinition) return

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

function boostFabricatorThroughput(machine) {
    if (!machine) return
    machine.rate *= ENERGY_USAGE_MULTIPLIER
}

function migrateLegacyUpgradeSlots(machine) {
    if (!machine?.inv) return
    for (const legacySlot of LEGACY_UPGRADE_SLOTS) {
        const item = machine.inv.getItem(legacySlot)
        if (!item) continue
        if (typeof item.hasTag === 'function' && !item.hasTag('utilitycraft:is_upgrade')) continue

        const target = UPGRADE_SLOTS.find(slot => !machine.inv.getItem(slot))
        if (target === undefined) continue
        machine.inv.setItem(target, item)
        machine.inv.setItem(legacySlot, undefined)
    }
}

function clampTotalCostKDE(value) {
    if (!Number.isFinite(value) || value <= 0) return 1
    return Math.min(MAX_TOTAL_KDE, value)
}

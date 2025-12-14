import { Machine, Energy, FluidManager } from '../managers_extra.js'
import { getClonerRecipes } from '../../config/recipes/cloner.js'

const INPUT_SLOT = 3
const STATUS_SLOT = 1
const FLUID_INPUT_SLOT = 10
const FLUID_DISPLAY_SLOT = 11
const OUTPUT_SLOT_ORIGINAL = 18
const OUTPUT_SLOT_COPY = 19
const DEFAULT_FLUID_TYPE = 'liquified_aetherium'
const FLUID_PER_SECOND = 50
const TICKS_PER_SECOND = 20
const UPGRADE_SLOTS = [4, 5]
const LEGACY_UPGRADE_SLOTS = [16, 17]
const CLONER_BASE_TIME_SECONDS = 30 * 60
const CLONER_ENERGY_COST = 1_000_000
const KDE = 1000
const CLONER_COST_KDE = Math.round(CLONER_ENERGY_COST / KDE)
const CLONER_BLOCK_ID = 'utilitycraft:cloner'
const CLONER_SPEED_DURATION_SECONDS = [
    CLONER_BASE_TIME_SECONDS,
    20 * 60,
    15 * 60,
    10 * 60,
    8 * 60,
    6 * 60,
    4 * 60,
    2 * 60,
    1 * 60
]
const MIN_CLONER_RATE = 1

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (STATUS_SLOT).
- [3] Input de template (INPUT_SLOT).
- [4,5] Slots de upgrades (UPGRADE_SLOTS); 16,17 são slots legados migrados.
- [10] Entrada de fluido (FLUID_INPUT_SLOT) — bloqueada ao jogador.
- [11] Display do tanque (FLUID_DISPLAY_SLOT) — bloqueado ao jogador.
- [18] Slot do original/entrada a ser clonado (OUTPUT_SLOT_ORIGINAL).
- [19] Slot da cópia/clonado (OUTPUT_SLOT_COPY).
Slots escondidos: [6, 7, 8, 9, 12, 13, 14, 15, 16, 17] (preenchimento/UI, não utilizáveis; 16/17 usados apenas para migração legada).
*/

doriosRegister()

function doriosRegister() {
    DoriosAPI.register.blockComponent('cloner', {
        beforeOnPlayerPlace(e, { params: settings }) {
            Machine.spawnMachineEntity(e, settings, () => {
                const machine = new Machine(e.block, settings, true)
                if (!machine?.entity) return
                machine.setEnergyCost(settings.machine.energy_cost ?? 1000)
                machine.displayProgress()
                machine.displayEnergy()
                machine.entity.setItem(STATUS_SLOT, 'utilitycraft:arrow_indicator_90', 1, '')
                machine.blockSlots([FLUID_DISPLAY_SLOT, FLUID_INPUT_SLOT])
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

            migrateLegacyUpgradeSlots(machine)

            if (tickGate(machine.entity, 'cln:items_cd', 4)) {
                machine.transferItems()
            }

            const tank = FluidManager.initializeSingle(machine.entity)
            if (tickGate(machine.entity, 'cln:fluids_cd', 4)) {
                tank.transferFluids(block)
            }

            const fail = (message, reset = true) => {
                machine.showWarning(message, reset)
                tank.display(FLUID_DISPLAY_SLOT)
            }

            const inputStack = machine.inv.getItem(INPUT_SLOT)
            if (!inputStack) {
                fail('Insert Template')
                return
            }

            if (isSingularityFabricatorTemplate(inputStack.typeId)) {
                fail('Use Singularity Fabricator')
                return
            }

            const recipe = createGenericRecipeFromInput(inputStack)
            if (!recipe) {
                fail('Invalid Template')
                return
            }

            applyClonerRuntime(machine, recipe)

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
            } else {
                updateHud(machine, recipe, tank, false)
            }
        },

        onPlayerBreak(e) {
            Machine.onDestroy(e)
        }
    })
}

function createGenericRecipeFromInput(stack) {
    if (!stack?.typeId) return null

    if (stack.typeId.toLowerCase() === CLONER_BLOCK_ID) {
        return null
    }

    const input = {
        id: stack.typeId,
        amount: 1
    }

    const output = {
        id: stack.typeId,
        amount: 2
    }

    return {
        id: `generic:${stack.typeId}`,
        input,
        output,
        timeSeconds: CLONER_BASE_TIME_SECONDS,
        ticks: Math.max(1, Math.round(CLONER_BASE_TIME_SECONDS * TICKS_PER_SECOND)),
        perSecondKDE: CLONER_COST_KDE / CLONER_BASE_TIME_SECONDS,
        costKDE: CLONER_COST_KDE,
        energyCost: CLONER_ENERGY_COST,
        fluid: {
            type: DEFAULT_FLUID_TYPE,
            amount: Math.max(1, Math.round(CLONER_BASE_TIME_SECONDS * FLUID_PER_SECOND))
        }
    }
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
function getRecipeFluid(recipe) {
    if (!recipe) return null
    if (recipe.fluid && typeof recipe.fluid === 'object') {
        recipe.fluid.type = recipe.fluid.type ?? DEFAULT_FLUID_TYPE
        recipe.fluid.amount = Math.max(1, Math.round(recipe.fluid.amount ?? 0))
        return recipe.fluid
    }

    const timeSeconds = recipe.timeSeconds ?? CLONER_BASE_TIME_SECONDS
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

    const action = crafted ? 'Duplication Ready' : 'Duplicating'
    const etaDisplay = formatEta(machine, recipe)
    const fluidLines = formatFluidBlock(recipe?.fluid, tank)
    const lore = [
        `§7Template: §b${formatName(recipe.input.id)}`,
        '§7Mode: §fUniversal',
        `§7ETA: §f${etaDisplay}`,
        `§cCost: §f${Energy.formatEnergyToText(recipe.energyCost)}`
    ]

    if (Array.isArray(fluidLines) && fluidLines.length) {
        lore.push(...fluidLines)
    }

    machine.setLabel({
        title: `§6${action}`,
        lore
    })
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
    const updatesPerSecond = TICKS_PER_SECOND / tickSpeed
    const theoreticalPerUpdate = machine.rate / Math.max(machine.boosts.consumption, Number.EPSILON)

    if (theoreticalPerUpdate <= 0 || updatesPerSecond <= 0) return 0

    return theoreticalPerUpdate * updatesPerSecond
}

function formatFluidBlock(fluid, tank) {
    if (!fluid || !tank) return null
    const perCraft = FluidManager.formatFluid(Math.max(1, fluid.amount ?? 0))
    const tankAmount = FluidManager.formatFluid(Math.max(0, tank.get()))
    const tankCap = FluidManager.formatFluid(Math.max(0, tank.getCap()))
    const fluidName = formatFluidDisplayName(fluid.type)
    return [
        `§3Fluid: §f${fluidName}`,
        `§7Need: §f${perCraft}`,
        `§7Tank: §f${tankAmount} §7/ §f${tankCap}`
    ]
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

function applyClonerRuntime(machine, recipe) {
    if (!machine || !recipe) return

    const speedLevel = getClonerSpeedLevel(machine)
    const targetSeconds = CLONER_SPEED_DURATION_SECONDS[speedLevel] ?? CLONER_BASE_TIME_SECONDS
    const tickSpeed = Math.max(1, globalThis.tickSpeed ?? 1)
    const updatesPerSecond = TICKS_PER_SECOND / tickSpeed

    recipe.timeSeconds = targetSeconds
    recipe.ticks = Math.max(1, Math.round(targetSeconds * TICKS_PER_SECOND))
    recipe.costKDE = CLONER_COST_KDE
    recipe.perSecondKDE = recipe.costKDE / targetSeconds
    recipe.energyCost = CLONER_ENERGY_COST
    if (recipe.fluid) {
        recipe.fluid.amount = Math.max(1, Math.round(targetSeconds * FLUID_PER_SECOND))
    }

    machine.boosts.speed = 1
    machine.boosts.consumption = 1

    const progressPerSecond = recipe.energyCost / targetSeconds
    const progressPerUpdate = progressPerSecond / updatesPerSecond
    const desiredRate = Math.max(MIN_CLONER_RATE, progressPerUpdate)

    machine.rate = desiredRate
    machine.baseRate = desiredRate
    machine.clonerTargetSeconds = targetSeconds
}

function getClonerSpeedLevel(machine) {
    const speed = machine?.upgrades?.speed ?? 0
    const clamped = Math.max(0, Math.floor(speed))
    return Math.min(CLONER_SPEED_DURATION_SECONDS.length - 1, clamped)
}

function isSingularityFabricatorTemplate(itemId) {
    if (!itemId) return false
    const recipes = getClonerRecipes()
    const normalizedId = itemId.toLowerCase()

    return recipes.some(recipe => {
        const inputId = recipe?.input?.id?.toLowerCase()
        const outputId = recipe?.output?.id?.toLowerCase()
        return inputId === normalizedId || outputId === normalizedId
    })
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


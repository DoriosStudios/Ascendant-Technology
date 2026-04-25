import { Machine, Energy, FluidManager, buildOverclockLoreLine, applyDynamicRecipeRate, tickGate, formatItemName, capitalize, formatSeconds, formatEta, calculateEtaSeconds, getProgressPerSecond, formatFluidDisplayName, computeSlotCapacity, addItemsToSlot, captureItemMetadata } from '../../DoriosCore/main.js'
import { getClonerBlockProfile } from '../../config/recipes/duplicator.js'

const config = Object.freeze({
    slots: Object.freeze({
        input: 3,
        status: 1,
        fluidInput: 10,
        fluidDisplay: 11,
        outputOriginal: 18,
        outputCopy: 19,
        upgrades: Object.freeze([4, 5, 6]),
        legacyUpgradeSlots: Object.freeze([16, 17])
    }),
    fluid: Object.freeze({
        type: 'liquified_aetherium',
        perSecond: 50,
        perCraft: 16
    }),
    cloner: Object.freeze({
        baseTimeSeconds: 30 * 60,
        undeclaredBaseTimeSeconds: 60,
        energyCost: 1_600_000,
        kde: 1000,
        ticksPerSecond: 20,
        blockId: 'utilitycraft:duplicator',
        speedDurationSeconds: Object.freeze([
            30 * 60,
            20 * 60,
            15 * 60,
            10 * 60,
            8 * 60,
            6 * 60,
            4 * 60,
            2 * 60,
            1 * 60
        ]),
        minRate: 1,
        rarityBase: 'common',
        rarityProfiles: Object.freeze({
            common: Object.freeze({ timeMultiplier: 1, costMultiplier: 1 }),
            uncommon: Object.freeze({ timeMultiplier: 1.75, costMultiplier: 2 }),
            rare: Object.freeze({ timeMultiplier: 3.5, costMultiplier: 3.5 }),
            epic: Object.freeze({ timeMultiplier: 6, costMultiplier: 5 }),
            legendary: Object.freeze({ timeMultiplier: 8.25, costMultiplier: 10 }),
            mythic: Object.freeze({ timeMultiplier: 10, costMultiplier: 15 }),
            transcendent: Object.freeze({ timeMultiplier: 12.5, costMultiplier: 25 })
        })
    })
})

let duplicator = config
let duplicatorSettingsCacheKey = ''

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]'
}

function deepMergeObjects(base, override) {
    if (Array.isArray(base)) {
        return Array.isArray(override) ? [...override] : [...base]
    }

    if (!isPlainObject(base)) {
        return override
    }

    const result = { ...base }
    if (!isPlainObject(override)) return result

    for (const [key, overrideValue] of Object.entries(override)) {
        const baseValue = base[key]
        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            result[key] = deepMergeObjects(baseValue, overrideValue)
            continue
        }

        if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
            result[key] = [...overrideValue]
            continue
        }

        result[key] = overrideValue
    }

    return result
}

function applyDuplicatorConfig(nextConfig) {
    duplicator = isPlainObject(nextConfig) ? nextConfig : config
}

function resolveDuplicatorConfig(settings) {
    const duplicatorOverride = settings?.machine?.duplicator ?? settings?.machine?.config?.duplicator
    if (!isPlainObject(duplicatorOverride)) {
        applyDuplicatorConfig(config)
        duplicatorSettingsCacheKey = ''
        return duplicator
    }

    let nextKey = ''
    try {
        nextKey = JSON.stringify(duplicatorOverride)
    } catch {
        nextKey = ''
    }

    if (nextKey && nextKey === duplicatorSettingsCacheKey) {
        return duplicator
    }

    const merged = deepMergeObjects(config, duplicatorOverride)
    applyDuplicatorConfig(merged)
    duplicatorSettingsCacheKey = nextKey
    return duplicator
}
/**
 * @typedef {Object} ClonerException
 * @property {string[]} ids - Lowercased identifiers blocked from cloning.
 * @property {string|string[]} warn - Warning text (single line or multiple) displayed to the player.
 */

const duplicatorExceptions = (() => {
    /** @type {ClonerException[]} */
    const entries = []

    const normalizeIds = (value) => {
        if (!value) return []
        const list = Array.isArray(value) ? value : [value]
        return list
            .map(id => typeof id === 'string' ? id.trim().toLowerCase() : '')
            .filter(Boolean)
    }

    const defineException = (config) => {
        if (!config) return
        const ids = normalizeIds(config.id ?? config.ids)
        if (!ids.length) return
        const warn = config.warn ?? config.message ?? "Can't duplicate this item"
        entries.push({ ids, warn })
    }

    const find = (typeId) => {
        if (!typeId) return null
        const normalized = typeId.toLowerCase()
        return entries.find(entry => entry.ids.includes(normalized)) ?? null
    }

    // Predefined exceptions
    defineException({
        id: ['utilitycraft:lucky_sword', 'utilitycraft:lucky_pickaxe', 'utilitycraft:lucky_aiot'],
        warn: "Can't duplicate Lucky Tools!"
    })

    defineException({
        id: ['minecraft:banner', 'minecraft:potion'],
        warn: "Can't duplicate items with data!"
    })
    defineException({
        id: ['minecraft:shulker_box'],
        warn: "Can't duplicate shulker boxes!"
    })

    return { defineException, find }
})()

function formatExceptionWarning(exception) {
    if (!exception) return "Can't duplicate this item"
    const warn = exception.warn
    if (Array.isArray(warn)) {
        const lines = warn.filter(line => typeof line === 'string' && line.trim().length)
        return lines.length ? lines.join('\n') : "Can't duplicate this item"
    }
    if (typeof warn === 'string' && warn.trim().length) {
        return warn
    }
    return "Can't duplicate this item"
}

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (`duplicator.slots.status`).
- [3] Input de template (`duplicator.slots.input`).
- [4,5,6] Slots de upgrades (`duplicator.slots.upgrades`); 16,17 são slots legados migrados.
- [10] Entrada de fluido (`duplicator.slots.fluidInput`) — bloqueada ao jogador.
- [11] Display do tanque (`duplicator.slots.fluidDisplay`) — bloqueado ao jogador.
- [18] Slot do original/entrada a ser clonado (`duplicator.slots.outputOriginal`).
- [19] Slot da cópia/clonado (`duplicator.slots.outputCopy`).
Slots escondidos: [7, 8, 9, 12, 13, 14, 15, 16, 17] (preenchimento/UI, não utilizáveis; 16/17 usados apenas para migração legada).
*/

doriosRegister()

function doriosRegister() {
    DoriosAPI.register.blockComponent('duplicator', {
        beforeOnPlayerPlace(e, { params: settings }) {
            resolveDuplicatorConfig(settings)
            Machine.spawnMachineEntity(e, settings, () => {
                const machine = new Machine(e.block, settings, true)
                if (!machine?.entity) return
                machine.setEnergyCost(settings.machine.energy_cost ?? duplicator.cloner.energyCost)
                machine.displayProgress()
                machine.displayEnergy()
                machine.entity.setItem(duplicator.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')
                machine.blockSlots([duplicator.slots.fluidDisplay, duplicator.slots.fluidInput])
                migrateLegacyUpgradeSlots(machine)

                machine.entity.addTag(`fluidWhitelist:${duplicator.fluid.type}`)
                machine.entity.setDynamicProperty?.('dorios:fluid_whitelist', duplicator.fluid.type)

                const tank = FluidManager.initializeSingle(machine.entity)
                tank.display(duplicator.slots.fluidDisplay)
            })
        },

        onTick(e, { params: settings }) {
            if (!globalThis.worldLoaded) return
            resolveDuplicatorConfig(settings)
            const { block } = e
            const machine = new Machine(block, settings)
            if (!machine.valid) return

            machine.entity?.addTag?.(`fluidWhitelist:${duplicator.fluid.type}`)
            machine.entity?.setDynamicProperty?.('dorios:fluid_whitelist', duplicator.fluid.type)

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
                tank.display(duplicator.slots.fluidDisplay)
            }

            const inputStack = machine.inv.getItem(duplicator.slots.input)
            if (!inputStack) {
                fail('Insert Template')
                return
            }

            const templateMeta = captureItemMetadata(inputStack)

            const exception = duplicatorExceptions.find(inputStack.typeId)
            if (exception) {
                fail(formatExceptionWarning(exception))
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
                const neededType = requiredFluid.type ?? duplicator.fluid.type
                const fluidName = formatFluidDisplayName(neededType)

                if (tankType !== 'empty' && tankType !== neededType) {
                    fail(`Wrong Fluid\n§7Need ${fluidName}`)
                    return
                }

                if (tankType === 'empty') {
                    tank.setType(neededType)
                }
            }

            const originalSlot = machine.inv.getItem(duplicator.slots.outputOriginal)
            const copySlot = machine.inv.getItem(duplicator.slots.outputCopy)
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

            const maxCrafts = calculateMaxCrafts(inputStack, originalSlot, copySlot, recipe)
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

            const crafts = handleProgress(machine, recipe, maxCrafts, tank, templateMeta)
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

    if (stack.typeId.toLowerCase() === duplicator.cloner.blockId) {
        return null
    }

    const rarityProfileData = getClonerBlockProfile(stack.typeId)
    const rarity = rarityProfileData.rarity
    const rarityProfile = getRarityProfile(rarity)
    const baseTimeSeconds = rarityProfileData.declared
        ? duplicator.cloner.baseTimeSeconds
        : duplicator.cloner.undeclaredBaseTimeSeconds
    const timeSeconds = Math.max(1, Math.round(baseTimeSeconds * rarityProfile.timeMultiplier))
    const clonerCostKDEBase = Math.max(1, duplicator.cloner.energyCost / duplicator.cloner.kde)
    const costKDE = Math.max(1, Math.round(clonerCostKDEBase * rarityProfile.costMultiplier))
    const energyModel = deriveClonerEnergyModel({
        timeSeconds,
        costKDE
    })

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
        rarity,
        rarityDeclared: rarityProfileData.declared,
        input,
        output,
        timeSeconds: energyModel.timeSeconds,
        ticks: energyModel.ticks,
        perSecondKDE: energyModel.perSecondKDE,
        costKDE: energyModel.costKDE,
        energyCost: energyModel.energyCost,
        fluid: {
            type: duplicator.fluid.type,
            amount: getFixedFluidPerCraftAmount()
        }
    }
}

function getFixedFluidPerCraftAmount() {
    const configured = Number(duplicator?.fluid?.perCraft)
    if (Number.isFinite(configured) && configured > 0) {
        return Math.max(1, Math.round(configured))
    }
    return 16
}

function getRecipeFluid(recipe) {
    if (!recipe) return null
    if (recipe.fluid && typeof recipe.fluid === 'object') {
        recipe.fluid.type = recipe.fluid.type ?? duplicator.fluid.type
        recipe.fluid.amount = getFixedFluidPerCraftAmount()
        return recipe.fluid
    }

    recipe.fluid = {
        type: duplicator.fluid.type,
        amount: getFixedFluidPerCraftAmount()
    }
    return recipe.fluid
}

function calculateMaxCrafts(inputStack, originalSlot, copySlot, recipe) {
    const perInput = Math.max(1, recipe.input.amount ?? 1)
    const inputAvailable = Math.floor(inputStack.amount / perInput)
    const originalCapacity = computeSlotCapacity(originalSlot, recipe.input?.id, getOriginalAmountPerCraft(recipe))
    const copyPerCraft = getCopyAmountPerCraft(recipe)
    const copyCapacity = copyPerCraft > 0
        ? computeSlotCapacity(copySlot, recipe.output?.id, copyPerCraft)
        : Number.MAX_SAFE_INTEGER

    const max = Math.min(inputAvailable, originalCapacity, copyCapacity)
    return Math.max(0, max)
}

function calculateFluidCraftCapacity(recipe, tank) {
    if (!recipe?.fluid?.amount) return Number.MAX_SAFE_INTEGER
    if (!tank) return 0

    const perCraft = Math.max(1, Number(recipe.fluid.amount) || getFixedFluidPerCraftAmount())
    return Math.max(0, Math.floor(tank.get() / perCraft))
}

function handleProgress(machine, recipe, maxCrafts, tank, templateMeta) {
    const energyCost = recipe.energyCost
    const progress = machine.getProgress()

    if (progress >= energyCost) {
        const byEnergy = Math.floor(progress / energyCost)
        const byFluid = calculateFluidCraftCapacity(recipe, tank)
        const crafts = Math.min(maxCrafts, byEnergy, byFluid)
        if (crafts <= 0) return 0
        applyCraft(machine, recipe, crafts, tank, templateMeta)
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

function applyCraft(machine, recipe, crafts, tank, templateMeta) {
    if (crafts <= 0) return

    const inputQty = (recipe.input.amount ?? 1) * crafts
    machine.entity.changeItemAmount(duplicator.slots.input, -inputQty)

    if (recipe?.fluid?.amount && tank) {
        const totalFluid = recipe.fluid.amount * crafts
        tank.add(-totalFluid)
        if (tank.get() <= 0) tank.setType('empty')
    }

    const originalAmount = getOriginalAmountPerCraft(recipe) * crafts
    addItemsToSlot(machine, duplicator.slots.outputOriginal, recipe.input.id, originalAmount, {
        metadata: templateMeta,
        applyMetadataOnMerge: true
    })

    const copyAmount = getCopyAmountPerCraft(recipe) * crafts
    if (copyAmount > 0) {
        addItemsToSlot(machine, duplicator.slots.outputCopy, recipe.output.id, copyAmount, {
            metadata: templateMeta,
            applyMetadataOnMerge: true
        })
    }
}

function updateHud(machine, recipe, tank, crafted) {
    machine.displayEnergy()
    machine.displayProgress()
    tank?.display(duplicator.slots.fluidDisplay)

    machine.on()

    const rawRarityName = capitalize(recipe?.rarity ?? duplicator.cloner.rarityBase)
    let rarityName = rawRarityName
    if (rawRarityName.toLowerCase() === 'uncommon') {
        rarityName = '§aUncommon'
    } else if (rawRarityName.toLowerCase() === 'rare') {
        rarityName = '§bRare'
    } else if (rawRarityName.toLowerCase() === 'epic') {
        rarityName = '§5Epic'
    } else if (rawRarityName.toLowerCase() === 'legendary') {
        rarityName = '§6Legendary'
    } else if (rawRarityName.toLowerCase() === 'mythic') {
        rarityName = '§dMythic'
    } else if (rawRarityName.toLowerCase() === 'transcendent') {
        rarityName = '§cTranscendent'
    }
    const action = crafted ? 'Duplication Ready' : 'Duplicating'
    const etaDisplay = formatEta(machine, recipe)
    const fluidLines = formatFluidBlock(recipe?.fluid, tank)
    const overclockLine = buildOverclockLoreLine(machine)
    const modeName = recipe?.rarityDeclared === false
        ? `(Unknown)`
        : rarityName
    const lore = [
        `§7Template: §b${formatItemName(recipe.input.id)}`,
        `§7Rarity: §f${modeName}`,
        `§7ETA: §f${etaDisplay}`,
        `§cCost: §f${Energy.formatEnergyToText(recipe.energyCost)}`,
        `§6Rate: §f${Energy.formatEnergyToText(recipe.perSecondKDE * duplicator.cloner.kde)}/s`
    ]

    if (Array.isArray(fluidLines) && fluidLines.length) {
        lore.push(...fluidLines)
    }

    if (overclockLine) lore.push(overclockLine)

    machine.setLabel({
        title: `§r§6${action}`,
        lore
    })
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

    const rarityProfile = getRarityProfile(recipe?.rarity)
    const baseRaritySeconds = Math.max(
        1,
        Math.round(
            Number(recipe?.timeSeconds)
            || (duplicator.cloner.baseTimeSeconds * rarityProfile.timeMultiplier)
        )
    )
    const clonerCostKDEBase = Math.max(1, duplicator.cloner.energyCost / duplicator.cloner.kde)
    const baseCostKDE = Math.max(
        1,
        Number(recipe?.costKDE)
        || (clonerCostKDEBase * rarityProfile.costMultiplier)
    )

    const speedLevel = getClonerSpeedLevel(machine)
    const speedScale = getClonerSpeedDurationScale(speedLevel)
    const baseSeconds = Math.max(1, Math.round(baseRaritySeconds * speedScale))
    const overclockClock = Number(machine.boosts?.overclockClock ?? 1)
    const timeScale = Number.isFinite(overclockClock) && overclockClock > 0 ? overclockClock : 1
    const targetSeconds = Math.max(1, baseSeconds / timeScale)
    const runtimeEnergy = deriveClonerEnergyModel({
        timeSeconds: targetSeconds,
        costKDE: baseCostKDE
    })

    recipe.timeSeconds = runtimeEnergy.timeSeconds
    recipe.ticks = runtimeEnergy.ticks
    recipe.energyCost = runtimeEnergy.energyCost
    recipe.costKDE = runtimeEnergy.costKDE
    recipe.perSecondKDE = runtimeEnergy.perSecondKDE
    if (recipe.fluid) {
        recipe.fluid.amount = getFixedFluidPerCraftAmount()
    }

    machine.boosts.speed = 1
    machine.boosts.consumption = 1

    const applied = applyDynamicRecipeRate(
        machine,
        {
            ...recipe,
            timeSeconds: runtimeEnergy.timeSeconds
        },
        {
            energyCost: recipe.energyCost,
            speedMultiplier: 1,
            consumptionMultiplier: 1
        }
    )

    if (!applied) {
        const tickSpeed = Math.max(1, globalThis.tickSpeed ?? 1)
        const updatesPerSecond = duplicator.cloner.ticksPerSecond / tickSpeed
        const progressPerSecond = recipe.energyCost / runtimeEnergy.timeSeconds
        const progressPerUpdate = progressPerSecond / Math.max(updatesPerSecond, Number.EPSILON)
        const desiredRate = Math.max(duplicator.cloner.minRate, progressPerUpdate)
        machine.rate = desiredRate
        machine.baseRate = desiredRate
        machine.processingRate = desiredRate
    }

    machine.duplicatorTargetSeconds = runtimeEnergy.timeSeconds
}

function deriveClonerEnergyModel(options = {}) {
    const resolvedSeconds = Math.max(1, Number(options.timeSeconds ?? duplicator.cloner.baseTimeSeconds) || duplicator.cloner.baseTimeSeconds)

    const explicitCostKDE = Number(options.costKDE)
    const explicitEnergyCost = Number(options.energyCost)

    const resolvedCostKDE = Number.isFinite(explicitCostKDE) && explicitCostKDE > 0
        ? explicitCostKDE
        : (Number.isFinite(explicitEnergyCost) && explicitEnergyCost > 0
            ? explicitEnergyCost / duplicator.cloner.kde
            : Math.max(1, duplicator.cloner.energyCost / duplicator.cloner.kde))

    const normalizedCostKDE = Math.max(1, resolvedCostKDE)
    const energyCost = Math.max(1, Math.round(normalizedCostKDE * duplicator.cloner.kde))

    return {
        timeSeconds: resolvedSeconds,
        ticks: Math.max(1, Math.round(resolvedSeconds * duplicator.cloner.ticksPerSecond)),
        costKDE: normalizedCostKDE,
        energyCost,
        perSecondKDE: normalizedCostKDE / resolvedSeconds,
        energyPerTick: energyCost / (resolvedSeconds * duplicator.cloner.ticksPerSecond)
    }
}

function getClonerSpeedLevel(machine) {
    const speed = machine?.upgrades?.speed ?? 0
    const clamped = Math.max(0, Math.floor(speed))
    return Math.min(duplicator.cloner.speedDurationSeconds.length - 1, clamped)
}

function getClonerSpeedDurationScale(speedLevel) {
    const resolved = duplicator.cloner.speedDurationSeconds[speedLevel] ?? duplicator.cloner.baseTimeSeconds
    return Math.max(Number.EPSILON, resolved / duplicator.cloner.baseTimeSeconds)
}

function getRarityProfile(rarity) {
    return duplicator.cloner.rarityProfiles[rarity] ?? duplicator.cloner.rarityProfiles[duplicator.cloner.rarityBase]
}

function isSingularityFabricatorTemplate(itemId) {
    if (!itemId) return false
    const recipes = getKnownSingularityRecipes()
    const normalizedId = itemId.toLowerCase()

    return recipes.some(recipe => {
        const inputId = recipe?.input?.id?.toLowerCase()
        const outputId = recipe?.output?.id?.toLowerCase()
        return inputId === normalizedId || outputId === normalizedId
    })
}

function getKnownSingularityRecipes() {
    const resolver = globalThis.utilitycraftGetSingularityRecipes
    if (typeof resolver !== 'function') return []

    try {
        const recipes = resolver()
        return Array.isArray(recipes) ? recipes : []
    } catch {
        return []
    }
}

function migrateLegacyUpgradeSlots(machine) {
    if (!machine?.inv) return
    for (const legacySlot of duplicator.slots.legacyUpgradeSlots) {
        const item = machine.inv.getItem(legacySlot)
        if (!item) continue
        if (typeof item.hasTag === 'function' && !item.hasTag('utilitycraft:is_upgrade')) continue

        const target = duplicator.slots.upgrades.find(slot => !machine.inv.getItem(slot))
        if (target === undefined) continue
        machine.inv.setItem(target, item)
        machine.inv.setItem(legacySlot, undefined)
    }
}


import { ItemStack } from '@minecraft/server'
import {
    Machine,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    formatItemName,
    syncButtonPanel,
    tickGate
} from '../../DoriosCore/index.js'
import { getArcPressForgeRecipes } from '../../config/recipes/arc_press_forge.js'

const ARC_PRESS_FORGE = Object.freeze({
    slots: Object.freeze({
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5, 6]),
        modeButton: 8,
        upgrades: Object.freeze([10, 11, 12, 13]),
        outputs: Object.freeze([16, 17, 18, 19])
    }),
    transfer: Object.freeze({
        outputIntervalTicks: 4
    }),
    quantity: Object.freeze({
        maxLevel: 4
    }),
    modes: Object.freeze({
        low_loss: Object.freeze({
            id: 'low_loss',
            title: 'Low Loss',
            description: 'Precision mode that treats matching inputs as one pool and finishes at 2x speed.',
            speedModifier: 2,
            energyModifier: 1
        }),
        high_speed: Object.freeze({
            id: 'high_speed',
            title: 'High Speed',
            description: 'Bulk mode that pools matching inputs into one batch and can waste output while accelerating throughput.',
            speedModifier: 1,
            energyModifier: 1
        })
    }),
    highSpeedProfiles: Object.freeze([
        Object.freeze({ batchSize: 2, lossChance: 0.5 }),
        Object.freeze({ batchSize: 4, lossChance: 0.25 }),
        Object.freeze({ batchSize: 6, lossChance: 0.25 }),
        Object.freeze({ batchSize: 8, lossChance: 0.25 }),
        Object.freeze({ batchSize: 4, lossChance: 0 })
    ]),
    legacyModes: Object.freeze({
        batch: 'high_speed'
    }),
    defaults: Object.freeze({
        mode: 'low_loss'
    })
})

const ARC_PRESS_MODE_BUTTONS = Object.freeze({
    id: 'arc_press_forge_mode',
    namespace: 'ascendant:arc_press_forge',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: ARC_PRESS_FORGE.defaults.mode
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_switch',
            property: 'mode',
            slot: ARC_PRESS_FORGE.slots.modeButton,
            type: 'cycle',
            values: Object.freeze([
                ARC_PRESS_FORGE.modes.low_loss.id,
                ARC_PRESS_FORGE.modes.high_speed.id
            ]),
            defaultValue: ARC_PRESS_FORGE.defaults.mode,
            getTitle: ({ state }) => getMode(state.mode).title,
            getLore: ({ state }) => buildModeButtonLore(getMode(state.mode)),
            pressHint: 'Take the switch to change modes.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, ARC_PRESS_FORGE.slots.progress)
            }
        })
    ])
})

DoriosAPI.register.blockComponent('arc_press_forge', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings.machine.energy_cost)
            machine.displayEnergy()
            machine.displayProgress(ARC_PRESS_FORGE.slots.progress)
            machine.entity.setItem(ARC_PRESS_FORGE.slots.status, 'utilitycraft:arrow_indicator_90', 1, '')
            syncButtonPanel(machine, ARC_PRESS_MODE_BUTTONS, {
                detectPresses: false,
                cleanupRadius: 12,
                cleanupIntervalTicks: 2,
                dropCleanupRadius: 8
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid) return

        const panelState = syncButtonPanel(machine, ARC_PRESS_MODE_BUTTONS, {
            cleanupRadius: 12,
            cleanupIntervalTicks: 2,
            dropCleanupRadius: 8
        })
        const mode = getMode(panelState.mode)
        const quantityLevel = getQuantityUpgradeLevel(machine)
        const modeProfile = getModeProfile(mode, quantityLevel)

        if (tickGate(machine.entity, 'apf:transfer_cd', ARC_PRESS_FORGE.transfer.outputIntervalTicks)) {
            transferOutputLanes(machine)
        }

        const recipes = resolveRecipes(e.block, settings)
        if (!recipes.length) {
            showMachineWarning(machine, 'No Recipes', mode, {
                quantityLevel,
                modeProfile
            })
            return
        }

        const operation = buildOperationPlan({
            machine,
            recipes,
            mode,
            modeProfile,
            settings
        })

        if (!operation.hasCandidateInput) {
            showMachineWarning(machine, 'Insert Items', mode, {
                quantityLevel,
                modeProfile,
                operation
            })
            return
        }

        if (!operation.ready) {
            const resetProgress = operation.message !== 'Output Full'
            showMachineWarning(machine, operation.message, mode, {
                quantityLevel,
                modeProfile,
                operation,
                focusGroup: operation.focusGroup
            }, resetProgress)
            return
        }

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, 'No Energy', mode, {
                quantityLevel,
                modeProfile,
                operation,
                focusGroup: operation.selectedGroup
            }, false)
            return
        }

        machine.setEnergyCost(operation.energyCost)

        if (settings?.machine?.dynamic_rate === true) {
            applyDynamicRecipeRate(machine, operation.referenceRecipe, {
                energyCost: operation.energyCost,
                speedMultiplier: (machine.boosts.speed ?? 1) * mode.speedModifier
            })
        }

        let lastCraft = null
        const progress = machine.getProgress()
        if (progress >= operation.energyCost) {
            lastCraft = processCraft(machine, operation)
            machine.addProgress(-operation.energyCost)
        } else {
            const consumption = machine.boosts.consumption
            const energyToConsume = Math.min(
                machine.energy.get(),
                machine.rate,
                Math.max(0, operation.energyCost - progress) * consumption
            )

            if (energyToConsume > 0) {
                machine.energy.consume(energyToConsume)
                machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON))
            }
        }

        showMachineStatus(machine, lastCraft ? 'Running' : 'Charging', mode, {
            quantityLevel,
            modeProfile,
            operation,
            focusGroup: operation.selectedGroup,
            lastCraft
        })
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function resolveRecipes(block, settings) {
    const component = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params
    if (component?.type === 'arc_press_forge') return getArcPressForgeRecipes()
    if (Array.isArray(component)) return component
    if (Array.isArray(settings?.machine?.recipes)) return settings.machine.recipes
    return getArcPressForgeRecipes()
}

function matchRecipe(recipes, itemId) {
    if (!itemId) return null
    return recipes.find(recipe => recipe?.input?.id === itemId) ?? null
}

function getMode(modeId) {
    const normalizedModeId = ARC_PRESS_FORGE.legacyModes[modeId] ?? modeId
    return ARC_PRESS_FORGE.modes[normalizedModeId] ?? ARC_PRESS_FORGE.modes[ARC_PRESS_FORGE.defaults.mode]
}

function getQuantityUpgradeLevel(machine) {
    let total = 0
    for (const slot of ARC_PRESS_FORGE.slots.upgrades) {
        const item = machine.inv.getItem(slot)
        if (!isQuantityUpgradeItem(item)) continue
        total += item.amount
    }

    return Math.max(0, Math.min(ARC_PRESS_FORGE.quantity.maxLevel, total))
}

function getModeProfile(mode, quantityLevel) {
    if (mode.id === ARC_PRESS_FORGE.modes.high_speed.id) {
        const profile = ARC_PRESS_FORGE.highSpeedProfiles[Math.max(0, Math.min(ARC_PRESS_FORGE.highSpeedProfiles.length - 1, quantityLevel))]
        return {
            batchSize: profile.batchSize,
            lossChance: profile.lossChance,
            speedModifier: mode.speedModifier,
            energyModifier: mode.energyModifier
        }
    }

    return {
        batchSize: 1,
        lossChance: 0,
        speedModifier: mode.speedModifier,
        energyModifier: mode.energyModifier
    }
}

function collectInputGroups(machine, recipes) {
    const groups = []
    const groupMap = new Map()

    for (const slot of ARC_PRESS_FORGE.slots.inputs) {
        const stack = machine.inv.getItem(slot)
        if (!stack) continue

        let group = groupMap.get(stack.typeId)
        if (!group) {
            group = {
                typeId: stack.typeId,
                firstSlot: slot,
                totalAmount: 0,
                slots: [],
                recipe: matchRecipe(recipes, stack.typeId)
            }
            groups.push(group)
            groupMap.set(stack.typeId, group)
        }

        group.totalAmount += stack.amount
        group.slots.push(slot)
    }

    return groups
}

function buildOperationPlan({
    machine,
    recipes,
    mode,
    modeProfile,
    settings
}) {
    const inputGroups = collectInputGroups(machine, recipes)
    if (!inputGroups.length) {
        return {
            ready: false,
            message: 'Insert Items',
            hasCandidateInput: false,
            inputGroupCount: 0,
            selectedGroup: null,
            focusGroup: null,
            modeProfile
        }
    }

    const yieldBoost = machine.boosts.overclockYield ?? 1
    const baseEnergyCost = settings?.machine?.energy_cost ?? 1
    const groupPlans = inputGroups.map(group =>
        buildGroupPlan(machine, group, modeProfile, yieldBoost, baseEnergyCost)
    )

    const selectedGroup = groupPlans.find(group => group.ready) ?? null
    if (selectedGroup) {
        const energyCost = Math.max(1, Math.ceil(selectedGroup.energyCost * modeProfile.energyModifier))
        return {
            ready: true,
            message: null,
            hasCandidateInput: true,
            inputGroupCount: groupPlans.length,
            selectedGroup,
            focusGroup: selectedGroup,
            groupPlans,
            modeProfile,
            energyCost,
            referenceRecipe: buildReferenceRecipe(selectedGroup, energyCost)
        }
    }

    const focusGroup = (
        groupPlans.find(group => group.invalidOutput)
        ?? groupPlans.find(group => group.invalidRecipe)
        ?? groupPlans.find(group => group.outputConflict)
        ?? groupPlans.find(group => group.outputFull)
        ?? groupPlans.find(group => group.missingInput)
        ?? groupPlans[0]
    )

    return {
        ready: false,
        message: determineWarningMessage(groupPlans, mode),
        hasCandidateInput: true,
        inputGroupCount: groupPlans.length,
        selectedGroup: null,
        focusGroup,
        groupPlans,
        modeProfile
    }
}

function buildGroupPlan(machine, group, modeProfile, yieldBoost, baseEnergyCost) {
    const recipe = group.recipe
    const craftCount = getCraftCountForProfile(modeProfile)
    const plan = {
        ...group,
        ready: false,
        invalidRecipe: false,
        invalidOutput: false,
        outputConflict: false,
        outputFull: false,
        missingInput: false,
        batchSize: craftCount,
        inputNeeded: 0,
        outputAmount: 0,
        energyCost: 0,
        outputPlan: null
    }

    if (!recipe) {
        plan.invalidRecipe = true
        return plan
    }

    if (!isValidItemId(recipe.output?.id)) {
        plan.invalidOutput = true
        return plan
    }

    plan.inputNeeded = (recipe.input.amount ?? 1) * craftCount
    plan.outputAmount = estimateOperationOutput(recipe, craftCount, yieldBoost)
    plan.energyCost = Math.max(1, (recipe.energyCost ?? baseEnergyCost) * craftCount)
    plan.missingInput = group.totalAmount < plan.inputNeeded
    plan.outputPlan = buildOutputPlan(machine, recipe.output.id)
    plan.outputConflict = plan.outputPlan.compatibleSlotCount <= 0
    plan.outputFull = plan.outputPlan.totalSpace < plan.outputAmount
    plan.ready = !plan.missingInput && !plan.outputConflict && !plan.outputFull

    return plan
}

function buildReferenceRecipe(groupPlan, energyCost) {
    return {
        energyCost,
        seconds: Number(groupPlan?.recipe?.seconds ?? 4),
        ticks: Number(groupPlan?.recipe?.ticks ?? 80)
    }
}

function determineWarningMessage(groupPlans, mode) {
    if (groupPlans.some(group => group.invalidOutput)) return 'Output Missing'
    if (groupPlans.some(group => group.invalidRecipe)) return 'Input Invalid'
    if (groupPlans.some(group => group.outputConflict)) return 'Output Conflict'
    if (groupPlans.some(group => group.outputFull)) return 'Output Full'
    if (groupPlans.some(group => group.missingInput)) {
        return mode.id === ARC_PRESS_FORGE.modes.high_speed.id
            ? 'Need Full Batch'
            : 'Missing Items'
    }
    return 'Insert Items'
}

function estimateOperationOutput(recipe, crafts, yieldBoost = 1) {
    const amount = (recipe.output?.amount ?? 1) * Math.max(1, crafts) * Math.max(1, yieldBoost)
    return Math.max(1, Math.ceil(amount))
}

function buildOutputPlan(machine, outputId) {
    const slots = []
    let totalSpace = 0
    let compatibleSlotCount = 0

    for (const slot of ARC_PRESS_FORGE.slots.outputs) {
        const stack = machine.inv.getItem(slot)
        if (!stack) {
            const maxAmount = resolveMaxStackSize(null, outputId)
            slots.push({
                slot,
                empty: true,
                compatible: true,
                space: maxAmount
            })
            compatibleSlotCount += 1
            totalSpace += maxAmount
            continue
        }

        if (stack.typeId !== outputId) {
            slots.push({
                slot,
                empty: false,
                compatible: false,
                space: 0
            })
            continue
        }

        const maxAmount = resolveMaxStackSize(stack, outputId)
        const space = Math.max(0, maxAmount - stack.amount)
        slots.push({
            slot,
            empty: false,
            compatible: true,
            space
        })
        compatibleSlotCount += 1
        totalSpace += space
    }

    return {
        slots,
        totalSpace,
        compatibleSlotCount
    }
}

function resolveMaxStackSize(slot, outputId) {
    if (slot?.maxAmount) return slot.maxAmount
    if (!outputId) return 64

    try {
        const probe = new ItemStack(outputId, 1)
        if (probe?.maxAmount) return probe.maxAmount
        const component = probe?.getComponent?.('minecraft:max_stack_size')
        if (typeof component?.value === 'number') return component.value
    } catch {
        // ignore invalid probes and fall back to a standard stack size
    }

    return 64
}

function consumeGroupedInput(machine, groupPlan, amount) {
    let remaining = Math.max(0, amount)
    for (const slot of groupPlan.slots) {
        if (remaining <= 0) break

        const current = machine.inv.getItem(slot)
        if (!current || current.typeId !== groupPlan.typeId) continue

        const consumed = Math.min(current.amount, remaining)
        if (consumed <= 0) continue

        machine.entity.changeItemAmount(slot, -consumed)
        remaining -= consumed
    }

    return remaining <= 0
}

function distributeOutput(machine, outputId, amount) {
    let remaining = Math.max(0, amount)
    if (remaining <= 0) return 0

    const maxAmount = resolveMaxStackSize(null, outputId)

    for (const slot of ARC_PRESS_FORGE.slots.outputs) {
        if (remaining <= 0) break

        const current = machine.inv.getItem(slot)
        if (!current || current.typeId !== outputId) continue

        const space = Math.max(0, resolveMaxStackSize(current, outputId) - current.amount)
        const inserted = Math.min(space, remaining)
        if (inserted <= 0) continue

        machine.entity.changeItemAmount(slot, inserted)
        remaining -= inserted
    }

    for (const slot of ARC_PRESS_FORGE.slots.outputs) {
        if (remaining <= 0) break

        const current = machine.inv.getItem(slot)
        if (current) continue

        const inserted = Math.min(maxAmount, remaining)
        if (inserted <= 0) continue

        machine.entity.setItem(slot, outputId, inserted)
        remaining -= inserted
    }

    if (remaining > 0) {
        try {
            machine.dim.spawnItem(new ItemStack(outputId, remaining), machine.block.center())
        } catch {
            // ignore emergency output spill failures
        }
    }

    return amount - remaining
}

function processCraft(machine, operation) {
    const group = operation.selectedGroup
    const recipe = group.recipe
    const yieldBoost = machine.boosts.overclockYield ?? 1
    const craftCount = getCraftCountForProfile(operation.modeProfile)

    consumeGroupedInput(machine, group, group.inputNeeded)

    const rawOutput = (recipe.output.amount ?? 1) * craftCount * yieldBoost
    let produced = machine.addFractionalItem(recipe.output.id, rawOutput)
    let lostItems = 0

    if (operation.modeProfile.lossChance > 0 && produced > 0 && Math.random() < operation.modeProfile.lossChance) {
        produced -= 1
        lostItems = 1
    }

    const inserted = distributeOutput(machine, recipe.output.id, produced)

    return {
        typeId: group.typeId,
        availableAmount: group.totalAmount,
        batchSize: craftCount,
        inputNeeded: group.inputNeeded,
        produced: inserted,
        lostItems,
        outputId: recipe.output.id
    }
}

function getCraftCountForProfile(modeProfile) {
    return Math.max(1, Math.floor(Number(modeProfile?.batchSize) || 1))
}

function isQuantityUpgradeItem(item) {
    if (!item?.typeId) return false

    if (item.typeId === 'utilitycraft:quantity_upgrade') {
        return true
    }

    if (typeof item.hasTag === 'function' && item.hasTag('utilitycraft:quantity_upgrade')) {
        return true
    }

    const [, raw = ''] = item.typeId.split(':')
    return raw === 'quantity_upgrade'
}

function buildModeButtonLore(mode) {
    if (mode.id === ARC_PRESS_FORGE.modes.low_loss.id) {
        return [
            '§72.0x base speed.',
            '§7Treats matching inputs as one combined pool.',
            '§7Processes one craft at a time with no loss chance.'
        ]
    }

    return [
        '§7Treats matching inputs as one combined pool.',
        '§7Q0: 2 crafts, 50% loss chance.',
        '§7Q1-3: 4 / 6 / 8 crafts, 25% loss chance.',
        '§7Q4: 4 crafts, 0% loss chance.'
    ]
}

function buildMachineLore(mode, context = {}) {
    const lines = [
        `§bMode: §f${mode.title}`,
        `§7${mode.description}`
    ]

    const quantityLevel = Number(context.quantityLevel ?? 0)
    const modeProfile = context.modeProfile ?? getModeProfile(mode, quantityLevel)
    const operation = context.operation
    const focusGroup = context.focusGroup

    lines.push(`§7Batch Size: §f${modeProfile.batchSize}`)
    lines.push(`§7Loss Chance: §f${Math.round(modeProfile.lossChance * 100)}%`)

    if (mode.id === ARC_PRESS_FORGE.modes.low_loss.id) {
        lines.push('§72.00x base speed')
    } else {
        lines.push(`§7Quantity Level: §f${quantityLevel}`)
    }

    if (operation?.inputGroupCount > 1) {
        lines.push(`§7Queued Types: §f${operation.inputGroupCount}`)
    }

    if (focusGroup?.recipe) {
        lines.push(`§7Input Pool: §f${formatItemName(focusGroup.typeId)} x${focusGroup.totalAmount}`)
        lines.push(`§7Input Need: §f${focusGroup.inputNeeded}`)
        lines.push(`§7Recipe: §f${formatItemName(focusGroup.recipe.input.id)} -> ${formatItemName(focusGroup.recipe.output.id)}`)
        if (focusGroup.outputPlan) {
            lines.push(`§7Output Space: §f${focusGroup.outputPlan.totalSpace}`)
        }
    } else if (focusGroup?.typeId) {
        lines.push(`§7Input Pool: §f${formatItemName(focusGroup.typeId)} x${focusGroup.totalAmount}`)
    }

    if (context.lastCraft?.lostItems > 0) {
        lines.push(`§6Batch loss: §f-${context.lastCraft.lostItems} item`)
    }

    if (context.lastCraft?.produced > 0 && context.lastCraft?.outputId) {
        lines.push(`§8Produced ${context.lastCraft.produced} ${formatItemName(context.lastCraft.outputId)}`)
    }

    return lines
}

function buildFooterLines(machine, mode, quantityLevel) {
    const modeProfile = getModeProfile(mode, quantityLevel)
    const lines = [
        `Mode: ${mode.title}`,
        `Batch: ${modeProfile.batchSize}`,
        `Loss: ${Math.round(modeProfile.lossChance * 100)}%`
    ]

    const overclockLine = buildOverclockLoreLine(machine)
    if (overclockLine) {
        lines.push(overclockLine.replace(/^§r/, ''))
    }

    return lines
}

function showMachineWarning(machine, message, mode, context = {}, resetProgress = true) {
    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(mode, context),
        { footerLines: buildFooterLines(machine, mode, context.quantityLevel ?? 0) }
    )
}

function showMachineStatus(machine, message, mode, context = {}) {
    machine.on()
    machine.displayEnergy()
    machine.displayProgress(ARC_PRESS_FORGE.slots.progress)
    machine.showStatus(
        message,
        buildMachineLore(mode, context),
        { footerLines: buildFooterLines(machine, mode, context.quantityLevel ?? 0) }
    )
}

function transferOutputLanes(machine) {
    let transferred = false
    for (const slot of ARC_PRESS_FORGE.slots.outputs) {
        transferred = transferSlotForward(machine, slot) || transferred
    }
    return transferred
}

function transferSlotForward(machine, slotIndex) {
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

function isValidItemId(id) {
    if (!id || typeof id !== 'string') return false
    try {
        new ItemStack(id, 1)
        return true
    } catch {
        return false
    }
}

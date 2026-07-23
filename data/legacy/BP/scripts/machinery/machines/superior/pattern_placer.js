import { BlockPermutation, ItemStack } from '@minecraft/server'
import {
    Machine,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName
} from '../../../DoriosCore/main.js'
import {
    formatEnergyCost,
    formatMachineEnergyBuffer,
    getContainerTransferSlots,
    resolveEffectiveEnergyCost,
    resolveManualProgressSpendRate,
    resolveAboveContainer,
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from './utils.js'

const PATTERN_PLACER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        activationButton: 12,
        inputs: Object.freeze([4, 5, 6, 7]),
        upgrades: Object.freeze([9, 10, 11]),
        hidden: Object.freeze([])
    }),
    defaults: Object.freeze({
        energyCost: 200,
        lineLength: 5
    }),
    modes: Object.freeze({
        single: Object.freeze({
            id: 'single',
            title: '1x1',
            description: 'Places a single block directly in front of the machine.'
        }),
        plane3x3: Object.freeze({
            id: 'plane3x3',
            title: '3x3',
            description: 'Places a 3x3 face that starts one block above the front center.'
        }),
        cube3x3x3: Object.freeze({
            id: 'cube3x3x3',
            title: '3x3x3',
            description: 'Places a 3x3x3 volume that starts one block above the front center.'
        }),
        line: Object.freeze({
            id: 'line',
            title: 'Line',
            description: 'Places a straight line of 5 blocks forward.',
            length: 5
        })
    })
})

const PATTERN_PLACER_BUTTONS = Object.freeze({
    id: 'pattern_placer_mode',
    namespace: 'ascendant:pattern_placer',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: PATTERN_PLACER.modes.single.id,
        enabled: true
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_cycle',
            property: 'mode',
            slot: PATTERN_PLACER.slots.modeButton,
            type: 'cycle',
            values: Object.freeze([
                PATTERN_PLACER.modes.single.id,
                PATTERN_PLACER.modes.plane3x3.id,
                PATTERN_PLACER.modes.cube3x3x3.id,
                PATTERN_PLACER.modes.line.id
            ]),
            defaultValue: PATTERN_PLACER.modes.single.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeButtonLore(getMode(state.mode)),
            pressHint: 'Take the switch to cycle the placement mode.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, PATTERN_PLACER.slots.progress)
            }
        }),
        Object.freeze({
            id: 'activation_toggle',
            property: 'enabled',
            slot: PATTERN_PLACER.slots.activationButton,
            type: 'toggle',
            defaultValue: true,
            activeValue: true,
            inactiveValue: false,
            iconItemId: 'utilitycraft:switch_button',
            inactiveIconItemId: 'utilitycraft:switch_button',
            activeIconItemId: 'utilitycraft:switch_button_pressed',
            getTitle: ({ state }) => `Active: ${state.enabled ? 'On' : 'Off'}`,
            getLore: ({ state }) => buildActivationButtonLore(state.enabled === true),
            pressHint: 'Take the switch to toggle automatic placement.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, PATTERN_PLACER.slots.progress)
            }
        })
    ])
})

DoriosAPI.register.blockComponent('pattern_placer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings?.machine?.energy_cost ?? PATTERN_PLACER.defaults.energyCost)
            machine.displayEnergy(PATTERN_PLACER.slots.energy)
            machine.displayProgress(PATTERN_PLACER.slots.progress)
            machine.blockSlots(PATTERN_PLACER.slots.hidden)
            syncSuperiorButtonPanel(machine, PATTERN_PLACER_BUTTONS, {
                detectPresses: false,
                forceRender: true
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'pattern_placer:ui')
        const panelState = syncSuperiorButtonPanel(machine, PATTERN_PLACER_BUTTONS, {
            forceRender: shouldRefreshUi
        })

        const mode = getMode(panelState.mode)
        const enabled = panelState.enabled !== false
        const supplyResult = enabled
            ? pullInputBlocksFromAbove(machine)
            : { movedCount: 0, source: null }
        const operation = buildOperation(machine, mode, settings, supplyResult, enabled)

        if (!enabled) {
            showMachineWarning(machine, 'Disabled', operation, false, shouldRefreshUi)
            return
        }

        if (!operation.anchorBlock) {
            showMachineWarning(machine, 'No Target', operation, true, shouldRefreshUi)
            return
        }

        if (!operation.hasAnyInput) {
            showMachineWarning(machine, 'No Block', operation, false, shouldRefreshUi)
            return
        }

        if (!operation.inputPermutation) {
            showMachineWarning(machine, 'Invalid Block', operation, false, shouldRefreshUi)
            return
        }

        if (!operation.placeableTargets.length || operation.placeCount <= 0) {
            showMachineWarning(machine, operation.hasPotentialTarget ? 'No Space' : 'No Target', operation, false, shouldRefreshUi)
            return
        }

        machine.setEnergyCost(operation.energyCost)

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, 'No Energy', operation, false, shouldRefreshUi)
            return
        }

        const progress = machine.getProgress()
        if (progress >= operation.energyCost) {
            const result = executeOperation(operation)
            if (result.placedCount <= 0) {
                machine.setProgress(0, PATTERN_PLACER.slots.progress)
                showMachineWarning(machine, 'No Space', {
                    ...operation,
                    result
                }, false, shouldRefreshUi)
                return
            }

            consumeInputItems(machine.inv, PATTERN_PLACER.slots.inputs, operation.inputStack, result.placedCount)
            machine.addProgress(-(operation.baseEnergyCost * result.placedCount))
            showMachineStatus(machine, 'Placing', {
                ...operation,
                result
            }, shouldRefreshUi)
            return
        }

        const consumption = machine.boosts.consumption
        const spendRate = resolveManualProgressSpendRate(machine)
        const energyToConsume = Math.min(
            machine.energy.get(),
            spendRate,
            Math.max(0, operation.energyCost - progress) * consumption
        )

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume)
            machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON))
        }

        showMachineStatus(machine, 'Charging', operation, shouldRefreshUi)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getMode(modeId) {
    return Object.values(PATTERN_PLACER.modes).find(mode => mode.id === modeId) ?? PATTERN_PLACER.modes.single
}

function buildOperation(machine, mode, settings, supplyResult = {}, enabled = true) {
    const inv = machine.inv
    const anchorBlock = machine.block.getFacingBlock?.() ?? null
    const targetPositions = anchorBlock
        ? buildTargetPositions(machine.block, anchorBlock.location, mode)
        : []
    const targetBlocks = targetPositions
        .map(pos => machine.dim.getBlock(pos))
        .filter(Boolean)

    const inputEntries = getInputEntries(inv, PATTERN_PLACER.slots.inputs)
    const validInputEntries = inputEntries.filter(entry => entry.permutation)
    const selectedInput = validInputEntries[0] ?? null
    const matchingInputEntries = selectedInput
        ? validInputEntries.filter(entry => areEquivalentStacks(entry.stack, selectedInput.stack))
        : []
    const inputStack = selectedInput?.stack ?? null
    const inputPermutation = selectedInput?.permutation ?? null
    const availableInputCount = matchingInputEntries.reduce((total, entry) => total + (entry.stack?.amount ?? 0), 0)
    const placeableTargets = inputPermutation
        ? targetBlocks.filter(isPlaceableTarget)
        : []
    const placeCount = Math.min(availableInputCount, placeableTargets.length)
    const baseEnergyCost = Number(settings?.machine?.energy_cost ?? PATTERN_PLACER.defaults.energyCost)
    const energyCost = Math.max(1, baseEnergyCost * Math.max(1, placeCount))
    const effectiveEnergyCost = resolveEffectiveEnergyCost(energyCost, machine?.boosts?.consumption ?? 1)
    const normalizedSupply = supplyResult && typeof supplyResult === 'object' ? supplyResult : {}

    return {
        machine,
        mode,
        enabled,
        anchorBlock,
        targetPositions,
        targetBlocks,
        hasAnyInput: inputEntries.length > 0,
        inputStack,
        inputPermutation,
        availableInputCount,
        placeableTargets,
        placeCount,
        hasPotentialTarget: targetBlocks.length > 0,
        blockedCount: Math.max(0, targetBlocks.length - placeableTargets.length),
        baseEnergyCost,
        energyCost,
        effectiveEnergyCost,
        supplySource: normalizedSupply.source ?? null,
        supplyPulledCount: Math.max(0, Number(normalizedSupply.movedCount ?? 0)),
        lineLength: mode.id === PATTERN_PLACER.modes.line.id
            ? Number(mode.length ?? PATTERN_PLACER.defaults.lineLength)
            : 0
    }
}

function buildTargetPositions(block, anchor, mode) {
    const forward = getForwardVector(block, anchor)
    if (!forward) return []

    if (mode.id === PATTERN_PLACER.modes.single.id) {
        return [anchor]
    }

    if (mode.id === PATTERN_PLACER.modes.line.id) {
        const length = Math.max(1, Number(mode.length ?? PATTERN_PLACER.defaults.lineLength))
        const positions = []
        for (let step = 0; step < length; step++) {
            positions.push({
                x: anchor.x + (forward.x * step),
                y: anchor.y + (forward.y * step),
                z: anchor.z + (forward.z * step)
            })
        }
        return positions
    }

    if (mode.id === PATTERN_PLACER.modes.cube3x3x3.id) {
        return buildCubePositions(anchor, forward)
    }

    return buildPlanePositions(anchor, forward)
}

function getForwardVector(block, anchor) {
    if (!block?.location || !anchor) return null
    const vector = {
        x: Math.sign(anchor.x - block.location.x),
        y: Math.sign(anchor.y - block.location.y),
        z: Math.sign(anchor.z - block.location.z)
    }

    if (!vector.x && !vector.y && !vector.z) return null
    return vector
}

function buildPlanePositions(anchor, forward) {
    const positions = []
    const yOffsets = [0, 1, 2]

    if (forward.x !== 0) {
        for (const dy of yOffsets) {
            for (let dz = -1; dz <= 1; dz++) {
                positions.push({ x: anchor.x, y: anchor.y + dy, z: anchor.z + dz })
            }
        }
        return positions
    }

    if (forward.z !== 0) {
        for (let dx = -1; dx <= 1; dx++) {
            for (const dy of yOffsets) {
                positions.push({ x: anchor.x + dx, y: anchor.y + dy, z: anchor.z })
            }
        }
        return positions
    }

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            positions.push({ x: anchor.x + dx, y: anchor.y + 1, z: anchor.z + dz })
        }
    }
    return positions
}

function buildCubePositions(anchor, forward) {
    const positions = []
    const yOffsets = [0, 1, 2]

    if (forward.x !== 0) {
        for (let depth = 0; depth < 3; depth++) {
            for (const dy of yOffsets) {
                for (let dz = -1; dz <= 1; dz++) {
                    positions.push({
                        x: anchor.x + (forward.x * depth),
                        y: anchor.y + dy,
                        z: anchor.z + dz
                    })
                }
            }
        }
        return positions
    }

    if (forward.z !== 0) {
        for (let depth = 0; depth < 3; depth++) {
            for (let dx = -1; dx <= 1; dx++) {
                for (const dy of yOffsets) {
                    positions.push({
                        x: anchor.x + dx,
                        y: anchor.y + dy,
                        z: anchor.z + (forward.z * depth)
                    })
                }
            }
        }
        return positions
    }

    for (let depth = 0; depth < 3; depth++) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                positions.push({
                    x: anchor.x + dx,
                    y: anchor.y + 1 + (forward.y * depth),
                    z: anchor.z + dz
                })
            }
        }
    }

    return positions
}

function isPlaceableTarget(block) {
    return Boolean(block?.isAir)
}

function resolveInputPermutation(stack) {
    if (!stack?.typeId) return null
    try {
        return BlockPermutation.resolve(stack.typeId)
    } catch {
        return null
    }
}

function getInputEntries(container, slots = []) {
    if (!container || !Array.isArray(slots)) return []

    const entries = []
    for (const slot of slots) {
        const stack = container.getItem(slot)
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue

        entries.push({
            slot,
            stack,
            permutation: resolveInputPermutation(stack)
        })
    }

    return entries
}

function pullInputBlocksFromAbove(machine) {
    const source = resolveAboveContainer(machine, {
        requireMachineFacing: true
    })
    if (!source?.container || !machine?.inv) {
        return { movedCount: 0, source: null }
    }

    const sourceSlots = getContainerTransferSlots(source, 'output')
    let movedCount = 0

    for (const sourceSlot of sourceSlots) {
        movedCount += transferBlockInputToSlots(source.container, sourceSlot, machine.inv, PATTERN_PLACER.slots.inputs)
    }

    return {
        movedCount,
        source
    }
}

function transferBlockInputToSlots(sourceContainer, sourceSlot, targetContainer, targetSlots) {
    if (!sourceContainer || !targetContainer || !Array.isArray(targetSlots) || targetSlots.length === 0) return 0

    const sourceItem = sourceContainer.getItem(sourceSlot)
    if (!sourceItem?.typeId || resolveInputPermutation(sourceItem) == null) return 0

    const initialAmount = Number(sourceItem.amount) || 0
    let remaining = Number(sourceItem.amount) || 0
    if (remaining <= 0) return 0

    for (const slot of targetSlots) {
        const targetItem = targetContainer.getItem(slot)
        if (!areEquivalentStacks(targetItem, sourceItem)) continue

        const space = Math.max(0, (targetItem.maxAmount ?? 64) - targetItem.amount)
        if (space <= 0) continue

        const moved = Math.min(space, remaining)
        targetItem.amount += moved
        targetContainer.setItem(slot, targetItem)
        remaining -= moved

        if (remaining <= 0) break
    }

    for (const slot of targetSlots) {
        if (remaining <= 0) break

        const targetItem = targetContainer.getItem(slot)
        if (targetItem) continue

        const moved = Math.min(sourceItem.maxAmount ?? 64, remaining)
        targetContainer.setItem(slot, cloneItemStack(sourceItem, moved))
        remaining -= moved
    }

    if (remaining <= 0) {
        sourceContainer.setItem(sourceSlot, undefined)
    } else if (remaining !== sourceItem.amount) {
        sourceItem.amount = remaining
        sourceContainer.setItem(sourceSlot, sourceItem)
    }

    return Math.max(0, initialAmount - remaining)
}

function cloneItemStack(stack, amount = stack?.amount ?? 1) {
    if (typeof stack?.clone === 'function') {
        const clone = stack.clone()
        clone.amount = amount
        return clone
    }

    const clone = new ItemStack(stack.typeId, amount)
    if (stack?.nameTag) clone.nameTag = stack.nameTag
    const lore = typeof stack?.getLore === 'function' ? stack.getLore() : []
    if (Array.isArray(lore) && lore.length && typeof clone.setLore === 'function') {
        clone.setLore(lore)
    }
    return clone
}

function consumeInputItems(container, slots, referenceStack, amount) {
    if (!container || !Array.isArray(slots) || !referenceStack?.typeId || amount <= 0) return 0

    let remaining = amount

    for (const slot of slots) {
        const current = container.getItem(slot)
        if (!areEquivalentStacks(current, referenceStack)) continue

        const currentAmount = Number(current.amount) || 0
        const amountToConsume = Math.min(currentAmount, remaining)
        if (amountToConsume <= 0) continue

        const nextAmount = currentAmount - amountToConsume
        if (nextAmount <= 0) {
            container.setItem(slot, undefined)
        } else {
            current.amount = nextAmount
            container.setItem(slot, current)
        }

        remaining -= amountToConsume
        if (remaining <= 0) break
    }

    return amount - remaining
}

function areEquivalentStacks(left, right) {
    if (!left || !right) return false
    if (left.typeId !== right.typeId) return false
    if ((left.nameTag ?? '') !== (right.nameTag ?? '')) return false

    const leftLore = typeof left.getLore === 'function' ? (left.getLore() ?? []) : []
    const rightLore = typeof right.getLore === 'function' ? (right.getLore() ?? []) : []
    if (leftLore.length !== rightLore.length) return false

    return leftLore.every((line, index) => line === rightLore[index])
}

function executeOperation(operation) {
    let placedCount = 0
    let failedCount = 0

    for (const block of operation.placeableTargets.slice(0, operation.placeCount)) {
        if (!isPlaceableTarget(block)) {
            failedCount += 1
            continue
        }

        try {
            block.setPermutation(operation.inputPermutation)
            placedCount += 1
        } catch {
            failedCount += 1
        }
    }

    return {
        placedCount,
        failedCount
    }
}

function buildModeButtonLore(mode) {
    const lines = [
        `§7Pattern: §f${mode.title}`
    ]

    if (mode.id === PATTERN_PLACER.modes.line.id) {
        lines.push(`§7Length: §f${mode.length ?? PATTERN_PLACER.defaults.lineLength}`)
    } else if (mode.id === PATTERN_PLACER.modes.cube3x3x3.id) {
        lines.push('§7Area: §f3x3x3')
    } else if (mode.id === PATTERN_PLACER.modes.plane3x3.id) {
        lines.push('§7Area: §f3x3')
    } else {
        lines.push('§7Area: §f1x1')
    }
    return lines
}

function buildActivationButtonLore(active) {
    return [
        `§7Status: ${active ? '§aEnabled' : '§7Disabled'}`,
        '§7Toggles automatic pattern placement.'
    ]
}

function buildMachineLore(operation = {}) {
    const machine = operation.machine
    const lines = []
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, '')

    const machineInfo = [
        {
            label: 'Energy',
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: 'Mode',
            value: operation.mode?.title ?? '1x1'
        },
        {
            label: 'Activation',
            value: operation.enabled === false ? 'Disabled' : 'Enabled',
            valueColor: operation.enabled === false ? '§7' : '§a'
        }
    ]
    if (overclockLine) machineInfo.push(overclockLine)

    appendLoreSection(lines, 'Machine Information', machineInfo, {
        spacing: false
    })

    const placementInfo = [
        {
            label: 'Available',
            value: operation.availableInputCount ?? 0
        },
        {
            label: 'Targets',
            value: operation.placeableTargets?.length ?? 0
        },
        {
            label: 'To Place',
            value: operation.placeCount ?? 0
        },
        {
            label: 'Cost',
            value: formatEnergyCost(operation.effectiveEnergyCost ?? operation.energyCost ?? 0)
        }
    ]

    if ((operation.blockedCount ?? 0) > 0) {
        placementInfo.push({
            label: 'Blocked',
            value: operation.blockedCount
        })
    }

    if (operation.mode?.id === PATTERN_PLACER.modes.line.id) {
        placementInfo.push({
            label: 'Length',
            value: operation.lineLength
        })
    }

    appendLoreSection(lines, 'Placement Information', placementInfo)

    const targetInfo = []
    if (operation.inputStack?.typeId) {
        targetInfo.push({
            label: 'Input Block',
            value: formatItemName(operation.inputStack.typeId)
        })
    }

    if (operation.anchorBlock?.typeId) {
        targetInfo.push({
            label: 'Front Block',
            value: formatItemName(operation.anchorBlock.typeId)
        })
    }

    if (operation.supplySource?.block?.typeId) {
        targetInfo.push({
            label: 'Supply',
            value: formatItemName(operation.supplySource.block.typeId)
        })
    }

    if (targetInfo.length > 0) {
        appendLoreSection(lines, 'Target Information', targetInfo)
    }

    const lastAction = []
    if (operation.supplyPulledCount > 0) {
        lastAction.push(`§7Pulled Above: §f${operation.supplyPulledCount} block(s)`)
    }
    if (operation.result?.failedCount > 0) {
        lastAction.push(`§6Skipped Positions: §f${operation.result.failedCount}`)
    }
    if (operation.result?.placedCount > 0) {
        lastAction.push(`§7Placed: §f${operation.result.placedCount} block(s)`)
    }

    if (lastAction.length > 0) {
        appendLoreSection(lines, 'Last Action', lastAction)
    }

    return lines
}

function buildFooterLines(operation = {}) {
    const lines = [
        `Mode: ${operation.mode?.title ?? '1x1'}`,
        `Active: ${operation.enabled === false ? 'Off' : 'On'}`
    ]

    if (operation.mode?.id === PATTERN_PLACER.modes.line.id) {
        lines.push(`Length: ${operation.lineLength}`)
    }

    return lines
}

function updateDisplays(machine, refreshUi = true) {
    if (!refreshUi) return

    machine.displayEnergy(PATTERN_PLACER.slots.energy)
    machine.displayProgress(PATTERN_PLACER.slots.progress)
}

function showMachineWarning(machine, message, operation = {}, resetProgress = false, refreshUi = true) {
    machine.off()
    if (!refreshUi) return

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(operation),
        {
            footerLines: buildFooterLines(operation),
            displayModel: 'minimal'
        }
    )
    updateDisplays(machine, true)
}

function showMachineStatus(machine, message, operation = {}, refreshUi = true) {
    machine.on()
    if (!refreshUi) return

    machine.showStatus(
        message,
        buildMachineLore(operation),
        {
            footerLines: buildFooterLines(operation),
            displayModel: 'minimal'
        }
    )
    updateDisplays(machine, true)
}
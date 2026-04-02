import { BlockPermutation } from '@minecraft/server'
import {
    Machine,
    Energy,
    buildOverclockLoreLine,
    formatItemName,
    syncButtonPanel
} from '../../DoriosCore/index.js'

const PATTERN_PLACER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        inputs: Object.freeze([4, 5, 6, 7]),
        upgrades: Object.freeze([9, 10, 11]),
        hidden: Object.freeze([12])
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
        mode: PATTERN_PLACER.modes.single.id
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
            syncButtonPanel(machine, PATTERN_PLACER_BUTTONS, {
                detectPresses: false,
                cleanupRadius: 12,
                cleanupIntervalTicks: 20,
                dropCleanupRadius: 8
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const panelState = syncButtonPanel(machine, PATTERN_PLACER_BUTTONS, {
            cleanupRadius: 12,
            cleanupIntervalTicks: 20,
            dropCleanupRadius: 8
        })

        const mode = getMode(panelState.mode)
        const operation = buildOperation(machine, mode, settings)

        if (!operation.anchorBlock) {
            showMachineWarning(machine, 'No Target', operation, true)
            return
        }

        if (!operation.hasAnyInput) {
            showMachineWarning(machine, 'No Block', operation, false)
            return
        }

        if (!operation.inputPermutation) {
            showMachineWarning(machine, 'Invalid Block', operation, false)
            return
        }

        if (!operation.placeableTargets.length || operation.placeCount <= 0) {
            showMachineWarning(machine, operation.hasPotentialTarget ? 'No Space' : 'No Target', operation, false)
            return
        }

        machine.setEnergyCost(operation.energyCost)

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, 'No Energy', operation, false)
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
                }, false)
                return
            }

            consumeInputItems(machine.inv, PATTERN_PLACER.slots.inputs, operation.inputStack, result.placedCount)
            machine.addProgress(-(operation.baseEnergyCost * result.placedCount))
            showMachineStatus(machine, 'Placing', {
                ...operation,
                result
            })
            return
        }

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

        showMachineStatus(machine, 'Charging', operation)
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function getMode(modeId) {
    return Object.values(PATTERN_PLACER.modes).find(mode => mode.id === modeId) ?? PATTERN_PLACER.modes.single
}

function buildOperation(machine, mode, settings) {
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

    return {
        machine,
        mode,
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

function consumeInputItems(container, slots, referenceStack, amount) {
    if (!container || !Array.isArray(slots) || !referenceStack?.typeId || amount <= 0) return 0

    let remaining = amount

    for (const slot of slots) {
        const current = container.getItem(slot)
        if (!areEquivalentStacks(current, referenceStack)) continue

        const amountToConsume = Math.min(current.amount, remaining)
        if (amountToConsume <= 0) continue

        current.amount -= amountToConsume
        if (current.amount <= 0) {
            container.setItem(slot, undefined)
        } else {
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
        `§7${mode.description}`
    ]

    if (mode.id === PATTERN_PLACER.modes.line.id) {
        lines.push(`§7Forward Length: §f${mode.length ?? PATTERN_PLACER.defaults.lineLength}`)
    } else if (mode.id === PATTERN_PLACER.modes.cube3x3x3.id) {
        lines.push('§7Placement Volume: §f27 blocks')
        lines.push('§7Grid Offset: §f+1Y')
    } else if (mode.id === PATTERN_PLACER.modes.plane3x3.id) {
        lines.push('§7Placement Face: §f9 blocks')
        lines.push('§7Grid Offset: §f+1Y')
    } else {
        lines.push('§7Placement Face: §f1 block')
    }

    lines.push('§7Energy cost scales with the amount of blocks placed.')
    return lines
}

function buildMachineLore(operation = {}) {
    const machine = operation.machine
    const lines = [
        `§bMode: §f${operation.mode?.title ?? '1x1'}`,
        `§7${operation.mode?.description ?? ''}`,
        `§7Available Blocks: §f${operation.availableInputCount ?? 0}`,
        `§7Target Slots: §f${operation.placeableTargets?.length ?? 0}`,
        `§7Blocked Positions: §f${operation.blockedCount ?? 0}`,
        `§7Placements Ready: §f${operation.placeCount ?? 0}`,
        `§cCost: §f${Energy.formatEnergyToText(operation.energyCost ?? 0)}`,
        `§7Speed: §f${machine?.boosts?.speed?.toFixed?.(2) ?? '1.00'}x`,
        `§7Efficiency: §f${(((1 / (machine?.boosts?.consumption ?? 1)) * 100)).toFixed(0)}%`,
        `§7Rate: §f${Energy.formatEnergyToText(Math.floor(machine?.baseRate ?? 0))}/t`
    ]

    if (operation.mode?.id === PATTERN_PLACER.modes.line.id) {
        lines.push(`§7Line Length: §f${operation.lineLength}`)
    } else if (
        operation.mode?.id === PATTERN_PLACER.modes.plane3x3.id ||
        operation.mode?.id === PATTERN_PLACER.modes.cube3x3x3.id
    ) {
        lines.push('§7Grid Offset: §f+1Y')
    }

    if (operation.inputStack?.typeId) {
        lines.push(`§7Input Block: §f${formatItemName(operation.inputStack.typeId)}`)
    }

    if (operation.anchorBlock?.typeId) {
        lines.push(`§7Front Block: §f${formatItemName(operation.anchorBlock.typeId)}`)
    }

    if (operation.result?.failedCount > 0) {
        lines.push(`§6Skipped Positions: §f${operation.result.failedCount}`)
    }
    if (operation.result?.placedCount > 0) {
        lines.push(`§8Placed ${operation.result.placedCount} block(s)`)
    }

    const overclockLine = buildOverclockLoreLine(machine)
    if (overclockLine) lines.push(overclockLine.replace(/^§r/, ''))

    return lines
}

function buildFooterLines(operation = {}) {
    const lines = [
        `Mode: ${operation.mode?.title ?? '1x1'}`
    ]

    if (operation.mode?.id === PATTERN_PLACER.modes.line.id) {
        lines.push(`Length: ${operation.lineLength}`)
    } else if (
        operation.mode?.id === PATTERN_PLACER.modes.plane3x3.id ||
        operation.mode?.id === PATTERN_PLACER.modes.cube3x3x3.id
    ) {
        lines.push('Grid: +1Y')
    }

    return lines
}

function updateDisplays(machine) {
    machine.displayEnergy(PATTERN_PLACER.slots.energy)
    machine.displayProgress(PATTERN_PLACER.slots.progress)
}

function showMachineWarning(machine, message, operation = {}, resetProgress = false) {
    machine.off()
    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(operation),
        { footerLines: buildFooterLines(operation) }
    )
    updateDisplays(machine)
}

function showMachineStatus(machine, message, operation = {}) {
    machine.on()
    machine.showStatus(
        message,
        buildMachineLore(operation),
        { footerLines: buildFooterLines(operation) }
    )
    updateDisplays(machine)
}
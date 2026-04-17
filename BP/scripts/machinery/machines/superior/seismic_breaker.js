import { ItemStack, world } from '@minecraft/server'
import {
    Machine,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName,
    syncButtonPanel
} from '../../../DoriosCore/index.js'
import {
    formatEnergyCost,
    formatMachineEnergyBuffer
} from './utils.js'

const SEISMIC_BREAKER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        precisionButton: 4,
        storage: Object.freeze([5, 6, 7, 8]),
        upgrades: Object.freeze([9, 10, 11]),
        hidden: Object.freeze([12])
    }),
    defaults: Object.freeze({
        energyCost: 6400,
        lineLength: 5
    }),
    modes: Object.freeze({
        single: Object.freeze({
            id: 'single',
            title: 'Single (1x1)',
            description: 'Breaks only the block directly in front of the machine.'
        }),
        plane3x3: Object.freeze({
            id: 'plane3x3',
            title: 'Grid (3x3)',
            description: 'Breaks a 3x3 face that starts one block above the front center.'
        }),
        cube3x3x3: Object.freeze({
            id: 'cube3x3x3',
            title: 'Cube (3x3x3)',
            description: 'Breaks a 3x3x3 volume that starts one block above the front center.'
        }),
        line: Object.freeze({
            id: 'line',
            title: 'Line (5x1)',
            description: 'Breaks a straight tunnel of 5 blocks forward.',
            length: 5
        })
    })
})

const SEISMIC_BREAKER_BUTTONS = Object.freeze({
    id: 'seismic_breaker_mode',
    namespace: 'ascendant:seismic_breaker',
    cooldownTicks: 6,
    defaultIconItemId: 'utilitycraft:switch_button',
    defaults: Object.freeze({
        mode: SEISMIC_BREAKER.modes.single.id,
        precision: false
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: 'mode_cycle',
            property: 'mode',
            slot: SEISMIC_BREAKER.slots.modeButton,
            type: 'cycle',
            values: Object.freeze([
                SEISMIC_BREAKER.modes.single.id,
                SEISMIC_BREAKER.modes.plane3x3.id,
                SEISMIC_BREAKER.modes.cube3x3x3.id,
                SEISMIC_BREAKER.modes.line.id
            ]),
            defaultValue: SEISMIC_BREAKER.modes.single.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeButtonLore(getMode(state.mode)),
            pressHint: 'Take the switch to cycle the breaking mode.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, SEISMIC_BREAKER.slots.progress)
            }
        }),
        Object.freeze({
            id: 'precision_toggle',
            property: 'precision',
            slot: SEISMIC_BREAKER.slots.precisionButton,
            type: 'toggle',
            defaultValue: false,
            activeValue: true,
            inactiveValue: false,
            getTitle: ({ state }) => `Precision: ${state.precision ? 'On' : 'Off'}`,
            getLore: ({ state }) => buildPrecisionButtonLore(state.precision === true),
            pressHint: 'Take the switch to toggle precision mode.',
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, SEISMIC_BREAKER.slots.progress)
            }
        })
    ])
})

DoriosAPI.register.blockComponent('seismic_breaker', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings?.machine?.energy_cost ?? SEISMIC_BREAKER.defaults.energyCost)
            machine.displayEnergy(SEISMIC_BREAKER.slots.energy)
            machine.displayProgress(SEISMIC_BREAKER.slots.progress)
            machine.blockSlots(SEISMIC_BREAKER.slots.hidden)
            syncButtonPanel(machine, SEISMIC_BREAKER_BUTTONS, {
                detectPresses: false
            })
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const machine = new Machine(e.block, settings)
        if (!machine.valid || !machine.entity || !machine.inv) return

        const panelState = syncButtonPanel(machine, SEISMIC_BREAKER_BUTTONS)

        const mode = getMode(panelState.mode)
        const precision = panelState.precision === true
        const operation = buildOperation(machine, mode, precision, settings)

        if (!operation.anchorBlock) {
            showMachineWarning(machine, 'No Target', operation, true)
            return
        }

        if (!operation.breakableTargets.length) {
            showMachineWarning(machine, operation.hasPotentialTarget ? 'Nothing to Break' : 'No Target', operation, true)
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
            if (result.brokenCount <= 0) {
                machine.setProgress(0, SEISMIC_BREAKER.slots.progress)
                showMachineWarning(machine, 'Nothing to Break', {
                    ...operation,
                    result
                }, true)
                return
            }

            machine.addProgress(-operation.energyCost)
            showMachineStatus(machine, precision ? 'Precision' : 'Running', {
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
    return Object.values(SEISMIC_BREAKER.modes).find(mode => mode.id === modeId) ?? SEISMIC_BREAKER.modes.single
}

function buildOperation(machine, mode, precision, settings) {
    const anchorBlock = machine.block.getFacingBlock?.() ?? null
    const targetPositions = anchorBlock
        ? buildTargetPositions(machine.block, anchorBlock.location, mode)
        : []
    const targetBlocks = targetPositions
        .map(pos => machine.dim.getBlock(pos))
        .filter(Boolean)

    const breakableTargets = targetBlocks.filter(isBreakableBlock)
    const firstBreakable = breakableTargets[0] ?? null
    const baseEnergyCost = Number(settings?.machine?.energy_cost ?? SEISMIC_BREAKER.defaults.energyCost)
    const energyCost = Math.max(1, baseEnergyCost * Math.max(1, breakableTargets.length))

    return {
        machine,
        mode,
        precision,
        anchorBlock,
        targetPositions,
        targetBlocks,
        breakableTargets,
        hasPotentialTarget: targetBlocks.length > 0,
        blockedCount: Math.max(0, targetBlocks.length - breakableTargets.length),
        energyCost,
        firstBreakable,
        lineLength: mode.id === SEISMIC_BREAKER.modes.line.id
            ? Number(mode.length ?? SEISMIC_BREAKER.defaults.lineLength)
            : 0
    }
}

function buildTargetPositions(block, anchor, mode) {
    const forward = getForwardVector(block, anchor)
    if (!forward) return []

    if (mode.id === SEISMIC_BREAKER.modes.single.id) {
        return [anchor]
    }

    if (mode.id === SEISMIC_BREAKER.modes.line.id) {
        const length = Math.max(1, Number(mode.length ?? SEISMIC_BREAKER.defaults.lineLength))
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

    if (mode.id === SEISMIC_BREAKER.modes.cube3x3x3.id) {
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

function isBreakableBlock(block) {
    if (!block || block.isAir || block.isLiquid) return false
    return !DoriosAPI.constants.unbreakableBlocks.includes(block.typeId)
}

function executeOperation(operation) {
    let brokenCount = 0
    let preservedCount = 0
    let fallbackCount = 0
    let collectedCount = 0
    let overflowCount = 0

    for (const block of operation.breakableTargets) {
        const result = operation.precision
            ? breakBlockPrecisely(operation.machine, block)
            : destroyBlockWithDrops(block.dimension, block.location)

        if (result?.broken === true || result === true) {
            brokenCount += 1
        }

        if (result && typeof result === 'object') {
            if (result.preserved === true) preservedCount += 1
            if (result.usedFallback === true) fallbackCount += 1
            collectedCount += Number(result.collectedCount ?? 0)
            overflowCount += Number(result.overflowCount ?? 0)
        }
    }

    const collectedDrops = collectDropsToMachine(operation)
    collectedCount += collectedDrops.collectedCount
    overflowCount += collectedDrops.overflowCount

    return {
        brokenCount,
        preservedCount,
        fallbackCount,
        collectedCount,
        overflowCount
    }
}

function breakBlockPrecisely(machine, block) {
    if (!block || !isBreakableBlock(block)) {
        return { broken: false, preserved: false, usedFallback: false, collectedCount: 0, overflowCount: 0 }
    }

    const drops = generatePrecisionDrops(block)
    if (!drops.length) {
        return {
            broken: destroyBlockWithDrops(block.dimension, block.location),
            preserved: false,
            usedFallback: true,
            collectedCount: 0,
            overflowCount: 0
        }
    }

    try {
        block.setType('minecraft:air')
        const stored = storeDropsInMachine(machine, drops, block.location)
        return {
            broken: true,
            preserved: true,
            usedFallback: false,
            collectedCount: stored.collectedCount,
            overflowCount: stored.overflowCount
        }
    } catch {
        return {
            broken: destroyBlockWithDrops(block.dimension, block.location),
            preserved: false,
            usedFallback: true,
            collectedCount: 0,
            overflowCount: 0
        }
    }
}

function generatePrecisionDrops(block) {
    try {
        const lootManager = world.getLootTableManager?.()
        if (!lootManager) return []

        if (typeof lootManager.generateLootFromBlockPermutation === 'function') {
            const fromPermutation = lootManager.generateLootFromBlockPermutation(block.permutation)
            if (Array.isArray(fromPermutation) && fromPermutation.length) {
                return fromPermutation.filter(Boolean)
            }
        }

        if (typeof lootManager.generateLootFromBlock === 'function') {
            const fromBlock = lootManager.generateLootFromBlock(block)
            if (Array.isArray(fromBlock) && fromBlock.length) {
                return fromBlock.filter(Boolean)
            }
        }
    } catch {
        // Ignore loot manager failures and fall back to destroy-mode breaking.
    }

    return []
}

function destroyBlockWithDrops(dimension, loc) {
    if (!dimension || !loc) return false
    const x = Math.floor(loc.x)
    const y = Math.floor(loc.y)
    const z = Math.floor(loc.z)

    try {
        dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`)
        return true
    } catch {
        return false
    }
}

function storeDropsInMachine(machine, drops, overflowLoc) {
    let collectedCount = 0
    let overflowCount = 0

    for (const stack of drops) {
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue

        const insertedAmount = insertItemIntoSlots(machine?.inv, stack, SEISMIC_BREAKER.slots.storage)
        collectedCount += insertedAmount

        const overflowAmount = Math.max(0, stack.amount - insertedAmount)
        if (overflowAmount > 0) {
            overflowCount += overflowAmount
            machine?.dim?.spawnItem?.(cloneItemStack(stack, overflowAmount), toSpawnPos(overflowLoc ?? machine?.block?.location))
        }
    }

    return { collectedCount, overflowCount }
}

function collectDropsToMachine(operation) {
    const bounds = buildCollectionBounds(operation?.targetPositions)
    if (!bounds || !operation?.machine?.dim) {
        return { collectedCount: 0, overflowCount: 0 }
    }

    const nearbyItems = operation.machine.dim.getEntities({
        type: 'item',
        location: bounds.center,
        maxDistance: bounds.radius
    })

    let collectedCount = 0
    let overflowCount = 0

    for (const itemEntity of nearbyItems) {
        if (!isWithinBounds(itemEntity?.location, bounds)) continue

        const stack = itemEntity.getComponent('minecraft:item')?.itemStack
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue

        const insertedAmount = insertItemIntoSlots(operation.machine.inv, stack, SEISMIC_BREAKER.slots.storage)
        if (insertedAmount <= 0) continue

        const overflowAmount = Math.max(0, stack.amount - insertedAmount)
        const entityLoc = itemEntity.location
        itemEntity.remove()

        if (overflowAmount > 0) {
            overflowCount += overflowAmount
            operation.machine.dim.spawnItem(cloneItemStack(stack, overflowAmount), entityLoc)
        }

        collectedCount += insertedAmount
    }

    return { collectedCount, overflowCount }
}

function buildCollectionBounds(positions = []) {
    if (!Array.isArray(positions) || positions.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity

    for (const pos of positions) {
        if (!pos) continue
        minX = Math.min(minX, pos.x)
        minY = Math.min(minY, pos.y)
        minZ = Math.min(minZ, pos.z)
        maxX = Math.max(maxX, pos.x)
        maxY = Math.max(maxY, pos.y)
        maxZ = Math.max(maxZ, pos.z)
    }

    if (!Number.isFinite(minX)) return null

    const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    }
    const radius = Math.max(
        Math.abs(maxX - center.x),
        Math.abs(maxY - center.y),
        Math.abs(maxZ - center.z)
    ) + 2

    return {
        minX: minX - 0.75,
        minY: minY - 0.75,
        minZ: minZ - 0.75,
        maxX: maxX + 0.75,
        maxY: maxY + 0.75,
        maxZ: maxZ + 0.75,
        center,
        radius
    }
}

function isWithinBounds(location, bounds) {
    if (!location || !bounds) return false
    return location.x >= bounds.minX && location.x <= bounds.maxX
        && location.y >= bounds.minY && location.y <= bounds.maxY
        && location.z >= bounds.minZ && location.z <= bounds.maxZ
}

function insertItemIntoSlots(container, stack, slots) {
    if (!container || !stack?.typeId || !Array.isArray(slots) || slots.length === 0) return 0

    let remaining = stack.amount
    const sourceLore = typeof stack.getLore === 'function' ? (stack.getLore() ?? []) : []
    const sourceName = stack.nameTag ?? ''

    const matchesStack = (slotItem) => {
        if (!slotItem || slotItem.typeId !== stack.typeId) return false
        if ((slotItem.nameTag ?? '') !== sourceName) return false
        const slotLore = typeof slotItem.getLore === 'function' ? (slotItem.getLore() ?? []) : []
        if (slotLore.length !== sourceLore.length) return false
        return slotLore.every((line, index) => line === sourceLore[index])
    }

    for (const slot of slots) {
        const slotItem = container.getItem(slot)
        if (!matchesStack(slotItem)) continue

        const space = slotItem.maxAmount - slotItem.amount
        if (space <= 0) continue

        const amountToInsert = Math.min(space, remaining)
        slotItem.amount += amountToInsert
        container.setItem(slot, slotItem)
        remaining -= amountToInsert
        if (remaining <= 0) {
            return stack.amount
        }
    }

    for (const slot of slots) {
        const slotItem = container.getItem(slot)
        if (slotItem) continue

        const amountToInsert = Math.min(stack.maxAmount ?? 64, remaining)
        const newStack = cloneItemStack(stack, amountToInsert)
        container.setItem(slot, newStack)
        remaining -= amountToInsert
        if (remaining <= 0) {
            return stack.amount
        }
    }

    return stack.amount - remaining
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

function toSpawnPos(loc) {
    return {
        x: loc.x + 0.5,
        y: loc.y + 0.5,
        z: loc.z + 0.5
    }
}

function buildModeButtonLore(mode) {
    const lines = [
        `§7Pattern: §f${mode.title}`
    ]

    if (mode.id === SEISMIC_BREAKER.modes.line.id) {
        lines.push(`§7Length: §f${mode.length ?? SEISMIC_BREAKER.defaults.lineLength}`)
    } else if (mode.id === SEISMIC_BREAKER.modes.cube3x3x3.id) {
        lines.push('§7Area: §f3x3x3')
    } else if (mode.id === SEISMIC_BREAKER.modes.plane3x3.id) {
        lines.push('§7Area: §f3x3')
    } else {
        lines.push('§7Area: §f1x1')
    }
    return lines
}

function buildPrecisionButtonLore(active) {
    return [
        `§7Status: ${active ? '§bEnabled' : '§7Disabled'}`,
        '§7Preserves loot-table drops when possible.'
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
            label: 'Precision',
            value: operation.precision ? 'Enabled' : 'Disabled',
            valueColor: operation.precision ? '§b' : '§7'
        }
    ]
    if (overclockLine) machineInfo.push(overclockLine)

    appendLoreSection(lines, 'Machine Information', machineInfo, {
        spacing: false
    })

    const operationInfo = [
        {
            label: 'Targets',
            value: operation.breakableTargets?.length ?? 0
        },
        {
            label: 'Blocked',
            value: operation.blockedCount ?? 0
        },
        {
            label: 'Cost',
            value: formatEnergyCost(operation.energyCost ?? 0)
        }
    ]

    if (operation.mode?.id === SEISMIC_BREAKER.modes.line.id) {
        operationInfo.push({
            label: 'Length',
            value: operation.lineLength
        })
    }

    appendLoreSection(lines, 'Breaking Operation', operationInfo)

    const targetInfo = []
    if (operation.firstBreakable?.typeId) {
        targetInfo.push({
            label: 'Front Block',
            value: formatItemName(operation.firstBreakable.typeId)
        })
    } else if (operation.anchorBlock?.typeId) {
        targetInfo.push({
            label: 'Front Block',
            value: formatItemName(operation.anchorBlock.typeId)
        })
    }

    if (targetInfo.length > 0) {
        appendLoreSection(lines, 'Target Information', targetInfo)
    }

    const lastAction = []
    if (operation.result?.preservedCount > 0) {
        lastAction.push(`§7Precision Drops: §f${operation.result.preservedCount}`)
    }
    if (operation.result?.collectedCount > 0) {
        lastAction.push(`§7Collected Items: §f${operation.result.collectedCount}`)
    }
    if (operation.result?.overflowCount > 0) {
        lastAction.push(`§6Dropped Overflow: §f${operation.result.overflowCount}`)
    }
    if (operation.result?.brokenCount > 0) {
        lastAction.push(`§7Broken: §f${operation.result.brokenCount} block(s)`)
    }

    if (lastAction.length > 0) {
        appendLoreSection(lines, 'Last Action', lastAction)
    }

    return lines
}

function buildFooterLines(operation = {}) {
    const lines = [
        `Mode: ${operation.mode?.title ?? '1x1'}`,
        `Precision: ${operation.precision ? 'On' : 'Off'}`
    ]

    if (operation.mode?.id === SEISMIC_BREAKER.modes.line.id) {
        lines.push(`Length: ${operation.lineLength}`)
    }

    return lines
}

function updateDisplays(machine) {
    machine.displayEnergy(SEISMIC_BREAKER.slots.energy)
    machine.displayProgress(SEISMIC_BREAKER.slots.progress)
}

function showMachineWarning(machine, message, operation = {}, resetProgress = true) {
    machine.off()
    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(operation),
        {
            footerLines: buildFooterLines(operation),
            displayModel: 'minimal'
        }
    )
    updateDisplays(machine)
}

function showMachineStatus(machine, message, operation = {}) {
    machine.on()
    machine.showStatus(
        message,
        buildMachineLore(operation),
        {
            footerLines: buildFooterLines(operation),
            displayModel: 'minimal'
        }
    )
    updateDisplays(machine)
}

import { Machine, Energy } from '../managers_extra.js'
import { ItemStack } from '@minecraft/server'

const DEFAULT_COST = 800
const BASE_LENGTH = 3 // blocks along the horizontal (right) axis
const BASE_HEIGHT = 3 // vertical blocks
const DAMAGE = 4 // 2 hearts per pulse
const COOLDOWN_TICKS = 4
const MAX_SIZE_LEVEL = 8
const FIELD_ID = 'utilitycraft:laser_barrier_field'
const FIELD_REFRESH_TICKS = 10 // only rebuild the wall a few times per second

const DP_LEN = 'laser:len'
const DP_HEI = 'laser:hei'
const DP_LAST_SPAN = 'laser:last_span'
const DP_REFRESH_CD = 'laser:refresh_cd'

/*
Slots (inventory_size: 7)
- [4] Upgrade de comprimento (size_upgrade) — aumenta o comprimento da barreira.
- [5] Upgrade de altura (size_upgrade) — aumenta a altura da barreira.
- [6] Upgrade de eficiência/energia (energy_upgrade) — reduz custo/energia.
- [0-3] Slots escondidos (filler/UI), não acessíveis ao jogador.
*/

DoriosAPI.register.blockComponent('laser_barrier', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            const defaultCost = settings?.machine?.energy_cost ?? DEFAULT_COST
            machine.setEnergyCost(defaultCost)
            machine.displayEnergy()
            machine.displayProgress()
        })
    },

    onPlayerInteract(e, { params: settings }) {
        const machine = new Machine(e.block, settings)
        if (!machine.valid) return

        // Apply upgrades from hand
        if (tryApplyUpgrade(machine, e.player)) return

        // Sneak + empty hand → retrieve installed upgrades
        const hand = getHeldItem(e.player)
        if (e.player.isSneaking && !hand) {
            dropInstalledUpgrades(machine)
        }
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const { block } = e
        const machine = new Machine(block, settings)
        if (!machine.valid) return

        // Energy upkeep
        const energyCost = settings?.machine?.energy_cost ?? DEFAULT_COST
        machine.setEnergyCost(energyCost)

        const energy = machine.energy.get()
        if (energy <= 0) {
            machine.showWarning('No Energy', false)
            clearField(machine)
            return
        }

        // Drain energy continuously to keep the barrier active
        const spend = Math.min(energy, machine.rate, energyCost)
        if (spend > 0) {
            machine.energy.consume(spend)
            machine.addProgress(spend)
        }

        // Maintain wall and pulse damage
        const levels = getBarrierLevels(machine)
        const length = BASE_LENGTH + levels.lengthLevel
        const height = BASE_HEIGHT + levels.heightLevel

        const { changed: needsRebuild, prevLen, prevHei } = syncCachedSpan(machine, length, height)
        if (shouldRefreshField(machine, needsRebuild)) {
            maintainField(machine, length, height, prevLen, prevHei)
            machine.entity.setDynamicProperty(DP_LAST_SPAN, Math.max(length, height))
            machine.entity.setDynamicProperty(DP_REFRESH_CD, FIELD_REFRESH_TICKS)
        }

        if (machine.getProgress() >= energyCost) {
            machine.addProgress(-energyCost)
            pulseBarrier(machine, length, height)
        }

        updateHud(machine, length, height, levels)
        machine.displayEnergy()
        machine.displayProgress()
        machine.on()
    },

    onPlayerBreak(e) {
        clearFieldAroundBlock(e.block)
        Machine.onDestroy(e)
    }
})

function maintainField(machine, length, height, prevLen, prevHei) {
    const dim = machine.block.dimension
    const positions = computeWall(machine.block, length, height)
    const keep = new Set(positions.map(keyOf))

    // Clear stray field blocks first (older spans, disabled areas)
    clearField(machine, keep, positions, prevLen, prevHei)

    for (const pos of positions) {
        // Never overwrite the controller block
        if (pos.x === machine.block.location.x && pos.y === machine.block.location.y && pos.z === machine.block.location.z) continue

        const block = dim.getBlock(pos)
        if (!block) continue

        if (block.typeId === 'minecraft:air' || block.typeId === FIELD_ID || block.isWaterlogged) {
            block.setType(FIELD_ID)
        }
    }
}

function clearField(machine, keep = new Set(), positions = null, prevLen = null, prevHei = null) {
    const dim = machine.block.dimension
    const { x, y, z } = machine.block.location
    const currLen = readDP(machine, DP_LEN, BASE_LENGTH)
    const currHei = readDP(machine, DP_HEI, BASE_HEIGHT)
    const lastLen = prevLen ?? currLen
    const lastHei = prevHei ?? currHei

    const boxes = [
        positions?.length ? getBoundingBox(positions, { x, y, z }) : null,
        buildWallBox(machine.block, currLen, currHei, 1),
        buildWallBox(machine.block, lastLen, lastHei, 1)
    ].filter(Boolean)

    const bbox = boxes.reduce(mergeBoxes)
    if (!bbox) return

    forEachPos(bbox, pos => {
        if (keep.has(keyOf(pos))) return
        const blk = dim.getBlock(pos)
        if (blk && blk.typeId === FIELD_ID) blk.setType('minecraft:air')
    })
}

function clearFieldAroundBlock(block, radius = 10) {
    const dim = block.dimension
    const { x, y, z } = block.location
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = 0; dy <= radius + 1; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const pos = { x: x + dx, y: y + dy, z: z + dz }
                const blk = dim.getBlock(pos)
                if (blk && blk.typeId === FIELD_ID) blk.setType('minecraft:air')
            }
        }
    }
}

function pulseBarrier(machine, length, height) {
    const dim = machine.block.dimension
    const center = machine.block.center()
    center.y += 0.5

    const radius = Math.max(length, height) / 2 + 1.5
    const targets = dim.getEntities({
        location: center,
        maxDistance: radius,
        excludeTypes: ['utilitycraft:machine', 'dorios:machine', 'minecraft:item', 'minecraft:xp_orb'],
        excludeFamilies: ['inanimate', 'projectile', 'item']
    })

    for (const ent of targets) {
        if (!ent?.isValid) continue
        if (ent.typeId === 'minecraft:player' && ent.isSneaking) continue
        ent.applyDamage(DAMAGE, { cause: 'contact' })
    }

    machine.holdTransfers(COOLDOWN_TICKS)
}

function computeWall(block, length, height) {
    const forward = getForward(block)
    const base = block.location
    const positions = []

    for (let h = 0; h < height; h++) {
        for (let w = 1; w <= length; w++) {
            const pos = {
                x: base.x + forward.x * w,
                y: base.y + h,
                z: base.z + forward.z * w
            }
            positions.push(pos)
        }
    }

    return positions
}

function getForward(block) {
    const axis = block.permutation?.getState('utilitycraft:axis') ?? 'north'
    switch (axis) {
        case 'south': return { x: 0, y: 0, z: 1 }
        case 'east': return { x: 1, y: 0, z: 0 }
        case 'west': return { x: -1, y: 0, z: 0 }
        case 'up': return { x: 0, y: 1, z: 0 }
        case 'down': return { x: 0, y: -1, z: 0 }
        case 'north':
        default: return { x: 0, y: 0, z: -1 }
    }
}

function getRight(forward) {
    // Right-hand mapping for horizontal axes; for vertical, default to X+ for right
    if (forward.x === 1) return { x: 0, y: 0, z: 1 }
    if (forward.x === -1) return { x: 0, y: 0, z: -1 }
    if (forward.z === 1) return { x: -1, y: 0, z: 0 }
    if (forward.z === -1) return { x: 1, y: 0, z: 0 }
    return { x: 1, y: 0, z: 0 }
}

const keyOf = (pos) => `${pos.x}|${pos.y}|${pos.z}`

function getBoundingBox(positions, origin) {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY

    for (const pos of positions) {
        if (pos.x < minX) minX = pos.x
        if (pos.y < minY) minY = pos.y
        if (pos.z < minZ) minZ = pos.z
        if (pos.x > maxX) maxX = pos.x
        if (pos.y > maxY) maxY = pos.y
        if (pos.z > maxZ) maxZ = pos.z
    }

    // add a small padding to clean stray blocks just outside the wall
    return {
        min: { x: minX - 1, y: Math.max(origin.y, minY - 1), z: minZ - 1 },
        max: { x: maxX + 1, y: maxY + 1, z: maxZ + 1 }
    }
}

function buildWallBox(block, length, height, pad = 1) {
    const base = block.location
    const forward = getForward(block)

    const end = {
        x: base.x + forward.x * length,
        y: base.y + height,
        z: base.z + forward.z * length
    }

    return {
        min: {
            x: Math.min(base.x, end.x) - pad,
            y: Math.max(0, base.y - pad),
            z: Math.min(base.z, end.z) - pad
        },
        max: {
            x: Math.max(base.x, end.x) + pad,
            y: end.y + pad,
            z: Math.max(base.z, end.z) + pad
        }
    }
}

const mergeBoxes = (a, b) => ({
    min: {
        x: Math.min(a.min.x, b.min.x),
        y: Math.min(a.min.y, b.min.y),
        z: Math.min(a.min.z, b.min.z)
    },
    max: {
        x: Math.max(a.max.x, b.max.x),
        y: Math.max(a.max.y, b.max.y),
        z: Math.max(a.max.z, b.max.z)
    }
})

function forEachPos(bbox, fn) {
    for (let dx = bbox.min.x; dx <= bbox.max.x; dx++) {
        for (let dy = bbox.min.y; dy <= bbox.max.y; dy++) {
            for (let dz = bbox.min.z; dz <= bbox.max.z; dz++) {
                fn({ x: dx, y: dy, z: dz })
            }
        }
    }
}

const readDP = (machine, key, fallback) => Number(machine.entity?.getDynamicProperty(key)) || fallback

function getBarrierLevels(machine) {
    const slots = machine.settings?.machine?.upgrades ?? [4, 5, 6]
    const [lengthSlot, heightSlot, energySlot] = slots
    const inv = machine.inv

    const readLevel = (slot, expectedId) => {
        if (slot === undefined || !inv) return 0
        const item = inv.getItem(slot)
        if (!item || item.typeId !== expectedId) return 0
        return Math.min(MAX_SIZE_LEVEL, item.amount)
    }

    const lengthLevel = readLevel(lengthSlot, 'utilitycraft:size_upgrade')
    const heightLevel = readLevel(heightSlot, 'utilitycraft:size_upgrade')

    let energyLevel = 0
    if (energySlot !== undefined && inv) {
        const item = inv.getItem(energySlot)
        if (item && item.typeId === 'utilitycraft:energy_upgrade') {
            energyLevel = Math.min(8, item.amount)
        }
    }

    return { lengthLevel, heightLevel, energyLevel }
}

function syncCachedSpan(machine, length, height) {
    const cachedLen = Number(machine.entity?.getDynamicProperty(DP_LEN)) || length
    const cachedHei = Number(machine.entity?.getDynamicProperty(DP_HEI)) || height
    const changed = cachedLen !== length || cachedHei !== height
    if (changed) {
        machine.entity.setDynamicProperty(DP_LEN, length)
        machine.entity.setDynamicProperty(DP_HEI, height)
    }
    return {
        changed,
        prevLen: cachedLen,
        prevHei: cachedHei
    }
}

function shouldRefreshField(machine, needsRebuild) {
    if (needsRebuild) return true
    const cd = Number(machine.entity?.getDynamicProperty(DP_REFRESH_CD)) || 0
    if (cd <= 0) return true
    machine.entity.setDynamicProperty(DP_REFRESH_CD, cd - 1)
    return false
}

function updateHud(machine, length, height, levels) {
    const costText = Energy.formatEnergyToText(machine.getEnergyCost())
    machine.setLabel({
        title: '§6Laser Barrier',
        lore: [
            '§7Modo: §fMuro a Laser',
            `§cCusto/ciclo: §f${costText}`,
            `§7Comprimento x Altura: §f${length}x${height}`,
            `§7Upg Comprimento: §f${levels.lengthLevel}`,
            `§7Upg Altura: §f${levels.heightLevel}`,
            `§7Upg Energia: §f${levels.energyLevel}`
        ]
    })
}

function tryApplyUpgrade(machine, player) {
    const held = getHeldItem(player)
    if (!held || !held.hasTag?.('utilitycraft:is_upgrade')) return false

    const slots = machine.settings?.machine?.upgrades ?? [4, 5, 6]
    const [lengthSlot, heightSlot, energySlot] = slots
    const container = machine.inv
    if (!container) return false

    const isSize = held.typeId === 'utilitycraft:size_upgrade'
    const isEnergy = held.typeId === 'utilitycraft:energy_upgrade'

    let targetSlot
    if (isSize) {
        // Sneaking applies to height slot, otherwise length slot
        targetSlot = player.isSneaking ? heightSlot : lengthSlot
    } else if (isEnergy) {
        targetSlot = energySlot
    } else {
        return false
    }

    if (targetSlot === undefined) return false

    const current = container.getItem(targetSlot)
    if (current && current.typeId !== held.typeId) {
        player.sendMessage('§cSlot já ocupado por outro tipo de melhoria.')
        return true
    }

    const playerInv = player.getComponent('inventory')?.container
    const handSlot = player.selectedSlot
    if (!playerInv || handSlot === undefined) return false

    // Move one upgrade into machine
    const insert = new ItemStack(held.typeId, 1)
    if (current) {
        insert.amount = current.amount + 1
    }
    container.setItem(targetSlot, insert)

    // Consume from player hand
    const newAmount = held.amount - 1
    if (newAmount > 0) {
        held.amount = newAmount
        playerInv.setItem(handSlot, held)
    } else {
        playerInv.setItem(handSlot, undefined)
    }

    player.sendMessage('§aMelhoria instalada.')
    return true
}

function dropInstalledUpgrades(machine) {
    const slots = machine.settings?.machine?.upgrades ?? [4, 5, 6]
    const dropLocation = machine.block?.center?.() ?? machine.block.location
    for (const slot of slots) {
        const item = machine.inv.getItem(slot)
        if (!item) continue
        if (!item.hasTag || !item.hasTag('utilitycraft:is_upgrade')) continue
        machine.inv.setItem(slot, undefined)
        machine.dim.spawnItem(item, dropLocation)
    }
}

function getHeldItem(player) {
    const inv = player.getComponent('inventory')?.container
    if (!inv) return null
    const slot = player.selectedSlot
    if (slot === undefined || slot === null) return null
    return inv.getItem(slot)
}

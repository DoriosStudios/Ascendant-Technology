import { Machine, Energy, buildOverclockLoreLine } from '../../DoriosCore/index.js'
import { ItemStack } from '@minecraft/server'

const DEFAULT_COST = 800
const BASE_LENGTH = 3 // blocks along the horizontal (right) axis
const BASE_HEIGHT = 3 // vertical blocks
const DAMAGE = 4 // 2 hearts per pulse
const COOLDOWN_TICKS = 4
const MAX_SIZE_LEVEL = 8
const DAMAGE_LATERAL_PADDING = 0.5 // extra hit width on each side of each barrier block
const FIELD_ID = 'utilitycraft:laser_barrier_field'
const FIELD_REFRESH_TICKS = 10 // only rebuild the wall a few times per second
const ENERGY_UPGRADE_CYCLE_COSTS = [800, 720, 640, 560, 480, 400, 320, 240, 200]
const AIR_BLOCK_IDS = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'])
const FIELD_CLEARABLE_BLOCKS = new Set([
    'minecraft:snow',
    'minecraft:snow_layer',
    'minecraft:grass',
    'minecraft:tallgrass',
    'minecraft:short_grass',
    'minecraft:tall_grass',
    'minecraft:fern',
    'minecraft:large_fern',
    'minecraft:deadbush',
    'minecraft:dandelion',
    'minecraft:poppy',
    'minecraft:blue_orchid',
    'minecraft:allium',
    'minecraft:azure_bluet',
    'minecraft:oxeye_daisy',
    'minecraft:cornflower',
    'minecraft:lily_of_the_valley',
    'minecraft:wither_rose',
    'minecraft:sunflower',
    'minecraft:lilac',
    'minecraft:rose_bush',
    'minecraft:peony',
    'minecraft:seagrass',
    'minecraft:tall_seagrass',
    'minecraft:kelp',
    'minecraft:kelp_plant',
    'minecraft:waterlily',
    'minecraft:vine',
    'minecraft:glow_lichen',
    'minecraft:cave_vines',
    'minecraft:cave_vines_body_with_berries',
    'minecraft:cave_vines_head_with_berries',
    'minecraft:small_dripleaf',
    'minecraft:big_dripleaf',
    'minecraft:big_dripleaf_stem'
])
const FIELD_CLEARABLE_SUFFIXES = ['_sapling', '_fungus', '_mushroom', '_flower', '_tulip']

const DP_LEN = 'laser:len'
const DP_HEI = 'laser:hei'
const DP_LAST_SPAN = 'laser:last_span'
const DP_REFRESH_CD = 'laser:refresh_cd'

const normalizeRawMessageArg = value => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return value
    return String(value)
}

const tr = (key, withArgs = []) => ({
    translate: key,
    with: withArgs.map(normalizeRawMessageArg)
})

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
            machine.entity.setDynamicProperty(DP_LEN, BASE_LENGTH)
            machine.entity.setDynamicProperty(DP_HEI, BASE_HEIGHT)
            machine.entity.setDynamicProperty(DP_LAST_SPAN, Math.max(BASE_LENGTH, BASE_HEIGHT))
            machine.entity.setDynamicProperty(DP_REFRESH_CD, 0)
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

        const levels = getBarrierLevels(machine)

        // Energy upkeep
        const baseCost = settings?.machine?.energy_cost ?? DEFAULT_COST
        const cycleCost = getCycleCostByEnergyUpgrade(levels.energyLevel, baseCost)
        machine.setEnergyCost(cycleCost)

        const energy = machine.energy.get()
        if (energy <= 0) {
            machine.showWarning('No Energy', false)
            clearField(machine)
            return
        }

        // Drain energy continuously to keep the barrier active
        const spend = Math.min(energy, machine.rate, cycleCost)
        if (spend > 0) {
            machine.energy.consume(spend)
            machine.addProgress(spend)
        }

        // Maintain wall and pulse damage
        const length = BASE_LENGTH + levels.lengthLevel
        const height = BASE_HEIGHT + levels.heightLevel

        const { changed: needsRebuild, prevLen, prevHei } = syncCachedSpan(machine, length, height)
        if (shouldRefreshField(machine, needsRebuild)) {
            maintainField(machine, length, height, prevLen, prevHei)
            machine.entity.setDynamicProperty(DP_LAST_SPAN, Math.max(length, height))
            machine.entity.setDynamicProperty(DP_REFRESH_CD, FIELD_REFRESH_TICKS)
        }

        if (machine.getProgress() >= cycleCost) {
            machine.addProgress(-cycleCost)
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

        if (!canPlaceFieldAt(block)) continue

        // Break light environment blocks first so the laser field can replace them.
        if (isEnvironmentClearableBlock(block) && block.typeId !== FIELD_ID) {
            block.setType('minecraft:air')
        }

        block.setType(FIELD_ID)
    }
}

function clearField(machine, keep = new Set(), positions = null, prevLen = null, prevHei = null) {
    const dim = machine.block.dimension
    const { x, y, z } = machine.block.location
    const currLen = readDP(machine, DP_LEN, BASE_LENGTH)
    const currHei = readDP(machine, DP_HEI, BASE_HEIGHT)
    const lastLen = prevLen ?? currLen
    const lastHei = prevHei ?? currHei
    const lastSpan = readDP(machine, DP_LAST_SPAN, Math.max(currLen, currHei, lastLen, lastHei))
    const sweepLen = Math.max(currLen, lastLen, lastSpan)
    const sweepHei = Math.max(currHei, lastHei, lastSpan)

    const boxes = [
        positions?.length ? getBoundingBox(positions, { x, y, z }) : null,
        buildWallBox(machine.block, currLen, currHei, 1),
        buildWallBox(machine.block, lastLen, lastHei, 1),
        buildWallBox(machine.block, sweepLen, sweepHei, 1)
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
    const positions = computeWall(machine.block, length, height)
    const search = getSearchSphereFromPositions(positions)
    if (!search) {
        machine.holdTransfers(COOLDOWN_TICKS)
        return
    }

    const fieldPositions = new Set(positions.map(keyOf))
    const fieldHitboxes = buildFieldDamageHitboxes(positions)
    const targets = dim.getEntities({
        location: search.center,
        maxDistance: search.radius,
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

function matchesClearableSuffix(typeId) {
    if (typeof typeId !== 'string') return false
    return FIELD_CLEARABLE_SUFFIXES.some(suffix => typeId.endsWith(suffix))
}

function isAirLike(block) {
    if (!block) return false
    if (block.isAir === true) return true
    return AIR_BLOCK_IDS.has(block.typeId)
}

function isEnvironmentClearableBlock(block) {
    if (!block) return false
    if (isAirLike(block)) return false
    if (block.typeId === FIELD_ID) return false

    const typeId = block.typeId
    const unbreakables = DoriosAPI?.constants?.unbreakableBlocks
    if (Array.isArray(unbreakables) && unbreakables.includes(typeId)) return false

    if (block.hasTag?.('minecraft:replaceable')) return true
    if (block.hasTag?.('minecraft:replaceable_plants')) return true
    if (block.hasTag?.('minecraft:plant')) return true

    if (FIELD_CLEARABLE_BLOCKS.has(typeId)) return true
    if (matchesClearableSuffix(typeId)) return true

    return false
}

function canPlaceFieldAt(block) {
    if (!block) return false
    if (block.typeId === FIELD_ID) return true
    if (isAirLike(block)) return true
    if (block.isWaterlogged) return true
    return isEnvironmentClearableBlock(block)
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

const readDP = (machine, key, fallback) => {
    const value = Number(machine.entity?.getDynamicProperty(key))
    return Number.isFinite(value) ? value : fallback
}

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
    const cachedLen = readDP(machine, DP_LEN, length)
    const cachedHei = readDP(machine, DP_HEI, height)
    const changed = cachedLen !== length || cachedHei !== height
    // Keep cache always in sync so downsizing cleanup can reliably compare spans.
    machine.entity.setDynamicProperty(DP_LEN, length)
    machine.entity.setDynamicProperty(DP_HEI, height)
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
    const overclockLine = buildOverclockLoreLine(machine)
    machine.setLabel({
        title: '§r§6Laser Barrier',
        lore: [
            '§7Mode: §fLaser Wall',
            `§cCost/Cycle: §f${costText}`,
            `§7Total Size: §f${length}x${height}`,
            `§7Length: §f${levels.lengthLevel}`,
            `§7Height: §f${levels.heightLevel}`,
            `§7Energy: §f${levels.energyLevel}`,
            ...(overclockLine ? [overclockLine] : [])
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
        player.sendMessage(tr('ui.utilitycraft.laser_barrier.upgrade.slot_occupied'))
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

    player.sendMessage(tr('ui.utilitycraft.laser_barrier.upgrade.installed'))
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

function getCycleCostByEnergyUpgrade(energyLevel, fallbackCost = DEFAULT_COST) {
    const level = Math.max(0, Math.min(8, Math.floor(Number(energyLevel) || 0)))
    const mapped = ENERGY_UPGRADE_CYCLE_COSTS[level]
    return Number.isFinite(mapped) && mapped > 0 ? mapped : fallbackCost
}

function getSearchSphereFromPositions(positions) {
    if (!Array.isArray(positions) || positions.length === 0) return null

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

    const center = {
        x: (minX + maxX + 1) / 2,
        y: (minY + maxY + 1) / 2,
        z: (minZ + maxZ + 1) / 2
    }

    const dx = (maxX - minX + 1) / 2
    const dy = (maxY - minY + 1) / 2
    const dz = (maxZ - minZ + 1) / 2
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1

    return { center, radius }
}

function buildFieldDamageHitboxes(positions) {
    if (!Array.isArray(positions) || positions.length === 0) return []
    const pad = DAMAGE_LATERAL_PADDING

    return positions.map(pos => ({
        minX: pos.x - pad,
        maxX: pos.x + 1 + pad,
        minY: pos.y,
        maxY: pos.y + 1,
        minZ: pos.z - pad,
        maxZ: pos.z + 1 + pad
    }))
}

function isEntityInsideField(entity, fieldPositions, fieldHitboxes = []) {
    if (!entity?.location || !fieldPositions?.size) return false

    const baseX = Math.floor(entity.location.x)
    const baseY = Math.floor(entity.location.y)
    const baseZ = Math.floor(entity.location.z)

    if (
        fieldPositions.has(`${baseX}|${baseY}|${baseZ}`)
        || fieldPositions.has(`${baseX}|${baseY + 1}|${baseZ}`)
        || fieldPositions.has(`${baseX}|${baseY + 2}|${baseZ}`)
    ) {
        return true
    }

    if (!Array.isArray(fieldHitboxes) || fieldHitboxes.length === 0) return false

    const sampleX = entity.location.x
    const sampleZ = entity.location.z
    const sampleY = [entity.location.y, entity.location.y + 0.9, entity.location.y + 1.8]

    for (const box of fieldHitboxes) {
        if (sampleX < box.minX || sampleX > box.maxX || sampleZ < box.minZ || sampleZ > box.maxZ) continue
        if (sampleY.some(y => y >= box.minY && y <= box.maxY)) return true
    }

    return false
}

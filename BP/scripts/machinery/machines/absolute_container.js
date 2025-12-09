import { Machine, Energy, FluidManager, Container } from '../managers_extra.js'

// ──────────────────────────────────────────────────────
// CONFIGURAÇÃO BASE (valores normalizados)
// ──────────────────────────────────────────────────────
const BASE_CAPS = Object.freeze({
    energy: 25_600_000,
    transfer: 25_600_000,
    fluid: 25_600_000
})

const STORAGE_COLUMNS = 14
const STORAGE_ROWS = 12
const STORAGE_SLOTS = STORAGE_COLUMNS * STORAGE_ROWS // 168 jogáveis
const HUD_SLOT_COUNT = 2 // apenas energia e fluido
const UPGRADE_SLOTS = 0
const INV_SLOTS = STORAGE_SLOTS + HUD_SLOT_COUNT // 170 total (sem upgrades)

/*
Slots (inventory_size: 170)
- [0 - 167] Grade principal (14x12)
- [168] HUD energia
- [169] HUD fluido
*/

const HUD_SLOTS = Object.freeze({
    energy: STORAGE_SLOTS,
    fluid: STORAGE_SLOTS + 1
})

const HUD_SLOT_TOTAL = Object.keys(HUD_SLOTS).length

const UPGRADE_TAGS = Object.freeze({})
const UPGRADE_SPECS = Object.freeze({
    range: { tag: '', max: 0 },
    damage: { tag: '', max: 0 },
    quantity: { tag: '', max: 0 },
    speed: { tag: '', max: 0 }
})

const ACCEPTED_UPGRADE_TAGS = new Set()

// Cooldowns (ticks)
const COOLDOWNS = Object.freeze({
    item: 4,
    fluid: 4,
    wireless: 5,
    damage: 20,
    speed: 20
})

// Áreas
const SPEED_AREA = Object.freeze({ xz: 12, y: 4.5 }) // 24x24x9
const HOSTILE_FAMILIES = Object.freeze(['monster', 'undead', 'arthropod'])

const SPEED_EFFECT = Object.freeze({ amplifier: 1, duration: 40, showParticles: false }) // Speed II

const TRANSFER_OFFSETS = Object.freeze({
    east: [-1, 0, 0],
    west: [1, 0, 0],
    north: [0, 0, 1],
    south: [0, 0, -1],
    up: [0, -1, 0],
    down: [0, 1, 0]
})

// ──────────────────────────────────────────────────────
// REGISTRO DO BLOCO (comportamento próprio, mas compatível)
// ──────────────────────────────────────────────────────
DoriosAPI.register.blockComponent('absolute_container', {
    beforeOnPlayerPlace(e, { params: settings }) {
        const normalized = withContainerDefaults(settings)
        Container.spawnContainerEntity(e, normalized, () => {
            const container = new Container(e.block, normalized, true)
            if (!container?.entity) return
            container.setEnergyCost(0)
            const tank = initializeTank(container.entity, BASE_CAPS.fluid)
            const upgrades = readUpgrades(container)
            const quantityMult = computeQuantityMult(upgrades.quantity)
            applyCaps(container, tank, quantityMult)
            updateHud(container, tank, upgrades, quantityMult)
            refreshHudDisplays(container, tank)
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return
        const machine = createMachine(e.block, settings)
        if (!machine) return
        processAbsoluteContainerTick(machine)
    },

    onPlayerInteract(e, { params: settings }) {
        const machine = createMachine(e.block, settings)
        if (!machine) return
        if (tryApplyUpgrade(machine, e.player)) return
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

function withContainerDefaults(settings) {
    return {
        ...settings,
        container: {
            ...(settings.container ?? {}),
            // Avoid inserting energy-bar items into the inventory grid
            display_energy_item: false
        },
        machine: {
            ...(settings.machine ?? {}),
            // Containers manage upgrades manually; skip base Machine upgrade scan.
            upgrades: []
        },
        entity: {
            ...(settings.entity ?? {}),
            // Allow machine/inventory events to run so inventory sizing applies
            skip_machine_event: false,
            skip_inventory_event: false,
            // Do not allow fallback to generic machine entity; ensure expanded inventory is used
            strict_entity_id: true,
            inventory_size: settings?.entity?.inventory_size ?? INV_SLOTS,
            id: settings?.entity?.id ?? 'utilitycraft:storage_container'
        }
    }
}

function readUpgrades() {
    // Upgrades desativados
    return { range: 0, damage: 0, quantity: 0, speed: 0 }
}

function computeQuantityMult() {
    return 1
}

function applyCaps(machine, tank, mult = 1) {
    const energyCap = BASE_CAPS.energy * mult
    const fluidCap = BASE_CAPS.fluid * mult
    machine.energy.setCap(energyCap)
    tank.setCap(fluidCap)
}

function getUpgradeSlots() {
    return []
}

function wirelessEnergy(machine, rangeLevel, cap, transferCap = cap) {
    // Upgrades desativados
    const dim = machine.dim
    const center = getBlockCenter(machine.block)
    if (!dim || !center) return

    const radius = 0
    const energy = machine.energy
    let budget = Math.min(energy.get(), transferCap)
    if (budget <= 0 || radius <= 0) return

    const targets = dim.getEntities({
        location: center,
        maxDistance: radius,
        excludeTypes: ['minecraft:item', 'minecraft:xp_orb', 'utilitycraft:machine'],
        excludeFamilies: ['projectile', 'inanimate']
    })

    const receivers = []
    for (const ent of targets) {
        if (!ent?.isValid || ent.id === machine.entity?.id) continue
        const tf = ent.getComponent('minecraft:type_family')
        if (!tf?.hasTypeFamily('dorios:energy_container')) continue
        const rec = new Energy(ent)
        const free = rec.getFreeSpace()
        if (free > 0) receivers.push({ rec, free })
    }
    if (!receivers.length) return

    // Ordena por necessidade (maior espaço livre primeiro)
    receivers.sort((a, b) => b.free - a.free)
    for (const { rec, free } of receivers) {
        if (budget <= 0) break
        const toSend = Math.min(free, budget, cap)
        const added = rec.add(toSend)
        if (added > 0) {
            machine.energy.add(-added)
            budget -= added
        }
    }
}

function damageAura(machine, dmgLevel) {
    // Upgrades desativados
    if (dmgLevel <= 0) return
    const dim = machine.dim
    const center = getBlockCenter(machine.block)
    if (!dim || !center) return

    const level = 0
    const radius = 0
    const damage = 0

    if (radius <= 0 || damage <= 0) return
}

function speedAura(machine) {
    const dim = machine.dim
    const center = getBlockCenter(machine.block)
    if (!dim || !center) return
    // Upgrades desativados: não aplicar aura
}

function updateHud(machine, tank, upgrades, mult) {
    const energyText = Energy.formatEnergyToText(machine.energy.get())
    const energyCapText = Energy.formatEnergyToText(machine.energy.getCap())
    const fluidText = FluidManager.formatFluid(tank.get())
    const fluidCapText = FluidManager.formatFluid(tank.getCap())

    // Display de informações desativado propositalmente
}

function refreshHudDisplays(machine, tank) {
    machine?.energy?.display?.(HUD_SLOTS.energy)
    tank?.display?.(HUD_SLOTS.fluid)
}

function tryApplyUpgrade(machine, player) {
    // Upgrades desativados
    return false
}


function findUpgradeSlot(inv, upgradeSlots = getUpgradeSlots(inv), preferredType) {
    let emptySlot = -1
    for (const slot of upgradeSlots) {
        const item = inv.getItem(slot)
        if (!item) {
            if (emptySlot === -1) emptySlot = slot
            continue
        }
        if (preferredType && item.typeId === preferredType && item.amount < (item.maxAmount ?? 64)) {
            return slot
        }
    }
    return emptySlot
}

function getHeldItem(player) {
    const inv = player.getComponent('inventory')?.container
    if (!inv) return null
    const slot = player.selectedSlot
    if (slot === undefined || slot === null) return null
    return inv.getItem(slot)
}

function tickGate(entity, key, cooldown) {
    if (!entity) return false
    const cd = Math.max(0, Number(entity.getDynamicProperty(key)) || 0)
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1)
        return false
    }
    entity.setDynamicProperty(key, cooldown)
    return true
}

function processAbsoluteContainerTick(machine) {
    if (!machine.valid || !machine.entity) return

    const tank = FluidManager.initializeSingle(machine.entity)
    if (!tank) return

    const upgrades = readUpgrades(machine)
    const quantityMult = computeQuantityMult(upgrades.quantity)

    applyCaps(machine, tank, quantityMult)
    machine.setEnergyCost(0)

    runCooldown(machine.entity, 'ac:item_cd', COOLDOWNS.item, () => transferStorageItems(machine, 'complex'))
    runCooldown(machine.entity, 'ac:fluid_cd', COOLDOWNS.fluid, () => tank.transferFluids(machine.block))

    if (upgrades.range > 0) {
        runCooldown(machine.entity, 'ac:wire_cd', COOLDOWNS.wireless, () =>
            wirelessEnergy(machine, upgrades.range, machine.energy.getCap(), BASE_CAPS.transfer)
        )
    }

    if (upgrades.damage > 0) {
        runCooldown(machine.entity, 'ac:damage_cd', COOLDOWNS.damage, () => damageAura(machine, upgrades.damage))
    }

    if (upgrades.speed > 0) {
        runCooldown(machine.entity, 'ac:speed_cd', COOLDOWNS.speed, () => speedAura(machine))
    }

    updateHud(machine, tank, upgrades, quantityMult)
    refreshHudDisplays(machine, tank)
    machine.on()
}

function createMachine(block, settings) {
    if (!block) return null
    const normalized = withContainerDefaults(settings)
    const machine = new Container(block, normalized)
    if (!machine.valid) return null
    return machine
}

function runCooldown(entity, key, cooldown, action) {
    if (!tickGate(entity, key, cooldown)) return
    action?.()
}

function initializeTank(entity, cap) {
    if (!entity) return null
    const tank = FluidManager.initializeSingle(entity)
    tank.setCap(cap)
    return tank
}

function transferStorageItems(machine, type = 'simple') {
    if (!machine || machine.shouldDelayTransfers?.()) return false
    const block = machine.block
    if (!block) return false

    const facing = block.getState?.('utilitycraft:axis')
    if (!facing) return false

    const offset = TRANSFER_OFFSETS[facing]
    if (!offset) return false

    const { x, y, z } = block.location ?? {}
    if (x === undefined || y === undefined || z === undefined) return false

    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] }
    const dim = machine.dim
    const inv = machine.inv
    if (!dim || !inv) return false

    let range
    if (type === 'complex') {
        const end = STORAGE_SLOTS - 1
        const start = Math.max(0, end - 8)
        range = [start, end]
    } else {
        range = STORAGE_SLOTS - 1
    }

    DoriosAPI.containers.transferItemsAt(inv, targetLoc, dim, range)
    return true
}


function clamp(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.max(min, Math.min(max, value))
}

function hasAnyFamily(tf, families) {
    if (!tf || !families?.length) return false
    return families.some(family => tf.hasTypeFamily?.(family))
}

function isUpgradeItem(item) {
    if (!item) return false
    for (const tag of ACCEPTED_UPGRADE_TAGS) {
        if (item.hasTag?.(tag)) return true
    }
    return false
}

function decrementPlayerHand(player, amount = 1) {
    const inv = player?.getComponent('inventory')?.container
    if (!inv) return
    const handSlot = player.selectedSlot
    if (handSlot === undefined || handSlot === null) return
    const held = inv.getItem(handSlot)
    if (!held) return
    const remaining = held.amount - amount
    if (remaining > 0) {
        held.amount = remaining
        inv.setItem(handSlot, held)
    } else {
        inv.setItem(handSlot, undefined)
    }
}

function getBlockCenter(block) {
    if (!block) return null
    if (typeof block.center === 'function') {
        return block.center()
    }
    if (block.location) {
        const { x, y, z } = block.location
        return { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
    }
    return null
}

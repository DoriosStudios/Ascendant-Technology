import { system } from '@minecraft/server'
import { Machine, Energy, FluidManager, Rotation, buildOverclockLoreLine } from '../../DoriosCore/index.js'

// ──────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ──────────────────────────────────────────────────────

const ABSOLUTE_CONTAINER = Object.freeze({
    capacity: Object.freeze({
        energy: 25_600_000,
        fluid: 25_600_000
    }),
    layout: Object.freeze({
        gridCols: 14,
        gridRows: 12,
        storageSlots: 14 * 12,
        slotEnergy: 14 * 12,
        slotFluid: (14 * 12) + 1,
        totalSlots: (14 * 12) + 2
    }),
    cooldowns: Object.freeze({
        item: 4,
        fluid: 4
    }),
    offsets: Object.freeze({
    east:  [-1, 0, 0],
    west:  [1, 0, 0],
    north: [0, 0, 1],
    south: [0, 0, -1],
    up:    [0, -1, 0],
    down:  [0, 1, 0]
    })
})

const ENERGY_CAP = ABSOLUTE_CONTAINER.capacity.energy
const FLUID_CAP = ABSOLUTE_CONTAINER.capacity.fluid
const GRID_COLS = ABSOLUTE_CONTAINER.layout.gridCols
const GRID_ROWS = ABSOLUTE_CONTAINER.layout.gridRows
const STORAGE_SLOTS = ABSOLUTE_CONTAINER.layout.storageSlots
const SLOT_ENERGY = ABSOLUTE_CONTAINER.layout.slotEnergy
const SLOT_FLUID = ABSOLUTE_CONTAINER.layout.slotFluid
const TOTAL_SLOTS = ABSOLUTE_CONTAINER.layout.totalSlots
const CD_ITEM = ABSOLUTE_CONTAINER.cooldowns.item
const CD_FLUID = ABSOLUTE_CONTAINER.cooldowns.fluid
const OFFSETS = ABSOLUTE_CONTAINER.offsets

// ──────────────────────────────────────────────────────
// COMPONENTE DO BLOCO
// ──────────────────────────────────────────────────────

DoriosAPI.register.blockComponent('absolute_container', {

    beforeOnPlayerPlace(e, { params }) {
        const { block, player, permutationToPlace } = e

        // Rotação
        if (params?.rotation) {
            if (player.isInSurvival()) {
                system.run(() => player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`))
            }
            e.cancel = true
            Rotation.facing(player, block, permutationToPlace)
        }

        // Lê energia/fluido do item
        const hand = player.getComponent('equippable')?.getEquipment('Mainhand')
        const lore = hand?.getLore() ?? []
        const savedEnergy = Energy.getEnergyFromText(lore[0] ?? '')
        const savedFluid = FluidManager.getFluidFromText(lore[savedEnergy > 0 ? 1 : 0] ?? '')

        system.run(() => spawnEntity(block, savedEnergy, savedFluid))
    },

    onTick(e) {
        if (!globalThis.worldLoaded) return
        const ctx = getContext(e.block)
        if (ctx) tick(ctx)
    },

    onPlayerInteract() {
        // Reservado para interações futuras
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})

// ──────────────────────────────────────────────────────
// SPAWN DA ENTIDADE
// ──────────────────────────────────────────────────────

function spawnEntity(block, savedEnergy = 0, savedFluid = null) {
    const dim = block.dimension
    const { x, y, z } = block.center()

    // Spawna entidade dedicada (já tem inventory_size: 194 nos components base)
    let entity
    try {
        entity = dim.spawnEntity('utilitycraft:storage_container', { x, y: y - 0.25, z })
    } catch (err) {
        console.warn('[AbsoluteContainer] Spawn falhou:', err)
        return
    }

    // Inicializa energia
    Energy.initialize(entity)
    const energy = new Energy(entity)
    energy.setCap(ENERGY_CAP)
    if (savedEnergy > 0) energy.set(savedEnergy)

    // Inicializa fluido
    const fluid = FluidManager.initializeSingle(entity)
    fluid.setCap(FLUID_CAP)
    if (savedFluid?.amount > 0) {
        fluid.setType(savedFluid.type)
        fluid.set(savedFluid.amount)
    }

    // Exibe barras de HUD
    energy.display(SLOT_ENERGY)
    fluid.display(SLOT_FLUID)

    entity.nameTag = 'entity.utilitycraft:absolute_container.name'
}

// ──────────────────────────────────────────────────────
// CONTEXTO E TICK
// ──────────────────────────────────────────────────────

function getContext(block) {
    if (!block) return null

    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
    if (!entity?.isValid) return null

    const inv = entity.getComponent('inventory')?.container
    if (!inv || inv.size < TOTAL_SLOTS) return null

    return { block, entity, inv, dim: block.dimension }
}

function tick(ctx) {
    const { block, entity, inv, dim } = ctx

    // Energia e Fluido
    const energy = new Energy(entity)
    const fluid = FluidManager.initializeSingle(entity)

    // Garante capacidades
    energy.setCap(ENERGY_CAP)
    fluid.setCap(FLUID_CAP)

    // Transferência de itens (últimos 9 slots)
    if (cooldown(entity, 'ac:item', CD_ITEM)) {
        transferItems(block, inv, dim)
    }

    // Transferência de fluidos
    if (cooldown(entity, 'ac:fluid', CD_FLUID)) {
        fluid.transferFluids(block)
    }

    // Atualiza displays de HUD
    energy.display(SLOT_ENERGY)
    fluid.display(SLOT_FLUID)
    // Estado visual "ligado"
    setOn(block, true)
}

// ──────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────

function cooldown(entity, key, ticks) {
    const cd = entity.getDynamicProperty(key) ?? 0
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1)
        return false
    }
    entity.setDynamicProperty(key, ticks)
    return true
}

function transferItems(block, inv, dim) {
    const facing = block.getState?.('utilitycraft:axis')
    const off = OFFSETS[facing]
    if (!off) return

    const loc = block.location
    const target = { x: loc.x + off[0], y: loc.y + off[1], z: loc.z + off[2] }

    // Transfere slots 159-167 (últimos 9 do grid)
    DoriosAPI.containers.transferItemsAt(inv, target, dim, [STORAGE_SLOTS - 9, STORAGE_SLOTS - 1])
}

function setOn(block, on) {
    try {
        if (block.getState?.('utilitycraft:on') !== on) {
            block.setPermutation(block.permutation.withState('utilitycraft:on', on))
        }
    } catch { /* ignora */ }
}

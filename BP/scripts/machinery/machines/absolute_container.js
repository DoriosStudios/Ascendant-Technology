import { system } from '@minecraft/server'
import { Machine, Energy, FluidManager, Rotation, tickGate } from '../../DoriosCore/index.js'

// ──────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ──────────────────────────────────────────────────────

const AbsoluteContainer = Object.freeze({
    capacity: Object.freeze({
        energy: 25_600_000,
        fluid: 25_600_000
    }),
    layout: Object.freeze({
        storageSlots: 14 * 12,
        slotEnergy: 14 * 12,
        slotFluid: (14 * 12) + 1,
        totalSlots: (14 * 12) + 2
    }),
    cooldowns: Object.freeze({
        item: 4,
        fluid: 4
    }),
    runtime: Object.freeze({
        hudRefreshTicks: 8,
        gates: Object.freeze({
            item: 'ac:item_gate',
            fluid: 'ac:fluid_gate'
        }),
        itemBackoff: Object.freeze({
            stallTicks: 12,
            emptyTicks: 6,
            failureEscalationThreshold: 2,
            drasticTicks: 80
        })
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

const BLOCK_CONTEXT_CACHE = new Map()
const ENTITY_RUNTIME_CACHE = new Map()

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

    onPlayerBreak(e) {
        const ctx = getContext(e.block)
        if (ctx) clearCachedState(e.block, ctx.entity)
        else clearCachedState(e.block)
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
    energy.setCap(AbsoluteContainer.capacity.energy)
    if (savedEnergy > 0) energy.set(savedEnergy)

    // Inicializa fluido
    const fluid = FluidManager.initializeSingle(entity)
    fluid.setCap(AbsoluteContainer.capacity.fluid)
    if (savedFluid?.amount > 0) {
        fluid.setType(savedFluid.type)
        fluid.set(savedFluid.amount)
    }

    // Exibe barras de HUD
    energy.display(AbsoluteContainer.layout.slotEnergy)
    fluid.display(AbsoluteContainer.layout.slotFluid)

    entity.nameTag = 'entity.utilitycraft:absolute_container.name'
}

// ──────────────────────────────────────────────────────
// CONTEXTO E TICK
// ──────────────────────────────────────────────────────

function getContext(block) {
    if (!block) return null

    const blockKey = getBlockKey(block)
    const cachedEntity = BLOCK_CONTEXT_CACHE.get(blockKey)

    if (cachedEntity?.isValid) {
        const cachedInv = cachedEntity.getComponent('inventory')?.container
        if (cachedInv && cachedInv.size >= AbsoluteContainer.layout.totalSlots) {
            return { block, entity: cachedEntity, inv: cachedInv, dim: block.dimension }
        }

        clearCachedState(block, cachedEntity)
    }

    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
    if (!entity?.isValid) {
        BLOCK_CONTEXT_CACHE.delete(blockKey)
        return null
    }

    const inv = entity.getComponent('inventory')?.container
    if (!inv || inv.size < AbsoluteContainer.layout.totalSlots) {
        clearCachedState(block, entity)
        return null
    }

    BLOCK_CONTEXT_CACHE.set(blockKey, entity)

    return { block, entity, inv, dim: block.dimension }
}

function tick(ctx) {
    const { block, entity, inv, dim } = ctx

    if (!entity?.isValid) {
        clearCachedState(block, entity)
        return
    }

    const state = getRuntimeState(entity)
    if (!state) return

    if (!state.capsInitialized) {
        state.energy.setCap(AbsoluteContainer.capacity.energy)
        state.fluid.setCap(AbsoluteContainer.capacity.fluid)
        state.capsInitialized = true
        state.hudCooldown = 0
    }

    let hudDirty = false

    if (state.itemBackoff > 0) {
        state.itemBackoff--
    } else if (tickGate(entity, AbsoluteContainer.runtime.gates.item, AbsoluteContainer.cooldowns.item)) {
        const outputStart = AbsoluteContainer.layout.storageSlots - 9
        const outputEnd = AbsoluteContainer.layout.storageSlots - 1
        let hasOutputItems = false

        for (let slot = outputStart; slot <= outputEnd; slot++) {
            if (inv.getItem(slot)) {
                hasOutputItems = true
                break
            }
        }

        if (!hasOutputItems) {
            state.itemFailStreak = 0
            state.itemBackoff = AbsoluteContainer.runtime.itemBackoff.emptyTicks
        } else {
            const movedItems = transferItems(block, inv, dim)
            hudDirty ||= movedItems

            if (movedItems) {
                state.itemFailStreak = 0
                state.itemBackoff = 0
            } else {
                state.itemFailStreak = Math.max(0, Math.floor(Number(state.itemFailStreak) || 0) + 1)
                state.itemBackoff = state.itemFailStreak >= AbsoluteContainer.runtime.itemBackoff.failureEscalationThreshold
                    ? AbsoluteContainer.runtime.itemBackoff.drasticTicks
                    : AbsoluteContainer.runtime.itemBackoff.stallTicks
            }
        }
    }

    if (tickGate(entity, AbsoluteContainer.runtime.gates.fluid, AbsoluteContainer.cooldowns.fluid)) {
        const hasFluid = state.fluid.getType() !== 'empty' && state.fluid.get() > 0
        if (hasFluid) {
            const movedFluid = state.fluid.transferFluids(block)
            hudDirty ||= movedFluid
        }
    }

    if (hudDirty || state.hudCooldown <= 0) {
        state.energy.display(AbsoluteContainer.layout.slotEnergy)
        state.fluid.display(AbsoluteContainer.layout.slotFluid)
        state.hudCooldown = AbsoluteContainer.runtime.hudRefreshTicks
    } else {
        state.hudCooldown--
    }

    // Estado visual "ligado"
    setOn(block, true)
}

// ──────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────

function getBlockKey(block) {
    const { x, y, z } = block.location
    return `${block.dimension.id}:${x},${y},${z}`
}

function getEntityKey(entity) {
    if (!entity) return ''
    if (typeof entity.id === 'string' && entity.id.length) return entity.id

    const fallbackId = entity.scoreboardIdentity?.id
    if (Number.isFinite(fallbackId)) return `score:${fallbackId}`

    return ''
}

function clearCachedState(block, entity) {
    if (block) {
        BLOCK_CONTEXT_CACHE.delete(getBlockKey(block))
    }

    const key = getEntityKey(entity)
    if (key) {
        ENTITY_RUNTIME_CACHE.delete(key)
    }
}

function getRuntimeState(entity) {
    const key = getEntityKey(entity)
    if (!key) return null

    let state = ENTITY_RUNTIME_CACHE.get(key)
    if (state) return state

    try {
        state = {
            energy: new Energy(entity),
            fluid: FluidManager.initializeSingle(entity),
            capsInitialized: false,
            hudCooldown: 0,
            itemBackoff: 0,
            itemFailStreak: 0
        }
    } catch {
        return null
    }

    ENTITY_RUNTIME_CACHE.set(key, state)
    return state
}

function transferItems(block, inv, dim) {
    const facing = block.getState?.('utilitycraft:axis')
    const off = AbsoluteContainer.offsets[facing]
    if (!off) return false

    const loc = block.location
    const target = { x: loc.x + off[0], y: loc.y + off[1], z: loc.z + off[2] }

    const targetData = DoriosAPI.containers.getContainerAt(target, dim)
    if (!targetData?.container) return false

    const transferTarget = targetData.entity ?? targetData.block ?? targetData.container
    if (!transferTarget) return false

    const range = [
        AbsoluteContainer.layout.storageSlots - 9,
        AbsoluteContainer.layout.storageSlots - 1
    ]

    const before = []
    for (let slot = range[0]; slot <= range[1]; slot++) {
        const item = inv.getItem(slot)
        before.push(item ? `${item.typeId}:${item.amount}` : '')
    }

    // Transfer slots 159-167 (last 9 of the storage grid)
    DoriosAPI.containers.transferItems(inv, transferTarget, range)

    let index = 0
    for (let slot = range[0]; slot <= range[1]; slot++) {
        const item = inv.getItem(slot)
        const after = item ? `${item.typeId}:${item.amount}` : ''
        if (after !== before[index]) return true
        index++
    }

    return false
}

function setOn(block, on) {
    try {
        if (block.getState?.('utilitycraft:on') !== on) {
            block.setPermutation(block.permutation.withState('utilitycraft:on', on))
        }
    } catch { /* ignora */ }
}

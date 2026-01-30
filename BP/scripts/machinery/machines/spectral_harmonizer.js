import { Machine, Energy } from '../managers_extra.js'

const BEAT_CORE_SLOT = 3
const INFO_SLOTS = [0, 1, 2, 4, 5]
const STATUS_SLOT = 4

const BEAT_CYCLE_TICKS = 60 // 3 seconds at 20 tps
const BEAT_CORES_PER_CYCLE = 10 // consume 1 beat core every 10 cycles
const SPEED_BOOST = 0.10 // 10% speed boost during beat window
const DESYNC_PENALTY_TICKS = 100 // 5-second stall on failure
const MAX_SCAN_RADIUS = 16 // maximum distance to scan for machines (cubic scan: 16 blocks in each direction)
const MAX_MACHINES = 32 // maximum machines to synchronize
const SCAN_INTERVAL = 20 // ticks between full machine scans (optimization)

/*
Slots (inventory_size: 10)
- [0] Status panel (current beat phase, synchronized machines)
- [1] Beat cycle indicator (beat timing, next core consumption)
- [2] Energy panel (energy usage, efficiency)
- [3] Beat Core input slot
- [4] Warning/status indicator
- [5] Machine list panel (synchronized machines count)
- [6-9] Hidden slots (for UI fillers)
*/

DoriosAPI.register.blockComponent('spectral_harmonizer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true)
            if (!machine?.entity) return

            machine.setEnergyCost(settings?.machine?.energy_cost ?? 3200)
            machine.displayEnergy(2)
            
            // Initialize harmonizer state
            machine.entity.setDynamicProperty('sh:beatPhase', 0)
            machine.entity.setDynamicProperty('sh:cycleCount', 0)
            machine.entity.setDynamicProperty('sh:coreCounter', 0)
            machine.entity.setDynamicProperty('sh:desyncTimer', 0)
            machine.entity.setDynamicProperty('sh:lastSyncCount', 0)
            machine.entity.setDynamicProperty('sh:cachedMachines', JSON.stringify([]))
            machine.entity.setDynamicProperty('sh:lastScan', 0)
            
            machine.entity.setItem(STATUS_SLOT, 'utilitycraft:arrow_indicator_90', 1, '')
        })
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return

        const { block } = e
        const machine = new Machine(block, settings)
        if (!machine.valid) return

        const energyCost = settings?.machine?.energy_cost ?? 3200
        machine.setEnergyCost(energyCost)

        // Check for desync penalty
        const desyncTimer = Math.max(0, machine.entity.getDynamicProperty('sh:desyncTimer') ?? 0)
        if (desyncTimer > 0) {
            machine.entity.setDynamicProperty('sh:desyncTimer', desyncTimer - 1)
            machine.showWarning('Desynchronized')
            machine.off()
            renderPanels(machine, {
                beatPhase: 0,
                cycleCount: 0,
                syncedMachines: 0,
                totalMachines: 0,
                nextCoreIn: 0,
                isDesynced: true,
                desyncRemaining: Math.ceil(desyncTimer / 20)
            })
            return
        }

        // Check for beat core
        const beatCoreStack = machine.inv.getItem(BEAT_CORE_SLOT)
        if (!beatCoreStack || beatCoreStack.typeId !== 'utilitycraft:beat_core') {
            machine.showWarning('Insert Beat Core')
            machine.off()
            renderPanels(machine, {
                beatPhase: 0,
                cycleCount: 0,
                syncedMachines: 0,
                totalMachines: 0,
                nextCoreIn: 0,
                isDesynced: false,
                desyncRemaining: 0
            })
            return
        }

        // Check energy
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false)
            machine.off()
            return
        }

        // Consume energy
        const consumption = Math.min(machine.energy.get(), machine.rate, energyCost)
        if (consumption > 0) {
            machine.energy.consume(consumption)
            machine.addProgress(consumption)
        }

        // Update beat cycle
        let beatPhase = Math.max(0, machine.entity.getDynamicProperty('sh:beatPhase') ?? 0)
        beatPhase = (beatPhase + 1) % BEAT_CYCLE_TICKS
        machine.entity.setDynamicProperty('sh:beatPhase', beatPhase)

        // Check if cycle complete
        let cycleCount = machine.entity.getDynamicProperty('sh:cycleCount') ?? 0
        let coreCounter = machine.entity.getDynamicProperty('sh:coreCounter') ?? 0
        
        if (beatPhase === 0) {
            cycleCount++
            machine.entity.setDynamicProperty('sh:cycleCount', cycleCount)
            
            // Consume beat core every 10 cycles
            coreCounter++
            if (coreCounter >= BEAT_CORES_PER_CYCLE) {
                const consumed = consumeBeatCore(machine)
                if (!consumed) {
                    // Failed to consume core - trigger desync
                    machine.entity.setDynamicProperty('sh:desyncTimer', DESYNC_PENALTY_TICKS)
                    machine.showWarning('Beat Core Depleted!')
                    return
                }
                coreCounter = 0
            }
            machine.entity.setDynamicProperty('sh:coreCounter', coreCounter)
        }

        // Scan for compatible machines
        const syncData = scanAndSyncMachines(machine, beatPhase)

        // Render information panels
        const remainingCores = BEAT_CORES_PER_CYCLE - coreCounter
        renderPanels(machine, {
            beatPhase,
            cycleCount,
            syncedMachines: syncData.synced,
            totalMachines: syncData.total,
            nextCoreIn: remainingCores,
            isDesynced: false,
            desyncRemaining: 0
        })

        machine.displayEnergy(2)
        machine.on()
    },

    onPlayerBreak(e) {
        const dim = e.block.dimension
        const entity = dim.getEntitiesAtBlockLocation(e.block.location)[0]
        if (entity) {
            const inv = entity.getComponent('inventory')?.container
            if (inv) {
                // Clear info slots
                for (const slot of INFO_SLOTS) {
                    inv.setItem(slot, undefined)
                }
            }
        }
        Machine.onDestroy(e)
    }
})

function consumeBeatCore(machine) {
    const stack = machine.inv.getItem(BEAT_CORE_SLOT)
    if (!stack || stack.typeId !== 'utilitycraft:beat_core') {
        return false
    }
    
    const newAmount = stack.amount - 1
    if (newAmount <= 0) {
        machine.inv.setItem(BEAT_CORE_SLOT, undefined)
    } else {
        stack.amount = newAmount
        machine.inv.setItem(BEAT_CORE_SLOT, stack)
    }
    return true
}

function scanAndSyncMachines(harmonizer, beatPhase) {
    const dim = harmonizer.block.dimension
    const center = harmonizer.block.location
    const currentTick = globalThis.tickCount ?? 0
    
    // Check if we need to rescan for machines
    const lastScan = harmonizer.entity.getDynamicProperty('sh:lastScan') ?? 0
    const shouldRescan = (currentTick - lastScan) >= SCAN_INTERVAL
    
    let machineList = []
    
    if (shouldRescan) {
        // Perform full scan for machines with harmonic couplers
        machineList = performMachineScan(dim, center)
        harmonizer.entity.setDynamicProperty('sh:cachedMachines', JSON.stringify(machineList))
        harmonizer.entity.setDynamicProperty('sh:lastScan', currentTick)
    } else {
        // Use cached machine list
        try {
            const cached = harmonizer.entity.getDynamicProperty('sh:cachedMachines')
            machineList = cached ? JSON.parse(cached) : []
        } catch {
            machineList = []
        }
    }
    
    let syncedCount = 0
    let totalCount = machineList.length
    
    // Apply beat synchronization to cached machines
    const isBeatWindow = beatPhase < (BEAT_CYCLE_TICKS / 2)
    
    for (const pos of machineList) {
        const entities = dim.getEntitiesAtBlockLocation(pos)
        if (!entities || entities.length === 0) continue
        
        const entity = entities[0]
        
        // Apply beat synchronization
        if (isBeatWindow) {
            entity.setDynamicProperty('sh:harmonicBoost', SPEED_BOOST)
            entity.setDynamicProperty('sh:harmonicTTL', 10)
            syncedCount++
        } else {
            const ttl = entity.getDynamicProperty('sh:harmonicTTL') ?? 0
            if (ttl > 0) {
                entity.setDynamicProperty('sh:harmonicTTL', ttl - 1)
                entity.setDynamicProperty('sh:harmonicBoost', SPEED_BOOST)
                syncedCount++
            } else {
                entity.setDynamicProperty('sh:harmonicBoost', 0)
            }
        }
    }
    
    return { synced: syncedCount, total: totalCount }
}

function performMachineScan(dim, center) {
    const machines = []
    let machineCount = 0
    
    // Use labeled loops for proper breaking
    outerLoop: 
    for (let x = -MAX_SCAN_RADIUS; x <= MAX_SCAN_RADIUS; x++) {
        for (let y = -MAX_SCAN_RADIUS; y <= MAX_SCAN_RADIUS; y++) {
            for (let z = -MAX_SCAN_RADIUS; z <= MAX_SCAN_RADIUS; z++) {
                if (machineCount >= MAX_MACHINES) break outerLoop
                
                const pos = { x: center.x + x, y: center.y + y, z: center.z + z }
                const block = dim.getBlock(pos)
                
                if (!block || !block.hasTag('dorios:machine')) continue
                if (block.typeId === 'utilitycraft:spectral_harmonizer') continue
                
                const entities = dim.getEntitiesAtBlockLocation(pos)
                if (!entities || entities.length === 0) continue
                
                const entity = entities[0]
                const inv = entity.getComponent('inventory')?.container
                if (!inv) continue
                
                // Check for harmonic coupler in upgrade slots
                const hasHarmonicCoupler = checkForHarmonicCoupler(inv)
                if (!hasHarmonicCoupler) continue
                
                machines.push(pos)
                machineCount++
            }
        }
    }
    
    return machines
}

function checkForHarmonicCoupler(inventory) {
    if (!inventory) return false
    
    // Check all slots for harmonic coupler
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i)
        if (item && item.typeId === 'utilitycraft:harmonic_coupler') {
            return true
        }
    }
    return false
}

function renderPanels(machine, data) {
    const { beatPhase, cycleCount, syncedMachines, totalMachines, nextCoreIn, isDesynced, desyncRemaining } = data
    
    const beatPercent = ((beatPhase / BEAT_CYCLE_TICKS) * 100).toFixed(0)
    const isBeatWindow = beatPhase < (BEAT_CYCLE_TICKS / 2)
    const beatStatus = isBeatWindow ? '§aBeat Active' : '§7Beat Cooldown'
    
    // Status panel
    const panelStatus = {
        title: '§6Spectral Harmonizer',
        lore: isDesynced ? [
            '§c⚠ DESYNCHRONIZED',
            `§7Recovering: §f${desyncRemaining}s`,
            '§7Insert Beat Core to resume'
        ] : [
            beatStatus,
            `§7Phase: §f${beatPercent}%`,
            `§7Cycles: §f${cycleCount}`,
            `§7Boost: §f+${(SPEED_BOOST * 100).toFixed(0)}%`
        ]
    }
    
    // Beat cycle panel
    const panelBeat = {
        title: '§dBeat Cycle',
        lore: [
            `§7Next Core: §f${nextCoreIn} cycles`,
            `§7Window: §f${(BEAT_CYCLE_TICKS / 2 / 20).toFixed(1)}s`,
            `§7Consumption: §f1/${BEAT_CORES_PER_CYCLE}`
        ]
    }
    
    // Machine sync panel
    const panelMachines = {
        title: '§bSynchronized',
        lore: [
            `§7Active: §f${syncedMachines}/${totalMachines}`,
            `§7Range: §f${MAX_SCAN_RADIUS} blocks`,
            totalMachines === 0 ? '§7No compatible machines' : '',
            syncedMachines < totalMachines ? '§7Some machines not in beat window' : ''
        ].filter(line => line.length > 0)
    }
    
    const contents = [panelStatus, panelBeat, panelMachines]
    const withReset = (text = '') => text.startsWith('§r') ? text : `§r${text}`
    
    for (const panel of contents) {
        panel.title = withReset(panel.title)
        if (Array.isArray(panel.lore)) {
            panel.lore = panel.lore.map(withReset)
        }
    }
    
    const slots = [0, 1, 5]
    
    if (typeof machine.setLabels === 'function') {
        machine.setLabels(contents, slots)
    } else {
        // Fallback for older runtime
        for (let i = 0; i < contents.length; i++) {
            machine.setLabel(contents[i], slots[i])
        }
    }
}

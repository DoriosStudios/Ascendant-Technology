import { Machine, Energy, FluidManager } from '../managers_extra.js';
import { getThermalControlConfig } from '../../config/recipes/thermal_control_module.js';

/**
 * Thermal Control Module - Heat management system
 * 
 * Operating Modes:
 * 1. Passive Cooling - Always active, 10% heat reduction
 * 2. Active Cooling - Requires energy + Cryofluid, 40% heat reduction
 * 
 * Slot Layout (inventory_size: 27):
 * - [0] Energy HUD indicator
 * - [1] Status label
 * - [2] Progress/cooling indicator
 * - [3] Cryofluid capsule input
 * - [4] Cryofluid tank display
 * - [5-7] Upgrade slots (Efficiency, Range, Auto-Priority)
 * - [8] Empty capsule output
 * - [9-26] Reserved for future features
 */

// Slot constants
const ENERGY_SLOT = 0;
const STATUS_SLOT = 1;
const PROGRESS_SLOT = 2;
const CRYOFLUID_INPUT_SLOT = 3;
const CRYOFLUID_DISPLAY_SLOT = 4;
const UPGRADE_SLOTS = [5, 6, 7];
const EMPTY_CAPSULE_SLOT = 8;

// Cooling parameters
const PASSIVE_COOLING_RATE = 0.10; // 10%
const ACTIVE_COOLING_RATE = 0.40;  // 40%
const BASE_CRYOFLUID_COST = 50;    // mB per operation
const PER_MACHINE_COST = 25;        // mB per adjacent machine
const HIGH_HEAT_MULTIPLIER = 1.5;   // Cost increase above 75% heat
const MAX_CRYOFLUID_PER_TICK = 500; // Maximum consumption rate

// Adjacent machine scan offsets
const ADJACENT_OFFSETS = [
    { x: 1, y: 0, z: 0 },   // East
    { x: -1, y: 0, z: 0 },  // West
    { x: 0, y: 1, z: 0 },   // Up
    { x: 0, y: -1, z: 0 },  // Down
    { x: 0, y: 0, z: 1 },   // South
    { x: 0, y: 0, z: -1 }   // North
];

const COLORS = {
    red: '§c',
    green: '§a',
    yellow: '§e',
    blue: '§b',
    cyan: '§3',
    gray: '§7',
    white: '§f'
};

DoriosAPI.register.blockComponent('thermal_control_module', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            const defaultCost = settings?.machine?.energy_cost ?? 800;
            machine.setEnergyCost(defaultCost);
            
            // Setup fluid system
            const fluidCap = settings?.machine?.fluid_cap ?? 16000;
            const fluid = new FluidManager(machine.entity);
            fluid.createTank('cryofluid', fluidCap, 'ascendant:cryofluid');
            
            // Display initial state
            machine.displayEnergy();
            updateStatusDisplay(machine, 'Idle', COLORS.gray);
            updateFluidDisplay(machine, fluid);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        // Transfer items periodically
        if (tickGate(machine.entity, 'tcm:items_cd', 4)) {
            machine.transferItems();
        }

        const fluid = new FluidManager(machine.entity);
        
        // Handle Cryofluid capsule input/output
        if (tickGate(machine.entity, 'tcm:fluid_cd', 10)) {
            handleFluidTransfer(machine, fluid);
        }

        // Scan for adjacent machines
        const adjacentMachines = scanAdjacentMachines(block);
        
        if (adjacentMachines.length === 0) {
            updateStatusDisplay(machine, 'No Machines', COLORS.yellow);
            machine.displayEnergy();
            updateFluidDisplay(machine, fluid);
            return;
        }

        // Check if we can do active cooling
        const hasEnergy = machine.energy.get() >= (settings?.machine?.energy_cost ?? 800);
        const cryofluidNeeded = calculateCryofluidCost(adjacentMachines.length);
        const hasCryofluid = fluid.getTankAmount('cryofluid') >= cryofluidNeeded;

        let mode = 'Passive';
        let coolingRate = PASSIVE_COOLING_RATE;
        
        if (hasEnergy && hasCryofluid) {
            mode = 'Active';
            coolingRate = ACTIVE_COOLING_RATE;
            
            // Consume resources
            const energyCost = settings?.machine?.energy_cost ?? 800;
            machine.energy.consume(energyCost);
            fluid.consumeFromTank('cryofluid', cryofluidNeeded);
        }

        // Apply cooling to adjacent machines (simulated)
        // In a full implementation, this would update heat properties on adjacent machines
        applyCooling(adjacentMachines, coolingRate);

        // Update displays
        const statusText = `${mode} | ${adjacentMachines.length} Machines`;
        const statusColor = mode === 'Active' ? COLORS.green : COLORS.cyan;
        updateStatusDisplay(machine, statusText, statusColor);
        
        machine.displayEnergy();
        updateFluidDisplay(machine, fluid);
        
        // Show active state
        if (mode === 'Active') {
            machine.on();
        } else {
            machine.off();
        }
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

/**
 * Scan for adjacent machines that can be cooled
 */
function scanAdjacentMachines(block) {
    const machines = [];
    const { x, y, z } = block.location;
    const dimension = block.dimension;

    for (const offset of ADJACENT_OFFSETS) {
        try {
            const adjacentBlock = dimension.getBlock({ 
                x: x + offset.x, 
                y: y + offset.y, 
                z: z + offset.z 
            });
            
            if (!adjacentBlock) continue;

            // Check if it's a machine that can be cooled
            if (adjacentBlock.hasTag('dorios:machine')) {
                machines.push({
                    location: adjacentBlock.location,
                    typeId: adjacentBlock.typeId,
                    // In a full implementation, would read heat levels here
                    heatLevel: 0
                });
            }
        } catch (error) {
            // Block not loaded or inaccessible
            continue;
        }
    }

    return machines;
}

/**
 * Calculate Cryofluid cost based on adjacent machines
 */
function calculateCryofluidCost(machineCount) {
    let cost = BASE_CRYOFLUID_COST;
    cost += machineCount * PER_MACHINE_COST;
    
    // Cap at maximum
    cost = Math.min(cost, MAX_CRYOFLUID_PER_TICK);
    
    return cost;
}

/**
 * Apply cooling to adjacent machines
 * In a full implementation, this would reduce heat properties on machines
 */
function applyCooling(machines, coolingRate) {
    // This is a placeholder for the actual cooling logic
    // Full implementation would:
    // 1. Read heat property from each machine entity
    // 2. Calculate heat reduction: finalHeat = currentHeat * (1 - coolingRate)
    // 3. Write back reduced heat to machine entity
    
    for (const machine of machines) {
        // Placeholder: cooling applied
        // Real implementation would modify machine.entity dynamic properties
    }
}

/**
 * Handle Cryofluid capsule input/output
 */
function handleFluidTransfer(machine, fluid) {
    const inputSlot = machine.inv.getItem(CRYOFLUID_INPUT_SLOT);
    
    if (inputSlot && inputSlot.typeId.includes('cryofluid_capsule')) {
        // Try to fill tank from capsule
        const capsuleFluid = getCapsuleFluidAmount(inputSlot);
        if (capsuleFluid > 0) {
            const tankSpace = fluid.getTankCapacity('cryofluid') - fluid.getTankAmount('cryofluid');
            const transferAmount = Math.min(capsuleFluid, tankSpace);
            
            if (transferAmount > 0) {
                fluid.addToTank('cryofluid', transferAmount);
                
                // Replace with empty capsule
                machine.inv.setItem(CRYOFLUID_INPUT_SLOT, null);
                
                const emptySlot = machine.inv.getItem(EMPTY_CAPSULE_SLOT);
                if (!emptySlot) {
                    machine.inv.setItem(EMPTY_CAPSULE_SLOT, 'utilitycraft:capsule', 1);
                } else if (emptySlot.typeId === 'utilitycraft:capsule' && emptySlot.amount < 64) {
                    machine.inv.setItem(EMPTY_CAPSULE_SLOT, 'utilitycraft:capsule', emptySlot.amount + 1);
                }
            }
        }
    }
}

/**
 * Get fluid amount from capsule item
 */
function getCapsuleFluidAmount(itemStack) {
    const typeId = itemStack.typeId;
    
    // Parse capsule type to determine fluid amount
    if (typeId.includes('cryofluid_capsule')) {
        // Default to 1000 mB per capsule
        // Could be refined based on capsule tier
        return 1000;
    }
    
    return 0;
}

/**
 * Update status display label
 */
function updateStatusDisplay(machine, text, color = COLORS.white) {
    const statusText = `${color}${text}`;
    machine.entity.setItem(STATUS_SLOT, 'utilitycraft:hud_display', 1, statusText);
}

/**
 * Update fluid tank display
 */
function updateFluidDisplay(machine, fluid) {
    const amount = fluid.getTankAmount('cryofluid');
    const capacity = fluid.getTankCapacity('cryofluid');
    const percent = capacity > 0 ? Math.floor((amount / capacity) * 100) : 0;
    
    const displayText = `${COLORS.cyan}Cryofluid\n${amount}/${capacity} mB\n${percent}%`;
    machine.entity.setItem(CRYOFLUID_DISPLAY_SLOT, 'utilitycraft:hud_display', 1, displayText);
}

/**
 * Simple tick gate utility
 */
function tickGate(entity, key, interval) {
    try {
        const prop = entity.getDynamicProperty(key) ?? 0;
        if (prop >= interval) {
            entity.setDynamicProperty(key, 0);
            return true;
        }
        entity.setDynamicProperty(key, prop + 1);
        return false;
    } catch {
        return false;
    }
}

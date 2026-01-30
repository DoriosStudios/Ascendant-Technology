/**
 * Thermal Control Module Configuration
 * 
 * Defines cooling parameters, upgrade effects, and operational settings
 */

// Cooling modes
export const COOLING_MODE = Object.freeze({
    PASSIVE: 'passive',
    ACTIVE: 'active'
});

// Default configuration
export const DEFAULT_CONFIG = Object.freeze({
    // Energy system
    energyCapacity: 32_000_000,      // 32 MDE
    energyConsumption: 800,           // DE per tick (active mode)
    energyTransferRate: 8_000,        // DE per tick
    
    // Fluid system
    fluidCapacity: 16_000,            // mB (Cryofluid only)
    fluidType: 'ascendant:cryofluid',
    
    // Cooling parameters
    passiveCoolingRate: 0.10,         // 10% heat reduction
    activeCoolingRate: 0.40,          // 40% heat reduction
    baseCryofluidCost: 50,            // mB per operation
    perMachineCryofluidCost: 25,      // mB per adjacent machine
    highHeatMultiplier: 1.5,          // Cost increase above 75% heat
    
    // Operational limits
    maxAdjacentMachines: 6,           // Maximum machines that can be cooled
    maxCryofluidPerTick: 500,         // Maximum consumption rate
    scanInterval: 20,                 // Ticks between machine scans
    
    // Upgrade slots
    upgradeSlots: 3,                  // Total upgrade capacity
});

// Upgrade effects configuration
export const UPGRADE_EFFECTS = Object.freeze({
    efficiency: {
        tier1: {
            cryofluidReduction: 0.20,    // -20% consumption
            energyReduction: 0.15,        // -15% consumption
        },
        tier2: {
            cryofluidReduction: 0.35,    // -35% consumption
            energyReduction: 0.30,        // -30% consumption
        },
        tier3: {
            cryofluidReduction: 0.50,    // -50% consumption
            energyReduction: 0.45,        // -45% consumption
        }
    },
    range: {
        tier1: {
            rangeType: 'diagonal',        // Adds diagonal adjacency
            maxMachines: 10,              // Increased capacity
        },
        tier2: {
            rangeType: 'radius_2',        // 2-block radius
            maxMachines: 16,              // Further increased
        }
    },
    autoPriority: {
        tier1: {
            enabled: true,
            overheadReduction: 0.10,      // -10% total cost
        }
    }
});

// Heat thresholds and effects
export const HEAT_THRESHOLDS = Object.freeze({
    cool: {
        max: 24,
        efficiencyModifier: 1.00,         // 100% efficiency
        energyModifier: 1.00,             // Normal energy cost
        failureChance: 0.00,              // 0% failure rate
        displayColor: '§a',               // Green
        displayText: 'Cool'
    },
    warm: {
        min: 25,
        max: 49,
        efficiencyModifier: 0.95,         // 95% efficiency (-5%)
        energyModifier: 1.05,             // 105% energy cost (+5%)
        failureChance: 0.01,              // 1% failure rate
        displayColor: '§e',               // Yellow
        displayText: 'Warm'
    },
    hot: {
        min: 50,
        max: 74,
        efficiencyModifier: 0.85,         // 85% efficiency (-15%)
        energyModifier: 1.10,             // 110% energy cost (+10%)
        failureChance: 0.05,              // 5% failure rate
        displayColor: '§6',               // Gold
        displayText: 'Hot'
    },
    critical: {
        min: 75,
        max: 89,
        efficiencyModifier: 0.70,         // 70% efficiency (-30%)
        energyModifier: 1.25,             // 125% energy cost (+25%)
        failureChance: 0.15,              // 15% failure rate
        displayColor: '§c',               // Red
        displayText: 'Critical'
    },
    overheated: {
        min: 90,
        max: 100,
        efficiencyModifier: 0.00,         // 0% efficiency (shutdown)
        energyModifier: 0.00,             // Machine disabled
        failureChance: 1.00,              // 100% failure (forced cooldown)
        displayColor: '§4',               // Dark red
        displayText: 'OVERHEATED'
    }
});

/**
 * Get Thermal Control configuration
 * Can be overridden by server config files
 */
export function getThermalControlConfig() {
    // In the future, this could read from a config file
    // For now, return the default configuration
    return DEFAULT_CONFIG;
}

/**
 * Calculate cooling effect
 * @param {number} currentHeat - Current heat level (0-100)
 * @param {boolean} hasEnergy - Module has sufficient energy
 * @param {boolean} hasCryofluid - Module has sufficient Cryofluid
 * @param {number} adjacentCount - Number of machines being cooled
 * @param {Object} upgrades - Applied upgrade effects
 * @returns {Object} Cooling result
 */
export function calculateCooling(currentHeat, hasEnergy, hasCryofluid, adjacentCount, upgrades = {}) {
    const config = getThermalControlConfig();
    
    let coolingRate = config.passiveCoolingRate;
    let cryofluidCost = 0;
    let energyCost = 0;
    let mode = COOLING_MODE.PASSIVE;
    
    // Active cooling if resources available
    if (hasEnergy && hasCryofluid) {
        coolingRate = config.activeCoolingRate;
        mode = COOLING_MODE.ACTIVE;
        
        // Base costs
        cryofluidCost = config.baseCryofluidCost;
        energyCost = config.energyConsumption;
        
        // Add cost per adjacent machine
        cryofluidCost += adjacentCount * config.perMachineCryofluidCost;
        
        // Apply upgrade modifiers
        if (upgrades.efficiency) {
            const tier = upgrades.efficiency.tier || 1;
            const effect = UPGRADE_EFFECTS.efficiency[`tier${tier}`];
            if (effect) {
                cryofluidCost *= (1 - effect.cryofluidReduction);
                energyCost *= (1 - effect.energyReduction);
            }
        }
        
        if (upgrades.autoPriority) {
            cryofluidCost *= (1 - UPGRADE_EFFECTS.autoPriority.tier1.overheadReduction);
            energyCost *= (1 - UPGRADE_EFFECTS.autoPriority.tier1.overheadReduction);
        }
        
        // High heat penalty
        if (currentHeat >= HEAT_THRESHOLDS.critical.min) {
            cryofluidCost *= config.highHeatMultiplier;
        }
        
        // Cap maximum consumption
        cryofluidCost = Math.min(cryofluidCost, config.maxCryofluidPerTick);
    }
    
    // Calculate final heat
    const heatReduction = currentHeat * coolingRate;
    const finalHeat = Math.max(0, currentHeat - heatReduction);
    
    return {
        mode,
        coolingRate,
        heatReduction,
        finalHeat,
        cryofluidCost: Math.ceil(cryofluidCost),
        energyCost: Math.ceil(energyCost),
        effectiveness: currentHeat > 0 ? (heatReduction / currentHeat) * 100 : 0
    };
}

/**
 * Get heat threshold for a given heat level
 * @param {number} heatLevel - Current heat level (0-100)
 * @returns {Object} Heat threshold info
 */
export function getHeatThreshold(heatLevel) {
    if (heatLevel <= HEAT_THRESHOLDS.cool.max) {
        return HEAT_THRESHOLDS.cool;
    } else if (heatLevel <= HEAT_THRESHOLDS.warm.max) {
        return HEAT_THRESHOLDS.warm;
    } else if (heatLevel <= HEAT_THRESHOLDS.hot.max) {
        return HEAT_THRESHOLDS.hot;
    } else if (heatLevel <= HEAT_THRESHOLDS.critical.max) {
        return HEAT_THRESHOLDS.critical;
    } else {
        return HEAT_THRESHOLDS.overheated;
    }
}

/**
 * Check if a machine type can be cooled
 * @param {string} machineTypeId - Machine block type ID
 * @returns {boolean} True if machine can be cooled
 */
export function canCoolMachine(machineTypeId) {
    // In the future, this could filter specific machine types
    // For now, all machines with the 'dorios:machine' tag can be cooled
    return true;
}

/**
 * Get maximum machines that can be cooled based on upgrades
 * @param {Object} upgrades - Applied upgrade effects
 * @returns {number} Maximum machine count
 */
export function getMaxCoolableMachines(upgrades = {}) {
    const config = getThermalControlConfig();
    let max = config.maxAdjacentMachines;
    
    if (upgrades.range) {
        const tier = upgrades.range.tier || 1;
        const effect = UPGRADE_EFFECTS.range[`tier${tier}`];
        if (effect) {
            max = effect.maxMachines;
        }
    }
    
    return max;
}

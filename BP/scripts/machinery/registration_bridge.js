/**
 * ========================================================
 * Machine Registration Bridge
 * ========================================================
 * 
 * This module wraps machine registrations to track integration
 * status and ensure all AT machines properly register with
 * UtilityCraft core systems.
 * 
 * It does NOT modify machine behavior - only adds tracking
 * for integration validation.
 */

import { registerMachine } from '../config/utilitycraft_integration.js';

/**
 * Wraps DoriosAPI.register.blockComponent to track registrations
 * and provide integration validation
 */
const originalBlockComponent = globalThis.DoriosAPI?.register?.blockComponent;

if (originalBlockComponent) {
    // Store original method
    const wrappedBlockComponent = originalBlockComponent.bind(globalThis.DoriosAPI.register);
    
    // Override with tracking wrapper
    globalThis.DoriosAPI.register.blockComponent = function(id, handlers) {
        // Call original registration
        wrappedBlockComponent(id, handlers);
        
        // Track registration for integration monitoring
        registerMachine(id);
    };
}

/**
 * Validates that all expected AT machines are registered
 * @returns {boolean} True if all machines registered
 */
export function validateMachineRegistrations() {
    const expectedMachines = [
        'liquifier',
        'energizer',
        'catalyst_weaver',
        'cloner',
        'singularity_fabricator',
        'cryo_chamber',
        'residue_processor',
        'network_center',
        'laser_barrier',
        'absolute_container'
    ];
    
    const { getIntegrationStatus } = await import('../config/utilitycraft_integration.js');
    const status = getIntegrationStatus();
    
    const registered = status.machinesRegistered;
    const missing = expectedMachines.filter(m => !registered.includes(m));
    
    if (missing.length > 0) {
        console.warn(`[AT Integration] Missing machine registrations: ${missing.join(', ')}`);
        return false;
    }
    
    return true;
}

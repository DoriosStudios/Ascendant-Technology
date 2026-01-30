/**
 * ========================================================
 * UtilityCraft Integration Registry
 * ========================================================
 * 
 * Centralized integration point between Ascendant Technology
 * and UtilityCraft core systems.
 * 
 * This module provides:
 * - Machine capability declarations
 * - Registration bridge for AT machines
 * - Recipe system integration helpers
 * - API version compatibility checks
 * 
 * @module utilitycraft_integration
 * @version 1.0.0
 * @requires UtilityCraft 3.3+
 */

import { system, world } from "@minecraft/server";

/**
 * Integration metadata for version compatibility checking
 */
export const INTEGRATION_INFO = {
    addon_name: "Ascendant Technology",
    addon_version: "0.7.1",
    required_utilitycraft_version: "3.3.0",
    api_version: "1.0.0",
    last_updated: "2026-01-30"
};

/**
 * Machine capabilities registry.
 * Declares what each AT machine can do and how it integrates with UtilityCraft.
 * 
 * @typedef {Object} MachineCapability
 * @property {string} id - Machine identifier (without namespace)
 * @property {string} type - Machine type category
 * @property {boolean} requiresEnergy - Whether machine needs energy
 * @property {boolean} hasFluidInput - Whether machine accepts fluid input
 * @property {boolean} hasFluidOutput - Whether machine produces fluid output
 * @property {string[]} upgradeSlots - Accepted upgrade types
 * @property {string} recipeSystem - Recipe registration mechanism
 * @property {Object} integration - Integration specifics
 */
export const MACHINE_CAPABILITIES = {
    liquifier: {
        id: "liquifier",
        displayName: "Liquifier (Flux Crucible)",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: true,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_liquifier_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: true,
            containerType: "custom",
            slots: 20
        }
    },

    energizer: {
        id: "energizer",
        displayName: "Energizer (Pulse Forge)",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_energizer_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "custom",
            slots: 20
        }
    },

    catalyst_weaver: {
        id: "catalyst_weaver",
        displayName: "Catalyst Weaver (Arc Loom)",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: true,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_catalyst_weaver_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: true,
            containerType: "custom",
            slots: 27,
            specialFeatures: ["multi_catalyst", "residue_output"]
        }
    },

    cloner: {
        id: "cloner",
        displayName: "Duplicator (Cloner | Replication Matrix)",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: true,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_cloner_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: true,
            containerType: "custom",
            slots: 20,
            specialFeatures: ["high_energy_consumption", "template_based"]
        }
    },

    singularity_fabricator: {
        id: "singularity_fabricator",
        displayName: "Singularity Fabricator",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: [], // No upgrades supported
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_cloner_recipe", // Uses cloner system
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "custom",
            slots: 20,
            specialFeatures: ["high_energy_consumption", "no_upgrades"]
        }
    },

    cryo_chamber: {
        id: "cryo_chamber",
        displayName: "Cryo Chamber",
        type: "multi_function",
        requiresEnergy: true,
        hasFluidInput: true,
        hasFluidOutput: true,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_cryo_chamber_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: true,
            containerType: "custom",
            slots: 27,
            specialFeatures: ["multi_mode", "temperature_control", "fluid_generation"]
        }
    },

    residue_processor: {
        id: "residue_processor",
        displayName: "Residue Processor",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade", "hyper_processing_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_residue_processor_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "custom",
            slots: 20,
            specialFeatures: ["waste_recycling", "chance_based_output"]
        }
    },

    network_center: {
        id: "network_center",
        displayName: "Network Center",
        type: "monitor",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: [], // No upgrades
        recipeSystem: "none",
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "custom",
            slots: 20,
            specialFeatures: ["network_scanning", "dashboard", "no_io"]
        }
    },

    laser_barrier: {
        id: "laser_barrier",
        displayName: "Laser Barrier",
        type: "utility",
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: [], // Custom upgrade system (length, height, efficiency)
        recipeSystem: "none",
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "none",
            slots: 0,
            specialFeatures: ["defensive_field", "custom_upgrades", "no_ui"]
        }
    },

    absolute_container: {
        id: "absolute_container",
        displayName: "Absolute Container",
        type: "storage",
        requiresEnergy: false,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: [], // No upgrades
        recipeSystem: "none",
        integration: {
            energyNetwork: false,
            fluidNetwork: false,
            containerType: "custom",
            slots: 168, // 14x12 grid
            specialFeatures: ["mass_storage", "energy_fluid_display"]
        }
    }
};

/**
 * Recipe registration helpers for extending UtilityCraft machines
 * from AT recipes.
 */
export const RECIPE_EXTENSIONS = {
    /**
     * Recipe event IDs for UtilityCraft base machines
     * that AT extends with additional recipes
     */
    infuser: "utilitycraft:register_infuser_recipe",
    crusher: "utilitycraft:register_crusher_recipe",
    furnace: "utilitycraft:register_furnace_recipe",
    sieve: "utilitycraft:register_sieve_recipe"
};

/**
 * Integration status tracker
 */
const integrationStatus = {
    initialized: false,
    machinesRegistered: [],
    recipesRegistered: [],
    errors: []
};

/**
 * Logs integration information to console
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error)
 */
function log(message, level = "info") {
    const prefix = "[AT Integration]";
    switch (level) {
        case "error":
            console.error(`${prefix} ${message}`);
            break;
        case "warn":
            console.warn(`${prefix} ${message}`);
            break;
        default:
            console.log(`${prefix} ${message}`);
    }
}

/**
 * Validates integration compatibility with UtilityCraft
 * @returns {boolean} True if compatible, false otherwise
 */
export function validateIntegration() {
    try {
        // Check if DoriosAPI is available
        if (typeof globalThis.DoriosAPI === "undefined") {
            log("DoriosAPI not found! UtilityCraft core may not be loaded.", "error");
            integrationStatus.errors.push("DoriosAPI_NOT_FOUND");
            return false;
        }

        // Check if required DoriosAPI methods exist
        if (!globalThis.DoriosAPI.register) {
            log("DoriosAPI.register not available!", "error");
            integrationStatus.errors.push("REGISTER_API_MISSING");
            return false;
        }

        log("Integration validation successful");
        return true;
    } catch (error) {
        log(`Integration validation failed: ${error}`, "error");
        integrationStatus.errors.push(`VALIDATION_ERROR: ${error}`);
        return false;
    }
}

/**
 * Registers a machine with the integration system
 * @param {string} machineId - Machine identifier
 */
export function registerMachine(machineId) {
    if (!MACHINE_CAPABILITIES[machineId]) {
        log(`Unknown machine: ${machineId}`, "warn");
        return;
    }

    integrationStatus.machinesRegistered.push(machineId);
    log(`Machine registered: ${machineId}`);
}

/**
 * Registers a recipe system with the integration
 * @param {string} recipeSystem - Recipe system identifier
 */
export function registerRecipeSystem(recipeSystem) {
    integrationStatus.recipesRegistered.push(recipeSystem);
    log(`Recipe system registered: ${recipeSystem}`);
}

/**
 * Gets the current integration status
 * @returns {Object} Integration status
 */
export function getIntegrationStatus() {
    return {
        ...integrationStatus,
        info: INTEGRATION_INFO
    };
}

/**
 * Initializes the integration system
 * Called on world load
 */
export function initializeIntegration() {
    if (integrationStatus.initialized) {
        log("Integration already initialized", "warn");
        return;
    }

    log(`Initializing ${INTEGRATION_INFO.addon_name} v${INTEGRATION_INFO.addon_version}`);
    log(`Required UtilityCraft version: ${INTEGRATION_INFO.required_utilitycraft_version}+`);

    if (!validateIntegration()) {
        log("Integration validation failed - some features may not work!", "error");
        return;
    }

    integrationStatus.initialized = true;
    log("Integration initialized successfully");
}

/**
 * Helper to send recipe registration event
 * @param {string} eventId - Script event ID
 * @param {Object} recipes - Recipe data
 */
export function sendRecipeEvent(eventId, recipes) {
    try {
        system.sendScriptEvent(eventId, JSON.stringify(recipes));
        log(`Sent recipe event: ${eventId}`);
    } catch (error) {
        log(`Failed to send recipe event ${eventId}: ${error}`, "error");
        integrationStatus.errors.push(`RECIPE_EVENT_ERROR: ${eventId}`);
    }
}

/**
 * Prints integration report to console
 */
export function printIntegrationReport() {
    log("=== Integration Report ===");
    log(`Status: ${integrationStatus.initialized ? "Initialized" : "Not Initialized"}`);
    log(`Machines Registered: ${integrationStatus.machinesRegistered.length}`);
    log(`Recipe Systems Registered: ${integrationStatus.recipesRegistered.length}`);
    
    if (integrationStatus.errors.length > 0) {
        log(`Errors: ${integrationStatus.errors.length}`, "warn");
        integrationStatus.errors.forEach(err => log(`  - ${err}`, "warn"));
    } else {
        log("No errors detected");
    }
    
    log("=========================");
}

// Initialize integration on world load
world.afterEvents.worldInitialize.subscribe(() => {
    initializeIntegration();
});

// Print integration report after world loads (with delay to ensure all systems loaded)
world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        printIntegrationReport();
    }, 100); // 5 second delay (100 ticks)
});

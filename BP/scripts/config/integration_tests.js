/**
 * Integration Test Examples
 * 
 * This file demonstrates how to test AT integration with UtilityCraft.
 * It can be imported in development/testing environments to validate integration.
 */

import { system, world } from "@minecraft/server";
import { 
    validateIntegration,
    getIntegrationStatus,
    printIntegrationReport,
    MACHINE_CAPABILITIES,
    sendRecipeEvent
} from './config/utilitycraft_integration.js';

/**
 * Test 1: Integration Validation
 * Verifies that DoriosAPI is available and integration is valid
 */
function testIntegrationValidation() {
    console.warn("[Test 1] Testing integration validation...");
    
    const isValid = validateIntegration();
    
    if (isValid) {
        console.warn("[Test 1] ✓ Integration validation passed");
        return true;
    } else {
        console.error("[Test 1] ✗ Integration validation failed");
        return false;
    }
}

/**
 * Test 2: Machine Capabilities
 * Verifies that all expected machines are registered
 */
function testMachineCapabilities() {
    console.warn("[Test 2] Testing machine capabilities...");
    
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
    
    const registeredCount = Object.keys(MACHINE_CAPABILITIES).length;
    console.warn(`[Test 2] Found ${registeredCount} machine capabilities`);
    
    let allPresent = true;
    for (const machineId of expectedMachines) {
        if (!MACHINE_CAPABILITIES[machineId]) {
            console.error(`[Test 2] ✗ Missing capability for: ${machineId}`);
            allPresent = false;
        }
    }
    
    if (allPresent) {
        console.warn("[Test 2] ✓ All expected machine capabilities present");
        return true;
    } else {
        console.error("[Test 2] ✗ Some machine capabilities missing");
        return false;
    }
}

/**
 * Test 3: Integration Status
 * Checks the integration status after world load
 */
function testIntegrationStatus() {
    console.warn("[Test 3] Testing integration status...");
    
    const status = getIntegrationStatus();
    
    console.warn(`[Test 3] Integration initialized: ${status.initialized}`);
    console.warn(`[Test 3] Machines registered: ${status.machinesRegistered.length}`);
    console.warn(`[Test 3] Recipe systems registered: ${status.recipesRegistered.length}`);
    console.warn(`[Test 3] Errors: ${status.errors.length}`);
    
    if (status.initialized && status.errors.length === 0) {
        console.warn("[Test 3] ✓ Integration status looks good");
        return true;
    } else {
        console.error("[Test 3] ✗ Integration status has issues");
        return false;
    }
}

/**
 * Test 4: Recipe Registration
 * Tests that recipe registration works correctly
 */
function testRecipeRegistration() {
    console.warn("[Test 4] Testing recipe registration...");
    
    try {
        const testRecipes = {
            "test:recipe_example": {
                input: { id: "minecraft:iron_ingot", amount: 1 },
                output: { id: "minecraft:gold_ingot", amount: 1 },
                energyCost: 5000,
                seconds: 5
            }
        };
        
        // This won't actually register (no listener for test event)
        // but tests the sendRecipeEvent function
        sendRecipeEvent("test:test_event", testRecipes);
        
        console.warn("[Test 4] ✓ Recipe event sent successfully");
        return true;
    } catch (err) {
        console.error(`[Test 4] ✗ Recipe registration failed: ${err}`);
        return false;
    }
}

/**
 * Test 5: DoriosAPI Availability
 * Verifies DoriosAPI methods are available
 */
function testDoriosAPI() {
    console.warn("[Test 5] Testing DoriosAPI availability...");
    
    const checks = [
        { name: "DoriosAPI", check: () => typeof globalThis.DoriosAPI !== "undefined" },
        { name: "DoriosAPI.register", check: () => typeof globalThis.DoriosAPI?.register !== "undefined" },
        { name: "DoriosAPI.register.blockComponent", check: () => typeof globalThis.DoriosAPI?.register?.blockComponent === "function" },
        { name: "DoriosAPI.register.itemComponent", check: () => typeof globalThis.DoriosAPI?.register?.itemComponent === "function" },
        { name: "DoriosAPI.containers", check: () => typeof globalThis.DoriosAPI?.containers !== "undefined" }
    ];
    
    let allPassed = true;
    for (const { name, check } of checks) {
        const passed = check();
        if (passed) {
            console.warn(`[Test 5]   ✓ ${name} available`);
        } else {
            console.error(`[Test 5]   ✗ ${name} not available`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        console.warn("[Test 5] ✓ All DoriosAPI checks passed");
        return true;
    } else {
        console.error("[Test 5] ✗ Some DoriosAPI checks failed");
        return false;
    }
}

/**
 * Run all integration tests
 */
function runIntegrationTests() {
    console.warn("========================================");
    console.warn("AT Integration Test Suite");
    console.warn("========================================");
    
    const tests = [
        testIntegrationValidation,
        testMachineCapabilities,
        testIntegrationStatus,
        testRecipeRegistration,
        testDoriosAPI
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (err) {
            console.error(`Test error: ${err}`);
            failed++;
        }
    }
    
    console.warn("========================================");
    console.warn(`Tests passed: ${passed}/${tests.length}`);
    console.warn(`Tests failed: ${failed}/${tests.length}`);
    console.warn("========================================");
    
    // Print integration report
    printIntegrationReport();
}

/**
 * Example: Adding custom recipes to AT machines
 */
function exampleAddCustomRecipes() {
    console.warn("[Example] Registering custom recipes...");
    
    // Add recipe to Liquifier
    const liquifierRecipes = {
        "example:netherite_liquification": {
            input: { id: "minecraft:netherite_ingot", amount: 1 },
            fluid: { type: "liquified_aetherium", amount: 3000 },
            energyCost: 20000,
            seconds: 30,
            byproduct: {
                id: "minecraft:netherrack",
                amount: 4,
                chance: 0.5
            }
        }
    };
    
    sendRecipeEvent("utilitycraft:register_liquifier_recipe", liquifierRecipes);
    console.warn("[Example] ✓ Custom liquifier recipe registered");
    
    // Add recipe to Energizer
    const energizerRecipes = {
        "example:energized_netherite": {
            input: { id: "minecraft:netherite_ingot", amount: 1 },
            output: { id: "utilitycraft:energized_netherite", amount: 1 },
            energyCost: 15000,
            seconds: 20
        }
    };
    
    sendRecipeEvent("utilitycraft:register_energizer_recipe", energizerRecipes);
    console.warn("[Example] ✓ Custom energizer recipe registered");
}

// Run tests after world loads
world.afterEvents.worldLoad.subscribe(() => {
    // Wait a bit to ensure all systems are loaded
    system.runTimeout(() => {
        runIntegrationTests();
        
        // Uncomment to test custom recipe registration
        // exampleAddCustomRecipes();
    }, 120); // 6 second delay
});

// Export test functions for external use
export {
    testIntegrationValidation,
    testMachineCapabilities,
    testIntegrationStatus,
    testRecipeRegistration,
    testDoriosAPI,
    runIntegrationTests,
    exampleAddCustomRecipes
};

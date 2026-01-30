# UtilityCraft Integration API Usage Guide

This guide explains how to properly integrate Ascendant Technology (AT) machines with UtilityCraft core systems using the provided integration APIs.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Machine Registration](#machine-registration)
3. [Recipe Systems](#recipe-systems)
4. [Energy & Fluid Integration](#energy--fluid-integration)
5. [Container Management](#container-management)
6. [Integration Validation](#integration-validation)
7. [Examples](#examples)

---

## Getting Started

### Prerequisites

- UtilityCraft 3.3+ installed
- Understanding of Minecraft Bedrock Add-on development
- Basic JavaScript/TypeScript knowledge

### Import the Integration API

```javascript
import { 
    MACHINE_CAPABILITIES,
    validateIntegration,
    registerMachine,
    registerRecipeSystem,
    sendRecipeEvent
} from './config/utilitycraft_integration.js';
```

---

## Machine Registration

### Using DoriosAPI for Block Components

All AT machines should register through DoriosAPI, which automatically handles namespace prefixing:

```javascript
// Machine implementation
DoriosAPI.register.blockComponent('my_machine', {
    beforeOnPlayerPlace(e, { params: settings }) {
        // Initialize machine entity and container
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;
            
            // Configure machine
            machine.setEnergyCost(settings.machine.energy_cost ?? 2000);
            machine.displayEnergy();
        });
    },
    
    onTick(e, { params: settings }) {
        // Machine processing logic
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        
        // Processing logic here...
    }
});
```

The registration bridge automatically tracks this for integration validation.

### Declaring Machine Capabilities

Add your machine to `MACHINE_CAPABILITIES` in `utilitycraft_integration.js`:

```javascript
export const MACHINE_CAPABILITIES = {
    my_machine: {
        id: "my_machine",
        displayName: "My Custom Machine",
        type: "processor",
        requiresEnergy: true,
        hasFluidInput: true,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade"],
        recipeSystem: "script_event",
        recipeEventId: "utilitycraft:register_my_machine_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: true,
            containerType: "custom",
            slots: 20
        }
    }
};
```

---

## Recipe Systems

### Script Event-Based Registration

AT machines use script events for recipe registration. This allows external add-ons to inject recipes without modifying AT files.

#### Step 1: Define Recipe Structure

```javascript
// my_machine_recipes.js
import { system } from "@minecraft/server";
import { registerRecipeSystem } from '../utilitycraft_integration.js';

const DEFAULT_ENERGY_COST = 5000;
const TICKS_PER_SECOND = 20;

/**
 * @typedef {Object} MyMachineRecipe
 * @property {string} id - Unique recipe identifier
 * @property {Object} input - Input item stack
 * @property {Object} output - Output item stack
 * @property {number} energyCost - Energy required
 * @property {number} seconds - Processing time
 */

const myMachineRecipes = [];

function defineRecipe(definition) {
    return {
        id: definition.id,
        input: normalizeItemStack(definition.input),
        output: normalizeItemStack(definition.output),
        energyCost: definition.energyCost ?? DEFAULT_ENERGY_COST,
        processTicks: (definition.seconds ?? 5) * TICKS_PER_SECOND
    };
}

function normalizeItemStack(stack) {
    if (typeof stack === 'string') {
        return { id: stack, amount: 1 };
    }
    return {
        id: stack.id,
        amount: stack.amount ?? 1
    };
}

export function getMyMachineRecipes() {
    return myMachineRecipes;
}
```

#### Step 2: Set Up Event Listener

```javascript
const MY_MACHINE_EVENT_ID = "utilitycraft:register_my_machine_recipe";

// Track integration registration
registerRecipeSystem('my_machine');

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== MY_MACHINE_EVENT_ID) return;
    
    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;
        
        let added = 0;
        let replaced = 0;
        
        for (const [recipeId, definition] of Object.entries(payload)) {
            try {
                const recipe = defineRecipe({ id: recipeId, ...definition });
                const index = myMachineRecipes.findIndex(r => r.id === recipe.id);
                
                if (index >= 0) {
                    myMachineRecipes[index] = recipe;
                    replaced++;
                } else {
                    myMachineRecipes.push(recipe);
                    added++;
                }
            } catch (err) {
                console.warn(`Failed to register recipe '${recipeId}':`, err);
            }
        }
        
        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} recipes.`);
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse recipe payload:", err);
    }
});
```

#### Step 3: Register Recipes from External Add-ons

```javascript
// In an external add-on or AT extension
import { system, world } from "@minecraft/server";
import { sendRecipeEvent } from './utilitycraft_integration.js';

world.afterEvents.worldLoad.subscribe(() => {
    const customRecipes = {
        "my_addon:custom_recipe_1": {
            input: { id: "minecraft:iron_ingot", amount: 2 },
            output: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
            energyCost: 8000,
            seconds: 10
        },
        "my_addon:custom_recipe_2": {
            input: "minecraft:diamond",
            output: "utilitycraft:compressed_diamond",
            energyCost: 12000,
            seconds: 15
        }
    };
    
    // Method 1: Using helper
    sendRecipeEvent("utilitycraft:register_my_machine_recipe", customRecipes);
    
    // Method 2: Direct event
    system.sendScriptEvent(
        "utilitycraft:register_my_machine_recipe",
        JSON.stringify(customRecipes)
    );
});
```

---

## Energy & Fluid Integration

### Energy System

All energy-using machines should use the `Energy` and `Machine` classes:

```javascript
import { Machine, Energy, updatePipes } from '../machinery/managers_extra.js';

// In beforeOnPlayerPlace
Machine.spawnMachineEntity(e, settings, () => {
    const machine = new Machine(e.block, settings, true);
    if (!machine?.entity) return;
    
    // Set energy requirements
    machine.setEnergyCost(5000); // Base cost per operation
    machine.displayEnergy(); // Show energy HUD
    
    // Connect to energy network
    updatePipes(e.block, 'energy');
});

// In onTick
const machine = new Machine(block, settings);
if (!machine.valid) return;

const energy = new Energy(machine.entity);
if (!energy.has(machine.energyCost)) {
    // Not enough energy
    return;
}

// Consume energy
energy.remove(machine.energyCost);

// Process item...
```

### Fluid System

Machines with fluid support use the `FluidManager` class:

```javascript
import { Machine, FluidManager } from '../machinery/managers_extra.js';

const FLUID_SLOT = 10;
const FLUID_DISPLAY_SLOT = 11;

// In beforeOnPlayerPlace
const tank = FluidManager.initializeSingle(machine.entity);
tank.display(FLUID_DISPLAY_SLOT);

// In onTick
const tank = FluidManager.initializeSingle(machine.entity);
const available = tank.get(); // { type: string, amount: number }

if (available.type === 'liquified_aetherium' && available.amount >= 100) {
    // Consume fluid
    tank.set(available.type, available.amount - 100);
    
    // Process with fluid...
}

// To output fluid
tank.set('cryofluid', 500); // Sets tank to 500mB of cryofluid

// Connect to fluid network
updatePipes(block, 'fluid');
```

---

## Container Management

### Using DoriosAPI Containers

DoriosAPI provides a unified container interface:

```javascript
// Get container from machine entity
const container = DoriosAPI.containers.getContainer(machine.entity);

if (container) {
    // Access slots
    const inputSlot = container.getSlot(3);
    const outputSlot = container.getSlot(5);
    
    // Check slot contents
    if (inputSlot.hasItem()) {
        const item = inputSlot.getItem();
        console.log(`Found ${item.amount}x ${item.typeId}`);
    }
    
    // Set slot contents
    outputSlot.setItem(new ItemStack('minecraft:diamond', 1));
}
```

### Blocking Slots

Prevent players from accessing specific slots:

```javascript
machine.blockSlots([FLUID_DISPLAY_SLOT, 6, 7, 8]); // Array of slot indices
```

---

## Integration Validation

### Checking Integration Status

```javascript
import { 
    validateIntegration,
    getIntegrationStatus,
    printIntegrationReport 
} from './config/utilitycraft_integration.js';

// Check if integration is valid
if (validateIntegration()) {
    console.log("Integration OK");
} else {
    console.error("Integration failed!");
}

// Get detailed status
const status = getIntegrationStatus();
console.log("Machines registered:", status.machinesRegistered);
console.log("Recipe systems:", status.recipesRegistered);
console.log("Errors:", status.errors);

// Print full report to console
printIntegrationReport();
```

### Automatic Validation

The integration system automatically validates on world load and prints a report:

```
[AT Integration] Initializing Ascendant Technology v0.7.1
[AT Integration] Required UtilityCraft version: 3.3.0+
[AT Integration] Integration validation successful
[AT Integration] Integration initialized successfully
[AT Integration] === Integration Report ===
[AT Integration] Status: Initialized
[AT Integration] Machines Registered: 10
[AT Integration] Recipe Systems Registered: 5
[AT Integration] No errors detected
[AT Integration] =========================
```

---

## Examples

### Example 1: Simple Processing Machine

```javascript
// simple_processor.js
import { Machine, Energy } from '../machinery/managers_extra.js';

const INPUT_SLOT = 3;
const OUTPUT_SLOT = 5;

DoriosAPI.register.blockComponent('simple_processor', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;
            
            machine.setEnergyCost(3000);
            machine.displayEnergy();
            machine.displayProgress();
        });
    },
    
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        
        const container = DoriosAPI.containers.getContainer(machine.entity);
        if (!container) return;
        
        const inputSlot = container.getSlot(INPUT_SLOT);
        const outputSlot = container.getSlot(OUTPUT_SLOT);
        
        // Check if we can process
        if (!inputSlot.hasItem() || outputSlot.hasItem()) return;
        
        const energy = new Energy(machine.entity);
        if (!energy.has(machine.energyCost)) return;
        
        // Find recipe
        const input = inputSlot.getItem();
        const recipe = findRecipe(input.typeId);
        if (!recipe) return;
        
        // Process
        if (!machine.isProcessing()) {
            machine.startProcessing(recipe.processTicks);
        }
        
        if (machine.process()) {
            // Complete
            energy.remove(machine.energyCost);
            inputSlot.setItem(undefined); // Remove input
            outputSlot.setItem(new ItemStack(recipe.output.id, recipe.output.amount));
        }
    }
});
```

### Example 2: Fluid Processing Machine

```javascript
// fluid_processor.js
import { Machine, Energy, FluidManager } from '../machinery/managers_extra.js';

const INPUT_SLOT = 3;
const FLUID_SLOT = 10;
const OUTPUT_SLOT = 5;

DoriosAPI.register.blockComponent('fluid_processor', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;
            
            machine.setEnergyCost(5000);
            machine.displayEnergy();
            
            const tank = FluidManager.initializeSingle(machine.entity);
            tank.display(11); // Display slot
        });
    },
    
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        
        const container = DoriosAPI.containers.getContainer(machine.entity);
        const tank = FluidManager.initializeSingle(machine.entity);
        
        if (!container) return;
        
        const inputSlot = container.getSlot(INPUT_SLOT);
        const outputSlot = container.getSlot(OUTPUT_SLOT);
        const fluid = tank.get();
        
        // Check requirements
        if (!inputSlot.hasItem() || outputSlot.hasItem()) return;
        if (fluid.type !== 'liquified_aetherium' || fluid.amount < 250) return;
        
        const energy = new Energy(machine.entity);
        if (!energy.has(machine.energyCost)) return;
        
        // Process
        if (!machine.isProcessing()) {
            machine.startProcessing(100); // 5 seconds
        }
        
        if (machine.process()) {
            // Complete
            energy.remove(machine.energyCost);
            tank.set(fluid.type, fluid.amount - 250); // Consume fluid
            inputSlot.setItem(undefined);
            outputSlot.setItem(new ItemStack('utilitycraft:processed_item', 1));
        }
    }
});
```

### Example 3: Registering Recipes for Existing Machines

```javascript
// my_addon_recipes.js
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add recipes to Liquifier
    const liquifierRecipes = {
        "my_addon:diamond_liquification": {
            input: { id: "minecraft:diamond", amount: 1 },
            fluid: { type: "liquified_aetherium", amount: 2000 },
            energyCost: 15000,
            seconds: 20
        }
    };
    
    system.sendScriptEvent(
        "utilitycraft:register_liquifier_recipe",
        JSON.stringify(liquifierRecipes)
    );
    
    // Add recipes to Infuser (UtilityCraft machine)
    const infuserRecipes = {
        "minecraft:gold_ingot|my_addon:crystal": {
            output: "my_addon:golden_crystal",
            required: 3
        }
    };
    
    system.sendScriptEvent(
        "utilitycraft:register_infuser_recipe",
        JSON.stringify(infuserRecipes)
    );
});
```

---

## Best Practices

### 1. Always Validate Integration

Check integration status during development:

```javascript
import { validateIntegration } from './config/utilitycraft_integration.js';

if (!validateIntegration()) {
    console.error("Integration check failed - see console for details");
}
```

### 2. Use Proper Namespacing

Always let DoriosAPI handle namespacing:

```javascript
// ✓ Correct - DoriosAPI adds namespace
DoriosAPI.register.blockComponent('my_machine', handlers);

// ✗ Wrong - Don't manually add namespace
DoriosAPI.register.blockComponent('utilitycraft:my_machine', handlers);
```

### 3. Track Recipe Registrations

Always track custom recipe systems:

```javascript
import { registerRecipeSystem } from '../utilitycraft_integration.js';

registerRecipeSystem('my_machine');
```

### 4. Handle Errors Gracefully

Wrap recipe registration in try-catch:

```javascript
try {
    system.sendScriptEvent(eventId, JSON.stringify(recipes));
} catch (err) {
    console.error(`Failed to register recipes: ${err}`);
}
```

### 5. Document Capabilities

Add your machine to `MACHINE_CAPABILITIES` for integration tracking and documentation.

---

## Troubleshooting

### "DoriosAPI not found"

**Cause:** UtilityCraft is not loaded or installed.  
**Solution:** Ensure UtilityCraft 3.3+ is installed and loaded before AT.

### "Recipe not registered"

**Cause:** Script event sent before listener is ready.  
**Solution:** Register recipes in `world.afterEvents.worldLoad` callback.

### "Energy not transferring"

**Cause:** Block not connected to energy network.  
**Solution:** Call `updatePipes(block, 'energy')` after placement.

### "Container not found"

**Cause:** Machine entity not spawned correctly.  
**Solution:** Ensure `Machine.spawnMachineEntity()` is called in `beforeOnPlayerPlace`.

---

## Support

For issues, questions, or contributions:

- **GitHub Issues:** [DoriosStudios/Ascendant-Technology](https://github.com/DoriosStudios/Ascendant-Technology/issues)
- **Documentation:** See `docs/INTEGRATION.md` for detailed integration spec
- **Discord:** Join Dorios Studios Discord (if available)

---

**Last Updated:** 2026-01-30  
**API Version:** 1.0.0  
**Maintainer:** Dorios Studios

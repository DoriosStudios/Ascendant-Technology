# Integration Quick Reference

Quick reference card for UtilityCraft integration patterns.

## Essential Imports

```javascript
// Integration API
import { 
    validateIntegration,
    registerMachine,
    registerRecipeSystem,
    sendRecipeEvent 
} from './config/utilitycraft_integration.js';

// Machine utilities
import { Machine, Energy, FluidManager, updatePipes } from '../machinery/managers_extra.js';

// Minecraft APIs
import { system, world } from "@minecraft/server";
```

## Machine Registration Pattern

```javascript
DoriosAPI.register.blockComponent('machine_id', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;
            
            machine.setEnergyCost(settings.machine.energy_cost ?? 2000);
            machine.displayEnergy();
            machine.displayProgress();
            
            // For fluid machines
            const tank = FluidManager.initializeSingle(machine.entity);
            tank.display(FLUID_DISPLAY_SLOT);
            
            // Connect networks
            updatePipes(e.block, 'energy');
            updatePipes(e.block, 'fluid');
        });
    },
    
    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;
        
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        
        // Processing logic...
    }
});
```

## Recipe Registration Pattern

```javascript
// 1. Define recipe structure
const recipes = [];

function defineRecipe(definition) {
    return {
        id: definition.id,
        input: normalizeItem(definition.input),
        output: normalizeItem(definition.output),
        energyCost: definition.energyCost ?? DEFAULT_COST,
        processTicks: (definition.seconds ?? 5) * 20
    };
}

// 2. Set up event listener
const EVENT_ID = "utilitycraft:register_machine_recipe";

registerRecipeSystem('machine_id');

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== EVENT_ID) return;
    
    try {
        const payload = JSON.parse(message);
        for (const [recipeId, def] of Object.entries(payload)) {
            const recipe = defineRecipe({ id: recipeId, ...def });
            recipes.push(recipe);
        }
    } catch (err) {
        console.warn("Recipe registration failed:", err);
    }
});

// 3. Export getter
export function getRecipes() {
    return recipes;
}
```

## External Recipe Registration

```javascript
// In external add-on
world.afterEvents.worldLoad.subscribe(() => {
    const customRecipes = {
        "addon:recipe_id": {
            input: { id: "minecraft:item", amount: 1 },
            output: { id: "utilitycraft:result", amount: 1 },
            energyCost: 5000,
            seconds: 10
        }
    };
    
    system.sendScriptEvent(
        "utilitycraft:register_machine_recipe",
        JSON.stringify(customRecipes)
    );
});
```

## Common Processing Pattern

```javascript
onTick(e, { params: settings }) {
    const { block } = e;
    const machine = new Machine(block, settings);
    if (!machine.valid) return;
    
    // Get container and slots
    const container = DoriosAPI.containers.getContainer(machine.entity);
    if (!container) return;
    
    const inputSlot = container.getSlot(INPUT_SLOT);
    const outputSlot = container.getSlot(OUTPUT_SLOT);
    
    // Check can process
    if (!inputSlot.hasItem() || outputSlot.hasItem()) return;
    
    // Check energy
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
        inputSlot.setItem(undefined);
        outputSlot.setItem(new ItemStack(recipe.output.id, recipe.output.amount));
    }
}
```

## Fluid Processing Pattern

```javascript
onTick(e, { params: settings }) {
    const { block } = e;
    const machine = new Machine(block, settings);
    if (!machine.valid) return;
    
    const tank = FluidManager.initializeSingle(machine.entity);
    const fluid = tank.get(); // { type: string, amount: number }
    
    // Check fluid
    if (fluid.type !== 'liquified_aetherium' || fluid.amount < 250) return;
    
    // ... processing logic ...
    
    // Consume fluid
    tank.set(fluid.type, fluid.amount - 250);
}
```

## Energy Management

```javascript
const energy = new Energy(machine.entity);

// Check if has enough
if (energy.has(5000)) {
    // Consume
    energy.remove(5000);
}

// Get current/max
const current = energy.get();
const max = energy.getMax();
const percentage = (current / max) * 100;
```

## Network Connection

```javascript
// In beforeOnPlayerPlace or when block updates
updatePipes(block, 'energy'); // Connect to energy network
updatePipes(block, 'fluid');  // Connect to fluid network
```

## Slot Management

```javascript
// Block specific slots from player access
machine.blockSlots([FLUID_DISPLAY_SLOT, 6, 7, 8]);

// Access slots
const container = DoriosAPI.containers.getContainer(machine.entity);
const slot = container.getSlot(3);

if (slot.hasItem()) {
    const item = slot.getItem();
    slot.setItem(undefined); // Clear slot
}
```

## Integration Validation

```javascript
import { validateIntegration, printIntegrationReport } from './config/utilitycraft_integration.js';

// Check integration
if (!validateIntegration()) {
    console.error("Integration failed!");
}

// Print detailed report
printIntegrationReport();
```

## Event IDs Reference

| Machine | Event ID |
|---------|----------|
| Liquifier | `utilitycraft:register_liquifier_recipe` |
| Energizer | `utilitycraft:register_energizer_recipe` |
| Catalyst Weaver | `utilitycraft:register_catalyst_weaver_recipe` |
| Cloner | `utilitycraft:register_cloner_recipe` |
| Residue Processor | `utilitycraft:register_residue_processor_recipe` |
| Infuser (UC) | `utilitycraft:register_infuser_recipe` |
| Crusher (UC) | `utilitycraft:register_crusher_recipe` |
| Furnace (UC) | `utilitycraft:register_furnace_recipe` |
| Sieve (UC) | `utilitycraft:register_sieve_recipe` |

## Common Slot Layouts

### Standard Machine (20 slots)
- Slot 0: Energy display
- Slots 1-2: Progress indicators
- Slot 3: Primary input
- Slots 4-5: Upgrade slots
- Slot 10: Fluid input/output
- Slot 11: Fluid display (blocked)
- Slot 19: Secondary output/residue

### Catalyst Weaver (27 slots)
- Slot 0: Energy display
- Slots 1-2: Progress
- Slot 3: Core input
- Slots 4-9: Catalyst slots (6)
- Slot 10: Output
- Slot 11: Fluid input
- Slot 12: Fluid display (blocked)
- Slot 19: Residue

## Capability Declaration Template

```javascript
// In utilitycraft_integration.js
export const MACHINE_CAPABILITIES = {
    machine_id: {
        id: "machine_id",
        displayName: "Machine Display Name",
        type: "processor", // processor | storage | utility | monitor | multi_function
        requiresEnergy: true,
        hasFluidInput: false,
        hasFluidOutput: false,
        upgradeSlots: ["speed_upgrade", "efficiency_upgrade"],
        recipeSystem: "script_event", // script_event | none
        recipeEventId: "utilitycraft:register_machine_recipe",
        integration: {
            energyNetwork: true,
            fluidNetwork: false,
            containerType: "custom", // custom | vanilla | none
            slots: 20,
            specialFeatures: ["feature1", "feature2"]
        }
    }
};
```

## Debugging Tips

```javascript
// Check if DoriosAPI loaded
if (typeof globalThis.DoriosAPI === "undefined") {
    console.error("DoriosAPI not loaded!");
}

// Check machine entity
const machine = new Machine(block, settings);
if (!machine.valid) {
    console.warn("Invalid machine!");
}

// Check container
const container = DoriosAPI.containers.getContainer(machine.entity);
if (!container) {
    console.warn("Container not found!");
}

// Log integration status
import { getIntegrationStatus } from './config/utilitycraft_integration.js';
console.log(JSON.stringify(getIntegrationStatus(), null, 2));
```

## Common Constants

```javascript
const TICKS_PER_SECOND = 20;
const DEFAULT_ENERGY_COST = 5000;
const DEFAULT_PROCESS_SECONDS = 5;
const DEFAULT_FLUID_AMOUNT = 250; // mB

// Fluid types
const FLUID_TYPES = {
    LIQUIFIED_AETHERIUM: 'liquified_aetherium',
    DARK_MATTER: 'dark_matter',
    CRYOFLUID: 'cryofluid',
    WATER: 'water'
};
```

---

See `docs/API_USAGE.md` for detailed examples and `docs/INTEGRATION.md` for the complete specification.

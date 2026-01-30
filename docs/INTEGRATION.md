# UtilityCraft Integration Specification

## Overview

Ascendant Technology (AT) is an official expansion add-on for UtilityCraft that adds end-game machinery and advanced technology content. This document outlines how AT systems integrate with UtilityCraft core mechanics.

## Architecture

### Dependency Structure

```
UtilityCraft (Core) v3.3+
    ↓ (provides DoriosAPI, base systems)
Ascendant Technology v0.7.1
    ↓ (extends via DoriosAPI)
User World
```

**Manifest Dependencies:**
- UtilityCraft Pack UUID: `1cd6f925-5e4f-45a6-93e5-f29241179512`
- Required Version: 1.0.16+
- AT Pack UUID: `8d4e0a7e-98d5-4bdb-bfcc-ff0c08f09799`

### Core Integration Layer: DoriosAPI

DoriosAPI (by Milo504/Dorios Studios) serves as the foundational bridge between AT and UtilityCraft:

**Location:** `BP/scripts/doriosAPI/`

**Key Modules:**
- `API.js` - Core registration system
- `blockClass.js` - Block utility extensions
- `entityClass.js` - Entity extensions
- `itemStackClass.js` - ItemStack helpers
- `playerClass.js` - Player utilities

**Namespace:** All components auto-prefix with `utilitycraft:` namespace

## Integration Points

### 1. Component Registration

**Block Components:**
```javascript
DoriosAPI.register.blockComponent('machine_id', {
    beforeOnPlayerPlace(e, { params: settings }) { /* ... */ },
    onTick(e, { params: settings }) { /* ... */ }
});
```

**Item Components:**
```javascript
DoriosAPI.register.itemComponent('item_id', {
    onUse(e) { /* ... */ },
    onBeforeUse(e) { /* ... */ }
});
```

All registrations automatically receive `utilitycraft:` prefix, ensuring namespace consistency.

### 2. Recipe System Integration

AT machines register recipes through **Script Events** that UtilityCraft core listens to:

| Machine | Event ID | Format |
|---------|----------|--------|
| Liquifier | `utilitycraft:register_liquifier_recipe` | JSON object |
| Energizer | `utilitycraft:register_energizer_recipe` | JSON object |
| Catalyst Weaver | `utilitycraft:register_catalyst_weaver_recipe` | JSON object |
| Cloner | `utilitycraft:register_cloner_recipe` | JSON object |
| Residue Processor | `utilitycraft:register_residue_processor_recipe` | JSON object |
| Infuser (UC) | `utilitycraft:register_infuser_recipe` | JSON object |
| Crusher (UC) | `utilitycraft:register_crusher_recipe` | JSON object |
| Furnace (UC) | `utilitycraft:register_furnace_recipe` | JSON object |

**Example Registration:**
```javascript
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const recipes = {
        "recipe_key": {
            output: "item_id",
            required: 4
        }
    };
    
    system.sendScriptEvent(
        "utilitycraft:register_infuser_recipe",
        JSON.stringify(recipes)
    );
});
```

### 3. Energy System Integration

AT machines use UtilityCraft's energy infrastructure:

**Energy Class:** `BP/scripts/machinery/managers_extra.js`

```javascript
const machine = new Machine(block, settings, true);
machine.setEnergyCost(2000); // Set energy cost
machine.displayEnergy(); // Display energy HUD
```

**Energy Network:**
- Tag: `dorios:energy`
- Property: `dorios:energy_nodes`
- Function: `updatePipes(block, 'energy')`

### 4. Fluid System Integration

AT machines support UtilityCraft's fluid infrastructure:

**FluidManager Class:** `BP/scripts/machinery/managers_extra.js`

```javascript
const tank = FluidManager.initializeSingle(entity);
tank.set(fluidType, amount);
tank.get(); // Returns { type, amount }
tank.display(slotIndex); // Visual display
```

**Fluid Network:**
- Tag: `dorios:fluid`
- Property: `dorios:fluid_nodes`
- Function: `updatePipes(block, 'fluid')`

**Custom Fluids:**
- Liquified Aetherium
- Cryofluid
- Water
- [Other UtilityCraft fluids]

### 5. Upgrade System Integration

Machines support UtilityCraft upgrade items:

**Settings Structure:**
```javascript
machine: {
    upgrades: [
        'utilitycraft:speed_upgrade',
        'utilitycraft:efficiency_upgrade',
        'utilitycraft:hyper_processing_upgrade'
    ]
}
```

**Upgrade Effects:**
- Speed: Reduces processing time
- Efficiency: Reduces energy consumption
- Hyper: Maximum speed multiplier

### 6. Overclock System (AT Extension)

AT introduces an advanced overclock network that extends UtilityCraft's base upgrade system:

**Components:**
- Overclock Tower - Generates overclock charge
- Overclock Relay - Distributes charge to network
- Reinforced Cable - Carries energy + overclock boost

**Key Distinction:** Overclock system does NOT conflict with UtilityCraft's base upgrade system; it's an additive late-game enhancement.

## Machine Registry

### AT Machines

| Machine | Type | Energy | Fluids | Purpose |
|---------|------|--------|--------|---------|
| **Liquifier** | Processor | Yes | Output | Solid → Liquid conversion |
| **Energizer** | Processor | Yes | No | Item energization |
| **Catalyst Weaver** | Processor | Yes | Input | Multi-catalyst fusion |
| **Cloner** | Processor | Yes | Yes | Item duplication |
| **Cryo Chamber** | Multi-function | Yes | I/O | Cooling + Cryofluid generation |
| **Residue Processor** | Processor | Yes | No | Waste recycling |
| **Singularity Fabricator** | Processor | Yes | No | Singularity crafting |
| **Network Center** | Monitor | Yes | No | Energy network dashboard |
| **Laser Barrier** | Utility | Yes | No | Defensive field |
| **Absolute Container** | Storage | No | No | Mass storage |

### Integration with UtilityCraft Machines

AT machines can consume recipes from UtilityCraft machines:
- **Infuser** - AT adds new infusion recipes
- **Crusher** - AT adds new crushing recipes
- **Furnace** - AT adds new smelting recipes
- **Sieve** - AT adds new sifting recipes

## Property System

AT uses a centralized property registry for maintainability:

**File:** `BP/scripts/config/property_registry.js`

**Categories:**
- Block States (e.g., `utilitycraft:isOn`)
- Dynamic Properties (e.g., entity cooldowns)
- Tags (e.g., `dorios:energy`, `dorios:fluid`)

## Container System

AT machines use UtilityCraft's unified container interface:

```javascript
DoriosAPI.containers.getContainer(entity); // Returns Container
```

**Container Types:**
- Vanilla containers
- Dorios custom containers
- Machine inventories

## Best Practices for Integration

### For AT Developers

1. **Always use DoriosAPI** - Never bypass the API layer
2. **Register via script events** - Use provided event system for recipes
3. **Follow naming conventions** - Use `utilitycraft:` prefix
4. **Respect energy/fluid APIs** - Use provided Manager classes
5. **Document custom additions** - Update this spec when adding new systems

### For UtilityCraft Developers

1. **Maintain backward compatibility** - AT depends on stable APIs
2. **Use script events for extensibility** - Allow addons to register content
3. **Document API changes** - Communicate breaking changes early
4. **Keep DoriosAPI stable** - Core API should remain consistent

### For Third-Party Addon Developers

1. **Study this spec** - Understand integration patterns
2. **Use same patterns** - Follow AT's integration approach
3. **Test with both packs** - Ensure compatibility
4. **Document your integration** - Help future developers

## Migration Notes

If UtilityCraft changes APIs, AT will need updates in these areas:

1. **Recipe registration** - Script event IDs or formats
2. **Energy/Fluid systems** - Manager class interfaces
3. **Component registration** - DoriosAPI.register methods
4. **Container system** - Inventory access patterns
5. **Property storage** - Dynamic property names/types

## Testing Integration

### Validation Checklist

- [ ] All AT machines spawn correctly
- [ ] Energy networks connect properly
- [ ] Fluid networks connect properly
- [ ] Recipes register without errors
- [ ] Upgrades work in AT machines
- [ ] No console errors on world load
- [ ] No breaking changes to AT behavior
- [ ] No modifications to UtilityCraft files

### Test Scenarios

1. **Machine Placement** - Place each AT machine, verify entity spawns
2. **Recipe Execution** - Run recipes in each machine type
3. **Energy Transfer** - Connect machines to UC energy network
4. **Fluid Transfer** - Connect machines to UC fluid network
5. **Upgrade Application** - Apply UC upgrades to AT machines
6. **Recipe Extension** - Add custom recipe via script event
7. **Cross-Pack Interaction** - Use UC items in AT machines and vice versa

## Troubleshooting

### Common Issues

**"Recipe not found"**
- Check script event listener is active
- Verify JSON format matches expected schema
- Ensure recipe registered after world load

**"Cannot find container"**
- Verify machine entity spawned correctly
- Check entity has `minecraft:inventory` component
- Use `DoriosAPI.containers.getContainer()`

**"Energy not transferring"**
- Verify block has `dorios:energy` tag
- Check `dorios:energy_nodes` property is set
- Call `updatePipes(block, 'energy')` on placement

**"Fluid not transferring"**
- Verify block has `dorios:fluid` tag
- Check `dorios:fluid_nodes` property is set
- Call `updatePipes(block, 'fluid')` on placement

## Version History

| AT Version | UC Version | Changes |
|------------|------------|---------|
| 0.7.1 | 3.3+ | Current integration spec |

## Contributing

When extending integration:

1. Update this document
2. Add tests for new integration points
3. Ensure backward compatibility
4. Submit PR with clear documentation

## License & Credits

- **DoriosAPI:** Created by Milo504 / Dorios Studios
- **UtilityCraft:** Dorios Studios
- **Ascendant Technology:** Dorios Studios

All rights reserved. See individual licenses for details.

---

**Last Updated:** 2026-01-30  
**Document Version:** 1.0.0  
**Maintainer:** Dorios Studios

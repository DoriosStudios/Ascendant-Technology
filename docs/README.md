# Ascendant Technology Documentation

Complete documentation for Ascendant Technology, an official expansion add-on for UtilityCraft.

## 📚 Documentation Index

### Integration & Development

- **[INTEGRATION.md](./INTEGRATION.md)** - Complete integration specification
  - Architecture overview
  - Integration points (components, recipes, energy, fluids)
  - Machine registry
  - Property system
  - Best practices
  - Testing & troubleshooting

- **[API_USAGE.md](./API_USAGE.md)** - Comprehensive API usage guide
  - Getting started
  - Machine registration
  - Recipe systems
  - Energy & fluid integration
  - Container management
  - Complete examples

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card
  - Essential patterns
  - Common code snippets
  - Event IDs
  - Slot layouts
  - Debugging tips

### Machines

Detailed documentation for each machine:

#### Storage & Management
- [absolute-container.md](./machines/absolute-container.md) - Massive storage solution
- [network-center.md](./machines/network-center.md) - Energy network monitoring

#### Processors
- [liquifier.md](./machines/liquifier.md) - Solid to liquid conversion
- [energizer.md](./machines/energizer.md) - Item energization
- [catalyst-weaver.md](./machines/catalyst-weaver.md) - Multi-catalyst fusion
- [cloner.md](./machines/cloner.md) - Item duplication
- [cryo-chamber.md](./machines/cryo-chamber.md) - Cooling and cryofluid generation
- [residue-processor.md](./machines/residue-processor.md) - Waste recycling
- [singularity-fabricator.md](./machines/singularity-fabricator.md) - Singularity items

#### Utilities
- [laser-barrier.md](./machines/laser-barrier.md) - Defensive energy field

#### Overclock Network
- [overclock-network.md](./machines/overclock-network.md) - System overview
- [overclock-tower.md](./machines/overclock-tower.md) - Boost generation
- [overclock-relay.md](./machines/overclock-relay.md) - Boost distribution
- [reinforced-cable.md](./machines/reinforced-cable.md) - High-capacity cable
- [reinforced-extractor.md](./machines/reinforced-extractor.md) - Network extractor

### Recipes

Recipe documentation for each machine:

- [liquifier.md](./recipes/liquifier.md)
- [energizer.md](./recipes/energizer.md)
- [catalyst-weaver.md](./recipes/catalyst-weaver.md)
- [cloner.md](./recipes/cloner.md)
- [cryo-chamber.md](./recipes/cryo-chamber.md)
- [residue-processor.md](./recipes/residue-processor.md)
- [singularity-fabricator.md](./recipes/singularity-fabricator.md)

## 🚀 Quick Start

### For Players

1. **Install UtilityCraft 3.3+** (required dependency)
2. **Install Ascendant Technology**
3. **Start playing** - All machines and items are available in-game

### For Developers

#### Adding Recipes to Existing Machines

```javascript
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const recipes = {
        "my_addon:recipe_id": {
            input: { id: "minecraft:diamond", amount: 1 },
            output: { id: "utilitycraft:compressed_diamond", amount: 1 },
            energyCost: 10000,
            seconds: 15
        }
    };
    
    system.sendScriptEvent(
        "utilitycraft:register_liquifier_recipe",
        JSON.stringify(recipes)
    );
});
```

#### Creating Custom Machines

See [API_USAGE.md](./API_USAGE.md) for complete examples.

```javascript
import { Machine, Energy } from '../machinery/managers_extra.js';

DoriosAPI.register.blockComponent('my_machine', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(5000);
            machine.displayEnergy();
        });
    },
    
    onTick(e, { params: settings }) {
        // Processing logic...
    }
});
```

## 📖 Key Concepts

### DoriosAPI

The foundational API that bridges AT and UtilityCraft:
- Automatic namespace prefixing (`utilitycraft:`)
- Component registration helpers
- Unified container interface
- Extended Minecraft classes (Block, Entity, Player, ItemStack)

### Script Events

Recipe registration mechanism allowing external add-ons to inject content:
- `utilitycraft:register_liquifier_recipe`
- `utilitycraft:register_energizer_recipe`
- `utilitycraft:register_cloner_recipe`
- And more...

### Energy & Fluid Networks

Tag-based network system for resource distribution:
- **Energy:** `dorios:energy` tag, `dorios:energy_nodes` property
- **Fluid:** `dorios:fluid` tag, `dorios:fluid_nodes` property

### Machine Classes

Standardized machine architecture:
- `Machine` - Core machine logic
- `Energy` - Energy management
- `FluidManager` - Fluid handling
- `updatePipes()` - Network connection

## 🔧 Integration Summary

```
┌─────────────────────────────────────────┐
│         UtilityCraft Core 3.3+          │
│     (Provides DoriosAPI & Systems)      │
└────────────────┬────────────────────────┘
                 │
                 │ Integration via:
                 │ • DoriosAPI
                 │ • Script Events
                 │ • Tag System
                 │ • Property System
                 │
┌────────────────▼────────────────────────┐
│       Ascendant Technology 0.7.1        │
│   (Extends via Integration Registry)    │
└─────────────────────────────────────────┘
                 │
                 │ Validation:
                 │ • utilitycraft_integration.js
                 │ • registration_bridge.js
                 │
┌────────────────▼────────────────────────┐
│              User World                 │
│      (Clean, Tested Integration)        │
└─────────────────────────────────────────┘
```

## 📝 Contributing

When extending AT or creating compatible add-ons:

1. **Read the integration spec** ([INTEGRATION.md](./INTEGRATION.md))
2. **Follow existing patterns** ([API_USAGE.md](./API_USAGE.md))
3. **Use the integration registry** (track capabilities)
4. **Test thoroughly** (validation checklist in INTEGRATION.md)
5. **Document your changes** (update relevant docs)

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "DoriosAPI not found" | Ensure UtilityCraft 3.3+ is installed |
| Recipe not registering | Use `world.afterEvents.worldLoad` |
| Energy not transferring | Call `updatePipes(block, 'energy')` |
| Container not found | Check machine entity spawned correctly |

See [INTEGRATION.md](./INTEGRATION.md) for detailed troubleshooting.

## 📦 Package Structure

```
Ascendant-Technology/
├── BP/
│   ├── scripts/
│   │   ├── doriosAPI/           # Core API layer
│   │   ├── config/
│   │   │   ├── utilitycraft_integration.js  # Integration registry
│   │   │   └── recipes/         # Recipe definitions
│   │   ├── machinery/
│   │   │   ├── registration_bridge.js       # Registration tracking
│   │   │   ├── managers_extra.js           # Machine utilities
│   │   │   ├── machines/        # Machine implementations
│   │   │   └── overclock/       # Overclock system
│   │   └── main.js              # Entry point
│   └── manifest.json            # Pack manifest
└── docs/
    ├── INTEGRATION.md           # Integration spec
    ├── API_USAGE.md             # Usage guide
    ├── QUICK_REFERENCE.md       # Quick ref
    ├── machines/                # Machine docs
    └── recipes/                 # Recipe docs
```

## 🔗 Links

- **GitHub:** [DoriosStudios/Ascendant-Technology](https://github.com/DoriosStudios/Ascendant-Technology)
- **UtilityCraft:** [DoriosStudios/UtilityCraft](https://github.com/DoriosStudios/UtilityCraft)
- **Download:** [Releases](https://github.com/DoriosStudios/Ascendant-Technology/releases)
- **Bug Reports:** [Known Bugs](../bugs.md)

## 📄 License

All rights reserved. Created by Dorios Studios.

- **DoriosAPI:** Created by Milo504 / Dorios Studios
- **UtilityCraft:** Dorios Studios
- **Ascendant Technology:** Dorios Studios

---

**Last Updated:** 2026-01-30  
**AT Version:** 0.7.1 Beta  
**Required UC Version:** 3.3+

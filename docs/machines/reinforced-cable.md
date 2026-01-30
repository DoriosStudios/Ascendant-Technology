# Reinforced Cable

## Overview
The **Reinforced Cable** is the high-capacity infrastructure backbone of Ascendant Technology, supporting energy transfer, fluid transfer, and overclock signal propagation through a unified network.

## Purpose
Reinforced Cable serves as the primary multi-purpose conduit for late-game factories, combining energy distribution, fluid transport, and overclock network capabilities into a single block type.

## Crafting
*Recipe to be added*

## Features

### Triple Functionality
Reinforced Cable provides three simultaneous capabilities:

#### 1. Energy Transfer
- High-capacity energy conduit
- Compatible with all energy-tagged blocks (`dorios:energy`)
- Seamless integration with energy cables and machines
- No energy loss during transfer
- Scans up to **2,048 nodes** for energy networks

#### 2. Fluid Transfer
- Fluid transport through the same cable
- Works with fluid-tagged blocks (`dorios:fluid`)
- Compatible with Reinforced Extractor for fluid routing
- No fluid loss or degradation
- Independent from energy functionality

#### 3. Overclock Network
- Propagates overclock signals from tower to relays
- Required for overclock boost distribution
- Tagged with `dorios:overclock_network`
- Maintains network topology for relay scanning
- Visual connections update dynamically

## How It Works

### Connection System
Reinforced Cable uses intelligent connection logic:

#### Visual Connections
The cable connects to adjacent blocks in all 6 directions:
- **Reinforced Cable**: Always connects (creates network backbone)
- **Overclock Relay**: Always connects (overclock network node)
- **Overclock Tower**: Does NOT visually connect (by design)
- **Machines** (`dorios:machine`): Connects for machine adjacency
- **Energy Blocks** (`dorios:energy`): Connects for energy transfer
- **Fluid Blocks** (`dorios:fluid`): Connects for fluid routing

#### Dynamic Updates
- Connections update automatically when placing/breaking adjacent blocks
- Network topology recalculates on changes
- Energy sources rescan their target networks
- Overclock relays refresh their machine lists

### Energy Network Scanning

#### Source Collection
When an energy source connects to the network:
1. Scans from its position through connected cables
2. Identifies all energy containers within 2,048 nodes
3. Excludes other energy sources (prevents feedback)
4. Tags itself with network target locations
5. Updates on any network topology change

#### Target Distribution
Energy sources distribute to tagged targets:
- Prioritizes by distance (nearest first)
- Respects capacity limits
- Balances across multiple targets
- Updates every machine tick

### Overclock Network Scanning

#### Relay Scanning
Overclock Relays use the cable network to:
1. Scan for overclock sources (tower or other relays)
2. Find strongest available signal within 96 nodes
3. Collect machines adjacent to network
4. Apply boost to eligible machines
5. Refresh every tick cycle

#### Tower Distribution
Overclock Towers use the network to:
1. Find connected relays within 96 nodes
2. Share excess energy with relays (20,000 DE/tick each)
3. Propagate overclock level and effectiveness
4. Maintain consistent boost across network

### Fluid Network Operation
Reinforced Cable supports fluid transfer when used with:
- **Reinforced Extractor**: Pulls fluid from sources and distributes through network
- **Fluid Machines**: Connect directly to cable for input/output
- **Network Routing**: Fluid follows cable paths to valid targets

## Block States

### Connection States
The cable has 6 directional connection states:
- `utilitycraft:up`: true/false
- `utilitycraft:down`: true/false  
- `utilitycraft:north`: true/false
- `utilitycraft:south`: true/false
- `utilitycraft:east`: true/false
- `utilitycraft:west`: true/false

These control visual rendering to show connected sides.

### State Management
- States update automatically on placement
- Refresh when adjacent blocks change
- Independent per cable block
- Purely visual (doesn't affect functionality)

## Placement Guidelines

### Network Design

#### Energy Networks
```
Generator ─ Cable ─ Cable ─ Machine
              │               │
            Cable           Cable
              │               │
          Machine         Machine
```

#### Overclock Networks
```
    Tower ─ Cable ─ Cable ─ Relay
              │               │
            Cable           Cable
              │               │
          Machine         Machine
```

#### Combined Networks
```
Generator ─ Cable ─ Tower ─ Cable ─ Relay
              │                       │
            Cable                   Cable
              │                       │
          Machine                 Machine
```
All machines receive energy AND overclock through shared cable backbone.

### Best Practices

1. **Central Hub**: Use cable hubs for star topology networks
2. **Short Paths**: Minimize cable distance for easier troubleshooting
3. **Organized Layout**: Keep cable paths clean and logical
4. **Avoid Loops**: While supported, loops can complicate debugging
5. **Label Sections**: Use different builds to mark energy vs. overclock zones

## Technical Details

### Network Limits
- **Energy Scan**: 2,048 nodes maximum
- **Overclock Scan**: 96 nodes maximum (relay-dependent)
- **Node Count**: Each cable/relay/extractor counts as 1 node
- **Update Rate**: Immediate on placement/breaking

### Performance Optimization
The cable system is optimized for large networks:
- Breadth-first search (BFS) for network scanning
- Visited set prevents duplicate processing
- Early termination on node limits
- Deferred updates via system.run() scheduling

### Tags
Reinforced Cable has multiple tags:
- `dorios:energy`: Enables energy network participation
- `dorios:fluid`: Enables fluid network participation
- `dorios:overclock_network`: Enables overclock signal propagation
- Custom tags for network identification

## Maintenance and Updates

### Automatic Network Refresh
The cable system automatically refreshes when:
- Cable is placed or broken
- Adjacent blocks change
- Machines connect or disconnect
- Energy sources update
- Overclock components change

### Manual Refresh
Generally not needed, but if network issues occur:
1. Break and replace a cable segment
2. Toggle a relay or tower off/on
3. Restart connected machines
4. Check for isolated segments

## Comparison with Standard Cables

| Feature | Standard Cable | Reinforced Cable |
|---------|---------------|------------------|
| Energy Transfer | ✓ | ✓ |
| Fluid Transfer | ✗ | ✓ |
| Overclock Network | ✗ | ✓ |
| Network Scan | ~512 nodes | 2,048 nodes |
| Crafting Cost | Lower | Higher |
| Visual Quality | Basic | Enhanced |
| Late-Game | Optional | Essential |

## Troubleshooting

### Network Not Connecting
- **Check Adjacency**: Cables must be directly adjacent (no gaps)
- **Verify Tags**: Target blocks must have appropriate tags
- **Node Limit**: Large networks may exceed scan limits
- **Break Points**: Isolated segments won't connect

### Energy Not Flowing
- **Source Active**: Verify generator/battery is ON and has energy
- **Target Space**: Machines must have free energy capacity
- **Network Path**: Ensure continuous cable path exists
- **Tag Check**: Blocks need `dorios:energy` tag

### Overclock Not Propagating
- **Tower Active**: Tower must be ON with fuel and energy
- **Relay Placement**: Relays must be within 96 nodes of tower
- **Cable Path**: Overclock requires continuous cable connection
- **Machine Adjacency**: Machines must be adjacent to network

### Visual Connection Issues
- **State Mismatch**: Break and replace cable to refresh
- **Chunk Loading**: May need to reload area
- **Update Lag**: Wait a tick for connection rendering
- **Overlapping**: Multiple cables at same location cause issues

## Advanced Techniques

### Multi-Network Separation
Create isolated networks using non-connecting blocks:
```
Network A ─ Cable ─ Machine ─ [Air Gap] ─ Machine ─ Cable ─ Network B
```
Useful for:
- Independent power grids
- Isolated overclock zones  
- Testing and debugging
- Security/safety zones

### Hub and Spoke Design
Central hub with radial spokes:
```
        Cable
          │
Cable ─ Cable ─ Cable
          │
        Cable
```
Benefits:
- Easy expansion
- Clear organization
- Centralized control
- Efficient routing

### Layered Networks
Vertical stacking for compact builds:
```
Floor 3: Machines
Floor 2: Cable ─ Cable ─ Cable
Floor 1: Generators
```
Saves horizontal space, useful for dense factories.

## Integration
Works seamlessly with:
- **Overclock Tower**: Network source for overclock signals
- **Overclock Relay**: Distribution nodes for machine boosts
- **Reinforced Extractor**: Fluid extraction and routing
- **All Machines**: Energy, fluid, and overclock delivery
- **Energy Cables**: Compatible for hybrid networks
- **Fluid Systems**: Complete fluid network support

## See Also
- [Overclock Tower](./overclock-tower.md)
- [Overclock Relay](./overclock-relay.md)
- [Reinforced Extractor](./reinforced-extractor.md)
- [Overclock Network Overview](./overclock-network.md)

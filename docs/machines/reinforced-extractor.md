# Reinforced Extractor

## Overview
The **Reinforced Extractor** is a directional fluid extraction device that pulls liquids from a source block and distributes them through the Reinforced Cable network to connected machines.

## Purpose
The Reinforced Extractor automates fluid logistics by actively extracting from various sources (tanks, vanilla fluids, special blocks) and routing them to machines that need fluids, eliminating manual capsule transfers.

## Crafting
*Recipe to be added*

## How It Works

### Basic Operation
The extractor operates in a simple pull-push cycle:
1. **Extract**: Pulls fluid from the block directly in front (facing direction)
2. **Scan**: Searches the cable network for fluid-capable target machines
3. **Distribute**: Transfers extracted fluid to targets across the network
4. **Repeat**: Continues every tick while source has fluid and targets have space

### Directional Extraction
The extractor has a **facing direction** (set on placement):
- Arrow or visual indicator shows extraction direction
- Only extracts from the block directly in front
- Will NOT extract from blocks on other sides
- Place carefully to face your fluid source

## Supported Fluid Sources

### Entity-Based Fluid Containers
Any machine or entity with a fluid tank:
- AT Machines (Cryo Chamber, Liquifier, etc.)
- Fluid Tanks
- Custom fluid containers with `FluidManager` support

**Priority**: Prefers non-water fluids from the fullest tank

### Vanilla Fluid Blocks
Standard Minecraft fluid blocks:
- **Water**: Full source blocks only (`liquid_depth == 0`)
- **Lava**: Full source blocks only (`liquid_depth == 0`)

**Extraction**: 1,000 mB per full block
**Consumption**: Source block turns to air after extraction

### Special Blocks

#### Crucible (UtilityCraft)
- Extracts lava from UtilityCraft crucibles
- Amount: 250 mB per lava level
- State: Reads `utilitycraft:lava` block state
- Consumption: Lava level resets to 0 after extraction

#### Sink (UtilityCraft)
- Infinite water source
- Amount: Unlimited (infinite)
- Consumption: Never depletes
- Perfect for automation

## Fluid Distribution

### Network Scanning
The extractor scans the cable network to find fluid targets:
- Follows Reinforced Cable paths
- Maximum scan range: **256 nodes**
- Identifies blocks with `dorios:fluid` tag
- Excludes the source block (prevents loops)
- Blocks extractors from pulling from other extractor outputs

### Target Selection
Distributes fluid based on transfer mode:

#### Modes
- **Nearest** (default): Prioritizes closest targets first
- **Farthest**: Prioritizes distant targets first
- **Round Robin**: Cycles through all targets evenly (not yet implemented)

Mode is stored in `transferMode` dynamic property (future expansion).

### Transfer Rate
- Maximum: **4,000 mB/tick** (configurable via settings)
- Splits across multiple targets as needed
- Respects individual target capacity limits
- Fills nearest targets before moving to next

## Target Compatibility

### Valid Targets
Machines must meet these criteria:
- Tagged with `dorios:fluid`
- Have at least one fluid tank with capacity > 0
- Tank is empty OR contains the same fluid type
- Has available space (not full)

### Excluded Targets
The extractor will NOT send fluid to:
- The source block it's extracting from
- Blocks in front of other Reinforced Extractors (prevents conflicts)
- Machines tagged with `dorios:fluid_input_only` (output-only blocks)
- Tanks with incompatible fluid types

## Placement Guide

### Basic Setup
```
[Source] → [Extractor] → [Cable] → [Target Machine]
```

### Multi-Target Setup
```
                [Target 1]
                    ↑
[Source] → [Extractor] → [Cable] ─ [Cable] → [Target 2]
                    ↓
                [Target 3]
```

### Multiple Extractors
```
[Source 1] → [Extractor 1] ┐
                           ├ [Cable] → [Machine]
[Source 2] → [Extractor 2] ┘
```

### Best Practices
1. **Face Source**: Extractor arrow must point at fluid source
2. **Cable Connection**: Extractor back/sides connect to cable network
3. **Avoid Chains**: Don't extract from another extractor's output
4. **Organize Sources**: Group fluid sources for easier management
5. **Monitor Capacity**: Ensure target machines can handle the flow rate

## Technical Details

### Properties
- **Fluid Rate**: 4,000 mB/tick (default, configurable)
- **Scan Range**: 256 nodes maximum
- **Transfer Mode**: "nearest" (default)
- **Tick Rate**: Operates every tick
- **Energy**: Does NOT require energy (passive device)

### Block States
- `utilitycraft:axis`: Facing direction (north/south/east/west/up/down)
- Connection states inherited from Reinforced Cable system

### Facing Directions
Set automatically on placement:
- Follows player's looking direction
- Can face any of 6 directions (including up/down)
- Indicated by visual arrow or model orientation
- Cannot be rotated after placement (break and replace)

### Internal Logic

#### Source Selection Priority
When extracting from entities with multiple tanks:
1. Tanks with fluid (not empty)
2. Non-water fluids (if available)
3. Fullest tank (highest mB count)

#### Distribution Algorithm
1. Collect all valid network targets
2. Sort by distance (nearest first by default)
3. Calculate available fluid to transfer (min of source amount and rate)
4. For each target (in order):
   - Check fluid type compatibility
   - Calculate available space
   - Transfer minimum of (remaining fluid, target space)
   - Reduce remaining fluid
   - Stop when no fluid remains

#### Finite Source Handling
For non-infinite sources (vanilla blocks, crucible):
- Tracks total amount transferred
- Deducts from source after successful transfer
- Vanilla water/lava: Replaces with air
- Crucible: Sets lava level to 0

## Fluid Types

### Supported Fluids
The extractor works with any fluid type registered in the fluid system:
- **Water**: Minecraft water blocks, sinks
- **Lava**: Minecraft lava blocks, crucibles
- **Cryofluid**: AT cryofluid system
- **Custom Fluids**: Any fluid registered with Dorios API

### Fluid Compatibility
- Targets must accept the specific fluid type
- Empty tanks accept any fluid type
- Mixed fluid types in source use priority rules
- Water has lower priority than other fluids

## Performance Considerations

### Network Size
- Larger networks (more cables) take longer to scan
- 256-node limit prevents excessive lag
- Multiple extractors can operate simultaneously
- Each extractor scans independently

### Transfer Efficiency
- 4,000 mB/tick is enough for most setups
- Multiple extractors for high-throughput systems
- Nearest-first distribution minimizes scan overhead
- Empty or incompatible targets are skipped quickly

### Source Types
- Entity tanks: Most efficient (direct FluidManager transfer)
- Vanilla fluids: Requires block replacement (slower)
- Infinite sources: Best for long-term automation
- Crucibles: Medium efficiency with state updates

## Troubleshooting

### Extractor Not Working
- **Check Facing**: Verify extractor faces the fluid source
- **Source Empty**: Ensure source block has fluid
- **Network Path**: Confirm Reinforced Cable connects extractor to targets
- **Target Space**: Verify targets have available capacity

### Fluid Not Transferring
- **Type Mismatch**: Target may contain different fluid type
- **Capacity Full**: All targets may be at maximum capacity
- **Blocked Output**: Check if output block is in front of another extractor
- **Scan Range**: Targets may be beyond 256 nodes

### Partial Transfer
- **Rate Limit**: 4,000 mB/tick maximum
- **Multiple Targets**: Rate splits across all targets
- **Source Capacity**: Source may have less than transfer rate
- **Target Limits**: Individual targets have capacity constraints

### Source Depleting Too Fast
- **Multiple Extractors**: Check if multiple extractors target same source
- **High Demand**: Many targets consuming fluid quickly
- **Rate Setting**: Review transfer rate configuration
- **Infinite Source**: Use sinks for unlimited water

## Advanced Usage

### Load Balancing
Distribute fluid across multiple machine lines:
```
              ┌ [Cable] → [Machine Line A]
[Extractor] ─ ┤
              └ [Cable] → [Machine Line B]
```

### Fluid Mixing Prevention
Keep different fluid types on separate networks:
```
[Water Source] → [Ext 1] → [Cable A] → [Water Machines]

[Lava Source]  → [Ext 2] → [Cable B] → [Lava Machines]
```

### Backup Sources
Multiple sources for redundancy:
```
[Primary]   → [Ext 1] ┐
                      ├ [Cable] → [Machines]
[Backup]    → [Ext 2] ┘
```

### Throughput Scaling
For high-demand systems:
```
[Big Source] → [Ext 1] ┐
[Big Source] → [Ext 2] ├ [Cable Hub] → [Many Machines]
[Big Source] → [Ext 3] ┘
```
Each extractor adds 4,000 mB/tick capacity.

## Integration
Works seamlessly with:
- **Reinforced Cable**: Network backbone for fluid routing
- **Fluid Machines**: All AT machines with fluid inputs
- **UtilityCraft Blocks**: Crucibles, sinks, tanks
- **Vanilla Fluids**: Water and lava source blocks
- **Custom Systems**: Any fluid system using Dorios API

## See Also
- [Reinforced Cable](./reinforced-cable.md)
- [Cryo Chamber](./cryo-chamber.md) (fluid user example)
- [Liquifier](./liquifier.md) (fluid user example)
- [Overclock Network Overview](./overclock-network.md)

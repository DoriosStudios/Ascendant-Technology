# Overclock Relay

## Overview
The **Overclock Relay** is a network distribution node that receives overclock charge from an Overclock Tower and applies it to connected machines. It acts as a bridge between the tower's power and your factory equipment.

## Purpose
The relay serves as the distribution layer of the Overclock Boost Network, scanning for nearby machines and applying performance boosts while also distributing energy throughout the network.

## Crafting
*Recipe to be added*

## How It Works

### Overclock Distribution
The relay performs three key functions:

#### 1. Source Scanning
- Scans up to **96 network nodes** to find the strongest overclock source
- Connects through **Reinforced Cable** or other overclock network blocks
- Prefers direct tower connections over relayed signals
- Automatically updates when network topology changes

#### 2. Machine Boosting
- Scans network to find all connected machines
- Applies overclock boost to adjacent machines
- Targets machines with `dorios:machine` tag
- **Excludes generators** (blocks with `dorios:energy_source` tag)
- Refreshes every tick to maintain boost levels

#### 3. Energy Distribution
- Distributes up to **20,000 DE/tick** to connected machines
- Receives energy from the Overclock Tower (20,000 DE/tick max)
- Prioritizes machines by distance (nearest first)
- Only transfers to machines with available capacity
- Automatically balances load across network

### Overclock Propagation
The relay receives overclock data from the tower:
- **Level**: Total power level from all active fuels
- **Effectiveness**: Highest effectiveness multiplier from active fuels

These values are passed to connected machines, which apply them to:
- Energy capacity
- Processing speed  
- Liquid transfer/consumption rates

## Network Scanning

### Connection Rules
The relay connects to blocks through:
- **Reinforced Cable** (primary network backbone)
- Blocks tagged with `dorios:overclock_network`
- Adjacent machine blocks

### Machine Detection
The relay boosts machines that:
- Are adjacent to any network cable/block
- Have the `dorios:machine` tag
- Do NOT have the `dorios:energy_source` tag (generators excluded)
- Are within the 96-node scan radius

### Range Calculation
Network range is determined by connected cable paths:
- Each cable/network block counts as 1 node
- Maximum 96 nodes scanned per relay
- Multiple relays can overlap ranges for redundancy

## Placement Strategy

### Optimal Positioning
For best results:
1. **Central Location**: Place relays in the center of machine clusters
2. **Cable Backbone**: Connect relays via Reinforced Cable to the tower
3. **Machine Adjacency**: Ensure machines are adjacent to cable or network blocks
4. **Multiple Relays**: Use several relays for large factories
5. **Redundancy**: Overlapping relay ranges provide backup coverage

### Connection Examples

**Single Relay Setup:**
```
Tower ─ Cable ─ Cable ─ Relay
                          │
                      Machines
```

**Multi-Relay Network:**
```
        Tower
          │
      Cable Hub
      ╱   │   ╲
  Relay Relay Relay
    │     │     │
  Mach  Mach  Mach
```

**Compact Setup:**
```
Tower ─ Relay (adjacent machines get boosted)
```

## UI Elements

### Energy Display
- Shows current energy stored in relay
- Displays energy capacity (inherited from block settings)
- Updates in real-time as energy flows

### Overclock Display  
- Shows current overclock level received from tower
- Displays effectiveness multiplier
- Animated bar indicates active overclock state
- Goes dark when no overclock source is found

### Status Indicators
- **Active (ON)**: Receiving overclock charge, boosting machines
- **Inactive (OFF)**: No overclock source found or level is 0

## Technical Details

### Properties
- **Energy Capacity**: Configurable (typically same as tower)
- **Energy Input Rate**: 20,000 DE/tick from tower
- **Energy Output Rate**: 20,000 DE/tick to machines
- **Scan Radius**: 96 network nodes
- **Refresh Rate**: Every 2 ticks (default tick interval)
- **Upgrade Slots**: None

### Block States
- `utilitycraft:on`: true/false (active/inactive)
- Connection states for cable geometry (handled by Reinforced Cable)

### Dynamic Properties
- `dorios:overclock_level`: Current overclock level (inherited from source)
- `dorios:overclock_eff`: Effectiveness multiplier (inherited from source)
- `dorios:overclock_ttl`: Time-to-live counter (refreshes every 6 ticks)

### Visual Indicators
- **Light Emission**: When active (based on block state)
- **Texture Changes**: Visual distinction between on/off states
- **Cable Connections**: Dynamic connection rendering with adjacent cables

## Machine Boost Mechanics

### How Boosts Apply
When a relay boosts a machine:
1. Sets the machine's `overclock_level` property to `level × effectiveness`
2. Sets the machine's `overclock_eff` property to `effectiveness`
3. Sets a time-to-live (TTL) counter to 6 ticks
4. Machine applies boost to its internal calculations
5. Boost decays if relay stops refreshing the TTL

### Boost Stacking
- Machines receive boost from **strongest available source** only
- Multiple relays = redundancy, NOT additive stacking  
- Relay with higher level × effectiveness wins
- Direct tower connections preferred over relay chains

### Excluded Machines
Generators and energy sources are excluded because:
- Prevents infinite energy loops
- Maintains power generation as a bottleneck
- Forces players to scale energy infrastructure
- Preserves game balance

## Performance Considerations

### Network Size
- Each relay scans up to 96 nodes
- Larger networks may need multiple relays
- Use cable efficiently to maximize coverage
- Monitor scan limits in mega-factories

### Energy Flow
- Energy distribution is independent of overclock level
- Relays act as energy buffers and distributors
- Helps balance power across distant machines
- Reduces strain on tower's direct connections

### Update Rate
- Relays tick every 2 ticks (default)
- Machines receive fresh boost every cycle
- TTL prevents stale boosts if relay fails
- Network topology updates are deferred to next tick

## Troubleshooting

### Relay Not Activating
- **Check Connection**: Ensure Reinforced Cable connects relay to tower
- **Verify Tower**: Tower must be ON with fuel and energy
- **Scan Range**: Relay may be beyond 96 nodes from tower
- **Network Breaks**: Gaps in cable prevent overclock propagation

### Machines Not Boosted
- **Adjacency**: Machines must be adjacent to network cables/blocks
- **Machine Tags**: Only `dorios:machine` blocks are eligible
- **Generator Check**: Generators are excluded by design
- **Relay Status**: Verify relay is ON and displaying overclock level

### Energy Not Distributing
- **Relay Capacity**: Relay must have energy stored to distribute
- **Machine Capacity**: Target machines must have free energy space
- **Network Topology**: Energy follows cable paths (same as overclock)
- **Transfer Limit**: Max 20,000 DE/tick per relay

## Advanced Usage

### Multi-Tower Networks
You can have multiple towers:
- Each tower operates independently  
- Relays connect to strongest source automatically
- Use for redundancy or isolated production lines
- Different fuel mixes for different factory sections

### Load Balancing
Distribute relays to balance:
- Machine boost coverage
- Energy distribution points
- Network scan overhead
- Physical factory layout

### Hybrid Networks
Combine with standard cables:
- Reinforced Cable carries energy + overclock
- Standard energy cables work for energy only
- Separate networks for isolated systems
- Mix for cost vs. performance tradeoffs

## Integration
Works seamlessly with:
- **Overclock Tower**: Receives overclock charge and energy
- **Reinforced Cable**: Network backbone for connection
- **All AT Machines**: Boosts any compatible machine
- **Energy Systems**: Integrated energy distribution

## See Also
- [Overclock Tower](./overclock-tower.md)
- [Reinforced Cable](./reinforced-cable.md)
- [Overclock Network Overview](./overclock-network.md)

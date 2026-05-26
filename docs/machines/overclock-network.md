# Overclock Boost Network - System Overview

## Introduction
The **Overclock Boost Network** is Ascendant Technology's unique late-game performance enhancement system. Unlike simple upgrade items, this system creates a factory-wide infrastructure that boosts multiple machines simultaneously through a dedicated network.

## What Makes It Unique

### Network-Based Boosting
Instead of upgrading individual machines with items, the Overclock Network:
- **Broadcasts boost signals** through cable infrastructure
- **Affects multiple machines** from a single power source
- **Scales with factory growth** as you add more machines
- **Requires strategic planning** for optimal coverage
- **Creates interesting logistics** around fuel, energy, and network topology

### Differentiation from Other Systems
- **Not Item-Based**: Unlike Hyper Processing Upgrades, overclock doesn't occupy inventory slots
- **Network Infrastructure**: Requires dedicated cables and relays
- **Fuel Variety**: Multiple fuel types with different power/efficiency tradeoffs
- **Dynamic Scaling**: Performance scales with fuel mixture and energy investment
- **Factory-Wide**: One tower can boost dozens of machines simultaneously

## System Components

### Core Components

#### 1. Overclock Tower
**Role**: Power source and overclock generator
- Consumes energy and fuel materials
- Generates overclock "charge" with configurable power level
- Distributes energy to connected relays
- Central hub for the overclock network

**Key Stats**:
- Base energy cost: 32,000 DE/tick
- Energy capacity: 102.4 million DE
- 9 fuel slots for flexible fuel mixing
- Relay energy sharing: 20,000 DE/tick per relay

#### 2. Overclock Relay
**Role**: Network distribution node
- Receives overclock charge from tower
- Applies boost to adjacent machines
- Distributes energy to network machines
- Acts as network extender for large factories

**Key Stats**:
- Network scan range: 96 nodes
- Energy distribution: 20,000 DE/tick
- Prioritizes nearest machines
- Excludes generators from boost

#### 3. Reinforced Cable
**Role**: Multi-purpose network backbone
- Carries energy for machine power
- Carries fluid for machine input
- Propagates overclock signals
- Visual connections to adjacent blocks

**Key Stats**:
- Energy network: 2,048 nodes
- Overclock network: 96 nodes (relay-limited)
- Triple functionality in one block
- Dynamic connection rendering

#### 4. Reinforced Extractor *(Bonus Component)*
**Role**: Automated fluid logistics
- Extracts fluids from sources
- Distributes through cable network
- Complements energy and overclock systems
- Rounds out factory automation

**Key Stats**:
- Extraction rate: 4,000 mB/tick
- Network scan: 256 nodes
- Supports all fluid types
- Directional extraction

## How The System Works

### Basic Setup Flow

#### Phase 1: Power Generation
```
1. Build energy generation (generators, batteries)
2. Ensure sufficient energy output for tower + machines
3. Plan for scaled energy costs as overclock level increases
```

#### Phase 2: Tower Installation
```
4. Place Overclock Tower in a central location
5. Connect energy source to tower
6. Insert fuel materials (Titanium, Copper, Energized Iron)
7. Verify tower activates and shows overclock charge
```

#### Phase 3: Network Infrastructure
```
8. Place Reinforced Cable from tower outward
9. Create cable backbone to reach machine areas
10. Use cable branches to cover all machine clusters
11. Verify continuous cable paths (no gaps)
```

#### Phase 4: Relay Deployment
```
12. Place Overclock Relays near machine groups
13. Ensure relays connect to tower via cable (within 96 nodes)
14. Verify relays show active overclock charge
15. Confirm machines adjacent to cables get boosted
```

### Signal Flow Diagram
```
┌─────────────────┐
│ Overclock Tower │ ← Energy Input
│  (Fuel + Energy)│ ← Fuel Input (Titanium, Copper, etc.)
└────────┬────────┘
         │ Overclock Signal (Level + Effectiveness)
         │ Energy Share (20k DE/tick)
         ↓
┌────────────────┐
│ Reinforced     │
│ Cable Network  │
└────────┬───────┘
         │ Propagates Overclock
         │ Distributes Energy
         │ Routes Fluid
         ↓
┌─────────────────┐
│ Overclock Relay │
└────────┬────────┘
         │ Machine Boost (Level × Effectiveness)
         │ Energy Distribution (20k DE/tick)
         ↓
   ┌─────┴─────┬─────────┬─────────┐
   ↓           ↓         ↓         ↓
[Machine A] [Machine B] [Machine C] [Machine D]
 +Speed      +Speed     +Speed      +Speed
 +Capacity   +Capacity  +Capacity   +Capacity
 +Transfer   +Transfer  +Transfer   +Transfer
```

## Boost Mechanics

### What Gets Boosted
Overclock affects three machine attributes:
1. **Processing Speed**: Machines complete recipes faster
2. **Energy Capacity**: Internal energy storage increases
3. **Liquid Transfer Rates**: Fluid input/output speeds up

### Boost Calculation
```
Effective Boost = Overclock Level × Effectiveness
Speed Bonus = 0.35 × (Fuel Power × Effectiveness)
```

**Example with 3 Titanium Ingots**:
- Fuel Power = 3 × 1.0 = 3.0
- Effectiveness = 1.25 (from Titanium)
- Effective Boost = 3.0 × 1.25 = 3.75
- Speed Bonus = 0.35 × 3.75 = +1.3125 (131.25% faster)

### Machine Eligibility
**Boosted**:
- All AT machines (Cloner, Liquifier, Energizer, etc.)
- All UtilityCraft machines connected to the network
- Any block tagged with `dorios:machine`

**NOT Boosted**:
- Generators (any energy source)
- Batteries (energy storage only)
- Blocks tagged with `dorios:energy_source`

This prevents infinite energy loops and maintains game balance.

## Fuel Strategy

### Fuel Types Comparison

| Fuel | Duration | Power | Effectiveness | Speed/Fuel | Efficiency Cost | Use Case |
|------|----------|-------|---------------|------------|-----------------|----------|
| **Titanium** | 500 ticks | 1.0 | 1.25× | +0.438 | -25% | Balanced, long-lasting |
| **Copper Ingot** | 400 ticks | 0.5 | 2.0× | +0.350 | -50% | High efficiency, lower power |
| **Energized Iron** | 50 ticks | 3.0 | 1.5× | +1.575 | -75% | Maximum burst power |

### Fuel Mixing Strategies

#### Strategy 1: Pure Titanium (Balanced)
```
9 Titanium Ingots → Level 9.0, Effectiveness 1.25
Speed Boost: +3.938
Energy Cost: ~144k DE/tick
Duration: 500 ticks each
```
**Best for**: Stable, long-term operation

#### Strategy 2: Mixed Copper + Titanium (Efficiency)
```
5 Copper + 4 Titanium → Level 6.5, Effectiveness 2.0
Speed Boost: +4.550
Energy Cost: ~104k DE/tick
Duration: 400-500 ticks
```
**Best for**: Energy-constrained setups

#### Strategy 3: Energized Iron Burst (Maximum Power)
```
9 Energized Iron → Level 27.0, Effectiveness 1.5
Speed Boost: +14.175
Energy Cost: ~432k DE/tick
Duration: 50 ticks each
```
**Best for**: Short-term production sprints

#### Strategy 4: Hybrid Mix (Flexible)
```
3 Titanium + 3 Copper + 3 Energized Iron
Level: 10.5, Effectiveness: 2.0
Speed Boost: +7.350
Energy Cost: ~168k DE/tick
Duration: Variable
```
**Best for**: Adapting to changing needs

## Progression Integration

### Early Game (Not Recommended)
Overclock Network is NOT for early game:
- Requires Titanium (deepslate ore)
- Needs Energized Iron (advanced processing)
- High energy demands
- Complex infrastructure

### Mid Game (Preparation)
Start preparing for overclock:
- Stockpile Titanium from mining
- Build sufficient energy generation
- Learn cable routing and network design
- Expand machine base to justify overclock investment

### Late Game (Full Deployment)
Overclock Network shines in late game:
- Massive machine arrays benefit from shared boost
- Energy infrastructure can handle scaled costs
- Aetherium and Titanium are readily available
- Factory layout supports cable networks

### End Game (Optimization)
Fine-tune your overclock setup:
- Mix fuels for optimal power-to-efficiency ratios
- Multiple towers for different factory sections
- Redundant relay coverage for critical machines
- Integrated energy, fluid, and overclock networks

## Network Design Patterns

### Pattern 1: Star Network
```
        Machine
           |
Machine - Relay - Machine
           |
        Machine
           |
        Cable
           |
         Tower
```
**Pros**: Simple, centralized, easy to expand
**Cons**: Single point of failure (relay)

### Pattern 2: Ring Network
```
Tower - Cable - Relay - Cable - Relay - Cable - Tower
          |               |               |
      Machines        Machines        Machines
```
**Pros**: Redundancy, balanced load
**Cons**: More complex, higher cost

### Pattern 3: Spine and Ribs
```
Tower - Cable - Relay - Cable - Relay - Cable - Relay
                  |               |               |
                Cable            Cable           Cable
                  |               |               |
              Machines        Machines        Machines
```
**Pros**: Scalable, organized, easy to debug
**Cons**: Requires planning, more cable needed

### Pattern 4: Layered Network
```
Floor 3: Machines - Cable - Machines
Floor 2: Cable - Relay - Cable
Floor 1: Tower - Generator - Battery
```
**Pros**: Compact, efficient use of space
**Cons**: Vertical routing challenges

## Resource Requirements

### Startup Costs
- **Overclock Tower**: High-tier materials
- **Reinforced Cable**: Medium-cost, quantity needed
- **Overclock Relay**: High-tier, multiple needed
- **Fuel Stock**: Continuous Titanium/Copper supply
- **Energy Infrastructure**: Significant generator capacity

### Operating Costs
- **Energy**: 32k+ DE/tick per tower (scales with level)
- **Fuel**: Continuous consumption while active
- **Maintenance**: Minimal (system is passive once built)

### Scaling Costs
Adding more machines to the network:
- **No cost**: Machines don't need individual upgrades
- **Energy**: Slightly higher energy consumption per machine
- **Cable**: Extend cable to reach new machines
- **Relays**: Add relays if beyond 96-node range

## Troubleshooting Guide

### Tower Not Activating
**Check**:
- [ ] Fuel inserted in slots 2-10
- [ ] Sufficient energy in tower
- [ ] Fuel types are valid (Titanium, Copper, Energized Iron)
- [ ] Energy cost not exceeding generation

**Fix**: Insert valid fuel, increase energy supply

### Relay Not Getting Overclock
**Check**:
- [ ] Relay connected to tower via Reinforced Cable
- [ ] Cable path is continuous (no gaps)
- [ ] Distance from tower is within 96 nodes
- [ ] Tower is active and showing overclock level

**Fix**: Complete cable path, add intermediate relays if too far

### Machines Not Boosted
**Check**:
- [ ] Machines adjacent to cable or network blocks
- [ ] Relay is active (ON state)
- [ ] Machine is not a generator
- [ ] Machine has `dorios:machine` tag

**Fix**: Move machines adjacent to cable, verify relay active

### Energy Not Reaching Machines
**Check**:
- [ ] Reinforced Cable connects energy sources to targets
- [ ] Energy sources are active and have energy
- [ ] Target machines have available capacity
- [ ] Network scan didn't exceed 2,048 nodes

**Fix**: Check cable continuity, verify source output

### Performance Degradation
**Check**:
- [ ] Fuel not depleted in tower
- [ ] Energy generation keeping up with consumption
- [ ] Network not overloaded (too many machines)
- [ ] No network breaks or disconnections

**Fix**: Refuel tower, scale energy generation, segment networks

## Performance Optimization

### Network Size Management
- Keep individual networks under 96 nodes for overclock
- Use multiple smaller networks instead of one massive network
- Segment by function: energy network vs. overclock network
- Monitor node counts when expanding

### Energy Efficiency
- Use Copper Ingots for high-efficiency setups
- Balance overclock level vs. energy cost
- Don't over-boost machines that are already fast enough
- Turn off tower when not needed (manual control)

### Fuel Management
- Stockpile fuels before activating tower
- Use longer-lasting fuels (Titanium) for AFK sessions
- Use burst fuels (Energized Iron) for active play
- Mix fuels based on current energy generation capacity

### Physical Layout
- Central tower placement reduces cable costs
- Cluster machines by function near relays
- Minimize cable path length for easier debugging
- Leave space for future expansion

## Advanced Techniques

### Multiple Tower Setup
Run multiple towers independently:
- **Isolated Networks**: Separate tower per factory section
- **Redundancy**: Backup tower for critical systems
- **Specialized Boosts**: Different fuel mixes for different areas
- **Load Distribution**: Split energy demand across towers

### Dynamic Fuel Switching
Change fuel types based on needs:
- **Idle**: Remove all fuel to save energy
- **Normal**: Use Titanium for steady operation
- **Sprint**: Switch to Energized Iron for short bursts
- **Economy**: Use Copper when energy-constrained

### Hybrid Cable Networks
Mix Reinforced Cable with standard cables:
- Use standard cables for energy-only sections
- Reserve Reinforced Cable for overclock zones
- Reduces overall infrastructure cost
- Maintains flexibility for future expansion

### Relay Placement Optimization
Strategic relay positioning:
- One relay per 10-15 machines
- Overlap coverage for redundancy
- Near high-priority machines (duplicators, fabricators)
- Central hubs for energy distribution

## Balance and Progression

### Why Overclock Exists
The Overclock Network addresses late-game needs:
- **Scaling Challenge**: Large factories need better throughput
- **Resource Sink**: Uses Titanium and Aetherium productively
- **Infrastructure Gameplay**: Rewards planning and network design
- **Unique Identity**: Differentiates AT from other tech add-ons

### Balance Considerations
- **Generator Exclusion**: Prevents infinite energy loops
- **Energy Scaling**: Higher overclock = higher energy cost
- **Fuel Consumption**: Continuous resource investment required
- **Network Limits**: Scan ranges prevent unlimited scaling

### Compared to Alternatives
- **Hyper Processing Upgrade**: Individual machine boost, occupies slot
- **Overclock Network**: Factory-wide boost, infrastructure investment
- **Conclusion**: Both have roles; use Hyper for specific machines, Overclock for everything else

## See Also
- [Overclock Tower](./overclock-tower.md) - Core overclock generator
- [Overclock Relay](./overclock-relay.md) - Distribution node
- [Reinforced Cable](./reinforced-cable.md) - Network backbone
- [Reinforced Extractor](./reinforced-extractor.md) - Fluid automation

## External Resources
- UtilityCraft Wiki (base system reference)
- Machine roadmap (Roadmap.md in repository)
- AT Discord community (support and optimization tips)

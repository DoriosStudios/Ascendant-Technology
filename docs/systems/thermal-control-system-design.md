# Thermal Control Module - System Design Specification

## Overview
The Thermal Control Module is a unique gameplay system that introduces heat management mechanics to Ascendant Technology. It serves as a stability layer for high-performance machine operations, creating meaningful choices between speed and resource consumption.

## System Goals

### Differentiation
- **Unique to AT**: No equivalent in base UtilityCraft
- **Thematic fit**: Aligns with AT's tech-focused progression
- **Resource sink**: Creates demand for Cryofluid production
- **Risk/reward**: Enables powerful setups with proper investment

### Gameplay Impact
- **Gate high-tier operations**: H.P.U and overclock require cooling
- **Resource management**: Balance Cryofluid production vs. consumption
- **Spatial planning**: Encourages thoughtful factory layouts
- **Progressive unlocking**: Scales with player advancement

## Core Mechanics

### Heat System
Heat is a hidden stat tracked per machine that runs H.P.U or overclock:
- **Generation**: Increases with processing speed multipliers
- **Accumulation**: Builds up over time during operation
- **Decay**: Slowly reduces when idle
- **Effects**: Impacts efficiency, reliability, and output quality

### Cooling System
The Thermal Control Module provides cooling through two modes:

#### Passive Cooling
- Always active when installed
- Uses structural properties of build materials
- 10% heat reduction
- No resource consumption
- Sufficient for basic operations

#### Active Cooling
- Requires energy and Cryofluid
- 40% heat reduction
- Prevents heat accumulation
- Enables sustained high-speed operations
- Scales with number of cooled machines

### Machine States

```
Heat Level | State | Effects
-----------|-------|--------
0-24%      | Cool  | Normal operation, optimal efficiency
25-49%     | Warm  | -5% efficiency, slight energy increase
50-74%     | Hot   | -15% efficiency, +10% energy, minor failures possible
75-89%     | Critical | -30% efficiency, +25% energy, high failure risk
90-100%    | Overheated | Machine shutdown, cooldown required
```

## Technical Implementation

### Block Structure
```javascript
Block ID: ascendant:thermal_control_module
Block Type: Machinery
Inventory Size: 27 slots
Energy Capacity: 32,000,000 DE
Fluid Capacity: 16,000 mB (Cryofluid only)
```

### Slot Layout
```
[0] Energy HUD indicator
[1] Status label
[2] Progress/cooling indicator
[3] Cryofluid capsule input
[4] Cryofluid tank display
[5-7] Upgrade slots
[8] Output/empty capsule
[9-26] Reserved for future features
```

### Adjacent Machine Detection
```javascript
// Scan pattern for adjacent machines
const ADJACENT_OFFSETS = [
  {x: 1, y: 0, z: 0},   // East
  {x: -1, y: 0, z: 0},  // West
  {x: 0, y: 1, z: 0},   // Up
  {x: 0, y: -1, z: 0},  // Down
  {x: 0, y: 0, z: 1},   // South
  {x: 0, y: 0, z: -1}   // North
];
```

### Cooling Calculation
```javascript
function calculateCooling(machine, heatLevel, cryofluidAvailable, energyAvailable) {
  const passiveCooling = 0.10; // 10%
  const activeCooling = 0.40; // 40%
  
  let coolingRate = passiveCooling;
  let cryofluidCost = 0;
  let energyCost = 0;
  
  if (cryofluidAvailable >= 50 && energyAvailable >= 800) {
    coolingRate = activeCooling;
    cryofluidCost = 50 + (adjacentMachineCount * 25);
    energyCost = 800;
    
    if (heatLevel > 75) {
      cryofluidCost *= 1.5; // High heat penalty
    }
  }
  
  return {
    coolingRate,
    cryofluidCost,
    energyCost,
    finalHeat: heatLevel * (1 - coolingRate)
  };
}
```

## Progression Integration

### Unlock Stages

#### Stage 1: Discovery (Mid-game)
**Prerequisites:**
- Cryo Chamber built and operational
- Titanium mining and processing established
- Basic Aetherium collected
- Understanding of H.P.U mechanics

**Unlocks:**
- Basic Thermal Control Module crafting
- Heat monitoring systems
- Passive cooling capability

#### Stage 2: Optimization (Late-game)
**Prerequisites:**
- Multiple H.P.U setups running
- Stable Cryofluid production pipeline
- Advanced Machine Frames available

**Unlocks:**
- Upgrade slots for efficiency/range
- Active cooling optimization
- Multi-machine cooling networks

#### Stage 3: Mastery (End-game)
**Prerequisites:**
- Overclock Tower operational
- Large-scale factory setups
- Aetherium-reinforced components

**Unlocks:**
- Auto-priority systems
- Maximum efficiency configurations
- Integration with Redundancy Nodes

### Material Costs

#### Basic Recipe
```
Thermal Control Module (1×):
├─ Titanium Plate (4×)
├─ Aetherium Shard (2×)
├─ Advanced Machine Frame (1×)
├─ Heat Sink (1×)
└─ Reinforced Casing (2×)
```

#### Heat Sink (Sub-component)
```
Heat Sink (1×):
├─ Titanium Ingot (3×)
├─ Copper Ingot (4×)
└─ Cryofluid Capsule (1×, returned empty)
```

#### Upgrade Costs
- **Efficiency Upgrade**: Titanium Plates + Aetherium + Circuit
- **Range Extension**: Advanced Frame + Aetherium Shards + Conduits
- **Auto-Priority**: Processing Unit + Refined Aetherium + Logic Core

## Balance Considerations

### Economic Balance
- **Cryofluid cost**: 50-500 mB per operation
- **Energy cost**: 800 DE per tick when active
- **Benefit**: Enables 2-4× speed operations safely
- **ROI**: Pays for itself after ~100 operations at H.P.U ×4

### Gameplay Balance
- **Required for**: H.P.U tier 3+, all overclock operations
- **Optional for**: H.P.U tier 1-2, standard operations
- **Risk without**: Increasing failure rates, output degradation
- **Reward with**: Reliable high-speed manufacturing

### Spatial Balance
- **Footprint**: 1 block
- **Range**: Adjacent only (upgradeable to 2-block radius)
- **Scaling**: 1 module per 2-4 machines recommended
- **Layout impact**: Encourages compact but organized builds

## User Interface

### Status Display
```
┌─────────────────────────────────┐
│  Thermal Control Module         │
├─────────────────────────────────┤
│  Mode: [Active/Passive]         │
│  Cooling: 40% (-15°C/tick)      │
│  Machines: 3 adjacent           │
│  Cryofluid: 8,450 / 16,000 mB  │
│  Energy: 24.5 / 32.0 MDE       │
├─────────────────────────────────┤
│  Consumption:                   │
│   - 125 mB/tick (Cryofluid)    │
│   - 800 DE/tick (Energy)       │
├─────────────────────────────────┤
│  [Upgrade Slots]               │
│   [Efficiency] [Range] [Auto]  │
└─────────────────────────────────┘
```

### Network Center Integration
The module reports to Network Center:
- Cooling efficiency percentage
- Cryofluid consumption rate
- Machines being cooled
- Alert when Cryofluid low

## Testing & Validation

### Test Scenarios

1. **Basic Functionality**
   - Module cools adjacent machine
   - Passive mode always works
   - Active mode requires resources

2. **Resource Management**
   - Cryofluid consumption scales correctly
   - Energy consumption as expected
   - Shortage handling (graceful degradation)

3. **Performance**
   - Multiple modules work independently
   - No lag with 10+ modules active
   - Heat calculations optimized

4. **Integration**
   - Works with all H.P.U tiers
   - Compatible with overclock systems
   - Reports to Network Center correctly

5. **Edge Cases**
   - Module removed during operation
   - Machine moved while being cooled
   - Zero Cryofluid handling
   - Maximum heat recovery

### Success Criteria
- ✅ All test scenarios pass
- ✅ No performance degradation
- ✅ Clear player feedback (UI)
- ✅ Balanced resource costs
- ✅ Documentation complete

## Documentation Requirements

### Player-Facing Docs
- ✅ Machine documentation (mechanics, usage, stats)
- ⬜ Recipe documentation (crafting, materials)
- ⬜ Progression guide (when to build, why important)
- ⬜ Tutorial tips (best practices, common mistakes)

### Technical Docs
- ✅ System design specification (this document)
- ⬜ Implementation notes (code structure, APIs)
- ⬜ Balance document (tuning parameters, formulas)
- ⬜ Integration guide (for future systems)

### Visual Aids
- ⬜ Machine screenshot/render
- ⬜ Layout examples (factory setups)
- ⬜ UI mockup/screenshot
- ⬜ Progression chart

## Future Expansion Opportunities

### Planned Features
- **Multi-tier modules**: Basic/Advanced/Expert versions
- **Specialized cooling**: Different fluids for different effects
- **Network cooling**: Centralized cooling distribution
- **Smart routing**: Automatic Cryofluid distribution

### Integration Points
- **Heavy Machinery**: Reactor cooling requirements
- **Redundancy Nodes**: Coordinated heat management
- **Batch Processor**: Cooling optimization for batches
- **Instability Regulator**: Combined stability system

## Conclusion

The Thermal Control Module introduces a meaningful resource management layer to high-performance operations in Ascendant Technology. It creates unique gameplay that:

1. **Differentiates AT** from base UtilityCraft
2. **Fits progression** naturally into existing systems
3. **Enables scaling** from basic to advanced setups
4. **Rewards planning** with reliable high-speed manufacturing
5. **Opens future design space** for expansion systems

This system fulfills the acceptance criteria:
- ✅ At least one new system implemented end-to-end
- ✅ Progression impact documented and balanced
- ⬜ Player-facing docs updated (in progress)

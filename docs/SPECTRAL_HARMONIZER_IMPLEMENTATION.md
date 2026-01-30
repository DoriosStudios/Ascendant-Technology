# Spectral Harmonizer System - Implementation Summary

## Overview
The Spectral Harmonizer system is a unique gameplay mechanic for Ascendant Technology that introduces synchronized beat cycles for machine coordination. This system was implemented from AI-suggested concepts to provide a distinctive end-game optimization strategy.

## System Components

### 1. Beat Core (Consumable Fuel)
- **File**: `BP/items/machinery/beat_core.json`
- **Type**: Consumable item
- **Stack Size**: 16
- **Crafting**: 4x Energized Iron + 4x Redstone + 1x Aetherium Shard → 2x Beat Core
- **Purpose**: Fuel for Spectral Harmonizer, consumed at 1 per 10 cycles (30 seconds)

### 2. Harmonic Coupler (Machine Upgrade)
- **File**: `BP/items/machinery/harmonic_coupler.json`
- **Type**: Upgrade item
- **Stack Size**: 8
- **Tag**: `utilitycraft:is_upgrade`, `utilitycraft:harmonic_coupler`
- **Crafting**: 4x Titanium + 4x Beat Core + 1x Advanced Chip
- **Purpose**: Enables machines to receive synchronization boosts from Spectral Harmonizer

### 3. Spectral Harmonizer (Synchronization Machine)
- **File**: `BP/blocks/machinery/machines/spectral_harmonizer.json`
- **Logic**: `BP/scripts/machinery/machines/spectral_harmonizer.js`
- **Type**: Machine block with tick processing
- **Energy Capacity**: 12,800,000 DE (12.8 MDE)
- **Energy Consumption**: 3,200 DE/tick upkeep
- **Inventory Size**: 10 slots
  - Slot 3: Beat Core input
  - Slots 0, 1, 2, 4, 5: Status/info panels
  - Slots 6-9: Hidden UI slots

## Mechanical Design

### Beat Cycle System
- **Cycle Duration**: 60 ticks (3 seconds at 20 TPS)
- **Beat Window**: First 30 ticks (1.5 seconds)
- **Speed Boost**: 10% increase during beat window
- **Fuel Consumption**: 1 Beat Core every 10 cycles
- **Desync Penalty**: 100 ticks (5 seconds) when Beat Core depletes

### Machine Scanning
- **Scan Volume**: Cubic, 16 blocks in each direction (33×33×33 total)
- **Max Machines**: 32 simultaneous synchronizations
- **Scan Optimization**: Results cached for 20 ticks (1 second)
- **Detection**: Checks for `dorios:machine` tag and `utilitycraft:harmonic_coupler` in inventory
- **Exclusions**: Self (Spectral Harmonizer) excluded from synchronization

### Synchronization Mechanism
1. Harmonizer scans for machines with Harmonic Couplers
2. During beat window (first 1.5s of cycle):
   - Sets `sh:harmonicBoost` property to 0.10 on synchronized machines
   - Sets `sh:harmonicTTL` to 10 ticks (grace period)
3. Outside beat window:
   - Decays `sh:harmonicTTL` timer
   - Maintains boost during TTL period
   - Removes boost when TTL expires

### Integration with Machine Class
**File**: `BP/scripts/machinery/managers_extra.js`

Added `applyHarmonicBoosts()` method:
- Called after `applyOverclockBoosts()` in Machine constructor
- Reads `sh:harmonicBoost` dynamic property
- Applies boost to `boosts.speed` multiplier
- Stacks multiplicatively with other speed upgrades

## Technical Implementation Details

### Performance Optimizations
1. **Scan Caching**: Machine locations cached in JSON, refreshed every 20 ticks
2. **Labeled Break**: Proper triple-loop exit when machine limit reached
3. **Targeted Property Updates**: Only writes to synchronized entities
4. **Grace Period**: 10-tick TTL prevents jittery boost application

### Status Panels
Three information panels display:
1. **Status Panel (Slot 0)**: Beat phase, cycle count, boost percentage
2. **Beat Cycle Panel (Slot 1)**: Next core consumption, window duration
3. **Synchronized Panel (Slot 5)**: Active machines count, scan range

### Failure Handling
- **No Beat Core**: Warning "Insert Beat Core", machine turns off
- **No Energy**: Warning "No Energy", machine turns off
- **Beat Core Depleted**: Triggers 5-second desync timer, all synchronized machines lose boost
- **Recovery**: Insert new Beat Core to resume after desync timer expires

## Balance Considerations

### Cost Analysis
**Initial Investment**:
- Spectral Harmonizer: Late-game materials (Aetherium Block, Titanium, Ultimate Chip)
- Harmonic Couplers: 1 per machine (4 Titanium + 4 Beat Cores + Advanced Chip each)

**Ongoing Costs**:
- Energy: 3.2 KDE/tick upkeep (continuous)
- Beat Cores: 1 every 30 seconds (120 per hour)

**Returns**:
- 10% speed boost across up to 32 machines
- Multiplicative stacking with other upgrades
- Persistent as long as fuel and energy maintained

### Progression Fit
- **Early Game**: Inaccessible (requires Aetherium, Titanium, late chips)
- **Mid Game**: Materials available but expensive
- **Late Game**: Viable optimization for large-scale factories
- **End Game**: Essential for maximum throughput setups

### Risk/Reward Balance
- **Risk**: Desync penalty disrupts production for 5 seconds
- **Mitigation**: Keep adequate Beat Core supply
- **Reward**: Significant throughput increase for coordinated setups
- **Trade-off**: Upgrade slot usage (Harmonic Couplers replace other upgrades)

## Documentation

### Player-Facing Documentation
- **Location**: `docs/machines/spectral-harmonizer.md`
- **Content**: 
  - Machine description and mechanics
  - Beat cycle explanation
  - Usage instructions
  - Status panel reference
  - Failure state recovery
  - Crafting recipes
  - Tips and strategies

### Localization
- **File**: `RP/texts/en_US.lang`
- **Entries**:
  - Block name and description
  - Entity name
  - Beat Core item description
  - Harmonic Coupler item description

### Code Documentation
- Inline comments explaining beat cycle logic
- Function documentation for scan/sync operations
- Property usage documentation

## Testing Recommendations

### Unit Testing (Manual)
1. **Beat Cycle Timing**: Verify 3-second cycles with correct phase transitions
2. **Fuel Consumption**: Confirm 1 core per 10 cycles
3. **Desync Behavior**: Test 5-second penalty on core depletion
4. **Energy Consumption**: Verify 3.2 KDE/tick upkeep

### Integration Testing (Manual)
1. **Multi-Machine Sync**: Test with various machine counts (1, 10, 32, 33)
2. **Harmonic Coupler Detection**: Verify detection in different inventory slots
3. **Boost Application**: Confirm 10% speed increase during beat windows
4. **Scan Range**: Test machines at boundaries (exactly 16 blocks away)
5. **Stacking**: Verify multiplicative stacking with overclock/other upgrades

### Performance Testing (Manual)
1. **Multiple Harmonizers**: Test 2-3 harmonizers in same area
2. **Max Capacity**: 32 synchronized machines per harmonizer
3. **Scan Optimization**: Verify 20-tick cache refresh behavior
4. **Entity Count**: Test with high entity counts nearby

### Edge Cases
1. **Machine Removed**: Verify graceful handling when synchronized machine broken
2. **Coupler Removed**: Test removing coupler from running machine
3. **Energy Depletion**: Confirm proper shutdown when energy runs out
4. **Dimension Change**: Test behavior across dimension boundaries (if applicable)

## Future Enhancement Opportunities

### Potential Improvements
1. **Visual Effects**: Particle effects during beat windows
2. **Audio Feedback**: Beat pulse sound effects
3. **Advanced Couplers**: Higher-tier couplers with increased boost
4. **Beat Patterns**: Variable cycle lengths for different boost profiles
5. **Network Linking**: Multiple harmonizers in coordinated super-networks

### Balance Adjustments
- Monitor actual usage patterns
- Adjust Beat Core consumption rate based on player feedback
- Fine-tune speed boost percentage if needed
- Consider desync penalty duration adjustments

## Comparison to Existing Systems

### vs. Overclock System
- **Overclock**: Continuous boost, requires coolant, applies to energy/capacity/speed
- **Harmonizer**: Periodic boost, requires Beat Cores, speed-only
- **Synergy**: Both systems can be used together (multiplicative stacking)

### vs. Hyper Processing Upgrade
- **Hyper Upgrade**: Per-machine, no energy cost, permanent once installed
- **Harmonizer**: Network-wide, requires upkeep, requires upgrade slot per machine
- **Synergy**: Both provide speed boosts that stack

### Unique Differentiators
- **Beat Cycle Mechanic**: Rhythmic gameplay element
- **Network Coordination**: Multi-machine optimization
- **Active Management**: Requires fuel maintenance
- **Strategic Placement**: Spatial optimization puzzle

## Conclusion

The Spectral Harmonizer system successfully introduces a unique gameplay mechanic that:
- Differentiates AT from base UtilityCraft
- Fits naturally into existing progression
- Provides meaningful late-game optimization
- Encourages strategic factory planning
- Creates ongoing resource management gameplay
- Stacks harmoniously with existing systems

The implementation is complete with all core components, documentation, and optimizations in place. In-game testing is recommended to validate balance and identify any edge cases not covered in the code review.

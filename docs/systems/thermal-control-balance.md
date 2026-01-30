# Thermal Control Module - Balance Configuration

This document defines all balance parameters for the Thermal Control system, including formulas, constants, and tuning guidelines.

## Core Parameters

### Module Base Stats
```javascript
const THERMAL_CONTROL_CONFIG = {
  // Energy system
  energyCapacity: 32_000_000,      // 32 MDE
  energyConsumption: 800,           // DE per tick (active mode)
  energyTransferRate: 8_000,        // DE per tick
  
  // Fluid system
  fluidCapacity: 16_000,            // mB (Cryofluid only)
  fluidType: 'ascendant:cryofluid',
  
  // Cooling parameters
  passiveCoolingRate: 0.10,         // 10% heat reduction
  activeCoolingRate: 0.40,          // 40% heat reduction
  baseCryofluidCost: 50,            // mB per operation
  perMachineCryofluidCost: 25,      // mB per adjacent machine
  highHeatMultiplier: 1.5,          // Cost increase above 75% heat
  
  // Operational limits
  maxAdjacentMachines: 6,           // Maximum machines that can be cooled
  maxCryofluidPerTick: 500,         // Maximum consumption rate
  scanInterval: 20,                 // Ticks between machine scans
  
  // Upgrade slots
  upgradeSlots: 3,                  // Total upgrade capacity
};
```

---

## Heat System Parameters

### Heat Generation Rates
```javascript
const HEAT_GENERATION = {
  // H.P.U heat generation (per tier, per tick)
  hpu_tier1: 5,     // +5 heat per tick
  hpu_tier2: 10,    // +10 heat per tick
  hpu_tier3: 20,    // +20 heat per tick
  hpu_tier4: 40,    // +40 heat per tick
  
  // Overclock heat generation (per level, per tick)
  overclock_level1: 15,   // +15 heat per tick
  overclock_level2: 30,   // +30 heat per tick
  overclock_level3: 50,   // +50 heat per tick
  
  // Recipe-based heat (per operation)
  simple_recipe: 2,       // Basic crafting
  complex_recipe: 5,      // Advanced processing
  unstable_recipe: 10,    // Volatile reactions
  
  // Passive heat decay (no cooling)
  natural_decay_rate: 1,  // -1 heat per tick when idle
};
```

### Heat Thresholds
```javascript
const HEAT_THRESHOLDS = {
  cool: {
    max: 24,
    efficiency_modifier: 1.00,     // 100% efficiency
    energy_modifier: 1.00,         // Normal energy cost
    failure_chance: 0.00,          // 0% failure rate
    display_color: '§a',           // Green
    display_text: 'Cool'
  },
  warm: {
    min: 25,
    max: 49,
    efficiency_modifier: 0.95,     // 95% efficiency (-5%)
    energy_modifier: 1.05,         // 105% energy cost (+5%)
    failure_chance: 0.01,          // 1% failure rate
    display_color: '§e',           // Yellow
    display_text: 'Warm'
  },
  hot: {
    min: 50,
    max: 74,
    efficiency_modifier: 0.85,     // 85% efficiency (-15%)
    energy_modifier: 1.10,         // 110% energy cost (+10%)
    failure_chance: 0.05,          // 5% failure rate
    display_color: '§6',           // Gold
    display_text: 'Hot'
  },
  critical: {
    min: 75,
    max: 89,
    efficiency_modifier: 0.70,     // 70% efficiency (-30%)
    energy_modifier: 1.25,         // 125% energy cost (+25%)
    failure_chance: 0.15,          // 15% failure rate
    display_color: '§c',           // Red
    display_text: 'Critical'
  },
  overheated: {
    min: 90,
    max: 100,
    efficiency_modifier: 0.00,     // 0% efficiency (shutdown)
    energy_modifier: 0.00,         // Machine disabled
    failure_chance: 1.00,          // 100% failure (forced cooldown)
    display_color: '§4',           // Dark red
    display_text: 'OVERHEATED'
  }
};
```

---

## Cooling Formulas

### Base Cooling Calculation
```javascript
/**
 * Calculate cooling effect on machine heat
 * @param {number} currentHeat - Current heat level (0-100)
 * @param {boolean} hasEnergy - Module has sufficient energy
 * @param {boolean} hasCryofluid - Module has sufficient Cryofluid
 * @param {number} adjacentCount - Number of machines being cooled
 * @returns {Object} Cooling result
 */
function calculateCooling(currentHeat, hasEnergy, hasCryofluid, adjacentCount) {
  let coolingRate = THERMAL_CONTROL_CONFIG.passiveCoolingRate;
  let cryofluidCost = 0;
  let energyCost = 0;
  let mode = 'passive';
  
  // Active cooling if resources available
  if (hasEnergy && hasCryofluid) {
    coolingRate = THERMAL_CONTROL_CONFIG.activeCoolingRate;
    mode = 'active';
    
    // Base cost
    cryofluidCost = THERMAL_CONTROL_CONFIG.baseCryofluidCost;
    energyCost = THERMAL_CONTROL_CONFIG.energyConsumption;
    
    // Add cost per adjacent machine
    cryofluidCost += adjacentCount * THERMAL_CONTROL_CONFIG.perMachineCryofluidCost;
    
    // High heat penalty
    if (currentHeat >= HEAT_THRESHOLDS.critical.min) {
      cryofluidCost *= THERMAL_CONTROL_CONFIG.highHeatMultiplier;
    }
    
    // Cap maximum consumption
    cryofluidCost = Math.min(cryofluidCost, THERMAL_CONTROL_CONFIG.maxCryofluidPerTick);
  }
  
  // Calculate final heat
  const heatReduction = currentHeat * coolingRate;
  const finalHeat = Math.max(0, currentHeat - heatReduction);
  
  return {
    mode,
    coolingRate,
    heatReduction,
    finalHeat,
    cryofluidCost,
    energyCost,
    effectiveness: (heatReduction / currentHeat) * 100
  };
}
```

### Upgrade Modifiers
```javascript
const UPGRADE_MODIFIERS = {
  efficiency: {
    tier1: {
      cryofluid_reduction: 0.20,    // -20% consumption
      energy_reduction: 0.15,        // -15% consumption
      cost_multiplier: 1.0
    },
    tier2: {
      cryofluid_reduction: 0.35,    // -35% consumption
      energy_reduction: 0.30,        // -30% consumption
      cost_multiplier: 1.5
    },
    tier3: {
      cryofluid_reduction: 0.50,    // -50% consumption
      energy_reduction: 0.45,        // -45% consumption
      cost_multiplier: 2.5
    }
  },
  range_extension: {
    tier1: {
      range_type: 'diagonal',        // Adds diagonal adjacency
      max_machines: 10,               // Increased capacity
      cost_multiplier: 1.2            // +20% costs
    },
    tier2: {
      range_type: 'radius_2',        // 2-block radius
      max_machines: 16,               // Further increased
      cost_multiplier: 1.5            // +50% costs
    }
  },
  auto_priority: {
    tier1: {
      balancing_enabled: true,
      overhead_reduction: 0.10,      // -10% total cost
      prioritization: 'heat_based',  // Targets hottest machines
      cost_multiplier: 0.90          // -10% costs
    }
  }
};
```

---

## Economic Balance

### Resource Costs

#### Crafting Costs
```javascript
const CRAFTING_COSTS = {
  thermal_control_module: {
    titanium_plate: 4,
    aetherium_shard: 2,
    advanced_machine_frame: 1,
    heat_sink: 1,
    reinforced_casing: 2
  },
  heat_sink: {
    titanium_ingot: 3,
    copper_ingot: 4,
    cryofluid_capsule: 1  // Catalyst, returned
  },
  reinforced_casing: {
    titanium_plate: 4,
    iron_plate: 4,
    aetherium_shard: 1,
    output_count: 4       // Makes 4 casings
  },
  // Upgrades
  efficiency_upgrade_t1: {
    titanium_plate: 2,
    aetherium_shard: 1,
    energy_circuit: 1,
    heat_conductor_coil: 1
  },
  range_extension_t1: {
    advanced_machine_frame: 1,
    aetherium_shard: 2,
    signal_conduit: 1,
    thermal_plating: 2
  },
  auto_priority: {
    processing_unit: 1,
    refined_aetherium_shard: 1,
    logic_core: 1,
    signal_router: 2
  }
};
```

#### Operational Costs (per hour)
```javascript
const OPERATIONAL_COSTS_PER_HOUR = {
  // At maximum usage (continuous operation)
  base_module: {
    cryofluid: 180_000,    // mB (180 buckets)
    energy: 576_000,       // DE (0.576 MDE)
  },
  
  // With efficiency tier 3
  optimized_module: {
    cryofluid: 90_000,     // mB (90 buckets)
    energy: 316_800,       // DE (0.317 MDE)
    savings: '50% Cryofluid, 45% energy'
  },
  
  // Per machine being cooled
  per_machine_addition: {
    cryofluid: 90_000,     // mB per hour per machine
    energy: 0,             // Energy is flat per module
  }
};
```

### Return on Investment
```javascript
const ROI_ANALYSIS = {
  // Cost of failures without cooling
  failure_costs: {
    recipe_failure_rate: 0.15,           // 15% at high heat
    average_recipe_value: 1000,          // Arbitrary units
    operations_per_hour: 200,            // At H.P.U ×4
    hourly_loss: 30_000,                 // Lost value
  },
  
  // Cooling system investment
  initial_investment: {
    titanium_equivalent: 20,             // Ingots
    aetherium_equivalent: 3,             // Shards
    total_value: 25_000,                 // Arbitrary units
  },
  
  // Break-even calculation
  break_even: {
    hourly_savings: 30_000,              // Prevented losses
    initial_cost: 25_000,
    hours_to_break_even: 0.83,           // ~50 minutes
    operations_to_break_even: 166,       // Operations
  }
};
```

---

## Performance Balance

### Computational Limits
```javascript
const PERFORMANCE_LIMITS = {
  // Per-module limits
  max_scan_radius: 3,                    // Blocks
  max_scanned_blocks: 125,               // 5×5×5 area
  scan_interval_ticks: 20,               // Scan every second
  
  // Per-world limits
  recommended_modules: 50,               // Per dimension
  maximum_modules: 200,                  // Hard cap
  warning_threshold: 100,                // Performance warning
  
  // Calculation optimization
  heat_update_interval: 5,               // Ticks between heat updates
  batch_size: 10,                        // Machines processed per batch
  cache_duration: 40,                    // Ticks to cache results
};
```

### Scaling Factors
```javascript
/**
 * Calculate performance impact of multiple modules
 * @param {number} moduleCount - Active modules
 * @returns {Object} Performance metrics
 */
function calculatePerformanceImpact(moduleCount) {
  const baseTickTime = 0.5;              // ms per module per tick
  const scalingFactor = 1.02;            // 2% increase per doubling
  
  const scaledTime = baseTickTime * moduleCount * Math.log2(moduleCount + 1) * scalingFactor;
  const tickBudget = 50;                 // ms per game tick
  const percentageUsed = (scaledTime / tickBudget) * 100;
  
  return {
    totalTickTime: scaledTime,
    percentageOfTick: percentageUsed,
    warning: percentageUsed > 10,
    critical: percentageUsed > 25
  };
}
```

---

## Tuning Guidelines

### When to Adjust Parameters

#### Cryofluid Consumption Too High
```javascript
// Reduce base cost
baseCryofluidCost: 40,  // Was 50
// Or reduce per-machine cost
perMachineCryofluidCost: 20,  // Was 25
```

#### Cooling Too Effective
```javascript
// Reduce active cooling rate
activeCoolingRate: 0.35,  // Was 0.40
// Or increase heat generation
hpu_tier3: 25,  // Was 20
```

#### Module Too Expensive
```javascript
// Reduce material requirements
CRAFTING_COSTS.thermal_control_module.titanium_plate = 3,  // Was 4
CRAFTING_COSTS.thermal_control_module.aetherium_shard = 1, // Was 2
```

#### Performance Issues
```javascript
// Increase scan interval
scanInterval: 40,  // Was 20 (scan every 2 seconds instead of 1)
// Reduce maximum machines
maxAdjacentMachines: 4,  // Was 6
```

### Testing Checklist
When adjusting balance:
- [ ] Test with single module + single machine
- [ ] Test with single module + max machines
- [ ] Test with multiple modules in cluster
- [ ] Verify Cryofluid consumption rates
- [ ] Check energy consumption patterns
- [ ] Measure performance impact
- [ ] Test edge cases (no resources, full heat, etc.)
- [ ] Validate upgrade effectiveness
- [ ] Compare to alternative strategies (no cooling)
- [ ] Check integration with other systems

---

## Version History

### v1.0 (Current)
- Initial balance parameters
- Based on theoretical calculations
- Pending real-world testing

### Future Versions
- Will adjust based on player feedback
- May introduce difficulty tiers
- Could add configuration options
- Possible dynamic balancing

---

## Configuration Options

### For Server Admins
```javascript
// config/ascendant_technology/thermal_control.json
{
  "enabled": true,
  "balance": {
    "cooling_rate_passive": 0.10,
    "cooling_rate_active": 0.40,
    "cryofluid_cost_base": 50,
    "cryofluid_cost_per_machine": 25,
    "energy_cost": 800
  },
  "limits": {
    "max_modules_per_chunk": 10,
    "max_machines_per_module": 6,
    "scan_radius": 3
  },
  "performance": {
    "scan_interval_ticks": 20,
    "heat_update_interval": 5,
    "enable_caching": true
  }
}
```

### Difficulty Presets
```javascript
const DIFFICULTY_PRESETS = {
  easy: {
    activeCoolingRate: 0.50,
    baseCryofluidCost: 30,
    energyConsumption: 600
  },
  normal: {
    activeCoolingRate: 0.40,
    baseCryofluidCost: 50,
    energyConsumption: 800
  },
  hard: {
    activeCoolingRate: 0.30,
    baseCryofluidCost: 75,
    energyConsumption: 1200
  },
  expert: {
    activeCoolingRate: 0.25,
    baseCryofluidCost: 100,
    energyConsumption: 1600
  }
};
```

---

## Balance Philosophy

### Design Principles
1. **Meaningful Choice:** Cooling should be optional for basic operations, required for advanced
2. **Scaling Cost:** More machines = proportionally more cost
3. **Risk/Reward:** Higher speeds need more cooling, but yield more output
4. **Progressive Unlocking:** Basic version accessible mid-game, optimized version end-game
5. **Integration:** Works with existing systems without replacing them

### Target Experience
- Players should **feel powerful** when properly cooling their factory
- Resource costs should be **noticeable but not punishing**
- Failures without cooling should be **frustrating enough to motivate building**
- Optimized setups should **feel rewarding and efficient**
- System should **enable creativity** in factory design

### Future Considerations
- Balance will evolve based on player data
- May introduce alternative cooling methods
- Could add specialized modules for specific use cases
- Possible integration with future reactor systems
- May add multiplayer-specific balance options

---

This balance document should be treated as a living document and updated as the system is tested and refined.

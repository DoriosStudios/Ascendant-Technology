# Overclock Injector

## Overview
The **Overclock Injector** is a specialized block in the Overclock Boost Network system that applies overclock boosts directly to machines. It acts as both an energy/fluid transfer cable and an overclock applicator, requiring careful coolant management to prevent catastrophic failure.

## Purpose
- Apply overclock boosts to individual machines
- Transfer energy and fluids through the overclock network
- Serve as the critical injection point in overclock systems

## Key Features

### Directional Overclock Application
- Must be placed facing the target machine
- Only applies overclock to the machine it directly faces
- Does not boost generators (preserves energy economy)

### Coolant System
The injector REQUIRES coolant to operate safely when overclock is active:

- **Cryofluid**: 100% effectiveness, consumes 120 mB/tick
- **Water**: 50% effectiveness, consumes 240 mB/tick

### Risk/Reward Mechanics

#### Normal Operation (with coolant)
- Green/Blue indicators
- Heat decreases over time
- Full overclock boost applied

#### Overheating (without coolant)
- Heat increases based on overclock level
- Warning state at 32+ heat
- Visual indicators (red glow, higher light emission)

#### Melt State (critical failure)
- Occurs at 42+ heat
- Block is destroyed permanently
- Plays destruction sound
- Interrupts network connection
- All machines downstream lose power/overclock

## Crafting Recipe
```
[Titanium] [Advanced Chip] [Titanium]
[Reinforced Cable] [Cryo Chamber] [Reinforced Cable]
[Titanium] [Energized Iron Ingot] [Titanium]
```

**Unlocks after**: Crafting an Overclock Tower

## Placement
1. Place near the machine you want to boost
2. Ensure the injector FACES the target machine
3. Connect to overclock network via Reinforced Cables
4. Fill with coolant (Cryofluid recommended)

## Network Integration

### Connection Chain
```
Overclock Tower → Reinforced Cable → Overclock Injector → Target Machine
```

### Energy Transfer
- Acts as a high-capacity energy conduit
- Seamlessly passes energy through the network
- No energy loss from passthrough

### Fluid Transfer
- Supports fluid transfer alongside energy
- Can carry coolant and other fluids
- Fluid tanks: 64,000 mB capacity

## Status Display
When interacting with the block, you'll see:
- **Overclock Level**: Current boost level from the network
- **Effectiveness**: Coolant effectiveness percentage
- **Coolant**: Type and status
- **Heat**: Current heat level vs threshold
- **Warning**: Critical overheat notification

## Usage Tips

### Best Practices
1. **Always use Cryofluid** when possible for full effectiveness
2. **Monitor heat levels** regularly to prevent melt failures
3. **Keep coolant reserves** - running out causes rapid heating
4. **Plan escape paths** - place injectors where melt won't cascade

### Common Mistakes
- ❌ Placing injector backwards (wrong face direction)
- ❌ Running without coolant monitoring
- ❌ Using only water for high-level overclocks
- ❌ Chaining too many machines on one injector

### Advanced Strategies
- Use separate injectors per critical machine
- Automate coolant delivery via fluid pipes
- Monitor heat with external systems
- Keep backup injectors crafted and ready

## Technical Details

### Specifications
- **Energy Capacity**: 10,240,000 DE
- **Fluid Capacity**: 64,000 mB
- **Heat Threshold**: 32 (warning) / 42 (melt)
- **Cooling Rate**: 2 heat/tick (with coolant)
- **Heating Rate**: 0.5 × overclock level/tick (no coolant)
- **Tick Rate**: Every 2 ticks

### Performance Impact
- Scans overclock network (max 96 nodes)
- Updates every 2 game ticks
- Minimal impact with proper network design

## Troubleshooting

### Injector not working
- Verify it's facing the target machine
- Check overclock tower has fuel and energy
- Ensure reinforced cable connections are complete
- Confirm target is not a generator

### Overheating constantly
- Increase coolant supply
- Use Cryofluid instead of Water
- Reduce overclock level from tower
- Check fluid connections

### Block melted
- Replace with new injector
- Reconnect network cables
- Set up coolant automation
- Monitor heat more carefully

## Integration with Other Systems

### Works With
- Overclock Tower (source)
- Reinforced Cable (backbone)
- All AT machines (targets)
- Fluid distribution systems
- Automated monitoring systems

### Does NOT Work With
- Generators (excluded by design)
- Non-machine blocks
- Vanilla machines

## Progression Context
The Overclock Injector represents late-game optimization:
- Requires established Overclock Tower setup
- Demands continuous resource investment (coolant)
- Offers substantial performance gains
- Punishes poor management with real consequences

This risk/reward balance encourages thoughtful factory design and active management rather than "set and forget" automation.

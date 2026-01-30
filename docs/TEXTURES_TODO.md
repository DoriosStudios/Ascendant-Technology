# Texture Assets TODO

## Overclock Injector

The Overclock Injector currently uses placeholder textures copied from other blocks. Custom textures should be created for:

### Required Textures
1. **overclock_injector_off.png** (64x64)
   - Base inactive state
   - Should show directional orientation clearly
   - Suggest: Dark metal frame with inactive injection ports
   
2. **overclock_injector_on.png** (64x64)
   - Active overclock injection state
   - Should show energy/overclock flowing through
   - Suggest: Glowing blue/cyan accents, active ports with particle effects
   
3. **overclock_injector_overheat.png** (64x64)
   - Critical warning state
   - Should clearly communicate danger
   - Suggest: Red/orange glow, heat distortion, warning indicators

### Design Guidelines
- Should be visually distinct from Overclock Tower
- Must clearly show directionality (which face is "front")
- Should integrate visually with Reinforced Cable
- Warning state needs to be immediately noticeable
- Consider animated textures for the "on" state

### Current Placeholder Mapping
- `off` → copied from `overclock_tower_off.png`
- `on` → copied from `overclock_tower_on.png`
- `overheat` → copied from `laser_barrier_on.png`

These placeholders work functionally but should be replaced with proper custom art for the final release.

## Model Reference
The injector uses the existing `geometry.utilitycraft_injector` model from `RP/models/blocks/injector.geo.json`, which appears to be already designed for this purpose.

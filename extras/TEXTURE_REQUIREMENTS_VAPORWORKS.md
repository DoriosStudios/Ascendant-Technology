# Vaporworks Processor - Texture Requirements

The Vaporworks Processor implementation requires the following textures to be added to the resource pack:

## Block Textures
- **utilitycraft_vaporworks_processor_off** - Texture for the machine when idle/off
- **utilitycraft_vaporworks_processor_on** - Texture for the machine when active/on (should have animated or glowing elements)

## Texture Location
Block textures should be placed in: `RP/textures/blocks/`
Item textures should be placed in: `RP/textures/items/*`

## Design Suggestions
- The Vaporworks Processor block texture should convey heat/steam processing (e.g., vents, steam effects)
- Active state should include glowing elements or animated steam effects
- Steam capsules can follow the existing capsule texture pattern but with a light gray/white tint to represent steam
- Consider adding particle effects or steam wisps in the active state texture

## Current Status
Currently, the machine will use placeholder textures until these custom textures are created. The machine is fully functional otherwise.

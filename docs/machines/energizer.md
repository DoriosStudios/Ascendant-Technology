# Energizer (Pulse Forge)

[![](../pics/energizer.png)](../pics/energizer.png)

Converter that turns common items into energized variants without catalysts.

## What it does
- Converts resources into energized variants.
- Runs with two input channels (Primary and Auxiliary).
- Uses a single output slot.
- Processes items using pure energy without additional materials.

## How to use
1. Insert items into the Primary or Auxiliary slot.
2. The machine uses the first slot with a valid recipe.
3. Take the result from the output slot.

## Inputs and outputs
- **Inputs**: Two slots (Primary and Auxiliary).
- **Output**: One slot.

## Machine Capabilities
- **Energy Capacity**: 256,000,000 DE (256 MDE)
- **Energy Consumption**: Varies per recipe (72,000 - 2,400,000 DE per craft)
- **Processing Rate**: 24,000 DE/tick
- **Upgrade Slots**: 3 slots (supports speed, energy, and advanced upgrades)

## Recipes

### Native Recipes
Catalyst-free conversion of common items into energized variants.

| Input | Output | Energy (DE) | Time (s) | Preferred slot |
| --- | --- | --- | --- | --- |
| Iron Ingot ×1 | Energized Iron Ingot ×1 | 96000 | 4 | Primary |
| Raw Iron ×1 | Raw Energized Iron ×1 | 104000 | 5 | Primary |
| Iron Block ×1 | Energized Iron Block ×1 | 1820000 | 18 | Primary |
| Iron Dust ×1 | Energized Iron Dust ×1 | 72000 | 3 | Auxiliary |
| Redstone Block ×1 | Energy Upgrade ×1 | 2400000 | 8 | Primary |
| Raw Iron Block ×1 | Raw Energized Iron Block ×1 | 1820000 | 5 | Primary |

**Note**: The machine will process recipes from the first input slot that contains a valid recipe.

# Catalyst Weaver (Arc Loom)

[![](../pics/catalyst_weaver.png)](../pics/catalyst_weaver.png)

Advanced catalyst weaving: combines a base item, up to six catalysts, and optional fluid to produce a main output and possible byproduct.

## What it does
- Processes complex recipes with multiple catalysts.
- May require a specific fluid.
- Can generate a byproduct with a chance.
- Automatically imports and converts Infuser recipes to catalyst format.

## How to use
1. Insert the base item in the main slot.
2. Fill catalyst slots (up to 6).
3. If the recipe requires it, fill the fluid tank.
4. Wait for processing and take the main output and byproduct.

## Inputs and outputs
- **Input**: Base item.
- **Catalysts**: Up to 6 slots (the combination must match the recipe).
- **Fluid**: Optional, depending on the recipe.
- **Output**: Main result and byproduct (dedicated slot).

## Machine Capabilities
- **Energy Capacity**: 256,800,000 DE (256.8 MDE)
- **Energy Consumption**: Varies per recipe (5,400 - 601,600 DE per craft)
- **Processing Rate**: 180 DE/tick (very slow, precision crafting)
- **Fluid Tank Capacity**: 128,000 mB (128 buckets)
- **Upgrade Slots**: 3 slots (standard upgrade system)

## Fluids
- Internal tank with display.
- If the fluid type is wrong, the recipe will not start.
- Supports **Lava**, **Liquified Aetherium**, and **Dark Matter**.

## Recipes

### Native Recipes
| Input | Catalysts | Fluid | Output | Byproduct | Cost (DE) | Speed |
| --- | --- | --- | --- | --- | --- | --- |
| Gold Ingot ×1 | Steel Ingot ×1<br>Energized Iron Ingot ×1<br>Ender Pearl Dust ×4<br>Aetherium Shard ×4 | Lava <br> - 10kB (10000 mB) | Aetherium Ingot ×1 | Refined Obsidian Dust 0–2 (5%) | 12000 | 0.5x |
| Netherite Ingot | Aetherium Shard x4 | Lava <br>- 8000mB | Aetherium Ingot x1 | — | 86000 | 1x |
| Crying Obsidian Dust ×4 | Glowstone Dust ×2<br>Energized Iron Dust ×1 | Liquified Aetherium <br>- 250 mB | Refined Obsidian Dust ×2 | Obsidian ×1 (0.1%) | 5400 | 1.0x |
| Gold Ingot ×1 | Copper Dust ×4 | — | Bronze Ingot ×1 | — | 6400 | 1.0x |
| Speed Upgrade ×1 | Energized Iron Dust ×2<br>Aetherium Shard ×1<br>Titanium ×1 | — | Hyper Processing Upgrade ×1 | — | 12800 | 0.25x |
| Quadruple Compressed Cobblestone ×1 | Compressed Coal Block 4 ×1 | — | Compressed Blackstone 4 ×1 | — | 601600 | 0.5x |
| Amethyst Shard ×1 | — | Dark Matter <br>- 800 mB | Refined Aetherium Shard ×1 | — | 6400 | 1.0x |

**Legend**:
- **Catalysts**: Up to 6 slots. Extra slots must remain empty.
- **Byproduct**: Chance in %; quantities can be a range.
- **Speed**: Processing speed multiplier (lower = slower, more energy efficient).

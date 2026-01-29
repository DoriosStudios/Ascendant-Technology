# Liquifier (Flux Crucible)

[![](../pics/liquifier.png)](../pics/liquifier.png)

Thermal crucible that melts solids into fluid, with a chance of residue.

## What it does
- Converts solid items into fluid in the internal tank.
- Can produce secondary residue.
- Pushes fluid to adjacent connections when available.
- Supports fluid network distribution through fluid cables.

## How to use
1. Insert the solid item in the input.
2. Ensure there is space in the fluid tank.
3. Extract the fluid via pipes/capsules and take residue from the dedicated slot (if any).

## Inputs and outputs
- **Input**: solid items supported by recipes.
- **Outputs**: fluid in the internal tank and optional residue.

## Machine Capabilities
- **Energy Capacity**: 8,192,000 DE (8.19 MDE)
- **Energy Consumption**: Varies per recipe (3,600 - 12,800 DE per craft)
- **Processing Rate**: 3,600 DE/tick
- **Fluid Tank Capacity**: 128,000 mB (128 buckets)
- **Upgrade Slots**: 2 slots (supports speed and energy upgrades)

## Fluids
- The tank receives the fluid produced by the recipe.
- The capsule slot lets you transfer fluid between capsules and the tank.
- Fluid is automatically pushed to adjacent blocks and through fluid networks.
- Supports two fluid types: **Liquified Aetherium** and **Dark Matter**.

## Recipes

### Native Recipes
| Input | Fluid (output) | Energy (DE) | Time (s) | Byproduct |
| --- | --- | --- | --- | --- |
| Aetherium ×1 | Liquified Aetherium - 1000 mB | 9600 | 15 | Obsidian ×1 (25%) |
| Aetherium Shard ×4 | Liquified Aetherium - 1000 mB | 5400 | 10 | — |
| Ancient Debris ×2 | Dark Matter - 1000 mB | 12800 | 20 | Netherrack ×2 (35%) |
| Void Essence ×3 | Dark Matter - 750 mB | 6400 | 9 | Ender Pearl ×1 (20%) |
| Obsidian ×2 | Dark Matter - 500 mB | 5200 | 8 | Crying Obsidian ×1 (10%) |
| Refined Obsidian Dust ×4 | Dark Matter - 1000 mB | 7600 | 12 | Obsidian ×1 (35%) |

**Note**: Byproduct percentages indicate the chance of receiving the secondary item per craft.

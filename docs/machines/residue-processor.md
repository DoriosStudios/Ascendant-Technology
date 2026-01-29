# Residue Processor

[![](../pics/residue_processor.png)](../pics/residue_processor.png)

Residue processor that converts debris into reclaimed materials, with a chance of byproduct.
> [!NOTE]
> The functionality is confusing even to me, its creator. This machine may or may not change in the future.

## What it does
- Consumes residue and produces a main item.
- Can produce a byproduct with a recipe-defined chance.
- Reclaims valuable materials from waste products.

## How to use
1. Insert residue in the input slot.
2. Wait for processing.
3. Take the main output and byproduct (if any).

## Inputs and outputs
- **Input**: Residues defined by recipe.
- **Output**: Main item + optional byproduct.

## Machine Capabilities
- **Energy Capacity**: 12,800,000 DE (12.8 MDE)
- **Energy Consumption**: Varies per recipe (2,600 - 7,800 DE per craft)
- **Processing Rate**: 16,000 DE/tick
- **Upgrade Slots**: Supports the machine's standard upgrade system

## Recipes

### Native Recipes
| Input | Output | Byproduct | Energy (DE) | Time (s) | Notes |
| --- | --- | --- | --- | --- | --- |
| Void Essence ×1 | Aetherium Shard ×2 | Iron Nugget ×2 (35%) | 5200 | 5 | Breaks down condensed void essence into usable shards with a chance to sift iron grit. |
| Void Essence ×3 | Aetherium ×1 | Aetherium Shard ×1 (50%) | 7800 | 7 | Compresses excess residue into aetherium with shard feedback for automation loops. |
| Rotten Flesh ×3 | Void Essence ×1 | — | 2600 | 4 | Reclaims trace void essence from organic scraps instead of trashing them. |
| Bone Block ×1 | Bone Meal ×9 | Void Essence ×1 (20%) | 2600 | 4 | Pulverizes bone blocks back into meal with a slim chance of void residue. |
| Ender Pearl Dust ×2 | Ender Pearl ×1 | Gravel ×1 (50%) | 4200 | 6 | Refines loose ender dust back into a stable pearl. |

**Note**: Byproduct percentages indicate the chance of receiving the secondary item per craft.

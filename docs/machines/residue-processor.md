# Residue Processor

[![](../pics/residue_processor.png)](../pics/residue_processor.png)

Recovers useful materials from discarded items, dead coral and organic blocks.

## How to use
1. Open **Recipes** to select an input and preview every result, quantity and chance.
2. Insert the required material and supply energy.
3. Extract products from the four output slots. Processing waits if any required output is blocked, including chance-based outputs.

The upper-left output is the main product. The remaining three slots hold independent secondary products. A 5% chance is rolled once per craft, including batch processing.

## Recipes
| Input | Guaranteed outputs | Chance-based outputs | Energy (DE) |
| --- | --- | --- | --- |
| Void Essence x1 | Aetherium Shard x2 | Iron Nugget x2 (35%) | 6400 |
| Podzol x1 | Bone Meal x2 | Rotten Flesh x1 (65%) | 2200 |
| Bone Block x1 | Bone Meal x9 | None | 2600 |
| Rotten Flesh x4 | Leather x1 | Bone Meal x1 (35%) | 3400 |
| Ender Pearl Dust x2 | Ender Pearl x1 | Gravel x1 (50%) | 4200 |
| String x9 | Cobweb x1 | None | 6400 |
| Terracotta x4 | Clay Ball x8 | Brick x1 (50%), Miner Pottery Sherd x1 (4%), Explorer Pottery Sherd x1 (4%) | 4800 |
| Dead coral blocks x4 (each of the five types) | Calcite Pebble x4, Sand x1 | Sponge x1 (5%) | 4800 |
| Rooted Dirt x1 | Dirt x1 | Hanging Roots x1 (50%), Bone Meal x1 (25%) | 2400 |
| Muddy Mangrove Roots x1 | Mud x1, Mangrove Roots x1 | None | 2400 |

## Inventory and automation
- Input: slot 3.
- Upgrades: slots 4-7.
- Outputs, in reading order: 8, 9, 16, 17.
- Item I/O controls: slots 10-15.
- Primary Output extracts from slot 8; Residue Output extracts from 9, 16 and 17; Output All extracts from all four.
- Existing inventories are migrated while retaining items and I/O settings.

The recipe book is generated from the runtime catalog with `node tools/generate-residue-recipe-book.mjs` and adds no per-tick scripting.

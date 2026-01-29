# Duplicator (Cloner | Replication Matrix)

[![](../pics/duplicator.png)](../pics/duplicator.png)

Replication chamber that duplicates items via templates, consuming huge energy and Liquified Aetherium.

## What it does
- Uses a template to produce the original item + one copy.
- Consumes Liquified Aetherium per recipe.
- Time and cost vary by recipe rarity.
- Supports a wide range of items from common to mythic rarity.

## How to use
1. Insert the template in the main slot.
2. Fill the tank with Liquified Aetherium.
3. Wait for the process and collect original and copy from dedicated slots.

## Restrictions
- Cannot clone Lucky Tools, banners, or potions.
- Singularity templates must be crafted in the Singularity Fabricator.
- The Cloner block itself cannot be duplicated.

## Inputs and outputs
- **Input**: Template.
- **Outputs**: Original (slot 18) and copy (slot 19).

## Machine Capabilities
- **Energy Capacity**: 512,000,000 DE (512 MDE)
- **Energy Consumption**: Varies by rarity (10,000 - 30,000 DE per second)
- **Processing Rate**: 400 DE/tick (slow, high precision)
- **Fluid Tank Capacity**: 512,000 mB (512 buckets)
- **Fluid Consumption**: 50 mB per second of recipe time
- **Upgrade Slots**: 2 slots; speed upgrades reduce duplication time

## Fluids
- Only **Liquified Aetherium** (internal tank).
- Consumed continuously during the replication process.

## Recipes

### Cloning Mechanism
The Cloner always produces **1 original item + 1 copy** (total ×2).

**Fluid Consumption:** Liquified Aetherium at **50 mB per second** of recipe time.

### Cost per Rarity (kDE per second)
| Rarity | Energy Cost (DE/s) |
| --- | --- |
| Common | 10,000 |
| Uncommon | 48,000 |
| Rare | 240,000 |
| Epic | 1,200,000 |
| Legendary | 6,000,000 |
| Mythic | 30,000,000 |

**Note**: Processing time varies based on the item's complexity and rarity. Higher rarity items require exponentially more energy and time.

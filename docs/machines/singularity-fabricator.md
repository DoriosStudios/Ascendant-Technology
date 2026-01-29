# Singularity Fabricator

[![](../pics/singularity_fabricator.png)](../pics/singularity_fabricator.png)

Extreme variant of the Duplicator, focused on singularity items and absurdly high costs.

## What it does
- Uses templates to generate the original item + one copy.
- Consumes Dark Matter instead of Liquified Aetherium.
- Enforces very high minimum time and energy costs.
- Designed for end-game item duplication of extremely rare materials.

## How to use
1. Insert the template in the main slot.
2. Fill the tank with Dark Matter.
3. Wait for the process and collect original and copy from dedicated slots.

## Machine Capabilities
- **Energy Capacity**: 1,000,000,000 DE (1 GDE)
- **Energy Consumption**: Minimum 55,296,000,000 DE (≈55.3 GDE) per craft
- **Processing Rate**: 2,560,000 DE/tick (extremely fast to meet absurd energy demands)
- **Fluid Tank Capacity**: 1,024,000 mB (1024 buckets)
- **Processing Time**: Minimum 3,600s (1 hour) per craft in real time
- **Upgrade Slots**: Does not support upgrades; You will suffer.

## Energy and Time
- **Minimum time per craft**: 3,600s (1h).
- **Minimum cost per craft**: 55,296,000,000 DE (≈55.3 GDE).
- Cost scales with `rate_speed_base` via the dynamic time calculation; longer recipes still raise the total cost.

## Fluids
- Only **Dark Matter** (internal tank).
- Required for all singularity fabrication recipes.

## Recipes

### Singularity Fabrication Mechanism
The Singularity Fabricator accepts the same base templates as the Cloner, but applies:
- **Required fluid:** Dark Matter.
- **Minimum cost:** 55,296,000,000 DE (≈55.3 GDE) per craft.
- **Minimum time:** 3,600s (1h) per craft; Real time.
- **Dynamic scaling:** Cost scales with `rate_speed_base` to keep time stable.

The result always includes the original item + one copy (total ×2), with output adjusted to at least `input + 1`.

### Compatible Templates (current base)
- Totem of Undying
- Nether Star
- Dragon Egg
- Wither Skeleton Skull
- Dragon Head

**Note**: For rarity/time details of individual items, refer to the standard item rarity system. All items processed through the Singularity Fabricator are subject to the extreme minimum costs regardless of base rarity.

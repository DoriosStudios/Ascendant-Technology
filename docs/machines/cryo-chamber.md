# Cryo Chamber

[![](../pics/cryo_chamber.png)](../pics/cryo_chamber.png)

Multifunction thermal stabilizer running three modules in parallel: Cryo Stabilizer, Cooling Chamber, and Cryofluid Generator.

## Modules (run at the same time)
### Cryo Stabilizer
- Stabilizes volatile materials using Cryofluid.
- Input: stabilizer slot.
- Output: stabilizer slot.
- Requires energy and, when the recipe asks for it, Cryofluid.

### Cooling Chamber (3×3 grid)
- Cools items and food into cold variants.
- Each grid slot is processed independently.
- Some recipes require water or Cryofluid (see recipes).

### Cryofluid Generator
- Converts water into Cryofluid.
- Requires energy and a catalyst (Titanium or Raw Titanium).
- Outputs Cryofluid into the dedicated tank.
> [!NOTE]
> Cryofluid will be a better coolant for [Heavy Machinery Expansion](https://github.com/doriosstudios/utilitycraft-heavy-machinery) reactors in the future.

## Machine Capabilities
- **Energy Capacity**: 128,000,000 DE (128 MDE)
- **Energy Consumption**: Varies by recipe and module (1,600 - 64,000 DE per operation)
- **Processing Rate**: 2,400 DE/tick
- **Fluid Tank Capacity**: 64,000 mB (64 buckets) per tank (Water and Cryofluid)
- **Upgrade Slots**: Speed/efficiency upgrades affect all modules

## Tanks
- **Water tank** (input): 64,000 mB capacity
- **Cryofluid tank** (output): 64,000 mB capacity
- Both tanks operate independently for different modules.
- Tank capacity can be modified by editing the block definition file.

## Recipes

### Stabilization (Cryo Stabilizer)
| Input | Output | Cryofluid | Energy (DE) | Time |
| --- | --- | --- | --- | --- |
| Charged Darloonite Crystal ×1 | Darloonite Crystal ×1 | 1600 mB | 24000 | 200 ticks (10s) |
| Energized Iron Dust ×1 | Iron Dust ×1 | 250 mB | 4000 | 100 ticks (5s) |
| Energized Iron Ingot ×1 | Iron Ingot ×1 | 500 mB | 8000 | 200 ticks (10s) |
| Brute Energized Iron ×1 | Raw Iron ×1 | 500 mB | 8000 | 200 ticks (10s) |
| Energized Iron Block ×1 | Iron Block ×1 | 4000 mB | 64000 | 1200 ticks (60s) |
| Brute Energized Iron Block ×1 | Raw Iron Block ×1 | 4000 mB | 64000 | 1200 ticks (60s) |
| Refined Aetherium Shard ×1 | Aetherium Shard ×1 | 400 mB | 12000 | 300 ticks (15s) |

### Cooling (Cooling Chamber)
| Accepted inputs | Output | Fluid | Energy (DE) | Time |
| --- | --- | --- | --- | --- |
| Cooked Beef ×1 | Raw Beef ×1 | — | 2400 | 40 ticks (2s) |
| Cooked Porkchop ×1 | Raw Porkchop ×1 | — | 2400 | 40 ticks (2s) |
| Cooked Chicken ×1 | Raw Chicken ×1 | — | 2400 | 40 ticks (2s) |
| Snow Block ×1 | Ice ×1 | Water 100 mB | 1600 | 20 ticks (1s) |
| Ice ×1 | Packed Ice ×1 | — | 4000 | 60 ticks (3s) |
| Packed Ice ×1 | Blue Ice ×1 | — | 8000 | 100 ticks (5s) |

### Cryofluid Generator (config)
- **Input:** Water in the tank.
- **Output:** Cryofluid in the dedicated tank.
- **Base conversion:** 1000 mB water → 800 mB Cryofluid (0.8×).
- **Energy cost:** 32,000 DE per 1000 mB of water.
- **Limits:** Minimum 100 mB of water, minimum 50 mB of output space, up to 1000 mB processed per tick.
- **Accepted catalysts:**
  - **Titanium**: 1000 mB water → 800 mB Cryofluid.
  - **Raw Titanium**: 1000 mB water → 1600 mB Cryofluid.

# Cryo Chamber — Recipes

Recipes are split by module: stabilization (Cryo Stabilizer), cooling (Cooling Chamber), and Cryofluid generation.

## Stabilization (Cryo Stabilizer)
| Input | Output | Cryofluid | Energy (DE) | Time |
| --- | --- | --- | --- | --- |
| Charged Darloonite Crystal ×1 | Darloonite Crystal ×1 | 1600 mB | 24000 | 200 ticks (10s) |
| Energized Iron Dust ×1 | Iron Dust ×1 | 250 mB | 4000 | 100 ticks (5s) |
| Energized Iron Ingot ×1 | Iron Ingot ×1 | 500 mB | 8000 | 200 ticks (10s) |
| Brute Energized Iron ×1 | Raw Iron ×1 | 500 mB | 8000 | 200 ticks (10s) |
| Energized Iron Block ×1 | Iron Block ×1 | 4000 mB | 64000 | 1200 ticks (60s) |
| Brute Energized Iron Block ×1 | Raw Iron Block ×1 | 4000 mB | 64000 | 1200 ticks (60s) |
| Refined Aetherium Shard ×1 | Aetherium Shard ×1 | 400 mB | 12000 | 300 ticks (15s) |

## Cooling (Cooling Chamber)
| Accepted inputs | Output | Fluid | Energy (DE) | Time |
| --- | --- | --- | --- | --- |
| Cooked Beef ×1 | Raw Beef ×1 | — | 2400 | 40 ticks (2s) |
| Cooked Porkchop ×1 | Raw Porkchop ×1 | — | 2400 | 40 ticks (2s) |
| Cooked Chicken ×1 | Raw Chicken ×1 | — | 2400 | 40 ticks (2s) |
| Snow Block ×1 | Ice ×1 | Water 100 mB | 1600 | 20 ticks (1s) |
| Ice ×1 | Packed Ice ×1 | — | 4000 | 60 ticks (3s) |
| Packed Ice ×1 | Blue Ice ×1 | — | 8000 | 100 ticks (5s) |

## Cryofluid Generator (config)
- **Input:** water in the tank.
- **Output:** Cryofluid in the dedicated tank.
- **Base conversion:** 1000 mB water → 800 mB Cryofluid (0.8×).
- **Energy cost:** 32,000 DE per 1000 mB of water.
- **Limits:** minimum 100 mB of water, minimum 50 mB of output space, up to 1000 mB processed per tick.
- **Supplement:** 8 Lapis Lazuli or 16 Lapis Lazuli Dust per 1000 mB water processed.
- **Accepted catalysts:**
  - Titanium: 1000 mB water → 800 mB Cryofluid.
  - Raw Titanium: 1000 mB water → 1600 mB Cryofluid.

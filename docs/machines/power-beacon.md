# Power Beacons

Power Beacons distribute stored energy wirelessly to nearby machines in the same
dimension. Supply energy through a cable connected to the beacon. They consume
exactly the energy delivered; they do not generate energy or charge other beacons,
batteries or generators wirelessly. Line of sight is not required.

| Tier | Maximum transfer | Capacity | Spherical radius |
| --- | --- | --- | --- |
| Basic | 1,000 DE/t | 128,000 DE | 4 blocks |
| Advanced | 4,000 DE/t | 512,000 DE | 8 blocks |
| Expert | 16,000 DE/t | 2,048,000 DE | 12 blocks |
| Ultimate | 100,000 DE/t | 12,800,000 DE | 24 blocks |
| Absolute | 8,000,000 DE/t | 1,024,000,000 DE | 48 blocks |

All tiers use `geometry.utilitycraft_power_beacon` and their own 64×64 on/off
textures. The block lights up when it transfers energy. Its inventory contains
an energy display, status information and a transmission button. Item automation
cannot insert into or extract from these UI slots. Disabling transmission keeps
the stored energy and persists across reloads of the placed entity.

Energy is divided equally among eligible machines, with unused shares from nearly
full machines redistributed during the same cycle. Integer remainders rotate
between machines, so a continuous shortage does not always favor the same target.
The status panel reports connected targets, actual recipients and DE/t delivered.
Target membership updates on entity spawn/load/removal, with a staggered safety
rebuild every 600 ticks. Range, dimension, validity and capacity are rechecked
before every transfer.

## Crafting

Workbench and Assembler use matching recipes. All five tiers require one Echo
Shard (`minecraft:echo_shard`) in the top-center slot and four primary materials
in the corners:

| Tier | Primary material (×4) |
| --- | --- |
| Basic | Gold Ingot |
| Advanced | Energized Iron Ingot |
| Expert | Diamond Dust |
| Ultimate | Netherite Ingot |
| Absolute | Aetherium Ingot |

The Basic recipe uses a Machine Case in the bottom-center slot:

```text
A S A
C B C
A M A
```

- `A`: primary material from the table.
- `S`: Echo Shard.
- `C`: chip matching the beacon tier.
- `B`: vanilla Beacon for Basic; the previous Power Beacon tier for upgrades.
- `M`: Machine Case for Basic; higher tiers use another matching chip here.

## Validation

`npm run audit:aetherium-beacons` checks energy conservation, utilization, fairness,
range, stale targets, reload discovery, protected UI slots, pending button clicks,
recipe equivalence and texture dimensions using Minecraft API fixtures.

Manual Minecraft testing is still required: place all five tiers, supply them
through real cables, inspect both model states and the UI, toggle transmission,
unload/reload chunks, then break and replace a charged beacon to verify the
shared Generator energy-lore restoration. Inventory crafting does not preserve
the stored energy or transmission setting of the ingredient beacon.

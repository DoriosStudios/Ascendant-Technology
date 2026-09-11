# Aetherium progression and conversions

Mining Aetherium Ore produces Aetherium Crystals, while sieving and residue
processing produce Aetherium Shards. Crushing either Aetherium Ore variant
produces two shards. The Residue Processor turns one Void Essence into two
shards for 6,400 DE; the Singularity Fabricator can clone shards. The original
large-crystal artwork is now the distinct item `utilitycraft:aetherium_crystal`,
using `aetherium_crystal.png`. Loose fragments retain
`utilitycraft:aetherium_shard` and `aetherium_shards.png`.

| Input | Process | Output |
| --- | --- | --- |
| 1 End / Deepslate Aetherium Ore | Mining without Silk Touch | Aetherium Crystal (Fortune applies) |
| 1 End / Deepslate Aetherium Ore | Crusher / Pulverizer | 2 shards |
| 4 shards | Crafting table / Press / Compactor | 1 crystal |
| 1 crystal | Crafting table / Decompactor | 4 shards |
| 9 metal nuggets | Crafting table / Compactor | 1 metal ingot |
| 1 metal ingot | Crafting table / Decompactor | 9 metal nuggets |
| 2 shards | Crusher / Pulverizer | 1 crystal dust |
| 1 crystal | Crusher / Pulverizer | 2 crystal dust |
| 4 crystals | Crafting table / Press / Compactor | 1 crystal block |
| 1 crystal block | Crafting table / Decompactor | 4 crystals |
| 1 crystal block | Crusher / Pulverizer | 8 crystal dust |
| 9 metal ingots | Crafting table / Compactor | 1 metal block |
| 1 metal block | Crafting table / Decompactor | 9 ingots |
| 1 metal ingot / 1 metal block | Crusher / Pulverizer | 1 / 9 metal dust |
| 1 metal dust | Furnace / Blast Furnace / powered furnace | 1 ingot |

One crystal block represents **4 crystals = 16 shards = 8 crystal dust**.
Crystalline grinding preserves the exact material ratio. Crystals and crystal
blocks cannot bypass shard cloning restrictions through the ordinary Duplicator.
Crystal dust has no furnace recipe and cannot become Aetherium metal directly.

Combining **one titanium dust + one tungsten dust** produces two
`utilitycraft:tingstanium_dust`, displayed as **Titanium & Tungsten Dust** with
the gray subtitle **Mixed**. The recipe is available through shapeless crafting,
the UtilityCraft Assembler and the Infuser.

The Catalyst Weaver makes one Aetherium ingot from **one netherite ingot** as the
input, **eight ender pearl dust**, either **eight shards or two crystals**, and
1,600 mB cryofluid. The metal catalyst may be supplied either as **eight
titanium dust plus eight tungsten dust** or as **sixteen mixed Titanium & Tungsten
Dust**. The mixed dust recipes are automation alternatives; they do not replace
the original separate-dust recipes. All four routes cost 12,000 DE at 0.5x
speed and require the cryogenic family before Aetherium production.
The existing metal ingot ID remains `utilitycraft:aetherium`.

Refinement is a separate branch: **one crystal + one amethyst shard + 800 mB dark
matter** produces one Refined Aetherium Crystal for 3,200 DE. The Stabilizer can
return it to one ordinary crystal for 400 mB cryofluid and 12,000 DE over 300 ticks.
Refined crystals serve enchantment extraction, advanced runic cores and the
Aetherium storage part. They are not required for the metal alloy itself.

## Liquification

| One item | Liquified Aetherium |
| --- | --- |
| Metal ingot | 250 mB |
| Metal dust | 150 mB |
| Crystal | 100 mB |
| Crystal dust | 50 mB |
| Shard | 25 mB |
| Refined crystal | Not supported |

Each recipe costs 3,200 DE; metal inputs take 300 ticks and crystalline inputs
take 200 ticks. Crystalline grinding preserves liquid recovery: one crystal gives
100 mB directly or as two dust, while two shards give 50 mB directly or as one
dust. Metal grinding reduces the direct yield from 250 to 150 mB, but metal dust
can be smelted back into an ingot.
No native recipe currently solidifies Liquified Aetherium.

See [End veins](../worldgen/aetherium-end.md),
[Aetherium storage](../machines/aetherium-storage-cell.md),
[Catalyst Weaver](../machines/catalyst-weaver.md) and [Liquifier](../machines/liquifier.md).
Run `npm run audit:aetherium-beacons` and `npm run audit:decompactor` to validate.

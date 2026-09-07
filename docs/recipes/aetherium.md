# Aetherium: crystal and metal

Crystalline Aetherium comes from ore drops, sieving and residue processing.
Metallic Aetherium is an alloy produced by the Catalyst Weaver. Existing item
identifiers remain valid: `utilitycraft:aetherium` is the metal ingot and
`utilitycraft:aetherium_shard` is the crystal fragment. Fragments now use
`aetherium_shards.png`; refined crystals use `refined_aetherium_crystal.png` and the item ID `utilitycraft:refined_aetherium_crystal`.

| Material | Processing | Result |
| --- | --- | --- |
| 9 crystal fragments | Crafting table / Press / Compactor | 1 crystal block |
| 1 crystal block | Crafting table / Decompactor | 9 crystal fragments |
| 1 crystal fragment | Crusher / Pulverizer | 2 crystal dust |
| 1 crystal block | Crusher / Pulverizer | 18 crystal dust |
| 9 metal ingots | Crafting table / Compactor | 1 metal block |
| 1 metal block | Crafting table / Decompactor | 9 metal ingots |
| 1 metal ingot | Crusher / Pulverizer | 1 metal dust |
| 1 metal block | Crusher / Pulverizer | 9 metal dust |
| 1 metal dust | Furnace / Blast Furnace / powered furnace recipes | 1 metal ingot |

Crystal dust cannot be smelted directly into an ingot. Both Catalyst Weaver
alloy recipes require one gold ingot, one steel ingot, one energized iron ingot,
four ender pearl dust and 8,000 mB lava. The crystalline ingredient is either
four fragments or eight crystal dust. Both recipes cost 12,000 DE at 0.5x speed
and produce one ingot, with the same optional stabilized obsidian dust residue.

Refined crystals remain in the crystalline line: one fragment and one amethyst
shard with 800 mB dark matter produce one Refined Aetherium Crystal. Equipment, structural
machine components and the existing compressed Aetherium blocks remain metallic.
The new crystal block is excluded from ordinary duplication, matching other
mineral blocks and preventing storage from bypassing shard cloning restrictions.

Liquifying one metal ingot or one metal dust yields 250 mB. Four crystal fragments
or eight crystal dust yield 25 mB. Grinding before liquification changes neither
yield. See [Catalyst Weaver](../machines/catalyst-weaver.md) and
[Liquifier](../machines/liquifier.md) for machine details.

Run `npm run audit:aetherium-beacons` and `npm run audit:decompactor` to verify
the ratios, alloy alternatives, recipe previews and reverse storage recipes.

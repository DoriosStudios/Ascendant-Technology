# End Aetherium: standard veins and rare dense deposits

Two independent rules generate Aetherium in the End:

| Variant | Attempts per chunk | Mineral positions per deposit | Cover |
| --- | --- | --- | --- |
| Standard diagonal vein | 24 | 7, 9, 11 or 13 ore blocks | No sand shell |
| Rare dense deposit | 1/64 chance for one attempt | 51, 61, 71 or 97 mineral blocks | Fully sealed in End Sand |

The standard generation remains a thin, uncovered line of ore, with no crystal
blocks or sand. Its original 24-attempt frequency is restored. The dense rule has
a 1/64 chunk chance and makes one attempt when it succeeds. The earlier **75%
reduction applies only to that dense attempt count**, from four to one; it does
not reduce the standard ore generation.

Both rules use `underground_pass`, with anchors at X/Z 0–15 and Y 16–72. Their
diagonal axes span 7, 9, 11 or 13 positions, mirrored around the anchor. Both
horizontal diagonal directions and both vertical slope directions are possible.
Only newly generated terrain uses these features; Overworld generation is separate.

## Dense shape and abundance

The rare variant forms a mineral body with a thick center, narrow shoulders and
single-block tips. End Sand surrounds every face, including both axial ends.

For each axial step `t`, the center is `(t, height(t), diagonal * t)`; height is a
symmetric staircase rising one block every two steps. Cross-sections use the
Manhattan distance from that center:

- Inner third: radius 2, with 13 mineral blocks per section and a maximum width of 5.
- Shoulders: radius 1, with 5 mineral blocks per section.
- Tips: radius 0, with one mineral block at each end.

The four lengths contain **51, 61, 71 or 97 mineral positions**, averaging 70.
Each successful dense placement averages 70 mineral candidates. Its 1/64 scatter
chance makes that roughly 1.09 mineral candidates per chunk before terrain
filtering. Actual placement depends on terrain. The standard rule separately
averages 240 ore candidates per chunk. The rare variant supplements this ordinary
generation.

At the **single central position**, weighted selection uses ore weight 3 and
crystal-block weight 1: a **25% chance of one Aetherium Crystal Block per deposit**
if that position is End Stone. All other mineral positions use End Aetherium Ore.
The crystal block unpacks into four crystals.

## End Sand shell

`utilitycraft:end_sand` is a new nature block, mined faster with a shovel, using
sand sounds and dropping itself. It is a stable geological block without falling
behavior. Its terrain-atlas key is `utilitycraft_end_sand`.

The shell contains every non-mineral block sharing a face with the mineral body,
including the two axial end caps. Every ore, crystal and sand placement replaces
**only End Stone**. The ore and crystal feature also refuses positions touching
normal air. Existing air, builds and other blocks remain untouched;
at island edges or caves, the shell may appear but its mineral interior will not.

The atlas entry in `RP/textures/terrain_texture.json` points to the dedicated file
`RP/textures/blocks/nature/end_sand.png`. Its placeholder is an unchanged copy of
[Mojang's vanilla sand texture](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/blocks/sand.png).
Replace that PNG with the final artwork; no JSON changes are needed.

## Overworld dense deposits

The Overworld has an equivalent buried deposit between Y −60 and Y −8. It uses
the same 51–97 mineral core, 25% central crystal-block chance and air rejection,
but replaces only Deepslate. Its complete visible shell is
`utilitycraft:crushed_cobbled_deepslate`; Aetherium ore and crystal blocks never
generate exposed beside air.

The deposit has one 1/512-chance attempt per chunk, averaging about 0.14 mineral
candidates per chunk before terrain filtering. It spans much more vertical space
than the ordinary Deepslate veins. Those standard low, mid and high rules remain
separate and change from a 1/64 chance to 1/48, a modest 33% increase; their
combined expected candidates rise from about 0.80 to 1.06 per chunk.

## Feature graph and validation

`ae_ore_end_feature_rule` places `ae_ore_end_feature`, which visits the thin axis
and places ore directly through `ae_ore_end_block_feature`.

`ae_ore_end_dense_feature_rule` independently places `ae_ore_end_dense_feature`,
which visits the dense axis. `ae_ore_end_section_feature` scans a 7×7
cross-section and calculates disjoint mineral, center and shell masks. The
aggregate evaluates three scatter gates with zero or one iteration. No gate
mutates shared variables, so material selection does not depend on aggregate order.
The center gate selects between the ore and crystal single-block features.

This uses the documented [scatter](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraftscatter_feature?view=minecraft-bedrock-stable),
[aggregate](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraftaggregate_feature?view=minecraft-bedrock-stable)
and [weighted random](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraftweighted_random_feature?view=minecraft-bedrock-stable)
features. It does not require conditional-list or preview features.

Run `node tools/audit-end-aetherium.mjs` or `npm run audit:aetherium-beacons`.
The audit evaluates the feature graph for every length, direction and center
outcome, repeats with reused variables and reversed aggregate order, and checks
symmetry, tapering, exact volume, sand coverage, tip openings and terrain filters.
It also verifies that standard veins contain only ore and that each variant has
its own correctly targeted generation rule and placement frequency.
This is a static simulation; appearance, abundance and generation performance
still need validation inside Minecraft.

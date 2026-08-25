# v0.9.2 (Draft)

This draft combines the commits made after v0.9.1-beta with the current uncommitted worktree. It is not a release confirmation.

## Added

- Added the **Compactor**, including its machine, interface, compression recipes, and compressed-material progression.
  - Uses a 3×3 input grid, a 3×3 output grid, and four upgrade slots.
  - Supports eligible UtilityCraft materials from their base form through the highest available compression tier.
  - Converts pebbles, fragments, shards, and chunks into their solid forms.
- Added **Universal Cable**, **Universal Importer**, and **Universal Exporter** recipes, models, textures, and block definitions.
  - One network can carry items, fluids, gases, energy, and overclock.
  - Each face can independently enable or block each resource type.
- Added an Absolute Drill recipe matching the high-tier drill progression.
- Added dedicated glyph assets for StatsCore feedback and status displays.

## Changed

- Standardized machine information panels around the Catalyst Weaver proportions and styling.
  - Uses the shared `ascendant_common.info_panel` presentation.
  - Adds the separate `item_label` layer where required and suppresses duplicate info-panel text.
  - Replaces manual `background_panel` backgrounds with `dialog_background` in the affected interfaces.
- Improved Refining Table displays with item abilities, ability descriptions, elemental data, and per-element colors.
- Expanded Refining Table displays with profile, tier, affinity, levels, quality odds, costs, core requirements, and inherited abilities.
- Advanced Runic Core refinements now chain 10% same-category ability-inheritance rolls without an artificial success-count cap.
- Preserving now activates only from hostile combat damage; Healing Efficiency feedback reports only meaningful bonus healing and is throttled.
- Double and Triple Trouble now use back-loaded level bands and duplicate complete entity loot tables as well as block loot.
- Marked particles now follow mob heads every two ticks, Berserk applies up to Strength V, and Void creates a persistent-center 7.5-block audiovisual singularity.
- Marked now renders 2.5 blocks above its target with full-bright additive rendering.
- Advanced Runic Core inheritance now uses canonical channel-based donor pools, allowing combat equipment to inherit Bleeding, Reaper, Berserk, and other combat abilities regardless of the receiver's material tier.
- Added `/sc:refine_element`; refinement attribute, ability, and element test commands persist the main-hand item and refresh its lore immediately.
- Updated fluid capsules to collect connected source blocks up to their remaining capacity and merge into compatible existing stacks when possible.
- Improved Universal Cable face configuration, connection geometry, invalidation, and overclock traversal performance.
- Updated StatsCore feedback defaults to `both_partial`; that style now shows only total damage. Healing feedback only appears for actual healing above 0.1 hearts.
- Adjusted Lightning aftermath handling to clear nearby player fire and fire blocks within ten blocks of the impact, while preserving the lightning strike.
- Added thermal status details to the Impact Crusher, including current heat, cooling state, and estimated overheat time without steam. Lava heating ramps more gradually after steam is exhausted.

## Fixed

- Fixed the Enchantment Station plan so compatible enchantments can be added after existing planned upgrades are applied.
- Arcane Enchanter outputs use `minecraft:enchanted_book`.
- Aetherium AIOT keeps its intentional all-equipment enchantability while selecting only from the station’s curated eligible enchantment catalogue.
- Duplicator now honours the `ascendant:unclonnable` block tag as well as item restrictions.
- Duplicator blocks mineral blocks and compressed variants from being cloned.
- Genetic Seed Synthesizer reserves output capacity before starting an operation, preventing dropped overflow items.
- Restored the Industrial Burner lava speed bonus and corrected Nether Tungsten Ore mining output.

## Technical

- Batched multi-resource network invalidation and reduced redundant cable permutation writes.
- Added face-configuration caching during overclock graph traversal.
- Added `best`, `worst`, preset, and true-random refinement modes to `sc:refine`, with clearer syntax diagnostics and logging.
- Reorganized transportation block assets and updated manifests, localization, and the roadmap.

## Release blocker / validation

- Elemental combat effects require a refined item and currently only target entities categorized as neutral, hostile, or boss. Players, tamed entities, and passive mobs are intentionally filtered before an elemental proc can run. Validate the intended target policy and test against a refined weapon on a hostile target before releasing 0.9.2.

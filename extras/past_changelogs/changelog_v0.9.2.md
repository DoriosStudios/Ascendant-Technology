# Ascendant Technology v0.9.2

> **Status:** Draft — includes the current working tree. Final in-game release validation is pending.

This update expands Aetherium processing, adds the Compactor and Decompactor, introduces Universal transportation, and improves machine upgrades, refining, recipes, and interfaces. The current draft also includes the Mob Slasher and Conveyor Table.

## BLOCKS

### General
- Added **Aetherium Crystal Block**.
    - Stores four Aetherium Crystals and supports four compressed tiers.
- Added **Conveyor Table**.
    - Crafts the Copper, Titanium, and Aetherium conveyor variants and bridge endpoints moved to this table.
    - Crafted from three Copper Ingots, two Redstone, and a Crafting Table; also available through the Assembler.
- Added **End Sand** around rich Aetherium deposits in the End.

### Ores
- **Aetherium Ore**
    - **End**
        - Ordinary mining now yields Aetherium Crystals instead of Shards.
        - Replaced the large square End clusters with smaller, less frequent exposed veins.
        - Added rare buried deposits beneath End Sand, with a chance of an Aetherium Crystal Block at their center.
        - Hammers convert End ore drops into Shards.
    - **Overworld**
        - Increased the frequency of small deposits and added rare larger deposits beneath Crushed Cobbled Deepslate.
- Updated ore textures, palettes, and depth.

### Generators
- **Absolute Battery**
    - Increased transfer rate from 80 kDE/t to 800 kDE/t.
- **Absolute Furnator, Magmator, and Thermo Generator**
    - Updated directional textures and corrected rate descriptions.
- Added **Power Beacons** in five tiers.
    - Receive energy through cables and distribute it wirelessly to compatible machines within range. The transfer rate is shared between receivers, and transmission can be toggled in the interface.
    - **Basic**: 4-block radius, 128 kDE capacity, and 1 kDE/t transfer rate.
    - **Advanced**: 8-block radius, 512 kDE capacity, and 4 kDE/t transfer rate.
    - **Expert**: 12-block radius, 2.048 MDE capacity, and 16 kDE/t transfer rate.
    - **Ultimate**: 24-block radius, 12.8 MDE capacity, and 100 kDE/t transfer rate.
    - **Absolute**: 48-block radius, 1.024 GDE capacity, and 8 MDE/t transfer rate.
    - Each tier has a dedicated model and active textures.

### Machines (Additions)
- Added **Compactor**.
    - Compresses supported nuggets, chunks, pebbles, shards, storage materials, and compressed blocks.
    - Uses 3x3 input and output grids with four upgrade slots.
- Added **Decompactor**.
    - Reverses the supported Compactor recipes through 3x3 input and output grids.
    - Includes four upgrade slots.
- Added **Mob Slasher**.
    - Superior version of the **Mob Grinder**
    - Maximum range of 12.5 blocks and maximum damage of 40 per hit.
    - Supports four modules, each independently enabled or disabled:
        - **Mob Magnet Module** (Mob Magnet): Pulls nearby mobs to the Slasher within its attack radius. Supports whitelist/blacklist filters and a configurable cooldown.
        - **XP Magnet Module** (XP Magnet): Moves nearby XP orbs to a destination configured with X/Y/Z offsets. Only loaded destinations are used; this module does not fill the internal XP storage.
        - **Teleporter Module** (Ender Hopper): Moves nearby dropped items in a selected direction, up to 0.5 blocks per installed Range Upgrade (4 blocks maximum). Setting the distance to zero disables movement.
        - **Storer Module** (XP Condenser): Stores bonus XP from Slasher kills, based on half the vanilla player-kill reward; custom creatures use a maximum-health-based reward. Holds up to 256,000 XP points, which can be withdrawn through the menu. Attacks can pause when the estimated reward will not fit; otherwise, excess XP is discarded.

### Machines (Changes)
- **Enchantment Station**
    - Improved enchantment selection and compatibility handling.
    - Tier V applies all mutually compatible non-curse enchantments at maximum level.
    - Enchanted books can be absorbed with a full XP tank; the display reports stored and discarded XP.
- **Multi Processing**
    - Arc-Press Forge, Centrifugal Siever, Industrial Crucible, and Pulverizer can process additional input slots in the same cycle.
    - Each Multi Processing Upgrade adds a slot; Stack Upgrades increase the amount processed per selected slot.
    - Energy consumption increases with active slots.
- **Residue Processor**
    - Expanded from two to four output slots and added support for three secondary products.
    - Added dead coral, terracotta, string, rooted dirt, and muddy mangrove root recovery recipes.
    - Added a recipe book displaying ingredients, amounts, and chances.
    - Updated extraction and inventory migration for the expanded layout.
- Reorganized machine processing, upgrade, display, and I/O slots.
- Improved selection of available inputs and output-capacity checks in processing machines.

### Transportation

- Added **Universal Cable** for Energy, Fluids, Gases, Items, and Overclock networks.
    - Displays connections independently on each face and uses one block variant.
- Added **Universal Exporter** and **Universal Importer**.
    - Transfer resources between compatible networks, containers, and machines.
    - Use UtilityCraft's shared endpoint behavior and resource configuration.
- Initialized automatic I/O defaults on supported machines.
- Preserved legacy network access for machines without explicit face restrictions.

## ITEMS

### Materials and Storage

- Added **Aetherium Crystal**, **Aetherium Crystal Dust**, and **Aetherium Nugget**.
    - Existing Aetherium Shards remain the smaller crystalline material; four Shards form one Crystal.
    - Metallic Aetherium Dust remains separate from Crystal Dust.
    - Nine Nuggets form one metallic Aetherium Ingot.
- Added **Aetherium Storage Part** and **Aetherium Storage Cell** for Digital Storage.
    - The current cell capacity is 6,553,600 storage units (6,400 KB), sixteen times an Ultimate Cell's capacity.
    - Actual item capacity depends on Digital Storage's accounting and per-type overhead.
- Added **Titanium & Tungsten Dust**, displayed with a **Mixed** subtitle.
- Renamed **Refined Aetherium Shard** to **Refined Aetherium Crystal**.
    - Retained the old item for existing inventories; convert it 1:1 through crafting or the Assembler.

### Machine Upgrades

- Added **Energy Capacity**, **Gas Capacity**, and **Liquid Capacity Upgrades**.
    - Add 50% capacity per Upgrade, up to 5x.
    - Removing them preserves excess stored resources until those resources are consumed.
- Added **Multi Processing Upgrade** for an additional input slot per Upgrade on supported machines.
- Added **Resource Efficiency Upgrade** with a 5% resource-preservation chance per Upgrade, up to 40%.
- These Upgrades use compatible existing upgrade slots and stack up to eight.

### Equipment and Refining

- Added **Minimal** as the default StatsCore feedback mode: only the equipment’s primary ability and Double/Triple Trouble display activation icons; routine damage, passive-stat, and healing messages are hidden.
    - Only equipment level-ups play a feedback sound in this mode. Existing explicit feedback preferences remain available.
- Added a dedicated **Stats** tab to the Refining Table with scrollable statistics, the analyzed equipment slot, and accessible player inventory.
- Added **Blessing**, **Earth**, **Void**, **Water**, and **Wind** elements.
    - Earth is an armor affinity that improves Armor Preserving and its durability recovery.
    - Void overrides attack damage, applies Weakness, and creates a singularity around the target.
    - Wind supports assisted mining and can transform Blazes into Breezes.
- Added **Armored** for Chestplates and **Arrow Volley** for Bows.
- Added selectable **Boot Dash**, **Bunny Jump**, and **None** boot mobility modes.
- Improved refinement inheritance and equipment-category donor selection, including Advanced Runic Core inheritance.
- Updated Darkness, Fire, Frost, Lightning, and Plant behavior and target rules.
- Reduced Berserk's maximum stacks from ten to five; Strength now follows the current stack count.
- Increased Boot Dash launch strength and reduced its cooldown.
- Reduced Double Trouble growth and updated Triple Trouble's additional loot roll.
- Healing Efficiency no longer converts excess healing into Absorption.
- Tool Preserving works during mining, attacks, and item use; Armor Preserving is restricted to hostile damage.
- Updated Wind Launch activation and gave it priority over Boot Dash.
- Improved Aetherium armor knockback handling and Aetherium AIOT enchantment compatibility.

## RECIPES

### Absolute Container

- Replaced the two Netherite Blocks in its recipe with Netherite Ingots.

### Aetherium

- Added Shard-to-Crystal conversion through crafting, pressing, and compacting.
- Crushing two Shards yields one Crystal Dust; one Crystal yields two Crystal Dust.
- Four Crystals form one Crystal Block; crushing it yields eight Crystal Dust.
- Crushing either Aetherium Ore variant yields two Shards.
- Aetherium metal now requires one Netherite Ingot, eight Titanium Dust, eight Tungsten Dust, eight Ender Pearl Dust, 1,600 mB Cryofluid, and either two Crystals or eight Shards in the Catalyst Weaver.
    - Costs 12,000 DE at 0.5x speed.
    - Sixteen Mixed Titanium & Tungsten Dust can replace the separate metal catalysts.
- One Titanium Dust plus one Tungsten Dust produces two Mixed Dust through shapeless crafting, the Assembler, or the Infuser.
- Hyper Processing Upgrades accept either Crystal Dust or metallic Aetherium Dust.
- Added furnace recovery of metallic Aetherium Dust into Ingots.

### Assembler

- Added the AT Workbench crafting catalog and selected crafting-table recipes to automated crafting.
- Corrected the Cryo Chamber recipe to use Ultimate Chips, matching the Workbench and allowing crafting before Aetherium production.

### Bountiful Crops

- Added Tier 3 Titanium and Tungsten Seeds and Tier 5 Aetherium Crystal Seeds.
- Added Tier 5 Pink Soil with 2.5x the Black Soil boost values and Seed Synthesizer integration.

### Catalyst Weaver

- Added Damage, Energy, Filter, Quantity, Range, and Speed Upgrade recipes, each costing 1,600 DE without fluids.
- Added recipes for the five new machine Upgrades and reduced several upgrade recipe costs.
- Improved matching of catalysts spread across slots, alternative recipes, and newly registered recipes.

### Compactor and Decompactor

- Expanded compactable UtilityCraft material coverage and compressed-material chains.
- Added reverse decompression recipes, including crystalline Aetherium storage.

### Cryogenic Machines

- Shared freezing and stabilization recipes across the corresponding Cryo Chamber modules and standalone machines.
- Expanded Titanium and Lapis inputs through compressed block tiers.
- Cryofluid Synthesizer consumes four Titanium points and eight Lapis points per 1,000 mB water-to-Cryofluid cycle, at 6,000 DE.
- Cryo Chamber retains direct item consumption and its own conversion yields.

### Industrial Processing

- Fixed Raw Tungsten Dust furnace processing.
- Improved Industrial Burner bonus outputs and Nether Tungsten processing.
- Added the missing Absolute Drill crafting recipe.

### Power Beacons

- All tiers now use Echo Shards and their corresponding primary material: Gold, Energized Iron, Diamond Dust, Netherite, and Aetherium.
- Basic Power Beacon now uses a Machine Case.

## UI/UX

- Added Liquifier and Residue Processor recipe books.
- Reorganized Catalyst Weaver recipes by material and included the recovery and upgrade recipes.
- Improved scrollable information panels, Refining Table displays, and Enchantment Station pages.
- Prioritized main and grouped input/output options while preserving existing mode identifiers.
- Added fluid-ejection controls to Catalyst Weaver and Liquifier.
- Standardized machine interfaces, upgrade descriptions, tooltip wrapping, and name colors.
- Removed the redundant AT Upgrades section from machine displays.
- Added ability glyphs and Blood, Blessing, Marked, and Void visual/audio feedback.
- Expanded localization entries; corrected Storage Cell tooltips to match the current capacity.

## FLUIDS

- **Liquified Aetherium**
    - Ingots yield 250 mB; metallic Dust yields 150 mB; Crystals yield 100 mB; Crystal Dust yields 50 mB; Shards yield 25 mB each.
    - Refined Crystals are not accepted.
- **Coolants**
    - Cryofluid can be used by compatible Heavy Machinery machines.
    - Saline Coolant can be used by compatible AT machines.
- **Fluid Ejection**
    - Returns whole-bucket quantities as capsules when the fluid supports them.
    - Remaining sub-bucket quantities and unsupported fluids are discarded when the tank is emptied.
- **Liquid Capsules**
    - Can collect multiple connected Water or Lava sources and merge into a compatible destination stack.

## BUG FIXES

- Fixed the missing Conveyor Table crafting route after moving conveyor recipes to that table.
- Restored the disabled Universal Importer and Exporter behaviors in the current working tree.
- Fixed machine displays failing to appear in some inventory states.
- Fixed blocked or conflicting outputs consuming inputs or overwriting output stacks in affected processing machines.
- Fixed Genetic Seed Synthesizer dropping items when its output was full.
- Fixed Duplicator restrictions for mineral blocks, compressed variants, and uncloneable items.
- Fixed enchantment planning, incompatible AIOT enchantments, and enchanted-book handling.
- Fixed the Enchantment Station disenchanting progress texture range.
- Fixed Impact Crusher thermal status and the Hyper Processing recipe book's Titanium ingredient.
- Fixed Hammer ore drop handling, Ore Bonus/Forger duplication cases, and environmental-damage Preserving exploits.
- Fixed lingering Lightning fire and invalid StatsCore effect/feedback state.
- Fixed the Compressed Blocks creative category name and several upgrade-slot positions.

## TECHNICAL CHANGES

- Updated DoriosCore and DoriosLib, including item energy storage, network access compatibility, link-node I/O, multiblock scaling, and container interaction.
- Added shared recipe catalogs, pooled processing, output reservation, rollback helpers, and machine inventory migrations.
- Removed duplicated machine-specific cryogenic recipe catalogs and the obsolete Ascane Engine screen.
- Added cached face connectivity and improved Overclock/network invalidation and scan scheduling.
- Organized StatsCore configuration and expanded element, effect, refinement, and combat handling.
- Added machine face-texture tooling, recipe-book generators, focused runtime tests, and the Mob Slasher source-to-runtime model generator.
- Added preparatory Niobium artwork; this does not introduce a playable Niobium tier.
- Adopted the shared release workflow and aligned release metadata to 0.9.2.

> **Existing worlds:** the refined material identifier changed from `utilitycraft:refined_aetherium_shard` to `utilitycraft:refined_aetherium_crystal`. The old identifier is retained as a compatibility item, with a 1:1 conversion recipe; loading an existing world still requires in-game validation. Final machine persistence, world generation, localization, and StatsCore target-policy tests remain pending in Bedrock.

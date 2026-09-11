# v0.9.2 (Draft)

This update brings the Compactor and Decompactor, Universal transportation blocks, five new StatsCore elements, and a lot of recipe and UI changes. It also fixes several machine issues and centralizes shared recipes so they can be used by more than one machine.

## BLOCKS
### General
- Added **Aetherium Crystal Block**.
    - Stores four Aetherium Crystals and can be converted back into them.
- Added **End Sand**.
    - Covers rich Aetherium deposits in the End.

### Ores
- **Aetherium Ore**
    - In v0.9.1, the End ore appeared in large square clusters. Its common deposits are now smaller, exposed diagonal veins and generate less often.
    - Mining the ore now drops Aetherium Crystals instead of Shards.
    - Added rare and resource-rich deposits buried beneath End Sand.
        - Their inner ore cannot generate exposed to air.
        - The center has a chance to contain an Aetherium Crystal Block.
- **Deepslate Aetherium Ore**
    - Its small deposits are slightly more common than in v0.9.1.
    - Added rare and larger Overworld deposits hidden beneath Crushed Cobbled Deepslate.
        - Only the surrounding crushed stone can be exposed to caves.

### Machines (Additions)
- Added **Compactor**
    - Compresses supported materials using a 3x3 input grid.
    - Supports every compactable UtilityCraft nugget, chunk, pebble, shard, and handful.
    - Has a 3x3 output grid and four upgrade slots.
    - Accepts Speed, Energy, Hyper Processing, and Stack Upgrades.
- Added **Decompactor**
    - Reverses every supported Compactor recipe.
    - Uses a 3x3 input grid and returns the original materials through a 3x3 output grid.
    - Has four upgrade slots.
    - Accepts Speed, Energy, Hyper Processing, and Stack Upgrades.

### Machines (Changes)
- Machine inventories
    - Reorganized processing, upgrade, display, and blocked slots across several machines.
- Multi Processing
    - Arc-Press Forge, Centrifugal Siever, Industrial Crucible, and Pulverizer can now process additional input slots during the same cycle.
    - Each Multi Processing Upgrade adds one slot to the cycle.
    - Stack Upgrades increase the amount processed in each selected slot.
    - Energy use increases with the number of active slots.
- Power Beacons
    - Rebuilt all five tiers with new models and dedicated active textures.
    - Improved energy distribution between nearby machines.
    - Updated their recipes with Echo Shards and materials matching each tier.
    - The Basic tier now uses a Machine Case.
- Superior machines now prioritize available inputs instead of missing ones.

### Transportation
- Added **Universal Cable**
    - Transports Energy, Fluids, Gases, Items, and Overclock through the same network.
    - Acts as a complete and more customizable pipe intended for large builds.
    - Connections are displayed separately for each block face.
    - Does not have multiple color variants.
- Added **Universal Exporter**
    - Exports supported resources from connected containers and machines into the Universal network.
    - Each face can be configured independently.
- Added **Universal Importer**
    - Imports supported resources from the Universal network into connected containers and machines.
    - Each face can be configured independently.

## ITEMS
### Aetherium
- Added **Aetherium Nuggets** for the metallic Aetherium progression.
    - Nine Nuggets form one Aetherium Ingot, and one Ingot can be unpacked into nine Nuggets.
- Added **Aetherium Shards**.
    - Four Aetherium Shards can be combined into one crystal.
    - Used as the starting material for Refined Aetherium Crystals.
- Added **Aetherium Crystal Dust**.
    - Keeps crystal processing separate from metallic Aetherium Dust.
- Added **Aetherium Storage Cell** and **Aetherium Storage Part**.
    - The Storage Cell holds 3,276,800 items, eight times the capacity of an Ultimate Storage Cell.
- Renamed the old **Aetherium Shard** to **Aetherium Crystal**.
- Renamed **Refined Aetherium Shard** to **Refined Aetherium Crystal**.

### Machine Upgrades
- Added **Energy Capacity Upgrade**.
    - Increases a machine's energy capacity by 50% per Upgrade, up to 5×.
- Added **Gas Capacity Upgrade**.
    - Increases a machine's gas capacity by 50% per Upgrade, up to 5×.
- Added **Liquid Capacity Upgrade**.
    - Increases a machine's liquid capacity by 50% per Upgrade, up to 5×.
- Added **Multi Processing Upgrade**.
    - Processes one additional input slot per Upgrade.
- Added **Resource Efficiency Upgrade**.
    - Adds a 5% chance per Upgrade to preserve consumed resources, up to 40%.
- The new Upgrades use existing machine Upgrade slots and can be stacked up to eight.
- Removing a Capacity Upgrade preserves stored resources above the new limit until they are consumed.

## EQUIPMENTS
### Refining
- New Elements
    - Added five new elements:
        - **Blessing**
        - **Earth**
        - **Void**
        - **Water**
        - **Wind**
    - Earth
        - Added an armor-only elemental affinity.
        - Increases Armor Preserving up to a maximum chance of 55%.
        - Repairs 2 durability points when Armor Preserving activates.
    - Void
        - Overrides the original attack damage.
        - Applies Weakness to the target.
        - Creates a 7.5-block singularity around the target.
    - Wind
        - Added Wind-assisted mining behavior.
        - Can transform Blazes into Breezes.
- New Abilities
    - Added **Armored** to Chestplates.
        - Negates Projectile damage.
        - Reduces Explosion damage by 50% and suppresses its knockback.
    - Added **Arrow Volley** to Bows.
        - Has a 20% chance to fire arrows at up to four nearby hostile targets within 8 blocks.
        - Has a 1.5-second cooldown.
    - Added **Bunny Jump** to the Boot mobility options.
        - Performs an additional aerial jump with a small forward impulse.
- Other Additions
    - Added selectable Boot mobility modes:
        - **Boot Dash**
        - **Bunny Jump**
        - **None**
    - Added Blood, Blessing, Marked, and Void particles and sounds.
    - Refinement inheritance
        - Inherited attributes are now selected from valid donor pools for the equipment channel.
        - Advanced Runic Core refinements can inherit additional abilities from the same equipment category.
- Balancing
    - Updated the behavior and target rules of the existing elements:
        - **Darkness**
        - **Fire**
        - **Frost**
        - **Lightning**
        - **Plant**
    - Armor Preserving
        - Maximum chance is now capped at 35% without Earth.
    - Berserk
        - Decreased maximum stacks from 10 to 5.
        - Now grants Strength based on the stack amount.
    - Boot Dash
        - Increased launch strength from 1.35 to 1.5.
        - Decreased cooldown from 3.5 seconds to 2 seconds.
    - Double Trouble
        - Decreased its growth multiplier.
    - Healing Efficiency
        - Now longer converts excess healing in Absorption.
    - Marked
        - Now has a visual mark that appears 2.5 blocks above the target.
        - Improved target tracking and effect cleanup.
    - Preserving
        - Tool Preserving can now activate when mining, attacking creatures, or using the item.
        - Armor Preserving is now limited to hostile damage.
        - Improved durability repair and feedback consistency.
    - Wind Launch
        - Crouching while on the ground launches the player using a Wind Charge.
        - Punching while descending or gliding can also trigger the launch.
        - Now uses an intercepting Wind Charge instead of applying a direct impulse.
        - Has priority over Boot Dash when both could activate.
- Refining Table
    - Increased the size of its Display Panel.
    - Improved refinement state, cost, result, and inherited attribute displays.

## RECIPES
### General
- Machine recipes
    - Outputs are now checked and reserved before inputs are consumed.

### Absolute Container
- Replaced the two Netherite Blocks in its recipe with Netherite Ingots.

### Aetherium
- Four Aetherium Shards now form one Crystal through crafting, pressing, or compacting.
- One Titanium Dust and one Tungsten Dust now form two **Titanium & Tungsten Dust**, shown with the **Mixed** subtitle, through shapeless crafting, the Assembler or the Infuser.
- Two Shards or one Crystal can be crushed into one or two Crystal Dust respectively.
- Four Crystals now form one Crystal Block, which can be crushed into eight Crystal Dust.
- Crushing either Aetherium Ore variant now produces two Aetherium Shards.
- Aetherium Ingots now require one Netherite Ingot as input, eight Titanium Dust, eight Tungsten Dust, eight Ender Pearl Dust, 1,600 mB of Cryofluid, and either eight Aetherium Shards or two Aetherium Crystals in the Catalyst Weaver.
- Added alternative Aetherium Ingot recipes where sixteen mixed Titanium & Tungsten Dust replace the separate Titanium and Tungsten catalysts.
- Hyper Processing Upgrades now accept either Aetherium Crystal Dust or metallic Aetherium Dust.
- Added a smelting recipe that turns Aetherium Dust back into Aetherium Ingots.

### Bountiful Crops
- Added Tier 3 Titanium and Tungsten Seeds.
- Added Tier 5 Aetherium Crystal Seeds.
- Added Tier 5 Pink Soil with 2.5x the Black Soil boost values and support in the Seed Synthesizer.

### Assembler
- Added all Ascendant Technology Workbench recipes to the Assembler.
    - 73 shaped recipes are now registered.
    - The Workbench and Assembler use the same crafting catalog without creating conflicting outputs.

### Catalyst Weaver
- Added recipes for the following Upgrades:
    - **Damage Upgrade**
        - Input: Base Upgrade
        - Catalysts: Iron Sword, Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - **Energy Upgrade**
        - Input: Base Upgrade
        - Catalysts: Diamond Dust, 2x Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - **Filter Upgrade**
        - Input: Base Upgrade
        - Catalysts: Comparator, Hopper, Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - **Quantity Upgrade**
        - Input: Base Upgrade
        - Catalysts: Cyan Dye, Spawner Core, Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - **Range Upgrade**
        - Input: Base Upgrade
        - Catalysts: Blue Dye, Gold Ingot, Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - **Speed Upgrade**
        - Input: Base Upgrade
        - Catalysts: Emerald Dust, Emerald Block, Redstone Block
        - Cost: 1600 DE (1.6 kDE)
    - None of these recipes use Fluids.

### Compactor
- Added recipes for supported storage blocks and compressed-material tiers.
- Expanded the compressed material chains used by the machine.

### Cryogenic Machines
- Freezing recipes
    - Cryo Chamber and Cryo Freezer now use the same recipes.
- Cryofluid generation
    - Cryo Chamber and Cryofluid Synthesizer now use the same generation settings and catalyst list.
- Stabilization recipes
    - Cryo Chamber and Cryo Stabilizer now use the same recipes.
- Existing inputs, outputs, costs, processing times, and temperatures were kept during this change.

### Decompactor
- Added reverse recipes for every supported Compactor recipe.
    - Each compressed input returns its original material through the 3x3 output grid.

### Industrial Burner
- Improved bonus output handling.
- Updated Nether Tungsten processing.

### Power Beacons
- Updated all Power Beacon recipes to use an Echo Shard.
- Each tier now uses its matching primary material:
    - **Basic:** Gold Ingot
    - **Advanced:** Energized Iron Ingot
    - **Expert:** Diamond Dust
    - **Ultimate:** Netherite Ingot
    - **Absolute:** Aetherium Ingot
- The Basic Power Beacon now uses a Machine Case instead of its lower Basic Chip.

## UI/UX
- Removed the AT Upgrades section from machine displays.
- Item and block descriptions now wrap cleanly inside their tooltips.
- Standardized machine descriptions around their accepted Upgrades.
    - Superior machines retain a line identifying their original machine or branch.
- Fixed the Compressed Blocks creative category displaying its translation key instead of its name.
- Added descriptions and distinct name colors for the five new Machine Upgrades.
- Enlarged the Catalyst Weaver I/O panel and replaced **All Inputs** with **All Catalysts**.
- Catalyst Weaver Recipe Book
    - Recipes are now organized by material.
    - Similar materials and related Upgrades are kept close to each other.
    - The hidden Easter Egg recipe remains hidden.
- Compactor
    - Added a new 3x3 machine interface.
- Decompactor
    - Added a new 3x3 machine interface.
- The following interfaces have been updated or standardized:
    - Abyssal Fisher
    - Arc-Press Forge
    - Arcane Enchanter
    - Ascane Engine
    - Catalyst Weaver
    - Centrifugal Siever
    - Cryo Chamber
    - Cryo Freezer
    - Cryo Stabilizer
    - Cryofluid Synthesizer
    - Disenchanter
    - Dual Siever
    - Duplicator
    - Energizer
    - Genetic Seed Synthesizer
    - Impact Crusher
    - Industrial Burner
    - Industrial Crucible
    - Liquifier
    - Network Center
    - Overclock Relay
    - Overclock Tower
    - Pattern Placer
    - Pulverizer
    - Reinforcement Anvil
    - Residue Processor
    - Seismic Breaker
    - Singularity Fabricator
    - Vaporworks Processor
    - Verdant Cultivator
- Updated English and Brazilian Portuguese text for the new blocks, machines, recipes, StatsCore features, and UI entries.

## FLUIDS
- Liquified Aetherium
    - Aetherium Ingots produce 250 mB.
    - Aetherium Dust produces 150 mB.
    - Aetherium Crystals produce 100 mB.
    - Aetherium Crystal Dust produces 50 mB.
    - Aetherium Shards produce 25 mB.
    - Refined Aetherium Crystals can no longer be liquified.
- Coolants
    - Cryofluid can now be used by compatible Heavy Machinery machines.
    - Saline Coolant can now be used by compatible Ascendant Technology machines.
- Liquid Capsules
    - Can now collect multiple connected Water or Lava source blocks at once.
    - Collected Capsules now merge with a compatible stack in the destination slot when possible.

## BUG FIXES
- Fixed the Absolute Container recipe.
- Fixed the Absolute Drill recipe being missing.
- Fixed Aetherium AIOT receiving incompatible enchantments.
- Fixed Aetherium Armor Knockback Resistance not affecting every source of damage-induced knockback.
- Fixed the Catalyst Weaver Recipe Book missing the Amethyst Dust recovery recipe and all six new Upgrade recipes.
- Fixed Catalyst Weaver, Compactor, and Pulverizer displays not appearing in some inventory states.
- Fixed Duplicator accepting blocked mineral and compressed-material outputs.
- Fixed Duplicator cloneable tag validation.
- Fixed enchanting a Book returning an unusable item.
- Fixed Enchantment Station planning and enchantment application edge cases.
- Fixed Genetic Seed Synthesizer dropping its items when its output was full.
- Fixed the Hyper Processing Upgrade Recipe Book entry displaying the wrong Titanium material.
- Fixed Impact Crusher thermal status not displaying correctly.
- Fixed Industrial Burner bonus outputs and Nether Tungsten processing.
- Fixed Lightning leaving unintended fire after its effect ended.
- Fixed resource-processing machines not having a fourth slot for Stack Upgrades.
- Fixed Stack Upgrade slots being placed after machine I/O slots instead of alongside the other Upgrades.
- Fixed machine outputs being consumed or overwritten when there was not enough output space.
- Fixed recipe registration not loading every configured recipe.
- Fixed Refining Table inheritance and display information getting out of sync.
- Fixed StatsCore feedback remaining active after its source or target became invalid.

## TECHNICAL CHANGES
### Core Utilities
- Updated DoriosLib to version 2.1.0.
    - Synchronized the library with UtilityCraft and improved machine-button responsiveness.
- Added shared output reservation for multi-output machines.
    - Machines now calculate available capacity before consuming inputs.
    - Partial and conflicting stacks are handled before a process completes.
- Improved machine upgrade detection and inventory-state caching.
- Improved shared machine status rendering and display refresh behavior.

### Machine Runtime
- Added native runtime registration for the Compactor and Decompactor.
    - Includes blocks, recipes, machine scripts, interfaces, item catalog integration, and localization.
- Added reusable recipe catalogs:
    - `crafter.js` for Workbench and Assembler crafting recipes.
    - `cryogen.js` for Cryofluid generation.
    - `decompactor.js` for reverse Compactor recipes.
    - `freezing.js` for freezing recipes.
    - `stabilizer.js` for stabilization recipes.
- Removed the duplicated machine-specific Cryogenic recipe files.
    - Cryo Chamber, Cryo Freezer, Cryo Stabilizer, and Cryofluid Synthesizer now read from the shared catalogs when their feature is available.
- Added shared runtime helpers for pooled inputs, pooled outputs, shared-cycle slot processing, and output reservation.

### Networks and Overclock
- Added cached per-face connection data for Universal and Reinforced transportation blocks.
- Improved network invalidation and update scheduling.
    - Placement and break events now avoid requesting duplicate rescans.
- Improved network scan batching to reduce repeated work in dense networks.
- Reorganized transportation blocks and assets into dedicated Conveyor and Duct folders.

### Resource Pack
- Added Compactor and Decompactor interfaces and registrations.
- Added Universal Cable, Universal Exporter, and Universal Importer:
    - Block models
    - Geometry
    - Textures
    - Recipes
    - Localization
- Added a F5 glyph atlas with unique icons for StatsCore and machine displays.
- Added new particles:
    - Blood
    - Blessing Burst
    - Marked
    - Void Singularity
- Added new StatsCore sounds:
    - Blessing
    - Blessing Curse
    - Void Singularity
- Converted the Compactor atlas into named per-face textures.
    - Compactor and Decompactor now use the same directional texture set.
- Updated UI definitions for the expanded machine interface set.

### StatsCore
- Added native state, effects, commands, refinement, and inheritance handling for Blessing, Earth, Void, Water, and Wind.
- Updated the element runtime and target rules for Darkness, Fire, Frost, Lightning, and Plant.
- Added gameplay behavior to admin-applied effects instead of only updating their HUD state.
- Changed `/sc:refine_element` to use the shared refinement and feedback flow.
- Improved channel-specific donor pools for inherited attributes.
- Improved damage resolution, entity categorization, runtime cleanup, and event-driven effect processing.
- Improved effect feedback defaults and invalid target cleanup.
- Updated StatsCore and Refining Table documentation for the new elements, effects, and refinement behavior.

### Release Tooling
- Added a Decompactor recipe audit tool.
- Added a tool for splitting Compactor atlas textures into directional faces.
- Updated project dependencies, build metadata, feature status documentation, localization documentation, and the Machine Roadmap.

> Note: Element target policy still needs final validation. This changelog will remain a Draft until that validation is finished.

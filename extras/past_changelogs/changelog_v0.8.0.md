# v0.8.0 (Prerelease)

This prerelease consolidates all changes from the `v0.8.0-alpha` build notes (Builds 3 to 7) into a single patch note focused on machines, transport progression, fluid/gas systems, and gameplay stability.

## BLOCKS
### Generators
- Absolute Wind Turbine
  - Decreased altitude modifier by 43%.

### Machines
- Added Enchantment Station
  - Repairs, enchants, reinforces, and disenchants gear in a shared workflow.
  - Uses XP-based progression and dedicated module support.
- Added Vaporworks Processor
  - Generates Steam from water using energy and fuel.
- Cloner
  - ETA is now affected by Overclock boost.
- Catalyst Weaver
  - Decreased energy capacity from 256 MDE to 128 MDE.
  - Increased operation speed from 180 DE/t to 6.4 kDE/t.
- Duplicator
  - Added Dynamic Rate.
  - Doubled base energy cost per operation.
  - Rebalanced rarity-based cost/time scaling.
  - Increased operation speed from 400 DE/t to 800 DE/t.
  - No longer duplicates Shulker Boxes.
- Enchantment Station
  - Decreased energy capacity from 128 MDE to 25.6 MDE.
  - Increased minimum operation cost from 8 kDE to 64 kDE.
  - Increased timing requirements across core operations.
  - Updated enchantment progression by level.
  - Improved ETA behavior and reinforcement/disenchant consistency.
- Mob Magnet
  - Expanded range upgrade tiers from 12 to 16 levels (0 to 15).

### Ores
- Aetherium
  - End: 
    - Increased max ore count from 3 to 7.
    - Increased generation frequency by 2.5x.
  - Overworld:
    - Increased spawn rate significantly.
    - Increased vertical generation range from -59..-54 to -61..-54.
- Titanium
  - Decreased vein size from 8 to 5 ores.
  - Reduced spawn rate by ~80%.

### Overclock
- Overclock Relay now supplies Overclock Tower if the tower has no own power source.
- Overclock now boosts additional machine stats:
  - Energy capacity
  - Energy input rate
  - Fluid capacity
> [!NOTE]
> They still cannot overclock base machines, unfortunately. However, that won't be need with 0.9.0

### Transportation
- Added Conveyor Belts (Copper, Titanium, Aetherium)
  - Normal Conveyors:
    - Tiers: Copper, Titanium, Aetherium.
    - Speed: 1 block/sec, 2 blocks/sec, 5 blocks/sec, respectively.
    - Variants: Horizontal, Vertical, Ascending/Inclined, Descending/Declined.
    - Vertical conveyors can be toggled between upward and downward flow using the Wrench, and their models flip to match direction.
    - Conveyor networks now persist and rebuild automatically when reloading a world.
    - Aetherium conveyors now transport creatures standing on them.
    > Note: Aetherium conveyors only forward items when stacks reach 64 to cut down on loose entities.
  - Bridge Conveyors:
    - Operating Mode:
      - Uses a transmitter/receiver system to create a temporary teleportation link between two points, allowing items to bypass gaps and terrain. Automatically builds a translucent path to guide item trajectories.
    - Properties:
      - Tiers: Copper, Titanium, Aetherium.
      - Speed: Infinite. (Teleport)
      - Range: 8 blocks, 16 blocks, 32 blocks, respectively.
      - Variants: Horizontal only (for now).
    > Note:
    > - Bridge conveyors are designed for long-distance item transport and can be used to create efficient item routes that bypass obstacles. However, they require careful setup and alignment to function properly, and they will not work if the path is obstructed.
    > - Bridge path guides are translucent and non-colliding for quick alignment. Paths blocked by any obstruction will warn the player.
    > - Bridge paths now clear small environmental blocks (plants, torches, snow layers) and render per tier for easier management.
    > - Bridge conveyors now have their own textures and models.
  - Special Conveyors:
    - Junction
      - Allows conveyor lines to cross without merging or rerouting, preserving straight-through flow.
    - Overflow Conveyor
      - Sends items forward first; if blocked, alternates side outputs for overflow routing.
    - Router
      - Teleports items to a random output and delays direction changes slightly.
    - Smart Router
      - Routes items based on per-item assignments set via the Smart Router UI.
    - Underflow Conveyor
      - Prioritizes side outputs, using the front only when sides are unavailable.
- Added Inverted Sorter
  - Filtered items are diverted to side outputs; other items continue forward.
- Added Sorter
  - Filtered items move forward; other items are diverted to side outputs.
- Conveyor Router now locks to one output for a short cycle and rotates direction every 10 ticks.
- Sorter blocks now include per-block filter setup and quick filter clear while sneaking.
- Removed Conveyor Network Updater block.
  - Conveyor networks now update automatically every 80 ticks.

## ITEMS
### General
- Added Aetherium Dust, Titanium Dust, and Titanium Plate.
- Added localized Materials and Resources item group.

### Capsules
- Added Capsules for Water, Lava, Steam and XP
  - Max of 8 buckets each.
  - Water and Lava capsules can be used to collect and place fluid blocks on the world. (from sea or a lava pool, for example.)
- Added Infinite Capsules
  - Supported Fluids: Cryofluid, Dark Matter, Lava, Liquified Aetherium, Milk, Steam, Water, XP 

### Modules
- Added Enchantment Station module line:
  - **Curse Protection Module:** Reduces the chance of curses during enchanting.
    - Higher tiers provide stronger protection.
  - **Enchantability Module:** Unlocks enchanting in the Ascane Engine.
    - **Tier I:** Enables enchanting; max level 1.
    - **Tier II:** Max level 2.
    - **Tier III:** Max level 3; includes mid-tier enchantments (e.g., Knockback, Frost Walker).
    - **Tier IV:** Max level 4.
    - **Tier V:** Max level 5; includes low-max enchantments (e.g., Mending, Infinity).
  - **Reinforcement Module:** Enables armor reinforcement in the Ascane Engine.
    - Higher tiers grant more durability points.
- Curse Protection Module now completely nullifies curse chance.

### Tools
- Aetherium and Titanium swords no longer break blocks in creative mode.
- Aetherium AIOT can now be enchanted with sword enchantments.
  - It's not recommended to enchant it normally. Either use the Enchantment Station or an Anvil.
- AIOTs can now break honeycomb blocks and bamboo.

## MOBS
### General
- Disabled natural Enderling family spawn during alpha stabilization.

## RECIPES
### General
- Added sieve drops for compressed variants.
- Updated Cryofluid recipe requirements.

### Machines
- Added recipes for conveyor variants and bridge components across all tiers.
- Added Mob Magnet recipe.
- Updated machine crafting progression recipes:
  - Cryo Chamber now uses Titanium Block and Packed Ice in the core recipe.
  - Enchantment Station and Vaporworks Processor recipes were added.
  - Singularity Fabricator ingredient progression was adjusted for better late-game flow.
- Added Enchantment Station module recipes:
  - Enchantability I–V
  - Reinforcement I–III
  - Curse Protection
  
### Catalyst Weaver
- Added Void Essence recipe using Empty Bottle, Crushed Endstone, and Dark Matter.

### Cryo Chamber
- Snow and Water to Ice now takes less time and energy.
- Ice to Packed Ice now takes more time.
- Packed Ice to Blue Ice now takes much more time.

### Residue Processor
- Added Podzol processing into Bone Meal with a chance for Rotten Flesh.
- Added Rotten Flesh processing into Leather with a chance for Bone Meal.
- Removed the old recipe that generated Void Essence.

## UI/UX
- Expanded localization coverage from 3 to 8 languages.
- Added and improved localization coverage for Smart Router, Sorters, Mob Magnet, and Laser Barrier feedback.
- Added missing item-group and machine-related localization keys.
- Replaced hardcoded Cryo Chamber title with localized mapping.
- Restored Cryo Chamber classic UI variant.
- Improved Cryo Chamber slot mapping and panel behavior.
- Improved machine panel textures and UI consistency.
- Improved Enchantment Station tab behavior and diagnostics display.

## FLUIDS
- Cryofluid is now recognized as a Heavy Machinery coolant with high efficiency.
- Updated fluid display units to bucket-based scaling (`mB → B → KB → MB → GB → TB → PB`).
- Steam capsule registration/handling was aligned with fluid-container behavior.

## GASES
- Added Gas system foundation (separate from fluids).
- Added Steam as the first implemented gas.

## BUG FIXES
- Fixed Mob Magnet text rendering issues. [#36](https://github.com/DoriosStudios/Ascendant-Technology/issues/36)
- Fixed Mob Magnet pull behavior edge cases after state updates. [#37](https://github.com/DoriosStudios/Ascendant-Technology/issues/37)
- Fixed Aetherium and Titanium hammers not applying hammer recipes correctly. [#39](https://github.com/DoriosStudios/Ascendant-Technology/issues/39)
- Fixed Aetherium and Titanium ore drop failures on drill/command breaks. [#40](https://github.com/DoriosStudios/Ascendant-Technology/issues/40)
- Fixed Laser Barrier orphan blocks after size-upgrade changes.
- Fixed Laser Barrier environmental block clearing and orientation behavior.
- Fixed Aetherium conveyors not moving mobs unless items were present.
- Fixed inclined conveyor side-detection behavior.
- Fixed special conveyor stalling behavior.
- Fixed compressed block drop routes for Aetherium/Titanium outputs. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Duplicator singularity recipe startup import failure.
- Fixed Energizer producing outputs above max stack size. [#8](https://github.com/doriosstudios/ascendant-technology/issues/8)
- Fixed machine network connectivity with energy cable behavior. [#38](https://github.com/DoriosStudios/Ascendant-Technology/issues/38)
- Fixed Reinforced Cable energy conduction behavior. [#15](https://github.com/doriosstudios/ascendant-technology/issues/15)
- Fixed Singularity Fabricator Dark Matter acceptance and progression timing issues. [#13](https://github.com/doriosstudios/ascendant-technology/issues/13) [#4](https://github.com/doriosstudios/ascendant-technology/issues/4)
- Fixed Vaporworks tank routing and transfer snapshot consistency after gas migration.

## TECHNICAL CHANGES
### Documentation
- Added Overclock network documentation.
- Expanded machine capability/recipe documentation.

### Core Utilities
- Added metadata-aware machine item handling and insertion support.
- Expanded command/util formatting helpers.
- Expanded drop-system behavior (`dropMode`, `xpMode`, replacement swap paths).
- Added centralized drop particle catalog exports.
- Extended Dorios Excavate bridge integration behavior.

### Entities
- Ported and updated Enderling family entities/projectiles and client assets.
- Updated entity schema compatibility and combat behavior presentation.
- Updated Enderling model/animation baseline integration.

### HUD & UI Assets
- Added/updated fluid and steam HUD item-bar support.
- Added missing nine-slice/cell texture definitions and slot variants.
- Improved slot surface options and panel texture behavior.

### Overclock & Energy Network
- Updated tower charge gating behavior for relay/cable transfer.
- Added additional machine stat boosts under Overclock.
- Added debug ScriptEvent support for energy network tracing.

### Runtime Registration
- Refactored machine-local defaults into structured config channels.
- Added `machine.config` payload support in machine definitions.
- Updated Enchantment Station slot/runtime consistency.
- Improved machine spawn/runtime registration and startup stability.
- Improved Mob Magnet runtime safety and range display mapping.

### World Generation
- Shortened ore feature and feature-rule identifiers/files using `ae`/`tt` aliases while preserving generation behavior.

### Performance & Stability
- Removed legacy/unused gas config internals in favor of fluid-aligned registration paths.
- Optimized pipe-network BFS traversal behavior.
- Reduced repeated dynamic-property parsing overhead in fluid-node lookups.

Contributors: @Kauziin , @jrice-88
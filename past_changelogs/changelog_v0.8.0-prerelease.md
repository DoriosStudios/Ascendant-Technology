# v0.8.0 (Prerelease)

This prerelease consolidates all changes from `v0.8.0-alpha` (Builds 3 to 6) into a single patch note, with full progression details for machines, conveyors, modules, fluids/gases, and stability fixes.

## BLOCKS
### Generators
- Absolute Wind Turbine
  - Decreased altitude modifier by 43%.

### Machines
- Added Enchantment Station
  - Repairs, enchants, and reinforces gear in a shared 3x3 grid.
  - Module slots control enchantment boosts, reinforcement targets, and curse protection.
  - Uses XP for enchanting.
  - Reworked disenchant flow to `1 source / 1 catalyst / 7 output`.
  - Reworked internals to a strict 27-slot layout (`0` through `26`).
- Added Vaporworks Processor
  - New machine that generates Steam from water using energy and a fuel source.
  - Can use either Gas Tubes or Fluid Conduits for input and output.
- Cloner
  - ETA is now affected by Overclock boost.
- Catalyst Weaver
  - Decreased energy capacity from 256 MDE to 128 MDE.
  - Increased operation speed from 180 DE/t to 6.4 kDE/t.
- Duplicator
  - Added Dynamic Rate.
  - Doubled base energy cost per operation.
  - Energy cost and ETA now scale with item/block rarity:
    - Common: 1x Cost, 1x Time
    - Uncommon: 2x Cost, 1.75x Time
    - Rare: 3.5x Cost, 3.5x Time
    - Epic: 5x Cost, 6x Time
    - Legendary: 10x Cost, 8.25x Time
    - Mythic: 15x Cost, 10x Time
    - Transcendent: 25x Cost, 12.5x Time
  - Increased operation speed from 400 DE/t to 800 DE/t.
  - No longer can duplicate Shulker Boxes, as they are now containers with special handling.
- Enchantment Station
  - Decreased energy capacity from 128 MDE to 25.6 MDE.
  - Increased minimum operation cost from 8 kDE to 64 kDE.
  - Increased time requirements for repair, reinforcement, and enchant progression steps.
  - ETA now uses real per-operation processing speed for better HUD accuracy.
  - Max Reinforcement value is now shown right after the Current Reinforcement value.
  - Rebalanced energy scaling across core operations:
    - Enchant changes now scale more aggressively with operation complexity.
    - Reinforcement and curse-protection operations now have higher energy scaling.
    - Disenchant extraction now costs significantly more per enchantment removed.
  - Reinforcement now correctly applies durability increases to armor and tools/weapons.
  - Changed which enchantments are applied by level.
- Mob Magnet
  - Expanded range upgrade tiers from 12 to 16 levels (now supporting levels 0 to 15).

### Ores
- Aetherium Ore (End)
  - Increased generation frequency by 2.5x.
- Aetherium
  - End: Increased max ore count from 3 to 7.
  - Overworld:
    - Increased spawn rate significantly.
    - Increased vertical generation range from -59..-54 to -61..-54.
- Titanium
  - Decreased vein size from 8 to 5 ores.
  - Spawn rate reduced by ~80%.

### Overclock
- Overclock Relay
  - Now supplies Overclock Tower if it doesn't have its own power source.
- Network
  - Overclock now boosts more machine stats, including:
    - Energy capacity
    - Energy input rate
    - Fluid capacity
> Note: If an overclocked machine loses its overclock (for example, the Overclock Tower is removed), boosted values remain until they naturally return to normal limits.

### Transportation
- Added Conveyor Belts (Copper, Titanium, Aetherium)
  - Normal Conveyors:
    - Tiers: Copper, Titanium, Aetherium.
    - Speed: 1 block/sec, 2 blocks/sec, 5 blocks/sec, respectively.
    - Variants: Horizontal, Vertical, Ascending/Inclined, Descending/Declined.
    - Vertical conveyors can be toggled between upward and downward flow using the Wrench, and their models flip to match direction.
    - Conveyor networks now persist and rebuild automatically when reloading a world.
    - Aetherium conveyors now transport creatures standing on them.
    > Note: Aetherium conveyors only forward items when stacks reach 64 to reduce loose entities.
  - Bridge Conveyors:
    - Operating mode:
      - Uses a transmitter/receiver system to create a temporary teleportation link between two points, allowing items to bypass gaps and terrain. A translucent path is generated to guide item trajectories.
    - Properties:
      - Tiers: Copper, Titanium, Aetherium.
      - Speed: Infinite (Teleport).
      - Range: 8 blocks, 16 blocks, 32 blocks, respectively.
      - Variants: Horizontal only (for now).
    > Note:
    > - Bridge conveyors are designed for long-distance item transport and can bypass obstacles, but require careful setup and alignment.
    > - Bridges do not connect across different tiers; transmitter and receiver must be the same tier.
    > - Bridge path guides are translucent and non-colliding for quick alignment.
    > - Path guides now clear small environmental blocks (plants, torches, snow layers).
    > - Bridge conveyors now have dedicated textures and models.
  - Special Conveyors:
    - Junction
      - Allows conveyor lines to cross without merging or rerouting.
    - Overflow Conveyor
      - Sends items forward first; if blocked, alternates side outputs.
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
- Removed Conveyor Network Updater block and script.
  - Conveyor networks now automatically update every 80 ticks without a dedicated block.

## ITEMS
### Capsules
- Added Infinite Capsules:
  - Vanilla fluids: Water, Lava, Milk, XP.
- Added finite vanilla fluid capsules:
  - Water, Lava, and Liquid XP (tiers from 1 to 8 buckets).
- Added fluid capsule behavior for world interaction:
  - Place fluid in empty spaces.
  - Pick up matching source blocks (up to capsule limits).
  - Fill steam from Vaporworks Processor outputs.
- Milk capsules are now infinite-only and cannot pick up milk from the world.

### Modules
- Added Ascane Engine / Enchantment Station modules:
  - **Curse Protection Module:** Reduces curse chance during enchanting.
    - Higher tiers provide stronger protection.
  - **Enchantability Module:** Unlocks enchanting in the Ascane Engine.
    - **Tier I:** Enables enchanting; max level 1.
    - **Tier II:** Max level 2.
    - **Tier III:** Max level 3; includes mid-tier enchantments (for example, Knockback, Frost Walker).
    - **Tier IV:** Max level 4.
    - **Tier V:** Max level 5; includes low-max enchantments (for example, Mending, Infinity).
  - **Reinforcement Module:** Enables armor reinforcement in the Ascane Engine.
    - Higher tiers grant more durability points.
- Curse Protection Module
  - Now completely nullifies the chance of curses.
- Added Upgrade Package
  - Stores upgrades for mass application to machines.
  - Can be used on conveyors and other state machines, such as Mob Magnets, Mob Grinders, and Ender Hoppers.
  - Absorbs upgrade items from inventory when used in the air, shows stored counts in lore, and applies upgrades across connected upgradable blocks or conveyor networks via context menu.

### Tools
- Aetherium and Titanium swords no longer break blocks in creative mode.
- Aetherium AIOT can now be enchanted with sword enchantments.
- AIOTs can now break honeycomb blocks and bamboo.

### General
- Added new resource items:
  - Aetherium Dust
  - Titanium Dust
  - Titanium Plate
- Added Enderling Tear and Pure Enderling Tear.
- Added a localized Materials and Resources item group for Ascendant Technology.
- Updated textures for Enchantment Modules (all levels), Reinforcement Modules (all levels), Enderling Tear, Pure Enderling Tear, and Void Essence.

## MOBS
### General
- Disabled natural Enderling family spawn.
> [!NOTE]
> Enderlings remain available in creative mode while behavior and animation quality is being stabilized.

## RECIPES
### General
- Added sieve drops for compressed variants.
- Changed Cryofluid recipe:
  - Now requires Titanium alongside 8 Lapis Lazuli OR 16 Lapis Lazuli Dust per 1000 mB of water processed.

### Machines
- Added recipes for Conveyors, Inclined Conveyors, and Bridge Transmitters/Receivers across all three tiers.
- Added Mob Magnet recipe using Lodestone, Redstone, and Lapis Lazuli.
- Updated machine crafting progression recipes:
  - Cryo Chamber now uses Titanium Block and Packed Ice in the core recipe.
  - Enchantment Station and Vaporworks Processor recipes were added.
  - Singularity Fabricator ingredient progression was adjusted for better late-game flow.
- Added Enchantment Station module recipes:
  - Enchantability Module (Levels 1 to 5)
  - Reinforcement Module (Levels 1 to 3)

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
- Expanded localization coverage from 3 to 8 languages (`en_US`, `pt_BR`, `es_MX`, `fr_FR`, `de_DE`, `ru_RU`, `ja_JP`, `zh_CN`).
- Reviewed and aligned translation parity across existing languages.
- Updated Mob Magnet and Smart Router placeholders to JSON-style `%` variables for dynamic value rendering.
- Added Smart Router localization coverage (menu text, assignment actions, and status feedback).
- Added Sorter Conveyor localization coverage (mode/filter labels, set/clear actions, and close button).
- Localized Generator transfer mode text and Laser Barrier upgrade feedback.
- Added missing bridge obstruction feedback key and Enchantment Station entity name mapping in non-English locales.
- Added missing Mob Magnet localization entries for new settings buttons and filter mode variants.
- Added missing item-group localization entries for Conveyors and Mob Grinding.
- Replaced hardcoded Cryo Chamber freezer title with localized key mapping.
- Aligned Cryo Chamber UI slot bindings with script indices, including explicit hidden guide-slot reservation (`25`) and stabilizer input slot naming (`3`).
- Restored Cryo Chamber classic UI.
- Improved machine panel textures/backgrounds and interface consistency.
- Adjusted Enchantment Station tab toggles to avoid forced per-open reset and allow binding-driven restore.
- Enchantment Station status panel now shows diagnostics (power/XP, readiness, active ETA, blocker summary, and corrective hints).
- Added a `Main/Dis` toggle to switch visibility between Enchantment Station top panels.

## FLUIDS
- Cryofluid
  - Is now recognized as a coolant for Heavy Machinery machines.
  - Coolant efficiency: 175%.
- Updated fluid display units to bucket-based scaling: `mB → B → KB → MB → GB → TB → PB` (decimal scaling).
- Steam capsules are now registered directly in the fluid container registry.
- Empty liquid capsules can now be filled with steam through the same fluid output mapping used by other fluids.
- Steam display mapping now uses the fluid bar renderer.

## GASES
- Added the Gas element system (separate from fluids), with gas capsules and gas networks.
  - Gases are generated, stored, and transported with dedicated mechanics.
- Added Steam
  - First implemented gas in the system.
  - Generated by the Vaporworks Processor.
  - Can be transported using Gas Tubes or Fluid Conduits.

## BUG FIXES
- Fixed Mob Magnet text rendering issues. [#36](https://github.com/DoriosStudios/Ascendant-Technology/issues/36)
- Fixed Mob Magnet not pulling mobs in some cases after state updates. [#37](https://github.com/DoriosStudios/Ascendant-Technology/issues/37)
- Fixed Aetherium and Titanium hammers not applying hammer recipes correctly. [#39](https://github.com/DoriosStudios/Ascendant-Technology/issues/39)
- Added missing hammer metadata parity with UtilityCraft for Titanium and Aetherium hammers.
- Fixed Aetherium and Titanium ores dropping nothing when mined by drills or command breaks. [#40](https://github.com/DoriosStudios/Ascendant-Technology/issues/40)
- Fixed Aetherium conveyors not moving mobs unless items were present.
- Fixed inclined conveyors detecting items too far to the sides.
- Fixed Compressed Crushed Cobbled Deepslate not yielding Titanium and Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Compressed Crushed Endstone not yielding Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Duplicator startup import failure by stabilizing singularity recipe loading at runtime.
- Fixed Energizer producing outputs above maximum stack size. [#8](https://github.com/doriosstudios/ascendant-technology/issues/8)
- Fixed machine network connectivity so machines reliably connect to energy cables and networks. [#38](https://github.com/DoriosStudios/Ascendant-Technology/issues/38)
- Fixed Reinforced Cable not conducting electricity. [#15](https://github.com/doriosstudios/ascendant-technology/issues/15)
- Fixed special conveyors stalling items (Router, Junction, Overflow, Underflow).
- Fixed Singularity Fabricator not accepting Dark Matter. [#13](https://github.com/doriosstudios/ascendant-technology/issues/13)
- Fixed Singularity Fabricator taking an impossible amount of time to craft Singularity items. [#4](https://github.com/doriosstudios/ascendant-technology/issues/4)
- Fixed Vaporworks internal tank routing and transfer flow after gas migration.
- Fixed Laser Barrier orphan blocks, environment clearing, and orientation edge cases.

## TECHNICAL CHANGES
### Documentation
- Added Overclock Boost Network documentation.
- Expanded machine documentation (recipes and capabilities).

### Core Utilities
- Added global metadata-aware machine item handling utilities.
- Upgraded shared item insertion logic for metadata-aware stacking/capture flows.
- Improved time/format helpers and numeric scaling utilities.
- Extended command helpers and block-lookup APIs.
- Added centralized drop particle catalog exports.
- Updated drop system with `dropMode`, broader tool matching, and non-cancel replacement swaps.
- Added drop system XP delivery control with `xpMode`.
- Added and extended Dorios Excavate bridge support (`dorios:blockLoot`, `dorios:hammerBlock`) and fallback logic.

### Entities
- Ported Enderling family (Snareling, Watchling, Blastling, Endersent) from reference content.
- Updated entity and projectile schemas for newer format compatibility.
- Normalized `type_family` usage and ranged-attack priorities.
- Improved projectile behavior, visuals, and combat presentation.
- Added Enderling client assets (textures, spawn-egg icons, and sound definitions).

### HUD & UI Assets
- Added/updated fluid and steam HUD bar assets and mappings.
- Added missing nine-slice definitions and cell texture JSONs.
- Extended slot-surface variants for panel/cell rendering.
- Aligned Cryo Chamber UI slot bindings with runtime indices.

### Overclock & Energy Network
- Tower charging now uses `dorios:oc_energy_need` gating behavior.
- Overclock boosts expanded for additional machine stats and machine-specific properties.
- Added `utilitycraft:debug_energy` ScriptEvent toggle for energy network debug tracing.

### Runtime Registration
- Refactored machine-local defaults into `config` objects.
- Enchantment Station now supports runtime override channels via `settings.machine.station` and `settings.machine.config.station`.
- Added `machine.config` payload support in machine block definitions.
- Migrated runtime imports from legacy `AscendantMachinery/core.js` to `DoriosCore` exports.
- Moved deprecated Tabs Test Machine assets out of production bootstrap.
- Fixed Enchantment Station slot mapping collisions with XP fluid-bar rendering.
- Updated Enchantment Station processing layout to strict `0` through `26` slots.
- Improved machine spawn/runtime registration stability and startup behavior.
- Improved Mob Magnet runtime safety and range display mapping.

### World Generation
- Shortened ore feature and feature-rule identifiers/files using `ae`/`tt` aliases while preserving generation behavior.

### Performance & Stability
- Removed standalone gas config loading in favor of fluid-aligned capsule registration.
- Removed legacy dead gas objective/whitelist internals.
- Optimized pipe-network BFS traversal (queue index walk instead of repeated `shift()`).
- Reduced repeated dynamic-property `JSON.parse` overhead in fluid-node lookups.
- Updated Duplicator fluid runtime to consume fixed `16B` on craft finalization.
- Reworked capsule world-use flow to `itemUse` + `getBlockFromViewDirection` with stable `afterEvents` mutation.

# v0.8.0 (Prerelease)

Consolidated prerelease notes for **Alpha Builds 4 through 8**, including machine balance updates, transport/content expansion, Mob Magnet progression updates, and the latest runtime/worldgen adjustments.

## v0.8.0 Alpha Build 8 (Current)

## BLOCKS
### Machines
- Laser Barrier
  - Energy cycle cost is now tied to Energy Upgrade level.
  - Damage hitbox checks were refined for more consistent collision behavior.
- Vaporworks Processor
  - Updated fluid-machine registration path for more reliable runtime initialization.

## RECIPES
### Catalyst Weaver
- Updated Void Essence recipe input from Water Bottle to Glass Bottle.

## TECHNICAL CHANGES
### Runtime Registration
- Added fluid-machine fallback event handling during machine entity spawn.
- Added support path for fluid-special machine event families.

### World Generation
- Shortened ore feature and feature-rule identifiers/files using `ae` (Aetherium) and `tt` (Titanium) aliases while preserving generation behavior.

### Items
- Renamed internal module item definition files to shorter aliases (no player-facing behavior change).

---

## v0.8.0 Alpha Build 7

## BLOCKS
### Mob Grinding
- Mob Magnet
  - Increased max range radius from 22 to 32 blocks.
  - Updated textures and render method.

## ITEMS
### Armor
- Aetherium Armor can now be repaired.

### Meshes
- Aetherium Mesh
  - Increased amount multiplier from 1.5 to 2.
  - Increased chance multiplier from 6 to 10.

### Nets
- Aetherium Net
  - Increased luck from 4 to 15.
  - Increased catching speed multiplier from 6 to 8.
- Lucky Net
  - Increased luck from 10 to 30.
- Titanium Net
  - Increased luck from 2 to 6.

## RECIPES
- Added recipes for every Enchantment Station module.
- Added recipe for the Mob Magnet.

## BUG FIXES
- Fixed a critical issue where Item Exporters could pull UI-only machine items.
- Fixed Aetherium Armor not being resistant to fire/lava.

---

## v0.8.0 Alpha Build 6

## BLOCKS
### Generators
- Absolute Wind Turbine
  - Decreased altitude modifier by 43%.
> [!NOTE]
> This change was made because this generator was simply the best version, surpassing event active generators while being a passive generator. The player now needs to go ~2.8 blocks high instead of ~1.5 blocks to gain +10% efficiency, which is a more meaningful difference and makes the generator less of a no-brainer in many cases.

### Machines
- Enchantment Station
  - Changed which enchantments are applied by level. These changes are documented in docs/machines/enchantment_station.md.
- Mob Magnet
  - Expanded range upgrade tiers from 12 to 16 levels (now supporting levels 0 to 15).

### Transportation
- Added Inverted Sorter
  - Filtered items are diverted to side outputs; other items continue forward.
- Added Sorter
  - Filtered items move forward; other items are diverted to side outputs.
- Bridge Conveyors (All)
  - Path guides now clear small environmental blocks (plants, torches, snow layers) during projection setup.
  - Now have their own textures and models.

## ITEMS
### Tools
- Aetherium and Titanium Swords no longer break blocks in creative mode.
- Aetherium AIOT can now be enchanted with sword enchantments.
  - Due to Mojang's behavior limitations, it can also receive extra enchantments not recommended for Enchanting Table usage.
- AIOTs can now break honeycomb blocks and bamboo.
- Fluid Capsules
  - Added Capsules for Water, Lava and XP.
  - Fluid Capsules can now place world fluids and pick up source blocks, similar to buckets. They can also be filled with steam from the Vaporworks Processor.
  - Milk capsules are now infinite-only and cannot pick up milk from the world.

## MOBS
### General
- Disabled the Enderling family spawn.
> [!NOTE]
> These mobs remain available in creative mode, but are temporarily disabled in natural spawning while behavior/animation quality is being improved.

## RECIPES
### Machines
- Added recipes for Conveyors, Inclined Conveyors, and Bridge Transmitters/Receivers across all three tiers (Copper, Titanium, Aetherium).
- Added Mob Magnet recipe using Lodestone, Redstone, and Lapis Lazuli.
- Updated machine crafting progression recipes:
  - Cryo Chamber now uses Titanium Block and Packed Ice in the core recipe.
  - Enchantment Station and Vaporworks Processor recipes were added.
  - Singularity Fabricator ingredient progression was adjusted for better late-game flow.
- Added Enchantment Station module recipes:
  - Enchantability Module (Levels 1 to 5)
  - Reinforcement Module (Levels 1 to 3)

## UI/UX
- Updated Mob Magnet and Smart Router placeholders to JSON-style `%` variables so dynamic values render correctly in all supported languages.
- Added Smart Router localization coverage (menu text, assignment actions, and status feedback) across all supported languages.
- Added Sorter Conveyor localization coverage (mode/filter labels, set/clear actions, and close button) across all supported languages.
- Localized Generator transfer mode selection text and Laser Barrier upgrade feedback across all supported languages.
- Added missing bridge obstruction feedback key and Enchantment Station entity name mapping in non-English locales to prevent raw key text.
- Added missing Mob Magnet localization entries for new settings buttons and filter mode variants.
- Added missing item-group localization entries for Conveyors and Mob Grinding.
- Replaced hardcoded Cryo Chamber freezer title text with a localized key mapping.
- Aligned Cryo Chamber UI slot bindings with script indices, including explicit hidden guide-slot reservation (`25`) and clearer stabilizer input slot naming (`3`).

## BUG FIXES
- Fixed Mob Magnet text rendering issues. [#36](https://github.com/DoriosStudios/Ascendant-Technology/issues/36)
- Fixed Mob Magnet not pulling mobs in some cases after state updates. [#37](https://github.com/DoriosStudios/Ascendant-Technology/issues/37)
- Fixed Aetherium and Titanium hammers not applying hammer recipes correctly. [#39](https://github.com/DoriosStudios/Ascendant-Technology/issues/39)
- Fixed Aetherium and Titanium ores dropping nothing when mined by drills or command breaks. [#40](https://github.com/DoriosStudios/Ascendant-Technology/issues/40)

## TECHNICAL CHANGES
### Core Utilities
- Added global metadata-aware machine item handling utilities (name, lore, enchantments, durability, lock mode, keep-on-death, and dynamic properties).
- Upgraded shared item insertion logic to support metadata-aware stacking/capture flows.
- Added centralized drop particle catalog exports for drop system usage.
- Extended Dorios Excavate bridge vanilla-drop handling with additional regeneration mode support.

### Runtime Registration
- Refactored machine-local defaults into local `config` objects for the new machine helper pipeline.
- Enchantment Station now supports runtime override channels via `settings.machine.station` and `settings.machine.config.station`.
- Added `machine.config` payload support in machine block definitions to align runtime configuration channels.
- Migrated Insight injector runtime imports to `DoriosCore` exports and removed obsolete legacy runtime dependencies.
- Moved deprecated Tabs Test Machine assets out of production runtime bootstrap.
- Improved Mob Magnet runtime safety for cross-API entity validation and clarified range display as 1-based levels in settings UI.

---

## v0.8.0 Alpha Build 5

## BLOCKS
### Transportation
- Added Conveyor Sorter.
  - Filtered items move forward; other items are diverted to side outputs.
- Added Conveyor Inverted Sorter.
  - Filtered items are diverted to side outputs; other items continue forward.
- Conveyor Router now locks to one output for a short cycle and rotates direction every 10 ticks.
- Sorter blocks now include per-block filter setup and quick filter clear while sneaking.

## ITEMS
### General
- Added new resource items:
  - Aetherium Dust
  - Titanium Dust
  - Titanium Plate
- Added a new Materials and Resources item group for Ascendant Technology with localized names across supported languages.
- Updated textures for:
  - Enchantment Module (all levels)
  - Enderling Tear
  - Pure Enderling Tear
  - Reinforcement Module (all levels)
  - Void Essence

## RECIPES
### Transportation
- Added crafting recipes for conveyor variants in all three tiers (Copper, Titanium, Aetherium):
  - Horizontal Conveyor
  - Vertical Conveyor
  - Inclined Conveyor
  - Declined Conveyor
  - Bridge Transmitter
  - Bridge Receiver

### Catalyst Weaver
- Added a new recipe for Void Essence. It uses an Empty Bottle, Crushed Endstone, and Dark Matter.

### Residue Processor
- Added a new recipe: Podzol now processes into Bone Meal with a chance for Rotten Flesh.
- Added Rotten Flesh processing into Leather with a chance for Bone Meal.
- Removed the old recipe that generated Void Essence.

## UI/UX
- Restored Cryo Chamber classic UI.

## FLUIDS
- Added finite vanilla fluid capsules for Water, Lava, and Liquid XP (tiers from 1 to 8 buckets).
- Milk capsule support is now infinite-only.
- Water and Lava capsules now interact with world fluid blocks like buckets:
  - Place fluid on empty spaces.
  - Collect matching source blocks into capsules (up to 8 buckets).

## BUG FIXES
- Laser Barrier no longer leaves behind orphan blocks when size upgrades are removed.
- Laser Barrier now properly clears light environment blocks (e.g., vegetation, snow) before projecting the wall, allowing it to form fully in natural terrain.
- Fixed Laser Barrier orientation so that North/South placement projects the wall in the same direction as the machine front, while East/West behavior remains unchanged.

## TECHNICAL CHANGES
- Normalized Titanium and Aetherium tool JSON schemas to `format_version` `1.21.90`.
- Restored legacy hammer custom components (`utilitycraft:hammer` and `utilitycraft:dig_pebble`) for runtime compatibility with existing scripts.
- Added/standardized `minecraft:repairable` entries for Titanium and Aetherium tool families and enforced `minecraft:can_destroy_in_creative: false` for swords.
- Updated Duplicator fluid runtime behavior: progress can now charge before the full fluid requirement is available, and craft finalization now consumes a fixed `16B` per operation (no rarity/speed scaling).
- Reworked capsule world-use flow for bucket parity: targeting now uses `itemUse` + `getBlockFromViewDirection` (including liquid blocks), fluid placement writes to the adjacent block space from the clicked face (with player-view fallback when face metadata is unavailable), and world/inventory mutation runs in `afterEvents` for stable transforms.

---

## v0.8.0 Alpha Build 4

## BLOCKS
### Machines
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
  - Increased time requirements for repair, reinforcement, and enchant progression steps, making full-item processing meaningfully longer.
  - ETA now uses real per-operation processing speed, improving second-by-second accuracy in the machine HUD.
  - Max Reinforcement value is now shown right after the Current Reinforcement value.
  - Rebalanced energy scaling across core operations:
    - Enchant changes now scale much more aggressively with operation complexity.
    - Reinforcement and curse-protection operations now have higher energy scaling.
    - Disenchant extraction now costs significantly more per enchantment removed.
  - Reinforcement now correctly applies durability increases to armor and tools/weapons, and it now consumes reinforcement points based on the amount of durability restored.

### Ores
- Aetherium
  - End
    - Increased max ore count from 3 to 7.
  - Overworld
    - Increased spawn rate significantly.
    - Increased vertical generation range from -59..-54 to -61..-54.
- Titanium
  - Decreased vein size from 8 to 5 ores.
  - Spawn rate reduced by ~80%.

### Transportation
- Removed Conveyor Network Updater block and script.
  - Conveyor networks now automatically update every 80 ticks without needing a dedicated block.

## ITEMS
- Curse Protection Module
  - Now completely nullifies the chance of curses.

## FLUIDS
### General
- Steam capsules are now registered directly in the fluid container registry.
- Empty liquid capsules can now be filled with steam through the same fluid output mapping used by other fluids.
- Steam display mapping now uses the fluid bar renderer, keeping HUD behavior consistent with other liquids.

## RECIPES
### Cryo Chamber
- Snow and Water to Ice now takes way less time and energy.
- Ice to Packed Ice now takes more time.
- Packed Ice to Blue Ice now takes way more time.

## BUG FIXES
- Fixed Vaporworks internal tank routing after gas migration so input and output use independent fluid tank slots.
- Fixed Vaporworks transfer flow to avoid stale node refresh loops and to keep pulls/pushes on the same fluid network snapshot during each transfer cycle.

## TECHNICAL CHANGES
- Removed standalone gas config loading in favor of fluid-only capsule registration.
- Removed legacy dead gas objective/whitelist internals from the core runtime.
- Optimized pipe-network BFS traversal by replacing queue `shift()` iteration with index-based queue walking.
- Reduced repeated dynamic-property `JSON.parse` calls for Vaporworks fluid-node lookups.

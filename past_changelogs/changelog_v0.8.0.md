# v0.8.0 Draft

Stability and correctness updates for the Overclock system, improved machine upgrade consistency (notably the Cryo Chamber), and clearer fluid units. This release also includes network and cable fixes, recipe integrations, documentation updates, and a number of bug fixes.

## BLOCKS
### Machines
- Added Ascane Engine
  - Repairs, enchants, and reinforces gear in a shared 3x3 grid.
  - Module slots control enchantment boosts, reinforcement targets, and curse protection.
  - Uses XP for enchanting.
  - Reworked disenchant flow to `1 source / 1 catalyst / 7 output`.
  - Each extracted enchantment is moved into its own enchanted book and consumes 1 Refined Aetherium Shard catalyst.
  - Removed legacy disenchant toggles and kept the machine within a 27-slot layout (`0` to `26`).
  - Updated player-facing name to **Enchantment Station** (internal IDs remain unchanged for world compatibility).
- Added Vaporworks Processor
  - New machine that generates Steam from water using energy and a fuel source.
  - Can use either Gas Tubes or Fluid Conduits for input and output.
- Cloner
  - ETA is now affected by Overclock boost.

### Ores
- Aetherium Ore (End)
  - Increased generation frequency by 2.5x.

### Overclock
- Overclock Relay
  - Now supplies Overclock Tower if it doesn't have its own power source.
- Network
  - Overclock now boosts more elements of a machine, including:
    - Energy capacity
    - Energy input rate
    - Fluid capacity
> Note: If an overclocked machine loses its overclock (e.g., the Overclock Tower is removed), its boosted capacity values will remain until they revert to the normal maximum. 

### Transportation
- Added Gas Tube
  - Pipe block intended for routing gas alongside existing fluid networks.
- Added Conveyor Network Updater
  - Automatically rebuilds adjacent conveyor network caches every 80 ticks.
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
    > - Bridge conveyors are designed for long-distance item transport and can be used to create efficient item routes that bypass obstacles. However, they require careful setup and alignment to function properly, and they will not work if the path is obstructed. Bridges do not connect to different tiers, similar to normal conveyors, so a transmitter and receiver must be the same tier to link successfully.  
    > - Bridge path guides are translucent and non-colliding for quick alignment. Paths blocked by any obstruction will warn the player.
    > - Bridge paths now clear small environmental blocks (plants, torches, snow layers) and render per tier for easier management.
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

## ITEMS
### Capsules
- Added Infinite Capsules:
  - Vanilla fluids: Water, Lava, Milk, XP.
- Added New Fluid Capsules:
  - Vanilla fluids: Water, Lava, Milk, XP.
  - Ascendant Technology fluid: Steam.
### Modules
- Added Ascane Engine Modules:
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
- Added Upgrade Package:
  - Stores upgrades for mass application to machines. Can be used on conveyors and other state machines, such as Mob Magnets, Mob Grinders and Ender Hoppers.
  - Now absorbs upgrade items from your inventory when used in the air, shows stored counts in the lore, and applies upgrades across connected upgradable blocks or conveyor networks via a context menu.

### Misc
- Added Enderling Tear and Pure Enderling Tear.
  - New Enderling drop materials reserved for future Interdimensional Gem crafting.

## RECIPES
- Added sieve drops for compressed variants.
- Changed Cryofluid recipe
  - You must now use Titanium alongside 8 Lapis Lazuli OR 16 Lapis Lazuli Dust per 1000 mB of water processed. This change was made to make the recipe more expensive and to give more use to Lapis, which is currently underused in the addon.
## UI/UX
- Expanded localization coverage from 3 to 8 languages (`en_US`, `pt_BR`, `es_MX`, `fr_FR`, `de_DE`, `ru_RU`, `ja_JP`, `zh_CN`).
- Reviewed and aligned translation formatting/parity across existing languages (`en_US`, `pt_BR`, `es_MX`), including capsule formatting and missing UI/block entries.
- Updated Mob Magnet and Smart Router value placeholders to JSON-style `%` variables so dynamic text renders correctly in all supported languages.
- Added Smart Router localization coverage (menu text, assignment actions, and status messages) across all supported languages.
- Added localization coverage for Sorter Conveyor UI/actions (mode, filter labels, set/clear actions, and close button) across all supported languages.
- Localized Generator transfer mode selection text and Laser Barrier upgrade feedback messages across all supported languages.
- Added missing bridge obstruction message and Enchantment Station entity name mapping in non-English locales to prevent raw key text in UI and labels.
- Replaced hardcoded Cryo Chamber freezer title text with localized key mapping.
- Fixed panel textures and background sizing for new panels.
- Moved Mob Magnet filter controls into the main settings panel and stabilized filter mode labels.
- Added missing Mob Magnet localization coverage for the new settings buttons and filter mode variants across all supported languages.
- Added missing item-group localization entries for Conveyors and Mob Grinding to avoid raw key text in category labels.
- Updated Cryo Chamber UI layout and improved several machine panels.
- Updated machine UI accents to match the refreshed texture set.
- Updated Mob Magnet settings to use button-based controls with inline value subtitles.
- Updated toggle button states to render with panel-based surfaces (normal, hover, and locked) for more consistent UI styling.
- Adjusted Enchantment Station tab toggles to avoid forced per-open state reset, allowing binding-driven tab state restore when available.
- Enchantment Station status panel now shows diagnostic helpers (power/XP, disenchant readiness, active task ETA, blocker summary, and corrective hints).
- Added a simple `Main/Dis` toggle to switch visibility between Enchantment Station top panels.

## FLUIDS
- Cryofluid
  - It is now recgnonized as a coolant for Heavy Machinery machines.
    - It has an efficiency of 175% as a coolant, making it the best coolant in the game at the moment.
- Updated fluid display units to use bucket-based scaling: `mB → B → KB → MB → GB → TB → PB` (decimal scaling).

## GASES
- Added the Gas element system (separate from fluids) with gas capsules and gas networks.
  - Gases are a new type of substance that can be generated, stored, and transported using dedicated mechanics. They will be used in future machines and recipes. They'll also have a block form that will flow high in the world, but they won't have fluid dynamics or flow like fluids.
- Added Steam
  - This is the first gas implemented in the system, and it will be used in future machines and recipes. It can be generated by the Vaporworks Processor, using either Gas Tubes or Fluid Conduits as transports.

## BUG FIXES
- Fixed Aetherium and Titanium hammers not applying hammer recipes correctly. [#39](https://github.com/DoriosStudios/Ascendant-Technology/issues/39)
- Added missing hammer metadata parity with UtilityCraft for Titanium and Aetherium hammers (repair entries and tier-equivalent tags).
- Fixed Aetherium and Titanium ores dropping nothing when mined by drills or command breaks. [#40](https://github.com/DoriosStudios/Ascendant-Technology/issues/40)
- Fixed Aetherium conveyors not moving mobs unless items were present.
- Fixed inclined conveyors detecting items too far to the sides.
- Fixed Compressed Crushed Cobbled Deepslate not yielding Titanium and Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Compressed Crushed Endstone not yielding Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Duplicator startup import failure by stabilizing singularity recipe loading at runtime.
- Fixed Energizer producing more items than the maximum stack size for energized outputs. [#8](https://github.com/doriosstudios/ascendant-technology/issues/8)
- Fixed machine network connectivity so machines reliably connect to energy cables and networks. [#38](https://github.com/DoriosStudios/Ascendant-Technology/issues/38)
- Fixed Mob Magnet text rendering issues. [#36](https://github.com/DoriosStudios/Ascendant-Technology/issues/36)
- Fixed Mob Magnet not pulling mobs in some cases after state updates. [#37](https://github.com/DoriosStudios/Ascendant-Technology/issues/37)
- Fixed Reinforced Cable not conducting electricity. [#15](https://github.com/doriosstudios/ascendant-technology/issues/15)
- Fixed special conveyors (Router, Junction, Overflow, Underflow) stalling items; they now teleport to valid outputs, and Underflow only injects into side containers before forwarding.
- Fixed Singularity Fabricator not accepting Dark Matter. [#13](https://github.com/doriosstudios/ascendant-technology/issues/13)
- Fixed Singularity Fabricator taking an impossible amount of time to craft Singularity items. [#4](https://github.com/doriosstudios/ascendant-technology/issues/4)

## TECHNICAL CHANGES
### Documentation
- Added Overclock Boost Network documentation.
- Expanded machine documentation (recipes and capabilities).

### Core Utilities
- Improved time/format helpers, numeric scaling, and fluid/energy parsing utilities.
- Extended command helpers and block-lookup APIs used across scripts.
- Added global item metadata utilities to machine helpers, including capture/apply flows for name tag, lore, can-place/can-destroy lists, enchantments, durability, lock mode, keep-on-death, and supported dynamic properties.
- Upgraded global `addItemsToSlot` to support metadata-aware insertion/stacking with optional source-stack capture.
- Updated the drop system to support `dropMode` (replace/supplement/vanilla) and broader tool tag matching.
- Added non-cancel replacement support via `originalDropId` → `replaceDropId` for intrusive drop swaps that preserve vanilla break effects.
- Added drop system XP delivery control (`xpMode`) with player, orb, auto, or disabled modes.
- Added a centralized drop particle catalog in `BP/scripts/drops/particle_catalog.js` and exposed it through `drops.js` for easier reference and autocomplete (`DROPS_PARTICLES`).
- Added a Dorios Excavate compatibility bridge that listens for `dorios:blockLoot` and `dorios:hammerBlock` ScriptEvents, using loot-table fallback when custom drops are not defined.
- Extended Excavate bridge vanilla-drop handling with `excavateBridge.vanillaDropMode`, including a third mode (`break_then_regen_loot_table`) that breaks the block via command, intercepts newly spawned vanilla item entities, and regenerates output from `LootTableManager`.
- Updated Titanium-related drops to use non-cancel swap logic for hammer and smelting-pickaxe outcomes, keeping break effects while replacing the raw drops.
- Excavate bridge now favors swap-based drops first and falls back to `setblock ... destroy` when loot-table access is disabled.

### Entities
- Ported the Enderling family (Snareling, Watchling, Blastling, Endersent) from End Expansion references.
  - Updated identifiers to `utilitycraft:*`, refreshed format versions, and added spawn rules + loot tables.
- Updated Enderling entity and projectile components to current schemas.
  - Aligned `minecraft:hurt_when_wet`, `minecraft:shooter`, `minecraft:spawn_entity`, and projectile field naming for newer format validation.
- Normalized Enderling `type_family` tags and added missing ranged-attack priorities.
  - Snareling and Blastling now use canonical lowercase families and explicit `minecraft:behavior.ranged_attack` priorities for more consistent projectile combat behavior.
- Fixed Enderling projectile runtime behavior and combat presentation.
  - Snareling web now triggers an impact event that applies an AoE root-like slow field (`slowness` 255 in radius) instead of only direct-hit damage.
  - Blastling ammo now correctly triggers its splash explosion event on impact with non-griefing settings.
  - Snareling/Blastling ranged attack sounds are now mapped to custom projectile shot SFX.
  - Enderling client entities now keep the `mad` animation active whenever they are angry, including while stationary.
- Refined Enderling combat follow-up and projectile presentation.
  - Watchling melee now keeps target tracking after the first hit (reduced stop stalls + enabled attack tracking).
  - Blastling projectile explosion power was reduced from `1.5` to `1.0` for a tighter blast radius.
  - Projectile visuals now use an improved dart-like model inspired by End Expansion reference assets.
  - Enderling client entities now also trigger `mad` during active attacks via `query.is_delayed_attacking`.
- Added Enderling client assets (textures, spawn-egg icons, and sound definitions) from the End Expansion reference pack.
- Reworked Enderling creature baselines using Ender Awakening v1.0.3.3 references (aggressive remap profile).
  - `utilitycraft:blastling` now uses the Ender Awakening blastling calm/angry state machine and goo-style projectile profile (`utilitycraft:blastling_ammo`).
  - `utilitycraft:watchling` now uses the Ender Awakening watchling aggression flow (calm → angry) with attack-driven client animation.
  - `utilitycraft:snareling` and `utilitycraft:endersent` retained the original Ascendant Technology baselines (no Ender Awakening counterparts).
  - RP models/animations for Blastling and Watchling were replaced with Ender Awakening-derived rigs and animation sets while preserving `utilitycraft:*` identifiers; Snareling and Endersent remain on original rigs/animations.

### HUD & UI Assets
- HUD and lore fluid display now uses bucket-based units: `mB → B → KB → MB → GB → TB → PB` (decimal scaling).
- Steam UI bar items now use dedicated `at_steam_bar_00` → `at_steam_bar_48` frames in `RP/textures/items/ui/steam_bar`.
- Added missing nine-slice definitions for colored panel textures.
- Added nine-slice JSON definitions for all cell textures (`{color}_cell_image.json`), enabling proper scaling and rendering.
- Extended `ascendant_common.slot_base` with panel-style slot surfaces, allowing dark/custom-colored slots with configurable texture and alpha.
- Added fixed-image slot variants for all 16 colors (`slot_white`, `slot_light_gray`, `slot_gray`, `slot_black`, `slot_brown`, `slot_red`, `slot_orange`, `slot_yellow`, `slot_lime`, `slot_green`, `slot_cyan`, `slot_light_blue`, `slot_blue`, `slot_purple`, `slot_magenta`, `slot_pink`) plus `slot_dark`, mapping directly to cell textures for parameter-free slot styling.
- Aligned Cryo Chamber UI slot bindings with runtime script indices, including explicit hidden guide-slot reservation (`25`) and clearer stabilizer input slot naming (`3`).

### Overclock & Energy Network
- Tower charging is now gated by the TOWER_NEED_PROP constant (`dorios:oc_energy_need`); overclock relays and reinforced cables only push charge when the recipient's stored energy is below the declared need.
  - This also fixes reinforced cable energy conduction.
- Overclock now boosts additional machine stats:
  - Energy capacity
  - Energy input rate
  - Fluid capacity
  - Unique properties depending on the machine
- Added `utilitycraft:debug_energy` ScriptEvent toggle to enable energy network debug logs (including `updatePipes` and rescan traces).

### Runtime Registration
- Refactored machine-local defaults into local `config` objects (instead of `*_DEFAULT` naming) for the new machine helper pipeline.
- Enchantment Station now uses a top-level `config` object and accepts overrides via `settings.machine.station` and `settings.machine.config.station`.
- Added `machine.config` payloads in machine block JSONs (`duplicator` and `enchantment_station`) to align script/runtime configuration channels.
- Migrated Insight injector runtime imports from legacy `AscendantMachinery/core.js` to `DoriosCore` exports and removed the obsolete legacy core file.
- Moved deprecated Tabs Test Machine assets to `references/AT Deprecated` and removed runtime bootstrap import to keep production registration clean.
- Fixed Enchantment Station slot mapping collision between disenchant processing and XP fluid-bar rendering.
  - XP tank tracking is now shown in status HUD text so disenchant outputs remain exclusive.
  - Disenchant source slot in the UI is now aligned with machine logic.
- Reworked Enchantment Station internals to fit a strict 27-slot inventory layout.
  - Updated script, block container metadata, and UI indices to remain within slots `0` through `26`.
  - Disenchant processing now uses one source slot, one catalyst slot, and seven dedicated output slots.
- Fixed Ascane Engine enchantment cycling so it only applies missing enchantments.
- Fixed Ascane Engine repeatedly re-applying enchantments when nothing changed, which could keep it running.
- Fixed Ascane Engine XP tracking so it no longer occupies disenchant output slots.
- Machine spawns now honor `entity.identifier` from machine definitions; Cryo Chamber is the first machine explicitly migrated.
- Removed the UtilityCraft-only `fluid_container` script from the expansion pack.
- Mob Magnet now validates entities safely across API variants and defaults to a stronger baseline pull cadence (0-tick cooldown option available by default).
- Mob Magnet range level display in the settings menu is now shown as 1-based levels for clearer player-facing values.
- Fixed Vaporworks Processor tanks sometimes initializing incorrectly.
- Fixed Vaporworks Processor failing to load in some cases.
- Normalized Vaporworks Processor crafting recipe key descriptors to object form to prevent load-time unknown ingredient parsing.
- Fixed a generator destruction crash caused by a duplicate `gas` declaration in `BP/scripts/machinery/AscendantMachinery/core.js`.
- Fixed startup errors caused by duplicate custom component registrations (`utilitycraft:thermo_generator`, `utilitycraft:solar_panel`, `utilitycraft:fluid_container`) in the expansion pack.


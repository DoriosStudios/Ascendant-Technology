# v0.8.0 Draft

Stability and correctness updates for the Overclock system, improved machine upgrade consistency (notably the Cryo Chamber), and clearer fluid units. This release also includes network and cable fixes, recipe integrations, documentation updates, and a number of bug fixes.

## BLOCKS
### Machines
- Added Ascane Engine
  - Repairs, enchants, and reinforces gear in a shared 3x3 grid.
  - Module slots control enchantment boosts, reinforcement targets, and curse protection.
  - Enchantment upgrades now cap by module tier.
  - Reinforcement is now stored as durability points and consumed on damage before armor durability is reduced.
  - Lower-tier modules now cap low-level enchantments.
  - Enchant changes now take about 2 seconds each.
  - Uses XP to power enchanting.
  - Added a dedicated disenchant slot to strip enchantments from items.
- Cloner
  - ETA is now affected by Overclock boost.

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

## ITEMS
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
### Misc
- Added Enderling Tear and Pure Enderling Tear.
  - New Enderling drop materials reserved for future Interdimensional Gem crafting.
### Capsules
- Added Infinite Capsules:
  - Vanilla fluids: Water, Lava, Milk, XP.
- Added Fluid Capsules:
  - Vanilla fluids: Water, Lava, Milk, XP.
  - Ascendant Technology fluids: Steam, Liquified Aetherium, Dark Matter, Cryo Fluid.

## RECIPES
- Added missing infuser and coolant recipes used by several machines and the Overclock Tower.
- Added sieve and compressed-ore recipe integrations for compressed materials.

## UI/UX
- Refined Cryo Chamber UI layout and improved several machine panels.
- Added Ascane Engine UI with centered 3x3 grid, module column, upgrade slots, and a disenchant slot.
- Updated Vaporworks Processor UI to match the Overclock Relay layout, with clearer bars and controls.
- Added Steam UI fluid bar visuals (00–48).
- Added optional container labels on machine panels.
- Adjusted Ascane Engine slot ordering so input slots are prioritized for quick moves.
- Fixed Ascane Engine 3x3 grid slots so the dark slot skin renders.
- Fixed panel textures and background sizing for new panels.
- Fixed the Absolute Container status toggle button and restored the status panel backdrop.
- Updated machine UI accents to match the refreshed texture set.
- Adjusted slot background sizing and refreshed dark slot visuals across slot panels.
- Updated Mob Magnet settings to use button-based controls with inline value subtitles.
- Fixed Mob Magnet value placeholders so subtitles render correctly in all languages.
- Moved Mob Magnet filter controls into the main settings panel and stabilized filter mode labels.

## FLUIDS
- Added the Gas element system (separate from fluids) with gas capsules and gas networks.
- Steam now behaves as a gas, and Vaporworks outputs gas accordingly.

## BUG FIXES
- Fixed Cloner missing fluid consumption on recipes that require fluid.
- Fixed Compressed Crushed Cobbled Deepslate not yielding Titanium and Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Compressed Crushed Endstone not yielding Aetherium. [#2](https://github.com/doriosstudios/ascendant-technology/issues/2)
- Fixed Energizer producing more items than the maximum stack size for energized outputs. [#8](https://github.com/doriosstudios/ascendant-technology/issues/8)
- Fixed Aetherium and Titanium hammers not applying hammer recipes correctly. [#39](https://github.com/DoriosStudios/Ascendant-Technology/issues/39)
- Fixed Aetherium and Titanium ores dropping nothing when mined by drills or command breaks. [#40](https://github.com/DoriosStudios/Ascendant-Technology/issues/40)
- Fixed Liquid Capsule transfers between machines and tanks so capsules correctly insert and extract fluids.
- Fixed Mob Magnet not pulling mobs in some cases after state updates.
- Fixed machine network connectivity so machines reliably connect to energy cables and networks.
- Fixed UtilityCraft energy cable visuals not refreshing when machines are placed or removed.
- Fixed Reinforced Cable not conducting electricity. [#15](https://github.com/doriosstudios/ascendant-technology/issues/15)
- Fixed Singularity Fabricator not accepting Dark Matter. [#13](https://github.com/doriosstudios/ascendant-technology/issues/13)
- Fixed Singularity Fabricator taking an impossible amount of time to craft Singularity items. [#4](https://github.com/doriosstudios/ascendant-technology/issues/4)

## TECHNICAL CHANGES
### Documentation
- Added Overclock Boost Network documentation.
- Expanded machine documentation (recipes and capabilities).

### Core Utilities
- Improved time/format helpers, numeric scaling, and fluid/energy parsing utilities.
- Extended command helpers and block-lookup APIs used across scripts.
- Updated the drop system to support `dropMode` (replace/supplement/vanilla) and broader tool tag matching.
- Added non-cancel replacement support via `originalDropId` → `replaceDropId` for intrusive drop swaps that preserve vanilla break effects.
- Added drop system XP delivery control (`xpMode`) with player, orb, auto, or disabled modes.
- Added a Dorios Excavate compatibility bridge that listens for `dorios:blockLoot` and `dorios:hammerBlock` ScriptEvents, using loot-table fallback when custom drops are not defined.
- Updated Titanium-related drops to use non-cancel swap logic for hammer and smelting-pickaxe outcomes, keeping break effects while replacing the raw drops.
- Excavate bridge now favors swap-based drops first and falls back to `setblock ... destroy` when loot-table access is disabled.

### Entities
- Ported the Enderling family (Snareling, Watchling, Blastling, Endersent) from End Expansion references.
  - Updated identifiers to `utilitycraft:*`, refreshed format versions, and added spawn rules + loot tables.
- Updated Enderling entity and projectile components to current schemas.
  - Aligned `minecraft:hurt_when_wet`, `minecraft:shooter`, `minecraft:spawn_entity`, and projectile field naming for newer format validation.
- Added Enderling client assets (textures, spawn-egg icons, and sound definitions) from the End Expansion reference pack.

### HUD & UI Assets
- HUD and lore fluid display now uses bucket-based units: `mB → B → KB → MB → GB → TB → PB` (decimal scaling).
- Steam UI bar items now use dedicated `at_steam_bar_00` → `at_steam_bar_48` frames in `RP/textures/items/ui/steam_bar`.
- Added missing nine-slice definitions for colored panel textures.

### Overclock & Energy Network
- Tower charging is now gated by the TOWER_NEED_PROP constant (`dorios:oc_energy_need`); overclock relays and reinforced cables only push charge when the recipient's stored energy is below the declared need.
  - This also fixes reinforced cable energy conduction.
- Added `utilitycraft:debug_energy` ScriptEvent toggle to enable energy network debug logs (including `updatePipes` and rescan traces).

### Runtime Registration
- Fixed Ascane Engine enchantment cycling so it only applies missing enchantments.
- Fixed Ascane Engine repeatedly re-applying enchantments when nothing changed, which could keep it running.
- Fixed Ascane Engine XP tank display so the fluid bar renders in the UI.
- Machine spawns now honor `entity.identifier` from machine definitions; Cryo Chamber is the first machine explicitly migrated.
- Removed the UtilityCraft-only `fluid_container` script from the expansion pack.
- Fixed Vaporworks Processor tanks sometimes initializing incorrectly.
- Fixed Vaporworks Processor failing to load in some cases.
- Fixed a generator destruction crash caused by a duplicate `gas` declaration in `BP/scripts/machinery/AscendantMachinery/core.js`.
- Fixed startup errors caused by duplicate custom component registrations (`utilitycraft:thermo_generator`, `utilitycraft:solar_panel`, `utilitycraft:fluid_container`) in the expansion pack.


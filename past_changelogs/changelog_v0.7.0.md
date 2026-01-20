Version 0.7.0 introduces the Overclock network, Smart Importer logistics, and a full Aetherium/Titanium equipment tier alongside new storage blocks, plus a revamped custom drop pipeline and expanded DoriosAPI core utilities.

## BLOCKS
### General
- Added Aetherium Block
- Added Raw Titanium Block
- Added Titanium Block
- The drop system has been updated to support new material blocks.

### Generators
- Absolute Battery
    - Increased base output rate from 800 kDE/t to 8 MDE/t.
### Machines
- Catalyst Weaver
    - Added support for Smart Filter upgrade.
    - Increased energy capacity from 2.05 MDE to 256 MDE.
    - Increased upgrade slots from 2 to 3.
    - Reduced fluid capacity from 256,000 mB to 128,000 mB.
- Cryo Chamber
    - Added support for Smart Filter upgrade.
    - Increased energy capacity from 12.8 MDE to 128 MDE.
- Duplicator
    - Added support for Smart Filter upgrade.
    - Increased base processing speed from 80 DE/t to 400 DE/t.
    - Increased energy capacity from 32.7 MDE to 512 MDE.
- Energizer
    - Added support for Smart Filter upgrade.
    - Increased energy capacity from 25.6 MDE to 256 MDE.
- Liquifier
    - Added support for Smart Filter upgrade.
- Residue Processor
    - Added support for Smart Filter upgrade.
    - Increased energy capacity from 720 kDE to 12.8 MDE.
- Singularity Fabricator
    - Decreased minimum time per craft from 12h to 1h.
    - Increased base processing speed from 80 DE/t to 2.56 MDE/t.
    - Increased energy capacity from 65.5 MDE to 1 GDE.
    - Increased minimum cost per craft from 1 GDE to 1.1 TDE.
    - Now uses dynamic scaling for cost based on `rate_speed_base`.
- Removed Synthesis Crucible
> Not added, not finished, and not used.

### Ores
- Aetherium Ore
    - Deepslate:
        - Increased max fortune yield multiplier from 0.4x to 0.5x per level.
    - End:
        - Increased max fortune yield multiplier from 0.6x to 0.75x per level.
- Titanium Ore
    - Deepslate:
        - Removed fortune yield bonus cap.
    - Hammer:
        - Increased max fortune yield bonus from 1 to 3 per level.
        - Removed fortune yield bonus cap.
    - Smelting:
        - Added xp yield of 0.7.
        - Increased max fortune yield multiplier from 0.25x to 2x per level.
        - Removed fortune yield bonus cap.

### Overclock
Implemented a new, network-based system that boosts machines via cables powered by tower charge and coolant.
- Added Overclock Relay
    - Mirrors tower charge into the overclock network
    - Needs to be connected to the top of an Overclock Tower
- Added Overclock Tower
    - Generates overclock charge using energy and fuel:
        - Titanium: Best fuel efficiency and charge rate,
        - Copper: High fuel efficiency, low charge rate,
        - Energized Iron: Poor fuel efficiency, extremely high charge rate.
- Generators cannot be overclocked.   
- Overclock is conducted through Reinforced Cables connected to Machines.
### Transportation
- Added Reinforced Cable
    - High-capacity backbone for energy, fluids, and overclock
> Notes: Does not transport energy at the moment.
- Added Reinforced Extractor
    - Pulls fluids from adjacent sources into the reinforced network, for coolant supply to overclock injectors.

## ITEMS
### Armor
- Added Aetherium Armor Set:
    - **Boots:** Durability 1125; fire resistant; knockback resistance 1.
    - **Chestplate:** Durability 1387; fire resistant; knockback resistance 1.
    - **Helmet:** Durability 952; fire resistant; knockback resistance 1.
    - **Leggings:** Durability 1300; fire resistant; knockback resistance 1.
- Added Titanium Armor Set:
    - **Boots:** Durability 195.
    - **Chestplate:** Durability 240.
    - **Helmet:** Durability 165.
    - **Leggings:** Durability 225.

### Materials
- Added Titanium Nugget
- Refined Aetherium Shard:
    - Now has a glint effect

### Meshes & Nets
- Added Aetherium Fishing Net:
    - Tier 8, 
    - Speed 6, 
    - Chance Multiplier 6x,
    - Amount Multiplier 1.5x, 
    - Rolls 6.
- Added Aetherium Mesh:
    - Tier 8,
    - Amount Multiplier 6x.
    - Fire resistant.
- Added Titanium Fishing Net:
    - Tier 5,
    - Speed 2.4, 
    - Chance Multiplier 3.6x, 
    - Amount Multiplier 1.2x, 
    - Rolls 4.
- Added Titanium Mesh:
    - Tier 6,
    - Amount Multiplier 3.6x.
    - Durability 1873.


### Tools
- Added Aetherium Tools:
    - **Vanilla:**
        - Axe, with 3579 durability and 8 attack damage;
        - Hoe, with 3579 durability and 4 attack damage;
        - Pickaxe, with 3579 durability and 7 attack damage;
        - Shovel, with 3579 durability and 7 attack damage;
        - Sword, with 3579 durability and 9 attack damage;
    - **Utilitycraft:**
        - AiOT, with 17895 durability and 12 attack damage;
        - Hammer, with 3579 durability and 10 attack damage;
        - Paxel, with 10737 durability and 11 attack damage;
    - Fire resistant across the set.
- Added Titanium Tools:
    - **Vanilla:**
        - Axe, with 1561 durability and 6 attack damage;
        - Hoe, with 1561 durability and 3 attack damage;
        - Pickaxe, with 1561 durability and 5 attack damage;
        - Shovel, with 1561 durability and 5 attack damage;
        - Sword, with 1561 durability and 7 attack damage;
    - **Utilitycraft:**
        - AiOT, with 7805 durability and 11 attack damage;
        - Hammer, with 1561 durability and 8 attack damage;
        - Paxel, with 4683 durability and 9 attack damage;

## RECIPES
### Blocks
- Added Aetherium Block (compress/unpack)
- Added Overclock Relay
- Added Overclock Tower
- Added Raw Titanium Block (compress/unpack)
- Added Reinforced Cable
- Added Titanium Block (compress/unpack)

### Items
- Added Aetherium Armor Recipes for:
    - Boots, Chestplate, Helmet, Leggings
- Added Aetherium Fishing Net
- Added Aetherium Mesh
- Added Aetherium Tool Recipes for:
    - AiOT, Axe, Hammer, Hoe, Paxel, Pickaxe, Shovel, Sword
- Added Titanium Armor Recipes for:
    - Boots, Chestplate, Helmet, Leggings
- Added Titanium Fishing Net
- Added Titanium Mesh
- Added Titanium Tool Recipes for:
    - AiOT, Axe, Hammer, Hoe, Paxel, Pickaxe, Shovel, Sword

### Materials
- Added Titanium Ingot ⇄ Nugget ⇄ Block conversions

## UI/UX
- Added new models/textures for overclock blocks, reinforced cable, and Aetherium/Titanium gear
- Added overclock HUD bar items (00–48) and machine lore readouts for overclock state
- Added textures for the following blocks:
    - Absolute Battery
    - Cryo Chamber
    - Network Center
    - Residue Processor
- Updated localization (EN/PT/ES) for overclock blocks and new equipment
- Updated ore shard textures and item/terrain atlases for new content

## BUG FIXES
- Fixed an issue where Laser Barrier did not have a proper UI.
- Fixed an issue where Reinforced Cable did not connect visually when placed next to another cable. (alpha ver only)
- Fixed an issue where Cloner would not consume fluid when a recipe required it.
- Fixed an issue where Liquid Capsules would not properly transfer fluids when used on machines or tanks.

## TECHNICAL CHANGES
- Added a centralized property registry for block states/dynamic properties with helper accessors (getPropertyMeta, getPropertyDefault, listProperties, requirePropertyMeta)
- Added compatibility for "Smart Filter" upgrade for every Ascendant Technology machine
- Added a custom drop pipeline that can replace vanilla drops and attach extras (sounds, particles, status effects, XP rewards, and command execution)
    - Key drop parameters include `baseSound`, `commandTarget`, `commands`, `conditions`, `extraDrops`, `fortuneMath` (multiplier/bonus + optional cap), `fortuneTiers`, `omitSpecialSound`, `replaceVanilla`, `specialTools`, `suppressVanillaSound`, and `xp` (fixed or range)
    - Elements:
        - DropConditions — dimension/biome/timeRange/playerSneaking/playerGameMode/toolType/blockStates
        - DropContext — block/player/dimension/tool + fortuneLevel/hasSilkTouch
        - DropEffect — status effects applied on break
        - DropEntry — core drop configuration (base drop, fortune scaling, extras, effects)
        - DropHandler — handler signature for entries in `DROPS_LIBRARY`
        - DropParticle — particle spawn definitions
        - DropResult — resolved drop payload (drops + side effects)
        - DropSound — sound definitions for base/override
        - ExtraDropEntry — bonus drops with chance/fortune scaling
        - FortuneMath / FortuneTier — fortune scaling rules and tier tables
        - SpecialToolOverride — per-tool overrides (dropId/silkDropId/fortune/sound)
- Added DoriosAPI container compatibility helpers (addItem/addItemAt/transferItems/transferItemsAt/transferItemsBetween/getContainerAt/getAllowedInputRange/getAllowedOutputRange/getMachineBlockedSlots/insertIntoInventory)
- Added DoriosAPI utility and math helpers (formatTimeFull, formatTime, capitalizeFirst, waitTicks/waitSeconds, formatIdToText, printJSON, scaleToSetNumber, roman conversions, distanceBetween)
- Added drop-system IntelliSense guide (`BP/scripts/drops/drops_guide.js`) documenting DropEntry/DropResult fields and examples
- Added overclock HUD slot rendering backed by `dorios:overclock_*` dynamic properties
    - This is not implemented for machines UI yet.
- Added prototype extensions for core classes (Block, Player, Entity, ItemStack) including state helpers, inventory/equipment utilities, and durability handling
- Updated machine overclock boosts (speed, consumption, capacity, yield)
- Updated reinforced fluid extraction to scan networks and accept vanilla sources/crucible/sink inputs

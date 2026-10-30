This update introduces the Alchemical Station and an expanded potion system, reworks steam production, and gives the newer machine upgrades more practical recipes. It also improves recipe books, machine interaction, localization, and mineral crop planting.

## HIGHLIGHTS
- Added **Alchemical Station** for six-bottle brewing, stronger potions, extended durations, and new potion effects.
- Reworked five **Machine Upgrade** recipes with components that match their functions.
- Added **Steam Boiler** and **Vaporizer** as a two-stage steam production chain.

## BLOCKS
### Machines
- Added **Alchemical Station**.
    - Combines six-bottle brewing with separate Amplify and Extend operations powered by Liquified Aetherium.
    - Brews up to six compatible bottles with one reagent per batch. Empty or incompatible bottle slots are skipped.
    - Each brewing batch takes 20 seconds and costs 12,000 DE and 250 mB of Blaze Essence before upgrades. One Blaze Powder supplies 1,000 mB, enough for four batches.
    - Amplify raises compatible potion levels while preserving their delivery form and duration; many effects can reach Level III, with limits depending on the effect.
    - Extend advances supported potions through longer and maximum-duration variants. Instant effects cannot be extended.
    - Amplify costs 1,000 mB of Liquified Aetherium; Extend costs 750 mB. Each operation takes 10 seconds and 16,000 DE before upgrades, and starts from its own button.
    - Converts supported potions between drinkable, splash, and lingering forms while preserving their upgraded level and duration. Dragon's Breath conversion returns one Glass Bottle per batch.
    - Stores 2.048 MDE, 64,000 mB of Blaze Essence, and 128,000 mB of Liquified Aetherium, with two upgrade slots for Speed and Energy.
    - Includes Brewing and Amplify/Extend pages, live process information, a recipe book, and a potion progression guide.
    - Supports separate item input modes for bottles, reagents, and Blaze Powder, automatic empty-bottle extraction, and Liquified Aetherium input. Finished potions are collected manually from their processing slots.
    - Available through Creative, the UtilityCraft Workbench, and the Assembler.
- Added **Steam Boiler**.
    - Converts 1,000 mB of Water into 1,000 mB of Steam for 2,400 DE in 8 seconds before upgrades.
    - Stores 128 kDE, 32,000 mB of Water, and 32,000 mB of Steam.
    - Includes two upgrade slots, dedicated liquid-container and gas-capsule slots, and configurable item, liquid, and gas I/O.
    - Uses its own powered and unpowered textures and appears in the Machines creative group.
- Added **Vaporizer** as the superior version of the Steam Boiler.
    - Converts 1,000 mB of Water into 1,000 mB of Steam for 1,600 DE in 4 seconds.
    - Converts 1,000 mB of Cryofluid into 1,500 mB of Steam for 2,400 DE in 6 seconds.
    - Converts 1,000 mB of Saline Coolant into 1,500 mB of Steam for 2,000 DE in 5 seconds.
    - Stores 1.024 MDE and 128,000 mB in each liquid and gas tank, with four upgrade slots.
    - Uses its own powered and unpowered textures and appears in the Superior Machines creative group.
- **Vaporworks Processor**
    - Replaced normal crafting and creative acquisition with the Steam Boiler and Vaporizer progression.
    - Existing blocks retain their inventories, stored resources, upgrade support, and processing behavior.
- **Verdant Cultivator**
    - Added Titanium and Tungsten mineral crop support on Blue Soil, and Aetherium Crystal crop support on Pink Soil.

## ITEMS

### Potions

- Added **Alchemical Potions** with 702 custom variants across supported effects, levels, durations, and delivery forms.
    - Expands brewing with effects such as Haste, Resistance, Absorption, Health Boost, Wither, Levitation, Blindness, Darkness, and Saturation.
    - Adds seven StatsCore potion families: Marked, Bleeding, Blessing, Curse, Berserk, Adaptive Resilience, and Soul Collector.
    - Marked increases incoming eligible attack damage; Bleeding inflicts periodic damage; Blessing restores health and grants protective effects; Curse applies harmful effects.
    - Berserk strengthens attacks, Adaptive Resilience builds resistance to repeated damage of the same type, and Soul Collector stores kill charges for empowered hits and healing.
    - Supports drinkable, splash, and lingering variants. Splash strength falls with distance; lingering clouds apply shorter effects with a reapplication cooldown.
    - Groups custom potions under Equipment, with descriptions showing effect levels, durations, and positive or negative effect colors.
## RECIPES

### Machines

- Added **Steam Boiler** crafting with Basic Chips and a Blast Furnace, and **Vaporizer** crafting with Advanced Chips and a Steam Boiler.
- Added **Alchemical Station** crafting with Titanium Plates, Aetherium, Absolute Chips, a Brewing Stand, and a Reinforced Machine Case.
- Updated the corresponding **Assembler** recipes.

### Machine Upgrades

- Reworked five upgrade recipes. Each Workbench recipe uses one Base Upgrade, two Redstone Blocks, and the following components:

| Upgrade | Structure | Functional components |
| --- | --- | --- |
| **Multi Processing** | 4 Titanium Plates | 1 Expert Chip and 1 Aetherium Ingot |
| **Energy Capacity** | 4 Steel Plates | 1 Gold Dust and 1 Basic Battery |
| **Liquid Capacity** | 4 Steel Plates | 1 Glass and 1 Basic Fluid Tank |
| **Gas Capacity** | 4 Lead Plates | 1 Glass and 1 Basic Gas Tank |
| **Resource Efficiency** | 4 Tungsten Plates | 1 Diamond Dust and 1 Refined Aetherium Crystal |

- Reduced the **Multi Processing Upgrade** Aetherium requirement from one block to one ingot.
- Updated **Catalyst Weaver** alternatives to use the same functional components while saving the four structural plates and one Redstone Block; processing energy costs are unchanged.
- Synchronized **Assembler** recipes and **Catalyst Weaver** recipe-book ingredients.
- Preserved the existing **Hyper Processing**, **Stack**, and **Size Upgrade** recipes and upgrade effects.

## UI/UX
- **Network Center**
    - Rebuilt the dashboard at standard inventory height, with four recipe-style button-card tabs (Overview, Gains, Losses, Capacity), independent scrolling, and a compact scan-status footer.
    - Split long information across bounded lore entries and pages, preventing lore-length errors without cutting off connected device types.
    - Made the Center a passive monitor: no local energy storage, scan cost, or Center-energy readout; existing helpers migrate without resizing their inventories.
    - Matched the navigation buttons to the machine blue, added four compact 12x12 tab symbols, narrowed the dashboard to 250 UI pixels with tighter vertical spacing, moved the auto-sized category title and page button into the main title row, and removed introductory and end-of-page descriptions.
    - Separated generators, consumers, batteries, and wireless distributors; Power Beacons no longer inflate generation totals.
    - Added storage breakdowns, free space, fill percentages, device activity, and comparable net energy samples without a machine-type display cutoff.

- **Residue Processor**
    - Reworked recipe selection and previews so ingredients, outputs, costs, and chances appear inside the recipe book instead of covering the machine inventory.
- **Machine I/O**
    - Replaced whole-atlas images with dedicated views of all six model faces for the Refining Table and Enchantment Station.
    - Added dedicated face images for the Seismic Breaker and Pattern Placer.
- **Machine Navigation**
    - Changed the inventory/recipe tab background to dark gray with light buttons.
- **Steam Boiler and Vaporizer**
    - Added recipe books, expanded item descriptions, operating instructions, and guidance for automation and upgrades.
- **Localization**
    - Moved block and item descriptions into native tooltips across all ten languages, keeping names clean in interfaces and recipe books.
    - Added translated shared machine information and status terms across the ten bundled languages.
    - Cleaned up inconsistent white formatting in translated machine entity names.
    - Renamed Power Beacons to **Emissor de Energia** in Portuguese.

## BUG FIXES

- Fixed **Titanium Hammer** mining speed on shovel-breakable blocks such as dirt and sand.
- Fixed **Verdant Cultivator** mineral seed registrations pointing to nonexistent crop blocks.
- Fixed failed **Verdant Cultivator** planting replacing named or customized seeds with plain items.
- Extended machine selection handling to Absolute generators, the Absolute Battery, Absolute Container, Overclock Relay, Overclock Tower, and Power Beacons, improving container access and sneaking interaction for block mining.
- Connected **Power Beacon** entities to the shared selection system and standardized their hitboxes to one block, restoring sneaking to mine across all five tiers.
- Fixed missing recipe-book arrow textures and incorrect Redstone Block icon paths.
- Fixed empty gas tanks retaining an incompatible previous output type and blocking a new recipe; tanks containing gas still prevent incompatible output mixing.

## THIRD-PARTY / INTEGRATION

- Added `utilitycraft:register_vaporizer_recipe` for custom advanced liquid-to-gas recipes. The previous `utilitycraft:register_vaporworks_processor_recipe` event remains supported by the same advanced recipe registry; the Steam Boiler remains Water-only.

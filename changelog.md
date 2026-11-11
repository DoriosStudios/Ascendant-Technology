# Ascendant Technology v0.9.3-beta

This update introduces the Alchemical Station and new potion effects, expands steam production and universal logistics, and improves machine progression, interfaces, and network monitoring.

> [!WARNING]
> Requires UtilityCraft 3.6.2 or newer.

## HIGHLIGHTS

- Added **Alchemical Station**, with six-bottle brewing, amplification, extension, and 35 potion families.
- Reworked **Machine Upgrade** recipes with Expert components and Aetherium Plates.
- Reworked **Network Center** with a passive, paged network dashboard.
- Added **Steam Boiler** and **Vaporizer** for two-stage steam production.
- Added **Universal Cable**, **Universal Exporter**, and **Universal Importer**.

## BLOCKS
### Machines
- Added **Alchemical Station**.
    - Brews up to six compatible bottles with one reagent per batch, skipping empty or incompatible slots.
    - A base brewing batch takes 20 seconds and consumes 12,000 DE and 250 mB of Blaze Essence. One Blaze Powder supplies 1,000 mB.
    - Amplify raises supported potion levels; Extend increases supported durations. Both use a shared central potion slot and separate action buttons.
    - Each upgrade takes 10 seconds and 16,000 DE. Amplify consumes 1,000 mB of Liquified Aetherium; Extend consumes 750 mB. Instant effects cannot be extended.
    - Preserves potion delivery forms during upgrades and upgraded levels and durations when converting between drinkable, splash, and lingering forms.
    - Returns one Glass Bottle per Dragon's Breath conversion batch.
    - Stores 2.048 MDE, 64,000 mB of Blaze Essence, and 128,000 mB of Liquified Aetherium. Accepts Speed and Energy upgrades.
    - Supports bottle, reagent, and Blaze Powder input modes, empty-bottle extraction, and Liquified Aetherium input. Finished potions are collected manually.
- Added **Steam Boiler**.
    - Converts 1,000 mB of Water into 1,000 mB of Steam for 2,400 DE in 8 seconds before upgrades.
    - Stores 128 kDE and 32,000 mB in each Water and Steam tank. Accepts Speed and Energy upgrades.
    - Receives Water through liquid I/O and exports Steam through gas I/O, without container conversion slots.
- Added **Vaporizer**.
    - Superior version of Steam Boiler, with 1.024 MDE, two 128,000 mB tanks, and four upgrade slots.
    - Converts 1,000 mB of Water into 1,000 mB of Steam for 1,600 DE in 4 seconds.
    - Converts 1,000 mB of Cryofluid into 3,000 mB of Steam for 2,400 DE in 4 seconds: three times the Water recipe's steam production per second. Cryofluid preparation has its own costs.
    - Converts 1,000 mB of Saline Coolant into 1,500 mB of Steam for 2,000 DE in 5 seconds.
    - Uses one container slot per side. Filled liquid containers return empty in the left slot; empty gas capsules return filled in the right slot.
    - Converts each container stack together when sufficient tank space or gas is available.
- **Network Center**
    - Rebuilt the dashboard with Overview, Gains, Losses, and Capacity tabs, independent scrolling, paged device information, and scan status.
    - Now monitors the network without storing energy or charging for scans.
    - Shows storage breakdowns, free space, fill percentages, activity, and comparable net energy samples.
    - Separates generators, consumers, batteries, and wireless distributors. Power Beacons no longer inflate generation totals.
    - Supports larger device lists without cutting off connected device types.
- **Verdant Cultivator**
    - Added Titanium and Tungsten mineral crop support on Blue Soil and Aetherium Crystal crop support on Pink Soil.
- **Vaporworks Processor**
    - Replaced normal crafting progression with Steam Boiler and Vaporizer. Existing processors remain functional and retain their inventories and stored resources.

### Transportation
- Added **Universal Cable**.
    - Carries energy, items, liquids, gases, and overclock through shared physical connections, including wrench disconnections.
- Added **Universal Exporter** and **Universal Importer**.
    - Exporter independently distributes items, liquids, and gases. Importer delivers resources through its attached container's input face.
    - Transfers up to 64 items per operation and 4,000 mB of each fluid resource per 10-tick cycle. Up to four Speed Upgrades increase transfer limits.
    - Includes separate resource switches, whitelist/blacklist filters, and nearest, farthest, or round-robin Exporter distribution.
    - Filters require a Filter Upgrade and support eight identifiers per resource. Transfers respect connected machine I/O settings.

### Overclock
- **Reinforced Cable**
    - Can share normal energy networks with Energy Cable while retaining a separate overclock network. Ordinary Energy Cable does not carry overclock.
    - Overclock connections update after placement, breaking, piston movement, and wrench disconnections.
- **Overclock Relay**
    - Can power ordinary Energy Cable branches without feeding energy back into Towers or other Relays.

## ITEMS
### Materials
- Added **Aetherium Plate**.
    - Produced from one Aetherium Ingot in the Electro Press and recyclable into one Aetherium Dust in the Crusher.
    - Used in the Multi Processing Upgrade recipe.
- Added **Contaminated Hide**.
    - Silverfish drop one Hide when mob loot is enabled, including automated kills, without a Looting multiplier.
    - Used to brew Infestation potions.

### Potions
- Added **Alchemical Potions**, with **702** (I repeat, ***702***) custom variants across supported effects, levels, durations, and delivery forms.
    - Includes Haste, Resistance, Absorption, Health Boost, Wither, Levitation, Blindness, Darkness, and Saturation.
    - Supports drinkable, splash, and lingering forms. Splash strength decreases with distance; lingering clouds apply shorter effects with a reapplication cooldown.
    - Tooltips show effect levels, durations, and positive or negative effect colors.
- Added **StatsCore Potions**.
    - **Marked:** Increases incoming eligible attack damage.
    - **Bleeding:** Inflicts periodic damage.
    - **Blessing:** Provides healing and protective effects.
    - **Curse:** Applies harmful effects.
    - **Berserk:** Strengthens attacks.
    - **Adaptive Resilience:** Builds resistance to repeated damage of the same type.
    - **Soul Collector:** Stores kill charges for empowered hits and healing.

## RECIPES
### Machines
- Added **Alchemical Station** crafting with Quartz Blocks, a Netherite Plate, Ultimate Chips, a Brewing Stand, and a Reinforced Machine Case.
- Added **Network Center** crafting with four Steel Blocks, two Titanium Plates, two Netherite Plates, and a Machine Case.
- Added **Steam Boiler** crafting with Basic Chips and a Blast Furnace, and **Vaporizer** crafting with Advanced Chips and a Steam Boiler.
- All four recipes are available in the Workbench and Assembler.

### Alchemical Station
- **Infestation:** Awkward Potion + Contaminated Hide.
- **Weaving:** Poison Potion + Spool of Strings.
- **Adaptive Resilience:** Resistance Potion + Steel Dust.
- **Saturation:** Thick Potion + Golden Carrot, keeping it distinct from Night Vision and Absorption.

### Machine Upgrades
- Reworked five Workbench recipes. Each uses one Base Upgrade, two Redstone Blocks, and:
    - **Multi Processing:** Four Aetherium Plates, an Expert Chip, and an Aetherium Ingot.
    - **Energy Capacity:** Four Steel Plates, Gold Dust, and an Expert Battery.
    - **Liquid Capacity:** Four Steel Plates, Glass, and an Expert Fluid Tank.
    - **Gas Capacity:** Four Lead Plates, Glass, and an Expert Gas Tank.
    - **Resource Efficiency:** Four Tungsten Plates, Diamond Dust, and a Refined Aetherium Crystal.
- Updated the corresponding Assembler and Catalyst Weaver recipes. Weaver alternatives save four structural plates and one Redstone Block.

### Transportation
- Added **Universal Cable** crafting with Fluid Pipe, Gas Pipe, Energy Cable, Item Conduit, Reinforced Cable, and four Netherite Plates. Produces eight cables.
- Added **Universal Exporter** and **Universal Importer** crafting with four Universal Cables and a Hopper in their respective arrangements.
- All three recipes are available in the Workbench and Assembler.

## UI/UX
- **Alchemical Station**
    - Added Brewing and Amplify/Extend pages, process information, a recipe book, and a potion progression guide.
    - Brewing progress follows a purple, pixelated path from the reagent to all six potion slots.
    - Upgrades use a 24×24 central potion slot, with an orange Amplify path and a blue Extend path that stop at the slot border.
- **Machine Navigation**
    - Standardized section menus with default gray buttons and the machine inventory tab on the right, keeping the machine page selected on opening.
- **Machine I/O**
    - Added clear views of machine faces for Refining Table, Enchantment Station, Seismic Breaker, and Pattern Placer.
- **Mob Slasher**
    - Added animated blade movement.
- **Recipe Books**
    - Added Steam Boiler and Vaporizer recipe books and animated empty-container hints for Vaporizer.
    - Added Aetherium Plate production and recycling entries to the Electro Press and Crusher books.
    - Updated upgrade ingredients and dedicated Expert tank icons.
    - Moved Residue Processor recipe previews into its book so they no longer cover the machine inventory.
- **Tooltips and Localization**
    - Moved block and item descriptions into native tooltips and standardized machine names, upgrade information, and addon identification.
    - Updated steam machine descriptions, I/O modes, processing states, fluid names, and alchemy ingredients across all ten bundled languages.
    - Renamed Power Beacons to **Emissor de Energia** in Portuguese and corrected the Absolute tier's name color.
- Updated **Cryo Chamber** interface and section navigation.

## BUG FIXES
- Fixed overclock rebuilds overwriting energy destinations and disconnected machines retaining old boosts after entity reloads.
- Fixed **Titanium Hammer** mining speed on shovel-breakable blocks.
- Fixed **Verdant Cultivator** crop references and preserved customized seeds when planting fails.
- Improved inventory access and sneaking to mine for Absolute generators, Absolute Battery, Absolute Container, Overclock Relay, Overclock Tower, and all five Power Beacon tiers.
- Fixed **Compactor** energy, progress, and inventory grid displays.
- Fixed missing recipe-book arrows and incorrect Redstone Block icons.
- Fixed empty gas tanks retaining an incompatible output type. Tanks containing gas still prevent incompatible mixing.

## THIRD-PARTY / INTEGRATION
- Added `utilitycraft:register_vaporizer_recipe` for custom advanced liquid-to-gas recipes. The previous `utilitycraft:register_vaporworks_processor_recipe` event remains supported; Steam Boiler remains Water-only.
- **Dorios' Insight** remains optional for custom effect HUD icons, levels, timers, and charges. Effects continue to work without it, and missing Insight no longer produces a chat warning.

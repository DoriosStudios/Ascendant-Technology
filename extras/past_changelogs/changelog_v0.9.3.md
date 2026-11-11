# Ascendant Technology v0.9.3

This update introduces the Alchemical Station and its expanded potion system, splits steam production into two machine tiers, reworks the Network Center, and adds universal cables and transfer ports. It also updates upgrade recipes, machine navigation, localization, and interaction.

## HIGHLIGHTS

- Added **Alchemical Station**, with six-bottle brewing, stronger potions, extended durations, and 35 potion families.
- Added **Steam Boiler** and **Vaporizer**. Cryofluid now produces three times as much steam per second as Water in the Vaporizer.
- Reworked **Network Center** into a passive network dashboard.
- Added **Universal Cable**, **Universal Exporter**, and **Universal Importer**, craftable in the Workbench and Assembler.
- Standardized section menus with default gray buttons and the machine inventory tab on the right.

## ALCHEMY

- Added **Alchemical Station**, with Brewing and Amplify/Extend pages, process information, a recipe book, and a potion progression guide.
- Brews up to six compatible bottles with one reagent per batch, skipping empty or incompatible slots. A base batch takes 20 seconds, 12,000 DE, and 250 mB of Blaze Essence. One Blaze Powder supplies 1,000 mB.
- Amplify raises supported potion levels; Extend advances supported duration variants. Both operations use a shared central potion slot. Each operation has its own button and costs 16,000 DE over 10 seconds. Amplify consumes 1,000 mB of Liquified Aetherium; Extend consumes 750 mB. Instant effects cannot be extended.
- Preserves delivery form during amplification and extension, and preserves upgraded levels and durations when converting between drinkable, splash, and lingering potions. Dragon's Breath conversion returns one Glass Bottle per batch.
- Stores 2.048 MDE, 64,000 mB of Blaze Essence, and 128,000 mB of Liquified Aetherium. Supports Speed and Energy upgrades, bottle/reagent/fuel input modes, empty-bottle extraction, and liquid input. Finished potions are collected manually.
- Added **702 custom potion variants** across supported effects, levels, durations, and delivery forms. Additional effects include Haste, Resistance, Absorption, Health Boost, Wither, Levitation, Blindness, Darkness, and Saturation.
- Added StatsCore potion families: **Marked, Bleeding, Blessing, Curse, Berserk, Adaptive Resilience, and Soul Collector**. Effects cover damage marking, periodic damage, healing and protection, harmful effects, stronger attacks, resistance to repeated damage types, and kill charges for empowered hits.
- Splash strength decreases with distance; lingering clouds apply shorter effects with a reapplication cooldown. Potion tooltips show effect levels, durations, and positive or negative effect colors.

### Brewing recipes

| Potion | Base potion | Reagent |
| --- | --- | --- |
| Infestation | Awkward | Contaminated Hide |
| Oozing | Awkward | Slime Block |
| Weaving | Poison | Spool of Strings |
| Adaptive Resilience | Resistance | Steel Dust |
| Saturation | Thick | Golden Carrot |

- Some effects require a prepared potion: Weaving starts from Poison, Adaptive Resilience from Resistance, and Saturation from Thick Potion.
- Added **Contaminated Hide**, dropped by Silverfish when mob loot is enabled, including automated kills. Each kill drops one Hide without a Looting multiplier.
- Contaminated Hide has its own texture and appears in the Creative inventory and Alchemical Station recipe book.
- Updated the Alchemical Station recipe book across all ten bundled languages.
- Craft the Alchemical Station with Quartz Blocks, a Netherite Plate, Ultimate Chips, a Brewing Stand, and a Reinforced Machine Case. The same recipe is available in the Assembler.

## STEAM PRODUCTION

- Added **Steam Boiler** as the entry machine, with 128 kDE, two 32,000 mB tanks, and two Speed/Energy upgrade slots. It accepts Water through liquid I/O and exports Steam through gas I/O. Its interface has no container conversion slots.
- Added **Vaporizer** as the superior machine, with 1.024 MDE, two 128,000 mB tanks, and four upgrade slots.

All values below are before upgrades and overclock. Each recipe consumes 1,000 mB of its input liquid.

| Machine / input | Steam output | Energy | Time |
| --- | ---: | ---: | ---: |
| Steam Boiler / Water | 1,000 mB | 2,400 DE | 8 s |
| Vaporizer / Water | 1,000 mB | 1,600 DE | 4 s |
| Vaporizer / Cryofluid | **3,000 mB** | **2,400 DE** | **4 s** |
| Vaporizer / Saline Coolant | 1,500 mB | 2,000 DE | 5 s |

- Cryofluid supplies **750 mB of Steam per second per Vaporizer**, compared with Water's 250 mB/s. Cryofluid synthesis still has its separate material and energy costs.
- Vaporizer has one container slot per side: filled liquid containers return empty in the left slot; empty gas capsules return filled in the right slot. Each stack converts together when sufficient tank space or gas is available. Empty slots show animated container hints.
- Container stacks wait until the entire stack can be converted, preventing partial consumption when there is insufficient tank space or gas.
- Both machines have dedicated powered/unpowered textures, recipe books, operating descriptions, and Workbench/Assembler recipes. Boiler uses Basic Chips and a Blast Furnace; Vaporizer uses Advanced Chips and a Steam Boiler.
- Steam Boiler and Vaporizer replace the Vaporworks Processor in the crafting progression. Existing Vaporworks Processors continue to work and retain their inventories and stored resources.

## NETWORKS AND LOGISTICS

### Network Center

- Rebuilt the dashboard with **Overview, Gains, Losses, and Capacity** tabs, independent scrolling, paged device information, and a compact scan-status footer.
- Monitor the network without supplying energy to the Center or paying an energy cost for scans.
- Browse connected device types across pages, including larger networks that previously exceeded the display limit.
- Added storage breakdowns, free space, fill percentages, activity, and comparable net energy samples. Generators, consumers, batteries, and wireless distributors are listed separately; Power Beacons no longer inflate generation totals.
- Added a more compact dashboard with clear tab icons and page controls.
- Craft the Network Center in the Workbench or Assembler using four Steel Blocks, two Titanium Plates, two Netherite Plates, and a Machine Case.

### Universal Cable and transfer ports

- Added **Universal Cable** in the pipes group. It carries energy, items, liquids, gases, and overclock through shared physical connections, including wrench disconnections.
- Added **Universal Exporter** and **Universal Importer**. The Exporter independently transfers items, liquids, and gases over routes discovered by UtilityCraft; the Importer delivers through the attached container's input face.
- Supports up to 64 items per operation and 4,000 mB of each fluid resource per 10-tick cycle. Up to four Speed Upgrades increase transfer limits.
- Added resource enable switches, whitelist/blacklist filters, and Exporter nearest/farthest/round-robin distribution. Filters require a Filter Upgrade and support eight identifiers per resource.
- Configure transfer settings and filters from each port. Transfers respect the connected machines’ input and output settings.
- Craft eight Universal Cables with Fluid Pipe, Gas Pipe, Energy Cable, Item Conduit, Reinforced Cable, and four Netherite Plates. Each Exporter or Importer uses four Universal Cables and a Hopper. All three recipes are available in the Workbench and Assembler.

### Overclock

- Reinforced Cable now shares normal energy networks with Energy Cable while retaining a separate overclock network. Ordinary Energy Cable does not carry overclock.
- Overclock connections update after blocks are placed, broken, moved by pistons, or disconnected with a wrench.
- Overclock Relay can power ordinary Energy Cable branches without feeding energy back into Towers or other Relays.

## MACHINE UPGRADES

Reworked five Workbench recipes. Each uses one Base Upgrade, two Redstone Blocks, and the components below.

| Upgrade | Structural material | Functional components |
| --- | --- | --- |
| Multi Processing | 4 Aetherium Plates | Expert Chip + Aetherium Ingot |
| Energy Capacity | 4 Steel Plates | Gold Dust + Expert Battery |
| Liquid Capacity | 4 Steel Plates | Glass + Expert Fluid Tank |
| Gas Capacity | 4 Lead Plates | Glass + Expert Gas Tank |
| Resource Efficiency | 4 Tungsten Plates | Diamond Dust + Refined Aetherium Crystal |

- Added **Aetherium Plate**, produced from one Aetherium Ingot in the Press and recyclable into one Aetherium Dust in the Crusher. Multi Processing uses four Aetherium Plates, an Expert Chip, an Aetherium Ingot, a Base Upgrade, and two Redstone Blocks.
- Craft the updated upgrades in the Workbench or Assembler. Catalyst Weaver alternatives save four structural plates and one Redstone Block.
- Updated recipe-book ingredients and dedicated Expert tank icons. Capacity upgrades now consistently use Expert components.

## INTERFACES AND LOCALIZATION

- Alchemical Station upgrades use a 24×24 central potion slot with an orange Amplify path and a blue Extend path. Paths fill toward the slot without covering it.

- Alchemical Station brewing progress now follows a pixel-art path from the reagent to all six potion slots, with gray vanilla-style channels and a purple blaze fill.

- Standardized section-menu buttons and backgrounds to default gray, including screens with their own color overrides. Machine inventory tabs appear on the right, with the machine page still selected on opening.
- Standardized Steam Boiler and Vaporizer descriptions with the other machines.
- Added Aetherium Plate production and recycling entries to the Electro Press and Crusher recipe books.
- Translated steam machine descriptions, I/O modes, processing states, and recipe-book fluid names across all ten bundled languages.
- Reworked Residue Processor recipe selection and previews so ingredients, outputs, costs, and chances appear in the recipe book instead of covering the inventory.
- Corrected Compactor energy, progress, and inventory grid controls.
- Updated Cryo Chamber’s interface and section navigation.
- I/O panels show clear views of each machine face for Refining Table, Enchantment Station, Seismic Breaker, and Pattern Placer.
- Moved block/item descriptions into native tooltips across ten languages and added shared machine information/status translations. Cleaned up machine-name formatting and renamed Power Beacons to **Emissor de Energia** in Portuguese.
- Added animated blade movement to Mob Slasher.

## OTHER FIXES

- Fixed overclock rebuilds overwriting energy destinations and disconnected machines retaining old boosts after entity reloads.
- Fixed Titanium Hammer mining speed on shovel-breakable blocks.
- Added Verdant Cultivator support for Titanium/Tungsten crops on Blue Soil and Aetherium Crystal crops on Pink Soil. Fixed nonexistent crop references and preserved customized seeds when planting fails.
- Improved inventory access and sneaking to mine for Absolute generators, Absolute Battery, Absolute Container, Overclock Relay/Tower, and all five Power Beacon tiers.
- Fixed missing recipe-book arrows, incorrect Redstone Block icons, and empty gas tanks retaining incompatible output types. Tanks containing gas still prevent incompatible mixing.

## COMPATIBILITY

- Requires compatible **UtilityCraft 3.6.2+** content for shared machines, items, and networks.
- **Dorios' Insight** remains optional for custom effect HUD icons, levels, timers, and charges. StatsCore effects continue to work without it, and the addon no longer shows a missing-Insight warning in chat.

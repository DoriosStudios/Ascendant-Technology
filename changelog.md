# Ascendant Technology v0.9.3

> **Status: draft.** Describes the current implementation. Release blockers and unfinished work are listed at the end.

This update introduces the Alchemical Station and its expanded potion system, splits steam production into two machine tiers, reworks the Network Center, and enables universal logistics in Creative. It also updates upgrade recipes, machine navigation, localization, and interaction.

## HIGHLIGHTS

- Added **Alchemical Station**, with six-bottle brewing, stronger potions, extended durations, and 35 potion families.
- Added **Steam Boiler** and **Vaporizer**. Cryofluid now produces three times as much steam per second as Water in the Vaporizer.
- Reworked **Network Center** into a passive network dashboard.
- Enabled **Universal Cable**, **Universal Exporter**, and **Universal Importer** in Creative; survival recipes remain unfinished.
- Standardized section menus with default gray buttons and the machine inventory tab on the right.

## ALCHEMY

- Added **Alchemical Station**, with Brewing and Amplify/Extend pages, process information, a recipe book, and a potion progression guide.
- Brews up to six compatible bottles with one reagent per batch, skipping empty or incompatible slots. A base batch takes 20 seconds, 12,000 DE, and 250 mB of Blaze Essence. One Blaze Powder supplies 1,000 mB.
- Amplify raises supported potion levels; Extend advances supported duration variants. Each operation has its own button and costs 16,000 DE over 10 seconds. Amplify consumes 1,000 mB of Liquified Aetherium; Extend consumes 750 mB. Instant effects cannot be extended.
- Preserves delivery form during amplification and extension, and preserves upgraded levels and durations when converting between drinkable, splash, and lingering potions. Dragon's Breath conversion returns one Glass Bottle per batch.
- Stores 2.048 MDE, 64,000 mB of Blaze Essence, and 128,000 mB of Liquified Aetherium. Supports Speed and Energy upgrades, bottle/reagent/fuel input modes, empty-bottle extraction, and liquid input. Finished potions are collected manually.
- Added **702 custom potion variants** across supported effects, levels, durations, and delivery forms. Additional effects include Haste, Resistance, Absorption, Health Boost, Wither, Levitation, Blindness, Darkness, and Saturation.
- Added StatsCore potion families: **Marked, Bleeding, Blessing, Curse, Berserk, Adaptive Resilience, and Soul Collector**. Effects cover damage marking, periodic damage, healing and protection, harmful effects, stronger attacks, resistance to repeated damage types, and kill charges for empowered hits.
- Splash strength decreases with distance; lingering clouds apply shorter effects with a reapplication cooldown. Potion tooltips show effect levels, durations, and positive or negative effect colors.

### Revised brewing recipes

| Potion | Base potion | Reagent |
| --- | --- | --- |
| Infestation | Awkward | Contaminated Hide |
| Oozing | Awkward | Slime Block — unchanged |
| Weaving | Poison | Spool of Strings |
| Adaptive Resilience | Resistance | Steel Dust |
| Saturation | Thick | Golden Carrot |

- Brewing now supports family-specific starting potions instead of requiring Awkward Potion for every direct recipe. Saturation no longer conflicts with Night Vision or Absorption.
- Added **Contaminated Hide**, dropped by Silverfish when mob loot is enabled, including automated kills. Each kill drops one Hide without a Looting multiplier.
- Added its item registration, Creative entry, localized name, recipe-book icon, and a 16×16 texture using six grays and four greens.
- Updated the Alchemical Station recipe book across all ten bundled languages.
- The current Workbench recipe uses Quartz Blocks, a Netherite Plate, Ultimate Chips, a Brewing Stand, and a Reinforced Machine Case. The Assembler registration uses the same ingredients.

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
- Automatic item output waits while source containers still need conversion. Failed shared-slot conversions restore stored resources instead of consuming part of a stack.
- Existing Boiler and Vaporizer inventories migrate to the compact layouts, preserving retained items, upgrades, and resources. Items from removed container slots are returned beside the machine.
- Both machines have dedicated powered/unpowered textures, recipe books, operating descriptions, and Workbench/Assembler recipes. Boiler uses Basic Chips and a Blast Furnace; Vaporizer uses Advanced Chips and a Steam Boiler.
- Retired normal acquisition of **Vaporworks Processor** in favor of the new progression. Placed processors retain their original inventories and capacities and share the advanced recipe registry, including the revised Cryofluid recipe.

## NETWORKS AND LOGISTICS

### Network Center

- Rebuilt the dashboard with **Overview, Gains, Losses, and Capacity** tabs, independent scrolling, paged device information, and a compact scan-status footer.
- Made the Center a passive monitor, without local energy storage or scan energy costs. Existing helpers migrate without resizing their inventories.
- Split long information across bounded lore entries and pages, preventing lore-length errors without cutting off connected device types.
- Added storage breakdowns, free space, fill percentages, activity, and comparable net energy samples. Generators, consumers, batteries, and wireless distributors are listed separately; Power Beacons no longer inflate generation totals.
- Uses a 250-pixel dashboard, compact tab symbols, and category titles/page controls in the main title row. The dashboard is functional; its survival recipe remains undefined.

### Universal logistics — Creative access

- Enabled **Universal Cable** in the pipes group. It carries energy, items, liquids, gases, and overclock through shared physical connections, including wrench disconnections.
- Enabled **Universal Exporter** and **Universal Importer**. The Exporter independently transfers items, liquids, and gases over routes discovered by UtilityCraft; the Importer delivers through the attached container's input face.
- Supports up to 64 items per operation and 4,000 mB of each fluid resource per 10-tick cycle. Up to four Speed Upgrades increase transfer limits.
- Added resource enable switches, whitelist/blacklist filters, and Exporter nearest/farthest/round-robin distribution. Filters require a Filter Upgrade and support eight identifiers per resource.
- AT owns settings, menus, upgrades, and filters; UtilityCraft supplies network routes. Machine I/O restrictions remain enforced, with energy and overclock connections passive.
- **No survival recipes are provided yet for these three universal blocks.**

### Overclock

- Reinforced Cable now shares normal energy networks with Energy Cable while retaining a separate overclock network. Ordinary Energy Cable does not carry overclock.
- Rebuilds overclock networks after placement, breaking, piston movement, and wrench disconnections, preserving Tower fuel/energy costs, the Relay requirement, and the strongest-Tower rule.
- Overclock Relay receives energy destinations from UtilityCraft and can power ordinary Energy Cable branches without feeding energy back into Towers or other Relays.

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
- Updated Assembler registrations and Catalyst Weaver alternatives. Weaver recipes save four structural plates and one Redstone Block; processing energy costs are unchanged.
- Updated recipe-book ingredients and dedicated Expert tank icons. Capacity upgrades now consistently use Expert components.
- Hyper Processing, Stack, and Size recipes and their effects are unchanged.

## INTERFACES AND LOCALIZATION

- Standardized section-menu buttons and backgrounds to default gray, including screens with their own color overrides. Machine inventory tabs appear on the right, with the machine page still selected on opening.
- Standardized Steam Boiler and Vaporizer descriptions with the other machines.
- Reworked Residue Processor recipe selection and previews so ingredients, outputs, costs, and chances appear in the recipe book instead of covering the inventory.
- Corrected Compactor energy, progress, and inventory grid controls.
- Updated Cryo Chamber's interface and section presentation; in-game validation remains pending.
- Replaced whole-atlas I/O images with dedicated model-face views for Refining Table and Enchantment Station; added dedicated face images for Seismic Breaker and Pattern Placer.
- Moved block/item descriptions into native tooltips across ten languages and added shared machine information/status translations. Cleaned up machine-name formatting and renamed Power Beacons to **Emissor de Energia** in Portuguese.
- Added animated blade movement to Mob Slasher.

## OTHER FIXES

- Fixed overclock rebuilds overwriting energy destinations and disconnected machines retaining old boosts after entity reloads.
- Fixed Titanium Hammer mining speed on shovel-breakable blocks.
- Added Verdant Cultivator support for Titanium/Tungsten crops on Blue Soil and Aetherium Crystal crops on Pink Soil. Fixed nonexistent crop references and preserved customized seeds when planting fails.
- Extended machine selection handling to Absolute generators, Absolute Battery, Absolute Container, Overclock Relay/Tower, and Power Beacons. Standardized Beacon hitboxes and restored sneaking to mine across all five tiers.
- Fixed missing recipe-book arrows, incorrect Redstone Block icons, and empty gas tanks retaining incompatible output types. Tanks containing gas still prevent incompatible mixing.

## INTEGRATION

- Removed mandatory UtilityCraft pack UUID dependencies from the manifests. Compatible UtilityCraft content is still needed for shared machines, components, assets, and network behavior; the current compatibility target is **UtilityCraft 3.6.2+**.
- Existing GitHub workflows already build downloadable addon packages and handle release publication/notifications. Packaging infrastructure is available.
- Added `utilitycraft:register_vaporizer_recipe`; the previous `utilitycraft:register_vaporworks_processor_recipe` event remains supported by the same advanced registry. Steam Boiler remains Water-only.

## UNFINISHED WORK / RELEASE CHECKLIST

- **Network Center:** the dashboard is functional. Define its survival recipe and register it in the Assembler.
- **Universal logistics:** define survival recipes or explicitly retain Creative-only availability for this release; validate transfers, filters, routing, and machine I/O together in Bedrock.
- **Alchemical Station:** the balanced Workbench and Assembler recipes are synchronized. Validate brewing, modifier operations, container returns, automation, thrown potions, lingering clouds, and StatsCore effects in Bedrock.
- **Steam machines:** validate compact-inventory migration, returned items, shared-slot stacks, animated hints, upgrades, overclock, and Arc-Press Steam supply in Bedrock. The Cryofluid throughput change has local runtime coverage; synthesis-chain balance still needs gameplay evaluation.
- **Cryo Chamber and shared UI:** finish in-game review of the current interface changes and mouse/controller/touch navigation across GUI scales.
- **Release metadata:** BP/RP manifests and Regolith configuration still identify version 0.9.2. Update them together before publishing 0.9.3.
- **Discontinued:** Mob Chamber remains discontinued. Removed the retained Controller, Core, and Essence Module recipe registrations; no Mob Chamber completion is planned for this release.
- **Deferred scope:** the Singularity Fabricator progression rework is not presented as a completed 0.9.3 feature.
- Local tests and rendered previews do not replace a Bedrock world reload and compatibility checks with existing machines.

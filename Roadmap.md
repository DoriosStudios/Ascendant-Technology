## Roadmap
The overall roadmap for Ascendant Technology. This is the source of truth for planned features, implementation status, and development priorities.

Machine status legend:
- 🟢 Implemented (in-game)
- 🟣 Needs Design (Done, but missing assets)
- 🔵 In Development (actively being built)
- 🟡 Planned (Confirmed for future implementation)
- 🟠 Not Confirmed (doesn't have a defined plan)
- 🟥 On Hold / Cut (Paused or no longer planned)

---

# Version 1.0 progression plan

Version 1.0 organizes the main progression into seven material eras, **Titanium → Tungsten → Aetherium Crystal → Aetherium Metal → Niobium → Singularities → Kyarium**.

The planned progression combines the decisions recorded in [Progression Summary](extras/Progression_Summary.md), the proposed machine placement in [Machine Progression Map](extras/progression_ptbr.md), and the [original discussion](extras/Chat_History.md). Implementation markers elsewhere in this roadmap describe existing features. The 1.0 changes below remain planned until their recipes, mechanics, and acquisition paths are implemented.

This roadmap also incorporates the latest confirmations from this planning review and the recovered progression and generator design exports. Proposed balance values are identified in their corresponding sections.

## Progression milestones

| Era | Material identity | Progression role |
|---|---|---|
| Titanium | Cold, stability, and cryogenics | Introduces Cryo Chamber and Cryofluid, with Cold Fusion Reactor as the culmination of its technological line |
| Tungsten | Heat resistance, high thermal capacity, and heavy industry | Supplies industrial infrastructure for the horizontal Superior Machines program and Aetherium synthesis |
| Aetherium Crystal | Cold, unstable alien matter associated with the souls of extinct End creatures | Supplies reagents, catalysts, enchanting, refinement, and StatsCore technology, culminating in Catalyst Weaver |
| Aetherium Metal | Artificial alloy combining anomalous properties, structural strength, and industrial synthesis | Opens advanced storage, logistics, Overclock, Absolute generation, Liquifier, and Energizer |
| Niobium | Purity, exceptional conductivity, precision, and confinement | Enables extreme-energy components, advanced replication, remote transport, and Quantum Reactor |
| Singularities | Extreme material concentration and industrial scale | Uses large-scale production, 9×9 assembly, and Kyarium Matrix to reach the final material |
| Kyarium | The Perfect Gem and the final material of the main progression | Rewards the completed industrial chain with final generators, equipment, Particle Condenser, and Universal Phaser |

The 1.0 roster incorporates the [earlier machine progression map](extras/progression_ptbr.md) and subsequent scope decisions recorded here. Individual mechanics and balance values that remain open are tracked below.

## Progression design principles

- Earlier materials retain applications wherever their properties support the technology. Titanium's cryogenic line can culminate in Cold Fusion Reactor throughout the broader progression.
- Each era introduces a distinct material identity and gameplay role. Crystal and metallic Aetherium have their own applications.
- Superior Machines provide optional, parallel throughput and automation upgrades within one shared tier.
- New players have a clear recommended route. Experienced UtilityCraft players can use existing knowledge and infrastructure to solve production requirements through alternative setups.
- Singularities reward sustained bulk production and resource handling at scale.
- Kyarium concludes the main material progression. Later additions focus on lateral expansion, challenges, convenience, and rewards.

## Machine and infrastructure placement

- **Titanium** introduces Compactor, Decompactor, the Steam Boiler/Vaporizer line, Cryo Chamber, Cryo Reservoir, and Cold Fusion Reactor. Steam Boiler and Vaporizer carry forward the processing role previously assigned to Vaporworks Processor.
- **Tungsten** introduces the [Superior Machines program](#superior-machines-program). The branches share the Superior tier and provide production choices within that stage.
- **Aetherium Crystals** covers Enchantment Station, Refining Table, Alchemical Station, Essence Collector, Mob Chamber, and Catalyst Weaver.
- **Aetherium Metal** covers Absolute Container, Liquifier, Fluid Crystallizer, Energizer, Residue Processor, Laser Barrier, Laser Bridge, and Network Center. It also covers the Absolute generator/storage line, Overclock Tower, Overclock Relay, Reinforced Cable, Universal Cable, Universal Importer, Universal Exporter, and Power Beacons.
  - The stage's generator/storage roster includes Absolute Furnator, Absolute Magmator, Absolute Thermo Generator, Absolute Solar Panel, and Absolute Battery.
- **Niobium** covers Material Property Generator, Climate Controller, Duplicator, Quantum Reactor, and Aurora's Lance. Item Phaser, Liquid Phaser, and Gas Phaser join its transport line. Energy Core, Thermal Regulator, Containment Matrix, Resonant Casing, Way Device, and Pearl Aligner belong to this stage.
- **Singularities** introduces the Singularity Fabricator compression rework and Kyarium Matrix. The 9×9 crafting system supports end-game assembly, with its exact unlock point still open.
- **Kyarium** unlocks Kyarium Furnator, Kyarium Magmator, Kyarium Property Generator, Kyarium Solar Panel, Kyarium Thermo Generator, Kyarium Wind Turbine, Particle Condenser, Universal Phaser, and the final armor and tool sets.

## Aetherium synthesis

- Move Cryo Chamber, Cryo Freezer, Cryofluid Synthesizer, and Cryo Stabilizer before Catalyst Weaver in the main progression. Their initial recipes use resources obtainable before industrial Aetherium.
- Rework Catalyst Weaver construction to fit that entry stage.
- Use the following planned synthesis inputs.

| Input | Amount |
|---|---:|
| Netherite Ingot | 1 |
| Titanium Dust | 8 |
| Tungsten Dust | 8 |
| New Aetherium Fragments or existing Aetherium Crystals | 8 fragments or 2 crystals |
| Ender Pearl Dust | 8 |
| Cryofluid | 1,600 mB |

- Add **Titanium & Tungsten Dust**, with the subtitle **Mixed** and identifier `tingstanium_dust`. Combining one Titanium Dust with one Tungsten Dust produces two Mixed Dust.
- Offer automation alternatives that consume 16 Mixed Dust in place of the eight Titanium Dust and eight Tungsten Dust. Preserve both recipes with separate metal powders and both fragment/crystal alternatives.
- Increase Aetherium ore availability in the Overworld. Generation frequency and distribution remain to be balanced.

## Niobium and replication

- Obtain raw Niobium through End mining or sieving. Its End distribution should be less abundant than local Aetherium while supporting deliberate acquisition.
- Process Niobium through four confirmed stages.
  1. Obtain raw Niobium through mining or sieving.
  2. Use Energizer and a considerable energy input to produce unstable Niobium.
  3. Condition the unstable Niobium in Catalyst Weaver using Liquified Aetherium.
  4. Stabilize the conditioned Niobium through cryogenic processing to obtain its usable form.
- Move Duplicator construction to the Niobium stage. Liquifier and Liquified Aetherium remain part of its operating chain.
- Introduce Thermal Regulators, Energy Cores, and Containment Matrices alongside the existing Chips and Machine Cases. Containment Matrices serve specialized matter-containment applications.
- Keep **Reinforced Machine Case** as the Singularity Fabricator chassis. Change that case's recipe to use Aetherium Blocks in place of ingots, and give the Fabricator a Niobium dependency through its advanced components.
- Rename the final case concept **Resonant Casing**, above Reinforced Machine Case.

## Singularities and Kyarium

- Rework **Singularity Fabricator** into extreme material compression. Each eligible material produces its corresponding Singularity, with costs measured in millions of equivalent base units.
- Credit blocks and compressed forms proportionally to their verified material content. Eligible materials, per-family costs, and conversion rules still need a complete definition.
- Limit the initial material survey to **Vanilla, UtilityCraft, and Ascendant Technology**. Future integrations will add required Singularities when their corresponding expansions are installed.
- Add a **9×9 Crafting Table** for end-game assembly. Its name, recipe, and exact position within the pre-Kyarium stage remain open.
- Rename **Interdimensional Infuser** to **Kyarium Matrix** and use it to produce Kyarium from Singularities.
- Target approximately **1 TDE per Kyarium craft**, supplied through continuous high-power input. Required input power, crafting duration, buffer size, and interruption behavior still need to be specified.
- Make the first Kyarium craft achievable with pre-Kyarium generation and transfer infrastructure.
- Add Kyarium armor and tools, including the planned Ascendant Omni-Tool, and generators targeting **128×** their corresponding predecessors. Exact equipment statistics and generator baselines remain open.

---

# Summary by category

## Machines

| New Machines | Superior Machines |
|---|---|
| 🟡 **9×9 Crafting Table** | 🟢 **Abyssal Fisher** |
| 🟢 **Absolute Container** | 🟢 **Arc-Press Forge** |
| 🟢 **Alchemical Station** | 🟢 **Arcane Enchanter** |
| 🟠 **Atmospheric Synchronizer** | 🟢 **Centrifugal Siever** |
| 🟡 **Aurora's Lance** | 🟢 **Cryo Freezer** |
| 🟢 **Catalyst Weaver** | 🟢 **Cryo Stabilizer** |
| 🟡 **Climate Controller** | 🟢 **Cryofluid Synthesizer** |
| 🟡 **Cold Fusion Reactor** | 🟢 **Disenchanter** |
| 🟢 **Compactor** | 🟢 **Dual Siever** |
| 🟢 **Cryo Chamber** | 🟢 **Genetic Seed Synthesizer** |
| 🟢 **Decompactor** | 🟢 **Impact Crusher** |
| 🟥 **Dismantler** | 🟢 **Industrial Burner** |
| 🟢 **Duplicator** | 🟢 **Industrial Crucible** |
| 🟢 **Enchantment Station** | 🟢 **Mob Slasher** |
| 🟢 **Energizer** | 🟢 **Pattern Placer** |
| 🟡 **Essence Collector** | 🟢 **Pulverizer** |
| 🟡 **Fluid Crystallizer** | 🟢 **Reinforcement Anvil** |
| 🟡 **Kyarium Generators** | 🟢 **Seismic Breaker** |
| 🟡 **Kyarium Matrix** | 🟢 **Verdant Cultivator** |
| 🟢 **Laser Barrier** | — |
| 🟡 **Laser Bridge** | — |
| 🟢 **Liquifier** | — |
| 🟡 **Material Property Generator** | — |
| 🟡 **Mob Chamber** | — |
| 🟥 **Orbital Command Terminal** | — |
| 🟡 **Particle Condenser** | — |
| 🟡 **Quantum Reactor** | — |
| 🟢 **Refining Table** | — |
| 🟢 **Residue Processor** | — |
| 🟢 **Singularity Fabricator** *(1.0 rework planned)* | — |
| 🟢 **Steam Boiler / Vaporizer** | — |

## Items, gear, materials, and systems

| Items, Gear & Materials | Infrastructure & Systems |
|---|---|
| 🟡 **Aetherium Fragment** | 🟡 **9×9 Crafting Table** |
| 🟡 **Aetherium synthesis rework** | 🟡 **Cryo Reservoir** |
| 🟡 **Ascendant Omni-Tool** | 🟡 **Item Phaser / Liquid Phaser / Gas Phaser** |
| 🟡 **Containment Matrix** | 🟢 **Network Center** |
| 🟡 **Dark Matter Crystal** | 🟢 **Overclock Boost Network** |
| 🟡 **Energy Core** | 🟢 **Overclock Relay** |
| 🟡 **Item Energizer Pad** | 🟢 **Overclock Tower** |
| 🟡 **Kyarium** | 🟢 **Power Beacons** |
| 🟡 **Kyarium armor and tool sets** | 🟢 **Reinforced Cable** |
| 🟡 **Niobium** | 🟡 **Reinforced Machine Case recipe rework** |
| 🟡 **Pearl Aligner** | 🟡 **Resonant Casing** |
| 🟡 **Portable Power Cell** | 🟠 **Rift Anchor** |
| 🟡 **Singularities** | 🟡 **Thermal Regulator** |
| 🟡 **Titanium & Tungsten Dust (Mixed)** | 🟢 **Universal Cable Network** |
| 🟢 **Tungsten** | 🟡 **Universal Phaser** |
| 🟡 **Way Device** | — |

---

# New Additions (Machines)

- 🟡 **9×9 Crafting Table**
  - Supports end-game recipes with an 81-slot crafting grid.
  - Belongs to the infrastructure used to assemble pre-Kyarium and final-stage content.
  - Its final name, construction recipe, recipe roster, and exact unlock point remain open. Using it to assemble Resonant Casing is still a proposal.

- 🟢 **Absolute Container**
  - **Purpose:** Singular vault for high-capacity item, fluid, and energy storage.
  - **Operating Mode:** 14×12 item grid + fluid/energy indicators.
  - **Notes:** Storage-only, no upgrade clutter.
    - To be updated. Will receive a storage size buff, as long as upgrades for capacity.

- 🟢 **Alchemical Station** *(formerly the `Enchanted Brewing Stand` concept)*
  - **Purpose:** Late-game brewing machine that combines alchemy and science to produce stronger, longer-lasting, and otherwise unobtainable potions.
  - **Operating Mode:** Uses a brewing input, effect reagents, catalysts, and optional conversion components to process upgraded potion recipes in a dedicated station interface.
  - **Core Progression:** For each supported effect, the initial scope includes at least three new potion variants:
    1. **Maximum Extended Level I:** the Level I effect with four times the duration of the normal long potion.
    2. **Extended Level II:** the long-duration version of the Level II effect.
    3. **Level III:** a stronger third-level version of the effect.
  - **Missing Effects:** Adds new potion families for effects that are absent from the current brewing progression, subject to recipe, balance, and effect-availability review.
  - **Potion Conversion:** Supports deliberate conversion paths between compatible potion forms and states, such as normal, splash, and lingering variants where the effect and recipe rules allow it. Conversion must preserve the intended effect tier and duration instead of silently resetting progression.
  - Available since 0.9.3 with six-bottle brewing, amplification and extension through a shared central potion slot, drinkable/splash/lingering forms, and 35 potion families. Amplification and extension use 1,000/750 mB Aetherium respectively. Brewing consumes 250 mB Blaze per batch, and the Blaze/Aetherium reservoirs store 64,000/128,000 mB.

- 🟡 **Aurora's Lance**
  - **Purpose:** Multiblock defensive turret designed to eliminate hostile targets with high-energy beams.
  - **Operating Mode:** Automatically targets hostile entities and consumes DE for each fired beam.
  - **Structure:** Up to `3x3` in width and length, with expandable vertical height.
  - **Modules:** Range, Fire Rate, Damage, Beam Count, Efficiency, and Loot Teleporter.
  - **Loot Teleporter:** Teleports drops from killed targets to a dedicated Receiver Casing.
  - **Lore:** Uses DE to communicate with orbital satellites that coordinate its attacks.
  - An optional Niobium-stage military/orbital technology that uses Niobium and Energy Cores to conduct and concentrate energy with the Light element of StatsCore.
  - Its visual identity is warm, golden, and luminous, expressing concentrated Light.

- 🟢 **Catalyst Weaver**
  - **Purpose:** High-tier fusion of multi-catalyst reactions.
  - **Operating Mode:** Up to 6 catalysts + fluid interaction + residue handling.
  - **Notes:** Built for unstable and expensive reactions.
  - The 1.0 recipe rework places construction after the cryogenic family and before industrial Aetherium. It performs the new Aetherium synthesis and mandatory Niobium treatment with Liquified Aetherium.

- 🟡 **Climate Controller**
  - Planned for the Niobium stage as an altar-like multiblock structure.
  - Uses catalysts and DE to control weather, with the catalysts determining the intended operation.
  - Weather recipes, energy costs, activation rules, and the multiblock layout remain open.

- 🟢 **Compactor**
  - **Purpose:** Automatically compress compatible materials into denser forms.
  - **Operating Mode:** Converts materials into their corresponding compressed variants.
  - **Examples:** Nuggets → Ingots, Ingots → Blocks, Quartz → Quartz Blocks.
  - **Automation:** Continues through multiple compression stages when possible.

- 🟢 **Cryo Chamber**
  - **Purpose:** Thermal stabilization, cooling operations, and Cryofluid generation.
  - **Operating Mode:** Three operational domains:
    1. Stabilizer
    2. Cooling Chamber
    3. Cryofluid Generator
  - **Notes:** Core machine for future cold-chain industry.
  - Its planned 1.0 acquisition precedes Catalyst Weaver and industrial Aetherium, alongside the dedicated cryogenic branches.

- 🟢 **Decompactor**
  - **Purpose:** Reverse only the material and item compactions registered for the Compactor.
  - **Operating Mode:** Uses 3×3 input and output buffers; one dense item is converted into its exact preceding material quantity.
  - **Upgrades:** Uses the same four upgrade fields as the Compactor: Speed, Energy, Hyper Processing, and Stack.
  - **Layout:** The four upgrade slots must be positioned immediately before its 3×3 output buffer.
  - **Recipe Source:** Builds its reverse mapping from the Compactor configuration, including all compressed blocks and compatible items such as bags and bundles.
  - **Safety:** Stops when output space is insufficient and never acts as a general reverse-crafting or item-recovery machine.
  - **Branch Handling:** Ambiguous reverse mappings fail closed; the current Compactor registry exposes 401 unique outputs and no conflicts.
  - **Scope:** Implemented as a dedicated machine, separate from the paused Dismantler, with its own runtime, recipe, creative entry, and routed 3×3 interface.

- 🟥 **Dismantler** *(Paused)*
  - **Status:** Removed from active implementation scope in Ascendant Technology.
  - **Reason:** Reverse-crafting recovery was cut from the current superior machines rollout.
  - **Note:** Existing runtime implementation and related assets were removed from the pack.

- 🟢 **Duplicator**
  - **Purpose:** Late-game replication with high energy and fluid costs.
  - **Operating Mode:** Template-driven, continuous energy draw.
  - Planned 1.0 construction requires Niobium. Liquified Aetherium remains an operational resource supplied by Liquifier.
  - Duplication eligibility for Niobium intermediates, Singularities, and Kyarium remains to be defined.

- 🟢 **Enchantment Station**
  - **Purpose:** High-tier repair + enchant + reinforcement hub.
  - **Operating Mode:** Module-driven behavior with invasive late-game scaling.

- 🟢 **Energizer**
  - **Purpose:** Convert base resources into energized line variants.
  - **Operating Mode:** Input + optional auxiliary path to output conversion.

- 🟡 **Fluid Crystallizer**
  - Planned for the Aetherium Metal stage, producing Aetherium Crystals and the new Dark Matter Crystals.
  - Additional crystallization recipes may use Vanilla and AT resources.
  - Exact liquid inputs, catalysts, yields, energy costs, and the additional recipe roster remain open.

- 🟡 **Kyarium Generators**
  - **Purpose:** End-game DE generators built around Kyarium technology.
  - **Operating Mode:** Generates massive amounts of DE and supports dedicated modifiers and Overclock.
  - Planned 1.0 performance targets 128× the corresponding predecessor. Generation, storage, transfer limits, and the predecessor used for each comparison still need explicit values.
  - The planned roster includes Kyarium Furnator, Kyarium Magmator, Kyarium Property Generator, Kyarium Solar Panel, Kyarium Thermo Generator, and Kyarium Wind Turbine.
  - **Modifiers:**
    - **Flux Amplifier:** Increases generation rate.
    - **Efficiency Matrix:** Reduces resource consumption.
    - **Resonance Stabilizer:** Reduces Overclock penalties.
    - **Capacitive Lattice:** Increases internal DE capacity.
    - **Transfer Matrix:** Increases DE transfer rate.
    - **Adaptive Governor:** Adjusts generation according to network demand.

- 🟢 **Laser Barrier**
  - **Purpose:** Defensive projected energy field.
  - **Operating Mode:** Continuous DE drain + dimension upgrades.

- 🟡 **Laser Bridge**
  - **Purpose:** Horizontal counterpart to the Laser Barrier that creates walkable energy bridges.
  - **Operating Mode:** Projects a horizontal energy surface while continuously consuming DE.

- 🟢 **Liquifier**
  - **Purpose:** Convert solids into industrial liquids.
  - **Operating Mode:** Heat + energy conversion with tank visualization.

- 🟡 **Material Property Generator**
  - A new passive generator that uses the block directly below it as its energy source.
  - Explores material emission and conductivity. Typical sources include Redstone, Energized Iron, Niobium, and compatible radioactive materials.
  - The source block is retained during passive generation.
  - Its progression is Basic → Advanced → Expert → Ultimate → Absolute → Pure → Kyarium.
  - Pure is exclusive to Niobium technology and occupies the intermediate "6.5" step between Absolute and Kyarium. It extracts the energy properties of the chosen source more efficiently.
  - Optional integrations may add source blocks such as Heavy Machinery Uranium. The base progression uses Vanilla, UtilityCraft, and AT resources.
  - Exact source-block eligibility, per-source generation values, Pure efficiency, storage, transfer limits, and tier recipes remain open.

- 🟢 **Network Center**
  - **Purpose:** Power network observability and diagnostics.
  - **Operating Mode:** Scans nodes/cables/machines and computes stability.

- 🟢 **Overclock Boost Network**
  - **Purpose:** Infrastructure-level machine overclocking.
  - **Core Blocks:** Overclock Tower + Overclock Relay + Reinforced Cable.

- 🟡 **Quantum Reactor**
  - The final multiblock energy generator planned for Ascendant Technology 1.0, placed in the Niobium stage.
  - Produces massive amounts of DE through a reaction involving liquids, radioactive or alien inputs, gases, and sustained temperature management.
  - Uses a dedicated reactor subsystem to coordinate the reaction, resource flows, thermal state, and energy production.
  - Specific fuels and reagents, coolant and gas roles, operating temperature ranges, structure, energy output, and failure behavior remain open.

- 🟢 **Refining Table**
  - The existing equipment refinement machine belongs to the Aetherium Crystal stage in the 1.0 progression.

- 🟢 **Residue Processor**
  - **Purpose:** Turn production residues into recovered outputs or neutral waste.

- 🟢 **Singularity Fabricator** *(1.0 rework planned)*
  - The existing machine performs specialized replication. The planned 1.0 rework converts eligible materials into their corresponding Singularities.
  - Each Singularity requires extreme quantities of one supported material and contributes to Kyarium production.
  - Planned 1.0 construction uses Reinforced Machine Case and Niobium-dependent components. The case recipe will use Aetherium Blocks.
  - Material accounting covers ingots, blocks, and compressed forms at proportional values, with costs in the millions of base-unit equivalents.
  - The initial eligible-material survey covers Vanilla, UtilityCraft, and AT. Exact families and costs remain open.

- 🟢 **Universal Cable Network**
  - **Core Blocks:** Universal Cable + Universal Importer + Universal Exporter.
  - Available since 0.9.3 as unified logistics for items, liquids, gases, energy, and overclock, with dedicated importer/exporter transfer configuration.
  - The 1.0 progression places this infrastructure in the Aetherium Metal stage.
  - **Design Requirement:** Universal routing must expose fine control per side, per resource type, and per importer/exporter endpoint.

- 🟡 **Particle Condenser** *(formerly Vacuum Particle Condenser)*
  - **Purpose:** A late-game environmental machine that condenses ambient particles into solid resources by reading altitude, dimension, and biome instead of mining blocks directly.
  - **Operating Mode:** The machine filters surrounding air and converts contextual conditions into outputs; higher altitudes favor lighter particulate materials, lower depths favor denser or more compressed results, and special dimension rules can override the default table.
  - **Environment Hook:** Biomes matter; placing it near specific terrain types changes what it can produce, with beach-adjacent placement acting like an enhanced sand-screening path.
  - **Input / Fuel:** Uses DE as fuel and requires Filter Cartridges to define which particle classes are condensed efficiently.
  - **Identity:** This is not a disguised miner; it is a placement-dependent logistics machine whose value comes from location, not from brute-force automation.
  - **Visual:** A large rotor or fan-centered housing with a central condensation chamber, built to sell the idea of suction, pressure, and particle separation.
  - Confirmed for the Kyarium stage in 1.0, retaining the environmental condensation concept under its new name.

- 🟢 **Steam Boiler / Vaporizer** *(Vaporworks rework)*
  - **Steam Boiler:** Basic electric water-to-steam machine, two upgrade slots, 128 kDE and 32,000 mB liquid/gas tanks. One 1,000 mB batch costs 2,400 DE and 160 ticks.
  - **Vaporizer:** Advanced electric processor crafted from the boiler, four upgrade slots, 1.024 MDE and 128,000 mB tanks. Water takes 1,600 DE / 80 ticks; Cryofluid and Saline Coolant keep their existing advanced recipes.
  - **Compatibility:** The legacy Vaporworks ID, 31-slot inventory/migration, storage and runtime stay registered. Only its normal acquisition is retired. No forced replacement of placed blocks.
  - Available since 0.9.3 with runtime, Workbench/Assembler recipes, interfaces, and recipe books. The planned progression places this line in the Titanium stage.

---

# Deferred from Ascendant scope

- 🟥 **RTG** *(discontinued)*
  - The generator family and its associated radioisotope capsule fuel concept were discontinued during the 1.0 planning review.

- 🟥 **Lightning Generator** *(electrical-discharge family, discontinued)*
  - The five-tier lightning-capture generator family was discontinued during the 1.0 planning review.

- 🟥 **Dense Active Generators** *(cancelled since 0.8.2)*
  - The former superior-generator concept was removed from the active program.

- 🟥 **Dimensional Teleporter** *(superseded by the Phaser family)*
  - Its industrial remote-transport role is carried forward by Item Phaser, Liquid Phaser, Gas Phaser, and Universal Phaser.

- 🟥 **Dimensional Flux Generator** *(outside the current selection)*
  - Explored as a single-block generator harvesting activity near an active Nether portal.

- 🟥 **Aetherium Dissociation Generator** *(outside the current selection)*
  - Explored as crystal-powered generation with possible soul and mana interaction through Dorios' Trinkets.

- 🟥 **Gravitational Accretion Generator** *(rejected)*
  - The proposed matter-feed and instability-management loop exceeded the intended complexity of the new simple generator families.

- 🟥 **Entity-motion Kinetic Generator** *(rejected)*
  - The proposed motion-sensing loop was rejected as an artificial generation mechanic.

- 🟥 **Water Wheel**
  - **Ascendant status:** Removed from generator progression.
  - **Marker:** `Planned for other expansion`.
  - **Reason:** Ascendant generator identity is being pushed toward denser, advanced high-tech systems instead of hydro-kinetic early-mid solutions.

---

# Superior Machines program

Superior Machines are now treated as one unified program.

A superior block can come from:

- a UtilityCraft machine upgraded into a denser industrial branch
- a standalone branch extracted from a complex Ascendant machine with multiple sections

All superior machines are listed below in **alphabetical order**.

Unless explicitly stated otherwise, Superior Machines use a **single operating profile**. Alternate selectable modes are reserved for **Pattern Placer** and **Seismic Breaker**.

- 🟢 **Abyssal Fisher** *(from `autofisher`; runtime IDs can stay `abyssal_*` for now)*
  - **Purpose:** Remote batch fishing machine with internal water logistics and abyssal loot scaling.
  - **Operation:** Runs one reinforced batch-fishing cycle using fishing nets and an internal water tank instead of requiring a nearby source block.
  - **Environment Hook:** Water quality, dimension context, and abyssal bonus rules can affect the loot table.

- 🟢 **Arcane Enchanter** *(from `Enchantment Station`, standalone enchanting branch)*
  - **Purpose:** Dedicated enchanting machine that exists purely to remove the repair and disenchant clutter from the Enchantment Station.
  - **Operation:** Uses a focused gear grid and module lane for enchanting only, keeping the same core module logic while running faster than the Enchantment Station.
  - **Identity:** Its value comes from specialization and speed, not from a giant new profile tree.

- 🟢 **Arc-Press Forge** *(from `electro_press`)*
  - **Purpose:** Electrothermal press specialized for high-throughput reinforced processing.
  - **Operation:** Presses items in batches with elevated energy draw and a controlled loss risk.
  - **Upgrade Rule:** Quantity Upgrades expand the batch cap.

- 🟢 **Centrifugal Siever** *(from `autosieve`, batch path)*
  - **Purpose:** Industrial bulk-processing siever focused on one material stream at a time.
  - **Operation:** Four shared input slots feed one reinforced mesh chamber; each cycle locks onto one valid material type, resolves grouped sieve rolls, and deposits everything into one enlarged shared output buffer.
  - **Booster:** Optional steam injection accelerates spin-up and batch throughput.
  - **Rule:** The first release stays focused on batch logic and steam only, without extra preset layers.

- 🟢 **Cryo Freezer** *(from `Cryo Chamber`, standalone Freezing branch)*
  - **Purpose:** Dedicated freezing and cold-crafting machine for recipes that should not compete with stabilization or Cryofluid generation.
  - **Operation:** Runs a freezing grid with independent recipe checks, using water or Cryofluid-backed chains for food reversal, freezing, and cold crafting.
  - **Identity:** This is the pure freezing branch extracted out of the Cryo Chamber.

- 🟢 **Cryofluid Synthesizer** *(from `Cryo Chamber`, standalone Generator branch)*
  - **Purpose:** Dedicated industrial Cryofluid production for bases that outgrow the shared Cryo Chamber generator lane.
  - **Operation:** Runs continuous industrial Cryofluid production with throughput scaling handled by the existing upgrade system.
  - **Separation Rule:** Exists to scale Cryofluid generation without forcing the player to scale the whole Cryo Chamber.

- 🟢 **Cryo Stabilizer** *(from `Cryo Chamber`, standalone Stabilization branch)*
  - **Purpose:** Dedicated stabilization machine for volatile materials that should be handled separately from cooling and Cryofluid generation.
  - **Operation:** Focuses only on stabilization recipes, running a dedicated catalyst/fluid-backed stabilization lane instead of sharing space with other cryogenic roles.
  - **Identity:** This is strictly the stabilization branch; freezing now belongs to its own superior machine.

- 🟢 **Disenchanter** *(from `Enchantment Station`, standalone disenchant branch)*
  - **Purpose:** Specialist machine for enchant extraction and XP-fluid recovery at scale.
  - **Operation:** Runs one unified disenchant flow that extracts enchantments into enchanted books while recovering XP into fluid storage; the Curse Protection module remains supported.
  - **Identity:** It exists to separate disenchant logistics from the Enchantment Station instead of inflating the station further.

- 🟢 **Dual Siever** *(from `autosieve`, split path; pending dedicated assets)*
  - **Purpose:** Run two independent sieve lanes inside one machine while keeping logistics compact.
  - **Operation:** Each lane keeps its own mesh identity and processing logic, but core resources such as energy, upgrades, and output buffering stay shared.
  - **Shared Basics:** Shared energy and shared outputs stay mandatory to avoid pointless logistics sprawl.

- 🟢 **Genetic Seed Synthesizer** *(from `seed_synthesizer`; runtime block `genetic_seed_synthesizer`)*
  - **Purpose:** Agricultural synthesis machine for higher-tier seed improvement and controlled crop mutation.
  - **Operation:** Four seed lanes synthesize together in a shared cycle with one soil slot and one Cryofluid lane.
  - **Constraint:** Higher-tier reagents and thermal stability should remain part of its identity.

- 🟢 **Impact Crusher** *(from `crusher`, aggressive path)*
  - **Purpose:** High-risk crusher branch built for peak output under controlled thermal danger.
  - **Operation:** Dual processing lanes draw on lava, build heat, and consume coolant while pushing much harder than the Pulverizer.
  - **Failure State:** If it overheats, it stops, burns half of the current inputs and buffered outputs, plays burning-item feedback, and stays locked until temperature fully drops and the player reseats the input.

- 🟢 **Industrial Burner** *(from `incinerator`)*
  - **Purpose:** Multi-input and multi-output incineration machine for high-volume trash-to-value and high-heat pre-processing.
  - **Operation:** Three input lanes and three output lanes process at the same time, with optional lava injection increasing batch volume per cycle.
  - **Byproduct Hook:** Selected recipes can route ash or residue into a dedicated result lane instead of deleting it.

- 🟢 **Industrial Crucible** *(from `magmatic_chamber`)*
  - **Purpose:** Thermal chamber for heat-intensive industrial work where process heat matters as a reusable resource.
  - **Operation:** Stores heat and steam internally, gains efficiency while working inside a healthy thermal window, and loses that efficiency when pushed too close to unsafe temperature.
  - **Thermal Role:** Heat should both power the machine and become a stored resource for adjacent industrial systems.

- 🟡 **Mob Slasher** *(from `mob_grinder`)*
  - **Purpose:** Superior Mob Grinder built to replace roughly four to five standard Grinders with one larger, stronger, longer-range machine.
  - **Operation:** Processes mobs across an expanded area and automatically collects the XP produced by kills.
  - **XP Routing:** Sends collected XP to a player-configurable destination.

- 🟢 **Pattern Placer** *(from `block_placer`)*
  - **Purpose:** Placement machine for world automation patterns that are too complex for a simple block placer.
  - **Operating Modes:** Supports `Grid`, `Line`, and `Alternation` placement logic with tag filters and block blacklist control.
  - **Placement Identity:** Complexity comes from deterministic layout logic, not just larger inventory size.

- 🟢 **Pulverizer** *(from `crusher`, stable path)*
  - **Purpose:** Stable industrial crusher upgrade with stronger buffers and steam-assisted acceleration.
  - **Operation:** Processes crusher recipes with higher energy draw and optional steam-fed throughput increase while keeping a safer operating profile than the Impact Crusher.
  - **Industrial Hook:** Larger internal space and batch-friendly routing are part of the appeal, not just speed.

- 🟢 **Reinforcement Anvil** *(from `induction_anvil`)*
  - **Purpose:** Advanced repair and reinforcement machine for dense metallurgy and gear recovery.
  - **Operation:** Resolves repair or reinforcement from the inserted item and materials without a selectable operating mode; reinforcement remains tied to Enchantment Station modules and a cooldown-based reuse window.
  - **Reinforcement Ladder:** Supports `Reinforcement Module IV` and `V` for `150%` and `200%` reinforcement targets.

- 🟢 **Seismic Breaker** *(from `block_breaker`)*
  - **Purpose:** Area-mining automation machine with controllable excavation patterns.
  - **Operating Modes:** Supports `1x1`, `3x3`, and `Line` modes, with a Precision toggle for preserving special drops where possible.
  - **Scaling Rule:** Energy cost scales with the selected affected area.

- 🟢 **Verdant Cultivator** *(from `harvester`; replaces the old `Chrono Harvester` name)*
  - **Purpose:** Large-scale crop automation machine that plants, fertilizes, harvests, and buffers produce in one superior agricultural block.
  - **Operation:** Accepts a Pedestal Clock in a dedicated slot to pulse bonemeal periodically, scales range from `3x3` up to `17x17`, uses Quantity level `1-4` as a fortune-style harvest bonus, plants from a `2x2` seed grid, and stores harvests in an internal `3x3` buffer when no rear container is attached.
  - **Biome Hook:** Can gain crop-specific bonuses from the biome where it is working.

## Locked design decisions from review (2026-04)

- **Abyssal Fisher** is the correct player-facing name; internal `abyssal_*` identifiers can stay until a runtime migration is worth the churn.
- **Adaptive Assembler** and **Quantum Digitizer** are out of the current superior roster because neither one has a strong enough gameplay justification right now.
- **Arcane Enchanter** stays simple: dedicated enchanting plus a speed advantage is enough.
- **Centrifugal Siever v1** stays batch + steam only.
- **Cryo Chamber** now branches into three separate superior specialists: **Cryo Freezer**, **Cryofluid Synthesizer**, and **Cryo Stabilizer**.
- **Disenchanter** uses one unified disenchant flow with Curse Protection module support.
- **Dual Siever** lanes should feel distinct, but shared energy/output remain mandatory.
- **Genetic Seed Synthesizer** uses one shared synthesis flow without alternate profile modes.
- **Impact Crusher** uses a destructive overheat failure state instead of self-damage or passive venting.
- **Industrial Crucible** should reward healthy heat management with both efficiency and stored thermal resources.
- **Reinforcement Anvil** can grow into higher reinforcement tiers through Module IV/V.
- **Superior Machine modes:** selectable alternate modes are reserved for **Pattern Placer** and **Seismic Breaker**.

## Mob and essence automation line

- 🟡 **Essence Collector**
  - **Role:** Late-game automation block for recovering mob essence near grinder setups.
  - **Placement Rule:** Must be placed within active collection range of a Mob Grinder zone.
  - **Balance Rules:** Netherite-tier crafting cost, slower than manual offhand collection, and requires DE to operate.
  - **Automation Hooks:** Fills Essence Vessels over time and supports routing/filter behavior through existing Filter Upgrade flow.
  - **Target Loop:** `Mechanical Spawner -> Mob Grinder -> Essence Collector -> Spawner`.

---

# Planned items, gear, and materials

- 🟡 **Ascendant Omni-Tool**
  - **Purpose:** Endgame configurable multi-tool that consolidates core Minecraft and UtilityCraft tool roles into one item.
  - **Operating Mode:** Context-sensitive tool routing with toggleable utility traits and adjustable area settings.
  - Planned as a Kyarium-stage reward alongside the final armor and tool sets. Equipment statistics and crafting details remain open.
  - **Tool Set:**
    - Pickaxe
    - Axe
    - Shovel
    - Hoe
    - Sword
    - Shears
    - Flint and Steel
    - Blazing Pickaxe
    - Hammer
    - Knife
  - **Configurable Traits:**
    - **Base Tool Mode:**
      - Dirt, Grass, Podzol, Mycelium, and Rooted Dirt: `Shovel`, `Hoe`, or `Tractor`
      - Stone variants: `Pickaxe`, `Hammer`, or `Blazing Pickaxe`
      - Leaves: `Hoe`, `Shears`, or `Knife`
      - Ores: `Pickaxe` or `Blazing Pickaxe`
      - Sand: `Shovel`, `Hammer`, or `Blazing Pickaxe`
      - Gravel: `Shovel` or `Hammer`
    - **Ability Toggles:** `Auto-Smelt` and `Silk Touch`
    - **Efficiency Settings:**
      - `1x1` (default): Haste effect with base Gold tool speed
      - `3x3`: base Gold tool speed
      - `5x5`: base Gold tool speed

- 🟡 **Aetherium Fragment**
  - A new material form used in the 1.0 Aetherium synthesis alternatives.
  - Eight fragments replace two existing Aetherium Crystals in the planned recipe.
  - Its acquisition and processing routes still need to be defined.

- 🟡 **Aetherium synthesis rework**
  - Requires the pre-Aetherium cryogenic chain and Catalyst Weaver.
  - Uses the quantities and fragment/crystal alternatives listed in the [Aetherium synthesis plan](#aetherium-synthesis), including the Mixed Dust automation alternatives.
  - Includes a more accessible Overworld ore distribution, with generation parameters still to be defined.

- 🟡 **Titanium & Tungsten Dust** *(Mixed)*
  - Uses the identifier `tingstanium_dust`.
  - One Titanium Dust and one Tungsten Dust produce two Mixed Dust.
  - Sixteen Mixed Dust replace the two eight-dust metal inputs in either Aetherium fragment/crystal recipe. The separate-powder recipes remain available.

- 🟡 **Dark Matter Crystal**
  - A new material produced by Fluid Crystallizer.
  - Its crafting uses, material relationships, and production recipe remain open.

- 🟡 **Kyarium**
  - **Type:** Gem.
  - **Purpose:** Supreme material of Ascendant Technology and the endpoint of its material progression.
  - Produced from Singularities in Kyarium Matrix, with an approximately 1 TDE energy target per craft and continuous high-power supply.
  - Unlocks final generators, a complete armor set, and a complete tool set. Exact statistics and recipes remain open.
  - Represents the Perfect Gem and the final material of the standard progression. Subsequent content develops lateral challenges, convenience, and rewards.

- 🟡 **Kyarium armor and tool sets**
  - Final-stage equipment crafted through the Kyarium progression, alongside Ascendant Omni-Tool.
  - Intended to provide powerful armor and tools. Individual attributes, abilities, durability, and crafting recipes remain open.

- 🟡 **Niobium**
  - **Purpose:** High-tier technical metal used in pre-Kyarium machinery and advanced energy-handling components.
  - Its identity centers on purity, exceptional conductivity, precision, confinement, and operation of highly sensitive systems.
  - **Integration:** Primary material for Thermal Regulators, Energy Cores, and other late-game machine components.
  - Obtained initially in raw form through mining or sieving of End resources. Its End abundance should be below local Aetherium without making acquisition exceptionally rare.
  - Its confirmed processing chain is raw Niobium → Energizer activation into unstable Niobium → Catalyst Weaver conditioning with Liquified Aetherium → cryogenic stabilization into usable Niobium.
  - Exact energy costs, fluid quantities, yields, and names for each material form remain open.
  - Unlocks Duplicator construction and advanced components used by Singularity Fabricator.

- 🟡 **Thermal Regulator**
  - **Purpose:** Advanced machine component responsible for cooling, thermal control, and sustained operation under extreme loads.
  - **Integration:** Used by high-output machines, Overclock-capable systems, cryogenic machinery, and other heat-intensive equipment.
  - **Progression Role:** One of the primary component families for pre-Kyarium machines.

- 🟡 **Energy Core**
  - **Purpose:** High-capacity energy component designed to absorb, buffer, and release sudden DE loads.
  - **Integration:** Used by machines with extreme power demand, high transfer rates, or large instantaneous energy requirements.
  - **Progression Role:** One of the primary component families for pre-Kyarium machines.

- 🟡 **Containment Matrix**
  - **Purpose:** Specialized component for safely containing highly compressed matter, unstable materials, and extreme energy phenomena.
  - **Integration:** Reserved for machines involving Singularities, matter manipulation, teleportation, replication, or similar end-game processes.
  - **Progression Role:** Rare specialized component rather than a standard requirement for every advanced machine.
  - Confirmed for the Niobium-stage component roster in 1.0, with specific recipes and machine assignments still to be defined.

- 🟡 **Reinforced Machine Case recipe rework**
  - Replace Aetherium Ingots with Aetherium Blocks in the planned 1.0 recipe.
  - Remains the chassis required by Singularity Fabricator.

- 🟡 **Resonant Casing** *(formerly Absolute Machine Case)*
  - **Purpose:** Final structural machine casing tier above the Reinforced Machine Case.
  - **Integration:** Used as the primary chassis for the most advanced pre-Kyarium and end-game machinery.
  - **Progression Role:** Structural foundation for machines that exceed the operating limits of Reinforced machinery.
  - Assembly on the 9×9 Crafting Table and use as Kyarium Matrix's chassis are proposals awaiting confirmation.

- 🟡 **Singularities**
  - **Purpose:** Extreme-compression items representing massive quantities of supported materials.
  - **Production:** Created in the Singularity Fabricator from eligible materials.
  - **Progression Role:** Used as core ingredients for Kyarium.
  - Planned costs are in the millions of equivalent material units. Blocks and compressed forms contribute proportionally to their material content.
  - The initial family selection covers Vanilla, UtilityCraft, and AT. Future expansion integrations will extend the required set when installed.
  - Eligible resources, precise costs, conversion tables, and duplication restrictions remain open.

- 🟢 **Tungsten**
  - **Purpose:** Late-game Nether material for dense, heat-resistant tools, machine parts, and superior-machine progression.
  - **Identity:** Built for durability and sustained industrial use rather than raw damage inflation.
  - **Acquisition:** Obtained from a dedicated Nether ore and intentionally excluded from sieving.
  - **Processing:** Pulverize ore into Tungsten dust, then smelt it in a Blast Furnace or Incinerator to produce Tungsten ingots.
  - **Integration:** Used for late-game machine components and other heat-resistant industrial recipes.
  - **Vanilla Variants:** Adds Tungsten-built variants of selected vanilla items, including Flint and Steel.
  - The material's 1.0 design direction also includes a dedicated application of its heat-related properties. That mechanic remains to be chosen.

- 🟡 **Way Device**
  - **Purpose:** Portable teleportation device synchronized with the Waypoints owned by the player.
  - **Waypoint Mapping:** Detects and maps both carpet-based Waypoints and Waypoint Centers.
  - **Operation:** Allows teleportation to a synchronized Waypoint regardless of the player's current location.
  - **Range Upgrades:** Supports distance upgrades ranging from `1,000` to `16,000` blocks.

- 🟡 **Pearl Aligner**
  - Included in the Niobium-stage item roster for 1.0.
  - Its operating purpose, acquisition, and relationship to other progression systems remain undefined.

---

# Planned core systems (still valid)

- 🟡 **Cryo Reservoir**
  - A Titanium-stage machine for mass Cryofluid generation.
  - Uses a modular interface and processes inputs gradually over time at mass-production scale.
  - Requires an extra ingredient in addition to the Cryofluid production inputs. Its identity, quantity, and acquisition remain open.
  - Exact processing rates, energy costs, capacity, and interface modules remain to be specified.

- 🟡 **Kyarium Matrix** *(formerly Interdimensional Infuser)*
  - Produces Kyarium from the required set of Singularities using end-game infrastructure.
  - Targets approximately 1 TDE per craft and requires continuous high-power supply.
  - Its first operation must be supportable by pre-Kyarium generators and transfer infrastructure.
  - Exact power input, operation duration, buffer capacity, interruption behavior, additional fluid requirements, and the final recipe remain open.
  - Future expansion integrations will contribute required Singularities. The initial material survey covers Vanilla, UtilityCraft, and AT.

- 🟡 **Item Energizer Pad**
  - Temporary item enhancement while draining DE continuously.

- 🟡 **Mob Chamber**
  - Closed rectangular titanium multiblock with variable dimensions; UtilityCraft supplies shared modules/cells, while Dorios Core supplies the detection and lifecycle infrastructure.
  - Reusable essences simulate independent mob deaths in discrete parallel batches.
  - Essence Modules unlock slots; Processing Modules provide simultaneous capacity.
  - Consumes energy once per operation and outputs loot to 27 slots plus vanilla XP directly to a fluid tank.
  - Implementation stages: [Mob Chamber plan](docs/uncategorized/mob-chamber-implementation.md).
  - Runtime and placeholder-driven UI implemented: Controller anywhere on the shell, independent batch deaths, single energy payment, persistent clog and 27 loot outputs. Native acceptance and exclusive front textures remain pending.

- 🟡 **Portable Power Cell**
  - Carryable DE storage tiers.

- 🟢 **Power Beacons**
  - Wireless energy distribution placed in the Aetherium Metal stage of the planned progression.

- 🟡 **Item Phaser / Liquid Phaser / Gas Phaser**
  - Confirmed Niobium-stage transport devices for their respective resource types.
  - Wireless transport over large distances within the same dimension, evolving the former Dimensional Teleporter concept into specialized industrial devices.
  - Linking method, range, transfer limits, and energy requirements remain open.

- 🟡 **Universal Phaser**
  - Confirmed Kyarium-stage transport device.
  - Combines multiple resource types in one remote-transport infrastructure and extends it to destinations in other dimensions.
  - Its supported resource channels, linking method, transfer limits, and energy requirements remain open.

---

# Migrated concept bank (from Overall_Concepts)

The following concepts were migrated and normalized into roadmap format.

- 🟠 **Atmospheric Synchronizer**
  - **Purpose:** Manipulate biological conditions within an area.
  - **Operating Mode:** Affects nearby mobs through a configurable synchronization field.
  - **Range:** Supports Range Upgrades.
  - **Notes:** Intended for biological automation without directly killing mobs.

- 🟡 **Cold Fusion Reactor**
  - A large multiblock at the culmination of Titanium's cryogenic technology line.
  - Generates DE through the difference between thermal extremes, with cryogenic operation central to its identity. It is a thermal counterpart to Heavy Machinery's Thermo Reactor.
  - Uses Titanium's visual palette, with a possible darker variant. Operation creates internal ice and visible snow or ice accumulation on the structure.
  - Its recipe unlock point, thermal sources, coolant requirements, structure, output, and operating temperatures remain open.

- 🟥 **Liquid Nitrogen Program** *(Discontinued)*
  - **Purpose:** High-tier coolant chain for advanced systems.
  - **Pipeline:** Catalyst Weaver + Liquifier heavy-energy production path.

- 🟥 **Orbital Command Terminal** *(outside the current 1.0 progression)*
  - Earlier concept for DE-powered orbital prospecting and weather operations.
  - A future return requires a consolidated operating role.

- 🟠 **Rift Anchor**
  - **Purpose:** Transfer resources over long distances and between dimensions.
  - **Operating Mode:** Links a Sender and Receiver through a shared frequency.
  - **Transfer:** Supports items, fluids, DE, and compatible network resources.
  - **Notes:** Cross-dimensional transfer requires more DE.

---

# Cross-pack simplification pass (Ascendant + UtilityCraft)

Based on current behavior from both packs (machine templates, wrench patterns, upgrade flows, and high-complexity slot machines), the roadmap now includes a dedicated simplification pass.

- 🟡 **Complex machine slot/layout simplification**
  - **Priority Targets:** Cryo Chamber, Enchantment Station, and Catalyst Weaver.
  - **Standardization Goal:** Standardize slot groups and labels by role (`input`, `catalyst`, `coolant`, `output`, `residue`).
  - **Usability Goal:** Reduce repeated manual configuration steps through preset memory.

---

# Proposed version 1.0 implementation order

1. Reorder the pre-Aetherium cryogenic and Catalyst Weaver recipes, then implement the Aetherium fragment/crystal and Mixed Dust alternatives. Place the Titanium-stage generation and cryogenic infrastructure alongside this entry chain.
2. Add End Niobium acquisition and its confirmed four-stage processing chain, followed by Thermal Regulators, Energy Cores, and Containment Matrices.
3. Build the Niobium-stage power and transport infrastructure, including Material Property Generator, Quantum Reactor, and the specialized Phasers.
4. Move Duplicator to Niobium and rework Reinforced Machine Case and Singularity Fabricator for large-scale compression. Define eligible Singularity families, material-equivalence tables, and per-family costs.
5. Introduce 9×9 crafting, Resonant Casing, and Kyarium Matrix with a defined sustained-power requirement.
6. Add Kyarium, its generator progression, armor, tools, Particle Condenser, and Universal Phaser.
7. Complete the remaining confirmed 1.0 machines, devices, and environmental systems at their assigned progression stages.

## Open 1.0 decisions

- Confirm whether Passive Redstone Generator is the earlier name of Material Property Generator or a separate family.
- Name Niobium's usable and intermediate forms, and specify the quantities and costs for its confirmed four-stage chain.
- Define **Material Property Generator** per-source outputs, Pure-tier efficiency, storage, transfer limits, and crafting recipes.
- Define **Cryo Reservoir**'s extra ingredient, modular interface, processing rate, energy use, and capacity.
- Define **Fluid Crystallizer** input recipes for Aetherium Crystals and Dark Matter Crystals, then evaluate additional Vanilla and AT recipes. Specify uses for the new Dark Matter Crystals and acquisition for the new Aetherium Fragments.
- Define **Climate Controller** weather catalysts, energy costs, activation rules, and multiblock structure.
- Define **Quantum Reactor** structure, fuels and reagents, liquid/gas roles, thermal behavior, energy production, and failure behavior within its dedicated subsystem.
- Define **Cold Fusion Reactor** construction requirements, thermal sources, coolant, energy output, temperature behavior, and its exact unlock point within the Titanium technology line.
- Recover or define the purpose of **Pearl Aligner**.
- Define **Item Phaser**, **Liquid Phaser**, and **Gas Phaser** linking, range, transfer limits, and energy consumption for same-dimension transport. Specify **Universal Phaser** resource channels and cross-dimensional operation.
- Resolve the older **Rift Anchor** concept in relation to the confirmed Phaser line.
- Specify **Particle Condenser** output tables, filter recipes, production rates, and energy costs for its Kyarium-stage environmental processing.
- Define the 9×9 table's final name, recipe, unlock point, and role in assembling Resonant Casing and Kyarium Matrix.
- Specify Singularity families, material-unit costs, expansion requirements, excess-material handling, and duplication rules for the new progression materials.
- Specify Kyarium Matrix's required power, duration, buffer, and behavior during supply interruptions.
- Specify Kyarium equipment statistics and the generator predecessor used for each 128× comparison.

---

# Notes

- Variants imported from UtilityCraft must include either:
  - New mechanical behavior, or
  - Meaningful systems integration (overclock, steam, cooling, tungsten internals).
- "Dual" variants should justify complexity with deterministic throughput gains and clearer logistics choices.

---

# Executive update (2026-03)

- **Water Wheel** is no longer part of Ascendant Technology's generator line.
  - Status in Ascendant: *🟥 On Hold / Cut*
  - Marker: *Planned for other expansion*
- Ascendant will keep machine inspiration from UtilityCraft, but express that growth through a unified **Superior Machines** program with stronger identity and functionality upgrades.
- Tungsten-focused industrial content is now prioritized (durability, heat handling, dense machinery casing).
- Steam supports industrial processing. The Liquid Nitrogen Program is discontinued.

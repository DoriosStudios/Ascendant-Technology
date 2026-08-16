## Roadmap
The overall roadmap for Ascendant Technology. This is the source of truth for planned features, implementation status, and development priorities.

Machine status legend:
- 🟢 Implemented (in-game)
- 🟣 Needs Design (Done, but missing assets)
- 🔵 In Development (actively being built)
- 🟡 Planned (Not started or confirmed)
- 🟠 Not Confirmed (doesn't have a defined plan)
- 🟥 On Hold / Cut (Paused or no longer planned)

---

# Summary by category

## Machines

| New Machines | Superior Machines |
|---|---|
| 🟢 **Absolute Container** | 🟢 **Abyssal Fisher** |
| 🟠 **Atmospheric Synchronizer** | 🟢 **Arcane Enchanter** |
| 🟡 **Aurora's Lance** | 🟢 **Arc-Press Forge** |
| 🟢 **Catalyst Weaver** | 🟢 **Centrifugal Siever** |
| 🟠 **Cold Fusion Reactor** | 🟢 **Cryo Freezer** |
| 🟣 **Compactor** | 🟢 **Cryofluid Synthesizer** |
| 🟢 **Cryo Chamber** | 🟢 **Cryo Stabilizer** |
| 🟥 **Dismantler** | 🟢 **Dense Active Generators** |
| 🟢 **Duplicator** | 🟢 **Disenchanter** |
| 🟢 **Enchantment Station** | 🟢 **Dual Siever** |
| 🟢 **Energizer** | 🟢 **Genetic Seed Synthesizer** |
| 🟡 **Essence Collector** | 🟢 **Impact Crusher** |
| 🟡 **Fluid Crystallizer** | 🟢 **Industrial Burner** |
| 🟡 **Interdimensional Infuser** | 🟢 **Industrial Crucible** |
| 🟡 **Kyarium Generators** | 🟡 **Mob Slasher** |
| 🟢 **Laser Barrier** | 🟢 **Pattern Placer** |
| 🟡 **Laser Bridge** | 🟢 **Pulverizer** |
| 🟢 **Liquifier** | 🟢 **Reinforcement Anvil** |
| 🟡 **Mob Temporal Chamber** | 🟢 **Seismic Breaker** |
| 🟠 **Orbital Command Terminal** | 🟢 **Verdant Cultivator** |
| 🟢 **Residue Processor** | — |
| 🟢 **Singularity Fabricator** | — |
| 🟡 **Vacuum Particle Condenser** | — |
| 🟢 **Vaporworks Processor** | — |
| 🟡 **Decompactor** | — |

## Items, gear, materials, and systems

| Items, Gear & Materials | Infrastructure & Systems |
|---|---|
| 🟡 **Ascendant Omni-Tool** | 🟡 **Cryo Reservoir** |
| 🟡 **Item Energizer Pad** | 🟡 **Dimensional Teleporter** |
| 🟡 **Kyarium** | 🟢 **Network Center** |
| 🟡 **Portable Power Cell** | 🟢 **Overclock Boost Network** |
| 🟡 **Singularities** | 🟢 **Overclock Relay** |
| 🟡 **Tungsten** | 🟢 **Overclock Tower** |
| 🟡 **Way Device** | 🟢 **Reinforced Cable** |
| — | 🟠 **Rift Anchor** |
| — | 🟡 **Universal Cable Network** |

---

# New Additions (Machines)

- 🟢 **Absolute Container**
  - **Purpose:** Singular vault for high-capacity item, fluid, and energy storage.
  - **Operating Mode:** 14×12 item grid + fluid/energy indicators.
  - **Notes:** Storage-only, no upgrade clutter.

- 🟡 **Aurora's Lance**
  - **Purpose:** Multiblock defensive turret designed to eliminate hostile targets with high-energy beams.
  - **Operating Mode:** Automatically targets hostile entities and consumes DE for each fired beam.
  - **Structure:** Up to `3x3` in width and length, with expandable vertical height.
  - **Modules:** Range, Fire Rate, Damage, Beam Count, Efficiency, and Loot Teleporter.
  - **Loot Teleporter:** Teleports drops from killed targets to a dedicated Receiver Casing.
  - **Lore:** Uses DE to communicate with orbital satellites that coordinate its attacks.

- 🟢 **Catalyst Weaver**
  - **Purpose:** High-tier fusion of multi-catalyst reactions.
  - **Operating Mode:** Up to 6 catalysts + fluid interaction + residue handling.
  - **Notes:** Built for unstable and expensive reactions.

- 🟣 **Compactor**
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

- 🟡 **Decompactor** *(Planned)*
  - **Purpose:** Reverse only the material and item compactions registered for the Compactor.
  - **Operating Mode:** Uses 3×3 input and output buffers; one dense item is converted into its exact preceding material quantity.
  - **Upgrades:** Uses the same four upgrade fields as the Compactor: Speed, Energy, Hyper Processing, and Stack.
  - **Layout:** The four upgrade slots must be positioned immediately before its 3×3 output buffer.
  - **Recipe Source:** Builds its reverse mapping from the Compactor configuration, including all compressed blocks and compatible items such as bags and bundles.
  - **Safety:** Stops when output space is insufficient and never acts as a general reverse-crafting or item-recovery machine.
  - **Branch Handling:** Any compressed result with more than one valid predecessor must expose an explicit selection rule before implementation; it must never guess and destroy value.
  - **Scope:** Separate from the paused Dismantler. No runtime, recipe, menu category, or assets are planned until this design is approved.

- 🟥 **Dismantler** *(Paused)*
  - **Status:** Removed from active implementation scope in Ascendant Technology.
  - **Reason:** Reverse-crafting recovery was cut from the current superior machines rollout.
  - **Note:** Existing runtime implementation and related assets were removed from the pack.

- 🟢 **Duplicator**
  - **Purpose:** Late-game replication with high energy and fluid costs.
  - **Operating Mode:** Template-driven, continuous energy draw.

- 🟢 **Enchantment Station**
  - **Purpose:** High-tier repair + enchant + reinforcement hub.
  - **Operating Mode:** Module-driven behavior with invasive late-game scaling.

- 🟢 **Energizer**
  - **Purpose:** Convert base resources into energized line variants.
  - **Operating Mode:** Input + optional auxiliary path to output conversion.

- 🟡 **Kyarium Generators**
  - **Purpose:** End-game DE generators built around Kyarium technology.
  - **Operating Mode:** Generates massive amounts of DE and supports dedicated modifiers and Overclock.
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

- 🟢 **Network Center**
  - **Purpose:** Power network observability and diagnostics.
  - **Operating Mode:** Scans nodes/cables/machines and computes stability.

- 🟢 **Overclock Boost Network**
  - **Purpose:** Infrastructure-level machine overclocking.
  - **Core Blocks:** Overclock Tower + Overclock Relay + Reinforced Cable.

- 🟢 **Residue Processor**
  - **Purpose:** Turn production residues into recovered outputs or neutral waste.

- 🟢 **Singularity Fabricator**
  - **Purpose:** Massively compact eligible materials into their corresponding Singularities.
  - **Operating Mode:** Consumes extreme quantities of one supported material to produce its Singularity.
  - **Progression Role:** Primary machine for producing the Singularities required by Kyarium.

- 🟡 **Universal Cable Network**
  - **Core Blocks:** Universal Cable + Universal Importer + Universal Exporter.
  - **Purpose:** Future premium unified logistics line for bases that want one duct family to carry items, fluids, energy, and overclock.
  - **Operating Mode:** Not implemented in the current reinforced logistics pass.
  - **Design Requirement:** Universal routing must expose fine control per side, per resource type, and per importer/exporter endpoint.
  - **Scope Rule:** The Universal line needs a more sophisticated configuration model than Reinforced Cable. It should not reuse the current reinforced importer/exporter UI without a dedicated design pass.

- 🟡 **Vacuum Particle Condenser** *(Planned)*
  - **Purpose:** A late-game environmental machine that condenses ambient particles into solid resources by reading altitude, dimension, and biome instead of mining blocks directly.
  - **Operating Mode:** The machine filters surrounding air and converts contextual conditions into outputs; higher altitudes favor lighter particulate materials, lower depths favor denser or more compressed results, and special dimension rules can override the default table.
  - **Environment Hook:** Biomes matter; placing it near specific terrain types changes what it can produce, with beach-adjacent placement acting like an enhanced sand-screening path.
  - **Input / Fuel:** Uses DE as fuel and requires Filter Cartridges to define which particle classes are condensed efficiently.
  - **Identity:** This is not a disguised miner; it is a placement-dependent logistics machine whose value comes from location, not from brute-force automation.
  - **Visual:** A large rotor or fan-centered housing with a central condensation chamber, built to sell the idea of suction, pressure, and particle separation.

- 🟢 **Vaporworks Processor**
  - **Purpose:** Produce steam/gas resources for auxiliary industrial use.

---

# Deferred from Ascendant scope

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
- a dense generator branch that gains machine-grade internal state instead of only larger numbers

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
- **Dense Active Generators** are limited to active generators only.
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

- 🟡 **Kyarium**
  - **Type:** Gem.
  - **Purpose:** Supreme material of Ascendant Technology and the endpoint of its material progression.
  - **Acquisition:** Crafted through Singularities.

- 🟡 **Singularities**
  - **Purpose:** Extreme-compression items representing massive quantities of supported materials.
  - **Production:** Created in the Singularity Fabricator from eligible materials.
  - **Progression Role:** Used as core ingredients for Kyarium.

- 🟡 **Tungsten**
  - **Purpose:** Late-game Nether material for dense, heat-resistant tools, machine parts, and superior-machine progression.
  - **Identity:** Built for durability and sustained industrial use rather than raw damage inflation.
  - **Acquisition:** Obtained from a dedicated Nether ore and intentionally excluded from sieving.
  - **Processing:** Pulverize ore into Tungsten dust, then smelt it in a Blast Furnace or Incinerator to produce Tungsten ingots.
  - **Integration:** Used for late-game machine components and other heat-resistant industrial recipes.
  - **Vanilla Variants:** Adds Tungsten-built variants of selected vanilla items, including Flint and Steel.

- 🟡 **Way Device**
  - **Purpose:** Portable teleportation device synchronized with the Waypoints owned by the player.
  - **Waypoint Mapping:** Detects and maps both carpet-based Waypoints and Waypoint Centers.
  - **Operation:** Allows teleportation to a synchronized Waypoint regardless of the player's current location.
  - **Range Upgrades:** Supports distance upgrades ranging from `1,000` to `16,000` blocks.

---

# Planned core systems (still valid)

- 🟡 **Cryo Reservoir**
  - Standalone, high-capacity cryofluid generation/storage for network scale.

- 🟡 **Dimensional Teleporter**
  - Anchor-linked teleport infrastructure with cooldown and high activation cost.

- 🟡 **Interdimensional Infuser**
  - Dynamic material scaling depending on installed UtilityCraft expansions.
  - Expanded tank architecture + additional infusion stages for true late-game scaling.
  - Extreme energy + fluid logistics requirement.

- 🟡 **Item Energizer Pad**
  - Temporary item enhancement while draining DE continuously.

- 🟡 **Mob Temporal Chamber**
  - Multiblock.
  - Simulates mob kill/drop loops from essence and energy.
  - Includes XP fluid tank for enchant-oriented progression.

- 🟡 **Portable Power Cell**
  - Carryable DE storage tiers.

---

# Migrated concept bank (from Overall_Concepts)

The following concepts were migrated and normalized into roadmap format.

- 🟠 **Atmospheric Synchronizer**
  - **Purpose:** Manipulate biological conditions within an area.
  - **Operating Mode:** Affects nearby mobs through a configurable synchronization field.
  - **Range:** Supports Range Upgrades.
  - **Notes:** Intended for biological automation without directly killing mobs.

- 🟠 **Cold Fusion Reactor**
  - **Purpose:** Produce massive amounts of DE through a controlled fusion reaction.
  - **Operating Mode:** Consumes fuel and coolant while maintaining a stable internal temperature.
  - **Thermal System:** Efficiency decreases outside its ideal temperature range.
  - **Notes:** Designed for continuous high-output generation.

- 🟥 **Liquid Nitrogen Program** *(Discontinued)*
  - **Purpose:** High-tier coolant chain for advanced systems.
  - **Pipeline:** Catalyst Weaver + Liquifier heavy-energy production path.

- 🟠 **Orbital Command Terminal**
  - **Purpose:** Perform large-scale environmental operations.
  - **Operating Mode:** Executes expensive orbital operations using DE and specialized resources.
  - **Modes:**
    - **Orbital Prospecting:** Scans an area for underground resources.
    - **Weather Seeding:** Controls local weather conditions.
  - **Range:** Supports Range Upgrades.

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

# Near-term implementation order

1. **Seismic Breaker**
2. **Impact Crusher + cooling safety loop**
3. **Centrifugal Siever**

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
- Steam and nitrogen are treated as practical industrial resources, not decorative side systems.

## Roadmap
The overall roadmap for Ascendant Technology. This is the source of truth for planned features, implementation status, and development priorities.

Machine status legend:
- 🟢 Implemented (in-game)
- 🔵 In Development (actively being built)
- 🟡 Planned (Not started or confirmed)
- 🟣 Needs Design (Missing assets)
- 🔴 On Hold / Cut (Paused or no longer planned)

---

# Summary by category

## Machines

| New Machines | Superior Machines |
|---|---|
| 🟢 **Absolute Container** | 🟡 **Abyssal Fisher** |
| 🟣 **Atmospheric Synchronizer** | 🟡 **Arcane Enchanter** |
| 🟢 **Catalyst Weaver** | 🟢 **Arc-Press Forge** |
| 🟣 **Cold Fusion Reactor** | 🟡 **Centrifugal Siever** |
| 🟢 **Cryo Chamber** | 🟡 **Cryo Freezer** |
| 🔴 **Dismantler** | 🟡 **Cryofluid Synthesizer** |
| 🟢 **Duplicator** | 🟡 **Cryo Stabilizer** |
| 🟢 **Enchantment Station** | 🟡 **Dense Active Generators** |
| 🟢 **Energizer** | 🟡 **Disenchanter** |
| 🟡 **Essence Collector** | 🟡 **Dual Siever** |
| 🟡 **Fluid Crystallizer** | 🔵 **Impact Crusher** |
| 🟡 **Interdimensional Infuser** | 🟢 **Industrial Burner** |
| 🟢 **Laser Barrier** | 🟡 **Magmatic Reactor Chamber** |
| 🟢 **Liquifier** | 🟢 **Pattern Placer** |
| 🟡 **Mob Temporal Chamber** | 🟢 **Pulverizer** |
| 🟣 **Orbital Command Terminal** | 🟡 **Reinforcement Anvil** |
| 🟢 **Residue Processor** | 🟡 **Seed Mutator** |
| 🟢 **Singularity Fabricator** | 🟢 **Seismic Breaker** |
| 🟢 **Vaporworks Processor** | 🟡 **Verdant Cultivator** |

## Items, gear, and systems

| Items & Gear | Infrastructure & Systems |
|---|---|
| 🟡 **Ascendant Omni-Tool** | 🟡 **Cryo Reservoir** |
| 🟡 **Item Energizer Pad** | 🟡 **Dimensional Teleporter** |
| 🟡 **Portable Power Cell** | 🟢 **Network Center** |
| 🟡 **Tungsten Ore** | 🟢 **Overclock Boost Network** |
| — | 🟢 **Overclock Relay** |
| — | 🟢 **Overclock Tower** |
| — | 🟢 **Reinforced Cable** |
| — | 🟣 **Rift Anchor** |
| — | 🟡 **Universal Cable Network** |

---

# New Additions (Machines)

- 🟢 **Absolute Container**
  - **Purpose:** Singular vault for high-capacity item, fluid, and energy storage.
  - **Operating Mode:** 14×12 item grid + fluid/energy indicators.
  - **Notes:** Storage-only, no upgrade clutter.

- 🟢 **Catalyst Weaver**
  - **Purpose:** High-tier fusion of multi-catalyst reactions.
  - **Operating Mode:** Up to 6 catalysts + fluid interaction + residue handling.
  - **Notes:** Built for unstable and expensive reactions.

- 🟢 **Cryo Chamber**
  - **Purpose:** Thermal stabilization, cooling operations, and Cryofluid generation.
  - **Operating Mode:** Three operational domains:
    1. Stabilizer
    2. Cooling Chamber
    3. Cryofluid Generator
  - **Notes:** Core machine for future cold-chain industry.

- 🔴 **Dismantler** *(Paused)*
  - **Status:** Removed from active implementation scope in Ascendant Technology.
  - **Reason:** Reverse-crafting recovery was cut from the current superior machines rollout.
  - **Note:** Existing runtime implementation and related assets were removed from the pack.

- 🟢 **Duplicator**
  - **Purpose:** Late-game replication with high energy and fluid costs.
  - **Operating Mode:** Template-driven, continuous energy draw.
  - **Variant:** **Singularity Fabricator** (dark matter path, no upgrades).

- 🟢 **Enchantment Station**
  - **Purpose:** High-tier repair + enchant + reinforcement hub.
  - **Operating Mode:** Module-driven behavior with invasive late-game scaling.

- 🟢 **Energizer**
  - **Purpose:** Convert base resources into energized line variants.
  - **Operating Mode:** Input + optional auxiliary path to output conversion.

- 🟢 **Laser Barrier**
  - **Purpose:** Defensive projected energy field.
  - **Operating Mode:** Continuous DE drain + dimension upgrades.

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

- 🔴 **Water Wheel**
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

- 🟡 **Abyssal Fisher** *(from `autofisher`; runtime IDs can stay `abyssal_*` for now)*
  - **Purpose:** Remote batch fishing machine with internal water logistics and abyssal loot scaling.
  - **Operating Mode:** `Expedition` favors longer casts and higher loot tiers, while `Mass` shortens the cycle for bulk output; both use fishing nets and an internal water tank instead of a nearby source block.
  - **Environment Hook:** Water quality, dimension context, and abyssal bonus rules can affect the loot table.

- 🟡 **Arcane Enchanter** *(from `Enchantment Station`, standalone enchanting branch)*
  - **Purpose:** Dedicated enchanting machine that exists purely to remove the repair and disenchant clutter from the Enchantment Station.
  - **Operating Mode:** Uses a focused gear grid and module lane for enchanting only, keeping the same core module logic while running faster than the Enchantment Station.
  - **Identity:** Its value comes from specialization and speed, not from a giant new profile tree.

- 🟢 **Arc-Press Forge** *(from `electro_press`)*
  - **Purpose:** Electrothermal press with a meaningful split between safe precision and risky throughput.
  - **Operating Mode:** `High Speed` presses items in batches with higher energy draw and loss risk, while `Low Loss` presses fewer items with safer yield and steadier operation.
  - **Upgrade Rule:** Quantity Upgrades expand the batch cap only on the high-speed path.

- 🟡 **Centrifugal Siever** *(from `autosieve`, batch path)*
  - **Purpose:** Industrial bulk-processing siever focused on one material stream at a time.
  - **Operating Mode:** Four shared input slots feed one reinforced mesh chamber; each cycle locks onto one valid material type, resolves grouped sieve rolls, and deposits everything into one enlarged shared output buffer.
  - **Booster:** Optional steam injection accelerates spin-up and batch throughput.
  - **Rule:** The first release stays focused on batch logic and steam only, without extra preset layers.

- 🟡 **Cryo Freezer** *(from `Cryo Chamber`, standalone Freezing branch)*
  - **Purpose:** Dedicated freezing and cold-crafting machine for recipes that should not compete with stabilization or Cryofluid generation.
  - **Operating Mode:** Runs a freezing grid with independent recipe checks, using water or Cryofluid-backed chains for food reversal, freezing, and cold crafting.
  - **Identity:** This is the pure freezing branch extracted out of the Cryo Chamber.

- 🟡 **Cryofluid Synthesizer** *(from `Cryo Chamber`, standalone Generator branch)*
  - **Purpose:** Dedicated industrial Cryofluid production for bases that outgrow the shared Cryo Chamber generator lane.
  - **Operating Mode:** `Stable` processes one cycle at a time with normal upgrade behavior, while `Impulse` processes in batches, ramps production up to `800%`, and ignores Speed/Hyper boosts while active.
  - **Separation Rule:** Exists to scale Cryofluid generation without forcing the player to scale the whole Cryo Chamber.

- 🟡 **Cryo Stabilizer** *(from `Cryo Chamber`, standalone Stabilization branch)*
  - **Purpose:** Dedicated stabilization machine for volatile materials that should be handled separately from cooling and Cryofluid generation.
  - **Operating Mode:** Focuses only on stabilization recipes, running a dedicated catalyst/fluid-backed stabilization lane instead of sharing space with other cryogenic roles.
  - **Identity:** This is strictly the stabilization branch; freezing now belongs to its own superior machine.

- 🟡 **Dense Active Generators** *(from the `Absolute` generator line)*
  - **Purpose:** Tier 6 active generator family that turns absolute generators into machine-grade power systems with state, safety, and multi-input behavior.
  - **Operating Mode:** The dense line is now limited to the active generators only:
    1. `Dense Furnator Array` — dedicated multi-input burn windows with batch ignition.
    2. `Dense Magmator Core` — larger lava tank, but each generation step resolves only `4000 mB` at a time.
    3. `Dense Thermo Matrix` — requires `Cryofluid` or `Saline Coolant` instead of water, stores heat and steam internally, and gains efficiency while staying below dangerous temperature.
  - **Scope Rule:** Passive generators are out of this superior branch for now.

- 🟡 **Disenchanter** *(from `Enchantment Station`, standalone disenchant branch)*
  - **Purpose:** Specialist machine for enchant extraction and XP-fluid absorption at scale.
  - **Operating Mode:** `Extraction` converts enchantments into enchanted books, while `Absorption` liquefies them into XP fluid; both modes share a Curse Protection module slot.
  - **Identity:** It exists to separate disenchant logistics from the Enchantment Station instead of inflating the station further.

- 🟡 **Dual Siever** *(from `autosieve`, split path; pending dedicated assets)*
  - **Purpose:** Run two independent sieve lanes inside one machine while keeping logistics compact.
  - **Operating Mode:** Each lane keeps its own mesh identity and processing logic, but core resources such as energy, upgrades, and output buffering stay shared.
  - **Shared Basics:** Shared energy and shared outputs stay mandatory to avoid pointless logistics sprawl.

- 🔵 **Impact Crusher** *(from `crusher`, aggressive path)*
  - **Purpose:** High-risk crusher branch built for peak output under controlled thermal danger.
  - **Operating Mode:** Dual processing lanes draw on lava, build heat, and consume coolant while pushing much harder than the Pulverizer.
  - **Failure State:** If it overheats, it stops, burns half of the current inputs and buffered outputs, plays burning-item feedback, and stays locked until temperature fully drops and the player reseats the input.

- 🟢 **Industrial Burner** *(from `incinerator`)*
  - **Purpose:** Multi-input and multi-output incineration machine for high-volume trash-to-value and high-heat pre-processing.
  - **Operating Mode:** Three input lanes and three output lanes process at the same time, with optional lava injection increasing batch volume per cycle.
  - **Byproduct Hook:** Selected recipes can route ash or residue into a dedicated result lane instead of deleting it.

- 🟡 **Magmatic Reactor Chamber** *(from `magmatic_chamber`)*
  - **Purpose:** Thermal chamber for heat-intensive industrial work where process heat matters as a reusable resource.
  - **Operating Mode:** Stores heat and steam internally, gains efficiency while working inside a healthy thermal window, and loses that efficiency when pushed too close to unsafe temperature.
  - **Thermal Role:** Heat should both power the machine and become a stored resource for adjacent industrial systems.

- 🟢 **Pattern Placer** *(from `block_placer`)*
  - **Purpose:** Placement machine for world automation patterns that are too complex for a simple block placer.
  - **Operating Mode:** Supports `Grid`, `Line`, and `Alternation` placement logic with tag filters and block blacklist control.
  - **Placement Identity:** Complexity comes from deterministic layout logic, not just larger inventory size.

- 🟢 **Pulverizer** *(from `crusher`, stable path)*
  - **Purpose:** Stable industrial crusher upgrade with stronger buffers and steam-assisted acceleration.
  - **Operating Mode:** Processes crusher recipes with higher energy draw and optional steam-fed throughput increase while keeping a safer operating profile than the Impact Crusher.
  - **Industrial Hook:** Larger internal space and batch-friendly routing are part of the appeal, not just speed.

- 🟡 **Reinforcement Anvil** *(from `induction_anvil`)*
  - **Purpose:** Advanced repair and reinforcement machine for dense metallurgy and gear recovery.
  - **Operating Mode:** Switches between `Repair` and `Reinforce`, with reinforcement behavior tied to Enchantment Station modules and a cooldown-based reuse window.
  - **Reinforcement Ladder:** Supports `Reinforcement Module IV` and `V` for `150%` and `200%` reinforcement targets.

- 🟡 **Seed Mutator** *(from `seed_synthesizer`)*
  - **Purpose:** Agricultural synthesis machine for higher-tier seed improvement and controlled crop mutation.
  - **Operating Mode:** Four seed lanes synthesize together in a shared cycle with one soil slot, one Cryofluid lane, and a profile button whose exact `Growth` / `Resilience` / `Yield` effects still need a cleaner differentiation pass.
  - **Constraint:** Higher-tier reagents and thermal stability should remain part of its identity.

- 🟢 **Seismic Breaker** *(from `block_breaker`)*
  - **Purpose:** Area-mining automation machine with controllable excavation patterns.
  - **Operating Mode:** Supports `1x1`, `3x3`, and `Line` modes, with a Precision toggle for preserving special drops where possible.
  - **Scaling Rule:** Energy cost scales with the selected affected area.

- 🟡 **Verdant Cultivator** *(from `harvester`; replaces the old `Chrono Harvester` name)*
  - **Purpose:** Large-scale crop automation machine that plants, fertilizes, harvests, and buffers produce in one superior agricultural block.
  - **Operating Mode:** Accepts a Pedestal Clock in a dedicated slot to pulse bonemeal periodically, scales range from `3x3` up to `17x17`, uses Quantity level `1-4` as a fortune-style harvest bonus, plants from a `2x2` seed grid, and stores harvests in an internal `3x3` buffer when no rear container is attached.
  - **Biome Hook:** Can gain crop-specific bonuses from the biome where it is working.

## Locked design decisions from review (2026-04)

- **Abyssal Fisher** is the correct player-facing name; internal `abyssal_*` identifiers can stay until a runtime migration is worth the churn.
- **Adaptive Assembler** and **Quantum Digitizer** are out of the current superior roster because neither one has a strong enough gameplay justification right now.
- **Arcane Enchanter** stays simple: dedicated enchanting plus a speed advantage is enough.
- **Centrifugal Siever v1** stays batch + steam only.
- **Cryo Chamber** now branches into three separate superior specialists: **Cryo Freezer**, **Cryofluid Synthesizer**, and **Cryo Stabilizer**.
- **Dense Active Generators** are limited to active generators only.
- **Disenchanter** keeps only `Extraction` and `Absorption`, both with a Curse Protection module slot.
- **Dual Siever** lanes should feel distinct, but shared energy/output remain mandatory.
- **Seed Mutator** keeps its current profile labels for now, but their exact distinctions still need a later balance pass.
- **Impact Crusher** uses a destructive overheat failure state instead of self-damage or passive venting.
- **Reinforcement Anvil** can grow into higher reinforcement tiers through Module IV/V.
- **Magmatic Reactor Chamber** should reward healthy heat management with both efficiency and stored thermal resources.

## Mob and essence automation line

- 🟡 **Essence Collector**
  - **Role:** Late-game automation block for recovering mob essence near grinder setups.
  - **Placement Rule:** Must be placed within active collection range of a Mob Grinder zone.
  - **Balance Rules:** Netherite-tier crafting cost, slower than manual offhand collection, and requires DE to operate.
  - **Automation Hooks:** Fills Essence Vessels over time and supports routing/filter behavior through existing Filter Upgrade flow.
  - **Target Loop:** `Mechanical Spawner -> Mob Grinder -> Essence Collector -> Spawner`.

---

# Planned items and gear

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

- 🟡 **Tungsten**
  - **Purpose:** Late-game Nether material for dense, heat-resistant tools, machine parts, and superior-machine progression.
  - **Identity:** Built for durability and sustained industrial use rather than raw damage inflation.
  - **Acquisition:** Obtained from a dedicated Nether ore and intentionally excluded from sieving.
  - **Processing:** Pulverize ore into Tungsten dust, then smelt it in a Blast Furnace or Incinerator to produce Tungsten ingots.
  - **Integration:** Used for late-game machine components and other heat-resistant industrial recipes.

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

- 🟣 **Atmospheric Synchronizer**
  - **Purpose:** Mutation/stabilization field for biological entities.
  - **Operating Mode:** Area aura with mutation chance and stress indicators.
  - **Role:** Rare drop ecosystems without classic kill farms.

- 🟣 **Cold Fusion Reactor**
  - **Purpose:** Massive stable power when thermals are controlled.
  - **Constraint:** Needs strict cooling and heat-feed balancing.

- 🔴 **Liquid Nitrogen Program** *(Discontinued)*
  - **Purpose:** High-tier coolant chain for advanced systems.
  - **Pipeline:** Catalyst Weaver + Liquifier heavy-energy production path.

- 🟣 **Orbital Command Terminal**
  - **Purpose:** Climate/prospecting intervention layer.
  - **Operating Mode:** Ore prospecting + weather seeding with advanced fluid costs.

- 🟣 **Rift Anchor**
  - **Purpose:** Cross-dimensional item/fluid/energy transportation in paired frequencies.
  - **Operating Mode:** Requires two anchors, one for sending and one for receiving; linked by a unique frequency code.
    - **Rift Sender:**  Sends everything that can be put on pipes or ducts, such as items, fluids, overclock and energy.
    - **Rift Receiver:**  Receives the load sent by the sender and outputs it omnidirectionally.
  - **Notes:** Will need some sort of Chunk Loader integration to keep the receiver/sender active.

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
  - Status in Ascendant: *🔴 On Hold / Cut*
  - Marker: *Planned for other expansion*
- Ascendant will keep machine inspiration from UtilityCraft, but express that growth through a unified **Superior Machines** program with stronger identity and functionality upgrades.
- Tungsten-focused industrial content is now prioritized (durability, heat handling, dense machinery casing).
- Steam and nitrogen are treated as practical industrial resources, not decorative side systems.
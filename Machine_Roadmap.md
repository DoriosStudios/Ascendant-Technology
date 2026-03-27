## Machine Roadmap

Machine status legend:
- 🟢 Implemented (in-game)
- 🟠 In Development (actively being built)
- 🟡 Planned (approved direction, not started)
- 🔵 Prototype (may change / experimental)
- 🟣 Needs Design (idea exists, spec missing)
- 🔴 On Hold / Cut (paused or removed from this expansion)

---

# Executive update (2026-03)

- **Water Wheel** is no longer part of Ascendant Technology's generator line.
  - Status in Ascendant: *🔴 On Hold / Cut*
  - Marker: *Planned for other expansion*
- Ascendant will keep machine inspiration from UtilityCraft, but with stronger identity and functionality upgrades.
- Tungsten-focused industrial content is now prioritized (durability, heat handling, dense machinery casing).
- Steam and nitrogen are treated as practical industrial resources, not decorative side systems.

---

# Summary by implementation rationale (4 categories)

Status:
- **✔: Implemented**
- **🔺: Not Implemented**

| New Machines | Upgraded Machines | Items & Gear | Infrastructure & Systems |
|---|---|---|---|
| ✔ **Absolute Container** | 🔺 **Abyssal Auto-Fisher** | 🔺 **Item Energizer Pad** | 🔺 **Cryo Reservoir** |
| 🔺 **Atmospheric Synchronizer** | 🔺 **Adaptive Assembler** | 🔺 **Portable Power Cell** | 🔺 **Dimensional Teleporter** |
| ✔ **Catalyst Weaver** | 🔺 **Arc-Press Forge** | 🔺 **The Ascendant's Tool** | ✔ **Network Center** |
| 🔺 **Cold Fusion Reactor** | 🔺 **Centrifugal Siever** | — | ✔ **Overclock Boost Network** |
| ✔ **Cryo Chamber** | 🔺 **Chrono Harvester** | — | ✔ **Overclock Relay** |
| ✔ **Duplicator** | 🔺 **Complex Siever line** | — | ✔ **Overclock Tower** |
| ✔ **Enchantment Station** | 🔺 **Dual Complex Siever** | — | ✔ **Reinforced Cable** |
| ✔ **Energizer** | 🔺 **Genetic Seed Synthesizer** | — | 🔺 **Rift Anchor** |
| 🔺 **Essence Collector** | 🔺 **Impact Crusher** | — | 🔺 **Tier 6 Dense Generators** |
| 🔺 **Fluid Crystallizer** | 🔺 **Induction Matrix Anvil** | — | — |
| 🔺 **Interdimensional Infuser** | 🔺 **Industrial Burner** | — | — |
| ✔ **Laser Barrier** | 🔺 **Magmatic Reactor Chamber** | — | — |
| ✔ **Liquifier (Flux Crucible)** | 🔺 **Pattern Placer** | — | — |
| 🔺 **Mob Temporal Chamber** | 🔺 **Pulverizer** | — | — |
| 🔺 **Orbital Command Terminal** | 🔺 **Quantum Digitizer** | — | — |
| ✔ **Residue Processor** | 🔺 **Seismic Breaker** | — | — |
| ✔ **Singularity Fabricator** | — | — | — |
| ✔ **Vaporworks Processor** | — | — | — |
| 🔺 **Dismantler** | - | - | - |

---

# New Additions (Machines)

- 🟢 **Absolute Container**
  - **Purpose:** Singular vault for high-capacity item, fluid, and energy storage.
  - **Operating Mode:** 14×12 item grid + fluid/energy indicators.
  - **Notes:** Storage-only, no upgrade clutter.

- 🟢 **Catalyst Weaver (Arc Loom)**
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

- 🟡 **Dismantler**
  - **Purpose:** Disassemble and recover parts from previously created items.
  - **Operating Mode:** It has an input with a 3x3 grid output, to retrieve the materials used in the crafting recipe. It uses energy and supports **4** upgrades, the additional upgrade being Quantity.
    - Quantity Upgrades will have 4 levels, acting randomly based on the percentage of materials used. Each level will recover 25% of the materials.
  - **Upgrades:** Efficiency, Speed, Hyper Processing, Quantity


- 🟢 **Duplicator (Replication Matrix)**
  - **Purpose:** Late-game replication with high energy and fluid costs.
  - **Operating Mode:** Template-driven, continuous energy draw.
  - **Variant:** **Singularity Fabricator** (dark matter path, no upgrades).

- 🟢 **Enchantment Station**
  - **Purpose:** High-tier repair + enchant + reinforcement hub.
  - **Operating Mode:** Module-driven behavior with invasive late-game scaling.

- 🟢 **Energizer (Pulse Forge)**
  - **Purpose:** Convert base resources into energized line variants.
  - **Operating Mode:** Input + optional auxiliary path to output conversion.

- 🟢 **Laser Barrier**
  - **Purpose:** Defensive projected energy field.
  - **Operating Mode:** Continuous DE drain + dimension upgrades.

- 🟢 **Liquifier (Flux Crucible)**
  - **Purpose:** Convert solids into industrial liquids.
  - **Operating Mode:** Heat + energy conversion with tank visualization.

- 🟢 **Network Center**
  - **Purpose:** Power network observability and diagnostics.
  - **Operating Mode:** Scans nodes/cables/machines and computes stability.

- 🟢 **Residue Processor**
  - **Purpose:** Turn production residues into recovered outputs or neutral waste.

- 🟢 **Vaporworks Processor**
  - **Purpose:** Produce steam/gas resources for auxiliary industrial use.

- 🟢 **Overclock Boost Network**
  - **Purpose:** Infrastructure-level machine overclocking.
  - **Core Blocks:** Overclock Tower + Overclock Relay + Reinforced Cable.

---

# Deferred from Ascendant scope

- 🔴 **Water Wheel**
  - **Ascendant status:** Removed from generator progression.
  - **Marker:** `Planned for other expansion`.
  - **Reason:** Ascendant generator identity is being pushed toward denser, advanced high-tech systems instead of hydro-kinetic early-mid solutions.

---

# UtilityCraft-inspired machine line (Ascendant variants)

These are not simple ports. They must provide mechanical upgrades, denser workflows, and stronger identity.

## Heavy processing line

- 🟡 **Pulverizer** *(from `crusher`, stable path)*
  - **Purpose:** Enchanced version of the Crusher, with more internal space and better operation speed.
  - **Operating Mode:** It uses more energy and, additionally, steam, to process Crusher recipes at a faster rate.

- 🔵 **Impact Crusher** *(from `crusher`, aggressive path)*
  - **Profile:** High production peaks under controlled risk.
  - **Operating Mode:** An even more powerful version of the Crusher, with dual processing. This version has 3 inputs on top, 3 on the bottom, a 7x3 output grid, a lava tank, and a cooler tank. It needs the lava to operate, and if too much heat accumulates, it stops working.
  - **Cooling Inputs:** Cryofluid, Saline Coolant *(from Heavy Machinery)*

- 🟡 **Industrial Burner** *(from `incinerator`)*
  - **Purpose:** Multi-input / multi-output, parallel processing Incinerator.
  -  **Operating Mode:** 3 inputs and 3 outputs, working at the same time.
  - **Booster:** Optional lava injection increases batch volume per cycle.

- 🟡 **Arc-Press Forge** *(from `electro_press`)*
  - **Purpose:** Electrothermal press with precision metallurgy path.
  - **Operating Mode:** `High Speed` and `Low Loss` production modes.
    - **High Speed Mode:** It works by pressing in batches (4 items at a time, expandable with Quantity Upgrades), with about a 25% chance of losing one of the items produced.
    - **Low Loss:** It works by pressing one item at a time, with a bit more speed.

- 🟡 **Induction Matrix Anvil** *(from `induction_anvil`)*
  - **Purpose:** Reinforcement and recomposition of advanced alloys.
  - **Synergy:** Direct interaction with modules/overclock at higher thermal cost.

## Block and world automation line

- 🟡 **Seismic Breaker** *(from `block_breaker`)*
  - **Modes:** `1x1`, `3x3`, `Line`.
  - **Precision Mode:** Preserves special drops when possible.
  - **Scaling Rule:** Energy cost scales with affected area.

- 🟡 **Pattern Placer** *(from `block_placer`)*
  - **Placement Modes:** Grid, line, alternation patterns.
  - **Control Layer:** Tag filters + block blacklist.

- 🟡 **Chrono Harvester** *(from `harvester`)*
  - **Role:** Growth-stage harvesting with internal buffer handling.
  - **Modes:** `Non-Destructive` and `Total Uproot` (higher yield).

## Resource and synthesis line

- 🟡 **Complex Siever** *(from `autosieve`, control path)*
  - **Purpose:** Higher consistency and finer filtration control.
  - **Operating Mode:** Multi-stage filtering with optional catalyst lane.

- 🟡 **Centrifugal Siever** *(from `autosieve`, split path)*
  - **Purpose:** Two independent sieve lines with balancing logic.

- 🟡 **Dual Complex Siever** *(advanced `autosieve` variant)*
  - **Purpose:** +1 or +2 extra processing lines over baseline Complex Siever.
  - **Operating Mode:** Shared energy bus with separated material channels.

- 🟡 **Genetic Seed Synthesizer** *(from `seed_synthesizer`)*
  - **Profiles:** Growth, resilience, and yield optimization profiles.
  - **Constraint:** Requires higher-tier reagents + thermal stability.

- 🟡 **Interdimensional Infuser** *(from `infuser`, main Ascendant line)*
  - **Profile:** Dynamic scaling based on active expansions.
  - **Escalation:** More tanks, more infusion stages, extreme late-game energy/fluid cost.
  - **Clarification:** This is **not** the upgraded Infuser path. It is a standalone Ascendant machine focused on interdimensional-tier synthesis, especially the `Interdimensional Gem`.
  - **Upgrade lineage note:** The real upgraded Infuser path was already implemented as the **Catalyst Weaver**.

- 🟡 **Quantum Digitizer** *(from `digitizer`)*
  - **Role:** Advanced item serialization/profile capture.
  - **Constraint:** Blueprint cache capacity scales by machine tier.
  - **Use Case:** Infrastructure support for manufacturing lines.

- 🟡 **Adaptive Assembler** *(from `assembler`)*
  - **Role:** Adaptive recipe execution by priority.
  - **Modes:** Continuous pipeline + smart queue orchestration.
  - **Use Case:** Core manufacturing node for very large networks.

## Thermal and fluid line

- 🟡 **Magmatic Reactor Chamber** *(from `magmatic_chamber`)*
  - **Role:** Industrial thermal chamber for heat-intensive processes.
  - **System Hook:** Exposes process heat as reusable thermal output (not only energy).

- 🟡 **Fluid Crystallizer**
  - **Role:** Reverse fluid processing by converting stored liquids back into solid resources.
  - **Operating Mode:** Tank-fed crystallization with continuous DE draw and recipe-defined cycle timing.
  - **Example Paths:** `Lava -> Obsidian / Magma Block`, `Water -> Prismarine Shard`, `XP Fluid -> Bottle o' Enchanting`.
  - **Value Hook:** Closes the fluid loop for high-volume liquid networks.

- 🟡 **Abyssal Auto-Fisher** *(from `autofisher`)*
  - **Rule:** Environmental conditions affect loot tier.
  - **Modes:** `Expedition` (long cycle, higher loot) and `Mass` (short cycle, bulk output).

## Mob and essence automation line

- 🟡 **Essence Collector**
  - **Role:** Late-game automation block for recovering mob essence near grinder setups.
  - **Placement Rule:** Must be placed within active collection range of a Mob Grinder zone.
  - **Balance Rules:** Netherite-tier crafting cost, slower than manual offhand collection, and requires DE to operate.
  - **Automation Hooks:** Fills Essence Vessels over time and supports routing/filter behavior through existing Filter Upgrade flow.
  - **Target Loop:** `Mechanical Spawner -> Mob Grinder -> Essence Collector -> Spawner`.

---

# New high-priority additions

- 🟡 **Industrial Burner**
  - **Description:** "Incinerator, but better."
  - **Operating Mode:**
    - Multiple input and output slots.
    - Simultaneous batch processing.
    - Optional lava injection to increase burn/smelting volume per cycle.
  - **Practical Role:** High-volume trash-to-value and high-heat pre-processing block for late automation.

- 🟡 **The Ascendant's Tool**
  - **Description:** The ultimate tool, merging every single tool on Minecraft into one. Cannot be compared to AIOTs, that are the combination of the five main tools. This tool combinates even shears and flint and steel, with every aspect of it configurable.
  - **Operating Mode:**
    - Multiple tool functions in one item. These are:
      - Pickaxe
      - Axe
      - Shovel
      - Hoe
      - Sword
      - Shears
      - Flint and Steel
      - Blazing Pickaxe (UtilityCraft)
      - Hammer (UtilityCraft)
      - Knife (UtilityCraft)
    - High durability and efficiency.
    - Unique abilities (e.g., auto-smelt, silk touch toggle, area mining mode).
  - **Configurable Traits:**
    - Base tool mode:
      - When using in Dirt, Grass, Podzol, Mycelium or Rooted Dirt:
        - Shovel, Hoe or Tractor mode.
      - When using in Stone variants:
        - Pickaxe, Hammer or Blazing Pickaxe mode.
      - When using in leaves:
        - Hoe, Shears or Knife mode.
      - When using in Ores:
        - Pickaxe or Blazing Pickaxe mode.
      - When using in Sand:
        - Shovel, Hammer or Blazing Pickaxe mode.
      - When using in Gravel:
        - Shovel or Hammer mode.
    - Ability toggles
      - Auto-Smelt (on/off)
      - Silk Touch (on/off)
    - Efficiency settings
      - 1x1 (Default): Haste effect with base Gold tool speed.
      - 3x3: Base Gold speed.
      - 5x5: Base Gold speed.

---

# Tungsten program (dense and heat-resistant)

- 🟡 **Tungsten Tools**
  - **Directive:** Tool damage equal to Netherite values.
  - **Identity:** Same damage tier, but oriented to durability and heat-friendly industrial use.

- 🟡 **Tungsten machine integration ideas**
  - **Dense casing component** for Tier 6 generator recipes.
  - **Heat-resistant internals** for Industrial Burner and Impact Crusher.
  - **Thermal line upgrades** reducing overheating penalties under sustained load.

---

# Steam and cooling with practical industrial use

Steam and cooling resources must be mechanically relevant, not cosmetic.

- 🟡 **Steam practical roles**
  - Pressure-assisted throughput in **Pulverizer** and **Industrial Burner** or other machines.
  - Steam-conditioned cycles for selected siever variants.
  - Temporary thermal acceleration mode with energy premium.

- 🟡 **Cooling practical roles**
  - Continuous cooling requirement for **Impact Crusher**.
  - Safety envelope for high-tier generator internals.
  - Thermal recovery loops (hot process -> coolant demand -> fluid logistics challenge).

- 🟡 **Target resource loop**
  - `Water -> Steam (Vaporworks) -> Process acceleration`
  - `Atmospheric nitrogen -> Liquid nitrogen -> High-heat machine stabilization`
  - `Cryofluid + Liquid Nitrogen` as distinct cooling tiers.

---

# Planned core systems (still valid)

- 🟡 **Cryo Reservoir**
  - Standalone, high-capacity cryofluid generation/storage for network scale.

- 🟡 **Dimensional Teleporter**
  - Anchor-linked teleport infrastructure with cooldown and high activation cost.

- 🟡 **Item Energizer Pad**
  - Temporary item enhancement while draining DE continuously.

- 🟡 **Portable Power Cell**
  - Carryable DE storage tiers.

- 🟡 **Interdimensional Infuser**
  - Dynamic material scaling depending on installed UtilityCraft expansions.
  - Expanded tank architecture + additional infusion stages for true late-game scaling.
  - Extreme energy + fluid logistics requirement.

- 🟡 **Mob Temporal Chamber**
  - Multiblock.
  - Simulates mob kill/drop loops from essence and energy.
  - Includes XP fluid tank for enchant-oriented progression.

---

# Migrated concept bank (from Overall_Concepts)

The following concepts were migrated and normalized into roadmap format.

- 🟣 **Atmospheric Synchronizer**
  - **Purpose:** Mutation/stabilization field for biological entities.
  - **Operating Mode:** Area aura with mutation chance and stress indicators.
  - **Role:** Rare drop ecosystems without classic kill farms.

- 🟣 **Rift Anchor**
  - **Purpose:** Cross-dimensional item/fluid teleportation in paired frequencies.
  - **Risk Hook:** Energy collapse during transfer can trigger unstable rift events.

- 🟣 **Orbital Command Terminal**
  - **Purpose:** Climate/prospecting intervention layer.
  - **Modes:** Ore prospecting + weather seeding with advanced fluid costs.

- 🟣 **Cold Fusion Reactor (3×3×3 multiblock)**
  - **Purpose:** Massive stable power when thermals are controlled.
  - **Constraint:** Needs strict cooling and heat-feed balancing.

- 🔴 **Liquid Nitrogen Program** *(Discontinued)*
  - **Purpose:** High-tier coolant chain for advanced systems.
  - **Pipeline:** Catalyst Weaver + Liquifier heavy-energy production path.

---

# Cross-pack simplification pass (Ascendant + UtilityCraft)

Based on current behavior from both packs (machine templates, wrench patterns, upgrade flows, and high-complexity slot machines), the roadmap now includes a dedicated simplification pass.

- 🟡 **Unified interaction contract**
  - **Wrench stays universal:** rotate / mode toggle / machine edge actions.
  - **Single controller item:** add a compact control item (button-like usage) that cycles machine mode and profile without opening full UI each time.
  - **Rule:** same interaction inputs across simple, liquid, dual, and advanced machines.

- 🟡 **One additional upgrade lane: `Automation Core Upgrade`**
  - **Goal:** reduce per-machine micro-management.
  - **Effects:** auto-input routing, auto-output routing, byproduct-safe output, optional redstone compatibility hooks.
  - **Scope:** starts on Pulverizer, Complex Siever line, Industrial Burner, then expands.

- 🟡 **Upgrade model normalization**
  - Keep machine-specific special upgrades only when identity requires it.
  - Consolidate general upgrades into shared families (speed, efficiency, thermal, automation).
  - Preserve break-and-drop upgrade behavior for consistency.

- 🟡 **Profile-based operation presets**
  - Introduce deterministic machine presets: `Balanced`, `Throughput`, `Efficiency`, `Thermal Safe`.
  - Controller item cycles presets quickly; UI remains for deep tuning.
  - Missing resource conditions should throttle first, not hard-fail immediately.

- 🟡 **Slot/layout simplification for complex machines**
  - Prioritize Cryo Chamber, Enchantment Station, and Catalyst Weaver.
  - Standardize slot groups and labels by role (input, catalyst, coolant, output, residue).
  - Reduce repeated manual configuration steps through preset memory.

- 🟡 **Implementation sequencing for simplification**
  1. Input contract + controller item behavior.
  2. Automation Core Upgrade.
  3. Preset/profile system.
  4. Complex machine UI/slot pass.

---

# Near-term implementation order

1. **Industrial Burner**
2. **Nitrogen Collector**
3. **Pulverizer**
4. **Impact Crusher + cooling safety loop**
5. **Complex Siever / Centrifugal Siever (dual path)**
6. **Tungsten armor + tools baseline**
7. **Tier 6 Dense generators**

---

# Notes

- Variants imported from UtilityCraft must include either:
  - New mechanical behavior, or
  - Meaningful systems integration (overclock, steam, cooling, tungsten internals).
- "Dual" variants should justify complexity with deterministic throughput gains and clearer logistics choices.

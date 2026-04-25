# Superior Machines Design

## Goal

Define the `Superior Machines` program for Ascendant Technology as a real expansion path for advanced machinery, not as a flat “faster tier” label.

This program now covers three valid origins:

- UtilityCraft machines that evolve into denser industrial branches
- standalone superior branches extracted from complex Ascendant machines with multiple internal sections
- dense generator branches that gain machine-grade internal state instead of only raw output inflation

---

## Rename decision

- `Upgraded Machines` becomes `Superior Machines` in roadmap and design language.
- `Superior` is the canonical term for planning, UI grouping, documentation, and future implementation checklists.
- Player-facing design language should use `Abyssal Fisher`; internal `abyssal_*` runtime identifiers can stay until a real migration is worth the churn.

---

## Design pillars

### 1. Superior blocks must change behavior

A superior block should add at least one of the following:

- new operating mode
- new resource dependency
- parallel or simultaneous processing
- batch processing
- dual-lane or multi-lane execution
- internal buffering / routing logic
- safety or instability mechanics
- profile-driven decision making

If a block only gains raw speed, it should remain an overclock, tuning pass, or recipe-tier improvement.

### 2. Heavy superior machines should feel industrial

The superior line should strongly leverage:

- steam as a throughput booster
- cooling fluids as safety / control resources
- heat as a real operational constraint
- larger inventories and clearer internal lanes
- more expensive casings and denser component chains
- visible machine state that the player can reason about

### 3. Complex base machines can split into standalone superior branches

If a base Ascendant machine already mixes multiple sections, a superior variant may extract one section into its own specialist block.

Valid reasons to split a section out:

- the section is strong enough to justify its own logistics loop
- the base machine becomes too cluttered when scaled up
- the standalone branch creates a new automation role instead of duplicating the original block

### 4. Generators can join the superior program

A generator only belongs in the superior program when it stops behaving like a passive number upgrade and starts acting like a real machine.

That means it should introduce at least one of:

- charge banking
- pressure / wind / heat / coolant management
- batch fuel windows
- safety envelopes
- burst-release behavior
- mode or profile switching

### 5. Mode complexity needs shared infrastructure

The project should not solve buttons, mode storage, or HUD summaries separately inside every superior machine.

Before the mode-heavy wave is expanded, Ascendant should standardize:

- button rendering
- mode persistence
- slot locking and anti-item-insertion handling
- page switching
- HUD summaries
- per-button cooldown / debounce

---

## Scope rules

- The roadmap should keep **one single alphabetical superior roster**.
- Every superior entry must define at least:
  - `Purpose`
  - `Operating Mode`
- Extra fields such as `Profiles`, `Safety Loop`, `Identity`, `Generator Logic`, and `Automation Hook` are encouraged when they clarify the block.
- Standalone superior branches must not erase the value of the original complex machine; they must specialize it.
- Superior generators should be documented beside the rest of the superior program, not in a disconnected generator-only bucket.

---

## Confirmed superior roster (alphabetical)

- `Abyssal Fisher`
- `Arcane Imprinter`
- `Arc-Press Forge`
- `Centrifugal Siever`
- `Cryo Cooling Bay`
- `Cryofluid Condenser`
- `Cryo Stabilizer Rack`
- `Dense Active Generators`
- `Disenchanter Array`
- `Dual Siever`
- `Genetic Seed Synthesizer`
- `Impact Crusher`
- `Induction Matrix Anvil`
- `Industrial Burner`
- `Magmatic Reactor Chamber`
- `Pattern Placer`
- `Pulverizer`
- `Seismic Breaker`
- `Verdant Cultivator`

---

## Standalone superior branches from complex Ascendant machines

### Arcane Imprinter

- **Source:** `Enchantment Station` enchanting branch
- **Purpose:** Dedicated enchanting machine that removes repair and disenchant clutter from the Enchantment Station.
- **Operating Mode:** Focused enchanting-only grid with the familiar module lane, plus a faster base cycle than the Enchantment Station.
- **Why it belongs here:** It is valuable because it is specialized and faster, not because it grows a giant extra mode tree.

### Cryo Cooling Bay

- **Source:** `Cryo Chamber` cooling branch
- **Purpose:** Dedicated freezing and cooling machine for recipe chains that should not compete with stabilization or Cryofluid generation.
- **Operating Mode:** Runs a cooling grid with independent slot processing, using water or Cryofluid-backed recipes for food reversal, freezing, and cold crafting.
- **Why it belongs here:** Cooling is already a distinct role inside the Cryo Chamber and deserves its own superior branch.

### Cryofluid Condenser

- **Source:** `Cryo Chamber` generator branch
- **Purpose:** Dedicated industrial Cryofluid production for bases that outgrow the shared Cryo Chamber generator lane.
- **Operating Mode:** `Stable` processes one cycle at a time with normal upgrade behavior, while `Impulse` runs in batches, ramps production up to `800%`, and ignores Speed/Hyper boosts while active.
- **Why it belongs here:** It extracts the fluid-production role into a specialist machine that can scale independently from stabilization and cooling.

### Cryo Stabilizer Rack

- **Source:** `Cryo Chamber` stabilization branch
- **Purpose:** Dedicated handling platform for volatile materials that need strict stabilization.
- **Operating Mode:** Focuses only on stabilization recipes, running a dedicated catalyst/fluid-backed stabilizer lane without mixing in cooling behavior.
- **Why it belongs here:** Once cooling is separated, the stabilizer becomes a much cleaner specialist machine.

### Disenchanter Array

- **Source:** `Enchantment Station` disenchant branch
- **Purpose:** Specialist disenchanting machine for mass enchant extraction and XP reclamation.
- **Operating Mode:** Uses `Extract` and `Absorb` modes, both sharing one Curse Protection module slot and dedicated catalyst/book logistics.
- **Why it belongs here:** Disenchanting already behaves like a machine inside the station, so scaling it into a standalone superior block is a natural progression.

---

## Dense active generator branches

### Dense Active Generators

- **Source:** `Absolute` generator line
- **Purpose:** Tier 6 active generator family that upgrades absolute active generators into machine-grade power systems with buffers, states, and player-manageable constraints.
- **Operating Mode:** The dense branch is intentionally limited to active generators:
  1. `Dense Furnator Array` — buffered multi-fuel burn windows with batch ignition
  2. `Dense Magmator Core` — larger lava tank, but each generation step resolves only `4000 mB` at a time
  3. `Dense Thermo Matrix` — uses `Cryofluid` or `Saline Coolant` instead of water, stores heat and steam, and gains efficiency while staying below dangerous temperature
- **Shared Rule:** Dense generators should be dedicated, multi-input, and visibly stateful.

---

## Parked superior candidates

These ideas are not part of the active superior roster right now because they do not have a strong enough gameplay justification.

### Adaptive Assembler

- **Status:** Parked / removed from current superior scope
- **Reason:** A better assembler does not yet justify itself as a meaningful superior machine.

### Quantum Digitizer

- **Status:** Parked / removed from current superior scope
- **Reason:** The concept still lacks a compelling role in actual progression and automation.

---

## Shared system dependencies

Before broad implementation, the project should formalize:

- button panel helpers
- machine profile declarations
- heat state helpers
- coolant requirement helpers
- multi-lane processing helpers
- batch operation helpers
- machine-local mode storage conventions
- label refresh priorities
- generator-side state helpers for burst / safety logic

Without that, each superior machine will reinvent the same internals.

---

## Recommended implementation waves

### Wave 0: shared systems first

- item-button subsystem
- machine mode persistence helpers
- shared HUD / status helpers for mode summaries
- shared slot profile definitions
- shared cooldown / debounce helpers
- shared batch / lane / thermal helpers

### Wave 1: stabilize the current superior baseline

- Industrial Burner
- Pulverizer
- Seismic Breaker
- Pattern Placer
- Arc-Press Forge

Reason:

- they already define the identity of the superior program
- they validate the button/profile infrastructure with manageable risk

### Wave 2: finish the active superior drafts

- Abyssal Fisher
- Centrifugal Siever
- Genetic Seed Synthesizer
- Verdant Cultivator

Reason:

- these already justify richer behavior but still need final identity locks

### Wave 3: standalone superior branches

- Arcane Imprinter
- Cryo Cooling Bay
- Cryofluid Condenser
- Cryo Stabilizer Rack
- Disenchanter Array
- Induction Matrix Anvil

Reason:

- this is where “multi-section machine -> specialist superior branch” becomes real design, not just a note in the roadmap

### Wave 4: high-complexity industrial / orchestration wave

- Impact Crusher
- Dual Siever
- Magmatic Reactor Chamber
- Dense Active Generators

---

## Locked decisions from April 2026 review

- **Abyssal Fisher** is the correct player-facing name; internal `abyssal_*` IDs can remain until a runtime migration is worth it.
- **Arcane Imprinter** should stay simple: dedicated enchanting plus a speed bonus is enough.
- **Centrifugal Siever v1** stays batch + steam only.
- **Verdant Cultivator** replaces the old `Chrono Harvester` name and should combine planting, bonemeal support, harvesting, and buffering.
- **Cryo Chamber** now splits cleanly into **Cryo Cooling Bay**, **Cryofluid Condenser**, and **Cryo Stabilizer Rack**.
- **Dense Active Generators** are limited to the active generator line only.
- **Disenchanter Array** keeps `Extract` and `Absorb`, both with Curse Protection module support.
- **Dual Siever** lanes should feel distinct, but shared energy/output remain mandatory.
- **Genetic Seed Synthesizer** keeps its current profile labels for now, but their exact differences still need a later balance pass.
- **Impact Crusher** should use a destructive overheat failure state that forces player intervention.
- **Induction Matrix Anvil** can extend reinforcement through Module IV/V for `150%` and `200%` tiers.
- **Magmatic Reactor Chamber** should reward healthy heat management with both efficiency and stored thermal resources.

---

## Success criteria

The Superior Machines program is healthy if:

- players can explain why each superior block exists in one sentence
- every superior block has a distinct logistics cost
- modes are visible and readable directly from the machine UI
- superior generators feel like machines, not oversized passive blocks
- standalone branches justify their existence by simplifying or specializing a bigger machine
- new superior blocks mostly declare profiles instead of re-implementing UI/runtime glue from scratch

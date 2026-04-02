# Upgraded Machines Design

## Goal

Define the `Upgraded Machines` program for Ascendant Technology as a real expansion of UtilityCraft machinery, not as a flat "faster tier" system.

These variants must:

- gain stronger mechanical identity
- justify higher cost through new workflows, not only throughput
- introduce industrial dependencies such as steam, heat, cooling, buffering, or batch logic
- support mode-driven operation through a reusable item-button subsystem

---

## Design pillars

### 1. Upgrades must change behavior

An upgraded machine should add at least one of the following:

- new operating mode
- new resource dependency
- parallel or simultaneous processing
- batch processing
- dual-lane or multi-lane execution
- internal buffering / routing logic
- safety or instability mechanics

If a machine only gains raw speed, it should remain an overclock or recipe-tier improvement, not a new block.

### 2. Heavy machines should feel industrial

The upgraded line should strongly leverage:

- steam as a throughput booster
- cooling fluids as safety/control resources
- heat as a real operational constraint
- larger inventories and clearer internal lanes
- more expensive casings and denser component chains

### 3. Mode complexity needs shared infrastructure

The project should not solve buttons/modes separately inside each machine.

Before the first mode-heavy upgraded machine is finalized, Ascendant should standardize:

- button rendering
- mode persistence
- slot locking and anti-item-insertion handling
- page switching
- HUD summaries
- per-button cooldown/debounce

---

## What should actually become an Upgraded Machine

### Strong fits

These are the best candidates because the base UtilityCraft role has clear room for mechanical expansion.

#### Heavy Processing Line

- `crusher -> Pulverizer`
  - Better fit for industrial acceleration through steam, buffer growth, and batch logic.
- `crusher -> Impact Crusher`
  - Strong high-risk variant with heat/coolant gameplay and dual processing identity.
- `incinerator -> Industrial Burner`
  - Excellent candidate for simultaneous lanes, lava boosting, and bulk trash-to-value loops.
- `electro_press -> Arc-Press Forge`
  - Natural mode split between precision and throughput.
- `induction_anvil -> Induction Matrix Anvil`
  - Good upgrade because it can interact with reinforcement/modules rather than only becoming faster.

#### Block / World Automation

- `block_breaker -> Seismic Breaker`
  - Clear mode identity: area patterns, precision mode, energy scaling.
- `block_placer -> Pattern Placer`
  - Good because patterns and blacklist logic justify a dedicated machine.
- `harvester -> Chrono Harvester`
  - Works well with harvest policies, growth awareness, and uproot mode.

#### Resource / Synthesis

- `autosieve -> Centrifugal Siever`
  - Strong as the batch-processing industrial branch.
- `autosieve -> Dual Siever`
  - Strong as the split-lane branch, but should wait for dedicated assets.
- `seed_synthesizer -> Genetic Seed Synthesizer`
  - Good if profile buttons and recipe gating are implemented cleanly.
  - Implemented v1 around a single Cryofluid tank with `Growth`, `Resilience`, and `Yield` profile cycling.
  - Current superior layout uses 30 slots: 4 seed input lanes, 1 soil slot, 1 profile button, 1 Cryofluid input, 1 Cryofluid display, 4 upgrade slots, and outputs `15-29`.
  - Occupied seed lanes now synthesize together in a shared cycle instead of selecting only one active lane.
- `digitizer -> Quantum Digitizer`
  - Strong infrastructure node rather than simple processor.
- `assembler -> Adaptive Assembler`
  - Very strong identity, but high system complexity.

#### Thermal / Fluid / Utility

- `magmatic_chamber -> Magmatic Reactor Chamber`
  - Works well if heat becomes a reusable industrial output.
- `autofisher -> Abyssal Auto-Fisher`
  - Good if environment-aware loot rules are worth the content budget.

### Medium fits

These make sense, but should come after the button system and heavy processing foundation.

- `Genetic Seed Synthesizer`
- `Chrono Harvester`
- `Magmatic Reactor Chamber`
- `Quantum Digitizer`
- `Abyssal Auto-Fisher`

### Only after subsystem maturity

These should wait until mode/buttons, routing, and machine profile infrastructure are proven.

- `Adaptive Assembler`
- `Dual Siever`
- `Impact Crusher`

---

## Machines that should not be treated as the core Upgraded Machines wave

These already have strong Ascendant identity or are better handled as standalone machines instead of "upgraded UtilityCraft variants":

- Enchantment Station
- Cryo Chamber
- Catalyst Weaver
- Liquifier / Flux Crucible
- Energizer / Pulse Forge
- Vaporworks Processor
- Residue Processor
- Duplicator / Singularity Fabricator
- Laser Barrier
- Network Center
- Interdimensional Infuser

These should still receive improvements over time, but they belong to the main Ascendant machine line, not the UtilityCraft-inspired upgraded line.

Important lineage note:

- `Catalyst Weaver` is the actual upgraded evolution of the UtilityCraft `Infuser`.
- `Interdimensional Infuser` is a standalone Ascendant synthesis machine, not part of the upgraded-machine lineage.

---

## Recommended implementation waves

## Wave 0: shared systems first

Build the reusable infrastructure before shipping mode-heavy blocks.

- item-button subsystem
- machine mode persistence helpers
- shared HUD/status helpers for mode summaries
- shared slot profile definitions
- shared cooldown/debounce helpers

## Wave 1: low-risk, high-value upgraded machines

- Industrial Burner
- Pulverizer
- Seismic Breaker
- Pattern Placer

Reason:

- strongest payoff for production gameplay
- easier to validate than multi-fluid, multi-risk machines
- enough complexity to prove the button subsystem

## Wave 2: first modal processing machines

- Arc-Press Forge
- Centrifugal Siever
- Chrono Harvester
- Genetic Seed Synthesizer

Reason:

- introduces profile/mode switching and batch logic without extreme thermal complexity

## Wave 3: high-complexity industrial machines

- Impact Crusher
- Induction Matrix Anvil
- Magmatic Reactor Chamber

## Wave 4: infrastructure-scale orchestration

- Dual Siever
- Quantum Digitizer
- Adaptive Assembler
- Abyssal Auto-Fisher

---

## Proposed machine upgrade directions

## Heavy Processing Line

### Pulverizer

- Base identity:
  - stable crusher upgrade
  - steam-fed throughput multiplier
  - better buffers and recipe batching
- Suggested mechanics:
  - primary modes: `Standard`, `Steam Boost`
  - optional batch size scaling through Quantity upgrade
  - steam buffer that reduces cycle time and increases DE cost
  - larger output buffer to avoid choking
- Why it is good early:
  - simple to understand
  - industrial feel without requiring full thermal danger simulation

### Impact Crusher

- Base identity:
  - dangerous, peak-output crusher branch
  - dual processing lanes
  - heat accumulation and cooling safety envelope
- Suggested mechanics:
  - lava input required for operation
  - internal heat meter
    - look at UtilityCraft-Heavy-Machinery for the heat meter.
  - coolant tank with tiered coolants
    - Cryofluid (Ascendant Technology) and Saline Coolant (Heavy Machinery)
  - `Balanced`, `Overdrive`, `Emergency Cooldown` modes
  - shutdown / stall penalties if heat exceeds safe range
- Important note:
  - should only be built after the thermal subsystem is reusable

### Industrial Burner

- Base identity:
  - late automation incinerator with simultaneous lanes
- Suggested mechanics:
  - 3 input lanes + 3 output lanes
  - all lanes process together
  - optional lava injection raises batch count per cycle
  - ash/byproduct lane for selected recipes
  - `Clean Burn` vs `Mass Burn` modes // Not necessary
- Why it is a priority:
  - high utility
  - low UI ambiguity
  - strong late-game logistics value

### Arc-Press Forge

- Base identity:
  - metallurgical press with meaningful mode split
- Suggested mechanics:
  - `High Speed` mode:
    - presses in batches
    - higher energy draw
    - small loss chance
  - `Low Loss` mode:
    - presses fewer items
    - safer yield
    - moderate speed improvement over baseline
  - quantity upgrades increase batch cap only in high-speed path
- Why it matters:
  - perfect first showcase for a clean mode-button system

### Induction Matrix Anvil

- Base identity:
  - Repairs and reinforces gear with direct module interaction.
- Suggested mechanics:
  - Direct interaction with reinforcement systems/modules. Especifically, the Reinforcement Module from Enchantment Station.
  - Repairs instantly, but requires a cooldown between operations. Can use an inverted progress bar using regular arrows to indicate the cooldown meter.
  - Can use the same button system to switch between `Repair` and `Reinforce` modes, with `Reinforce` mode only being available when a reinforcement module is present.
- Risk: None.

## Resource / Synthesis Line

### Centrifugal Siever

- Base identity:
  - industrial batch-focused autosieve upgrade
  - one material stream processed in grouped cycles
  - optional steam-fed throughput boost
- Suggested mechanics:
  - one shared input flow feeding a reinforced sieve chamber
  - one active mesh chamber per cycle, designed for bulk runs instead of dual lanes
  - grouped processing that turns stacked inputs into burst-style result output
  - optional steam injection that shortens cycle time while increasing DE cost
  - larger shared output buffer to absorb batch spikes
- Why this naming fits:
  - it mirrors the upgraded-machine naming logic already used by Pulverizer and Industrial Burner
  - it gives the autosieve line a clear industrial identity without overlapping the future dual-lane machine

#### Centrifugal Siever v1 implementation draft

- Scope guardrails:
  - keep `sieveRecipes` compatibility as the base behavior
  - keep `utilitycraft:mesh` tier and multiplier rules intact
  - do not introduce dual-lane logic in v1
  - do not require a button panel for the first release; the identity should come from batch logic + optional steam

- Recommended inventory layout (29-slot superior machine profile):
  - `0`: energy HUD
  - `1`: status label
  - `2`: progress meter
  - `3-6`: shared input buffer
  - `7`: mesh slot
  - `8`: steam input
  - `9`: steam tank display / fluid HUD
  - `10-13`: upgrade slots
  - `14-28`: shared output buffer (15 slots)

- Recommended upgrade package:
  - **Speed** for shorter spin-up time
  - **Efficiency** for lower DE cost per batch
  - **Hyper Processing** for better throughput scaling without changing drop logic
  - **Quantity** as the signature upgrade that raises the batch cap

- Suggested first-pass tuning:
  - base batch cap: `8` items per completed cycle
  - Quantity Upgrades: `+4` items to the cap per level
  - steam boost: reduce cycle time by roughly `30%` while increasing DE draw by roughly `25%`
  - steam remains optional; the machine must still function without it

- Recommended cycle logic:
  1. Scan the shared input buffer for the first valid item with a registered sieve recipe.
  2. Lock the cycle to that item type until the batch is resolved.
  3. Validate the mesh slot and read its `tier` and `multiplier`.
  4. Determine the batch size from available items, batch cap, and output headroom.
  5. Charge energy over time; if steam is available, apply the steam throughput modifier.
  6. On completion, consume the batch input and run the existing sieve loot table logic once per processed item.
  7. Aggregate the generated items and insert them into the shared output buffer.

- Output and automation rules:
  - output storage should be treated as one shared buffer, not lane-specific output groups
  - automation should be able to push into the input range and pull from the output range using the existing special-machine conventions
  - compressed sieve materials should stay compatible with the current recipe table instead of using a custom shortcut system

- Failure states that should be visible to the player:
  - `No Input`
  - `No Mesh`
  - `Invalid Material`
  - `Mesh Too Weak`
  - `Output Full`
  - `No Energy`

- Nice-to-have only after the first version is stable:
  - profile buttons such as `Balanced` and `Turbo`
  - steam-specific HUD indicators beyond the standard fluid display
  - recipe groups with custom centrifugal-only bonus rolls

### Dual Siever

- Base identity:
  - split-lane autosieve upgrade stored for future dedicated assets
- Preserved profile:
  - two independent sieve lanes
  - one mesh slot per lane
  - one input type per lane
    - if the opposite lane 1 is idle, it pulls half of lane 2 input to keep both lanes active and vice versa.
  - shared output logistics
  - autosieve-compatible baseline behavior first
  - optional steam boost once implemented
- Preserved arbitration model:
  - each lane should be able to pull from the same shared input pool when idle
  - each lane keeps its own progress state and mesh validation
  - both lanes deposit into the same output buffer to keep logistics compact
- Important note:
  - this is the branch that had previously been mislabeled as `Centrifugal Siever`
  - it should stay parked until the proper block assets are available

---

## Button subsystem proposal

## Why item-buttons are the right approach

The machine inventory is already the closest thing Ascendant has to an in-world control panel.

Item-buttons let the player:

- see the machine state directly in the inventory
- switch modes without leaving the block flow
- reuse existing hidden-slot / label-slot patterns
- keep machines diegetic instead of form-heavy

---

## Button panel model

Each upgraded machine should define a `button panel profile`:

- `panelId`
- `slots`
- `buttons`
- `pages`
- `defaultState`
- `validators`
- `renderers`

Each button should define:

- `id`
- `slot`
- `type`
  - `toggle`
  - `cycle`
  - `radio`
  - `action`
  - `page`
- `property`
- `states`
- `icons`
- `cooldownTicks`
- `isVisible(machine, state)`
- `isEnabled(machine, state)`
- `onPress(machine, state)`

---

## How the item-button interaction should work

### Input model

Because Bedrock container UIs are limited, the system should treat button slots as protected UI slots.

Recommended flow:

1. Machine renders the expected button item into reserved button slots.
2. On tick, the subsystem checks each reserved slot.
3. If the button item is missing, replaced, or moved, the subsystem interprets that as a press attempt.
4. The slot is restored immediately.
5. The state is updated and the panel is re-rendered.

### Anti-insertion rule

If the player tries to insert a real item into a button slot:

- the inserted item should be rejected
- it should return to the player if possible
- otherwise it should be spawned at the machine center
- the button item should be restored on the same tick or next tick

This avoids "eating" player items and keeps button slots deterministic.

### Debounce

Every button slot should have a short cooldown:

- recommended default: `4 ticks`
- page-change buttons: `6 ticks`
- dangerous actions: `8-10 ticks`

Store cooldowns in dynamic properties:

- `ascendant:btn:<panelId>:<slot>:cd`

---

## Visual states

Each button should have clear visual states:

- `active`
- `inactive`
- `disabled`
- `locked`
- `warning`

Recommended implementation path:

- prototype path:
  - use existing placeholder UI items + `nameTag` + lore + selection text
- polished path:
  - use dedicated item assets prepared for button states
  - keep the lore as fallback explanation

---

## Recommended slot taxonomy

For upgraded machines with modes, use a predictable layout:

- slot 0: energy HUD
- slot 1: machine status label
- slot 2: progress or batch meter
- mode panel slots: left or top edge
- toggle panel slots: right edge
- info label slot: one dedicated summary slot
- hidden/internal slots: final row or unreachable indices

This consistency matters more as the project grows.

---

## Suggested shared module

Add a shared DoriosCore helper:

- `BP/scripts/DoriosCore/machinery/buttonPanel.js`

Responsibilities:

- render button items
- read/write panel state
- detect press attempts
- reject inserted items
- apply button cooldowns
- expose `getMode`, `setMode`, `cycleMode`, `toggleOption`
- feed status labels with current mode summary

Optional companion module:

- `BP/scripts/DoriosCore/machinery/machineProfile.js`

Responsibilities:

- declare slot layouts
- declare button panels
- declare HUD slots
- declare dynamic property namespaces

---

## Shared system dependencies for upgraded machines

Before broad implementation, the project should formalize:

- heat state helpers
- coolant requirement helpers
- multi-lane processing helpers
- batch operation helpers
- machine-local mode storage conventions
- label refresh priorities

Without that, each upgraded machine will reinvent the same internals.

---

## Recommended first concrete build order

1. Button subsystem prototype in DoriosCore.
2. Industrial Burner as first production machine using multi-lane logic.
3. Arc-Press Forge as first strong mode-driven machine.
4. Pulverizer with steam boost integration.
5. Seismic Breaker as first world-automation mode panel.
6. Impact Crusher only after heat/coolant infrastructure is reusable.

---

## Success criteria

The Upgraded Machines program is healthy if:

- players can explain why each upgraded machine exists in one sentence
- each machine has a distinct logistics cost
- modes are visible and readable directly from the machine UI
- button slots never eat real items
- adding a new modal machine mostly means declaring a profile, not rewriting UI logic

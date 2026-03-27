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

- `autosieve -> Complex Siever`
  - Strong as a control-heavy, stable branch.
- `autosieve -> Centrifugal Siever`
  - Strong as a split-lane branch.
- `autosieve -> Dual Complex Siever`
  - Best used only after Complex Siever proves stable.
- `seed_synthesizer -> Genetic Seed Synthesizer`
  - Good if profile buttons and recipe gating are implemented cleanly.
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
- `Impact Crusher`
- `Dual Complex Siever`

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
- Complex Siever
- Chrono Harvester
- Genetic Seed Synthesizer

Reason:

- introduces profile/mode switching without extreme thermal complexity

## Wave 3: high-complexity industrial machines

- Impact Crusher
- Induction Matrix Anvil
- Centrifugal Siever
- Magmatic Reactor Chamber

## Wave 4: infrastructure-scale orchestration

- Dual Complex Siever
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
  - coolant tank with tiered coolants
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
  - `Clean Burn` vs `Mass Burn` modes
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
  - alloy reinforcement and recomposition hub
- Suggested mechanics:
  - direct interaction with reinforcement systems/modules
  - recipe classes: reshape, reinforce, rebind, stabilize
  - thermal overhead grows with operation class
  - `Precision`, `Recompose`, `Reinforce` modes
- Risk:
  - needs clear recipes and good mode messaging to avoid confusion

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

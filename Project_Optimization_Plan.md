# Project Optimization Plan

## Goal

Reduce structural complexity in Ascendant Technology before the codebase becomes too large to evolve safely.

This document is not about gameplay balance. It is about keeping the project maintainable while the machine count, UI complexity, and systems depth keep growing.

---

## Current scaling risks

### 1. Machine logic is becoming too bespoke

Many machines already carry their own:

- slot maps
- HUD render rules
- dynamic property naming
- progress handling
- recipe normalization quirks
- transfer cadence logic

That is manageable for a few machines, but expensive for a full superior line.

### 2. UI logic is about to multiply

The upcoming superior machines need:

- multiple modes
- multiple button slots
- page switching
- richer status labels
- lock states

If each machine builds that manually, the project will slow down fast.

### 3. Dynamic-property sprawl

The codebase increasingly depends on one-off dynamic property keys.

That creates:

- naming drift
- collision risk
- hard migrations
- harder debugging

### 4. Recipes are normalized in many places

This is workable now, but it will become a maintenance burden once superior machines add:

- multi-lane recipes
- batch sizes
- thermal requirements
- fluid alternatives
- mode-specific constraints

### 5. Tick cost will keep rising

More machines means more:

- scanning
- HUD rerenders
- fluid/item transfer passes
- dynamic property reads
- slot verification

Without shared throttle rules, performance work will become reactive instead of planned.

---

## Main optimization targets

## A. Shared machine profile layer

Create a small declarative profile system for machines.

Suggested file:

- `BP/scripts/DoriosCore/machinery/machineProfile.js`

Profile should centralize:

- slot layout
- blocked slots
- hidden slots
- HUD slots
- mode panel slots
- property namespace
- optional transfer cadence defaults

Value:

- less boilerplate per machine
- easier UI consistency
- easier future migration

## B. Shared button panel subsystem

Suggested file:

- `BP/scripts/DoriosCore/machinery/buttonPanel.js`

This is the highest-priority optimization because it prevents every superior machine from becoming a UI snowflake.

Value:

- one place to solve button rendering
- one place to solve anti-insertion behavior
- one place to solve mode persistence
- one place to solve cooldown/debounce

## C. Shared process helpers

Suggested helpers:

- `batchProcessing.js`
- `laneProcessing.js`
- `thermalState.js`
- `machineStatus.js`

Value:

- fewer per-machine implementations of the same math
- easier balancing of DE, time, heat, and coolant costs

## D. Property namespace registry

Expand the property registry approach already being used.

Suggested file:

- `BP/scripts/config/property_registry.js`

Add grouped namespaces for:

- buttons
- machine modes
- thermal state
- per-lane progress
- machine-local caches

Value:

- easier audits
- easier renames
- safer system growth

## E. Recipe schema normalization

Suggested directory:

- `BP/scripts/config/recipes/shared/`

Shared helpers should normalize:

- time / ticks / seconds
- batch sizes
- lane counts
- fluid requirements
- catalyst alternatives
- mode restrictions
- thermal requirements

Value:

- fewer one-off recipe shapes
- easier tooling
- easier validation

## F. Tick-budget planning

Split machine work into cadence classes:

- every tick
- every 2 ticks
- every 4 ticks
- every 10 ticks
- on-demand only

Examples:

- button slot validation: every 2-4 ticks
- network scans: slower cadence
- expensive recipe matching: only when inputs changed, where possible
- HUD rerender: only on state change or low-frequency cadence

Value:

- less accidental performance regression
- clearer reasoning about machine cost

---

## Recommended folder / module additions

### Core infrastructure

- `BP/scripts/DoriosCore/machinery/buttonPanel.js`
- `BP/scripts/DoriosCore/machinery/machineProfile.js`
- `BP/scripts/DoriosCore/machinery/machineStatus.js`
- `BP/scripts/DoriosCore/machinery/thermalState.js`
- `BP/scripts/DoriosCore/machinery/laneProcessing.js`
- `BP/scripts/DoriosCore/machinery/batchProcessing.js`

### Config-side organization

- `BP/scripts/config/machines/superior/`
- `BP/scripts/config/recipes/shared/`

### Documentation

- `docs/machines/`
- `docs/systems/`
- `docs/profiles/`

Even if those exact paths change later, the repo needs a clearer split between:

- machine runtime
- config/schema
- design docs

---

## Priority roadmap

## Phase 1: protect the next wave

- build button panel subsystem
- build machine profile schema
- standardize property namespaces for mode/button state
- define slot-layout conventions

This phase should happen before the first heavy superior machine is implemented for real.

## Phase 2: reduce duplication in existing machines

- migrate repeated HUD/status helpers into shared utilities
- migrate repeated time/rate helpers into shared processing helpers
- migrate repeated label-building patterns where practical

## Phase 3: performance and scaling

- classify tick cadence by subsystem
- cache expensive recipe lookups where safe
- reduce full rerender frequency for labels and UI slots
- centralize item/button signature checks

## Phase 4: documentation and workflow

- one design file per major machine family
- one implementation checklist per machine
- one smoke-test checklist for machine QA

---

## Suggested machine implementation workflow

For each new large machine:

1. Create a design note.
2. Define the machine profile.
3. Define the recipe schema.
4. Define mode/button panel behavior.
5. Implement runtime.
6. Run smoke-test checklist.
7. Document balancing knobs.

This keeps large features from skipping architecture and becoming expensive to revisit.

---

## Smoke-test checklist proposal

Each machine should eventually have a lightweight manual checklist covering:

- placement / break behavior
- inventory size and blocked slots
- item transfer
- fluid transfer
- energy usage
- mode switching
- save/load persistence
- UI labels
- edge-case full output / missing input / no energy behavior

This is much cheaper than debugging after multiple machines share the same subsystem.

---

## Success criteria

The project is becoming healthier if:

- new modal machines mostly declare profiles instead of hand-rolling UI logic
- machine files get smaller on average
- property names become predictable
- performance work starts from known cadence rules
- design docs and implementation stay aligned


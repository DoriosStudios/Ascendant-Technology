# Refining Table

The Refining Table is the player-facing StatsCore workstation. It refines a
compatible equipment item, rolls permanent attribute quality, awakens Runic
abilities, and writes the resolved lore back to the item immediately.

## Inputs and costs

- Equipment occupies slot 3 and is also the output slot.
- Ingots occupy slot 4 and improve the roll according to material power.
- Chips occupy slot 5 and define the base quality interval and processing cost.
- The confirmation control occupies slot 6.
- A Runic Core or Advanced Runic Core occupies slot 8.
- Speed and energy upgrades occupy slots 9 and 10.
- Stored XP is displayed in slot 11; item and fluid IO controls use slots
  12–23; the full-statistics display occupies slot 24.
- A normal roll accepts at most 8 ingots. An already awakened advanced item, or
  a roll awakening through an Advanced Runic Core, accepts up to 12.
- Rerolls increase both XP and energy costs. Input identity, quantities, item
  UID, previous refinement state, available XP, and core mode form the operation
  signature; changing them invalidates an active operation safely.

## Runic awakening

- A Runic Core awakens the equipment's primary exclusive ability.
- An Advanced Runic Core can awaken primary and advanced abilities, improves
  supported strong effects, and enables the advanced refinement ceiling.
- Every refinement that consumes an Advanced Runic Core makes an independent
  10% same-category inheritance roll. A successful roll grants one unowned
  ability from another compatible item and immediately attempts another 10%
  roll. There is no fixed success-count cap; the chain ends on failure or when
  its unique donor pool is exhausted.
- Combat equipment inherits from combat equipment, mining/utility equipment
  inherits from mining/utility equipment, and support equipment inherits from
  support equipment. Donor strength follows the recipient's material tier.
- Inherited effects are persisted as StatsCore ability data, participate in
  runtime resolution, appear inside the item's `Ability … +` summary, and are
  listed individually in the table's statistics display.

## Displays

The primary status display includes:

- operation state and equipment name;
- profile, material tier, affinity, grade, quality, and category levels;
- chip, ingot material, ingot count, and quality interval;
- Strong, Masterwork, and Transcendent odds;
- required/stored XP and per-tick energy cost;
- required Runic Core, primary ability and short behavior description;
- Advanced inheritance chance and previously inherited abilities.

The details display focuses on level, current grade, roll range, high-grade
odds, awakening requirements, advanced ingot ceiling, and inheritance rules.
The all-statistics display exposes resolved combat, mining, defense,
event-driven, elemental, Double/Triple Trouble, native ability, and inherited
ability values.

## Persistence

Refinement writes are forced to synchronize lore before the equipment returns
to slot 3. The saved state includes refinement grade/range/quality, consumed XP,
reroll count, material contribution, Runic unlock state, inherited effects, and
the normal StatsCore progression categories.

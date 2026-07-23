# Ascendant Technology feature inventory and status

Last updated: 2026-07-22

This document is the AT rebuild tracker. The inventory was obtained from the active
`BP` and `RP` definitions and the runtime preserved under `data/legacy/BP/scripts`.

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Connected to the current runtime, or declarative content that requires no AT logic. |
| 🟨 | Exists and loads, but is only partially functional or has no active consumer. |
| ❌ | Its AT logic is disabled and must still be rebuilt. |
| ⬜ | Manual in-game test pending. |
| 🧪 | Manual testing in progress. |
| ☑️ | Manual testing completed. |

A `✅` under **Active now** means the required code and components are registered. It
does not replace the **In-game test** column. A feature should not be considered complete
until placement/use, processing, IO, destruction, and persistence have been tested where
applicable.

## Summary

| Area | Inventory | Active now | Main remaining work |
|---|---:|---:|---|
| AT machines | 30 | 0 | 30 new implementations |
| Generators | 11 blocks / 7 families | 6 blocks / 6 families | Power Beacon (5 tiers) |
| Transportation | 30 blocks | 0 | Conveyors, bridges, and routing |
| Overclock | 5 blocks | 0 | Network, tower, relay, and reinforced IO |
| Mob grinding | 1 block | 0 | Mob Magnet |
| Storage | 1 block | 0 | Absolute Container |
| Ores and material blocks | 9 blocks | 9 definitions | Verify world generation and drops |
| Gameplay items, excluding UI | 128 | 45 complete or connected; 83 partial | Capsules, modules, and AT effects |
| UI helper items | 215 | 0 AT consumers | Rebuild UI last |

## Technical foundation

| Active now | In-game test | Layer | Status |
|---|---|---|---|
| ✅ | ⬜ | UtilityCraft 3.5.0 dependency | Declared in the manifest. |
| ✅ | ⬜ | DoriosLib | Canonical copy is active; registration and initialization pass the build. |
| ✅ | ⬜ | DoriosCore | Clean UC copy with no AT modifications. |
| ✅ | ⬜ | DoriosAPI removed | There are no active imports. It remains only as a legacy reference. |
| ✅ | ⬜ | Legacy isolated | `data/legacy` is not imported by the active runtime. |
| 🟨 | ⬜ | ATCore | Directory structure exists, but it has no functional AT classes yet. |
| ✅ | ⬜ | esbuild bundle | The current entrypoint bundles successfully. |
| ✅ | ⬜ | Base `Machine`, `BasicMachine`, `Generator`, and storage classes | Available from DoriosCore for new implementations. |
| ❌ | ⬜ | AT feature registration | Feature indexes exist, but no AT feature has been rebuilt yet. |

## Generators

The six generators use components registered by UC, and their block parameter contracts
match the current UC tiers with AT-specific tier values. Battery, Solar, and Wind require
no block-ID-specific IO policy. Furnator, Magmator, and Thermo use explicit UC family tags;
DoriosCore resolves each tagged external block type once and materializes the ordinary IO
registration. The experimental `dense_*` scripts found in legacy were not imported by the
old `main.js`, so they are not part of the confirmed behavior of the previous release.

| Active now | In-game test | Family / identifier | Current implementation | Test requirements |
|---|---|---|---|---|
| ✅ | ⬜ | Absolute Battery — `utilitycraft:absolute_battery` | UC `utilitycraft:battery` | Place, charge, transfer, break, and restore energy. |
| ✅ | ⬜ | Absolute Furnator — `utilitycraft:absolute_furnator` | UC `utilitycraft:furnator` + `utilitycraft:io.furnator` | Fuel, IO, generation, UI, and persistence. |
| ✅ | ⬜ | Absolute Magmator — `utilitycraft:absolute_magmator` | UC `magmator` + `fluid_container` + `utilitycraft:io.magmator` | Lava input, IO, energy, and persistence. |
| ✅ | ⬜ | Absolute Solar Panel — `utilitycraft:absolute_solar_panel` | UC `utilitycraft:solar_panel` | Day/night cycle, generation, and transfer. |
| ✅ | ⬜ | Absolute Thermo Generator — `utilitycraft:absolute_thermo_generator` | UC `utilitycraft:thermo_generator` + `utilitycraft:io.thermo_generator` | Heat source, coolant, IO, and energy. |
| ✅ | ⬜ | Absolute Wind Turbine — `utilitycraft:absolute_wind_turbine` | UC `utilitycraft:wind_turbine` | Altitude, weather, generation, and transfer. |
| ❌ | ⬜ | Power Beacon — `basic`, `advanced`, `expert`, `ultimate`, `absolute` | The `power_beacon` component and ticks are disabled | Rebuild tiers, consumption, range, UI, and effects. |

## Machines

`utilitycraft:machine_recipes` is active again where appropriate because UC registers that
component. It only exposes parameters: none of these machines processes recipes while its
AT component and tick remain disabled.

| Active now | In-game test | Machine | Behavior preserved in legacy | Likely base |
|---|---|---|---|---|
| ❌ | ⬜ | Abyssal Fisher | Automated fishing using fishing nets, water, loot, energy, and upgrades. | AT class over `Machine` |
| ❌ | ⬜ | Arc Press Forge | Pressing/forging with recipes, progress, energy, IO, and quantity upgrades. | `BasicMachine` + AT extension |
| ❌ | ⬜ | Arcane Enchanter | Enchanting through enchantability modules and result selection. | Specialized AT class |
| ❌ | ⬜ | Catalyst Weaver | Recipe processing with items, catalysts, and fluids. | Item/fluid machine |
| ❌ | ⬜ | Centrifugal Siever | Advanced sieving with meshes, multiple results, and upgrades. | AT sieve class |
| ❌ | ⬜ | Cryo Chamber | Cooling recipes, cryofluid, energy, and cooling aura. | Item/fluid machine + multiblock |
| ❌ | ⬜ | Cryo Freezer | Superior cryogenic processing variant. | Cryo base extension |
| ❌ | ⬜ | Cryo Stabilizer | Cryogenic stabilization and specialized progress behavior. | Specialized AT class |
| ❌ | ⬜ | Cryofluid Synthesizer | Produces cryofluid from inputs and energy. | Item/fluid machine |
| ❌ | ⬜ | Disenchanter | Extracts enchantments from items. | Specialized AT class |
| ❌ | ⬜ | Dual Siever | Dual sieving with mesh, two input/output lines, and upgrades. | AT sieve class |
| ❌ | ⬜ | Duplicator | Profile/recipe-based duplication using fluids, energy, and item metadata. | Specialized AT class |
| ❌ | ⬜ | Enchantment Station | Direct enchantment application and management. | Specialized AT class |
| ❌ | ⬜ | Energizer | Energized recipes and heater aura. | `BasicMachine` + multiblock |
| ❌ | ⬜ | Genetic Seed Synthesizer | Seed synthesis with recipes, selection, and upgrades. | Specialized AT class |
| ❌ | ⬜ | Impact Crusher | Advanced crushing with temperature/fluids, multiple results, and upgrades. | Specialized AT class |
| ❌ | ⬜ | Industrial Burner | Industrial thermal processing with recipes and quantity upgrades. | `BasicMachine` + AT extension |
| ❌ | ⬜ | Laser Barrier | Energy barrier, projected field, filters, and size/energy upgrades. | AT structure class |
| ❌ | ⬜ | Liquifier | Converts items into fluids with byproducts and IO. | Item/fluid machine |
| ❌ | ⬜ | Magmatic Reactor Chamber | Reactor chamber with energy, states, and thermal behavior. | Specialized AT class |
| ❌ | ⬜ | Network Center | Machine-network inspection and control center. | AT network class |
| ❌ | ⬜ | Pattern Placer | Places blocks according to a pattern, orientation, and configured area. | AT world-action class |
| ❌ | ⬜ | Pulverizer | Crushing with recipes, multiple results, and quantity upgrades. | `BasicMachine` + AT extension |
| ❌ | ⬜ | Refining Table | Equipment and attribute refinement integrated with StatsCore. | AT class + new stats system |
| ❌ | ⬜ | Reinforcement Anvil | Reinforces equipment through modules and persistent properties. | AT class + new stats system |
| ❌ | ⬜ | Residue Processor | Converts residue through recipes and possible byproducts. | `BasicMachine` + AT extension |
| ❌ | ⬜ | Seismic Breaker | Controlled area mining/breaking with energy and configuration. | AT world-action class |
| ❌ | ⬜ | Singularity Fabricator | High-cost fabrication using fluids, energy, capacity, and metadata. | Specialized AT class |
| ❌ | ⬜ | Vaporworks Processor | Steam/fluid-based processing with energy and recipes. | Item/fluid/gas machine |
| ❌ | ⬜ | Verdant Cultivator | Automated farming with an oriented area, crops, and quantity upgrades. | AT farming class |

## Storage and mob grinding

| Active now | In-game test | Feature | Status |
|---|---|---|---|
| ❌ | ⬜ | Absolute Container | Block exists; its custom entity, inventory, energy, fluids, UI, and persistence remain in legacy. |
| ❌ | ⬜ | Mob Magnet | UC `upgradeable` is registered, but the `mob_magnet` component and its tick remain disabled. |

## Overclock and reinforced IO

| Active now | In-game test | Feature | Legacy behavior to reproduce |
|---|---|---|---|
| ❌ | ⬜ | Overclock Tower | Network source; fuel/material, power, efficiency, burn time, and UI. |
| ❌ | ⬜ | Overclock Relay | Network extension/repetition, orientation, and UI. |
| ❌ | ⬜ | Reinforced Cable | Block and geometry load, but connections, energy/fluids, and network updates do not work. |
| ❌ | ⬜ | Reinforced Importer | Fluid import, filters, whitelist, and UI. |
| ❌ | ⬜ | Reinforced Exporter | Fluid export, filters, whitelist, and UI. |

## Conveyors and transportation

| Active now | In-game test | Group | Identifiers / variants |
|---|---|---|---|
| ❌ | ⬜ | Copper conveyors | `horizontal`, `inclined`, `declined`, `vertical` |
| ❌ | ⬜ | Titanium conveyors | `horizontal`, `inclined`, `declined`, `vertical` |
| ❌ | ⬜ | Aetherium conveyors | `horizontal`, `inclined`, `declined`, `vertical` |
| ❌ | ⬜ | Copper bridges | `bridge_transmitter`, `bridge_receiver`, `bridge_path` |
| ❌ | ⬜ | Titanium bridges | `bridge_transmitter`, `bridge_receiver`, `bridge_path` |
| ❌ | ⬜ | Aetherium bridges | `bridge_transmitter`, `bridge_receiver`, `bridge_path` |
| ❌ | ⬜ | Generic bridge path | `utilitycraft:conveyor_bridge_path` |
| ❌ | ⬜ | Basic routing | `conveyor_junction`, `conveyor_sorter`, `conveyor_inverted_sorter` |
| ❌ | ⬜ | Flow routing | `conveyor_overflow`, `conveyor_underflow` |
| ❌ | ⬜ | Advanced routing | `conveyor_router`, `conveyor_smart_router` |
| ❌ | ⬜ | Network updater | `conveyor_network_updater` |

Shared remaining work: item movement, entity ownership, scheduling, connections, bridges,
filters, UI, break cleanup, and persistence after chunk reloads.

## Cross-cutting systems preserved in legacy

| Active now | In-game test | System | Previous scope / rebuild decision |
|---|---|---|---|
| ❌ | ⬜ | AT machine runtime | Lifecycle, entity spawn/lookup, tick gating, on/off state, and cleanup. Rebuild over DoriosCore. |
| ❌ | ⬜ | AT machine IO | Slots, inputs/outputs, energy, fluids, and gases. Rebuild with `registerIOInterface`/`processIO`. |
| 🟨 | ⬜ | AT recipe registration | Five UC recipe injections are active through public script events; 12 machine-specific recipe modules remain pending. |
| ❌ | ⬜ | AT fluids and coolants | Container, output, holder, and coolant registration. Integrate with current DoriosCore/UC. |
| ❌ | ⬜ | Fluid capsules | Registration, world interaction, filling/draining, and infinite capsules. |
| ❌ | ⬜ | Multicore / auras | Cooling aura, heater aura, and cooperation between structures. Move to ATCore if shared. |
| ❌ | ⬜ | Overclock | Network discovery, fuel, boost, efficiency, relays, and machine integration. ATCore. |
| ❌ | ⬜ | Conveyors | Network, scheduling, ownership, routing, bridges, filters, and forms. ATCore. |
| ❌ | ⬜ | Drop system | Tool-specific drops, fortune/silk touch, hammers, and AT ores. Evaluate what UC already covers. |
| ❌ | ⬜ | StatsCore | Attributes, equipment, lore, abilities, refinement, commands, and persistent state. Keep separate from DoriosCore. |
| ❌ | ⬜ | StatsCore combat | Critical hits, effects, lifesteal, and penetration. |
| ❌ | ⬜ | StatsCore mining | Mining effects, tools, and shared durability behavior. |
| ❌ | ⬜ | Special AT armor | Additional Aetherium damage reduction/negation. Create an ATCore component, not a DoriosCore change. |
| ❌ | ⬜ | AT script events and commands | Configuration/debug commands and events tied to legacy systems. Redesign only those still needed. |
| ❌ | ⬜ | Inventory UI | Labels, buttons, progress bars, refresh throttling, and per-machine layouts. Work on this after runtime. |
| ❌ | ⬜ | Persistence/migration | Old dynamic properties, world compatibility, orphan entities, and data cleanup. |

## Declarative blocks, ores, and world generation

| Active now | In-game test | Group | Content |
|---|---|---|---|
| ✅ | ⬜ | Machine cases | `reinforced_machine_case`, `superior_machine_case` |
| 🟨 | ⬜ | Laser Barrier Field | Definition exists; it is only generated after Laser Barrier is rebuilt. |
| 🟨 | ⬜ | Aetherium | `aetherium_block`, `deepslate_aetherium_ore`, `end_aetherium_ore`; features and rules exist, advanced drops remain pending. |
| 🟨 | ⬜ | Titanium | `titanium_block`, `raw_titanium_block`, `deepslate_titanium_ore`; worldgen and loot exist, advanced drops remain pending. |
| 🟨 | ⬜ | Tungsten | `tungsten_block`, `raw_tungsten_block`, `deepslate_tungsten_ore`; no dedicated AT worldgen feature was found. |

Declared assets: 3 features, 6 feature rules, 10 loot tables, 1 structure, and 2 function
files. They must be tested in a new world before being marked complete.

## Items and tools

| Active now | In-game test | Family | Content and status |
|---|---|---|---|
| ✅ | ⬜ | Meshes | Titanium, Lucky, and Aetherium; UC registers `utilitycraft:mesh`. |
| ✅ | ⬜ | Fishing nets | Titanium, Lucky, and Aetherium; UC registers `utilitycraft:fishing_net`. |
| ✅ | ⬜ | Titanium tools | Axe, pickaxe, shovel, hoe, sword, and paxel use vanilla components. |
| ✅ | ⬜ | Aetherium tools | Axe, pickaxe, shovel, hoe, sword, and paxel use vanilla components. |
| ✅ | ⬜ | Hammers | Titanium and Aetherium; UC registers `hammer` and `dig_pebble`. Verify 3×3 drops and durability. |
| ✅ | ⬜ | AIOTs | Titanium, Aetherium, and Lucky; UC registers `hoe`/`shovel`. Verify area actions. |
| ✅ | ⬜ | Titanium armor | Four-piece set with vanilla wearable, protection, repair, and durability components. |
| 🟨 | ⬜ | Aetherium armor | Equipable set; the extra `utilitycraft:armor` reduction/negation is disabled. |
| ✅ | ⬜ | Progression materials | Runic Core, Enderling Tear, Pure Enderling Tear, and 15 ore/material items. |
| 🟨 | ⬜ | Enchantment modules | Base + tiers 1–5 and Curse Protection exist, but Arcane Enchanter is inactive. |
| 🟨 | ⬜ | Reinforcement modules | Tiers 1–3 exist, but Reinforcement Anvil is inactive. |
| 🟨 | ⬜ | AT upgrades | Hyper Processing and Size Upgrade exist, but their AT consumers are inactive. |
| 🟨 | ⬜ | Fluid capsules | 64 items: empty, Aetherium, Cryofluid, Dark Matter, Steam, Lava, Water, XP, and Milk. The `fluid_capsule` component is disabled. |
| 🟨 | ⬜ | Liquid Void / Void Essence | Items exist; their fluid-dependent interactions must be reviewed. |
| 🟨 | ⬜ | Lucky AIOT structure item | `lucky_aiot_item` remains as a helper for the delivery structure/function. Verify whether it is still needed. |

## Recipes and data content

| Active now | In-game test | Content | Status |
|---|---|---|---|
| ✅ | ⬜ | 128 JSON recipes | Remain in the BP and do not require legacy runtime registration. Validate outputs and machine dependencies. |
| ❌ | ⬜ | Script-based machine recipes | Duplicator, Catalyst Weaver, Arc Press, Industrial Burner, Pulverizer, Sievers, Fisher, Seed Synth, Cultivator, Liquifier, Energizer, and Residue Processor. |
| ✅ | ⬜ | UC Crusher additions | 4 recipes registered through `utilitycraft:register_crusher_recipe`. |
| ✅ | ⬜ | UC Furnace/Incinerator additions | 3 recipes registered through `utilitycraft:register_furnace_recipe`. |
| ✅ | ⬜ | UC Infuser additions | 3 recipes registered through `utilitycraft:register_infuser_recipe`. |
| ✅ | ⬜ | UC Press additions | 1 recipe registered through `utilitycraft:register_press_recipe`. |
| ✅ | ⬜ | UC Sieve additions | 6 drops across 4 inputs registered through `utilitycraft:register_sieve_drop`. |

## UI and helper assets

| Active now | In-game test | Group | Inventory |
|---|---|---|---|
| 🟨 | ⬜ | RP UI definitions | 46 files: shared layouts, 29 machines, storage, overclock, tests, and 3 recipe views. Enchantment Station has no dedicated layout. No AT runtime is active. |
| 🟨 | ⬜ | UI items | 215: Arcane 17, buttons 2, Cryofluid 49, Dark Matter 49, Liquified Aetherium 49, and Overclock 49. |
| 🟨 | ⬜ | Fluid entities | `fluid_tank_aetherium`, `fluid_tank_cryofluid`, and `fluid_tank_dark_matter` exist, but no AT machine currently consumes them. |
| ❌ | ⬜ | Machine UI | Rebuild after machine runtime, IO, recipes, and persistence are stable. |

## Legacy code not confirmed as an active feature

These files existed, but were not imported directly by the old entrypoint. They should not
become requirements until we confirm whether an indirect path used them.

| Status | Code | Decision |
|---|---|---|
| 🔎 | `dense_furnator_array.js` | Treat as an experiment/reference, not required behavior. |
| 🔎 | `dense_magmator_core.js` | Treat as an experiment/reference, not required behavior. |
| 🔎 | `dense_thermo_matrix.js` | Treat as an experiment/reference, not required behavior. |

## Recommended work order

1. Test the five UC recipe integrations, six UC generators, meshes, fishing nets, hammers, and AIOTs in-game.
2. Implement one complete simple machine with `BasicMachine`; Residue Processor is recommended.
3. Stabilize lifecycle, entity handling, persistence, energy, recipes, and IO with that machine.
4. Migrate the simple item-processing machines.
5. Create the ATCore layers required for fluids, special machines, and world actions.
6. Rebuild transportation, then overclock, on top of stable contracts.
7. Restore StatsCore/armor only as a separate AT module.
8. Rebuild UI after the data models and slot layouts are stable.

# Steam production — next update

Steam Boiler is the entry machine and Vaporizer is its electric upgrade. Both
use their dedicated existing atlases under `RP/textures/blocks/machines/new/`,
split losslessly into six faces for each powered state. Steam
remains a gas transported by the existing gas I/O and capsules. Arc-Press Forge's
steam boost and consumption are unchanged.

| Machine / fluid input | Input mB | Steam mB | DE | Ticks | Seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| Steam Boiler / Water | 1000 | 1000 | 2400 | 160 | 8 |
| Vaporizer / Water | 1000 | 1000 | 1600 | 80 | 4 |
| Vaporizer / Cryofluid | 1000 | 1500 | 2400 | 120 | 6 |
| Vaporizer / Saline Coolant | 1000 | 1500 | 2000 | 100 | 5 |

These are base values before upgrades and overclock. Boiler has 128,000 DE,
32,000 mB per tank and upgrade slots 5–6 (Speed/Energy). Vaporizer has 1,024,000 DE,
128,000 mB per tank and slots 5–8 (Speed/Energy/Hyper/Stack). AT capacity upgrades
follow each machine's profile; resource efficiency is supported by Vaporizer.
Boiler's liquid type is fixed to water to reject incompatible network input.

Both blocks use 31 slots: energy/status/progress 0–2; filled liquid containers 3;
empty gas containers 4; upgrades 5–8; returned liquid containers 9; filled gas
containers 10; liquid/gas gauges 11–12; item I/O 13–18; liquid I/O 19–24; gas I/O
25–30. Boiler's unused upgrade cells 7–8 are blocked and hidden. Item I/O modes
target container inputs/outputs, liquid I/O receives tank 0, gas I/O exports tank 0.

Workbench recipes and Assembler registrations agree. Boiler uses Basic Chips and
a Blast Furnace; Vaporizer uses Advanced Chips and a Steam Boiler. Remaining
copper/casing ingredients follow the original processor recipe. The creative
catalog exposes both new IDs. EN/PT names are supplied; remaining locales use
English for new names/help and inherit existing translated recipe/I/O labels.

`utilitycraft:vaporworks_processor` stays defined and functional with its original
capacities, layout key, migration and recipes. Its Creative/catalog, Workbench and
Assembler acquisition is retired, with its recipe backed up under
`extras/legacy_recipes/`. No placed block, inventory or stored resource is replaced.
Old recipe registrations remain supported. `utilitycraft:register_vaporizer_recipe`
is an alias for the same advanced registry; Boiler is water-only. External recipe
registrations do not dynamically rebuild the static recipe book.

Runtime and generator share `BP/scripts/config/steamProcessing.js`. Run
`node tools/generate-steam-machines.mjs` to regenerate blocks, UI, books, recipes
and language entries. The generator also restores Alchemical Station acquisition;
it does not re-enable Mob Chamber or Universal Tubes. Run
`node tools/test-steam-processing.mjs` and the existing UI/container/alchemy checks.

Before release, reload the world and validate both screens with mouse, controller
and touch, bucket/capsule returns, every I/O side, upgrades, overclock, Arc-Press
steam supply, moving a filled machine and reopening an old Vaporworks. Validate
Alchemical Station's native potion API and thrown/cloud effects in the same game
version. Static checks and mocked Bedrock APIs do not establish these results.

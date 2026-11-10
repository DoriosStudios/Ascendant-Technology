# Steam production â€” next update

Steam Boiler is the entry machine and Vaporizer is its electric upgrade. Both
use their dedicated existing atlases under `RP/textures/blocks/machines/new/`,
split losslessly into six faces for each powered state. Steam
remains a gas transported by the existing gas I/O and capsules. Arc-Press Forge's
steam boost and consumption are unchanged.

| Machine / fluid input | Input mB | Steam mB | DE | Ticks | Seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| Steam Boiler / Water | 1000 | 1000 | 2400 | 160 | 8 |
| Vaporizer / Water | 1000 | 1000 | 1600 | 80 | 4 |
| Vaporizer / Cryofluid | 1000 | 3000 | 2400 | 80 | 4 |
| Vaporizer / Saline Coolant | 1000 | 1500 | 2000 | 100 | 5 |

These are base values before upgrades and overclock. Cryofluid produces 750 mB/s,
three times the Water recipe per Vaporizer; synthesis costs and materials remain
separate from the vaporization cost. Boiler has 128,000 DE,
32,000 mB per tank and upgrade slots 5â€“6 (Speed/Energy). Vaporizer has 1,024,000 DE,
128,000 mB per tank and slots 5â€“8 (Speed/Energy/Hyper/Stack). AT capacity upgrades
follow each machine's profile; resource efficiency is supported by Vaporizer.
Boiler's liquid type is fixed to water to reject incompatible network input.

Steam Boiler uses 27 slots: energy/status/progress 0–2; upgrades 3–4;
blocked upgrade placeholders 5–6; liquid/gas gauges 7–8; item I/O placeholders
9–14; liquid I/O 15–20; gas I/O 21–26. It has no container slots or item I/O.
Water enters through liquid I/O and steam leaves through gas I/O.

Vaporizer uses 29 slots: energy/status/progress 0–2; liquid container 3; gas
capsule 4; upgrades 5–8; liquid/gas gauges 9–10; item I/O 11–16; liquid I/O
17–22; gas I/O 23–28. Filled liquid containers become empty containers in
slot 3. Empty capsules become filled gas capsules in slot 4. Each whole stack
converts together once tank space or stored gas is sufficient. Unsupported
items and insufficient resources leave the stack unchanged. Empty slots show
the existing three-frame container atlas. Automatic item output waits while
source containers still need conversion; liquid I/O receives tank 0 and gas
I/O exports tank 0.

Existing machines migrate once, preserving retained items and stored resources.
Items in removed container slots are returned beside the machine. The legacy
processor keeps its original 31-slot layout and separate container returns.

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

Runtime profiles are defined in `BP/scripts/config/steamProcessing.js`.
Temporary runtime tests and UI previews belong in `.cache/`. The focused
container and migration tests use the processing engine and inventory migration
implementation with mocked Bedrock objects. They do not establish in-game results.

Before release, reload the world and validate both screens with mouse, controller
and touch, bucket/capsule returns, every I/O side, upgrades, overclock, Arc-Press
steam supply, reopening migrated machines and an old Vaporworks. Validate
Alchemical Station's native potion API and thrown/cloud effects in the same game
version. Static checks and mocked Bedrock APIs do not establish these results.

HUGE update, bringing new materials, machines, system changes, recipes changes... It's just too much for me to include here. I'll take a while to finish this changelog.

## BLOCKS
### General
- Added **Reinforced Case** and **Superior Case**.
    - New machine-case block variants are now registered with their own textures for future recipe use.
- Added **Aetherium Cobblestone Generator** (Tier 7)
    - Produces up to 32 cobblestone per second.
- Added **Deepslate Tungsten Ore** and **Nether Tungsten Ore**.
	- New ore for components, mainly focused in heat and high-tier machine recipes.

### Generators
- Absolute Battery
    - Decreased energy capacity from 25.6 GDE to 256 MDE.
    - Decreased transfer rate from 800 kDE/t to 80 kDE/t.
- Absolute Furnator
    - Decreased energy capacity from 512 MDE to 51.2 MDE.
    - Decreased transfer rate from 320 kDE/t to 32 kDE/t.
- Absolute Magmator
    - Decreased energy capactiy from 640 MDE to 64 MDE.
    - Decreased liquid capacity from 320 MB to 32 MB.
    - Decreased transfer rate from 400 kDE/t to 40 kDE/t.
- Absolute Solar Panel
    - Decreased energy capacity from 256 MDE to 25.6 MDE.
    - Decreased transfer rate from 96 kDE/t to 9.6 kDE/t.
- Absolute Thermo Generator
    - Decreased energy capacity from 256 MDE to 25.6 MDE.
    - Decreased liquid capacity from 16 MB to 12.8 MB.
    - Decreased transfer rate from 160 kDE/t to 16 kDE/t.
- Absolute Wind Turbine
    - Decreased energy capacity from 512 MDE to 40.96 MDE.
    - Decreased transfer rate from 64 kDE/t to 6.4 kDE/t.

### Machines (Additions)
- Added **Abyssal Fisher**
    - Superior version of Autofisher with more output slots and speed.
        - Unlike Autofisher, that requires a water source block nearby, Abyssal Fisher uses an internal water tank for fishing.
    - Accepts four upgrades.
- Added **Arcane Enchanter**
    - Standalone superior enchanting machine split from Enchantment Station.
    - Focuses only on enchant application and level-up behavior without repair or disenchant flow.
    - Supports module-driven enchant strength and faster cycle pacing.
    - Accepts three upgrades.
- Added **Arc-Press Forge**
    - Superior version of Electro Press with 4 input slots and 4 output slots.
    - Accepts four upgrades.
- Added **Centrifugal Siever**
    - Superior version of Autosieve with 4 input slots, 1 mesh chamber, and 15 output slots.
    - Can optionally consume Steam to boost the sieving efficiency.
	- Accepts four upgrades.
- Added **Cryo Stabilizer**
    - Standalone superior branch of the Cryo Chamber focused only on stabilization recipes.
    - Uses Cryofluid to safely process unstable materials without sharing space with the freezer or generator sections.
- Added **Cryo Freezer**
    - Standalone superior branch of the Cryo Chamber focused only on freezing and cold-crafting recipes.
    - Keeps a dedicated 5x3 freezing grid with independent slot processing, using one shared tank for Water and Cryofluid-backed recipes without competing with stabilization or Cryofluid generation.
- Added **Cryofluid Synthesizer**
    - Standalone superior branch of the Cryo Chamber dedicated to industrial Cryofluid output.
    - Includes **Stable** mode for steady processing and **Impulse** mode for burst production.
    - Built to scale Cryofluid supply independently from Cryo Chamber operation.
- Added **Dual Siever**
    - Superior split-path siever with two independent mesh lanes in one machine.
    - Shares energy, upgrades, steam tank, and output buffering across both lanes.
    - Can process both lanes in the same cycle when resources are available.
- Added **Disenchanter**
    - Standalone superior disenchant machine with dedicated extraction and fluid conversion logic.
    - Supports **Extraction** mode for enchanted-book output and **Absorption** mode for XP-fluid generation.
    - Keeps disenchant logistics separate from Enchantment Station and Arcane Enchanter flows.
- Added **Genetic Seed Synthesizer**
    - Superior version of Seed Synthesizer with 2 seed input lanes and 15 output slots.
    - Needs Cryofluid to operate.
	- Accepts four upgrades.
- Added **Industrial Burner**
    - Superior version of Incinerator with 3 input slots and 6 output slots.
    - Smelt items into their molten forms, using lava as an optional booster.
    - Accepts four upgrades.
- Added **Impact Crusher**
    - Superior multi-lane crusher with 2 input slots and 8 output slots.
    - Uses Lava for impact cycles and accepts Steam for thermal control.
        - If not enough Steam is available, the machine will heat up and eventually overheat, stopping operation until cooled down.
    - Accepts four upgrades.
- Added **Industrial Crucible**
    - Superior version of the Magmatic Chamber.
    - Smelt stones and hot blocks into lava, additionally using the rests to produce their molten forms.
    - Accepts four upgrades.
- Added **Reinforced Importer** and **Reinforced Exporter**
    - Reinforced fluid networks now use dedicated blocks for moving fluids into and out of the cable backbone.
    - Reinforced Cable still carries fluids across the network, but it no longer pulls from or pushes into distant tanks by itself.
    - Importers and Exporters can be enabled, disabled, and filtered for specific fluid types.
- Added **Pattern Placer**
    - Superior version of Block Placer with 4 input slots and different modes.
    - Has four modes:
        - **Single (1x1)**: Places a single block in front of it.
        - **Grid (3x3)**: Places a 3x3 area in front of it, starting 1 block above the machine center.
        - **Cube (3x3x3)**: Places a 3x3x3 volume in front of it, starting 1 block above the machine center.
        - **Line (1x5)**: Places a line of 5 blocks in front of it.
    - Energy cost scales with the amount of blocks placed in the selected pattern.
    - Can now pull placeable blocks from a compatible container placed above it.
        - Supports common storage such as chests, barrels, Absolute Containers, and compatible machines feeding downward into it.
    - Now includes a dedicated activation toggle in its UI.
- Added **Pulverizer**
    - Superior version of Crusher with 4 input slots and 4 output slots.
    - Accepts four upgrades.
    - Can optionally consume Steam to accelerate crushing batches.
- Added **Reinforcement Anvil**
    - Standalone superior machine for advanced item repair and reinforcement.
    - Supports **Repair** and **Reinforce** modes with module-based reinforcement targets.
    - Includes support for Reinforcement Module IV/V progression targets.
- Added **Refining Table**
    - Refines your weapon with a new tool-based progression system, allowing you to level up your equipment and unlock special abilities.
    - Uses an internal **XP tank** instead of direct player XP spending during each roll.
    - Lets players inspect equipment stats, preview roll quality, and awaken locked item abilities with a **Runic Core**.
- Added **Seismic Breaker**
    - Superior version of Block Breaker with internal storage and different modes.
    - Has four modes:
        - **Single (1x1)**: Breaks a single block in front of it.
        - **Grid (3x3)**: Breaks a 3x3 area in front of it, starting 1 block above the machine center.
        - **Cube (3x3x3)**: Breaks a 3x3x3 volume in front of it, starting 1 block above the machine center.
        - **Line (1x5)**: Breaks a line of 5 blocks in front of it, consuming more energy and taking longer.
    - Drops are pulled into the internal storage slots when possible.
        - If the storage fills up, the breaker stops working.
    - Includes a dedicated activation toggle in its UI.
- Added **Verdant Cultivator**
    - Superior version of Harvester with a repeated 2x2 seed grid and a 15-slot internal harvest buffer.
    - Range Upgrades expand its working field from 3x3 up to 17x17.
    - A dedicated Pedestal Clock slot pulses crop growth while Quantity Upgrades add extra harvest rolls.
    - Supports vanilla field crops and UtilityCraft seed crops, then exports buffered harvests from the rear when possible.

### Machines (Balancing)
- Catalyst Weaver
    - Decreased energy capacity from 4 MDE to 2 MDE.
    - Decreased minimum energy cost per operation from 6.4 kDe to 1.6 kDE.
    - Increased transfer rate from 180 DE/t to 320 DE/t.
    - Increased liquid capacity from 128 B to 512 B.
- Cryo Chamber
    - Decreased energy capacity from 128 MDE to 1.5 MDE.
    - Decreased minimum energy cost per operation from 6.4 kDe to 1.6 kDE.
- Duplicator
	- Changed how it works, but will get a rework in the future.
    - Decreased transfer rate from 800 DE/t to 640 DE/t.
- Enchantment Station
    - Decreased minimum energy cost per operation from 64 kDE to 16 kDE.
    - Decreased transfer rate from 64 kDE/t to 640 DE/t.
- Energizer
    - Decreased energy capacity from 256 MDE to 512 kDE.
    - Decreased minimum energy cost per operation from 9.6 kDE to 1.6 kDE.
    - Decreased transfer rate from 24 kDE/t to 640 DE/t.
- Liquifier
    - Decreased energy capacity from 8.2 MDE to 512 kDE.
    - Decreased minimum energy cost per operation from 3.6 kDE to 1.6 kDE.
    - Decreased liquid capacity from 640 B to 512 B.
    - Increased transfer rate from 32 DE/t to 640 DE/t.
- Network Center
	- Can no longer be obtained in survival mode. Will be removed in the future.
- Residue Processor
    - Decreased energy capacity from 12.8 MDE to 512 kDE.
    - Decreased minimum energy cost per operation from 5.2 kDE to 1.6 kDE.
- Singularity Fabricator
	- Deactivated it. Will be reworked in the future.
- Vaporworks Processor
    - Decreased energy capacity from 9.6 MDE to 512 kDE.
    - Decreased minimum energy cost per operation from 2.4 kDE to 1.6 kDE.
    - Decreased transfer rate from 24 kDE/t to 640 DE/t.
    - Increased gas capacity from 64 B to 128 B.
    - Increased liquid capacity from 64 B to 128 B.

### Transportation
- Conveyors
    - Vertical conveyors now switch cleanly between upward and downward flow when adjusted with a **Wrench**.
    - Copper, Titanium, and Aetherium vertical conveyors now keep their visual direction and real item movement aligned when flipped.
    - Inclined and declined conveyors now follow a more faithful ramp path, starting the lift earlier, keeping the lane slightly higher, and handing off with a shorter end reach.
    - Vertical conveyors now keep rising items centered on the lane instead of pushing them sideways.

## ITEMS
### General
- Hyper Processing Upgrade can now be used in UtilityCraft machines.
- Added **Absolute Chip**
	- A new tier for chips, used in most of AT machines and the Absolute Tier of Generators.
- Added **Advanced Runic Core**
	- Better than the regular Runic Core, it can awaken more than a single special ability on equipment.
- Added **Runic Core**
	- A new item used to awaken locked special abilities on equipment.
- Added **Stack Upgrade**
	- A new upgrade that allows machines to process more items per operation. Cost increases with each upgrade level.

### Equipment
- Aetherium Armor
	- Chestplate
		- Increased protection from 10 to 12.
		- Increased damage reduction from 7.5% to 10%.
	- Leggings
		- Increased protection from 8 to 10.
		- Increased damage reduction from 7.5% to 10%.
	- Boots
		- Increased protection from 6 to 7.
	- Helmet
		- Increased protection from 5 to 7.

### Ores
- Added **Tungsten Ore** family, including Tungsten Ore, Tungsten Ingot, and Tungsten Dust.

## RECIPES
- Added conversion recipes to convert gem dust into their gem from again.
- Changed the **Lucky Mesh** recipe to use an Emerald Block instead of Emeralds.
    - The change better reflects the mesh's tier and resource cost, while also making it more consistent with the other superior mesh recipes that use block-tier materials.

## UI/UX

- Impact Crusher now shows a dedicated temperature bar in its menu.
    - The heat display now matches the machine's live thermal state, making coolant use and overheat risk easier to read at a glance.
- Refining Table now keeps equipment inspection clearer and more focused.
    - Item lore now shows up to three core stats and a green ability line when the item has a class or tool ability.
    - Extra stats such as Evasion, Damage Immunity, Vulnerability, and Preserving remain available inside the machine details panel instead of crowding the item itself.
- Refining Table now previews locked special abilities more clearly.
    - The machine can now show when an item's class ability is still locked, which ability will be awakened, and when a Runic Core is optionally armed for that roll.
- Refining Table displays now split machine and equipment information more cleanly.
    - The primary display now stays focused on warnings, resources, input state, and refinement costs.
    - The secondary display now focuses only on the inserted equipment, including its stats, awakened ability state, and a short ability description.
- Added a dedicated documentation page for StatsCore special abilities.
    - The page now uses a cascading list layout and explains what each special ability does and which equipment families can roll it.
- Cryo Freezer and Cryo Stabilizer now use dedicated cryogenic machine menus.
    - Both standalone Cryo Chamber branches now expose their own focused layouts instead of relying on the broader shared Cryo Chamber presentation.
- Superior machine names now use consistent subtitle formatting across all supported languages.
- Superior machine menus now follow the world's refresh speed setting.
    - Progress arrows, status panels, tank displays, and mode panels now refresh on the same cadence as the configured world update speed.
- Pattern Placer and Seismic Breaker now keep their activation toggle visually latched while enabled.
    - Their machine buttons no longer bounce back to the same neutral look immediately after being switched on.

## FLUIDS

- Liquid Capsules now interact more reliably with vanilla Water and Lava sources.
    - Pickup targeting now follows the block the player is looking at up to 6 blocks away, making source collection more consistent in tight spaces.
    - Placement now uses more precise face detection, so Water and Lava Capsules are much easier to place where intended.
- Liquid Capsules now handle wider, deeper, and player-overlapping fluid spaces more naturally.
    - Collecting while standing inside Water or Lava now prioritizes the closest valid source block instead of failing on awkward targets.
    - Placement now looks for the nearest sensible open space around the aimed area, improving behavior in larger pools and cramped spots.
- Infinite fluid capsules now behave as true infinite fillers when used on compatible tanks and fluid machines.
    - Water and Lava Infinite Capsules now keep refilling accepted fluid storage instead of acting like oversized single-use containers.

## BUG FIXES

- Fixed Pattern Placer and Seismic Breaker upgrade scaling.
    - Speed and Hyper upgrades now shorten their charge time more noticeably, and Efficiency upgrades now also reduce their effective per-operation energy cost in line with regular UtilityCraft machine behavior.
- Fixed Verdant Cultivator stopping when its internal seed grid was empty.
    - The machine can now keep harvesting, replanting existing crops, pulsing growth, and buffering harvests without requiring internal seeds, while the 2x2 seed grid remains the optional path for filling empty field spaces.
- Fixed Verdant Cultivator harvest routing mixing seed items into the output buffer unnecessarily.
    - Supported seed drops now refill a compatible seed slot first when available, while crop produce continues to flow into the harvest buffer.
- Fixed Verdant Cultivator leaving some harvest drops behind in larger fields.
    - Expected crop drops are now pulled more reliably from the harvested area, including corner cells that could previously escape the pickup sweep before being routed into the machine.
- Fixed stacked Liquid Capsules disappearing while collecting Water or Lava.
    - Picking up a source with multiple capsules in hand no longer deletes the source block while losing the filled capsule.
- Fixed capsule world-use priority around fluid tanks.
    - Fluid capsules now try to fill the tank or fluid storage you clicked before attempting to place their contents into the world.

## TECHNICAL CHANGES

### Compatibility

- Added `utilitycraft:register_armor_mitigation` as a ScriptEvent-based registry for external armor items that cannot use the native `utilitycraft:armor` component.
    - The registry accepts per-item mitigation definitions with damage reduction, damage negation chance, and optional damage-type overrides.

### StatsCore

- Added the first full native `StatsCore` runtime stack to Ascendant Technology.
    - Introduced dedicated combat, mining, support, utility, progression, lore, and registry modules for supported equipment.
    - Supported items now persist level, XP, refinement data, and special-ability awakening state directly on the item.
- Added the native `Refining Table` machine runtime and UI flow for StatsCore refinement.
    - Refinement rolls are now queued and only applied when the confirm button is pressed.
    - The machine tracks XP through its internal tank, consumes chips and ingots on successful rolls, and treats `utilitycraft:runic_core` as an optional awakening catalyst instead of a hard gate for standard refinement.
- Expanded the StatsCore ability runtime to cover universal gear families.
    - Added native handling for combat identities such as **Bleeding**, **Sweeping**, **Skewer**, **Aftershock**, **Harpoon**, **Deadeye**, and **Ballista**.
    - Added mining and utility handling for **Luck**, **Crushing**, **Operator**, **Gardener**, **Primal**, **Forger**, **Ingniter**, **Worm**, **Reaper**, and the always-active logging side of **Berserk**.
    - Added support-side handling for **Clarity**, **Retaliation**, **Bulwark**, **Featherstep**, **Spikes**, and **Tough**.
- Updated several combat-side procs to behave closer to normal Bedrock combat resolution.
    - **Sweeping** now resolves its area damage through command-based damage flow instead of relying only on direct script damage.
    - Locked/awakened effect resolution is now filtered per effect, allowing utility-side behaviors like Berserk log conversion to stay active without unlocking the combat side early.
- Reorganized the internal StatsCore runtime surface around explicit bootstrap, API, and shared helper layers.
    - Added shared helpers for effect application, enchantment checks, durability repair, item-context resolution, damage parsing, and action-bar writes.
    - Reduced redundant one-off helper functions and documented the intended shared entry points inside `BP/scripts/StatsCore/README.md`.

### Runtime Registration

- Added native runtime registration for Pulverizer, Centrifugal Siever, Dual Siever, Genetic Seed Synthesizer, Impact Crusher, Verdant Cultivator, Seismic Breaker, and Pattern Placer blocks, recipes, machine scripts, UI definitions, textures, and item catalog entries.
- Added native runtime registration for Arcane Enchanter, Cryofluid Synthesizer, Disenchanter, Magmatic Reactor Chamber, and Reinforcement Anvil.
    - Includes machine scripts, block registration, and item catalog integration for each superior branch.
- Added native runtime registration for Dense Active Generators.
    - Includes Dense Furnator Array, Dense Magmator Core, and Dense Thermo Matrix scripts and block definitions.
- Added native runtime registration for Cryo Stabilizer as a standalone superior Cryo Chamber branch.
    - Includes block, recipe, machine script, dedicated UI definition, item catalog integration, localization, and classic superior texture registration.
- Added native runtime registration for Cryo Freezer as a standalone superior Cryo Chamber branch.
    - Includes block, recipe, machine script, dedicated UI definition, item catalog integration, localization, and classic superior texture registration.
- Added native runtime registration for Power Beacons.
    - Includes five tiered blocks, recipes, machine script, toggle button UI, localization, item catalog, and resource registration.
- Expanded StatsCore runtime handling for awakened utility abilities.
    - Added persistent per-item awakening data for special abilities and saved **Operator** mode state on drills.
    - Added runtime handling for **Operator**, **Gardener**, **Primal**, **Forger**, and **Ingniter** behaviors.
- Added Verdant Cultivator crop-field runtime handling for repeated seed patterns, Pedestal Clock growth pulses, buffered harvest collection, and quantity-based bonus harvest rolls.
- Removed the native Dismantler runtime stack (block, recipe, machine script, UI definition, textures, item catalog entry, and related localization entries).
- Reworked the conveyor runtime into separate `plain_conveyors`, `bridge_conveyors`, and `special_conveyors` script modules.
    - Removed duplicated local conveyor helpers where equivalent `DoriosAPI` block-state helpers or shared transport routines already covered the behavior.
- Removed the generated Dismantler reverse-recipe registry and its supporting generation tooling from the active runtime.
- Added a native Pulverizer crusher-recipe registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_crusher_recipe` custom insertions.
- Added a native Centrifugal Siever sieve-recipe registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_sieve_drop` custom insertions.
- Added a native Genetic Seed Synthesizer plant registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_plant` and `utilitycraft:register_bonsai` custom insertions.

### Resource Pack

- Converted Cryo Chamber, Residue Processor, and Seismic Breaker to `minecraft:geometry.full_block` with named per-face `material_instances`.
    - Replaced their box-UV atlas usage with generated face textures so directional rendering no longer flips the north and south sides on those machines.
    - Archived the previous atlas sheets under `RP/textures/blocks/machines/legacy_atlases` and `RP/textures/blocks/machines/superior/legacy_atlases` for reference and future art rework.
    - Added `tools/convert_machine_atlases_to_full_block_faces.py` to regenerate the split face textures from the archived atlases when those machine textures change.
- Updated Cryo Freezer to use the classic `geometry.utilitycraft_block_2` atlas flow.
    - The machine now uses its dedicated `utilitycraft_cryo_freezer_off/on` textures instead of borrowing Cryo Chamber face textures.
- Updated Cryo Stabilizer to use the classic `geometry.utilitycraft_block_2` atlas flow.
    - The machine now uses its dedicated `utilitycraft_cryo_stabilizer_off/on` textures again instead of borrowing Cryo Chamber face textures.

### UI Definitions

- Rebuilt `ascendant_common.vertical_player_inventory` in `RP/ui/ascendant_common.json` as a true vertical composition.
    - The control now mirrors `common.inventory_panel_bottom_half` as a right-side vertical inventory using a `3x9` player grid instead of the vanilla `9x3` horizontal layout.
    - Added `$show_inventory_label` and `$inventory_label_text` variables so each screen can toggle or override the inventory heading per layout.
- Added `ascendant_common.vertical_hotbar_grid_template` in `RP/ui/ascendant_common.json`.
    - The new common mirrors `common.hotbar_grid_template` as a vertical `1x9` hotbar grid for layouts that need a side-mounted player hotbar.
- Added recreated standard inventory commons with customizable slot backgrounds and hover colors in `RP/ui/ascendant_common.json`.
    - `ascendant_common.customizable_inventory_panel_bottom_half_with_label` and `ascendant_common.customizable_hotbar_grid_template` now mirror the vanilla desktop player inventory layout while exposing `$slot_color` and `$slot_hover_color` for themed slot styling.
    - The new implementation uses a stateful slot button so the hover cell texture swaps behind the item renderer instead of covering the item icon.
- Updated `RP/ui/centrifugal_siever.json` to use the new customizable standard inventory and hotbar commons as the first migration example.
    - The screen now keeps gray base cells with a light-blue hover accent for both the player inventory and hotbar.

### Release Tooling

- Added a dedicated GitHub Actions packaging workflow for clean add-on builds.
    - The workflow builds `.mcpack` files directly from `BP` and `RP`, bundles them into `Ascendant_Tech_<version>.mcaddon`, uploads the generated packages as workflow artifacts, and can create or update a matching GitHub release without including repository-only files.

### Core Utilities

- Hyper Processing no longer contributes to machine output yield multipliers.
- Ascendant machine visuals now respect the selected world refresh speed across the shared machine core.
    - Shared labels, progress arrows, energy displays, tank displays, button panels, and generator HUD updates now follow the configured visual update cadence instead of mixing in fixed 4-tick refresh paths.
- Enchantment Station and custom multi-panel machine HUDs now align with the same world refresh-speed cadence.
    - The Enchantment Station no longer bypasses the main machine tick cadence during runtime, and custom progress indicators used by special machine UIs now flow through the shared refresh helper.
    - It now affects processing speed only, preventing output inflation without matching input consumption.
- Updated manual-progress charging for Pattern Placer and Seismic Breaker.
    - Their per-tick spend cap now preserves Speed and Hyper throughput while also letting lower consumption from Efficiency upgrades reduce total action time.
- Updated Pattern Placer and Seismic Breaker operation telemetry to show upgrade-adjusted energy costs.
    - Their detailed status sections now report the effective cost after Efficiency scaling instead of only the raw pattern or target total.
- Updated Verdant Cultivator delayed drop collection to bypass normal machine tick gating.
    - Scheduled harvest pickup now resolves reliably into the internal buffer or rear output flow instead of skipping collection on non-machine ticks.
- Moved Verdant Cultivator crop support into a dedicated recipe registry module.
    - Crop specs, supported soils, tracked harvest-drop identifiers, and biome data now live under `scripts/config/recipes/verdant_cultivator.js`.
    - Added `utilitycraft:register_verdant_crop` so new seed/crop pairs can register their planting and pickup behavior without editing the machine runtime directly.
- Refactored Verdant Cultivator field analysis to reduce per-tick runtime cost.
    - Field layout data is now cached until the seed pattern, range, or facing changes.
    - Full crop-state scans now reuse cached results for short windows instead of rebuilding the whole field operation every tick.
    - Clock pulse targets are now sampled only when a pulse cycle actually executes, reducing repeated array work while preserving behavior.
- Updated Pattern Placer input consumption to clear exhausted stacks before writing back inventory changes.
    - Prevents zero-amount item writes when the last block in a stack is placed, fixing the final-stack duplication case triggered by successful placements.
- Industrial Burner charging now respects per-recipe time windows when calculating progress gain.
    - Speed-related boosts now change throughput more consistently instead of collapsing into near-constant craft timing.
- Added shared runtime optimizations for high-traffic machine loops.
    - Reduced redundant block-entity lookups through cached machine entity resolution.
    - Reduced repeated direct recipe-array scans in Arc-Press Forge, Industrial Burner, and Pulverizer.
    - Reduced redundant overclock property writes across towers, relays, and connected machines.
- Further optimized liquid-machine runtime loops for Vaporworks Processor and Liquifier.
    - Converted Vaporworks Processor and Liquifier recipe registries to UtilityCraft-style direct lookups keyed by their main input.
    - Added shared DoriosCore recipe resolvers so machines can consume either keyed registries or list-based recipe sets without redefining local `resolveRecipes(...)` handlers.
    - Added per-entity caching for parsed `dorios:fluid_nodes` payloads and distance-ordered fluid-network targets to reduce repeated JSON parsing and resorting work.
    - Collapsed repeated tank, energy, and progress reads into per-tick state snapshots before validation and HUD generation.
    - Throttled redundant tank, energy, progress, and label refreshes when the rendered machine state has not changed.
    - Vaporworks Processor now resolves valid fluids through direct input-type lookup instead of repeated per-tick recipe scans.
    - Liquifier now resolves its input items through the same direct registry model while keeping shared cached lookup support for list-based recipes.
- Optimized Absolute Container runtime behavior under sustained full-output conditions.
    - Added cached block-context and entity-runtime state to reduce repeated lookup and manager initialization cost.
    - Replaced per-tick capacity rewrites with one-time runtime initialization.
    - Added adaptive output-transfer backoff with consecutive-failure escalation (drastic cooldown after repeated failed sends) and throttled HUD display refreshes.
- Expanded adaptive machine I/O throttling to additional high-traffic runtime loops.
    - Industrial Burner, Centrifugal Siever, Genetic Seed Synthesizer, and Vaporworks Processor now use movement-aware adaptive gates for repeated item/fluid checks.
    - Repeated failed checks now back off more aggressively, while successful movement restores responsive polling.
- Updated core machine transfer helpers to report real movement outcomes for adaptive control flow.
    - Item pulls from above and side transfers now return accurate moved/not-moved state for downstream scheduling logic.
- Optimized reinforced cable / overclock network scan paths and refresh scheduling.
    - Replaced shift-based BFS queue traversal with index-based scans in reinforced cable, overclock, and reinforced extractor network walkers.
    - Added tick-level deduplication for reinforced cable geometry and energy rescan scheduling to avoid duplicate recomputes in dense placement/break events.
- Updated reinforced cable energy target collection to allow Power Beacons to recharge from connected cable networks.
    - Normal generator target restrictions remain in place for other source blocks.
- Updated Power Beacon wireless target discovery to recognize both Ascendant Technology and UtilityCraft machine helper entities.
    - Nearby powered machines are now resolved by their block position instead of relying on only one helper-entity type.
- Updated reinforced fluid network semantics around explicit node roles.
    - `dorios:fluid_nodes` now stores role-aware nodes (`direct`, `source`, `sink`) instead of only raw positions.
    - Reinforced Cable now acts as a fluid transport backbone only; cable spans no longer expose remote machines or tanks as direct fluid I/O endpoints.
    - Reinforced Importer and Reinforced Exporter are now the dedicated fluid I/O endpoints for reinforced cable spans.
    - Vaporworks Processor and Impact Crusher now respect fluid node role, enabled state, and per-node fluid filters when pulling from a reinforced network.
- Updated Ascendant machine energy managers to recover missing scoreboard identities before evaluating stored energy or capacity.
    - Prevents connected machines from being treated as zero-capacity cable targets when their runtime entity is freshly spawned or reloaded.
- Updated Dual Siever batch drop flow to use mapped autosieve-style rolls before batch expansion.
    - The machine now simulates normal autosieve rolls per consumed input (independent roll + chance per roll), stores mapped results, then applies batch expansion to the mapped output.
    - Batch processing no longer mutates base drop entry values directly.
- Updated Abyssal Fisher and Centrifugal Siever output handling to clamp rolled results against live output capacity before insertion.
    - Prevents full-stack edge cases from forcing avoidable `Output Full` stalls when only part of a batch can be stored.
    - Reduces emergency spill behavior by reserving valid output space first, then inserting only the reservable portion.
- Removed manual fluid item input slots from superior-machine UIs and runtime container mappings.
    - Abyssal Fisher (`Water Input`), Centrifugal Siever / Dual Siever / Pulverizer (`Steam Input`), Genetic Seed Synthesizer (`Cryofluid Input`), and Industrial Burner (`Lava Input`) now use tank/network flow paths without dedicated item input cells.
    - Updated script-side slot blocking and block `hidden_slots` metadata so deprecated fluid-input indices no longer appear as active operator slots.
- Refactored superior-machine status lore into structured display sections.
    - Added shared lore section helpers in DoriosCore to keep heading/metric formatting consistent across machines.
    - Arc-Press Forge, Pulverizer, Centrifugal Siever, Dual Siever, Genetic Seed Synthesizer, Abyssal Fisher, Pattern Placer, and Seismic Breaker now separate machine telemetry, operation context, and last-batch/action feedback into distinct categories.
    - Dual Siever now presents per-lane information in dedicated lane sections, improving readability in Individual mode.
    - Reduced lore verbosity by removing repeated machine telemetry and long descriptions, keeping only core operational metrics per section.
    - Removed duplicated generic warning text from superior lore sections and standardized section titles to cyan (`§b`) across all superior machines.
    - Added a shared superior utility module (`machines/superior/utils.js`) to centralize non-essential conversion/format helpers used by lore and footer displays.
    - Migrated superior machine scripts to use the shared conversion helpers for energy buffers, tank buffers, batch labels, percentage formatting, cycle-time text, and mixed energy+fluid cost lines.
    - Converted superior status/warning labels to the minimal structured model and removed the legacy generic telemetry group (`Speed`, `Efficiency`, `Cost`, `Rate`) from those displays.
- Updated Impact Crusher fluid routing to resolve Lava and coolant roles by stored fluid type instead of fixed tank positions.
    - The machine now accepts direct fluid-item insertion and keeps its Lava / coolant logic aligned with its live tank contents.
- Updated Impact Crusher batch scaling to remap inherited crusher recipe costs and timings to the machine's own balance profile.
    - The machine now applies its superior baseline cost and speed consistently instead of inheriting Pulverizer defaults during lane processing.
- Updated Impact Crusher thermal display to use UtilityCraft's `temperature_00` through `temperature_31` UI items.
    - Keeps the heat slot aligned with the machine's live thermal buffer instead of reusing the generic lane-progress arrow frames.
- Added missing nineslice JSON metadata for inverted UI cell texture variants used by superior machine buttons.
- Updated superior machine button states to swap base and hover cell imagery while keeping dedicated button textures through UtilityCraft UI Core controls.
- Added missing nineslice JSON metadata for the remaining hover-inverted superior button cell textures.
    - Hovered superior machine buttons now have consistent panel slicing across every registered color variant.
- Added a shared superior UI refresh gate for display and panel rendering.
    - Superior machine status panels, tank bars, progress arrows, and button panels now throttle against the world's configured refresh cadence instead of updating immediately on every local render path.
- Updated capsule fluid registries and world interaction flow for finite and infinite capsule behavior.
    - Added explicit `infinite: true` registration metadata for Ascendant Technology infinite capsules so `FluidManager` treats them as real infinite providers.
    - Replaced the old global capsule-use handler with the native `utilitycraft:fluid_capsule` item component, using per-item `fluid`, `amount`, and `infinite` parameters directly on each capsule definition.
    - Capsule items no longer rely on deprecated `minecraft:custom_components` declarations or chained `using_converts_to` fallback behavior for their fluid state.
    - Switched capsule world interactions to prefer `itemUseOn` targeting when available, with a 6-block fallback raycast for source lookup.
    - Tightened world pickup and placement resolution to follow the player's line of sight first, avoiding the old nearest-fluid behavior that could grab water beside or below the intended target.
    - Added a pre-placement fluid-storage handler so registered capsule containers can fill clicked tanks, ports, and fluid-capable machine blocks before any world placement is attempted.
    - Placement now stays close to vanilla behavior, with only a short fallback around the looked-at target to reduce misplacement in cramped spaces without drifting to unrelated nearby fluid blocks.

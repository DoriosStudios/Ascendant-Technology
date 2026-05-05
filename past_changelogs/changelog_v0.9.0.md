# v0.9.0 Draft

Heavy processing and block automation still anchor this draft, but this pass also introduces the first full **StatsCore** equipment wave. StatsCore is Ascendant Technology's gear progression layer: it gives supported weapons, tools, and defense pieces their own growth, refinement rolls, readable stat identity, and unlockable special abilities through the new **Refining Table**.

## BLOCKS
### Machines
- Added **Abyssal Fisher**
  - Superior version of Autofisher with more output slots and different modes.
    - Unlike Autofisher, that requires a water source block nearby, Abyssal Fisher uses an internal water tank for fishing, using an Ender Eye to fish remotely between different places.
  - Accepts four upgrades.
  - Has two modes:
    - **Mass**: Process fish drops in batches with regular water consumption. Faster than Autofisher.
    - **Expedition**: Process fish drops with increased water consumption, higher luck and a bonus of +1 tier to the current mesh used.
- Added **Arc-Press Forge**
  - Superior version of Electro Press with 4 input slots and 4 output slots.
  - Accepts four upgrades.
  - Has two modes:
    - **High Speed**: Processes inputs in batches, consuming more energy, but being overall faster for large runs.
        - Batches have a 25% chance of losing one output item per recipe, which can be mitigated with 4 Quantity Upgrades.
        - Quantity Upgrades increase batch size and energy consumption.
    - **Low Loss**: 
        - Processes inputs one at a time, faster than Electro Press, but with no chance of losing output items.
- Added **Centrifugal Siever**
  - Superior version of Autosieve with 4 input slots, 1 mesh chamber, and 15 output slots.
  - Processes one material stream in grouped spin cycles instead of single-item sieving.
  - Can optionally consume Steam to accelerate larger sieve batches.
- Added **Dual Siever**
  - Superior split-path siever with two independent mesh lanes in one machine.
  - Shares energy, upgrades, steam tank, and output buffering across both lanes.
  - Can process both lanes in the same cycle when resources are available.
- Added **Genetic Seed Synthesizer**
  - Superior version of Seed Synthesizer with 4 seed input lanes and 15 output slots.
  - Can switch between Growth, Resilience, and Yield profiles.
  - Uses Cryofluid to keep advanced synthesis stable.
  - Energy and Cryofluid costs were increased substantially to better match its parallel output potential.
  - Seed inputs are preserved during synthesis instead of being consumed.
  - Occupied seed lanes now synthesize together in the same cycle instead of stalling on a single active lane.
  - Higher-tier resource seeds now output shard, nugget, and fragment forms where appropriate.
- Added **Industrial Burner**
    - Superior version of Incinerator with 3 input slots and 3 output slots.
    - Instantly smelt items into their molten forms, using lava as an optional booster.
    - Accepts four upgrades.
    - Supports Quantity Upgrades for larger grouped batches.
- Added **Impact Crusher**
  - Superior multi-lane crusher with 4 input slots and 4 output slots.
  - Uses Lava for impact cycles and accepts Water, Cryofluid, or Saline Coolant for thermal control.
  - Supports grouped crushing runs for larger processing batches.
  - Base crushing cycles now cost more energy, but complete much faster than before.
- Added **Pattern Placer**
  - Superior version of Block Placer with 4 input slots and different modes.
  - Has four modes:
    - **Single (1x1)**: Places a single block in front of it.
    - **Grid (3x3)**: Places a 3x3 area in front of it, starting 1 block above the machine center.
    - **Cube (3x3x3)**: Places a 3x3x3 volume in front of it, starting 1 block above the machine center.
    - **Line (1x5)**: Places a line of 5 blocks in front of it.
  - Energy cost scales with the amount of blocks placed in the selected pattern.
- Added **Pulverizer**
    - Superior version of Crusher with 4 input slots and 4 output slots.
    - Accepts four upgrades. 
    - Can optionally consume Steam to accelerate crushing batches.
    - Supports Quantity Upgrades for larger grouped batches.
- Added **Refining Table**
  - New machine dedicated to **StatsCore** equipment refinement.
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
    - If the storage fills up, excess items are dropped normally in the world.
- Added **Verdant Cultivator**
  - Superior version of Harvester with a repeated 2x2 seed grid and a 9-slot internal harvest buffer.
  - Range Upgrades expand its working field from 3x3 up to 17x17.
  - A dedicated Pedestal Clock slot pulses crop growth while Quantity Upgrades add extra harvest rolls.
  - Supports vanilla field crops and UtilityCraft seed crops, then exports buffered harvests from the rear when possible.

## ITEMS
### Equipment
- **StatsCore** now acts as the universal progression and identity system for supported gear.
  - Supported equipment can gain readable stat lines, level through use, store refinement results, and expose class-style abilities instead of staying as flat stat sticks.
- StatsCore special abilities now need to be awakened in the Refining Table.
  - Equipment with a special ability now uses a dedicated **Runic Core** slot during refinement.
  - The first successful awakening consumes the Runic Core and permanently unlocks that item's class ability.
- More vanilla and special gear families now work with StatsCore.
  - Added support for **Spears**, **Mace**, **Trident**, **Bow**, **Crossbow**, and **Flint and Steel**.
- StatsCore equipment now uses clearer class-style abilities instead of generic effect labels.
  - Swords can roll **Bleeding**, AIOTs can roll **Sweeping**, and pickaxes can roll **Luck**.
- StatsCore armor now also carries unique class-style abilities.
  - Chestplates can trigger **Retaliation**, while helmets, leggings, boots, and shields now expose their own defensive identity instead of remaining effectless.
- More tools and gear families now work with StatsCore.
  - Added support for Lucky Sword, Lucky Pickaxe, drills, Heavy Drill, Smelting Pickaxe, Flint Knife, Shield, Shears, and extra hammer / paxel / AIOT variants.
- Several StatsCore special abilities were corrected to match their in-game design more closely.
  - **Drills** now use **Operator**, with **Crushy**, **Silky**, and **Greedy** modes.
  - **Shears** now use **Gardener**.
  - **Flint Knife** now uses **Primal**.
  - **Smelting Pickaxe** now uses **Forger**.
  - **Flint and Steel** now uses **Ingniter**.
- StatsCore special abilities received a broader combat and farming rework.
  - **Luck** now always spawns XP orbs from ore breaks, while **Crushing** now always adds matching dust for coal, copper, iron, gold, and titanium ores.
  - **Hoes** now use **Reaper**, **Shovels** now use **Worm**, and **Axes** now use **Berserk**.
  - **Berserk** axes now always keep their sneaking log-to-planks utility, while the Runic Core awakening still governs the combat side of the ability.
  - **Aftershock**, **Harpoon**, **Deadeye**, **Ballista**, **Bleeding**, **Featherstep**, and shield passives were updated to behave more distinctly in play.
  - **Turtle Helmet** now uses **Tough** instead of sharing the regular helmet identity.
- Added **Runic Core**.
  - Crafted from a **Totem of Undying** and used as the dedicated awakening catalyst for locked StatsCore abilities.
- Newly supported combat families now also receive their own ability identities.
  - Spears use **Skewer**, Mace uses **Aftershock**, Trident uses **Harpoon**, Bow uses **Deadeye**, and Crossbow uses **Ballista**.
- Pure utility tools now stay focused on mining or defense instead of pretending to be melee gear.
  - Pickaxes, shovels, drills, Smelting Pickaxe, Shears, Flint Knife, and Shield no longer center their StatsCore profile around bonus melee damage.
- StatsCore abilities now follow one universal system across combat gear, mining tools, and defensive equipment.
  - The same ability pipeline now feeds item lore, Refining Table inspection, debug inspection, and runtime behavior.

## RECIPES
- Added the **Refining Table** crafting recipe.
  - The machine is crafted with Titanium Plates, Advanced Chips, Aetherium, a Machine Case, and an Anvil.
- Added the **Runic Core** conversion recipe.
  - A **Totem of Undying** can now be converted into a **Runic Core** for StatsCore awakenings.

## UI/UX
- Impact Crusher now shows a dedicated temperature bar in its menu.
  - The heat display now matches the machine's live thermal state, making coolant use and overheat risk easier to read at a glance.
- Refining Table now keeps equipment inspection clearer and more focused.
  - Item lore now shows up to three core stats and a green ability line when the item has a class or tool ability.
  - Extra stats such as Evasion, Damage Immunity, Vulnerability, and Preserving remain available inside the machine details panel instead of crowding the item itself.
- Refining Table now previews locked special abilities more clearly.
  - The machine can now show when an item's class ability is still locked, which ability will be awakened, and when a Runic Core is still missing.
- Refining Table displays now split machine and equipment information more cleanly.
  - The primary display now stays focused on warnings, resources, input state, and refinement costs.
  - The secondary display now focuses only on the inserted equipment, including its stats, awakened ability state, and a short ability description.
- Added a dedicated documentation page for StatsCore special abilities.
  - The page now uses a cascading list layout and explains what each special ability does and which equipment families can roll it.
- Superior machine names now use consistent subtitle formatting across all supported languages.
- Superior machine menus now follow the world's refresh speed setting.
  - Progress arrows, status panels, tank displays, and mode panels now refresh on the same cadence as the configured world update speed.

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
  - The machine tracks XP through its internal tank, consumes chips and ingots on successful rolls, and uses `utilitycraft:runic_core` as the awakening catalyst.
- Expanded the StatsCore ability runtime to cover universal gear families.
  - Added native handling for combat identities such as **Bleeding**, **Sweeping**, **Skewer**, **Aftershock**, **Harpoon**, **Deadeye**, and **Ballista**.
  - Added mining and utility handling for **Luck**, **Crushing**, **Operator**, **Gardener**, **Primal**, **Forger**, **Ingniter**, **Worm**, **Reaper**, and the always-active logging side of **Berserk**.
  - Added support-side handling for **Clarity**, **Retaliation**, **Bulwark**, **Featherstep**, **Spikes**, and **Tough**.
- Updated several combat-side procs to behave closer to normal Bedrock combat resolution.
  - **Sweeping** now resolves its area damage through command-based damage flow instead of relying only on direct script damage.
  - Locked/awakened effect resolution is now filtered per effect, allowing utility-side behaviors like Berserk log conversion to stay active without unlocking the combat side early.

### Runtime Registration
- Added native runtime registration for Pulverizer, Centrifugal Siever, Dual Siever, Genetic Seed Synthesizer, Impact Crusher, Verdant Cultivator, Seismic Breaker, and Pattern Placer blocks, recipes, machine scripts, UI definitions, textures, and item catalog entries.
- Expanded StatsCore runtime handling for awakened utility abilities.
  - Added persistent per-item awakening data for special abilities and saved **Operator** mode state on drills.
  - Added runtime handling for **Operator**, **Gardener**, **Primal**, **Forger**, and **Ingniter** behaviors.
- Added Verdant Cultivator crop-field runtime handling for repeated seed patterns, Pedestal Clock growth pulses, buffered harvest collection, and quantity-based bonus harvest rolls.
- Removed the native Dismantler runtime stack (block, recipe, machine script, UI definition, textures, item catalog entry, and related localization entries).
- Removed the generated Dismantler reverse-recipe registry and its supporting generation tooling from the active runtime.
- Added a native Pulverizer crusher-recipe registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_crusher_recipe` custom insertions.
- Added a native Centrifugal Siever sieve-recipe registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_sieve_drop` custom insertions.
- Added a native Genetic Seed Synthesizer plant registry in Ascendant Technology, keeping compatibility with `utilitycraft:register_plant` and `utilitycraft:register_bonsai` custom insertions.

### Core Utilities
- Hyper Processing no longer contributes to machine output yield multipliers.
  - It now affects processing speed only, preventing output inflation without matching input consumption.
- Industrial Burner charging now respects per-recipe time windows when calculating progress gain.
  - Speed-related boosts now change throughput more consistently instead of collapsing into near-constant craft timing.
- Added shared runtime optimizations for high-traffic machine loops.
  - Reduced redundant block-entity lookups through cached machine entity resolution.
  - Reduced repeated direct recipe-array scans in Arc-Press Forge, Industrial Burner, and Pulverizer.
  - Reduced redundant overclock property writes across towers, relays, and connected machines.
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
- Added a shared superior UI refresh gate for display and panel rendering.
  - Superior machine status panels, tank bars, progress arrows, and button panels now throttle against the world's configured refresh cadence instead of updating immediately on every local render path.
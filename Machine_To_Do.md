## Machine Roadmap

Machine status:
- 🟢 Implemented (in-game)
- 🟠 In Development (actively being built)
- 🟡 Planned (approved direction, not started)
- 🔵 Prototype (may change / experimental)
- 🟣 Needs Design (idea exists, spec missing)
- 🔴 On Hold / Cut (paused or removed)

- 🟢 **Absolute Container**
	- **Purpose:** Singular vault that layers massive item, energy, and fluid storage without automated upgrades or informational clutter.
	- **Operating Mode:** 14×12 item grid with HUD indicators for energy and fluid levels (no label display); energy/fluid caps sit at 25.6 M each and integrate with Dorios energy/fluid systems.
	- **Notes:** Passive storage only—no upgrade slots, no extra HUD lore—designed as a reliable backbone for late-stage logistics.

- 🟢 **Catalyst Weaver (Arc Loom)**
	- **Purpose:** High-tier fusion loom that threads up to six catalyst lanes, an input core, fluids, and residue handling into a single volatile recipe.
	- **Operating Mode:** Uses catalyst slots, an input core, optional fluid interference, and an output/residue pipeline; contextual warnings keep each channel predictable.
	- **Additional Fields:**
		- **Features:** Supports fluid-based interference, can generate residues/debris/failed outputs, designed for complex and unstable reactions.
		- **Slots:** Catalysts (up to 6), Main Input (1), Output (1), Fluid Input (1), Residue/Trash (1).
		- **Notes:** High-cost processing; not optimized for mass automation.

- 🟢 **Liquifier (Flux Crucible)**
	- **Purpose:** Heat-focused crucible that melts solids into fluid stacks for downstream processing.
	- **Operating Mode:** Consumes energy to melt/dissolve compatible solids into fluids while feeding capsules or fluid-capable machines.
	- **Slots:**
		- **Input:** Solid items (ingots, crystals, special materials).
		- **Manual Fluid Input:** Liquid capsule or any other fluid container for fluid injection.
		- **Output:** Liquid form of that input (supports partial conversion, multiple items per bucket).
	- **Features:** Supports capsule/containers, displays tank status, rolls byproducts.
		- **Notes:** Processing-only machine; does not mix, refine, or infuse fluids beyond conversion.

- 🟢 **Duplicator (Cloner | Replication Matrix)**
	- **Purpose:** Late-game replication chamber that consumes templates, mountains of energy, and liquified aetherium to print pristine duplicates.
	- **Operating Mode:** Continuous process with high energy demand and a template-driven recipe list.
	- **Upgrades:** Supports speed, hyper and efficiency upgrades to moderate energy draw and processing time.
	- **Variant:**
		- **Singularity Fabricator:** Specialized duplicator variant that fabricates singularity items using dark matter and energy.
	        - **Upgrades:** Does not support upgrades; high energy consumption, as well as processing time.

- 🟢 **Energizer (Pulse Forge)**
	- **Purpose:** Mass-convert mundane resources into energized counterparts with brutal energy draw but zero catalyst overhead.
	- **Operating Mode:** Shares a progress bar while two input slots (primary + auxiliary) queue conversions into a single output buffer.
	- **Optional Inputs:** Secondary energization slot for dust/alternate materials.
	- **Example Flow:** `Iron Ingot → Energized Iron Ingot`

- 🟢 **Network Center**
	- **Purpose:** Energy-ops dashboard that scans the connected energy network via cables/energy-tagged blocks and reports health.
	- **Operating Mode:** Consumes a small upkeep to keep panels updated; scans every ~2s with unlimited reach through connected cables.
	- **Displays:** Multi-panel readout showing nodes, cables, generators, machines, batteries, stored vs capacity, fill %, and status (Stable/Deficit/Buffer Full). Indicates truncation if the graph exceeds the safety cap.
	- **Notes:** No I/O and no upgrades.

- 🟢 **Residue Processor**
	- **Purpose:** Turns junked debris into reclaimed parts, neutral slag, or heat pulses.
	- **Operating Mode:** Consumes energy to recycle/neutralize residues from complex machines.
	- **Outputs:** Reclaimed materials, neutral waste, heat or minor byproducts.
	- **Notes:** Adds value to leftovers but does not guarantee returns; designed as a debris sink companion to liquifier/duplicator.

- 🟢 **Laser Barrier**
	- **Purpose:** Energy wall controller that spawns a temporary laser grid to the **right** of the block, respecting the placement facing.
	- **Operating Mode:** Consumes energy per tick to sustain the grid; pulses damage in the field.
	- **Features:** Three dedicated upgrade slots — Length (slot 1), Height (slot 2), and Energy Efficiency (slot 3). Size upgrades add +1 to the selected dimension (max +8 each); sneak while applying a size upgrade to target Height. No UI—apply/remove upgrades by interacting with the block.
	- **Notes:** Defensive utility only—not intended for mob farming.

- 🟢 **Cryo Chamber**
	- **Purpose:** Thermal stabilizer that keeps volatile alloys from exploding.
	- **Operating Mode:** Constant energy input to maintain low or stable temperatures for sensitive reactions, as cooling down items and food and generating Cryofluid.
	- **Main Function: Cryo Stabilizer**
		- **Use Cases:** Prevent reaction failure, stabilize volatile materials, enable advanced alloy processing.
		- **Notes:** Intended exclusively for industrial/high-tier recipes.
		- **Operating Mode:** Uses its main screen to monitor and maintain target temperatures for items in the "stabilizer slot".
	- **Secondary Function: Cooling Chamber**
	    - **Use Cases**: Restore food, items, cool heated tools, and machinery to its cold state.
		- **Notes:** Useful for survival scenarios; not a substitute for dedicated refrigeration units.
		- **Operating Mode:** Uses its own side of the screen to manage cooling tasks, changing the items in "freezer slot" to its cold variants.
	- **Tertiary Function: Cryofluid Generator**
		- **Use Cases:** Produces Cryofluid from cold water for cooling machines or better cold clothing crafting.
		- **Notes:** Cryofluid can be used in other machines or crafting recipes.
		- **Operating Mode:** Uses fluid input/output ports to convert water into Cryofluid over time. Is a machine with 2 fluid tanks (input and output) and do not accept items as input for this function.

- 🟠 **Vaporworks Processor (Steam/Gas)**
	- **Purpose:** Converts water into steam and other gases as supplemental reagents.
	- **Operating Mode:** Heat + fluid input turn water into steam, which can be fed into other systems.
	- **Additional Fields:**
		- **Usage:** Auxiliary input for specific machines, temporary processing boosts.
		- **Notes:** Steam is a resource, not a power substitute; no complex gas piping required (initially).

- 🟠 **Dimensional Teleporter**
	- **Purpose:** Anchor-linked platform for deliberate teleportation.
	- **Operating Mode:** Requires a linked core and high energy cost per activation.
	- **Additional Fields:**
		- **Features:** One-way/two-way linking, high activation cooldown.
		- **Restrictions:** No instant spam teleport; physical installation needed in each dimension.
		- **Notes:** Late-game infrastructure; not a fast-travel replacement.

- 🟠 **Item Energizer Pad**
	- **Purpose:** Benchtop booster that bathes tools in temporary buffs while draining power continuously.
	- **Operating Mode:** Provides continuous energy drain while items remain active on the pad.
	- **Additional Fields:**
		- **Effects:** Enhanced efficiency, faster operation, temporary bonuses that wear off once removed.
		- **Notes:** No permanent upgrades applied to items.

- 🟠 **Portable Power Cell**
	- **Purpose:** Pocket battery tiers for backpackable DE storage and emergency jump-starts.
	- **Operating Mode:** Chargeable in machines, carries stored energy while on the player.
	- **Additional Fields:**
		- **Features:** Multiple capacity tiers, can fuel machines or tools temporarily.
		- **Notes:** Storage-only; no generation or routing logic onboard.

- 🟠 **Interdimensional Infuser**
   - **Purpose:** Create and process Interdimensional Gems.
   - **Operating Mode:** Combines base gems with infusion fluids to produce powerful Interdimensional Gems. Consumes a gigantic amount of energy and requires precise fluid management.
   - **Slots:**
    	- **Base Input:** Up from 8 to 16 slots for base gems and infusion materials.
		- **Fluid Input:** 4 different tanks for infusion fluids.
		- **Output:** 1 Interdimensional Gem output slot.
		- **(Optional) Residue Slot:** For failed infusions or unstable byproducts.

---

## Concepts suggested by AI:

- 🧠 **Spectral Harmonizer**
	- **Purpose:** Syncs multiple machines into a single clock cycle to enable burst-speed windows or shared cooldown reductions.
	- **Operating Mode:** Consumes rare "beat cores"; failure briefly desynchronizes connected equipment.
	- **Additional Fields:**
		- **Use Cases:** Timed production surges, synchronized cooldown windows, or shared maintenance cycles.
		- **Risks:** Mistimed beats can stall connected machines for several seconds; requires redundant energy buffering.
		- **Notes:** Only compatible with machines upgraded with harmonic couplers.

- 🧠 **Entropy Condenser**
	- **Purpose:** Compresses unwanted byproducts into dense entropy pellets for late-game reactors.
	- **Operating Mode:** Over-compression risks chaos pulses unless vented through residue processors.
	- **Additional Fields:**
		- **Outputs:** Entropy pellets, slag bricks, volatile heat packets (byproduct chance).
		- **Safeguards:** Requires residue processor hookup for auto-venting.
		- **Notes:** Acts as a material sink; pellets are valuable reactor fuel.

- 🧠 **Aperture Forge**
	- **Purpose:** Reconfigurable crafting stage that re-projects molds (plates, rods, coils) using light-hardening fields.
	- **Operating Mode:** Players swap holographic molds instead of rebuilding the block model for each recipe.
	- **Additional Fields:**
		- **Features:** Modular mold cartridges, fast swap UI, supports batch jobs per mold.
		- **Inputs:** Base ingots/alloys + optional dopants for variant outputs.
		- **Notes:** Ideal for workshop hubs; no internal storage beyond active recipe buffers.

---

## Planned ideas (curated)

- 🟡 **Cryo Reservoir**
	- **Purpose:** Dedicated Cryofluid buffer for factories, with clean input/output ports and clear UI readouts.
	- **Operating Mode:** Stores Cryofluid and exposes simple I/O rules; insulation tiers can reduce or eliminate passive loss (if enabled).
	- **Notes:** Cryofluid already exists in the addon (Cryo Chamber + capsules). This block would be the “network-scale” storage option.

- 🟡 **Cryo-Infused Pipes (optional logistics layer)**
	- **Purpose:** Move Cryofluid between machines with predictable throughput.
	- **Operating Mode:** Basic pipes move Cryofluid at a fixed rate; higher tiers improve throughput and reduce loss/decay.
	- **Notes:** Only add if the addon wants a dedicated Cryofluid routing layer (otherwise keep capsules + direct machine tanks).

- 🟡 **Thermal Control Module**
	- **Purpose:** One stability/heat helper that makes high-tier setups safer without introducing a whole “cluster management” meta.
	- **Operating Mode:** Adjacent block/module that reduces negative effects from high-speed operation (heat/instability themes) at a steady upkeep (energy and/or Cryofluid).
	- **Notes:** This intentionally merges multiple AI concepts (Cryo Stabilizer + Thermal Dissipator) into a single, readable component.

- 🟡 **Overclock Boost Network**
	- **Purpose:** Late-game “true overclock” system that boosts multiple machine attributes via a dedicated reinforced cable, without colliding with the existing **Hyper Processing Upgrade** item.
	- **Operating Mode:**
		- An **Overclock Tower** generates the overclock “charge” (boost level). As well as the energy itself, overclock has its own bar and properties.
		- An **Overclock Relay** exports that property into the network (to prevent self-boosting loops).
		- Overclock is applied through a dedicated **Overclock Injector** block placed in-line near the target machine(s). This block also have the Reinforced Cable properties for energy/fluid transfer.
		- The injector passes normal energy/fluid transfer, but only applies overclock if it is the injection point (no opt-in per-machine UI required).
		- Cooling is mandatory: **Cryofluid** = 100% effectiveness; **Water** = 50% effectiveness.
		- Overclock boosts machine attributes (example set): energy capacity, processing speed, and liquid transfer/consumption rates.
		- Generators are excluded from overclock effects to preserve the need to supply extra energy.
	- **Failure / Risk:** If an injector runs without coolant, it overheats and **melts**: the block breaks, plays a “burnt” SFX, and the network connection is interrupted (machines beyond stop receiving energy).
	- **Notes:** This system is intentionally *separate* from **Hyper Processing Upgrade** (which already increases speed with **no extra energy cost**).

- 🟡 **Overclock Tower**
	- **Purpose:** Main overclock generator: defines the available boost level for a factory.
	- **Operating Mode:** Consumes energy and Titanium (with a config file) to produce an overclock charge that can be exported by an relay.
	- **Notes:** This is the “overclocker” itself.

- 🟡 **Overclock Relay**
	- **Purpose:** Export the Overclock Tower’s overclock charge into the network without allowing the source block to self-boost.
	- **Operating Mode:** Works like an antenna: reads overclock from its paired source and transmits it to connected injectors. Similar to a fluid exporter block.
	- **Notes:** This is intentionally not the generator; it’s the exporter.

- 🟡 **Reinforced Cable**
	- **Purpose:** High-capacity energy/fluid cable that supports overclock injection.
	- **Operating Mode:** Functions like a reinforced cable for energy/fluid transfer, but is compatible with overclock injection when paired with an injector block.
	- **Notes:** This is the “backbone” cable for overclock networks.

- 🟡 **Precision Calibrator**
	- **Purpose:** End-game efficiency attachment that improves yield/consistency on select machines (fewer bad rolls/byproducts).
	- **Operating Mode:** Installs as a module or adjacent helper; consumes energy upkeep; applies recipe-specific tuning.
	- **Notes:** Good sink for Titanium parts: reinforces the identity of Titanium as “machine-performance metal”, not just armor/tool power.

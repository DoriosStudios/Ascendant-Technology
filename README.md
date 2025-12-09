# Ascendant Technology
An expansion add-on for UtilityCraft.

## Machine Roadmap

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
		- **Notes:** High-risk/high-reward processing; not optimized for mass automation.

- 🟢 **Liquifier (Flux Crucible)**
	- **Purpose:** Heat-focused crucible that melts solids into fluid stacks for downstream processing.
	- **Operating Mode:** Consumes energy to melt/dissolve compatible solids into fluids while feeding capsules or fluid-capable machines.
	- **Additional Fields:**
		- **Input:** Solid items (ingots, crystals, special materials).
		- **Output:** Liquid form of that input (supports partial conversion, multiple items per bucket).
		- **Features:** Supports capsule/containers, displays tank status, rolls byproducts.
		- **Notes:** Processing-only machine; does not mix, refine, or infuse fluids beyond conversion.

- 🟢 **Duplicator (Replication Matrix)**
	- **Purpose:** Late-game replication chamber that consumes templates, mountains of energy, and liquified aetherium to print pristine duplicates.
	- **Operating Mode:** Continuous process with high energy demand and a template-driven recipe list.
	- **Additional Fields:**
		- **Characteristics:** Recipe-based cloning (no direct duplication), designed for controlled reproduction.
		- **Notes:** Suited for automation chains and late mid-game setups.

- 🟢 **Energizer (Pulse Forge)**
	- **Purpose:** Mass-convert mundane resources into energized counterparts with brutal energy draw but zero catalyst overhead.
	- **Operating Mode:** Shares a progress bar while two input slots (primary + auxiliary) queue conversions into a single output buffer.
	- **Additional Fields:**
		- **Highlights:** Slot-aware HUD messaging, upgrade-friendly layout (speed + efficiency), auxiliary queue for seamless swaps.
		- **Optional Inputs:** Secondary energization slot for dust/alternate materials.
		- **Example Flow:** `Iron Ingot → Energized Iron Ingot`, `Raw Iron → Raw Energized Iron`, `Steel Block → Energized Iron Block`.

- 🟢 **Network Center**
	- **Purpose:** Energy-ops dashboard that scans the connected energy network via cables/energy-tagged blocks and reports health.
	- **Operating Mode:** Consumes a small upkeep to keep panels updated; scans every ~2s with unlimited reach through connected cables.
	- **Additional Fields:**
		- **Displays:** Multi-panel readout (3 item labels) showing nodes, cables, generators, machines, batteries, stored vs capacity, fill %, and status (Stable/Deficit/Buffer Full). Indicates truncation if the graph exceeds the safety cap.
		- **Notes:** Purely diagnóstico/telemetry; no I/O and no upgrades.
- 🟢 **Residue Processor**
	- **Purpose:** Turns junked debris into reclaimed parts, neutral slag, or heat pulses.
	- **Operating Mode:** Consumes energy to recycle/neutralize residues from complex machines.
	- **Additional Fields:**
		- **Outputs:** Reclaimed materials, neutral waste, heat or minor byproducts.
		- **Notes:** Adds value to leftovers but does not guarantee returns; designed as a debris sink companion to liquifier/duplicator.

- 🟢 **Laser Barrier**
	- **Purpose:** Energy wall controller that spawns a temporary laser grid to the **right** of the block, respecting the placement facing.
	- **Operating Mode:** Consumes energy per tick to sustain the grid; pulses damage in the field.
	- **Additional Fields:**
		- **Features:** Three dedicated upgrade slots — Length (slot 1), Height (slot 2), and Energy Efficiency (slot 3). Size upgrades add +1 to the selected dimension (max +8 each); sneak while applying a size upgrade to target Height. No UI—apply/remove upgrades by interacting with the block.
		- **Notes:** Defensive utility only—not intended for mob farming.

- 🟠 **Cryo Chamber**
	- **Purpose:** Thermal stabilizer that keeps volatile alloys from exploding.
	- **Operating Mode:** Constant energy input to maintain low or stable temperatures for sensitive reactions.
	- **Additional Fields:**
		- **Use Cases:** Prevent reaction failure, stabilize volatile materials, enable advanced alloy processing.
		- **Notes:** Not a freezer; intended exclusively for industrial/high-tier recipes.

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

0.4.5 update brings with it several additions, changes, and fixes, with the Cryo Chamber being the main addition.


## BLOCKS
### Machines
- Added Cryo Chamber
  - Cryo Chamber is a block that combines three functions into one. These are:
    - Stabilizer: Reduces the activity of ingots or alloys that use a lot of heat and/or conduct a lot of energy, such as Energized Iron Ingot, returning them to their stabilized state.
    - Freezer: Cools items and blocks, causing them to become colder or solidify.
    - Cryofluid Generator: Generates cryofluid from water mixed with titanium, using energy for operation.
- Catalyst Weaver
  - Now supports recipes with fluid-only catalysts (no item catalysts required).
## ITEMS
### General
- Better organized creative menu.
 
### Ores
- Added a new ore family, the Titanium:
  - Added Titanium Chunk
  - Added Titanium Ingot
  - Added Raw Titanium

### Tools
- Added Cryofluid Capsules
- Added Hyper Processing Upgrade
  - Increases the operating speed of machines without increasing energy consumption, using advanced cooling technology; it can be used in conjunction with Speed Upgrade.
- Added Lucky Mesh
- Added Lucky Fishing Net

## FLUIDS
- Added Cryofluid
  - Derived from titanium combined with water, Cryofluid is primarily a coolant liquid, with extremely low temperatures. It is mainly used for cooling tasks, both for items and machines.
- Added Cryofluid tank support (new fluid tank definition + textures)

## RECIPES
### General
- Adjusted/updated late-game generator recipes:
  - Absolute Solar Panel
  - Absolute Thermo Generator
  - Absolute Wind Turbine
### Sieve
- Added Titanium Chunk to Crushed Cobbled Deepslate sieve drop with 10% chance. Needs tier 4.
- Added Aetherium Shard to Crushed Cobbled Deepslate sieve drop with 0.5% chance. Needs tier 7.
- Added Aetherium Shard to Crushed Endstone sieve drop with 10% chance. Needs tier 5.
### Crusher
- Added Titanium Chunk → Raw Titanium
### Furnace/Incinerator
- Added Raw Titanium → Titanium Ingot
### Catalyst Weaver
- Added Catalyst Weaver recipe:
  - Amethyst Shard + Dark Matter → Refined Aetherium Shard

## UI/UX
- The following machines have had their interfaces updated:
  - Catalyst Weaver
  - Energized
  - Residue Processor
- Reworked Absolute Container UI entirely.
- Improved Cryo Chamber generator feedback:
  - Titanium prompts/status now use proper localized strings.
- Improved localization coverage and consistency (EN/PT/ES):
  - Filled missing item/machine keys introduced in this update (Titanium Chunk, Cryofluid prompts, meshes/nets).

## TECHNICAL CHANGES
### New reusable UI building blocks
- Expanded `ascendant_common` UI component:
  - Added a new generic `ascendant_common.panel` component with `$panel_color` support.
    - New color options include: **gray**, **dark**, **blue**, and **aqua**. (For now)
  - Legacy wrappers preserved for compatibility.
- Updated pack icons (`BP/pack_icon.png`, `RP/pack_icon.png`).
- Added/updated UI textures and panels:
  - `RP/textures/ui/background_panel*.png` (+ matching JSON where applicable).
  - New frozen-themed UI assets (panel/outline) and an upgrades icon.
- Updated ore textures (Aetherium shard/ingot refresh) and item atlas mappings.

## THiRD PARTY / INTEGRATION
### Ascendant Common UI
- Documented new `ascendant_common.panel` component and color options for third-party use. Experimental.

### Cryo Chamber integration
- Cryo Chamber recipes are defined in `BP/scripts/config/recipes/cryo_chamber.js`.
  - The Cryo Chamber is split into 3 internal modules (sub-machines), each with its own registry:
    - Stabilizer (stabilization recipes)
    - Freezer (cooling recipes)
    - Cryofluid Generator (water → cryofluid conversion config + catalyst list)

#### Registering Stabilizer recipes
- Add new entries to `stabilizationRecipes` using `defineCryoRecipe({ ... })`.
  - Use `category: CATEGORY.STABILIZATION`.
  - `input` can be a single item, while `inputs` allows multiple accepted variants.
  - `output` is required.
  - `fluid`/`fluids` are supported and typically point to `cryofluid` for stabilization.
  - Optional UI hints:
    - `ui.name`, `ui.description`
    - `ui.processingMessage`, `ui.completionMessage` (supports templates like `{{input}}`, `{{output}}`, `{{fluidAmount}}`).

#### Registering Freezer recipes
- Add new entries to `coolingRecipes` using `defineCryoRecipe({ ... })`.
  - Use `category: CATEGORY.COOLING`.
  - Supports the same `input`/`inputs`/`output` ergonomics.
  - Cooling recipes may be energy-only, or optionally consume fluids (example: water-based ice chain).

#### Registering Cryofluid Generator catalysts & conversion
- Cryofluid Generator behavior is driven by `getCryofluidGenerationConfig()`.
  - To add new catalyst options, extend the `catalysts: []` array.
    - Each catalyst supports:
      - `itemId` (the catalyst item)
      - `label` (display name)
      - `itemsPerProcess` (items consumed per cycle)
      - `waterPerItem` (mB of water processed per catalyst item)
      - `cryoPerItem` (mB of cryofluid produced; can exceed `waterPerItem` for stronger catalysts)
  - Advanced knobs are also exposed for balancing:
    - `conversionRate`, `energyCostPer1000mB`, `processTime`, `maxProcessPerTick`, plus `minInput`/`minOutput` safeguards.

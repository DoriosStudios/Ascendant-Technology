# v0.9.0 Draft

Heavy processing and block automation take center stage in this draft, with new superior machines, expanded batch controls, and supporting UI/runtime work to make them practical in real automation lines.

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
- Added **Seismic Breaker**
  - Superior version of Block Breaker with internal storage and different modes.
  - Has four modes:
    - **Single (1x1)**: Breaks a single block in front of it.
    - **Grid (3x3)**: Breaks a 3x3 area in front of it, starting 1 block above the machine center.
    - **Cube (3x3x3)**: Breaks a 3x3x3 volume in front of it, starting 1 block above the machine center.
    - **Line (1x5)**: Breaks a line of 5 blocks in front of it, consuming more energy and taking longer.
  - Drops are pulled into the internal storage slots when possible.
    - If the storage fills up, excess items are dropped normally in the world.

## TECHNICAL CHANGES
### Runtime Registration
- Added native runtime registration for Pulverizer, Centrifugal Siever, Genetic Seed Synthesizer, Seismic Breaker, and Pattern Placer blocks, recipes, machine scripts, UI definitions, textures, and item catalog entries.
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
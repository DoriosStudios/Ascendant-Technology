# Ascendant Technology
An official expansion add-on for UtilityCraft, aiming to add more end-game content.

---

Download: https://github.com/DoriosStudios/Ascendant-Technology/releases/tag/v0.4.3-beta
Latest Pre-release Changelog:

---

Version v0.4.3 is focused on heavy-duty storage, smarter automation, and UI quality-of-life polish ahead of broader testing.

Needs [UtilityCraft 3.3+](https://github.com/DoriosStudios/UtilityCraft/releases/tag/v3.3.0.01) to work properly.

## BLOCKS

### General

- Core block architecture refreshed to align with the new machine behaviors and multi-system storage workflows.
- Added creative menu group categories for every machine family to keep testing and creative inventory browsing organized.
- Updated `format_version` across block definitions for full compatibility with the latest runtime targets.
- Re-organized the block and machine folders to match the new taxonomy and simplify content maintenance.

### Storage

- Added Absolute Container
  - 14×12 storage grid (168 item slots)
  - Includes internal energy buffer and liquid storage
  - Consolidates functionality of 7 blocks into one compact, durable unit

### Fluids

- Liquified Aetherium and Dark Matter tank storage
  - Both liquids can be stored across fluid tank tiers
  - Enables inline buffering without requiring capsules

### Machines

- Added Energizer
  - Dedicated machine to energize components (e.g., Energized Iron Ingots)
  - Supports automation chains requiring charge-based intermediates
- Added Network Center
  - Diagnostic hub: scans connected networks via cables or machine links
  - Reports input/output values, total capacity, and aggregate flow data
  - Not a processing machine; behaves as an analyzer
- Added Residue Processor
  - Converts certain materials into waste outputs
  - Useful as a built-in trash sink in automation lines
- Added Laser Barrier
  - Projects an unbreakable laser wall
  - Base footprint: 3×3
  - Expandable size: up to +8 blocks per axis (X/Y) via upgrades
  - Upgrades: Energy, Size
  - Size Upgrade stacks to 16, adding +1 block per item (up to +8 height and +8 length)
  - UI pending; operates without a dedicated screen for now

## ITEMS

### Tools

- Added Lucky AiOT
  - All-in-one Lucky-tier utility tool

### Components & Upgrades

- Added assets: Lucky Mesh and Lucky Net
  - Prepares sieving and Lucky automation pipeline content
- Added Size Upgrade
  - Tuned for Laser Barrier wall scaling
  - Each upgrade extends length or height by +1 block
  - Stacks to 16 for maximum coverage (+8 height, +8 length)

## RECIPES

### Machines & Processing

- Machine recipe updates
  - Refreshed progression and part costs across all machines
- Infuser
  - Added 2 recipes for Catalyst Weaver infusions
  - Removed 1 outdated recipe
- Liquifier
  - Added 3 new conversion recipes to broaden liquid sourcing

## UI

### Elements & Fonts

- Classic Long Panel (UI Element)
  - Now resizable via new JSON properties
- Added Simple Gray Bar (UI Element)
  - Lightweight indicator for minimalist layouts
- Better Unicode fonts
  - Improved multilingual display and special symbol rendering

### Machine Interfaces

- Catalyst Weaver UI rework
  - Clearer recipe previews
  - Improved warnings and helper text
- Separate UIs: Cloner and Singularity Fabricator
  - Each machine now has its own interface file (no shared layout)
  - Safer per-machine tuning and iteration
- Laser Barrier UI status
  - Dedicated UI not yet available
  - Functionality driven through upgrade items meanwhile

## TECHNICAL CHANGES

### Machinery Logic

- Tick gating for transfers
  - Applied to Catalyst Weaver, Cloner, Liquifier, and Singularity Fabricator
  - Reduces redundant item and fluid operations
- Slot documentation & HUD/lore refinements
  - Detailed slot docs for machines
  - Clearer HUD/lore guidance for players
- Catalyst Weaver logic improvements
  - Better recipe previews
  - Refined catalyst helper behavior
- Cloner & Singularity Fabricator runtime updates
  - Runtime calculations updated to reflect throughput upgrades
- Catalyst Weaver upgrade migration removal
  - Removed legacy migration to reduce startup overhead

### Core Systems

- `setLabel()` lore display
  - Surfaces lore-based item displays for richer scripted feedback
- Typedef helpers for Script API
  - Added typedefs to improve development ergonomics
- Container registry migration
  - Switched from `containers.js` to `items.js` for compatibility

Don't forget to give feedback. It's very important in determining the future of the addon. See you in the next pre-release!

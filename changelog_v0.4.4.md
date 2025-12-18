# v0.4.4 (Draft)

A small-but-meaningful update focusing on new fluid visuals, refined machine UX, and core machinery plumbing, plus an exploit fix for the Duplicator.

## ITEMS
- Added the **Refined Aetherium Shard** (currently a flavor item with no active functionality).
- Added new sieve drop entries so the Aetherium Shard can be obtained via sieving.

## MACHINES
- **Catalyst Weaver**
  - Catalyst fluid display now has its own panel slot and appears last in the combined lore output for clearer context.
- **Duplicator**
  - The duplicator can no longer clone itself, preventing self-replicating loops that generated infinite machines.
- Updated `machine.json` to standardize inventory types and definitions across all machines.

## UI & ASSETS
- Updated pack icons and refreshed multiple UI/texture files to match the new machine states and improved readability.
- Adjusted machine interfaces to better present recipe previews, warnings, helper text, and newly added fluid information.

## RECIPES
- Minor tweaks across recipe tables to stay in sync with the fluid and energy handling changes.
- Added sieve drops for the Aetherium Shard to expand its acquisition paths.

## TECHNICAL CHANGES
- Refactored the machinery managers (`BP/scripts/machinery`):
  - Improved energy and fluid handling, including normalization, display, and scoreboard tracking.
  - Added registries for fluid containers/outputs with ScriptEvent-powered registration hooks.
  - Hardened network transfer logic and tube detection for safer fluid routing.
- Removed unused transfer system scripts/imports and replaced the obsolete hook with a local stub where needed.
- Enhanced the label/lore helpers (`setLabel`, truncation, normalization) to keep UI text consistent across machines.
- Polished internal documentation and typedefs (JSDoc) to ease third-party integrations.
- Catalyst Weaver now has clearer validation flow and more informative status messages around fluid and catalyst requirements.

## THIRD-PARTY / INTEGRATION
- ScriptEvent hooks for registering recipes, containers, and holders remain documented with validation logs, so external packs can continue extending machines at runtime.

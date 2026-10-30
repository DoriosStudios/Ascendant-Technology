# Reported bugs follow-up — 2026-10-29

## Confirmed fixes

- Titanium Hammer: added speed 12 for `minecraft:is_shovel_item_destructible`.
  Pickaxe/compressed-block rules, tool tags and harvest tier are retained.
- Verdant Cultivator: corrected the UtilityCraft mineral crop IDs from nonexistent
  `*_crop` blocks to the actual `*_seeds` block IDs. The earlier review checked
  registration presence without validating its destination; the report about
  these seeds was valid. All 35 mineral/utility registrations now resolve to
  actual blocks and supported age states in AT/UtilityCraft.
- Added Titanium and Tungsten on Blue Soil, plus Aetherium Crystal on Pink Soil,
  using each crop's actual block ID, age state and produce IDs.
- Failed planting now restores the original seed stack, including name/lore,
  instead of recreating a plain seed. Successful planting still consumes seeds.
- Shared machine information: native translated lore through `RawMessage`;
  73 terms cover shared statistics and the Verdant/Seismic/Pattern status panels
  in all ten bundled locales. Numeric values and formatting are preserved.
  Unknown phrases/item names keep their original spelling rather than inventing
  translations. No server-wide language selection is imposed.
- Refining Table and Enchantment Station: six orthographic model views each
  replace the whole-atlas I/O images. See `docs/previews/machine-io/README.md`.
- Seismic Breaker and Pattern Placer: face images are copied from their actual
  native assets to dedicated `textures/ui/io_faces/<machine>/<face>` paths;
  I/O slots and bindings remain unchanged. The 0.9.1 Breaker UI used old face
  filenames; current source had already moved to the split-face paths. The
  purple/black screenshot must be checked against the updated resource pack.

## Seismic Breaker / Pattern Placer review

Focused tests exercise the actual helpers with simulated Bedrock objects:

- Pattern skips occupied or protected positions, counts successful placements,
  and consumes only matching stacks; differently named stacks are retained.
- Seismic retains a block when loot generation throws and preserves metadata
  in overflow drops when only part of the loot fits inside the machine.
- The four spatial modes produce 1/9/27/5 unique targets in front of the machine
  in each of the four cardinal orientations.
- No additional functional rewrite was made to either machine.

## Validation

- `node tools/test-reported-machine-bugs.mjs`: five regression tests passed.
- `node tools/test-ui-rebuild.mjs`: 64 UI definitions and shared contracts passed.
- `node --experimental-vm-modules tools/test-residue-processor.mjs`: passed.
- All 24 referenced I/O face files exist; twelve model renders are nonempty
  transparent 80x80 PNGs. Contact sheet visually inspected.
- Full `BP/scripts/main.js` esbuild bundle passed in memory.
- Changed JS syntax checks and `git diff --check` passed.

## In-game follow-up

- Test hammer speed on dirt/sand/gravel, farming with the correct tier soils,
  and forced planting failure using a named seed stack.
- Open all four I/O screens with the updated RP, including all six directions.
- Test native translated lore with two clients using different languages; mocks
  verify the RawMessage payload, not Bedrock's final tooltip rendering.
- Test Seismic loot/protection and Pattern placement in the actual world.
- Random menu item loss, cable compatibility and the older external-Hyper report
  still need a reproducible world/version/topology before a further fix can be
  attributed to them. They were not marked false or fixed by these tests.

No manifest versions were changed, no commit/push was made, and the earlier
`.mcaddon` was not regenerated in this follow-up.

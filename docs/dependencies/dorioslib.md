# DoriosLib upstream snapshot

Ascendant Technology uses DoriosLib **2.1.0** from UtilityCraft commit
[`4cc859f5`](https://github.com/DoriosStudios/UtilityCraft/commit/4cc859f5475cbe055d08bba39bfea5873f2313bf),
checked against `origin/main` on 2026-09-07. The local UtilityCraft branch was
older than the remote snapshot, so the imported files come from that immutable
commit rather than from its working directory.

Relevant upstream history:

- [`65adbd1d`](https://github.com/DoriosStudios/UtilityCraft/commit/65adbd1d): shared link-node IO, registration and container resolution.
- [`9cc2a922`](https://github.com/DoriosStudios/UtilityCraft/commit/9cc2a922): passive default IO access through `anyInputSlots`/`anyOutputSlots`; explicitly disabled faces remain closed.
- [`aacb73f4`](https://github.com/DoriosStudios/UtilityCraft/commit/aacb73f4): Electrolyzer and Chemical Converter recipe registration.
- [`7dbd1333`](https://github.com/DoriosStudios/UtilityCraft/commit/7dbd1333): the shared DoriosCore button watcher no longer resets an existing watcher during repeated registration. This narrow DoriosCore update supports reliable Beacon toggles.

The snapshot also includes shared entity-to-player tracking. `config.js` remains
local, preserving Ascendant's identity, dependency requirements and announcements.
Other DoriosCore modules retain the project's existing changes.

`dorioslib-upstream.json` records LF-normalized SHA-256 hashes produced from the
upstream Git blobs, including the button module. `npm run audit:dorioslib` verifies
these hashes and inventories the runtime exports without requiring network access.
This project uses runtime JSDoc, so the audit no longer requires the absent
`types/DoriosLib` declaration tree. If declarations are supplied later, the original
declaration/inventory comparison remains available.

The main script bundle and `npm run audit:aetherium-beacons` provide integration
checks. The separate `audit:dorioscore` command still depends on the pre-existing,
absent `types/DoriosCore/API_INVENTORY.md`; it was not used as a passing check.

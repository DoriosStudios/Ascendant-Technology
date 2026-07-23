# Ascendant Technology rebuild

Feature inventory and status: [FEATURE_STATUS.md](./FEATURE_STATUS.md)

The active pack is intentionally a minimal foundation while Ascendant Technology is
rebuilt on the canonical `DoriosLib` and `DoriosCore` implementations. Components
owned and registered by the UtilityCraft dependency remain active; only AT's legacy
runtime is quarantined.

## Dependency direction

```text
features -> ATCore -> DoriosCore + DoriosLib
integrations ------> public cross-addon contracts
```

- `DoriosCore` contains shared machinery infrastructure and must not contain AT code.
- `DoriosLib` contains shared utilities and registration infrastructure.
- `ATCore` contains only reusable systems exclusive to Ascendant Technology.
- `features` contains concrete machines, generators, blocks, and transportation.
- `legacy` is read-only behavioral reference and is never imported by active code.

## Rebuilding a feature

1. Document the intended behavior from `legacy/`; do not copy its architecture.
2. Implement the feature with `DoriosLib` and the public `DoriosCore` API.
3. Use `registerIOInterface` and `processIO` from the first implementation.
4. Add shared AT behavior to `ATCore` only after a concrete reusable need exists.
5. Remove its AT identifiers from the pending sets in the disable tool, then restore
   that feature's `LEGACY_DISABLED` AT components and tick.
6. Verify placement, reload, processing, IO, destruction, and persistence.
7. Keep all other legacy features disabled.

Run `node tools/rebuild/disable_legacy_content.mjs` to verify that no pending AT legacy
component has accidentally been re-enabled. `restore_uc_components.mjs` documents the
allowlist of components supplied by UtilityCraft 3.5.0.

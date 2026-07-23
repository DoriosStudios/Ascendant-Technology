# StatsCore Architecture Notes

`StatsCore` now follows a clearer split between runtime bootstrap, public API, and shared Bedrock helpers.

## Entry points

- `index.js` → runtime entrypoint for the whole package.
- `bootstrap.js` → initializes default definitions and subscribes modules.
- `API.js` → stable public surface for external systems such as machines or script tools.
- `main.js` → compatibility shim that re-exports `index.js`.

## Public API rules

When another system needs to read or mutate StatsCore data, prefer `API.js` instead of importing deep files directly.

Use `API.js` for:
- `getStatsCoreDefinition(...)`
- `readStatsState(...)`
- `writeStatsState(...)`
- `resolveStatsAttributes(...)`
- `collectStatsAbilityNames(...)`
- progression helpers such as `grantStatsProgress(...)`

## Shared helper rules

When multiple runtime modules need the same Bedrock glue code, keep it in `shared/`.

### `shared/context.js`

Use these helpers whenever a module needs the full StatsCore runtime context for an item:

- `readStatsItemContext(stack)`
  - Reads `definition + state + attributes` from an already resolved item stack.
- `getEquipmentStatsContext(entity, slotName, expectedTypeId?)`
  - Reads the live item from a slot and validates the expected item type when needed.
- `getHeldStatsContext(player, expectedTypeId?)`
  - Shortcut for the mainhand item flow used by combat, mining, utility, and script tooling.

### `shared/effects.js`

Use these helpers for Bedrock status effects instead of rewriting `EffectTypes.get(...)` logic:

- `resolveStatsEffectType(id)`
- `applyEffectById(target, id, duration, amplifier?, showParticles?)`

### `shared/effectSelectors.js`

Use these helpers to scan StatsCore effect definitions:

- `collectStatsEffectPool(attributes)`
- `findEffectByKind(list, kind)`
- `filterEffectsByKind(list, kind)`
- `hasEffectKind(list, kind)`

If the logic is only needed once, keep it inline near the caller instead of creating a new helper.

### `shared/enchantments.js`

Use these helpers for enchantment checks:

- `hasEnchantmentToken(stack, token)`
- `hasSilkTouch(stack)`

### `shared/durability.js`

Use `repairItemDurability(stack, amount?)` for all durability restoration.

It already knows how to use the DoriosAPI durability patch when that runtime is present.

### `shared/damage.js`

Use these helpers for `entityHurt` parsing and damage-type normalization:

- `getEntityHurtAttacker(event)`
- `getEntityHurtTarget(event)`
- `getEventDamageType(event)`
- `normalizeDamageType(value)`
- `uniqueDamageTypes(values)`
- `matchesDamageType(values, damageType)`
- `isBossLikeEntity(entity)`

### `shared/messages.js`

Use `setActionBarSafe(target, message)` for direct action bar writes.

If a module needs cooldown or throttling, wrap it on top of this helper instead of duplicating the low-level `try/catch`.

## Runtime style rules

- Keep one-time logic inline when it only serves a single handler.
- Extract only Bedrock glue, repeated selectors, or true cross-module behavior.
- Comment the intent of unusual event timing, delayed `system.run(...)` blocks, or item persistence paths.
- Prefer shared helpers over local duplicates.
- Prefer `API.js` for external consumers and `shared/` for internal cross-module helpers.

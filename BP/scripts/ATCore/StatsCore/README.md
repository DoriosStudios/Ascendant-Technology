# StatsCore Architecture Notes

`StatsCore` now follows a clearer split between runtime bootstrap, public API, and shared Bedrock helpers.

## Entry points

- `index.js` -> runtime entrypoint for the whole package.
- `bootstrap.js` -> initializes default definitions and subscribes modules.
- `eventDriven/index.js` -> owns input, healing, charging, projectile, pickup, explosion, death, and dimension-change mechanics.
- `API.js` -> stable public surface for external systems such as machines or script tools.
- `main.js` -> compatibility shim that re-exports `index.js`.

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

It uses the native item durability component and has no DoriosAPI dependency.

### `shared/damage.js`

Use these helpers for `entityHurt` parsing and damage-type normalization:

- `getEntityHurtAttacker(event)`
- `getEntityHurtTarget(event)`
- `getEventDamageType(event)`
- `normalizeDamageType(value)`
- `uniqueDamageTypes(values)`
- `matchesDamageType(values, damageType)`
- `isBossLikeEntity(entity)`

### `shared/entityCategories.js`

Use the centralized entity taxonomy instead of local `monster`, pet, or boss checks:

- `getEntityCategory(entity)` -> `ally`, `passive`, `neutral`, `hostile`, or `boss`
- `entityMatchesAppliesTo(entity, appliesTo, fallback?)`
- `effectAppliesToEntity(effect, entity, fallback?)`

`appliesTo` accepts one category/typeId string or an array mixing both. Tamed
entities and players resolve dynamically as allies; unknown addon mobs fall back
through their Bedrock families.

### `shared/messages.js`

Use `setActionBarSafe(target, message)` for direct action bar writes.

When Dorios' Insight announces its cooperative actionbar bridge, this helper
automatically registers `ascendant.statscore` as
`Ascendant Technology · StatsCore` and pins StatsCore feedback to the secondary
JSON UI display above the actionbar. Minecraft's native actionbar remains the
primary receiver for Insight and other addons.
The bridge uses script events between behavior packs and falls back to the
regular Ascendant Technology actionbar writer when Insight is absent.

If a module needs cooldown or throttling, wrap it on top of this helper instead of duplicating the low-level `try/catch`.

## Runtime style rules

- Keep one-time logic inline when it only serves a single handler.
- Extract only Bedrock glue, repeated selectors, or true cross-module behavior.
- Comment the intent of unusual event timing, delayed `system.run(...)` blocks, or item persistence paths.
- Prefer shared helpers over local duplicates.
- Prefer `API.js` for external consumers and `shared/` for internal cross-module helpers.

## Feedback styles

- `only_text` (`text`) -> text without glyphs.
- `only_icons` (`emoji`) -> glyphs without text.
- `text_and_icons` (`both`) -> every feedback entry keeps its glyphs and text.
- `both_partial` -> combines every queued glyph on the left and renders only the highest-priority text entry.

Level-up feedback is batched per player. Simultaneous armor level-ups share one action-bar message, sound, and particle.

The cooperative actionbar integration is automatic. The per-player
`/sc:insight_bridge` setting remains a compatibility fallback for older Insight
builds that only expose the custom StatsCore activity HUD; it is ignored while
the cooperative queue is available to prevent duplicate feedback.

## Attributes

StatsCore resolves an item's base definition, equipment level, refinement
bonuses, affinity, and unlocked abilities into one runtime attribute snapshot.
Unless an entry explicitly says otherwise, chance values are normalized between
`0` and `1`, where `1` means 100%. The actual value available on an item still
depends on its type, material, branch, refinement grade, and unlock tier.

### Combat attributes

| Attribute | What it does |
| --- | --- |
| Extra Damage | Adds direct damage to an eligible combat hit. |
| Damage Multiplier | Multiplies eligible combat damage after StatsCore calculates its combat modifiers. |
| Marked Damage | Adds bonus damage against targets currently marked by a compatible effect. |
| Critical Chance | Gives attacks a chance to become critical hits. |
| Critical Multiplier | Sets the damage multiplier used by a critical hit. |
| Critical Damage | Adds an extra critical-damage bonus when a critical hit succeeds. |
| Armor Penetration | Reduces the effective armor contribution of the target; bosses use the configured boss scalar. |
| Lifesteal | Restores health from eligible damage, subject to the item's lifesteal cap and any critical-hit bonus. |
| Elemental Damage | Applies configured fire, poison/plant, frost, lightning, or darkness effects when their individual roll succeeds. |

### Mining attributes

| Attribute | What it does |
| --- | --- |
| Bonus Loot Chance | Gives eligible ore breaks one additional loot roll. It is intentionally hidden from item lore. |
| Tool Preserving | Uses the item's Defense level: compatible mining equipment earns Defense progress while used. It starts at 1%, repairs 2 durability on a successful roll, gains 1% per level with no chance cap, and repairs one additional point for each full 100% passed. It never repairs a fully durable item. |
| Double Trouble | Enables a configurable chance for an additional mining yield. |
| Triple Trouble | Adds the triple-yield follow-up rule when Double Trouble is available. |

### Defensive and armor attributes

| Attribute | What it does |
| --- | --- |
| Damage Reduction | Reduces all incoming damage. Equipment reduction is capped at 90% in total; an off-hand shield contributes a fixed 60%. Vanilla armor protection remains separate. |
| Evasion | Gives a chance to avoid an incoming hit entirely. Armor starts at 1% and gains 1% per Defense level; an off-hand shield contributes a fixed 5%. |
| Armor Preserving | Uses the item's Defense level and follows the same repair rules as Tool Preserving. |

### Event-driven attributes

These attributes are evaluated only by their matching gameplay event; they do
not modify every hit continuously.

| Attribute | What it does |
| --- | --- |
| Adaptive Resilience | Builds defensive resilience from the configured combat conditions. |
| Healing Efficiency | Improves compatible healing events, up to 25%. |
| Charge Mastery | Tracks and improves charge-based behavior for compatible equipment. |
| Persistence | Consecutive hits on the same target with the same weapon gain 2.5% damage each, up to 50%, and reset after the configured gap. |
| Dimensional Attunement | Applies the configured dimensional travel or cooldown benefit. |
| Scavenging | Rolls on eligible pickups to grant extra XP and optional healing. |

### Refinement command attributes

`/sc:refine_attribute apply` accepts the following keys. The command rejects
an attribute when the held registered item does not support its equipment
category. The command value is a float in the inclusive range shown below.

| Key | Runtime attribute | Range | Equipment |
| --- | --- | ---: | --- |
| `damage_multiplier` | Damage Multiplier | 0–1 | Combat equipment |
| `extra_damage` | Extra Damage | 0–18 | Combat equipment |
| `critical_chance` | Critical Chance | 0–1 | Combat equipment |
| `critical_damage` | Critical Damage | 0–1 | Combat equipment |
| `penetration` | Armor Penetration | 0–1 | Combat equipment |
| `lifesteal` | Lifesteal | 0–1 | Combat equipment |
| `damage_reduction` | Damage Reduction | 0–1 | Support equipment |
| `negate_all_damage` | Evasion | 0–1 | Support equipment |
| `bonus_loot_chance` | Bonus Loot Chance | 0–1 | Mining equipment |
| `durability_save` | Tool Preserving | 0–1 | Mining equipment |
| `durability_preserve` | Armor Preserving | 0–1 | Support equipment |

## Event-driven profiles

Resolved equipment can expose these passive attributes through `attributes.eventDriven`:

- Adaptive Resilience
- Healing Efficiency
- Charge Mastery
- Persistence
- Dimensional Attunement
- Scavenging

Unique effect pools can expose these event-driven abilities:

- Perfect Guard
- Pinning Shot
- Overcharge
- Soul Collector
- Blast Ward
- Phase Step

## Runic unlock tiers

- `utilitycraft:runic_core` unlocks the item's primary/exclusive ability.
- `utilitycraft:advanced_runic_core` uses the same Refining Table slot, unlocks both the primary and advanced event-driven abilities, raises the ingot/refinement ceiling, and boosts strong attributes, effects, and event-driven profiles.
- Advanced abilities are marked with `unlockTier: "advanced"` and `requiresAdvancedUnlock: true`; runtime effect resolution must enforce this gate.
- Lore joins direct Extra Damage, bonus damage, and elemental damage into one Extra Damage entry, then shows the three attributes with the highest activation likelihood. It shows only the primary ability name and appends `+` when additional unlocked abilities exist. Bonus Loot Chance is not shown in lore.

Pinning Shot, Charge Mastery, Persistence, and Ballista resolve from confirmed projectile damage. Charge Mastery also spawns one wind charge for every struck target. Harpoon is activated from the item's completed charge event.

## Administrative commands

- `/sc:state <on|off>`
- `/sc:style [only_text|only_icons|text_and_icons|both_partial]`
- `/sc:insight_bridge [on|off]` — routes personal StatsCore notices through Dorios' Insight and prevents duplicate action-bar notices.
- `/sc:refine custom <target> <tier> <chip> <ingot> <core> [amount]`
- `/sc:refine_attribute apply <target> <attribute> <float-value>`
- `/sc:refine_ability apply <target> <ability> <int-level> <appliesTo>`
- `/sc:refine_list <attributes|abilities>`
- `/sc:xp add <target> <xp-type> <xp|levels> <amount>`

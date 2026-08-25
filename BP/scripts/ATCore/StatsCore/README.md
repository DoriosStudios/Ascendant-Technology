# StatsCore Player Guide

StatsCore gives compatible equipment levels, passive attributes, elemental
affinities, and special abilities. Refinement writes the result directly to the
item, so its lore and the Refining Table always describe the saved equipment.

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

Attributes are passive bonuses that work while the corresponding equipment is
being used. In commands, decimal chances use `0` to `1`: for example, `0.25`
means 25%. The number shown to the player already includes material, level,
refinement quality, affinity, and relevant unlocks.

### Combat attributes

| Attribute | What the player gets | Important details |
| --- | --- | --- |
| Flat Extra Damage | A fixed amount added to eligible hits. | `+4` damage equals two hearts before the target's reductions. |
| Bonus Damage | A percentage increase to eligible attack damage. | A command value of `0.25` means `+25%`. |
| Marked Damage | More damage against a target carrying Marked. | It does nothing until an ability such as Skewer or Pinning Shot marks the target. |
| Critical Hit Chance | A chance for a normal hit to become critical. | The final chance respects the equipment profile's cap. |
| Critical Multiplier | Controls how hard a successful critical hits. | `2.00x` means the critical deals twice its resolved normal damage. |
| Critical Damage | Adds to the critical multiplier. | A command value of `0.50` adds `+0.50x`, not 50% critical chance. |
| Armor Penetration | Ignores part of the target's effective armor. | Bosses receive a reduced amount and have their own penetration cap. |
| Lifesteal | Restores health from eligible damage dealt. | Healing is based on damage and still respects the item's Lifesteal cap. |
| Element | Gives attacks a chance to trigger Plant, Frost, Fire, Lightning, Darkness, Blessing, Wind, Water, or Void. | Every element has its own behavior; chance and extra damage are shown separately. |

### Mining attributes

| Attribute | What the player gets | Important details |
| --- | --- | --- |
| Bonus Loot Chance | A chance for another eligible loot result. | Works with supported block and entity loot; it stays out of compact item lore but appears in the Refining Table. |
| Tool Preserving | A chance to repair one durability on the held tool after hostile damage. | Melee, projectiles, explosions, Thorns, and ram attacks qualify. Environmental damage and mining do not. |
| Double Trouble | A second complete loot-table result. | Growth is slower at levels 1–50, improves at 51–100, and is strongest at 101–200. |
| Triple Trouble | A third complete loot-table result after Double Trouble succeeds. | It performs its own smaller roll and requires Double Trouble. |

### Defensive and armor attributes

| Attribute | What the player gets | Important details |
| --- | --- | --- |
| Damage Reduction | Less incoming damage while the armor is equipped. | StatsCore pieces combine up to 90%; vanilla armor protection is separate. An off-hand shield contributes a fixed 60%. |
| Evasion | A chance to cancel an eligible hit completely. | Armor begins at 1% and gains 1 percentage point per Defense level; an off-hand shield contributes a fixed 5%. |
| Armor Preserving | A chance to repair damaged equipped armor after hostile damage. | Normally repairs 1 durability and caps at 35%. Earth Toughness raises the cap to 55% and repairs 2. |

### Event-driven attributes

These attributes are evaluated only by their matching gameplay event; they do
not modify every hit continuously.

| Attribute | What the player gets | When it activates |
| --- | --- | --- |
| Adaptive Resilience | Stacking temporary damage reduction. | Holds up to three normal stacks for five seconds and can gain a fourth with an Advanced Runic Core. |
| Healing Efficiency | More healing and temporary Absorption from overhealing. | Only on compatible healing events; HUD feedback is limited to once every two seconds. |
| Charge Mastery | More damage from a properly charged bow, crossbow, or trident. | Scales with charge time and reaches its maximum at full charge. |
| Persistence | `+2.5%` damage per consecutive projectile hit on the same target, up to `+50%`. | Resets when the target changes or ten seconds pass. |
| Dimensional Attunement | A temporary dimensional travel/cooldown benefit. | Activates on its configured dimension-change event. |
| Scavenging | A chance for extra XP and healing from eligible pickups. | Uses Utility level, or Mining when Mining is higher. |

### Refinement command attributes

`/sc:refine_attribute apply` accepts the following keys. The command rejects
an attribute when the held registered item does not support its equipment
category. The command value is a float in the inclusive range shown below.

| Command key | Player-facing meaning | Accepted value | Example |
| --- | --- | --- | --- |
| `damage_multiplier` | Bonus attack damage | `0–1`, combat | `0.25` adds 25% |
| `extra_damage` | Fixed extra damage | `0–18`, combat | `4` adds two hearts of raw damage |
| `critical_chance` | Extra critical chance | `0–1`, combat | `0.20` adds 20 percentage points |
| `critical_damage` | Extra critical multiplier | `0–1`, combat | `0.50` adds `+0.50x` |
| `penetration` | Armor ignored | `0–1`, combat | `0.15` means 15% |
| `lifesteal` | Damage returned as healing | `0–1`, combat | `0.08` means 8% |
| `damage_reduction` | Incoming damage reduction | `0–1`, armor/support | `0.10` means 10% |
| `negate_all_damage` | Evasion chance | `0–1`, armor/support | `0.05` means 5% |
| `bonus_loot_chance` | Additional loot chance | `0–1`, mining | `0.12` means 12% |
| `durability_save` | Tool Preserving bonus | `0–1`, mining | `0.10` adds 10 percentage points |
| `durability_preserve` | Armor Preserving bonus | `0–1`, armor/support | `0.10` adds 10 percentage points |

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
- `utilitycraft:advanced_runic_core` uses the same Refining Table slot, unlocks both the primary and advanced event-driven abilities, raises the ingot/refinement ceiling, and boosts strong attributes, effects, and event-driven profiles. When consumed by a refinement it also rolls a 10% same-category ability inheritance; every success grants an unowned `+` ability and recursively attempts another 10% roll without a fixed chain cap.
- Advanced abilities are marked with `unlockTier: "advanced"` and `requiresAdvancedUnlock: true`; runtime effect resolution must enforce this gate.
- Lore joins direct Extra Damage, bonus damage, and elemental damage into one Extra Damage entry, then shows the three attributes with the highest activation likelihood. It shows only the primary ability name and appends `+` when additional unlocked abilities exist. Bonus Loot Chance is not shown in lore.

Pinning Shot, Charge Mastery, Persistence, and Ballista resolve from confirmed projectile damage. Charge Mastery also spawns one wind charge for every struck target. Harpoon is activated from the item's completed charge event.

## Administrative commands

- `/sc:state <on|off>`
- `/sc:style [only_text|only_icons|text_and_icons|both_partial]`
- `/sc:insight_bridge [on|off]` — routes personal StatsCore notices through Dorios' Insight and prevents duplicate action-bar notices.
- `/sc:effects <marked|bleeding|blessed|cursed|berserk|adaptive_resilience|soul_collector> <target> <duration_seconds>` — applies a StatsCore status to players or mobs for Insight HUD/WAILA testing.
- `/sc:refine custom <target> <tier> <chip> <ingot> <core> [amount]`
- `/sc:refine_attribute apply <target> <attribute> <float-value>`
- `/sc:refine_ability apply <target> <ability> <int-level> <appliesTo>`
- `/sc:refine_element apply <target> <element> <chance:0..1> <damage:0..18>`
- `/sc:refine_list <attributes|abilities|elements>`
- `/sc:stats_xp add <target> <xp-type> <xp|levels> <amount>`

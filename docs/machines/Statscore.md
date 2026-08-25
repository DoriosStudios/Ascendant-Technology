# StatsCore

StatsCore gives compatible equipment its own progression, attributes, and
special abilities. An item's final behavior is determined by its material,
equipment type, level, refinement quality, affinity, and unlocked abilities.

Most special abilities are awakened through the **Refining Table**. The first
successful awakening of a locked ability consumes a **Runic Core**. An
**Advanced Runic Core** can unlock advanced abilities and strengthen supported
attributes. Every refinement that actually consumes an Advanced Runic Core
also starts a `10%` inheritance roll for an ability from another item in the
same equipment category. Each success grants one previously unowned ability
and immediately rolls another `10%`; the chain has no artificial success cap.

## Attributes

Attributes are passive improvements. Some use **attribute points**: a point is
awarded to one of the listed attributes as the item progresses, rather than
every item level increasing every attribute. Other attributes use the relevant
category level directly. Percent values are stored from `0` to `1`, where `1`
represents 100%.

Unless an entry says otherwise, an attribute-point increase is determined by
the item's material:

| Material | Gain per attribute point |
| --- | ---: |
| Wood | 0.6 percentage points |
| Stone | 0.8 percentage points |
| Copper | 1.0 percentage point |
| Iron | 1.2 percentage points |
| Steel | 1.4 percentage points |
| Golden | 1.8 percentage points |
| Diamond | 2.0 percentage points |
| Netherite / Titanium | 2.4 percentage points |
| Aetherium | 3.0 percentage points |

### Combat attributes

**Damage Multiplier** (weapons, tools, hybrids, and utility items):

- Starts at `1.00×` damage.
- Gains the material's attribute-point value for each **Bonus Damage** point.
- Has no independent StatsCore cap; refinement bonuses can also raise it.

**Extra Damage** (weapons, tools, hybrids, and utility items):

- Starts at `+0` damage unless the item has a named override.
- Does not gain a passive amount per level or attribute point.
- Refinement can add up to `+18` damage; named equipment can add its own value
  (for example, Primal starts at `+4`).

**Marked Damage** (combat-capable items):

- Starts at `+4%` damage against marked targets.
- Does not scale with level or attribute points.
- Is capped at 100% by the final attribute resolver.

**Critical Chance** (combat-capable items):

- Starts between `1.01%` and `45%`, depending on material and equipment type.
- Caps at `45%`.
- Gains the material's attribute-point value for each **Critical Chance** point.
- Bows use their own profile: `8%` initial chance, `+0.32%` per point, and a
  `40%` cap.
- Refinement can add up to 100 percentage points before final clamping.

**Critical Multiplier** (combat-capable items):

- Starts at `1.50×`.
- Increases once per **Offensive** level, by a material-specific value between
  `+0.024×` and `+0.216×`.
- Caps at `2.25×`.
- Bows instead gain `+0.005×` per Offensive level and cap at `2.15×`.
- Refinement can add up to `+1.00×` critical damage, but the item's multiplier
  cap still applies.

**Armor Penetration** (combat-capable items):

- Starts between `0.53%` and `45%` after material caps are applied.
- Gains the material's attribute-point value for each **Armor Penetration**
  point.
- Caps at `45%` on the standard profile.
- Boss-like targets use their reduced penetration profile but can never receive
  more than `20%` effective penetration. Crossbows use `8%` initial
  penetration, `+0.4%` per point, and a `34%` cap before this boss limit.

**Lifesteal** (non-tool combat items):

- Starts between `0%` and `7.2%`, depending on material.
- Gains the material's attribute-point value for each **Lifesteal** point.
- Caps at `25%`.
- Critical hits add `+1%` Lifesteal for weapons and `+0.4%` for other eligible
  combat items.

**Elemental Damage** (combat-capable items):

- Has no universal initial value or level growth.
- Uses the configured Fire, Plant/Poison, Frost, Lightning, or Darkness effect
  for that item; each effect supplies its own chance, duration, damage, and
  cooldown.

### Mining attributes

**Bonus Loot Chance** (tools, hybrids, and utility items):

- Replaces both Bonus Drop Chance and Ore Bonus Chance with one roll.
- Combines the former base values for an item's material and gains the
  material's attribute-point value for each **Bonus Loot** point.
- Grants the matching eligible ore loot when the roll succeeds.
- Is deliberately hidden from the item's lore, but remains visible in the
  Refining Table details.

**Tool Preserving** (weapons, tools, hybrids, and utility items):

- Scales from the item's Mining level; it does not create or display a Defense
  progression category on non-support equipment.
- Uses the item's resolved Preserving chance, but never activates from mining,
  environmental damage, falling, fire, drowning, starvation, or similar
  non-hostile sources.
- Can repair the held item only after the player receives eligible hostile
  melee, projectile, explosion, Thorns, or ram-attack damage.
- Repairs 1 durability on activation and never repairs an undamaged item.

**Double Trouble** (refined tools, hybrids, and utility items):

- Requires active refinement.
- Starts at `1%` chance to generate the complete loot-table result a second
  time. It works for both blocks and killed entities without an item whitelist.
- Growth is back-loaded: levels `1–50` traverse the first 10% of the distance
  from the base chance to the cap, levels `51–100` reach 35%, and levels
  `101–200` cover the remaining distance to the cap.
- Caps at `20%`; an Advanced Runic Core raises the initial value and growth to
  `1.2%`, and the cap to `25%`.

**Triple Trouble** (with Double Trouble):

- Requires both active refinement and Double Trouble.
- Has a chance equal to `10%` of the resolved Double Trouble chance to generate
  the loot a third time.
- An Advanced Runic Core raises that scale to `12.5%`.

### Defensive and armor attributes

**Damage Reduction** (armor and shields):

- Standard armor starts at `0.7%` (Diamond), `1.0%` (Netherite), or `0.9%`
  (all other supported materials).
- Gains the material's attribute-point value for each **Damage Reduction**
  point.
- Per-piece caps are `12%`; the total reduction from equipped StatsCore armor
  cannot exceed `90%` and applies to every damage type.
- A shield held in the offhand contributes a fixed `60%` reduction and never
  levels this value.

**Evasion** (armor and shields):

- Can cancel an eligible incoming hit completely.
- Uses **Defensive** level directly, not defensive attribute points.
- Every armor piece starts at `1%` and gains `+1%` per Defense level, with no
  per-piece level cap; the final chance cannot exceed 100%.
- A shield held in the offhand has a fixed `5%` chance and does not
  level it.

**Armor Preserving** (armor and shields):

- Gains `+0.5%` per Defense level and caps at `35%` normally.
- Rolls only after eligible hostile melee, projectile, explosion, Thorns, or
  ram-attack damage. Environmental and self-inflicted sources are ignored.
- Repairs 1 durability and never repairs full-durability equipment.
- **Earth Toughness** raises the final cap to `55%`, improves damage reduction,
  and repairs 2 durability per successful activation.

### Event-driven attributes

These attributes only run when their matching gameplay event happens.

For these attributes, **P** is the event-tier power: `0.65` Wood, `0.75` Stone,
`0.85` Copper, `1.00` Iron, `1.08` Steel, `1.12` Golden, `1.20` Diamond,
`1.40` Netherite, `1.35` Titanium, and `1.60` Aetherium.

**Adaptive Resilience** (armor):

- Starts at `0.8% × P` damage reduction per stack.
- Gains `0.018% × P` per **Defensive** level, up to `2.5%` per stack.
- Holds up to 3 stacks for 5 seconds.
- An Advanced Runic Core increases the resolved reduction by 20% (up to 4%)
  and adds one maximum stack.

**Healing Efficiency** (armor):

- Starts at `1.2% × P` improved compatible healing.
- Gains `0.025% × P` per **Defensive** level, up to `25%`.
- Overhealing grants Absorption for 5 seconds.
- HUD feedback reports only the healing added by Healing Efficiency, ignores
  ordinary baseline healing, and is rate-limited to one notice every 2 seconds.
- An Advanced Runic Core increases the resolved bonus by 20%, up to `25%`.

**Charge Mastery** (bows, crossbows, and tridents):

- Starts at `8% × P` maximum charged-damage bonus.
- Gains `0.15% × P` per **Offensive** level, up to `40%`.
- Reaches full charge after 20 ticks, or 25 ticks for crossbows.
- An Advanced Runic Core increases the resolved bonus by 20%, up to `55%`.

**Persistence** (bows, crossbows, and tridents):

- Tracks repeat projectile hits on the same target with the same weapon.
- Adds `2.5%` damage for each consecutive hit, up to `50%`.
- Resets after 10 seconds without another hit on that target.

**Dimensional Attunement** (armor):

- Starts at `80 + (30 × P)` ticks of duration (about 5.0–6.4 seconds).
- Does not grow with level.
- Uses amplifier I on all compatible armor.
- An Advanced Runic Core increases its duration by 20%.

**Scavenging** (tools, hybrids, and utility items):

- Starts at `3.5% × P` chance on an eligible item pickup.
- Gains `0.075% × P` per **Utility** level (or Mining level when it is higher),
  up to `30%`.
- Grants `floor(2 × P)`, minimum 1, extra XP and restores `0.5 + (0.35 × P)`
  health when it succeeds.
- An Advanced Runic Core increases the resolved chance and healing by 20%,
  caps chance at `45%`, and adds one extra XP.

## Equipment test commands

These administrator commands modify the registered item in each target
player's main hand. Every successful command persists the new StatsCore state,
recalculates the resolved attributes, replaces the item in the correct slot,
and refreshes its lore immediately.

- `/sc:refine_attribute apply <target> <attribute> <value>` adds a compatible
  refinement attribute. Chance values use `0–1`, while Extra Damage uses
  `0–18`.
- `/sc:refine_element apply <target> <element> <chance> <damage>` assigns an
  elemental affinity. Use `/sc:refine_list elements` for the accepted IDs.
- `/sc:refine_ability apply <target> <ability> <level> <appliesTo>` unlocks a
  native ability or installs it as an inherited `+` ability when the target's
  combat/mining/support category accepts it. `appliesTo` accepts an entity
  category such as `hostile` or an exact entity type ID.
- `/sc:refine_list <attributes|abilities|elements>` explains the available
  test values in chat.

Examples:

```text
/sc:refine_attribute apply @s critical_chance 0.25
/sc:refine_element apply @s void 1 8
/sc:refine_ability apply @s bleeding 1 hostile
/sc:refine_ability apply @s reaper 1 hostile,boss
```

## Special abilities

### Combat and hybrid abilities

**Bleeding** (Sword):

- Always applies damage over time after a successful hit.
- Produces red dust particles whenever the bleed damage ticks.

**Sweeping** (AIOT and advanced Swords):

- Releases a wide melee strike.
- Damages nearby animals, neutral mobs, hostile mobs, and bosses in addition
  to the original target. Players, tamed creatures, villagers, golems, and
  other allied mobs are excluded.
- Every five Offensive levels, expands its radius by `0.5` blocks and increases
  its secondary-hit damage by `5%`, up to Offensive level 25.

**Skewer** (Spear):

- Marks the target after a successful hit.
- Increases the damage of compatible follow-up attacks against that marked
  target.
- Throws the target away with strong knockback and gives the user a short
  forward impulse.
- Marked mobs render a glowing short-lived marker 2.5 blocks above their
  origin; it is refreshed every two ticks so it follows the target.

**Aftershock** (Mace):

- Affects nearby mobs in a 7.5-block radius.
- Launches affected mobs upward and releases hit particles.
- Applies Slowness IV when each affected mob lands.

**Harpoon** (Trident):

- Marks the entity struck by the trident.
- Uses the charge-complete event to launch the player in their look direction.
- Briefly grants Slow Falling after that launch.

**Pinning Shot** (Bow):

- Activates after a confirmed projectile hit.
- Slows and weakens the struck target.
- Marks the target for compatible follow-up damage.

**Ballista** (Crossbow):

- Marks the directly struck target.
- Marks and damages up to three nearby valid targets.
- Draws a particle path from the original target to every Ballista target.

**Reaper** (Hoe):

- Adds bonus attack damage.
- Damages nearby mobs matching the original target's category.
- Applies Bleeding to the original and reaped targets.
- Also enables the crop-harvesting behavior described below.

**Soul Collector** (advanced combat equipment):

- Stores one soul charge for each kill, up to five charges; Reaper gains two
  charges per kill instead.
- Charges last 30 seconds and remain stored until the collector is completely
  full.
- The next successful attack at five charges consumes all charges, increases
  its damage, and heals the wielder for each stored charge.
- Its discharge creates the Ascendant Soul Harvester burst and explosion at
  the target, with its own soul-discharge sound and vanilla emitters as a
  visual fallback.

**Berserk** (Axe):

- Builds temporary attack-damage stacks after kills and applies the matching
  vanilla Strength level to the wielder.
- Cannot exceed five stacks/Strength V.
- Can be used by every supported axe, including addon axes whose identifier
  ends in `_axe`.

### Mining and utility abilities

**Luck** (AIOT):

- Spawns an XP orb whenever a valid ore is broken.

**Crushing** (Hammer):

- Adds matching dust when mining coal, copper, iron, gold, or titanium ore.

**Operator** (Drill or Heavy Drill):

- Sneak and interact to cycle the active drill mode.
- `Crushy` preserves the wide-breaking behavior.
- `Silky` uses silk-style mining where possible.
- `Greedy` applies fortune-style drops where valid.

**Gardener** (Shears):

- Turns breaking leaves or plants into a 5×5 clearing action.
- Duplicates eligible plant harvests in the cleared area.

**Primal** (Flint Knife):

- Adds 2–4 Fiber when breaking leaves and supported foliage.
- Adds 1–2 Sugar Cane when breaking sugar cane or reeds.
- Increases base attack damage by 4.
- Always applies Bleeding after hitting an entity.

**Forger** (Smelting Pickaxe):

- Can add matching plates when eligible ores are broken.
- Uses the post-break loot to convert broken Netherrack into four Nether Bricks.
- Ignites entities hit with the pickaxe.

**Igniter** (Flint and Steel):

- Replaces ignited TNT with a fresh TNT block.
- Can light Creepers.

**Guard Worm** (Shovel):

- Adds matching handfuls or fragments when breaking Dirt, Sand, Red Sand, or
  Gravel.
- Cycles supported soil variants.
- Can uncover buried seeds while sneaking.
- Reduces all incoming damage by 40% while held.

**Reaper** (Hoe):

- Duplicates the harvest from a ripe crop.
- Replants the crop automatically after harvesting it.

**Berserk** (Axe):

- Sneak-break normal or stripped logs to convert them directly into planks.
- Grants extra plank output during the conversion.

### Defense abilities

**Clarity** (Helmet):

- Grants Night Vision below Y48 in the Overworld.

**Retaliation** (Chestplate):

- Can reflect part of received damage back to the attacker.

**Armored** (Chestplate):

- Negates projectile damage completely.
- Reduces damage from block and entity explosions by 50%.

**Bulwark** (Leggings):

- Provides a defensive identity focused on steady protection and survival.
- Works alongside the armor's regular defensive attributes.

**Featherstep** (Boots):

- Reduces fall damage by 80%.
- Grants a short Absorption burst after a qualifying fall.
- Has a one-minute cooldown.

**Boot Dash** (Boots):

- Double-jump within six ticks to apply a forward dash.
- Has a brief cooldown after each dash.

**Wind Launch** (Elytra):

- The Elytra is a refined chest-slot armor item with a fixed `45%` damage
  reduction, plus the regular StatsCore armor progression, evasion, and
  preservation attributes.
- Jump once from the ground, then press Jump again while airborne to fire a
  native Wind Charge upward from below the player and gain a forward/upward
  launch without using a firework rocket. The launch plays a wind sound.
- Has a short cooldown between launches.

**Spikes** (Shield):

- Is disabled for now because Bedrock does not reliably emit `EntityHurt` for
  blocked shield hits.

**Tough** (Turtle Helmet):

- Grants Conduit Power while the wearer is in water.
- Reduces damage from falling blocks, suffocation, lightning, and stalactites.

## Notes

### Element behavior

- **Earth Toughness** is exclusive to support equipment and improves armor
  damage reduction and Preserving.
- **Void** deals override damage, applies Weakness, and creates a 7.5-block
  singularity for creatures matching the struck target. The center is captured
  before damage, so later pull pulses, the purple converging ground ring, and
  the teleport sound continue even if the original target dies.
- **Water** extinguishes targets, deals increased damage to hot creatures, and
  grants Water Breathing after eligible kills.
- **Wind** can transform Blazes into Breezes, is resisted by Blazes, and grants
  progressive Haste while continuously mining.
- **Frost** can transform Skeletons into Strays.

### Refining Table displays

- The primary display is a compact summary: item, grade/quality, relevant
  category levels, shortened inputs, roll interval, operation costs, core,
  primary ability, and active `+` abilities. It intentionally omits technical
  unlock labels and long probability explanations.
- Tier, affinity, individual grade odds, unlock requirements, the NRA chain
  rule, resolved Trouble chances, elemental data, event-driven attributes, and
  every inherited `+` ability remain available in the detailed displays.

- Named abilities complement normal StatsCore attributes; armor can still have
  damage reduction, evasion, and preservation.
- Some abilities require a matching target or event before they can activate.
- Refinement values, ability levels, and material presets can limit the final
  strength of an attribute or ability.

utilitycraft:armor component

Purpose
- Define per-item armor behavior for the ATCore StatsCore armor system.
- The component profile is combined with refined StatsCore attributes in one
  mitigation pass. Reinforcement remains the item's durability reserve and is
  preserved because all three systems use the same ItemStack properties.

Fields (in `customComponentParameters.params`):

- damage_reduction: boolean | number
  - If boolean true uses the default fraction (5%).
  - If number <= 1 treated as fraction (0.075 => 7.5%).
  - If number > 1 treated as percentage and converted (75 => 0.75).

- reduces: "all" | "none" | array<string>
  - Which damage types this piece reduces. Default: `all` when damage_reduction/damage_negation present.
  - Example: `["fire", "explosion"]`

- damage_negation: boolean | number
  - If boolean true uses the default negation chance (2.5%).
  - If number interpreted same as damage_reduction.

- cases: optional object mapping damage type -> overrides
  - Example:
    {
      "fire": { "damage_reduction": 0.5, "damage_negation": 0.1 }
    }

Notes on aggregation (implemented in `BP/scripts/ATCore/StatsCore/support/armor.js`):
- Per-piece reductions are summed and clamped to 90%.
- Per-piece negation chances combine as independent probabilities (combined = 1 - Π(1-p_i)).
- Damage type matching is done by comparing the event damage source cause string (lowercased) with entries in `reduces`.
- Refinement state, levels, attributes, and reinforcement reserves are read from
  item dynamic properties; lore is presentation only.
- Add-ons that cannot attach the component can register the same profile with
  `utilitycraft:register_armor_mitigation` and an item `id`.

Example (aetherium helmet):

"utilitycraft:armor": {
  "customComponentParameters": {
    "params": {
      "damage_reduction": 0.075,
      "damage_negation": 0.025,
      "reduces": "all"
    }
  }
}

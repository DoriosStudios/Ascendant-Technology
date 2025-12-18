## ScriptEvent recipe injection

Every processing machine now listens for `system` script events so you can register, override, or tweak recipes live—no resource pack rebuilds required. Follow the Infuser pattern by sending a JSON object where each key represents the recipe identifier and its value describes the recipe payload. The Infuser keeps its existing `"catalyst|input"` keys; the other machines use simple recipe IDs.

| Machine | ScriptEvent ID | Key format | Notes |
| --- | --- | --- | --- |
| Infuser | `utilitycraft:register_infuser_recipe` | `catalyst|input` | Existing syntax (e.g., `"minecraft:redstone|minecraft:iron_ingot"`). |
| Energizer | `utilitycraft:register_energizer_recipe` | recipe ID string | Payload matches `defineEnergizerRecipe` fields (`input`, `output`, `energyCost`, etc.). |
| Liquifier | `utilitycraft:register_liquifier_recipe` | recipe ID string | Provide `input`, `fluid`, optional `byproduct`, and timing/energy overrides. |
| Residue Processor | `utilitycraft:register_residue_processor_recipe` | recipe ID string | Supply `input`, `output`, and optional `byproduct`. |
| Catalyst Weaver | `utilitycraft:register_catalyst_weaver_recipe` | recipe ID string | Accepts up to six `catalysts`, optional `fluid`, `byproduct`, and `speedModifier`. |
| Cloner | `utilitycraft:register_cloner_recipe` | recipe ID string | Supports `rarity`, `time`, template `input`/`output`, energy cost overrides, and optional `fluid`. |

**Example command (Energizer):**

```
/scriptevent utilitycraft:register_energizer_recipe {"utilitycraft:energized_copper":{"input":{"id":"minecraft:copper_ingot","amount":1},"output":{"id":"utilitycraft:energized_copper","amount":1},"energyCost":72000,"seconds":4}}
```

You can also fire these events from scripts using `system.sendScriptEvent` exactly like the Infuser sample in `BP/scripts/config/recipes/added/insert_infuser.js`.

##### *Man, I need a Wiki for ts.*

---


Use `$dark_mode: true` anywhere you reference `ascendant_common.toggle_button_base` (e.g., in `absolute_container.status_toggle`) to guarantee consistent visuals with dark backdrops without recreating the state machine.

### Color panels (`ascendant_common.panel`)

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `$panel_size` | array `[w, h]` | `["100%", "100%"]` | Final dimensions for the rendered panel surface. |
| `$panel_alpha` | number | `1` | Opacity multiplier (0-1). |
| `$panel_layer` | int | `0` | Layer utility for stacking panels under/over other controls. |
| `$panel_color` | string | `"gray"` | Color preset feeding the proper texture: `gray`, `dark`, `blue`, or `aqua`. |
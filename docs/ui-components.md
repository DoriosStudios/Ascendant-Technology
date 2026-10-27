# Ascendant UI components

`RP/ui/at_core.json` defines reusable behavior. `RP/ui/at_common.json` defines
Ascendant visuals and shared compositions. Each machine owns its layout,
container indices and screen root. Both modules are registered in `_ui_defs.json`.

The extensible [button card](ui-button-card.md) adds native toolbar layout in
Core and appearance controls in `RP/ui/at_button_card.json`, also registered in
`_ui_defs.json`. It is integrated into the Catalyst Weaver.

UtilityCraft's `uc` module remains a dependency of the screens. Its IO, upgrade,
information and recipe helpers can be used directly. Core depends only on native
UI templates; its direct/cached text bindings are defined locally with the same
compatibility behavior. No replacement recipe system is introduced.

| Component | Responsibility | Main parameters |
| --- | --- | --- |
| `at_core.collection_text` | Collection hover text, including lore | Native `collection_index`, `$text_scale`, `$text_alignment`, `$text_color`, `$localize` |
| `at_core.machine_name` | Native chest title | `$offset`, `$color`, `$text_scale`; native positioning |
| `at_core.item` | Native item display, optional read-only hover/focus; stack/durability/storage/selection/lock/bundle visuals | Native `collection_index`, `$panel_size`, `$renderer_size`, `$renderer_offset`, `$has_hover` |
| `at_core.slot` | Native container interaction and focus | `$slot_index`, `$background_ref`, `$outline_texture`, `$outline_size`; native positioning |
| `at_core.resource_display` | Helper item with optional border/background | `$collection_index`, renderer/border/background texture, size and offset parameters |
| `at_core.collection_button` | Collection action with native button focus and accessibility | `$collection_index`, state references, `$button_mapping`, `$label`, `$label_binding` |
| `at_core.toggle` | Native toggle with consistent state defaults | Native toggle parameters and state references |
| `at_core.surface` | Native image | `$texture`; native `size`, `alpha`, `layer`; nine-slice comes from the texture metadata |
| `at_common.slot` | Native interactive slot with optional textured background/hover | Core slot parameters, `$slot_texture`, `$slot_hover_texture` |
| `at_common.toggle_button` | Plus/minus toggle with focus border and dimmed disabled states | Native toggle parameters and state references |
| `at_common.panel` | Background, content and optional close button | `$panel_size`, `$background_ref`, `$panel_texture`, `$content_ref`, `$show_close`, `$close_button_ref` |
| `at_common.info_panel` | Information frame | `$bg_size`, `$info_size`, `$has_text`, `$label_index`, `$text_scale` |
| `at_common.scrollable_info_panel` | Information frame with native scrolling | Information parameters plus `$content_ref` |
| `at_common.scroll_panel` | Small `common.scrolling_panel` wrapper | `$content_ref`; native desktop/touch viewport parameters |
| `at_common.grid_2x2`, `grid_3x3` | Fixed 18-pixel cell layout, including slot zero | `$slot_index_0` onward, `$slot_control` |
| `at_common.tab_button`, `tab_content` | Toggle-backed tab and visible content | `$tab_group`, `$tab_index`, `$selected_tab`; content `$tab_control` |

The common resource displays are `energy_display`, `liquid_display` and
`gas_display`. They share Core behavior and supply their own border geometry.
The resource index defaults to zero; a machine must select its own helper slot.
The default renderer is 48 × 48, with a 16 × 48 border and a 16 × 50 hover area
(`$hover_size`), so adjacent tanks do not share their hover area. `$background_texture`
enables a background directly, without a separate visibility flag.

The common interactive slots are `slot`, `input_slot`, `output_slot` and `upgrade_slot`.
Input defaults to 18 × 18 and output to 26 × 26; native `size` overrides both.
Empty `$slot_texture` preserves the native background. A nonempty texture selects
the shared textured surface instead of `$background_ref`. Likewise a nonempty
`$slot_hover_texture` selects a textured hover surface with the native highlight,
tooltip and bundle behavior; leave it empty to retain `$highlight_control`.
The upgrade slot defaults to the orange background. Both small grids now use
`at_common.slot` by default, so texture parameters also work on their cells.
The enchanting screen keeps its input/output appearances locally; there are no
shared aliases by color. Custom controls can still use the inherited background,
button, overlay and highlight references directly.
`dark_panel` and `blue_panel` are background surfaces selected through
`$background_ref`; their content and close button belong to `panel` or the screen.

```json
"input@at_common.input_slot": {
    "$slot_index": 3,
    "$slot_texture": "textures/ui/cells/blue_cell_image",
    "$slot_hover_texture": "textures/ui/cells/hover_inverted_blue_cell_image"
}
```

Texture names are explicit choices: `inverted` is not automatically interpreted
as selected or checked. The palette has 16 normal, 15 inverted and 15
hover-inverted PNGs. White has metadata but no local PNG; yellow has no inverted
or hover-inverted PNG. These missing variants are not synthesized or referenced
by the library's defaults.

`collection_button` retains its collection index and `button.drop_all` event
default. Its nonempty `$label_binding` (default `#hover_text`) supplies the label.
For a literal/localized `$label`, set `$label_binding` to `""`. It inherits
`common.button` mappings, focus navigation and accessibility; controller activation
uses the native focused mapping. Read-only `item` hover uses a native slot button
with an empty mapping list, so it does not take, place or drop items.

Toggle normal states retain the plus/minus appearance. Enabled hover/focus adds
a white border; locked states dim the background and icon and retain their on/off
identity. The wrapper leaves the native state, enable bindings and input mappings
unchanged.

The shared templates compose their children through `controls`, not inherited
`modifications`. Bedrock rejected the latter on the information panel, toggle
hover states and slot backgrounds. The optional scroll and focus children use
`ignored`; the slot background contains its surface and outline, while the
colored highlight wraps the complete native highlight panel to preserve its
tooltip and bundle bindings. Public component references and parameters stay
the same. Bedrock UI Preview applies inherited modifications itself, so a clean
preview did not catch those content-log errors.

`node tools/test-common-ui-regressions.cjs` uses the installed Dorios Bedrock UI
Preview to check the affected Catalyst Weaver, Absolute Container and Compactor
templates, including text scrolling, hover states, slot indices, native input
mappings and colored slot tooltips. It also checks raw shared controls for
inherited `modifications`, before Preview can process them. This focused check
does not establish in-game acceptance.

The scrollable information frame now sets its native scroll parameters explicitly
and uses the previous UtilityCraft direct/cached labels for its content. The
base frame's content default is the real information text, preventing an empty
content reference from inherited defaults. Catalyst Weaver remains on helper
slot 1; Refining Table statistics remain on slot 11.

The information frame owns its complete child list, including background,
inner screen, text, scroll and optional close. The scrollable variant only enables
`$has_scroll`; it does not redefine `controls`. A partial list in that variant
removed the inherited background in Bedrock, even though Preview merged it.

```json
{
    "namespace": "machine_example",
    "machine_top": {
        "type": "collection_panel",
        "collection_name": "container_items",
        "controls": [
            { "title@at_core.machine_name": { "offset": [10, -2] } },
            { "energy@at_common.energy_display": {
                "$collection_index": 0,
                "offset": [97, 64],
                "$background_texture": "textures/ui/toggle_button/right_bg"
            } },
            { "input@at_common.input_slot": { "$slot_index": 3, "offset": [-28, 29] } },
            { "output@at_common.output_slot": { "$slot_index": 4, "offset": [32, 29] } }
        ]
    }
}
```

The Compactor is the migrated pilot. Its energy/text/progress slots remain
0/1/2, inputs 3–11, upgrades 12–15, outputs 16–24 and IO 25–30. Its native
inventory, cursor, gamepad helpers, lock notifications and root composition remain
in the machine file. Conventional and special screens use the new shared library
alongside their existing UC controls.

The previous `ascendant_common.json` and duplicate `grid_export.json` are removed.
The recipe generators emit the new scroll references and `$content_ref` parameter.
Unused color catalogs, fixed chest presets, giant roots, per-index tab aliases and
custom scrolling machinery are not carried into the new library. Screens can
compose native inventory and container controls locally when they need them.

Run `node tools/test-ui-rebuild.mjs` for syntax, registration, shared references,
inheritance, architecture boundaries, Core independence and the pilot's slot indices.
These checks do not execute Bedrock's UI engine.

In-game acceptance remains pending on mouse/keyboard, controller and touch:

- Compactor: both grids, hover/tooltip, selection, take/place/auto-place, stack
  counts, durability, storage, lock and bundle behavior; live energy and text.
- Enchanting screens: slot appearances and scaling, tab radio selection and
  navigation events; Refining Table: statistics toggle and scrolling text.
- Catalyst Weaver and recipe panels: wrapped text, clipping, scrollbar and
  touch scrolling with short and long localized content.
- Absolute Container: initially visible status panel, both toggle states,
  inventory order, cursor and focus.
- Colored slots: default/colored backgrounds, optional hover texture, native
  selection, tooltip and bundle hover; both grids and individually sized slots.
- Collection button: live text changes, literal/localized label, collection index,
  one action per mouse/controller activation and focus navigation.
- Toggle button: checked/unchecked, hover/focus and disabled visuals; item displays:
  tooltip and focus without take/place/drop interaction.
- Repeat at different GUI scales and aspect ratios. Confirm pack loading in the
  development-pack content log before treating this migration as release-validated.

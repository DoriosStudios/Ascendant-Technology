# Catalyst Weaver resolver and scrolling information

`ascendant_common.scrollable_info_panel` reuses the existing information-panel
background and puts its content inside a clipped viewport with a vertical scrollbar.
The Catalyst Weaver keeps its 104 × 166 frame at the existing position.
Scrolling uses `common.scrolling_panel`, as UtilityCraft's info tab does. Content
uses a vertical stack containing a `container_items` collection panel. Its direct
child `machine_label@uc.text_label` selects `$label_index`; the nested labels do
not declare `collection_index`. Both `_text_label_v1` and `_text_label_v2` retain
UtilityCraft's original bindings. Each wrapper grows with its text content.
Text wraps to the 88-pixel viewport width and grows vertically with the label content.
Desktop and touch use the same viewport dimensions. The outer background remains
at layer 1, the inner surface at 2, and the native scroll control at 6.

The component accepts `$bg_size`, `$label_index` (default 1), `$text_scale`
(default 0.55), and `$info_content`. The default content displays the selected
container item's hover text, including lore. A different `$info_content` can
provide a stack of controls instead; that content must report its full height.
Use it in a container-items collection scope, as with the existing `info_panel`.

Recipe definitions are normalized and indexed once when registered, by base item
and the exact set of catalyst types. Candidate order preserves native recipes before
Infuser imports, and replacements retain their original position. Selection checks
input/catalyst quantities and fluid type, matching the reference matcher from `main`.
Tank volume and output capacity remain live checks in the machine's processing tick.

Each cached machine retains six catalyst-slot snapshots and an aggregated quantity
map. Unchanged materials and fluid type reuse the selected recipe. Quantity changes,
input changes, fluid-type changes, and catalog revisions invalidate selection and
helper text. The cache holds at most 256 machine entries; eviction only causes a
fresh lookup. No combinations accumulate and no global inventory scan is added.

Recipe previews and material hints are built only while the UI is open, from the
base item's candidates. Stable state reuses the resulting sections and strings.
Existing energy/progress displays keep their normal update behavior. The scrolling
control handles its own position without additional scripting.

Run `node tools/test-catalyst-weaver-resolver.mjs` for comparison with the captured
`main` matcher, cache/registration checks, and processing-tick tests with a simulated
Minecraft API. Add `--benchmark` to compare eight resolver instances against the
catalog implementation in `HEAD`. The benchmark excludes native Bedrock API cost,
rendering, actual crafting, other machines, and world load. It does not establish
in-game frame time or confirm mouse/touch/controller behavior of the scrollbar.

# Network Center

`utilitycraft:network_center` inspects the loaded, wired energy component from a
single dashboard. It is a passive monitor: it neither stores nor consumes energy.
The existing ID, recipe and six-slot helper entity are preserved. UtilityCraft and
shared Core files are not modified.

## Dashboard

Four radio tabs share one main panel. Overview is selected on opening. Each page
has its own full-width scroll area. Its short category title and Next page button
share a horizontal stack on the main title row, with widths measured from localized
text. The stack uses `100%c` and the Next page collection wraps the vanilla
`common_buttons.light_text_form_fitting_button`; width propagates from its label
through its parent controls without a hidden measurement label or sibling-size
feedback. The main title, category and button caption share the center of a
12-pixel title row using natural text height. The footer uses a separate 10-pixel
row with vertically centered lore and a 1-pixel gap after the data panel.
No `enable_text_wrap` property is used. A persistent footer shows scan state/progress, sample age and unavailable
positions; it contains no local-energy readout. The
panel is at most 250 x 166 UI pixels, matching the normal inventory height and
shrinking on shorter viewports. The shared recipe-style button card sits above
its top-right edge, with four light-blue icon toggles and the close button.
The card retains its shared 27-pixel height, positioned with a local vertical
offset of 4 so its buttons meet the panel edge. Compact 12x12 symbols are centered inside 16x16
transparent icon canvases and use the machine palette; authored plans live in
tools/art/network-center. A concrete local lore template omits vertical spacers and runtime `modifications`,
which Bedrock rejects on inherited scrolling content. Moving navigation to the
main title row leaves the body free for data. Introductory sentences and per-page
explanatory notes are omitted; the compact footer retains operational status.

| Tab | Contents |
| --- | --- |
| Overview | Endpoint totals by role, cable count, signed storage balance, total stored/fill, and every connected device type with its observed activity. |
| Gains | Generator count, configured total base generation, base generation of known active units, positive net storage change, sample interval and generator details. |
| Losses | Consumer count, negative net storage change, consumer activity/buffers, and outbound wireless distributor limits/details. Zero-cost machines are excluded from consumers. |
| Capacity | Total stored/capacity/free/fill, separate battery/machine/generator/distributor totals, empty/full buffer counts, configured battery transfer and every device type's storage. |

Power Beacons are distributors, not producers. Batteries are storage, not
producers or consumers. A missing activity state is unknown, not inactive. Active
generator base rates use sampled `utilitycraft:on` and do not claim actual output
or account for upgrades, fuel, weather or blocked outputs. Machine processing
rates are not presented as measured consumption.

Slots: 0=overview, 1=gains, 2=losses, 3=capacity, 4=persistent status, 5=reserved
(legacy energy display). The helper keeps its six-slot inventory; no resize occurs.
Before both open and closed updates, legacy helpers have their energy and capacity
set to zero and switch to the existing container family, excluding energy transfers.
Only the known energy-bar item in slot 5 is cleared; an unexpected real item is
preserved. Empty slot 5 receives the normal blocked-slot placeholder. A fresh
open initializes all four pages to waiting until a scan completes, clearing old category contents.

Long payloads remain localized RawMessage lore on blank-name UI filler items.
Literal strings are split without breaking surrogate pairs or format introducers,
then packed at complete newline boundaries into multiple lore entries. Each full
serialized entry is at most 900 UTF-8 bytes (below the API's 1,000-character bound).
A payload page contains at most 99 entries plus one page indicator, respecting
the API's 100-entry maximum. Fragmenting only the rawtext array is insufficient:
setLore validates the complete serialized entry.

The Next page button cycles that category's payload pages; it reuses the existing
category slot through ButtonManager, with a deferred lore restore after the
shared filler restore. The regular renderer leaves pending clicks untouched.
The four category page indices are independent and are clamped on a rescan.
Pagination does not change IDs or inventory size; monitoring and pagination are
free. Large lists are paginated rather than truncated. EN/PT strings are provided for all new data. The other bundled locales retain the
existing English fallback for details and have localized tab names.

## Collection and measurement

Collection is read-only and follows six-direction cable links, respecting disabled
faces at both ends. Machines are endpoints, not bridges. Link Nodes resolve to
their owner and deduplicate by entity ID, including aliases back to the Center
itself. The Center is excluded from statistics. Wireless destinations are outside
this wired view. Unloaded blocks are never forced to load.

At most 64 queued positions are processed per update. Indexed queues/visited sets
bound work per update rather than network size; traversal buffers are released
on completion. Closed UIs do not scan. Collection is independent of local energy;
a replacement starts 100 ticks after completion. Previous completed results stay
visible during rescans. Rendering refreshes at most once per 20 ticks and writes only changed
category payloads. Closing/removal/breaking clears cached state.

Net energy change is `(totalStored - previousStored) / elapsedTicks`. Gains are
the positive part and losses the negative part of this same balance. Internal
transfers cancel out across all roles. They are not separate gross production
and consumption measurements. Scans span time, so all balances are approximate.

Comparisons require two consecutive complete scans with the same entity-ID set
and increasing ticks. Traversal order does not matter. Membership changes or
unavailable positions suppress the comparison; the UI shows a dash and waits for
a new comparable pair. A stable buffer may still have heavy simultaneous
production and consumption. Capacity numbers represent the sampled buffers, not
configured base capacities. Distributor and battery transfer rates are nominal
limits, not measured flow.

## Validation

- `node tools/test-network-center.mjs`: traversal budget, 1,200 types, no cutoff,
  cable faces/cycles, endpoint isolation, linked-owner deduplication, all four
  category totals, activity/zero-cost consumers, gains/losses/internal transfers,
  changing/partial networks, actual endpoint reader/presenter/runtime, UI-slot
  mapping, passive scans/rescans, legacy energy removal, new zero-capacity placement,
  closed-screen suspension, 1,550-character
  strings, serialized lore bounds, full 1,200-type presentation across pages and
  button restore/pending-click ordering.
- `node tools/test-ui-rebuild.mjs`: existing UI syntax/reference/registration gate.
- `node tools/preview-network-center.cjs`: all four selected pages at 480x270 and
  360x240, top and bottom of each scroll (16 views), using actual presentation
  logic and a simulated 98-device network with 80 machine types.

Previews are written under `.tmp/network-center-preview/`. They use the installed
Bedrock UI Preview and `../Vanilla/resource_pack` (override with `--vanilla=PATH`).
The font is provisional with matching six-pixel measurement/painting. A preview
adapter hides locked-hover toggle faces that the preview engine does not filter;
fixture controls are neither locked nor hovered. This adapter changes no pack UI.
Native factories, gamepad behavior and Bedrock rendering remain runtime limits.

In-game acceptance: old/new Centers, all four tabs and their default/exclusive
selection, mouse/controller/touch, GUI scales, long localized lists, independent
scroll positions, two viewers, battery/generator/Beacon classification, cable
face changes, partial chunks, topology changes, and close/reopen during a scan.
No mocked test or preview proves native behavior.

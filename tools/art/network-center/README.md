# Network Center tab icons

Four authored 12x12 symbols centered in 16x16 transparent canvases share the
outline and blue ramp sampled from
`RP/textures/blocks/machines/network_center_off_north.png`: monitor/overview,
upward flow/gains, downward flow/losses, and segmented battery/capacity.

Palette: outline #241E1F, screen #1C2E2E, shadow #7575C8, body #889BD9,
light #A4B8F9, glint #E1ECFF. All colors come from the machine reference.

The existing `button_light_blue` family (#8892C9 fill) is the closest existing
blue button variant to the machine body. Shared button PNGs are unchanged.

Each JSON is an intent-first native-coordinate design for the Dorios Pixel Art
CLI: `python <skill>/scripts/pixel_art.py generate --design <name>.json --output <name>.png`.

Visual inspection: checked native, nearest-neighbor enlargement, and actual blue
button backgrounds. Functions read as monitor, up arrow, down arrow and battery.
All icons have binary alpha, a two-pixel transparent margin, and no smoothing.
Technical review reports no errors. The arrows have isolated-color warnings on
intentional diagonal staircase edges; the inspected shapes are connected and
coherent, so those pixels are retained. Human artistic approval is not recorded.

Final PNG SHA-256:

- `overview.png`: `d9d1754bd19cf0693461969c47caa66a2cfc078dbe707a1b9bbc24b8a6a78864`
- `gains.png`: `1f06cbc1d7f564e39986586e2996092e033941ecc71ec63cab9721aa68ef5256`
- `losses.png`: `15be01c9f30ef65fba724a4916b91fc9b28208f981ad63ae60d254f07b544154`
- `capacity.png`: `9c7e11ce2a98ac2a9d10fa9dfe405df9146089a7770d8aebd76737dea4789f0e`

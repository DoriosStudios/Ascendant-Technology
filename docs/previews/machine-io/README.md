# Machine I/O face previews

`faces.png` shows Refining Table (first row) and Enchantment Station (second row).
Columns: north/front, south/back, west/left, east/right, up/top, down/bottom.

The twelve transparent 80x80 PNGs under `RP/textures/ui/io_faces/` are rendered
from the original geometries and atlases at 1024x1024, centered by alpha bounds,
then reduced with exact nearest neighbour. No bones are hidden. Orthographic
views use automatic framing and a 0.025 margin. Unlit RGBA materials preserve
the texture colors; Cycles CPU avoids the OpenGL dependency of Eevee.

Regenerate with the installed Dorios render skill and Blender 3.6+ (generated
assets here used Blender 4.5.9 LTS):

```powershell
python tools/render-machine-io-faces.py --blender .tmp/render-tools/blender-4.5.9-windows-x64/blender.exe --jobs 2
```

The project renderer adapts an isolated temporary copy of the skill worker;
the installed skill, original geometry and atlas textures are never overwritten.
Seismic Breaker and Pattern Placer use byte-for-byte copies of their original
square face textures in dedicated UI paths rather than 3D renders.

The contact sheet is a viewing aid with a checkerboard background. Resource-pack
images retain transparency. A fresh Bedrock UI load is required to check the
final 16x16 button appearance, face orientation and input interactions.

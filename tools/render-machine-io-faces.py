"""Render orthographic I/O previews from the original Bedrock models/atlases.

Requires Blender and the installed dorios-render-skill. Uses an isolated copy of
its worker with Cycles CPU + unlit RGBA materials (no GPU/OpenGL requirement).
The skill's 1024 -> 80 nearest-neighbour and alpha centering stay unchanged.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
VIEWS = {"north": ["front"], "south": ["back"], "west": ["left"],
         "east": ["right"], "up": ["top"],
         "down": ["custom", "--azimuth", "90", "--elevation", "-90"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", required=True)
    parser.add_argument("--skill", type=Path, default=Path.home() / ".codex/skills/dorios-render-skill")
    parser.add_argument("--jobs", type=int, default=2)
    args = parser.parse_args()
    blender = str(Path(args.blender).resolve())
    if not Path(blender).is_file():
        raise SystemExit(f"Blender not found: {blender}")
    with tempfile.TemporaryDirectory(prefix="at-io-render-") as temp:
        scripts = Path(temp)
        for source in (args.skill / "scripts").glob("*.py"):
            shutil.copy2(source, scripts / source.name)
        worker = scripts / "blender_render.py"
        source = worker.read_text(encoding="utf-8")
        for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            source = source.replace(f'scene.render.engine = "{engine}"', 'scene.render.engine = "CYCLES"')
        source = source.replace('    scene.render.resolution_x, scene.render.resolution_y',
                                '    scene.cycles.device = "CPU"\n    scene.cycles.samples = 4\n    scene.render.resolution_x, scene.render.resolution_y')
        source = source.replace('        self.materials[image_path] = material', '''        if image_path:
            emission = nodes.new("ShaderNodeEmission")
            emission.inputs["Strength"].default_value = 1.0
            links.new(texture.outputs["Color"], emission.inputs["Color"])
            transparent = nodes.new("ShaderNodeBsdfTransparent")
            mix = nodes.new("ShaderNodeMixShader")
            links.new(texture.outputs["Alpha"], mix.inputs[0])
            links.new(transparent.outputs[0], mix.inputs[1])
            links.new(emission.outputs[0], mix.inputs[2])
            links.new(mix.outputs[0], output.inputs["Surface"])
        self.materials[image_path] = material''')
        source = source.replace('    scene.view_settings.exposure = 0.20 if uses_original_directional_light(args.lighting) else 0.42',
                                '    scene.view_settings.view_transform = "Standard"\n    scene.view_settings.look = "None"\n    scene.view_settings.exposure = 0.0\n    scene.view_settings.gamma = 1.0')
        worker.write_text(source, encoding="utf-8")

        def render(task):
            machine, face = task
            output = ROOT / f"RP/textures/ui/io_faces/{machine}/{face}.png"
            command = [sys.executable, str(scripts / "render_model.py"),
                       "--model", str(ROOT / f"RP/models/blocks/{machine}.geo.json"),
                       "--textures", str(ROOT / f"RP/textures/blocks/machines/{machine}.png"),
                       "--output", str(output), "--view", *VIEWS[face],
                       "--lighting", "flat", "--no-shadows", "--ground", "off", "--blender", blender]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            print(f"Rendered {machine}/{face}.png", flush=True)

        tasks = [(machine, face) for machine in ("refining_table", "enchantment_station") for face in VIEWS]
        with ThreadPoolExecutor(max_workers=max(1, min(4, args.jobs))) as pool:
            list(pool.map(render, tasks))


if __name__ == "__main__":
    main()

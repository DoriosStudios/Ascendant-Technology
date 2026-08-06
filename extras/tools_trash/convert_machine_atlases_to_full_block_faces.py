import argparse
from pathlib import Path
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MACHINES_ROOT = ROOT / "RP" / "textures" / "blocks" / "machines"
SUPERIOR_ROOT = MACHINES_ROOT / "superior"
TERRAIN_TEXTURE_PATH = ROOT / "RP" / "textures" / "terrain_texture.json"
BLOCKS_ROOT = ROOT / "BP" / "blocks"

FACE_BOXES = {
    "west": (0, 16, 16, 32),
    "north": (16, 16, 32, 32),
    "east": (32, 16, 48, 32),
    "south": (48, 16, 64, 32),
    "up": (16, 0, 32, 16),
    "down": (32, 0, 48, 16),
}

HORIZONTALLY_MIRRORED_FACES = {"east", "west"}

CONVERSIONS = (
    {
        "label": "cryo_chamber_off",
        "source": MACHINES_ROOT / "cryo_chamber_off.png",
        "legacy": MACHINES_ROOT / "legacy_atlases" / "cryo_chamber_off.png",
        "faces_dir": MACHINES_ROOT / "faces" / "cryo_chamber" / "off",
    },
    {
        "label": "cryo_chamber_on",
        "source": MACHINES_ROOT / "cryo_chamber_on.png",
        "legacy": MACHINES_ROOT / "legacy_atlases" / "cryo_chamber_on.png",
        "faces_dir": MACHINES_ROOT / "faces" / "cryo_chamber" / "on",
    },
    {
        "label": "residue_processor_off",
        "source": MACHINES_ROOT / "residue_processor_off.png",
        "legacy": MACHINES_ROOT / "legacy_atlases" / "residue_processor_off.png",
        "faces_dir": MACHINES_ROOT / "faces" / "residue_processor" / "off",
    },
    {
        "label": "residue_processor_on",
        "source": MACHINES_ROOT / "residue_processor_on.png",
        "legacy": MACHINES_ROOT / "legacy_atlases" / "residue_processor_on.png",
        "faces_dir": MACHINES_ROOT / "faces" / "residue_processor" / "on",
    },
    {
        "label": "seismic_breaker_off",
        "source": SUPERIOR_ROOT / "seismic_breaker.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "seismic_breaker.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "seismic_breaker" / "off",
        "mirror_horizontal": True,
    },
    {
        "label": "seismic_breaker_on",
        "source": SUPERIOR_ROOT / "seismic_breaker_on.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "seismic_breaker_on.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "seismic_breaker" / "on",
        "mirror_horizontal": True,
    },
    {
        "label": "disenchanter_off",
        "source": SUPERIOR_ROOT / "disenchanter_off.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "disenchanter_off.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "disenchanter" / "off",
    },
    {
        "label": "disenchanter_on",
        "source": SUPERIOR_ROOT / "disenchanter_on.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "disenchanter_on.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "disenchanter" / "on",
    },
    {
        "label": "cryofluid_synthesizer_off",
        "source": SUPERIOR_ROOT / "cryofluid_synthesizer_off.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "cryofluid_synthesizer_off.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "cryofluid_synthesizer" / "off",
    },
    {
        "label": "cryofluid_synthesizer_on",
        "source": SUPERIOR_ROOT / "cryofluid_synthesizer_on.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "cryofluid_synthesizer_on.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "cryofluid_synthesizer" / "on",
    },
)

# Some atlases are still useful as source material for custom geometries, so do
# not archive them.  Export only the missing face that a full block consumes.
FACE_EXPORTS = (
    {
        "source": SUPERIOR_ROOT / "superior_machine_case.png",
        "face": "north",
        "output": SUPERIOR_ROOT / "superior_machine_case_north.png",
    },
)


def archive_source_atlas(source_path: Path, legacy_path: Path) -> Path:
    legacy_path.parent.mkdir(parents=True, exist_ok=True)

    if source_path.exists() and not legacy_path.exists():
        source_path.replace(legacy_path)

    if legacy_path.exists():
        return legacy_path

    if source_path.exists():
        return source_path

    raise FileNotFoundError(f"Missing source atlas: {source_path}")



def export_faces(atlas_path: Path, faces_dir: Path, mirror_horizontal: bool = False) -> None:
    faces_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(atlas_path).convert("RGBA") as atlas:
        for face_name, box in FACE_BOXES.items():
            output_path = faces_dir / f"{face_name}.png"
            face = atlas.crop(box)
            if mirror_horizontal and face_name in HORIZONTALLY_MIRRORED_FACES:
                face = face.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            face.save(output_path)


def export_face(atlas_path: Path, face_name: str, output_path: Path) -> None:
    """Export one named vanilla face without modifying its source atlas."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(atlas_path).convert("RGBA") as atlas:
        if atlas.size != (64, 64):
            raise ValueError(f"Expected a 64x64 atlas, got {atlas.size}: {atlas_path}")
        atlas.crop(FACE_BOXES[face_name]).save(output_path)


def find_full_block_atlas_references() -> list[tuple[Path, str, Path]]:
    """Find 64x64 terrain textures still assigned to a vanilla full block.

    Blocks with custom geometry are intentionally excluded: their atlas layout is
    defined by their geometry UVs and must not be replaced with cube faces.
    """
    terrain_text = TERRAIN_TEXTURE_PATH.read_text(encoding="utf-8")
    texture_paths = dict(
        re.findall(
            r'"([^\"]+)"\s*:\s*\{\s*"textures"\s*:\s*"([^\"]+)"',
            terrain_text,
        )
    )
    offenders: list[tuple[Path, str, Path]] = []

    for block_path in BLOCKS_ROOT.rglob("*.json"):
        block_text = block_path.read_text(encoding="utf-8")
        if '"minecraft:geometry": "minecraft:geometry.full_block"' not in block_text:
            continue

        for texture_key in set(re.findall(r'"texture"\s*:\s*"([^\"]+)"', block_text)):
            texture_path = texture_paths.get(texture_key)
            if not texture_path:
                continue

            image_path = ROOT / "RP" / f"{texture_path}.png"
            if not image_path.exists():
                continue

            with Image.open(image_path) as image:
                if image.size == (64, 64):
                    offenders.append((block_path, texture_key, image_path))

    return offenders


def verify_full_block_faces() -> None:
    """Ensure all vanilla full blocks now use individual face textures."""
    offenders = find_full_block_atlas_references()
    if offenders:
        details = "\n".join(
            f"- {block.relative_to(ROOT)}: {texture_key} -> {texture.relative_to(ROOT)}"
            for block, texture_key, texture in offenders
        )
        raise RuntimeError(
            "64x64 atlases are still assigned to full blocks. Convert their faces "
            f"and update the material instances first:\n{details}"
        )

    print("Verified: all full blocks use face textures; custom geometries were skipped.")



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert 64x64 box-UV machine atlases into six 16x16 block faces."
    )
    parser.add_argument(
        "--only",
        action="append",
        choices=[conversion["label"] for conversion in CONVERSIONS],
        help="Convert only the selected label; repeat for multiple states.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selected = set(args.only or ())

    for conversion in CONVERSIONS:
        if selected and conversion["label"] not in selected:
            continue
        atlas_path = archive_source_atlas(conversion["source"], conversion["legacy"])
        export_faces(
            atlas_path,
            conversion["faces_dir"],
            conversion.get("mirror_horizontal", False),
        )
        print(f"Converted {conversion['label']} -> {conversion['faces_dir']}")

    if not selected:
        for export in FACE_EXPORTS:
            export_face(export["source"], export["face"], export["output"])
            print(f"Exported {export['face']} face -> {export['output']}")

    verify_full_block_faces()


if __name__ == "__main__":
    main()

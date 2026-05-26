from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MACHINES_ROOT = ROOT / "RP" / "textures" / "blocks" / "machines"
SUPERIOR_ROOT = MACHINES_ROOT / "superior"

FACE_BOXES = {
    "west": (0, 16, 16, 32),
    "north": (16, 16, 32, 32),
    "east": (32, 16, 48, 32),
    "south": (48, 16, 64, 32),
    "up": (16, 0, 32, 16),
    "down": (32, 0, 48, 16),
}

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
    },
    {
        "label": "seismic_breaker_on",
        "source": SUPERIOR_ROOT / "seismic_breaker_on.png",
        "legacy": SUPERIOR_ROOT / "legacy_atlases" / "seismic_breaker_on.png",
        "faces_dir": SUPERIOR_ROOT / "faces" / "seismic_breaker" / "on",
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



def export_faces(atlas_path: Path, faces_dir: Path) -> None:
    faces_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(atlas_path).convert("RGBA") as atlas:
        for face_name, box in FACE_BOXES.items():
            output_path = faces_dir / f"{face_name}.png"
            atlas.crop(box).save(output_path)



def main() -> None:
    for conversion in CONVERSIONS:
        atlas_path = archive_source_atlas(conversion["source"], conversion["legacy"])
        export_faces(atlas_path, conversion["faces_dir"])
        print(f"Converted {conversion['label']} -> {conversion['faces_dir']}")


if __name__ == "__main__":
    main()

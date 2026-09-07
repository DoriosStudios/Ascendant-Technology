"""Build directional Compactor textures from the original 64x64 box-UV atlas.

The Ascendant Technology copy already contains the authored inactive atlas.  An
active atlas can be supplied once from the UtilityCraft source: this script
transfers only the source off->on colour delta so local artwork/orientation is
preserved, then exports six 16x16 faces for each state.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MACHINES_ROOT = ROOT / "RP" / "textures" / "blocks" / "machines"
LEGACY_ROOT = MACHINES_ROOT / "legacy_atlases"

FACE_BOXES = {
    "west": (0, 16, 16, 32),
    "north": (16, 16, 32, 32),
    "east": (32, 16, 48, 32),
    "south": (48, 16, 64, 32),
    "up": (16, 0, 32, 16),
    "down": (32, 0, 48, 16),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Split the Compactor box-UV atlases into full-block faces."
    )
    parser.add_argument(
        "--reference-off",
        type=Path,
        help="Original inactive UtilityCraft atlas used to derive the active state.",
    )
    parser.add_argument(
        "--reference-on",
        type=Path,
        help="Original active UtilityCraft atlas used to derive the active state.",
    )
    return parser.parse_args()


def open_atlas(path: Path) -> Image.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Missing Compactor atlas: {path}")
    atlas = Image.open(path).convert("RGBA")
    if atlas.size != (64, 64):
        raise ValueError(f"Expected a 64x64 atlas, got {atlas.size}: {path}")
    return atlas


def clamp_channel(value: int) -> int:
    return max(0, min(255, value))


def build_active_atlas(
    local_off_path: Path,
    reference_off_path: Path,
    reference_on_path: Path,
    output_path: Path,
) -> None:
    with (
        open_atlas(local_off_path) as local_off,
        open_atlas(reference_off_path) as reference_off,
        open_atlas(reference_on_path) as reference_on,
    ):
        local_pixels = list(local_off.get_flattened_data())
        reference_off_pixels = list(reference_off.get_flattened_data())
        reference_on_pixels = list(reference_on.get_flattened_data())
        active_pixels: list[tuple[int, int, int, int]] = []

        for local, inactive, active in zip(
            local_pixels, reference_off_pixels, reference_on_pixels
        ):
            active_pixels.append(
                (
                    clamp_channel(local[0] + active[0] - inactive[0]),
                    clamp_channel(local[1] + active[1] - inactive[1]),
                    clamp_channel(local[2] + active[2] - inactive[2]),
                    local[3],
                )
            )

        generated = Image.new("RGBA", local_off.size)
        generated.putdata(active_pixels)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        generated.save(output_path)


def export_faces(atlas_path: Path, state: str) -> None:
    output_dir = MACHINES_ROOT / "faces" / "compactor" / state
    output_dir.mkdir(parents=True, exist_ok=True)
    with open_atlas(atlas_path) as atlas:
        for face_name, box in FACE_BOXES.items():
            atlas.crop(box).save(output_dir / f"{face_name}.png")
    print(f"Exported Compactor {state}: {output_dir.relative_to(ROOT)}")


def main() -> None:
    args = parse_args()
    off_atlas = LEGACY_ROOT / "compactor_off.png"
    on_atlas = LEGACY_ROOT / "compactor_on.png"

    references = (args.reference_off, args.reference_on)
    if any(references) and not all(references):
        raise ValueError("Use --reference-off and --reference-on together.")
    if all(references):
        build_active_atlas(off_atlas, args.reference_off, args.reference_on, on_atlas)
        print(f"Generated active atlas: {on_atlas.relative_to(ROOT)}")

    export_faces(off_atlas, "off")
    export_faces(on_atlas, "on")


if __name__ == "__main__":
    main()

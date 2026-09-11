from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]

TEXTURES_ROOT = ROOT / "RP" / "textures" / "blocks"
MACHINES_ROOT = TEXTURES_ROOT / "machines"
GENERATORS_ROOT = TEXTURES_ROOT / "generators"
LEGACY_ROOT = MACHINES_ROOT / "legacy_atlases"


# ---------------------------------------------------------------------------
# Machine library
# ---------------------------------------------------------------------------

MACHINES = {
    "decompactor": ("off", "on"),
    "industrial_crucible": ("off", "on"),
}

# Only full-block generators use the Box-UV face layout below. Solar Panels
# and Wind Turbines keep their custom geometry and atlas textures intact.
GENERATORS = {
    "absolute_furnator": ("off", "on"),
    "absolute_magmator": ("off", "on"),
    "absolute_thermo_generator": ("off", "on"),
}


# ---------------------------------------------------------------------------
# Box-UV layout
# ---------------------------------------------------------------------------

ATLAS_SIZE = (64, 64)

FACE_BOXES = {
    "west": (0, 16, 16, 32),
    "north": (16, 16, 32, 32),
    "east": (32, 16, 48, 32),
    "south": (48, 16, 64, 32),
    "up": (16, 0, 32, 16),
    "down": (32, 0, 48, 16),
}


def open_atlas(path: Path) -> Image.Image:
    """Open and validate a 64x64 Box-UV atlas."""

    if not path.is_file():
        raise FileNotFoundError(f"Missing Box-UV atlas: {path}")

    atlas = Image.open(path).convert("RGBA")

    if atlas.size != ATLAS_SIZE:
        raise ValueError(
            f"Expected a {ATLAS_SIZE[0]}x{ATLAS_SIZE[1]} atlas, "
            f"got {atlas.size}: {path}"
        )

    return atlas


def export_faces(
    atlas_path: Path,
    output_root: Path,
    texture_name: str,
    state: str,
) -> None:
    """
    Split one machine atlas into six directional 16x16 textures.

    Output:
        {texture_name}_{state}_{side}.png
    """

    output_root.mkdir(parents=True, exist_ok=True)
    with open_atlas(atlas_path) as atlas:
        for side, box in FACE_BOXES.items():
            output_name = f"{texture_name}_{state}_{side}.png"
            output_path = output_root / output_name

            atlas.crop(box).save(output_path)

    print(f"Exported: {texture_name} [{state}]")


def main() -> None:
    libraries = (
        (MACHINES, LEGACY_ROOT, MACHINES_ROOT),
        (GENERATORS, GENERATORS_ROOT, GENERATORS_ROOT),
    )

    for library, atlas_root, output_root in libraries:
        for texture_name, states in library.items():
            for state in states:
                atlas_name = f"{texture_name}_{state}.png"
                atlas_path = atlas_root / atlas_name

                if not atlas_path.is_file():
                    print(
                        f"Skipping missing atlas: "
                        f"{atlas_path.relative_to(ROOT)}"
                    )
                    continue

                export_faces(
                    atlas_path=atlas_path,
                    output_root=output_root,
                    texture_name=texture_name,
                    state=state,
                )


if __name__ == "__main__":
    main()

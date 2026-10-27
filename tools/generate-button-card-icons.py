"""Create 12px pixel motifs and padded 16px button-card sprites."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "RP/textures/ui/at_icons"
OUTPUT = ROOT / "RP/textures/ui/button_card/icons"
OUTPUT.mkdir(parents=True, exist_ok=True)

def write(name, icon):
    assert icon.size == (12, 12)
    target = OUTPUT / (name + ".png")
    if target.exists():
        with Image.open(target) as existing:
            assert existing.convert("RGBA").tobytes() == icon.tobytes(), target
        return
    icon.save(target, optimize=True)

def from_at(source, name, limit=10):
    original = Image.open(SOURCE / (source + ".png")).convert("RGBA")
    bounds = original.getchannel("A").getbbox()
    assert bounds, source
    image = original.crop(bounds)
    width, height = image.size
    factor = min(limit / width, limit / height)
    scaled = image.resize((max(1, round(width * factor)), max(1, round(height * factor))), Image.Resampling.NEAREST)
    icon = Image.new("RGBA", (12, 12))
    icon.alpha_composite(scaled, ((12 - scaled.width) // 2, (12 - scaled.height) // 2))
    write(name, icon)

for source, name in {
    "crafting_table": "catalyst",
    "nether_star": "enchant",
    "xp": "disenchant",
    "furnace": "refine",
    "pressure_meter": "stats",
    "potion": "brew",
    "hourglass": "progression",
    "ice_cube": "freeze",
    "cryofluid_icon": "cryofluid",
    "titanium_stabilized": "stabilize",
}.items():
    from_at(source, name)

# Open recipe book: a cream page spread, dark stitched edges and green marker.
book = Image.new("RGBA", (12, 12))
d = ImageDraw.Draw(book)
d.rectangle((1, 2, 10, 9), fill="#2a1a10")
d.rectangle((2, 3, 5, 8), fill="#c79d66")
d.rectangle((6, 3, 9, 8), fill="#e8c899")
d.line((5, 3, 5, 9), fill="#724329")
d.line((3, 5, 4, 5), fill="#f2dfae")
d.line((7, 5, 8, 5), fill="#fff0bd")
d.rectangle((8, 1, 9, 4), fill="#3b9f56")
d.point((8, 1), fill="#91cf75")
d.line((2, 10, 9, 10), fill="#75482a")
write("recipe_book", book)

# Potion with redstone and glowstone sparks for the amplifier/extension page.
potion = Image.open(SOURCE / "potion.png").convert("RGBA")
bounds = potion.getchannel("A").getbbox()
potion = potion.crop(bounds).resize((7, 9), Image.Resampling.NEAREST)
modify = Image.new("RGBA", (12, 12))
modify.alpha_composite(potion, (2, 2))
d = ImageDraw.Draw(modify)
d.point((9, 2), fill="#fff1a8")
d.point((10, 3), fill="#d8a33c")
d.point((9, 5), fill="#b71f18")
d.point((10, 6), fill="#e45d2b")
d.point((1, 9), fill="#f3b658")
write("modify_potion", modify)

# Compact vanilla-style information glyph without a second button frame.
info = Image.new("RGBA", (12, 12))
d = ImageDraw.Draw(info)
d.rectangle((2, 1, 9, 10), fill="#252421")
d.rectangle((3, 2, 8, 9), fill="#8b8b85")
d.point((5, 3), fill="#ffffff")
d.rectangle((5, 5, 6, 8), fill="#f5f5eb")
d.point((4, 8), fill="#f5f5eb")
write("info", info)

# Bedrock draws a 16x16 icon; only its centered 12x12 area contains art.
for motif in OUTPUT.glob("*.png"):
    if motif.stem.endswith("_16"):
        continue
    with Image.open(motif) as source:
        source = source.convert("RGBA")
        assert source.size == (12, 12), motif
        canvas = Image.new("RGBA", (16, 16))
        canvas.alpha_composite(source, (2, 2))
    target = OUTPUT / (motif.stem + "_16.png")
    if target.exists():
        with Image.open(target) as existing:
            assert existing.convert("RGBA").tobytes() == canvas.tobytes(), target
        continue
    canvas.save(target, optimize=True)

print("Prepared", len(list(OUTPUT.glob("*_16.png"))), "16x16 icons with 12x12 centered art")


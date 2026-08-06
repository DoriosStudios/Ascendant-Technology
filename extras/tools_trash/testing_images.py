from pathlib import Path
from PIL import Image

base_dir = Path(__file__).resolve().parent
input_dir = base_dir / "entrada"
output_dir = base_dir / "saida"

expected_size = (16, 16)
levels = 4

# controla o tamanho/alcance da vinheta em cada nível
# quanto menor o valor, maior a área limpa central
thresholds = {
    1: 0.5,
    2: 0.6,
    3: 0.7,
    4: 0.84,
}

# controla a força base de cada faixa da vinheta
# 1 = faixa mais externa
# 4 = faixa mais interna
band_strength = {
    1: 0.6,
    2: 0.42,
    3: 0.22,
    4: 0.1,
}

# controla o quanto cada nível escurece, sem mudar a área
# 1 = mais leve
# 4 = mais escuro
level_darkness = {
    1: 0.25,
    2: 0.55,
    3: 1.10,
    4: 1.25,
}

# opcional: gera preview ampliado para analisar melhor
make_preview = True
preview_scale = 32


def clamp(value):
    return max(0, min(255, int(round(value))))


def darken_pixel(r, g, b, a, amount):
    factor = 1.0 - amount
    return (
        clamp(r * factor),
        clamp(g * factor),
        clamp(b * factor),
        a
    )


def vignette_band(x, y, w, h):
    cx = (w - 1) / 2.0
    cy = (h - 1) / 2.0

    nx = abs(x - cx) / cx if cx else 0.0
    ny = abs(y - cy) / cy if cy else 0.0

    # superellipse arredondada para evitar vinheta em losango
    power = 4.0
    m = (nx ** power + ny ** power) ** (1.0 / power)

    if m < thresholds[1]:
        return 0
    elif m < thresholds[2]:
        return 4
    elif m < thresholds[3]:
        return 3
    elif m < thresholds[4]:
        return 2
    else:
        return 1


def apply_level(image, level):
    img = image.convert("RGBA")
    w, h = img.size

    if (w, h) != expected_size:
        raise ValueError(f"imagem fora do padrão: {w}x{h} (esperado: 16x16)")

    out = Image.new("RGBA", (w, h))
    src = img.load()
    dst = out.load()

    level_factor = level_darkness[level]

    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            band = vignette_band(x, y, w, h)

            if band != 0 and band <= level:
                amount = band_strength[band] * level_factor
                amount = min(amount, 0.95)
                dst[x, y] = darken_pixel(r, g, b, a, amount)
            else:
                dst[x, y] = (r, g, b, a)

    return out


def save_output(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main():
    if not input_dir.exists():
        raise FileNotFoundError(f"pasta de entrada não encontrada: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    image_files = sorted(
        p for p in input_dir.iterdir()
        if p.suffix.lower() in {".png", ".bmp", ".jpg", ".jpeg"}
    )

    if not image_files:
        print("nenhuma imagem encontrada na pasta de entrada.")
        return

    for img_path in image_files:
        with Image.open(img_path) as img:
            stem = img_path.stem

            for level in range(1, levels + 1):
                out_img = apply_level(img, level)

                level_dir = output_dir / f"nivel_{level}"

                if level == 1:
                    out_path = level_dir / f"compressed_{stem}.png"
                else:
                    out_path = level_dir / f"compressed_{stem}_{level}.png"

                save_output(out_img, out_path)
                print(f"salvo: {out_path}")

                if make_preview:
                    preview = out_img.resize(
                        (expected_size[0] * preview_scale, expected_size[1] * preview_scale),
                        Image.Resampling.NEAREST
                    )
                    preview_path = level_dir / f"preview_{stem}_{level}.png"
                    save_output(preview, preview_path)

    print("processamento concluído.")


if __name__ == "__main__":
    main()
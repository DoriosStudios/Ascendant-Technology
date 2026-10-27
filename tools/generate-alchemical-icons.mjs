import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { POTION_FAMILIES, POTION_FORMS } from "../BP/scripts/config/alchemy.js";
import { STATSCORE_ICONS } from "../BP/scripts/ATCore/StatsCore/config/presentation.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const effectIcons = { haste: "haste", resistance: "resistance", absorption: "absorption", health_boost: "health_boost",
    levitation: "levitation", blindness: "blindness", darkness: "darkness", saturation: "hunger" };
export const customPotionIcon = family => family.statsCore || Object.hasOwn(effectIcons, family.id);
export function potionTexture(family, form) {
    if (customPotionIcon(family)) return `textures/items/alchemy/${family.id}_${form}`;
    return `textures/items/potion_bottle${form === "drink" ? "" : `_${form}`}_${family.icon ?? family.id}`;
}

const load = async file => PNG.sync.read(await readFile(file));
const luma = color => 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
const rgbKey = (data, i) => [...data.subarray(i, i + 3)].join(",");
const crop = (image, x, y, w, h) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(image, out, x, y, w, h, 0, 0);
    return out;
};
function palette(icon) {
    const colors = new Map();
    for (let i = 0; i < icon.data.length; i += 4) {
        if (icon.data[i + 3] < 255) continue;
        const color = [...icon.data.subarray(i, i + 3)];
        // Black outlines stay in the bottle stencil; they are not the liquid's identity.
        if (luma(color) <= 12) continue;
        colors.set(color.join(","), color);
    }
    const all = [...colors.values()];
    const chromatic = all.filter(c => Math.max(...c) - Math.min(...c) >= 18);
    // Silver armor has a neutral identity; the other icons use their chromatic ramps.
    const ramp = (chromatic.length >= 2 ? chromatic : all).sort((a, b) => luma(a) - luma(b));
    assert(ramp.length, "Effect icon has no usable opaque palette");
    return ramp;
}

export async function generateAlchemicalIcons(vanillaTextures) {
    if (!vanillaTextures) throw Error("Pass --vanilla-textures=PATH to the provided vanilla textures directory.");
    const font = await load(path.resolve(root, "../UtilityCraft/RP/font/glyph_F5.png"));
    const cell = font.width / 16;
    assert.equal(cell, font.height / 16);
    const templates = new Map();
    for (const form of POTION_FORMS) {
        const suffix = form === "drink" ? "" : `_${form}`;
        const base = await load(path.join(vanillaTextures, `items/potion_bottle${suffix}_moveSpeed.png`));
        const comparison = await load(path.join(vanillaTextures, `items/potion_bottle${suffix}_heal.png`));
        assert.equal(base.width, 16); assert.equal(base.height, 16);
        const mask = [], shades = new Map();
        for (let i = 0; i < base.data.length; i += 4) {
            assert.equal(base.data[i + 3], comparison.data[i + 3], "Vanilla bottle silhouette mismatch");
            if (rgbKey(base.data, i) !== rgbKey(comparison.data, i)) {
                mask.push(i); shades.set(rgbKey(base.data, i), [...base.data.subarray(i, i + 3)]);
            }
        }
        assert(mask.length > 0);
        templates.set(form, { base, mask, shades: [...shades.values()].sort((a, b) => luma(a) - luma(b)) });
    }
    const output = path.join(root, "RP/textures/items/alchemy");
    await mkdir(output, { recursive: true });
    const records = [], previews = [];
    for (const family of POTION_FAMILIES.filter(customPotionIcon)) {
        let icon, source;
        if (family.paletteGlyph) {
            const glyph = STATSCORE_ICONS[family.paletteGlyph].codePointAt(0) & 255;
            icon = crop(font, (glyph % 16) * cell, Math.floor(glyph / 16) * cell, cell, cell);
            source = `UtilityCraft/RP/font/glyph_F5.png#${family.paletteGlyph}`;
        } else {
            source = `ui/${effectIcons[family.id]}_effect.png`;
            icon = await load(path.join(vanillaTextures, source));
        }
        const ramp = palette(icon), row = [icon];
        for (const form of POTION_FORMS) {
            const { base, mask, shades } = templates.get(form);
            const image = new PNG({ width: 16, height: 16 });
            image.data = Buffer.from(base.data);
            const mapping = new Map(shades.map((shade, index) => [shade.join(","), ramp[Math.round(index / Math.max(1, shades.length - 1) * (ramp.length - 1))]]));
            for (const i of mask) mapping.get(rgbKey(base.data, i)).forEach((v, channel) => { image.data[i + channel] = v; });
            // Exact pixels: glass/cork, highlights outside the liquid and alpha never change.
            const masked = new Set(mask);
            for (let i = 0; i < image.data.length; i += 4) {
                assert.equal(image.data[i + 3], base.data[i + 3]);
                if (!masked.has(i)) assert.deepEqual(image.data.subarray(i, i + 4), base.data.subarray(i, i + 4));
            }
            await writeFile(path.join(output, `${family.id}_${form}.png`), PNG.sync.write(image));
            row.push(image);
        }
        records.push({ family: family.id, source, palette: ramp.map(c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("")) });
        previews.push(row);
    }
    // A nearest-neighbor contact sheet is an inspection artifact, not a game texture.
    const scale = 6, preview = new PNG({ width: 4 * 24 * scale, height: previews.length * 24 * scale });
    previews.forEach((row, y) => row.forEach((icon, x) => {
        for (let iy = 0; iy < icon.height; iy++) for (let ix = 0; ix < icon.width; ix++) {
            const source = (iy * icon.width + ix) * 4;
            for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
                const dest = (((y * 24 + 4 + iy) * scale + sy) * preview.width + (x * 24 + 4 + ix) * scale + sx) * 4;
                icon.data.copy(preview.data, dest, source, source + 4);
            }
        }
    }));
    const previewDir = path.join(root, "docs/previews");
    await mkdir(previewDir, { recursive: true });
    await writeFile(path.join(previewDir, "alchemical-potions.png"), PNG.sync.write(preview));
    await writeFile(path.join(previewDir, "alchemical-potion-palettes.json"), JSON.stringify(records, null, 4) + "\n");
    console.log(`${records.length * 3} potion textures, 16x16; exact icon palettes; glass, cork and alpha preserved. Rows: ${records.map(r => r.family).join(", ")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await generateAlchemicalIcons(process.argv.find(arg => arg.startsWith("--vanilla-textures="))?.slice(19));
}

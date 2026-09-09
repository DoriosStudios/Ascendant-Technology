// Deterministic pixel-art source for the four new AT upgrade icons.
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../RP/textures/items/machinery");
const palettes = {
    energy_capacity: ["#f5d35a", "#aa7727", "#fff2ac"],
    liquid_capacity: ["#42bed8", "#20617e", "#bbf7ff"],
    gas_capacity: ["#b8dacd", "#487d70", "#effff8"],
    resource_efficiency: ["#76d451", "#366d32", "#d6ffae"],
};
for (const [name, [base, dark, light]] of Object.entries(palettes)) {
    const png = new PNG({ width: 32, height: 32 });
    const rect = (x, y, w, h, color) => {
        const rgb = color.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16));
        for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
            const at = (row * 32 + col) * 4;
            png.data.set([...rgb, 255], at);
        }
    };
    for (let n = 7; n <= 25; n += 6) {
        rect(n, 2, 2, 28, "#bd9352");
        rect(2, n, 28, 2, "#bd9352");
    }
    rect(4, 4, 24, 24, "#192534");
    rect(5, 5, 22, 22, dark);
    rect(6, 6, 20, 19, base);
    rect(6, 6, 19, 2, light);
    rect(6, 8, 2, 16, light);
    rect(9, 9, 15, 15, "#223847");
    if (name === "energy_capacity") {
        rect(14, 10, 5, 2, light);
        rect(12, 12, 9, 10, light);
        rect(14, 14, 5, 6, dark);
        rect(16, 14, 1, 6, light);
        rect(14, 16, 5, 1, light);
    } else if (name === "liquid_capacity") {
        rect(12, 11, 9, 11, light);
        rect(14, 12, 5, 5, "#223847");
        rect(14, 17, 5, 3, base);
        rect(14, 16, 2, 1, base);
    } else if (name === "gas_capacity") {
        rect(13, 14, 8, 7, light);
        rect(11, 16, 2, 4, light);
        rect(15, 11, 4, 3, light);
        rect(21, 16, 2, 4, light);
        rect(14, 21, 6, 1, dark);
    } else {
        rect(13, 12, 8, 3, light);
        rect(11, 14, 9, 5, light);
        rect(12, 19, 5, 2, light);
        rect(16, 16, 2, 2, dark);
        rect(14, 18, 2, 2, dark);
        rect(12, 20, 2, 3, dark);
    }
    writeFileSync(resolve(root, `${name}_upgrade.png`), PNG.sync.write(png));
}
console.log("Generated four AT upgrade icons (Multi Processing artwork retained).");

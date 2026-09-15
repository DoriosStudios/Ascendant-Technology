import { readFile, writeFile, readdir } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("BP/scripts/config/recipes/liquifier.js", root), "utf8");
const recipes = vm.runInNewContext(source.replace("export const liquifierRecipes", "const liquifierRecipes") + "\nliquifierRecipes");
const textures = {
    aetherium: "textures/items/ores/aetherium_ingot",
    aetherium_crystal: "textures/items/ores/aetherium_crystal",
    aetherium_shard: "textures/items/ores/aetherium_shards",
    aetherium_crystal_dust: "textures/items/ores/aetherium_crystal_dust",
    aetherium_dust: "textures/items/ores/aetherium_dust",
    void_essence: "textures/items/misc/void_essence",
    obsidian: "textures/static/images/obsidian_render",
    stabilized_obsidian_dust: "textures/items/dusts/stabilized_obsidian_dust",
    compressed_obsidian: "textures/blocks/compressed/obsidian",
    compressed_obsidian_2: "textures/blocks/compressed/obsidian_2",
    compressed_obsidian_3: "textures/blocks/compressed/obsidian_3",
};
const key = id => `ui.ascendant:liquifier.recipe.${id.split(":")[1]}`;
const label = (text, size, offset, extra = {}) => ({
    type: "label", text, size, offset, anchor_from: "top_left", anchor_to: "top_left",
    font_scale_factor: 0.55, color: [0.9, 0.9, 0.9], layer: 2, text_alignment: "left", ...extra,
});
const rows = [];
const panels = [];
let index = 0;
for (const fluid of ["liquified_aetherium", "dark_matter"]) {
    rows.push({ [fluid + "_heading"]: {
        type: "panel", size: [88, 18], controls: [
            { background: { type: "image", texture: "textures/ui/gray_bg_border", size: [88, 18], layer: 0 } },
            { icon: { type: "image", texture: `textures/ui/at_icons/${fluid}`, size: [12, 12], offset: [-36, 0], layer: 2 } },
            { title: label(`ui.ascendant:liquifier.recipes.${fluid}`, [70, 16], [17, 2], { color: [0.3, 0.3, 0.3], font_scale_factor: 0.6 }) },
        ],
    } });
    const entries = Object.entries(recipes).filter(([, recipe]) => recipe.liquid === fluid);
    for (let start = 0; start < entries.length; start += 4) {
        const controls = [];
        for (const [column, [id, recipe]] of entries.slice(start, start + 4).entries()) {
            const shortId = id.split(":")[1];
            const controlName = `liquifier_${shortId}_recipe`;
            controls.push({ [shortId + "@uc.recipe_toggle"]: {
                anchor_from: "top_left", anchor_to: "top_left", offset: [column * 18 + 4, 0], size: [18, 18],
                "$toggle_name": "liquifier_recipes", "$toggle_index": 6000 + index++,
                "$toggle_control_name": controlName, "$toggle_hover_text": "",
                "$toggle_hover_text_localize": false, "$toggle_checked_hover_text_localize": false,
                "$toggle_unchecked_hover": "textures/ui/recipe_book_item_bg",
                "$toggle_checked_hover": "textures/ui/recipe_book_touch_cell_selected",
                "$recipe_icon": textures[shortId], "$toggle_layer": 2,
                "$toggle_icon_uv_size": shortId === "obsidian" ? [90, 90] : [16, 16],
            } });
            const slot = (texture, count, offset, collectionIndex) => ({
                collection_index: collectionIndex, bindings: [], "$slot_offset": offset,
                "$slot_item_texture": texture, "$has_slot_count": true, "$slot_count_text": String(count),
            });
            const detail = [
                { "input@uc.recipe_slot_overlay": slot(textures[shortId], recipe.required, [-28, 2], 3) },
                { fluid_output: {
                    type: "panel", size: [70, 18], offset: [17, 20], layer: 20,
                    controls: [
                        { icon: { type: "image", texture: `textures/ui/at_icons/${fluid}`, size: [12, 12], offset: [28, 0], layer: 2 } },
                        { name: label(`ui.ascendant:liquifier.recipes.${fluid}`, [54, 10], [0, 0], { font_scale_factor: 0.55, text_alignment: "right", color: [0.3, 0.3, 0.3] }) },
                        { amount: label(`${recipe.amount.toLocaleString("en-US")} mB`, [54, 8], [0, 10], { text_alignment: "right", color: [0.3, 0.3, 0.3] }) },
                    ],
                } },
            ];
            if (recipe.byproduct) {
                detail.push({ "residue@uc.recipe_slot_overlay": slot("textures/items/ender_pearl", recipe.byproduct.amount, [32, 1], 8) });
                detail.push({ chance: label(`${Math.round(recipe.byproduct.chance * 100)}%`, [24, 9], [101, 20], { color: [0.3, 0.3, 0.3] }) });
            }
            panels.push({ [shortId + "@uc.recipe_panel"]: {
                "$recipe_control_name": controlName, size: [162, 72], controls: detail,
            } });
        }
        rows.push({ [`${fluid}_row_${start}`]: { type: "panel", size: [88, 18], controls } });
    }
}
const recipeBinding = [{ binding_type: "view", source_control_name: "recipes_toggle_button", source_property_name: "#toggle_state", target_property_name: "#visible", resolve_sibling_scope: false }];
const book = {
    namespace: "liquifier",
    recipe_book: {
        type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items",
        size: [104, 166], anchor_from: "top_left", anchor_to: "top_left", offset: [-100, -7], layer: 6,
        bindings: recipeBinding,
        controls: [
            { background: { type: "image", texture: "textures/ui/background/background_panel", size: [104, 166], layer: 0 } },
            { title_background: { type: "image", texture: "textures/ui/background/dark_top_tab", size: [104, 22], anchor_from: "top_left", anchor_to: "top_left", layer: 1 } },
            { list_background: { type: "image", texture: "textures/ui/recipe_grid_bg", size: [92, 138], anchor_from: "top_left", anchor_to: "top_left", offset: [6, 24], layer: 1 } },
            { title: label("ui.utilitycraft:recipes_panel.name", [88, 12], [8, 6], { font_scale_factor: 0.85, text_alignment: "center" }) },
            { "recipes_scroll@ascendant_common.info_scroll_view": {
                anchor_from: "top_left", anchor_to: "top_left", size: [104, 134], offset: [8, 26],
                "$info_content": "liquifier.recipe_rows", layer: 6,
                "$scroll_view_port_size": [88, "100%"], "$scroll_view_port_max_size": [88, "100%"],
                "$scroll_view_port_size_touch": [88, "100%"], "$scroll_view_port_max_size_touch": [88, "100%"],
            } },
        ],
    },
    recipe_rows: { type: "stack_panel", orientation: "vertical", size: [88, "default"], anchor_from: "top_left", anchor_to: "top_left", controls: rows },
    recipe_overlays: { type: "panel", size: [162, 72], layer: 20, bindings: recipeBinding, controls: panels },
};
await writeFile(new URL("RP/ui/recipes/liquifier.json", root), JSON.stringify(book, null, 4) + "\n");

function parseLang(text) {
    return new Map(text.split(/\r?\n/).filter(line => line.includes("=")).map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
}
const obsidianNames = { en_US: "Obsidian", pt_BR: "Obsidiana", pt_PT: "Obsidiana", es_ES: "Obsidiana", es_MX: "Obsidiana", de_DE: "Obsidian", fr_FR: "Obsidienne", ja_JP: "黒曜石", ru_RU: "Обсидиан", zh_CN: "黑曜石" };
const localeNames = {
    en_US: ["Liquified Aetherium", "Dark Matter"], pt_BR: ["Aetherium Liquefeito", "Matéria Escura"], pt_PT: ["Aetherium Liquefeito", "Matéria Escura"],
    es_ES: ["Aetherium licuado", "Materia oscura"], es_MX: ["Aetherium licuado", "Materia oscura"],
    de_DE: ["Verflüssigtes Aetherium", "Dunkle Materie"], fr_FR: ["Aetherium liquéfié", "Matière noire"],
    ja_JP: ["液化エーテリウム", "ダークマター"], ru_RU: ["Жидкий аэтериум", "Тёмная материя"], zh_CN: ["液化以太", "暗物质"],
};
for (const file of (await readdir(new URL("RP/texts/", root))).filter(file => file.endsWith(".lang"))) {
    const path = new URL("RP/texts/" + file, root);
    let text = await readFile(path, "utf8");
    const uc = await readFile(new URL("../UtilityCraft/RP/texts/" + file, root), "utf8").catch(() => "");
    const names = parseLang(uc + "\n" + text);
    const added = [];
    for (const id of Object.keys(recipes)) {
        const name = names.get(`item.${id}`) ?? names.get(`tile.${id}.name`) ?? names.get(`tile.${id}`) ?? (id === "minecraft:obsidian" ? names.get("tile.obsidian.name") ?? obsidianNames[file.replace(".lang", "")] : undefined) ?? id.split(":")[1].replaceAll("_", " ");
        added.push(`${key(id)}=${name.split("\\n")[0].replace(/§./g, "")}`);
    }
    const [aetherium, dark] = localeNames[file.replace(".lang", "")] ?? localeNames.en_US;
    added.push(`ui.ascendant:liquifier.recipes.liquified_aetherium=${aetherium}`, `ui.ascendant:liquifier.recipes.dark_matter=${dark}`);
    text = text.split(/\r?\n/).filter(line => !/^ui\.ascendant:liquifier\.(recipe\.|recipes\.)/.test(line)).join("\n").trimEnd();
    await writeFile(path, text + "\n\n" + added.join("\n") + "\n");
}
console.log(`Generated Liquifier recipe book: ${Object.keys(recipes).length} recipes in two fluid groups.`);

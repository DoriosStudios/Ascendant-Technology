import { readFile, writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { ALCHEMY_SLOTS as S, ALCHEMY_UI as U, POTION_FAMILIES, formatPotionDuration, potionLevelLabel } from "../BP/scripts/config/alchemy.js";
import { BREWING_RECIPES } from "../BP/scripts/ATCore/alchemy/recipes.js";
import { writeAlchemicalUITranslations } from "./alchemical-ui-text.mjs";

const root = new URL("../", import.meta.url);
const read = async file => JSON.parse((await readFile(new URL(file, root), "utf8")).replace(/^\uFEFF/, ""));
const write = async (file, value) => {
    const url = new URL(file, root);
    await mkdir(new URL("./", url), { recursive: true });
    await writeFile(url, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 4) + "\n");
};
const ctrl = (name, value) => ({ [name]: value });
const at = (x, y, w, h) => ({ anchor_from: "top_left", anchor_to: "top_left", offset: [x, y], size: [w, h] });
const view = (name, expression = "#toggle_state", target = "#visible") => ({ binding_type: "view", source_control_name: name,
    source_property_name: expression, target_property_name: target, resolve_sibling_scope: false });
const image = (texture, x, y, w, h, layer = 1) => ({ type: "image", texture, ...at(x, y, w, h), layer });
const label = (text, x, y, w, h, scale = 0.6) => ({ type: "label", text, ...at(x, y, w, h),
    font_scale_factor: scale, color: [1, 0.94, 0.8], shadow: true, text_alignment: "left", layer: 4 });
const brown = "textures/ui/panels/background_panel_brown";
const cell = "textures/ui/cells/brown_cell_image";
const scroll = content => ({ size: [98, 133], "$content_ref": content, "$scrolling_content": content,
    "$scroll_view_port_size": [90, "100%"], "$scroll_view_port_max_size": [90, "100%"],
    "$scroll_view_port_size_touch": [90, "100%"], "$scroll_view_port_max_size_touch": [90, "100%"] });
function iconCard(texture, tooltip, x, y) {
    const tooltipRef = tooltip.includes(".recipe.") || /\.ingredient\.(gunpowder|dragon_breath)$/.test(tooltip)
        ? "alchemical_recipes.name_tooltip" : "alchemical_recipes.potion_tooltip";
    return { type: "panel", ...at(x, y, 22, 24), controls: [
        ctrl("background", image(cell, 0, 0, 22, 24, 1)),
        ctrl("icon", image(texture, 1, 2, 20, 20, 2)),
        ctrl("hover@uc.fake_hover_button", { ...at(0, 0, 22, 24), layer: 10, "$hover_text": tooltip,
            controls: [ctrl("hover", { type: "panel", controls: [ctrl(`tooltip@${tooltipRef}`, { "$hover_text": "$hover_text" })] })] }),
    ] };
}

// Recipe icons share one card background. Only inputs and ingredients need hover names;
// the result is named by the card's visible heading.
function recipeIcon(texture, tooltip, x, y) {
    return { type: "panel", ...at(x, y, 18, 18), controls: [
        ctrl("icon", image(texture, 1, 1, 16, 16, 2)),
        ...(tooltip ? [ctrl("hover@uc.fake_hover_button", { ...at(0, 0, 18, 18), layer: 10, "$hover_text": tooltip,
            controls: [ctrl("hover", { type: "panel", controls: [
                ctrl("tooltip@alchemical_recipes.name_tooltip", { "$hover_text": "$hover_text" }),
            ] })] })] : []),
    ] };
}

// Timed families only: instant effects have no duration or extension stage.
export function alchemicalGuideRanges() {
    const timed = POTION_FAMILIES.filter(f => !f.instant);
    const range = (property, factor = 1) => [Math.min(...timed.map(f => f[property])) * factor,
        Math.max(...timed.map(f => f[property])) * factor].map(formatPotionDuration).join(" - ");
    return { normal: range("normal"), lingering: range("normal", 0.25),
        extended: range("long"), maximum: range("long", 4), maxLevel: Math.max(...POTION_FAMILIES.map(f => f.maxLevel)) };
}

// Explicit pixels: 6 x 54 including a one-pixel border and 52 fill rows.
// A centered 64 x 64 item canvas preserves exact sprite scale in the item renderer.
function blazePng(frame) {
    const rows = Buffer.alloc(64 * (1 + 64 * 4));
    const pixel = (x, y, rgba) => { const i = y * 257 + 1 + x * 4; rgba.forEach((v, j) => { rows[i + j] = v; }); };
    for (let y = 0; y < 54; y++) for (let x = 0; x < 6; x++) {
        let c = [49, 44, 37, 255];
        if (x === 0 || y === 0) c = [71, 66, 54, 255];
        else if (x === 5 || y === 53) c = [228, 220, 200, 255];
        else if (y >= 53 - frame) c = x === 1 ? [249, 157, 25, 255] : x === 4 ? [218, 104, 15, 255]
            : y % 3 === 0 ? [255, 239, 127, 255] : [255, 208, 62, 255];
        pixel(29 + x, 5 + y, c);
    }
    const crc = data => {
        let v = 0xffffffff;
        for (const b of data) { v ^= b; for (let i = 0; i < 8; i++) v = (v >>> 1) ^ (v & 1 ? 0xedb88320 : 0); }
        return (v ^ 0xffffffff) >>> 0;
    };
    const chunk = (type, data) => {
        const name = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
        size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data])));
        return Buffer.concat([size, name, data, checksum]);
    };
    const header = Buffer.alloc(13); header.writeUInt32BE(64); header.writeUInt32BE(64, 4); header[8] = 8; header[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

function toggle(name, x, y, w, h, uncheckedIcon, checkedIcon = uncheckedIcon, options = {}) {
    return ctrl(`${name}_wrapper@uc.toggle_button`, {
        ...at(x, y, w, h), "$toggle_control_name": name, "$toggle_name": name,
        "$toggle_size": [w, h], "$toggle_layer": 40, "$toggle_lost_reset": false,
        "$toggle_default_state": false, "$toggle_binding_condition": "always",
        "$toggle_unchecked": "textures/ui/toggle_button/recipe_base_unchecked",
        "$toggle_checked": "textures/ui/toggle_button/recipe_base_checked",
        "$toggle_unchecked_hover": "textures/ui/toggle_button/recipe_base_unchecked_hover",
        "$toggle_checked_hover": "textures/ui/toggle_button/recipe_base_checked_hover",
        "$has_toggle_icon": true, "$toggle_icon_size": [14, 14],
        "$toggle_icon_unchecked": uncheckedIcon, "$toggle_icon_checked": checkedIcon,
        "$toggle_icon_unchecked_hover": uncheckedIcon, "$toggle_icon_checked_hover": checkedIcon,
        ...options,
    });
}

const nativeSlot = (index, x, y, overrides = {}) => ({ ...at(x, y, 18, 18), collection_index: index,
    "$item_collection_name": "container_items", "$cell_overlay_ref": "alchemical_station.bottle_empty",
    "$background_images": "alchemical_station.potion_slot_background", ...overrides });
function itemBar(index, x, y, w, h, canvas, frameTexture) {
    return { type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items", ...at(x, y, w, h),
        controls: [ctrl("item@common.container_item", { collection_index: index, size: [w, h],
            "$cell_image_size": [w, h], "$cell_overlay_ref": "common.empty_panel", "$background_images": "common.empty_panel",
            "$button_ref": "uc.slot_button", "$highlight_control": "uc.slot_highlight",
            "$item_renderer_panel_size": [canvas, canvas], "$item_renderer_size": [canvas, canvas],
            "$stack_count_required": false, "$durability_bar_required": false, "$storage_bar_required": false }),
            ...(frameTexture ? [ctrl("border", { type: "image", texture: frameTexture, size: [w, h], layer: 9 })] : [])] };
}

function machineButton(index, x, y, icon, common, hoverText) {
    const controls = structuredClone(common.machine_button.controls);
    const button = controls.find(c => c.button).button;
    button.controls.find(c => c.hover).hover.controls = [ctrl("hover_text@uc.fake_hover_text", {
        "$hover_text": hoverText,
    })];
    button.controls.push(ctrl("action_icon", {
        type: "image", texture: icon, size: [12, 12], layer: 18,
    }));
    return { ...at(x, y, 18, 18), "$index": index, "$button_size": [18, 18], "$button_text": "",
        "$default_texture": "textures/ui/toggle_button/recipe_base_unchecked",
        "$hover_texture": "textures/ui/toggle_button/recipe_base_unchecked_hover",
        "$pressed_texture": "textures/ui/toggle_button/recipe_base_checked", layer: 15, controls };
}

export async function generateAlchemicalUI({ assets = true } = {}) {
    const common = JSON.parse(await readFile(new URL("../UtilityCraft/RP/ui/ui_core.json", root), "utf8"));
    const informationControls = structuredClone(common.info_tab.controls);
    // Keep the shared scrolling content and native open/close pair. The compact
    // popup sits within this container so both side panels fit the small viewport.
    const informationPanel = informationControls.find(c => c.info_panel).info_panel;
    informationPanel.offset = [-20, 16];
    informationPanel.controls.find(c => c["description_scroll@common.scrolling_panel"])
        ["description_scroll@common.scrolling_panel"].$scrolling_content = "uc.info_description_scroll_content";
    informationPanel.controls.find(c => c.text_label).text_label.size = [92, 12];
    const atlas = await read("RP/textures/item_texture.json");
    for (let frame = 0; assets && frame <= U.blazeFrames; frame++) {
        const n = String(frame).padStart(2, "0"), icon = `utilitycraft_alchemical_blaze_${n}`;
        atlas.texture_data[icon] = { textures: `textures/items/ui/blaze/alchemical_blaze_${n}` };
        await write(`RP/textures/items/ui/blaze/alchemical_blaze_${n}.png`, blazePng(frame));
        await write(`BP/items/ui/blaze/alchemical_blaze_${n}.json`, { format_version: "1.20.80", "minecraft:item": {
            description: { identifier: `${U.blazeItemPrefix}${n}`, menu_category: { category: "none", is_hidden_in_commands: true } },
            components: { "minecraft:icon": icon, "minecraft:max_stack_size": 1, "minecraft:tags": { tags: ["utilitycraft:ui_element"] } } } });
    }
    if (assets) await write("RP/textures/item_texture.json", atlas);

    const ui = { namespace: "alchemical_station" };
    ui.brown_background = { type: "image", texture: brown, size: ["100%", "100%"], layer: 1 };
    // Retain vanilla's selected-slot treatment (including touch selection).
    ui.potion_slot_background = { type: "panel", size: ["100%", "100%"], controls: [
        ctrl("cell_image@common.cell_image", { texture: cell,
            "$cell_selected_binding_name|default": "#is_selected_slot", visible: true,
            bindings: [{ binding_name: "(not $cell_selected_binding_name)", binding_name_override: "#visible",
                binding_type: "collection", binding_collection_name: "$item_collection_name" }] }),
        ctrl("cell_image_selected@common.cell_image_selected", {
            "$cell_selected_binding_name|default": "#is_selected_slot", visible: false,
            bindings: [{ binding_name: "$cell_selected_binding_name", binding_name_override: "#visible",
                binding_type: "collection", binding_collection_name: "$item_collection_name" }] }),
    ] };
    ui.bottle_empty = { type: "image", texture: "textures/ui/bottle_empty", size: [16, 16], layer: 2,
        bindings: [{ binding_name: "#item_id_aux", binding_type: "collection", binding_collection_name: "container_items" },
            { binding_type: "view", source_property_name: "(not (#item_id_aux > 0))", target_property_name: "#visible" }] };
    ui.brewing_progress = { type: "panel", "$item_collection_name": "container_items", collection_index: S.progress, size: [9, 28],
        controls: [ctrl("empty", { type: "image", texture: "textures/ui/brewing_arrow_empty", size: [9, 28] }),
            ...Array.from({ length: 29 }, (_, frame) => ctrl(`fill_${frame}`, { type: "image", texture: "textures/ui/brewing_arrow_full",
                size: [9, 28], clip_direction: "down", clip_ratio: frame / 28, layer: 2,
                bindings: [{ binding_name: "#hover_text", binding_type: "collection", binding_collection_name: "container_items" },
                    { binding_type: "view", source_property_name: `(not ((#hover_text - '§0§a${String(frame).padStart(2, "0").split("").map(d => `§${d}`).join("")}§r') = #hover_text))`, target_property_name: "#visible" }] }))] };
    ui.brewing_page = { type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items",
        size: [176, 86], visible: true, bindings: [view("alchemy_aplifying_tab", "(not #toggle_state)")], controls: [
            ctrl("blaze", itemBar(S.blaze, 22, 26, 6, 54, 64)),
            ctrl("fuel@common.container_item", nativeSlot(S.fuel, 30, 22, { "$cell_overlay_ref": "common.empty_panel" })),
            ctrl("ingredient@common.container_item", nativeSlot(S.ingredient, 50, 22, { "$cell_overlay_ref": "common.empty_panel" })),
            ctrl("progress@alchemical_station.brewing_progress", at(96, 28, 9, 28)),
            ...S.bottles.map((index, i) => ctrl(`bottle_${i}@common.container_item`, nativeSlot(index, 30 + Math.floor(i / 2) * 20, 44 + (i % 2) * 20))),
            ctrl("bottle_return@common.container_item", nativeSlot(33, 70, 22, { "$cell_overlay_ref": "common.empty_panel", visible: false,
                bindings: [{ binding_name: "#item_id_aux", binding_type: "collection", binding_collection_name: "container_items" },
                    { binding_type: "view", source_property_name: "(#item_id_aux > 0)", target_property_name: "#visible" }] })),
        ] };
    ui.aplifying_page = { type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items",
        size: [176, 86], visible: false, bindings: [view("alchemy_aplifying_tab")], controls: [
            ctrl("aetherium", itemBar(S.aetherium, 154, 29, 16, 48, 48, "textures/ui/liquid_border")),
            ...[["amplify", 96, S.amplify, S.amplifyButton, S.amplifyProgress, "textures/items/glowstone_dust"],
                ["extend", 132, S.extend, S.extendButton, S.extendProgress, "textures/items/redstone_dust"]].flatMap(([lane, x, index, button, progress, icon]) => [
                ctrl(`${lane}_slot@common.container_item`, nativeSlot(index, x, 26)),
                ctrl(`${lane}_progress@uc.progress_display`, { ...at(x, 46, 18, 16), collection_index: progress,
                    "$cell_image_size": [18, 16], "$item_renderer_panel_size": [18, 16], "$item_renderer_size": [16, 16],
                    "$cell_overlay_ref": "common.empty_panel", "$stack_count_required": false, "$durability_bar_required": false, "$storage_bar_required": false }),
                ctrl(`${lane}_button@uc.machine_button`, machineButton(button, x, 64, icon, common, `ui.ascendant:alchemy.${lane}`)),
            ]),
        ] };
    const cardTab = (name, group, index, icon, tooltip) => ctrl(`${name}@at_common.card_tab`, {
        "$toggle_name": group, "$card_tab_index": index, "$card_icon": icon,
        "$card_tooltip": tooltip, "$toggle_tts_name": tooltip,
        "$card_unchecked_texture": "textures/ui/button_card/button_brown",
        "$card_checked_texture": "textures/ui/button_card/button_brown_pressed",
        "$card_unchecked_hover_texture": "textures/ui/button_card/button_brown_hover",
        "$card_checked_hover_texture": "textures/ui/button_card/button_brown_pressed_hover",
    });
    ui["button_card_buttons@at_core.button_card_row"] = { controls: [
        cardTab("alchemy_brewing_tab", "alchemy_pages", 0, "textures/ui/inventory_icon", "ui.ascendant:alchemy.tab.brewing"),
        cardTab("alchemy_aplifying_tab", "alchemy_pages", 1, "textures/ui/recipe_book_icon", "ui.ascendant:alchemy.tab.upgrades"),
    ] };
    ui["view_top_bar@at_common.button_card"] = {
        "$card_offset": [0, 4],
        "$card_buttons_ref": "alchemical_station.button_card_buttons",
        "$card_background_texture": "textures/ui/button_card/tab_top_brown",
    };
    ui["side_button_card_buttons@at_core.button_card_row"] = { controls: [
        ["display", "textures/ui/toggle_button/info_unchecked"], ["recipes", "textures/ui/recipe_book_icon"],
        ["progression", "textures/ui/inventory_icon"],
    ].map(([tab, icon], index) => cardTab(`alchemy_${tab}_tab`, "alchemy_side_pages", index, icon, `ui.ascendant:alchemy.tab.${tab}`)) };
    ui["side_view_top_bar@at_common.button_card"] = {
        "$card_buttons_ref": "alchemical_station.side_button_card_buttons",
        "$card_background_texture": "textures/ui/button_card/tab_top_brown",
        anchor_from: "top_right", anchor_to: "top_right", "$card_offset": [-22, 0], "$card_show_close": false,
    };
    ui.station_top = { type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items",
        ...at(0, 0, 176, 86), controls: [
            ctrl("title", { type: "label", text: "entity.utilitycraft:alchemical_station.name", localize: true, ...at(8, 5, 142, 10),
                font_scale_factor: 0.7, color: [1, 0.94, 0.8], shadow: true, text_alignment: "center", layer: 8 }),
            ctrl("energy", itemBar(S.energy, 4, 29, 16, 48, 48, "textures/ui/energy_border")),
            ctrl("view_top_bar@alchemical_station.view_top_bar", {}),
            ctrl("brewing@alchemical_station.brewing_page", {}), ctrl("aplifying@alchemical_station.aplifying_page", {}),
            ctrl("side_panels@alchemical_station.side_panels", {}),
            toggle("alchemy_panels_hidden", -26, 2, 18, 18, "textures/ui/arrow_dark_left_stretch", "textures/ui/arrow_dark_right_stretch", {
                "$toggle_hover_text": "ui.ascendant:alchemy.panel.hide", "$toggle_checked_hover_text": "ui.ascendant:alchemy.panel.show" }),
            ctrl("upgrades@uc.upgrades_tab", { "$upgrade_index_1": S.speed, "$upgrade_index_2": S.efficiency,
                "$has_first_upgrade": true, "$has_second_upgrade": true, "$has_third_upgrade": false, "$has_fourth_upgrade": false,
                "$upgrade_overlay_1": "textures/items/machinery/speed_upgrade", "$upgrade_overlay_2": "textures/items/machinery/energy_upgrade",
                offset: [-10, 2] }),
            ctrl("io@uc.io_tab", { "$has_item_io": true, "$has_fluid_io": true, offset: [-10, 2],
                "$io_items_modes_description": "ui.ascendant:alchemy.io.items", "$io_fluids_modes_description": "ui.ascendant:alchemy.io.fluids",
                ...Object.fromEntries(["top", "left", "front", "right", "bottom", "back"].flatMap((face, i) => [
                    [`$io_item_${face}_index`, S.itemIO[i]], [`$io_fluid_${face}_index`, S.fluidIO[i]],
                    [`$io_${face}_texture`, `textures/blocks/machines/alchemical_station_off_${{ top: "up", left: "west", front: "north", right: "east", bottom: "down", back: "south" }[face]}`],
                ])) }),
            ctrl("information@uc.info_tab", { "$info_description": "ui.ascendant:alchemy.help", offset: [-10, 2],
                "$info_panel_size": [80, 134], controls: informationControls }),
        ] };
    ui.side_panels = { type: "collection_panel", collection_name: "container_items", "$item_collection_name": "container_items",
        ...at(-116, 0, 110, 166), visible: true, bindings: [view("alchemy_panels_hidden", "(not #toggle_state)")], layer: 12, controls: [
            ctrl("background", image(brown, 0, 0, 110, 166, 0)),
            ctrl("side_view_top_bar@alchemical_station.side_view_top_bar", {}),
            ctrl("display", { type: "panel", ...at(6, 27, 98, 133), visible: true, bindings: [view("alchemy_display_tab")],
                controls: [ctrl("background", image(cell, 0, 0, 90, 133, 1)),
                    ctrl("text@at_common.scroll_panel", { ...scroll("at_common.info_text"), "$label_index": S.status,
                    "$text_scale": 0.5, "$text_color": [1, 0.94, 0.8], layer: 3 })] }),
            ctrl("recipes@alchemical_recipes.recipe_book", { ...at(6, 27, 98, 133), visible: false, bindings: [view("alchemy_recipes_tab")] }),
            ctrl("progression@alchemical_recipes.progression_book", { ...at(6, 27, 98, 133), visible: false, bindings: [view("alchemy_progression_tab")] }),
        ] };
    const shell = await read("RP/ui/liquifier.json");
    ui.utility_panel = structuredClone(shell.utility_panel);
    const rootPanel = ui.utility_panel.controls.find(c => c["root_panel@common.root_panel"])["root_panel@common.root_panel"];
    rootPanel.size = [176, 166];
    // Center the complete open composition (110px side panel + 6px gap +
    // 176px container + 24px shared machine buttons), including the top tabs.
    rootPanel.offset = [46, 10];
    rootPanel.controls.find(c => c["common_panel@common.common_panel"])["common_panel@common.common_panel"]
        .$dialog_background = "alchemical_station.brown_background";
    const chest = rootPanel.controls.find(c => c.chest_panel).chest_panel;
    chest.controls = [ctrl("station_top@alchemical_station.station_top", {}), ctrl("inventory_panel@common.inventory_panel", {}),
        ctrl("hotbar_grid@common.hotbar_grid_template", {}), ctrl("inventory_take_progress_icon_button@common.inventory_take_progress_icon_button", {})];
    await write("RP/ui/alchemical_station.json", ui);
    await write("RP/ui/recipes/alchemical_station.json", await recipeBook(atlas));
    await writeAlchemicalUITranslations(alchemicalGuideRanges());
    console.log(`Alchemical UI: brown panels; display / recipes / progression; 7 general stages; 58x38 bottle grid.`);
}

export async function generateAlchemicalRecipeBook() {
    await write("RP/ui/recipes/alchemical_station.json", await recipeBook(await read("RP/textures/item_texture.json")));
    await writeAlchemicalUITranslations(alchemicalGuideRanges());
}

async function recipeBook(atlas) {
    // Paths verified against Mojang's item/terrain atlases. Generation itself
    // must not depend on an editor extension or a user's vanilla mirror path.
    const nativeIcons = {
        nether_wart: "items/nether_wart", fermented_spider_eye: "items/spider_eye_fermented",
        glowstone_dust: "items/glowstone_dust", redstone: "items/redstone_dust", sugar: "items/sugar",
        rabbit_foot: "items/rabbit_foot", blaze_powder: "items/blaze_powder", glistering_melon_slice: "items/melon_speckled",
        spider_eye: "items/spider_eye", ghast_tear: "items/ghast_tear", golden_carrot: "items/carrot_golden",
        magma_cream: "items/magma_cream", pufferfish: "items/fish_pufferfish_raw", phantom_membrane: "items/phantom_membrane",
        turtle_helmet: "items/turtle_helmet", breeze_rod: "items/breeze_rod", web: "blocks/web", slime: "items/slimeball",
        stone: "blocks/stone", golden_apple: "items/apple_golden", wither_rose: "blocks/flower_wither_rose",
        shulker_shell: "items/shulker_shell", ink_sac: "items/dye_powder_black", echo_shard: "items/echo_shard",
        enchanted_golden_apple: "items/apple_golden", gunpowder: "items/gunpowder", dragon_breath: "items/dragons_breath",
        ender_eye: "items/ender_eye", sweet_berries: "items/sweet_berries", glow_berries: "items/glow_berries", fire_charge: "items/fireball",
    };
    const entryPath = entry => typeof entry === "string" ? entry : Array.isArray(entry) ? entryPath(entry[0]) : entryPath(entry?.textures ?? entry?.path);
    const reagent = id => {
        const key = id.split(":")[1];
        if (id.startsWith("utilitycraft:")) {
            const entry = atlas.texture_data[`utilitycraft_${key}`];
            if (entry) return entryPath(entry);
        } else if (nativeIcons[key]) return `textures/${nativeIcons[key]}`;
        throw Error(`Missing recipe icon mapping: ${id}`);
    };
    const potion = name => {
        const form = name === "Splash" ? "splash" : name === "Lingering" ? "lingering" : "drink";
        const family = POTION_FAMILIES.find(f => f.id === name);
        const entry = family && atlas.texture_data[`utilitycraft_alchemical_${family.id}_${form}`];
        return entry ? entryPath(entry) : `textures/items/potion_bottle${form === "drink" ? "_drinkable" : `_${form}`}`;
    };
    const ranges = alchemicalGuideRanges();
    const guide = [
        ["common", "drink", "I", ranges.normal],
        ["splash", "splash", "I", ranges.normal, "textures/items/gunpowder", "gunpowder"],
        ["lingering", "lingering", "I", ranges.lingering, "textures/items/dragons_breath", "dragon_breath"],
        ["amplified_1", "drink", "II", ranges.normal, "textures/ui/at_icons/liquified_aetherium", "amplify"],
        ["amplified_2", "drink", "III", ranges.normal, "textures/ui/at_icons/liquified_aetherium", "amplify_twice"],
        ["extended", "drink", "I", ranges.extended, "textures/items/redstone_dust", "redstone"],
        ["maximum", "drink", `I - ${potionLevelLabel(ranges.maxLevel)}`, ranges.maximum, "textures/ui/at_icons/liquified_aetherium", "maximum"],
    ];
    return { namespace: "alchemical_recipes", "potion_tooltip@uc.fake_hover_text": { controls: [
        ctrl("content", { type: "panel", size: [176, "100%c + 8px"], controls: [
            ctrl("label", { type: "label", text: "$hover_text", localize: true, ...at(6, 4, 164, "default"),
                color: [1, 1, 1], font_scale_factor: 0.7, text_alignment: "left", shadow: true, layer: 81 }),
        ] }),
    ] }, "name_tooltip@alchemical_recipes.potion_tooltip": { controls: [
        ctrl("content", { type: "panel", size: ["100%c + 12px", "100%c + 8px"], controls: [
            ctrl("label", { type: "label", text: "$hover_text", localize: true, ...at(6, 4, "default", "default"),
                color: [1, 1, 1], font_scale_factor: 0.7, text_alignment: "left", shadow: true, layer: 81 }),
        ] }),
    ] }, recipe_book: { type: "panel", size: [98, 133], controls: [
        ctrl("scroll@at_common.scroll_panel", scroll("alchemical_recipes.recipe_rows"))] },
        recipe_rows: { type: "stack_panel", orientation: "vertical", size: [90, "default"], controls: BREWING_RECIPES.map((r, i) => ctrl(`recipe_${i}`, {
            type: "panel", size: [90, 34], controls: [
                ctrl("background", image(cell, 0, 0, 90, 32, 0)),
                ctrl("effect_name", { ...label(`ui.ascendant:alchemy.recipe.${i}.output`, 4, 2, 82, 10, 0.6), localize: true }),
                ctrl("input", recipeIcon(potion(r.input), `ui.ascendant:alchemy.recipe.${i}.input`, 4, 12)),
                ctrl("plus", label("+", 24, 16, 6, 10)),
                ctrl("ingredient", recipeIcon(reagent(r.ingredient), `ui.ascendant:alchemy.recipe.${i}.ingredient`, 34, 12)),
                ctrl("arrow", image("textures/ui/progress_bar/arrow_right_22", 56, 16, 8, 10, 2)),
                ctrl("output", recipeIcon(potion(r.output), "", 68, 12)),
            ] })) },
        progression_book: { type: "panel", size: [98, 133], controls: [
            ctrl("scroll@at_common.scroll_panel", scroll("alchemical_recipes.progression_rows"))] },
        progression_rows: { type: "stack_panel", orientation: "vertical", size: [90, "default"], controls: guide.map(([stage, form, level, time, ingredient, name]) =>
            ctrl(`stage_${stage}`, { type: "panel", size: [90, 32], controls: [
                ctrl("background", image(cell, 0, 0, 90, 30, 0)),
                ctrl("potion", iconCard(potion(form === "splash" ? "Splash" : form === "lingering" ? "Lingering" : "Drink"),
                    `ui.ascendant:alchemy.guide.${stage}`, 2, 3)),
                ctrl("level", label(level, 28, 3, 36, 10, 0.65)),
                ctrl("duration", label(time, 28, 18, 58, 8, 0.55)),
                ...(ingredient ? [ctrl("ingredient", recipeIcon(ingredient, `ui.ascendant:alchemy.guide.ingredient.${name}`, 68, 1))] : []),
            ] })) } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await generateAlchemicalUI({ assets: !process.argv.includes("--ui-only") });

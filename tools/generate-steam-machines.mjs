import { readFile, writeFile, mkdir, copyFile, readdir, unlink } from "node:fs/promises";
import { STEAM_MACHINES, STEAM_BOILER_RECIPE, VAPORIZER_RECIPES } from "../BP/scripts/config/steamProcessing.js";
import { PNG } from "pngjs";
import { splitAtlas } from "./split_faces.mjs";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");
const parse = text => JSON.parse(text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\r\n]*/g, (m, q) => q ?? ""));
const load = async file => parse(await read(file));
const save = async (file, data) => {
    const url = new URL(file, root);
    await mkdir(new URL("./", url), { recursive: true });
    await writeFile(url, JSON.stringify(data, null, 4) + "\n");
};
const replace = (data, from, to) => JSON.parse(JSON.stringify(data).replaceAll(from, to));
const legacy = "vaporworks_processor";
const blockPath = name => `BP/blocks/machinery/machines/${name}.json`;
const legacyBlock = await load(blockPath(legacy));
const legacyUI = await load(`RP/ui/${legacy}.json`);
const terrain = await load("RP/textures/terrain_texture.json");
const books = await load("RP/ui/recipes/machine_books.json");
const generatedBooks = { namespace: "at_steam_recipes" };
const rpBlocks = await load("RP/blocks.json");
const recipePath = name => `BP/recipes/blocks/machinery/machines/${name}.json`;
const archivedRecipe = `extras/legacy_recipes/${legacy}.json`;
const oldRecipe = await load(await read(archivedRecipe).then(() => archivedRecipe, () => recipePath(legacy)));
const basicRecipe = structuredClone(oldRecipe);
const basic = basicRecipe["minecraft:recipe_shaped"];
basic.description.identifier = "utilitycraft:steam_boiler";
basic.result.item = "utilitycraft:steam_boiler";
basic.tags = ["utilitycraft_workbench"];
basic.key.A.item = "utilitycraft:basic_chip";
basic.unlock = [{ item: "minecraft:blast_furnace" }];
const advancedRecipe = structuredClone(oldRecipe);
const advanced = advancedRecipe["minecraft:recipe_shaped"];
advanced.description.identifier = "utilitycraft:vaporizer";
advanced.result.item = "utilitycraft:vaporizer";
advanced.tags = ["utilitycraft_workbench"];
advanced.key.B.item = "utilitycraft:steam_boiler";
advanced.unlock = [{ item: "utilitycraft:steam_boiler" }];

for (const [id, profile] of Object.entries(STEAM_MACHINES).filter(([, p]) => !p.legacy)) {
    const name = id.split(":")[1];
    const data = structuredClone(legacyBlock);
    const b = data["minecraft:block"];
    b.description.identifier = id;
    b.description.menu_category.category = "construction";
    b.description.menu_category.group = name === "vaporizer" ? "at:itemGroup.name.superior_machines" : "at:itemGroup.name.machines";
    for (const state of ["off", "on"]) {
        const faces = splitAtlas(PNG.sync.read(await readFile(new URL(`RP/textures/blocks/machines/new/${name}_${state}.png`, root))));
        for (const [face, pixels] of Object.entries(faces)) {
            const texture = `textures/blocks/machines/${name}_${state}_${face}`;
            await writeFile(new URL(`RP/${texture}.png`, root), PNG.sync.write(pixels));
            terrain.texture_data[`utilitycraft_${name}_${state}_${face}`] = { textures: texture };
        }
    }
    const materials = [b.components["minecraft:material_instances"], ...b.permutations.map(p => p.components["minecraft:material_instances"]).filter(Boolean)];
    for (const materialSet of materials) for (const material of Object.values(materialSet)) material.texture = material.texture.replace(legacy, name);
    rpBlocks[id] = { sound: "metal", textures: Object.fromEntries(["north", "south", "east", "west", "up", "down"].map(face => [face, `utilitycraft_${name}_off_${face}`])) };
    const component = b.components[`utilitycraft:${legacy}`];
    if (name === "steam_boiler") component.entity.fixed_fluid_types = true;
    delete b.components[`utilitycraft:${legacy}`];
    b.components[id] = component;
    Object.assign(component.machine, {
        energy_cap: profile.energyCapacity, energy_cost: name === "steam_boiler" ? STEAM_BOILER_RECIPE.cost : 1600,
        rate_speed_base: profile.baseRate, fluid_cap: profile.tankCapacity, gas_cap: profile.tankCapacity,
        upgrades: profile.slots,
    });
    b.components["utilitycraft:machine_upgrades"] = b.components["utilitycraft:machine_upgrades"].slice(0, profile.slots.length);
    b.components["utilitycraft:machine_recipes"].type = profile.recipeType;
    await save(blockPath(name), data);
    await save(recipePath(name), name === "steam_boiler" ? basicRecipe : advancedRecipe);

    const ui = replace(legacyUI, legacy, name);
    for (const control of ui[`${name}_top`].controls) {
        const upgrades = control["upgrades_tab@uc.upgrades_tab"];
        if (upgrades && profile.slots.length === 2) {
            upgrades.$has_third_upgrade = false;
            upgrades.$has_fourth_upgrade = false;
        }
        const io = control["io_tab@at_common.machine_io_tab"];
        if (io) for (const key of Object.keys(io).filter(k => k.endsWith("_texture"))) {
            const face = io[key].split("_off_")[1];
            io[key] = terrain.texture_data[`utilitycraft_${name}_off_${face}`].textures;
        }
        const book = control["recipe_book@at_machine_recipes.book"];
        if (book) {
            book.$recipe_rows = `at_steam_recipes.${name}_rows`;
            book.$recipe_selection = `at_steam_recipes.${name}_selection`;
        }
    }
    await save(`RP/ui/${name}.json`, ui);
    const rows = replace(books[`${legacy}_rows`], legacy, name);
    const selection = replace(books[`${legacy}_selection`], legacy, name);
    const toggles = rows.controls[0].row_0.controls;
    if (name === "steam_boiler") {
        toggles.splice(1);
        selection.controls.splice(1);
    }
    for (const [i, toggle] of toggles.entries()) Object.values(toggle)[0].$toggle_index = (name === "steam_boiler" ? 7100 : 7200) + i;
    // Keep amounts unambiguous; the source book predates current fluid units.
    for (const [i, panel] of selection.controls.entries()) {
        const recipe = name === "steam_boiler" ? STEAM_BOILER_RECIPE : Object.values(VAPORIZER_RECIPES)[i];
        for (const control of Object.values(panel)[0].controls) {
            if (control.input_amount) control.input_amount.text = `${recipe.inputFluid.amount} mB`;
            if (control.output_amount) control.output_amount.text = `${recipe.outputGas.amount} mB`;
            if (control.details) control.details.text = `${recipe.cost} DE / ${recipe.ticks / 20} s`;
            if (control.arrow) control.arrow.texture = "textures/ui/steam_recipe_arrow";
        }
    }
    generatedBooks[`${name}_rows`] = rows;
    generatedBooks[`${name}_selection`] = selection;
}
await save("RP/ui/recipes/steam_machines.json", generatedBooks);
await save("RP/textures/terrain_texture.json", terrain);
await save("RP/blocks.json", rpBlocks);

// Source JSON UI contains comments; preserve its existing formatting and routing.
let chest = await read("RP/ui/chest_screen.json");
for (const name of ["steam_boiler", "vaporizer"]) {
    if (chest.includes(`entity.utilitycraft:${name}.name`)) continue;
    const routing = { array_name: "variables", operation: "insert_back", value: [{
        requires: `($temp_container_title = 'entity.utilitycraft:${name}.name')`,
        $screen_content: `${name}.utility_panel`, $screen_bg_content: "common.screen_background",
    }] };
    chest = chest.replace("// Vaporworks Processor", `${JSON.stringify(routing, null, 2).replaceAll("\n", "\n      ")},\n      // Vaporworks Processor`);
}
await writeFile(new URL("RP/ui/chest_screen.json", root), chest);
let defsText = await read("RP/ui/_ui_defs.json");
const defs = parse(defsText);
for (const file of ["ui/steam_boiler.json", "ui/vaporizer.json", "ui/recipes/steam_machines.json"]) {
    if (!defs.ui_defs.includes(file)) defsText = defsText.replace('"ui/vaporworks_processor.json"', `"${file}",\n                    "ui/vaporworks_processor.json"`);
}
await writeFile(new URL("RP/ui/_ui_defs.json", root), defsText);

// Restore Alchemy as a group: recipe, creative visibility and catalogue.
const alchemy = await load(blockPath("alchemical_station"));
alchemy["minecraft:block"].description.menu_category.category = "construction";
await save(blockPath("alchemical_station"), alchemy);
await copyFile(new URL("extras/paused_recipes/blocks/machinery/machines/alchemical_station.json", root), new URL(recipePath("alchemical_station"), root));
const catalog = await load("BP/item_catalog/crafting_item_catalog.json");
for (const category of catalog["minecraft:crafting_items_catalog"].categories) {
    for (const group of category.groups) {
        if (!group.items) continue;
        group.items = group.items.filter(id => !["utilitycraft:vaporworks_processor", "utilitycraft:steam_boiler", "utilitycraft:vaporizer"].includes(id));
        if (group.group_identifier?.name === "at:itemGroup.name.machines") group.items.push("utilitycraft:steam_boiler");
        if (group.group_identifier?.name === "at:itemGroup.name.superior_machines") group.items.push("utilitycraft:vaporizer");
        if (group.items.includes("utilitycraft:energizer") && !group.items.includes("utilitycraft:alchemical_station")) group.items.push("utilitycraft:alchemical_station");
    }
}
await save("BP/item_catalog/crafting_item_catalog.json", catalog);

await save(archivedRecipe, oldRecipe);
await unlink(new URL(recipePath(legacy), root)).catch(error => { if (error.code !== "ENOENT") throw error; });
await writeFile(new URL(blockPath(legacy), root), (await read(blockPath(legacy))).replace('"category": "construction"', '"category": "none"'));

for (const file of (await readdir(new URL("RP/texts/", root))).filter(f => f.endsWith(".lang"))) {
    let text = await read(`RP/texts/${file}`);
    const pt = file.startsWith("pt_");
    const lines = [];
    for (const [name, title] of [["steam_boiler", pt ? "Caldeira de Vapor" : "Steam Boiler"], ["vaporizer", pt ? "Vaporizador" : "Vaporizer"]]) {
        const boiler = name === "steam_boiler";
        const description = pt
            ? boiler ? "§7Converte água em vapor para máquinas industriais.\\n§7Tanques: 32.000 mB de água e de vapor.\\n§7Energia: 128 kDE · 2.400 DE por lote.\\n§7Produz 1.000 mB em 8 s, sem melhorias.\\n§7Aceita melhorias: §a§r, §b§r"
                : "§7Produção avançada de vapor a partir de líquidos.\\n§7Aceita água, Cryofluid e fluido salino.\\n§7Tanques: 128.000 mB · Energia: 1,024 MDE.\\n§7Água: 1.000 mB de vapor em 4 s, por 1.600 DE.\\n§7Fluidos especiais rendem 50% mais vapor.\\n§7Aceita melhorias: §a§r, §b§r, §d§r, §6§r"
            : boiler ? "§7Converts water into steam for industrial machines.\\n§7Tanks: 32,000 mB each for water and steam.\\n§7Energy: 128 kDE · 2,400 DE per batch.\\n§7Produces 1,000 mB in 8 s before upgrades.\\n§7Accepts upgrades: §a§r, §b§r"
                : "§7Advanced steam production from liquids.\\n§7Accepts water, Cryofluid and Saline Coolant.\\n§7Tanks: 128,000 mB · Energy: 1.024 MDE.\\n§7Water: 1,000 mB steam in 4 s for 1,600 DE.\\n§7Special fluids yield 50% more steam.\\n§7Accepts upgrades: §a§r, §b§r, §d§r, §6§r";
        lines.push(`tile.utilitycraft:${name}.name=${title}`, `tile.utilitycraft:${name}.tooltip=§r${description}`, `entity.utilitycraft:${name}.name=${title}`);
        for (const kind of ["items", "liquids", "gases"]) {
            const sourceKey = `ui.utilitycraft:io.${legacy}.${kind}=`;
            const sourceLine = text.split(/\r?\n/).find(l => l.startsWith(sourceKey));
            if (sourceLine) lines.push(sourceLine.replace(`io.${legacy}.`, `io.${name}.`));
        }
        lines.push(`ui.utilitycraft:info.${name}=${pt
            ? name === "steam_boiler" ? "Converte água em vapor usando energia. 2 melhorias; 128 kDE; tanques de 32000 mB. 1000 mB → 1000 mB; 2400 DE; 8 s. Evolui para o Vaporizador."
                : "Processamento avançado de vapor. 4 melhorias; 1,024 MDE; tanques de 128000 mB. Aceita água, Cryofluid e fluido salino."
            : name === "steam_boiler" ? "Converts water into steam using energy. 2 upgrades; 128 kDE; 32000 mB tanks. 1000 mB → 1000 mB; 2400 DE; 8 s. Upgrades to the Vaporizer."
                : "Advanced steam processing. 4 upgrades; 1.024 MDE; 128000 mB tanks. Accepts water, Cryofluid and Saline Coolant."}`);
        for (const source of text.split(/\r?\n/).filter(l => l.startsWith(`ui.ascendant:recipe_book.${legacy}.`))) {
            if (name === "steam_boiler" && !source.startsWith(`ui.ascendant:recipe_book.${legacy}.0.`)) continue;
            lines.push(source.replace(`recipe_book.${legacy}.`, `recipe_book.${name}.`));
        }
        const infoIndex = lines.findIndex(line => line.startsWith(`ui.utilitycraft:info.${name}=`));
        lines[infoIndex] += pt
            ? "\\n\\n§eOperação\\n§rForneça energia e líquido pela rede ou pelo slot de recipientes. Baldes vazios retornam ao slot inferior. Coloque cápsulas vazias no lado da saída para recolher vapor.\\n\\n§eAutomação\\n§rConfigure itens, líquidos e gases separadamente no painel I/O. A entrada recebe líquido; a saída de gás pode abastecer a Arc-Press Forge. O processamento pausa se faltar energia ou líquido, ou se o tanque de saída estiver cheio.\\n\\n§eMelhorias\\n§rOs valores do livro são os valores-base; melhorias e overclock alteram o processamento."
            : "\\n\\n§eOperation\\n§rSupply energy and liquid through the network or container slot. Empty buckets return to the lower slot. Insert empty capsules on the output side to collect steam.\\n\\n§eAutomation\\n§rConfigure items, liquids and gases separately in the I/O panel. The liquid input receives fluid; gas output can supply the Arc-Press Forge. Processing pauses without energy or liquid, or when the output tank is full.\\n\\n§eUpgrades\\n§rThe recipe book shows base values; upgrades and overclock affect processing.";
    }
    const keys = new Set(lines.map(l => l.split("=")[0]));
    text = text.split(/\r?\n/).filter(l => !keys.has(l.split("=")[0])).map(l => l.startsWith("ui.ascendant:alchemy.recipe_cost=") ? l.replace("50 mB", "250 mB") : l).join("\n").trimEnd();
    await writeFile(new URL(`RP/texts/${file}`, root), text + "\n\n" + lines.join("\n") + "\n");
}
console.log("Generated Steam Boiler, Vaporizer, UI/books/locales; restored Alchemy acquisition; retained legacy Vaporworks.");

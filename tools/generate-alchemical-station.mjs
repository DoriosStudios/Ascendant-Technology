import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSplit } from "./split_faces.mjs";
import { ALCHEMY as C, ALCHEMY_SLOTS as S, ALCHEMY_POTION_COMPONENTS, CUSTOM_POTIONS, POTION_FAMILIES } from "../BP/scripts/config/alchemy.js";
import { BREWING_RECIPES } from "../BP/scripts/ATCore/alchemy/recipes.js";
import { POTION_GROUP, generateAlchemicalPotions, defaultName } from "./generate-alchemical-potions.mjs";
import { potionTexture } from "./generate-alchemical-icons.mjs";

const root = new URL("../", import.meta.url);
const json = async (file, data) => {
    const url = new URL(file, root);
    await mkdir(new URL("./", url), { recursive: true });
    await writeFile(url, JSON.stringify(data, null, 4) + "\n");
};
const read = async file => JSON.parse((await readFile(new URL(file, root), "utf8")).replace(/^\uFEFF/, ""));
const entries = {};
for (const [id, p] of Object.entries(CUSTOM_POTIONS)) {
    const f = POTION_FAMILIES.find(f => f.id === p.family);
    const icon = `utilitycraft_alchemical_${f.id}_${p.form}`;
    entries[icon] = { textures: potionTexture(f, p.form) };
    const components = {
        "minecraft:icon": icon,
        "minecraft:display_name": { value: `item.${id}.name` },
        "minecraft:max_stack_size": 1,
        [p.form === "drink" ? ALCHEMY_POTION_COMPONENTS.drink : ALCHEMY_POTION_COMPONENTS.throwable]: {},
    };
    if (p.form === "drink") Object.assign(components, {
        "minecraft:food": { nutrition: 0, saturation_modifier: 0, can_always_eat: true, using_converts_to: "minecraft:glass_bottle" },
        "minecraft:use_animation": "drink",
        "minecraft:use_modifiers": { use_duration: 1.6, movement_modifier: 0.35 },
    });
    else components["minecraft:cooldown"] = { category: "alchemical_potion", duration: 0.5 };
    await json(`BP/items/alchemy/${id.split(":")[1]}.json`, {
        format_version: "1.21.100",
        "minecraft:item": { description: { identifier: id, menu_category: { category: "equipment", group: POTION_GROUP } }, components },
    });
}
const atlas = await read("RP/textures/item_texture.json");
Object.assign(atlas.texture_data, entries);
await json("RP/textures/item_texture.json", atlas);

const components = {
    "utilitycraft:fluid_container": {},
    "utilitycraft:alchemical_station": {
        entity: { type: "fluid_machine", inventory_size: S.size, fixed_fluid_types: true },
        machine: { energy_cap: C.energyCapacity, energy_cost: C.brewEnergy,
            rate_speed_base: C.brewEnergy / C.brewTicks, fluid_cap: C.aetheriumCapacity,
            fluid_types: 2, upgrades: [S.speed, S.efficiency] },
    },
    "utilitycraft:machine_upgrades": [{ type: "speed", slot: S.speed }, { type: "energy", slot: S.efficiency }],
    "minecraft:geometry": "minecraft:geometry.full_block",
    "minecraft:material_instances": Object.fromEntries(["*", "north", "south", "east", "west", "up", "down"].map(face => [face, {
        texture: `utilitycraft_alchemical_station_off_${face === "*" ? "north" : face}`, render_method: "alpha_test",
    }])),
    "minecraft:tick": { interval_range: [4, 4] },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 1.5 },
    "minecraft:destructible_by_explosion": false,
    "tag:dorios:machine": {}, "tag:dorios:energy": {}, "tag:dorios:fluid": {}, "tag:dorios:item": {},
    "tag:minecraft:is_pickaxe_item_destructible": {},
};
await json("BP/blocks/machinery/machines/alchemical_station.json", {
    format_version: "1.21.100", "minecraft:block": {
        description: { identifier: "utilitycraft:alchemical_station", menu_category: { category: "construction" },
            traits: { "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 } },
            states: { "utilitycraft:on": [false, true] } },
        components,
        permutations: [{ condition: "q.block_state('utilitycraft:on') == 1", components: { "minecraft:light_emission": 4 } },
            ...[["north", 0], ["south", 180], ["east", -90], ["west", 90]].map(([face, y]) => ({
                condition: `q.block_state('minecraft:cardinal_direction') == '${face}'`, components: { "minecraft:transformation": { rotation: [0, y, 0] } },
            }))],
    },
});
const terrain = await read("RP/textures/terrain_texture.json");
terrain.texture_data.utilitycraft_alchemical_station = { textures: "textures/blocks/alchemy_table" };
await writeFile(new URL("RP/textures/terrain_texture.json", root), JSON.stringify(terrain, null, "\t") + "\n");
// Regeneration must keep the six cropped faces wired to the full-block model.
for (const { file, contents } of prepareSplit(fileURLToPath(root), ["alchemical_station"]).plan) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contents);
}
let blocks = await readFile(new URL("RP/blocks.json", root), "utf8");
if (!blocks.includes('"utilitycraft:alchemical_station"')) blocks = blocks.replace(/\{/, '{\n\t"utilitycraft:alchemical_station": { "sound": "wood" },');
await writeFile(new URL("RP/blocks.json", root), blocks);
const faces = (up, side, down = side, w = 16, d = 16, h = 2) => Object.fromEntries(
    ["up", "down", "north", "south", "east", "west"].map(face => [face, { uv: face === "up" ? up : face === "down" ? down : side,
        uv_size: face === "up" || face === "down" ? [w, d] : [face === "east" || face === "west" ? d : w, h] }]),
);
await json("RP/models/blocks/alchemical_station.geo.json", {
    format_version: "1.12.0", "minecraft:geometry": [{ description: { identifier: "geometry.alchemical_station", texture_width: 64, texture_height: 64,
        visible_bounds_width: 2, visible_bounds_height: 2, visible_bounds_offset: [0, 0.5, 0] }, bones: [{ name: "table", pivot: [0, 0, 0], cubes: [
            { origin: [-8, 10, -8], size: [16, 2, 16], uv: faces([16, 0], [0, 16]) },
            ...[-7, 5].flatMap(x => [-7, 5].map(z => ({ origin: [x, 0, z], size: [2, 10, 2], uv: faces([0, 32], [0, 32], [0, 32], 2, 2, 10) }))),
            { origin: [-5, 12, -3], size: [10, 1, 6], uv: faces([32, 16], [32, 16], [32, 16], 10, 6, 1) },
            { origin: [-1, 13, -1], size: [2, 3, 2], uv: faces([0, 16], [0, 16], [0, 16], 2, 2, 3) },
        ] }] }],
});
const recipeKey = { P: "utilitycraft:titanium_plate", A: "utilitycraft:aetherium", C: "utilitycraft:absolute_chip",
    B: "minecraft:brewing_stand", R: "utilitycraft:reinforced_machine_case" };
await json("BP/recipes/blocks/machinery/machines/alchemical_station.json", {
    format_version: "1.20.80", "minecraft:recipe_shaped": { description: { identifier: "utilitycraft:alchemical_station" },
        tags: ["utilitycraft_workbench"], pattern: ["PAP", "CBC", "PRP"],
        key: Object.fromEntries(Object.entries(recipeKey).map(([k, item]) => [k, { item }])),
        result: { item: "utilitycraft:alchemical_station", count: 1 }, unlock: [{ item: "minecraft:brewing_stand" }] },
});

await json("BP/entities/alchemy/potion_projectile.json", {
    format_version: "1.21.0", "minecraft:entity": { description: { identifier: "utilitycraft:alchemical_potion_projectile", is_spawnable: false, is_summonable: true },
        components: { "minecraft:collision_box": { width: 0.25, height: 0.25 }, "minecraft:physics": {}, "minecraft:pushable": { is_pushable: false },
            "minecraft:projectile": { gravity: 0.05, power: 0.6, anchor: 1, offset: [0, 0, 0],
                on_hit: { definition_event: { affect_projectile: true, event_trigger: { event: "ascendant:impact", target: "self" } } } },
            "minecraft:timer": { time: 30, looping: false, time_down_event: { event: "ascendant:expire", target: "self" } } },
        component_groups: { "ascendant:expired": { "minecraft:instant_despawn": {} } },
        events: { "ascendant:impact": { queue_command: { command: "scriptevent ascendant:alchemical_impact" } },
            "ascendant:expire": { add: { component_groups: ["ascendant:expired"] } } } },
});
await json("BP/entities/alchemy/potion_cloud.json", {
    format_version: "1.21.0", "minecraft:entity": { description: { identifier: "utilitycraft:alchemical_potion_cloud", is_spawnable: false, is_summonable: true },
        components: { "minecraft:collision_box": { width: 0, height: 0 }, "minecraft:physics": { has_gravity: false, has_collision: false }, "minecraft:persistent": {},
            "minecraft:damage_sensor": { triggers: [{ cause: "all", deals_damage: "no" }] },
            "minecraft:timer": { time: 30, looping: false, time_down_event: { event: "ascendant:expire", target: "self" } } },
        component_groups: { "ascendant:expired": { "minecraft:instant_despawn": {} } },
        events: { "ascendant:expire": { add: { component_groups: ["ascendant:expired"] } } } },
});
await json("RP/entity/alchemical_potion.entity.json", {
    format_version: "1.10.0", "minecraft:client_entity": { description: { identifier: "utilitycraft:alchemical_potion_projectile",
        materials: { default: "entity_alphatest" }, textures: { default: "textures/items/potion_bottle_splash" },
        geometry: { default: "geometry.alchemical_potion" }, render_controllers: ["controller.render.alchemical_potion"],
        animations: { billboard: "animation.alchemical_potion.billboard" }, scripts: { animate: ["billboard"] } } },
});
await json("RP/animations/alchemical_potion.animation.json", {
    format_version: "1.8.0", animations: { "animation.alchemical_potion.billboard": {
        loop: true, bones: { bottle: { rotation: ["query.rotation_to_camera(0)", "query.rotation_to_camera(1) - query.body_y_rotation", 0] } },
    } },
});
await json("RP/entity/alchemical_cloud.entity.json", {
    format_version: "1.10.0", "minecraft:client_entity": { description: { identifier: "utilitycraft:alchemical_potion_cloud",
        materials: { default: "entity_alphatest" }, textures: { default: "textures/items/potion_bottle_splash" },
        geometry: { default: "geometry.alchemical_cloud" }, render_controllers: ["controller.render.alchemical_potion"] } },
});
await json("RP/models/entity/alchemical_potion.geo.json", {
    format_version: "1.12.0", "minecraft:geometry": [
        { description: { identifier: "geometry.alchemical_potion", texture_width: 16, texture_height: 16, visible_bounds_width: 1, visible_bounds_height: 1 },
            bones: [{ name: "bottle", pivot: [0, 2, 0], cubes: [{ origin: [-2, 0, 0], size: [4, 4, 0], uv: { north: { uv: [0, 0], uv_size: [16, 16] }, south: { uv: [16, 0], uv_size: [-16, 16] } } }] }] },
        { description: { identifier: "geometry.alchemical_cloud", texture_width: 16, texture_height: 16, visible_bounds_width: 1, visible_bounds_height: 1 }, bones: [{ name: "root", pivot: [0, 0, 0] }] },
    ],
});
await json("RP/render_controllers/alchemical_potion.render_controllers.json", { format_version: "1.8.0", render_controllers: {
    "controller.render.alchemical_potion": { geometry: "Geometry.default", materials: [{ "*": "Material.default" }], textures: ["Texture.default"] },
} });
await json("RP/particles/alchemical_cloud.json", { format_version: "1.10.0", particle_effect: {
    description: { identifier: "ascendant:alchemical_cloud", basic_render_parameters: { material: "particles_alpha", texture: "textures/particle/particles" } },
    components: { "minecraft:emitter_rate_instant": { num_particles: 12 }, "minecraft:emitter_lifetime_once": { active_time: 0.1 },
        "minecraft:emitter_shape_sphere": { radius: 2, direction: "outwards" }, "minecraft:particle_lifetime_expression": { max_lifetime: 1 },
        "minecraft:particle_initial_speed": 0.05,
        "minecraft:particle_appearance_billboard": { size: [0.08, 0.08], facing_camera_mode: "lookat_xyz",
            uv: { texture_width: 128, texture_height: 128, uv: [0, 0], uv_size: [8, 8] } },
        "minecraft:particle_appearance_tinting": { color: [0.7, 0.3, 1, 0.6] } },
} });

await generateUI();
await localize();
await generateAlchemicalPotions();
console.log(`Generated Alchemical Station, ${Object.keys(CUSTOM_POTIONS).length} potion items, ${POTION_FAMILIES.length} families and ${BREWING_RECIPES.length} brewing recipes.`);

async function generateUI() {
    const { generateAlchemicalUI } = await import("./generate-alchemical-ui.mjs");
    await generateAlchemicalUI();
}

async function localize() {
    const pt = { swiftness: "Agilidade", slowness: "Lentidão", leaping: "Salto", strength: "Força", healing: "Cura", harming: "Dano",
        poison: "Veneno", regeneration: "Regeneração", nightvision: "Visão Noturna", invisibility: "Invisibilidade", fire_resistance: "Resistência ao Fogo",
        water_breathing: "Respiração Aquática", weakness: "Fraqueza", slow_falling: "Queda Lenta", turtle_master: "Mestre Tartaruga",
        wind_charged: "Carga de Vento", weaving: "Tecelagem", oozing: "Exsudação", infested: "Infestação", haste: "Pressa", resistance: "Resistência",
        absorption: "Absorção", health_boost: "Vida Extra", wither: "Decomposição", levitation: "Levitação", blindness: "Cegueira", darkness: "Escuridão", saturation: "Saturação",
        water: "Frasco de Água", awkward: "Poção Estranha", mundane: "Poção Comum", thick: "Poção Espessa",
        "Level I": "Nível I", "Long I": "Nível I Estendido", "Strong (when supported)": "Potência (quando disponível)",
        Drink: "Comum", Splash: "Arremessável", Lingering: "Persistente", nether_wart: "Fungo do Nether",
        sugar: "Açúcar", rabbit_foot: "Pé de Coelho", blaze_powder: "Pó de Blaze", glistering_melon_slice: "Melancia Reluzente",
        spider_eye: "Olho de Aranha", ghast_tear: "Lágrima de Ghast", golden_carrot: "Cenoura Dourada", magma_cream: "Creme de Magma",
        pufferfish: "Baiacu", fermented_spider_eye: "Olho de Aranha Fermentado", phantom_membrane: "Membrana de Phantom",
        turtle_helmet: "Casco de Tartaruga", breeze_rod: "Vara de Breeze", web: "Teia de Aranha", slime: "Bloco de Slime", stone: "Pedra",
        titanium_dust: "Pó de Titânio", aetherium_dust: "Pó de Aetherium", golden_apple: "Maçã Dourada",
        refined_aetherium_crystal: "Cristal de Aetherium Refinado", wither_rose: "Rosa de Wither", shulker_shell: "Casco de Shulker",
        ink_sac: "Bolsa de Tinta", echo_shard: "Fragmento de Eco", enchanted_golden_apple: "Maçã Dourada Encantada",
        redstone: "Redstone", glowstone_dust: "Pó de Pedra Luminosa", gunpowder: "Pólvora", dragon_breath: "Bafo do Dragão" };
    const title = s => s.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
    for (const file of (await readdir(new URL("RP/texts/", root))).filter(f => f.endsWith(".lang"))) {
        const portuguese = file.startsWith("pt_");
        const name = portuguese ? "Estação Alquímica" : "Alchemical Station";
        const lines = [`tile.utilitycraft:alchemical_station.name=${name}`, `entity.utilitycraft:alchemical_station.name=${name}`,
            `ui.ascendant:alchemy.amplify=${portuguese ? "Amplificar" : "Amplify"}`,
            `ui.ascendant:alchemy.extend=${portuguese ? "Estender" : "Extend"}`,
            `ui.ascendant:alchemy.information=${portuguese ? "Informações" : "Information"}`,
            `ui.ascendant:alchemy.batch=${portuguese ? "1 ingrediente → até 6 poções" : "1 reagent → up to 6 potions"}`,
            `ui.ascendant:alchemy.recipe_cost=12,000 DE · 50 mB Blaze · ×6`,
            `ui.ascendant:alchemy.io.items=${portuguese ? "Modos I/O:\\n§9E1: frascos\\n§9E2: reagente\\n§9E3: blaze\\n§cS: frascos\\n§c   vazios" : "I/O Modes:\\n§9IN 1: bottles\\n§9IN 2: reagent\\n§9IN 3: blaze\\n§cOUT: empty\\n§c     bottles"}`,
            `ui.ascendant:alchemy.io.fluids=${portuguese ? "Entrada:\\n§9Aetherium\\n§rTanque 1" : "Input:\\n§9Aetherium\\n§rTank 1"}`,
            `ui.ascendant:alchemy.help=${portuguese
                ? "§eBrewing\\n§r1. Coloque até 6 frascos nos pares inferiores.\\n2. Coloque o reagente no slot central superior.\\n3. Abasteça o slot de combustível com pó de blaze.\\nO preparo começa automaticamente quando há energia e recursos.\\nUm reagente é consumido por lote.\\n\\n§eAplifying\\n§rEsquerda: aumenta o nível (1000 mB).\\nDireita: estende a duração (750 mB).\\nColoque a poção e pressione o botão abaixo do seu slot.\\nAmbas usam Aetherium líquido.\\nPoções incompatíveis ou no limite não podem ser melhoradas.\\n\\n§eTanques\\n§rBlaze: 64000 mB; 1000 mB por pó.\\nAetherium: 128000 mB; entrada de fluido."
                : "§eBrewing\\n§r1. Place up to 6 bottles in the lower pairs.\\n2. Place the reagent in the upper middle slot.\\n3. Put blaze powder in the fuel slot.\\nBrewing starts automatically with energy and resources.\\nOne reagent is consumed per batch.\\n\\n§eAplifying\\n§rLeft: increases level (1000 mB).\\nRight: extends duration (750 mB).\\nPlace a potion and press the button below its slot.\\nBoth use liquid Aetherium.\\nUnsupported potions and maximum upgrades cannot be improved.\\n\\n§eTanks\\n§rBlaze: 64000 mB; 1000 mB per powder.\\nAetherium: 128000 mB; fluid input."}`,
        ];
        const display = s => portuguese ? (pt[s] ?? title(s)) : title(s);
        for (const [id, p] of Object.entries(CUSTOM_POTIONS)) {
            const prefix = portuguese ? (p.form === "splash" ? "Poção Arremessável" : p.form === "lingering" ? "Poção Persistente" : "Poção")
                : (p.form === "splash" ? "Splash Potion" : p.form === "lingering" ? "Lingering Potion" : "Potion");
            const title = POTION_FAMILIES.find(f => f.id === p.family).statsCore ? defaultName(p, file.slice(0, -5))
                : `${prefix} ${portuguese ? "de" : "of"} ${display(p.family)} ${["", "I", "II", "III", "IV", "V"][p.level]}`;
            lines.push(`item.${id}.name=${title}`);
        }
        for (const [i, r] of BREWING_RECIPES.entries()) lines.push(`ui.ascendant:alchemy.recipe.${i}=${display(r.input)} + ${display(r.ingredient.split(":")[1])}\\n→ ${display(r.output)}`);
        let content = await readFile(new URL(`RP/texts/${file}`, root), "utf8");
        const keys = new Set(lines.map(l => l.split("=")[0]));
        content = content.split(/\r?\n/).filter(l => !keys.has(l.split("=")[0])).join("\n").trimEnd();
        await writeFile(new URL(`RP/texts/${file}`, root), content + "\n\n" + lines.join("\n") + "\n");
    }
}

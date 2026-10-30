import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CUSTOM_POTIONS, POTION_FAMILIES, ALCHEMY_POTION_COMPONENTS, potionDescriptionEffects, formatPotionDuration, potionLevelLabel, potionEffectColor } from "../BP/scripts/config/alchemy.js";
import { potionTexture } from "./generate-alchemical-icons.mjs";
import { BREWING_RECIPES } from "../BP/scripts/ATCore/alchemy/recipes.js";

const root = new URL("../", import.meta.url);
export const POTION_GROUP = "at:itemGroup.name.alchemical_potions";
const names = {
    speed: ["Speed", "Velocidade"], slowness: ["Slowness", "Lentidão"], jump_boost: ["Jump Boost", "Supersalto"],
    strength: ["Strength", "Força"], instant_health: ["Instant Health", "Vida Instantânea"], instant_damage: ["Instant Damage", "Dano Instantâneo"],
    poison: ["Poison", "Veneno"], regeneration: ["Regeneration", "Regeneração"], night_vision: ["Night Vision", "Visão Noturna"],
    invisibility: ["Invisibility", "Invisibilidade"], fire_resistance: ["Fire Resistance", "Resistência ao Fogo"],
    water_breathing: ["Water Breathing", "Respiração Aquática"], weakness: ["Weakness", "Fraqueza"], slow_falling: ["Slow Falling", "Queda Lenta"],
    wind_charged: ["Wind Charged", "Carga de Vento"], weaving: ["Weaving", "Tecelagem"], oozing: ["Oozing", "Exsudação"],
    infested: ["Infested", "Infestação"], haste: ["Haste", "Pressa"], resistance: ["Resistance", "Resistência"],
    absorption: ["Absorption", "Absorção"], health_boost: ["Health Boost", "Vida Extra"], wither: ["Wither", "Decomposição"],
    levitation: ["Levitation", "Levitação"], blindness: ["Blindness", "Cegueira"], darkness: ["Darkness", "Escuridão"], saturation: ["Saturation", "Saturação"],
    marked: ["Marked", "Marcação"], bleeding: ["Bleeding", "Sangramento"], blessed: ["Blessing", "Bênção"], cursed: ["Curse", "Maldição"],
    berserk: ["Berserk", "Fúria"], adaptive_resilience: ["Adaptive Resilience", "Resiliência Adaptativa"], soul_collector: ["Soul Collector", "Coletor de Almas"],
};

export function defaultName(p, locale) {
    const pt = locale.startsWith("pt_"), family = POTION_FAMILIES.find(f => f.id === p.family);
    const name = names[family.effect][pt ? 1 : 0];
    const prefix = pt ? (p.form === "splash" ? "Poção Arremessável" : p.form === "lingering" ? "Poção Persistente" : "Poção")
        : (p.form === "splash" ? "Splash Potion" : p.form === "lingering" ? "Lingering Potion" : "Potion");
    return `${prefix} ${pt ? "de" : "of"} ${name} ${potionLevelLabel(p.level)}`;
}

const ptReagents = { nether_wart: "Fungo do Nether", fermented_spider_eye: "Olho de Aranha Fermentado", glowstone_dust: "Pó de Pedra Luminosa",
    redstone: "Redstone", sugar: "Açúcar", rabbit_foot: "Pé de Coelho", blaze_powder: "Pó de Blaze", glistering_melon_slice: "Melancia Reluzente",
    spider_eye: "Olho de Aranha", ghast_tear: "Lágrima de Ghast", golden_carrot: "Cenoura Dourada", magma_cream: "Creme de Magma",
    pufferfish: "Baiacu", phantom_membrane: "Membrana de Phantom", turtle_helmet: "Casco de Tartaruga", breeze_rod: "Vara de Breeze",
    web: "Teia de Aranha", slime: "Bloco de Slime", stone: "Pedra", golden_apple: "Maçã Dourada", wither_rose: "Rosa de Wither",
    shulker_shell: "Casco de Shulker", ink_sac: "Bolsa de Tinta", echo_shard: "Fragmento de Eco", enchanted_golden_apple: "Maçã Dourada Encantada",
    ender_eye: "Olho do Ender", sweet_berries: "Bagas Doces", glow_berries: "Bagas Luminosas", fire_charge: "Bola de Fogo",
    gunpowder: "Pólvora", dragon_breath: "Bafo do Dragão", water: "Frasco de Água", awkward: "Poção Estranha", mundane: "Poção Comum", thick: "Poção Espessa",
    "Level I": "Nível I", "Long I": "Nível I Estendido", "Strong (when supported)": "Potência (quando disponível)",
    Drink: "Comum", Splash: "Arremessável", Lingering: "Persistente" };

function newPotionItem(id, p) {
    const icon = `utilitycraft_alchemical_${p.family}_${p.form}`;
    const components = { "minecraft:icon": icon, "minecraft:display_name": { value: `item.${id}.name` }, "minecraft:max_stack_size": 1,
        [p.form === "drink" ? ALCHEMY_POTION_COMPONENTS.drink : ALCHEMY_POTION_COMPONENTS.throwable]: {} };
    if (p.form === "drink") Object.assign(components, {
        "minecraft:food": { nutrition: 0, saturation_modifier: 0, can_always_eat: true, using_converts_to: "minecraft:glass_bottle" },
        "minecraft:use_animation": "drink", "minecraft:use_modifiers": { use_duration: 1.6, movement_modifier: 0.35 },
    });
    else components["minecraft:cooldown"] = { category: "alchemical_potion", duration: 0.5 };
    return { format_version: "1.21.100", "minecraft:item": { description: { identifier: id, menu_category: { category: "equipment", group: POTION_GROUP } }, components } };
}

export function potionDescription(p, locale) {
    const lines = potionDescriptionEffects(p).map(effect => {
        const name = names[effect.id][locale.startsWith("pt_") ? 1 : 0];
        return `${potionEffectColor(effect.id)}${name} ${potionLevelLabel(effect.amplifier + 1)} (${formatPotionDuration(effect.duration)})`;
    });
    const pt = locale.startsWith("pt_");
    if (p.extent === "long") lines.push(`§7${pt ? "Estendida" : "Extended"}`);
    else if (p.extent === "maximum") lines.push(`§7${pt ? "Máxima" : "Maximum"}`);
    return lines.join("\\n");
}

export async function updatePotionCatalog() {
    const file = new URL("BP/item_catalog/crafting_item_catalog.json", root);
    const source = await readFile(file, "utf8"), catalog = JSON.parse(source);
    const categories = catalog["minecraft:crafting_items_catalog"].categories;
    const category = categories.find(c => c.category_name === "equipment");
    for (const other of categories) {
        if (other !== category) other.groups = other.groups.filter(g => g.group_identifier.name !== POTION_GROUP);
    }
    const forms = ["drink", "splash", "lingering"], extents = ["normal", "long", "maximum"];
    const items = Object.keys(CUSTOM_POTIONS).sort((a, b) => {
        const pa = CUSTOM_POTIONS[a], pb = CUSTOM_POTIONS[b];
        return pa.family.localeCompare(pb.family, "en") || forms.indexOf(pa.form) - forms.indexOf(pb.form)
            || pa.level - pb.level || extents.indexOf(pa.extent) - extents.indexOf(pb.extent);
    });
    const group = { group_identifier: { icon: "utilitycraft:alchemical_haste_1_normal_drink", name: POTION_GROUP }, items };
    const existing = category.groups.findIndex(g => g.group_identifier.name === POTION_GROUP);
    if (existing >= 0) category.groups[existing] = group;
    else category.groups.push(group);
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    await writeFile(file, JSON.stringify(catalog, null, 4).replaceAll("\n", newline) + newline);
}

export async function generateAlchemicalPotions() {
    // Target potion items and names only: the station UI may contain manual layout edits.
    await mkdir(new URL("BP/items/alchemy/", root), { recursive: true });
    for (const [id, potion] of Object.entries(CUSTOM_POTIONS)) {
        const file = new URL(`BP/items/alchemy/${id.split(":")[1]}.json`, root);
        let source, item;
        try { source = await readFile(file, "utf8"); item = JSON.parse(source); }
        catch (error) { if (error.code !== "ENOENT") throw error; source = ""; item = newPotionItem(id, potion); }
        item["minecraft:item"].description.menu_category = { category: "equipment", group: POTION_GROUP };
        const newline = source.includes("\r\n") ? "\r\n" : "\n";
        await writeFile(file, JSON.stringify(item, null, 4).replaceAll("\n", newline) + newline);
    }
    const atlasFile = new URL("RP/textures/item_texture.json", root);
    const atlas = JSON.parse(await readFile(atlasFile, "utf8"));
    for (const potion of Object.values(CUSTOM_POTIONS)) {
        const family = POTION_FAMILIES.find(f => f.id === potion.family);
        atlas.texture_data[`utilitycraft_alchemical_${potion.family}_${potion.form}`] = { textures: potionTexture(family, potion.form) };
    }
    await writeFile(atlasFile, JSON.stringify(atlas, null, 4) + "\n");
    await updatePotionCatalog();
    await generateAlchemicalPotionTranslations();
    const { generateAlchemicalRecipeBook } = await import("./generate-alchemical-ui.mjs");
    await generateAlchemicalRecipeBook();
    console.log(`Alchemical potions: ${Object.keys(CUSTOM_POTIONS).length} items in Equipment / ${POTION_GROUP}; estimated effects in all language files.`);
}

export async function generateAlchemicalPotionTranslations() {
    const groupNames = { pt_BR: "Poções Alquímicas", pt_PT: "Poções Alquímicas", de_DE: "Alchemistische Tränke", es_ES: "Pociones alquímicas",
        es_MX: "Pociones alquímicas", fr_FR: "Potions alchimiques", ja_JP: "錬金術のポーション", ru_RU: "Алхимические зелья", zh_CN: "炼金药水" };
    for (const localeFile of (await readdir(new URL("RP/texts/", root))).filter(f => f.endsWith(".lang"))) {
        const locale = localeFile.slice(0, -5), file = new URL(`RP/texts/${localeFile}`, root);
        const source = await readFile(file, "utf8"), newline = source.includes("\r\n") ? "\r\n" : "\n";
        const additions = new Map([[POTION_GROUP, groupNames[locale] ?? "Alchemical Potions"],
            ["ui.ascendant:alchemy.actual_duration", locale.startsWith("pt_") ? "Duração real:" : "Actual duration:"]]);
        for (const [id, labels] of Object.entries(names)) additions.set(`ui.ascendant:alchemy.effect.${id}`, labels[locale.startsWith("pt_") ? 1 : 0]);
        for (const [id, p] of Object.entries(CUSTOM_POTIONS)) {
            additions.set(`item.${id}.name`, defaultName(p, locale));
            additions.set(`tile.${id}.tooltip`, `§r${potionDescription(p, locale)}`);
        }
        const previous = new Map(source.split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).split("\\n")[0]]));
        const display = id => {
            const family = POTION_FAMILIES.find(f => f.id === id);
            if (family) {
                const p = { family: id, form: "drink", level: 1, extent: "normal" };
                return (previous.get(`item.utilitycraft:alchemical_${id}_1_normal_drink.name`) ?? defaultName(p, locale))
                    .replace(/^(Poção de |Potion of )/, "").replace(/ I$/, "");
            }
            const custom = previous.get(`item.utilitycraft:${id}.name`) ?? previous.get(`item.utilitycraft:${id}`) ?? previous.get(`tile.utilitycraft:${id}.name`);
            if (custom) return custom.replace(/§./g, "");
            return (locale.startsWith("pt_") ? ptReagents[id] : undefined) ?? id.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
        };
        for (const [index, recipe] of BREWING_RECIPES.entries()) additions.set(`ui.ascendant:alchemy.recipe.${index}`,
            `${display(recipe.input)} + ${display(recipe.ingredient.split(":")[1])}\\n→ ${display(recipe.output)}`);
        const lines = source.split(/\r?\n/).map(line => {
            const separator = line.indexOf("="), key = line.slice(0, separator);
            const p = key.startsWith("item.") && key.endsWith(".name") ? CUSTOM_POTIONS[key.slice(5, -5)] : undefined;
            if (p) {
                additions.delete(key);
                const title = line.slice(separator + 1).split("\\n")[0].replace(/ · (Extended|Maximum|Estendida|Máxima)$/, "");
                return `${key}=${title}`;
            }
            if (additions.has(key)) { const value = additions.get(key); additions.delete(key); return `${key}=${value}`; }
            return line;
        });
        let content = lines.join(newline).trimEnd() + newline;
        if (additions.size) content += [...additions].map(([key, value]) => `${key}=${value}`).join(newline) + newline;
        await writeFile(file, content);
    }
    console.log(`Alchemical potion translations: ${Object.keys(CUSTOM_POTIONS).length} descriptions with effect colors and separate duration states.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    if (process.argv.includes("--translations-only")) await generateAlchemicalPotionTranslations();
    else await generateAlchemicalPotions();
}

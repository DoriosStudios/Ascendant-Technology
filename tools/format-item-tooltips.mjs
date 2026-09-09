import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// The reference screenshot's longest description line, including the bullet.
const WIDTH = [..."- Increases the amount of items"].length;
const visible = (text) => text.replace(/§./gu, "");
const length = (text) => [...visible(text)].length;
const colors = {
    multi_processing: "m",
    energy_capacity: "b",
    liquid_capacity: "p",
    gas_capacity: "u",
    resource_efficiency: "t",
};
const descriptions = {
    en_US: [
        "Processes 1 additional slot per upgrade.",
        "Adds 50% energy capacity per upgrade.",
        "Adds 50% liquid capacity per upgrade.",
        "Adds 50% gas capacity per upgrade.",
        "5% chance per upgrade to save consumed resources.",
        "Uses an existing upgrade slot.",
        "Maximum: 8 upgrades.",
    ],
    pt_BR: [
        "Processa 1 slot adicional por melhoria.",
        "Adiciona 50% de capacidade de energia por melhoria.",
        "Adiciona 50% de capacidade de líquidos por melhoria.",
        "Adiciona 50% de capacidade de gases por melhoria.",
        "5% de chance por melhoria de preservar recursos consumidos.",
        "Ocupa um slot de melhoria existente.",
        "Máximo: 8 melhorias.",
    ],
    es_MX: [
        "Procesa 1 ranura adicional por mejora.",
        "Añade 50% de capacidad de energía por mejora.",
        "Añade 50% de capacidad de líquidos por mejora.",
        "Añade 50% de capacidad de gases por mejora.",
        "5% de probabilidad por mejora de conservar recursos consumidos.",
        "Ocupa una ranura de mejora existente.",
        "Máximo: 8 mejoras.",
    ],
    fr_FR: [
        "Traite 1 emplacement supplémentaire par amélioration.",
        "Ajoute 50% de capacité énergétique par amélioration.",
        "Ajoute 50% de capacité des liquides par amélioration.",
        "Ajoute 50% de capacité des gaz par amélioration.",
        "5% de chance par amélioration de préserver les ressources consommées.",
        "Occupe un emplacement d’amélioration existant.",
        "Maximum : 8 améliorations.",
    ],
    de_DE: [
        "Verarbeitet 1 zusätzlichen Slot je Upgrade.",
        "50% mehr Energiekapazität je Upgrade.",
        "50% mehr Flüssigkeitskapazität je Upgrade.",
        "50% mehr Gaskapazität je Upgrade.",
        "5% Chance je Upgrade, verbrauchte Ressourcen zu sparen.",
        "Belegt einen vorhandenen Upgrade-Platz.",
        "Maximum: 8 Upgrades.",
    ],
    ru_RU: [
        "Обрабатывает 1 дополнительный слот за улучшение.",
        "+50% ёмкости энергии за улучшение.",
        "+50% ёмкости жидкостей за улучшение.",
        "+50% ёмкости газов за улучшение.",
        "5% шанса за улучшение сохранить расходуемые ресурсы.",
        "Занимает существующий слот улучшения.",
        "Максимум: 8 улучшений.",
    ],
    ja_JP: [
        "1個につき処理スロットが1つ増加。",
        "1個につきエネルギー容量が50%増加。",
        "1個につき液体容量が50%増加。",
        "1個につき気体容量が50%増加。",
        "1個につき消費資源を節約する確率が5%増加。",
        "既存のアップグレードスロットを使用。",
        "最大8個まで。",
    ],
    zh_CN: [
        "每个升级可额外处理1个槽位。",
        "每个升级增加50%能量容量。",
        "每个升级增加50%液体容量。",
        "每个升级增加50%气体容量。",
        "每个升级有5%几率保留消耗的资源。",
        "占用一个已有的升级槽。",
        "最多8个升级。",
    ],
};
descriptions.pt_PT = descriptions.pt_BR;
descriptions.es_ES = descriptions.es_MX;

function wrap(line) {
    if (length(line) <= WIDTH) return [line];
    const indent = line.match(/^ */u)[0];
    const continuation = /^\s*[-•]/u.test(visible(line)) ? indent + "  " : indent;
    const output = [];
    let current = indent;
    for (let word of line.trim().split(/\s+/u)) {
        const gap = current.trim() ? " " : "";
        if (length(current + gap + word) > WIDTH && current.trim()) {
            output.push(current);
            current = continuation;
        }
        // Long individual words/CJK text: split by visible code point, never § codes.
        if (length(current + word) > WIDTH) {
            for (const token of word.match(/§.|[^]/gu) ?? []) {
                if (!token.startsWith("§") && length(current) >= WIDTH) {
                    output.push(current);
                    current = continuation;
                }
                current += token;
            }
        } else current += (current.trim() ? " " : "") + word;
    }
    if (current.trim()) output.push(current);
    return output;
}

const folder = resolve(import.meta.dirname, "../RP/texts");
const checkOnly = process.argv.includes("--check");
let changed = 0;
let checked = 0;
for (const file of readdirSync(folder).filter((name) => name.endsWith(".lang"))) {
    const path = resolve(folder, file);
    const original = readFileSync(path, "utf8");
    const locale = file.slice(0, -5);
    const text = descriptions[locale] ?? descriptions.en_US;
    const updated = original
        .split(/\r?\n/u)
        .map((line) => {
            const match = line.match(/^((?:item|tile|upgrade)\.[^=]+)=(.*)$/u);
            if (!match) return line;
            const [, key] = match;
            let value = match[2];
            const type = Object.keys(colors).find(
                (type) =>
                    key === `item.utilitycraft:${type}_upgrade` ||
                    key === `upgrade.utilitycraft:${type}_upgrade.name`,
            );
            if (type) {
                const name = visible(value.split("\\n")[0]);
                value = `§${colors[type]}${name}`;
                if (key.startsWith("item.")) {
                    const index = Object.keys(colors).indexOf(type);
                    value += `§7\\n- ${text[index]}\\n- ${text[5]}\\n- ${text[6]}\\n§o§9@UC: Ascendant Technology`;
                } else value += "§r";
            }
            if (!key.startsWith("upgrade.")) {
                const [title, ...body] = value.split("\\n");
                const description = body.flatMap(wrap);
                for (const part of description) {
                    if (length(part) > WIDTH) throw new Error(`Overlong tooltip: ${file} ${key}`);
                    checked++;
                }
                value = [title, ...description].join("\\n");
            }
            if (value !== match[2]) changed++;
            return `${key}=${value}`;
        })
        .join(original.includes("\r\n") ? "\r\n" : "\n");
    if (!checkOnly && updated !== original) writeFileSync(path, updated);
}
if (checkOnly && changed) throw new Error(`${changed} tooltips need formatting`);
console.log(
    `${WIDTH} visible characters/line; ${checked} description lines checked; ${changed} entries ${checkOnly ? "need changes" : "updated"}.`,
);

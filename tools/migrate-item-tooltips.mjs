import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// UtilityCraft 75709e2a: Bedrock uses tile.<id>.tooltip for both blocks and items.
export function tooltipKeyForName(key) {
    const match = key.match(/^(?:tile\.|item\.(?:spawn_egg\.entity\.)?)([^=]+?)(?:\.name)?$/u);
    return match && !key.endsWith(".tooltip") ? `tile.${match[1]}.tooltip` : undefined;
}

export function tooltipValue(description, title = "") {
    const value = description.trimEnd();
    // Some upgrade names end in §7 to color the following plain-text description.
    // A native tooltip starts with a reset, so retain that inherited formatting explicitly.
    const inherited = title.trimEnd().match(/(?:§[0-9a-z])+$/iu)?.[0] ?? "";
    const prefix = value.startsWith("§") ? "" : inherited;
    return value.startsWith("§r") ? value : `§r${prefix}${value}`;
}

// Keep names, descriptions, locale-specific formatting and unrelated entries intact.
export function migrateItemDescriptions(source) {
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = source.split(/\r?\n/u);
    const existing = new Set(lines.map(line => line.slice(0, line.indexOf("="))));
    const descriptions = new Map();
    const stripped = lines.map(line => {
        const separator = line.indexOf("=");
        if (separator < 1) return line;
        const key = line.slice(0, separator), tooltipKey = tooltipKeyForName(key);
        const value = line.slice(separator + 1), split = value.indexOf("\\n");
        if (!tooltipKey || split < 0) return line;
        const description = tooltipValue(value.slice(split + 2), value.slice(0, split));
        if (descriptions.has(tooltipKey) && descriptions.get(tooltipKey) !== description) {
            throw new Error(`Conflicting item/block descriptions for ${tooltipKey}`);
        }
        descriptions.set(tooltipKey, description);
        return `${key}=${value.slice(0, split).trimEnd()}`;
    });
    const emitted = new Set();
    return stripped.flatMap(line => {
        const key = line.slice(0, line.indexOf("="));
        if (descriptions.has(key)) return [`${key}=${descriptions.get(key)}`];
        const tooltipKey = tooltipKeyForName(key);
        if (descriptions.has(tooltipKey) && !existing.has(tooltipKey) && !emitted.has(tooltipKey)) {
            emitted.add(tooltipKey);
            return [line, `${tooltipKey}=${descriptions.get(tooltipKey)}`];
        }
        return [line];
    }).join(newline);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const folder = new URL("../RP/texts/", import.meta.url);
    const check = process.argv.includes("--check");
    let changed = 0, migrated = 0;
    for (const file of readdirSync(folder).filter(name => name.endsWith(".lang"))) {
        const path = new URL(file, folder), source = readFileSync(path, "utf8");
        const updated = migrateItemDescriptions(source);
        if (source !== updated) {
            changed++;
            migrated += updated.split(/\r?\n/u).filter(line => /^tile\..*\.tooltip=/u.test(line)).length
                - source.split(/\r?\n/u).filter(line => /^tile\..*\.tooltip=/u.test(line)).length;
            if (!check) writeFileSync(path, updated);
        }
    }
    if (check && changed) throw new Error(`${changed} locales still contain descriptions in item/block names`);
    console.log(`${changed} locales ${check ? "need migration" : "migrated"}; ${migrated} tooltips added.`);
}

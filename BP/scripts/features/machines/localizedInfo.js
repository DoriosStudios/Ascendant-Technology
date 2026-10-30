import { machineInfoTerms } from "../../config/machineInfoTerms.js";

// Translate only known UI phrases; numbers, formatting codes and unknown text
// retain their original spelling. Longest phrases must match before their parts.
const phrases = Object.keys(machineInfoTerms).sort((a, b) => b.length - a.length);
const pattern = new RegExp(phrases.map(text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

export function localizeMachineInfoLine(line) {
    const text = String(line);
    const rawtext = [];
    let end = 0;
    for (const match of text.matchAll(pattern)) {
        // Avoid translating a phrase embedded inside an unrelated item name.
        const start = match.index;
        const next = start + match[0].length;
        const previous = text.slice(0, start).replace(/§./g, "").at(-1) ?? "";
        if (/[A-Za-z]/.test(previous) || /[A-Za-z]/.test(text[next] ?? "")) continue;
        if (start > end) rawtext.push({ text: text.slice(end, start) });
        rawtext.push({ translate: machineInfoTerms[match[0]] });
        end = next;
    }
    if (end < text.length) rawtext.push({ text: text.slice(end) });
    return { rawtext: rawtext.length ? rawtext : [{ text: "" }] };
}

export function setLocalizedMachineInfo(machine, lines) {
    // nameTag accepts only strings; lore supports native RawMessage translation.
    // The engine localizes lore for each viewer before exposing #hover_text.
    let item = machine.container.getItem(1);
    if (!item) {
        machine.setLabel(" ");
        item = machine.container.getItem(1);
    }
    if (!item) return;
    item.nameTag = " ";
    item.setLore(lines.map(localizeMachineInfoLine));
    machine.container.setItem(1, item);
}

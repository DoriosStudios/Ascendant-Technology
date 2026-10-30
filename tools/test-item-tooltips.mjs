import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { migrateItemDescriptions, tooltipKeyForName } from "./migrate-item-tooltips.mjs";
import { CUSTOM_POTIONS } from "../BP/scripts/config/alchemy.js";
import { potionDescription } from "./generate-alchemical-potions.mjs";

test("UtilityCraft tooltip keys support block, item, legacy item and spawn egg names", () => {
    for (const key of ["tile.at:example.name", "item.at:example.name", "item.at:example", "item.spawn_egg.entity.at:example.name"]) {
        assert.equal(tooltipKeyForName(key), "tile.at:example.tooltip");
    }
    for (const key of ["entity.at:example.name", "ui.at:example", "upgrade.at:example.name", "tile.at:example.tooltip"]) {
        assert.equal(tooltipKeyForName(key), undefined);
    }
});

test("migration preserves complete multiline descriptions, reset codes and CRLF without touching UI", () => {
    const source = "## Header\r\nitem.at:example.name=§dTitle\\n§9Effect II (8:00)\\n§7Extended\\n\\n§o§9@AT\r\nui.at:help=Line 1\\nLine 2\r\n";
    const expected = "## Header\r\nitem.at:example.name=§dTitle\r\ntile.at:example.tooltip=§r§9Effect II (8:00)\\n§7Extended\\n\\n§o§9@AT\r\nui.at:help=Line 1\\nLine 2\r\n";
    assert.equal(migrateItemDescriptions(source), expected);
    assert.equal(migrateItemDescriptions(expected), expected);
    assert.equal(migrateItemDescriptions("item.at:upgrade=§dUpgrade§7\\n- Description"),
        "item.at:upgrade=§dUpgrade§7\ntile.at:upgrade.tooltip=§r§7- Description");
});

test("shared item/block aliases generate one tooltip and regenerated descriptions replace stale values", () => {
    const source = "item.at:seed=Seed\\n§7Tier 1\ntile.at:seed.name=Seed\\n§7Tier 1\n";
    const result = migrateItemDescriptions(source);
    assert.equal(result.match(/tile\.at:seed\.tooltip=/g).length, 1);
    assert.equal(migrateItemDescriptions("item.at:seed=Seed\\n§7Tier 2\ntile.at:seed.tooltip=§rOld\n"),
        "item.at:seed=Seed\ntile.at:seed.tooltip=§r§7Tier 2\n");
    assert.throws(() => migrateItemDescriptions("item.at:seed=Seed\\nTier 1\ntile.at:seed.name=Seed\\nTier 2"), /Conflicting/);
});

test("all bundled locale names are clean and potion tooltips keep their effects, durations and states", () => {
    const folder = new URL("../RP/texts/", import.meta.url);
    for (const file of readdirSync(folder).filter(name => name.endsWith(".lang"))) {
        const source = readFileSync(new URL(file, folder), "utf8"), entries = new Map();
        for (const line of source.split(/\r?\n/u)) {
            const separator = line.indexOf("=");
            if (separator < 1 || line.startsWith("#")) continue;
            const key = line.slice(0, separator), value = line.slice(separator + 1);
            if (/^(?:item|tile)\./u.test(key)) assert(!entries.has(key), `${file}: duplicate ${key}`);
            entries.set(key, value);
            if (tooltipKeyForName(key)) assert(!value.includes("\\n"), `${file}: description inside ${key}`);
        }
        for (const [key, value] of entries) if (/^tile\..*\.tooltip$/u.test(key)) {
            const id = key.slice(5, -8);
            assert([`item.${id}`, `item.${id}.name`, `tile.${id}`, `tile.${id}.name`, `item.spawn_egg.entity.${id}.name`].some(k => entries.has(k)), `${file}: orphan ${key}`);
            assert(value.startsWith("§r"), `${file}: reset missing in ${key}`);
        }
        for (const [id, potion] of Object.entries(CUSTOM_POTIONS)) {
            assert(entries.has(`item.${id}.name`), `${file}: potion name missing ${id}`);
            assert.equal(entries.get(`tile.${id}.tooltip`), `§r${potionDescription(potion, file.slice(0, -5))}`, `${file}: ${id}`);
        }
        assert.equal(migrateItemDescriptions(source), source, file);
    }
});

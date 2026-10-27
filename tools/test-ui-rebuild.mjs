import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ui = join(root, 'RP', 'ui');
function readJson(path) {
    const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    const withoutComments = text.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
        (match, string) => string ?? '');
    return JSON.parse(withoutComments.replace(/("(?:\\.|[^"\\])*")|,(?=\s*[}\]])/g,
        (match, string) => string ?? ''));
}
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? files(join(directory, entry.name)) :
            entry.name.endsWith('.json') ? [join(directory, entry.name)] : []);
}
function visit(value, fn) {
    if (typeof value === 'string') fn(value);
    else if (Array.isArray(value)) value.forEach(v => visit(v, fn));
    else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            fn(key);
            visit(child, fn);
        }
    }
}

const registered = readJson(join(ui, '_ui_defs.json')).ui_defs;
assert(registered.includes('ui/at_core.json') && registered.includes('ui/at_common.json'));
assert(!registered.includes('ui/ascendant_common.json'));
assert(!existsSync(join(ui, 'ascendant_common.json')));
const definitions = new Map();
for (const file of registered) {
    assert(existsSync(join(root, 'RP', file)), `Missing registered file: ${file}`);
    const data = readJson(join(root, 'RP', file));
    for (const [key, value] of Object.entries(data)) {
        if (key === 'namespace') continue;
        const [name, parent] = key.split('@');
        definitions.set(`${data.namespace}.${name}`, { parent, value });
    }
}
let parsed = 0;
for (const file of files(ui)) {
    const data = readJson(file);
    parsed++;
    visit(data, text => {
        assert(!text.includes('ascendant_common'), `Old namespace in ${file}: ${text}`);
        for (const [ref] of text.matchAll(/(?<![a-zA-Z_0-9/])at_(?:core|common)\.[a-zA-Z_0-9]+/g)) {
            assert(definitions.has(ref), `Missing shared control in ${file}: ${ref}`);
        }
    });
}
const active = new Set(), visited = new Set();
function inheritance(ref) {
    if (!ref?.startsWith('at_') || visited.has(ref)) return;
    assert(!active.has(ref), `Inheritance cycle: ${ref}`);
    active.add(ref);
    const definition = definitions.get(ref);
    assert(definition, `Missing inheritance target: ${ref}`);
    inheritance(definition.parent);
    active.delete(ref);
    visited.add(ref);
}
for (const ref of definitions.keys()) inheritance(ref);
const core = readJson(join(ui, 'at_core.json'));
visit(core, text => {
    assert(!text.includes('at_common.'), 'Core depends on Common');
    assert(!text.includes('uc.'), 'Core depends on UtilityCraft UI');
    assert(!text.includes('textures/'), 'Core contains a themed asset');
});

// The pilot must retain the BP container protocol, including both nine-slot grids.
const pilot = readJson(join(ui, 'compactor.json'));
const top = new Map(pilot.compactor_top.controls.flatMap(Object.entries));
for (const [name, expected] of [['input_grid', [3,4,5,6,7,8,9,10,11]], ['output_grid', [16,17,18,19,20,21,22,23,24]]]) {
    const grid = top.get(`${name}@at_common.grid_3x3`);
    assert(grid, `Missing pilot grid: ${name}`);
    assert.deepEqual(expected.map((_, index) => grid[`$slot_index_${index}`]), expected);
}
assert.equal(top.get('energy_bar@at_common.energy_display').$collection_index, 0);
assert.equal(top.get('item_label@at_core.collection_text').collection_index, 1);
assert.equal(top.get('process_progress@at_common.progress_arrow').collection_index, 2);
assert(top.has('upgrades_tab@uc.upgrades_tab') && top.has('io_tab@at_common.machine_io_tab') && top.has('info_tab@at_common.machine_info_tab'));

for (const file of ['generate-alchemical-ui.mjs', 'generate-liquifier-recipe-book.mjs', 'generate-residue-recipe-book.mjs']) {
    assert(!readFileSync(join(root, 'tools', file), 'utf8').includes('ascendant_common'), `Generator restores old namespace: ${file}`);
}
console.log(`PASS: ${parsed} UI JSONs parsed; registration, shared references, inheritance, independent Core and Compactor slot protocol.`);
console.log('Bedrock layout, focus, mouse, controller and touch require in-game validation.');

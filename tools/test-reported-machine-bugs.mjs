import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const plain = value => JSON.parse(JSON.stringify(value));
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/\bexport /g, '');

class Stack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = 64; this.nameTag = 'Named stack'; this.lore = ['custom lore']; }
    clone() { return Object.assign(new Stack(this.typeId, this.amount), { nameTag: this.nameTag, lore: structuredClone(this.lore) }); }
    isStackableWith(other) { return this.typeId === other?.typeId && this.nameTag === other.nameTag; }
    setLore(value) { this.lore = value; }
}
function inventory(size) {
    const items = new Map();
    return { size, items, getItem: slot => items.get(slot)?.clone(), setItem: (slot, item) => item ? items.set(slot, item.clone()) : items.delete(slot) };
}
function machineModule(name, names, overrides = {}) {
    const context = {
        ItemStack: Stack,
        system: { currentTick: 0 },
        DoriosLib: { constants: { UNBREAKABLE_BLOCKS: ['minecraft:bedrock'] } },
        ButtonManager: { registerMachineButton() {} },
        resourceCost: (_, amount) => amount,
        registerIOInterface(_, io) { context.io = io; },
        registerATMachine() {},
        ...overrides,
    };
    vm.runInNewContext(strip(read(`BP/scripts/features/machines/${name}.js`)) + `\nglobalThis.api={${names.join(',')}};`, context);
    return context;
}

test('Verdant registers addon crops with actual block IDs/soil/age states; failed planting refunds original metadata', () => {
    const env = vm.createContext({ system: { afterEvents: { scriptEventReceive: { subscribe() {} } } } });
    vm.runInContext(strip(read('BP/scripts/ATCore/agriculture/verdantCropRegistry.js')) + '\n' + strip(read('BP/scripts/config/recipes/verdantCultivator.js')), env);
    // Regress the original root cause: the registry existed, but referenced
    // nonexistent *_crop IDs instead of the actual placed *_seeds blocks.
    for (const [seed, tier] of [['iron', 1], ['gold', 2], ['diamond', 3], ['netherite', 4]]) {
        const spec = env.getVerdantCropBySeed(`utilitycraft:${seed}_seeds`);
        const block = json(`../UtilityCraft/BP/blocks/addons/bc/crops/tier_${tier}/${seed}_seeds.json`)['minecraft:block'];
        assert.equal(spec.cropBlockId, block.description.identifier);
        assert(block.description.states[spec.ageState].includes(spec.maxAge));
    }
    for (const [seed, tier, soil] of [['titanium', 3, 'blue'], ['tungsten', 3, 'blue'], ['aetherium_crystal', 5, 'pink']]) {
        const id = `utilitycraft:${seed}_seeds`, spec = env.getVerdantCropBySeed(id);
        const block = json(`BP/blocks/addons/bc/crops/tier_${tier}/${seed}_seeds.json`)['minecraft:block'];
        assert.equal(spec.cropBlockId, block.description.identifier);
        assert(block.description.states[spec.ageState].includes(spec.maxAge));
        assert(spec.validSoilIds.has(`utilitycraft:${soil}_soil`));
    }
    const spec = env.getVerdantCropBySeed('utilitycraft:titanium_seeds');
    const container = inventory(33), original = new Stack(spec.seedItemId);
    container.setItem(3, original);
    let fail = true, plantedPermutation;
    const machine = { container, dimension: { getBlock: pos => pos.y === -1 ? { typeId: 'utilitycraft:blue_soil' } : { isAir: true, setPermutation(p) { if (fail) throw Error('cannot place'); plantedPermutation = p; } } } };
    const { api } = machineModule('verdantCultivator', ['executeOperation'], { BlockPermutation: { resolve: (id, states) => ({ id, states }) } });
    const operation = { pulseCount: 0, harvestTargets: [], plantTargets: [{ templateSlot: 3, position: { x: 0, y: 0, z: 0 }, spec }] };
    assert.equal(api.executeOperation(machine, operation, {}).planted, 0);
    assert.deepEqual(plain(container.getItem(3)), plain(original));
    fail = false;
    assert.equal(api.executeOperation(machine, operation, {}).planted, 1);
    assert.equal(container.getItem(3), undefined);
    assert.equal(plantedPermutation.id, spec.cropBlockId);
});

test('Pattern Placer skips occupied/failed positions and consumes matching stacks only after successful placement', () => {
    let fail = true;
    const env = machineModule('patternPlacer', ['selectBlockInput', 'findPlaceableTargets', 'placeBlocks', 'consumeMatchingInput'], {
        BlockPermutation: { resolve: id => { if (id !== 'minecraft:stone') throw Error('not a block'); return { id }; } },
    });
    const container = inventory(23), same = new Stack('minecraft:stone', 2), foreign = new Stack('minecraft:stone', 8);
    foreign.nameTag = 'Different metadata';
    container.setItem(4, same); container.setItem(5, foreign);
    const input = env.api.selectBlockInput(container);
    assert.equal(input.available, 2);
    const blocks = [{ isAir: false }, { isAir: true, setPermutation() { if (fail) throw Error('protected'); this.isAir = false; } }];
    const dim = { getBlock: pos => blocks[pos.x] }, positions = [{ x: 0 }, { x: 1 }];
    const targets = env.api.findPlaceableTargets(dim, positions);
    assert.equal(targets.length, 1);
    assert.equal(env.api.placeBlocks(dim, targets, 2, input.selected.permutation), 0);
    fail = false;
    const placed = env.api.placeBlocks(dim, targets, 2, input.selected.permutation);
    assert.equal(placed, 1);
    assert.equal(env.api.consumeMatchingInput(container, input.selected.stack, placed), 1);
    assert.equal(container.getItem(4).amount, 1);
    assert.equal(container.getItem(5).amount, 8);
});

test('Seismic Breaker preserves blocks on loot failure and preserves overflow stacks on success', () => {
    let failLoot = true, stored = 0;
    const drop = new Stack('minecraft:cobblestone', 5), spawned = [];
    const env = machineModule('seismicBreaker', ['breakTargets', 'findBreakableTargets'], {
        world: { getLootTableManager: () => ({ generateLootFromBlock() { if (failLoot) throw Error('unavailable'); return [drop.clone()]; } }) },
        DoriosLib: { constants: { UNBREAKABLE_BLOCKS: ['minecraft:bedrock'] }, container: { insert: () => { stored += 2; return 2; } } },
    });
    const block = { typeId: 'minecraft:stone', isAir: false, setType(id) { this.typeId = id; this.isAir = id === 'minecraft:air'; } };
    const dim = { getBlock: () => block, spawnItem: stack => spawned.push(stack) };
    const machine = { dimension: dim, container: inventory(24) }, positions = [{ x: 0, y: 0, z: 1 }];
    assert.equal(env.api.breakTargets(machine, positions).broken, 0);
    assert.equal(block.typeId, 'minecraft:stone');
    failLoot = false;
    const result = env.api.breakTargets(machine, positions);
    assert.equal(result.broken, 1); assert.equal(result.overflow, 3);
    assert.equal(stored + spawned[0].amount, drop.amount);
    assert.equal(spawned[0].nameTag, drop.nameTag);
    assert.equal(env.api.findBreakableTargets(dim, positions).length, 0);
});

test('Pattern modes stay in front of the machine in all cardinal directions', () => {
    const env = vm.createContext({}); vm.runInContext(strip(read('BP/scripts/ATCore/spatial/patternGeometry.js')), env);
    for (const direction of ['north', 'south', 'west', 'east']) for (const [mode, count] of [['single', 1], ['plane3x3', 9], ['cube3x3x3', 27], ['line', 5]]) {
        const block = { location: { x: 0, y: 0, z: 0 }, permutation: { getState: () => direction } };
        const positions = env.buildPatternPositions(block, mode), forward = env.getPatternForward(block);
        assert.equal(positions.length, count);
        assert.equal(new Set(positions.map(p => `${p.x},${p.y},${p.z}`)).size, count);
        for (const pos of positions) assert(pos.x * forward.x + pos.z * forward.z >= 1);
    }
});

test('Localized information preserves values/colors and exposes translations through native lore', () => {
    const env = vm.createContext({});
    vm.runInContext(strip(read('BP/scripts/config/machineInfoTerms.js')) + '\n' + strip(read('BP/scripts/features/machines/localizedInfo.js')), env);
    const english = Object.fromEntries(read('RP/texts/en_US.lang').split(/\r?\n/).filter(l => l.startsWith('ui.ascendant:machine_info.')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    const line = '§r§7Status: §aPlanting\n\n§r§eMachine Information\n§r§aSpeed §fx1.25';
    const raw = env.localizeMachineInfoLine(line);
    assert(raw.rawtext.some(part => part.translate?.endsWith('.machine_information')));
    assert(raw.rawtext.some(part => part.translate?.endsWith('.speed')));
    assert.equal(raw.rawtext.map(part => part.text ?? english[part.translate]).join(''), line);
    assert.deepEqual(plain(env.localizeMachineInfoLine('Speedier custom name')), { rawtext: [{ text: 'Speedier custom name' }] });
    const container = inventory(24); container.setItem(1, new Stack('utilitycraft:arrow_indicator_90'));
    env.setLocalizedMachineInfo({ container }, [line]);
    const item = container.getItem(1);
    assert.equal(item.nameTag, ' '); assert(item.lore[0].rawtext.some(part => part.translate));
    for (const locale of ['en_US', 'pt_BR', 'pt_PT', 'es_ES', 'es_MX', 'fr_FR', 'de_DE', 'ru_RU', 'ja_JP', 'zh_CN']) {
        const entries = read(`RP/texts/${locale}.lang`).split(/\r?\n/).filter(l => l.startsWith('ui.ascendant:machine_info.'));
        assert.equal(entries.length, Object.keys(english).length, locale);
        assert.equal(new Set(entries.map(l => l.split('=')[0])).size, entries.length, locale);
    }
});

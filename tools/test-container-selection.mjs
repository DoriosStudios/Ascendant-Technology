import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file).replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (m, q) => q ?? '').replace(/("(?:\\.|[^"\\])*")|,(?=\s*[}\]])/g, (m, q) => q ?? ''));
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(folder, e.name)) : e.name.endsWith('.json') ? [path.join(folder, e.name)] : []);
const ownEntities = ['BP/entities/machines/power_beacon_entity.json', 'BP/entities/mob_chamber_machine.json'];
const blockSelection = 'utilitycraft:has_selection';
const emptyProperty = 'utilitycraft:selection_empty';
const copy = value => JSON.parse(JSON.stringify(value));

test('every AT block with a declared container, battery or Mob Chamber controller opts into selection', () => {
    let count = 0;
    for (const file of walk('BP/blocks')) {
        const b = json(file)['minecraft:block']; if (!b) continue;
        const components = b.components ?? {};
        if (!Object.values(components).some(c => c && typeof c === 'object' && c.entity)
            && !components['utilitycraft:battery'] && b.description.identifier !== 'utilitycraft:mob_chamber_controller') continue;
        assert.deepEqual([...b.description.states[blockSelection]].sort(), [false, true], file);
        assert(b.permutations.some(p => p.condition === "!q.block_state('utilitycraft:has_selection')" && p.components?.['minecraft:selection_box'] === false), file);
        count++;
    }
    assert.equal(count, 50);
});

test('owned entities implement selection without putting inventories or scale into the selection groups', () => {
    for (const file of ownEntities) {
        const e = json(file)['minecraft:entity'];
        assert(e.components['minecraft:type_family'].family.includes('utilitycraft:block_container'));
        assert.equal(e.description.properties[emptyProperty].default, false);
        for (const empty of [true, false]) {
            const mode = empty ? 'empty' : 'full', other = empty ? 'full' : 'empty';
            const event = e.events[`utilitycraft:selection_${mode}`];
            assert.equal(event.set_property[emptyProperty], empty);
            assert.deepEqual(event.remove.component_groups, [`utilitycraft:selection_${other}`]);
            const group = e.component_groups[event.add.component_groups[0]];
            assert.deepEqual(Object.keys(group), ['minecraft:collision_box']);
            const box = group['minecraft:collision_box'];
            assert.deepEqual(box, empty ? { height: 0, width: 0 } : e.components['minecraft:collision_box']);
        }
    }
    const beacon = json(ownEntities[0])['minecraft:entity'];
    assert.deepEqual(beacon.components['minecraft:collision_box'], { height: 1, width: 1 });
    const chamber = json(ownEntities[1])['minecraft:entity'];
    assert.equal(chamber.description.properties['utilitycraft:orphan_cleanup'].default, false);
    assert.deepEqual(chamber.component_groups['utilitycraft:hide'], { 'minecraft:scale': { value: 0.1 } });
});

function fixture(entityFile, hidden = false, blockFile) {
    const definition = json(entityFile)['minecraft:entity'];
    const properties = Object.fromEntries(Object.entries(definition.description.properties ?? {}).map(([key, value]) => [key, value.default]));
    const groups = new Set();
    const inventory = { contents: [{ id: 'minecraft:diamond', amount: 37, name: 'Retained', lore: ['metadata'] }] };
    const resources = { energy: 12345, fluid: 678, transmission: false };
    const entity = {
        id: 'container', isValid: true, location: { x: 0.5, y: 64.5, z: 0.5 },
        getProperty: key => properties[key],
        getComponent(key) {
            if (key === 'minecraft:type_family') return { hasTypeFamily: value => definition.components[key].family.includes(value) };
            if (key === 'minecraft:scale') return { value: hidden ? 0.1 : 1 };
            if (key === 'minecraft:inventory') return { container: inventory };
            if (key === 'minecraft:collision_box') {
                let result = definition.components[key];
                for (const group of groups) result = definition.component_groups[group]?.[key] ?? result;
                return result;
            }
        },
        teleport(location) { this.location = { ...location }; },
        triggerEvent(name) {
            const event = definition.events[name]; assert(event, name);
            Object.assign(properties, event.set_property);
            for (const group of event.remove?.component_groups ?? []) groups.delete(group);
            for (const group of event.add?.component_groups ?? []) groups.add(group);
        },
    };
    const permutation = states => ({ states, getState: key => states[key], withState: (key, value) => permutation({ ...states, [key]: value }) });
    const blockDefinition = blockFile ? json(blockFile)['minecraft:block'] : undefined;
    const initialStates = blockDefinition
        ? Object.fromEntries(Object.entries(blockDefinition.description.states).map(([key, values]) => [key, values[0]]))
        : { [blockSelection]: true };
    const block = { isAir: false, typeId: blockDefinition?.description.identifier, location: { x: 0, y: 64, z: 0 }, permutation: permutation(initialStates), center: () => ({ x: 0.5, y: 64.5, z: 0.5 }), setPermutation(value) { this.permutation = value; } };
    const dimension = { id: 'minecraft:overworld', getBlock: () => block, getEntitiesAtBlockLocation: () => [entity], spawnEntity: () => ({ isValid: true, remove() { this.isValid = false; } }) };
    entity.dimension = block.dimension = dimension;
    const player = id => ({ id, isSneaking: false, dimension, getHeadLocation: () => ({ x: 0.5, y: 65, z: -2 }),
        getBlockFromViewDirection: () => !block.isAir && block.permutation.getState(blockSelection) ? { block, faceLocation: { x: 0.5, y: 0.5, z: 0 } } : undefined,
        getEntitiesFromViewDirection: () => entity.getComponent('minecraft:collision_box').height > 0 ? [{ entity, distance: 2 }] : [],
        setPropertyOverrideForEntity() {},
    });
    let players = [player('one')], tick, cleanups = 0;
    const context = vm.createContext({
        system: { runInterval(fn) { tick = fn; }, runTimeout() { cleanups++; } },
        world: { getAllPlayers: () => players, afterEvents: { entityHitEntity: { subscribe() {} } } },
        dropAllItems() { throw Error('Unexpected cleanup'); }, TickScheduler: { releaseTickGroup() {} },
    });
    const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/\bexport /g, '');
    vm.runInContext(strip(read('../UtilityCraft/BP/scripts/UtilityCore/blockContainerTarget.js')) + '\n' + strip(read('../UtilityCraft/BP/scripts/UtilityCore/blockContainerSelection.js')), context);
    return { entity, block, inventory, resources, tick: () => tick(), addPlayer: () => { const p = player('two'); players.push(p); return p; }, get players() { return players; }, clearPlayers() { players = []; }, get cleanups() { return cleanups; } };
}

test('real shared selector opens entity interaction, exposes block for mining, and resets when viewers leave', () => {
    for (const entityFile of [...ownEntities, '../UtilityCraft/BP/entities/machines/machine_entity.json']) {
        const f = fixture(entityFile), original = copy({ inventory: f.inventory, resources: f.resources });
        const normal = copy(f.entity.getComponent('minecraft:collision_box'));
        f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), false);
        assert.equal(f.entity.getProperty(emptyProperty), false);
        assert.equal(f.entity.location.y, 64);
        f.players[0].isSneaking = true; f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), true);
        assert.equal(f.entity.getProperty(emptyProperty), true);
        assert.equal(f.entity.getComponent('minecraft:collision_box').height, 0);
        f.players[0].isSneaking = false; f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), false);
        assert.deepEqual(f.entity.getComponent('minecraft:collision_box'), normal);
        f.clearPlayers(); f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), true);
        assert.deepEqual(f.entity.getComponent('minecraft:collision_box'), normal);
        assert.deepEqual(copy({ inventory: f.inventory, resources: f.resources }), original);
    }
});

test('multiple viewers cannot shrink the container while another viewer needs interaction', () => {
    const f = fixture(ownEntities[0]);
    f.players[0].isSneaking = true;
    const other = f.addPlayer(); f.tick();
    assert.equal(f.entity.getProperty(emptyProperty), false);
    other.isSneaking = true; f.tick();
    assert.equal(f.entity.getProperty(emptyProperty), true);
});

test('inactive Mob Chamber remains block-selectable and owns its orphan cleanup', () => {
    const f = fixture(ownEntities[1], true), original = copy(f.inventory);
    f.tick();
    assert.equal(f.block.permutation.getState(blockSelection), true);
    assert.equal(f.entity.getComponent('minecraft:scale').value, 0.1);
    assert.deepEqual(f.inventory, original);
    f.block.isAir = true; f.tick();
    assert.equal(f.cleanups, 0);
});


test('all five Power Beacon tiers expose their generic block box when sneaking, including initial placement', () => {
    for (const tier of ['basic', 'advanced', 'expert', 'ultimate', 'absolute']) {
        const file = `BP/blocks/machinery/generators/power_beacon/${tier}_power_beacon.json`;
        const definition = json(file)['minecraft:block'];
        assert.equal(definition.components['utilitycraft:power_beacon'].entity.identifier, 'utilitycraft:power_beacon_entity');
        assert.deepEqual(definition.components['minecraft:collision_box'], { origin: [-8, 0, -8], size: [16, 16, 16] });
        assert(definition.components['minecraft:destructible_by_mining'].seconds_to_destroy > 0);
        const f = fixture(ownEntities[0], false, file);
        // Actual block defaults hide its selection, so the first acquisition must use the entity.
        assert.equal(f.block.permutation.getState(blockSelection), false);
        f.players[0].isSneaking = true;
        f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), true, tier);
        assert.deepEqual(f.entity.getComponent('minecraft:collision_box'), { height: 0, width: 0 });
        // The following pass must retain the target through the block raycast instead.
        f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), true, tier);
        f.players[0].isSneaking = false;
        f.tick();
        assert.equal(f.block.permutation.getState(blockSelection), false, tier);
        assert.deepEqual(f.entity.getComponent('minecraft:collision_box'), { height: 1, width: 1 });
        assert.deepEqual(f.entity.location, { x: 0.5, y: 64, z: 0.5 });
    }
});

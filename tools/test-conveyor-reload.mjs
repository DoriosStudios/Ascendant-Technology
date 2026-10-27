// Regression checks for automatic conveyor recovery and energy-free movement.
// Run: node tools/test-conveyor-reload.mjs
// Executes actual transportation modules and block callbacks in a mocked Bedrock runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../BP/scripts/ATCore/transportation/${name}.js`, import.meta.url), 'utf8');
const key = p => `${Math.floor(p.x)}|${Math.floor(p.y)}|${Math.floor(p.z)}`;
const definitions = new Map();
for (const filename of (await import('node:fs')).readdirSync(new URL('../BP/blocks/machinery/transportation/conveyors/', import.meta.url))) {
  if (!filename.endsWith('.json')) continue;
  const definition = JSON.parse(readFileSync(new URL('../BP/blocks/machinery/transportation/conveyors/' + filename, import.meta.url), 'utf8'))['minecraft:block'];
  definitions.set(definition.description.identifier, definition);
}
const tagsFor = id => Object.keys(definitions.get(id)?.components ?? {}).filter(k => k.startsWith('tag:')).map(k => k.slice(4));
const chunk = p => `${Math.floor(p.x / 16)}|${Math.floor(p.z / 16)}`;
const pos = (x, y = 0, z = 0) => ({ x, y, z });
const checks = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    checks.push(name);
    console.log(`PASS: ${name}`);
  });
}
class Signal {
  listeners = [];
  subscribe(fn) { this.listeners.push(fn); }
  emit(event = {}) { for (const fn of this.listeners) fn(event); }
}
class Stack {
  constructor(typeId = 'minecraft:iron_ingot', amount = 1) { this.typeId = typeId; this.amount = amount; }
  clone() { return new Stack(this.typeId, this.amount); }
}
function runtime(properties = new Map()) {
  let nextEntity = 0;
  const tasks = [];
  const intervals = [];
  const errors = [];
  const dimensions = new Map();
  const world = {
    afterEvents: Object.fromEntries(['entitySpawn', 'entityLoad', 'entityRemove', 'playerPlaceBlock', 'playerBreakBlock', 'pistonActivate', 'worldLoad', 'playerSpawn'].map(n => [n, new Signal()])),
    getDynamicProperty: k => properties.get(k),
    setDynamicProperty: (k, v) => { if (v === undefined) properties.delete(k); else properties.set(k, v); },
    getDimension: id => dimensions.get(id.includes(':') ? id : `minecraft:${id}`),
  };
  const system = {
    currentTick: 0,
    run: fn => tasks.push({ fn, due: system.currentTick + 1 }),
    runTimeout: (fn, ticks = 1) => tasks.push({ fn, due: system.currentTick + ticks }),
    runInterval: (fn, ticks) => intervals.push({ fn, ticks }),
    afterEvents: { scriptEventReceive: new Signal() },
  };
  function invoke(fn) {
    try { const pending = fn(); pending?.catch?.(error => errors.push(error)); }
    catch (error) { errors.push(error); }
  }
  async function ticks(count = 40) {
    for (let i = 0; i < count; i++) {
      system.currentTick++;
      const ready = tasks.filter(t => t.due <= system.currentTick);
      for (const task of ready) { tasks.splice(tasks.indexOf(task), 1); invoke(task.fn); }
      for (const dimension of dimensions.values()) {
        for (const b of [...dimension.blocks.values()]) {
          if (!b.tickEvery || !dimension.loaded.has(chunk(b.location)) || system.currentTick % b.tickEvery !== 0) continue;
          invoke(() => call('conveyorComponent.onTick({block: b})', { b }));
        }
      }
      for (const interval of intervals) if (system.currentTick % interval.ticks === 0) invoke(interval.fn);
      for (let turn = 0; turn < 12; turn++) await Promise.resolve();
    }
  }
  for (const id of ['overworld', 'nether', 'the_end']) {
    const dimension = {
      id: `minecraft:${id}`, blocks: new Map(), entities: [], loaded: new Set(),
      getBlock(p) {
        if (!this.loaded.has(chunk(p))) throw new Error('LocationInUnloadedChunkError');
        if (!this.blocks.has(key(p))) this.blocks.set(key(p), block(this, p, 'minecraft:air', []));
        return this.blocks.get(key(p));
      },
      getEntitiesAtBlockLocation(p) { return this.entities.filter(e => e.isValid && this.loaded.has(chunk(e.location)) && key(e.location) === key(p)); },
      getEntities(options = {}) { return this.entities.filter(e => e.isValid && this.loaded.has(chunk(e.location)) && (!options.tags || options.tags.every(t => e.tags.includes(t)))); },
      spawnItem(stack, p) { return payload(this, p, stack); },
      runCommand() {},
    };
    dimensions.set(dimension.id, dimension);
  }
  function block(dimension, p, typeId, tags, facing = 'east') {
    let states = { 'minecraft:cardinal_direction': facing, 'utilitycraft:vertical_direction': 'up' };
    const b = { dimension, location: { ...p }, typeId, tags: new Set(tags), tickEvery: definitions.get(typeId)?.components["minecraft:tick"]?.interval_range[0] ?? 0,
      hasTag(t) { return this.tags.has(t); },
      getTags() { return [...this.tags]; },
      setType(id) {
        this.typeId = id;
        this.tags = new Set(tagsFor(id));
      },
      setPermutation(permutation) { states = { ...permutation.states }; },
      get permutation() { return { states, getState: s => states[s], withState: (s, v) => ({ states: { ...states, [s]: v } }) }; },
    };
    return b;
  }
  function addBlock(p, typeId, facing = 'east', dimension = world.getDimension('overworld'), tags) {
    const defaultTags = tagsFor(typeId);
    const b = block(dimension, p, typeId, tags ?? defaultTags, facing);
    dimension.blocks.set(key(p), b);
    dimension.loaded.add(chunk(p));
    return b;
  }
  function payload(dimension, p, stack = new Stack(), event = 'entitySpawn', typeId = 'minecraft:item', families = []) {
    const entity = {
      id: `entity-${++nextEntity}`, typeId, dimension, isValid: true, _location: { ...p }, tags: [], energy: 1000, teleports: 0,
      get location() { if (!this.isValid) throw new Error('InvalidEntityError'); return this._location; },
      teleport(p) { this.teleports++; if (this.failTeleport) throw new Error('teleport failed'); this._location = { ...p }; },
      remove() { this.isValid = false; world.afterEvents.entityRemove.emit({ removedEntityId: this.id }); },
      getComponent(id) {
        if (id === 'minecraft:item' && typeId === 'minecraft:item') return { itemStack: stack.clone() };
        if (id === 'minecraft:type_family') return { hasTypeFamily: f => families.includes(f) };
      },
    };
    dimension.entities.push(entity);
    if (event) world.afterEvents[event].emit({ entity });
    return entity;
  }
  const DoriosLib = {
    text: { formatIdentifier: s => s }, constants: { isUnbreakableBlock: () => false },
    container: {
      resolveAt(d, p) { try { return d.getBlock(p)?.container ?? null; } catch { return null; } },
      insert(target, { item }) { const moved = Math.min(target.free ?? 0, item.amount); target.free -= moved; target.inserted = (target.inserted ?? 0) + moved; return moved; },
    },
  };
  const context = vm.createContext({ world, system, DoriosLib, ActionFormData: class {},
    worldLoaded: true, console,
  });
  for (const name of ['plainConveyors', 'bridgeConveyors', 'specialConveyors', 'conveyors']) {
    const source = read(name).replace(/^import[^;]*;\s*/gm, '').replace(/\bexport\s+/g, '');
    vm.runInContext(source, context, { filename: `${name}.js` });
  }
  vm.runInContext('installTransportation()', context);
  const evaluate = code => vm.runInContext(code, context);
  const call = (code, args = {}) => { Object.assign(context, args); return evaluate(code); };
  return { world, system, properties, errors, dimensions, ticks, addBlock, payload, evaluate, call,
    overworld: world.getDimension('overworld'),
    place: b => call('refreshPlacedConveyor(b)', { b }),
    move: () => evaluate('processPayloads()'),
    restore: () => { world.afterEvents.worldLoad.emit(); return ticks(); },
    special: (b, items) => call('special.process(b, getType(b.typeId), {items, creatures: []})', {
      b, items,
    }),
  };
}

await check('Persisted conveyor resumes in a fresh runtime with loaded entities', async () => {
  const old = runtime(); old.place(old.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal'));
  const r = runtime(old.properties); r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  const item = r.payload(r.overworld, pos(32.2, 0.3, 0.5), undefined, null);
  await r.restore(); assert(item.teleports > 0); assert.equal(r.errors.length, 0);
});

await check('Persisted but initially unavailable chunks recover automatically in all three dimensions', async () => {
  const old = runtime();
  for (const d of old.dimensions.values()) old.place(old.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal', 'east', d));
  const r = runtime(old.properties);
  for (const d of r.dimensions.values()) { r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal', 'east', d); d.loaded.clear(); }
  await r.restore();
  assert.equal(r.evaluate('registryByDimension.size'), 0);
  const items = [];
  for (const d of r.dimensions.values()) {
    d.loaded.add('2|0'); items.push(r.payload(d, pos(32.2, 0.3, 0.5), undefined, 'entityLoad'));
  }
  await r.ticks(20);
  for (const item of items) assert(item.teleports > 0);
  assert.equal(r.errors.length, 0);
});

await check('Every moving conveyor variant discovers itself after reload without persistence, energy or updater', async () => {
  const r = runtime(); const blocks = [];
  for (const [id, definition] of definitions) {
    if (!Object.hasOwn(definition.components, 'utilitycraft:conveyor')) continue;
    const b = r.addBlock(pos(32 + blocks.length * 64), id);
    blocks.push(b);
    if (id.endsWith('bridge_transmitter')) r.addBlock(pos(b.location.x + 3), id.replace('_transmitter', '_receiver'));
  }
  assert.equal(blocks.length, 25);
  for (const d of r.dimensions.values()) d.loaded.clear();
  await r.restore(); assert.equal(r.properties.size, 0);
  for (const b of blocks) r.overworld.loaded.add(chunk(b.location));
  await r.ticks(20);
  for (const b of blocks) assert(r.call('registryByDimension.get(b.dimension.id).has(positionKey(b.location))', { b }));
  const items = blocks.map(b => r.payload(r.overworld, pos(b.location.x + 0.5, 0.3, 0.5)));
  await r.ticks(2);
  for (let i = 0; i < items.length; i++) assert(items[i].teleports > 0, blocks[i].typeId);
  assert.equal(r.errors.length, 0);
});

await check('New payload discovers an unregistered conveyor before its first block tick', () => {
  const r = runtime(); r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  const item = r.payload(r.overworld, pos(32.2, 0.3, 0.5)); r.move();
  assert(item.location.x > 32.2); assert.equal(r.system.currentTick, 0);
});

await check('Already loaded and late-loaded payloads recover even when spawn/load events are missed', async () => {
  const r = runtime(); r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  const first = r.payload(r.overworld, pos(32.2, 0.3, 0.5), undefined, null);
  await r.restore(); assert(first.teleports > 0);
  const late = r.payload(r.overworld, pos(32.2, 0.3, 0.5), undefined, null);
  await r.ticks(100); assert(late.teleports > 0); assert.equal(r.errors.length, 0);
});

await check('Delayed world readiness does not permanently skip discovery of existing payloads', async () => {
  const r = runtime(); r.evaluate('globalThis.worldLoaded = false');
  r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  const item = r.payload(r.overworld, pos(32.2, 0.3, 0.5), undefined, null);
  await r.restore(); assert.equal(item.teleports, 0);
  r.evaluate('globalThis.worldLoaded = true'); await r.ticks(100);
  assert(item.teleports > 0); assert.equal(r.errors.length, 0);
});

await check('Structure-style onPlace registers immediately; recurring ticks do not rewrite persistence', async () => {
  const r = runtime(); const b = r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  let writes = 0; const set = r.world.setDynamicProperty;
  r.world.setDynamicProperty = (...args) => { writes++; set(...args); };
  r.call('conveyorComponent.onPlace({block: b})', { b }); assert(writes > 0);
  const originalWrites = writes; await r.ticks(100); assert.equal(writes, originalWrites);
  assert.equal(r.evaluate('registryByDimension.get("minecraft:overworld").size'), 1);
});

await check('A bridge waits for its late receiver and preserves the saved path during reload', async () => {
  const old = runtime(); old.place(old.addBlock(pos(15), 'utilitycraft:copper_conveyor_bridge_transmitter'));
  old.place(old.addBlock(pos(18), 'utilitycraft:copper_conveyor_bridge_receiver'));
  const r = runtime(old.properties); const tx = r.addBlock(pos(15), 'utilitycraft:copper_conveyor_bridge_transmitter');
  r.addBlock(pos(18), 'utilitycraft:copper_conveyor_bridge_receiver');
  const path = r.addBlock(pos(16), 'utilitycraft:copper_conveyor_bridge_path'); r.overworld.loaded.delete('1|0');
  const item = r.payload(r.overworld, pos(15.5, 0.3, 0.5), undefined, null);
  await r.restore(); assert.equal(item.teleports, 0); assert.equal(path.typeId, 'utilitycraft:copper_conveyor_bridge_path');
  r.overworld.loaded.add('1|0'); await r.ticks(20);
  assert(item.location.x >= 18.5); assert.equal(r.call('bridge.getVirtualEdge(d.id, positionKey(tx.location))', { d: r.overworld, tx }), '18|0|0');
  assert.equal(r.errors.length, 0);
});

await check('A new bridge defers an unavailable corridor and connects once the corridor loads', async () => {
  const r = runtime(); const tx = r.addBlock(pos(15), 'utilitycraft:aetherium_conveyor_bridge_transmitter');
  r.addBlock(pos(33), 'utilitycraft:aetherium_conveyor_bridge_receiver'); r.place(tx);
  assert.equal(r.call('bridge.getVirtualEdge(d.id, positionKey(tx.location))', { d: r.overworld, tx }), null);
  r.overworld.loaded.add('1|0'); await r.ticks(20);
  assert.equal(r.call('bridge.getVirtualEdge(d.id, positionKey(tx.location))', { d: r.overworld, tx }), '33|0|0');
  assert.equal(r.errors.length, 0);
});

await check('An established bridge keeps its link/path through receiver unload and resumes on reload', async () => {
  const r = runtime(); const tx = r.addBlock(pos(15), 'utilitycraft:copper_conveyor_bridge_transmitter');
  r.addBlock(pos(18), 'utilitycraft:copper_conveyor_bridge_receiver'); r.place(tx);
  r.overworld.loaded.delete('1|0');
  const item = r.payload(r.overworld, pos(15.5, 0.3, 0.5)); await r.ticks(40);
  assert.equal(item.teleports, 0); assert.equal(r.call('bridge.getVirtualEdge(d.id, positionKey(tx.location))', { d: r.overworld, tx }), '18|0|0');
  r.overworld.loaded.add('1|0'); await r.ticks(2); assert.equal(item.location.x, 18.5);
  assert.equal(r.errors.length, 0);
});

await check('All seven special conveyors move without any energy API or source', () => {
  for (const shape of ['router', 'sorter', 'inverted_sorter', 'smart_router', 'overflow', 'underflow', 'junction']) {
    const r = runtime(); const b = r.addBlock(pos(32), `utilitycraft:conveyor_${shape}`); r.place(b);
    const item = r.payload(r.overworld, pos(32.5, 0.3, 0.5)); r.special(b, [item]);
    assert.equal(item.teleports, 1, shape); assert.equal(r.errors.length, 0);
  }
});

await check('Underflow inserts in a side container without energy', () => {
  const r = runtime(); const b = r.addBlock(pos(32), 'utilitycraft:conveyor_underflow');
  const chest = r.addBlock(pos(32, 0, 1), 'minecraft:chest'); chest.container = { free: 64 };
  const item = r.payload(r.overworld, pos(32.5, 0.3, 0.5)); r.special(b, [item]);
  assert(!item.isValid); assert.equal(chest.container.inserted, 1);
});

await check('Sorter and Smart Router filters survive a fresh runtime without energy', () => {
  const properties = new Map([
    ['conveyor_sorter_filter_minecraft:overworld_32_0_0', 'minecraft:iron_ingot'],
    ['smart_router_minecraft:overworld_64_0_0', JSON.stringify({ left: ['minecraft:iron_ingot'], front: [], right: [] })],
  ]);
  const r = runtime(properties);
  const sorter = r.addBlock(pos(32), 'utilitycraft:conveyor_sorter');
  const smart = r.addBlock(pos(64), 'utilitycraft:conveyor_smart_router');
  r.overworld.loaded.add('4|-1');
  const a = r.payload(r.overworld, pos(32.5, 0.3, 0.5)); const b = r.payload(r.overworld, pos(64.5, 0.3, 0.5));
  r.special(sorter, [a]); r.special(smart, [b]);
  assert.equal(a.location.x, 33.5); assert.equal(b.location.z, -0.5);
  assert.equal(properties.get('conveyor_sorter_filter_minecraft:overworld_32_0_0'), 'minecraft:iron_ingot');
});

await check('Multiple items inserted in one pass do not read a removed entity from the spacing bucket', () => {
  const r = runtime(); r.place(r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal'));
  const chest = r.addBlock(pos(33), 'minecraft:chest'); chest.container = { free: 64 };
  const front = r.payload(r.overworld, pos(32.9, 0.3, 0.5)); const rear = r.payload(r.overworld, pos(32.1, 0.3, 0.5));
  r.move(); assert(!front.isValid && !rear.isValid); assert.equal(chest.container.inserted, 2);
});

await check('Failed legacy persistence does not prevent movement after reload', async () => {
  const old = runtime(); old.world.setDynamicProperty = () => { throw new Error('write failed'); };
  old.place(old.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal')); assert.equal(old.properties.size, 0);
  const r = runtime(old.properties); r.addBlock(pos(32), 'utilitycraft:copper_conveyor_horizontal');
  const item = r.payload(r.overworld, pos(32.2, 0.3, 0.5), undefined, null); await r.restore(); assert(item.teleports > 0);
  assert.equal(r.errors.length, 0);
});

await check('Conveyor definitions have no energy, pipe, color or upgrade hooks', () => {
  for (const [id, definition] of definitions) {
    if (id === 'utilitycraft:conveyor_network_updater') continue;
    const components = definition.components;
    for (const forbidden of ['tag:dorios:energy', 'tag:dorios:isTube', 'tag:dorios:color.default', 'tag:dorios:upgradeable', 'utilitycraft:upgradeable']) assert(!Object.hasOwn(components, forbidden), `${id}: ${forbidden}`);
    if (Object.hasOwn(components, 'utilitycraft:conveyor')) assert.equal(components['minecraft:tick'].interval_range[0], 20);
  }
});

console.log(`\n${checks.length} regression checks passed. Bedrock physics and native event ordering still require in-game validation.`);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('BP/scripts/features/machines/cryoChamber.js', 'utf8');
const constants = source.slice(source.indexOf('const INVENTORY_SIZE ='), source.indexOf('const STABILIZER_STATUS_SLOT ='));
const migration = source.slice(source.indexOf('function ensureCryoChamberInventoryLayout('), source.indexOf('function processStabilizer('));
assert(constants.startsWith('const INVENTORY_SIZE = 36;'));
assert(migration.startsWith('function ensureCryoChamberInventoryLayout('));

const context = {
    setDynamicString(entity, key, value) { entity.properties[key] = value; },
    ensureMachineInventoryLayout(machine, targetSize, layout, key, version, previousSlots) {
        assert.equal(targetSize, 38);
        if (machine.container.size !== targetSize) {
            assert.equal(layout.length, targetSize);
            machine.items = layout.map(slot => slot >= 0 ? machine.items[slot] : undefined);
            machine.container.size = targetSize;
            machine.entity.properties[key] = `resizing:${version}`;
            return false;
        }
        const marker = machine.entity.properties[key];
        if (marker === version) return true;
        if (marker === `resizing:${version}`) {
            machine.entity.properties[key] = version;
            return true;
        }
        assert.equal(previousSlots.length, targetSize);
        machine.items = previousSlots.map(slot => machine.items[slot]);
        machine.entity.properties[key] = version;
        return false;
    },
};
vm.runInNewContext(constants + migration + '\nglobalThis.contract = { migrate: ensureCryoChamberInventoryLayout, map: NEW_TO_LEGACY_SLOT, legacy: SLOT_LAYOUTS, previous: PREVIOUS_SLOT_LAYOUT, key: LAYOUT_KEY, version: LAYOUT_VERSION };', context);
const { migrate, map, legacy, previous, key, version } = context.contract;
assert.equal(map.length, 36);
assert.equal(new Set(map).size, 36);
assert(!map.includes(13) && !map.includes(15));
assert.deepEqual(Array.from(map), Array.from({ length: 38 }, (_, i) => i).filter(i => i !== 13 && i !== 15));

function run(size, marker) {
    const original = Array.from({ length: size }, (_, i) => `slot_${i}`);
    const machine = {
        container: { size }, items: [...original], dropped: [],
        entity: { properties: { [key]: marker }, getDynamicProperty(name) { return this.properties[name]; } },
        ensureInventoryLayout(target, sourceSlots) {
            assert.equal(target, 36);
            assert.equal(sourceSlots.length, 36);
            const retained = new Set(sourceSlots);
            for (let slot = 0; slot < this.items.length; slot++) {
                if (!retained.has(slot) && this.items[slot] !== undefined) this.dropped.push(this.items[slot]);
            }
            this.items = sourceSlots.map(slot => this.items[slot]);
            this.container.size = target;
            return false;
        },
    };
    let complete = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        if (migrate(machine)) { complete = true; break; }
    }
    assert(complete, `${size}-slot migration did not finish`);
    assert.equal(machine.container.size, 36);
    assert.equal(machine.entity.properties[key], version);
    if (size === 36 && marker === version) {
        assert.deepEqual(Array.from(machine.items), original);
        assert.deepEqual(machine.dropped, []);
        return;
    }
    let old38 = original;
    if (size === 36 || size === 37) old38 = Array.from(legacy[size], slot => slot >= 0 ? original[slot] : undefined);
    else if (marker !== 'contiguous_upgrades_v1' && marker !== version) old38 = Array.from(previous, slot => original[slot]);
    assert.deepEqual(Array.from(machine.items), Array.from(map, slot => old38[slot]));
    assert.deepEqual(machine.dropped, [old38[13], old38[15]].filter(Boolean));
}
for (const size of [36, 37, 38]) run(size, size === 38 ? 'contiguous_upgrades_v1' : '');
run(38, '');
run(36, version);
console.log('Cryo Chamber migrations from 36/37/38 slots preserve useful items and return removed containers.');

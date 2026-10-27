import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projects = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = 64; }
    clone() { return new ItemStack(this.typeId, this.amount); }
    isStackableWith(other) { return this.typeId === other.typeId; }
}

async function library(pack) {
    const base = path.join(projects, pack, "BP/scripts/DoriosLib");
    const context = vm.createContext({ console });
    const modules = new Map();
    const synthetic = (id, values) => {
        const module = new vm.SyntheticModule(Object.keys(values), function () {
            for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context, identifier: id });
        modules.set(id, module);
    };
    synthetic("@minecraft/server", { ItemStack, BlockComponentTypes: { Inventory: "minecraft:inventory" },
        EntityComponentTypes: { Inventory: "minecraft:inventory", TypeFamily: "minecraft:type_family" }, system: {}, world: {} });
    synthetic(path.join(base, "utils/index.js"), { isPlainObject: value => !!value && typeof value === "object" && !Array.isArray(value) });
    synthetic(path.join(base, "linkNodes/index.js"), {
        getLinkNodeIOOverride: () => [4, 5, 6, 7], isLinkedEntity: () => true, isLinkNode: () => true, resolveLinkNode: () => undefined,
    });
    synthetic(path.join(base, "containers/ioFaceState.js"), { isIOFaceDisabled: () => false, setIOFaceDisabled() {} });
    const load = async id => {
        if (modules.has(id)) return modules.get(id);
        const module = new vm.SourceTextModule(fs.readFileSync(id, "utf8"), { context, identifier: id });
        modules.set(id, module);
        await module.link((specifier, parent) => load(specifier.startsWith(".") ? path.resolve(path.dirname(parent.identifier), specifier) : specifier));
        return module;
    };
    const module = await load(path.join(base, "containers/index.js"));
    await module.evaluate();
    return module.namespace;
}

function entity(id = "target") {
    const items = new Map();
    const container = { isValid: true, size: 36, getItem: slot => items.get(slot),
        setItem: (slot, item) => item ? items.set(slot, item) : items.delete(slot), addItem() { throw new Error("Should not use unfiltered fast path"); } };
    return { id, isValid: true, items, container,
        getDynamicProperty() {}, runCommand() {},
        getComponent: name => name === "minecraft:type_family" ? { hasTypeFamily: () => true } : { container } };
}

for (const pack of ["Ascendant-Technology", "UtilityCraft", "UtilityCraft-Heavy-Machinery"]) {
    test(`${pack}: optional filter rejects invalid items and locked slots through every normal IO route`, async () => {
        const lib = await library(pack), target = entity();
        lib.setConfig(target, {
            version: 1, type: "complex", anyInputSlots: [4, 5, 6, 7], anyOutputSlots: [9],
            inputConfig: {}, outputConfig: {}, inputFilter: { itemIds: ["utilitycraft:blaze_essence"], slots: [4] },
        });
        assert.deepEqual(Array.from(lib.getInputSlots(target)), [4]);
        assert.equal(lib.insert(target, { item: new ItemStack("minecraft:diamond") }), 0);
        assert.equal(lib.insert(target, { item: new ItemStack("utilitycraft:blaze_essence", 3) }), 3);
        assert.equal(target.items.get(4).amount, 3);
        const source = entity("source"); source.items.set(0, new ItemStack("utilitycraft:blaze_essence", 5));
        assert.equal(lib.transfer(source, { sourceSlot: 0, target, targetSlots: [7] }), 0);
        assert.equal(source.items.get(0).amount, 5);
        const linked = { kind: "entity", owner: target, entity: target, container: target.container, via: "link_node", block: { location: {} } };
        assert.deepEqual(Array.from(lib.getInputSlots(linked)), [4]);
        assert.equal(lib.transfer(source, { sourceSlot: 0, target: linked }), 5);
        assert.equal(target.items.get(4).amount, 8);
        assert.equal(source.items.get(0), undefined);
        source.items.set(0, new ItemStack("minecraft:diamond"));
        assert.equal(lib.transfer(source, { sourceSlot: 0, target, targetSlots: [4] }), 0);
        const clone = lib.getConfig(target);
        clone.inputFilter.slots.push(7);
        assert.deepEqual(Array.from(lib.getConfig(target).inputFilter.slots), [4]);
    });
    test(`${pack}: absent filter preserves existing policy and invalid filter documents fail closed`, async () => {
        const lib = await library(pack), target = entity();
        const config = { version: 1, type: "simple", inputConfig: [4], outputConfig: [9] };
        lib.setConfig(target, config);
        assert.equal(lib.insert(target, { item: new ItemStack("minecraft:diamond", 3) }), 3);
        assert.equal(lib.getConfig(target).inputFilter, undefined);
        assert.throws(() => lib.setConfig(target, { ...config, inputFilter: { itemIds: ["invalid id"], slots: [4] } }), /item identifiers/);
        assert.throws(() => lib.setConfig(target, { ...config, inputFilter: { itemIds: ["minecraft:diamond"], slots: [36] } }), /out-of-range/);
    });
}

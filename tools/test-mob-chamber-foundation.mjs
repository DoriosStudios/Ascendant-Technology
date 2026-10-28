import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "BP/scripts/features/multiblocks/mobChamber");
const key = p => `${p.x},${p.y},${p.z}`;
const controllerId = "utilitycraft:mob_chamber_controller";
const coreId = "utilitycraft:mob_chamber_core";
const caseTag = "dorios:multiblock.case.titanium";
const componentTag = "dorios:multiblock_component";
const internalPositions = [];
for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) for (let z = 1; z <= 3; z++) internalPositions.push({ x, y, z });

function fixture(rotation = 0, controller = { x: 2, y: 2, z: 0 }) {
    const blocks = new Map();
    const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
    const put = (position, typeId, tags = []) => blocks.set(key(position), {
        ...position, location: position, typeId, hasTag: tag => tags.includes(tag),
    });
    for (let x = 0; x <= 4; x++) for (let y = 0; y <= 4; y++) for (let z = 0; z <= 4; z++) {
        const outside = [x, y, z].some(n => n === 0 || n === 4);
        put({ x, y, z }, outside ? "utilitycraft:titanium_case" : "minecraft:air", outside ? [caseTag] : []);
    }
    put(controller, controllerId, ["dorios:multiblock.controller"]);
    for (const [type, position] of [["energy", { x: 0, y: 0, z: 0 }], ["fluid", { x: 4, y: 4, z: 4 }], ["item", { x: 0, y: 2, z: 2 }]]) {
        const p = key(position) === key(controller) ? { x: 0, y: 4, z: 0 } : position;
        put(p, `utilitycraft:titanium_${type}_port`, [caseTag, "dorios:link_node"]);
    }
    const componentIds = [coreId, "utilitycraft:energy_cell", "utilitycraft:fluid_cell", "utilitycraft:processing_module", "utilitycraft:speed_module", "utilitycraft:efficiency_module", "utilitycraft:essence_module"];
    componentIds.forEach((id, i) => put(internalPositions[(i + rotation) % 27], id, [componentTag]));
    const dimension = { getBlock: position => blocks.get(key(position)), spawnParticle() {} };
    const block = dimension.getBlock(controller);
    block.dimension = dimension;
    const messages = [];
    const event = { block, player: { sendMessage: message => messages.push(message) } };
    return { bounds, controller, dimension, put, blocks, componentIds, event, messages };
}

function rectangularFixture(width, height, depth, controller = { x: 0, y: 1, z: 1 }) {
    const blocks = new Map();
    const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: width - 1, y: height - 1, z: depth - 1 } };
    const put = (position, typeId, tags = []) => blocks.set(key(position), {
        ...position, location: position, typeId, hasTag: tag => tags.includes(tag),
    });
    for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) for (let z = 0; z < depth; z++) {
        const outside = x === 0 || x === width - 1 || y === 0 || y === height - 1 || z === 0 || z === depth - 1;
        put({ x, y, z }, outside ? "utilitycraft:titanium_case" : "minecraft:air", outside ? [caseTag] : []);
    }
    const ports = [
        ["energy", { x: 0, y: 0, z: 0 }],
        ["fluid", { x: width - 1, y: height - 1, z: depth - 1 }],
        ["item", { x: width - 1, y: 0, z: 0 }],
    ];
    for (const [type, position] of ports) put(position, `utilitycraft:titanium_${type}_port`, [caseTag, "dorios:link_node"]);
    put(controller, controllerId, ["dorios:multiblock.controller"]);
    const interior = [];
    for (let x = 1; x < width - 1; x++) for (let y = 1; y < height - 1; y++) for (let z = 1; z < depth - 1; z++) interior.push({ x, y, z });
    [coreId, "utilitycraft:energy_cell", "utilitycraft:fluid_cell", "utilitycraft:processing_module"]
        .forEach((id, index) => put(interior[index], id, [componentTag]));
    const dimension = { getBlock: position => blocks.get(key(position)), spawnParticle() {} };
    const block = dimension.getBlock(controller);
    block.dimension = dimension;
    const event = { block, player: { sendMessage() {} } };
    return { bounds, controller, dimension, put, interior, event };
}

class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = typeId.endsWith("_sword") ? 1 : 64; this.lore = []; }
    get nameTag() { return this._nameTag; }
    set nameTag(value) {
        assert(value.length <= 255, `nameTag exceeds Bedrock limit: ${value.length}`);
        this._nameTag = value;
    }
    setLore(lore) { this.lore = [...lore]; }
    clone() { return Object.assign(new ItemStack(this.typeId, this.amount), structuredClone(this)); }
    isStackableWith(other) {
        return this.typeId === other.typeId && this.nameTag === other.nameTag && JSON.stringify(this.lore) === JSON.stringify(other.lore)
            && JSON.stringify(this.metadata) === JSON.stringify(other.metadata);
    }
}

async function environment() {
    const context = vm.createContext({ console });
    const cache = new Map();
    const calls = [];
    const core = {};
    let registration;
    let currentEntity;
    const entities = new Map();
    let nextId = 0;
    const api = { generateLootFromEntityType() { return undefined; } };
    const world = { getEntity: id => entities.get(id), getLootTableManager: () => api, afterEvents: { entityLoad: { subscribe() {} } } };
    const linkNode = { createLinkNodeTag: p => `dorios:link_node[${key(p)}]`, isLinkNode: b => b.hasTag("dorios:link_node") };
    const synthetic = (name, value) => {
        const module = new vm.SyntheticModule(Object.keys(value), function () {
            for (const [key, entry] of Object.entries(value)) this.setExport(key, entry);
        }, { context, identifier: name });
        cache.set(name, module);
        return module;
    };
    synthetic("@minecraft/server", { ItemStack, world, EntityTypes: { get: id => ({ id }) }, ItemLockMode: { slot: "slot" }, system: { currentTick: 1, waitTicks: async () => {}, run() {}, runInterval() {} } });
    synthetic("DoriosCore/machinery/constants.js", { CONSTANT_FLUID_TYPE_TAG: "dorios:constant_fluid_type" });
    synthetic("DoriosCore/utils/entity.js", { hasOpenUI: entity => entity.uiOpen === true });
    synthetic("DoriosLib/index.js", {
        linkNode,
        registry: { blockComponent(id, component) { registration = { id, component }; } },
        container: { setConfig(entity, config) { entity.itemIO = config; calls.push("itemIO"); } },
    });
    // Core detector itself is real; storage and activation are Bedrock-facing doubles.
    const linkPath = path.join(root, "BP/scripts/DoriosLib/linkNodes/index.js");
    synthetic(linkPath, linkNode);
    const load = async name => {
        if (cache.has(name)) return cache.get(name);
        const module = new vm.SourceTextModule(fs.readFileSync(name, "utf8"), { context, identifier: name });
        cache.set(name, module);
        await module.link((specifier, parent) => load(specifier.startsWith(".")
            ? path.resolve(path.dirname(parent.identifier), specifier) : specifier));
        return module;
    };
    const detector = await load(path.join(root, "BP/scripts/DoriosCore/multiblock/structureDetection.js"));
    await detector.evaluate();
    core.StructureDetector = detector.namespace.StructureDetector;
    core.Constants = (await load(path.join(root, "BP/scripts/DoriosCore/multiblock/constants.js"))).namespace;
    core.EntityManager = { getControllerEntityFromBlock: () => currentEntity };
    core.DeactivationManager = {
        deactivateEntity(entity) { entity.state = "off"; calls.push("deactivate"); },
        handleBreakController(...args) { calls.push(["break", ...args]); },
    };
    core.ActivationManager = {
        activateMultiblock(entity, structure) {
            calls.push("activate"); entity.state = "on"; entity.structure = structure;
            return (structure.components.energy_cell ?? 0) * 4_000_000;
        },
    };
    class MultiblockMachine {
        static handlePlayerInteract(...args) { calls.push(["interact", this, ...args]); }
    }
    synthetic("DoriosCore/index.js", {
        Multiblock: core, MultiblockMachine,
        registerLinkNodeIO() {},
        EnergyStorage: { formatEnergyToText: amount => `${amount} DE` },
        FluidStorage: { formatFluid: amount => `${amount} mB`, initializeMultiple(entity, count) { assert.equal(count, 1); return [{
            get: () => entity.fluid ?? 0,
            getType: () => entity.fluidType ?? "empty",
            setType(type) { entity.fluidType = type; },
            setCap(cap) { entity.xpCap = cap; calls.push("xpCap"); },
        }]; } },
        setFluidConfig(entity, config) { entity.fluidIO = config; calls.push("fluidIO"); },
    });
    const index = await load(path.join(folder, "index.js"));
    await index.evaluate();
    const config = (await load(path.join(folder, "config.js"))).namespace;
    const structure = (await load(path.join(folder, "structure.js"))).namespace;
    const ui = (await load(path.join(folder, "uiState.js"))).namespace;
    const makeEntity = (size = 40, typeId = "at:mob_chamber_machine") => {
        const props = new Map();
        const items = new Map();
        const entity = { id: `chamber_${++nextId}`, typeId, isValid: true, state: "off", props, items, location: { x: 2.5, y: 2, z: 0.5 },
            addTag() {}, remove() { entities.delete(this.id); this.isValid = false; },
            getDynamicProperty: name => props.get(name),
            setDynamicProperty: (name, value) => value === undefined ? props.delete(name) : props.set(name, value),
            getComponent: () => ({ container: {
                size, getItem: slot => items.get(slot)?.clone?.() ?? items.get(slot), setItem: (slot, item) => item ? items.set(slot, item.clone?.() ?? item) : items.delete(slot),
            } }),
        };
        entities.set(entity.id, entity);
        entity.dimension = { spawnEntity(id, location) { const page = makeEntity(54, id); page.location = location; return page; } };
        if (typeId === "at:mob_chamber_machine") currentEntity = entity;
        return entity;
    };
    const runtime = (await load(path.join(folder, "runtime.js"))).namespace;
    const essences = (await load(path.join(folder, "essences.js"))).namespace;
    const staging = (await load(path.join(folder, "staging.js"))).namespace;
    const loot = (await load(path.join(folder, "loot.js"))).namespace;
    const transaction = (await load(path.join(folder, "transaction.js"))).namespace;
    return { ...config, ...structure, ...ui, ...runtime, ...essences, ...staging, ...loot, ...transaction,
        Controller: index.namespace.MobChamberController, registration, makeEntity, core, calls, api, entities, world };
}

test("Core and every internal component can occupy all 27 positions", async () => {
    const env = await environment();
    for (let rotation = 0; rotation < 27; rotation++) {
        const f = fixture(rotation);
        const result = env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock);
        assert.equal(result.valid, true, `rotation ${rotation}: ${result.code}`);
        for (const id of f.componentIds) assert.equal(result.components[id.split(":")[1]], 1);
    }
});

test("real Dorios Core detection supports all 98 Controller positions on the shell", async () => {
    const env = await environment();
    const positions = [];
    for (let x = 0; x <= 4; x++) for (let y = 0; y <= 4; y++) for (let z = 0; z <= 4; z++) if ([x, y, z].some(n => n === 0 || n === 4)) positions.push({ x, y, z });
    for (const controller of positions) {
        const f = fixture(0, controller);
        const detected = await env.core.StructureDetector.detectFromController(f.event, caseTag);
        assert.deepEqual(JSON.parse(JSON.stringify(detected.bounds)), f.bounds);
        const result = env.validateChamberStructure(detected.bounds, f.controller, f.dimension.getBlock);
        assert.equal(result.valid, true);
        assert.equal(result.ports.length, 3);
    }
});

test("closed rectangular casings accept variable width, height and depth with only mandatory parts", async () => {
    const env = await environment();
    for (const size of [[3, 4, 4], [3, 3, 6], [4, 4, 4], [4, 6, 7], [10, 8, 12]]) {
        const [width, height, depth] = size;
        for (const controller of [
            { x: 0, y: 1, z: 1 }, { x: width - 1, y: 1, z: 1 },
            { x: 1, y: 0, z: 1 }, { x: 1, y: height - 1, z: 1 },
            { x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: depth - 1 },
        ]) {
            const f = rectangularFixture(width, height, depth, controller);
            const detected = await env.core.StructureDetector.detectFromController(f.event, caseTag);
            assert.deepEqual(JSON.parse(JSON.stringify(detected.bounds)), f.bounds, `${size} at ${key(controller)}`);
            const checked = env.validateChamberStructure(detected.bounds, controller, f.dimension.getBlock);
            assert.equal(checked.valid, true, `${size} at ${key(controller)}: ${checked.code}`);
            assert.equal(checked.components.mob_chamber_core, 1);
            assert.equal(checked.components.processing_module, 1);
        }
    }
});

test("variable casings still reject holes, liquids and interiors too small for mandatory parts", async () => {
    const env = await environment();
    const small = rectangularFixture(3, 3, 6);
    assert.equal(env.validateChamberStructure(small.bounds, small.controller, small.dimension.getBlock).valid, true);
    small.put({ x: 0, y: 1, z: 2 }, "minecraft:air");
    assert.equal(env.validateChamberStructure(small.bounds, small.controller, small.dimension.getBlock).code, "shell");
    const liquid = rectangularFixture(4, 4, 4);
    liquid.put(liquid.interior[7], "minecraft:water");
    assert.equal(env.validateChamberStructure(liquid.bounds, liquid.controller, liquid.dimension.getBlock).code, "internal");
    const cramped = rectangularFixture(3, 3, 6);
    assert.equal(env.validateChamberStructure({ min: cramped.bounds.min, max: { x: 2, y: 2, z: 4 } },
        cramped.controller, cramped.dimension.getBlock).code, "size");
});

test("strict validation rejects missing/duplicate Core, required cells, foreign modules, liquids and extra Controllers", async () => {
    const env = await environment();
    for (const [id, code] of [["utilitycraft:mob_chamber_core", "core_count"], ["utilitycraft:energy_cell", "energy_cell"], ["utilitycraft:fluid_cell", "fluid_cell"], ["utilitycraft:processing_module", "processing_module"]]) {
        const f = fixture(); f.put(internalPositions[f.componentIds.indexOf(id)], "minecraft:air");
        assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, code);
    }
    for (const [id, code] of [[coreId, "core_count"], ["utilitycraft:gas_cell", "internal"], ["utilitycraft:basic_power_condenser_unit", "internal"], ["minecraft:water", "internal"], [controllerId, "internal"], ["foreign:mob_chamber_core", "internal"]]) {
        const f = fixture(); f.put(internalPositions[26], id, [componentTag]);
        assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, code);
    }
});

test("foreign component names cannot satisfy legacy counts or Chamber roles without an exact-ID adapter", async () => {
    const env = await environment();
    const f = fixture();
    const speedPosition = internalPositions[f.componentIds.indexOf("utilitycraft:speed_module")];
    f.put(speedPosition, "other:speed_module", [componentTag]);
    const detected = await env.core.StructureDetector.detectFromController(f.event, caseTag);
    assert.equal(detected.componentsById["other:speed_module"], 1);
    assert.equal(detected.components.speed_module, undefined);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, "internal");

    const accepted = env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        { "other:speed_module": { role: "speed_module" } });
    assert.equal(accepted.valid, true);
    assert.equal(accepted.components.speed_module, 1);
    assert.equal(accepted.componentsById["other:speed_module"], 1);
});

test("external Cells need explicit positive capacities, and cannot impersonate Core", async () => {
    const env = await environment();
    const f = fixture();
    const energyPosition = internalPositions[f.componentIds.indexOf("utilitycraft:energy_cell")];
    f.put(energyPosition, "other:energy_cell", [componentTag]);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, "internal");
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        { "other:energy_cell": { role: "energy_cell" } }).code, "internal");
    const accepted = env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        { "other:energy_cell": { role: "energy_cell", energyCapacity: 2_000_000 } });
    assert.equal(accepted.valid, true);
    assert.equal(accepted.components.energy_cell, 1);
    assert.equal(accepted.componentsById["other:energy_cell"], 1);
    assert.deepEqual(JSON.parse(JSON.stringify(accepted.energyCapacityById)), { "other:energy_cell": 2_000_000 });
    assert.equal(accepted.xpCapacity, 256_000);
    assert.equal(env.computeChamberStats(accepted.components, { xpCapacity: accepted.xpCapacity }).xpCapacity, 256_000);
    const forbidden = fixture();
    forbidden.put(internalPositions[forbidden.componentIds.indexOf(coreId)], "other:mob_chamber_core", [componentTag]);
    assert.equal(env.validateChamberStructure(forbidden.bounds, forbidden.controller, forbidden.dimension.getBlock,
        { "other:mob_chamber_core": { role: "mob_chamber_core" } }).code, "internal");
});

test("external shell blocks need an exact-ID allowlist and case tag; foreign ports remain unsupported", async () => {
    const env = await environment();
    const f = fixture();
    const position = { x: 4, y: 0, z: 0 };
    f.put(position, "other:titanium_case", [caseTag]);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, "shell");
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        {}, ["other:titanium_case"]).valid, true);
    f.put(position, "other:titanium_case", []);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        {}, ["other:titanium_case"]).code, "shell");
    f.put(position, "other:titanium_case", [caseTag, "dorios:link_node"]);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock,
        {}, ["other:titanium_case"]).code, "port");
});

test("strict validation rejects wrong dimensions, shell, missing ports and unloaded blocks", async () => {
    const env = await environment();
    const f = fixture();
    assert.equal(env.validateChamberStructure({ min: f.bounds.min, max: { x: 1, y: 4, z: 4 } }, f.controller, f.dimension.getBlock).code, "size");
    assert.equal(env.validateChamberStructure(f.bounds, { x: 2, y: 2, z: 2 }, f.dimension.getBlock).code, "controller_position");
    for (const [type, position] of [["energy", { x: 0, y: 0, z: 0 }], ["fluid", { x: 4, y: 4, z: 4 }], ["item", { x: 0, y: 2, z: 2 }]]) {
        const g = fixture(); g.put(position, "utilitycraft:titanium_case", [caseTag]);
        assert.equal(env.validateChamberStructure(g.bounds, g.controller, g.dimension.getBlock).code, `${type}_port`);
    }
    f.put({ x: 4, y: 0, z: 0 }, "utilitycraft:steel_case", [caseTag]);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).code, "shell");
    const g = fixture(); g.blocks.delete(key(internalPositions[26]));
    assert.equal(env.validateChamberStructure(g.bounds, g.controller, g.dimension.getBlock).code, "unloaded");
});

test("Essence Modules unlock up to eight slots independently of processing capacity", async () => {
    const env = await environment();
    for (let modules = 0; modules <= 9; modules++) {
        const stats = env.computeChamberStats({ essence_module: modules, processing_module: 1 });
        assert.equal(stats.essenceSlots, Math.min(8, 1 + modules));
        assert.equal(stats.processingCapacity, 1);
    }
    const f = fixture();
    for (let i = 7; i < 15; i++) f.put(internalPositions[i], "utilitycraft:essence_module", [componentTag]);
    assert.equal(env.validateChamberStructure(f.bounds, f.controller, f.dimension.getBlock).valid, true);
    const entity = env.makeEntity();
    const activated = await env.Controller.activateMachineController(f.event, env.CONFIG, entity);
    assert(activated);
    assert.equal(entity.state, "on");
    assert.equal(activated.stats.essenceSlots, 8);
    assert(f.messages.some(message => message.includes("2 extra Essence Modules ignored")));
    assert.deepEqual(Array.from(entity.itemIO.anyInputSlots), [4, 5, 6, 7, 36, 37, 38, 39]);
});

test("speed/efficiency retain diminishing multiplicative returns; Processing never multiplies XP", async () => {
    const env = await environment();
    for (let modules = 0; modules < 27; modules++) {
        const stats = env.computeChamberStats({ speed_module: modules, efficiency_module: modules, processing_module: modules, fluid_cell: 2 });
        assert.equal(stats.operationSeconds, 10 * 0.95 ** modules);
        assert.equal(stats.efficiencyMultiplier, 0.975 ** modules);
        assert(stats.operationTicks >= 1);
        assert.equal(stats.xpCapacity, 512_000);
        assert(!Object.keys(stats).some(key => /xp.*multiplier/i.test(key)));
    }
    const extreme = env.computeChamberStats({ speed_module: 100_000, efficiency_module: 100_000 });
    assert.equal(extreme.operationTicks, 1);
    assert(extreme.operationSeconds > 0);
    assert(extreme.efficiencyMultiplier > 0);
    assert.equal(env.operationEnergyCost(4, extreme.efficiencyMultiplier), 1);
});

test("placeholder uses slot 3 only and preserves every button, essence and loot item", async () => {
    const env = await environment(), entity = env.makeEntity();
    const container = entity.getComponent().container;
    for (let slot = 0; slot < env.INVENTORY_SIZE; slot++) if (slot !== 3) entity.items.set(slot, { typeId: `sentinel:${slot}` });
    assert(env.writeUiState(container, env.computeChamberStats({ essence_module: 3, processing_module: 12 })));
    assert.equal(entity.items.get(3).typeId, "utilitycraft:ui_filler");
    assert.equal(entity.items.get(3).nameTag, "at:mob_chamber:v1|e4|p12");
    assert.equal(entity.items.get(3).lockMode, "slot");
    for (let slot = 0; slot < env.INVENTORY_SIZE; slot++) if (slot !== 3) assert.equal(entity.items.get(slot).typeId, `sentinel:${slot}`);
    const placeholder = entity.items.get(3);
    env.writeUiState(container, env.computeChamberStats({ essence_module: 3, processing_module: 12 }));
    assert.equal(entity.items.get(3), placeholder);
    entity.items.set(3, { typeId: "minecraft:diamond" });
    assert.equal(env.writeUiState(container, env.computeChamberStats({})), false);
    assert.equal(entity.items.get(3).typeId, "minecraft:diamond");
    assert.deepEqual(Array.from(env.SLOTS.loot), Array.from({ length: 27 }, (_, i) => 9 + i));
    assert.deepEqual(Array.from(env.SLOTS.essences), [4, 5, 6, 7, 36, 37, 38, 39]);
});

test("activation uses Core lifecycle, filters essence IO, exposes loot/XP and persists raw Chamber stats", async () => {
    const env = await environment(), f = fixture(), entity = env.makeEntity();
    const result = await env.Controller.activateMachineController(f.event, env.CONFIG, entity);
    assert(result);
    assert.equal(entity.state, "on");
    assert.equal(entity.xpCap, 256_000);
    assert.equal(entity.structure.inputBlocks.length, 3);
    assert.equal(JSON.parse(entity.props.get(env.STATS_KEY)).processingCapacity, 1);
    assert.deepEqual(Array.from(entity.itemIO.anyInputSlots), [4, 5]);
    assert.deepEqual(Array.from(entity.itemIO.inputFilter.slots), [4, 5]);
    assert.deepEqual(Array.from(entity.itemIO.anyOutputSlots), Array.from(env.SLOTS.loot));
    assert.deepEqual(Array.from(entity.fluidIO.anyInputIndices), []);
    assert.deepEqual(Array.from(entity.fluidIO.anyOutputIndices), [0]);
    assert(env.calls.indexOf("itemIO") < env.calls.indexOf("activate"));
    assert(env.calls.indexOf("fluidIO") < env.calls.indexOf("activate"));
    assert.equal(entity.items.size, 11);
    assert.equal(entity.fluidType, "xp");
    assert(!f.messages.some(message => message.includes("not enabled yet")));
});

test("invalid final scan cannot activate ports, resize resource caps or replace inventory", async () => {
    const env = await environment(), f = fixture(), entity = env.makeEntity();
    // Generic scan accepts liquids; Chamber final scan must reject before activation.
    f.put(internalPositions[26], "minecraft:water");
    f.dimension.getBlock(internalPositions[26]).isLiquid = true;
    const result = await env.Controller.activateMachineController(f.event, env.CONFIG, entity);
    assert.equal(result, undefined);
    assert.equal(entity.state, "off");
    assert.deepEqual(env.calls, ["deactivate"]);
    assert.equal(entity.items.size, 0);
});

test("rescan refuses fluid capacity loss and real items in the reserved UI slot", async () => {
    for (const occupied of [true, false]) {
        const env = await environment(), f = fixture(), entity = env.makeEntity();
        if (occupied) entity.items.set(3, { typeId: "minecraft:diamond" });
        else entity.fluid = 300_000;
        await env.Controller.activateMachineController(f.event, env.CONFIG, entity);
        assert.equal(entity.state, "off");
        assert.equal(entity.xpCap, undefined);
        assert(!env.calls.includes("activate"));
        if (occupied) assert.equal(entity.items.get(3).typeId, "minecraft:diamond");
        else assert.equal(entity.fluid, 300_000);
    }
});

test("concurrent wrench scans serialize; Controller break delegates to Heavy's shared policy", async () => {
    const env = await environment(), f = fixture(), entity = env.makeEntity();
    await Promise.all([env.Controller.activateMachineController(f.event, env.CONFIG, entity), env.Controller.activateMachineController(f.event, env.CONFIG, entity)]);
    assert.equal(env.calls.filter(call => call === "activate").length, 1);
    const permutation = {};
    env.registration.component.onPlayerBreak({ block: f.event.block, brokenBlockPermutation: permutation, player: f.event.player });
    const call = env.calls.at(-1);
    assert.equal(call[0], "break");
    assert.equal(call[4], permutation);
    assert.equal(env.registration.id, controllerId);
    assert.equal(typeof env.registration.component.onTick, "function");
});

test("paused Mob Chamber retains local assets, localization and archived recipes", () => {
    const atlas = JSON.parse(fs.readFileSync(path.join(root, "RP/textures/terrain_texture.json"), "utf8")).texture_data;
    const crafterSource = fs.readFileSync(path.join(root, "BP/scripts/config/recipes/mobChamber.js"), "utf8");
    let crafter;
    vm.runInNewContext(crafterSource.replace(/^import .*;\r?\n/m, ""), { DoriosLib: { registry: { registerCrafterRecipe(value) { crafter = value; } } } });
    const recipeIndex = fs.readFileSync(path.join(root, "BP/scripts/config/recipes/index.js"), "utf8");
    assert(!/^\s*(?:import|export)\s+.*["']\.\/mobChamber\.js["']/m.test(recipeIndex));
    for (const name of ["mob_chamber_controller", "mob_chamber_core", "essence_module"]) {
        const block = JSON.parse(fs.readFileSync(path.join(root, `BP/blocks/multiblock/mob_chamber/${name}.json`), "utf8"))["minecraft:block"];
        assert.equal(block.description.identifier, `utilitycraft:${name}`);
        assert.equal(block.description.menu_category.category, "none");
        for (const material of Object.values(block.components["minecraft:material_instances"])) {
            const texture = atlas[material.texture]?.textures;
            assert(texture, material.texture);
            assert(fs.existsSync(path.join(root, `RP/${texture}.png`)), texture);
        }
        assert(!fs.existsSync(path.join(root, `BP/recipes/blocks/multiblock/mob_chamber/${name}.json`)));
        const recipe = JSON.parse(fs.readFileSync(path.join(root, `extras/paused_recipes/blocks/multiblock/mob_chamber/${name}.json`), "utf8"))["minecraft:recipe_shaped"];
        const grid = recipe.pattern.join("").split("").map(letter => recipe.key[letter].item.split(":")[1]).join(",");
        assert.equal(crafter[grid].output, `utilitycraft:${name}`);
        for (const language of ["en_US", "pt_BR", "pt_PT", "es_ES", "es_MX", "de_DE", "fr_FR", "ru_RU", "ja_JP", "zh_CN"]) {
            const text = fs.readFileSync(path.join(root, `RP/texts/${language}.lang`), "utf8");
            assert(text.includes(`tile.utilitycraft:${name}.name=`));
        }
    }
});

async function runtimeFixture(count = 1) {
    const env = await environment(), entity = env.makeEntity();
    const container = entity.getComponent().container;
    const stats = env.computeChamberStats({ processing_module: count, essence_module: count - 1, fluid_cell: 1 });
    const energy = { amount: 10_000_000, consumed: [], get() { return this.amount; }, set(value) { this.amount = value; },
        consume(value) { if (this.amount < value) return 0; this.consumed.push(value); this.amount -= value; return value; } };
    const xp = { amount: 0, cap: 256_000, get() { return this.amount; }, getCap() { return this.cap; }, set(value) { this.amount = value; } };
    for (let index = 0; index < count; index++) container.setItem(4 + index, new ItemStack("utilitycraft:blaze_essence", 16));
    env.api.generateLootFromEntityType = () => [new ItemStack("minecraft:blaze_rod", 1)];
    return { env, entity, container, stats, energy, xp,
        step: () => env.processChamber(entity, container, stats, energy, xp, () => 0.99) };
}

test("10-second timer consumes nothing until a single discrete operation executes", async () => {
    const f = await runtimeFixture();
    for (let tick = 1; tick < 200; tick++) { assert.equal(f.step().status, "Processing"); assert.equal(f.energy.amount, 10_000_000); }
    assert.match(f.step().status, /Completed 1/);
    assert.deepEqual(f.energy.consumed, [64_000]);
    assert.equal(f.container.getItem(9).amount, 1);
    assert.equal(f.xp.amount, 10);
    assert.equal(f.container.getItem(4).amount, 16);
    assert.equal(f.entity.props.get(f.env.PROGRESS_KEY), 0);
});

test("1-4 simultaneous deaths have confirmed exponential costs and additive, unmultiplied XP", async () => {
    for (let count = 1; count <= 4; count++) {
        const f = await runtimeFixture(count);
        f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
        assert.match(f.step().status, new RegExp(`Completed ${count}`));
        assert.deepEqual(f.energy.consumed, [[64_000, 256_000, 768_000, 2_048_000][count - 1]]);
        assert.equal(f.xp.amount, count * 10);
        assert.equal(f.container.getItem(9).amount, count);
        for (let slot = 4; slot < 4 + count; slot++) assert.equal(f.container.getItem(slot).amount, 16);
    }
});

test("batch size is limited by Processing capacity as well as unlocked essence slots", async () => {
    const f = await runtimeFixture(4);
    f.stats.processingCapacity = 2;
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    f.step();
    assert.equal(f.xp.amount, 20);
    assert.equal(f.container.getItem(9).amount, 2);
    assert.deepEqual(f.energy.consumed, [256_000]);
    const selected = f.env.selectEssences(f.container, f.stats, 2);
    assert.deepEqual(Array.from(selected.selected, entry => entry.slot), [6, 7]);
});

test("the eighth essence slot participates in a real operation without shifting loot", async () => {
    const f = await runtimeFixture();
    Object.assign(f.stats, f.env.computeChamberStats({ processing_module: 1, essence_module: 7, fluid_cell: 1 }));
    f.container.setItem(4, undefined);
    f.container.setItem(39, new ItemStack("utilitycraft:blaze_essence", 16));
    assert.deepEqual(Array.from(f.env.selectEssences(f.container, f.stats).selected, entry => entry.slot), [39]);
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    assert.match(f.step().status, /Completed 1/);
    assert.equal(f.container.getItem(9).amount, 1);
    assert.equal(f.container.getItem(39).amount, 16);
    assert.equal(f.xp.amount, 10);
});

test("round-robin rotates across valid enabled slots; amount in a stack is not extra deaths", async () => {
    const f = await runtimeFixture(4);
    f.stats.processingCapacity = 1;
    const order = [];
    for (let operation = 0; operation < 6; operation++) {
        const cursor = f.entity.props.get(f.env.CURSOR_KEY) ?? 0;
        order.push(f.env.selectEssences(f.container, f.stats, cursor).selected[0].slot);
        f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
        f.step();
    }
    assert.deepEqual(order, [4, 5, 6, 7, 4, 5]);
    assert.equal(f.xp.amount, 60);
    f.container.setItem(4, new ItemStack("minecraft:diamond"));
    assert.equal(f.env.selectEssences(f.container, { ...f.stats, essenceSlots: 1 }).selected.length, 0);
});

test("clogged loot retains one roll across runtime reloads and consumes nothing until all results fit", async () => {
    const f = await runtimeFixture(2);
    f.container.setItem(4, new ItemStack("utilitycraft:cow_essence"));
    f.container.setItem(5, new ItemStack("utilitycraft:cow_essence"));
    let rolls = 0;
    f.env.api.generateLootFromEntityType = () => { rolls++; return [new ItemStack("minecraft:blaze_rod", 2)]; };
    for (const slot of f.env.SLOTS.loot) f.container.setItem(slot, new ItemStack("minecraft:cobblestone", 64));
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    assert.equal(f.step().status, "Clog: loot output full");
    assert.equal(rolls, 2);
    assert.equal(f.energy.consumed.length, 0);
    const raw = f.entity.props.get(f.env.PENDING_KEY);
    for (let tick = 0; tick < 10; tick++) f.step();
    assert.equal(f.entity.props.get(f.env.PENDING_KEY), raw);
    assert.equal(rolls, 2);
    // A fresh VM represents a script reload; native entities/inventories persist.
    const reloaded = await environment();
    reloaded.world.getEntity = id => f.env.entities.get(id);
    reloaded.api.generateLootFromEntityType = () => { throw new Error("Must not reroll"); };
    f.container.setItem(9, undefined);
    const result = reloaded.processChamber(f.entity, f.container, f.stats, f.energy, f.xp);
    assert.match(result.status, /Completed 2/);
    assert.equal(f.container.getItem(9).amount, 4);
    assert.equal(f.xp.amount, 6);
    assert.deepEqual(f.energy.consumed, [256_000]);
    assert.equal(f.entity.props.get(f.env.PENDING_KEY), undefined);
});

test("XP clog and insufficient energy cannot execute partial batches or consume resources", async () => {
    const f = await runtimeFixture(2);
    f.xp.amount = f.xp.cap - 10;
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    assert.equal(f.step().status, "Clog: XP tank full");
    assert.equal(f.energy.consumed.length, 0);
    assert.equal(f.container.getItem(9), undefined);
    f.xp.amount = 0;
    f.energy.amount = 255_999;
    assert.equal(f.step().status, "Not enough energy");
    assert.equal(f.xp.amount, 0);
    f.energy.amount = 256_000;
    assert.match(f.step().status, /Completed 2/);
    assert.equal(f.energy.amount, 0);
    assert.equal(f.xp.amount, 20);
});

test("pending catalyst changes pause without reroll; restoring catalysts releases the same batch", async () => {
    const f = await runtimeFixture();
    f.xp.cap = 0;
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    f.step();
    const raw = f.entity.props.get(f.env.PENDING_KEY);
    f.container.setItem(4, new ItemStack("utilitycraft:cow_essence"));
    assert.equal(f.step().status, "Restore pending essences/capacity");
    assert.equal(f.entity.props.get(f.env.PENDING_KEY), raw);
    f.container.setItem(4, new ItemStack("utilitycraft:blaze_essence"));
    f.xp.cap = 100;
    assert.match(f.step().status, /Completed 1/);
});

test("native staging supports more than 54 stacks and preserves engine-only metadata", async () => {
    const env = await environment(), entity = env.makeEntity();
    const loot = Array.from({ length: 110 }, (_, index) => {
        const stack = new ItemStack("minecraft:diamond_sword");
        stack.metadata = { opaqueNativeData: index, enchantments: ["sharpness:5"], damage: 67 };
        stack.nameTag = `Loot ${index}`;
        return stack;
    });
    const pending = env.savePending(entity, { selected: [{ slot: 4, typeId: "utilitycraft:blaze_essence" }], xp: 1, cost: 64_000 }, loot);
    assert.equal(pending.pages.length, 3);
    const stored = env.readPendingLoot(entity, env.getPending(entity));
    assert.equal(stored.length, 110);
    for (let index = 0; index < stored.length; index++) assert.deepEqual(stored[index].metadata, loot[index].metadata);
    env.clearPending(entity);
    assert.equal(env.getPending(entity), undefined);
    assert.equal(env.entities.size, 1);
});

test("missing staging data blocks instead of rerolling or granting empty loot", async () => {
    const f = await runtimeFixture();
    f.xp.cap = 0;
    f.entity.setDynamicProperty(f.env.PROGRESS_KEY, 199);
    f.step();
    const pending = f.env.getPending(f.entity);
    f.env.entities.delete(pending.pages[0]);
    f.xp.cap = 100;
    assert.equal(f.step().status, "Waiting for pending storage");
    assert.equal(f.energy.consumed.length, 0);
    assert.equal(f.xp.amount, 0);
});

test("insertion respects item-specific stack limits and compares metadata", async () => {
    const f = await runtimeFixture();
    f.container.setItem(9, new ItemStack("minecraft:blaze_rod", 63));
    const named = new ItemStack("minecraft:blaze_rod", 64); named.nameTag = "Different metadata";
    const plan = f.env.planLootInsertion(f.container, f.env.SLOTS.loot, [new ItemStack("minecraft:blaze_rod", 3), named, new ItemStack("minecraft:diamond_sword"), new ItemStack("minecraft:diamond_sword")]);
    assert.equal(plan.items[0].amount, 64);
    assert.equal(plan.items[1].amount, 2);
    assert.equal(plan.items[2].nameTag, "Different metadata");
    assert.equal(plan.items[3].amount, 1);
    assert.equal(plan.items[4].amount, 1);
    assert.equal(f.container.getItem(9).amount, 63);
});

test("commit exceptions roll back loot, energy and XP, keeping pending output stable", async () => {
    const f = await runtimeFixture();
    const plan = f.env.planLootInsertion(f.container, f.env.SLOTS.loot, [new ItemStack("minecraft:blaze_rod")]);
    const setItem = f.container.setItem;
    let throwOnce = true;
    f.container.setItem = (slot, item) => { if (slot === 10 && throwOnce) { throwOnce = false; throw new Error("native failure"); } setItem(slot, item); };
    assert.throws(() => f.env.commitOperation(f.container, plan, f.energy, f.xp, 64_000, 10), /native failure/);
    assert.equal(f.energy.amount, 10_000_000);
    assert.equal(f.xp.amount, 0);
    assert.equal(f.container.getItem(9), undefined);
});

test("Illager follows Spawner weights and Slime/Magma sizes have exact boundary probabilities", async () => {
    const env = await environment();
    for (const [random, mob] of [[0, "pillager"], [45 / 96, "vindicator"], [80 / 96, "witch"], [95 / 96, "evoker"]]) {
        assert.equal(env.deathProfile("utilitycraft:illager_essence", () => random).mob, mob);
    }
    for (const mob of ["slime", "magma_cube"]) for (const [random, size] of [[0, 1], [0.49999, 1], [0.5, 2], [0.79999, 2], [0.8, 4], [0.99999, 4]]) {
        const profile = env.deathProfile(`utilitycraft:${mob}_essence`, () => random);
        assert.equal(profile.size, size);
        assert.equal(env.deathXp(profile), size);
    }
});

test("local fallback covers every essence and respects size-specific vanilla drops", async () => {
    const env = await environment();
    for (const id of env.ESSENCE_IDS) {
        const profile = env.deathProfile(id, () => 0.9);
        assert(Array.isArray(env.fallbackLoot(profile, () => 0.9)));
    }
    assert.equal(env.fallbackLoot({ mob: "slime", size: 4 }).length, 0);
    assert.equal(env.fallbackLoot({ mob: "slime", size: 2 }).length, 0);
    assert.equal(env.fallbackLoot({ mob: "magma_cube", size: 1 }).length, 0);
    assert.equal(env.fallbackLoot({ mob: "slime", size: 1 }, () => 0.99)[0].typeId, "minecraft:slime_ball");
    assert.equal(env.fallbackLoot({ mob: "magma_cube", size: 4 }, () => 0.99)[0].typeId, "minecraft:magma_cream");
    assert.equal(env.fallbackLoot({ mob: "evoker" }, () => 0.99).at(-1).typeId, "minecraft:totem_of_undying");
});

test("LootTableManager receives EntityType, empty API rolls stay empty and exceptions use fallback", async () => {
    const env = await environment();
    env.api.generateLootFromEntityType = entityType => { assert.equal(entityType.id, "minecraft:cow"); return []; };
    assert.equal(env.generateDeathLoot({ entityId: "minecraft:cow", mob: "cow" }).length, 0);
    env.api.generateLootFromEntityType = () => { throw new Error("unavailable"); };
    assert.equal(env.generateDeathLoot({ entityId: "minecraft:cow", mob: "cow" }, () => 0.99)[0].typeId, "minecraft:leather");
});

test("UI routes by title and placeholder, maps every output exactly once and preserves indices", () => {
    const ui = JSON.parse(fs.readFileSync(path.join(root, "RP/ui/mob_chamber.json"), "utf8"));
    const controls = ui.chamber_top.controls;
    const loot = controls.flatMap(control => Object.entries(control)).filter(([name]) => name.startsWith("loot_"));
    assert.equal(loot.length, 27);
    assert.deepEqual(loot.map(([, control]) => control.$slot_index), Array.from({ length: 27 }, (_, index) => index + 9));
    const essenceIndices = [4, 5, 6, 7, 36, 37, 38, 39];
    for (let slots = 1; slots <= 8; slots++) {
        const variant = controls.find(control => control[`essences_${slots}`])[`essences_${slots}`];
        assert.equal(variant.type, "collection_panel", "indexed children require a collection parent");
        assert.equal(variant.collection_name, "container_items");
        assert.equal(variant.controls.length, slots);
        assert(variant.bindings[0].source_property_name.includes(`|e${slots}|`));
        assert.deepEqual(variant.controls.map(control => Object.values(control)[0].$slot_index), essenceIndices.slice(0, slots));
        assert.deepEqual(variant.controls.map(control => Object.values(control)[0].collection_index), essenceIndices.slice(0, slots));
    }
    assert(controls.find(control => control.state_reader).state_reader.collection_index === 3);
    assert.deepEqual(ui["slot@common.container_item"].$item_renderer_size, [16,16]);
    assert.deepEqual(ui["slot@common.container_item"].$item_renderer_offset, [0,0]);
    const router = fs.readFileSync(path.join(root, "RP/ui/chest_screen.json"), "utf8");
    assert(router.includes("entity.utilitycraft:mob_chamber.name"));
    const entity = JSON.parse(fs.readFileSync(path.join(root, "BP/entities/mob_chamber_machine.json"), "utf8"))["minecraft:entity"];
    assert.equal(entity.component_groups["utilitycraft:inventory_40"]["minecraft:inventory"].inventory_size, 40);
    assert.equal(entity.component_groups["utilitycraft:inventory_36"]["minecraft:inventory"].inventory_size, 40);
    assert(entity.events["utilitycraft:inventory_40"]);
});

test("Speed changes only the interval and Efficiency changes only the discrete payment", async () => {
    const f = await runtimeFixture(2);
    f.stats = f.env.computeChamberStats({ processing_module: 2, essence_module: 1, fluid_cell: 1, speed_module: 2, efficiency_module: 7 });
    const step = () => f.env.processChamber(f.entity, f.container, f.stats, f.energy, f.xp, () => 0.99);
    for (let tick = 1; tick < f.stats.operationTicks; tick++) {
        step(); assert.equal(f.energy.consumed.length, 0);
    }
    assert.match(step().status, /Completed 2/);
    assert.equal(f.stats.operationTicks, 181);
    assert.deepEqual(f.energy.consumed, [Math.ceil(256_000 * 0.975 ** 7)]);
    assert.equal(f.xp.amount, 20);
});

test("staging cleanup preserves active/malformed batches and tolerates owner load ordering", async () => {
    const env = await environment(), owner = env.makeEntity();
    const batch = env.savePending(owner, { selected: [], xp: 1, cost: 64_000 }, [new ItemStack("minecraft:diamond")]);
    const page = env.world.getEntity(batch.pages[0]);
    env.cleanupStagingPage(page);
    assert(page.isValid);
    owner.setDynamicProperty(env.PENDING_KEY, "malformed");
    env.cleanupStagingPage(page);
    assert(page.isValid);
    env.entities.delete(owner.id);
    page.dimension.getBlock = () => ({ typeId: "utilitycraft:mob_chamber_controller" });
    env.cleanupStagingPage(page);
    assert(page.isValid);
    page.dimension.getBlock = () => ({ typeId: "minecraft:air" });
    env.cleanupStagingPage(page);
    assert.equal(page.isValid, false);
});

test("reducing Essence Modules never hides or deletes occupied disabled slots", async () => {
    const env = await environment(), owner = env.makeEntity();
    const container = owner.getComponent().container;
    container.setItem(7, new ItemStack("utilitycraft:cow_essence", 2));
    const stats = env.computeChamberStats({ processing_module: 1, fluid_cell: 1 });
    assert.equal(env.prepareInventory(container, stats), false);
    assert.equal(container.getItem(7).amount, 2);
    assert.equal(owner.items.size, 1);
});

test("console frames clamp invalid capacities and distinguish blocked outputs", async () => {
    const env = await environment();
    for (const [amount, capacity, frame] of [[0,100,0],[50,100,11],[100,100,22],[200,100,22],[-1,100,0],[1,0,0],[NaN,100,0],[1,Infinity,0]]) {
        assert.equal(env.meterFrame(amount, capacity), frame);
    }
    assert.equal(env.chamberDisplayState("Clog: loot output full"), "loot");
    assert.equal(env.chamberDisplayState("Clog: XP tank full"), "xp");
    assert.equal(env.chamberDisplayState("Not enough energy"), "energy");
    assert.equal(env.chamberDisplayState("Completed 4 virtual deaths"), "completed");
});

test("open console updates presentation only, retaining placeholder, items and progress contract", async () => {
    const env = await environment(), entity = env.makeEntity(), container = entity.getComponent().container;
    const stats = env.computeChamberStats({ processing_module: 4, essence_module: 3, fluid_cell: 1 });
    assert(env.prepareInventory(container, stats));
    container.setItem(4, new ItemStack("utilitycraft:zombie_essence", 8));
    container.setItem(9, new ItemStack("minecraft:rotten_flesh", 32));
    const marker = container.getItem(3).nameTag, displays = [];
    const energy = { get: () => 50, getCap: () => 100, display: slot => displays.push(slot) };
    const xp = { get: () => 100, getCap: () => 100, display: slot => displays.push(slot) };
    const result = { status: "Clog: XP tank full", progress: stats.operationTicks, cost: 256000 };
    env.renderChamberUI(entity, container, stats, energy, xp, result);
    assert.equal(displays.length, 0);
    entity.uiOpen = true;
    env.renderChamberUI(entity, container, stats, energy, xp, result);
    assert.deepEqual(displays, [0,8]);
    assert.equal(container.getItem(2).typeId, "utilitycraft:progress_right_big_bar_22");
    assert.equal(container.getItem(2).nameTag, "at:mob_chamber:meters:v1|t22|e11|x22|sxp|");
    assert.equal(container.getItem(2).lockMode, "slot");
    assert.equal(container.getItem(3).nameTag, marker);
    assert.equal(container.getItem(4).amount, 8);
    assert.equal(container.getItem(9).amount, 32);
    const info = container.getItem(1);
    const fullDisplay = [info.nameTag, ...info.lore].join("\n");
    assert(fullDisplay.length > 255, "exercise a display exceeding the nameTag limit");
    assert(info.nameTag.length <= 255);
    assert(info.nameTag.includes("Clog: XP tank full"));
    assert(info.lore.every(line => line.length <= 255));
    assert(fullDisplay.includes("256000 DE"));
    assert(fullDisplay.includes("Energy Information"));
    assert(fullDisplay.includes("XP Tank"));
});

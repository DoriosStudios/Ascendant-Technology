import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const json = file => JSON.parse(read(file));
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/\bexport /g, "");
const plain = value => JSON.parse(JSON.stringify(value));
class Stack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = typeId.includes("bucket") ? 16 : 64; this.nameTag = "custom"; this.lore = ["preserve me"]; }
    clone() { return Object.assign(new Stack(this.typeId, this.amount), { nameTag: this.nameTag, lore: [...this.lore] }); }
}
function storage(type, capacity, amount = 0) {
    return { type, amount, capacity, get() { return this.amount; }, getType() { return this.type; }, setType(v) { this.type = v; },
        getCap() { return this.capacity; }, getFreeSpace() { return this.capacity - this.amount; },
        consume(v) { assert(v <= this.amount); this.amount -= v; }, add(v) { assert(v <= this.getFreeSpace()); this.amount += v; }, display() {} };
}
function environment() {
    let current, scriptEvent;
    const components = new Map(), ios = new Map();
    class Fluid {
        constructor(entity) { return entity.fluid; }
        static getContainerData(id) { return id === "minecraft:water_bucket" ? { type: "water", output: "minecraft:bucket" } : undefined; }
        static formatFluid(v) { return String(v); }
    }
    class Gas {
        constructor(entity) { return entity.gas; }
        static itemGasHolders = { "utilitycraft:empty_capsule": { required: 1000, types: { steam: "utilitycraft:steam_capsule" } } };
        static formatGas(v) { return String(v); }
    }
    const context = vm.createContext({
        ItemStack: Stack, FluidStorage: Fluid, GasStorage: Gas,
        Machine: class { constructor() { return current; } },
        registerATMachine: (id, component) => components.set(id, component), registerIOInterface: (id, io) => ios.set(id, io),
        system: { afterEvents: { scriptEventReceive: { subscribe(fn) { scriptEvent = fn; } } } },
        DoriosLib: { text: { formatIdentifier: s => s } }, resourceCost: (_, total) => total,
        setDynamicNumber: (e, k, v) => e.setDynamicProperty(k, v), setDynamicString: (e, k, v) => e.setDynamicProperty(k, v),
        displayProgress() {}, setUiItem() {}, renderStatus(m, active, status) { m.status = status; },
    });
    const runtime = read("BP/scripts/features/machines/runtime.js");
    // Use the existing migration implementation, not a test reimplementation.
    const migration = runtime.slice(runtime.indexOf("export function ensureMachineInventoryLayout"), runtime.indexOf("function resolveEnergyCost"))
        + runtime.slice(runtime.indexOf("function isInventoryPermutation"), runtime.indexOf("export function halveStack"));
    for (const source of [read("BP/scripts/config/steamProcessing.js"), read("BP/scripts/config/recipes/vaporworksProcessor.js"),
        read("BP/scripts/ATCore/processing/processEngine.js"), migration, read("BP/scripts/features/machines/vaporworksProcessor.js")]) vm.runInContext(strip(source), context);
    function setup(name, type = "water", amount = 1000) {
        const id = `utilitycraft:${name}`, b = json(`BP/blocks/machinery/machines/${name}.json`)["minecraft:block"];
        const settings = b.components[id];
        const data = new Map([[`ascendant:${name}_layout`, "contiguous_upgrades_v1"]]), items = new Map();
        const entity = { fluid: storage(type, settings.machine.fluid_cap, amount), gas: storage("steam", settings.machine.gas_cap),
            getDynamicProperty: k => data.get(k), setDynamicProperty: (k, v) => data.set(k, v) };
        entity.fluid.fluidItem = () => { if (entity.fluid.getFreeSpace() < 1000) return false; entity.fluid.add(1000); return "minecraft:bucket"; };
        entity.gas.gasItem = () => { if (entity.gas.get() < 1000) return false; entity.gas.consume(1000); return "utilitycraft:steam_capsule"; };
        current = { valid: true, shouldUpdateUI: false, entity, container: { size: 31, getItem: slot => items.get(slot)?.clone(),
            setItem: (slot, item) => item ? items.set(slot, item.clone()) : items.delete(slot) },
            energy: storage("energy", settings.machine.energy_cap, settings.machine.energy_cap), rate: settings.machine.rate_speed_base * 4,
            boosts: { consumption: 1, process_batch: 1 }, processIO() {}, getProgress: () => data.get("dorios:progress_0") ?? 0,
        };
        return { m: current, items, data, settings, tick: () => components.get(id).onTick({}, { params: settings }) };
    }
    return { setup, components, ios, event: payload => scriptEvent(payload) };
}

test("boiler and vaporizer complete water cycles at 8s/2400 DE and 4s/1600 DE with the real engine", () => {
    const env = environment();
    for (const [name, ticks, cost] of [["steam_boiler", 40, 2400], ["vaporizer", 20, 1600], ["vaporworks_processor", 20, 1600]]) {
        const s = env.setup(name), energy = s.m.energy.get();
        for (let i = 1; i < ticks; i++) s.tick();
        assert.equal(s.m.entity.gas.get(), 0); s.tick();
        assert.equal(s.m.entity.fluid.get(), 0); assert.equal(s.m.entity.gas.get(), 1000);
        assert.equal(energy - s.m.energy.get(), cost);
    }
});

test("cold fluids belong to advanced/legacy machines; shortages, gas conflicts and full tanks never consume input", () => {
    const env = environment();
    const invalid = env.setup("steam_boiler", "cryofluid"); invalid.tick();
    assert.equal(invalid.m.status, "Invalid Liquid"); assert.equal(invalid.m.entity.fluid.get(), 1000);
    for (const name of ["vaporizer", "vaporworks_processor"]) {
        const s = env.setup(name, "cryofluid");
        for (let i = 0; i < 30; i++) s.tick();
        assert.equal(s.m.entity.gas.get(), 1500); assert.equal(s.m.entity.fluid.get(), 0);
    }
    for (const reason of ["energy", "full", "conflict", "shortage"]) {
        const s = env.setup("vaporizer");
        if (reason === "energy") s.m.energy.amount = 0;
        if (reason === "full") s.m.entity.gas.amount = s.m.entity.gas.capacity;
        if (reason === "conflict") { s.m.entity.gas.type = "oxygen"; s.m.entity.gas.amount = 1000; }
        if (reason === "shortage") s.m.entity.fluid.amount = 999;
        const before = [s.m.energy.get(), s.m.entity.fluid.get(), s.m.entity.gas.get()]; s.tick();
        assert.deepEqual([s.m.energy.get(), s.m.entity.fluid.get(), s.m.entity.gas.get()], before, reason);
    }
});

test("filled return slots block container consumption; gas filling requires a full capsule volume", () => {
    const env = environment(), s = env.setup("steam_boiler", "water", 0);
    s.items.set(3, new Stack("minecraft:water_bucket")); s.items.set(9, new Stack("minecraft:bucket", 16));
    s.tick(); assert.equal(s.items.get(3).amount, 1); assert.equal(s.m.entity.fluid.get(), 0);
    s.items.delete(9); s.tick(); assert.equal(s.items.has(3), false); assert.equal(s.items.get(9).typeId, "minecraft:bucket");
    s.items.set(4, new Stack("utilitycraft:empty_capsule", 2)); s.m.entity.gas.amount = 999;
    s.tick(); assert.equal(s.items.get(4).amount, 2);
    s.m.entity.gas.amount = 1000; s.tick(); assert.equal(s.items.get(4).amount, 1);
    assert.equal(s.items.get(10).typeId, "utilitycraft:steam_capsule"); assert.equal(s.m.entity.gas.get(), 0);
});

test("new and legacy registration events feed advanced machines without opening boiler recipes", () => {
    const env = environment();
    for (const event of ["register_vaporizer_recipe", "register_vaporworks_processor_recipe"]) {
        env.event({ id: `utilitycraft:${event}`, message: JSON.stringify({ custom: { inputFluid: { type: "lava", amount: 1000 }, outputGas: { type: "steam", amount: 2000 }, cost: 1600, ticks: 4 } }) });
        const basic = env.setup("steam_boiler", "lava"); basic.tick(); assert.equal(basic.m.status, "Invalid Liquid");
        const advanced = env.setup("vaporizer", "lava"); advanced.tick(); assert.equal(advanced.m.entity.gas.get(), 2000);
    }
});

test("a drained gas tank can change recipe type, but stored gas is never overwritten", () => {
    const env = environment();
    env.event({ id: "utilitycraft:register_vaporizer_recipe", message: JSON.stringify({ oxygen: {
        inputFluid: { type: "water", amount: 1000 }, outputGas: { type: "oxygen", amount: 1000 }, cost: 1600, ticks: 4,
    } }) });
    const s = env.setup("vaporizer");
    s.m.entity.gas.amount = 500; s.tick(); assert.equal(s.m.status, "Gas Output Conflict");
    assert.equal(s.m.entity.gas.get(), 500); assert.equal(s.m.entity.fluid.get(), 1000);
    s.m.entity.gas.amount = 0; s.tick();
    assert.equal(s.m.entity.gas.type, "oxygen"); assert.equal(s.m.entity.gas.get(), 1000);
    assert.equal(s.m.entity.fluid.get(), 0);
});

test("legacy same-size inventory migration preserves every stack and stored resources exactly once", () => {
    const env = environment(), s = env.setup("vaporworks_processor");
    s.data.delete("ascendant:vaporworks_processor_layout");
    for (let slot = 0; slot < 31; slot++) s.items.set(slot, new Stack(`test:slot_${slot}`));
    const before = Array.from(s.items.values()).map(plain).sort((a, b) => a.typeId.localeCompare(b.typeId));
    s.tick();
    assert.deepEqual(Array.from(s.items.values()).map(plain).sort((a, b) => a.typeId.localeCompare(b.typeId)), before);
    assert.equal(s.items.get(8).typeId, "test:slot_30"); assert.equal(s.items.get(30).typeId, "test:slot_29");
    assert.equal(s.m.entity.fluid.get(), 1000); assert.equal(s.m.energy.get(), 512000);
    assert.equal(s.data.get("ascendant:vaporworks_processor_layout"), "contiguous_upgrades_v1");
    s.tick(); assert.equal(s.items.get(8).typeId, "test:slot_30");
});

test("crafting/Assembler patterns agree and paused dependent features remain unavailable", () => {
    const context = vm.createContext({ DoriosLib: { registry: { registerCrafterRecipe() {} } } });
    const source = strip(read("BP/scripts/config/recipes/crafter.js"));
    vm.runInContext(source + "\nglobalThis.recipes=crafterRecipeAdditions", context);
    for (const name of ["steam_boiler", "vaporizer", "alchemical_station"]) {
        const r = json(`BP/recipes/blocks/machinery/machines/${name}.json`)["minecraft:recipe_shaped"];
        const signature = r.pattern.join("").split("").map(k => (r.key[k]?.item ?? "minecraft:air").split(":")[1]).join(",");
        assert.equal(context.recipes[signature]?.output, r.result.item);
    }
    assert(!Object.values(context.recipes).some(r => r.output === "utilitycraft:vaporworks_processor"));
    assert(!existsSync(new URL("../BP/recipes/blocks/machinery/machines/vaporworks_processor.json", import.meta.url)));
    const catalog = read("BP/item_catalog/crafting_item_catalog.json"); JSON.parse(catalog);
    for (const name of ["mob_chamber_controller", "mob_chamber_core", "essence_module", "universal_cable", "universal_importer", "universal_exporter", "vaporworks_processor"]) assert(!catalog.includes(`"utilitycraft:${name}"`));
});

test("BP, upgrade profiles, runtime I/O and generated UI agree on capacities and slot boundaries", () => {
    const env = environment();
    const profiles = vm.createContext({});
    vm.runInContext(strip(read("BP/scripts/ATCore/machinery/upgradeProfiles.js")) + "\nglobalThis.profiles=UPGRADE_PROFILES", profiles);
    const terrain = json("RP/textures/terrain_texture.json").texture_data;
    for (const name of ["steam_boiler", "vaporizer"]) {
        const id = `utilitycraft:${name}`, b = json(`BP/blocks/machinery/machines/${name}.json`)["minecraft:block"];
        const m = b.components[id].machine, p = profiles.profiles[id], io = env.ios.get(id);
        const expectedGroup = name === "vaporizer" ? "at:itemGroup.name.superior_machines" : "at:itemGroup.name.machines";
        assert.equal(b.description.menu_category.group, expectedGroup);
        const groups = json("BP/item_catalog/crafting_item_catalog.json")["minecraft:crafting_items_catalog"].categories.flatMap(c => c.groups);
        const membership = groups.filter(g => g.items?.includes(id));
        assert.equal(membership.length, 1);
        assert.equal(membership[0].group_identifier.name, expectedGroup);
        assert(json("RP/blocks.json")[id], "Missing RP block registration");
        assert.equal(m.energy_cap, p.energy_cap); assert.equal(m.fluid_cap, p.fluid_cap); assert.equal(m.gas_cap, p.gas_cap);
        assert.deepEqual(m.upgrades, plain(p.slots));
        const top = json(`RP/ui/${name}.json`)[`${name}_top`].controls;
        const tabs = top.find(c => c["io_tab@at_common.machine_io_tab"])["io_tab@at_common.machine_io_tab"];
        for (const [resource, prefix] of [["items", "item"], ["liquids", "fluid"], ["gases", "gas"]]) {
            const uiSlots = ["top", "left", "front", "right", "bottom", "back"].map(face => tabs[`$io_${prefix}_${face}_index`]);
            assert.deepEqual(uiSlots, plain(io[resource].buttonSlots));
            for (const mode of io[resource].modes) for (const slot of [...(mode.inputSlots ?? []), ...(mode.outputSlots ?? [])]) assert(slot < 13);
        }
        for (const face of ["top", "left", "front", "right", "bottom", "back"]) assert(existsSync(new URL(`../RP/${tabs[`$io_${face}_texture`]}.png`, import.meta.url)));
        for (const materials of [b.components["minecraft:material_instances"], ...b.permutations.map(p => p.components["minecraft:material_instances"]).filter(Boolean)]) {
            assert.equal(new Set(Object.values(materials).map(m => m.render_method)).size, 1);
            for (const material of Object.values(materials)) {
                assert(material.texture.startsWith(`utilitycraft_${name}_`), "Steam machines must use their dedicated artwork");
                assert(terrain[material.texture]);
                assert(existsSync(new URL(`../RP/${terrain[material.texture].textures}.png`, import.meta.url)));
            }
        }
    }
    assert(existsSync(new URL("../RP/textures/ui/steam_recipe_arrow.png", import.meta.url)));
    const books = read("RP/ui/recipes/steam_machines.json");
    assert(!books.includes("textures/ui/progress_bar/arrow_right_22"));
    assert(books.includes("textures/ui/steam_recipe_arrow"));
});

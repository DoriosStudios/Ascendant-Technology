import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import {
    UPGRADE_DEFINITIONS,
    resolveATBoosts,
    resourceCost,
    supportsUpgrade,
    findUpgradeSlot,
} from "../BP/scripts/ATCore/machinery/upgradeEffects.js";
import { UPGRADE_PROFILES } from "../BP/scripts/ATCore/machinery/upgradeProfiles.js";
import { advanceLanes, advanceSlotCycle } from "../BP/scripts/ATCore/processing/processEngine.js";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
let checks = 0;
function check(label, run) {
    run();
    checks++;
    console.log(`PASS ${label}`);
}

class Item {
    constructor(typeId, amount = 1) {
        this.typeId = typeId;
        this.amount = amount;
        this.maxAmount = 64;
    }
    clone() {
        return Object.assign(new Item(this.typeId, this.amount), this);
    }
}
function container(size = 40) {
    const items = new Map();
    return {
        size,
        getItem: (slot) => items.get(slot)?.clone(),
        setItem(slot, item) {
            assert.ok(Number.isInteger(slot) && slot >= 0 && slot < size);
            if (item) items.set(slot, item.clone());
            else items.delete(slot);
        },
    };
}
function storage(amount, capacity = 100000) {
    return {
        amount,
        capacity,
        writes: 0,
        capWrites: 0,
        get() {
            return this.amount;
        },
        getCap() {
            return this.capacity;
        },
        setCap(value) {
            this.capacity = value;
            this.capWrites++;
            this.amount = Math.min(value, this.amount);
        },
        consume(value) {
            if (value > this.amount) return 0;
            this.amount -= value;
            this.writes++;
            return value;
        },
        add(value) {
            this.amount += value;
            return value;
        },
        getType() {
            return "water";
        },
        getFreeSpace() {
            return Math.max(0, this.capacity - this.amount);
        },
        display() {},
    };
}
function entity() {
    const properties = new Map();
    return {
        id: `test-${Math.random()}`,
        isValid: true,
        getDynamicProperty: (key) => properties.get(key),
        setDynamicProperty: (key, value) => properties.set(key, value),
    };
}
async function load(path, mocks = {}) {
    const result = await build({
        entryPoints: [resolve(root, path)],
        bundle: true,
        write: false,
        format: "cjs",
        platform: "node",
        plugins: [
            {
                name: "test-mocks",
                setup(b) {
                    b.onResolve({ filter: /.*/ }, (args) =>
                        Object.hasOwn(mocks, args.path)
                            ? { path: args.path, external: true }
                            : undefined,
                    );
                },
            },
        ],
    });
    const module = { exports: {} };
    new Function("require", "module", "exports", result.outputFiles[0].text)(
        (id) => mocks[id] ?? require(id),
        module,
        module.exports,
    );
    return module.exports;
}

check("Profiles match live block slots, capacities and supported resources", () => {
    for (const [id, profile] of Object.entries(UPGRADE_PROFILES)) {
        const file = `BP/blocks/machinery/machines/${id.split(":")[1]}.json`;
        const components = json(file)["minecraft:block"].components;
        const settings = Object.values(components).find((value) => value?.machine)?.machine;
        assert.deepEqual(profile.slots, settings.upgrades);
        for (const key of ["energy_cap", "fluid_cap", "gas_cap"])
            assert.equal(profile[key], settings[key]);
        for (const type of ["liquid_capacity", "gas_capacity"]) {
            assert.equal(
                supportsUpgrade(profile, type),
                Boolean(profile[type === "gas_capacity" ? "gas_cap" : "fluid_cap"]),
            );
        }
    }
    assert.equal(supportsUpgrade(undefined, "energy_capacity"), false);
    assert.deepEqual(
        Object.entries(UPGRADE_PROFILES)
            .filter(([, profile]) => profile.parallel_slots > 1)
            .map(([id, profile]) => [id, profile.parallel_slots]),
        [
            ["utilitycraft:arc_press_forge", 4],
            ["utilitycraft:centrifugal_siever", 4],
            ["utilitycraft:industrial_crucible", 6],
            ["utilitycraft:pulverizer", 4],
        ],
    );
});
check("All eight linear levels; duplicates and unsupported slots cannot add perks", () => {
    const profiles = {
        multi_processing: UPGRADE_PROFILES["utilitycraft:pulverizer"],
        energy_capacity: UPGRADE_PROFILES["utilitycraft:pulverizer"],
        liquid_capacity: UPGRADE_PROFILES["utilitycraft:industrial_crucible"],
        gas_capacity: UPGRADE_PROFILES["utilitycraft:pulverizer"],
        resource_efficiency: UPGRADE_PROFILES["utilitycraft:pulverizer"],
    };
    for (const [id, definition] of Object.entries(UPGRADE_DEFINITIONS)) {
        const profile = profiles[definition.type];
        for (let level = 1; level <= 8; level++) {
            const inv = container();
            inv.setItem(profile.slots[0], new Item(id, level));
            inv.setItem(profile.slots[1], new Item(id, 8));
            const expected =
                definition.type === "multi_processing"
                    ? level + 1
                    : definition.type === "resource_efficiency"
                      ? level * 0.05
                      : 1 + level * 0.5;
            assert.equal(resolveATBoosts(inv, profile)[definition.perk], expected);
        }
    }
    const profile = UPGRADE_PROFILES["utilitycraft:pulverizer"];
    const inv = container();
    inv.setItem(0, new Item("utilitycraft:multi_processing_upgrade", 8));
    assert.equal(resolveATBoosts(inv, profile).parallel_operations, 1);
});
check(
    "Independent preservation per craft, full requirements, zero cost and probability boundaries",
    () => {
        const m = { boosts: { resource_preservation_chance: 0.4 } };
        let draws = 0;
        assert.equal(
            resourceCost(m, 1000, 250, () => [0, 0.9, 0.1, 0.8][draws++]),
            500,
        );
        assert.equal(draws, 4);
        m.boosts.resource_preservation_chance = 0;
        assert.equal(
            resourceCost(m, 64, 1, () => {
                throw Error("No RNG needed");
            }),
            64,
        );
        m.boosts.resource_preservation_chance = 1;
        assert.equal(resourceCost(m, 64, 1), 0);
        assert.equal(resourceCost(m, 0, 0), 0);
    },
);
check(
    "Multi Processing uses one shared cycle and scales selected slots without changing its duration",
    () => {
        for (const count of [1, 2, 4]) {
            const m = { energy: storage(10000), rate: 100, boosts: { consumption: 1 } };
            const result = advanceSlotCycle(m, {
                progress: 0,
                operations: Array.from({ length: count }, () => ({ cost: 100 })),
            });
            assert.equal(result.completed, true);
            assert.equal(result.activeOperations, count);
            assert.equal(result.progress, 0);
            assert.equal(m.energy.get(), 10000 - 100 * count);
            assert.equal(m.energy.writes, 1);
        }
        const m = { energy: storage(100), rate: 100, boosts: { consumption: 1 } };
        const result = advanceSlotCycle(m, {
            progress: 0,
            operations: Array.from({ length: 4 }, () => ({ cost: 100 })),
        });
        assert.equal(result.progress, 25);
        assert.equal(result.completed, false);
        const mixed = { energy: storage(1000), rate: 100, boosts: { consumption: 1 } };
        const first = advanceSlotCycle(mixed, {
            progress: 0,
            operations: [{ cost: 100 }, { cost: 200 }],
        });
        assert.equal(first.cost, 200);
        assert.equal(first.totalCost, 300);
        assert.equal(first.progress, 100);
        assert.equal(first.completed, false);
        const second = advanceSlotCycle(mixed, {
            progress: first.progress,
            operations: [{ cost: 100 }, { cost: 200 }],
        });
        assert.equal(second.completed, true);
        assert.equal(mixed.energy.get(), 700);
    },
);
check("Native lane machines retain their original shared energy budget", () => {
    const m = { energy: storage(100), rate: 100, boosts: { consumption: 1 } };
    const lanes = Array.from({ length: 4 }, () => ({ cost: 100, maxCrafts: 1 }));
    advanceLanes(m, lanes);
    assert.deepEqual(
        lanes.map((lane) => lane.progress),
        [25, 25, 25, 25],
    );
    assert.equal(m.energy.get(), 0);
    assert.ok(lanes.every((lane) => lane.active));
});
check("Slot-grid machines use one shared progress property", () => {
    for (const file of [
        "arcPressForge.js",
        "centrifugalSiever.js",
        "industrialCrucible.js",
        "pulverizer.js",
    ]) {
        const source = readFileSync(resolve(root, "BP/scripts/features/machines", file), "utf8");
        assert.ok(source.includes("advanceSlotCycle("), file);
        assert.ok(source.includes("parallelLimit("), file);
        assert.ok(source.includes('"dorios:progress_0"'), file);
        assert.doesNotMatch(source, /dorios:progress_[1-9]/u, file);
    }
});

let registered;
let active;
const core = {
    Machine: class {
        constructor() {
            Object.assign(this, active, { boosts: { consumption: 1 } });
        }
        static spawnEntity(event, config) {
            registered = config;
        }
    },
    FluidStorage: class {
        constructor(ent, index) {
            return ent.fluids[index];
        }
    },
    GasStorage: class {
        constructor(ent, index) {
            return ent.gases[index];
        }
    },
};
const lib = {
    registry: {
        blockComponent: (id, component) => {
            registered = component;
        },
    },
};
const { Machine: ATMachine, registerATMachine } = await load(
    "BP/scripts/ATCore/machinery/atMachine.js",
    {
        "DoriosCore/index.js": core,
        "DoriosLib/index.js": lib,
        "@minecraft/server": { world: { afterEvents: { entityRemove: { subscribe() {} } } } },
        "../../DoriosCore/machinery/resourceLore.js": {
            getResourcesFromItem: (item) => item.snapshot,
        },
    },
);
check("AT capacities shrink without loss, close refill space, cache unchanged capacities", () => {
    const profile = UPGRADE_PROFILES["utilitycraft:impact_crusher"];
    const ent = entity();
    ent.fluids = [storage(0, profile.fluid_cap)];
    ent.gases = [storage(0, profile.gas_cap)];
    active = {
        valid: true,
        entity: ent,
        container: container(),
        energy: storage(0, profile.energy_cap),
    };
    active.container.setItem(profile.slots[0], new Item("utilitycraft:liquid_capacity_upgrade", 8));
    active.container.setItem(profile.slots[1], new Item("utilitycraft:gas_capacity_upgrade", 8));
    active.container.setItem(profile.slots[2], new Item("utilitycraft:energy_capacity_upgrade", 8));
    const block = { typeId: "utilitycraft:impact_crusher" };
    let m = new ATMachine(block, {});
    assert.equal(ent.fluids[0].getCap(), profile.fluid_cap * 5);
    assert.equal(ent.gases[0].getCap(), profile.gas_cap * 5);
    assert.equal(active.energy.getCap(), profile.energy_cap * 5);
    m.syncUpgradeCapacity();
    assert.equal(ent.fluids[0].capWrites, 1);
    ent.fluids[0].amount = profile.fluid_cap * 4;
    for (const slot of profile.slots) active.container.setItem(slot, undefined);
    m = new ATMachine(block, {});
    assert.equal(ent.fluids[0].getCap(), profile.fluid_cap * 4);
    assert.equal(ent.fluids[0].getFreeSpace(), 0);
    ent.fluids[0].consume(profile.fluid_cap * 3);
    m.syncUpgradeCapacity();
    assert.equal(ent.fluids[0].getCap(), profile.fluid_cap);
    assert.equal(ent.fluids[0].get(), profile.fluid_cap);
    // Existing stored excess must survive shared placement's initial clamp.
    const snapshot = { energy: 300, fluids: [{ amount: 500 }], gases: [{ amount: 700 }] };
    ATMachine.spawnEntity(
        { player: { getComponent: () => ({ getEquipment: () => ({ snapshot }) }) } },
        { machine: { energy_cap: 100, fluid_cap: 100, gas_cap: 100 } },
    );
    assert.deepEqual(registered.machine, { energy_cap: 300, fluid_cap: 500, gas_cap: 700 });
});
check("Capacity finalization runs on early returns and exceptions", () => {
    let finalizations = 0;
    registerATMachine("test", {
        onTick() {
            const m = new ATMachine({ typeId: "utilitycraft:impact_crusher" }, {});
            m.syncUpgradeCapacity = () => finalizations++;
            throw new Error("test abort");
        },
    });
    assert.throws(() => registered.onTick({}, {}), /test abort/);
    assert.equal(finalizations, 1);
});

let installer;
let held;
const inv = container();
const player = {
    typeId: "minecraft:player",
    isSneaking: false,
    onScreenDisplay: { setActionBar() {} },
    getComponent: () => ({
        getEquipment: () => held?.clone(),
        setEquipment(slot, item) {
            held = item?.clone();
            return true;
        },
    }),
};
await load("BP/scripts/ATCore/machinery/upgradeInstaller.js", {
    "DoriosLib/index.js": {
        registry: {
            itemComponent: (id, c) => {
                assert.equal(id, "ascendant:machine_upgrade");
                installer = c;
            },
        },
        player: { isCreative: () => false },
        container: { resolveAt: () => ({ container: inv }) },
    },
});
check(
    "Private installer selects empty slots, adds to existing stack and rejects UtilityCraft machines",
    () => {
        const profile = UPGRADE_PROFILES["utilitycraft:impact_crusher"];
        inv.setItem(profile.slots[0], new Item("utilitycraft:speed_upgrade", 8));
        held = new Item("utilitycraft:energy_capacity_upgrade", 8);
        installer.onUseOn({
            source: player,
            block: { typeId: "utilitycraft:impact_crusher" },
            itemStack: held,
        });
        assert.equal(inv.getItem(profile.slots[1]).amount, 1);
        assert.equal(held.amount, 7);
        player.isSneaking = true;
        installer.onUseOn({
            source: player,
            block: { typeId: "utilitycraft:impact_crusher" },
            itemStack: held,
        });
        assert.equal(inv.getItem(profile.slots[1]).amount, 8);
        assert.equal(held, undefined);
        assert.equal(inv.getItem(profile.slots[0]).typeId, "utilitycraft:speed_upgrade");
        held = new Item("utilitycraft:energy_capacity_upgrade", 2);
        installer.onUseOn({
            source: player,
            block: { typeId: "utilitycraft:crusher" },
            itemStack: held,
        });
        assert.equal(held.amount, 2);
        assert.equal(findUpgradeSlot(inv, profile, held.typeId), profile.slots[1]);
    },
);
const itemPools = await load("BP/scripts/ATCore/processing/itemPools.js", {
    "@minecraft/server": { ItemStack: Item },
});
check(
    "Shared output reservations prevent different slot operations from claiming the same space",
    () => {
        const outputs = container(2);
        const reservation = itemPools.createPooledOutputReservation(outputs, [0, 1]);
        assert.equal(reservation.reserve("test:a", 64), true);
        assert.equal(reservation.reserve("test:b", 64), true);
        assert.equal(reservation.reserve("test:c", 1), false);
    },
);
let pulverizerTick;
let pulverizer;
let pulverizerSteam;
const pulverizerRecipes = Object.fromEntries(
    [0, 1, 2, 3].map((index) => [
        `test:input_${index}`,
        { required: 1, amount: 1, output: `test:output_${index}`, outputMaxAmount: 64, cost: 100 },
    ]),
);
await load("BP/scripts/features/machines/pulverizer.js", {
    "DoriosCore/index.js": {
        registerIOInterface() {},
        GasStorage: class {
            constructor() {
                return pulverizerSteam;
            }
            static formatGas(value) {
                return String(value);
            }
        },
    },
    "../../ATCore/machinery/atMachine.js": {
        Machine: class {
            constructor() {
                return pulverizer;
            }
        },
        registerATMachine(id, component) {
            pulverizerTick = component.onTick;
        },
    },
    "../../ATCore/processing/index.js": {
        advanceSlotCycle,
        createPooledOutputReservation: itemPools.createPooledOutputReservation,
        insertPooledOutput: itemPools.insertPooledOutput,
        crusherRecipes: pulverizerRecipes,
    },
    "./runtime.js": {
        displayProgress() {},
        renderStatus() {},
        setUiItem() {},
        setDynamicNumber: (target, key, value) => target.setDynamicProperty(key, value),
        setDynamicString: (target, key, value) => target.setDynamicProperty(key, value),
    },
});
check("Actual Pulverizer shares one cycle across the slots selected by Multi Processing", () => {
    function setup(parallelOperations, stackBatch = 1) {
        pulverizerSteam = storage(0, 1000);
        pulverizerSteam.type = "steam";
        pulverizerSteam.getType = function () {
            return this.type;
        };
        pulverizerSteam.setType = function (type) {
            this.type = type;
        };
        pulverizer = {
            valid: true,
            container: container(28),
            entity: entity(),
            energy: storage(1000),
            rate: 100,
            boosts: {
                consumption: 1,
                process_batch: stackBatch,
                parallel_operations: parallelOperations,
                resource_preservation_chance: 0,
            },
            processingInterval: 4,
            processIO() {},
            getProgress() {
                return Number(this.entity.getDynamicProperty("dorios:progress_0")) || 0;
            },
            shouldUpdateUI: false,
        };
        for (let index = 0; index < 4; index++) {
            pulverizer.container.setItem(3 + index, new Item(`test:input_${index}`, stackBatch));
        }
    }
    setup(1);
    pulverizerTick({}, { params: { machine: { energy_cost: 100 } } });
    assert.equal(pulverizer.container.getItem(3), undefined);
    for (const slot of [4, 5, 6]) assert.ok(pulverizer.container.getItem(slot));
    assert.equal(pulverizer.energy.get(), 900);

    setup(4, 2);
    pulverizerTick({}, { params: { machine: { energy_cost: 100 } } });
    for (const slot of [3, 4, 5, 6]) assert.equal(pulverizer.container.getItem(slot), undefined);
    for (const slot of [7, 8, 9, 10]) assert.equal(pulverizer.container.getItem(slot).amount, 2);
    assert.equal(pulverizer.energy.get(), 600);
    assert.equal(pulverizer.entity.getDynamicProperty("dorios:progress_0"), 0);
});

let arcPressTick;
let arcPress;
let arcPressSteam;
const pressRecipes = Object.fromEntries(
    [0, 1, 2, 3].map((index) => [
        `test:press_input_${index}`,
        {
            required: 1,
            amount: 1,
            output: `test:press_output_${index}`,
            outputMaxAmount: 64,
            cost: 100,
        },
    ]),
);
await load("BP/scripts/features/machines/arcPressForge.js", {
    "DoriosCore/index.js": {
        registerIOInterface() {},
        ButtonManager: {
            registerMachineButton() {},
            ensureWatching() {},
            unwatchEntity() {},
        },
        GasStorage: class {
            constructor() {
                return arcPressSteam;
            }
            static formatGas(value) {
                return String(value);
            }
        },
    },
    "../../ATCore/machinery/atMachine.js": {
        Machine: class {
            constructor() {
                return arcPress;
            }
        },
        registerATMachine(id, component) {
            arcPressTick = component.onTick;
        },
    },
    "../../ATCore/processing/index.js": {
        advanceSlotCycle,
        createPooledOutputReservation: itemPools.createPooledOutputReservation,
        insertPooledOutput: itemPools.insertPooledOutput,
        pressRecipes,
    },
    "./runtime.js": {
        displayProgress() {},
        renderStatus() {},
        setUiItem() {},
        setDynamicNumber: (target, key, value) => target.setDynamicProperty(key, value),
        setDynamicString: (target, key, value) => target.setDynamicProperty(key, value),
    },
});
check("Actual Arc-Press Forge processes every slot selected by Multi Processing", () => {
    arcPressSteam = storage(0, 1000);
    arcPressSteam.getType = () => "steam";
    arcPressSteam.setType = () => {};
    arcPress = {
        valid: true,
        container: container(29),
        entity: entity(),
        energy: storage(1000),
        rate: 100,
        boosts: {
            consumption: 1,
            process_batch: 1,
            parallel_operations: 4,
            resource_preservation_chance: 0,
        },
        processingInterval: 4,
        processIO() {},
        ensureInventoryLayout: () => true,
        getProgress() {
            return Number(this.entity.getDynamicProperty("dorios:progress_0")) || 0;
        },
        shouldUpdateUI: false,
    };
    for (let index = 0; index < 4; index++) {
        arcPress.container.setItem(3 + index, new Item(`test:press_input_${index}`));
    }
    arcPressTick({}, { params: { machine: { energy_cost: 100 } } });
    for (const slot of [3, 4, 5, 6]) assert.equal(arcPress.container.getItem(slot), undefined);
    for (const slot of [7, 8, 9, 10]) assert.equal(arcPress.container.getItem(slot).amount, 1);
    assert.equal(arcPress.energy.get(), 600);
    assert.equal(arcPress.entity.getDynamicProperty("dorios:progress_0"), 0);
});

let crucibleTick;
let crucible;
let crucibleLava;
await load("BP/scripts/features/machines/industrialCrucible.js", {
    "DoriosCore/index.js": {
        registerIOInterface() {},
        FluidStorage: class {
            constructor() {
                return crucibleLava;
            }
            static formatFluid(value) {
                return String(value);
            }
        },
    },
    "../../ATCore/machinery/atMachine.js": {
        Machine: class {
            constructor() {
                return crucible;
            }
        },
        registerATMachine(id, component) {
            crucibleTick = component.onTick;
        },
    },
    "../../ATCore/processing/index.js": {
        advanceSlotCycle,
        createPooledOutputReservation: itemPools.createPooledOutputReservation,
        insertPooledOutput: itemPools.insertPooledOutput,
    },
    "../../config/recipes/industrialCrucible.js": {
        getIndustrialCrucibleRecipe(typeId) {
            const index = Number(typeId.at(-1));
            if (!Number.isInteger(index)) return undefined;
            return {
                input: { amount: 1 },
                output: { id: `test:crucible_output_${index}`, amount: 1 },
                lavaGain: 10,
                energyCost: 100,
            };
        },
    },
    "./runtime.js": {
        displayProgress() {},
        renderStatus() {},
        setUiItem() {},
        ensureMachineInventoryLayout: () => true,
        setDynamicNumber: (target, key, value) => target.setDynamicProperty(key, value),
        setDynamicString: (target, key, value) => target.setDynamicProperty(key, value),
    },
});
check("Actual Industrial Crucible processes every slot selected by Multi Processing", () => {
    crucibleLava = storage(0, 1000);
    crucibleLava.getType = () => "lava";
    crucibleLava.setType = () => {};
    crucible = {
        valid: true,
        container: container(32),
        entity: entity(),
        energy: storage(1000),
        rate: 100,
        boosts: {
            consumption: 1,
            process_batch: 1,
            parallel_operations: 6,
            resource_preservation_chance: 0,
        },
        processIO() {},
        getProgress() {
            return Number(this.entity.getDynamicProperty("dorios:progress_0")) || 0;
        },
        shouldUpdateUI: false,
    };
    for (let index = 0; index < 6; index++) {
        crucible.container.setItem(3 + index, new Item(`test:crucible_input_${index}`));
    }
    crucibleTick({}, { params: { machine: { energy_cost: 100 } } });
    for (const slot of [3, 4, 5, 6, 7, 8])
        assert.equal(crucible.container.getItem(slot), undefined);
    for (const slot of [14, 15, 16, 17, 18, 19]) {
        assert.equal(crucible.container.getItem(slot).amount, 1);
    }
    assert.equal(crucibleLava.get(), 60);
    assert.equal(crucible.energy.get(), 400);
    assert.equal(crucible.entity.getDynamicProperty("dorios:progress_0"), 0);
});

let sieverTick;
let siever;
let sieverSteam;
const sieverRecipes = new Map(
    [0, 1, 2, 3].map((index) => [
        `test:sieve_input_${index}`,
        [{ item: `test:sieve_output_${index}`, amount: 1, chance: 1, tier: 1 }],
    ]),
);
await load("BP/scripts/features/machines/centrifugalSiever.js", {
    "DoriosCore/index.js": {
        registerIOInterface() {},
        GasStorage: class {
            constructor() {
                return sieverSteam;
            }
            static formatGas(value) {
                return String(value);
            }
        },
    },
    "../../ATCore/machinery/atMachine.js": {
        Machine: class {
            constructor() {
                return siever;
            }
        },
        registerATMachine(id, component) {
            sieverTick = component.onTick;
        },
    },
    "../../ATCore/processing/index.js": {
        advanceSlotCycle,
        getEligibleSieveDrops: (recipe) => recipe,
        hasSieveOutputCapacity: () => true,
        insertSieveOutputs(target, slots, outputs) {
            let insertedTotal = 0;
            for (const [typeId, amount] of outputs) {
                insertedTotal += itemPools.insertPooledOutput(target, slots, typeId, amount);
            }
            return { insertedTotal, insertedTypes: outputs.size };
        },
        resolveMeshProfile(item) {
            return item
                ? { itemTypeId: item.typeId, tier: 1, multiplier: 1, amountMultiplier: 1 }
                : undefined;
        },
        rollSieveDrops(drops, craftCount) {
            return new Map([[drops[0].item, craftCount]]);
        },
        sieveRecipes: sieverRecipes,
    },
    "./runtime.js": {
        displayProgress() {},
        renderStatus() {},
        setUiItem() {},
        setDynamicNumber: (target, key, value) => target.setDynamicProperty(key, value),
        setDynamicString: (target, key, value) => target.setDynamicProperty(key, value),
    },
});
check("Actual Centrifugal Siever processes every slot selected by Multi Processing", () => {
    sieverSteam = storage(0, 1000);
    sieverSteam.getType = () => "steam";
    sieverSteam.setType = () => {};
    siever = {
        valid: true,
        container: container(40),
        entity: entity(),
        energy: storage(1000),
        rate: 100,
        boosts: {
            consumption: 1,
            process_batch: 1,
            parallel_operations: 4,
            resource_preservation_chance: 0,
        },
        processingInterval: 4,
        processIO() {},
        ensureInventoryLayout: () => true,
        getProgress() {
            return Number(this.entity.getDynamicProperty("dorios:progress_0")) || 0;
        },
        shouldUpdateUI: false,
    };
    siever.container.setItem(7, new Item("test:mesh"));
    for (let index = 0; index < 4; index++) {
        siever.container.setItem(3 + index, new Item(`test:sieve_input_${index}`));
    }
    sieverTick({}, { params: { machine: { energy_cost: 100 } } });
    for (const slot of [3, 4, 5, 6]) assert.equal(siever.container.getItem(slot), undefined);
    for (const slot of [13, 14, 15, 16]) assert.equal(siever.container.getItem(slot).amount, 1);
    assert.equal(siever.energy.get(), 600);
    assert.equal(siever.entity.getDynamicProperty("dorios:progress_0"), 0);
});

const { processCryoCoolingGrid } = await load("BP/scripts/ATCore/processing/cryoCoolingGrid.js", {
    "@minecraft/server": { ItemStack: Item },
});
check(
    "In-place freezing preserves originals and coolant without overwriting occupied slots",
    () => {
        const inv = container(4);
        inv.setItem(0, new Item("test:input", 4));
        const m = {
            container: inv,
            entity: entity(),
            rate: 1000,
            energy: storage(10000),
            boosts: { resource_preservation_chance: 1, parallel_operations: 1 },
            upgradeProfile: { parallel_slots: 4 },
        };
        const tank = storage(1000);
        const options = {
            slots: [0, 1, 2, 3],
            progressPrefix: "test:",
            getRecipe: (id) =>
                id === "test:input"
                    ? {
                          input: { amount: 1 },
                          output: { id: "test:output", amount: 1 },
                          cost: 100,
                          fluid: { type: "water", amount: 100 },
                      }
                    : undefined,
            isOutput: () => false,
        };
        processCryoCoolingGrid(m, tank, options);
        assert.equal(inv.getItem(0).typeId, "test:output");
        assert.equal(inv.getItem(1).typeId, "test:input");
        assert.equal(inv.getItem(1).amount, 4);
        assert.equal(tank.amount, 1000);
        for (const slot of [0, 1, 2, 3]) inv.setItem(slot, new Item("test:input", 4));
        const previousEnergy = m.energy.get();
        processCryoCoolingGrid(m, tank, options);
        assert.equal(m.energy.get(), previousEnergy);
        assert.equal(inv.getItem(0).typeId, "test:input");
    },
);
let weaverTick;
let weaver;
let weaverTank;
const weaverRecipe = {
    id: "test:weaver",
    input: { id: "test:base", amount: 2 },
    catalysts: [
        { id: "test:a", amount: 3 },
        { id: "test:b", amount: 4 },
    ],
    fluid: { type: "water", amount: 250 },
    output: { id: "test:result", amount: 1 },
    cost: 100,
};
await load("BP/scripts/features/machines/catalystWeaver.js", {
    "@minecraft/server": { ItemStack: Item },
    "DoriosLib/index.js": { text: { formatIdentifier: (value) => value } },
    "DoriosCore/index.js": {
        registerIOInterface() {},
        FluidStorage: class {
            constructor() {
                return weaverTank;
            }
            static formatFluid(v) {
                return String(v);
            }
        },
    },
    "../../ATCore/machinery/atMachine.js": {
        Machine: class {
            constructor() {
                return weaver;
            }
        },
        registerATMachine(id, c) {
            weaverTick = c.onTick;
        },
    },
    "../../ATCore/processing/index.js": await import(
        "../BP/scripts/ATCore/processing/processEngine.js"
    ),
    "../../config/recipes/catalystWeaver.js": { getCatalystWeaverRecipe: () => weaverRecipe },
    "./runtime.js": {
        displayProgress() {},
        renderStatus() {},
        setUiItem() {},
        ensureMachineInventoryLayout: () => true,
        setDynamicNumber: (e, k, v) => e.setDynamicProperty(k, v),
        setDynamicString: (e, k, v) => e.setDynamicProperty(k, v),
    },
});
check(
    "Actual Weaver tick saves base, each catalyst and fluid independently; blocked output uses nothing",
    () => {
        function setup(chance) {
            weaverTank = storage(500);
            weaver = {
                valid: true,
                container: container(29),
                entity: entity(),
                energy: storage(1000),
                rate: 200,
                boosts: { resource_preservation_chance: chance, process_batch: 1 },
                processIO() {},
                getProgress: () => 0,
            };
            weaver.container.setItem(3, new Item("test:base", 4));
            weaver.container.setItem(4, new Item("test:a", 6));
            weaver.container.setItem(5, new Item("test:b", 8));
        }
        setup(1);
        weaverTick({}, { params: { machine: { energy_cost: 100 } } });
        assert.equal(weaver.container.getItem(16).amount, 2);
        assert.equal(weaver.container.getItem(3).amount, 4);
        assert.equal(weaver.container.getItem(4).amount, 6);
        assert.equal(weaver.container.getItem(5).amount, 8);
        assert.equal(weaverTank.get(), 500);
        assert.equal(weaver.energy.get(), 800);
        setup(0);
        weaverTick({}, { params: { machine: { energy_cost: 100 } } });
        assert.equal(weaver.container.getItem(3), undefined);
        assert.equal(weaver.container.getItem(4), undefined);
        assert.equal(weaver.container.getItem(5), undefined);
        assert.equal(weaverTank.get(), 0);
        setup(1);
        weaver.container.setItem(16, new Item("test:blocked", 1));
        weaverTick({}, { params: { machine: { energy_cost: 100 } } });
        assert.equal(weaver.energy.get(), 1000);
        assert.equal(weaverTank.get(), 500);
        setup(0);
        const write = weaver.container.setItem.bind(weaver.container);
        let failOnce = true;
        weaver.container.setItem = (slot, item) => {
            if (slot === 16 && item && failOnce) {
                failOnce = false;
                throw new Error("simulated output failure");
            }
            write(slot, item);
        };
        weaverTick({}, { params: { machine: { energy_cost: 100 } } });
        assert.equal(weaver.container.getItem(3).amount, 4);
        assert.equal(weaver.container.getItem(4).amount, 6);
        assert.equal(weaver.container.getItem(16), undefined);
        assert.equal(weaverTank.get(), 500);
        assert.equal(weaver.entity.getDynamicProperty("dorios:progress_0"), 200);
    },
);
check("Saved planting seeds cannot be refunded a second time on failure", () => {
    const source = readFileSync(
        resolve(root, "BP/scripts/features/machines/verdantCultivator.js"),
        "utf8",
    );
    const start = source.indexOf("function consumeSeed(");
    const end = source.indexOf("function restoreSeed(", start);
    const consumeSeed = new Function(
        "resourceCost",
        `${source.slice(start, end)}; return consumeSeed;`,
    )(resourceCost);
    const m = { container: container(), boosts: { resource_preservation_chance: 1 } };
    m.container.setItem(3, new Item("test:seed", 1));
    assert.equal(consumeSeed(m, 3, "test:seed"), 0);
    assert.equal(m.container.getItem(3).amount, 1);
    m.boosts.resource_preservation_chance = 0;
    assert.equal(consumeSeed(m, 3, "test:seed"), 1);
    assert.equal(m.container.getItem(3), undefined);
    assert.equal(consumeSeed(m, 3, "test:seed"), -1);
    assert.ok(source.includes("else if (paidSeed > 0) restoreSeed("));
});
check(
    "New items have private components, valid icons, recipes, unique UI toggles and localization",
    () => {
        const atlas = json("RP/textures/item_texture.json").texture_data;
        const ui = json("RP/ui/recipes/catalyst_weaver.json");
        const indices = [];
        function walk(v) {
            if (!v || typeof v !== "object") return;
            if (v.$toggle_index !== undefined) indices.push(v.$toggle_index);
            Object.values(v).forEach(walk);
        }
        walk(ui);
        assert.equal(new Set(indices).size, indices.length);
        for (const id of Object.keys(UPGRADE_DEFINITIONS)) {
            const name = id.split(":")[1];
            const item = json(`BP/items/machinery/${name}.json`)["minecraft:item"];
            assert.equal(item.description.identifier, id);
            assert.equal(item.components["minecraft:max_stack_size"], 8);
            assert.ok(item.components["ascendant:machine_upgrade"]);
            assert.equal(item.components["utilitycraft:machine_upgrade"], undefined);
            assert.ok(
                existsSync(
                    resolve(root, "RP", atlas[item.components["minecraft:icon"]].textures + ".png"),
                ),
            );
            assert.equal(
                json(`BP/recipes/items/materials/${name}.json`)["minecraft:recipe_shaped"].result
                    .item,
                id,
            );
            for (const lang of readdirSync(resolve(root, "RP/texts")).filter((n) =>
                n.endsWith(".lang"),
            )) {
                assert.ok(
                    readFileSync(resolve(root, "RP/texts", lang), "utf8").includes(`item.${id}=`),
                    lang,
                );
            }
        }
    },
);
console.log(`${checks} upgrade checks passed.`);

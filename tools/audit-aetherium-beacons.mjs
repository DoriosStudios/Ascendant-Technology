import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import vm from "node:vm";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
let assertions = 0;
function check(condition, message) {
    assert.ok(condition, message);
    assertions++;
}
const listeners = {};
const signal = (name) => ({
    subscribe(fn) {
        (listeners[name] ??= []).push(fn);
    },
});
const pending = [];
const system = {
    currentTick: 0,
    run: (fn) => pending.push(fn),
    runInterval: () => 1,
    clearRun() {},
    afterEvents: { scriptEventReceive: signal("script") },
};
const world = {
    afterEvents: {
        entitySpawn: signal("spawn"),
        entityLoad: signal("load"),
        entityRemove: signal("remove"),
    },
};
class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId;
        this.amount = amount;
        this.lore = [];
    }
    setLore(lore) {
        this.lore = lore;
    }
    getLore() {
        return this.lore;
    }
    clone() {
        const item = new ItemStack(this.typeId, this.amount);
        item.nameTag = this.nameTag;
        item.lore = [...this.lore];
        return item;
    }
}
class EnergyStorage {
    constructor(entity) {
        this.entity = entity;
    }
    get() {
        return this.entity.stored;
    }
    getFreeSpace() {
        return this.entity.capacity - this.get();
    }
    transferTo(target, limit) {
        const amount = Math.min(limit, this.get(), target.getFreeSpace());
        this.entity.stored -= amount;
        target.entity.stored += amount;
        return amount;
    }
    display() {}
    static formatEnergyToText(value) {
        return String(value);
    }
}
const registrations = new Map();
const policies = new Map();
const registry = new Proxy(
    {
        REGISTRATION_EVENT_IDS: { INFUSER_RECIPE: "infuser" },
        blockComponent(id, component) {
            registrations.set(id, component);
        },
    },
    {
        get(target, key) {
            return key in target ? target[key] : () => {};
        },
    },
);
const lib = {
    registry,
    block: {
        getState: (block, key) => block.states[key],
        setState(block, key, value) {
            block.states[key] = value;
        },
    },
};
const api = { system, world, ItemStack };
const core = { EnergyStorage, registerIOInterface: (id, config) => policies.set(id, config) };
async function load(entry) {
    const result = await build({
        entryPoints: [join(root, entry)],
        bundle: true,
        write: false,
        format: "cjs",
        platform: "node",
        plugins: [
            {
                name: "minecraft-fixtures",
                setup(builder) {
                    builder.onResolve(
                        {
                            filter: /^(@minecraft\/server|DoriosCore\/index.js|DoriosLib\/index.js)$/,
                        },
                        ({ path }) => ({ path, namespace: "fixture" }),
                    );
                    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
                        const object =
                            path === "@minecraft/server"
                                ? api
                                : path === "DoriosCore/index.js"
                                  ? core
                                  : lib;
                        const name =
                            path === "@minecraft/server"
                                ? "api"
                                : path === "DoriosCore/index.js"
                                  ? "core"
                                  : "lib";
                        return {
                            contents: Object.keys(object)
                                .map((key) => `export const ${key} = globalThis.${name}.${key};`)
                                .join("\n"),
                        };
                    });
                },
            },
        ],
    });
    const context = { module: { exports: {} }, api, core, lib, console };
    context.exports = context.module.exports;
    vm.runInNewContext(result.outputFiles[0].text, context, { filename: entry });
    return context.module.exports;
}

const network = await load("BP/scripts/ATCore/networks/powerBeacons.js");
const buttonModule = await load("BP/scripts/DoriosCore/buttons/index.js");
buttonModule.loadButtonItemStack("utilitycraft:ui_filler", ItemStack);
core.ButtonManager = buttonModule.ButtonManager;
let serial = 0;
function fixture(capacities, range = 48) {
    const entities = [];
    const dimension = {
        id: "overworld",
        getEntities: ({ type }) =>
            entities.filter((e) => e.isValid && (!type || type === e.typeId)),
        getBlock: () => block,
        getEntitiesAtBlockLocation: () => [beacon],
    };
    function entity(capacity, location, typeId = "utilitycraft:machine_entity", extra = []) {
        const families = ["dorios:machine", "dorios:energy_container", ...extra];
        const slots = new Map();
        const container = {
            getItem: (slot) => slots.get(slot),
            setItem: (slot, item) => slots.set(slot, item),
            size: 3,
        };
        const properties = new Map();
        const result = {
            id: String(++serial),
            typeId,
            capacity,
            stored: 0,
            isValid: true,
            location,
            dimension,
            getDynamicProperty: (key) => properties.get(key),
            setDynamicProperty: (key, value) => properties.set(key, value),
            getComponent: (name) =>
                name.includes("type_family")
                    ? { hasTypeFamily: (family) => families.includes(family) }
                    : name.includes("inventory")
                      ? { container }
                      : undefined,
        };
        entities.push(result);
        return result;
    }
    const beacon = entity(100000, { x: 0, y: 0, z: 0 }, network.POWER_BEACON_ENTITY_ID, [
        "dorios:energy_source",
    ]);
    const block = {
        typeId: "utilitycraft:basic_power_beacon",
        states: { "utilitycraft:on": false },
        dimension,
        location: beacon.location,
    };
    const targets = capacities.map((cap, index) => entity(cap, { x: index + 1, y: 0, z: 0 }));
    const record = network.ensurePowerBeacon(beacon, range);
    return { entity, beacon, block, targets, record, source: new EnergyStorage(beacon) };
}
const constrained = fixture([100, 1]);
constrained.beacon.stored = 100;
check(
    network.transferPowerBeaconEnergy(constrained.record, constrained.source, 100).transferred ===
        100,
    "Small late receiver must not waste transferable energy",
);
check(
    constrained.targets[0].stored === 99 && constrained.targets[1].stored === 1,
    "Full receivers redistribute their unused share",
);
const scarce = fixture([1, 20, 100]);
const received = [0, 0, 0];
for (let tick = 0; tick < 30; tick++) {
    scarce.beacon.stored = 1;
    network.transferPowerBeaconEnergy(scarce.record, scarce.source, 1);
    scarce.targets.forEach((target, index) => {
        received[index] += target.stored;
        target.stored = 0;
    });
}
check(
    received.every((amount) => amount === 10),
    "Scarce energy must rotate across different receiver capacities",
);
const gaps = fixture([10, 0, 0, 0, 10]);
const gapReceived = [0, 0];
for (let tick = 0; tick < 20; tick++) {
    gaps.beacon.stored = 1;
    network.transferPowerBeaconEnergy(gaps.record, gaps.source, 1);
    [gaps.targets[0], gaps.targets[4]].forEach((target, index) => {
        gapReceived[index] += target.stored;
        target.stored = 0;
    });
}
check(
    gapReceived.every((amount) => amount === 10),
    "Full receivers cannot bias the rotating allocation",
);
for (let seed = 1; seed <= 150; seed++) {
    const caps = Array.from({ length: 1 + (seed % 11) }, (_, i) => (seed * 37 + i * 29) % 103);
    const current = fixture(caps);
    const stored = (seed * 13) % 901;
    const limit = (seed * 7) % 403;
    current.beacon.stored = stored;
    const result = network.transferPowerBeaconEnergy(current.record, current.source, limit);
    const total = current.targets.reduce((sum, target) => sum + target.stored, 0);
    check(
        total ===
            Math.min(
                stored,
                limit,
                caps.reduce((a, b) => a + b, 0),
            ),
        `Budget utilization, seed ${seed}`,
    );
    check(
        total + current.beacon.stored === stored && total === result.transferred,
        `Energy conservation, seed ${seed}`,
    );
    check(
        current.targets.every((target) => target.stored <= target.capacity),
        `Capacity limit, seed ${seed}`,
    );
    network.unregisterPowerBeacon(current.beacon.id);
}
const rangeCase = fixture([10, 10, 10], 2);
check(rangeCase.record.targets.size === 2, "Range includes boundary and excludes beyond it");
rangeCase.targets[0].dimension = { id: "nether" };
rangeCase.targets[1].isValid = false;
rangeCase.beacon.stored = 10;
check(
    network.transferPowerBeaconEnergy(rangeCase.record, rangeCase.source, 10).transferred === 0,
    "Invalid and cross-dimension targets are pruned",
);
const excluded = fixture([]);
for (const family of ["dorios:battery", "dorios:energy_source"])
    excluded.entity(20, { x: 1, y: 0, z: 0 }, "utilitycraft:machine_entity", [family]);
system.currentTick += 601;
network.maintainPowerBeacon(excluded.beacon, 48);
check(
    excluded.record.targets.size === 0,
    "Wireless transmission excludes batteries and generators",
);
const newMachine = excluded.entity(20, { x: 2, y: 0, z: 0 });
for (const fn of listeners.load) fn({ entity: newMachine });
while (pending.length) pending.shift()();
check(excluded.record.targets.has(newMachine.id), "Loaded machines join nearby beacons");
for (const fn of listeners.remove) fn({ removedEntityId: newMachine.id });
check(!excluded.record.targets.has(newMachine.id), "Removed machines leave caches");
check(
    network.transferPowerBeaconEnergy(excluded.record, excluded.source, NaN).transferred === 0,
    "Invalid rate fails closed",
);

let machineFixture;
core.Generator = class {
    constructor(block) {
        Object.assign(this, {
            valid: true,
            block,
            entity: machineFixture.beacon,
            energy: machineFixture.source,
            rate: 4,
            baseRate: 1,
            processingInterval: 4,
            shouldUpdateUI: true,
        });
    }
    setLabel(value) {
        this.entity.label = value;
    }
    static spawnEntity(event, settings, callback) {
        callback(machineFixture.beacon);
    }
    static onDestroy() {}
};
await load("BP/scripts/features/generators/powerBeacon.js");
const feature = registrations.get("utilitycraft:power_beacon");
machineFixture = fixture([100], 4);
machineFixture.beacon.stored = 100;
feature.beforeOnPlayerPlace(
    { block: machineFixture.block },
    { params: { generator: { range: 4 } } },
);
feature.onTick({ block: machineFixture.block }, { params: { generator: { range: 4 } } });
check(
    machineFixture.block.states["utilitycraft:on"] === true,
    "Transmission activates the dedicated texture state",
);
machineFixture.beacon.getComponent("minecraft:inventory").container.setItem(2, undefined);
// Another block tick before the button poll must not swallow the pending click.
feature.onTick({ block: machineFixture.block }, { params: { generator: { range: 4 } } });
core.ButtonManager.tick();
check(
    machineFixture.beacon.getDynamicProperty("ascendant:power_beacon_transmission") === "false",
    "Pending transmission toggle survives watcher refresh",
);
const savedEnergy = machineFixture.beacon.stored;
feature.onTick({ block: machineFixture.block }, { params: { generator: { range: 4 } } });
check(
    machineFixture.beacon.stored === savedEnergy && !machineFixture.block.states["utilitycraft:on"],
    "Disabled beacon preserves stored energy and switches off",
);
check(
    policies.size === 5 &&
        [...policies.values()].every(
            (p) => p.items.anyInputSlots.length === 0 && p.items.anyOutputSlots.length === 0,
        ),
    "All five tiers protect UI slots from automation",
);

const crusher = (await load("BP/scripts/config/recipes/added/crusher.js")).crusherRecipeAdditions;
const furnace = (await load("BP/scripts/config/recipes/added/furnace.js")).furnaceRecipeAdditions;
const liquid = (await load("BP/scripts/config/recipes/liquifier.js")).liquifierRecipes;
const catalyst = (await load("BP/scripts/config/recipes/catalystWeaver.js"))
    .catalystWeaverRecipeDefinitions;
check(
    crusher["utilitycraft:aetherium_shard"].output === "utilitycraft:aetherium_crystal_dust",
    "Crystal crushing cannot create metal",
);
check(
    crusher["utilitycraft:aetherium_crystal_block"].amount ===
        9 * crusher["utilitycraft:aetherium_shard"].amount,
    "Crystal block crushing preserves material ratio",
);
check(
    crusher["utilitycraft:aetherium_block"].amount === 9 * crusher["utilitycraft:aetherium"].amount,
    "Metal block crushing preserves material ratio",
);
check(
    furnace["utilitycraft:aetherium_dust"].output === "utilitycraft:aetherium" &&
        !furnace["utilitycraft:aetherium_crystal_dust"] &&
        !furnace["utilitycraft:aetherium_shard"],
    "Only metal dust can be smelted into ingots",
);
const alloy = catalyst["utilitycraft:aetherium_ingot"];
const dustAlloy = catalyst["utilitycraft:aetherium_ingot_from_crystal_dust"];
check(
    alloy.catalysts[3].amount * crusher["utilitycraft:aetherium_shard"].amount ===
        dustAlloy.catalysts[3].amount &&
        alloy.cost === dustAlloy.cost &&
        alloy.fluid.amount === dustAlloy.fluid.amount,
    "Both alloy routes consume equivalent crystal and energy",
);
check(
    liquid["utilitycraft:aetherium"].amount === liquid["utilitycraft:aetherium_dust"].amount,
    "Metal liquification is independent of grinding",
);
check(
    liquid["utilitycraft:aetherium_shard"].required * 2 ===
        liquid["utilitycraft:aetherium_crystal_dust"].required &&
        liquid["utilitycraft:aetherium_shard"].amount ===
            liquid["utilitycraft:aetherium_crystal_dust"].amount,
    "Crystal liquification is independent of grinding",
);
const terrain = json("RP/textures/terrain_texture.json").texture_data;
const itemAtlas = json("RP/textures/item_texture.json").texture_data;
check(
    existsSync(join(root, "RP", itemAtlas.utilitycraft_aetherium_crystal_dust.textures + ".png")),
    "Crystal dust icon resolves",
);
check(
    existsSync(join(root, "RP", terrain.utilitycraft_aetherium_crystal_block.textures + ".png")),
    "Crystal block texture resolves",
);
const crafter = (await load("BP/scripts/config/recipes/crafter.js")).crafterRecipeAdditions;
const geometry = json("RP/models/blocks/power_beacon.geo.json")["minecraft:geometry"][0]
    .description;
const knownIds = new Set();
// UtilityCraft is optional for this audit; when available, also resolve every
// custom crafting ingredient against both active packs.
const dependencyRoot = resolve(root, "../UtilityCraft/BP");
for (const pack of [join(root, "BP"), ...(existsSync(dependencyRoot) ? [dependencyRoot] : [])]) {
    for (const folder of ["items", "blocks"]) {
        for (const file of readdirSync(join(pack, folder), {
            recursive: true,
            withFileTypes: true,
        })) {
            if (!file.isFile() || !file.name.endsWith(".json")) continue;
            const source = readFileSync(join(file.parentPath, file.name), "utf8");
            const id = source.match(/"identifier"\s*:\s*"([^"]+)"/)?.[1];
            if (id) knownIds.add(id);
        }
    }
}
for (const tier of ["basic", "advanced", "expert", "ultimate", "absolute"]) {
    const block = json(`BP/blocks/machinery/generators/power_beacon/${tier}_power_beacon.json`)[
        "minecraft:block"
    ];
    check(
        block.components["minecraft:geometry"] === geometry.identifier,
        `${tier} uses dedicated geometry`,
    );
    for (const [state, components] of [
        ["off", block.components],
        ["on", block.permutations[0].components],
    ]) {
        const texture = components["minecraft:material_instances"]["*"].texture;
        check(
            texture === `utilitycraft_${tier}_power_beacon_${state}`,
            `${tier} ${state} texture identity`,
        );
        const png = readFileSync(join(root, "RP", terrain[texture].textures + ".png"));
        check(
            png.readUInt32BE(16) === geometry.texture_width &&
                png.readUInt32BE(20) === geometry.texture_height,
            `${tier} ${state} atlas dimensions match model`,
        );
    }
    const recipe = json(
        `BP/recipes/blocks/machinery/generators/power_beacon/${tier}_power_beacon.json`,
    )["minecraft:recipe_shaped"];
    const signature = recipe.pattern
        .join("")
        .split("")
        .map((key) => recipe.key[key].item.replace(/^(minecraft|utilitycraft):/, ""))
        .join(",");
    check(
        crafter[signature]?.output === recipe.result.item,
        `${tier} has matching Workbench and Assembler recipes`,
    );
    if (existsSync(dependencyRoot))
        for (const ingredient of Object.values(recipe.key)) {
            check(
                ingredient.item.startsWith("minecraft:") || knownIds.has(ingredient.item),
                `${tier} ingredient ${ingredient.item} exists`,
            );
        }
}
const alloyPreview = json("RP/ui/recipes/catalyst_weaver.json");
const previewText = JSON.stringify(alloyPreview);
check(
    previewText.includes("cw_aetherium_dust_recipe") &&
        previewText.includes("textures/items/ores/aetherium_crystal_dust"),
    "Crystal dust alloy has a recipe preview",
);
console.log(
    `Aetherium/Power Beacon audit passed: ${assertions} checks, including 150 energy distributions and pending UI clicks.`,
);

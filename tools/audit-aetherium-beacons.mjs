import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import vm from "node:vm";
import { build } from "esbuild";
import { auditEndAetherium } from "./audit-end-aetherium.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const json = (file) => JSON.parse(read(file).replace(/^\uFEFF/, ""));
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
const press = (await load("BP/scripts/config/recipes/added/press.js")).pressRecipeAdditions;
const sieve = (await load("BP/scripts/config/recipes/added/sieve.js")).sieveDropAdditions;
const furnace = (await load("BP/scripts/config/recipes/added/furnace.js")).furnaceRecipeAdditions;
const liquid = (await load("BP/scripts/config/recipes/liquifier.js")).liquifierRecipes;
const catalyst = (await load("BP/scripts/config/recipes/catalystWeaver.js"))
    .catalystWeaverRecipeDefinitions;
check(
    crusher["utilitycraft:aetherium_shard"].output === "utilitycraft:aetherium_crystal_dust" &&
        crusher["utilitycraft:aetherium_shard"].required === 2 &&
        crusher["utilitycraft:aetherium_shard"].amount === 1 &&
        crusher["utilitycraft:aetherium_crystal"].amount === 2 &&
        crusher["utilitycraft:aetherium_crystal_block"].output ===
            "utilitycraft:aetherium_crystal_dust" &&
        crusher["utilitycraft:aetherium_crystal_block"].amount === 8,
    "Crystalline crushing preserves the two-shards-to-one-dust ratio",
);
check(
    ["end_aetherium_ore", "deepslate_aetherium_ore"].every((ore) => {
        const recipe = crusher[`utilitycraft:${ore}`];
        return recipe.output === "utilitycraft:aetherium_shard" && recipe.amount === 2;
    }),
    "Both Aetherium ores crush into two shards",
);
check(
    press["utilitycraft:aetherium_shard"].required === 4 &&
        press["utilitycraft:aetherium_shard"].output === "utilitycraft:aetherium_crystal" &&
        press["utilitycraft:aetherium_crystal"].required === 4 &&
        press["utilitycraft:aetherium_crystal"].output === "utilitycraft:aetherium_crystal_block" &&
        ["utilitycraft:crushed_endstone", "utilitycraft:crushed_cobbled_deepslate"].every((input) =>
            sieve[input].some((drop) => drop.item === "utilitycraft:aetherium_shard"),
        ),
    "Sieving produces shards that press into crystals and four-crystal blocks",
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
    alloy.catalysts[3].amount * crusher["utilitycraft:aetherium_crystal"].amount ===
        dustAlloy.catalysts[3].amount &&
        alloy.cost === dustAlloy.cost &&
        alloy.fluid.amount === dustAlloy.fluid.amount,
    "Both alloy routes consume equivalent crystal and energy",
);
const hyper = catalyst["utilitycraft:hyper_processing_upgrade"];
check(
    hyper.catalysts.some((entry) => entry.id === "utilitycraft:aetherium_dust") &&
        hyper.catalysts.some((entry) => entry.id === "utilitycraft:aetherium_crystal_dust"),
    "Hyper Processing consumes both metallic and crystalline Aetherium dust",
);
for (const [material, amount] of Object.entries({
    aetherium: 250,
    aetherium_dust: 150,
    aetherium_crystal: 100,
    aetherium_crystal_dust: 50,
    aetherium_shard: 25,
})) {
    check(
        liquid[`utilitycraft:${material}`].required === 1 &&
            liquid[`utilitycraft:${material}`].amount === amount,
        `${material} uses the specified per-item liquid yield`,
    );
}
check(!liquid["utilitycraft:refined_aetherium_crystal"], "Refined crystals cannot be liquified");
check(
    catalyst["utilitycraft:refined_aetherium_crystal"].input.id ===
        "utilitycraft:aetherium_crystal",
    "Refining starts from the original crystal rather than a loose fragment",
);
const terrain = json("RP/textures/terrain_texture.json").texture_data;
const itemAtlas = json("RP/textures/item_texture.json").texture_data;
const crystal = json("BP/items/ore_related/aetherium_crystal.json")["minecraft:item"];
check(
    crystal.description.identifier === "utilitycraft:aetherium_crystal" &&
        existsSync(
            join(root, "RP", itemAtlas[crystal.components["minecraft:icon"]].textures + ".png"),
        ),
    "The original crystal is a distinct registered item with its own icon",
);
check(
    existsSync(join(root, "RP", itemAtlas.utilitycraft_aetherium_crystal_dust.textures + ".png")),
    "Crystal dust icon resolves",
);
check(
    existsSync(join(root, "RP", terrain.utilitycraft_aetherium_crystal_block.textures + ".png")),
    "Crystal block texture resolves",
);
const crafter = (await load("BP/scripts/config/recipes/crafter.js")).crafterRecipeAdditions;
const compactor = await load("BP/scripts/config/recipes/compactor.js");
const crystalCraft = json("BP/recipes/items/materials/aetherium_crystal.json")[
    "minecraft:recipe_shaped"
];
const crystalUnpack = json("BP/recipes/items/materials/aetherium_crystal_unpack.json")[
    "minecraft:recipe_shapeless"
];
const crystalBlockCraft = json("BP/recipes/items/materials/aetherium_crystal_block.json")[
    "minecraft:recipe_shaped"
];
const crystalBlockUnpack = json("BP/recipes/items/materials/aetherium_crystal_block_unpack.json")[
    "minecraft:recipe_shapeless"
];
check(
    crystalCraft.pattern.join("") === "SSSS" &&
        crystalCraft.key.S.item === "utilitycraft:aetherium_shard" &&
        crystalCraft.result.item === "utilitycraft:aetherium_crystal" &&
        crystalCraft.result.count === 1 &&
        crystalUnpack.ingredients[0].item === crystalCraft.result.item &&
        crystalUnpack.result.item === crystalCraft.key.S.item &&
        crystalUnpack.result.count === 4,
    "Crystal crafting and unpacking preserve four shards",
);
check(
    crystalBlockCraft.pattern.join("") === "AAAA" &&
        crystalBlockCraft.key.A.item === "utilitycraft:aetherium_crystal" &&
        crystalBlockUnpack.result.item === "utilitycraft:aetherium_crystal" &&
        crystalBlockUnpack.result.count === 4,
    "Crystal block crafting and unpacking preserve four crystals",
);
check(
    compactor.getCompactorRecipe("utilitycraft:aetherium_shard", 4)?.output ===
        "utilitycraft:aetherium_crystal" &&
        compactor.getCompactorRecipe("utilitycraft:aetherium_crystal", 4)?.output ===
            "utilitycraft:aetherium_crystal_block" &&
        compactor.getCompactorRecipe("utilitycraft:aetherium_crystal", 4)?.required === 4,
    "Compactor follows the four-shard and four-crystal progression",
);
for (const ore of ["end_aetherium_ore", "deepslate_aetherium_ore"]) {
    const loot = json(`BP/loot_tables/blocks/${ore}.json`);
    const nonsilkDrops = loot.pools
        .slice(1)
        .flatMap((pool) => pool.entries ?? [])
        .map((entry) => entry.name);
    check(
        nonsilkDrops.length > 0 &&
            nonsilkDrops.every((item) => item === "utilitycraft:aetherium_crystal"),
        `${ore} drops crystals without Silk Touch`,
    );
}
const absoluteContainer = json("BP/recipes/blocks/machinery/machines/absolute_container.json")[
    "minecraft:recipe_shaped"
];
check(
    absoluteContainer.key.N.item === "minecraft:netherite_ingot" &&
        crafter[
            "aetherium,ultimate_fluid_tank,aetherium,netherite_ingot,absolute_battery,netherite_ingot,chest,network_center,chest"
        ]?.output === "utilitycraft:absolute_container",
    "Absolute Container uses Netherite Ingots in both Workbench and Assembler recipes",
);
for (const name of ["aetherium_storage_part", "aetherium_storage_cell"]) {
    const definition = json(`BP/recipes/items/storage/${name}.json`);
    const recipe =
        definition["minecraft:recipe_shaped"] ?? definition["minecraft:recipe_shapeless"];
    const inputs = recipe.pattern
        ? [...recipe.pattern.join("")].map((key) => recipe.key[key].item)
        : recipe.ingredients.map((ingredient) => ingredient.item);
    const signature = inputs.map((id) => id.replace(/^(minecraft|utilitycraft):/, ""));
    while (signature.length < 9) signature.push("air");
    check(
        crafter[signature.join(",")]?.output === recipe.result.item,
        `${name} has matching Workbench and Assembler recipes`,
    );
}
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
check(
    previewText.includes("cw_hyper_processing_recipe") &&
        previewText.includes("catalyst_4@catalyst_weaver.recipe_catalyst_4"),
    "Hyper Processing preview includes both Aetherium dust types",
);
const crusherPreview = JSON.stringify(json("RP/ui/recipes/crusher.json"));
check(
    [
        "at_aetherium_shards_end_ore_recipe",
        "at_aetherium_shards_deepslate_ore_recipe",
        "at_aetherium_crystal_dust_from_shards_recipe",
        "at_aetherium_crystal_dust_from_crystal_recipe",
        "at_aetherium_crystal_dust_from_block_recipe",
    ].every((name) => crusherPreview.includes(name)),
    "Crusher preview lists every crystalline Aetherium conversion",
);
const pressPreview = JSON.stringify(json("RP/ui/recipes/electro_press.json"));
check(
    pressPreview.includes("at_aetherium_crystal_recipe") &&
        pressPreview.includes("at_aetherium_crystal_block_recipe"),
    "Press preview lists the shard-to-crystal progression",
);

assertions += auditEndAetherium(root);

const cell = json("BP/items/storage/aetherium_storage_cell.json")["minecraft:item"];
const cellTags = cell.components["minecraft:tags"].tags;
check(
    cell.components["minecraft:max_stack_size"] === 1,
    "Storage cells keep independent identities",
);
check(
    cellTags.includes("utilitycraft:ds.is_storage_cell") &&
        cellTags.filter((tag) => tag.startsWith("utilitycraft:ds.capacity.")).length === 1,
    "Cell declares the Digital Storage extension contract",
);
const digitalStorageSource =
    "../UtilityCraft-Digital-Storage/BP/scripts/Machinery/storage/cell_store.js";
if (existsSync(join(root, digitalStorageSource))) {
    const digitalStorage = await load(digitalStorageSource);
    const capacity = digitalStorage.getStorageCellCapacity({
        typeId: cell.description.identifier,
        hasTag: (tag) => cellTags.includes(tag),
        getTags: () => cellTags,
    });
    check(
        capacity === digitalStorage.CELL_CAPACITIES["utilitycraft:ultimate_storage_cell"] * 8,
        "The actual Digital Storage resolver accepts the cell at eight times Ultimate capacity",
    );
}
console.log(
    `Aetherium/Power Beacon audit passed: ${assertions} checks, including 150 energy distributions and pending UI clicks.`,
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const configPath = "BP/scripts/config/alchemy.js";
const potionPath = "BP/scripts/ATCore/alchemy/potions.js";
const recipePath = "BP/scripts/ATCore/alchemy/recipes.js";
const machinePath = "BP/scripts/features/machines/alchemicalStation.js";
const itemPath = "BP/scripts/features/alchemy/potionItems.js";
let current, registered, io, unsupported = false;
const statsEffects = [];
const buttons = new Map(), handlers = {}, nativeTypes = new Map(), itemComponents = new Map();
class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId; this.amount = amount;
        this.maxAmount = /potion/.test(typeId) ? 1 : 64;
        this.data = new Map(); this.lore = [];
    }
    clone() { const v = new ItemStack(this.typeId, this.amount); v.data = new Map(this.data); v.lore = [...this.lore]; v.native = this.native && { ...this.native }; return v; }
    getDynamicProperty(k) { return this.data.get(k); }
    setDynamicProperty(k, v) { this.data.set(k, v); }
    setLore(v) { this.lore = v; }
    getComponent(id) { return id === "minecraft:potion" && this.native ? { potionEffectType: { id: this.native.id, durationTicks: this.native.durationTicks }, potionDeliveryType: { id: this.native.delivery } } : undefined; }
}
const Potions = { resolve(id, delivery) {
    if (unsupported) throw Error("Unavailable potion");
    assert(nativeTypes.has(id) || ["water", "awkward", "mundane", "thick"].some(k => id === `minecraft:${k}`), id);
    const item = new ItemStack(delivery === "Consume" ? "minecraft:potion" : delivery === "ThrownSplash" ? "minecraft:splash_potion" : "minecraft:lingering_potion");
    item.native = { id, delivery }; return item;
} };
const signal = name => ({ subscribe(fn) { handlers[name] = fn; } });
const system = { currentTick: 0, run() {}, runInterval(fn) { handlers.cloudTick = fn; }, afterEvents: { scriptEventReceive: signal("script") } };
const world = { afterEvents: Object.fromEntries(["projectileHitEntity", "projectileHitBlock", "entityLoad", "entityRemove"].map(k => [k, signal(k)])) };
const exports = {
    ItemStack, Potions, system, world,
    Machine: class { constructor() { return current; } },
    registerATMachine: (_, component) => { registered = component; },
    registerIOInterface: (_, options) => { io = options; },
    FluidStorage: class { constructor(_, index) { return current.tanks[index]; } },
    ButtonManager: { registerMachineButton: (_, slot, cb) => buttons.set(slot, cb), ensureWatching() {}, unwatchEntity() {} },
    renderStatus: (m, active, title, lines) => { m.status = lines; },
    setRunning: (m, active) => { m.running = active; },
    setDynamicNumber: (entity, k, v) => entity.setDynamicProperty(k, v),
    setDynamicString: (entity, k, v) => entity.setDynamicProperty(k, v),
    setUiItem(container, slot, id, nameTag) { const item = new ItemStack(id); item.nameTag = nameTag; container.setItem(slot, item); },
    registry: { itemComponent: (id, component) => { itemComponents.set(id, component); } },
    applyStatsCorePotionEffect: (target, id, ticks, level) => { statsEffects.push({ target, id, ticks, level }); return true; },
};
const context = vm.createContext({ console });
const stub = new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
const modules = new Map();
function module(file) {
    if (!modules.has(file)) modules.set(file, new vm.SourceTextModule(readFileSync(new URL(file, root), "utf8"), { context, identifier: file }));
    return modules.get(file);
}
async function load(file) {
    const m = module(file);
    await m.link(async specifier => {
        if (specifier.endsWith("config/alchemy.js")) return module(configPath);
        if (specifier.endsWith("alchemy/recipes.js")) return module(recipePath);
        if (specifier.endsWith("alchemy/potions.js")) return module(potionPath);
        return stub;
    });
    await m.evaluate(); return m.namespace;
}
await load(machinePath);
const { ALCHEMY: C, ALCHEMY_SLOTS: S, ALCHEMY_POTION_COMPONENTS, POTION_FAMILIES, CUSTOM_POTIONS, NATIVE_POTIONS, potionEffects } = module(configPath).namespace;
for (const id of Object.keys(NATIVE_POTIONS)) nativeTypes.set(id, true);
const { createPotion, readPotion } = module(potionPath).namespace;
const { resolvePotionUpgrade, resolveBrew, planBrewingBatch } = module(recipePath).namespace;
function tank(capacity, type, amount = 0) {
    return { amount, capacity, type, get() { return this.amount; }, getCap() { return this.capacity; }, setCap(v) { this.capacity = v; }, getType() { return this.type; }, setType(v) { this.type = v; },
        consume(v) { assert(this.amount >= v); this.amount -= v; }, add(v) { this.amount += v; }, getFreeSpace() { return this.capacity - this.amount; }, display() {} };
}
function setup(energy = 200000, aetherium = 10000, blaze = 1000) {
    const items = new Map(), data = new Map();
    const entity = { getDynamicProperty: k => data.get(k), setDynamicProperty: (k, v) => data.set(k, v), getComponent: () => ({ container: current.container }) };
    current = { entity, valid: true, shouldUpdateUI: false, processingInterval: 100, boosts: { speed: 1, consumption: 1 },
        energy: tank(200000, "energy", energy), tanks: [tank(C.aetheriumCapacity, "liquified_aetherium", aetherium), tank(C.blazeCapacity, "blaze_essence", blaze)],
        container: { size: S.size, getItem: slot => items.get(slot)?.clone(), setItem: (slot, item) => item ? items.set(slot, item.clone()) : items.delete(slot) },
        processIO() {}, displayProgress() {}, setLabel(lines) { this.status = lines; }, getProgress: index => data.get(`dorios:progress_${index ?? 0}`) ?? 0,
    };
    return { items, data, m: current };
}
const tick = () => registered.onTick({}, { params: { machine: {} } });
const run = n => { for (let i = 0; i < n; i++) tick(); };
const request = lane => buttons.get(lane === "amplify" ? S.amplifyButton : S.extendButton)({ entity: current.entity });
const drink = family => createPotion({ family, level: 1, extent: "normal", form: "drink" });

// The native gauge renderer needs registered frame items, including empty/full
// endpoints. Opening the UI must update that slot without charging any process.
for (const [amount, frame] of [[0, "00"], [C.blazeCapacity / 2, "26"], [C.blazeCapacity, "52"]]) {
    const { m, items } = setup(200000, 0, amount);
    m.shouldUpdateUI = true;
    tick();
    assert.equal(items.get(S.blaze).typeId, `utilitycraft:alchemical_blaze_${frame}`);
    assert.equal(m.tanks[1].get(), amount);
    assert.equal(m.energy.get(), 200000);
    assert.equal(m.status.length, 4);
    assert(m.status[0].includes("Add a reagent to the middle slot."));
    assert(m.status[1].includes("Insert a potion in the left slot."));
    assert(m.status[2].includes("Insert a potion in the right slot."));
}

// Verify the roadmap's three key variants and conversion preservation, including two-effect Turtle Master.
for (const f of POTION_FAMILIES) {
    const p = { family: f.id, level: 1, extent: "normal", form: "drink" };
    if (!f.instant) {
        const extended = resolvePotionUpgrade(resolvePotionUpgrade(p, "extend"), "extend");
        assert.equal(potionEffects(extended)[0].duration, f.long * 4);
        assert.equal(resolvePotionUpgrade(extended, "extend"), null);
    } else assert.equal(resolvePotionUpgrade(p, "extend"), null);
    if (f.maxLevel >= 3) {
        const level2 = resolvePotionUpgrade(p, "amplify");
        assert.equal(potionEffects(resolvePotionUpgrade(level2, "extend") ?? level2)[0].amplifier, 1);
        assert.equal(resolvePotionUpgrade(level2, "amplify").level, 3);
    }
}
let p = { family: "strength", level: 3, extent: "maximum", form: "drink", duration: 90 };
const splash = resolveBrew(p, "minecraft:gunpowder"), lingering = resolveBrew(splash, "minecraft:dragon_breath");
assert.equal(lingering.duration, 90); assert.equal(lingering.level, 3);
assert.deepEqual(JSON.parse(JSON.stringify(readPotion(createPotion(lingering)))), JSON.parse(JSON.stringify(lingering)));
// Canonical Creative descriptions should not be duplicated by runtime lore.
assert.equal(createPotion({ family: "haste", level: 2, extent: "normal", form: "drink" }).lore.length, 0);
// A native shorter duration stays exact without adding duplicate tooltip lore.
const shortenedCloud = createPotion(lingering);
assert.equal(shortenedCloud.lore.length, 0);
assert.equal(readPotion(shortenedCloud).duration, 90);
const turtle = resolvePotionUpgrade({ family: "turtle_master", level: 1, extent: "long", form: "drink" }, "amplify");
assert.equal(potionEffects(turtle).length, 2); assert.equal(potionEffects(turtle)[0].amplifier, 3);
assert.equal(resolvePotionUpgrade(turtle, "amplify"), null);
assert.equal(readPotion(Potions.resolve("minecraft:strong_slowness", "Consume")).level, 4);
assert.equal(resolvePotionUpgrade(readPotion(Potions.resolve("minecraft:strong_slowness", "Consume")), "amplify").level, 5);
assert.equal(readPotion(Potions.resolve("minecraft:nightvision", "Consume")).family, "nightvision");
const shorter = readPotion(Potions.resolve("minecraft:strong_regeneration", "ThrownSplash"));
assert.equal(readPotion(createPotion(resolvePotionUpgrade(shorter, "amplify"))).duration, 22.5);
Potions.getEffectType = id => id === "minecraft:long_swiftness" ? { durationTicks: 10000 } : undefined;
const live = drink("swiftness"); live.native.durationTicks = 4000;
const liveUpgrade = resolvePotionUpgrade(readPotion(live), "amplify");
assert.equal(potionEffects(liveUpgrade)[0].duration, 200);
const liveMaximum = resolvePotionUpgrade(resolvePotionUpgrade(liveUpgrade, "extend"), "extend");
assert.equal(potionEffects(readPotion(createPotion(liveMaximum)))[0].duration, 2000);
delete Potions.getEffectType;

// Six bottles: no consumption during progress, one reagent and one fuel charge on commit.
let s = setup(); s.items.set(S.ingredient, new ItemStack("minecraft:nether_wart", 2));
for (const slot of S.bottles) s.items.set(slot, drink("water"));
run(3); assert.equal(s.m.energy.get(), 200000); assert.equal(s.items.get(S.ingredient).amount, 2);
tick(); assert.equal(s.m.energy.get(), 188000); assert.equal(s.m.tanks[1].get(), 1000 - C.blazePerBrew); assert.equal(s.items.get(S.ingredient).amount, 1);
for (const slot of S.bottles) assert.equal(readPotion(s.items.get(slot)).family, "awkward");
run(4); assert.equal(s.m.energy.get(), 188000);

// Partial batches leave incompatible bottles untouched; full-stack potion input is rejected.
s = setup(); s.items.set(S.ingredient, new ItemStack("utilitycraft:titanium_dust", 3));
s.items.set(4, drink("awkward")); s.items.set(5, drink("strength")); s.items.set(6, new ItemStack("minecraft:stone"));
run(4); assert.equal(readPotion(s.items.get(4)).family, "haste"); assert.equal(readPotion(s.items.get(5)).family, "strength");
assert.equal(s.items.get(6).typeId, "minecraft:stone"); assert.equal(s.items.get(S.ingredient).amount, 2);

// Resource shortages pause without charging. Input replacement cancels accumulated progress.
s = setup(11999); s.items.set(3, new ItemStack("minecraft:nether_wart")); s.items.set(4, drink("water")); run(10);
assert.equal(s.m.getProgress(0), 0); assert.equal(s.m.tanks[1].get(), 1000);
s.m.energy.add(1); run(2); s.items.set(4, drink("awkward")); tick(); assert.equal(s.m.getProgress(0), 0);
s.items.set(4, drink("water")); run(2); s.items.set(3, new ItemStack("minecraft:glowstone_dust")); tick(); assert.equal(s.m.getProgress(0), 100);
unsupported = true; run(3); assert.equal(s.m.energy.get(), 12000); assert.equal(s.m.tanks[1].get(), 1000); unsupported = false;
tick(); assert.equal(readPotion(s.items.get(4)).family, "thick");

// Independent upgrade transactions cannot overspend shared fluid or energy.
s = setup(32000, 1749); s.items.set(S.amplify, createPotion({ family: "strength", level: 1, extent: "long", form: "splash" }));
s.items.set(S.extend, drink("haste")); request("amplify"); request("extend"); run(2);
assert.equal(s.m.tanks[0].get(), 749); assert.equal(s.m.energy.get(), 16000);
assert.equal(readPotion(s.items.get(S.amplify)).level, 2); assert.equal(readPotion(s.items.get(S.amplify)).form, "splash");
assert.equal(potionEffects(readPotion(s.items.get(S.amplify)))[0].duration, 480);
assert.equal(readPotion(s.items.get(S.extend)).extent, "normal"); s.m.tanks[0].add(1); run(2);
assert.equal(s.m.tanks[0].get(), 0); assert.equal(s.m.energy.get(), 0); assert.equal(readPotion(s.items.get(S.extend)).extent, "long");
s.m.energy.add(100000); s.m.tanks[0].add(10000); run(10); assert.equal(readPotion(s.items.get(S.amplify)).level, 2);
request("amplify"); tick(); s.items.set(S.amplify, drink("haste")); run(3); assert.equal(readPotion(s.items.get(S.amplify)).level, 1);
assert.equal(s.m.tanks[0].get(), 10000);

// Instant potions cannot be extended; maximum/no-level effects are rejected.
s = setup(); s.items.set(S.extend, drink("healing")); request("extend"); run(3); assert.equal(s.m.tanks[0].get(), 10000);
s.items.set(S.amplify, drink("fire_resistance")); request("amplify"); run(3); assert.equal(s.m.tanks[0].get(), 10000);

// Dragon's Breath returns exactly one bottle and refuses a blocked return slot.
s = setup(); s.items.set(3, new ItemStack("minecraft:dragon_breath", 2)); s.items.set(4, createPotion(splash)); s.items.set(33, new ItemStack("minecraft:stone"));
run(8); assert.equal(s.items.get(3).amount, 2); assert.equal(s.m.energy.get(), 200000);
s.items.delete(33); run(4); assert.equal(s.items.get(3).amount, 1); assert.equal(s.items.get(33).typeId, "minecraft:glass_bottle");
assert.equal(readPotion(s.items.get(4)).duration, 90);

// Blaze loading respects the separate reservoir and retains excess powder.
s = setup(0, 0, 0); s.items.set(S.fuel, new ItemStack("minecraft:blaze_powder", 64)); tick();
assert.equal(s.m.tanks[1].get(), 64000); assert(!s.items.has(S.fuel));
s.items.set(S.fuel, new ItemStack("minecraft:blaze_powder", 2)); tick(); assert.equal(s.items.get(S.fuel).amount, 2);
assert.deepEqual(Array.from(io.liquids.anyInputIndices), [0]);
assert.deepEqual(Array.from(io.items.anyOutputSlots), [33]);
assert.equal(planBrewingBatch([{ slot: 4, potion: null }], "minecraft:sugar"), null);

await load(itemPath);
const drinkComponent = itemComponents.get(ALCHEMY_POTION_COMPONENTS.drink);
const throwableComponent = itemComponents.get(ALCHEMY_POTION_COMPONENTS.throwable);
assert.equal(itemComponents.size, 2);
assert.equal(typeof drinkComponent.onConsume, "function");
assert.equal(drinkComponent.onUse, undefined);
// Splash and lingering items have no food component, so registering onConsume rejects them.
assert.equal(throwableComponent.onConsume, undefined);
assert.equal(typeof throwableComponent.onUse, "function");
let effects = [], healed = 0, damage = 0;
const health = { currentValue: 1, effectiveMax: 20, setCurrentValue(v) { healed = v; } };
const target = { matches: () => false, getComponent: () => health, applyDamage: n => { damage = n; }, addEffect: (id, ticks, options) => effects.push({ id, ticks, options }) };
drinkComponent.onConsume({ source: target, itemStack: createPotion({ family: "haste", level: 3, extent: "maximum", form: "drink" }) });
assert.equal(effects[0].id, "haste"); assert.equal(effects[0].ticks, 38400); assert.equal(effects[0].options.amplifier, 2);
const { applyPotion } = module(itemPath).namespace;
applyPotion(target, { family: "healing", level: 3, extent: "normal", form: "drink" }); assert.equal(healed, 17);
target.matches = () => true; applyPotion(target, { family: "healing", level: 3, extent: "normal", form: "splash" }, 0.5); assert.equal(damage, 12);
effects = []; applyPotion(target, { family: "strength", level: 2, extent: "long", form: "lingering" }, 0.25); assert.equal(effects[0].ticks, 2400);
for (const family of POTION_FAMILIES.filter(f => f.statsCore)) {
    statsEffects.length = 0; effects = [];
    applyPotion(target, { family: family.id, level: 3, extent: "long", form: "lingering" }, 0.25);
    assert.equal(effects.length, 0, family.id + ': custom status is never a native addEffect');
    assert.equal(statsEffects.length, 1);
    assert.equal(statsEffects[0].id, family.effect); assert.equal(statsEffects[0].level, 3);
    assert.equal(statsEffects[0].ticks, family.long * 5, family.id + ': lingering quarter duration');
}

// Real item callbacks and impact handlers: consume on a successful throw only,
// apply a splash once, and preserve the lingering payload through the cloud lifecycle.
const spawned = [], thrownInventory = new Map();
let failShot = false;
target.id = "target"; target.location = { x: 2, y: 0, z: 0 }; target.hasComponent = () => true;
const dimension = {
    playSound() {}, spawnParticle() {}, getEntities() { return [target]; },
    spawnEntity(typeId, location) {
        const properties = new Map();
        const entity = { id: String(spawned.length), typeId, location: { ...location }, dimension, isValid: true,
            getDynamicProperty: k => properties.get(k), setDynamicProperty: (k, v) => properties.set(k, v),
            remove() { this.isValid = false; }, getComponent() { return { shoot() { if (failShot) throw Error("Shot failed"); } }; } };
        spawned.push(entity); return entity;
    },
};
const player = { selectedSlotIndex: 0, dimension, getGameMode: () => "Survival", getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
    getHeadLocation: () => ({ x: 0, y: 0, z: 0 }), getComponent: () => ({ container: {
        getItem: slot => thrownInventory.get(slot)?.clone(), setItem: (slot, item) => item ? thrownInventory.set(slot, item.clone()) : thrownInventory.delete(slot),
    } }) };
let thrown = createPotion({ family: "haste", level: 3, extent: "long", form: "splash" });
thrownInventory.set(0, thrown); throwableComponent.onUse({ source: player, itemStack: thrown }); assert(!thrownInventory.has(0));
const projectile = spawned.at(-1); projectile.location = { x: 0, y: 0, z: 0 }; effects = [];
handlers.projectileHitBlock({ projectile }); assert.equal(effects.length, 1); assert.equal(effects[0].ticks, 4800);
handlers.projectileHitBlock({ projectile }); assert.equal(effects.length, 1); assert(!projectile.isValid);
thrownInventory.set(0, thrown); failShot = true;
assert.throws(() => throwableComponent.onUse({ source: player, itemStack: thrown }), /Shot failed/);
assert(thrownInventory.has(0)); assert(!spawned.at(-1).isValid); failShot = false;
const countBeforeMismatch = spawned.length;
thrownInventory.set(0, drink("healing")); throwableComponent.onUse({ source: player, itemStack: thrown }); assert.equal(spawned.length, countBeforeMismatch);
thrown = createPotion({ family: "haste", level: 2, extent: "long", form: "lingering" });
thrownInventory.set(0, thrown); throwableComponent.onUse({ source: player, itemStack: thrown });
const lingeringProjectile = spawned.at(-1); lingeringProjectile.location = { x: 0, y: 0, z: 0 };
handlers.projectileHitBlock({ projectile: lingeringProjectile }); const cloud = spawned.at(-1);
effects = []; handlers.cloudTick(); assert.equal(effects[0].ticks, 2400); assert.equal(effects[0].options.amplifier, 1);
system.currentTick = 10; handlers.cloudTick(); assert.equal(effects.length, 1);
system.currentTick = 20; handlers.cloudTick(); assert.equal(effects.length, 2);
cloud.setDynamicProperty("ascendant:cloud_life", 1); handlers.cloudTick(); assert(!cloud.isValid);

// Build the real pack entry to catch dependency/linking failures beyond the mocked machine.
await build({ entryPoints: [fileURLToPath(new URL("BP/scripts/main.js", root))], bundle: true, write: false,
    platform: "neutral", format: "esm", external: ["@minecraft/server", "@minecraft/server-ui"], absWorkingDir: fileURLToPath(root),
    nodePaths: [fileURLToPath(new URL("BP/scripts/", root))], logLevel: "silent" });
console.log(`PASS: ${POTION_FAMILIES.length} families, ${Object.keys(CUSTOM_POTIONS).length} variants; six-bottle/partial batches, atomic costs, input replacement, split upgrades, native II/IV/live durations, conversions, bottle returns, fuel capacity, separate consume/throw components, drinking/throw failure/splash/cloud callbacks and full entry bundle.`);

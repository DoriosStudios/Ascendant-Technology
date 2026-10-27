import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Focused behavior tests; no pack/JSON audits and no Minecraft runtime claims.
const signals = new Map();
const signal = name => {
    if (!signals.has(name)) signals.set(name, []);
    return { subscribe(fn) { signals.get(name).push(fn); } };
};
function emit(name, event) { for (const fn of signals.get(name) ?? []) fn(event); }
const deferred = [];
const intervals = [];
const system = { currentTick: 0, run: fn => deferred.push(fn), runTimeout: fn => deferred.push(fn), runInterval: fn => intervals.push(fn), clearRun: id => { intervals[id - 1] = undefined; } };
function flush() { while (deferred.length) deferred.shift()(); }
const properties = new Map();
const entities = new Map();
const world = {
    getDynamicProperty: key => properties.get(key),
    setDynamicProperty: (key, value) => value === undefined ? properties.delete(key) : properties.set(key, value),
    getEntity: id => entities.get(id),
    afterEvents: new Proxy({}, { get: (_, name) => signal(name) }),
    beforeEvents: new Proxy({}, { get: (_, name) => signal(`before:${name}`) }),
};
let nextEntity = 0;
class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId; this.amount = amount; this.lore = []; this.props = new Map();
        this.durability = { damage: 0, maxDurability: 2000 }; this.enchants = [];
        this.keepOnDeath = false; this.lockMode = "none";
    }
    clone() { const copy = new ItemStack(this.typeId, this.amount); Object.assign(copy, this); copy.props = new Map(this.props); copy.lore = [...this.lore]; copy.durability = { ...this.durability }; copy.enchants = this.enchants.map(e => ({ ...e })); return copy; }
    getLore() { return this.lore; } setLore(lore) { this.lore = lore; }
    getDynamicPropertyIds() { return [...this.props.keys()]; }
    getDynamicProperty(key) { return this.props.get(key); } setDynamicProperty(key, value) { this.props.set(key, value); }
    getCanDestroy() { return []; } getCanPlaceOn() { return []; } setCanDestroy() {} setCanPlaceOn() {}
    getComponent(id) {
        if (id.endsWith("durability")) return this.durability;
        if (id.endsWith("enchantable")) return {
            getEnchantments: () => this.enchants,
            getEnchantment: key => this.enchants.find(e => e.type.id === key),
            addEnchantment: e => this.enchants.push(e),
        };
    }
}
class FakeEntity {
    constructor(typeId, dimension, location) {
        this.id = `e${++nextEntity}`; this.typeId = typeId; this.dimension = dimension;
        this.location = { ...location }; this.isValid = true; this.props = new Map(); this.health = 1000;
        this.tags = new Set(); this.families = []; this.equipment = undefined; this.damageLog = [];
        entities.set(this.id, this);
    }
    getComponent(id) {
        if (id.endsWith("equippable")) return { getEquipment: slot => slot === "Mainhand" ? this.equipment?.clone() : undefined, setEquipment: (_, item) => { this.equipment = item?.clone(); return true; } };
        if (id.endsWith("health")) return { currentValue: this.health, effectiveMax: this.maxHealth ?? this.health };
        if (id.endsWith("is_baby")) return this.baby ? {} : undefined;
        if (id.endsWith("variant")) return this.variant === undefined ? undefined : { value: this.variant };
    }
    getDynamicProperty(key) { return this.props.get(key); } setDynamicProperty(key, value) { this.props.set(key, value); }
    matches(query) { return query.families?.some(f => this.families.includes(f)) ?? false; }
    addTag(tag) { this.tags.add(tag); } removeTag(tag) { this.tags.delete(tag); } hasTag(tag) { return this.tags.has(tag); }
    triggerEvent(event) { this.lastEvent = event; }
    teleport(at, options = {}) { this.location = { ...at }; this.dimension = options.dimension ?? this.dimension; }
    clearVelocity() {} remove() { this.isValid = false; }
    setOnFire() {} applyKnockback() {}
    applyDamage(amount, damageSource) {
        const event = { hurtEntity: this, damageSource, damage: amount, cancel: false };
        emit("before:entityHurt", event);
        if (event.cancel) return false;
        amount = event.damage;
        this.damageLog.push({ amount, damageSource }); this.health -= amount;
        emit("entityHurt", { hurtEntity: this, damageSource });
        if (this.health <= 0) { emit("entityDie", { deadEntity: this, damageSource }); this.isValid = false; }
        return true;
    }
}
const dimensions = new Map();
function makeDimension(id) {
    const dimension = {
        id, drops: [], queries: [],
        spawnEntity(type, location) { return new FakeEntity(type, this, location); },
        spawnItem(item) { this.drops.push(item); },
        getBlock() { return {}; },
        getEntities(query) {
            this.queries.push(query);
            return [...entities.values()].filter(e => e.isValid && e.dimension === this)
                .filter(e => !query.type || e.typeId === query.type)
                .filter(e => !query.excludeTypes?.includes(e.typeId))
                .filter(e => !query.excludeFamilies?.some(f => e.families.includes(f)))
                .filter(e => Math.hypot(e.location.x - query.location.x, e.location.y - query.location.y, e.location.z - query.location.z) <= query.maxDistance);
        },
        getPlayers(query = {}) { return [...entities.values()].filter(e => e.typeId === "minecraft:player" && e.dimension === this && e.isValid)
            .filter(e => !query.location || !query.maxDistance || Math.hypot(e.location.x - query.location.x, e.location.y - query.location.y, e.location.z - query.location.z) <= query.maxDistance); },
    };
    dimensions.set(id, dimension); return dimension;
}
function makeBlock(dimension, x = 0) {
    let on = true;
    return {
        typeId: "utilitycraft:mob_slasher", isValid: true, dimension, location: { x, y: 0, z: 0 },
        center() { return { x: x + 0.5, y: 0.5, z: 0.5 }; },
        get permutation() { return { getState: () => on, withState: (_, value) => ({ value }) }; },
        setPermutation(permutation) { on = permutation.value; },
    };
}
const responses = [];
const shownForms = [];
const keyOf = label => label?.translate?.endsWith(".menu_entry") ? keyOf(label.with.rawtext[0])
    : label?.rawtext ? keyOf(label.rawtext[0]) : label?.translate?.split(".").at(-1);
class Form {
    constructor() { this.controls = []; this.buttons = []; }
    title(value) { this.titleText = value; return this; }
    body(value) { this.bodyText = value; return this; }
    submitButton(value) { this.submitText = value; return this; }
    button(label, icon) { this.buttons.push({ label, icon }); return this; }
    toggle(label, options = {}) { this.controls.push({ label, value: options.defaultValue ?? false, options }); return this; }
    dropdown(label, items, options = {}) { this.controls.push({ label, value: options.defaultValueIndex ?? 0, items, options }); return this; }
    textField(label, placeholder, options = {}) { this.controls.push({ label, value: options.defaultValue ?? "", placeholder, options }); return this; }
    control(key) { return this.controls.find(c => keyOf(c.label) === key); }
    set(key, value) { this.control(key).value = value; }
    choose(key) {
        const selection = this.buttons.findIndex(b => keyOf(b.label) === key);
        assert.notEqual(selection, -1, `button ${key}`);
        return { canceled: false, selection };
    }
    submit() { return { canceled: false, formValues: this.controls.map(c => c.value) }; }
    async show() {
        shownForms.push(this);
        const response = responses.shift();
        return (typeof response === "function" ? await response(this) : response) ?? { canceled: true };
    }
}
const choose = key => form => form.choose(key);
let component;
const context = vm.createContext({ console, Math, Map, Set, WeakMap });
const cache = new Map();
function synthetic(key, values) {
    const module = new vm.SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context, identifier: key });
    cache.set(key, module); return module;
}
synthetic("@minecraft/server", { world, system, ItemStack, EnchantmentTypes: { get: id => ({ id }) }, EntityDamageCause: { entityAttack: "entityAttack" } });
synthetic("@minecraft/server-ui", { ActionFormData: Form, ModalFormData: Form, FormCancelationReason: { UserBusy: "UserBusy" } });
synthetic("DoriosLib/index.js", { registry: { blockComponent: (_, value) => { component = value; } } });
const registryPath = path.resolve("BP/scripts/ATCore/StatsCore/core/registry.js");
synthetic(registryPath, { getStatsCoreDefinition: stack => /sword|bow|axe/.test(stack?.typeId ?? "") ? { type: "weapon" } : undefined });
const contextCachePath = path.resolve("BP/scripts/ATCore/StatsCore/shared/contextCache.js");
synthetic(contextCachePath, { invalidateEquipmentContextCache() {} });
async function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const module = new vm.SourceTextModule(fs.readFileSync(absolute, "utf8"), { context, identifier: absolute });
    cache.set(absolute, module);
    return module;
}
async function exportsOf(file) {
    const module = await load(file);
    if (module.status === "unlinked") await module.link(async (name, parent) => cache.get(name) ?? load(path.resolve(path.dirname(parent.identifier), name)));
    if (module.status !== "evaluated") await module.evaluate();
    return module.namespace;
}
const stateApi = await exportsOf("BP/scripts/features/blocks/slasher/state.js");
const config = await exportsOf("BP/scripts/features/blocks/slasher/config.js");
const weapon = await exportsOf("BP/scripts/features/blocks/slasher/weapon.js");
const combat = await exportsOf("BP/scripts/features/blocks/slasher/combat.js");
const xp = await exportsOf("BP/scripts/features/blocks/slasher/xp.js");
const aggressors = await exportsOf("BP/scripts/ATCore/StatsCore/shared/aggressors.js");
const forms = await exportsOf("BP/scripts/features/blocks/slasher/forms.js");
await exportsOf("BP/scripts/features/blocks/mobSlasher.js");
const overworld = makeDimension("minecraft:overworld"), nether = makeDimension("minecraft:nether");
const block = makeBlock(overworld), state = stateApi.load(block);
assert.deepEqual(Array.from(config.RANGE), [0.5, 2, 3.5, 5, 6.5, 8, 9.5, 11, 12.5]);
for (let n = 0; n <= 16; n++) assert.equal(config.damageAt(n), 8 + 2 * n);
const sword = new ItemStack("minecraft:diamond_sword"); sword.nameTag = "Test"; sword.setLore(["refined"]);
sword.setDynamicProperty("statscore:test", "saved"); sword.durability.damage = 23; sword.enchants = [{ type: { id: "looting" }, level: 3 }];
const restored = weapon.deserializeWeapon(weapon.serializeWeapon(sword));
assert.equal(restored.nameTag, "Test"); assert.equal(restored.durability.damage, 23); assert.equal(restored.getDynamicProperty("statscore:test"), "saved"); assert.equal(restored.enchants[0].level, 3);
state.weapon = restored;
const victim = new FakeEntity("minecraft:zombie", overworld, block.center());
combat.attack(state, victim); flush();
assert.equal(victim.damageLog[0].amount, 15); assert.equal(state.weapon.durability.damage, 24);
assert.equal(victim.damageLog[0].damageSource.damagingEntity, undefined, "Slasher attacks without an executor or nearby player");
assert.equal(overworld.getPlayers().length, 0);
const secondBlock = makeBlock(nether, 10), second = stateApi.load(secondBlock); second.weapon = new ItemStack("minecraft:wooden_sword");
const victim2 = new FakeEntity("minecraft:zombie", nether, secondBlock.center()); combat.attack(second, victim2); flush();
assert.equal(victim2.damageLog[0].damageSource.damagingEntity, undefined);
assert.equal(properties.has("at:ms:executor"), false, "no executor is stored or spawned");
state.modules.storer = true; state.active.storer = true;
const kill = new FakeEntity("minecraft:zombie", overworld, block.center()); kill.health = 1; combat.attack(state, kill); flush();
assert.ok(state.xp === 2 || state.xp === 3, "5 native XP yields an additional 2 or 3 XP");
state.xp = config.XP_CAP; const fullVictim = new FakeEntity("minecraft:zombie", overworld, block.center()); combat.attack(state, fullVictim); assert.equal(fullVictim.damageLog.length, 0);
state.xp = 0;
const player = new FakeEntity("minecraft:player", overworld, block.center()); player.xp = 0; player.addExperience = n => { player.xp += n; }; player.sendMessage = () => {}; player.onScreenDisplay = { setActionBar() {} };
const playerHit = new FakeEntity("minecraft:zombie", overworld, block.center()); playerHit.applyDamage(1, { damagingEntity: player }); playerHit.health = 1; combat.attack(state, playerHit); flush();
assert.ok(state.xp === 2 || state.xp === 3, "bonus stays additional after a previous player hit");
assert.equal(playerHit.damageLog.at(-1).damageSource.damagingEntity, player, "nearby player gets native kill credit");
state.xp = 0;
const assisted = new FakeEntity("minecraft:zombie", overworld, block.center());
combat.attack(state, assisted);
assisted.applyDamage(2000, { cause: "entityAttack", damagingEntity: player }); flush();
assert.equal(state.xp, 0, "player finishing a nonfatal Slasher hit grants no machine bonus");
const custom = new FakeEntity("example:creature", overworld, block.center());
for (const [health, expected] of [[16, [2, 5]], [32, [4, 10]], [48, [6, 15]], [17, [4, 10]]]) {
    custom.maxHealth = health;
    assert.deepEqual(Array.from(xp.bonusXpRange(custom)), expected);
}
assert.deepEqual(Array.from(xp.bonusXpRange(new FakeEntity("minecraft:blaze", overworld, block.center()))), [5, 5]);
assert.deepEqual(Array.from(xp.bonusXpRange(new FakeEntity("minecraft:cow", overworld, block.center()))), [0.5, 1.5]);
const babyZombie = new FakeEntity("minecraft:zombie", overworld, block.center()); babyZombie.baby = true;
assert.deepEqual(Array.from(xp.bonusXpRange(babyZombie)), [6, 6]);
const gearedZombie = new FakeEntity("minecraft:zombie", overworld, block.center()); gearedZombie.equipment = new ItemStack("minecraft:iron_sword");
assert.deepEqual(Array.from(xp.bonusXpRange(gearedZombie)), [3, 4]);
assert.equal(xp.rollBonusXp(babyZombie, () => 0), 6);
assert.equal(xp.rollBonusXp(gearedZombie, () => 0), 3);
assert.equal(xp.rollBonusXp(new FakeEntity("minecraft:cow", overworld, block.center()), (() => { const values = [0, 0.75]; return () => values.shift(); })()), 0);
assert.equal(xp.rollBonusXp(new FakeEntity("minecraft:cow", overworld, block.center()), (() => { const values = [0, 0.25]; return () => values.shift(); })()), 1);
const noXp = new FakeEntity("minecraft:bat", overworld, block.center());
assert.deepEqual(Array.from(xp.bonusXpRange(noXp)), [0, 0]);
for (let i = 0; i < 10; i++) { player.equipment = new ItemStack("utilitycraft:range_upgrade"); component.onPlayerInteract({ block, player }); }
assert.equal(state.upgrades.range, 8); assert.equal(player.equipment.typeId, "utilitycraft:range_upgrade");
for (let i = 0; i < 18; i++) { player.equipment = new ItemStack("utilitycraft:damage_upgrade"); component.onPlayerInteract({ block, player }); }
assert.equal(state.upgrades.damage, 16);
for (const item of Object.keys(config.MODULES)) { player.equipment = new ItemStack(item); component.onPlayerInteract({ block, player }); }
assert.equal(state.modules.xpMagnet, true); assert.equal(state.modules.teleporter, true);
// Navigate the real standard-form flow; every modal is a draft until submitted.
const intervalsBefore = intervals.filter(Boolean).length;
responses.push(choose("modules"), choose("module_teleporter"), form => {
    form.set("direction", 2); form.set("distance", 8); return form.submit();
}, choose("module_xpMagnet"), form => {
    form.set("xp_offset_x", "4"); form.set("xp_offset_y", "2"); form.set("xp_offset_z", "-3");
    return form.submit();
});
await forms.openMain(player, state);
assert.equal(state.distance, 4); assert.deepEqual({ ...state.xpOffset }, { x: 4, y: 2, z: -3 });
responses.push(choose("modules"), choose("module_xpMagnet"), form => { form.set("xp_offset_x", "999"); });
await forms.openMain(player, state);
assert.equal(state.xpOffset.x, 4, "cancel discards draft values");
assert.equal(intervals.filter(Boolean).length, intervalsBefore, "standard forms need no refresh interval");
for (const input of ["NaN", "", "Infinity"]) {
    responses.push(choose("modules"), choose("module_xpMagnet"), form => {
        form.set("xp_offset_x", input); form.set("enabled", false); return form.submit();
    });
    await forms.openMain(player, state);
    assert.equal(state.active.xpMagnet, true, "invalid XYZ must not partially save the toggle");
    assert.equal(state.xpOffset.x, 4);
}
responses.push(choose("settings"), form => {
    form.set("damage", 0); state.revision++; return form.submit();
});
await forms.openMain(player, state);
assert.equal(state.damage, undefined, "stale response cannot overwrite settings");
responses.push(choose("settings"), form => {
    assert.equal(form.control("damage").items.length, 17);
    assert.equal(form.control("range").items.length, 9);
    form.set("damage", 3); return form.submit();
});
await forms.openMain(player, state);
assert.equal(state.damage, 3);
responses.push(choose("settings"), form => { form.set("damage", 16); return form.submit(); });
await forms.openMain(player, state);
assert.equal(state.damage, undefined, "highest selection follows installed upgrades");
responses.push(choose("filters"), form => {
    form.set("filter_ids", "minecraft:zombie, minecraft:zombie"); form.set("filter_mode", 1); return form.submit();
});
await forms.openMain(player, state);
assert.deepEqual(Array.from(state.filter), ["minecraft:zombie"]);
responses.push(choose("filters"), form => { form.set("filter_ids", "invalid"); return form.submit(); });
await forms.openMain(player, state);
assert.deepEqual(Array.from(state.filter), ["minecraft:zombie"], "invalid filter preserves previous entries");
state.filter = []; state.filterMode = "blacklist";
state.xp = 150;
responses.push(choose("xp_menu"), choose("xp_withdraw"), choose("xp_withdraw"));
await forms.openMain(player, state);
assert.equal(state.xp, 0); assert.equal(player.xp, 150, "repeated withdrawals use current balance");
player.xp = 0;
responses.push({ canceled: true, cancelationReason: "UserBusy" });
await forms.openMain(player, state);
responses.push(async form => {
    const count = shownForms.length;
    await forms.openMain(player, state);
    assert.equal(shownForms.length, count, "only one menu session per player");
    return form.choose("close");
});
await forms.openMain(player, state);
assert.equal(intervals.filter(Boolean).length, intervalsBefore);

// Translate exactly the RawMessage shape sent to the client, including nested item names.
const langFiles = fs.readdirSync("RP/texts").filter(file => file.endsWith(".lang"));
const translations = new Map();
for (const file of langFiles) {
    const rows = fs.readFileSync(`RP/texts/${file}`, "utf8").split(/\r?\n/).filter(line => line.startsWith("ui.utilitycraft.mob_slasher."));
    const entries = Object.fromEntries(rows.map(row => { const i = row.indexOf("="); return [row.slice(0, i), row.slice(i + 1)]; }));
    assert.equal(rows.length, Object.keys(entries).length, `${file}: no duplicate Slasher keys`);
    translations.set(file, entries);
}
const english = translations.get("en_US.lang");
for (const [file, entries] of translations) {
    assert.deepEqual(Object.keys(entries).sort(), Object.keys(english).sort(), `${file}: complete translation`);
    for (const [key, value] of Object.entries(entries)) {
        assert.equal((value.match(/%s/g) ?? []).length, (english[key].match(/%s/g) ?? []).length, `${file}: ${key} placeholders`);
        assert.equal(/%[1-9]/.test(value), false, `${file}: no invalid positional placeholders`);
    }
}
function render(message) {
    if (typeof message !== "object") return String(message);
    if (message.with !== undefined) {
        const substitutions = Array.isArray(message.with) ? message.with : message.with.rawtext;
        assert.ok(Array.isArray(substitutions) && substitutions.length > 0, "RawMessage.with must not be empty (Bedrock serializes it as {})");
    }
    if (message.text !== undefined) return message.text;
    if (message.rawtext) return message.rawtext.map(render).join("");
    const template = english[message.translate];
    if (!template) { assert.ok(!message.translate.startsWith("ui.utilitycraft.mob_slasher."), message.translate); return message.translate; }
    const args = message.with?.rawtext?.map(render) ?? message.with ?? [];
    let index = 0;
    const result = template.replace(/%s/g, () => { assert.ok(index < args.length, message.translate); return args[index++]; });
    assert.equal(index, args.length, `${message.translate}: substitution count`);
    return result;
}
for (const form of shownForms) {
    render(form.titleText);
    if (form.bodyText) render(form.bodyText);
    for (const button of form.buttons) render(button.label);
    for (const control of form.controls) { render(control.label); for (const item of control.items ?? []) render(item); if (control.options.tooltip) render(control.options.tooltip); }
}
state.block.setPermutation({ value: false });
responses.push(choose("modules"), form => { assert.match(render(form.buttons[1].label), /Paused: machine off/); });
await forms.openMain(player, state);
state.block.setPermutation({ value: true });
state.active.xpMagnet = false;
responses.push(choose("modules"), form => { assert.match(render(form.buttons[1].label), /Disabled/); });
await forms.openMain(player, state);
state.active.xpMagnet = true;
state.modules.xpMagnet = false;
responses.push(choose("modules"), choose("module_xpMagnet"), form => {
    assert.equal(form.controls.length, 0, "locked module cannot expose settings");
    assert.match(render(form.bodyText), /utilitycraft:xp_magnet/);
});
await forms.openMain(player, state);
state.modules.xpMagnet = true;
// Error reporting must neither repeat the empty-with bug nor reject openMain.
const originalConsole = context.console;
const warnings = [];
context.console = { ...console, warn: (...args) => warnings.push(args) };
let notification;
player.sendMessage = message => { notification = message; };
responses.push(() => { throw new Error("Simulated form failure"); });
await forms.openMain(player, state);
assert.equal(notification.translate, "ui.utilitycraft.mob_slasher.error");
assert.equal(Object.hasOwn(notification, "with"), false);
render(notification);
player.sendMessage = () => { throw new Error("Simulated disconnected player"); };
responses.push(() => { throw new Error("Simulated form failure"); });
await forms.openMain(player, state);
assert.equal(warnings.length, 3, "both the form and notification errors are contained");
player.sendMessage = () => {};
context.console = originalConsole;
const countAfterError = shownForms.length;
responses.push(choose("close"));
await forms.openMain(player, state);
assert.equal(shownForms.length, countAfterError + 1, "failed notifications still release the menu session");
console.log("PASS: standard form navigation, cancel/stale/busy guards, module states, atomic XYZ validation, filter validation, current XP withdrawals, translation coverage and RawMessage substitutions.");

state.nextAttack = Infinity; state.nextMagnet = Infinity;
const orb = new FakeEntity("minecraft:xp_orb", overworld, { x: 0, y: 0, z: 0 });
const item = new FakeEntity("minecraft:item", overworld, { x: 0, y: 0, z: 0 });
system.currentTick += 20; component.onTick({ block }); flush();
assert.deepEqual(orb.location, { x: 4.5, y: 2.5, z: -2.5 }); assert.deepEqual(item.location, { x: 4.5, y: 0.5, z: 0.5 });
stateApi.save(state); stateApi.states.delete(state.key); const reloaded = stateApi.load(block);
assert.equal(reloaded.weapon.typeId, "minecraft:diamond_sword"); assert.equal(reloaded.upgrades.range, 8); assert.equal(reloaded.xpOffset.z, -3);
// Oversized equipment records use independently bounded parts and round-trip exactly.
reloaded.weapon.setDynamicProperty("large", "漢".repeat(18000)); stateApi.save(reloaded);
assert.ok([...properties.keys()].some(key => key.includes(":part:")));
stateApi.states.delete(reloaded.key); const largeReload = stateApi.load(block);
assert.equal(largeReload.weapon.getDynamicProperty("large").length, 18000);
largeReload.weapon.setDynamicProperty("large", "small"); stateApi.save(largeReload);
assert.equal([...properties.keys()].some(key => key.includes(":part:")), false);
largeReload.xp = 123; stateApi.save(largeReload);
component.onBreak({ block }); component.onPlayerBreak({ block, player }); flush();
assert.equal(player.xp, 123); assert.equal(overworld.drops.filter(i => i.typeId === "minecraft:diamond_sword").length, 1);
assert.equal(overworld.drops.filter(i => i.typeId === "utilitycraft:range_upgrade")[0].amount, 8);
assert.equal(properties.has(`at:ms:${reloaded.key}`), false);
assert.equal(aggressors.isEligibleAggressor({ typeId: "minecraft:player" }), true);
assert.equal(aggressors.isEligibleAggressor({ typeId: "minecraft:zombie" }), false);

// Exercise the actual StatsCore combat handlers with controlled attribute rolls.
const statsPath = file => path.resolve("BP/scripts/ATCore/StatsCore", file);
const effectCalls = [];
const definition = { type: "weapon", limits: { maxDamageMultiplier: 10 } };
const attributes = { refinement: { active: true }, flatDamageBonus: 2, damageMultiplier: 1, effects: [], elemental: [] };
const readContext = (entity, slot = "Mainhand", expected) => {
    const stack = entity.getComponent("equippable")?.getEquipment(slot);
    return stack && (!expected || expected === stack.typeId) ? { stack, definition, attributes, slotName: slot } : null;
};
synthetic(statsPath("shared/context.js"), { getEquipmentStatsContext: readContext });
synthetic(statsPath("progression/refinement.js"), {
    getProgressAmount: () => 1,
    grantStatsProgress: stack => { stack.setDynamicProperty("test:combat_xp", (stack.getDynamicProperty("test:combat_xp") ?? 0) + 1); return { changed: true }; },
});
synthetic(statsPath("feedback/index.js"), { showAbilityFeedback() {}, showCombatFeedback() {}, showLevelUp() {} });
synthetic(statsPath("combat/effects.js"), {
    applyCombatEffects: ({ attacker }) => { effectCalls.push(attacker.id); return { elemental: [], abilities: [] }; },
    applyBlessingCurse() {}, applyPreparedBlessing() {}, getMarkedDamageBonus: () => 0,
    isProcDamageTarget: () => false, prepareBlessingForHit: () => null,
});
synthetic(statsPath("combat/crit.js"), { rollStatsCrit: () => ({ active: false }), rememberCombatContact() {} });
synthetic(statsPath("combat/penetration.js"), { applyArmorPenetration: ({ damage }) => ({ damage }) });
synthetic(statsPath("combat/lifesteal.js"), { applyLifeSteal: () => 0 });
synthetic(statsPath("shared/effects.js"), { applyEffectById() {} });
synthetic(statsPath("effects/index.js"), { getStatsCoreEffect: () => undefined, getStatsCoreEffects: () => [], upsertStatsCoreEffect() {} });
synthetic(statsPath("shared/durability.js"), { rollToolPreserving: () => false });
const actualCombat = await exportsOf("BP/scripts/ATCore/StatsCore/combat/index.js");
actualCombat.initializeCombatModule();
const blockA = makeBlock(overworld, 100), blockB = makeBlock(overworld, 110);
const stateA = stateApi.load(blockA), stateB = stateApi.load(blockB);
stateA.weapon = new ItemStack("minecraft:diamond_sword"); stateB.weapon = new ItemStack("minecraft:wooden_sword");
const targetA = new FakeEntity("minecraft:zombie", overworld, blockA.center());
const targetB = new FakeEntity("minecraft:zombie", overworld, blockB.center());
combat.attack(stateA, targetA); combat.attack(stateB, targetB); flush();
assert.equal(targetA.damageLog[0].amount, 17); assert.equal(targetB.damageLog[0].amount, 14);
assert.equal(targetA.damageLog[0].damageSource.damagingEntity, undefined);
assert.equal(stateA.weapon.getDynamicProperty("test:combat_xp"), 1);
assert.equal(stateB.weapon.getDynamicProperty("test:combat_xp"), 1);
assert.notEqual(effectCalls.at(-1), effectCalls.at(-2), "separate logical Slasher contexts");
player.equipment = new ItemStack("minecraft:diamond_sword");
const stateNear = stateApi.load(makeBlock(overworld, 1));
stateNear.weapon = new ItemStack("minecraft:wooden_sword");
const creditedVictim = new FakeEntity("minecraft:zombie", overworld, stateNear.block.center());
combat.attack(stateNear, creditedVictim); flush();
assert.equal(creditedVictim.damageLog[0].damageSource.damagingEntity, player);
assert.equal(creditedVictim.damageLog[0].amount, 14);
assert.equal(stateNear.weapon.getDynamicProperty("test:combat_xp"), 1, "StatsCore uses stored weapon");
assert.equal(player.equipment.getDynamicProperty("test:combat_xp"), undefined, "StatsCore does not mutate player's held weapon");
const normalVictim = new FakeEntity("minecraft:zombie", overworld, blockA.center());
normalVictim.applyDamage(7, { damagingEntity: player }); flush();
assert.equal(normalVictim.damageLog[0].amount, 9); assert.equal(player.equipment.getDynamicProperty("test:combat_xp"), 1);
const unlisted = new FakeEntity("minecraft:zombie", overworld, blockB.center()); unlisted.equipment = new ItemStack("minecraft:diamond_sword");
normalVictim.applyDamage(7, { damagingEntity: unlisted }); flush(); assert.equal(normalVictim.damageLog.at(-1).amount, 7);
console.log("PASS: damage/range caps, weapon persistence/durability, attacks without executor, Storer bonus ranges and health fallback, modules, XYZ XP destination, item destination, reload, refunds, and machine/player StatsCore paths.");

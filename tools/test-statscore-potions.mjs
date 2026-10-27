import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = new URL("../", import.meta.url);
const base = "BP/scripts/ATCore/StatsCore/";
const intervals = new Map(), pending = [], snapshots = [], native = [];
let nextRun = 1;
const system = { currentTick: 0, run(fn) { pending.push(fn); }, runInterval(fn, every) { const id = nextRun++; intervals.set(id, { fn, every }); return id; },
    clearRun(id) { intervals.delete(id); }, sendScriptEvent(id, message) { snapshots.push(JSON.parse(message)); },
    afterEvents: { scriptEventReceive: { subscribe() {} } } };
const world = { afterEvents: Object.fromEntries(["entityDie", "playerLeave", "playerSpawn", "worldLoad"].map(k => [k, { subscribe() {} }])) };
const stubs = {
    system, world, EntityDamageCause: { entityAttack: "entity_attack", override: "override" },
    EffectTypes: { get: id => id }, STATSCORE: { runtime: { markCleanupSize: 1000 } },
    getCurrentTick: () => system.currentTick, normalizeChance: n => Number(n) || 0, rollChance: () => true,
    applyAggressorDamage: (target, amount) => { target.health.currentValue -= amount; return true; },
    playActivationSound() {}, markStatsCoreOverrideDamage() {}, getEquipmentStatsContext() {}, resolveStatsAbilityName() {},
    HOT_ENTITY_TOKENS: [], COLD_ENTITY_TOKENS: [], DARK_RESISTANT_TOKENS: [], UNDEAD_ENTITY_TOKENS: [],
    SWEEP_ENTITY_CATEGORIES: [], SWEEP_EXCLUDED_ENTITY_TYPES: [], OFFENSIVE_ENTITY_CATEGORIES: [],
    ENTITY_CATEGORIES: { ally: "ally", passive: "passive" }, effectAppliesToEntity: () => true, getEntityCategory: () => "ally",
};
const context = vm.createContext({ console });
const stub = new vm.SyntheticModule(Object.keys(stubs), function () { for (const [key, value] of Object.entries(stubs)) this.setExport(key, value); }, { context });
const real = new Set(["effects/potions.js", "effects/state.js", "effects/catalog.js", "effects/index.js", "effects/insightBridge.js",
    "combat/effects.js", "shared/effects.js", "config/definitions.js", "config/values.js", "config/presentation.js", "config/equipmentTypes.js"]);
const modules = new Map();
function module(file) {
    if (!modules.has(file)) modules.set(file, new vm.SourceTextModule(readFileSync(new URL(base + file, root), "utf8"), { context, identifier: file }));
    return modules.get(file);
}
async function linker(specifier, source) {
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(source.identifier), specifier));
    return real.has(file) ? module(file) : stub;
}
const main = module("effects/potions.js"); await main.link(linker); await main.evaluate();
const { applyStatsCorePotionEffect: apply, applyStatsCorePotionDefense: defend, applyStatsCorePotionOffense: attack, collectStatsCorePotionSoul: collect } = main.namespace;
const state = module("effects/state.js").namespace;
state.initializeStatsCoreEffects();
function target(id, undead = false) {
    const health = { currentValue: 10, effectiveMax: 100, setCurrentValue(v) { this.currentValue = v; } };
    return { id, typeId: undead ? "minecraft:zombie" : "minecraft:player", health,
        matches: () => undead, getComponent: id => id === "minecraft:health" ? health : undefined,
        addEffect(id, ticks, options) { native.push({ target: this.id, id, ticks, ...options }); },
        dimension: { spawnParticle() {} }, location: { x: 0, y: 0, z: 0 } };
}
const flush = () => { while (pending.length) pending.shift()(); };
function advance(ticks) {
    for (let t = 0; t < ticks; t++) { system.currentTick++; for (const { fn, every } of [...intervals.values()]) if (system.currentTick % every === 0) fn(); flush(); }
}
const victim = target("victim"), attacker = target("attacker");
apply(victim, "marked", 100, 3);
let hit = { damage: 10 }; attack(hit, attacker, victim); assert.equal(hit.damage, 13);
apply(victim, "marked", 1000, 1); assert.equal(state.getStatsCoreEffect(victim, "marked", "alchemy").level, 3);

apply(victim, "adaptive_resilience", 100, 3);
hit = { damage: 10 }; defend(hit, victim, "entity_attack"); flush(); assert.equal(hit.damage, 9.1);
hit = { damage: 10 }; defend(hit, victim, "entity_attack"); flush(); assert(Math.abs(hit.damage - 8.2) < 1e-9);
hit = { damage: 10 }; defend(hit, victim, "fire"); flush(); assert.equal(hit.damage, 9.1);
assert.equal(state.getStatsCoreEffect(victim, "adaptive_resilience", "alchemy").expiresAtTick, 100);

state.upsertStatsCoreEffect(attacker, { id: "soul_collector", level: 5, durationTicks: 200, currentCharges: 5 });
apply(attacker, "soul_collector", 100, 2);
hit = { damage: 10 }; attack(hit, attacker, target("neutral")); flush(); assert.equal(hit.damage, 10, "Requires five collected souls");
for (let kill = 0; kill < 5; kill++) collect(attacker);
hit = { damage: 10 }; attack(hit, attacker, target("neutral")); flush(); assert.equal(hit.damage, 15); assert.equal(attacker.health.currentValue, 13.75);
hit = { damage: 10 }; attack(hit, attacker, target("neutral")); flush(); assert.equal(hit.damage, 10);
assert.equal(state.getStatsCoreEffect(attacker, "soul_collector").currentCharges, 5);
assert.equal(state.getStatsCoreEffect(attacker, "soul_collector", "alchemy").currentCharges, 0);
for (let kill = 0; kill < 5; kill++) collect(attacker);
hit = { damage: 10 }; attack(hit, attacker, target("lethal-hit"));
collect(attacker); // Entity-death handling can precede the deferred heal.
flush(); assert.equal(hit.damage, 15); assert.equal(attacker.health.currentValue, 17.5);
assert.equal(state.getStatsCoreEffect(attacker, "soul_collector", "alchemy").currentCharges, 1);

const bleeding = target("bleeding"); apply(bleeding, "bleeding", 100, 3); apply(bleeding, "bleeding", 1000, 1);
assert.equal(state.getStatsCoreEffect(bleeding, "bleeding", "alchemy").level, 3);
advance(20); assert.equal(bleeding.health.currentValue, 7, "Actual combat bleed damage per second");

const blessed = target("blessed");
state.upsertStatsCoreEffect(blessed, { id: "blessed", durationTicks: 1000 });
apply(blessed, "blessed", 100, 2); assert.equal(blessed.health.currentValue, 26);
apply(blessed, "blessed", 25, 2); assert.equal(blessed.health.currentValue, 26, "Cloud refresh does not repeat instant healing");
assert.equal(state.getStatsCoreEffect(blessed, "blessed", "alchemy").expiresAtTick, 120);
const undead = target("undead", true); apply(undead, "blessed", 20, 1); advance(10); assert.equal(undead.health.currentValue, 2);

const cursed = target("cursed"); apply(cursed, "cursed", 40, 2);
assert.equal(native.find(e => e.target === "cursed" && e.id.endsWith("weakness")).amplifier, 3);
const berserk = target("berserk"); apply(berserk, "berserk", 40, 3);
assert.equal(native.find(e => e.target === "berserk").amplifier, 2);
hit = { damage: 10 }; attack(hit, berserk, target("neutral")); assert.equal(hit.damage, 13);
assert(snapshots.some(s => s.effects.some(e => e.id === "marked" && e.level === 3)), "Published StatsCore/Insight snapshot");

advance(90);
assert.equal(state.getStatsCoreEffect(victim, "marked", "alchemy"), undefined);
assert.equal(state.getStatsCoreEffect(victim, "adaptive_resilience", "alchemy"), undefined);
assert.equal(state.getStatsCoreEffect(blessed, "blessed", "alchemy"), undefined);
assert(state.getStatsCoreEffect(blessed, "blessed"), "Equipment Blessing survives potion expiration");
assert(state.getStatsCoreEffect(attacker, "soul_collector"), "Equipment charges survive potion expiration");
hit = { damage: 10 }; attack(hit, attacker, victim); defend(hit, victim, "entity_attack"); assert.equal(hit.damage, 10);
console.log("PASS: seven real StatsCore potion effects; levels, bleed ticks, Blessing/undead damage, curse, Berserk, adaptation, souls, weaker-dose protection, cloud refresh, expiration, Insight snapshots and equipment isolation.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { matchRecipe } from "./fixtures/catalyst-weaver-main-matcher.mjs";

const root = new URL("../", import.meta.url);
const catalogPath = "BP/scripts/config/recipes/catalystWeaver.js";
const stripImports = source => source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/^export /gm, "");
let receiver;
const library = {
    registry: { REGISTRATION_EVENT_IDS: { INFUSER_RECIPE: "test:infuser" } },
    text: { formatIdentifier: value => value },
};
const catalog = vm.createContext({
    system: { afterEvents: { scriptEventReceive: { subscribe: callback => { receiver = callback; } } } },
    DoriosLib: library,
});
vm.runInContext(stripImports(readFileSync(new URL(catalogPath, root), "utf8")), catalog);
let searches = 0;
const resolver = vm.createContext({
    DoriosLib: library,
    FluidStorage: { formatFluid: amount => `${amount / 1000} B` },
    createCatalystSignature: catalog.createCatalystSignature,
    getCatalystWeaverCandidates: catalog.getCatalystWeaverCandidates,
    getCatalystWeaverRecipeRevision: catalog.getCatalystWeaverRecipeRevision,
    getCatalystWeaverRecipe: (...args) => { searches++; return catalog.getCatalystWeaverRecipe(...args); },
});
vm.runInContext(stripImports(readFileSync(new URL("BP/scripts/features/machines/catalystWeaverResolver.js", root), "utf8")), resolver);

const definitions = vm.runInContext("catalystWeaverRecipeDefinitions", catalog);
const input = { typeId: "test:base", amount: 64 };
const stack = (typeId, amount = 1) => ({ typeId, amount });
const definition = (fluid, amount = 1, catalysts = [{ id: "test:a", amount: 2 }]) => ({
    input: { id: input.typeId, amount }, catalysts,
    output: { id: `test:${fluid ?? "dry"}`, amount: 1 },
    ...(fluid ? { fluid: { type: fluid, amount: 1000 } } : {}),
});
const register = payload => receiver({ id: "utilitycraft:register_catalyst_weaver_recipe", message: JSON.stringify(payload) });
register({ "test:lava": definition("lava", 2), "test:water": definition("water"), "test:dry": definition(undefined) });
let reads = 0;
let stacks = [stack("test:a", 1), stack("test:a", 1)];
const container = { getItem: slot => { reads++; return stacks[slot - 4]; } };
const resolve = (fluid = "water", base = input, id = "machine") => resolver.resolveCatalystWeaver(id, container, base, fluid);
let state = resolve();
assert.equal(state.recipe.id, "test:water", "fluid selects the compatible alternative");
assert.equal(state.hints, undefined, "closed UI builds no helper strings");
const hints = resolver.getCatalystWeaverHints("machine");
const firstSearches = searches;
for (let i = 0; i < 1000; i++) {
    assert.equal(resolve(), state);
    assert.equal(resolver.getCatalystWeaverHints("machine"), hints);
}
assert.equal(searches, firstSearches, "unchanged inventories perform zero additional recipe searches");
assert.equal(resolve("lava").recipe.id, "test:lava");
assert.equal(resolve("empty").recipe.id, "test:lava", "empty tank preserves registration priority");
assert.equal(resolve("water", { ...input, amount: 1 }).recipe.id, "test:water");
stacks = [stack("test:a")];
assert.equal(resolve().recipe, undefined, "insufficient catalysts cannot select a recipe");
assert(resolver.getCatalystWeaverHints("machine").some(section => section.title === "Insufficient Amount"));
stacks = [stack("test:a", 2), stack("test:extra")];
assert.equal(resolve().recipe, undefined, "unrelated catalysts reject exact matching");
stacks = [stack("test:a", 2)];
resolver.resolveCatalystWeaver("machine", container, undefined, "water");
assert.equal(resolver.getCatalystWeaverHints("machine").length, 0);
assert.equal(resolve().recipe.id, "test:water", "reinserting input restores resolution");
const beforeReplace = resolve().recipe;
register({ "test:water": { ...definition("water"), output: { id: "test:replacement", amount: 1 } } });
assert.notEqual(resolve().recipe, beforeReplace, "runtime replacement invalidates the machine cache");
assert.equal(resolve().recipe.output.id, "test:replacement");
register({ "test:lava": definition("water", 2) });
assert.equal(resolve().recipe.id, "test:lava", "replacement keeps the original priority");
register({ "test:lava": { ...definition("water"), input: { id: "test:moved", amount: 1 } } });
assert.equal(resolve().recipe.id, "test:water", "replacement removes the old index entry");
receiver({ id: "test:infuser", message: JSON.stringify({ "test:a|test:import": { output: "test:imported" } }) });
register({ "test:native": { ...definition(undefined, 1, [{ id: "test:a", amount: 1 }]), input: { id: "test:import", amount: 1 } } });
assert.equal(catalog.getCatalystWeaverRecipe("test:import", 1, new Map([["test:a", 1]])).id, "test:native", "native precedes an earlier Infuser import");
register({ "test:none": { ...definition(undefined, 1, []), input: { id: "test:empty", amount: 1 } } });
assert.equal(catalog.getCatalystWeaverRecipe("test:empty", 1, new Map()).id, "test:none");

// Compare directly against main's original matcher, including split stacks,
// wrong/empty fluids, quantity boundaries, extra catalysts and recipe collisions.
let comparisons = 0;
const all = [...new Set([...Object.values(definitions).map(recipe => recipe.input.id), input.typeId, "test:empty", "test:import"])];
for (const inputId of all) {
    const candidates = catalog.getCatalystWeaverCandidates(inputId);
    for (const recipe of candidates) {
        const required = recipe.catalysts.map(c => stack(c.id, c.amount));
        const split = required.flatMap(s => s.amount > 1 ? [stack(s.typeId, 1), stack(s.typeId, s.amount - 1)] : [s]);
        const variants = [[], required, split, required.map(s => stack(s.typeId, Math.max(0, s.amount - 1))), [...required, stack("test:extra")]];
        for (const items of variants) for (const amount of [0, 1, recipe.input.amount, 64]) for (const fluid of ["empty", "water", "lava", "wrong", recipe.fluid?.type ?? "empty"]) {
            const totals = new Map();
            for (const item of items) if (item.amount > 0) totals.set(item.typeId, (totals.get(item.typeId) ?? 0) + item.amount);
            const expected = matchRecipe(candidates, stack(inputId, amount), items, { getType: () => fluid });
            const actual = catalog.getCatalystWeaverRecipe(inputId, amount, totals, fluid);
            assert.equal(actual?.id, expected?.id, `${inputId}, ${amount}, ${fluid}`);
            comparisons++;
        }
    }
}
// Cache eviction must affect performance only, never recipe selection.
stacks = [stack("test:a", 2)];
for (let i = 0; i < 300; i++) resolve("water", input, `eviction:${i}`);
assert.equal(resolve().recipe.id, "test:water");
// Exercise the actual machine tick through consumption, output and pause paths.
let tick;
let rendered;
const properties = new Map([["ascendant:catalyst_weaver_layout", "fluid_ejection_v2"]]);
const inventory = new Map();
const entity = { id: "integration", getDynamicProperty: key => properties.get(key) };
let storedFluid = 3000;
let storedType = "water";
class Tank {
    get() { return storedFluid; }
    getType() { return storedType; }
    consume(amount) { storedFluid -= amount; }
    display() {}
    static formatFluid(amount) { return `${amount / 1000} B`; }
}
class ItemStack {
    constructor(typeId, amount = 1) { Object.assign(this, { typeId, amount, maxAmount: 64 }); }
}
const machine = {
    valid: true, entity, shouldUpdateUI: false,
    container: { size: 30, getItem: slot => inventory.get(slot), setItem: (slot, item) => inventory.set(slot, item) },
    processIO() {}, getProgress: () => properties.get("dorios:progress_0") ?? 0,
};
const runtime = vm.createContext({
    ItemStack, DoriosLib: library, FluidStorage: Tank,
    Machine: function () { return machine; },
    registerATMachine: (id, handlers) => { tick = handlers.onTick; },
    registerIOInterface() {}, registerFluidEjection() {},
    resolveCatalystWeaver: resolver.resolveCatalystWeaver,
    getCatalystWeaverHints: resolver.getCatalystWeaverHints,
    getCatalystWeaverCandidates: catalog.getCatalystWeaverCandidates,
    ensureMachineInventoryLayout: () => true,
    setDynamicNumber: (entity, key, value) => properties.set(key, value),
    setDynamicString: (entity, key, value) => properties.set(key, value),
    displayProgress() {}, setUiItem() {},
    renderStatus: (machine, active, title, sections) => { rendered = { active, title, sections }; },
    resourceCost: (machine, amount) => amount,
    advanceProcess: (machine, options) => ({ processCount: Math.min(1, options.maxCrafts), energyUsed: 1, progress: 0 }),
    commitProcess: (machine, result, slots, tanks, callback) => callback(),
});
vm.runInContext(stripImports(readFileSync(new URL("BP/scripts/features/machines/catalystWeaver.js", root), "utf8")), runtime);
register({ "test:integration": {
    ...definition("water"), input: { id: "test:integration_input", amount: 1 },
    output: { id: "test:result", amount: 1 },
} });
inventory.set(3, new ItemStack("test:integration_input", 3));
inventory.set(4, new ItemStack("test:a", 6));
const runTick = () => tick({ block: {} }, { params: { machine: { energy_cost: 3200 } } });
runTick();
assert.equal(inventory.get(3).amount, 2);
assert.equal(inventory.get(4).amount, 4);
assert.equal(inventory.get(16).amount, 1);
assert.equal(storedFluid, 2000);
assert.equal(rendered.active, true);
assert.equal(rendered.sections, undefined, "closed UI bypasses helpers in the real tick");
machine.shouldUpdateUI = true;
runTick();
assert.equal(inventory.get(16).amount, 2);
assert(rendered.sections.some(section => section.title === "Catalyst Fluid"));
storedType = "lava";
runTick();
assert.equal(inventory.get(16).amount, 2, "wrong fluid cannot craft");
assert.equal(rendered.active, false);
storedType = "water";
storedFluid = 500;
runTick();
assert.equal(inventory.get(16).amount, 2, "insufficient fluid cannot craft");
storedFluid = 1000;
inventory.set(16, new ItemStack("test:other"));
runTick();
assert.equal(rendered.title, "Output Conflict");
inventory.delete(16);
runTick();
assert.equal(inventory.get(3), undefined);
assert.equal(inventory.get(4), undefined);
assert.equal(storedFluid, 0);
runTick();
assert.equal(rendered.title, "Insert Base Item");
register({ "test:integration_empty": {
    ...definition(undefined, 1, []), input: { id: "test:integration_empty", amount: 1 },
} });
inventory.set(3, new ItemStack("test:integration_empty"));
inventory.delete(16);
runTick();
assert.equal(inventory.get(16).typeId, "test:dry", "recipes without catalysts are processable");
console.log(`PASS: ${comparisons} comparisons with main; cache reuse/invalidation, UI hints, live registration, priority, bounded eviction and actual machine tick paths.`);

if (process.argv.includes("--benchmark")) {
    const baseline = vm.createContext({ DoriosLib: library, system: { afterEvents: { scriptEventReceive: { subscribe() {} } } } });
    vm.runInContext(stripImports(execFileSync("git", ["show", `HEAD:${catalogPath}`], { encoding: "utf8" })), baseline);
    const recipe = Object.values(definitions)[0];
    const base = stack(recipe.input.id, 64);
    stacks = recipe.catalysts.map(c => stack(c.id, c.amount));
    const iterations = 20000;
    function oldTick() {
        const totals = new Map();
        for (let index = 0; index < 6; index++) {
            const item = container.getItem(index + 4);
            if (item) totals.set(item.typeId, (totals.get(item.typeId) ?? 0) + item.amount);
        }
        baseline.getCatalystWeaverRecipe(base.typeId, base.amount, totals);
    }
    function measure(callback) {
        for (let i = 0; i < 1000; i++) callback(i % 8);
        const start = performance.now();
        for (let i = 0; i < iterations; i++) for (let machine = 0; machine < 8; machine++) callback(machine);
        return performance.now() - start;
    }
    const oldMs = measure(oldTick);
    const stableMs = measure(id => resolve("empty", base, `bench:${id}`));
    const changingMs = measure(id => {
        if (id === 0) stacks[0].amount = stacks[0].amount === 63 ? 64 : 63;
        resolve("empty", base, `bench:${id}`);
    });
    console.log(`Node microbenchmark, 8 machines x ${iterations} iterations; excludes Bedrock API, crafting, UI rendering and other machines.`);
    console.log(`Previous resolver: ${oldMs.toFixed(1)} ms; cached/stable: ${stableMs.toFixed(1)} ms; changing amounts: ${changingMs.toFixed(1)} ms.`);
}

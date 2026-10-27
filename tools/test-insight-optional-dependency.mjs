import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../BP/scripts/ATCore/StatsCore/", import.meta.url);
async function fixture() {
    const sent = [], warnings = [], jobs = [], players = [];
    const signal = () => {
        const handlers = [];
        return { subscribe(fn) { handlers.push(fn); }, emit(value) { for (const fn of handlers) fn(value); } };
    };
    const events = { worldLoad: signal(), playerSpawn: signal() }, scriptEvents = signal();
    const system = {
        currentTick: 0, afterEvents: { scriptEventReceive: scriptEvents },
        run(fn) { jobs.push({ fn, at: system.currentTick + 1 }); },
        runTimeout(fn, delay) { jobs.push({ fn, at: system.currentTick + delay }); },
        sendScriptEvent(id, message) { sent.push({ id, payload: JSON.parse(message) }); },
    };
    const world = { afterEvents: events, getAllPlayers: () => players };
    const context = vm.createContext({ console: { warn: message => warnings.push(message) } });
    const server = new vm.SyntheticModule(["system", "world"], function () {
        this.setExport("system", system); this.setExport("world", world);
    }, { context });
    const modules = new Map();
    function load(name) {
        if (!modules.has(name)) modules.set(name, new vm.SourceTextModule(readFileSync(new URL(name, root), "utf8"), { context, identifier: name }));
        return modules.get(name);
    }
    const main = load("effects/insightBridge.js");
    await main.link(specifier => specifier === "@minecraft/server" ? server : load(`config/${specifier.split("/").at(-1)}`));
    await main.evaluate();
    const api = main.namespace;
    function advance(ticks) {
        const until = system.currentTick + ticks;
        while (jobs.some(job => job.at <= until)) {
            jobs.sort((a, b) => a.at - b.at);
            const job = jobs.shift(); system.currentTick = job.at; job.fn();
        }
        system.currentTick = until;
    }
    const player = id => ({ id, typeId: "minecraft:player", messages: [], sendMessage(message) { this.messages.push(message); } });
    return { api, sent, warnings, system, world, context, players, player, advance, scriptEvents,
        start() { events.worldLoad.emit(); advance(1); },
        ready(id = "insight:effects_ready_v1") { scriptEvents.emit({ id, message: "{}" }); },
    };
}

const missing = await fixture();
const first = missing.player("first"); missing.players.push(first);
missing.api.initializeStatsCoreEffectsBridge(); missing.api.initializeStatsCoreEffectsBridge();
missing.advance(200); assert.equal(missing.warnings.length, 0, "No warning before world load");
missing.start(); missing.advance(99); assert.equal(missing.warnings.length, 0);
missing.advance(1); assert.equal(missing.warnings.length, 1); assert.equal(first.messages.length, 1);
assert.equal(first.messages[0].translate, "at.integration.insight.missing");
assert.equal(missing.sent.filter(e => e.id === "insight:effects_discover_v1").length, 4, "Initial discovery plus three world-load attempts");
missing.world.afterEvents.worldLoad.emit(); missing.advance(200); assert.equal(missing.warnings.length, 1, "Startup is idempotent");
missing.world.afterEvents.playerSpawn.emit({ initialSpawn: true, player: first }); missing.advance(100);
assert.equal(first.messages.length, 1, "Warn only once per player per session");
const late = missing.player("late"); missing.world.afterEvents.playerSpawn.emit({ initialSpawn: true, player: late });
missing.advance(100); assert.equal(late.messages.length, 1, "Dedicated-server players joining after startup receive the warning");
const respawn = missing.player("respawn"); missing.world.afterEvents.playerSpawn.emit({ initialSpawn: false, player: respawn });
missing.advance(100); assert.equal(respawn.messages.length, 0);
missing.ready(); const afterReady = missing.player("after-ready");
missing.world.afterEvents.playerSpawn.emit({ initialSpawn: true, player: afterReady }); missing.advance(100);
assert.equal(afterReady.messages.length, 0, "Late readiness suppresses further missing-dependency messages");

for (const readyEvent of ["insight:effects_ready_v1", "insight:custom_effects_ready_v1"]) {
    const present = await fixture(); present.api.initializeStatsCoreEffectsBridge(); present.start();
    present.advance(80); present.ready(readyEvent); present.advance(20);
    assert.equal(present.warnings.length, 0); assert.equal(present.api.isInsightEffectsAvailable(), true);
    present.api.publishStatsCoreEffects(present.player("target"), [{ id: "marked", level: 2 }]);
    const payload = present.sent.at(-1);
    assert.equal(payload.id, readyEvent.replace("ready", "send"));
    assert.equal(payload.payload.namespace, "ascendant.statscore"); assert.equal(payload.payload.action, "replace");
    present.ready(); present.ready("insight:custom_effects_ready_v1");
    present.api.publishStatsCoreEffects(present.player("target"), []);
    assert.equal(present.sent.at(-1).id, "insight:effects_send_v1", "Legacy announcements cannot downgrade the modern bridge");
}

for (const key of ["effects", "customEffects"]) {
    const direct = await fixture(), calls = [];
    direct.context.DoriosAPI = { insight: { [key]: { replace: (...args) => { calls.push(args); return true; } } } };
    direct.api.initializeStatsCoreEffectsBridge(); direct.start(); direct.advance(100);
    assert.equal(direct.warnings.length, 0);
    direct.api.publishStatsCoreEffects(direct.player("api-target"), [{ id: "bleeding" }]);
    assert.equal(calls.length, 1); assert.equal(calls[0][2], "ascendant.statscore");
}
const wrongApi = await fixture(); wrongApi.context.DoriosAPI = { insight: { actionbarQueue: { send() {} } } };
wrongApi.api.initializeStatsCoreEffectsBridge(); wrongApi.start(); wrongApi.advance(100);
assert.equal(wrongApi.warnings.length, 1, "An actionbar-only API does not supply the custom-effects HUD");
const transportFailure = await fixture();
transportFailure.system.sendScriptEvent = () => { throw new Error("No event transport"); };
transportFailure.api.initializeStatsCoreEffectsBridge(); transportFailure.start(); transportFailure.advance(100);
assert.equal(transportFailure.warnings.length, 1, "Missing Insight never prevents startup");
console.log("PASS: optional Insight detection, startup grace/retries, modern/legacy/direct APIs, late readiness, localized once-per-session player warnings, dedicated-server joins and transport failure.");

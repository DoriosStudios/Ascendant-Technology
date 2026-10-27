import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the actual presentation pipeline without launching Bedrock or auditing JSON.
const root = new URL("../BP/scripts/ATCore/StatsCore/", import.meta.url);
const messages = [], sounds = [], events = [], scheduled = [];
let tick = 0, queueAvailable = false;
const properties = new Map();
const equipment = new Map();
const player = {
    id: "player", typeId: "minecraft:player", location: { x: 0, y: 0, z: 0 },
    getDynamicProperty: key => properties.get(key),
    setDynamicProperty: (key, value) => properties.set(key, value),
    playSound: id => sounds.push(id),
    dimension: { spawnParticle() {}, playSound() { throw Error("Feedback must not broadcast"); } },
};
const context = vm.createContext({
    CACHE_LIMITS: { feedbackPreferences: 128, feedbackCooldowns: 256 },
    INSIGHT_ACTIVITY_EVENT: "test:activity",
    STATSCORE: { runtime: { feedbackCooldownTicks: 12 },
        playerProperties: { feedbackStyle: "style", insightBridge: "bridge" },
        slots: { mainhand: "Mainhand", offhand: "Offhand", armor: ["Head", "Chest", "Legs", "Feet"] } },
    system: { runTimeout: (fn, delay) => scheduled.push({ fn, at: tick + delay }),
        sendScriptEvent: (id, payload) => events.push({ id, ...JSON.parse(payload) }) },
    getCurrentTick: () => tick,
    titleCaseIdentifier: value => String(value ?? ""),
    normalizeId: value => String(value ?? "").toLowerCase(),
    isInsightActionbarQueueAvailable: () => queueAvailable,
    setActionBarSafe: (_, message) => messages.push(message),
    getEquipmentStatsContext: (_, slot) => equipment.get(slot),
});
function load(file) {
    const source = readFileSync(new URL(file, root), "utf8")
        .replace(/^import[\s\S]*?;\r?\n/gm, "")
        .replace(/^export\s*\{[^}]*\}\s*from\s*[^;]+;\r?\n/gm, "")
        .replace(/^export /gm, "");
    vm.runInContext(source, context, { filename: file });
}
for (const file of ["config/presentation.js", "shared/effectSelectors.js", "core/abilities.js", "icons.js", "feedback/index.js"]) load(file);
const icons = vm.runInContext("STATSCORE_ICONS", context);
function advance(ticks = 30) {
    const until = tick + ticks;
    while (scheduled.some(job => job.at <= until)) {
        scheduled.sort((a, b) => a.at - b.at);
        const job = scheduled.shift(); tick = job.at; job.fn();
    }
    tick = until;
}
function clear() { advance(); messages.length = sounds.length = events.length = 0; }
equipment.set("Mainhand", { definition: { attributes: { effects: [
    { kind: "sweep", label: "Sweeping" },
    { kind: "fire", label: "Igniter", requiresAdvancedUnlock: true },
] } }, state: {} });

assert.equal(context.getStatsCoreFeedbackStyle(player), "minimal");
context.showCombatFeedback(player, player, { damage: 18, crit: { active: true }, elemental: ["fire"] });
context.showMiningFeedback(player, "stone", { bonusXp: true, preserved: true });
context.showHealingFeedback(player, 4);
context.showAbilityFeedback(player, "Tool Preserving");
context.showAbilityFeedback(player, "Igniter");
context.playActivationSound(player, "random.levelup"); // Troubles used this sound too.
context.playActivationSound(player, "ascendant.statscore.void_singularity");
advance(); assert.deepEqual(messages, []); assert.deepEqual(sounds, []);

context.showCombatFeedback(player, player, { damage: 18, abilities: ["Sweeping", "Igniter"] });
advance(); assert.deepEqual(messages, [icons.sweeping]); assert.deepEqual(sounds, []); clear();
context.showMiningFeedback(player, "stone", { bonusDrop: true, bonusDropLabel: "§dDouble Trouble" });
context.showAbilityFeedback(player, "Triple Trouble");
advance(); assert.equal(messages.length, 1);
assert(messages[0].includes(icons.doubleTrouble)); assert(messages[0].includes(icons.tripleTrouble));
assert(!/[A-Za-z0-9]/.test(messages[0])); assert.deepEqual(sounds, []); clear();

context.showLevelUp(player, {}, { levelUp: true, category: "defensive", previousLevel: 1, level: 2 });
context.showLevelUp(player, {}, { levelUp: true, category: "defensive", previousLevel: 1, level: 2 });
advance(); assert.deepEqual(sounds, ["random.levelup"]); assert.equal(messages.length, 1);
assert(!messages[0].includes("Level")); clear();

context.setStatsCoreInsightBridgeEnabled(player, true);
context.showCombatFeedback(player, player, { damage: 10, abilities: ["Sweeping"] });
context.showHealingFeedback(player, 5);
advance(); assert.deepEqual(messages, []); assert.equal(events.length, 1);
assert.deepEqual(Array.from(events[0].primary), [icons.sweeping]);
assert.deepEqual(Array.from(events[0].attributes), []); clear();
queueAvailable = true;
context.showAbilityFeedback(player, "Double Trouble");
advance(); assert.deepEqual(messages, [icons.doubleTrouble]); assert.deepEqual(events, []); clear();

assert(context.setStatsCoreFeedbackStyle(player, "text"));
assert.equal(context.getStatsCoreFeedbackStyle(player), "only_text");
context.showCombatFeedback(player, player, { damage: 12 });
advance(); assert(messages[0].includes("Damage 12")); assert.deepEqual(sounds, ["random.orb"]); clear();
assert(context.setStatsCoreFeedbackStyle(player, "both_partial"));
context.showCombatFeedback(player, player, { damage: 12 });
assert(context.setStatsCoreFeedbackStyle(player, "minimal"));
advance(); assert.deepEqual(messages, []); clear();
properties.set("style", "invalid-old-value"); advance();
assert.equal(context.getStatsCoreFeedbackStyle(player), "minimal");
console.log("PASS: quiet default, primary-only glyphs, both Troubles, batched level-up sound, both Insight routes, explicit legacy styles, and queued-style changes.");

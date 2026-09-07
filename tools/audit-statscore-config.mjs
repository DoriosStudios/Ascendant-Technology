// Run with: node --experimental-vm-modules tools/audit-statscore-config.mjs
// Optional --baseline <source-snapshot.json> compares behavior before/after a refactor.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const prefix = "BP/scripts/ATCore/StatsCore/";
function filesAt(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? filesAt(join(directory, entry.name)) : [join(directory, entry.name)],
    );
}
const current = Object.fromEntries(
    filesAt(join(root, prefix))
        .filter((file) => file.endsWith(".js"))
        .map((file) => [
            file.slice(root.length + 1).replaceAll("\\", "/"),
            readFileSync(file, "utf8"),
        ]),
);
const recipePath = "BP/scripts/config/recipes/refiningTable.js";
current[recipePath] = readFileSync(join(root, recipePath), "utf8");
const baselineArg = process.argv.indexOf("--baseline");
const baseline =
    baselineArg >= 0 ? JSON.parse(readFileSync(process.argv[baselineArg + 1], "utf8")) : null;

// Expose private data only inside the audit VM to compare the extracted tables.
const privateData = {
    "defaults.js": [
        "TIER_PRESETS",
        "WEAK_ATTRIBUTE_GROWTH",
        "EVENT_TIER_POWER",
        "NON_COMBAT_TOOL_BRANCHES",
        "CANONICAL_TIER_TOKENS",
        "ADVANCED_ABILITY_TIERS",
    ],
    "mining/index.js": [
        "UNBREAKABLE_BLOCKS",
        "GARDENER_PLANT_TOKENS",
        "GARDENER_EXACT_BLOCKS",
        "PRIMAL_FIBER_TOKENS",
        "ORE_PLATE_DROPS",
        "ORE_BONUS_DROPS",
        "ORE_DUST_DROPS",
        "ORE_PROCESSED_DROPS",
        "WORM_SOIL_DROPS",
        "CROP_GROWTH_CONFIG",
    ],
    "utility/index.js": ["WORM_SOIL_CYCLE", "WORM_DIG_DROPS"],
    "combat/effects.js": [
        "HOT_ENTITY_TOKENS",
        "COLD_ENTITY_TOKENS",
        "DARK_RESISTANT_TOKENS",
        "UNDEAD_ENTITY_TOKENS",
        "SWEEP_ENTITY_CATEGORIES",
        "SWEEP_EXCLUDED_ENTITY_TYPES",
    ],
    "support/armor.js": [
        "MAX_TOTAL_DAMAGE_REDUCTION",
        "MAX_TOTAL_KNOCKBACK_RESISTANCE",
        "PRESERVING_DAMAGE_TYPES",
        "KNOCKBACK_DAMAGE_TYPES",
    ],
    "support/armorComponent.js": [
        "DEFAULT_DAMAGE_REDUCTION",
        "DEFAULT_DAMAGE_NEGATION",
        "DEFAULT_KNOCKBACK_RESISTANCE",
        "MAX_COMPONENT_REDUCTION",
        "MAX_KNOCKBACK_RESISTANCE",
    ],
    "support/dash.js": ["BOOT_MOBILITY_MODES", "BOOT_MOBILITY_LABELS", "DOUBLE_INPUT_WINDOW_TICKS"],
    "support/elytra.js": [
        "DOUBLE_JUMP_WINDOW_TICKS",
        "AIR_PUNCH_FALL_SPEED",
        "HEIGHT_RAY_DISTANCE",
    ],
    "core/refinement.js": ["DEFAULT_REFINEMENT_BONUSES"],
    "core/lore.js": ["MAX_VISIBLE_LORE_ATTRIBUTES"],
    "effects/state.js": [
        "CLEANUP_INTERVAL_TICKS",
        "INSIGHT_RESYNC_INTERVAL_TICKS",
        "MAX_EFFECT_LEVEL",
        "DEFAULT_EFFECT_SOURCE",
    ],
    "effects/insightBridge.js": [
        "EFFECTS_NAMESPACE",
        "EFFECTS_DISCOVER_EVENT",
        "EFFECTS_READY_EVENT",
        "EFFECTS_SEND_EVENT",
        "LEGACY_DISCOVER_EVENT",
        "LEGACY_READY_EVENT",
        "LEGACY_SEND_EVENT",
    ],
    "elements/windMining.js": ["HASTE_STEP_TICKS", "MAX_HASTE_LEVEL"],
    "shared/messages.js": [
        "INSIGHT_ACTIONBAR_NAMESPACE",
        "INSIGHT_NAMESPACE_NAME",
        "INSIGHT_QUEUE_DISCOVER_EVENT",
        "INSIGHT_QUEUE_READY_EVENT",
        "INSIGHT_QUEUE_SEND_EVENT",
        "ACTIONBAR_LIFETIME_TICKS",
        "INSIGHT_READY_GRACE_TICKS",
    ],
    "shared/damage.js": ["DAMAGE_TYPE_ALIASES"],
    "feedback/index.js": [
        "INSIGHT_ACTIVITY_EVENT",
        "MINING_ABILITY_TOKENS",
        "FEEDBACK_STYLE_ALIASES",
    ],
    "refining/inheritance.js": ["CATEGORY_CHANNEL", "INHERITANCE_DONOR_IDS"],
    "commands.js": ["REFINEMENT_PRESETS", "REFINEMENT_ACTIONS"],
};

function graph(sources) {
    const edges = new Map();
    for (const [file, source] of Object.entries(sources)) {
        const dependencies = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)].map(
            (match) => match[1],
        );
        const internal = [];
        for (const dep of dependencies) {
            const target = dep.startsWith(".") ? posix.join(posix.dirname(file), dep) : dep;
            if (file.startsWith(`${prefix}config/`)) {
                assert(
                    target.startsWith(`${prefix}config/`),
                    `Config imports runtime: ${file} -> ${dep}`,
                );
                assert(sources[target], `Missing config: ${target}`);
            }
            if (sources[target]) internal.push(target);
        }
        edges.set(file, internal);
    }
    const visited = new Set();
    const active = [];
    function visit(file) {
        assert(!active.includes(file), `Import cycle: ${[...active, file].join(" -> ")}`);
        if (visited.has(file)) return;
        active.push(file);
        for (const dep of edges.get(file) ?? []) visit(dep);
        active.pop();
        visited.add(file);
    }
    for (const file of edges.keys()) visit(file);
}

class Stack {
    constructor(typeId, properties = {}, components = {}, tags = []) {
        this.typeId = typeId;
        this.properties = { ...properties };
        this.components = components;
        this.tags = tags;
        this.maxAmount = 1;
        this.amount = 1;
        this.lore = ["Existing external lore"];
    }
    getDynamicProperty(key) {
        return this.properties[key];
    }
    setDynamicProperty(key, value) {
        if (value === undefined) delete this.properties[key];
        else this.properties[key] = value;
    }
    getComponent(key) {
        return this.components[key];
    }
    getTags() {
        return this.tags;
    }
    getLore() {
        return [...this.lore];
    }
    setLore(value) {
        this.lore = [...value];
    }
}
function portable(value) {
    return JSON.parse(
        JSON.stringify(value, (_key, entry) => {
            if (typeof entry === "number" && !Number.isFinite(entry)) return String(entry);
            if (Object.prototype.toString.call(entry) === "[object Set]") return [...entry];
            if (Object.prototype.toString.call(entry) === "[object Map]") return [...entry];
            return entry;
        }),
    );
}

async function loadRuntime(sources) {
    let seed = 123456789;
    const math = Object.create(Math);
    math.random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
    class FixedDate extends Date {
        static now() {
            return 1700000000000;
        }
    }
    const context = createContext({ console, Math: math, Date: FixedDate });
    const subscriptions = [];
    const commands = [];
    const queue = [];
    const events = (group) =>
        new Proxy(
            {},
            {
                get: (_target, event) => ({
                    subscribe: (callback) => subscriptions.push({ group, event, callback }),
                }),
            },
        );
    const system = {
        currentTick: 100,
        afterEvents: events("system.after"),
        run: (callback) => {
            queue.push({ callback, delay: 1 });
            return queue.length;
        },
        runTimeout: (callback, delay) => {
            queue.push({ callback, delay });
            return queue.length;
        },
        runInterval: (_callback, delay) => {
            subscriptions.push({ group: "interval", event: delay });
            return subscriptions.length;
        },
        clearRun() {},
        sendScriptEvent() {},
    };
    const world = {
        beforeEvents: events("before"),
        afterEvents: events("after"),
        getPlayers: () => [],
        getDynamicProperty: () => undefined,
        setDynamicProperty() {},
    };
    const registrations = [];
    const registry = {
        customCommand: (definition) => commands.push(definition),
        itemComponent: (id, definition) => registrations.push([id, definition]),
    };
    const modules = new Map();
    function synthetic(id, exports) {
        return new SyntheticModule(
            Object.keys(exports),
            function () {
                for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
            },
            { context, identifier: id },
        );
    }
    function moduleFor(id) {
        if (modules.has(id)) return modules.get(id);
        let module;
        if (sources[id]) {
            const names = privateData[id.slice(prefix.length)];
            const auditExport = names
                ? `\nexport const __auditData = { ${names.join(", ")} };\n`
                : "";
            module = new SourceTextModule(sources[id] + auditExport, { context, identifier: id });
        } else if (id === "@minecraft/server") {
            module = synthetic(id, {
                system,
                world,
                ItemStack: Stack,
                ButtonState: { Pressed: "Pressed" },
                InputButton: { Jump: "Jump", Sneak: "Sneak" },
                EntitySwingSource: { Attack: "Attack" },
                EntityDamageCause: { entityAttack: "entityAttack", override: "override" },
                EffectTypes: { get: (id) => id },
                EntityTypes: { get: (id) => ({ id }) },
            });
        } else if (id === "DoriosLib/index.js") {
            module = synthetic(id, { registry });
        } else if (id.endsWith("/enchanting/reinforcement.js")) {
            module = synthetic(id, {
                getReinforcementPoints: () => 0,
                getReinforcementMaximum: () => 0,
            });
        } else if (id.endsWith("/DoriosLib/messages/index.js")) {
            module = synthetic(id, { actionBar() {} });
        } else {
            throw new Error(`Unresolved import: ${id}`);
        }
        modules.set(id, module);
        return module;
    }
    async function get(file) {
        const module = moduleFor(file.startsWith("BP/") ? file : prefix + file);
        if (module.status === "unlinked")
            await module.link((dep, parent) =>
                moduleFor(
                    dep.startsWith(".") ? posix.join(posix.dirname(parent.identifier), dep) : dep,
                ),
            );
        if (module.status === "linked") await module.evaluate();
        return module.namespace;
    }
    const api = await get("index.js");
    return { api, get, system, commands, subscriptions, registrations, queue };
}

const itemIds = new Set(
    filesAt(join(root, "BP/items"))
        .filter((file) => file.endsWith(".json"))
        .flatMap((file) => {
            const source = readFileSync(file, "utf8");
            const id = source.match(/"identifier"\s*:\s*"([^"]+)"/)?.[1];
            return id ? [id] : [];
        }),
);
const branches = [
    "sword",
    "pickaxe",
    "shovel",
    "hoe",
    "axe",
    "aiot",
    "paxel",
    "helmet",
    "chestplate",
    "leggings",
    "boots",
    "shield",
    "elytra",
    "drill",
    "knife",
    "lighter",
    "shears",
    "hammer",
    "spear",
    "bow",
    "crossbow",
    "trident",
    "mace",
    "wand",
    "equipment",
];
for (const material of [
    "wooden",
    "stone",
    "copper",
    "iron",
    "steel",
    "gold",
    "golden",
    "diamond",
    "netherite",
    "titanium",
    "aetherium",
    "unknown",
]) {
    for (const branch of branches) itemIds.add(`test:${material}_${branch}`);
}
for (const id of [
    "minecraft:elytra",
    "minecraft:stick",
    "minecraft:turtle_helmet",
    "minecraft:bow",
    "minecraft:trident",
    "minecraft:mace",
    "minecraft:crossbow",
    "minecraft:shield",
    "minecraft:apple",
    "test:staff",
    "test:__proto__",
    "test:toString",
])
    itemIds.add(id);

async function snapshot(sources) {
    const runtime = await loadRuntime(sources);
    const { api, get } = runtime;
    const { inferDynamicDefinition } = await get("defaults.js");
    const stateApi = await get("core/state.js");
    const refinement = await get("core/refinement.js");
    const inheritance = await get("refining/inheritance.js");
    const rolls = await get("refining/rolls.js");
    const { REFINING_TABLE_CONFIG: recipe } = await get(recipePath);
    const output = {};
    let supported = 0;
    const record = (key, value) => {
        output[key] = createHash("sha256")
            .update(JSON.stringify(portable(value)))
            .digest("hex");
    };
    for (const file of Object.keys(baseline ?? current).filter((file) => file.startsWith(prefix))) {
        const exports = await get(file);
        record(
            `exports:${file}`,
            Object.keys(exports).filter((name) => name !== "__auditData"),
        );
        for (const [name, value] of Object.entries(exports)) {
            if (typeof value !== "function") record(`data:${file}:${name}`, value);
        }
    }
    record("startup", {
        events: runtime.subscriptions.map(({ group, event, callback }) => [
            group,
            event,
            callback?.name,
        ]),
        commands: runtime.commands.map(({ callback, ...metadata }) => metadata),
        registrations: runtime.registrations,
        queue: runtime.queue.map((entry) => entry.delay),
    });
    for (const id of [...itemIds].sort()) {
        const definition = inferDynamicDefinition(id);
        record(`definition:${id}`, definition);
        if (!definition) continue;
        supported++;
        for (const variant of ["unrefined", "normal", "unique", "advanced", "legacy"]) {
            const stack = new Stack(id);
            let state = api.readStatsState(stack, definition);
            state = {
                ...state,
                uid: "audit_item",
                refined: variant !== "unrefined",
                progression: Object.fromEntries(
                    ["offensive", "defensive", "mining", "utility"].map((category) => [
                        category,
                        { level: 25, xp: 4500 },
                    ]),
                ),
                abilityData: {
                    ...state.abilityData,
                    uniqueUnlocked: variant === "unique" || variant === "advanced",
                    advancedUnlocked: variant === "advanced",
                    appliedAbilities: { bleeding: 99, operator: 1 },
                    abilityTargets: { bleeding: ["HOSTILE", "minecraft:zombie"] },
                    bootMobilityMode: variant === "legacy" ? "invalid" : "bunny_jump",
                },
                attributeProgress: {
                    offensive: { bonus_damage: 8, critical_chance: 3 },
                    mining: { bonus_loot: 5, ore_yield: 2 },
                },
                refinement: {
                    quality: 0.7,
                    bonuses: {
                        extraDamage: variant === "legacy" ? 100 : 4,
                        bonusLootChance: 0.1,
                        bonusDropChance: 0.2,
                        oreBonusChance: 0.3,
                        elemental: {
                            id: definition.type === "support" ? "earth" : "light",
                            damage: 100,
                            chance: 0.7,
                            quality: 0.8,
                        },
                    },
                },
            };
            const written = api.writeStatsState(stack, definition, state, { syncLore: true });
            const attrs = api.resolveStatsAttributes(definition, written.state);
            record(`state:${id}:${variant}`, {
                written,
                attrs,
                properties: stack.properties,
                lore: stack.lore,
                reserve: refinement.getStatsRefinementReserveXp(written.state),
            });
            assert(stack.lore.includes("Existing external lore"));
            assert.equal(api.writeStatsState(stack, definition, written.state).changed, false);
        }
        record(
            `xp:${id}`,
            [1, 2, 10, 50, 200].map((level) => {
                const xp = api.getTotalXpForLevel(level, definition);
                assert.equal(api.getLevelFromXp(xp, definition), level);
                return [
                    xp,
                    api.getXpNeededForLevel(level, definition),
                    api.getLevelFromXp(Math.max(0, xp - 1), definition),
                ];
            }),
        );
    }
    for (const branch of branches) {
        const definition = inferDynamicDefinition(`test:diamond_${branch}`);
        if (!definition) continue;
        const second = inferDynamicDefinition(definition.id);
        definition.attributes.effects.push({ key: "audit_only" });
        assert(
            !second.attributes.effects.some((effect) => effect.key === "audit_only"),
            "Shared mutable effects",
        );
        for (const effect of definition.support.effects) {
            for (const key of ["reducedDamageTypes", "negatedDamageTypes"]) {
                if (!Array.isArray(effect[key])) continue;
                effect[key].push("audit_only");
                assert(
                    !second.support.effects.some((other) => other[key]?.includes("audit_only")),
                    "Shared mutable damage types",
                );
            }
        }
        record(`inheritance:${branch}`, inheritance.getAdvancedInheritancePool(second));
        for (const coreMode of ["none", "normal", "advanced"]) {
            record(
                `roll:${branch}:${coreMode}`,
                rolls.rollStatsRefinement({
                    definition: second,
                    state: {},
                    chip: [...recipe.chips.values()][2],
                    ingot: [...recipe.ingots.values()][1],
                    amount: 8,
                    advanced: coreMode === "advanced",
                    coreMode,
                }),
            );
        }
    }
    for (const maxDurability of [
        0, 1, 160, 161, 320, 321, 640, 641, 1800, 1801, 2600, 2601, 4200, 4201,
    ]) {
        const stack = new Stack("test:unusual", {}, { "minecraft:durability": { maxDurability } });
        record(`durability:${maxDurability}`, inferDynamicDefinition(stack));
    }
    for (const tag of branches) {
        record(
            `tag:${tag}`,
            inferDynamicDefinition(new Stack("test:unusual", {}, {}, [`other:is_${tag}`])),
        );
    }
    assert.equal(api.getStatsCoreDefinition("test:tag_only"), null);
    assert(api.getStatsCoreDefinition(new Stack("test:tag_only", {}, {}, ["minecraft:is_sword"])));
    record(
        "categories",
        [
            null,
            {},
            { type: "utility" },
            { progression: { combatXp: 1, killXp: 2, armorXp: 1, toolXp: 1 } },
        ].map((def) => [...stateApi.getCategoriesForDefinition(def)]),
    );
    record(
        "reasons",
        [
            "combat",
            "kill",
            "armor",
            "hurt",
            "ore",
            "tool",
            "block",
            "utility",
            "invalid",
            "__proto__",
        ].map(stateApi.getCategoryForReason),
    );
    for (const typeId of [
        "minecraft:zombie",
        "minecraft:player",
        "minecraft:wither",
        "minecraft:cow",
        "minecraft:wolf",
        "test:unknown",
    ]) {
        record(
            `entity:${typeId}`,
            [false, true].map((isTamed) => api.getEntityCategory({ typeId, isTamed })),
        );
    }
    for (const value of [true, false, 0, -1, 0.25, 25, 95, 200, "invalid"]) {
        const stack = new Stack(
            "test:component_armor",
            {},
            {
                [api.ARMOR_COMPONENT_ID]: {
                    customComponentParameters: {
                        params: {
                            damage_reduction: value,
                            damage_negation: value,
                            knockback_resistance: value,
                            cases: {
                                projectile: { damage_reduction: true, knockback_resistance: 1 },
                            },
                        },
                    },
                },
            },
        );
        record(
            `armor:${value}`,
            ["all", "entity_attack", "projectile", "fire"].map((cause) =>
                api.resolveArmorComponentMitigation(stack, cause),
            ),
        );
    }
    const progressStack = new Stack("minecraft:diamond_sword");
    const progressDefinition = inferDynamicDefinition(progressStack);
    api.writeStatsState(progressStack, progressDefinition, {
        ...api.readStatsState(progressStack, progressDefinition),
        uid: "progress_audit",
        refined: true,
    });
    record(
        "progress-buffer",
        [1, 1, 16, 60, 500].map((amount) => ({
            result: api.grantStatsProgress(progressStack, progressDefinition, amount, "combat"),
            properties: { ...progressStack.properties },
        })),
    );
    const timedEntity = { id: "effect_audit", typeId: "minecraft:zombie" };
    record(
        "effect-aliases",
        ["mark", "bleed", "blessing", "light", "curse", "adaptive", "soul"].map((id) => {
            api.upsertStatsCoreEffect(timedEntity, { id, durationTicks: 40, level: 99 });
            return api.getStatsCoreEffects(timedEntity);
        }),
    );
    runtime.system.currentTick += 41;
    assert.equal(api.getStatsCoreEffects(timedEntity).length, 0);
    if (sources[prefix + "config/definitions.js"]) {
        assert.strictEqual(api.STATSCORE, (await get("config/definitions.js")).STATSCORE);
        assert.strictEqual(api.ITEM_TYPES, (await get("config/equipmentTypes.js")).ITEM_TYPES);
        assert.strictEqual(
            (await get("icons.js")).STATSCORE_ICONS,
            (await get("config/presentation.js")).STATSCORE_ICONS,
        );
    }
    return { output, supported };
}

for (const file of ["values.js", "definitions.js", "equipmentTypes.js"]) {
    assert(current[prefix + "config/" + file], `Missing central configuration: ${file}`);
}
graph(current);
await build({
    absWorkingDir: root,
    entryPoints: [prefix + "index.js", "BP/scripts/features/machines/refiningTable.js"],
    outdir: "statscore-audit-output",
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    external: ["@minecraft/*", "DoriosLib", "DoriosLib/*", "DoriosCore", "DoriosCore/*"],
    logLevel: "silent",
});
const after = await snapshot(current);
if (baseline) {
    const before = await snapshot(baseline);
    for (const [key, value] of Object.entries(before.output))
        assert.equal(after.output[key], value, `Behavior changed: ${key}`);
    console.log(`Baseline equivalence: ${Object.keys(before.output).length} comparisons passed.`);
}
console.log(
    `StatsCore audit passed: ${itemIds.size} item identifiers (${after.supported} supported), state/lore, progression, inheritance, rolls, exports and startup.`,
);

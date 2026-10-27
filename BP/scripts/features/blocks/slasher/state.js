import { world, system } from "@minecraft/server";
import { ID, clamp, DAMAGE_CAP } from "./config.js";
import { deserializeWeapon, serializeWeapon } from "./weapon.js";
export const states = new Map();
let storageGeneration = 0;
export function locationKey(block) {
    const dims = { "minecraft:overworld": "o", "minecraft:nether": "n", "minecraft:the_end": "e" };
    const { x, y, z } = block.location;
    return `${dims[block.dimension.id] ?? block.dimension.id.replaceAll(":", ".")}:${x},${y},${z}`;
}
function read(key) {
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== "string") return {};
    const record = JSON.parse(raw);
    if (!record?.parts) return record;
    let encoded = "";
    for (let i = 0; i < record.parts; i++) {
        const part = world.getDynamicProperty(`${key}:part:${record.generation}:${i}`);
        if (typeof part !== "string") throw new Error(`Incomplete Slasher record: ${key}`);
        encoded += part;
    }
    return JSON.parse(encoded);
}
function clearParts(key, raw) {
    if (typeof raw !== "string") return;
    const record = JSON.parse(raw);
    for (let i = 0; i < (record.parts ?? 0); i++) world.setDynamicProperty(`${key}:part:${record.generation}:${i}`, undefined);
}
export function load(block) {
    const key = locationKey(block);
    let state = states.get(key);
    if (state) { state.block = block; state.lastSeen = system.currentTick; return state; }
    const saved = read(`at:ms:${key}`);
    const upgrades = saved.upgrades ?? read(`at:ms:upgrades:${key}`);
    state = {
        ...saved, key, block, lastSeen: system.currentTick, revision: 0, alive: true,
        upgrades: { damage: clamp(upgrades.damage, DAMAGE_CAP), range: clamp(upgrades.range, 8) },
        modules: saved.modules ?? {}, active: saved.active ?? {}, xp: clamp(saved.xp, 256000),
        direction: clamp(saved.direction, 5), distance: saved.distance ?? 0.5,
        filter: saved.filter ?? [], filterMode: saved.filterMode ?? "blacklist",
        weapon: deserializeWeapon(saved.weapon),
        nextAttack: 0, nextUtility: 0,
    };
    states.set(key, state);
    return state;
}
export function valid(state) {
    try { return state.alive && state.block.isValid && state.block.typeId === ID; } catch { return false; }
}
export function save(state) {
    if (!state.alive) return;
    const data = {
        upgrades: state.upgrades, range: state.range, damage: state.damage,
        modules: state.modules, active: state.active, xp: state.xp,
        direction: state.direction, distance: state.distance, xpOffset: state.xpOffset, filter: state.filter,
        filterMode: state.filterMode, cooldown: state.cooldown ?? 4,
        pauseFull: state.pauseFull !== false, weapon: serializeWeapon(state.weapon),
    };
    const encoded = JSON.stringify(data);
    const key = `at:ms:${state.key}`;
    const previous = world.getDynamicProperty(key);
    if (previous === encoded) return;
    if (encoded.length <= 8000) {
        world.setDynamicProperty(key, encoded);
    } else {
        // <=8,000 UTF-16 units per part fits even non-ASCII payloads. Commit the
        // pointer last so a failed write never replaces a valid weapon record.
        const generation = `${Date.now()}_${++storageGeneration}`;
        const parts = Math.ceil(encoded.length / 8000);
        let written = 0;
        try {
            for (; written < parts; written++) world.setDynamicProperty(`${key}:part:${generation}:${written}`, encoded.slice(written * 8000, (written + 1) * 8000));
            world.setDynamicProperty(key, JSON.stringify({ parts, generation }));
        } catch (error) {
            for (let i = 0; i < written; i++) world.setDynamicProperty(`${key}:part:${generation}:${i}`, undefined);
            throw error;
        }
    }
    clearParts(key, previous);
}
export function clear(block) {
    const key = locationKey(block);
    const old = states.get(key);
    if (old) { old.alive = false; old.revision++; }
    states.delete(key);
    clearParts(`at:ms:${key}`, world.getDynamicProperty(`at:ms:${key}`));
    world.setDynamicProperty(`at:ms:${key}`, undefined);
    world.setDynamicProperty(`at:ms:upgrades:${key}`, undefined);
}
system.runInterval(() => {
    for (const [key, state] of states) if (system.currentTick - state.lastSeen > 1200) {
        state.alive = false; state.revision++; states.delete(key);
    }
}, 600);

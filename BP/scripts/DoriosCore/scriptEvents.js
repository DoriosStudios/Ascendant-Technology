import { system, world, ItemStack } from "@minecraft/server";
import { Energy } from "./machinery/energyStorage.js";
import {
    FluidManager,
    GasManager,
    registerFluidContainerDefinition,
    registerFluidContainerBatch,
    registerFluidOutputDefinition,
    registerFluidOutputBatch,
    registerGasContainerDefinition,
    registerGasContainerBatch,
    registerGasOutputDefinition,
    registerGasOutputBatch,
    getFluidContainerRegistry,
    getFluidOutputRegistry,
    getGasContainerRegistry,
    getGasOutputRegistry,
} from "./machinery/fluidStorage.js";
import { Machine, updatePipes, sanitizeTickSpeed } from "./machinery/machine.js";
import { Generator } from "./machinery/generator.js";
import { ENERGY_DEBUG_PROP } from "./constants.js";
import {
    registerArmorMitigationDefinitionsFromScriptEvent
} from "./armor/reduction.js";

// ─── Event IDs ───────────────────────────────────────────────────────────────

const SCRIPT_EVENT_IDS = Object.freeze({
    fluid: Object.freeze({
        registerContainer: "utilitycraft:register_fluid_container",
        registerOutput: "utilitycraft:register_fluid_output",
        legacyItem: "utilitycraft:register_fluid_item",
        legacyHolder: "utilitycraft:register_fluid_holder"
    }),
    gas: Object.freeze({
        registerContainer: "utilitycraft:register_gas_container",
        registerOutput: "utilitycraft:register_gas_output",
        legacyItem: "utilitycraft:register_gas_item",
        legacyHolder: "utilitycraft:register_gas_holder"
    }),
    machine: Object.freeze({
        legacyTickSpeed: "utilitycraft:set_tick_speed",
        updatePipes: "dorios:updatePipes",
        energyDebug: "utilitycraft:debug_energy"
    }),
    armor: Object.freeze({
        registerMitigation: "utilitycraft:register_armor_mitigation"
    })
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function energyDebugEnabled() {
    try {
        const value = world.getDynamicProperty(ENERGY_DEBUG_PROP);
        if (value !== undefined) return value === true;
    } catch { /* ignore */ }
    return globalThis.energyDebugEnabled === true;
}

const normalizeFluidType = (value) =>
    typeof value === "string" && value.trim().length
        ? value.trim().toLowerCase()
        : "";

const normalizeGasType = (value) =>
    typeof value === "string" && value.trim().length
        ? value.trim().toLowerCase()
        : "";

const safeJsonParse = (payload) => {
    if (typeof payload !== "string" || payload.length === 0) return null;
    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
};

// ─── Fluid container / output registration via ScriptEvent ───────────────────

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id } = event;
    if (id !== SCRIPT_EVENT_IDS.fluid.registerContainer && id !== SCRIPT_EVENT_IDS.fluid.registerOutput) {
        return;
    }

    const trimmedMessage = typeof event.message === "string" ? event.message.trim() : "";
    if (!trimmedMessage) return;

    const payload = safeJsonParse(trimmedMessage);
    if (!payload) return;

    try {
        if (id === SCRIPT_EVENT_IDS.fluid.registerContainer) {
            const added = registerFluidContainerBatch(payload);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} fluid container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        } else {
            const added = registerFluidOutputBatch(payload);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} fluid output container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        }
    } catch (error) {
        console.warn(`[UtilityCraft] Failed to process ${id} payload:`, error);
    }
});

// ─── Gas container / output registration via ScriptEvent ─────────────────────

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id } = event;
    if (id !== SCRIPT_EVENT_IDS.gas.registerContainer && id !== SCRIPT_EVENT_IDS.gas.registerOutput) {
        return;
    }

    const trimmedMessage = typeof event.message === "string" ? event.message.trim() : "";
    if (!trimmedMessage) return;

    const payload = safeJsonParse(trimmedMessage);
    if (!payload) return;

    try {
        if (id === SCRIPT_EVENT_IDS.gas.registerContainer) {
            const added = registerGasContainerBatch(payload);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} gas container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        } else {
            const added = registerGasOutputBatch(payload);
            if (added > 0) {
                console.warn(`[UtilityCraft] Registered ${added} gas output container${added === 1 ? "" : "s"} via ScriptEvent.`);
            }
        }
    } catch (error) {
        console.warn(`[UtilityCraft] Failed to process ${id} payload:`, error);
    }
});

// ─── updatePipes handler ─────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id, message, sourceEntity } = event;
    if (id !== SCRIPT_EVENT_IDS.machine.updatePipes) return;

    const text = typeof message === "string" ? message : "";
    const [rawType, rawCoords] = text.split("|");
    const type = rawType?.trim();
    if (type !== "energy" && type !== "fluid" && type !== "item") return;

    let location = null;
    try {
        const parsed = JSON.parse(rawCoords ?? "null");
        if (Array.isArray(parsed) && parsed.length >= 3) {
            const [x, y, z] = parsed.map(Number);
            if ([x, y, z].every(Number.isFinite)) location = { x, y, z };
        } else if (parsed && typeof parsed === "object") {
            const x = Number(parsed.x);
            const y = Number(parsed.y);
            const z = Number(parsed.z);
            if ([x, y, z].every(Number.isFinite)) location = { x, y, z };
        }
    } catch { /* ignore malformed payloads */ }

    if (!location) return;

    const dim = sourceEntity?.dimension ?? world.getDimension("overworld");
    const block = dim.getBlock(location);
    if (!block) return;

    try {
        updatePipes(block, type);
    } catch (err) {
        console.warn(`[UtilityCraft] updatePipes ScriptEvent failed: ${err}`);
    }
});

// ─── Energy debug toggle ─────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id, message } = event;
    if (id !== SCRIPT_EVENT_IDS.machine.energyDebug) return;

    const raw = typeof message === "string" ? message.trim().toLowerCase() : "";
    let nextState = null;

    if (!raw || raw === "toggle") {
        nextState = !energyDebugEnabled();
    } else if (["true", "1", "on", "enable", "enabled"].includes(raw)) {
        nextState = true;
    } else if (["false", "0", "off", "disable", "disabled"].includes(raw)) {
        nextState = false;
    } else {
        console.warn(`[EnergyDebug] Unknown toggle value: ${raw}`);
        return;
    }

    globalThis.energyDebugEnabled = nextState;

    try {
        world.setDynamicProperty(ENERGY_DEBUG_PROP, nextState);
        console.warn(`[EnergyDebug] ${nextState ? "Enabled" : "Disabled"} (ScriptEvent).`);
    } catch (error) {
        console.warn(`[EnergyDebug] Failed to set ${ENERGY_DEBUG_PROP} (ScriptEvent).`, error);
    }
});

// ─── Armor mitigation registration via ScriptEvent ──────────────────────────

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id } = event;
    if (id !== SCRIPT_EVENT_IDS.armor.registerMitigation) {
        return;
    }

    const trimmedMessage = typeof event.message === "string" ? event.message.trim() : "";
    if (!trimmedMessage) return;

    const payload = safeJsonParse(trimmedMessage);
    if (!payload) return;

    try {
        const applied = registerArmorMitigationDefinitionsFromScriptEvent(payload);
        if (applied > 0) {
            console.warn(`[UtilityCraft] Registered ${applied} armor mitigation definition${applied === 1 ? "" : "s"} via ScriptEvent.`);
        }
    } catch (error) {
        console.warn(`[UtilityCraft] Failed to process ${id} payload:`, error);
    }
});

// ─── Legacy fluid / gas item & holder registration ───────────────────────────

function normalizeLegacyFluidContainer(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amount = entry.amountRange ?? entry.amount ?? entry.value ?? entry.required;
    const type = normalizeFluidType(entry.type ?? entry.fluid ?? entry.liquid);

    if (amount === undefined || amount === null || !type) return null;

    const normalized = { amount, type };
    const output = entry.output ?? entry.result ?? entry.returnItem ?? entry.empty;
    if (typeof output === "string" && output.length > 0) {
        normalized.output = output;
    }

    return normalized;
}

function normalizeLegacyFluidHolder(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amount = entry.amountRange ?? entry.required ?? entry.amount ?? entry.requirement;
    const types = entry.types ?? entry.fills ?? entry.outputs;
    if (amount === undefined || amount === null || typeof types !== "object" || types === null) return null;

    const fills = {};
    for (const [rawType, itemId] of Object.entries(types)) {
        const type = normalizeFluidType(rawType);
        if (!type) continue;
        if (typeof itemId !== "string" || itemId.length === 0) continue;
        fills[type] = itemId;
    }

    if (Object.keys(fills).length === 0) return null;

    return { amount, fills };
}

function normalizeLegacyGasContainer(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amount = entry.amountRange ?? entry.amount ?? entry.value ?? entry.required;
    const type = normalizeGasType(entry.type ?? entry.gas ?? entry.vapor);

    if (amount === undefined || amount === null || !type) return null;

    const normalized = { amount, type };
    const output = entry.output ?? entry.result ?? entry.returnItem ?? entry.empty;
    if (typeof output === "string" && output.length > 0) {
        normalized.output = output;
    }

    return normalized;
}

function normalizeLegacyGasHolder(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amount = entry.amountRange ?? entry.required ?? entry.amount ?? entry.requirement;
    const types = entry.types ?? entry.fills ?? entry.outputs;
    if (amount === undefined || amount === null || typeof types !== "object" || types === null) return null;

    const fills = {};
    for (const [rawType, itemId] of Object.entries(types)) {
        const type = normalizeGasType(rawType);
        if (!type) continue;
        if (typeof itemId !== "string" || itemId.length === 0) continue;
        fills[type] = itemId;
    }

    if (Object.keys(fills).length === 0) return null;

    return { amount, fills };
}

system.afterEvents.scriptEventReceive.subscribe(event => {
    const { id, message } = event;

    const isTickSpeedEvent = id === SCRIPT_EVENT_IDS.machine.legacyTickSpeed || id === "dorios:set_tick_speed";
    if (isTickSpeedEvent) {
        const parsed = safeJsonParse(message);
        const numeric = typeof parsed === "number" ? parsed : Number(message);
        if (Number.isFinite(numeric)) {
            const sanitized = sanitizeTickSpeed(numeric);
            globalThis.tickSpeed = sanitized;
            try {
                world.setDynamicProperty("utilitycraft:tickSpeed", sanitized);
            } catch { /* ignore property errors */ }
        }
        return;
    }

    if (id === SCRIPT_EVENT_IDS.fluid.legacyItem) {
        const payload = safeJsonParse(message);
        if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) return;

        const queue = Array.isArray(payload)
            ? payload
            : Object.entries(payload).map(([entryId, definition]) => ({ id: entryId, ...definition }));

        let added = 0;
        let replaced = 0;

        for (const entry of queue) {
            if (!entry || typeof entry !== "object") continue;

            const targets = [];
            const appendTarget = value => {
                if (typeof value === "string" && value.length > 0) {
                    targets.push(value);
                }
            };
            appendTarget(entry.id);
            appendTarget(entry.item);
            appendTarget(entry.itemId);

            if (Array.isArray(entry.ids)) {
                for (const candidate of entry.ids) {
                    appendTarget(candidate);
                }
            }

            const uniqueTargets = [...new Set(targets)];
            if (uniqueTargets.length === 0) continue;

            const normalized = normalizeLegacyFluidContainer(entry);
            if (!normalized) continue;

            for (const targetId of uniqueTargets) {
                const existed = Boolean(getFluidContainerRegistry()[targetId]);
                if (registerFluidContainerDefinition(targetId, normalized)) {
                    existed ? replaced++ : added++;
                }
            }
        }

        if (added || replaced) {
            console.warn(`[UtilityCraft] Registered ${added} new and ${replaced} updated fluid container${added + replaced === 1 ? "" : "s"} via legacy ScriptEvent.`);
        }
        return;
    }

    if (id === SCRIPT_EVENT_IDS.fluid.legacyHolder) {
        const payload = safeJsonParse(message);
        if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) return;

        const queue = Array.isArray(payload)
            ? payload
            : Object.entries(payload).map(([entryId, definition]) => ({ id: entryId, ...definition }));

        let added = 0;
        let replaced = 0;

        for (const entry of queue) {
            if (!entry || typeof entry !== "object") continue;

            const targets = [];
            const appendTarget = value => {
                if (typeof value === "string" && value.length > 0) {
                    targets.push(value);
                }
            };
            appendTarget(entry.id);
            appendTarget(entry.item);
            appendTarget(entry.itemId);

            if (Array.isArray(entry.ids)) {
                for (const candidate of entry.ids) {
                    appendTarget(candidate);
                }
            }

            const uniqueTargets = [...new Set(targets)];
            if (uniqueTargets.length === 0) continue;

            const normalized = normalizeLegacyFluidHolder(entry);
            if (!normalized) continue;

            for (const targetId of uniqueTargets) {
                const existed = Boolean(getFluidOutputRegistry()[targetId]);
                if (registerFluidOutputDefinition(targetId, normalized)) {
                    existed ? replaced++ : added++;
                }
            }
        }

        if (added || replaced) {
            console.warn(`[UtilityCraft] Registered ${added} new and ${replaced} updated fluid holder${added + replaced === 1 ? "" : "s"} via legacy ScriptEvent.`);
        }
        return;
    }

    if (id === SCRIPT_EVENT_IDS.gas.legacyItem) {
        const payload = safeJsonParse(message);
        if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) return;

        const queue = Array.isArray(payload)
            ? payload
            : Object.entries(payload).map(([entryId, definition]) => ({ id: entryId, ...definition }));

        let added = 0;
        let replaced = 0;

        for (const entry of queue) {
            if (!entry || typeof entry !== "object") continue;

            const targets = [];
            const appendTarget = value => {
                if (typeof value === "string" && value.length > 0) {
                    targets.push(value);
                }
            };
            appendTarget(entry.id);
            appendTarget(entry.item);
            appendTarget(entry.itemId);

            if (Array.isArray(entry.ids)) {
                for (const candidate of entry.ids) {
                    appendTarget(candidate);
                }
            }

            const uniqueTargets = [...new Set(targets)];
            if (uniqueTargets.length === 0) continue;

            const normalized = normalizeLegacyGasContainer(entry);
            if (!normalized) continue;

            for (const targetId of uniqueTargets) {
                const existed = Boolean(getGasContainerRegistry()[targetId]);
                if (registerGasContainerDefinition(targetId, normalized)) {
                    existed ? replaced++ : added++;
                }
            }
        }

        if (added || replaced) {
            console.warn(`[UtilityCraft] Registered ${added} new and ${replaced} updated gas container${added + replaced === 1 ? "" : "s"} via legacy ScriptEvent.`);
        }
        return;
    }

    if (id === SCRIPT_EVENT_IDS.gas.legacyHolder) {
        const payload = safeJsonParse(message);
        if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) return;

        const queue = Array.isArray(payload)
            ? payload
            : Object.entries(payload).map(([entryId, definition]) => ({ id: entryId, ...definition }));

        let added = 0;
        let replaced = 0;

        for (const entry of queue) {
            if (!entry || typeof entry !== "object") continue;

            const targets = [];
            const appendTarget = value => {
                if (typeof value === "string" && value.length > 0) {
                    targets.push(value);
                }
            };
            appendTarget(entry.id);
            appendTarget(entry.item);
            appendTarget(entry.itemId);

            if (Array.isArray(entry.ids)) {
                for (const candidate of entry.ids) {
                    appendTarget(candidate);
                }
            }

            const uniqueTargets = [...new Set(targets)];
            if (uniqueTargets.length === 0) continue;

            const normalized = normalizeLegacyGasHolder(entry);
            if (!normalized) continue;

            for (const targetId of uniqueTargets) {
                const existed = Boolean(getGasOutputRegistry()[targetId]);
                if (registerGasOutputDefinition(targetId, normalized)) {
                    existed ? replaced++ : added++;
                }
            }
        }

        if (added || replaced) {
            console.warn(`[UtilityCraft] Registered ${added} new and ${replaced} updated gas holder${added + replaced === 1 ? "" : "s"} via legacy ScriptEvent.`);
        }
        return;
    }
});

// ─── destroyMachine ──────────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e;

    if (id === 'dorios:destroyMachine') {
        try {
            const [x, y, z] = message.split(',').map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim
            };

            const broken = Machine.onDestroy(fakeEvent);

            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, 'minecraft:air');
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                }
            }, 1);

        } catch (err) {
            console.warn(`[destroyMachine] Error: ${err}`);
        }
    }
});

// ─── special_container ───────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e;

    if (id !== 'dorios:special_container') return;

    let slots;
    try {
        slots = JSON.parse(message);
    } catch {
        return;
    }

    if (!slots || (!slots.input && !slots.output)) return;
    if (!sourceEntity) return;

    sourceEntity.setDynamicProperty("dorios:special_container", JSON.stringify(slots));
});

// ─── destroyGenerator ────────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e;

    if (id === 'dorios:destroyGenerator') {
        try {
            const [x, y, z] = message.split(',').map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const fakeEvent = {
                block,
                brokenBlockPermutation: block.permutation,
                player: null,
                dimension: dim
            };

            const broken = Generator.onDestroy(fakeEvent);

            system.runTimeout(() => {
                if (broken) {
                    dim.setBlockType(block.location, 'minecraft:air');
                } else {
                    dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                }
            }, 1);

        } catch (err) {
            console.warn(`[destroyGenerator] Error: ${err}`);
        }
    }
});

// ─── destroyTank ─────────────────────────────────────────────────────────────

system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e;

    if (id === 'dorios:destroyTank') {
        try {
            const [x, y, z] = message.split(',').map(Number);
            const dim = sourceEntity.dimension;
            const block = dim.getBlock({ x, y, z });
            if (!block) return;

            const entity = dim.getEntitiesAtBlockLocation(block.location)
                .find(e => e.typeId.includes("tank"));
            if (!entity) {
                dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} air destroy`);
                return;
            }

            const fluid = new FluidManager(entity);
            const blockItemId = block.typeId;
            const blockItem = new ItemStack(blockItemId);
            const lore = [];

            if (fluid.type !== 'empty' && fluid.get() > 0) {
                const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
                lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
            }
            if (lore.length > 0) blockItem.setLore(lore);

            const dropPos = block.center();

            system.run(() => {
                entity.remove();
                dim.setBlockType(block.location, 'minecraft:air');
                dim.spawnItem(blockItem, dropPos);
            });
        } catch (err) {
            console.warn(`[destroyTank] Error: ${err}`);
        }
    }
});

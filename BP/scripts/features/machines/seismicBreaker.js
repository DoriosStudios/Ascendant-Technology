// @ts-check

import { system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    PATTERN_MODE_ORDER,
    buildPatternPositions,
    getPatternConfigurationSignature,
    getPatternDirection,
    getPatternMode,
    handleSeismicOutlineInteract,
    initializeSeismicOutline,
    removeSeismicOutline,
    syncSeismicOutlineIfNeeded,
} from "../../ATCore/spatial/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderMachineInfo,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";
import { capitalizeFirst, formatIdentifier } from "DoriosLib/text/index.js";

const ID = "utilitycraft:seismic_breaker";
const INVENTORY_SIZE = 24;
const LEGACY_SLOT_LAYOUT_18 = [
    0, 1, 2, 3,
    -1,
    11, 9, 10, -1,
    5, 6, 7, 8, -1, -1, -1, -1, -1,
    12, 13, 14, 15, 16, 17,
];
const LEGACY_SLOT_LAYOUT_19 = [
    0, 1, 2, 3,
    -1,
    12, 9, 10, -1,
    5, 6, 7, 8, -1, -1, -1, -1, -1,
    13, 14, 15, 16, 17, 18,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 14, 15, 16, 17,
    5, 6, 7, 8, 9, 10, 11, 12, 13,
    18, 19, 20, 21, 22, 23,
];
const LAYOUT_KEY = "ascendant:seismic_breaker_layout";
const LAYOUT_VERSION = "output_last_v2";
const MODE_BUTTON_SLOT = 3;
const TOOL_SLOT = 4;
const ACTIVATION_BUTTON_SLOT = 5;
const OUTPUT_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const IO_BUTTON_SLOTS = [18, 19, 20, 21, 22, 23];
const MODE_KEY = "ascendant:seismic_breaker_mode";
const ENABLED_KEY = "ascendant:seismic_breaker_enabled";
const OPERATION_KEY = "ascendant:seismic_breaker_operation";
const EMPTY_RESCAN_TICKS = 20;
const CACHE_CLEANUP_INTERVAL = 1200;
const CACHE_EXPIRATION = 6000;

const unbreakableBlocks = new Set(DoriosLib.constants.UNBREAKABLE_BLOCKS);
const targetStates = new Map();
let lastCacheCleanupTick = 0;

function getMode(entity) {
    return getPatternMode(entity.getDynamicProperty(MODE_KEY));
}

function isEnabled(entity) {
    return entity.getDynamicProperty(ENABLED_KEY) !== "false";
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const current = getMode(entity);
    const currentIndex = PATTERN_MODE_ORDER.indexOf(current.id);
    const next = getPatternMode(PATTERN_MODE_ORDER[(currentIndex + 1) % PATTERN_MODE_ORDER.length]);
    resetOperation(entity);
    setDynamicString(entity, MODE_KEY, next.id);
    return `\u00A7r\u00A76${next.short}`;
});

ButtonManager.registerMachineButton(ID, ACTIVATION_BUTTON_SLOT, ({ entity }) => {
    const next = !isEnabled(entity);
    resetOperation(entity);
    setDynamicString(entity, ENABLED_KEY, next ? "true" : "false");
    return next ? "\u00A7r\u00A7aON" : "\u00A7r\u00A7cOFF";
});

registerIOInterface(ID, {
    items: {
        buttonSlots: IO_BUTTON_SLOTS,
        anyInputSlots: [TOOL_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_2", inputSlots: [TOOL_SLOT] },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A761x1");
            setUiItem(machine.container, ACTIVATION_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aON");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setDynamicString(machine.entity, MODE_KEY, "single");
            setDynamicString(machine.entity, ENABLED_KEY, "true");
            resetOperation(machine.entity);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            initializeSeismicOutline(event.block, machine.entity, event.player);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const legacyLayout = machine.container.size >= 19
            ? LEGACY_SLOT_LAYOUT_19
            : LEGACY_SLOT_LAYOUT_18;
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, legacyLayout,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;

        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        syncSeismicOutlineIfNeeded(machine, mode.id);
        cleanupTargetStates();

        if (!isEnabled(machine.entity)) {
            pauseMachine(machine, settings.machine.energy_cost, "Disabled", mode);
            return;
        }
        if (!getPatternDirection(machine.block)) {
            resetMachine(machine, settings.machine.energy_cost, "Invalid Direction", mode);
            return;
        }

        const slottedTool = machine.container.getItem(TOOL_SLOT);
        if (slottedTool && !isPickaxe(slottedTool)) {
            resetMachine(machine, settings.machine.energy_cost, "Invalid Tool", mode, 0, slottedTool);
            return;
        }
        if (!hasOutputSpace(machine.container)) {
            pauseMachine(machine, settings.machine.energy_cost, "Output Full", mode, slottedTool);
            return;
        }

        const targetState = getTargetState(machine, mode.id);
        if (system.currentTick < targetState.nextScanTick) {
            resetMachine(machine, settings.machine.energy_cost, "Nothing to Break", mode, targetState.positions.length, slottedTool);
            return;
        }

        const targets = findBreakableTargets(machine.dimension, targetState.positions);
        if (targets.length === 0) {
            targetState.nextScanTick = system.currentTick + EMPTY_RESCAN_TICKS;
            resetMachine(machine, settings.machine.energy_cost, "Nothing to Break", mode, targetState.positions.length, slottedTool);
            return;
        }
        targetState.nextScanTick = 0;

        const energyCost = Math.max(1, settings.machine.energy_cost * targets.length);
        const operationKey = `${mode.id}|${slottedTool?.typeId ?? "hand"}|${targets.length}`;
        if (machine.entity.getDynamicProperty(OPERATION_KEY) !== operationKey) {
            setDynamicString(machine.entity, OPERATION_KEY, operationKey);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: energyCost,
            maxCrafts: 1,
            batch: 1,
        });

        let completed = null;
        if (result.processCount > 0) completed = breakTargets(machine, targets, slottedTool);

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
        displayProgress(machine, energyCost);

        const active = result.energyUsed > 0 || (completed?.broken ?? 0) > 0;
        const message = completed?.broken > 0
            ? `Broke ${completed.broken}`
            : (completed?.weak ?? 0) > 0
                ? "Tool Too Weak"
                : active ? "Charging" : "No Energy";
        renderStatus(machine, active, message, mode, slottedTool, {
            total: targetState.positions.length,
            targets: targets.length,
            energyCost,
            completed,
        });
    },

    onPlayerInteract(event, { params: settings }) {
        const machine = new Machine(event.block, { ...settings, ignoreTick: true });
        if (!machine.valid) return;
        handleSeismicOutlineInteract(event, getMode(machine.entity).id);
    },

    onPlayerBreak(event) {
        const machineEntity = event.dimension
            .getEntitiesAtBlockLocation(event.block.location)
            .find((entity) => entity.typeId === "utilitycraft:machine_entity");
        removeSeismicOutline(event.block, machineEntity);
        if (machineEntity) {
            targetStates.delete(machineEntity.id);
            ButtonManager.unwatchEntity(machineEntity);
        }
        Machine.onDestroy(event);
    },
});

function isPickaxe(item) {
    if (!item) return false;
    try {
        if (item.hasTag?.("minecraft:is_pickaxe") || item.hasTag?.("minecraft:pickaxe")) return true;
    } catch {}
    return item.typeId.split(":").pop()?.includes("pickaxe") === true;
}

function resetOperation(entity) {
    setDynamicString(entity, OPERATION_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
}

function getTargetState(machine, modeId) {
    const signature = getPatternConfigurationSignature(machine.block, modeId);
    let state = targetStates.get(machine.entity.id);
    if (!state || state.signature !== signature) {
        state = {
            signature,
            positions: buildPatternPositions(machine.block, modeId),
            nextScanTick: 0,
            lastSeenTick: system.currentTick,
        };
        targetStates.set(machine.entity.id, state);
    }
    state.lastSeenTick = system.currentTick;
    return state;
}

function findBreakableTargets(dimension, positions) {
    const targets = [];
    for (const position of positions) {
        const block = dimension.getBlock(position);
        if (isBreakable(block)) targets.push(position);
    }
    return targets;
}

function isBreakable(block) {
    return Boolean(block)
        && !block.isAir
        && !block.isLiquid
        && !unbreakableBlocks.has(block.typeId);
}

function hasOutputSpace(container) {
    return OUTPUT_SLOTS.some((slot) => {
        const item = container.getItem(slot);
        return !item || item.amount < item.maxAmount;
    });
}

function breakTargets(machine, targetPositions, tool) {
    let broken = 0;
    let stored = 0;
    let overflow = 0;
    let weak = 0;

    for (const position of targetPositions) {
        const block = machine.dimension.getBlock(position);
        if (!isBreakable(block)) continue;

        const drops = generateBlockLoot(block, tool);
        if (!drops) {
            weak++;
            continue;
        }
        if (!clearBlock(block)) continue;
        broken++;

        for (const stack of drops) {
            const inserted = storeStack(machine.container, stack);
            stored += inserted;
            const remaining = stack.amount - inserted;
            if (remaining > 0) {
                spawnStack(machine.dimension, stack, remaining, position);
                overflow += remaining;
            }
        }
    }
    return { broken, stored, overflow, weak };
}

function generateBlockLoot(block, tool) {
    try {
        return world.getLootTableManager().generateLootFromBlock(block, tool);
    } catch {
        return undefined;
    }
}

function clearBlock(block) {
    try {
        block.setType("minecraft:air");
        return true;
    } catch {
        return false;
    }
}

function storeStack(container, stack) {
    try {
        return DoriosLib.container.insert(container, {
            item: stack,
            slots: OUTPUT_SLOTS,
        });
    } catch {
        return 0;
    }
}

function spawnStack(dimension, template, amount, position) {
    if (amount <= 0) return;
    try {
        const stack = template.clone();
        stack.amount = amount;
        dimension.spawnItem(stack, {
            x: position.x + 0.5,
            y: position.y + 0.5,
            z: position.z + 0.5,
        });
    } catch {}
}

function resetMachine(machine, cost, message, mode, total = 0, tool) {
    resetOperation(machine.entity);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message, mode, tool, {
        total,
        targets: 0,
        energyCost: cost,
    });
}

function pauseMachine(machine, cost, message, mode, tool) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message, mode, tool, {
        total: 0,
        targets: 0,
        energyCost: cost,
    });
}

function renderStatus(machine, running, message, mode, tool, context) {
    const sections = [{
        title: "Breaking Information",
        lines: [
            `\u00A7r\u00A77Mode \u00A7f${mode.title}`,
            `\u00A7r\u00A77Tool \u00A7f${formatIdentifier(formatItem(tool?.typeId))}`,
            `\u00A7r\u00A77Targets \u00A7f${context.targets}/${context.total}`,
        ],
    }];
    if (context.completed) {
        sections.push({
            title: "Breaking Result",
            lines: [
                `\u00A7r\u00A7bStored \u00A7f${context.completed.stored ?? 0}`,
                `\u00A7r\u00A76Overflow \u00A7f${context.completed.overflow ?? 0}`,
                `\u00A7r\u00A7cTool Too Weak \u00A7f${context.completed.weak ?? 0}`,
            ],
        });
    }
    renderMachineInfo(machine, running, message, sections, { energyCost: context.energyCost, batch: 1 });
}

function formatItem(typeId) {
    if (!typeId) return "None (bare hand)";
    return typeId.split(":").pop().replace(/_/g, " ");
}

function cleanupTargetStates() {
    const tick = system.currentTick;
    if (tick - lastCacheCleanupTick < CACHE_CLEANUP_INTERVAL) return;
    lastCacheCleanupTick = tick;
    for (const [entityId, state] of targetStates) {
        if (tick - state.lastSeenTick > CACHE_EXPIRATION) targetStates.delete(entityId);
    }
}

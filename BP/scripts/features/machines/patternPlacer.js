// @ts-check

import { BlockPermutation, system } from "@minecraft/server";
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
    handlePatternOutlineInteract,
    initializePatternOutline,
    removePatternOutline,
    syncPatternOutlineIfNeeded,
} from "../../ATCore/spatial/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderMachineInfo,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:pattern_placer";
const INVENTORY_SIZE = 23;
const LEGACY_SLOT_LAYOUT_17 = [
    0, 1, 2, 3,
    4, 5, 6, 7, -1, -1, -1, -1, -1,
    10, 8, 9, -1,
    11, 12, 13, 14, 15, 16,
];
const LEGACY_SLOT_LAYOUT_19 = [
    0, 1, 2, 3,
    4, 5, 6, 7, -1, -1, -1, -1, -1,
    12, 9, 10, -1,
    13, 14, 15, 16, 17, 18,
];
const MODE_BUTTON_SLOT = 3;
const INPUT_SLOTS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const ACTIVATION_BUTTON_SLOT = 13;
const IO_BUTTON_SLOTS = [17, 18, 19, 20, 21, 22];
const MODE_KEY = "ascendant:pattern_placer_mode";
const ENABLED_KEY = "ascendant:pattern_placer_enabled";
const OPERATION_KEY = "ascendant:pattern_placer_operation";
const CACHE_CLEANUP_INTERVAL = 1200;
const CACHE_EXPIRATION = 6000;
const NO_SPACE_RESCAN_TICKS = 20;

const targetStates = new Map();
const permutationCache = new Map();
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
    setDynamicString(entity, MODE_KEY, next.id);
    setDynamicString(entity, OPERATION_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return `\u00A7r\u00A7f${next.short}`;
});

ButtonManager.registerMachineButton(ID, ACTIVATION_BUTTON_SLOT, ({ entity }) => {
    const next = !isEnabled(entity);
    setDynamicString(entity, ENABLED_KEY, next ? "true" : "false");
    setDynamicString(entity, OPERATION_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return next ? "\u00A7r\u00A7aON" : "\u00A7r\u00A7cOFF";
});

registerIOInterface(ID, {
    items: {
        buttonSlots: IO_BUTTON_SLOTS,
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
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
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7f1x1");
            setUiItem(machine.container, ACTIVATION_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aON");
            setDynamicString(machine.entity, MODE_KEY, "single");
            setDynamicString(machine.entity, ENABLED_KEY, "true");
            setDynamicString(machine.entity, OPERATION_KEY, "");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            initializePatternOutline(event.block, machine.entity, event.player);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const legacyLayout = machine.container.size >= 19
            ? LEGACY_SLOT_LAYOUT_19
            : LEGACY_SLOT_LAYOUT_17;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, legacyLayout)) return;

        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        syncPatternOutlineIfNeeded(machine, mode.id);
        cleanupTargetStates();

        if (!isEnabled(machine.entity)) {
            pauseMachine(machine, settings.machine.energy_cost, "Disabled", mode);
            return;
        }

        const direction = getPatternDirection(machine.block);
        if (!direction) {
            resetMachine(machine, settings.machine.energy_cost, "Invalid Direction", mode);
            return;
        }

        const input = selectBlockInput(machine.container);
        if (!input.selected) {
            resetMachine(
                machine,
                settings.machine.energy_cost,
                input.hasAnyInput ? "Invalid Block" : "Insert Blocks",
                mode,
            );
            return;
        }

        const targetState = getTargetState(machine, mode.id);
        const positions = targetState.positions;
        if (system.currentTick < targetState.nextScanTick) {
            resetMachine(machine, settings.machine.energy_cost, "No Space", mode, input, positions.length, 0);
            return;
        }

        const targets = findPlaceableTargets(machine.dimension, positions);
        const placeCount = Math.min(input.available, targets.length);
        if (placeCount <= 0) {
            targetState.nextScanTick = system.currentTick + NO_SPACE_RESCAN_TICKS;
            resetMachine(machine, settings.machine.energy_cost, "No Space", mode, input, positions.length, 0);
            return;
        }
        targetState.nextScanTick = 0;

        const energyCost = Math.max(1, settings.machine.energy_cost * placeCount);
        const operationKey = `${mode.id}|${input.selected.typeId}|${placeCount}`;
        if (machine.entity.getDynamicProperty(OPERATION_KEY) !== operationKey) {
            setDynamicString(machine.entity, OPERATION_KEY, operationKey);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: energyCost,
            maxCrafts: 1,
            batch: 1,
            rateMultiplier: 1,
        });

        let placed = 0;
        if (result.processCount > 0) {
            placed = placeBlocks(
                machine.dimension,
                targets,
                placeCount,
                input.selected.permutation,
            );
            if (placed > 0) {
                consumeMatchingInput(machine.container, input.selected.stack, placed);
            }
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
        displayProgress(machine, energyCost);

        const active = result.energyUsed > 0 || placed > 0;
        const message = placed > 0
            ? `Placed ${placed}`
            : active
                ? "Charging"
                : "No Energy";
        renderPatternStatus(machine, active, message, mode, input, positions.length, placeCount, energyCost);
    },

    onPlayerInteract(event, { params: settings }) {
        const machine = new Machine(event.block, { ...settings, ignoreTick: true });
        if (!machine.valid) return;
        handlePatternOutlineInteract(event, getMode(machine.entity).id);
    },

    onPlayerBreak(event) {
        const machineEntity = event.dimension
            .getEntitiesAtBlockLocation(event.block.location)
            .find((entity) => entity.typeId === "utilitycraft:machine_entity");
        removePatternOutline(event.block, machineEntity);
        if (machineEntity) {
            targetStates.delete(machineEntity.id);
            ButtonManager.unwatchEntity(machineEntity);
        }
        Machine.onDestroy(event);
    },
});

function selectBlockInput(container) {
    let selected = null;
    let hasAnyInput = false;

    for (const slot of INPUT_SLOTS) {
        const stack = container.getItem(slot);
        if (!stack || stack.amount <= 0) continue;
        hasAnyInput = true;
        if (selected) continue;

        const permutation = resolveBlockPermutation(stack.typeId);
        if (permutation) selected = { slot, stack, typeId: stack.typeId, permutation };
    }

    let available = 0;
    if (selected) {
        for (const slot of INPUT_SLOTS) {
            const stack = container.getItem(slot);
            if (stack && stacksMatch(stack, selected.stack)) available += stack.amount;
        }
    }
    return { selected, available, hasAnyInput };
}

function resolveBlockPermutation(typeId) {
    if (permutationCache.has(typeId)) return permutationCache.get(typeId);
    let permutation = null;
    try {
        permutation = BlockPermutation.resolve(typeId);
    } catch {}
    permutationCache.set(typeId, permutation);
    return permutation;
}

function stacksMatch(left, right) {
    return left?.isStackableWith?.(right) === true;
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

function findPlaceableTargets(dimension, positions) {
    const targets = [];
    for (const position of positions) {
        const block = dimension.getBlock(position);
        if (block?.isAir) targets.push(position);
    }
    return targets;
}

function placeBlocks(dimension, targets, requested, permutation) {
    let placed = 0;
    for (let index = 0; index < targets.length && placed < requested; index++) {
        const block = dimension.getBlock(targets[index]);
        if (!block?.isAir) continue;
        try {
            block.setPermutation(permutation);
            placed++;
        } catch {}
    }
    return placed;
}

function consumeMatchingInput(container, reference, requested) {
    let remaining = requested;
    for (const slot of INPUT_SLOTS) {
        if (remaining <= 0) break;
        const stack = container.getItem(slot);
        if (!stack || !stacksMatch(stack, reference)) continue;

        const consumed = Math.min(stack.amount, remaining);
        const nextAmount = stack.amount - consumed;
        if (nextAmount <= 0) container.setItem(slot, undefined);
        else {
            stack.amount = nextAmount;
            container.setItem(slot, stack);
        }
        remaining -= consumed;
    }
    return requested - remaining;
}

function resetMachine(machine, cost, message, mode, input = null, targetCount = 0, placeCount = 0) {
    setDynamicString(machine.entity, OPERATION_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderPatternStatus(machine, false, message, mode, input, targetCount, placeCount, cost);
}

function pauseMachine(machine, cost, message, mode) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderPatternStatus(machine, false, message, mode, null, 0, 0, cost);
}

function renderPatternStatus(machine, running, message, mode, input, targetCount, placeCount, energyCost) {
    const blockName = input?.selected?.typeId
        ? input.selected.typeId.split(":").pop().replace(/_/g, " ")
        : "None";
    renderMachineInfo(machine, running, message, [{
        title: "Pattern Information",
        lines: [
            `\u00A7r\u00A77Mode \u00A7f${mode.title}`,
            `\u00A7r\u00A77Block \u00A7f${blockName}`,
            `\u00A7r\u00A77Available \u00A7f${input?.available ?? 0}`,
            `\u00A7r\u00A77Targets \u00A7f${placeCount}/${targetCount}`,
        ],
    }], { energyCost, batch: 1 });
}

function cleanupTargetStates() {
    const tick = system.currentTick;
    if (tick - lastCacheCleanupTick < CACHE_CLEANUP_INTERVAL) return;
    lastCacheCleanupTick = tick;
    for (const [entityId, state] of targetStates) {
        if (tick - state.lastSeenTick > CACHE_EXPIRATION) targetStates.delete(entityId);
    }
}

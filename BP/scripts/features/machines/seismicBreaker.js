// @ts-check

import { system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
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
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:seismic_breaker";
const MODE_BUTTON_SLOT = 3;
const PRECISION_BUTTON_SLOT = 4;
const OUTPUT_SLOTS = [5, 6, 7, 8];
const ACTIVATION_BUTTON_SLOT = 12;
const IO_BUTTON_SLOTS = [13, 14, 15, 16, 17, 18];
const MODE_KEY = "ascendant:seismic_breaker_mode";
const PRECISION_KEY = "ascendant:seismic_breaker_precision";
const ENABLED_KEY = "ascendant:seismic_breaker_enabled";
const OPERATION_KEY = "ascendant:seismic_breaker_operation";
const EMPTY_RESCAN_TICKS = 20;
const DROP_COLLECTION_DELAY = 3;
const CACHE_CLEANUP_INTERVAL = 1200;
const CACHE_EXPIRATION = 6000;

const unbreakableBlocks = new Set(DoriosLib.constants.UNBREAKABLE_BLOCKS);
const targetStates = new Map();
let lastCacheCleanupTick = 0;

function getMode(entity) {
    return getPatternMode(entity.getDynamicProperty(MODE_KEY));
}

function isPrecisionEnabled(entity) {
    return entity.getDynamicProperty(PRECISION_KEY) === "true";
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

ButtonManager.registerMachineButton(ID, PRECISION_BUTTON_SLOT, ({ entity }) => {
    const next = !isPrecisionEnabled(entity);
    resetOperation(entity);
    setDynamicString(entity, PRECISION_KEY, next ? "true" : "false");
    return next ? "\u00A7r\u00A7bON" : "\u00A7r\u00A77OFF";
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
        anyInputSlots: [],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([11]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A761x1");
            setUiItem(machine.container, PRECISION_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A77OFF");
            setUiItem(machine.container, ACTIVATION_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aON");
            setDynamicString(machine.entity, MODE_KEY, "single");
            setDynamicString(machine.entity, PRECISION_KEY, "false");
            setDynamicString(machine.entity, ENABLED_KEY, "true");
            setDynamicString(machine.entity, OPERATION_KEY, "");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            initializeSeismicOutline(event.block, machine.entity, event.player);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        const precision = isPrecisionEnabled(machine.entity);
        syncSeismicOutlineIfNeeded(machine, mode.id);
        cleanupTargetStates();

        if (!isEnabled(machine.entity)) {
            pauseMachine(machine, settings.machine.energy_cost, "Disabled", mode, precision);
            return;
        }

        if (!getPatternDirection(machine.block)) {
            resetMachine(machine, settings.machine.energy_cost, "Invalid Direction", mode, precision);
            return;
        }

        if (!hasOutputSpace(machine.container)) {
            pauseMachine(machine, settings.machine.energy_cost, "Output Full", mode, precision);
            return;
        }

        const targetState = getTargetState(machine, mode.id);
        if (system.currentTick < targetState.nextScanTick) {
            resetMachine(machine, settings.machine.energy_cost, "Nothing to Break", mode, precision, targetState.positions.length);
            return;
        }

        const targets = findBreakableTargets(machine.dimension, targetState.positions);
        if (targets.length === 0) {
            targetState.nextScanTick = system.currentTick + EMPTY_RESCAN_TICKS;
            resetMachine(machine, settings.machine.energy_cost, "Nothing to Break", mode, precision, targetState.positions.length);
            return;
        }
        targetState.nextScanTick = 0;

        const energyCost = Math.max(1, settings.machine.energy_cost * targets.length);
        const operationKey = `${mode.id}|${precision ? 1 : 0}|${targets.length}`;
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

        let completed = null;
        if (result.processCount > 0) {
            completed = breakTargets(machine, targets, precision, settings);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
        displayProgress(machine, energyCost);

        const active = result.energyUsed > 0 || (completed?.broken ?? 0) > 0;
        const message = completed?.broken > 0
            ? `Broke ${completed.broken}`
            : active
                ? "Charging"
                : "No Energy";
        renderStatus(machine, active, message, mode, precision, {
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
    for (const slot of OUTPUT_SLOTS) {
        const item = container.getItem(slot);
        if (!item || item.amount < item.maxAmount) return true;
    }
    return false;
}

function breakTargets(machine, targetPositions, precision, settings) {
    const preexistingItemIds = getNearbyItemIds(machine.dimension, targetPositions);
    const normalDropPositions = [];
    let broken = 0;
    let stored = 0;
    let overflow = 0;
    let precisionDrops = 0;

    for (const position of targetPositions) {
        const block = machine.dimension.getBlock(position);
        if (!isBreakable(block)) continue;

        if (precision) {
            const drops = generatePrecisionDrops(block);
            if (drops.length > 0 && clearBlock(block)) {
                broken++;
                precisionDrops++;
                for (const stack of drops) {
                    const inserted = storeStack(machine.container, stack);
                    stored += inserted;
                    const remaining = stack.amount - inserted;
                    if (remaining > 0) {
                        spawnStack(machine.dimension, stack, remaining, position);
                        overflow += remaining;
                    }
                }
                continue;
            }
        }

        if (destroyWithDrops(machine.dimension, position)) {
            broken++;
            normalDropPositions.push(position);
        }
    }

    if (normalDropPositions.length > 0) {
        scheduleDropCollection(machine, normalDropPositions, preexistingItemIds, settings);
    }
    return { broken, stored, overflow, precisionDrops };
}

function generatePrecisionDrops(block) {
    try {
        const lootManager = world.getLootTableManager?.();
        if (!lootManager) return [];
        const fromPermutation = lootManager.generateLootFromBlockPermutation?.(block.permutation);
        if (Array.isArray(fromPermutation) && fromPermutation.length > 0) {
            return fromPermutation.filter(Boolean);
        }
        const fromBlock = lootManager.generateLootFromBlock?.(block);
        return Array.isArray(fromBlock) ? fromBlock.filter(Boolean) : [];
    } catch {
        return [];
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

function destroyWithDrops(dimension, position) {
    try {
        dimension.runCommand(`setblock ${position.x} ${position.y} ${position.z} air destroy`);
        return true;
    } catch {
        return false;
    }
}

function storeStack(container, stack) {
    try {
        return DoriosLib.containers.insert(container, {
            item: stack,
            slots: OUTPUT_SLOTS,
        });
    } catch {
        return 0;
    }
}

function spawnStack(dimension, template, amount, position, centerOnBlock = true) {
    if (amount <= 0) return;
    try {
        const stack = template.clone();
        stack.amount = amount;
        dimension.spawnItem(stack, {
            x: position.x + (centerOnBlock ? 0.5 : 0),
            y: position.y + (centerOnBlock ? 0.5 : 0),
            z: position.z + (centerOnBlock ? 0.5 : 0),
        });
    } catch {}
}

function scheduleDropCollection(machine, positions, excludedIds, settings) {
    const machineLocation = { ...machine.block.location };
    const positionKeys = new Set(positions.map(positionKey));
    const bounds = collectionBounds(positions);

    system.runTimeout(() => {
        const block = machine.dimension.getBlock(machineLocation);
        if (!block || block.typeId !== ID) return;
        const delayed = new Machine(block, { ...settings, ignoreTick: true });
        if (!delayed.valid) return;
        delayed.processIO();
        collectNewDrops(delayed, positionKeys, bounds, excludedIds);
    }, DROP_COLLECTION_DELAY);
}

function collectNewDrops(machine, positionKeys, bounds, excludedIds) {
    const entities = machine.dimension.getEntities({
        type: "item",
        location: bounds.center,
        maxDistance: bounds.radius,
    });

    for (const entity of entities) {
        if (excludedIds.has(entity.id) || !nearTargetCell(entity.location, positionKeys)) continue;
        const stack = entity.getComponent("minecraft:item")?.itemStack;
        if (!stack) continue;
        const inserted = storeStack(machine.container, stack);
        if (inserted <= 0) continue;

        const remaining = stack.amount - inserted;
        const location = entity.location;
        try {
            entity.remove();
        } catch {
            continue;
        }
        if (remaining > 0) spawnStack(machine.dimension, stack, remaining, location, false);
    }
}

function getNearbyItemIds(dimension, positions) {
    const bounds = collectionBounds(positions);
    return new Set(dimension.getEntities({
        type: "item",
        location: bounds.center,
        maxDistance: bounds.radius,
    }).map((entity) => entity.id));
}

function collectionBounds(positions) {
    let minX = positions[0].x;
    let maxX = minX;
    let minY = positions[0].y;
    let maxY = minY;
    let minZ = positions[0].z;
    let maxZ = minZ;
    for (let index = 1; index < positions.length; index++) {
        const position = positions[index];
        minX = Math.min(minX, position.x);
        maxX = Math.max(maxX, position.x);
        minY = Math.min(minY, position.y);
        maxY = Math.max(maxY, position.y);
        minZ = Math.min(minZ, position.z);
        maxZ = Math.max(maxZ, position.z);
    }
    const center = {
        x: (minX + maxX + 1) / 2,
        y: (minY + maxY + 1) / 2,
        z: (minZ + maxZ + 1) / 2,
    };
    const dx = maxX - minX + 2;
    const dy = maxY - minY + 2;
    const dz = maxZ - minZ + 2;
    return { center, radius: Math.sqrt(dx * dx + dy * dy + dz * dz) / 2 + 1 };
}

function positionKey(position) {
    return `${position.x},${position.y},${position.z}`;
}

function nearTargetCell(location, positionKeys) {
    const baseX = Math.floor(location.x);
    const baseY = Math.floor(location.y);
    const baseZ = Math.floor(location.z);
    for (let y = baseY - 1; y <= baseY + 1; y++) {
        for (let x = baseX - 1; x <= baseX + 1; x++) {
            for (let z = baseZ - 1; z <= baseZ + 1; z++) {
                if (positionKeys.has(`${x},${y},${z}`)) return true;
            }
        }
    }
    return false;
}

function resetMachine(machine, cost, message, mode, precision, total = 0) {
    resetOperation(machine.entity);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message, mode, precision, {
        total,
        targets: 0,
        energyCost: cost,
    });
}

function pauseMachine(machine, cost, message, mode, precision) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message, mode, precision, {
        total: 0,
        targets: 0,
        energyCost: cost,
    });
}

function renderStatus(machine, running, message, mode, precision, context) {
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);
    const lines = [
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${message}`,
        `\u00A7r\u00A77Mode: \u00A7f${mode.title}`,
        `\u00A7r\u00A77Precision: ${precision ? "\u00A7bOn" : "\u00A77Off"}`,
        `\u00A7r\u00A77Targets: \u00A7f${context.targets}/${context.total}`,
        `\u00A7r\u00A77Cost: \u00A7f${EnergyStorage.formatEnergyToText(context.energyCost)} DE`,
    ];
    if (context.completed?.precisionDrops > 0) {
        lines.push(`\u00A7r\u00A7bPrecision blocks: ${context.completed.precisionDrops}`);
    }
    if (context.completed?.overflow > 0) {
        lines.push(`\u00A7r\u00A76Overflow: ${context.completed.overflow}`);
    }
    machine.setLabel(lines);
}

function cleanupTargetStates() {
    const tick = system.currentTick;
    if (tick - lastCacheCleanupTick < CACHE_CLEANUP_INTERVAL) return;
    lastCacheCleanupTick = tick;
    for (const [entityId, state] of targetStates) {
        if (tick - state.lastSeenTick > CACHE_EXPIRATION) targetStates.delete(entityId);
    }
}

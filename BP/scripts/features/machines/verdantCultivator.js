// @ts-check

import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    handleVerdantOutlineInteract,
    initializeVerdantOutline,
    getVerdantCropByBlock,
    getVerdantCropBySeed,
    removeVerdantOutline,
    syncVerdantOutlineIfNeeded,
} from "../../ATCore/agriculture/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderMachineInfo,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:verdant_cultivator";
const INVENTORY_SIZE = 32;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    -1, -1, -1, -1, -1, -1,
    20, 21, 22, 23, 24, 25,
];
const SEED_SLOTS = [3, 4, 5, 6];
const CLOCK_SLOT = 7;
const OUTPUT_SLOTS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
const CONFIGURATION_KEY = "ascendant:verdant_configuration";
const BASE_SIDE_LENGTH = 3;
const MAX_RANGE_LEVEL = 4;
const MACHINE_UPDATES_PER_SECOND = 5;
const DROP_COLLECTION_DELAY = 3;
const fieldStates = new Map();
let lastCacheCleanupTick = 0;

const tillableSoils = new Set([
    "minecraft:dirt",
    "minecraft:grass",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:dirt_with_roots",
]);

const CLOCKS = Object.freeze({
    "utilitycraft:accelerator_clock": Object.freeze({ title: "Accelerator", baseChance: 0.1875, bonusStepChance: 0, speed: 1, pulses: 1 }),
    "utilitycraft:diamond_accelerator_clock": Object.freeze({ title: "Diamond", baseChance: 0.5, bonusStepChance: 0, speed: 2, pulses: 2 }),
    "utilitycraft:nether_star_accelerator_clock": Object.freeze({ title: "Nether Star", baseChance: 1, bonusStepChance: 0.25, speed: 4, pulses: 4 }),
});
const CROP_TIER_MULTIPLIERS = Object.freeze({ 0: 1, 1: 1, 2: 4 / 7, 3: 4 / 11, 4: 1 / 4 });

registerIOInterface(ID, {
    items: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
        anyInputSlots: [...SEED_SLOTS, CLOCK_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: SEED_SLOTS },
            { id: "input_2", inputSlots: [CLOCK_SLOT] },
            { id: "input_3", inputSlots: [...SEED_SLOTS, CLOCK_SLOT] },
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
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, CONFIGURATION_KEY, "");
            initializeVerdantOutline(event.block, event.player);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;
        machine.processIO();

        const configuration = readConfiguration(machine);
        syncVerdantOutlineIfNeeded(machine, configuration.rangeLevel);
        if (!configuration.direction) {
            resetProcess(machine, settings.machine.energy_cost, "Invalid Direction", configuration);
            return;
        }

        const state = getFieldState(machine, configuration);
        updateFieldScan(machine, state);
        cleanupFieldStates();

        const storedConfiguration = String(machine.entity.getDynamicProperty(CONFIGURATION_KEY) ?? "");
        if (storedConfiguration !== configuration.operationSignature) {
            setDynamicString(machine.entity, CONFIGURATION_KEY, configuration.operationSignature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        if (!state.snapshot) {
            resetProcess(machine, settings.machine.energy_cost, "Scanning Field", configuration, false);
            return;
        }

        const operation = buildOperation(machine, configuration, state.snapshot, state.biomeId);
        if (!operation.hasOperatingProfile) {
            resetProcess(
                machine,
                settings.machine.energy_cost,
                configuration.invalidSeedCount > 0 ? "Unsupported Seed" : "Insert Seeds",
                configuration,
            );
            return;
        }

        if (!operation.ready) {
            resetProcess(machine, settings.machine.energy_cost, operation.message, operation);
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: operation.energyCost,
            maxCrafts: 1,
            batch: 1,
            rateMultiplier: getRateMultiplier(
                settings.machine.rate_speed_base,
                operation.energyCost,
                operation.cycleSeconds,
            ),
        });

        let completed = null;
        if (result.processCount > 0) {
            completed = executeOperation(machine, operation, settings);
            invalidateFieldState(state);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", operation.energyCost);
        displayProgress(machine, operation.energyCost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        const message = completed
            ? completedMessage(completed)
            : active
                ? chargingMessage(operation)
                : "No Energy";
        renderStatus(machine, active, message, operation, completed);
    },

    onPlayerInteract(event, { params: settings }) {
        const machine = new Machine(event.block, { ...settings, ignoreTick: true });
        if (!machine.valid) return;
        const rangeLevel = Math.max(
            0,
            Math.min(MAX_RANGE_LEVEL, Math.floor(machine.boosts.range ?? 0)),
        );
        handleVerdantOutlineInteract(event, rangeLevel);
    },

    onPlayerBreak(event) {
        removeVerdantOutline(event.block);
        const entity = event.dimension
            .getEntitiesAtBlockLocation(event.block.location)
            .find((candidate) => candidate.typeId === "utilitycraft:machine_entity");
        if (entity?.id) fieldStates.delete(entity.id);
        Machine.onDestroy(event);
    },
});

function readConfiguration(machine) {
    const direction = machine.block.permutation.getState("minecraft:cardinal_direction");
    const vectors = directionVectors(direction);
    const rangeLevel = Math.max(0, Math.min(MAX_RANGE_LEVEL, Math.floor(machine.boosts.range ?? 0)));
    const sideLength = BASE_SIDE_LENGTH + rangeLevel * 2;
    const clockItem = machine.container.getItem(CLOCK_SLOT);
    const clock = clockItem ? CLOCKS[clockItem.typeId] ?? null : null;
    const processBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const templates = new Array(SEED_SLOTS.length);
    let validSeedCount = 0;
    let invalidSeedCount = 0;
    let templateSignature = "";

    for (let index = 0; index < SEED_SLOTS.length; index++) {
        const slot = SEED_SLOTS[index];
        const item = machine.container.getItem(slot);
        const spec = item ? getVerdantCropBySeed(item.typeId) : null;
        if (item && spec) validSeedCount++;
        else if (item) invalidSeedCount++;
        templates[index] = { slot, typeId: item?.typeId ?? "", amount: item?.amount ?? 0, spec };
        templateSignature += `${index ? "," : ""}${item?.typeId ?? "-"}`;
    }

    const layoutSignature = `${direction}|${sideLength}|${templateSignature}`;
    const operationSignature = `${layoutSignature}|${clockItem?.typeId ?? "-"}|${processBatch}`;
    return {
        direction,
        vectors,
        rangeLevel,
        sideLength,
        clock,
        processBatch,
        templates,
        validSeedCount,
        invalidSeedCount,
        layoutSignature,
        operationSignature,
        bufferFilledSlots: machine.shouldUpdateUI ? countFilledOutputs(machine.container) : 0,
    };
}

function directionVectors(direction) {
    if (direction === "north") return { forwardX: 0, forwardZ: -1, rightX: 1, rightZ: 0 };
    if (direction === "south") return { forwardX: 0, forwardZ: 1, rightX: -1, rightZ: 0 };
    if (direction === "east") return { forwardX: 1, forwardZ: 0, rightX: 0, rightZ: 1 };
    if (direction === "west") return { forwardX: -1, forwardZ: 0, rightX: 0, rightZ: -1 };
    return null;
}

function getFieldState(machine, configuration) {
    let state = fieldStates.get(machine.entity.id);
    if (!state || state.signature !== configuration.layoutSignature) {
        const cells = buildFieldCells(machine.block.location, configuration);
        state = {
            signature: configuration.layoutSignature,
            cells,
            evaluations: new Array(cells.length),
            cursor: 0,
            snapshot: null,
            nextScanTick: 0,
            biomeId: getBiomeId(machine.dimension, cells[0]?.position ?? machine.block.location),
            lastSeenTick: system.currentTick,
        };
        fieldStates.set(machine.entity.id, state);
    }
    state.lastSeenTick = system.currentTick;
    return state;
}

function buildFieldCells(origin, configuration) {
    const pattern = buildSeedPattern(configuration.templates);
    const cells = new Array(configuration.sideLength * configuration.sideLength);
    const halfWidth = Math.floor(configuration.sideLength / 2);
    let index = 0;

    for (let row = 0; row < configuration.sideLength; row++) {
        for (let column = 0; column < configuration.sideLength; column++) {
            const lateral = column - halfWidth;
            const template = pattern.cells.length > 0
                ? pattern.cells[(row % pattern.height) * pattern.width + (column % pattern.width)]
                : null;
            cells[index++] = {
                templateSlot: template?.slot,
                templateSpec: template?.spec ?? null,
                position: {
                    x: origin.x + configuration.vectors.forwardX * (row + 1) + configuration.vectors.rightX * lateral,
                    y: origin.y,
                    z: origin.z + configuration.vectors.forwardZ * (row + 1) + configuration.vectors.rightZ * lateral,
                },
            };
        }
    }
    return cells;
}

function buildSeedPattern(templates) {
    const activeRows = [];
    const activeColumns = [];
    let first = null;
    for (let index = 0; index < templates.length; index++) {
        if (!templates[index].spec) continue;
        const row = Math.floor(index / 2);
        const column = index % 2;
        if (!activeRows.includes(row)) activeRows.push(row);
        if (!activeColumns.includes(column)) activeColumns.push(column);
        first ??= templates[index];
    }
    if (!first) return { cells: [], width: 0, height: 0 };

    const cells = [];
    for (const row of activeRows) {
        for (const column of activeColumns) {
            let selected = templates[row * 2 + column];
            if (!selected?.spec) selected = templates.find((entry, index) => entry.spec && Math.floor(index / 2) === row);
            if (!selected?.spec) selected = templates.find((entry, index) => entry.spec && index % 2 === column);
            cells.push(selected?.spec ? selected : first);
        }
    }
    return {
        cells,
        width: activeColumns.length,
        height: activeRows.length,
    };
}

function updateFieldScan(machine, state) {
    const currentTick = system.currentTick;
    if (state.cursor === 0 && state.snapshot && currentTick < state.nextScanTick) return false;

    const budget = Math.max(9, Math.ceil(state.cells.length / 8));
    const end = Math.min(state.cells.length, state.cursor + budget);
    for (let index = state.cursor; index < end; index++) {
        state.evaluations[index] = evaluateCell(machine, state.cells[index]);
    }
    state.cursor = end;
    if (state.cursor < state.cells.length) return false;

    state.snapshot = buildSnapshot(state.cells, state.evaluations);
    state.cursor = 0;
    state.nextScanTick = currentTick + scanInterval(state.snapshot);
    return true;
}

function evaluateCell(machine, cell) {
    const block = machine.dimension.getBlock(cell.position);
    if (!block) return { kind: "blocked", spec: null };

    const crop = getVerdantCropByBlock(block.typeId);
    if (crop) {
        const age = block.permutation.getState(crop.ageState);
        if (typeof age === "number" && age >= crop.maxAge) return { kind: "harvest", spec: crop };
        if (typeof age === "number" && age < crop.maxAge) return { kind: "grow", spec: crop };
        return { kind: "monitor", spec: crop };
    }
    if (!block.isAir) return { kind: "blocked", spec: null };
    if (!cell.templateSpec) return { kind: "idle", spec: null };

    const soil = machine.dimension.getBlock({
        x: cell.position.x,
        y: cell.position.y - 1,
        z: cell.position.z,
    });
    return soil && resolveSoil(soil.typeId, cell.templateSpec).valid
        ? { kind: "plant", spec: cell.templateSpec }
        : { kind: "invalid_soil", spec: cell.templateSpec };
}

function buildSnapshot(cells, evaluations) {
    const snapshot = {
        harvestTargets: [],
        plantCandidates: [],
        growthTargets: [],
        detectedCropCount: 0,
        blockedCount: 0,
        invalidSoilCount: 0,
    };

    for (let index = 0; index < cells.length; index++) {
        const evaluation = evaluations[index];
        const target = evaluation?.spec ? { ...cells[index], spec: evaluation.spec } : cells[index];
        if (evaluation?.kind === "harvest") {
            snapshot.harvestTargets.push(target);
            snapshot.detectedCropCount++;
        } else if (evaluation?.kind === "plant") snapshot.plantCandidates.push(target);
        else if (evaluation?.kind === "grow") {
            snapshot.growthTargets.push(target);
            snapshot.detectedCropCount++;
        } else if (evaluation?.kind === "monitor") snapshot.detectedCropCount++;
        else if (evaluation?.kind === "blocked") snapshot.blockedCount++;
        else if (evaluation?.kind === "invalid_soil") snapshot.invalidSoilCount++;
    }
    return snapshot;
}

function scanInterval(snapshot) {
    if (snapshot.harvestTargets.length || snapshot.plantCandidates.length || snapshot.growthTargets.length) return 4;
    if (snapshot.blockedCount || snapshot.invalidSoilCount) return 16;
    return snapshot.detectedCropCount ? 8 : 20;
}

function invalidateFieldState(state) {
    state.cursor = 0;
    state.snapshot = null;
    state.nextScanTick = 0;
}

function buildOperation(machine, configuration, snapshot, biomeId) {
    const plantTargets = [];
    const budgets = new Map();
    for (const template of configuration.templates) {
        if (template.spec && template.amount > 0) budgets.set(template.slot, template.amount);
    }
    for (const target of snapshot.plantCandidates) {
        const remaining = budgets.get(target.templateSlot) ?? 0;
        if (remaining <= 0) continue;
        budgets.set(target.templateSlot, remaining - 1);
        plantTargets.push(target);
    }

    const biomeBonus = resolveBiomeBonus(configuration.templates, snapshot, biomeId);
    const pulseCount = configuration.clock
        ? Math.min(snapshot.growthTargets.length, configuration.processBatch * configuration.clock.pulses + (biomeBonus.active ? 1 : 0))
        : 0;
    const harvestCount = snapshot.harvestTargets.length;
    const plantCount = plantTargets.length + harvestCount;
    const ready = harvestCount > 0 || plantTargets.length > 0 || pulseCount > 0;
    const energyCost = ready
        ? 1200
            + configuration.sideLength * 120
            + harvestCount * 900
            + plantCount * 260
            + pulseCount * 380
        : 0;
    const cycleSeconds = ready
        ? 1.1
            + configuration.sideLength * 0.18
            + Math.min(2.4, harvestCount * 0.08)
            + Math.min(1.8, plantCount * 0.06)
            + pulseCount * 0.7
        : 0;
    const acceleratedCycleSeconds = cycleSeconds / Math.max(1, configuration.clock?.speed ?? 1);

    let message = "Monitoring";
    if (!ready && snapshot.invalidSoilCount > 0) message = "Invalid Soil";
    else if (!ready && snapshot.blockedCount > 0) message = "Field Blocked";

    return {
        ...configuration,
        ...snapshot,
        plantTargets,
        biomeId,
        biomeBonus,
        pulseCount,
        hasOperatingProfile: configuration.validSeedCount > 0 || snapshot.detectedCropCount > 0,
        ready,
        message,
        energyCost,
        cycleSeconds: acceleratedCycleSeconds,
        bufferFilledSlots: countFilledOutputs(machine.container),
    };
}

function resolveBiomeBonus(templates, snapshot, biomeId) {
    if (!biomeId) return { active: false, title: null };
    const normalized = biomeId.toLowerCase();
    const specs = [];
    for (const template of templates) if (template.spec) specs.push(template.spec);
    for (const target of snapshot.harvestTargets) specs.push(target.spec);
    for (const target of snapshot.growthTargets) specs.push(target.spec);

    for (const spec of specs) {
        for (const token of spec.biomeTokens) {
            if (normalized.includes(token)) return { active: true, title: spec.biomeTitle ?? "Biome Surge" };
        }
    }
    return { active: false, title: null };
}

function executeOperation(machine, operation, settings) {
    let harvested = 0;
    let planted = 0;
    let pulsed = 0;
    const harvestedPositions = [];
    const harvestedSpecs = new Set();

    if (operation.pulseCount > 0 && operation.growthTargets.length > 0) {
        const start = Math.floor(Math.random() * operation.growthTargets.length);
        for (let offset = 0; offset < operation.pulseCount; offset++) {
            const target = operation.growthTargets[(start + offset) % operation.growthTargets.length];
            if (growCrop(machine, target, operation.clock)) pulsed++;
        }
    }

    for (const target of operation.harvestTargets) {
        const block = machine.dimension.getBlock(target.position);
        if (!block || block.typeId !== target.spec.cropBlockId || !isMature(block, target.spec)) continue;
        if (!destroyCrop(machine, target.position)) continue;
        harvested++;
        harvestedPositions.push(target.position);
        harvestedSpecs.add(target.spec);
        if (plantAt(machine, target.position, target.spec)) planted++;
    }

    for (const target of operation.plantTargets) {
        if (!consumeSeed(machine.container, target.templateSlot, target.spec.seedItemId)) continue;
        if (plantAt(machine, target.position, target.spec)) planted++;
        else restoreSeed(machine.container, target.templateSlot, target.spec.seedItemId);
    }

    if (harvestedPositions.length > 0) {
        scheduleDropCollection(machine, harvestedPositions, harvestedSpecs, operation, settings);
    }
    return { harvested, planted, pulsed };
}

function growCrop(machine, target, clock) {
    const block = machine.dimension.getBlock(target.position);
    if (!block || block.typeId !== target.spec.cropBlockId) return false;
    const age = block.permutation.getState(target.spec.ageState);
    if (typeof age !== "number" || age >= target.spec.maxAge) return false;
    if (!clock) return false;
    const tier = Number(block.permutation.getState("utilitycraft:tier") ?? 0);
    const chance = Math.min(1, clock.baseChance * (CROP_TIER_MULTIPLIERS[tier] ?? 1));
    if (Math.random() > chance) return false;
    try {
        const bonus = age + 1 < target.spec.maxAge && Math.random() < clock.bonusStepChance ? 1 : 0;
        block.setPermutation(block.permutation.withState(target.spec.ageState, Math.min(target.spec.maxAge, age + 1 + bonus)));
        return true;
    } catch {
        return false;
    }
}

function isMature(block, spec) {
    const age = block.permutation.getState(spec.ageState);
    return typeof age === "number" && age >= spec.maxAge;
}

function destroyCrop(machine, position) {
    try {
        const result = machine.dimension.runCommand(`setblock ${position.x} ${position.y} ${position.z} air destroy`);
        return (result?.successCount ?? 1) > 0;
    } catch {
        return false;
    }
}

function plantAt(machine, position, spec) {
    const block = machine.dimension.getBlock(position);
    const soil = machine.dimension.getBlock({ x: position.x, y: position.y - 1, z: position.z });
    if (!block?.isAir || !soil) return false;
    const soilPlan = resolveSoil(soil.typeId, spec);
    if (!soilPlan.valid) return false;

    try {
        if (soilPlan.till) soil.setType("minecraft:farmland");
        block.setPermutation(BlockPermutation.resolve(spec.cropBlockId, { [spec.ageState]: 0 }));
        return true;
    } catch {
        return false;
    }
}

function resolveSoil(soilTypeId, spec) {
    if (spec.validSoilIds.has(soilTypeId)) return { valid: true, till: false };
    if (spec.validSoilIds.has("minecraft:farmland") && tillableSoils.has(soilTypeId)) {
        return { valid: true, till: true };
    }
    return { valid: false, till: false };
}

function consumeSeed(container, slot, typeId) {
    const item = container.getItem(slot);
    if (!item || item.typeId !== typeId) return false;
    if (item.amount <= 1) container.setItem(slot, undefined);
    else {
        item.amount--;
        container.setItem(slot, item);
    }
    return true;
}

function restoreSeed(container, slot, typeId) {
    const current = container.getItem(slot);
    if (!current) container.setItem(slot, new ItemStack(typeId, 1));
    else if (current.typeId === typeId && current.amount < current.maxAmount) {
        current.amount++;
        container.setItem(slot, current);
    }
}

function scheduleDropCollection(machine, positions, specs, operation, settings) {
    const machineLocation = { ...machine.block.location };
    const harvestedKeys = new Set(positions.map(positionKey));
    const pickupIds = new Set();
    const exclusions = new Set();
    for (const spec of specs) {
        for (const typeId of spec.pickupItemIds) pickupIds.add(typeId);
        for (const typeId of spec.bonusExclusions) exclusions.add(typeId);
    }
    const bounds = collectionBounds(positions);
    const bonusLevels = Math.max(0, operation.processBatch - 1);
    const biomeBonus = operation.biomeBonus.active;

    system.runTimeout(() => {
        const block = machine.dimension.getBlock(machineLocation);
        if (!block || block.typeId !== ID) return;
        const delayed = new Machine(block, { ...settings, ignoreTick: true });
        if (!delayed.valid) return;
        delayed.processIO();
        collectDrops(delayed, harvestedKeys, pickupIds, exclusions, bounds, bonusLevels, biomeBonus);
    }, DROP_COLLECTION_DELAY);
}

function collectDrops(machine, harvestedKeys, pickupIds, exclusions, bounds, bonusLevels, biomeBonus) {
    const entities = machine.dimension.getEntities({
        type: "item",
        location: bounds.center,
        maxDistance: bounds.radius,
    });

    for (const entity of entities) {
        const stack = entity.getComponent("minecraft:item")?.itemStack;
        if (!stack || !pickupIds.has(stack.typeId) || !nearHarvestedCell(entity.location, harvestedKeys)) continue;
        const bonus = bonusEligible(stack.typeId, exclusions)
            ? rollBonus(bonusLevels, biomeBonus)
            : 0;
        const total = stack.amount + bonus;
        const inserted = storeHarvest(machine.container, stack, total);
        if (inserted <= 0 && bonus === 0) continue;
        entity.remove();
        if (inserted < total) spawnOverflow(machine, stack, total - inserted);
    }
}

function nearHarvestedCell(location, harvestedKeys) {
    const baseX = Math.floor(location.x);
    const baseY = Math.floor(location.y);
    const baseZ = Math.floor(location.z);
    for (let y = baseY - 1; y <= baseY + 1; y++) {
        for (let x = baseX - 1; x <= baseX + 1; x++) {
            for (let z = baseZ - 1; z <= baseZ + 1; z++) {
                if (harvestedKeys.has(`${x},${y},${z}`)) return true;
            }
        }
    }
    return false;
}

function storeHarvest(container, template, amount) {
    let remaining = amount;
    const seedSpec = getVerdantCropBySeed(template.typeId);
    if (seedSpec) {
        const preferredSlots = preferredSeedSlots(container, template.typeId);
        remaining -= insertIntoSlots(container, template, remaining, preferredSlots);
    }
    if (remaining > 0) remaining -= insertIntoSlots(container, template, remaining, OUTPUT_SLOTS);
    return amount - remaining;
}

function preferredSeedSlots(container, typeId) {
    const matching = [];
    let firstEmpty = -1;
    for (const slot of SEED_SLOTS) {
        const current = container.getItem(slot);
        if (!current) {
            if (firstEmpty < 0) firstEmpty = slot;
        } else if (current.typeId === typeId && current.amount < current.maxAmount) {
            matching.push(slot);
        }
    }
    return matching.length > 0 ? matching : firstEmpty >= 0 ? [firstEmpty] : [];
}

function insertIntoSlots(container, template, amount, slots) {
    let remaining = amount;
    for (const slot of slots) {
        if (remaining <= 0) break;
        const current = container.getItem(slot);
        if (!current || !current.isStackableWith(template)) continue;
        const moved = Math.min(remaining, current.maxAmount - current.amount);
        if (moved <= 0) continue;
        current.amount += moved;
        container.setItem(slot, current);
        remaining -= moved;
    }
    for (const slot of slots) {
        if (remaining <= 0) break;
        if (container.getItem(slot)) continue;
        const moved = Math.min(remaining, template.maxAmount);
        const copy = template.clone();
        copy.amount = moved;
        container.setItem(slot, copy);
        remaining -= moved;
    }
    return amount - remaining;
}

function bonusEligible(typeId, exclusions) {
    return !exclusions.has(typeId)
        && !typeId.endsWith("_seeds")
        && !typeId.endsWith("_sapling")
        && !typeId.endsWith("_propagule");
}

function rollBonus(levels, biomeBonus) {
    let result = 0;
    for (let level = 0; level < levels; level++) if (Math.random() <= 0.4) result++;
    if (biomeBonus && Math.random() <= 0.25) result++;
    return result;
}

function spawnOverflow(machine, template, amount) {
    let remaining = amount;
    while (remaining > 0) {
        const moved = Math.min(remaining, template.maxAmount);
        const copy = template.clone();
        copy.amount = moved;
        machine.dimension.spawnItem(copy, machine.block.center());
        remaining -= moved;
    }
}

function collectionBounds(positions) {
    let minX = positions[0].x;
    let maxX = minX;
    let minZ = positions[0].z;
    let maxZ = minZ;
    const y = positions[0].y;
    for (let index = 1; index < positions.length; index++) {
        minX = Math.min(minX, positions[index].x);
        maxX = Math.max(maxX, positions[index].x);
        minZ = Math.min(minZ, positions[index].z);
        maxZ = Math.max(maxZ, positions[index].z);
    }
    const center = { x: (minX + maxX) / 2 + 0.5, y: y + 0.5, z: (minZ + maxZ) / 2 + 0.5 };
    return { center, radius: Math.hypot((maxX - minX) / 2, 2, (maxZ - minZ) / 2) + 2.5 };
}

function positionKey(position) {
    return `${position.x},${position.y},${position.z}`;
}

function getBiomeId(dimension, location) {
    try {
        const biome = dimension.getBiome?.(location);
        return biome?.id ?? biome?.typeId ?? biome?.identifier ?? null;
    } catch {
        return null;
    }
}

function countFilledOutputs(container) {
    let filled = 0;
    for (const slot of OUTPUT_SLOTS) if (container.getItem(slot)) filled++;
    return filled;
}

function getRateMultiplier(baseRate, energyCost, seconds) {
    const updates = Math.max(1, Math.round(seconds * MACHINE_UPDATES_PER_SECOND));
    return energyCost / (Math.max(Number.EPSILON, baseRate) * updates);
}

function chargingMessage(operation) {
    if (operation.harvestTargets.length) return "Cultivating";
    if (operation.plantTargets.length) return "Planting";
    return "Accelerating";
}

function completedMessage(result) {
    if (result.harvested) return "Cultivated";
    if (result.planted) return "Planted";
    if (result.pulsed) return "Growth Pulsed";
    return "Monitoring";
}

function resetProcess(machine, cost, message, context, resetProgress = true) {
    if (resetProgress) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message, context);
}

function renderStatus(machine, running, message, context, completed = null) {
    const sideLength = context.sideLength ?? BASE_SIDE_LENGTH;
    const fieldLines = [
        `\u00A7r\u00A77Field \u00A7f${sideLength}x${sideLength}`,
        `\u00A7r\u00A77Seed Patterns \u00A7f${context.validSeedCount ?? 0}/4`,
        `\u00A7r\u00A77Clock \u00A7f${context.clock?.title ?? "Off"}`,
        `\u00A7r\u00A77Buffer \u00A7f${context.bufferFilledSlots ?? 0}/15`,
    ];
    if (context.biomeBonus?.active) fieldLines.push(`\u00A7r\u00A7aBiome Bonus \u00A7f${context.biomeBonus.title}`);
    const sections = [{ title: "Cultivator Information", lines: fieldLines }];
    if (context.ready) {
        sections.push({
            title: "Field Operation",
            lines: [
                `\u00A7r\u00A77Harvest Targets \u00A7f${context.harvestTargets.length}`,
                `\u00A7r\u00A77Plant Targets \u00A7f${context.plantTargets.length}`,
                `\u00A7r\u00A77Growth Pulses \u00A7f${context.pulseCount}`,
            ],
        });
    }
    if (completed) {
        sections.push({
            title: "Last Cycle",
            lines: [
                `\u00A7r\u00A7aHarvested \u00A7f${completed.harvested}`,
                `\u00A7r\u00A7aPlanted \u00A7f${completed.planted}`,
                `\u00A7r\u00A7aPulsed \u00A7f${completed.pulsed}`,
            ],
        });
    }
    const rateMultiplier = context.ready
        ? getRateMultiplier(
            machine.settings.machine.rate_speed_base,
            context.energyCost,
            context.cycleSeconds,
        )
        : 1;
    renderMachineInfo(machine, running, message, sections, {
        energyCost: context.energyCost,
        rateMultiplier,
        batch: 1,
    });
}

function cleanupFieldStates() {
    const tick = system.currentTick;
    if (tick - lastCacheCleanupTick < 1200) return;
    lastCacheCleanupTick = tick;
    for (const [entityId, state] of fieldStates) {
        if (tick - state.lastSeenTick > 6000) fieldStates.delete(entityId);
    }
}

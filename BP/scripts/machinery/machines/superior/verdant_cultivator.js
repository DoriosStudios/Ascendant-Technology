import { ItemStack, system } from "@minecraft/server";
import {
    Machine,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate
} from "../../../DoriosCore/main.js";
import {
    getVerdantCultivatorCropSpec,
    getVerdantCultivatorCropSpecByBlockId,
    getVerdantCultivatorTrackedDropIds,
    isVerdantCultivatorSeedItem
} from "../../../config/recipes/verdant_cultivator.js";
import {
    formatEnergyCost,
    formatMachineEnergyBuffer,
    formatSecondsLabel,
    shouldRefreshSuperiorUi
} from "./utils.js";

const VERDANT_CULTIVATOR = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        seeds: Object.freeze([3, 4, 5, 6]),
        clock: 7,
        upgrades: Object.freeze([8, 9, 10, 11]),
        outputs: Object.freeze([12, 13, 14, 15, 16, 17, 18, 19, 20])
    }),
    transfer: Object.freeze({
        itemAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        })
    }),
    defaults: Object.freeze({
        energyCost: 6400,
        maxRangeLevel: 7,
        baseSideLength: 3,
        sweepCostBase: 1200,
        sweepCostPerSide: 120,
        harvestCost: 900,
        plantCost: 260,
        growthCost: 380,
        clockPulseBaseTargets: 1,
        clockPulseTargetsPerQuantityLevel: 1,
        clockPulseBaseChance: 0.8,
        dropCollectionDelayTicks: 8,
        dropCollectionRadius: 1.25,
        cycleTimeBaseSeconds: 1.1,
        cycleTimePerSideSeconds: 0.18,
        cycleTimePerHarvestSeconds: 0.08,
        cycleTimePerPlantSeconds: 0.06,
        cycleTimePerPulseSeconds: 0.7,
        maxHarvestCycleBonusSeconds: 2.4,
        maxPlantCycleBonusSeconds: 1.8,
        maxQuantityLevel: 4,
        harvestBonusChancePerLevel: 0.4,
        biomeBonusYieldChance: 0.25,
        biomeBonusExtraPulseTargets: 1
    }),
    properties: Object.freeze({
        configSignature: "ascendant:verdant_config"
    })
});

const SEED_PATTERN_LAYOUT = Object.freeze([
    Object.freeze({ slotIndex: 0, row: 0, col: 0 }),
    Object.freeze({ slotIndex: 1, row: 0, col: 1 }),
    Object.freeze({ slotIndex: 2, row: 1, col: 0 }),
    Object.freeze({ slotIndex: 3, row: 1, col: 1 })
]);

const TILLABLE_FARMLAND_SOILS = Object.freeze([
    "minecraft:dirt",
    "minecraft:grass",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:dirt_with_roots"
]);

const CLOCK_TIER_CHANCE_MULTIPLIERS = Object.freeze({
    0: 1,
    1: 0.8,
    2: 0.6,
    3: 0.1,
    4: 0.05
});

const VERDANT_FIELD_LAYOUT_CACHE = new Map();
const VERDANT_FIELD_SCAN_CACHE = new Map();

const VERDANT_FIELD_SCAN_INTERVALS = Object.freeze({
    active: 4,
    monitoring: 8,
    blocked: 16,
    idle: 20
});

DoriosAPI.register.blockComponent("verdant_cultivator", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? VERDANT_CULTIVATOR.defaults.energyCost);
            machine.displayEnergy(VERDANT_CULTIVATOR.slots.energy);
            machine.displayProgress(VERDANT_CULTIVATOR.slots.progress);
            machine.entity.setItem(VERDANT_CULTIVATOR.slots.status, "utilitycraft:arrow_indicator_90", 1, "");
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "verdant_cultivator:ui");

        runAdaptiveTickGate(
            machine.entity,
            "verdant_cultivator:item_io",
            VERDANT_CULTIVATOR.transfer.itemAdaptive,
            () => {
                const hasOutputs = VERDANT_CULTIVATOR.slots.outputs.some(slot => !!machine.inv.getItem(slot));
                const hasInputRoom = [...VERDANT_CULTIVATOR.slots.seeds, VERDANT_CULTIVATOR.slots.clock].some(slot => {
                    const stack = machine.inv.getItem(slot);
                    return !stack || stack.amount < stack.maxAmount;
                });

                if (!hasOutputs && !hasInputRoom) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                let moved = machine.transferItems("complex");
                for (const slot of VERDANT_CULTIVATOR.slots.seeds) {
                    moved = pullMatchingItemsFromAbove(machine, slot, isSupportedSeedItem) || moved;
                }
                moved = pullMatchingItemsFromAbove(machine, VERDANT_CULTIVATOR.slots.clock, isClockItem) || moved;

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        const operation = buildOperation(machine);

        if (!operation.supportedFacing) {
            clearConfigSignature(machine);
            showMachineWarning(machine, "Horizontal Only", operation, true, shouldRefreshUi);
            return;
        }

        if (!operation.hasValidSeeds) {
            clearConfigSignature(machine);
            showMachineWarning(machine, operation.message ?? "Insert Seeds", operation, true, shouldRefreshUi);
            return;
        }

        syncConfigSignature(machine, operation);

        if (!operation.ready) {
            machine.setProgress(0, VERDANT_CULTIVATOR.slots.progress);
            if (operation.message === "Monitoring") {
                showMachineStatus(machine, operation.message, operation, shouldRefreshUi);
            } else {
                showMachineWarning(machine, operation.message ?? "Monitoring", operation, true, shouldRefreshUi);
            }
            return;
        }

        machine.setEnergyCost(operation.energyCost);
        applyOperationRate(machine, operation);

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, "No Energy", operation, false, shouldRefreshUi);
            return;
        }

        const progress = machine.getProgress();
        if (progress >= operation.energyCost) {
            const lastCycle = executeOperation(machine, operation, settings);
            machine.addProgress(-operation.energyCost);
            showMachineStatus(machine, resolveCompletedMessage(lastCycle), {
                ...operation,
                lastCycle
            }, shouldRefreshUi);
            return;
        }

        const consumption = machine.boosts.consumption;
        const energyToConsume = Math.min(
            machine.energy.get(),
            machine.rate,
            Math.max(0, operation.energyCost - progress) * consumption
        );

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON));
        }

        showMachineStatus(machine, resolveChargingMessage(operation), operation, shouldRefreshUi);
    },

    onPlayerBreak(e) {
        clearVerdantRuntimeCache(e.block);
        Machine.onDestroy(e);
    }
});

function buildVerdantCacheKey(block) {
    const { location, dimension } = block ?? {};
    if (!location) return "";
    return `${String(dimension?.id ?? "unknown")}:${location.x},${location.y},${location.z}`;
}

function clearVerdantRuntimeCache(block) {
    const cacheKey = buildVerdantCacheKey(block);
    if (!cacheKey) return;
    VERDANT_FIELD_LAYOUT_CACHE.delete(cacheKey);
    VERDANT_FIELD_SCAN_CACHE.delete(cacheKey);
}

function invalidateVerdantFieldScan(block) {
    const cacheKey = buildVerdantCacheKey(block);
    if (cacheKey) VERDANT_FIELD_SCAN_CACHE.delete(cacheKey);
}

function resolveSeedTemplates(machine) {
    return VERDANT_CULTIVATOR.slots.seeds.map(slot => {
        const stack = machine.inv.getItem(slot);
        const spec = stack ? getCropSpec(stack.typeId) : null;
        return {
            slot,
            stack,
            spec,
            invalid: Boolean(stack && !spec)
        };
    });
}

function getCropSpec(typeId) {
    if (!typeId) return null;
    return getVerdantCultivatorCropSpec(typeId);
}

function getCropSpecByBlockId(typeId) {
    if (!typeId) return null;
    return getVerdantCultivatorCropSpecByBlockId(typeId);
}

function isSupportedSeedItem(item) {
    return isVerdantCultivatorSeedItem(item);
}

function isClockItem(item) {
    return item?.typeId === "utilitycraft:accelerator_clock";
}

function buildOperation(machine) {
    const axis = machine.block.getState("utilitycraft:axis");
    const vectors = resolveHorizontalFieldVectors(machine.block);
    const supportedFacing = Boolean(vectors);
    const rangeLevel = Math.max(0, Math.min(VERDANT_CULTIVATOR.defaults.maxRangeLevel, Number(machine.upgrades?.range) || 0));
    const quantityLevel = getQuantityUpgradeLevel(machine);
    const hyperLevel = Math.max(0, Number(machine.upgrades?.hyper) || 0);
    const sideLength = VERDANT_CULTIVATOR.defaults.baseSideLength + (rangeLevel * 2);
    const clockInstalled = isClockItem(machine.inv.getItem(VERDANT_CULTIVATOR.slots.clock));
    const templates = resolveSeedTemplates(machine);
    const validTemplates = templates.filter(template => template.spec);
    const invalidTemplate = templates.find(template => template.invalid) ?? null;
    const bufferInfo = getOutputBufferInfo(machine);
    const templateSignature = templates.map(template => template?.stack?.typeId ?? "empty").join(",");
    const layoutSignature = [axis, sideLength, templateSignature].join("|");

    const baseOperation = {
        supportedFacing,
        axis,
        rangeLevel,
        quantityLevel,
        hyperLevel,
        sideLength,
        clockInstalled,
        seedTemplates: templates,
        activeTemplateCount: validTemplates.length,
        invalidTemplate,
        bufferFilledSlots: bufferInfo.filledSlots,
        biomeId: null,
        activeBiomeBonusTitle: null,
        biomeBonusActive: false,
        hasValidSeeds: validTemplates.length > 0,
        focusSpec: validTemplates[0]?.spec ?? null,
        harvestTargets: [],
        plantTargets: [],
        replantTargets: [],
        growthTargets: [],
        selectedGrowthTargetCount: 0,
        blockedCount: 0,
        invalidSoilCount: 0,
        ready: false,
        message: null,
        energyCost: 0,
        cycleSeconds: 0,
        configSignature: ""
    };

    if (!supportedFacing) {
        return {
            ...baseOperation,
            hasValidSeeds: validTemplates.length > 0,
            message: "Horizontal Only"
        };
    }

    const field = getVerdantFieldRuntime(machine, layoutSignature, sideLength, templates);
    const biomeId = field.biomeId ?? getBiomeId(machine.dim, field.cells[0]?.position ?? machine.block.location);
    const activeBiomeBonuses = dedupeBiomeBonuses(
        validTemplates
            .map(template => resolveBiomeBonus(template.spec, biomeId))
            .filter(result => result.active)
    );

    const { harvestTargets, plantCandidates, growthCandidates, blockedCount, invalidSoilCount, detectedCropCount } = field.scan;

    const plantBudgets = buildSeedBudgets(validTemplates);
    const replantTargets = harvestTargets.map(target => ({
        ...target,
        template: null
    }));
    const plantTargets = reservePlantTargets(plantCandidates, plantBudgets);

    const hyperPulseTargets = Math.max(VERDANT_CULTIVATOR.defaults.clockPulseBaseTargets, hyperLevel);
    const quantityPulseTargets = quantityLevel * VERDANT_CULTIVATOR.defaults.clockPulseTargetsPerQuantityLevel;
    const biomePulseTargets = activeBiomeBonuses.length > 0
        ? VERDANT_CULTIVATOR.defaults.biomeBonusExtraPulseTargets
        : 0;
    const pulseTargetBudget = hyperPulseTargets + quantityPulseTargets + biomePulseTargets;
    const pulseTargetCount = clockInstalled
        ? Math.min(
            growthCandidates.length,
            Math.max(hyperPulseTargets, pulseTargetBudget)
        )
        : 0;

    const ready = harvestTargets.length > 0 || plantTargets.length > 0 || pulseTargetCount > 0;
    const hasOperatingProfile = validTemplates.length > 0 || detectedCropCount > 0;
    const energyCost = ready
        ? Math.max(
            1,
            VERDANT_CULTIVATOR.defaults.sweepCostBase
                + (sideLength * VERDANT_CULTIVATOR.defaults.sweepCostPerSide)
                + (harvestTargets.length * VERDANT_CULTIVATOR.defaults.harvestCost)
                + ((plantTargets.length + replantTargets.length) * VERDANT_CULTIVATOR.defaults.plantCost)
                + (pulseTargetCount * VERDANT_CULTIVATOR.defaults.growthCost)
        )
        : 0;
    const cycleSeconds = ready
        ? resolveOperationCycleSeconds({
            sideLength,
            harvestCount: harvestTargets.length,
            plantCount: plantTargets.length + replantTargets.length,
            pulseCount: pulseTargetCount
        })
        : 0;
    const configSignature = buildConfigSignature({
        axis,
        sideLength,
        quantityLevel,
        clockInstalled,
        templateSignature
    });

    return {
        ...baseOperation,
        hasValidSeeds: hasOperatingProfile,
        biomeId,
        activeBiomeBonusTitle: activeBiomeBonuses[0]?.title ?? null,
        biomeBonusActive: activeBiomeBonuses.length > 0,
        focusSpec: validTemplates[0]?.spec ?? harvestTargets[0]?.spec ?? growthCandidates[0]?.spec ?? null,
        harvestTargets,
        plantTargets,
        replantTargets,
        growthTargets: growthCandidates,
        selectedGrowthTargetCount: pulseTargetCount,
        blockedCount,
        invalidSoilCount,
        ready,
        message: invalidTemplate && !hasOperatingProfile
            ? "Unsupported Seed"
            : resolveIdleMessage({ blockedCount, invalidSoilCount, ready }),
        energyCost,
        cycleSeconds,
        configSignature
    };
}

function getVerdantFieldRuntime(machine, layoutSignature, sideLength, templates) {
    const cacheKey = buildVerdantCacheKey(machine?.block);
    let field = cacheKey ? VERDANT_FIELD_LAYOUT_CACHE.get(cacheKey) : null;

    if (field?.layoutSignature !== layoutSignature) {
        field = {
            layoutSignature,
            cells: buildFieldLayout(machine.block, sideLength, templates).cells,
            biomeId: null
        };
        field.biomeId = getBiomeId(machine.dim, field.cells[0]?.position ?? machine.block.location);
        if (cacheKey) VERDANT_FIELD_LAYOUT_CACHE.set(cacheKey, field);
        VERDANT_FIELD_SCAN_CACHE.delete(cacheKey);
    }

    const currentTick = Math.max(0, Math.floor(Number(system.currentTick ?? globalThis.tickCount ?? 0)));
    const cachedScan = cacheKey ? VERDANT_FIELD_SCAN_CACHE.get(cacheKey) : null;
    if (cachedScan?.layoutSignature !== layoutSignature || currentTick >= cachedScan.nextScanTick) {
        const scan = scanFieldState(machine, field.cells);
        const nextScanTick = currentTick + resolveFieldScanInterval(scan);
        if (cacheKey) {
            VERDANT_FIELD_SCAN_CACHE.set(cacheKey, {
                layoutSignature,
                nextScanTick,
                scan
            });
        }
        return {
            ...field,
            scan
        };
    }

    return {
        ...field,
        scan: cachedScan.scan
    };
}

function scanFieldState(machine, cells) {
    const harvestTargets = [];
    const plantCandidates = [];
    const growthCandidates = [];
    let blockedCount = 0;
    let invalidSoilCount = 0;
    let detectedCropCount = 0;

    for (const cell of cells) {
        const evaluation = evaluateFieldCell(machine, cell);
        const resolvedCell = evaluation.spec
            ? {
                ...cell,
                spec: evaluation.spec
            }
            : cell;

        if (evaluation.kind === "harvest") {
            harvestTargets.push(resolvedCell);
            detectedCropCount += 1;
            continue;
        }
        if (evaluation.kind === "plant") {
            plantCandidates.push(resolvedCell);
            continue;
        }
        if (evaluation.kind === "grow") {
            growthCandidates.push(resolvedCell);
            detectedCropCount += 1;
            continue;
        }
        if (evaluation.kind === "monitor") {
            detectedCropCount += 1;
            continue;
        }
        if (evaluation.kind === "invalid_soil") {
            invalidSoilCount += 1;
            continue;
        }
        if (evaluation.kind === "blocked") {
            blockedCount += 1;
        }
    }

    return {
        harvestTargets,
        plantCandidates,
        growthCandidates,
        blockedCount,
        invalidSoilCount,
        detectedCropCount
    };
}

function resolveFieldScanInterval(scanResult) {
    if ((scanResult?.harvestTargets?.length ?? 0) > 0
        || (scanResult?.plantCandidates?.length ?? 0) > 0
        || (scanResult?.growthCandidates?.length ?? 0) > 0) {
        return VERDANT_FIELD_SCAN_INTERVALS.active;
    }

    if ((scanResult?.blockedCount ?? 0) > 0 || (scanResult?.invalidSoilCount ?? 0) > 0) {
        return VERDANT_FIELD_SCAN_INTERVALS.blocked;
    }

    if ((scanResult?.detectedCropCount ?? 0) > 0) {
        return VERDANT_FIELD_SCAN_INTERVALS.monitoring;
    }

    return VERDANT_FIELD_SCAN_INTERVALS.idle;
}

function buildFieldLayout(block, sideLength, templates) {
    const vectors = resolveHorizontalFieldVectors(block);
    const pattern = buildSeedPattern(templates);
    if (!vectors) return { cells: [] };

    const halfWidth = Math.floor(sideLength / 2);
    const cells = [];
    const anchor = {
        x: block.location.x + vectors.forward.x,
        y: block.location.y,
        z: block.location.z + vectors.forward.z
    };

    for (let row = 0; row < sideLength; row++) {
        for (let col = 0; col < sideLength; col++) {
            const hasPattern = pattern.width > 0 && pattern.height > 0 && pattern.cells.length > 0;
            const patternIndex = hasPattern
                ? ((row % pattern.height) * pattern.width) + (col % pattern.width)
                : -1;
            const template = hasPattern
                ? (pattern.cells[patternIndex] ?? null)
                : null;

            const lateral = col - halfWidth;
            cells.push({
                row,
                col,
                template,
                spec: template?.spec ?? null,
                position: {
                    x: anchor.x + (vectors.forward.x * row) + (vectors.right.x * lateral),
                    y: anchor.y,
                    z: anchor.z + (vectors.forward.z * row) + (vectors.right.z * lateral)
                }
            });
        }
    }

    return { cells };
}

function resolveHorizontalFieldVectors(block) {
    const forward = getFrontVector(block);
    if (!forward || forward.y !== 0) return null;

    if (forward.x === 1) {
        return {
            forward: { x: 1, z: 0 },
            right: { x: 0, z: 1 }
        };
    }

    if (forward.x === -1) {
        return {
            forward: { x: -1, z: 0 },
            right: { x: 0, z: -1 }
        };
    }

    if (forward.z === 1) {
        return {
            forward: { x: 0, z: 1 },
            right: { x: -1, z: 0 }
        };
    }

    if (forward.z === -1) {
        return {
            forward: { x: 0, z: -1 },
            right: { x: 1, z: 0 }
        };
    }

    return null;
}

function getFrontVector(block) {
    const axis = block?.permutation?.getState?.("utilitycraft:axis") ?? block?.getState?.("utilitycraft:axis");

    switch (axis) {
        case "east":
            return { x: 1, y: 0, z: 0 };
        case "west":
            return { x: -1, y: 0, z: 0 };
        case "north":
            return { x: 0, y: 0, z: -1 };
        case "south":
            return { x: 0, y: 0, z: 1 };
        case "up":
            return { x: 0, y: 1, z: 0 };
        case "down":
            return { x: 0, y: -1, z: 0 };
        default:
            return null;
    }
}

function buildSeedPattern(templates) {
    const entries = SEED_PATTERN_LAYOUT
        .map(layout => ({
            row: layout.row,
            col: layout.col,
            template: templates[layout.slotIndex] ?? null
        }))
        .filter(entry => entry.template?.spec);

    if (entries.length <= 0) {
        return {
            width: 0,
            height: 0,
            cells: []
        };
    }

    const rows = [...new Set(entries.map(entry => entry.row))].sort((a, b) => a - b);
    const cols = [...new Set(entries.map(entry => entry.col))].sort((a, b) => a - b);
    const firstTemplate = entries[0].template;
    const cells = [];

    for (const row of rows) {
        for (const col of cols) {
            const template = entries.find(entry => entry.row === row && entry.col === col)?.template
                ?? entries.find(entry => entry.row === row)?.template
                ?? entries.find(entry => entry.col === col)?.template
                ?? firstTemplate;
            cells.push(template);
        }
    }

    return {
        width: Math.max(1, cols.length),
        height: Math.max(1, rows.length),
        cells
    };
}

function evaluateFieldCell(machine, cell) {
    const block = machine.dim.getBlock(cell.position);
    if (!block) return { kind: "blocked" };

    const blockSpec = getCropSpecByBlockId(block.typeId);
    if (blockSpec) {
        if (isCropMature(block, blockSpec)) {
            return {
                kind: "harvest",
                spec: blockSpec
            };
        }
        if (canGrowCrop(block, blockSpec)) {
            return {
                kind: "grow",
                spec: blockSpec
            };
        }
        return {
            kind: "monitor",
            spec: blockSpec
        };
    }

    if (!block.isAir) {
        return { kind: "blocked" };
    }

    if (!cell.spec) {
        return { kind: "idle" };
    }

    const soilBlock = machine.dim.getBlock({
        x: cell.position.x,
        y: cell.position.y - 1,
        z: cell.position.z
    });

    if (!soilBlock || !isValidSoil(soilBlock, cell.spec)) {
        return { kind: "invalid_soil" };
    }

    return { kind: "plant" };
}

function isCropMature(block, spec) {
    const age = block?.permutation?.getState?.(spec.ageState);
    return typeof age === "number" && age >= spec.maxAge;
}

function canGrowCrop(block, spec) {
    const age = block?.permutation?.getState?.(spec.ageState);
    return typeof age === "number" && age < spec.maxAge;
}

function isValidSoil(block, spec) {
    return resolvePlantingSoil(block, spec).valid;
}

function resolvePlantingSoil(block, spec) {
    const soilId = block?.typeId;
    if (!soilId || !spec?.validSoils?.length) {
        return { valid: false, tillRequired: false, targetSoilId: null };
    }

    if (spec.validSoils.includes(soilId)) {
        return {
            valid: true,
            tillRequired: false,
            targetSoilId: soilId
        };
    }

    if (spec.validSoils.includes("minecraft:farmland") && TILLABLE_FARMLAND_SOILS.includes(soilId)) {
        return {
            valid: true,
            tillRequired: true,
            targetSoilId: "minecraft:farmland"
        };
    }

    return { valid: false, tillRequired: false, targetSoilId: null };
}

function prepareSoilForPlanting(machine, soilBlock, spec) {
    const soilPlan = resolvePlantingSoil(soilBlock, spec);
    if (!soilPlan.valid) return false;
    if (!soilPlan.tillRequired) return true;

    try {
        soilBlock.setType(soilPlan.targetSoilId);
        return true;
    } catch {
        return runSetblock(machine, soilBlock.location, `${soilPlan.targetSoilId} replace`);
    }
}

function buildSeedBudgets(templates) {
    const budgets = new Map();

    for (const template of templates) {
        const amount = Number(template?.stack?.amount ?? 0);
        if (!template?.spec || amount <= 0) continue;
        budgets.set(template.slot, amount);
    }

    return budgets;
}

function reservePlantTargets(candidates, budgets) {
    const reserved = [];

    for (const candidate of candidates) {
        const slot = candidate?.template?.slot;
        if (typeof slot !== "number") continue;

        const remaining = budgets.get(slot) ?? 0;
        if (remaining <= 0) continue;

        budgets.set(slot, remaining - 1);
        reserved.push(candidate);
    }

    return reserved;
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of VERDANT_CULTIVATOR.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(VERDANT_CULTIVATOR.defaults.maxQuantityLevel, total));
}

function isQuantityUpgradeItem(item) {
    if (!item?.typeId) return false;

    if (item.typeId === "utilitycraft:quantity_upgrade") {
        return true;
    }

    if (typeof item.hasTag === "function" && item.hasTag("utilitycraft:quantity_upgrade")) {
        return true;
    }

    const [, raw = ""] = item.typeId.split(":");
    return raw === "quantity_upgrade";
}

function executeOperation(machine, operation, settings) {
    let harvestedCount = 0;
    let plantedCount = 0;
    let pulsedCount = 0;
    let collectedCount = 0;
    let bonusCount = 0;
    let overflowCount = 0;
    const harvestedPositions = [];
    const replantTargets = new Set((operation.replantTargets ?? []).map(target => buildPositionKey(target.position)));
    const selectedGrowthTargets = getOperationSelectedGrowthTargets(operation);

    for (const target of selectedGrowthTargets) {
        const block = machine.dim.getBlock(target.position);
        if (!block || block.typeId !== target.spec.cropBlockId) continue;

        if (!growCropBlock(block, target.spec)) continue;
        pulsedCount += 1;
    }

    for (const target of operation.harvestTargets) {
        const block = machine.dim.getBlock(target.position);
        if (!block || block.typeId !== target.spec.cropBlockId || !isCropMature(block, target.spec)) continue;

        const harvestResult = harvestCrop(machine, target);
        if (!harvestResult.harvested) continue;

        harvestedCount += 1;
        harvestedPositions.push(target.position);

        if (replantTargets.has(buildPositionKey(target.position)) && plantTarget(machine, target)) {
            plantedCount += 1;
        }
    }

    for (const target of operation.plantTargets) {
        if (!plantTarget(machine, target)) continue;
        plantedCount += 1;
    }

    if (harvestedPositions.length > 0) {
        scheduleHarvestDropCollection(machine, harvestedPositions, operation, settings);
    }

    if (harvestedCount > 0 || plantedCount > 0 || pulsedCount > 0) {
        invalidateVerdantFieldScan(machine.block);
    }

    return {
        harvestedCount,
        plantedCount,
        pulsedCount,
        collectedCount,
        bonusCount,
        overflowCount
    };
}

function getOperationSelectedGrowthTargets(operation) {
    const pulseTargetCount = Math.max(0, Number(operation?.selectedGrowthTargetCount) || 0);
    return pulseTargetCount > 0 ? sampleEntries(operation?.growthTargets ?? [], pulseTargetCount) : [];
}

function growCropBlock(block, spec) {
    const permutation = block?.permutation;
    if (!permutation) return false;

    const currentAge = permutation.getState(spec.ageState);
    if (typeof currentAge !== "number" || currentAge >= spec.maxAge) return false;

    const tier = Number(permutation.getState("utilitycraft:tier") ?? 0);
    const chanceMultiplier = CLOCK_TIER_CHANCE_MULTIPLIERS[tier] ?? 1;
    const finalChance = Math.min(
        0.95,
        VERDANT_CULTIVATOR.defaults.clockPulseBaseChance * chanceMultiplier
    );
    if (Math.random() > finalChance) return false;

    try {
        block.setPermutation(permutation.withState(spec.ageState, currentAge + 1));
        if (Math.random() <= 0.25) {
            block.dimension.spawnParticle("minecraft:crop_growth_emitter", block.center());
        }
        return true;
    } catch {
        return false;
    }
}

function harvestCrop(machine, target) {
    const block = machine.dim.getBlock(target.position);
    if (!block || block.typeId !== target.spec.cropBlockId || !isCropMature(block, target.spec)) {
        return {
            harvested: false
        };
    }

    if (!runSetblock(machine, target.position, "air destroy")) {
        return {
            harvested: false
        };
    }

    return {
        harvested: true
    };
}

function plantCrop(machine, spec, position) {
    const specifier = buildPlantBlockSpecifier(spec);
    return runSetblock(machine, position, `${specifier} replace`);
}

function buildPlantBlockSpecifier(spec) {
    if (spec.ageState === "utilitycraft:age") {
        return `${spec.commandBlockId} [\"utilitycraft:age\"=0]`;
    }

    return spec.commandBlockId;
}

function plantTarget(machine, target) {
    const block = machine.dim.getBlock(target.position);
    const soilBlock = machine.dim.getBlock({
        x: target.position.x,
        y: target.position.y - 1,
        z: target.position.z
    });

    if (!block || !block.isAir || !soilBlock || !isValidSoil(soilBlock, target.spec)) return false;

    const shouldConsumeInternalSeed = typeof target.template?.slot === "number";
    if (shouldConsumeInternalSeed && !consumeSeedFromSlot(machine, target.template.slot, target.spec.seedItemId)) {
        return false;
    }

    if (!prepareSoilForPlanting(machine, soilBlock, target.spec)) {
        if (shouldConsumeInternalSeed) {
            restoreSeedToSlot(machine, target.template.slot, target.spec.seedItemId);
        }
        return false;
    }

    if (plantCrop(machine, target.spec, target.position)) {
        return true;
    }

    if (shouldConsumeInternalSeed) {
        restoreSeedToSlot(machine, target.template.slot, target.spec.seedItemId);
    }
    return false;
}

function consumeSeedFromSlot(machine, slot, expectedTypeId) {
    if (!machine?.inv || typeof slot !== "number" || !expectedTypeId) return false;

    const stack = machine.inv.getItem(slot);
    if (!stack || stack.typeId !== expectedTypeId || stack.amount <= 0) return false;

    if (stack.amount <= 1) {
        machine.inv.setItem(slot, undefined);
        return true;
    }

    stack.amount -= 1;
    machine.inv.setItem(slot, stack);
    return true;
}

function restoreSeedToSlot(machine, slot, typeId) {
    if (!machine?.inv || typeof slot !== "number" || !typeId) return false;

    const current = machine.inv.getItem(slot);
    if (!current) {
        machine.inv.setItem(slot, new ItemStack(typeId, 1));
        return true;
    }

    if (current.typeId !== typeId || current.amount >= current.maxAmount) return false;
    current.amount += 1;
    machine.inv.setItem(slot, current);
    return true;
}

function runSetblock(machine, position, suffix) {
    try {
        machine.dim.runCommand(`setblock ${position.x} ${position.y} ${position.z} ${suffix}`);
        return true;
    } catch {
        return false;
    }
}

function scheduleHarvestDropCollection(machine, harvestedPositions, operation, settings) {
    if (!machine?.dim || !machine?.block || !Array.isArray(harvestedPositions) || harvestedPositions.length <= 0) {
        return;
    }

    const machineLocation = {
        x: machine.block.location.x,
        y: machine.block.location.y,
        z: machine.block.location.z
    };
    const operationSnapshot = {
        quantityLevel: operation.quantityLevel,
        biomeBonusActive: operation.biomeBonusActive,
        trackedDropIds: buildTrackedDropIds(operation),
        harvestExclusionIds: [...buildHarvestExclusionSet(operation)]
    };

    system.runTimeout(() => {
        const block = machine.dim.getBlock(machineLocation);
        if (!block || block.typeId !== "utilitycraft:verdant_cultivator") return;

        const delayedMachine = new Machine(block, settings, true);
        if (!delayedMachine.valid || !delayedMachine.inv) return;

        delayedMachine.transferItems("complex");
        collectHarvestDrops(delayedMachine, harvestedPositions, operationSnapshot);
        delayedMachine.transferItems("complex");
    }, VERDANT_CULTIVATOR.defaults.dropCollectionDelayTicks);
}

function collectHarvestDrops(machine, harvestedPositions, operation) {
    const bounds = buildCollectionBounds(harvestedPositions, {
        margin: VERDANT_CULTIVATOR.defaults.dropCollectionRadius,
        radiusPadding: 2.75
    });
    if (!bounds) {
        return {
            collectedCount: 0,
            bonusCount: 0,
            overflowCount: 0
        };
    }

    const nearbyItems = machine.dim.getEntities({
        type: "item",
        location: bounds.center,
        maxDistance: bounds.radius
    });

    const trackedDropIds = new Set(operation?.trackedDropIds ?? []);
    const exclusions = buildHarvestExclusionSet(operation);
    let collectedCount = 0;
    let bonusCount = 0;
    let overflowCount = 0;

    for (const itemEntity of nearbyItems) {
        const stack = itemEntity.getComponent("minecraft:item")?.itemStack;
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue;
        if (trackedDropIds.size > 0 && !trackedDropIds.has(stack.typeId)) continue;
        if (!isWithinBounds(itemEntity?.location, bounds)) continue;
        if (!isWithinHarvestCollectionRadius(itemEntity?.location, harvestedPositions, VERDANT_CULTIVATOR.defaults.dropCollectionRadius)) continue;

        const bonusAmount = isHarvestBonusEligible(stack, exclusions)
            ? rollHarvestBonus(operation.quantityLevel, operation.biomeBonusActive)
            : 0;
        const totalAmount = stack.amount + bonusAmount;
        const itemLocation = teleportHarvestDropToMachine(machine, itemEntity);

        itemEntity.remove();

        const augmented = cloneItemStack(stack, totalAmount);
        const storageResult = storeCollectedHarvestStack(machine, augmented);
        const insertedAmount = storageResult.insertedAmount;
        const overflowAmount = storageResult.overflowAmount;

        collectedCount += insertedAmount;
        bonusCount += bonusAmount;
        overflowCount += overflowAmount;

        if (overflowAmount > 0) {
            machine.dim.spawnItem(cloneItemStack(stack, overflowAmount), itemLocation);
        }
    }

    return {
        collectedCount,
        bonusCount,
        overflowCount
    };
}

function buildTrackedDropIds(operation) {
    const trackedSpecs = [];

    for (const target of operation?.harvestTargets ?? []) {
        if (target?.spec) trackedSpecs.push(target.spec);
    }

    if (trackedSpecs.length <= 0) {
        for (const template of operation?.seedTemplates ?? []) {
            if (template?.spec) trackedSpecs.push(template.spec);
        }
    }

    return getVerdantCultivatorTrackedDropIds(trackedSpecs);
}

function storeCollectedHarvestStack(machine, stack) {
    if (!machine?.inv || !stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) {
        return {
            insertedAmount: 0,
            overflowAmount: 0
        };
    }

    let remaining = stack.amount;
    let insertedAmount = 0;

    const preferredSeedSlots = getPreferredSeedCollectionSlots(machine, stack.typeId);
    if (preferredSeedSlots.length > 0) {
        const seedInserted = insertItemIntoSlots(
            machine.inv,
            cloneItemStack(stack, remaining),
            preferredSeedSlots
        );
        insertedAmount += seedInserted;
        remaining -= seedInserted;
    }

    if (remaining > 0) {
        const outputInserted = insertItemIntoSlots(
            machine.inv,
            cloneItemStack(stack, remaining),
            VERDANT_CULTIVATOR.slots.outputs
        );
        insertedAmount += outputInserted;
        remaining -= outputInserted;
    }

    return {
        insertedAmount,
        overflowAmount: Math.max(0, remaining)
    };
}

function getPreferredSeedCollectionSlots(machine, typeId) {
    if (!machine?.inv || !isSupportedSeedItem({ typeId })) {
        return [];
    }

    const matchingSlots = [];
    const emptySlots = [];

    for (const slot of VERDANT_CULTIVATOR.slots.seeds) {
        const current = machine.inv.getItem(slot);
        if (!current) {
            emptySlots.push(slot);
            continue;
        }

        if (current.typeId === typeId && current.amount < current.maxAmount) {
            matchingSlots.push(slot);
        }
    }

    if (matchingSlots.length > 0) {
        return matchingSlots;
    }

    return emptySlots.length > 0 ? [emptySlots[0]] : [];
}

function buildHarvestExclusionSet(operation) {
    if (Array.isArray(operation?.harvestExclusionIds)) {
        return new Set(operation.harvestExclusionIds);
    }

    const exclusions = new Set();

    for (const template of operation.seedTemplates ?? []) {
        for (const typeId of template?.spec?.bonusExclusions ?? []) {
            exclusions.add(typeId);
        }
    }

    return exclusions;
}

function isHarvestBonusEligible(stack, exclusions) {
    if (!stack?.typeId) return false;
    if (exclusions.has(stack.typeId)) return false;
    if (stack.typeId.endsWith("_seeds")) return false;
    if (stack.typeId.endsWith("_sapling")) return false;
    if (stack.typeId.endsWith("_propagule")) return false;
    return true;
}

function rollHarvestBonus(quantityLevel, biomeBonusActive) {
    let extra = 0;

    for (let level = 0; level < quantityLevel; level++) {
        if (Math.random() <= VERDANT_CULTIVATOR.defaults.harvestBonusChancePerLevel) {
            extra += 1;
        }
    }

    if (biomeBonusActive && Math.random() <= VERDANT_CULTIVATOR.defaults.biomeBonusYieldChance) {
        extra += 1;
    }

    return extra;
}

function getOutputBufferInfo(machine) {
    let filledSlots = 0;
    let totalItems = 0;

    for (const slot of VERDANT_CULTIVATOR.slots.outputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) continue;
        filledSlots += 1;
        totalItems += Number(stack.amount) || 0;
    }

    return { filledSlots, totalItems };
}

function buildConfigSignature({ axis, sideLength, quantityLevel, clockInstalled, templateSignature, templates }) {
    const resolvedTemplateSignature = typeof templateSignature === "string" && templateSignature.length > 0
        ? templateSignature
        : (typeof templates === "string"
            ? templates
            : templates.map(template => template?.stack?.typeId ?? "empty").join(","));

    return [
        axis,
        sideLength,
        quantityLevel,
        clockInstalled ? 1 : 0,
        resolvedTemplateSignature
    ].join("|");
}

function getStoredConfigSignature(machine) {
    const value = machine?.entity?.getDynamicProperty?.(VERDANT_CULTIVATOR.properties.configSignature);
    return typeof value === "string" ? value : "";
}

function syncConfigSignature(machine, operation) {
    const nextValue = operation?.configSignature ?? "";
    const previousValue = getStoredConfigSignature(machine);

    if (machine.getProgress() > 0 && previousValue && nextValue && previousValue !== nextValue) {
        machine.setProgress(0, VERDANT_CULTIVATOR.slots.progress);
    }

    if (previousValue !== nextValue) {
        machine.entity.setDynamicProperty(VERDANT_CULTIVATOR.properties.configSignature, nextValue);
    }
}

function clearConfigSignature(machine) {
    machine?.entity?.setDynamicProperty?.(VERDANT_CULTIVATOR.properties.configSignature, "");
}

function resolveIdleMessage({ blockedCount, invalidSoilCount, ready }) {
    if (ready) return null;
    if (blockedCount > 0 || invalidSoilCount > 0) return "Field Blocked";
    return "Monitoring";
}

function resolveChargingMessage(operation) {
    if ((operation.harvestTargets?.length ?? 0) > 0) return "Cultivating";
    if ((operation.plantTargets?.length ?? 0) > 0) return "Planting";
    if (getSelectedGrowthTargetCount(operation) > 0) return "Pulsing";
    return "Charging";
}

function resolveCompletedMessage(lastCycle) {
    if ((lastCycle?.harvestedCount ?? 0) > 0) return "Cultivated";
    if ((lastCycle?.plantedCount ?? 0) > 0) return "Planted";
    if ((lastCycle?.pulsedCount ?? 0) > 0) return "Pulsed";
    return "Monitoring";
}

function resolveOperationCycleSeconds({ sideLength = 0, harvestCount = 0, plantCount = 0, pulseCount = 0 } = {}) {
    const harvestSeconds = Math.min(
        VERDANT_CULTIVATOR.defaults.maxHarvestCycleBonusSeconds,
        Math.max(0, harvestCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerHarvestSeconds
    );
    const plantSeconds = Math.min(
        VERDANT_CULTIVATOR.defaults.maxPlantCycleBonusSeconds,
        Math.max(0, plantCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerPlantSeconds
    );
    const pulseSeconds = Math.max(0, pulseCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerPulseSeconds;

    return Math.max(
        0.5,
        VERDANT_CULTIVATOR.defaults.cycleTimeBaseSeconds
            + (Math.max(0, sideLength) * VERDANT_CULTIVATOR.defaults.cycleTimePerSideSeconds)
            + harvestSeconds
            + plantSeconds
            + pulseSeconds
    );
}

function applyOperationRate(machine, operation) {
    if (!machine || !operation?.ready || !Number.isFinite(operation.energyCost) || operation.energyCost <= 0) {
        return false;
    }

    const cycleSeconds = Math.max(0.5, Number(operation.cycleSeconds) || 0);
    if (!Number.isFinite(cycleSeconds) || cycleSeconds <= 0) {
        return false;
    }

    return applyDynamicRecipeRate(
        machine,
        { timeSeconds: cycleSeconds },
        { energyCost: operation.energyCost }
    );
}

function resolveBiomeBonus(spec, biomeId) {
    if (!spec?.biomeTokens?.length || !biomeId) {
        return { active: false, title: null };
    }

    const normalizedBiomeId = biomeId.toLowerCase();
    const active = spec.biomeTokens.some(token => normalizedBiomeId.includes(token));
    return {
        active,
        title: active ? spec.biomeTitle ?? "Biome Surge" : null
    };
}

function dedupeBiomeBonuses(bonuses) {
    const seen = new Set();
    const list = [];

    for (const bonus of bonuses) {
        if (!bonus?.active || !bonus.title || seen.has(bonus.title)) continue;
        seen.add(bonus.title);
        list.push(bonus);
    }

    return list;
}

function getBiomeId(dimension, location) {
    try {
        const biome = dimension.getBiome?.(location);
        if (!biome) return null;
        return biome.id ?? biome.typeId ?? biome.identifier ?? null;
    } catch {
        return null;
    }
}

function formatBiomeName(biomeId) {
    if (!biomeId) return "Unknown";
    const raw = biomeId.split(":").pop() ?? biomeId;
    return raw
        .split(/[_-]/g)
        .filter(Boolean)
        .map(capitalizeWord)
        .join(" ");
}

function capitalizeWord(value) {
    if (!value) return "";
    return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function sampleEntries(entries, count) {
    if (!Array.isArray(entries) || entries.length <= 0 || count <= 0) {
        return [];
    }

    if (count >= entries.length) {
        return [...entries];
    }

    const pool = [...entries];
    for (let index = pool.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, count);
}

function getSelectedGrowthTargetCount(operation) {
    return Math.max(
        0,
        Number(operation?.selectedGrowthTargetCount) || 0
    );
}

function transferOutputBufferToRear(machine) {
    return machine?.transferItems?.("complex") ?? false;
}

function pullMatchingItemsFromAbove(machine, targetSlot, predicate) {
    const aboveBlock = machine.block.above(1);
    if (!aboveBlock) return false;

    if (!DoriosAPI.constants.vanillaContainers.includes(aboveBlock.typeId)) return false;

    const inputContainer = aboveBlock.getComponent("minecraft:inventory")?.container;
    if (!inputContainer) return false;

    const targetItem = machine.inv.getItem(targetSlot);
    for (let slot = 0; slot < inputContainer.size; slot++) {
        const inputItem = inputContainer.getItem(slot);
        if (!inputItem || !predicate(inputItem)) continue;

        if (targetItem && inputItem.typeId !== targetItem.typeId) continue;

        if (!targetItem) {
            machine.inv.setItem(targetSlot, inputItem);
            inputContainer.setItem(slot, undefined);
            return true;
        }

        const space = targetItem.maxAmount - targetItem.amount;
        const amount = Math.min(space, inputItem.amount);
        if (amount <= 0) continue;

        targetItem.amount += amount;
        machine.inv.setItem(targetSlot, targetItem);

        if (inputItem.amount - amount <= 0) {
            inputContainer.setItem(slot, undefined);
        } else {
            inputItem.amount -= amount;
            inputContainer.setItem(slot, inputItem);
        }

        return true;
    }

    return false;
}

function insertItemIntoSlots(container, stack, slots) {
    if (!container || !stack?.typeId || !Array.isArray(slots) || slots.length === 0) return 0;

    let remaining = stack.amount;
    const sourceLore = typeof stack.getLore === "function" ? (stack.getLore() ?? []) : [];
    const sourceName = stack.nameTag ?? "";

    const matchesStack = slotItem => {
        if (!slotItem || slotItem.typeId !== stack.typeId) return false;
        if ((slotItem.nameTag ?? "") !== sourceName) return false;
        const slotLore = typeof slotItem.getLore === "function" ? (slotItem.getLore() ?? []) : [];
        if (slotLore.length !== sourceLore.length) return false;
        return slotLore.every((line, index) => line === sourceLore[index]);
    };

    for (const slot of slots) {
        const slotItem = container.getItem(slot);
        if (!matchesStack(slotItem)) continue;

        const space = slotItem.maxAmount - slotItem.amount;
        if (space <= 0) continue;

        const amountToInsert = Math.min(space, remaining);
        slotItem.amount += amountToInsert;
        container.setItem(slot, slotItem);
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    for (const slot of slots) {
        const slotItem = container.getItem(slot);
        if (slotItem) continue;

        const amountToInsert = Math.min(stack.maxAmount ?? 64, remaining);
        const newStack = cloneItemStack(stack, amountToInsert);
        container.setItem(slot, newStack);
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    return stack.amount - remaining;
}

function cloneItemStack(stack, amount = stack?.amount ?? 1) {
    if (typeof stack?.clone === "function") {
        const clone = stack.clone();
        clone.amount = amount;
        return clone;
    }

    const clone = new ItemStack(stack.typeId, amount);
    if (stack?.nameTag) clone.nameTag = stack.nameTag;
    const lore = typeof stack?.getLore === "function" ? stack.getLore() : [];
    if (Array.isArray(lore) && lore.length && typeof clone.setLore === "function") {
        clone.setLore(lore);
    }
    return clone;
}

function buildCollectionBounds(positions = [], { margin = 0.75, radiusPadding = 2.5 } = {}) {
    if (!Array.isArray(positions) || positions.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const position of positions) {
        if (!position) continue;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        minZ = Math.min(minZ, position.z);
        maxX = Math.max(maxX, position.x);
        maxY = Math.max(maxY, position.y);
        maxZ = Math.max(maxZ, position.z);
    }

    if (!Number.isFinite(minX)) return null;

    const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    };
    const halfExtents = {
        x: Math.abs(maxX - center.x) + margin,
        y: Math.abs(maxY - center.y) + margin,
        z: Math.abs(maxZ - center.z) + margin
    };
    const radius = Math.hypot(halfExtents.x, halfExtents.y, halfExtents.z) + radiusPadding;

    return {
        minX: minX - margin,
        minY: minY - margin,
        minZ: minZ - margin,
        maxX: maxX + margin,
        maxY: maxY + margin,
        maxZ: maxZ + margin,
        center,
        radius
    };
}

function isWithinBounds(location, bounds) {
    if (!location || !bounds) return false;
    return location.x >= bounds.minX && location.x <= bounds.maxX
        && location.y >= bounds.minY && location.y <= bounds.maxY
        && location.z >= bounds.minZ && location.z <= bounds.maxZ;
}

function isWithinHarvestCollectionRadius(location, harvestedPositions, radius) {
    if (!location || !Array.isArray(harvestedPositions) || harvestedPositions.length <= 0) return false;

    const maxDistance = Math.max(0, Number(radius) || 0);
    const maxDistanceSquared = maxDistance * maxDistance;

    for (const position of harvestedPositions) {
        if (!position) continue;

        const deltaX = location.x - (position.x + 0.5);
        const deltaY = location.y - (position.y + 0.5);
        const deltaZ = location.z - (position.z + 0.5);
        const distanceSquared = (deltaX * deltaX) + (deltaY * deltaY) + (deltaZ * deltaZ);

        if (distanceSquared <= maxDistanceSquared) {
            return true;
        }
    }

    return false;
}

function buildPositionKey(position) {
    return `${position?.x ?? 0},${position?.y ?? 0},${position?.z ?? 0}`;
}

function teleportHarvestDropToMachine(machine, itemEntity) {
    const intakeLocation = buildHarvestIntakeLocation(machine);

    try {
        itemEntity.teleport(intakeLocation, {
            checkForBlocks: false,
            dimension: machine.dim
        });
        return intakeLocation;
    } catch {
        return itemEntity?.location ?? intakeLocation;
    }
}

function buildHarvestIntakeLocation(machine) {
    return {
        x: (machine?.block?.location?.x ?? 0) + 0.5,
        y: (machine?.block?.location?.y ?? 0) + 1.05,
        z: (machine?.block?.location?.z ?? 0) + 0.5
    };
}

function toSpawnPosition(location) {
    return {
        x: (location?.x ?? 0) + 0.5,
        y: (location?.y ?? 0) + 0.5,
        z: (location?.z ?? 0) + 0.5
    };
}

function buildMachineLore(machine, context = {}) {
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Area",
            value: `${context.sideLength ?? 0}x${context.sideLength ?? 0}`
        },
        {
            label: "Templates",
            value: `${context.activeTemplateCount ?? 0}/4`
        },
        {
            label: "Clock",
            value: context.clockInstalled ? "Pulse" : "None"
        },
        {
            label: "Fortune",
            value: `Q${context.quantityLevel ?? 0}`
        },
        {
            label: "Buffer",
            value: `${context.bufferFilledSlots ?? 0}/${VERDANT_CULTIVATOR.slots.outputs.length} slots`
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    const fieldInfo = [];
    if (context.focusSpec?.seedItemId) {
        fieldInfo.push({
            label: "Focus",
            value: formatItemName(context.focusSpec.seedItemId)
        });
    }
    if (context.invalidTemplate?.stack?.typeId) {
        fieldInfo.push({
            label: "Template Issue",
            value: formatItemName(context.invalidTemplate.stack.typeId),
            valueColor: "§e"
        });
    }
    fieldInfo.push(
        {
            label: "Harvest",
            value: context.harvestTargets?.length ?? 0
        },
        {
            label: "Plant",
            value: (context.plantTargets?.length ?? 0) + (context.replantTargets?.length ?? 0)
        }
    );

    if (context.clockInstalled) {
        fieldInfo.push({
            label: "Pulse",
            value: getSelectedGrowthTargetCount(context)
        });
    }
    if ((context.invalidSoilCount ?? 0) > 0) {
        fieldInfo.push({
            label: "Soil",
            value: `${context.invalidSoilCount} blocked`,
            valueColor: "§e"
        });
    }
    if ((context.blockedCount ?? 0) > 0) {
        fieldInfo.push({
            label: "Blocked",
            value: context.blockedCount,
            valueColor: "§e"
        });
    }
    if ((context.energyCost ?? 0) > 0) {
        fieldInfo.push({
            label: "Cost",
            value: formatEnergyCost(context.energyCost)
        });
    }
    if ((context.cycleSeconds ?? 0) > 0) {
        fieldInfo.push({
            label: "Cycle",
            value: formatSecondsLabel(context.cycleSeconds)
        });
    }
    if (context.biomeId) {
        fieldInfo.push({
            label: "Biome",
            value: formatBiomeName(context.biomeId)
        });
    }
    if (context.activeBiomeBonusTitle) {
        fieldInfo.push({
            label: "Biome Bonus",
            value: context.activeBiomeBonusTitle,
            valueColor: "§b"
        });
    }

    if (fieldInfo.length > 0) {
        appendLoreSection(lines, "Field Operation", fieldInfo);
    }

    const lastCycle = context.lastCycle ?? null;
    if (lastCycle) {
        const lastSection = [];
        if ((lastCycle.harvestedCount ?? 0) > 0) {
            lastSection.push(`§7Harvested: §f${lastCycle.harvestedCount} crop(s)`);
        }
        if ((lastCycle.plantedCount ?? 0) > 0) {
            lastSection.push(`§7Planted: §f${lastCycle.plantedCount} slot(s)`);
        }
        if ((lastCycle.pulsedCount ?? 0) > 0) {
            lastSection.push(`§7Pulsed: §f${lastCycle.pulsedCount} crop(s)`);
        }
        if ((lastCycle.collectedCount ?? 0) > 0) {
            lastSection.push(`§7Buffered: §f${lastCycle.collectedCount} item(s)`);
        }
        if ((lastCycle.bonusCount ?? 0) > 0) {
            lastSection.push(`§bBiome/Fortune Bonus: §f${lastCycle.bonusCount}`);
        }
        if ((lastCycle.overflowCount ?? 0) > 0) {
            lastSection.push(`§6Overflow: §f${lastCycle.overflowCount} dropped`);
        }

        if (lastSection.length > 0) {
            appendLoreSection(lines, "Last Sweep", lastSection);
        }
    }

    return lines;
}

function buildFooterLines(context = {}) {
    const lines = [
        `Area: ${context.sideLength ?? 0}x${context.sideLength ?? 0}`,
        `Clock: ${context.clockInstalled ? "Pulse" : "Off"}`,
        `Fortune: Q${context.quantityLevel ?? 0}`
    ];

    if (context.activeBiomeBonusTitle) {
        lines.push(`Biome Bonus: ${context.activeBiomeBonusTitle}`);
    }

    return lines;
}

function updateDisplays(machine, refreshUi = true) {
    if (!refreshUi) return;

    machine.displayEnergy(VERDANT_CULTIVATOR.slots.energy);
    machine.displayProgress(VERDANT_CULTIVATOR.slots.progress);
}

function showMachineWarning(machine, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off();
    if (!refreshUi) return;

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(machine, context),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, true);
}

function showMachineStatus(machine, message, context = {}, refreshUi = true) {
    machine.on();
    if (!refreshUi) return;

    machine.showStatus(
        message,
        buildMachineLore(machine, context),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, true);
}

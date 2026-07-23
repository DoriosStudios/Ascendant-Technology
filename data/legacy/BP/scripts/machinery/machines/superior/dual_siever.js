import { ItemStack } from "@minecraft/server";
import {
    Machine,
    FluidManager,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName,
    resolveItemMaxStackSize as resolveMaxStackSize,
    tickGate
} from "../../../DoriosCore/main.js";
import { getCentrifugalSieveRecipe } from "../../../config/recipes/centrifugal_siever.js";
import {
    formatBatchWithQuantity,
    formatEnergyCost,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatOptionalFluidSuffix,
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from "./utils.js";

const DUAL_SIEVER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        laneAInputs: Object.freeze([3, 4]),
        laneAMesh: 5,
        laneBInputs: Object.freeze([6, 7]),
        laneBMesh: 8,
        steamInput: 9,
        steamDisplay: 10,
        upgrades: Object.freeze([11, 12, 13, 14]),
        outputs: Object.freeze([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]),
        modeButton: 35,
        laneBProgress: 36
    }),
    lanes: Object.freeze([
        Object.freeze({
            key: "A",
            label: "A",
            inputSlots: Object.freeze([3, 4]),
            meshSlot: 5
        }),
        Object.freeze({
            key: "B",
            label: "B",
            inputSlots: Object.freeze([6, 7]),
            meshSlot: 8
        })
    ]),
    transfer: Object.freeze({
        outputIntervalTicks: 4,
        inputPullIntervalTicks: 4
    }),
    quantity: Object.freeze({
        maxLevel: 4,
        batchSizes: Object.freeze([2, 4, 8, 16, 24]) // 0, 1, 2, 3, 4
    }),
    steam: Object.freeze({
        type: "steam",
        perInput: 125,
        speedMultiplier: 1.5,
        energyMultiplier: 1.25
    }),
    defaults: Object.freeze({
        mode: "individual",
        energyCostPerInput: 800,
        fluidCap: 32000,
        minimumLegacyOutputSlot: 15,
        minimumBatchSeconds: 2.75,
        secondsPerInput: 0.45
    }),
    modes: Object.freeze({
        shared: Object.freeze({
            id: "shared",
            title: "Shared",
            description: "Both lanes use one shared progress bar. Slower, coordinated throughput.",
            speedMultiplier: 0.72,
            sharedCostMultiplier: 1.35
        }),
        individual: Object.freeze({
            id: "individual",
            title: "Individual",
            description: "Each lane advances on its own progress bar at default autosieve-like speed.",
            speedMultiplier: 1,
            sharedCostMultiplier: 1
        })
    }),
    mesh: Object.freeze({
        boostIgnoreOutput: "minecraft:flint"
    }),
    laneProgress: Object.freeze({
        A: "ascendant:dual_siever_progress_a",
        B: "ascendant:dual_siever_progress_b"
    })
});

const DUAL_SIEVER_MODE_BUTTONS = Object.freeze({
    id: "dual_siever_mode",
    namespace: "ascendant:dual_siever",
    cooldownTicks: 6,
    defaultIconItemId: "utilitycraft:switch_button",
    defaults: Object.freeze({
        mode: DUAL_SIEVER.defaults.mode
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: "mode_switch",
            property: "mode",
            slot: DUAL_SIEVER.slots.modeButton,
            type: "cycle",
            values: Object.freeze([
                DUAL_SIEVER.modes.shared.id,
                DUAL_SIEVER.modes.individual.id
            ]),
            defaultValue: DUAL_SIEVER.defaults.mode,
            getTitle: ({ state }) => `Mode: ${getDualMode(state.mode).title}`,
            getLore: ({ state }) => buildModeButtonLore(getDualMode(state.mode)),
            pressHint: "Take the switch to change processing mode.",
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                if (!machine?.setProgress) return;
                machine.setProgress(0, DUAL_SIEVER.slots.progress, "arrow_right", true);
                resetDualLaneProgress(machine);
                clearProgressVisual(machine, DUAL_SIEVER.slots.laneBProgress);
            }
        })
    ])
});

DoriosAPI.register.blockComponent("dual_siever", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? DUAL_SIEVER.defaults.energyCostPerInput);
            machine.displayEnergy(DUAL_SIEVER.slots.energy);
            machine.displayProgress(DUAL_SIEVER.slots.progress);
            machine.blockSlots([DUAL_SIEVER.slots.steamDisplay, DUAL_SIEVER.slots.steamInput]);
            clearProgressVisual(machine, DUAL_SIEVER.slots.laneBProgress);
            resetDualLaneProgress(machine);

            const tank = getSteamTank(machine, settings);
            tank.display(DUAL_SIEVER.slots.steamDisplay);

            syncSuperiorButtonPanel(machine, DUAL_SIEVER_MODE_BUTTONS, {
                detectPresses: false,
                forceRender: true
            });
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "dual_siever:ui");
        const panelState = syncSuperiorButtonPanel(machine, DUAL_SIEVER_MODE_BUTTONS, {
            forceRender: shouldRefreshUi
        });
        const mode = getDualMode(panelState.mode);

        const tank = getSteamTank(machine, settings);
        const quantityLevel = getQuantityUpgradeLevel(machine);
        const desiredBatch = getBatchSize(quantityLevel);

        if (tickGate(machine.entity, "dual_siever:transfer_cd", DUAL_SIEVER.transfer.outputIntervalTicks)) {
            transferOutputSlots(machine);
        }

        if (tickGate(machine.entity, "dual_siever:inputs_cd", DUAL_SIEVER.transfer.inputPullIntervalTicks)) {
            for (const lane of DUAL_SIEVER.lanes) {
                for (const slot of lane.inputSlots) {
                    machine.pullItemsFromAbove(slot);
                }
                machine.pullItemsFromAbove(lane.meshSlot);
            }
        }

        const operation = buildOperationPlan({
            machine,
            tank,
            settings,
            quantityLevel,
            desiredBatch,
            mode
        });

        if (!operation.ready) {
            const resetProgress = operation.message !== "Output Full" && operation.message !== "Output Conflict";
            if (resetProgress && mode.id === DUAL_SIEVER.modes.individual.id) {
                resetDualLaneProgress(machine);
            }

            showMachineWarning(
                machine,
                tank,
                operation.message,
                {
                    mode,
                    quantityLevel,
                    desiredBatch,
                    operation,
                    batchResults: []
                },
                resetProgress,
                shouldRefreshUi
            );
            return;
        }

        const modeEnergyCost = mode.id === DUAL_SIEVER.modes.shared.id
            ? getSharedModeEnergyCost(operation, mode)
            : getIndividualDisplayEnergyCost(operation);

        machine.setEnergyCost(modeEnergyCost);

        if (settings?.machine?.dynamic_rate === true && operation.referenceRecipe) {
            applyDynamicRecipeRate(machine, operation.referenceRecipe, {
                energyCost: modeEnergyCost,
                speedMultiplier: (machine.boosts.speed ?? 1) * operation.speedMultiplier * mode.speedMultiplier
            });
        }

        if (machine.energy.get() <= 0) {
            showMachineWarning(
                machine,
                tank,
                "No Energy",
                {
                    mode,
                    quantityLevel,
                    desiredBatch,
                    operation,
                    batchResults: []
                },
                false,
                shouldRefreshUi
            );
            return;
        }

        const batchResults = [];
        if (mode.id === DUAL_SIEVER.modes.shared.id) {
            const sharedEnergyCost = getSharedModeEnergyCost(operation, mode);
            const progress = machine.getProgress();
            if (progress >= sharedEnergyCost) {
                for (const lanePlan of operation.selectedLanes) {
                    const laneBatch = processLaneBatch(machine, lanePlan, tank);
                    if (laneBatch) {
                        batchResults.push(laneBatch);
                    }
                }

                machine.addProgress(-sharedEnergyCost);
            } else {
                const consumption = machine.boosts.consumption;
                const energyToConsume = Math.min(
                    machine.energy.get(),
                    machine.rate,
                    Math.max(0, sharedEnergyCost - progress) * consumption
                );

                if (energyToConsume > 0) {
                    machine.energy.consume(energyToConsume);
                    machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON));
                }
            }
        } else {
            for (const lanePlan of operation.selectedLanes) {
                const laneCost = Math.max(1, lanePlan.energyCost ?? 1);
                const laneProgress = getDualLaneProgress(machine, lanePlan.laneKey);

                if (laneProgress >= laneCost) {
                    const laneBatch = processLaneBatch(machine, lanePlan, tank);
                    if (laneBatch) {
                        batchResults.push(laneBatch);
                    }
                    setDualLaneProgress(machine, lanePlan.laneKey, laneProgress - laneCost);
                    continue;
                }

                const consumption = machine.boosts.consumption;
                const energyToConsume = Math.min(
                    machine.energy.get(),
                    machine.rate,
                    Math.max(0, laneCost - laneProgress) * consumption
                );

                if (energyToConsume > 0) {
                    machine.energy.consume(energyToConsume);
                    addDualLaneProgress(machine, lanePlan.laneKey, energyToConsume / Math.max(consumption, Number.EPSILON));
                }
            }
        }

        const statusText = batchResults.length > 0
            ? (operation.steamBoostedLaneCount > 0 ? "Boosted" : "Spinning")
            : (operation.steamBoostedLaneCount > 0 ? "Charging+" : "Charging");

        showMachineStatus(machine, tank, statusText, {
            mode,
            quantityLevel,
            desiredBatch,
            operation,
            batchResults
        }, shouldRefreshUi);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function getSteamTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : DUAL_SIEVER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(DUAL_SIEVER.steam.type);
    }

    return tank;
}

function resolveMeshData(meshStack) {
    if (!meshStack?.hasComponent?.("utilitycraft:mesh")) return null;

    const component = meshStack.getComponent("utilitycraft:mesh");
    const data = component?.customComponentParameters?.params;
    if (!data || typeof data !== "object") return null;

    return {
        tier: Math.max(0, Number(data.tier) || 0),
        multiplier: Math.max(0, Number(data.multiplier) || 1),
        amountMultiplier: Math.max(0, Number(data.amount_multiplier) || 1),
        name: meshStack.typeId
    };
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of DUAL_SIEVER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(DUAL_SIEVER.quantity.maxLevel, total));
}

function getBatchSize(quantityLevel) {
    const profileIndex = Math.max(0, Math.min(DUAL_SIEVER.quantity.batchSizes.length - 1, Number(quantityLevel) || 0));
    return DUAL_SIEVER.quantity.batchSizes[profileIndex];
}

function buildOperationPlan({ machine, tank, settings, quantityLevel, desiredBatch, mode }) {
    const baseEnergyCost = settings?.machine?.energy_cost ?? DUAL_SIEVER.defaults.energyCostPerInput;

    const lanePlans = DUAL_SIEVER.lanes.map(lane => {
        const meshStack = machine.inv.getItem(lane.meshSlot);
        const meshData = resolveMeshData(meshStack);
        return buildLanePlan(machine, lane, desiredBatch, meshData, baseEnergyCost);
    });

    const readyLanes = lanePlans.filter(plan => plan.ready);

    if (!readyLanes.length) {
        return {
            ready: false,
            message: determineMachineWarningMessage(lanePlans),
            lanePlans,
            selectedLanes: [],
            mode,
            quantityLevel,
            desiredBatch,
            energyCost: 0,
            speedMultiplier: 1,
            referenceRecipe: null,
            steamBoostedLaneCount: 0
        };
    }

    const selectedLanes = readyLanes;

    let remainingSteam = Math.max(0, tank?.get() ?? 0);
    for (const lanePlan of selectedLanes) {
        const selectedGroup = lanePlan.selectedGroup;
        if (!selectedGroup) continue;

        const steamNeeded = Math.max(0, selectedGroup.steamNeeded ?? 0);
        const steamBoostActive = steamNeeded > 0 && remainingSteam >= steamNeeded;

        if (steamBoostActive) {
            remainingSteam -= steamNeeded;
        }

        lanePlan.steamBoostActive = steamBoostActive;
        selectedGroup.steamBoostActive = steamBoostActive;

        const boostedCost = selectedGroup.baseEnergyCost * (steamBoostActive ? DUAL_SIEVER.steam.energyMultiplier : 1);
        lanePlan.energyCost = Math.max(1, Math.ceil(boostedCost));
        selectedGroup.energyCost = lanePlan.energyCost;
    }

    const energyCost = Math.max(1, selectedLanes.reduce((sum, lanePlan) => sum + (lanePlan.energyCost ?? 0), 0));
    const steamBoostedLaneCount = selectedLanes.filter(lanePlan => lanePlan.steamBoostActive).length;
    const speedMultiplier = steamBoostedLaneCount > 0 ? DUAL_SIEVER.steam.speedMultiplier : 1;

    return {
        ready: true,
        message: null,
        lanePlans,
        selectedLanes,
        mode,
        quantityLevel,
        desiredBatch,
        energyCost,
        speedMultiplier,
        referenceRecipe: buildReferenceRecipe(selectedLanes, energyCost),
        steamBoostedLaneCount
    };
}

function fitLanesToOutputCapacity(machine, lanePlans) {
    const selectedLanes = lanePlans.filter(plan => plan.ready && plan.selectedGroup?.batchCount > 0);
    if (!selectedLanes.length) {
        return { ready: false, selectedLanes: [] };
    }

    let attempts = 0;
    while (attempts < 256) {
        attempts += 1;

        const requiredOutputs = buildWorstCaseOutputRequirement(selectedLanes);
        const fit = canFitWorstCaseOutputs(machine, requiredOutputs);
        if (fit.canFit) {
            return { ready: true, selectedLanes, requiredOutputs, fit };
        }

        const laneToReduce = selectLaneForCapacityReduction(selectedLanes);
        if (!laneToReduce) break;

        reduceLaneBatchForCapacity(laneToReduce);

        for (let i = selectedLanes.length - 1; i >= 0; i -= 1) {
            const lane = selectedLanes[i];
            if (!lane.ready || !lane.selectedGroup || lane.selectedGroup.batchCount <= 0) {
                selectedLanes.splice(i, 1);
            }
        }

        if (!selectedLanes.length) break;
    }

    return { ready: false, selectedLanes: [] };
}

function selectLaneForCapacityReduction(selectedLanes) {
    let bestLane = null;
    let bestScore = -1;

    for (const lanePlan of selectedLanes) {
        const batchCount = lanePlan?.selectedGroup?.batchCount ?? 0;
        if (batchCount <= 0) continue;

        const perInputWorstCase = getLaneWorstCasePerInput(lanePlan);
        const score = Math.max(1, perInputWorstCase) * batchCount;

        if (score > bestScore) {
            bestScore = score;
            bestLane = lanePlan;
            continue;
        }

        if (score === bestScore && bestLane) {
            const bestBatch = bestLane.selectedGroup?.batchCount ?? 0;
            if (batchCount > bestBatch) {
                bestLane = lanePlan;
            }
        }
    }

    return bestLane;
}

function reduceLaneBatchForCapacity(lanePlan) {
    const currentBatch = lanePlan?.selectedGroup?.batchCount ?? 0;
    rebuildLaneBatchStats(lanePlan, currentBatch - 1);
}

function rebuildLaneBatchStats(lanePlan, nextBatchCount) {
    const group = lanePlan?.selectedGroup;
    if (!group) return;

    const batchCount = Math.max(0, Math.floor(nextBatchCount));
    group.batchCount = batchCount;
    group.missingInput = batchCount <= 0;

    if (batchCount <= 0) {
        group.ready = false;
        group.baseEnergyCost = 0;
        group.energyCost = 0;
        group.steamNeeded = 0;
        group.cycleSeconds = 0;
        group.estimatedOutputs = 0;

        lanePlan.ready = false;
        lanePlan.energyCost = 0;
        lanePlan.message = "Output Full";
        return;
    }

    const energyCostPerInput = Math.max(
        1,
        Number(group.energyCostPerInput) || DUAL_SIEVER.defaults.energyCostPerInput
    );

    group.baseEnergyCost = Math.max(1, energyCostPerInput * batchCount);
    group.energyCost = group.baseEnergyCost;
    group.steamNeeded = DUAL_SIEVER.steam.perInput * batchCount;
    group.cycleSeconds = computeCycleSeconds(batchCount);
    group.estimatedOutputs = estimateExpectedOutputs(group.eligibleDrops, batchCount, lanePlan.meshData);
    group.ready = true;

    lanePlan.ready = true;
    lanePlan.energyCost = group.baseEnergyCost;
    lanePlan.message = null;
}

function getLaneWorstCasePerInput(lanePlan) {
    const group = lanePlan?.selectedGroup;
    if (!group?.eligibleDrops?.length) return 0;

    const amountMultiplier = Math.max(0, Number(lanePlan.meshData?.amountMultiplier) || 1);
    let worstCase = 0;

    for (const entry of group.eligibleDrops) {
        const effectiveChance = getEffectiveEntryChance(entry, lanePlan.meshData);
        if (effectiveChance < 1) continue;

        const maxBaseAmount = resolveEntryMaxAmount(entry.amount);
        if (maxBaseAmount <= 0) continue;

        worstCase += Math.max(1, Math.ceil(maxBaseAmount * amountMultiplier));
    }

    return worstCase;
}

function buildWorstCaseOutputRequirement(selectedLanes) {
    const requiredOutputs = new Map();

    for (const lanePlan of selectedLanes) {
        const group = lanePlan?.selectedGroup;
        if (!group || group.batchCount <= 0) continue;

        const amountMultiplier = Math.max(0, Number(lanePlan.meshData?.amountMultiplier) || 1);

        for (const entry of group.eligibleDrops ?? []) {
            const itemId = entry?.item;
            if (!itemId) continue;

            const effectiveChance = getEffectiveEntryChance(entry, lanePlan.meshData);
            if (effectiveChance < 1) continue;

            const maxBaseAmount = resolveEntryMaxAmount(entry.amount);
            if (maxBaseAmount <= 0) continue;

            const perInputAmount = Math.max(1, Math.ceil(maxBaseAmount * amountMultiplier));
            const totalAmount = perInputAmount * group.batchCount;

            requiredOutputs.set(itemId, (requiredOutputs.get(itemId) ?? 0) + totalAmount);
        }
    }

    return requiredOutputs;
}

function canFitWorstCaseOutputs(machine, requiredOutputs) {
    if (!(requiredOutputs instanceof Map) || requiredOutputs.size <= 0) {
        return { canFit: true, slotsNeeded: 0, emptySlots: 0 };
    }

    const outputSlots = getAvailableOutputSlots(machine);
    let emptySlots = 0;
    const existingSpaceByItem = new Map();

    for (const slot of outputSlots) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            emptySlots += 1;
            continue;
        }

        const space = Math.max(0, resolveMaxStackSize(stack, stack.typeId) - stack.amount);
        if (space <= 0) continue;

        existingSpaceByItem.set(stack.typeId, (existingSpaceByItem.get(stack.typeId) ?? 0) + space);
    }

    let slotsNeeded = 0;

    for (const [itemId, requiredAmount] of requiredOutputs) {
        if (!itemId || requiredAmount <= 0) continue;

        const existingSpace = existingSpaceByItem.get(itemId) ?? 0;
        const remainingAmount = Math.max(0, requiredAmount - existingSpace);
        if (remainingAmount <= 0) continue;

        const maxStack = Math.max(1, resolveMaxStackSize(null, itemId));
        slotsNeeded += Math.ceil(remainingAmount / maxStack);

        if (slotsNeeded > emptySlots) {
            return { canFit: false, slotsNeeded, emptySlots };
        }
    }

    return { canFit: slotsNeeded <= emptySlots, slotsNeeded, emptySlots };
}

function buildLanePlan(machine, lane, desiredBatch, meshData, baseEnergyCost) {
    const lanePlan = {
        laneKey: lane.key,
        laneLabel: lane.label,
        inputSlots: lane.inputSlots,
        meshSlot: lane.meshSlot,
        meshData,
        hasMesh: Boolean(meshData),
        hasCandidateInput: false,
        ready: false,
        message: null,
        selectedGroup: null,
        focusGroup: null,
        groupPlans: [],
        desiredBatch,
        steamBoostActive: false,
        energyCost: 0
    };

    if (!meshData) {
        lanePlan.message = "Insert Mesh";
        return lanePlan;
    }

    const inputGroups = collectInputGroups(machine, lane.inputSlots);
    if (!inputGroups.length) {
        lanePlan.message = "Insert Items";
        return lanePlan;
    }

    lanePlan.hasCandidateInput = true;
    lanePlan.groupPlans = inputGroups.map(group => (
        buildGroupPlan(machine, group, desiredBatch, meshData, baseEnergyCost)
    ));

    const selectedGroup = lanePlan.groupPlans.find(group => group.ready) ?? null;
    if (selectedGroup) {
        lanePlan.ready = true;
        lanePlan.message = null;
        lanePlan.selectedGroup = selectedGroup;
        lanePlan.focusGroup = selectedGroup;
        lanePlan.energyCost = selectedGroup.baseEnergyCost;
        return lanePlan;
    }

    lanePlan.focusGroup = (
        lanePlan.groupPlans.find(group => group.invalidRecipe)
        ?? lanePlan.groupPlans.find(group => group.meshTooWeak)
        ?? lanePlan.groupPlans.find(group => group.outputConflict)
        ?? lanePlan.groupPlans.find(group => group.outputFull)
        ?? lanePlan.groupPlans.find(group => group.missingInput)
        ?? lanePlan.groupPlans[0]
    );
    lanePlan.message = determineLaneWarningMessage(lanePlan.groupPlans);

    return lanePlan;
}

function collectInputGroups(machine, inputSlots) {
    const groups = [];
    const groupMap = new Map();

    for (const slot of inputSlots) {
        const stack = machine.inv.getItem(slot);
        if (!stack) continue;

        let group = groupMap.get(stack.typeId);
        if (!group) {
            group = {
                typeId: stack.typeId,
                firstSlot: slot,
                totalAmount: 0,
                slots: [],
                recipe: getCentrifugalSieveRecipe(stack.typeId)
            };
            groups.push(group);
            groupMap.set(stack.typeId, group);
        }

        group.totalAmount += stack.amount;
        group.slots.push(slot);
    }

    return groups.sort((left, right) => left.firstSlot - right.firstSlot);
}

function buildGroupPlan(machine, group, desiredBatch, meshData, baseEnergyCost) {
    const recipe = group.recipe;
    const plan = {
        ...group,
        ready: false,
        invalidRecipe: false,
        meshTooWeak: false,
        outputConflict: false,
        outputFull: false,
        missingInput: false,
        desiredBatch,
        batchCount: 0,
        steamNeeded: 0,
        steamBoostActive: false,
        energyCost: 0,
        energyCostPerInput: 0,
        baseEnergyCost: 0,
        cycleSeconds: 0,
        eligibleDrops: [],
        producibleDrops: [],
        estimatedOutputs: 0,
        outputPlan: null
    };

    if (!recipe?.length) {
        plan.invalidRecipe = true;
        return plan;
    }

    plan.eligibleDrops = recipe.filter(entry => canMeshRollEntry(meshData, entry));
    if (!plan.eligibleDrops.length) {
        plan.meshTooWeak = true;
        return plan;
    }

    plan.producibleDrops = filterDropsByOutputCapacity(machine, plan.eligibleDrops);
    if (!plan.producibleDrops.length) {
        plan.outputFull = true;
        return plan;
    }

    plan.outputPlan = buildOutputPlan(machine, plan.producibleDrops.map(entry => entry.item));
    plan.outputConflict = plan.outputPlan.compatibleSlotCount <= 0;
    plan.outputFull = !plan.outputPlan.hasSpace;
    plan.batchCount = Math.max(0, Math.min(group.totalAmount, desiredBatch));
    plan.missingInput = plan.batchCount <= 0;

    if (plan.batchCount <= 0 || plan.outputConflict || plan.outputFull) {
        return plan;
    }

    plan.energyCostPerInput = Math.max(1, Math.ceil(baseEnergyCost));
    plan.baseEnergyCost = Math.max(1, plan.energyCostPerInput * plan.batchCount);
    plan.steamNeeded = DUAL_SIEVER.steam.perInput * plan.batchCount;
    plan.steamBoostActive = false;
    plan.energyCost = plan.baseEnergyCost;
    plan.cycleSeconds = computeCycleSeconds(plan.batchCount);
    plan.estimatedOutputs = estimateExpectedOutputs(plan.eligibleDrops, plan.batchCount, meshData);
    plan.ready = true;

    return plan;
}

function canMeshRollEntry(meshData, entry) {
    if (!meshData || !entry) return false;
    if (meshData.tier < (entry.tier ?? 0)) return false;
    if (meshData.tier >= 7 && entry.item === DUAL_SIEVER.mesh.boostIgnoreOutput) return false;
    return isValidItemId(entry.item);
}

function getEffectiveEntryChance(entry, meshData) {
    const baseChance = Number(entry?.chance ?? 0);
    if (!Number.isFinite(baseChance) || baseChance <= 0) return 0;

    const chanceMultiplier = Math.max(0, Number(meshData?.multiplier) || 1);
    if (chanceMultiplier <= 0) return 0;

    return baseChance * chanceMultiplier;
}

function filterDropsByOutputCapacity(machine, entries) {
    if (!Array.isArray(entries) || entries.length <= 0) return [];
    return entries.filter(entry => {
        const itemId = entry?.item;
        if (!itemId) return false;
        return getOutputInsertCapacity(machine, itemId) > 0;
    });
}

function getOutputInsertCapacity(machine, itemId) {
    if (!itemId) return 0;

    const outputSlots = getAvailableOutputSlots(machine);
    const maxStack = Math.max(1, resolveMaxStackSize(null, itemId));
    let total = 0;

    for (const slot of outputSlots) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            total += maxStack;
            continue;
        }

        if (stack.typeId !== itemId) continue;

        const stackMax = Math.max(1, resolveMaxStackSize(stack, itemId));
        total += Math.max(0, stackMax - stack.amount);
    }

    return Math.max(0, total);
}

function buildOutputPlan(machine, candidateOutputIds) {
    const uniqueOutputIds = [...new Set(candidateOutputIds.filter(Boolean))];
    const availableOutputSlots = getAvailableOutputSlots(machine);
    const slots = [];
    let totalSpace = 0;
    let compatibleSlotCount = 0;
    let emptySlotCount = 0;

    for (const slot of availableOutputSlots) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            const maxAmount = resolveMaxStackSize(null, uniqueOutputIds[0]);
            slots.push({
                slot,
                empty: true,
                compatible: true,
                space: maxAmount,
                itemId: null
            });
            compatibleSlotCount += 1;
            emptySlotCount += 1;
            totalSpace += maxAmount;
            continue;
        }

        if (!uniqueOutputIds.includes(stack.typeId)) {
            slots.push({
                slot,
                empty: false,
                compatible: false,
                space: 0,
                itemId: stack.typeId
            });
            continue;
        }

        const maxAmount = resolveMaxStackSize(stack, stack.typeId);
        const space = Math.max(0, maxAmount - stack.amount);
        slots.push({
            slot,
            empty: false,
            compatible: true,
            space,
            itemId: stack.typeId
        });
        compatibleSlotCount += 1;
        totalSpace += space;
    }

    return {
        slots,
        totalSpace,
        emptySlotCount,
        compatibleSlotCount,
        hasSpace: totalSpace > 0,
        candidateOutputIds: uniqueOutputIds
    };
}

function getAvailableOutputSlots(machine) {
    const containerSize = Number(machine?.inv?.size);
    if (!Number.isFinite(containerSize) || containerSize <= 0) {
        return DUAL_SIEVER.slots.outputs;
    }

    return DUAL_SIEVER.slots.outputs.filter(slot => (
        slot >= DUAL_SIEVER.defaults.minimumLegacyOutputSlot
        && slot < containerSize
    ));
}

function determineLaneWarningMessage(groupPlans) {
    if (groupPlans.some(group => group.invalidRecipe)) return "Input Invalid";
    if (groupPlans.some(group => group.meshTooWeak)) return "Mesh Too Weak";
    if (groupPlans.some(group => group.outputConflict)) return "Output Conflict";
    if (groupPlans.some(group => group.outputFull)) return "Output Full";
    if (groupPlans.some(group => group.missingInput)) return "Missing Items";
    return "Insert Items";
}

function determineMachineWarningMessage(lanePlans) {
    if (lanePlans.every(plan => !plan.hasMesh)) return "Insert Mesh";

    const orderedMessages = [
        "Output Conflict",
        "Output Full",
        "Input Invalid",
        "Mesh Too Weak",
        "Insert Mesh",
        "Missing Items",
        "Insert Items"
    ];

    for (const message of orderedMessages) {
        if (lanePlans.some(plan => plan.message === message)) {
            return message;
        }
    }

    return "Insert Items";
}

function buildReferenceRecipe(selectedLanes, energyCost) {
    const maxSeconds = selectedLanes.reduce(
        (maxValue, lanePlan) => Math.max(maxValue, lanePlan?.selectedGroup?.cycleSeconds ?? DUAL_SIEVER.defaults.minimumBatchSeconds),
        DUAL_SIEVER.defaults.minimumBatchSeconds
    );

    return {
        energyCost,
        seconds: maxSeconds,
        ticks: Math.ceil(maxSeconds * 20)
    };
}

function computeCycleSeconds(batchCount) {
    return Math.max(
        DUAL_SIEVER.defaults.minimumBatchSeconds,
        batchCount * DUAL_SIEVER.defaults.secondsPerInput
    );
}

function processLaneBatch(machine, lanePlan, tank) {
    const group = lanePlan?.selectedGroup;
    if (!group || group.batchCount <= 0) return null;

    consumeGroupedInput(machine, group, group.batchCount);

    if (lanePlan.steamBoostActive && group.steamNeeded > 0) {
        tank.consume(group.steamNeeded);
    }

    const sourceDrops = (group.producibleDrops?.length ?? 0) > 0
        ? group.producibleDrops
        : group.eligibleDrops;

    const dropRoll = rollBatchOutputs(sourceDrops, group.batchCount, lanePlan.meshData);
    group.mappedDrops = dropRoll.mappedDrops;

    const rolledOutputs = dropRoll.batchedDrops;
    const cappedOutputs = (typeof clampOutputsToAvailableCapacity === "function")
        ? clampOutputsToAvailableCapacity(machine, rolledOutputs)
        : rolledOutputs;
    const distribution = distributeOutputs(machine, cappedOutputs);

    return {
        lane: lanePlan.laneLabel,
        inputId: group.typeId,
        batchCount: group.batchCount,
        produced: distribution.insertedTotal,
        uniqueOutputs: distribution.insertedTypes,
        overflow: distribution.spilledTotal,
        steamUsed: lanePlan.steamBoostActive ? group.steamNeeded : 0
    };
}

function rollBatchOutputs(entries, batchCount, meshData) {
    const batchedDrops = applyBatchMultiplierToDrops(entries, batchCount, meshData);
    const mappedDrops = buildMappedDropObject(batchedDrops);

    return {
        mappedDrops,
        batchedDrops
    };
}

function simulateAutosieveDrops(entries, meshData) {
    const mapped = new Map();
    if (!Array.isArray(entries) || entries.length <= 0) return mapped;

    const chanceMultiplier = Math.max(0, Number(meshData?.multiplier) || 1);
    const amountMultiplier = Math.max(0, Number(meshData?.amountMultiplier) || 1);

    for (const entry of entries) {
        const itemId = entry?.item;
        if (!itemId || !isValidItemId(itemId)) continue;

        const chance = Math.max(0, Math.min(1, Number(entry?.chance) * chanceMultiplier));
        if (chance <= 0) continue;
        if (Math.random() > chance) continue;

        let quantity = resolveEntryAmount(entry?.amount);
        if (amountMultiplier > 0) {
            quantity *= amountMultiplier;
        }

        const normalized = Math.max(1, Math.ceil(Math.random() * quantity));
        mapped.set(itemId, (mapped.get(itemId) ?? 0) + normalized);
    }

    return mapped;
}

function buildMappedDropObject(dropMap) {
    const mapped = Object.create(null);
    if (!(dropMap instanceof Map) || dropMap.size <= 0) return mapped;

    const ordered = [...dropMap.entries()].sort((left, right) => left[0].localeCompare(right[0]));
    for (const [itemId, amount] of ordered) {
        const normalized = Math.max(0, Math.floor(Number(amount) || 0));
        if (!itemId || normalized <= 0) continue;
        mapped[itemId] = normalized;
    }

    return mapped;
}

function applyBatchMultiplierToDrops(entries, batchCount, meshData) {
    const multiplied = new Map();
    if (!Array.isArray(entries) || entries.length <= 0) return multiplied;

    const multiplier = Math.max(0, Math.min(128, Math.floor(Number(batchCount) || 0)));
    if (multiplier <= 0) return multiplied;

    for (let roll = 0; roll < multiplier; roll += 1) {
        const baseRollDrops = simulateAutosieveDrops(entries, meshData);
        mergeDropMap(multiplied, baseRollDrops);
    }

    return multiplied;
}

function mergeDropMap(target, source) {
    if (!(target instanceof Map) || !(source instanceof Map) || source.size <= 0) return;

    for (const [itemId, amount] of source) {
        if (!itemId) continue;

        const normalized = Math.max(0, Math.floor(Number(amount) || 0));
        if (normalized <= 0) continue;

        target.set(itemId, (target.get(itemId) ?? 0) + normalized);
    }
}

function resolveEntryAmount(amount) {
    if (Array.isArray(amount) && amount.length >= 2) {
        const min = Math.max(1, Math.floor(Number(amount[0]) || 1));
        const max = Math.max(min, Math.floor(Number(amount[1]) || min));
        return DoriosAPI.math.randomInterval(min, max);
    }

    return Math.max(1, Math.floor(Number(amount) || 1));
}

function resolveEntryMaxAmount(amount) {
    if (Array.isArray(amount) && amount.length >= 2) {
        const min = Math.max(1, Math.floor(Number(amount[0]) || 1));
        const max = Math.max(min, Math.floor(Number(amount[1]) || min));
        return max;
    }

    return Math.max(1, Math.floor(Number(amount) || 1));
}

function clampOutputsToAvailableCapacity(machine, rolledOutputs) {
    const capped = new Map();
    if (!(rolledOutputs instanceof Map) || rolledOutputs.size <= 0) return capped;

    const reservationState = createOutputReservationState(machine);
    const ordered = [...rolledOutputs.entries()].sort((left, right) => left[0].localeCompare(right[0]));

    for (const [itemId, amount] of ordered) {
        const desiredAmount = Math.max(0, Math.floor(Number(amount) || 0));
        if (!itemId || desiredAmount <= 0) continue;

        const reservableAmount = reserveOutputAmount(reservationState, itemId, desiredAmount);
        if (reservableAmount <= 0) continue;

        capped.set(itemId, reservableAmount);
    }

    return capped;
}

function createOutputReservationState(machine) {
    const slots = [];

    for (const slot of getAvailableOutputSlots(machine)) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            slots.push({
                slot,
                itemId: null,
                amount: 0,
                maxAmount: 0
            });
            continue;
        }

        slots.push({
            slot,
            itemId: stack.typeId,
            amount: stack.amount,
            maxAmount: Math.max(1, resolveMaxStackSize(stack, stack.typeId))
        });
    }

    return { slots };
}

function reserveOutputAmount(reservationState, itemId, amount) {
    if (!reservationState?.slots?.length || !itemId || amount <= 0) return 0;

    let remaining = Math.max(0, Math.floor(amount));

    for (const slot of reservationState.slots) {
        if (remaining <= 0) break;
        if (slot.itemId !== itemId) continue;

        const space = Math.max(0, slot.maxAmount - slot.amount);
        if (space <= 0) continue;

        const inserted = Math.min(space, remaining);
        slot.amount += inserted;
        remaining -= inserted;
    }

    const maxAmount = Math.max(1, resolveMaxStackSize(null, itemId));
    for (const slot of reservationState.slots) {
        if (remaining <= 0) break;
        if (slot.itemId !== null) continue;

        const inserted = Math.min(maxAmount, remaining);
        if (inserted <= 0) continue;

        slot.itemId = itemId;
        slot.maxAmount = maxAmount;
        slot.amount = inserted;
        remaining -= inserted;
    }

    return Math.max(0, amount - remaining);
}

function distributeOutputs(machine, rolledOutputs) {
    let insertedTotal = 0;
    let spilledTotal = 0;
    let insertedTypes = 0;

    const ordered = [...rolledOutputs.entries()].sort((left, right) => left[0].localeCompare(right[0]));
    for (const [itemId, rolledAmount] of ordered) {
        const producedAmount = machine.addFractionalItem(itemId, rolledAmount);
        if (producedAmount <= 0) continue;

        const insertedAmount = distributeSingleOutput(machine, itemId, producedAmount);
        const spilledAmount = Math.max(0, producedAmount - insertedAmount);

        if (insertedAmount > 0) {
            insertedTypes += 1;
            insertedTotal += insertedAmount;
        }

        spilledTotal += spilledAmount;
    }

    return {
        insertedTotal,
        insertedTypes,
        spilledTotal
    };
}

function distributeSingleOutput(machine, itemId, amount) {
    const availableOutputSlots = getAvailableOutputSlots(machine);
    let remaining = Math.max(0, Math.floor(amount));
    if (remaining <= 0) return 0;

    for (const slot of availableOutputSlots) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (!current || current.typeId !== itemId) continue;

        const space = Math.max(0, resolveMaxStackSize(current, itemId) - current.amount);
        const inserted = Math.min(space, remaining);
        if (inserted <= 0) continue;

        machine.entity.changeItemAmount(slot, inserted);
        remaining -= inserted;
    }

    const maxAmount = resolveMaxStackSize(null, itemId);
    for (const slot of availableOutputSlots) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (current) continue;

        const inserted = Math.min(maxAmount, remaining);
        if (inserted <= 0) continue;

        machine.entity.setItem(slot, itemId, inserted);
        remaining -= inserted;
    }

    return amount - remaining;
}

function consumeGroupedInput(machine, groupPlan, amount) {
    let remaining = Math.max(0, amount);

    for (const slot of groupPlan.slots) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (!current || current.typeId !== groupPlan.typeId) continue;

        const consumed = Math.min(current.amount, remaining);
        if (consumed <= 0) continue;

        machine.entity.changeItemAmount(slot, -consumed);
        remaining -= consumed;
    }

    return remaining <= 0;
}

function estimateExpectedOutputs(entries, batchCount, meshData) {
    const chanceMultiplier = Math.max(0, Number(meshData?.multiplier) || 1);
    const amountMultiplier = Math.max(0, Number(meshData?.amountMultiplier) || 1);
    let total = 0;

    for (const entry of entries) {
        const averageAmount = Array.isArray(entry.amount)
            ? (entry.amount[0] + entry.amount[1]) / 2
            : Number(entry.amount) || 1;
        const normalizedChance = Math.max(0, Math.min(1, Number(entry.chance) * chanceMultiplier));
        const scaledAverageAmount = Math.max(1, averageAmount * amountMultiplier);
        const randomizedAverageAmount = (scaledAverageAmount + 1) / 2;
        total += randomizedAverageAmount * normalizedChance * batchCount;
    }

    return Math.max(0, Math.round(total));
}

function transferOutputSlots(machine) {
    let transferred = false;
    for (const slot of getAvailableOutputSlots(machine)) {
        transferred = transferSlotForward(machine, slot) || transferred;
    }
    return transferred;
}

function transferSlotForward(machine, slotIndex) {
    const facing = machine.block.getState("utilitycraft:axis");
    if (!facing) return false;

    const offsets = {
        east: [-1, 0, 0],
        west: [1, 0, 0],
        north: [0, 0, 1],
        south: [0, 0, -1],
        up: [0, -1, 0],
        down: [0, 1, 0]
    };

    const offset = offsets[facing];
    if (!offset) return false;

    const { x, y, z } = machine.block.location;
    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };
    DoriosAPI.containers.transferItemsAt(machine.inv, targetLoc, machine.dim, slotIndex);
    return true;
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

function getDualMode(modeId) {
    if (modeId === DUAL_SIEVER.modes.shared.id) return DUAL_SIEVER.modes.shared;
    if (modeId === DUAL_SIEVER.modes.individual.id) return DUAL_SIEVER.modes.individual;
    return DUAL_SIEVER.modes[DUAL_SIEVER.defaults.mode];
}

function buildModeButtonLore(mode) {
    if (mode.id === DUAL_SIEVER.modes.shared.id) {
        return [
            "§7Shared progress across both lanes.",
            "§7Balanced steam usage."
        ];
    }

    return [
        "§7Independent lane progress.",
        "§7Best throughput with both lanes loaded."
    ];
}

function getSharedModeEnergyCost(operation, mode) {
    const base = Math.max(1, Number(operation?.energyCost) || 1);
    const multiplier = Math.max(1, Number(mode?.sharedCostMultiplier) || 1);
    return Math.max(1, Math.ceil(base * multiplier));
}

function getIndividualDisplayEnergyCost(operation) {
    const selected = Array.isArray(operation?.selectedLanes) ? operation.selectedLanes : [];
    if (!selected.length) return 1;

    const largestLaneCost = selected.reduce((maxValue, lanePlan) => (
        Math.max(maxValue, Math.max(1, Number(lanePlan?.energyCost) || 1))
    ), 1);

    return largestLaneCost;
}

function getDualLaneProgressProperty(laneKey) {
    if (laneKey === "A") return DUAL_SIEVER.laneProgress.A;
    if (laneKey === "B") return DUAL_SIEVER.laneProgress.B;
    return null;
}

function getDualLaneProgress(machine, laneKey) {
    const propertyId = getDualLaneProgressProperty(laneKey);
    if (!propertyId) return 0;

    const current = Number(machine?.entity?.getDynamicProperty?.(propertyId) ?? 0);
    return Number.isFinite(current) && current > 0 ? current : 0;
}

function setDualLaneProgress(machine, laneKey, value) {
    const propertyId = getDualLaneProgressProperty(laneKey);
    if (!propertyId || !machine?.entity?.setDynamicProperty) return;

    const normalized = Math.max(0, Number(value) || 0);
    machine.entity.setDynamicProperty(propertyId, normalized);
}

function addDualLaneProgress(machine, laneKey, amount) {
    if (!amount || !Number.isFinite(amount)) return;

    const current = getDualLaneProgress(machine, laneKey);
    const hyperMultiplier = Number(machine?.boosts?.hyper ?? 1);
    const effectiveHyper = Number.isFinite(hyperMultiplier) && hyperMultiplier > 0 ? hyperMultiplier : 1;
    const delta = amount > 0 ? amount * effectiveHyper : amount;

    setDualLaneProgress(machine, laneKey, current + delta);
}

function resetDualLaneProgress(machine) {
    setDualLaneProgress(machine, "A", 0);
    setDualLaneProgress(machine, "B", 0);
}

function setProgressVisual(machine, slot, progress, energyCost, type = "arrow_right") {
    if (!machine?.inv || typeof slot !== "number") return;

    const normalizedCost = Math.max(1, Number(energyCost) || 1);
    const normalizedProgress = Math.max(0, Number(progress) || 0);
    const frame = Math.max(0, Math.min(16, Math.floor((normalizedProgress / normalizedCost) * 16)));
    const itemId = `utilitycraft:${type}_${frame}`;
    const current = machine.inv.getItem(slot);

    if (current?.typeId === itemId && (current.amount ?? 1) === 1) return;
    machine.entity.setItem(slot, itemId, 1);
}

function clearProgressVisual(machine, slot) {
    if (!machine?.inv || typeof slot !== "number") return;
    const current = machine.inv.getItem(slot);
    if (!current) return;
    machine.inv.setItem(slot, undefined);
}

function updateDualProgressDisplays(machine, context = {}, refreshUi = true) {
    if (!refreshUi) return;

    const mode = getDualMode(context.mode?.id ?? context.mode);
    if (mode.id === DUAL_SIEVER.modes.shared.id) {
        machine.displayProgress(DUAL_SIEVER.slots.progress);
        clearProgressVisual(machine, DUAL_SIEVER.slots.laneBProgress);
        return;
    }

    const selectedLanes = context.operation?.selectedLanes ?? [];
    const laneAPlan = selectedLanes.find(plan => plan?.laneKey === "A") ?? null;
    const laneBPlan = selectedLanes.find(plan => plan?.laneKey === "B") ?? null;

    const laneAEnergyCost = Math.max(1, Number(laneAPlan?.energyCost) || Number(machine.getEnergyCost()) || 1);
    const laneBEnergyCost = Math.max(1, Number(laneBPlan?.energyCost) || laneAEnergyCost);

    setProgressVisual(machine, DUAL_SIEVER.slots.progress, getDualLaneProgress(machine, "A"), laneAEnergyCost);
    setProgressVisual(machine, DUAL_SIEVER.slots.laneBProgress, getDualLaneProgress(machine, "B"), laneBEnergyCost);
}

function buildMachineLore(machine, tank, context = {}) {
    const mode = getDualMode(context.mode?.id ?? context.mode);
    const operation = context.operation ?? null;
    const lanePlans = operation?.lanePlans ?? [];

    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Mode",
            value: mode.title
        },
        {
            label: "Steam",
            value: formatFluidTankBuffer(tank, DUAL_SIEVER.steam.type)
        },
        {
            label: "Batch",
            value: formatBatchWithQuantity(context.desiredBatch ?? 1, context.quantityLevel ?? 0)
        },
        {
            label: "Lanes",
            value: `${operation?.selectedLanes?.length ?? 0}/${DUAL_SIEVER.lanes.length}`
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    for (const lane of DUAL_SIEVER.lanes) {
        const lanePlan = lanePlans.find(plan => plan.laneKey === lane.key) ?? null;
        appendLoreSection(lines, `Lane ${lane.label} Info`, buildLaneLoreEntries(lane, lanePlan));
    }

    if (Array.isArray(context.batchResults)) {
        const batchEntries = [];
        for (const batch of context.batchResults) {
            if (!batch || batch.produced <= 0) continue;
            batchEntries.push(`§7Lane ${batch.lane}: §f+${batch.produced}`);
            if (batch.overflow > 0) {
                batchEntries.push(`§6Lane ${batch.lane}: ${batch.overflow} overflow`);
            }
        }

        if (batchEntries.length > 0) {
            appendLoreSection(lines, "Last Batch", batchEntries);
        }
    }

    return lines;
}

function buildLaneLoreEntries(lane, lanePlan) {
    const entries = [];

    if (!lanePlan) {
        entries.push({
            label: "State",
            value: "Idle",
            valueColor: "§8"
        });
        return entries;
    }

    if (!lanePlan.hasMesh) {
        entries.push({
            label: "Mesh",
            value: "None"
        });
        return entries;
    }

    entries.push({
        label: "Mesh",
        value: `Tier ${lanePlan.meshData?.tier ?? 0}`
    });

    if (!lanePlan.selectedGroup) {
        if (lanePlan.focusGroup?.typeId) {
            entries.push({
                label: "Block",
                value: formatItemName(lanePlan.focusGroup.typeId)
            });
        } else {
            entries.push({
                label: "State",
                value: "Idle",
                valueColor: "§8"
            });
        }

        return entries;
    }

    const group = lanePlan.selectedGroup;
    entries.push({
        label: "Block",
        value: formatItemName(group.typeId)
    });
    entries.push({
        label: "Batch",
        value: group.batchCount
    });
    entries.push({
        label: "Cost",
        value: `${formatEnergyCost(lanePlan.energyCost ?? group.energyCost ?? 0)}${formatOptionalFluidSuffix(lanePlan.steamBoostActive, group.steamNeeded, "Steam")}`
    });
    entries.push({
        label: "Status",
        value: lanePlan.steamBoostActive ? "Boosted" : "Ready",
        valueColor: lanePlan.steamBoostActive ? "§b" : "§7"
    });

    return entries;
}

function buildFooterLines(machine, context = {}) {
    const mode = getDualMode(context.mode?.id ?? context.mode);
    const operation = context.operation ?? null;
    const lines = [
        `Mode: ${mode.title}`,
        `Lanes: ${operation?.selectedLanes?.length ?? 0}/${DUAL_SIEVER.lanes.length}`,
        `Batch: ${formatBatchWithQuantity(context.desiredBatch ?? 1, context.quantityLevel ?? 0)}`
    ];

    if ((operation?.steamBoostedLaneCount ?? 0) > 0) {
        lines.push(`Steam+: ${operation.steamBoostedLaneCount}`);
    }

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) {
        lines.push(overclockLine.replace(/^§r/, ""));
    }

    return lines;
}

function updateDisplays(machine, tank, context = {}, refreshUi = true) {
    if (!refreshUi) return;

    tank.display(DUAL_SIEVER.slots.steamDisplay);
    machine.displayEnergy(DUAL_SIEVER.slots.energy);
    updateDualProgressDisplays(machine, context, true);
}

function showMachineWarning(machine, tank, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off();
    if (!refreshUi) return;

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(machine, tank, context),
        {
            footerLines: buildFooterLines(machine, context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, tank, context, true);
}

function showMachineStatus(machine, tank, message, context = {}, refreshUi = true) {
    machine.on();
    if (!refreshUi) return;

    machine.showStatus(
        message,
        buildMachineLore(machine, tank, context),
        {
            footerLines: buildFooterLines(machine, context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, tank, context, true);
}

function isValidItemId(id) {
    if (!id || typeof id !== "string") return false;
    try {
        new ItemStack(id, 1);
        return true;
    } catch {
        return false;
    }
}

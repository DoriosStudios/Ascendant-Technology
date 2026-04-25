import { ItemStack } from "@minecraft/server";
import {
    Machine,
    FluidManager,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate
} from "../../../DoriosCore/main.js";
import { getCentrifugalSieveRecipe } from "../../../config/recipes/centrifugal_siever.js";
import {
    formatBatchWithQuantity,
    formatEnergyCost,
    formatFluidNeedValue,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatOptionalFluidSuffix,
    shouldRefreshSuperiorUi
} from "./utils.js";

const CENTRIFUGAL_SIEVER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5, 6]),
        mesh: 7,
        steamInput: 8,
        steamDisplay: 9,
        upgrades: Object.freeze([10, 11, 12, 13]),
        outputs: Object.freeze([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28])
    }),
    transfer: Object.freeze({
        outputIntervalTicks: 4,
        inputPullIntervalTicks: 4,
        itemAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        })
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
        energyCostPerInput: 800,
        fluidCap: 32000,
        minimumLegacyOutputSlot: 14,
        minimumBatchSeconds: 2.75,
        secondsPerInput: 0.45
    }),
    mesh: Object.freeze({
        boostIgnoreOutput: "minecraft:flint"
    }),
    lockProperty: "ascendant:centrifugal_siever_locked_input"
});

const MAX_STACK_SIZE_CACHE = new Map();

DoriosAPI.register.blockComponent("centrifugal_siever", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? CENTRIFUGAL_SIEVER.defaults.energyCostPerInput);
            machine.displayEnergy(CENTRIFUGAL_SIEVER.slots.energy);
            machine.displayProgress(CENTRIFUGAL_SIEVER.slots.progress);
            machine.blockSlots([CENTRIFUGAL_SIEVER.slots.steamDisplay, CENTRIFUGAL_SIEVER.slots.steamInput]);

            const tank = getSteamTank(machine, settings);
            tank.display(CENTRIFUGAL_SIEVER.slots.steamDisplay);

            machine.entity.setItem(CENTRIFUGAL_SIEVER.slots.status, "utilitycraft:arrow_indicator_90", 1, "");
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const tank = getSteamTank(machine, settings);
        const quantityLevel = getQuantityUpgradeLevel(machine);
        const desiredBatch = getBatchSize(quantityLevel);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "centrifugal_siever:ui");

        runAdaptiveTickGate(
            machine.entity,
            "centrifugal_siever:item_io",
            CENTRIFUGAL_SIEVER.transfer.itemAdaptive,
            () => {
                const hasOutputItems = getAvailableOutputSlots(machine).some(slot => !!machine.inv.getItem(slot));
                const hasInputRoom = [...CENTRIFUGAL_SIEVER.slots.inputs, CENTRIFUGAL_SIEVER.slots.mesh].some(slot => {
                    const stack = machine.inv.getItem(slot);
                    return !stack || stack.amount < stack.maxAmount;
                });

                if (!hasOutputItems && !hasInputRoom) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                let moved = transferOutputSlots(machine);
                for (const slot of CENTRIFUGAL_SIEVER.slots.inputs) {
                    moved = machine.pullItemsFromAbove(slot) || moved;
                }
                moved = machine.pullItemsFromAbove(CENTRIFUGAL_SIEVER.slots.mesh) || moved;

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        const meshStack = machine.inv.getItem(CENTRIFUGAL_SIEVER.slots.mesh);
        const meshData = resolveMeshData(meshStack);
        if (!meshData) {
            clearLockedInput(machine);
            showMachineWarning(machine, tank, "Insert Mesh", {
                quantityLevel,
                desiredBatch,
                operation: null,
                focusGroup: null,
                steamActive: false,
                meshData: null
            }, true, shouldRefreshUi);
            return;
        }

        const operation = buildOperationPlan({
            machine,
            tank,
            settings,
            quantityLevel,
            desiredBatch,
            meshData
        });

        if (!operation.hasCandidateInput) {
            clearLockedInput(machine);
            showMachineWarning(machine, tank, "Insert Items", {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: null,
                steamActive: false,
                meshData
            }, true, shouldRefreshUi);
            return;
        }

        if (!operation.ready) {
            const resetProgress = operation.message !== "Output Full" && operation.message !== "Output Conflict";
            if (resetProgress) {
                clearLockedInput(machine);
            }
            showMachineWarning(machine, tank, operation.message, {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: operation.focusGroup,
                steamActive: operation.focusGroup?.steamBoostActive === true,
                meshData
            }, resetProgress, shouldRefreshUi);
            return;
        }

        machine.setEnergyCost(operation.energyCost);

        if (settings?.machine?.dynamic_rate === true) {
            applyDynamicRecipeRate(machine, operation.referenceRecipe, {
                energyCost: operation.energyCost,
                speedMultiplier: (machine.boosts.speed ?? 1) * operation.speedMultiplier
            });
        }

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, tank, "No Energy", {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: operation.selectedGroup,
                steamActive: operation.selectedGroup?.steamBoostActive === true,
                meshData
            }, false, shouldRefreshUi);
            return;
        }

        let lastBatch = null;
        const progress = machine.getProgress();
        if (progress >= operation.energyCost) {
            lastBatch = processBatch(machine, operation, tank);
            machine.addProgress(-operation.energyCost);
        } else {
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
        }

        showMachineStatus(
            machine,
            tank,
            lastBatch
                ? (operation.selectedGroup?.steamBoostActive ? "Boosted" : "Spinning")
                : (operation.selectedGroup?.steamBoostActive ? "Charging+" : "Charging"),
            {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: operation.selectedGroup,
                steamActive: operation.selectedGroup?.steamBoostActive === true,
                lastBatch,
                meshData
            },
            shouldRefreshUi
        );
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
        : CENTRIFUGAL_SIEVER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(CENTRIFUGAL_SIEVER.steam.type);
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
    for (const slot of CENTRIFUGAL_SIEVER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(CENTRIFUGAL_SIEVER.quantity.maxLevel, total));
}

function getBatchSize(quantityLevel) {
    const profileIndex = Math.max(0, Math.min(CENTRIFUGAL_SIEVER.quantity.batchSizes.length - 1, Number(quantityLevel) || 0));
    return CENTRIFUGAL_SIEVER.quantity.batchSizes[profileIndex];
}

function buildOperationPlan({ machine, tank, settings, quantityLevel, desiredBatch, meshData }) {
    const inputGroups = collectInputGroups(machine);
    if (!inputGroups.length) {
        return {
            ready: false,
            message: "Insert Items",
            hasCandidateInput: false,
            inputGroupCount: 0,
            selectedGroup: null,
            focusGroup: null,
            quantityLevel,
            desiredBatch,
            meshData
        };
    }

    const baseEnergyCost = settings?.machine?.energy_cost ?? CENTRIFUGAL_SIEVER.defaults.energyCostPerInput;
    const progress = machine.getProgress();
    const lockedInputId = progress > 0 ? getLockedInputId(machine) : null;
    const groupPlans = inputGroups.map(group =>
        buildGroupPlan(machine, group, desiredBatch, meshData, baseEnergyCost, tank)
    );

    const lockedGroup = lockedInputId
        ? groupPlans.find(group => group.typeId === lockedInputId) ?? null
        : null;

    if (lockedInputId && progress > 0) {
        if (!lockedGroup) {
            return {
                ready: false,
                message: "Missing Items",
                hasCandidateInput: true,
                inputGroupCount: groupPlans.length,
                selectedGroup: null,
                focusGroup: {
                    typeId: lockedInputId,
                    missingInput: true,
                    batchCount: 0,
                    eligibleDrops: [],
                    outputPlan: null,
                    steamBoostActive: false,
                    estimatedOutputs: 0
                },
                groupPlans,
                quantityLevel,
                desiredBatch,
                meshData
            };
        }

        if (!lockedGroup.ready) {
            return {
                ready: false,
                message: determineWarningMessage([lockedGroup], lockedGroup, progress),
                hasCandidateInput: true,
                inputGroupCount: groupPlans.length,
                selectedGroup: null,
                focusGroup: lockedGroup,
                groupPlans,
                quantityLevel,
                desiredBatch,
                meshData
            };
        }

        return {
            ready: true,
            message: null,
            hasCandidateInput: true,
            inputGroupCount: groupPlans.length,
            selectedGroup: lockedGroup,
            focusGroup: lockedGroup,
            groupPlans,
            quantityLevel,
            desiredBatch,
            meshData,
            energyCost: lockedGroup.energyCost,
            speedMultiplier: lockedGroup.steamBoostActive ? CENTRIFUGAL_SIEVER.steam.speedMultiplier : 1,
            referenceRecipe: buildReferenceRecipe(lockedGroup)
        };
    }

    const selectedGroup = groupPlans.find(group => group.ready) ?? null;

    if (selectedGroup) {
        setLockedInput(machine, selectedGroup.typeId);
        return {
            ready: true,
            message: null,
            hasCandidateInput: true,
            inputGroupCount: groupPlans.length,
            selectedGroup,
            focusGroup: selectedGroup,
            groupPlans,
            quantityLevel,
            desiredBatch,
            meshData,
            energyCost: selectedGroup.energyCost,
            speedMultiplier: selectedGroup.steamBoostActive ? CENTRIFUGAL_SIEVER.steam.speedMultiplier : 1,
            referenceRecipe: buildReferenceRecipe(selectedGroup)
        };
    }

    const focusGroup = (
        (lockedGroup && progress > 0 ? lockedGroup : null)
        ?? groupPlans.find(group => group.invalidRecipe)
        ?? groupPlans.find(group => group.meshTooWeak)
        ?? groupPlans.find(group => group.outputConflict)
        ?? groupPlans.find(group => group.outputFull)
        ?? groupPlans.find(group => group.missingInput)
        ?? groupPlans[0]
    );

    return {
        ready: false,
        message: determineWarningMessage(groupPlans, lockedGroup, progress),
        hasCandidateInput: true,
        inputGroupCount: groupPlans.length,
        selectedGroup: null,
        focusGroup,
        groupPlans,
        quantityLevel,
        desiredBatch,
        meshData
    };
}

function collectInputGroups(machine) {
    const groups = [];
    const groupMap = new Map();

    for (const slot of CENTRIFUGAL_SIEVER.slots.inputs) {
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

function buildGroupPlan(machine, group, desiredBatch, meshData, baseEnergyCost, tank) {
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

    plan.baseEnergyCost = Math.max(1, Math.ceil(baseEnergyCost * plan.batchCount));
    plan.steamNeeded = CENTRIFUGAL_SIEVER.steam.perInput * plan.batchCount;
    plan.steamBoostActive = (tank?.get() ?? 0) >= plan.steamNeeded;
    plan.energyCost = Math.max(1, Math.ceil(plan.baseEnergyCost * (plan.steamBoostActive ? CENTRIFUGAL_SIEVER.steam.energyMultiplier : 1)));
    plan.cycleSeconds = computeCycleSeconds(plan.batchCount);
    plan.estimatedOutputs = estimateExpectedOutputs(plan.producibleDrops, plan.batchCount, meshData);
    plan.ready = true;

    return plan;
}

function canMeshRollEntry(meshData, entry) {
    if (!meshData || !entry) return false;
    if (meshData.tier < (entry.tier ?? 0)) return false;
    if (meshData.tier >= 7 && entry.item === CENTRIFUGAL_SIEVER.mesh.boostIgnoreOutput) return false;
    return isValidItemId(entry.item);
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

    const availableOutputSlots = getAvailableOutputSlots(machine);
    const maxStack = Math.max(1, resolveMaxStackSize(null, itemId));
    let total = 0;

    for (const slot of availableOutputSlots) {
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
        return CENTRIFUGAL_SIEVER.slots.outputs;
    }

    return CENTRIFUGAL_SIEVER.slots.outputs.filter(slot => (
        slot >= CENTRIFUGAL_SIEVER.defaults.minimumLegacyOutputSlot
        && slot < containerSize
    ));
}

function determineWarningMessage(groupPlans, lockedGroup, progress) {
    const relevantGroups = lockedGroup && progress > 0 ? [lockedGroup] : groupPlans;

    if (relevantGroups.some(group => group.invalidRecipe)) return "Input Invalid";
    if (relevantGroups.some(group => group.meshTooWeak)) return "Mesh Too Weak";
    if (relevantGroups.some(group => group.outputConflict)) return "Output Conflict";
    if (relevantGroups.some(group => group.outputFull)) return "Output Full";
    if (relevantGroups.some(group => group.missingInput)) return "Missing Items";
    return "Insert Items";
}

function buildReferenceRecipe(groupPlan) {
    return {
        energyCost: groupPlan.energyCost,
        seconds: groupPlan.cycleSeconds,
        ticks: Math.ceil(groupPlan.cycleSeconds * 20)
    };
}

function computeCycleSeconds(batchCount) {
    return Math.max(
        CENTRIFUGAL_SIEVER.defaults.minimumBatchSeconds,
        batchCount * CENTRIFUGAL_SIEVER.defaults.secondsPerInput
    );
}

function processBatch(machine, operation, tank) {
    const group = operation.selectedGroup;
    consumeGroupedInput(machine, group, group.batchCount);

    if (group.steamBoostActive && group.steamNeeded > 0) {
        tank.consume(group.steamNeeded);
    }

    const sourceDrops = (group.producibleDrops?.length ?? 0) > 0
        ? group.producibleDrops
        : group.eligibleDrops;
    const rolledOutputs = rollBatchOutputs(sourceDrops, group.batchCount, operation.meshData);
    const cappedOutputs = clampOutputsToAvailableCapacity(machine, rolledOutputs);
    const distribution = distributeOutputs(machine, cappedOutputs);

    if (countItemsAcrossSlots(machine, CENTRIFUGAL_SIEVER.slots.inputs, group.typeId) <= 0) {
        clearLockedInput(machine);
    } else {
        setLockedInput(machine, group.typeId);
    }

    return {
        inputId: group.typeId,
        batchCount: group.batchCount,
        produced: distribution.insertedTotal,
        uniqueOutputs: distribution.insertedTypes,
        overflow: distribution.spilledTotal,
        steamUsed: group.steamBoostActive ? group.steamNeeded : 0
    };
}

function rollBatchOutputs(entries, batchCount, meshData) {
    const rolled = new Map();
    const chanceMultiplier = Math.max(0, Number(meshData?.multiplier) || 1);
    const amountMultiplier = Math.max(0, Number(meshData?.amountMultiplier) || 1);

    for (let batch = 0; batch < batchCount; batch += 1) {
        for (const entry of entries) {
            const chance = Math.max(0, Math.min(1, Number(entry.chance) * chanceMultiplier));
            if (chance <= 0) continue;
            if (Math.random() > chance) continue;

            const baseAmount = resolveEntryAmount(entry.amount);
            const totalAmount = Math.max(1, Math.ceil(baseAmount * amountMultiplier));
            rolled.set(entry.item, (rolled.get(entry.item) ?? 0) + totalAmount);
        }
    }

    return rolled;
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

function resolveEntryAmount(amount) {
    if (Array.isArray(amount) && amount.length >= 2) {
        const min = Math.max(1, Math.floor(Number(amount[0]) || 1));
        const max = Math.max(min, Math.floor(Number(amount[1]) || min));
        return DoriosAPI.math.randomInterval(min, max);
    }

    return Math.max(1, Math.floor(Number(amount) || 1));
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

    if (remaining > 0) {
        try {
            machine.dim.spawnItem(new ItemStack(itemId, remaining), machine.block.center());
        } catch {
            // Ignore emergency overflow spawn failures.
        }
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

function countItemsAcrossSlots(machine, slots, typeId) {
    let total = 0;

    for (const slot of slots) {
        const current = machine.inv.getItem(slot);
        if (!current || current.typeId !== typeId) continue;
        total += current.amount;
    }

    return total;
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
        total += averageAmount * amountMultiplier * normalizedChance * batchCount;
    }

    return Math.max(0, Math.round(total));
}

function resolveMaxStackSize(slot, outputId) {
    if (slot?.maxAmount) return slot.maxAmount;
    if (!outputId) return 64;

    const cached = MAX_STACK_SIZE_CACHE.get(outputId);
    if (cached) return cached;

    try {
        const probe = new ItemStack(outputId, 1);
        if (probe?.maxAmount) {
            MAX_STACK_SIZE_CACHE.set(outputId, probe.maxAmount);
            return probe.maxAmount;
        }
        const component = probe?.getComponent?.("minecraft:max_stack_size");
        if (typeof component?.value === "number") {
            MAX_STACK_SIZE_CACHE.set(outputId, component.value);
            return component.value;
        }
    } catch {
        // Ignore invalid probes and fall back to a standard stack size.
    }

    MAX_STACK_SIZE_CACHE.set(outputId, 64);
    return 64;
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

function getLockedInputId(machine) {
    const value = machine.entity?.getDynamicProperty?.(CENTRIFUGAL_SIEVER.lockProperty);
    return typeof value === "string" && value.length > 0 ? value : null;
}

function setLockedInput(machine, inputId) {
    if (!machine.entity?.setDynamicProperty) return;
    machine.entity.setDynamicProperty(CENTRIFUGAL_SIEVER.lockProperty, inputId ?? "");
}

function clearLockedInput(machine) {
    if (!machine.entity?.setDynamicProperty) return;
    machine.entity.setDynamicProperty(CENTRIFUGAL_SIEVER.lockProperty, "");
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

function buildMachineLore(machine, tank, context = {}) {
    const focusGroup = context.focusGroup ?? null;
    const desiredBatch = Number(context.desiredBatch ?? 1);
    const steamActive = context.steamActive === true;
    const meshData = context.meshData ?? null;
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Mesh",
            value: meshData?.name
                ? `${formatItemName(meshData.name)} (T${meshData.tier ?? 0})`
                : "None"
        },
        {
            label: "Steam",
            value: formatFluidTankBuffer(tank, CENTRIFUGAL_SIEVER.steam.type)
        },
        {
            label: "Batch",
            value: formatBatchWithQuantity(desiredBatch, context.quantityLevel ?? 0)
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    const operationInfo = [];
    if (context.operation?.inputGroupCount > 1) {
        operationInfo.push({
            label: "Queued Types",
            value: context.operation.inputGroupCount
        });
    }

    if (focusGroup?.typeId) {
        operationInfo.push({
            label: "Input",
            value: formatItemName(focusGroup.typeId)
        });
    }

    if (focusGroup?.eligibleDrops?.length) {
        operationInfo.push(
            {
                label: "Batch",
                value: `${focusGroup.batchCount} / ${desiredBatch}`
            },
            {
                label: "Expected",
                value: focusGroup.estimatedOutputs
            },
            {
                label: "Cost",
                value: `${formatEnergyCost(focusGroup.energyCost ?? 0)}${formatOptionalFluidSuffix(focusGroup.steamBoostActive, focusGroup.steamNeeded, "Steam")}`
            }
        );

        if (!focusGroup.steamBoostActive) {
            const shortage = Math.max(0, (focusGroup.steamNeeded ?? 0) - (tank?.get() ?? 0));
            if (shortage > 0 && focusGroup.steamNeeded > 0) {
                operationInfo.push({
                    label: "Need Steam",
                    value: formatFluidNeedValue(shortage)
                });
            }
        }
    }

    if (operationInfo.length > 0) {
        appendLoreSection(lines, "Sieve Operation", operationInfo);
    }

    const batchInfo = [];
    if (context.lastBatch?.produced > 0) {
        batchInfo.push(`§7Produced: §f${context.lastBatch.produced} items §7(${context.lastBatch.uniqueOutputs} outputs)`);
    }
    if (context.lastBatch?.overflow > 0) {
        batchInfo.push(`§6Overflow: §f${context.lastBatch.overflow} dropped`);
    }
    if (batchInfo.length > 0) {
        appendLoreSection(lines, "Last Batch", batchInfo);
    }

    return lines;
}

function buildFooterLines(machine, context = {}) {
    const lines = [
        `Batch: ${formatBatchWithQuantity(context.desiredBatch ?? 1, context.quantityLevel ?? 0)}`,
        `Steam: ${context.steamActive ? "Boost" : "Base"}`
    ];

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) {
        lines.push(overclockLine.replace(/^§r/, ""));
    }

    return lines;
}

function updateDisplays(machine, tank, refreshUi = true) {
    if (!refreshUi) return;

    tank.display(CENTRIFUGAL_SIEVER.slots.steamDisplay);
    machine.displayEnergy(CENTRIFUGAL_SIEVER.slots.energy);
    machine.displayProgress(CENTRIFUGAL_SIEVER.slots.progress);
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
    updateDisplays(machine, tank, true);
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
    updateDisplays(machine, tank, true);
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

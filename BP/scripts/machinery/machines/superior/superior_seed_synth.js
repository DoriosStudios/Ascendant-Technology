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
import {
    GENETIC_ACCEPTED_SOILS,
    getGeneticSeedPlantRecipe
} from "../../../config/recipes/genetic_seed_synthesizer.js";
import {
    formatEnergyWithFluidCost,
    formatFluidNeedValue,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatPercentFromRatio,
    formatSecondsLabel,
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from "./utils.js";

const GENETIC_SEED_SYNTHESIZER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5, 6]),
        soil: 7,
        profileButton: 8,
        cryofluidInput: 9,
        cryofluidDisplay: 10,
        upgrades: Object.freeze([11, 12, 13, 14]),
        outputs: Object.freeze([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29])
    }),
    transfer: Object.freeze({
        outputIntervalTicks: 4,
        inputPullIntervalTicks: 4,
        fluidIntervalTicks: 4,
        itemAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        }),
        fluidAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 10,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 40
        })
    }),
    cryofluid: Object.freeze({
        type: "cryofluid"
    }),
    defaults: Object.freeze({
        energyCost: 8000,
        fluidCap: 64000,
        cryoDivisor: 256,
        minimumCryofluidCost: 25,
        minimumBatchSeconds: 2.6,
        secondsPerTier: 0.55,
        baseRecipeCost: 8000,
        energyInflationMultiplier: 4,
        cryofluidInflationMultiplier: 1.75,
        minimumLegacyOutputSlot: 15
    }),
    profiles: Object.freeze({
        growth: Object.freeze({
            id: "growth",
            title: "Growth",
            summary: "Faster synthesis cycles with standard Cryofluid load.",
            speedMultiplier: 1.45,
            cryoMultiplier: 1,
            bonusRollChance: 0,
            preserveProgressOnLowCryofluid: false
        }),
        resilience: Object.freeze({
            id: "resilience",
            title: "Resilience",
            summary: "Reduced Cryofluid load and better progress retention.",
            speedMultiplier: 1,
            cryoMultiplier: 0.65,
            bonusRollChance: 0,
            preserveProgressOnLowCryofluid: true
        }),
        yield: Object.freeze({
            id: "yield",
            title: "Yield",
            summary: "Extra resource rolls at a heavier Cryofluid cost.",
            speedMultiplier: 0.8,
            cryoMultiplier: 1.85,
            bonusRollChance: 0.45,
            preserveProgressOnLowCryofluid: false
        })
    }),
    lockProperty: "ascendant:genetic_seed_operation"
});

const PROFILE_LIST = Object.freeze(Object.values(GENETIC_SEED_SYNTHESIZER.profiles));
const MAX_STACK_SIZE_CACHE = new Map();
const VALID_ITEM_ID_CACHE = new Map();
const LOCK_SEPARATOR = "||";

const PROFILE_BUTTONS = Object.freeze({
    id: "genetic_seed_profile",
    namespace: "ascendant:genetic_seed_synthesizer",
    cooldownTicks: 6,
    defaultIconItemId: "utilitycraft:switch_button",
    defaults: Object.freeze({
        profile: GENETIC_SEED_SYNTHESIZER.profiles.growth.id
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: "profile_cycle",
            property: "profile",
            slot: GENETIC_SEED_SYNTHESIZER.slots.profileButton,
            type: "cycle",
            values: Object.freeze(PROFILE_LIST.map(profile => profile.id)),
            defaultValue: GENETIC_SEED_SYNTHESIZER.profiles.growth.id,
            getTitle: ({ state }) => `Profile: ${getProfile(state.profile).title}`,
            getLore: ({ state }) => buildProfileButtonLore(getProfile(state.profile)),
            pressHint: "Take the switch to cycle the synthesis profile.",
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, GENETIC_SEED_SYNTHESIZER.slots.progress);
                clearLockedOperation(machine);
            }
        })
    ])
});

DoriosAPI.register.blockComponent("genetic_seed_synthesizer", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? GENETIC_SEED_SYNTHESIZER.defaults.energyCost);
            machine.displayEnergy(GENETIC_SEED_SYNTHESIZER.slots.energy);
            machine.displayProgress(GENETIC_SEED_SYNTHESIZER.slots.progress);
            machine.blockSlots([GENETIC_SEED_SYNTHESIZER.slots.cryofluidDisplay, GENETIC_SEED_SYNTHESIZER.slots.cryofluidInput]);

            const tank = getCryofluidTank(machine, settings);
            tank.display(GENETIC_SEED_SYNTHESIZER.slots.cryofluidDisplay);
            machine.entity.setItem(GENETIC_SEED_SYNTHESIZER.slots.status, "utilitycraft:arrow_indicator_90", 1, "");

            syncSuperiorButtonPanel(machine, PROFILE_BUTTONS, {
                detectPresses: false,
                forceRender: true
            });
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;

        const tank = getCryofluidTank(machine, settings);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "superior_seed_synth:ui");
        const panelState = syncSuperiorButtonPanel(machine, PROFILE_BUTTONS, {
            forceRender: shouldRefreshUi
        });
        const profile = getProfile(panelState.profile);

        runAdaptiveTickGate(
            machine.entity,
            "genetic_seed:item_io",
            GENETIC_SEED_SYNTHESIZER.transfer.itemAdaptive,
            () => {
                const hasOutputItems = getAvailableOutputSlots(machine).some(slot => !!machine.inv.getItem(slot));
                const hasInputRoom = [...GENETIC_SEED_SYNTHESIZER.slots.inputs, GENETIC_SEED_SYNTHESIZER.slots.soil].some(slot => {
                    const stack = machine.inv.getItem(slot);
                    return !stack || stack.amount < stack.maxAmount;
                });

                if (!hasOutputItems && !hasInputRoom) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                let moved = transferOutputSlots(machine);
                for (const slot of GENETIC_SEED_SYNTHESIZER.slots.inputs) {
                    moved = machine.pullItemsFromAbove(slot) || moved;
                }
                moved = machine.pullItemsFromAbove(GENETIC_SEED_SYNTHESIZER.slots.soil) || moved;

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        runAdaptiveTickGate(
            machine.entity,
            "genetic_seed:fluid_io",
            GENETIC_SEED_SYNTHESIZER.transfer.fluidAdaptive,
            () => {
                const hasCryofluid = tank.getType() !== "empty" && tank.get() > 0;
                if (!hasCryofluid) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                const moved = tank.transferFluids(machine.block);
                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        const soilStack = machine.inv.getItem(GENETIC_SEED_SYNTHESIZER.slots.soil);
        if (!soilStack) {
            clearLockedOperation(machine);
            showMachineWarning(machine, tank, "Insert Soil", { profile, soil: null, focusGroup: null }, true, shouldRefreshUi);
            return;
        }

        const soil = resolveSoil(soilStack);
        if (!soil) {
            clearLockedOperation(machine);
            showMachineWarning(machine, tank, "Invalid Soil", {
                profile,
                soil: { typeId: soilStack.typeId, cost: null },
                focusGroup: null
            }, true, shouldRefreshUi);
            return;
        }

        const operation = buildOperationPlan({ machine, tank, soil, profile });
        if (!operation.hasCandidateInput) {
            clearLockedOperation(machine);
            showMachineWarning(machine, tank, operation.message ?? "Insert Seeds", operation, true, shouldRefreshUi);
            return;
        }

        if (!operation.ready) {
            const resetProgress = shouldResetProgress(operation.message, operation);
            if (resetProgress) {
                clearLockedOperation(machine);
            }
            showMachineWarning(machine, tank, operation.message ?? "Insert Seeds", operation, resetProgress, shouldRefreshUi);
            return;
        }

        machine.setEnergyCost(operation.energyCost);
        applyDynamicRecipeRate(machine, operation.referenceRecipe, {
            energyCost: operation.energyCost,
            speedMultiplier: (machine.boosts.speed ?? 1) * operation.profile.speedMultiplier
        });

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, tank, "No Energy", operation, false, shouldRefreshUi);
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

        showMachineStatus(machine, tank, lastBatch ? "Synthesized" : getProcessingVerb(operation.profile), {
            ...operation,
            lastBatch
        }, shouldRefreshUi);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function getCryofluidTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : GENETIC_SEED_SYNTHESIZER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(GENETIC_SEED_SYNTHESIZER.cryofluid.type);
    }

    return tank;
}

function getProfile(profileId) {
    return PROFILE_LIST.find(profile => profile.id === profileId) ?? GENETIC_SEED_SYNTHESIZER.profiles.growth;
}

function resolveSoil(stack) {
    if (!stack?.typeId) return null;
    const data = GENETIC_ACCEPTED_SOILS[stack.typeId];
    if (!data) return null;
    return {
        typeId: stack.typeId,
        cost: Math.max(0.01, Number(data.cost) || 1)
    };
}

function buildOperationPlan({ machine, tank, soil, profile }) {
    const inputGroups = collectInputGroups(machine);
    if (!inputGroups.length) {
        return {
            ready: false,
            message: "Insert Seeds",
            hasCandidateInput: false,
            profile,
            soil,
            focusGroup: null,
            selectedGroup: null,
            selectedGroups: [],
            groupPlans: []
        };
    }

    const progress = machine.getProgress();
    const lockedOperationKeys = progress > 0 ? getLockedOperationKeys(machine) : [];
    const groupPlans = inputGroups.map(group => buildGroupPlan(machine, group, soil, profile, tank));

    if (lockedOperationKeys.length && progress > 0) {
        const lockedGroups = lockedOperationKeys
            .map(operationKey => groupPlans.find(group => group.operationKey === operationKey) ?? null)
            .filter(Boolean);

        if (lockedGroups.length !== lockedOperationKeys.length) {
            return {
                ready: false,
                message: "Recipe Changed",
                hasCandidateInput: true,
                profile,
                soil,
                focusGroup: null,
                selectedGroup: null,
                selectedGroups: [],
                groupPlans
            };
        }

        const blockedLockedGroup = lockedGroups.find(group => !group.ready) ?? null;
        if (blockedLockedGroup) {
            return {
                ready: false,
                message: determineWarningMessage(lockedGroups),
                hasCandidateInput: true,
                profile,
                soil,
                focusGroup: blockedLockedGroup,
                selectedGroup: null,
                selectedGroups: [],
                groupPlans
            };
        }

        return buildReadyOperation(lockedGroups, groupPlans, profile, soil);
    }

    const selectedGroups = groupPlans.filter(group => group.ready);
    if (selectedGroups.length) {
        setLockedOperation(machine, selectedGroups.map(group => group.operationKey));
        return buildReadyOperation(selectedGroups, groupPlans, profile, soil);
    }

    const focusGroup = groupPlans.find(group => group.invalidRecipe)
        ?? groupPlans.find(group => group.invalidOutput)
        ?? groupPlans.find(group => group.outputConflict)
        ?? groupPlans.find(group => group.outputFull)
        ?? groupPlans.find(group => group.lowCryofluid)
        ?? groupPlans[0]
        ?? null;

    return {
        ready: false,
        message: determineWarningMessage(groupPlans),
        hasCandidateInput: true,
        profile,
        soil,
        focusGroup,
        selectedGroup: null,
        selectedGroups: [],
        groupPlans
    };
}

function buildReadyOperation(selectedGroups, groupPlans, profile, soil) {
    const focusGroup = selectedGroups[0] ?? null;
    const energyCost = selectedGroups.reduce((total, group) => total + group.energyCost, 0);
    const cryofluidCost = selectedGroups.reduce((total, group) => total + group.cryofluidCost, 0);
    const cycleSeconds = selectedGroups.reduce((maxSeconds, group) => Math.max(maxSeconds, group.cycleSeconds), 0);

    return {
        ready: true,
        hasCandidateInput: true,
        message: null,
        profile,
        soil,
        focusGroup,
        selectedGroup: focusGroup,
        selectedGroups,
        groupPlans,
        energyCost,
        cryofluidCost,
        referenceRecipe: buildReferenceRecipe(energyCost, cycleSeconds)
    };
}

function collectInputGroups(machine) {
    const groups = [];

    for (const slot of GENETIC_SEED_SYNTHESIZER.slots.inputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) continue;

        groups.push({
            typeId: stack.typeId,
            firstSlot: slot,
            laneSlot: slot,
            totalAmount: stack.amount,
            slots: [slot],
            recipe: getGeneticSeedPlantRecipe(stack.typeId)
        });
    }

    return groups.sort((left, right) => left.firstSlot - right.firstSlot);
}

function buildGroupPlan(machine, group, soil, profile, tank) {
    const recipe = group.recipe;
    const plan = {
        ...group,
        ready: false,
        invalidRecipe: false,
        invalidOutput: false,
        outputConflict: false,
        outputFull: false,
        lowCryofluid: false,
        operationKey: buildOperationKey(group.laneSlot, group.typeId, soil.typeId, profile.id),
        outputPlan: null,
        energyCost: 0,
        cryofluidCost: 0,
        cycleSeconds: 0,
        estimatedOutputs: 0,
        profile,
        soil
    };

    if (!recipe?.drops?.length) {
        plan.invalidRecipe = true;
        return plan;
    }

    const outputIds = recipe.drops.map(drop => drop.item);
    if (outputIds.some(outputId => !isValidItemId(outputId))) {
        plan.invalidOutput = true;
        return plan;
    }

    plan.outputPlan = buildOutputPlan(machine, outputIds);
    plan.outputConflict = plan.outputPlan.compatibleSlotCount <= 0;
    plan.outputFull = !plan.outputPlan.hasSpace;
    if (plan.outputConflict || plan.outputFull) {
        return plan;
    }

    plan.energyCost = resolveEnergyCost(recipe.cost, soil);
    plan.cryofluidCost = resolveCryofluidCost(recipe.cost, soil, profile);
    plan.cycleSeconds = computeCycleSeconds(recipe.cost);
    plan.estimatedOutputs = estimateExpectedOutputs(recipe.drops, group.typeId, profile);
    plan.lowCryofluid = (tank?.get() ?? 0) < plan.cryofluidCost;
    plan.ready = !plan.lowCryofluid;

    return plan;
}

function buildOperationKey(laneSlot, inputId, soilId, profileId) {
    return `${laneSlot}|${inputId}|${soilId}|${profileId}`;
}

function determineWarningMessage(groupPlans) {
    if (groupPlans.some(group => group.invalidRecipe)) return "Invalid Seed";
    if (groupPlans.some(group => group.invalidOutput)) return "Recipe Error";
    if (groupPlans.some(group => group.outputConflict)) return "Output Conflict";
    if (groupPlans.some(group => group.outputFull)) return "Output Full";
    if (groupPlans.some(group => group.lowCryofluid)) return "Low Cryofluid";
    return "Insert Seeds";
}

function shouldResetProgress(message, operation) {
    if (message === "No Energy" || message === "Output Full" || message === "Output Conflict") {
        return false;
    }

    if (message === "Low Cryofluid") {
        return operation?.focusGroup?.profile?.preserveProgressOnLowCryofluid !== true;
    }

    return true;
}

function resolveEnergyCost(recipeCost, soil) {
    const cost = Math.max(1, Number(recipeCost) || GENETIC_SEED_SYNTHESIZER.defaults.energyCost);
    return Math.max(
        1,
        Math.ceil(
            cost
            * (soil?.cost ?? 1)
            * (GENETIC_SEED_SYNTHESIZER.defaults.energyInflationMultiplier ?? 1)
        )
    );
}

function resolveCryofluidCost(recipeCost, soil, profile) {
    const energyCost = resolveEnergyCost(recipeCost, soil);
    const baseCost = Math.max(
        GENETIC_SEED_SYNTHESIZER.defaults.minimumCryofluidCost,
        Math.ceil(energyCost / GENETIC_SEED_SYNTHESIZER.defaults.cryoDivisor)
    );
    return Math.max(
        1,
        Math.ceil(
            baseCost
            * (GENETIC_SEED_SYNTHESIZER.defaults.cryofluidInflationMultiplier ?? 1)
            * (profile?.cryoMultiplier ?? 1)
        )
    );
}

function computeCycleSeconds(recipeCost) {
    const normalizedCost = Math.max(1, Number(recipeCost) || GENETIC_SEED_SYNTHESIZER.defaults.baseRecipeCost);
    const tier = Math.max(0, Math.log2(normalizedCost / GENETIC_SEED_SYNTHESIZER.defaults.baseRecipeCost));
    return Math.max(
        GENETIC_SEED_SYNTHESIZER.defaults.minimumBatchSeconds,
        GENETIC_SEED_SYNTHESIZER.defaults.minimumBatchSeconds + (tier * GENETIC_SEED_SYNTHESIZER.defaults.secondsPerTier)
    );
}

function buildReferenceRecipe(energyCost, cycleSeconds) {
    return {
        energyCost,
        seconds: cycleSeconds,
        ticks: Math.ceil(cycleSeconds * 20)
    };
}

function getAvailableOutputSlots(machine) {
    const containerSize = Number(machine?.inv?.size);
    if (!Number.isFinite(containerSize) || containerSize <= 0) {
        return GENETIC_SEED_SYNTHESIZER.slots.outputs;
    }

    return GENETIC_SEED_SYNTHESIZER.slots.outputs.filter(slot => (
        slot >= GENETIC_SEED_SYNTHESIZER.defaults.minimumLegacyOutputSlot
        && slot < containerSize
    ));
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

function processBatch(machine, operation, tank) {
    const groups = Array.isArray(operation.selectedGroups) && operation.selectedGroups.length
        ? operation.selectedGroups
        : operation.selectedGroup
            ? [operation.selectedGroup]
            : [];

    if (!groups.length) return null;

    if (operation.cryofluidCost > 0) {
        tank.consume(operation.cryofluidCost);
    }

    let produced = 0;
    let overflow = 0;
    const outputTypes = new Set();
    const inputIds = [];

    for (const group of groups) {
        const rolledOutputs = rollOutputs(group.recipe.drops, group.typeId, operation.profile);
        const distribution = distributeOutputs(machine, rolledOutputs);

        produced += distribution.insertedTotal;
        overflow += distribution.spilledTotal;
        inputIds.push(group.typeId);

        for (const outputId of distribution.insertedItemIds) {
            outputTypes.add(outputId);
        }
    }

    const remainingOperationKeys = groups
        .filter(group => hasMatchingInputLane(machine, group.laneSlot ?? group.firstSlot, group.typeId))
        .map(group => group.operationKey);

    if (remainingOperationKeys.length > 0) {
        setLockedOperation(machine, remainingOperationKeys);
    } else {
        clearLockedOperation(machine);
    }

    return {
        inputIds,
        produced,
        uniqueOutputs: outputTypes.size,
        overflow,
        cryofluidUsed: operation.cryofluidCost,
        processedGroups: groups.length
    };
}

function rollOutputs(drops, inputId, profile) {
    const rolled = new Map();
    for (const drop of drops) {
        const chance = Math.max(0, Math.min(1, Number(drop.chance) || 0));
        if (chance <= 0 || Math.random() > chance) continue;

        addRolledOutput(rolled, drop.item, resolveEntryAmount(drop.amount));

        if (
            profile?.bonusRollChance > 0
            && !isReproductiveDrop(drop.item, inputId)
            && Math.random() <= profile.bonusRollChance
        ) {
            addRolledOutput(rolled, drop.item, resolveEntryAmount(drop.amount));
        }
    }

    return rolled;
}

function addRolledOutput(rolled, itemId, amount) {
    const normalizedAmount = Math.max(0, Math.floor(amount));
    if (!itemId || normalizedAmount <= 0) return;
    rolled.set(itemId, (rolled.get(itemId) ?? 0) + normalizedAmount);
}

function isReproductiveDrop(itemId, inputId) {
    if (!itemId || typeof itemId !== "string") return false;
    if (itemId === inputId) return true;

    return itemId.endsWith("_seeds")
        || itemId.endsWith("_sapling")
        || itemId.endsWith("_propagule")
        || itemId.endsWith("_fungus")
        || itemId === "minecraft:wheat_seeds"
        || itemId === "minecraft:beetroot_seeds"
        || itemId === "minecraft:melon_seeds"
        || itemId === "minecraft:pumpkin_seeds";
}

function resolveEntryAmount(amount) {
    if (Array.isArray(amount) && amount.length >= 2) {
        const min = Math.max(1, Math.floor(Number(amount[0]) || 1));
        const max = Math.max(min, Math.floor(Number(amount[1]) || min));
        return DoriosAPI.math.randomInterval(min, max);
    }

    return Math.max(1, Math.floor(Number(amount) || 1));
}

function estimateExpectedOutputs(drops, inputId, profile) {
    let total = 0;

    for (const drop of drops) {
        const averageAmount = Array.isArray(drop.amount)
            ? (Math.max(1, Number(drop.amount[0]) || 1) + Math.max(1, Number(drop.amount[1]) || 1)) / 2
            : Math.max(1, Number(drop.amount) || 1);
        const chance = Math.max(0, Math.min(1, Number(drop.chance) || 0));
        total += averageAmount * chance;

        if (profile?.bonusRollChance > 0 && !isReproductiveDrop(drop.item, inputId)) {
            total += averageAmount * chance * profile.bonusRollChance;
        }
    }

    return Math.max(0, Math.round(total));
}

function distributeOutputs(machine, rolledOutputs) {
    let insertedTotal = 0;
    let spilledTotal = 0;
    let insertedTypes = 0;
    const insertedItemIds = [];

    const ordered = [...rolledOutputs.entries()].sort((left, right) => left[0].localeCompare(right[0]));
    for (const [itemId, rolledAmount] of ordered) {
        const producedAmount = Math.max(0, Math.floor(rolledAmount));
        if (producedAmount <= 0) continue;

        const insertedAmount = distributeSingleOutput(machine, itemId, producedAmount);
        const spilledAmount = Math.max(0, producedAmount - insertedAmount);

        if (insertedAmount > 0) {
            insertedTypes += 1;
            insertedTotal += insertedAmount;
            insertedItemIds.push(itemId);
        }

        spilledTotal += spilledAmount;
    }

    return {
        insertedTotal,
        insertedTypes,
        insertedItemIds,
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

function hasMatchingInputLane(machine, slot, typeId) {
    const current = machine.inv.getItem(slot);
    return Boolean(current && current.typeId === typeId);
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

function isValidItemId(id) {
    if (!id || typeof id !== "string") return false;

    const cached = VALID_ITEM_ID_CACHE.get(id);
    if (cached !== undefined) {
        return cached;
    }

    let valid = false;
    try {
        new ItemStack(id, 1);
        valid = true;
    } catch {
        valid = false;
    }

    VALID_ITEM_ID_CACHE.set(id, valid);
    return valid;
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

function getLockedOperation(machine) {
    const value = machine?.entity?.getDynamicProperty?.(GENETIC_SEED_SYNTHESIZER.lockProperty);
    return typeof value === "string" && value.length > 0 ? value : null;
}

function getLockedOperationKeys(machine) {
    const value = getLockedOperation(machine);
    return value ? value.split(LOCK_SEPARATOR).filter(Boolean) : [];
}

function setLockedOperation(machine, operationKey) {
    if (!machine?.entity?.setDynamicProperty) return;

    const value = Array.isArray(operationKey)
        ? operationKey.filter(entry => typeof entry === "string" && entry.length > 0).join(LOCK_SEPARATOR)
        : operationKey ?? "";

    machine.entity.setDynamicProperty(GENETIC_SEED_SYNTHESIZER.lockProperty, value);
}

function clearLockedOperation(machine) {
    if (!machine?.entity?.setDynamicProperty) return;
    machine.entity.setDynamicProperty(GENETIC_SEED_SYNTHESIZER.lockProperty, "");
}

function buildProfileButtonLore(profile) {
    return [
        `§7${profile.summary}`,
        `§7Speed: §f${profile.speedMultiplier.toFixed(2)}x §7| Cryo: §f${profile.cryoMultiplier.toFixed(2)}x`,
        `§7Yield: §f${profile.bonusRollChance > 0 ? `${formatPercentFromRatio(profile.bonusRollChance)} bonus` : "None"}`
    ];
}

function getProcessingVerb(profile) {
    if (profile?.id === GENETIC_SEED_SYNTHESIZER.profiles.growth.id) return "Culturing";
    if (profile?.id === GENETIC_SEED_SYNTHESIZER.profiles.resilience.id) return "Stabilizing";
    return "Optimizing";
}

function buildMachineLore(machine, tank, context = {}) {
    const profile = context.profile ?? GENETIC_SEED_SYNTHESIZER.profiles.growth;
    const soil = context.soil ?? null;
    const focusGroup = context.focusGroup ?? null;
    const selectedGroups = Array.isArray(context.selectedGroups) && context.selectedGroups.length
        ? context.selectedGroups
        : focusGroup
            ? [focusGroup]
            : [];
    const lastBatch = context.lastBatch ?? null;
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Profile",
            value: profile.title
        },
        {
            label: "Soil",
            value: soil?.typeId ? formatItemName(soil.typeId) : "None"
        },
        {
            label: "Cryofluid",
            value: formatFluidTankBuffer(tank, GENETIC_SEED_SYNTHESIZER.cryofluid.type)
        },
        {
            label: "Lanes",
            value: selectedGroups.length || 0
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    const operationInfo = [];

    if (focusGroup?.typeId) {
        if (selectedGroups.length > 1) {
            operationInfo.push({
                label: "Parallel",
                value: `${selectedGroups.length} lanes`
            });
        }

        operationInfo.push(
            {
                label: "Focus",
                value: formatItemName(focusGroup.typeId)
            },
            {
                label: "Cost",
                value: formatEnergyWithFluidCost(focusGroup.energyCost ?? 0, focusGroup.cryofluidCost ?? 0, "Cryofluid")
            },
            {
                label: "Cycle",
                value: formatSecondsLabel(focusGroup.cycleSeconds ?? 0)
            },
            {
                label: "Expected",
                value: focusGroup.estimatedOutputs ?? 0
            }
        );

        if (focusGroup.lowCryofluid) {
            const shortage = Math.max(0, (focusGroup.cryofluidCost ?? 0) - (tank?.get() ?? 0));
            operationInfo.push({
                label: "Need Cryo",
                value: formatFluidNeedValue(shortage)
            });
        }
    }

    if (operationInfo.length > 0) {
        appendLoreSection(lines, "Synthesis Operation", operationInfo);
    }

    const batchInfo = [];
    if (lastBatch?.produced > 0) {
        batchInfo.push(`§7Produced: §f${lastBatch.produced} items §7(${lastBatch.uniqueOutputs} outputs${lastBatch.processedGroups > 1 ? `, ${lastBatch.processedGroups} lanes` : ""})`);
    }
    if (lastBatch?.overflow > 0) {
        batchInfo.push(`§6Overflow: §f${lastBatch.overflow} dropped`);
    }
    if (batchInfo.length > 0) {
        appendLoreSection(lines, "Last Batch", batchInfo);
    }

    return lines;
}

function buildFooterLines(context = {}) {
    const profile = context.profile ?? GENETIC_SEED_SYNTHESIZER.profiles.growth;
    const soil = context.soil ?? null;
    return [
        `Profile: ${profile.title}`,
        `Soil: ${soil?.typeId ? formatItemName(soil.typeId) : "None"}`
    ];
}

function updateDisplays(machine, tank, refreshUi = true) {
    if (!refreshUi) return;

    tank.display(GENETIC_SEED_SYNTHESIZER.slots.cryofluidDisplay);
    machine.displayEnergy(GENETIC_SEED_SYNTHESIZER.slots.energy);
    machine.displayProgress(GENETIC_SEED_SYNTHESIZER.slots.progress);
}

function showMachineWarning(machine, tank, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off();
    if (!refreshUi) return;

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(machine, tank, context),
        {
            footerLines: buildFooterLines(context),
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
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, tank, true);
}

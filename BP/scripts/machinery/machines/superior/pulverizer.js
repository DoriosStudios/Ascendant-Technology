import { ItemStack } from "@minecraft/server";
import {
    Machine,
    FluidManager,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    findRecipeByInputId,
    formatItemName,
    resolveMachineRecipeList,
    tickGate
} from "../../../DoriosCore/main.js";
import { getPulverizerRecipes } from "../../../config/recipes/pulverizer.js";
import {
    formatBatchWithQuantity,
    formatEnergyCost,
    formatFluidNeedValue,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatOptionalFluidSuffix,
    shouldRefreshSuperiorUi
} from "./utils.js";

const PULVERIZER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5, 6]),
        steamInput: 7,
        steamDisplay: 8,
        hidden: Object.freeze([9, 14, 15]),
        upgrades: Object.freeze([10, 11, 12, 13]),
        outputs: Object.freeze([16, 17, 18, 19])
    }),
    transfer: Object.freeze({
        outputIntervalTicks: 4,
        inputPullIntervalTicks: 4
    }),
    quantity: Object.freeze({
        maxLevel: 4,
        batchSizes: Object.freeze([1, 2, 4, 6, 8])
    }),
    steam: Object.freeze({
        type: "steam",
        perCraft: 250,
        speedMultiplier: 1.75,
        energyMultiplier: 1.5
    }),
    defaults: Object.freeze({
        energyCost: 1600,
        fluidCap: 32000,
        baseRecipeSeconds: 3
    })
});

const MAX_STACK_SIZE_CACHE = new Map();

DoriosAPI.register.blockComponent("pulverizer", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? PULVERIZER.defaults.energyCost);
            machine.displayEnergy(PULVERIZER.slots.energy);
            machine.displayProgress(PULVERIZER.slots.progress);
            machine.blockSlots([PULVERIZER.slots.steamDisplay, PULVERIZER.slots.steamInput, ...PULVERIZER.slots.hidden]);

            const tank = getSteamTank(machine, settings);
            tank.display(PULVERIZER.slots.steamDisplay);

            machine.entity.setItem(PULVERIZER.slots.status, "utilitycraft:arrow_indicator_90", 1, "");
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const tank = getSteamTank(machine, settings);
        const recipes = resolveMachineRecipeList(e.block, settings, ["pulverizer", "crusher"], getPulverizerRecipes());
        const quantityLevel = getQuantityUpgradeLevel(machine);
        const desiredBatch = getBatchSize(quantityLevel);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "pulverizer:ui");

        if (tickGate(machine.entity, "pulverizer:transfer_cd", PULVERIZER.transfer.outputIntervalTicks)) {
            transferOutputLanes(machine);
        }

        if (tickGate(machine.entity, "pulverizer:inputs_cd", PULVERIZER.transfer.inputPullIntervalTicks)) {
            for (const slot of PULVERIZER.slots.inputs) {
                machine.pullItemsFromAbove(slot);
            }
        }

        if (!recipes.length) {
            showMachineWarning(machine, tank, "No Recipes", {
                quantityLevel,
                desiredBatch,
                operation: null,
                focusGroup: null,
                steamActive: false
            }, true, shouldRefreshUi);
            return;
        }

        const operation = buildOperationPlan({
            machine,
            recipes,
            tank,
            settings,
            quantityLevel,
            desiredBatch
        });

        if (!operation.hasCandidateInput) {
            showMachineWarning(machine, tank, "Insert Items", {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: null,
                steamActive: false
            }, true, shouldRefreshUi);
            return;
        }

        if (!operation.ready) {
            const resetProgress = operation.message !== "Output Full";
            showMachineWarning(machine, tank, operation.message, {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: operation.focusGroup,
                steamActive: operation.focusGroup?.steamBoostActive === true
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
                steamActive: operation.selectedGroup?.steamBoostActive === true
            }, false, shouldRefreshUi);
            return;
        }

        let lastCraft = null;
        const progress = machine.getProgress();
        if (progress >= operation.energyCost) {
            lastCraft = processCraft(machine, operation, tank);
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
            lastCraft
                ? (operation.selectedGroup?.steamBoostActive ? "Boosted" : "Running")
                : (operation.selectedGroup?.steamBoostActive ? "Charging+" : "Charging"),
            {
                quantityLevel,
                desiredBatch,
                operation,
                focusGroup: operation.selectedGroup,
                steamActive: operation.selectedGroup?.steamBoostActive === true,
                lastCraft
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
        : PULVERIZER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(PULVERIZER.steam.type);
    }

    return tank;
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of PULVERIZER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(PULVERIZER.quantity.maxLevel, total));
}

function getBatchSize(quantityLevel) {
    const profileIndex = Math.max(0, Math.min(PULVERIZER.quantity.batchSizes.length - 1, Number(quantityLevel) || 0));
    return PULVERIZER.quantity.batchSizes[profileIndex];
}

function matchRecipe(recipes, itemId) {
    if (!itemId) return null;
    return findRecipeByInputId(recipes, itemId);
}

function collectInputGroups(machine, recipes) {
    const groups = [];
    const groupMap = new Map();

    for (const slot of PULVERIZER.slots.inputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) continue;

        let group = groupMap.get(stack.typeId);
        if (!group) {
            group = {
                typeId: stack.typeId,
                firstSlot: slot,
                totalAmount: 0,
                slots: [],
                recipe: matchRecipe(recipes, stack.typeId)
            };
            groups.push(group);
            groupMap.set(stack.typeId, group);
        }

        group.totalAmount += stack.amount;
        group.slots.push(slot);
    }

    return groups;
}

function buildOperationPlan({ machine, recipes, tank, settings, quantityLevel, desiredBatch }) {
    const inputGroups = collectInputGroups(machine, recipes);
    if (!inputGroups.length) {
        return {
            ready: false,
            message: "Insert Items",
            hasCandidateInput: false,
            inputGroupCount: 0,
            selectedGroup: null,
            focusGroup: null,
            quantityLevel,
            desiredBatch
        };
    }

    const yieldBoost = machine.boosts.overclockYield ?? 1;
    const baseEnergyCost = settings?.machine?.energy_cost ?? PULVERIZER.defaults.energyCost;
    const groupPlans = inputGroups.map(group =>
        buildGroupPlan(machine, group, desiredBatch, yieldBoost, baseEnergyCost, tank)
    );

    const selectedGroup = groupPlans.find(group => group.ready) ?? null;
    if (selectedGroup) {
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
            energyCost: selectedGroup.energyCost,
            speedMultiplier: selectedGroup.steamBoostActive ? PULVERIZER.steam.speedMultiplier : 1,
            referenceRecipe: buildReferenceRecipe(selectedGroup)
        };
    }

    const focusGroup = (
        groupPlans.find(group => group.invalidOutput)
        ?? groupPlans.find(group => group.invalidRecipe)
        ?? groupPlans.find(group => group.outputConflict)
        ?? groupPlans.find(group => group.outputFull)
        ?? groupPlans.find(group => group.missingInput)
        ?? groupPlans[0]
    );

    return {
        ready: false,
        message: determineWarningMessage(groupPlans),
        hasCandidateInput: true,
        inputGroupCount: groupPlans.length,
        selectedGroup: null,
        focusGroup,
        groupPlans,
        quantityLevel,
        desiredBatch
    };
}

function buildGroupPlan(machine, group, desiredBatch, yieldBoost, baseEnergyCost, tank) {
    const recipe = group.recipe;
    const plan = {
        ...group,
        ready: false,
        invalidRecipe: false,
        invalidOutput: false,
        outputConflict: false,
        outputFull: false,
        missingInput: false,
        desiredBatch,
        availableInputCrafts: 0,
        craftCount: 0,
        inputNeeded: 0,
        outputAmount: 0,
        energyCost: 0,
        baseEnergyCost: 0,
        steamNeeded: 0,
        steamBoostActive: false,
        outputPlan: null
    };

    if (!recipe) {
        plan.invalidRecipe = true;
        return plan;
    }

    if (!isValidItemId(recipe.output?.id)) {
        plan.invalidOutput = true;
        return plan;
    }

    const inputPerCraft = recipe.input.amount ?? 1;
    const outputPerCraft = recipe.output.amount ?? 1;
    plan.availableInputCrafts = Math.floor(group.totalAmount / Math.max(1, inputPerCraft));
    plan.outputPlan = buildOutputPlan(machine, recipe.output.id);
    plan.outputConflict = plan.outputPlan.compatibleSlotCount <= 0;

    const outputCrafts = Math.floor(plan.outputPlan.totalSpace / Math.max(1, outputPerCraft * yieldBoost));
    plan.outputFull = outputCrafts <= 0;
    plan.craftCount = Math.max(0, Math.min(desiredBatch, plan.availableInputCrafts, outputCrafts));
    plan.missingInput = plan.availableInputCrafts <= 0;

    if (plan.craftCount <= 0 || plan.outputConflict || plan.outputFull) {
        return plan;
    }

    plan.inputNeeded = inputPerCraft * plan.craftCount;
    plan.outputAmount = estimateOperationOutput(recipe, plan.craftCount, yieldBoost);
    plan.baseEnergyCost = Math.max(1, (recipe.energyCost ?? baseEnergyCost) * plan.craftCount);

    const availableSteam = tank?.get() ?? 0;
    const neededSteam = PULVERIZER.steam.perCraft * plan.craftCount;
    if (availableSteam >= neededSteam) {
        plan.steamBoostActive = true;
        plan.steamNeeded = neededSteam;
    }

    plan.energyCost = Math.max(1, Math.ceil(plan.baseEnergyCost * (plan.steamBoostActive ? PULVERIZER.steam.energyMultiplier : 1)));
    plan.ready = true;

    return plan;
}

function buildReferenceRecipe(groupPlan) {
    return {
        energyCost: groupPlan.energyCost,
        seconds: Number(groupPlan?.recipe?.seconds ?? PULVERIZER.defaults.baseRecipeSeconds),
        ticks: Number(groupPlan?.recipe?.ticks ?? (PULVERIZER.defaults.baseRecipeSeconds * 20))
    };
}

function determineWarningMessage(groupPlans) {
    if (groupPlans.some(group => group.invalidOutput)) return "Output Missing";
    if (groupPlans.some(group => group.invalidRecipe)) return "Input Invalid";
    if (groupPlans.some(group => group.outputConflict)) return "Output Conflict";
    if (groupPlans.some(group => group.outputFull)) return "Output Full";
    if (groupPlans.some(group => group.missingInput)) return "Missing Items";
    return "Insert Items";
}

function estimateOperationOutput(recipe, crafts, yieldBoost = 1) {
    const amount = (recipe.output?.amount ?? 1) * Math.max(1, crafts) * Math.max(1, yieldBoost);
    return Math.max(1, Math.ceil(amount));
}

function buildOutputPlan(machine, outputId) {
    const slots = [];
    let totalSpace = 0;
    let compatibleSlotCount = 0;

    for (const slot of PULVERIZER.slots.outputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            const maxAmount = resolveMaxStackSize(null, outputId);
            slots.push({
                slot,
                empty: true,
                compatible: true,
                space: maxAmount
            });
            compatibleSlotCount += 1;
            totalSpace += maxAmount;
            continue;
        }

        if (stack.typeId !== outputId) {
            slots.push({
                slot,
                empty: false,
                compatible: false,
                space: 0
            });
            continue;
        }

        const maxAmount = resolveMaxStackSize(stack, outputId);
        const space = Math.max(0, maxAmount - stack.amount);
        slots.push({
            slot,
            empty: false,
            compatible: true,
            space
        });
        compatibleSlotCount += 1;
        totalSpace += space;
    }

    return {
        slots,
        totalSpace,
        compatibleSlotCount
    };
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

function distributeOutput(machine, outputId, amount) {
    let remaining = Math.max(0, amount);
    if (remaining <= 0) return 0;

    const maxAmount = resolveMaxStackSize(null, outputId);

    for (const slot of PULVERIZER.slots.outputs) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (!current || current.typeId !== outputId) continue;

        const space = Math.max(0, resolveMaxStackSize(current, outputId) - current.amount);
        const inserted = Math.min(space, remaining);
        if (inserted <= 0) continue;

        machine.entity.changeItemAmount(slot, inserted);
        remaining -= inserted;
    }

    for (const slot of PULVERIZER.slots.outputs) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (current) continue;

        const inserted = Math.min(maxAmount, remaining);
        if (inserted <= 0) continue;

        machine.entity.setItem(slot, outputId, inserted);
        remaining -= inserted;
    }

    if (remaining > 0) {
        try {
            machine.dim.spawnItem(new ItemStack(outputId, remaining), machine.block.center());
        } catch {
            // Ignore emergency output spill failures.
        }
    }

    return amount - remaining;
}

function processCraft(machine, operation, tank) {
    const group = operation.selectedGroup;
    const recipe = group.recipe;
    const yieldBoost = machine.boosts.overclockYield ?? 1;

    consumeGroupedInput(machine, group, group.inputNeeded);

    if (group.steamBoostActive && group.steamNeeded > 0) {
        tank.consume(group.steamNeeded);
    }

    const rawOutput = (recipe.output.amount ?? 1) * group.craftCount * yieldBoost;
    const produced = machine.addFractionalItem(recipe.output.id, rawOutput);
    const inserted = distributeOutput(machine, recipe.output.id, produced);

    return {
        typeId: group.typeId,
        inputNeeded: group.inputNeeded,
        craftCount: group.craftCount,
        produced: inserted,
        outputId: recipe.output.id,
        steamUsed: group.steamBoostActive ? group.steamNeeded : 0
    };
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
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Steam",
            value: formatFluidTankBuffer(tank, PULVERIZER.steam.type)
        },
        {
            label: "Batch",
            value: formatBatchWithQuantity(desiredBatch, context.quantityLevel ?? 0)
        },
        {
            label: "Mode",
            value: steamActive ? "Boost" : "Base",
            valueColor: steamActive ? "§b" : "§7"
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

    if (focusGroup?.recipe) {
        operationInfo.push(
            {
                label: "Focus",
                value: `${formatItemName(focusGroup.recipe.input.id)} -> ${formatItemName(focusGroup.recipe.output.id)}`
            },
            {
                label: "Crafts",
                value: `${focusGroup.craftCount} / ${desiredBatch}`
            },
            {
                label: "Cost",
                value: `${formatEnergyCost(focusGroup.energyCost ?? 0)}${formatOptionalFluidSuffix(focusGroup.steamBoostActive, focusGroup.steamNeeded, "Steam")}`
            }
        );

        if (!focusGroup.steamBoostActive) {
            const availableSteam = tank?.get() ?? 0;
            const steamNeeded = PULVERIZER.steam.perCraft * Math.max(1, focusGroup.craftCount || 1);
            const shortage = Math.max(0, steamNeeded - availableSteam);
            if (shortage > 0) {
                operationInfo.push({
                    label: "Need Steam",
                    value: formatFluidNeedValue(shortage)
                });
            }
        }
    }

    if (operationInfo.length > 0) {
        appendLoreSection(lines, "Crushing Operation", operationInfo);
    }

    if (context.lastCraft?.produced > 0 && context.lastCraft?.outputId) {
        appendLoreSection(lines, "Last Batch", [
            `§7Produced: §f${context.lastCraft.produced} ${formatItemName(context.lastCraft.outputId)}`
        ]);
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

    tank.display(PULVERIZER.slots.steamDisplay);
    machine.displayEnergy(PULVERIZER.slots.energy);
    machine.displayProgress(PULVERIZER.slots.progress);
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

function transferOutputLanes(machine) {
    let transferred = false;
    for (const slot of PULVERIZER.slots.outputs) {
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

function isValidItemId(id) {
    if (!id || typeof id !== "string") return false;
    try {
        new ItemStack(id, 1);
        return true;
    } catch {
        return false;
    }
}

import { ItemStack } from "@minecraft/server";
import {
    Machine,
    Energy,
    FluidManager,
    buildOverclockLoreLine,
    tickGate,
    feedFluidSlot,
    formatItemName,
    formatFluidDisplayName
} from "../../DoriosCore/index.js";
import { getIndustrialBurnerRecipes } from "../../config/recipes/industrial_burner.js";

const INDUSTRIAL_BURNER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        inputs: Object.freeze([3, 4, 5]),
        upgrades: Object.freeze([6, 7, 8]),
        lavaInput: 9,
        lavaDisplay: 10,
        outputs: Object.freeze([11, 12, 13]),
        laneProgress: Object.freeze([14, 15, 16]),
        hidden: Object.freeze([17, 18, 19])
    }),
    defaults: Object.freeze({
        energyCost: 800,
        fluidCap: 32000,
        lavaType: "lava"
    }),
    transfer: Object.freeze({
        itemIntervalTicks: 4
    }),
    quantity: Object.freeze({
        maxLevel: 4,
        batchSizes: Object.freeze([2, 4, 6, 8, 10])
    }),
    progress: Object.freeze({
        indicator: "arrow_right"
    })
});

const LANE_PROGRESS_KEYS = INDUSTRIAL_BURNER.slots.inputs.map((_, index) => `industrial_burner:lane_progress_${index}`);

DoriosAPI.register.blockComponent("industrial_burner", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? INDUSTRIAL_BURNER.defaults.energyCost);
            machine.displayEnergy(INDUSTRIAL_BURNER.slots.energy);
            machine.blockSlots([
                INDUSTRIAL_BURNER.slots.lavaDisplay,
                ...INDUSTRIAL_BURNER.slots.laneProgress,
                ...INDUSTRIAL_BURNER.slots.hidden
            ]);

            const tank = getLavaTank(machine, settings);
            tank.display(INDUSTRIAL_BURNER.slots.lavaDisplay);

            setOverallProgress(machine, 0);
            for (let laneIndex = 0; laneIndex < INDUSTRIAL_BURNER.slots.laneProgress.length; laneIndex++) {
                setLaneProgress(machine.entity, laneIndex, 0);
                setProgressArrow(machine.inv, INDUSTRIAL_BURNER.slots.laneProgress[laneIndex], 0);
            }

            renderStatus(machine, {
                header: "Idle",
                headerColor: "§e",
                tank,
                quantityLevel: 0,
                batchSize: getBatchSize(0),
                laneMessages: [
                    "§7[1] Waiting Input",
                    "§7[2] Waiting Input",
                    "§7[3] Waiting Input"
                ]
            });
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const tank = getLavaTank(machine, settings);
        const recipes = resolveRecipes(e.block, settings);
        const quantityLevel = getQuantityUpgradeLevel(machine);
        const batchSize = getBatchSize(quantityLevel);
        const yieldBoost = Math.max(1, machine.boosts.overclockYield ?? 1);

        if (tickGate(machine.entity, "industrial_burner:items_cd", INDUSTRIAL_BURNER.transfer.itemIntervalTicks)) {
            for (const slot of INDUSTRIAL_BURNER.slots.inputs) {
                machine.pullItemsFromAbove(slot);
            }
            machine.pullItemsFromAbove(INDUSTRIAL_BURNER.slots.lavaInput);
            transferOutputLanes(machine);
        }

        feedFluidSlot(machine, tank, INDUSTRIAL_BURNER.slots.lavaInput);
        tank.display(INDUSTRIAL_BURNER.slots.lavaDisplay);
        machine.displayEnergy(INDUSTRIAL_BURNER.slots.energy);

        if (!recipes.length) {
            resetProgressIndicators(machine);
            renderStatus(machine, {
                header: "No Recipes",
                headerColor: "§c",
                tank,
                quantityLevel,
                batchSize,
                laneMessages: [
                    "§c[1] No Furnace Recipes",
                    "§c[2] No Furnace Recipes",
                    "§c[3] No Furnace Recipes"
                ]
            });
            machine.off();
            return;
        }

        const laneStates = buildLaneStates(machine, recipes, tank, batchSize, yieldBoost, settings);
        let availableEnergy = machine.energy.get();
        let rateBudget = machine.rate;
        let active = false;
        let craftedAnything = false;

        for (const lane of laneStates) {
            if (lane.ready && lane.progress >= lane.energyCost) {
                const crafted = craftLane(machine, lane, tank, yieldBoost);
                if (crafted.count > 0) {
                    active = true;
                    craftedAnything = true;
                    lane.message = `Smelted x${crafted.count}`;
                    lane.color = "§2";
                    lane.progress = Math.max(0, lane.progress - lane.energyCost);
                    refreshLaneState(machine, lane, recipes, tank, batchSize, yieldBoost, settings);
                }
            }
        }

        for (let index = 0; index < laneStates.length; index++) {
            const lane = laneStates[index];
            if (!lane.ready) {
                finalizeLane(machine, lane);
                continue;
            }

            if (machine.energy.get() <= 0 || availableEnergy <= 0 || rateBudget <= 0) {
                if (lane.progress <= 0) {
                    lane.message = "No Energy";
                    lane.color = "§c";
                } else {
                    lane.message = "Holding Charge";
                    lane.color = "§e";
                }
                finalizeLane(machine, lane);
                continue;
            }

            const remainingActive = countEnergyReadyLanes(laneStates, index);
            if (remainingActive > 0 && lane.progress < lane.energyCost) {
                const consumption = machine.boosts.consumption;
                const progressNeeded = lane.energyCost - lane.progress;
                const laneBudget = Math.min(
                    availableEnergy / remainingActive,
                    rateBudget / remainingActive,
                    progressNeeded * consumption
                );

                if (laneBudget > 0) {
                    const consumed = machine.energy.consume(laneBudget);
                    if (consumed > 0) {
                        availableEnergy = Math.max(0, availableEnergy - consumed);
                        rateBudget = Math.max(0, rateBudget - consumed);
                        lane.progress += consumed / Math.max(consumption, Number.EPSILON);
                        lane.message = "Heating Batch";
                        lane.color = "§a";
                        active = true;
                    }
                }
            }

            if (lane.ready && lane.progress >= lane.energyCost) {
                const crafted = craftLane(machine, lane, tank, yieldBoost);
                if (crafted.count > 0) {
                    active = true;
                    craftedAnything = true;
                    lane.message = `Smelted x${crafted.count}`;
                    lane.color = "§2";
                    lane.progress = Math.max(0, lane.progress - lane.energyCost);
                    refreshLaneState(machine, lane, recipes, tank, batchSize, yieldBoost, settings);
                }
            }

            if (lane.ready && lane.message === "Ready") {
                lane.color = "§a";
            }

            finalizeLane(machine, lane);
        }

        tank.display(INDUSTRIAL_BURNER.slots.lavaDisplay);
        machine.displayEnergy(INDUSTRIAL_BURNER.slots.energy);

        const progressSummary = summarizeOverallProgress(laneStates);
        setOverallProgress(machine, progressSummary.ratio);

        const header = craftedAnything
            ? "Running"
            : (active ? "Heating" : inferHeader(laneStates, machine.energy.get()));
        const headerColor = craftedAnything || active
            ? "§2"
            : inferHeaderColor(laneStates, machine.energy.get());

        renderStatus(machine, {
            header,
            headerColor,
            tank,
            quantityLevel,
            batchSize,
            laneMessages: laneStates.map(buildLaneMessage),
            focusLane: laneStates.find(lane => lane.ready) ?? laneStates.find(lane => lane.typeId) ?? null
        });

        if (active || craftedAnything) {
            machine.on();
        } else {
            machine.off();
        }
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function resolveRecipes(block, settings) {
    const component = block.getComponent("utilitycraft:machine_recipes")?.customComponentParameters?.params;
    if (component?.type === "industrial_burner" || component?.type === "furnace") return getIndustrialBurnerRecipes();
    if (Array.isArray(component)) return component;
    if (Array.isArray(settings?.machine?.recipes)) return settings.machine.recipes;
    return getIndustrialBurnerRecipes();
}

function getLavaTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : INDUSTRIAL_BURNER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(INDUSTRIAL_BURNER.defaults.lavaType);
    }

    return tank;
}

function buildLaneStates(machine, recipes, tank, batchSize, yieldBoost, settings) {
    return INDUSTRIAL_BURNER.slots.inputs.map((inputSlot, laneIndex) => {
        const outputSlot = INDUSTRIAL_BURNER.slots.outputs[laneIndex];
        return createLaneState(machine, recipes, tank, batchSize, yieldBoost, settings, laneIndex, inputSlot, outputSlot);
    });
}

function createLaneState(machine, recipes, tank, batchSize, yieldBoost, settings, laneIndex, inputSlot, outputSlot) {
    const inputStack = machine.inv.getItem(inputSlot);
    const state = {
        laneIndex,
        inputSlot,
        outputSlot,
        inputStack,
        outputStack: machine.inv.getItem(outputSlot),
        progress: getLaneProgress(machine.entity, laneIndex),
        ready: false,
        recipe: null,
        typeId: inputStack?.typeId ?? null,
        color: "§7",
        message: "Waiting Input",
        availableCrafts: 0,
        craftCount: 0,
        inputNeeded: 0,
        outputAmount: 0,
        energyCost: 0,
        lavaNeeded: 0,
        batchSize
    };

    if (!inputStack) {
        state.progress = 0;
        return state;
    }

    const recipe = matchRecipe(recipes, inputStack.typeId);
    if (!recipe) {
        state.progress = 0;
        state.color = "§c";
        state.message = "Invalid Recipe";
        return state;
    }

    state.recipe = recipe;

    if (state.outputStack && state.outputStack.typeId !== recipe.output.id) {
        state.color = "§c";
        state.message = "Output Conflict";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    const outputFitsSingle = canOutputFit(state.outputStack, recipe.output.id, estimateBatchOutput(recipe, 1, yieldBoost));
    if (!outputFitsSingle) {
        state.color = "§e";
        state.message = "Output Full";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    const baseAvailableCrafts = Math.floor(inputStack.amount / Math.max(1, recipe.input.amount));
    if (baseAvailableCrafts <= 0) {
        state.progress = 0;
        state.color = "§e";
        state.message = `Need ${recipe.input.amount}`;
        return state;
    }

    for (let crafts = Math.min(batchSize, baseAvailableCrafts); crafts >= 1; crafts--) {
        const outputAmount = estimateBatchOutput(recipe, crafts, yieldBoost);
        const lavaNeeded = estimateBatchLava(recipe, crafts);
        if (!canOutputFit(state.outputStack, recipe.output.id, outputAmount)) continue;
        if (tank.get() < lavaNeeded) continue;

        state.availableCrafts = baseAvailableCrafts;
        state.craftCount = crafts;
        state.inputNeeded = recipe.input.amount * crafts;
        state.outputAmount = outputAmount;
        state.energyCost = estimateBatchEnergy(recipe, crafts, settings);
        state.lavaNeeded = lavaNeeded;
        state.ready = true;
        state.color = "§a";
        state.message = state.progress > 0 ? "Heating Batch" : "Ready";
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    state.availableCrafts = baseAvailableCrafts;
    state.energyCost = estimateBatchEnergy(recipe, 1, settings);
    state.progress = Math.min(state.progress, state.energyCost);
    state.lavaNeeded = estimateBatchLava(recipe, 1);

    if (tank.get() < state.lavaNeeded) {
        state.color = "§6";
        state.message = "Need Lava";
        return state;
    }

    state.color = "§e";
    state.message = "Output Full";
    return state;
}

function refreshLaneState(machine, lane, recipes, tank, batchSize, yieldBoost, settings) {
    const next = createLaneState(
        machine,
        recipes,
        tank,
        batchSize,
        yieldBoost,
        settings,
        lane.laneIndex,
        lane.inputSlot,
        lane.outputSlot
    );

    Object.assign(lane, next);
}

function craftLane(machine, lane, tank, yieldBoost) {
    if (!lane.ready || !lane.recipe || lane.craftCount <= 0) {
        return { count: 0 };
    }

    machine.entity.changeItemAmount(lane.inputSlot, -lane.inputNeeded);
    tank.consume(lane.lavaNeeded);

    const rawOutput = (lane.recipe.output.amount ?? 1) * lane.craftCount * yieldBoost;
    const produced = machine.addFractionalItem(lane.recipe.output.id, rawOutput);
    if (produced > 0) {
        addToOutputSlot(machine, lane.outputSlot, lane.recipe.output.id, produced);
    }

    return {
        count: lane.craftCount,
        produced
    };
}

function addToOutputSlot(machine, slotIndex, itemId, amount) {
    if (!itemId || amount <= 0) return;

    const existing = machine.inv.getItem(slotIndex);
    if (!existing) {
        machine.entity.setItem(slotIndex, itemId, amount);
        return;
    }

    if (existing.typeId === itemId) {
        machine.entity.changeItemAmount(slotIndex, amount);
        return;
    }

    try {
        machine.dim.spawnItem(new ItemStack(itemId, amount), machine.block.center());
    } catch {
        // ignore emergency spill failures
    }
}

function matchRecipe(recipes, inputId) {
    if (!inputId) return null;
    return recipes.find(recipe => recipe?.input?.id === inputId) ?? null;
}

function estimateBatchEnergy(recipe, crafts, settings) {
    const fallback = settings?.machine?.energy_cost ?? INDUSTRIAL_BURNER.defaults.energyCost;
    return Math.max(1, Math.ceil((recipe?.energyCost ?? fallback) * Math.max(1, crafts)));
}

function estimateBatchLava(recipe, crafts) {
    return Math.max(1, Math.ceil((recipe?.lavaPerCraft ?? 250) * Math.max(1, crafts)));
}

function estimateBatchOutput(recipe, crafts, yieldBoost = 1) {
    return Math.max(1, Math.ceil((recipe?.output?.amount ?? 1) * Math.max(1, crafts) * Math.max(1, yieldBoost)));
}

function resolveMaxStackSize(slot, itemId) {
    if (slot?.maxAmount) return slot.maxAmount;

    try {
        const probe = new ItemStack(itemId, 1);
        if (probe?.maxAmount) return probe.maxAmount;
        const component = probe?.getComponent?.("minecraft:max_stack_size");
        if (typeof component?.value === "number") return component.value;
    } catch {
        // fall through to vanilla-like default
    }

    return 64;
}

function canOutputFit(outputStack, itemId, amount) {
    if (!outputStack) {
        return resolveMaxStackSize(null, itemId) >= amount;
    }

    if (outputStack.typeId !== itemId) {
        return false;
    }

    return Math.max(0, resolveMaxStackSize(outputStack, itemId) - outputStack.amount) >= amount;
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of INDUSTRIAL_BURNER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(INDUSTRIAL_BURNER.quantity.maxLevel, total));
}

function isQuantityUpgradeItem(item) {
    if (!item?.typeId) return false;
    if (item.typeId === "utilitycraft:quantity_upgrade") return true;
    if (typeof item.hasTag === "function" && item.hasTag("utilitycraft:quantity_upgrade")) return true;

    const [, raw = ""] = item.typeId.split(":");
    return raw === "quantity_upgrade";
}

function getBatchSize(quantityLevel) {
    const profileIndex = Math.max(0, Math.min(INDUSTRIAL_BURNER.quantity.batchSizes.length - 1, Number(quantityLevel) || 0));
    return INDUSTRIAL_BURNER.quantity.batchSizes[profileIndex];
}

function getLaneProgress(entity, laneIndex) {
    return Number(entity.getDynamicProperty(LANE_PROGRESS_KEYS[laneIndex])) || 0;
}

function setLaneProgress(entity, laneIndex, value) {
    entity.setDynamicProperty(LANE_PROGRESS_KEYS[laneIndex], Math.max(0, Number(value) || 0));
}

function setProgressArrow(inv, slotIndex, ratio) {
    const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    const frame = Math.max(0, Math.min(16, Math.floor(clampedRatio * 16)));
    inv.setItem(slotIndex, new ItemStack(`utilitycraft:${INDUSTRIAL_BURNER.progress.indicator}_${frame}`, 1));
}

function finalizeLane(machine, lane) {
    const energyCost = Math.max(1, lane.energyCost || 1);
    lane.progress = Math.min(Math.max(0, lane.progress), energyCost);
    setLaneProgress(machine.entity, lane.laneIndex, lane.progress);
    setProgressArrow(machine.inv, INDUSTRIAL_BURNER.slots.laneProgress[lane.laneIndex], lane.progress / energyCost);
}

function resetProgressIndicators(machine) {
    setOverallProgress(machine, 0);
    for (let laneIndex = 0; laneIndex < INDUSTRIAL_BURNER.slots.laneProgress.length; laneIndex++) {
        setLaneProgress(machine.entity, laneIndex, 0);
        setProgressArrow(machine.inv, INDUSTRIAL_BURNER.slots.laneProgress[laneIndex], 0);
    }
}

function summarizeOverallProgress(laneStates) {
    let totalCurrent = 0;
    let totalMax = 0;

    for (const lane of laneStates) {
        if (lane.energyCost <= 0) continue;
        totalCurrent += Math.min(lane.progress, lane.energyCost);
        totalMax += lane.energyCost;
    }

    return {
        ratio: totalMax > 0 ? totalCurrent / totalMax : 0
    };
}

function setOverallProgress(machine, ratio) {
    setProgressArrow(machine.inv, INDUSTRIAL_BURNER.slots.progress, ratio);
}

function countEnergyReadyLanes(laneStates, startIndex = 0) {
    let total = 0;
    for (let index = startIndex; index < laneStates.length; index++) {
        const lane = laneStates[index];
        if (lane.ready && lane.progress < lane.energyCost) {
            total++;
        }
    }
    return total;
}

function buildLaneMessage(lane) {
    const laneNumber = lane.laneIndex + 1;
    const detail = lane.ready && lane.craftCount > 0
        ? `${lane.message} x${lane.craftCount}`
        : lane.message;
    return `${lane.color}[${laneNumber}] ${detail}`;
}

function inferHeader(laneStates, energy) {
    if (energy <= 0 && laneStates.some(lane => lane.typeId)) return "No Energy";
    if (laneStates.some(lane => lane.message === "Need Lava")) return "Need Lava";
    if (laneStates.some(lane => lane.message === "Output Conflict")) return "Output Conflict";
    if (laneStates.some(lane => lane.message === "Output Full")) return "Output Full";
    if (laneStates.some(lane => lane.message === "Invalid Recipe")) return "Invalid Recipe";
    if (laneStates.some(lane => lane.typeId)) return "Idle";
    return "Waiting Input";
}

function inferHeaderColor(laneStates, energy) {
    if (energy <= 0 && laneStates.some(lane => lane.typeId)) return "§c";
    if (laneStates.some(lane => lane.message === "Need Lava")) return "§6";
    if (laneStates.some(lane => lane.message === "Invalid Recipe" || lane.message === "Output Conflict")) return "§c";
    if (laneStates.some(lane => lane.message === "Output Full")) return "§e";
    if (laneStates.some(lane => lane.typeId)) return "§e";
    return "§7";
}

function renderStatus(machine, context) {
    const tankAmount = FluidManager.formatFluid(context.tank?.get() ?? 0);
    const tankCap = FluidManager.formatFluid(context.tank?.getCap() ?? 0);
    const focusLane = context.focusLane;
    const focusHeat = focusLane?.recipe
        ? FluidManager.formatFluid(focusLane.recipe.lavaPerCraft ?? 250)
        : FluidManager.formatFluid(250);
    const lore = [
        `${context.headerColor}${context.header}`,
        `§7Fuel: §f${formatFluidDisplayName("lava")} ${tankAmount} §7/ §f${tankCap}`,
        `§7Batch Cap: §f${context.batchSize} §7(Q${context.quantityLevel})`,
        `§7Heat Cost: §f${focusHeat} §7per craft`,
        `§7Speed: §f${machine.boosts.speed.toFixed(2)}x`,
        `§7Efficiency: §f${((1 / machine.boosts.consumption) * 100).toFixed(0)}%`,
        `§7Rate: §f${Energy.formatEnergyToText(Math.floor(machine.baseRate))}/t`
    ];

    if (focusLane?.recipe) {
        lore.push(`§7Focus: §f${formatItemName(focusLane.recipe.input.id)} -> ${formatItemName(focusLane.recipe.output.id)}`);
        lore.push(`§7Batch Output: §f${focusLane.outputAmount}`);
    }

    lore.push(...context.laneMessages);

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) lore.push(overclockLine.replace(/^§r/, ""));

    machine.setLabel({
        title: "§6Industrial Burner",
        lore
    }, INDUSTRIAL_BURNER.slots.status);
}

function transferOutputLanes(machine) {
    let transferred = false;
    for (const slot of INDUSTRIAL_BURNER.slots.outputs) {
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

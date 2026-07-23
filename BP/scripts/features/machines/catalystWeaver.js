// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { getCatalystWeaverRecipe } from "../../config/recipes/catalystWeaver.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:catalyst_weaver";
const INPUT_SLOT = 3;
const CATALYST_SLOTS = [4, 5, 6, 7, 8, 9];
const FLUID_DISPLAY_SLOT = 10;
const BYPRODUCT_SLOT = 13;
const OUTPUT_SLOT = 14;
const RECIPE_KEY = "ascendant:catalyst_weaver_recipe";
const FLUID_IO_RATE = 128000;
const itemMaximums = new Map();

registerIOInterface(ID, {
    items: {
        buttonSlots: [15, 16, 17, 18, 19, 20],
        anyInputSlots: [INPUT_SLOT, ...CATALYST_SLOTS],
        anyOutputSlots: [OUTPUT_SLOT, BYPRODUCT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "input_2", inputSlots: [CATALYST_SLOTS[0]] },
            { id: "input_3", inputSlots: [CATALYST_SLOTS[1]] },
            { id: "input_4", inputSlots: [CATALYST_SLOTS[2]] },
            { id: "input_5", inputSlots: [CATALYST_SLOTS[3]] },
            { id: "input_6", inputSlots: [CATALYST_SLOTS[4]] },
            { id: "input_7", inputSlots: [CATALYST_SLOTS[5]] },
            { id: "input_8", inputSlots: [INPUT_SLOT, ...CATALYST_SLOTS] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
            { id: "output_2", outputSlots: [BYPRODUCT_SLOT] },
            { id: "output_3", outputSlots: [OUTPUT_SLOT, BYPRODUCT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [21, 22, 23, 24, 25, 26],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([FLUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const tank = new FluidStorage(machine.entity, 0);
            tank.display(FLUID_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });
        const tank = new FluidStorage(machine.entity, 0);
        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Insert Base Item", "");
            return;
        }

        const catalystTotals = readCatalystTotals(machine.container);
        const recipe = getCatalystWeaverRecipe(input.typeId, input.amount, catalystTotals);
        if (!recipe) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Invalid Catalysts", "");
            return;
        }

        const previousRecipe = machine.entity.getDynamicProperty(RECIPE_KEY);
        if (previousRecipe !== recipe.id) {
            setDynamicString(machine.entity, RECIPE_KEY, recipe.id);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        if (!isValidItem(recipe.output.id)) {
            pauseProcess(machine, tank, cost, "Output Unavailable");
            return;
        }

        const inputCrafts = Math.floor(input.amount / recipe.input.amount);
        const catalystCrafts = getCatalystCraftCapacity(recipe, catalystTotals);
        if (inputCrafts <= 0 || catalystCrafts <= 0) {
            resetProcess(machine, tank, cost, "Needs More Materials", recipe.id);
            return;
        }

        let fluidCrafts = Number.MAX_SAFE_INTEGER;
        if (recipe.fluid) {
            const tankType = tank.getType();
            if (tankType !== recipe.fluid.type) {
                const message = tankType === "empty"
                    ? `Needs ${DoriosLib.text.formatIdentifier(recipe.fluid.type)}`
                    : `Wrong Fluid: ${DoriosLib.text.formatIdentifier(tankType)}`;
                pauseProcess(machine, tank, cost, message);
                return;
            }
            fluidCrafts = Math.floor(tank.get() / recipe.fluid.amount);
            if (fluidCrafts <= 0) {
                pauseProcess(
                    machine,
                    tank,
                    cost,
                    `Needs ${FluidStorage.formatFluid(recipe.fluid.amount)} ${DoriosLib.text.formatIdentifier(recipe.fluid.type)}`,
                );
                return;
            }
        }

        const output = machine.container.getItem(OUTPUT_SLOT);
        const outputCrafts = getOutputCraftCapacity(output, recipe.output.id, recipe.output.amount);
        if (outputCrafts <= 0) {
            pauseProcess(
                machine,
                tank,
                cost,
                output?.typeId === recipe.output.id ? "Output Full" : "Output Conflict",
            );
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, catalystCrafts, fluidCrafts, outputCrafts),
            rateMultiplier: recipe.speed,
        });

        if (result.processCount > 0) {
            consumeStack(machine.container, INPUT_SLOT, result.processCount * recipe.input.amount);
            consumeCatalysts(machine.container, recipe.catalysts, result.processCount);
            if (recipe.fluid) tank.consume(result.processCount * recipe.fluid.amount);
            insertStack(
                machine.container,
                OUTPUT_SLOT,
                output,
                recipe.output.id,
                result.processCount * recipe.output.amount,
            );
            produceByproduct(machine.container, recipe.byproduct, result.processCount);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);
        if (machine.shouldUpdateUI) tank.display(FLUID_DISPLAY_SLOT);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Weaving" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(recipe, tank) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function readCatalystTotals(container) {
    const totals = new Map();
    for (let index = 0; index < CATALYST_SLOTS.length; index++) {
        const item = container.getItem(CATALYST_SLOTS[index]);
        if (!item) continue;
        totals.set(item.typeId, (totals.get(item.typeId) ?? 0) + item.amount);
    }
    return totals;
}

function getCatalystCraftCapacity(recipe, catalystTotals) {
    let capacity = Number.MAX_SAFE_INTEGER;
    for (let index = 0; index < recipe.catalysts.length; index++) {
        const catalyst = recipe.catalysts[index];
        capacity = Math.min(
            capacity,
            Math.floor((catalystTotals.get(catalyst.id) ?? 0) / catalyst.amount),
        );
    }
    return recipe.catalysts.length > 0 ? capacity : 0;
}

function getOutputCraftCapacity(item, typeId, amountPerCraft) {
    if (!item) return Math.floor(getItemMaximum(typeId) / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function consumeCatalysts(container, catalysts, crafts) {
    for (let requirementIndex = 0; requirementIndex < catalysts.length; requirementIndex++) {
        const requirement = catalysts[requirementIndex];
        let remaining = requirement.amount * crafts;
        for (let slotIndex = 0; slotIndex < CATALYST_SLOTS.length && remaining > 0; slotIndex++) {
            const slot = CATALYST_SLOTS[slotIndex];
            const item = container.getItem(slot);
            if (!item || item.typeId !== requirement.id) continue;

            const consumed = Math.min(item.amount, remaining);
            remaining -= consumed;
            if (consumed >= item.amount) container.setItem(slot, undefined);
            else {
                item.amount -= consumed;
                container.setItem(slot, item);
            }
        }
    }
}

function consumeStack(container, slot, amount) {
    const item = container.getItem(slot);
    if (!item) return;
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

function insertStack(container, slot, item, typeId, amount) {
    if (amount <= 0) return;
    if (item) {
        item.amount += amount;
        container.setItem(slot, item);
    } else {
        container.setItem(slot, new ItemStack(typeId, amount));
    }
}

function produceByproduct(container, byproduct, crafts) {
    if (!byproduct || !isValidItem(byproduct.id)) return;

    let produced = 0;
    for (let craft = 0; craft < crafts; craft++) {
        if (Math.random() > byproduct.chance) continue;
        produced += rollAmount(byproduct.amount);
    }
    if (produced <= 0) return;

    const item = container.getItem(BYPRODUCT_SLOT);
    if (item && item.typeId !== byproduct.id) return;
    const available = (item?.maxAmount ?? getItemMaximum(byproduct.id)) - (item?.amount ?? 0);
    insertStack(container, BYPRODUCT_SLOT, item, byproduct.id, Math.min(produced, available));
}

function rollAmount(amount) {
    if (!Array.isArray(amount)) return amount;
    return amount[0] + Math.floor(Math.random() * (amount[1] - amount[0] + 1));
}

function isValidItem(typeId) {
    return getItemMaximum(typeId) > 0;
}

function getItemMaximum(typeId) {
    if (itemMaximums.has(typeId)) return itemMaximums.get(typeId);
    let maximum = 0;
    try {
        maximum = new ItemStack(typeId, 1).maxAmount;
    } catch {}
    itemMaximums.set(typeId, maximum);
    return maximum;
}

function resetProcess(machine, tank, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, tank, cost, message);
}

function pauseProcess(machine, tank, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) tank.display(FLUID_DISPLAY_SLOT);
    renderStatus(machine, false, message);
}

function recipeStatusLines(recipe, tank) {
    const lines = [
        `\u00A7r\u00A77Output: \u00A7f${recipe.output.amount} x ${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Catalysts: \u00A7f${recipe.catalysts.length}`,
    ];
    if (recipe.fluid) {
        lines.push(
            `\u00A7r\u00A77Fluid: \u00A7f${FluidStorage.formatFluid(recipe.fluid.amount)} ${DoriosLib.text.formatIdentifier(recipe.fluid.type)}`,
            `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(tank.get())}`,
        );
    }
    return lines;
}

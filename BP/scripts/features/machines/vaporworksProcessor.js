// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { getVaporworksRecipe } from "../../config/recipes/vaporworksProcessor.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:vaporworks_processor";
const FLUID_CONTAINER_INPUT_SLOT = 3;
const FLUID_CONTAINER_RETURN_SLOT = 4;
const GAS_CONTAINER_INPUT_SLOT = 5;
const GAS_CONTAINER_OUTPUT_SLOT = 6;
const FLUID_DISPLAY_SLOT = 7;
const GAS_DISPLAY_SLOT = 8;
const RECIPE_KEY = "ascendant:vaporworks_recipe";
const RESOURCE_IO_RATE = 128000;
const itemMaximums = new Map();

registerIOInterface(ID, {
    items: {
        buttonSlots: [11, 12, 13, 14, 15, 16],
        anyInputSlots: [FLUID_CONTAINER_INPUT_SLOT, GAS_CONTAINER_INPUT_SLOT],
        anyOutputSlots: [FLUID_CONTAINER_RETURN_SLOT, GAS_CONTAINER_OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [FLUID_CONTAINER_INPUT_SLOT] },
            { id: "input_2", inputSlots: [GAS_CONTAINER_INPUT_SLOT] },
            { id: "input_3", inputSlots: [FLUID_CONTAINER_INPUT_SLOT, GAS_CONTAINER_INPUT_SLOT] },
            { id: "output_1", outputSlots: [FLUID_CONTAINER_RETURN_SLOT] },
            { id: "output_2", outputSlots: [GAS_CONTAINER_OUTPUT_SLOT] },
            { id: "output_3", outputSlots: [FLUID_CONTAINER_RETURN_SLOT, GAS_CONTAINER_OUTPUT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [17, 18, 19, 20, 21, 22],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
    gases: {
        buttonSlots: [23, 24, 25, 26, 27, 28],
        anyInputIndices: [],
        anyOutputIndices: [0],
        modes: [
            { id: "disabled" },
            { id: "output_1", outputIndices: [0] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([FLUID_DISPLAY_SLOT, GAS_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const steam = new GasStorage(machine.entity, 0);
            steam.setType("steam");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const liquid = new FluidStorage(machine.entity, 0);
        const steam = new GasStorage(machine.entity, 0);
        if (steam.getType() === "empty") steam.setType("steam");

        machine.processIO({
            maxFluidMovedPerTick: RESOURCE_IO_RATE,
            maxGasMovedPerTick: RESOURCE_IO_RATE,
        });
        processFluidInputContainer(machine.container, liquid);
        processGasOutputContainer(machine.container, steam);

        const inputType = liquid.getType();
        if (inputType === "empty" || liquid.get() <= 0) {
            resetProcess(machine, liquid, steam, settings.machine.energy_cost, "Insert Liquid", "");
            return;
        }

        const recipe = getVaporworksRecipe(inputType);
        if (!recipe) {
            resetProcess(machine, liquid, steam, settings.machine.energy_cost, "Invalid Liquid", "");
            return;
        }

        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== recipe.id) {
            setDynamicString(machine.entity, RECIPE_KEY, recipe.id);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        const gasType = steam.getType();
        if (gasType !== "empty" && gasType !== recipe.outputGas.type) {
            pauseProcess(machine, liquid, steam, cost, "Gas Output Conflict");
            return;
        }

        const inputCrafts = Math.floor(liquid.get() / recipe.inputFluid.amount);
        const outputCrafts = Math.floor(steam.getFreeSpace() / recipe.outputGas.amount);
        if (inputCrafts <= 0 || outputCrafts <= 0) {
            if (inputCrafts <= 0) {
                resetProcess(machine, liquid, steam, cost, "Needs More Liquid", recipe.id);
            } else {
                pauseProcess(machine, liquid, steam, cost, "Steam Tank Full");
            }
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, outputCrafts),
            rateMultiplier: getRecipeRateMultiplier(settings.machine.rate_speed_base, cost, recipe.ticks),
        });

        if (result.processCount > 0) {
            liquid.consume(result.processCount * recipe.inputFluid.amount);
            if (steam.getType() === "empty") steam.setType(recipe.outputGas.type);
            steam.add(result.processCount * recipe.outputGas.amount);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayResources(machine, liquid, steam, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Producing Steam" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(recipe, liquid, steam) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function processFluidInputContainer(container, liquid) {
    const input = container.getItem(FLUID_CONTAINER_INPUT_SLOT);
    if (!input) return false;

    const definition = FluidStorage.getContainerData(input.typeId);
    if (!definition || !getVaporworksRecipe(definition.type)) return false;

    const resultType = definition.output;
    if (resultType && !canInsertItem(container, FLUID_CONTAINER_RETURN_SLOT, resultType)) return false;

    const result = liquid.fluidItem(input.typeId);
    if (result === false) return false;

    consumeOne(container, FLUID_CONTAINER_INPUT_SLOT, input);
    if (result) insertOne(container, FLUID_CONTAINER_RETURN_SLOT, result);
    return true;
}

function processGasOutputContainer(container, steam) {
    const input = container.getItem(GAS_CONTAINER_INPUT_SLOT);
    if (!input) return false;

    const holder = GasStorage.itemGasHolders[input.typeId];
    const resultType = holder?.types?.[steam.getType()];
    if (!resultType || steam.get() < holder.required) return false;
    if (!canInsertItem(container, GAS_CONTAINER_OUTPUT_SLOT, resultType)) return false;

    const result = steam.gasItem(input.typeId);
    if (result === false) return false;

    consumeOne(container, GAS_CONTAINER_INPUT_SLOT, input);
    if (result) insertOne(container, GAS_CONTAINER_OUTPUT_SLOT, result);
    return true;
}

function canInsertItem(container, slot, typeId) {
    const item = container.getItem(slot);
    if (!item) return getItemMaximum(typeId) > 0;
    return item.typeId === typeId && item.amount < item.maxAmount;
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

function consumeOne(container, slot, item) {
    if (item.amount <= 1) container.setItem(slot, undefined);
    else {
        item.amount--;
        container.setItem(slot, item);
    }
}

function insertOne(container, slot, typeId) {
    const item = container.getItem(slot);
    if (!item) container.setItem(slot, new ItemStack(typeId, 1));
    else {
        item.amount++;
        container.setItem(slot, item);
    }
}

function getRecipeRateMultiplier(baseRate, cost, ticks) {
    return cost / (Math.max(Number.EPSILON, baseRate) * Math.max(1, ticks));
}

function resetProcess(machine, liquid, steam, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, liquid, steam, cost, message);
}

function pauseProcess(machine, liquid, steam, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayResources(machine, liquid, steam, cost);
    renderStatus(machine, false, message);
}

function displayResources(machine, liquid, steam, cost) {
    displayProgress(machine, cost);
    if (!machine.shouldUpdateUI) return;
    liquid.display(FLUID_DISPLAY_SLOT);
    steam.display(GAS_DISPLAY_SLOT);
}

function recipeStatusLines(recipe, liquid, steam) {
    return [
        `\u00A7r\u00A77Input: \u00A7f${FluidStorage.formatFluid(recipe.inputFluid.amount)} ${DoriosLib.text.formatIdentifier(recipe.inputFluid.type)}`,
        `\u00A7r\u00A77Output: \u00A7f${GasStorage.formatGas(recipe.outputGas.amount)} ${DoriosLib.text.formatIdentifier(recipe.outputGas.type)}`,
        `\u00A7r\u00A77Liquid: \u00A7f${FluidStorage.formatFluid(liquid.get())} / ${FluidStorage.formatFluid(liquid.getCap())}`,
        `\u00A7r\u00A77Steam: \u00A7f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
    ];
}

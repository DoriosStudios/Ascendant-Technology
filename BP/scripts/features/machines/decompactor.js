// @ts-check

import { resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    advanceProcess,
    consumePooledInput,
    countPooledInput,
    getPooledOutputCapacity,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import { getDecompactorRecipe } from "../../config/recipes/decompactor.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:decompactor";
const INVENTORY_SIZE = 31;
const INPUTS = Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11]);
const OUTPUTS = Object.freeze([16, 17, 18, 19, 20, 21, 22, 23, 24]);
const PROGRESS_SLOT = 2;
const RECIPE_KEY = "ascendant:decompactor_recipe";
const itemMaximums = new Map();

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [25, 26, 27, 28, 29, 30],
        anyInputSlots: INPUTS,
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
});

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid || machine.container.size !== INVENTORY_SIZE) return;
        machine.processIO();

        const selected = selectRecipe(machine.container);
        if (!selected) {
            reset(machine, settings.machine.energy_cost, hasAnyInput(machine.container) ? "Input Invalid" : "Insert Materials");
            return;
        }

        const { inputTypeId, recipe, inputCount } = selected;
        if (inputCount < recipe.required) {
            reset(machine, recipe.cost, `Needs ${recipe.required} ${DoriosLib.text.formatIdentifier(inputTypeId)}`);
            return;
        }

        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== recipe.input) {
            setDynamicString(machine.entity, RECIPE_KEY, recipe.input);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const inputCrafts = Math.floor(inputCount / recipe.required);
        const outputCrafts = Math.floor(getPooledOutputCapacity(
            machine.container,
            OUTPUTS,
            recipe.output,
            getItemMaximum(recipe.output),
        ) / recipe.amount);
        const maxCrafts = Math.min(inputCrafts, outputCrafts);
        if (maxCrafts <= 0) {
            pause(machine, recipe.cost, outputCrafts <= 0 ? "Output Full or Conflicting" : "Needs More Materials");
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: recipe.cost,
            maxCrafts,
            rateMultiplier: recipe.cost / (
                Math.max(Number.EPSILON, settings.machine.rate_speed_base) * recipe.ticks
            ),
        });
        if (result.processCount > 0) {
            consumePooledInput(machine.container, INPUTS, inputTypeId, resourceCost(machine, result.processCount * recipe.required, recipe.required));
            insertPooledOutput(
                machine.container,
                OUTPUTS,
                recipe.output,
                result.processCount * recipe.amount,
            );
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", recipe.cost);
        displayProgress(machine, recipe.cost, PROGRESS_SLOT);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? "Decompacting" : "No Energy", [
            `§r§7Dense Inputs: §f${inputCount} across 3×3`,
            `§r§7Returns: §f${recipe.amount} × ${DoriosLib.text.formatIdentifier(recipe.output)}`,
            `§r§7Compression Level: §f${recipe.level}`,
            `§r§7Cost: §f${EnergyStorage.formatEnergyToText(recipe.cost)}`,
        ]);
    },

    onPlayerBreak: Machine.onDestroy,
});

function selectRecipe(container) {
    const checkedTypes = new Set();
    let partial;
    for (const slot of INPUTS) {
        const input = container.getItem(slot);
        if (!input || checkedTypes.has(input.typeId)) continue;
        checkedTypes.add(input.typeId);

        const recipe = getDecompactorRecipe(input.typeId);
        if (!recipe) continue;
        const inputCount = countPooledInput(container, INPUTS, input.typeId);
        const selected = { inputTypeId: input.typeId, inputCount, recipe };
        if (inputCount >= recipe.required) return selected;
        partial ??= selected;
    }
    return partial;
}

function hasAnyInput(container) {
    return INPUTS.some((slot) => container.getItem(slot));
}

function reset(machine, cost, message) {
    setDynamicString(machine.entity, RECIPE_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pause(machine, cost, message);
}

function pause(machine, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost, PROGRESS_SLOT);
    renderStatus(machine, false, message);
}

function getItemMaximum(typeId) {
    if (itemMaximums.has(typeId)) return itemMaximums.get(typeId);
    let maximum = 0;
    try { maximum = new ItemStack(typeId, 1).maxAmount; } catch {}
    itemMaximums.set(typeId, maximum);
    return maximum;
}

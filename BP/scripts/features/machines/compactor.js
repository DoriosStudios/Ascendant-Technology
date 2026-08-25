// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess, consumePooledInput, countPooledInput, getPooledOutputCapacity, insertPooledOutput } from "../../ATCore/processing/index.js";
import { getCompactorRecipe } from "../../config/recipes/compactor.js";
import { displayProgress, ensureMachineInventoryLayout, renderStatus, setDynamicNumber, setDynamicString, setUiItem } from "./runtime.js";

const ID = "utilitycraft:compactor";
const INVENTORY_SIZE = 31;
const INPUTS = Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11]);
const OUTPUTS = Object.freeze([16, 17, 18, 19, 20, 21, 22, 23, 24]);
const PROGRESS_SLOT = 2;
const RECIPE_KEY = "ascendant:compactor_recipe";
const LAYOUT_KEY = "ascendant:compactor_layout";
const LAYOUT_VERSION = "compactor_4_upgrades_before_output_v1";
// Source maps for the old 14-slot and 29-slot Compactor layouts.
const LEGACY_SLOT_LAYOUT_14 = [0, 1, 2, 3, -1, -1, -1, -1, -1, -1, -1, -1, 6, 7, -1, -1, 5, -1, -1, -1, -1, -1, -1, -1, -1, 8, 9, 10, 11, 12, 13];
const LEGACY_SLOT_LAYOUT_29 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 22, -1, -1, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28];
// Same-size migration from the prior 31-slot layout.
const PREVIOUS_SLOT_LAYOUT_31 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 22, 29, 30, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28];
const itemMaximums = new Map();

registerIOInterface(ID, {
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

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const legacyLayout = machine.container.size >= 29 ? LEGACY_SLOT_LAYOUT_29 : LEGACY_SLOT_LAYOUT_14;
        if (!ensureMachineInventoryLayout(machine, INVENTORY_SIZE, legacyLayout, LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT_31)) return;
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
            machine.container, OUTPUTS, recipe.output, getItemMaximum(recipe.output),
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
            rateMultiplier: recipe.cost / (Math.max(Number.EPSILON, settings.machine.rate_speed_base) * recipe.ticks),
        });
        if (result.processCount > 0) {
            consumePooledInput(machine.container, INPUTS, inputTypeId, result.processCount * recipe.required);
            insertPooledOutput(machine.container, OUTPUTS, recipe.output, result.processCount * recipe.amount);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", recipe.cost);
        displayProgress(machine, recipe.cost, PROGRESS_SLOT);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? "Compacting" : "No Energy", [
            `§r§7Inputs: §f${inputCount} across 3×3`,
            `§r§7Result: §f${DoriosLib.text.formatIdentifier(recipe.output)}`,
            `§r§7Compression Level: §f${recipe.level}`,
            `§r§7Final: §f${DoriosLib.text.formatIdentifier(recipe.final)}`,
            `§r§7Cost: §f${EnergyStorage.formatEnergyToText(recipe.cost)}`,
        ]);
    },

    onPlayerBreak: Machine.onDestroy,
});

function selectRecipe(container) {
    const checkedTypes = new Set();
    for (const slot of INPUTS) {
        const input = container.getItem(slot);
        if (!input || checkedTypes.has(input.typeId)) continue;
        checkedTypes.add(input.typeId);
        const inputCount = countPooledInput(container, INPUTS, input.typeId);
        const recipe = getCompactorRecipe(input.typeId, inputCount);
        // Invalid items and partial stacks must not block an eligible item in
        // a later input slot.
        if (recipe && inputCount >= recipe.required) return { inputTypeId: input.typeId, inputCount, recipe };
    }
    return undefined;
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

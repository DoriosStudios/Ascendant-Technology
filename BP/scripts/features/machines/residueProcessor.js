// @ts-check

import { resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { residueProcessorRecipes } from "../../config/recipes/residueProcessor.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:residue_processor";
const INVENTORY_SIZE = 16;
const SLOT_LAYOUTS = {
    15: [0, 1, 2, 3, 4, 5, 6, -1, 7, 8, 9, 10, 11, 12, 13, 14],
    14: [0, 1, 2, 3, 6, 7, -1, -1, 4, 5, 8, 9, 10, 11, 12, 13],
};
const PREVIOUS_SLOT_LAYOUT = [0, 1, 2, 3, 4, 5, 6, 15, 7, 8, 9, 10, 11, 12, 13, 14];
const LAYOUT_KEY = "ascendant:residue_processor_layout";
const LAYOUT_VERSION = "contiguous_upgrades_v1";
const INPUT_SLOT = 3;
const OUTPUT_SLOT = 8;
const BYPRODUCT_SLOT = 9;
const DEFAULT_STACK_SIZE = 64;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [10, 11, 12, 13, 14, 15],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: [OUTPUT_SLOT, BYPRODUCT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
            { id: "output_2", outputSlots: [BYPRODUCT_SLOT] },
            { id: "output_3", outputSlots: [OUTPUT_SLOT, BYPRODUCT_SLOT] },
        ],
    },
});

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, SLOT_LAYOUTS[machine.container.size] ?? [],
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;

        machine.processIO();

        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            resetProcess(machine, settings.machine.energy_cost, "Insert Residue");
            return;
        }

        const recipe = residueProcessorRecipes[input.typeId];
        if (!recipe) {
            resetProcess(machine, settings.machine.energy_cost, "Invalid Input");
            return;
        }

        const cost = recipe.cost || settings.machine.energy_cost;
        const inputCrafts = Math.floor(input.amount / recipe.required);
        if (inputCrafts <= 0) {
            resetProcess(machine, cost, "Needs More Input");
            return;
        }

        const output = machine.container.getItem(OUTPUT_SLOT);
        const outputCrafts = getCraftCapacity(output, recipe.output, recipe.amount);
        if (outputCrafts <= 0) {
            pauseProcess(machine, cost, output?.typeId === recipe.output ? "Output Full" : "Output Conflict");
            return;
        }

        const byproduct = recipe.byproduct;
        const byproductItem = machine.container.getItem(BYPRODUCT_SLOT);
        const byproductCrafts = byproduct
            ? getCraftCapacity(byproductItem, byproduct.item, byproduct.amount)
            : Number.MAX_SAFE_INTEGER;
        if (byproductCrafts <= 0) {
            pauseProcess(
                machine,
                cost,
                byproductItem?.typeId === byproduct?.item ? "Residue Full" : "Residue Conflict",
            );
            return;
        }

        const maxCrafts = Math.min(inputCrafts, outputCrafts, byproductCrafts);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts,
        });

        if (result.processCount > 0) {
            consumeInput(machine.container, input, resourceCost(machine, result.processCount * recipe.required, recipe.required));
            insertOutput(
                machine.container,
                OUTPUT_SLOT,
                output,
                recipe.output,
                result.processCount * recipe.amount,
            );

            if (byproduct) {
                const rolled = rollByproduct(byproduct.chance, result.processCount);
                if (rolled > 0) {
                    insertOutput(
                        machine.container,
                        BYPRODUCT_SLOT,
                        byproductItem,
                        byproduct.item,
                        rolled * byproduct.amount,
                    );
                }
            }
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Processing Residue" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(input.typeId, recipe) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function resetProcess(machine, cost, message) {
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, cost, message);
}

function pauseProcess(machine, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message);
}

function getCraftCapacity(item, typeId, amountPerCraft) {
    if (!item) return Math.floor(DEFAULT_STACK_SIZE / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function consumeInput(container, item, amount) {
    if (amount >= item.amount) {
        container.setItem(INPUT_SLOT, undefined);
        return;
    }

    item.amount -= amount;
    container.setItem(INPUT_SLOT, item);
}

function insertOutput(container, slot, item, typeId, amount) {
    if (amount <= 0) return;
    if (item) {
        item.amount += amount;
        container.setItem(slot, item);
        return;
    }

    container.setItem(slot, new ItemStack(typeId, amount));
}

function rollByproduct(chance, crafts) {
    if (chance >= 1) return crafts;
    if (chance <= 0) return 0;

    let successes = 0;
    for (let craft = 0; craft < crafts; craft++) {
        if (Math.random() < chance) successes++;
    }
    return successes;
}

function recipeStatusLines(inputTypeId, recipe) {
    const lines = [
        `\u00A7r\u00A77Input: \u00A7f${recipe.required} x ${DoriosLib.text.formatIdentifier(inputTypeId)}`,
        `\u00A7r\u00A77Output: \u00A7f${recipe.amount} x ${DoriosLib.text.formatIdentifier(recipe.output)}`,
    ];

    if (recipe.byproduct) {
        lines.push(
            `\u00A7r\u00A77Residue: \u00A7f${recipe.byproduct.amount} x ${DoriosLib.text.formatIdentifier(recipe.byproduct.item)} (${Math.round(recipe.byproduct.chance * 100)}%)`,
        );
    }
    return lines;
}

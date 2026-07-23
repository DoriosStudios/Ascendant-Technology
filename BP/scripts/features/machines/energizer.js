// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { getEnergizerRecipe } from "../../config/recipes/energizer.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:energizer";
const PRIMARY_INPUT_SLOT = 3;
const AUXILIARY_INPUT_SLOT = 4;
const OUTPUT_SLOT = 5;
const RECIPE_KEY = "ascendant:energizer_recipe";
const itemMaximums = new Map();

registerIOInterface(ID, {
    items: {
        buttonSlots: [10, 11, 12, 13, 14, 15],
        anyInputSlots: [PRIMARY_INPUT_SLOT, AUXILIARY_INPUT_SLOT],
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [PRIMARY_INPUT_SLOT] },
            { id: "input_2", inputSlots: [AUXILIARY_INPUT_SLOT] },
            { id: "input_3", inputSlots: [PRIMARY_INPUT_SLOT, AUXILIARY_INPUT_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([8, 9]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO();

        const channel = selectChannel(machine.container);
        if (!channel.stack) {
            resetProcess(machine, settings.machine.energy_cost, "Insert Material", "");
            return;
        }
        if (!channel.recipe || channel.stack.amount < channel.recipe.input.amount) {
            const message = channel.recipe
                ? `Needs More ${channel.label}`
                : `${channel.label} Input Invalid`;
            resetProcess(machine, channel.recipe?.cost ?? settings.machine.energy_cost, message, "");
            return;
        }

        const recipeKey = `${channel.recipe.id}\u0001${channel.slot}`;
        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== recipeKey) {
            setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const recipe = channel.recipe;
        const cost = recipe.cost ?? settings.machine.energy_cost;
        const outputMaximum = getItemMaximum(recipe.output.id);
        if (outputMaximum <= 0) {
            pauseProcess(machine, cost, "Output Unavailable");
            return;
        }

        const inputCrafts = Math.floor(channel.stack.amount / recipe.input.amount);
        const output = machine.container.getItem(OUTPUT_SLOT);
        const outputCrafts = getOutputCraftCapacity(
            output,
            recipe.output.id,
            recipe.output.amount,
            outputMaximum,
        );
        if (outputCrafts <= 0) {
            pauseProcess(
                machine,
                cost,
                output?.typeId === recipe.output.id ? "Output Full" : "Output Conflict",
            );
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, outputCrafts),
            rateMultiplier: getRecipeRateMultiplier(settings.machine.rate_speed_base, cost, recipe.ticks),
        });

        if (result.processCount > 0) {
            consumeInput(
                machine.container,
                channel.slot,
                channel.stack,
                result.processCount * recipe.input.amount,
            );
            insertOutput(
                machine.container,
                output,
                recipe.output.id,
                result.processCount * recipe.output.amount,
            );
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Energizing" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(channel, recipe) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function selectChannel(container) {
    const primary = container.getItem(PRIMARY_INPUT_SLOT);
    const primaryRecipe = primary ? getEnergizerRecipe(primary.typeId) : undefined;
    if (primaryRecipe && primary.amount >= primaryRecipe.input.amount) {
        return { slot: PRIMARY_INPUT_SLOT, label: "Primary", stack: primary, recipe: primaryRecipe };
    }

    const auxiliary = container.getItem(AUXILIARY_INPUT_SLOT);
    const auxiliaryRecipe = auxiliary ? getEnergizerRecipe(auxiliary.typeId) : undefined;
    if (auxiliaryRecipe && auxiliary.amount >= auxiliaryRecipe.input.amount) {
        return { slot: AUXILIARY_INPUT_SLOT, label: "Auxiliary", stack: auxiliary, recipe: auxiliaryRecipe };
    }

    if (primary) {
        return { slot: PRIMARY_INPUT_SLOT, label: "Primary", stack: primary, recipe: primaryRecipe };
    }
    if (auxiliary) {
        return { slot: AUXILIARY_INPUT_SLOT, label: "Auxiliary", stack: auxiliary, recipe: auxiliaryRecipe };
    }
    return { slot: PRIMARY_INPUT_SLOT, label: "Primary", stack: undefined, recipe: undefined };
}

function getOutputCraftCapacity(item, typeId, amountPerCraft, emptyMaximum) {
    if (!item) return Math.floor(emptyMaximum / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function getRecipeRateMultiplier(baseRate, cost, ticks) {
    return cost / (Math.max(Number.EPSILON, baseRate) * Math.max(1, ticks));
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

function consumeInput(container, slot, item, amount) {
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

function insertOutput(container, item, typeId, amount) {
    if (item) {
        item.amount += amount;
        container.setItem(OUTPUT_SLOT, item);
    } else {
        container.setItem(OUTPUT_SLOT, new ItemStack(typeId, amount));
    }
}

function resetProcess(machine, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, cost, message);
}

function pauseProcess(machine, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    renderStatus(machine, false, message);
}

function recipeStatusLines(channel, recipe) {
    const preferred = recipe.preferredChannel === "auxiliary" ? "Auxiliary" : "Primary";
    return [
        `\u00A7r\u00A77Channel: \u00A7f${channel.label}`,
        `\u00A7r\u00A77Output: \u00A7f${recipe.output.amount} x ${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Cost: \u00A7f${EnergyStorage.formatEnergyToText(recipe.cost)}`,
        `\u00A7r\u00A77Preferred: \u00A7f${preferred}`,
    ];
}

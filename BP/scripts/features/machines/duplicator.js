// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { getDuplicatorRecipe, getDuplicatorRestriction } from "../../ATCore/cloning/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:duplicator";
const INVENTORY_SIZE = 21;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 11, 18, 19,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
];
const INPUT_SLOT = 3;
const LIQUID_DISPLAY_SLOT = 6;
const ORIGINAL_OUTPUT_SLOT = 7;
const COPY_OUTPUT_SLOT = 8;
const LIQUIFIED_AETHERIUM = "liquified_aetherium";
const RECIPE_KEY = "ascendant:duplicator_recipe";
const MACHINE_UPDATES_PER_SECOND = 5;
const FLUID_IO_RATE = 128000;

registerIOInterface(ID, {
    items: {
        buttonSlots: [9, 10, 11, 12, 13, 14],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: [ORIGINAL_OUTPUT_SLOT, COPY_OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: [ORIGINAL_OUTPUT_SLOT] },
            { id: "output_2", outputSlots: [COPY_OUTPUT_SLOT] },
            { id: "output_3", outputSlots: [ORIGINAL_OUTPUT_SLOT, COPY_OUTPUT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [15, 16, 17, 18, 19, 20],
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

            machine.blockSlots([LIQUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const tank = new FluidStorage(machine.entity, 0);
            tank.setType(LIQUIFIED_AETHERIUM);
            tank.display(LIQUID_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });
        const tank = new FluidStorage(machine.entity, 0);
        if (tank.getType() === "empty") tank.setType(LIQUIFIED_AETHERIUM);

        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Insert Template", "");
            return;
        }

        const restriction = getDuplicatorRestriction(input.typeId);
        if (restriction) {
            resetProcess(machine, tank, settings.machine.energy_cost, restriction, "");
            return;
        }

        const recipe = getDuplicatorRecipe(input.typeId);
        if (!recipe) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Invalid Template", "");
            return;
        }

        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== recipe.id) {
            setDynamicString(machine.entity, RECIPE_KEY, recipe.id);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        if (tank.getType() !== LIQUIFIED_AETHERIUM) {
            pauseProcess(machine, tank, recipe.energyCost, "Wrong Liquid");
            return;
        }

        const fluidCrafts = Math.floor(tank.get() / recipe.fluid.amount);
        if (fluidCrafts <= 0) {
            pauseProcess(
                machine,
                tank,
                recipe.energyCost,
                `Needs ${FluidStorage.formatFluid(recipe.fluid.amount)} Liquified Aetherium`,
            );
            return;
        }

        const originalOutput = machine.container.getItem(ORIGINAL_OUTPUT_SLOT);
        const copyOutput = machine.container.getItem(COPY_OUTPUT_SLOT);
        const originalCrafts = getOutputCraftCapacity(originalOutput, input, recipe.input.amount);
        const copyCrafts = getOutputCraftCapacity(copyOutput, input, recipe.output.amount);

        if (originalCrafts <= 0) {
            pauseProcess(
                machine,
                tank,
                recipe.energyCost,
                !originalOutput || originalOutput.isStackableWith(input)
                    ? "Original Output Full"
                    : "Original Output Conflict",
            );
            return;
        }
        if (copyCrafts <= 0) {
            pauseProcess(
                machine,
                tank,
                recipe.energyCost,
                !copyOutput || copyOutput.isStackableWith(input)
                    ? "Copy Output Full"
                    : "Copy Output Conflict",
            );
            return;
        }

        const inputCrafts = Math.floor(input.amount / recipe.input.amount);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: recipe.energyCost,
            maxCrafts: Math.min(inputCrafts, fluidCrafts, originalCrafts, copyCrafts),
            batch: 1,
            rateMultiplier: getRecipeRateMultiplier(
                settings.machine.rate_speed_base,
                recipe.energyCost,
                recipe.timeSeconds,
            ),
        });

        if (result.processCount > 0) {
            const originalTemplate = cloneWithAmount(input, recipe.input.amount);
            const copyTemplate = cloneWithAmount(input, recipe.output.amount);
            consumeInput(machine.container, input, result.processCount * recipe.input.amount);
            tank.consume(result.processCount * recipe.fluid.amount);
            insertClonedOutput(
                machine.container,
                ORIGINAL_OUTPUT_SLOT,
                originalOutput,
                originalTemplate,
                result.processCount,
            );
            insertClonedOutput(
                machine.container,
                COPY_OUTPUT_SLOT,
                copyOutput,
                copyTemplate,
                result.processCount,
            );
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", recipe.energyCost);
        displayProgress(machine, recipe.energyCost);
        if (machine.shouldUpdateUI) tank.display(LIQUID_DISPLAY_SLOT);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Duplicating" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(recipe, tank) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function getOutputCraftCapacity(current, template, amountPerCraft) {
    if (!current) return Math.floor(template.maxAmount / amountPerCraft);
    if (!current.isStackableWith(template)) return 0;
    return Math.floor(Math.max(0, current.maxAmount - current.amount) / amountPerCraft);
}

function cloneWithAmount(stack, amount) {
    const result = stack.clone();
    result.amount = amount;
    return result;
}

function consumeInput(container, input, amount) {
    if (amount >= input.amount) container.setItem(INPUT_SLOT, undefined);
    else {
        input.amount -= amount;
        container.setItem(INPUT_SLOT, input);
    }
}

function insertClonedOutput(container, slot, current, template, crafts) {
    const amount = template.amount * crafts;
    if (current) {
        current.amount += amount;
        container.setItem(slot, current);
        return;
    }

    const output = template.clone();
    output.amount = amount;
    container.setItem(slot, output);
}

function getRecipeRateMultiplier(baseRate, cost, timeSeconds) {
    const updates = Math.max(1, Math.round(timeSeconds * MACHINE_UPDATES_PER_SECOND));
    return cost / (Math.max(Number.EPSILON, baseRate) * updates);
}

function resetProcess(machine, tank, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, tank, cost, message);
}

function pauseProcess(machine, tank, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) tank.display(LIQUID_DISPLAY_SLOT);
    renderStatus(machine, false, message);
}

function recipeStatusLines(recipe, tank) {
    const rarity = DoriosLib.text.capitalizeFirst(recipe.rarity);
    return [
        `\u00A7r\u00A77Template: \u00A7f${DoriosLib.text.formatIdentifier(recipe.input.id)}`,
        `\u00A7r\u00A77Rarity: ${rarityColor(recipe.rarity)}${rarity}${recipe.declared ? "" : " (Fallback)"}`,
        `\u00A7r\u00A77Time: \u00A7f${formatDuration(recipe.timeSeconds)}`,
        `\u00A7r\u00A77Cost: \u00A7f${EnergyStorage.formatEnergyToText(recipe.energyCost)}`,
        `\u00A7r\u00A77Aetherium: \u00A7f${FluidStorage.formatFluid(recipe.fluid.amount)}`,
        `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(tank.get())}`,
    ];
}

function rarityColor(rarity) {
    return {
        uncommon: "\u00A7a",
        rare: "\u00A7b",
        epic: "\u00A75",
        legendary: "\u00A76",
        mythic: "\u00A7d",
        transcendent: "\u00A7c",
    }[rarity] ?? "\u00A7f";
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
}

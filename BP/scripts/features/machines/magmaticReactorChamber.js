// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { getMagmaticReactorChamberRecipe } from "../../config/recipes/magmaticReactorChamber.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:magmatic_reactor_chamber";
const INPUT_SLOTS = [3, 4, 5, 6, 7, 8];
const OUTPUT_SLOT = 9;
const LAVA_DISPLAY_SLOT = 10;
const RECIPE_KEY = "ascendant:magmatic_reactor_recipe";
const FLUID_IO_RATE = 128000;
const DEFAULT_STACK_SIZE = 64;

registerIOInterface(ID, {
    items: {
        buttonSlots: [13, 14, 15, 16, 17, 18],
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [19, 20, 21, 22, 23, 24],
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

            machine.blockSlots([LAVA_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const lava = new FluidStorage(machine.entity, 0);
            if (lava.getType() === "empty" || lava.get() <= 0) lava.setType("lava");
            lava.display(LAVA_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const lava = new FluidStorage(machine.entity, 0);
        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });

        const storedFluid = lava.getType();
        if (storedFluid !== "empty" && storedFluid !== "lava" && lava.get() > 0) {
            pauseProcess(machine, lava, settings.machine.energy_cost, "Drain Invalid Liquid");
            return;
        }
        if (storedFluid !== "lava") lava.setType("lava");

        const selection = selectRecipe(machine.container);
        if (!selection.candidate) {
            const message = selection.hasKnownInput
                ? "Needs More Input"
                : selection.hasAnyInput
                    ? "Invalid Input"
                    : "Insert Process Item";
            resetProcess(machine, lava, settings.machine.energy_cost, message, "");
            return;
        }

        const { slot, stack, recipe } = selection.candidate;
        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== stack.typeId) {
            setDynamicString(machine.entity, RECIPE_KEY, stack.typeId);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const cost = recipe.energyCost || settings.machine.energy_cost;
        const inputCrafts = Math.floor(stack.amount / recipe.input.amount);
        const outputItem = machine.container.getItem(OUTPUT_SLOT);
        const outputCrafts = getOutputCraftCapacity(
            outputItem,
            recipe.output.id,
            recipe.output.amount,
        );
        if (outputCrafts <= 0) {
            pauseProcess(
                machine,
                lava,
                cost,
                outputItem?.typeId === recipe.output.id ? "Output Full" : "Output Conflict",
            );
            return;
        }

        const lavaCrafts = Math.floor(lava.getFreeSpace() / recipe.lavaGain);
        if (lavaCrafts <= 0) {
            pauseProcess(machine, lava, cost, "Lava Tank Full");
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, outputCrafts, lavaCrafts),
        });

        if (result.processCount > 0) {
            consumeInput(
                machine.container,
                slot,
                stack,
                result.processCount * recipe.input.amount,
            );
            insertOutput(
                machine.container,
                outputItem,
                recipe.output.id,
                result.processCount * recipe.output.amount,
            );
            lava.add(result.processCount * recipe.lavaGain);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        display(machine, lava, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Reactor Running" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(stack.typeId, recipe, lava) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function selectRecipe(container) {
    let hasAnyInput = false;
    let hasKnownInput = false;

    for (let index = 0; index < INPUT_SLOTS.length; index++) {
        const slot = INPUT_SLOTS[index];
        const stack = container.getItem(slot);
        if (!stack) continue;

        hasAnyInput = true;
        const recipe = getMagmaticReactorChamberRecipe(stack.typeId);
        if (!recipe) continue;

        hasKnownInput = true;
        if (stack.amount < recipe.input.amount) continue;
        return { candidate: { slot, stack, recipe }, hasAnyInput, hasKnownInput };
    }

    return { candidate: undefined, hasAnyInput, hasKnownInput };
}

function getOutputCraftCapacity(item, typeId, amountPerCraft) {
    if (!item) return Math.floor(DEFAULT_STACK_SIZE / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function consumeInput(container, slot, item, amount) {
    if (amount >= item.amount) {
        container.setItem(slot, undefined);
        return;
    }

    item.amount -= amount;
    container.setItem(slot, item);
}

function insertOutput(container, item, typeId, amount) {
    if (item) {
        item.amount += amount;
        container.setItem(OUTPUT_SLOT, item);
        return;
    }

    container.setItem(OUTPUT_SLOT, new ItemStack(typeId, amount));
}

function resetProcess(machine, lava, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, lava, cost, message);
}

function pauseProcess(machine, lava, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    display(machine, lava, cost);
    renderStatus(machine, false, message);
}

function display(machine, lava, cost) {
    if (!machine.shouldUpdateUI) return;
    displayProgress(machine, cost);
    lava.display(LAVA_DISPLAY_SLOT);
}

function recipeStatusLines(inputTypeId, recipe, lava) {
    return [
        `\u00A7r\u00A77Input: \u00A7f${recipe.input.amount} x ${DoriosLib.text.formatIdentifier(inputTypeId)}`,
        `\u00A7r\u00A77Output: \u00A7f${recipe.output.amount} x ${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Lava: \u00A7f+${FluidStorage.formatFluid(recipe.lavaGain)}`,
        `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
    ];
}

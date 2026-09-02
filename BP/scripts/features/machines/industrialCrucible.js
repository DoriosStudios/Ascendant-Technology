// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess, getPooledOutputCapacity, insertPooledOutput } from "../../ATCore/processing/index.js";
import { getIndustrialCrucibleRecipe } from "../../config/recipes/industrialCrucible.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:industrial_crucible";
const INVENTORY_SIZE = 32;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
    11, 12, -1, -1, 9, -1, -1, -1, -1, -1,
    13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19,
    9, 10, 11, 12, 13, 14,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
];
const LAYOUT_KEY = "ascendant:industrial_crucible_layout";
const LAYOUT_VERSION = "output_last_v2";
const INPUT_SLOTS = [3, 4, 5, 6, 7, 8];
const LAVA_DISPLAY_SLOT = 9;
const OUTPUT_SLOTS = [14, 15, 16, 17, 18, 19];
const RECIPE_KEY = "ascendant:industrial_crucible_recipe";
const FLUID_IO_RATE = 128000;
const DEFAULT_STACK_SIZE = 64;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [20, 21, 22, 23, 24, 25],
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
    liquids: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
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
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
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
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, LEGACY_SLOT_LAYOUT,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;

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
        const outputCrafts = Math.floor(getPooledOutputCapacity(
            machine.container,
            OUTPUT_SLOTS,
            recipe.output.id,
            DEFAULT_STACK_SIZE,
        ) / recipe.output.amount);
        if (outputCrafts <= 0) {
            pauseProcess(
                machine,
                lava,
                cost,
                "Output Full",
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
            insertPooledOutput(machine.container, OUTPUT_SLOTS, recipe.output.id, result.processCount * recipe.output.amount);
            lava.add(result.processCount * recipe.lavaGain);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        display(machine, lava, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Crucible Running" : "No Energy",
            machine.shouldUpdateUI ? [{ title: "Crucible Information", lines: recipeStatusLines(stack.typeId, recipe, lava) }] : undefined,
            { energyCost: cost },
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
        const recipe = getIndustrialCrucibleRecipe(stack.typeId);
        if (!recipe) continue;

        hasKnownInput = true;
        if (stack.amount < recipe.input.amount) continue;
        return { candidate: { slot, stack, recipe }, hasAnyInput, hasKnownInput };
    }

    return { candidate: undefined, hasAnyInput, hasKnownInput };
}

function consumeInput(container, slot, item, amount) {
    if (amount >= item.amount) {
        container.setItem(slot, undefined);
        return;
    }

    item.amount -= amount;
    container.setItem(slot, item);
}

function resetProcess(machine, lava, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, lava, cost, message);
}

function pauseProcess(machine, lava, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    display(machine, lava, cost);
    renderStatus(machine, false, message, [{
        title: "Crucible Information",
        lines: [`\u00A7r\u00A77Lava Stored \u00A7f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`],
    }], { energyCost: cost });
}

function display(machine, lava, cost) {
    if (!machine.shouldUpdateUI) return;
    displayProgress(machine, cost);
    lava.display(LAVA_DISPLAY_SLOT);
}

function recipeStatusLines(inputTypeId, recipe, lava) {
    return [
        `\u00A7r\u00A77Input \u00A7f${recipe.input.amount} x ${DoriosLib.text.formatIdentifier(inputTypeId)}`,
        `\u00A7r\u00A77Output \u00A7f${recipe.output.amount} x ${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Lava Gain \u00A7f+${FluidStorage.formatFluid(recipe.lavaGain)}`,
        `\u00A7r\u00A77Stored \u00A7f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
    ];
}

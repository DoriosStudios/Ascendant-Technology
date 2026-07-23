// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { getCryoStabilizerRecipe } from "../../config/recipes/cryoStabilizer.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:cryo_stabilizer";
const INPUT_SLOT = 3;
const OUTPUT_SLOT = 4;
const CONTAINER_INPUT_SLOT = 5;
const CONTAINER_RETURN_SLOT = 6;
const CRYOFLUID_DISPLAY_SLOT = 7;
const GUIDE_SLOT = 8;
const RECIPE_KEY = "ascendant:cryo_stabilizer_recipe";
const RESOURCE_IO_RATE = 64000;
const itemMaximums = new Map();

registerIOInterface(ID, {
    items: {
        buttonSlots: [11, 12, 13, 14, 15, 16],
        anyInputSlots: [INPUT_SLOT, CONTAINER_INPUT_SLOT],
        anyOutputSlots: [OUTPUT_SLOT, CONTAINER_RETURN_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "input_2", inputSlots: [CONTAINER_INPUT_SLOT] },
            { id: "input_3", inputSlots: [INPUT_SLOT, CONTAINER_INPUT_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
            { id: "output_2", outputSlots: [CONTAINER_RETURN_SLOT] },
            { id: "output_3", outputSlots: [OUTPUT_SLOT, CONTAINER_RETURN_SLOT] },
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
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([CRYOFLUID_DISPLAY_SLOT, GUIDE_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(
                machine.container,
                GUIDE_SLOT,
                "utilitycraft:arrow_indicator_90",
                "\u00A7rCryo Stabilizer\n\u00A77Unstable item + Cryofluid -> stabilized result",
            );
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const cryofluid = new FluidStorage(machine.entity, 0);
            cryofluid.setType("cryofluid");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const cryofluid = new FluidStorage(machine.entity, 0);
        if (cryofluid.getType() === "empty") cryofluid.setType("cryofluid");

        machine.processIO({ maxFluidMovedPerTick: RESOURCE_IO_RATE });
        processCryofluidContainer(machine.container, cryofluid);

        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            resetProcess(machine, cryofluid, settings.machine.energy_cost, "Insert Unstable Item", "");
            return;
        }

        const recipe = getCryoStabilizerRecipe(input.typeId);
        if (!recipe || input.amount < recipe.input.amount) {
            resetProcess(
                machine,
                cryofluid,
                recipe?.cost ?? settings.machine.energy_cost,
                recipe ? "Needs More Input" : "Invalid Input",
                "",
            );
            return;
        }

        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== recipe.id) {
            setDynamicString(machine.entity, RECIPE_KEY, recipe.id);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        const outputMaximum = getItemMaximum(recipe.output.id);
        if (outputMaximum <= 0) {
            pauseProcess(machine, cryofluid, cost, "Output Unavailable", recipe);
            return;
        }

        const output = machine.container.getItem(OUTPUT_SLOT);
        const inputCrafts = Math.floor(input.amount / recipe.input.amount);
        const fluidCrafts = recipe.cryofluid > 0
            ? Math.floor(cryofluid.get() / recipe.cryofluid)
            : Number.MAX_SAFE_INTEGER;
        const outputCrafts = getOutputCraftCapacity(
            output,
            recipe.output.id,
            recipe.output.amount,
            outputMaximum,
        );

        if (fluidCrafts <= 0 || outputCrafts <= 0) {
            const message = fluidCrafts <= 0
                ? "Needs Cryofluid"
                : output?.typeId === recipe.output.id ? "Output Full" : "Output Conflict";
            pauseProcess(machine, cryofluid, cost, message, recipe);
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, fluidCrafts, outputCrafts),
            rateMultiplier: getRecipeRateMultiplier(settings.machine.rate_speed_base, cost, recipe.ticks),
        });

        if (result.processCount > 0) {
            consumeInput(
                machine.container,
                input,
                result.processCount * recipe.input.amount,
            );
            cryofluid.consume(result.processCount * recipe.cryofluid);
            insertOutput(
                machine.container,
                output,
                recipe.output.id,
                result.processCount * recipe.output.amount,
            );
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayResources(machine, cryofluid, cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Stabilizing" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(recipe, cryofluid) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function processCryofluidContainer(container, cryofluid) {
    const input = container.getItem(CONTAINER_INPUT_SLOT);
    if (!input) return false;

    const definition = FluidStorage.getContainerData(input.typeId);
    if (!definition || definition.type !== "cryofluid") return false;

    const resultType = definition.output ?? (definition.infinite ? input.typeId : undefined);
    if (resultType && !canInsertItem(container, CONTAINER_RETURN_SLOT, resultType)) return false;

    const result = cryofluid.fluidItem(input.typeId);
    if (result === false) return false;

    consumeOne(container, CONTAINER_INPUT_SLOT, input);
    if (result) insertOne(container, CONTAINER_RETURN_SLOT, result);
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

function getOutputCraftCapacity(item, typeId, amountPerCraft, emptyMaximum) {
    if (!item) return Math.floor(emptyMaximum / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function getRecipeRateMultiplier(baseRate, cost, ticks) {
    return cost / (Math.max(Number.EPSILON, baseRate) * Math.max(1, ticks));
}

function consumeInput(container, item, amount) {
    if (amount >= item.amount) container.setItem(INPUT_SLOT, undefined);
    else {
        item.amount -= amount;
        container.setItem(INPUT_SLOT, item);
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

function resetProcess(machine, cryofluid, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, cryofluid, cost, message);
}

function pauseProcess(machine, cryofluid, cost, message, recipe) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayResources(machine, cryofluid, cost);
    renderStatus(
        machine,
        false,
        message,
        machine.shouldUpdateUI && recipe ? recipeStatusLines(recipe, cryofluid) : undefined,
    );
}

function displayResources(machine, cryofluid, cost) {
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
}

function recipeStatusLines(recipe, cryofluid) {
    return [
        `\u00A7r\u00A77Output: \u00A7f${recipe.output.amount} x ${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Cryofluid Cost: \u00A7f${FluidStorage.formatFluid(recipe.cryofluid)}`,
        `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(cryofluid.get())} / ${FluidStorage.formatFluid(cryofluid.getCap())}`,
        `\u00A7r\u00A77Energy Cost: \u00A7f${EnergyStorage.formatEnergyToText(recipe.cost)}`,
    ];
}

// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { liquifierRecipes } from "../../config/recipes/liquifier.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:liquifier";
const INPUT_SLOT = 3;
const LIQUID_DISPLAY_SLOT = 4;
const BYPRODUCT_SLOT = 5;
const RECIPE_KEY = "ascendant:liquifier_recipe";
const DEFAULT_STACK_SIZE = 64;
const FLUID_IO_RATE = 128000;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [8, 9, 10, 11, 12, 13],
        anyInputSlots: [INPUT_SLOT],
        anyOutputSlots: [BYPRODUCT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "output_1", outputSlots: [BYPRODUCT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [14, 15, 16, 17, 18, 19],
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

            machine.blockSlots([LIQUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const tank = new FluidStorage(machine.entity, 0);
            tank.display(LIQUID_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });

        const tank = new FluidStorage(machine.entity, 0);

        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Insert Item", "");
            return;
        }

        const recipe = liquifierRecipes[input.typeId];
        if (!recipe) {
            resetProcess(machine, tank, settings.machine.energy_cost, "Invalid Input", "");
            return;
        }

        const previousRecipe = machine.entity.getDynamicProperty(RECIPE_KEY);
        if (previousRecipe !== input.typeId) {
            setDynamicString(machine.entity, RECIPE_KEY, input.typeId);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const cost = recipe.cost || settings.machine.energy_cost;
        const inputCrafts = Math.floor(input.amount / recipe.required);
        if (inputCrafts <= 0) {
            resetProcess(machine, tank, cost, "Needs More Input", input.typeId);
            return;
        }

        const tankType = tank.getType();
        if (tankType !== "empty" && tankType !== recipe.liquid) {
            pauseProcess(machine, tank, cost, `Tank Contains ${DoriosLib.text.formatIdentifier(tankType)}`);
            return;
        }

        const fluidCrafts = Math.floor(tank.getFreeSpace() / recipe.amount);
        if (fluidCrafts <= 0) {
            pauseProcess(machine, tank, cost, "Liquid Tank Full");
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
                tank,
                cost,
                byproductItem?.typeId === byproduct?.item ? "Residue Full" : "Residue Conflict",
            );
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            maxCrafts: Math.min(inputCrafts, fluidCrafts, byproductCrafts),
            rateMultiplier: getRecipeRateMultiplier(settings.machine.rate_speed_base, cost, recipe.ticks),
        });

        if (result.processCount > 0) {
            consumeInput(machine.container, input, result.processCount * recipe.required);
            if (tank.getType() === "empty") tank.setType(recipe.liquid);
            tank.add(result.processCount * recipe.amount);

            if (byproduct) {
                const rolled = rollByproduct(byproduct.chance, result.processCount);
                if (rolled > 0) {
                    insertOutput(
                        machine.container,
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
        tank.display(LIQUID_DISPLAY_SLOT);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Liquifying" : "No Energy",
            machine.shouldUpdateUI ? recipeStatusLines(input.typeId, recipe, tank) : undefined,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function resetProcess(machine, tank, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, tank, cost, message);
}

function pauseProcess(machine, tank, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    tank.display(LIQUID_DISPLAY_SLOT);
    renderStatus(machine, false, message);
}

function getCraftCapacity(item, typeId, amountPerCraft) {
    if (!item) return Math.floor(DEFAULT_STACK_SIZE / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function getRecipeRateMultiplier(configuredBaseRate, cost, ticks) {
    const baseRate = Math.max(Number.EPSILON, configuredBaseRate);
    return cost / (Math.max(1, ticks) * baseRate);
}

function consumeInput(container, item, amount) {
    if (amount >= item.amount) {
        container.setItem(INPUT_SLOT, undefined);
        return;
    }

    item.amount -= amount;
    container.setItem(INPUT_SLOT, item);
}

function insertOutput(container, item, typeId, amount) {
    if (amount <= 0) return;
    if (item) {
        item.amount += amount;
        container.setItem(BYPRODUCT_SLOT, item);
        return;
    }

    container.setItem(BYPRODUCT_SLOT, new ItemStack(typeId, amount));
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

function recipeStatusLines(inputTypeId, recipe, tank) {
    const lines = [
        `\u00A7r\u00A77Input: \u00A7f${recipe.required} x ${DoriosLib.text.formatIdentifier(inputTypeId)}`,
        `\u00A7r\u00A77Liquid: \u00A7f${FluidStorage.formatFluid(recipe.amount)} ${DoriosLib.text.formatIdentifier(recipe.liquid)}`,
        `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(tank.get())} / ${FluidStorage.formatFluid(tank.getCap())}`,
    ];

    if (recipe.byproduct) {
        lines.push(
            `\u00A7r\u00A77Residue: \u00A7f${recipe.byproduct.amount} x ${DoriosLib.text.formatIdentifier(recipe.byproduct.item)} (${Math.round(recipe.byproduct.chance * 100)}%)`,
        );
    }
    return lines;
}

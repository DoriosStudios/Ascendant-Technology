// @ts-check

import { ItemStack } from "@minecraft/server";
import { advanceLanes } from "./processEngine.js";

const itemMaximums = new Map();

/**
 * Processes an in-place cooling grid with direct recipe lookup and one shared
 * energy write. Each occupied slot is one independent atomic stack lane.
 */
export function processCryoCoolingGrid(machine, tank, options) {
    const lanes = [];
    let availableFluid = tank.get();
    const tankType = tank.getType();
    let idleCount = 0;
    let blockedCount = 0;
    let readyCount = 0;

    for (let index = 0; index < options.slots.length; index++) {
        const slot = options.slots[index];
        const progressKey = `${options.progressPrefix}${slot}`;
        const item = machine.container.getItem(slot);

        if (!item) {
            setDynamicNumber(machine.entity, progressKey, 0);
            idleCount++;
            continue;
        }

        const recipe = options.getRecipe(item.typeId);
        if (!recipe) {
            setDynamicNumber(machine.entity, progressKey, 0);
            if (options.isOutput(item.typeId)) readyCount++;
            else blockedCount++;
            continue;
        }

        const inputAmount = Math.max(1, recipe.input.amount);
        if (item.amount % inputAmount !== 0) {
            blockedCount++;
            continue;
        }

        const crafts = Math.floor(item.amount / inputAmount);
        const outputAmount = crafts * recipe.output.amount;
        if (crafts <= 0 || outputAmount > getItemMaximum(recipe.output.id)) {
            blockedCount++;
            continue;
        }

        const fluidAmount = (recipe.fluid?.amount ?? 0) * crafts;
        if (fluidAmount > 0) {
            if ((tankType !== "empty" && tankType !== recipe.fluid.type) || availableFluid < fluidAmount) {
                blockedCount++;
                continue;
            }
            availableFluid -= fluidAmount;
        }

        lanes.push({
            slot,
            recipe,
            outputAmount,
            fluidAmount,
            progressKey,
            progress: getDynamicNumber(machine.entity, progressKey),
            cost: recipe.cost * crafts,
            maxCrafts: 1,
            batch: 1,
        });
    }

    const energyUsed = advanceLanes(machine, lanes);
    let completedCount = 0;
    for (let index = 0; index < lanes.length; index++) {
        const lane = lanes[index];
        if (lane.processCount > 0) {
            machine.container.setItem(
                lane.slot,
                new ItemStack(lane.recipe.output.id, lane.outputAmount),
            );
            if (lane.fluidAmount > 0) tank.consume(lane.fluidAmount);
            completedCount++;
        }
        setDynamicNumber(machine.entity, lane.progressKey, lane.progress);
    }

    return {
        running: energyUsed > 0 || completedCount > 0,
        activeCount: lanes.length,
        idleCount,
        blockedCount,
        readyCount,
        completedCount,
        energyUsed,
    };
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

function getDynamicNumber(entity, key) {
    return Math.max(0, Number(entity.getDynamicProperty(key)) || 0);
}

function setDynamicNumber(entity, key, value) {
    const normalized = Math.max(0, Number(value) || 0);
    if (entity.getDynamicProperty(key) === normalized) return;
    entity.setDynamicProperty(key, normalized);
}

// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceLanes,
    furnaceRecipes,
    getPooledOutputCapacity,
} from "../../ATCore/processing/index.js";
import { displayProgress, renderStatus, setDynamicNumber, setUiItem } from "./runtime.js";

const ID = "utilitycraft:industrial_burner";
const INPUTS = Object.freeze([3, 4, 5]);
const OUTPUTS = Object.freeze([11, 12, 13]);
const PROGRESS_SLOTS = Object.freeze([14, 15, 16]);
const LAVA_PER_BONUS_CRAFT = 250;

registerIOInterface(ID, {
    items: {
        buttonSlots: [20, 21, 22, 23, 24, 25],
        anyInputSlots: INPUTS,
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [3] },
            { id: "input_2", inputSlots: [4] },
            { id: "input_3", inputSlots: [5] },
            { id: "input_4", inputSlots: INPUTS },
            { id: "output_1", outputSlots: [11] },
            { id: "output_2", outputSlots: [12] },
            { id: "output_3", outputSlots: [13] },
            { id: "output_4", outputSlots: OUTPUTS },
        ],
    },
    liquids: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "fuel", inputIndices: [0] },
        ],
    },
});

function createLane(machine, laneIndex, settings, lavaCraftBudget) {
    const inputSlot = INPUTS[laneIndex];
    const outputSlot = OUTPUTS[laneIndex];
    const input = machine.container.getItem(inputSlot);
    const recipe = input ? furnaceRecipes[input.typeId] : undefined;
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));

    if (!input || !recipe) {
        return {
            laneIndex, inputSlot, outputSlot, input, recipe,
            progress: 0, cost: settings.machine.energy_cost,
            batch, maxCrafts: 0, baseCrafts: 0,
        };
    }

    const byInput = Math.floor(input.amount / recipe.required);
    const byOutput = Math.floor(getPooledOutputCapacity(
        machine.container, [outputSlot], recipe.output, recipe.outputMaxAmount,
    ) / recipe.amount);
    const possible = Math.min(byInput, byOutput);
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const baseCrafts = batch * intervalScale;
    const bonusCrafts = Math.min(baseCrafts, lavaCraftBudget, Math.max(0, possible - baseCrafts));
    return {
        laneIndex, inputSlot, outputSlot, input, recipe,
        progress: machine.getProgress(laneIndex),
        cost: recipe.cost ?? settings.machine.energy_cost,
        batch,
        maxCrafts: Math.min(possible, baseCrafts + bonusCrafts),
        baseCrafts,
    };
}

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            machine.blockSlots([2, 9, 18, 19]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 10, "utilitycraft:lava_00");
            for (let index = 0; index < PROGRESS_SLOTS.length; index++) {
                setUiItem(machine.container, PROGRESS_SLOTS[index], "utilitycraft:progress_right_big_bar_00");
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
            }
            const lava = new FluidStorage(machine.entity, 0);
            lava.setType("lava");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const lava = new FluidStorage(machine.entity, 0);
        if (lava.getType() === "empty") lava.setType("lava");
        machine.processIO();

        let lavaCraftBudget = lava.getType() === "lava"
            ? Math.floor(lava.get() / LAVA_PER_BONUS_CRAFT)
            : 0;
        const lanes = new Array(INPUTS.length);
        for (let index = 0; index < lanes.length; index++) {
            const lane = createLane(machine, index, settings, lavaCraftBudget);
            lanes[index] = lane;
            const reserved = Math.max(0, lane.maxCrafts - lane.baseCrafts);
            lavaCraftBudget = Math.max(0, lavaCraftBudget - reserved);
        }

        const energyUsed = advanceLanes(machine, lanes);
        let crafted = 0;
        let lavaUsed = 0;
        let readyLanes = 0;

        for (let index = 0; index < lanes.length; index++) {
            const lane = lanes[index];
            if (lane.maxCrafts > 0) readyLanes++;
            if (lane.processCount > 0 && lane.input && lane.recipe) {
                const inputAmount = lane.processCount * lane.recipe.required;
                const outputAmount = lane.processCount * lane.recipe.amount;
                if (inputAmount >= lane.input.amount) machine.container.setItem(lane.inputSlot, undefined);
                else {
                    lane.input.amount -= inputAmount;
                    machine.container.setItem(lane.inputSlot, lane.input);
                }

                const output = machine.container.getItem(lane.outputSlot);
                if (output) {
                    output.amount += outputAmount;
                    machine.container.setItem(lane.outputSlot, output);
                } else {
                    DoriosLib.entity.setNewItem(machine.entity, {
                        slot: lane.outputSlot,
                        typeId: lane.recipe.output,
                        amount: outputAmount,
                    });
                }

                crafted += lane.processCount;
                lavaUsed += Math.max(0, lane.processCount - lane.baseCrafts) * LAVA_PER_BONUS_CRAFT;
            }

            setDynamicNumber(machine.entity, `dorios:progress_${index}`, lane.progress);
            setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, lane.cost);
            displayProgress(machine, lane.cost, PROGRESS_SLOTS[index], index);
        }

        if (lavaUsed > 0) lava.consume(lavaUsed);
        if (machine.shouldUpdateUI) lava.display(10);
        renderStatus(machine, energyUsed > 0 || crafted > 0, readyLanes > 0 ? "Running" : "Insert Items", [
            `§r§7Active lanes: ${readyLanes}/3`,
            `§r§7Smelted: ${crafted}`,
        ]);
    },

    onPlayerBreak: Machine.onDestroy,
});

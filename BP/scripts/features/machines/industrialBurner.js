// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceLanes,
    furnaceRecipes,
    getPooledOutputCapacity,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:industrial_burner";
const INVENTORY_SIZE = 31;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4,
    8, 9, 10, 11, 12, 13, 14, 15,
    5, -1, 6, -1, 7, -1,
    16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 11, 12, 13, 14, 15, 16, 17, 18,
    5, 6, 7, 8, 9, 10,
    19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
];
const LAYOUT_KEY = "ascendant:industrial_burner_layout";
const LAYOUT_VERSION = "output_last_v2";
const INPUTS = Object.freeze([2, 3, 4]);
const PROGRESS_SLOTS = Object.freeze([5, 6, 7]);
const LAVA_DISPLAY_SLOT = 8;
const OUTPUTS = Object.freeze([[13, 14], [15, 16], [17, 18]]);
const ALL_OUTPUTS = Object.freeze(OUTPUTS.flat());
const LAVA_PER_BONUS_CRAFT = 250;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [19, 20, 21, 22, 23, 24],
        anyInputSlots: INPUTS,
        anyOutputSlots: ALL_OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [2] },
            { id: "input_2", inputSlots: [3] },
            { id: "input_3", inputSlots: [4] },
            { id: "input_4", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS[0] },
            { id: "output_2", outputSlots: OUTPUTS[1] },
            { id: "output_3", outputSlots: OUTPUTS[2] },
            { id: "output_4", outputSlots: ALL_OUTPUTS },
        ],
    },
    liquids: {
        buttonSlots: [25, 26, 27, 28, 29, 30],
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
    const outputSlots = OUTPUTS[laneIndex];
    const input = machine.container.getItem(inputSlot);
    const recipe = input ? furnaceRecipes[input.typeId] : undefined;
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));

    if (!input || !recipe) {
        return {
            laneIndex, inputSlot, outputSlots, input, recipe,
            progress: 0, cost: settings.machine.energy_cost,
            batch, maxCrafts: 0, baseCrafts: 0,
        };
    }

    const byInput = Math.floor(input.amount / recipe.required);
    const byOutput = Math.floor(getPooledOutputCapacity(
        machine.container, outputSlots, recipe.output, recipe.outputMaxAmount,
    ) / recipe.amount);
    const possible = Math.min(byInput, byOutput);
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const baseCrafts = batch * intervalScale;
    const bonusCrafts = Math.min(baseCrafts, lavaCraftBudget, Math.max(0, possible - baseCrafts));
    return {
        laneIndex, inputSlot, outputSlots, input, recipe,
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
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setUiItem(machine.container, LAVA_DISPLAY_SLOT, "utilitycraft:lava_00");
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
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, LEGACY_SLOT_LAYOUT,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;
        const lava = new FluidStorage(machine.entity, 0);
        if (lava.getType() === "empty") lava.setType("lava");
        machine.processIO();

        const lavaBoostActive = lava.getType() === "lava" && lava.get() > 0;
        let lavaCraftBudget = lavaBoostActive
            ? Math.floor(lava.get() / LAVA_PER_BONUS_CRAFT)
            : 0;
        const lanes = new Array(INPUTS.length);
        for (let index = 0; index < lanes.length; index++) {
            const lane = createLane(machine, index, settings, lavaCraftBudget);
            lanes[index] = lane;
            const reserved = Math.max(0, lane.maxCrafts - lane.baseCrafts);
            lavaCraftBudget = Math.max(0, lavaCraftBudget - reserved);
        }

        const energyUsed = advanceLanes(machine, lanes, {
            rateMultiplier: lavaBoostActive ? 1.5 : 1,
        });
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

                insertPooledOutput(machine.container, lane.outputSlots, lane.recipe.output, outputAmount);

                crafted += lane.processCount;
                lavaUsed += Math.max(0, lane.processCount - lane.baseCrafts) * LAVA_PER_BONUS_CRAFT;
            }

            setDynamicNumber(machine.entity, `dorios:progress_${index}`, lane.progress);
            setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, lane.cost);
            displayProgress(machine, lane.cost, PROGRESS_SLOTS[index], index);
        }

        if (lavaUsed > 0) lava.consume(lavaUsed);
        if (machine.shouldUpdateUI) lava.display(LAVA_DISPLAY_SLOT);
        renderStatus(machine, energyUsed > 0 || crafted > 0, readyLanes > 0 ? "Running" : "Insert Items", [{
            title: "Incinerator Information",
            lines: [
                `§r§7Active Lanes §f${readyLanes}/3`,
                `§r§7Smelted §f${crafted}`,
                `§r§7Lava Rate Boost §f${lavaBoostActive ? "Active (+50%)" : "Inactive"}`,
                `§r§7Lava Stored §f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
            ],
        }], {
            energyCost: Math.max(settings.machine.energy_cost, ...lanes.map((lane) => lane.cost)),
            rateMultiplier: lavaBoostActive ? 1.5 : 1,
        });
    },

    onPlayerBreak: Machine.onDestroy,
});

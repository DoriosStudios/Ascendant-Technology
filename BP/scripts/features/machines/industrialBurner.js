// @ts-check

import { resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage } from "DoriosCore/index.js";
import { liquidFuels } from "../../config/resources/liquidFuels.js";
import { registerIOInterface } from "../../ATCore/machinery/ioRegistration.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
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
const FUEL_DISPLAY_SLOT = 8;
const OUTPUTS = Object.freeze([[13, 14], [15, 16], [17, 18]]);
const ALL_OUTPUTS = Object.freeze(OUTPUTS.flat());

FluidStorage.registerInputFilter(ID, (type, index) => index === 0 && !!liquidFuels[type]);

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
            { id: "output_1", outputIndices: [0] },
        ],
    },
});

function createLane(machine, laneIndex, settings, fuelCraftBudget) {
    const inputSlot = INPUTS[laneIndex];
    const outputSlots = OUTPUTS[laneIndex];
    const input = machine.container.getItem(inputSlot);
    const signatureKey = `ascendant:parallel_recipe_${laneIndex}`;
    const signature = input?.typeId ?? "";
    if (machine.entity.getDynamicProperty(signatureKey) !== signature) {
        machine.entity.setDynamicProperty(signatureKey, signature);
        setDynamicNumber(machine.entity, `dorios:progress_${laneIndex}`, 0);
    }
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
    const bonusCrafts = Math.min(baseCrafts, fuelCraftBudget, Math.max(0, possible - baseCrafts));
    return {
        laneIndex, inputSlot, outputSlots, input, recipe,
        progress: machine.getProgress(laneIndex),
        cost: recipe.cost ?? settings.machine.energy_cost,
        batch,
        maxCrafts: Math.min(possible, baseCrafts + bonusCrafts),
        baseCrafts,
    };
}

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setUiItem(machine.container, FUEL_DISPLAY_SLOT, "utilitycraft:empty_fluid_bar");
            for (let index = 0; index < PROGRESS_SLOTS.length; index++) {
                setUiItem(machine.container, PROGRESS_SLOTS[index], "utilitycraft:progress_right_big_bar_00");
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
            }
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, LEGACY_SLOT_LAYOUT,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;
        const fuelTank = new FluidStorage(machine.entity, 0);
        machine.processIO();

        const fuel = liquidFuels[fuelTank.getType()];
        const fuelBoostActive = !!fuel && fuelTank.get() > 0;
        let fuelCraftBudget = fuelBoostActive
            ? Math.floor(fuelTank.get() / fuel.amount)
            : 0;
        const lanes = new Array(INPUTS.length);
        for (let index = 0; index < lanes.length; index++) {
            const lane = createLane(machine, index, settings, fuelCraftBudget);
            lanes[index] = lane;
            const reserved = Math.max(0, lane.maxCrafts - lane.baseCrafts);
            fuelCraftBudget = Math.max(0, fuelCraftBudget - reserved);
        }

        const energyUsed = advanceLanes(machine, lanes, {
            rateMultiplier: fuelBoostActive ? fuel.rateMultiplier : 1,
        });
        let crafted = 0;
        let fuelUsed = 0;
        let readyLanes = 0;

        for (let index = 0; index < lanes.length; index++) {
            const lane = lanes[index];
            if (lane.active) readyLanes++;
            if (lane.processCount > 0 && lane.input && lane.recipe) {
                const inputAmount = resourceCost(machine, lane.processCount * lane.recipe.required, lane.recipe.required);
                const outputAmount = lane.processCount * lane.recipe.amount;
                if (inputAmount >= lane.input.amount) machine.container.setItem(lane.inputSlot, undefined);
                else {
                    lane.input.amount -= inputAmount;
                    machine.container.setItem(lane.inputSlot, lane.input);
                }

                insertPooledOutput(machine.container, lane.outputSlots, lane.recipe.output, outputAmount);

                crafted += lane.processCount;
                fuelUsed += Math.max(0, lane.processCount - lane.baseCrafts) * (fuel?.amount ?? 0);
            }

            setDynamicNumber(machine.entity, `dorios:progress_${index}`, lane.progress);
            setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, lane.cost);
            displayProgress(machine, lane.cost, PROGRESS_SLOTS[index], index);
        }

        if (fuelUsed > 0) fuelTank.consume(resourceCost(machine, fuelUsed, fuel.amount));
        if (machine.shouldUpdateUI) fuelTank.display(FUEL_DISPLAY_SLOT);
        renderStatus(machine, energyUsed > 0 || crafted > 0, readyLanes > 0 ? "Running" : "Insert Items", [{
            title: "Incinerator Information",
            lines: [
                `§r§7Active Lanes §f${readyLanes}/3`,
                `§r§7Smelted §f${crafted}`,
                `§r§7Fuel §f${DoriosLib.text.formatIdentifier(fuelTank.getType())}`,
                `§r§7Rate §f${fuelBoostActive ? fuel.rateMultiplier : 1}x`,
                `§r§7Stored §f${FluidStorage.formatFluid(fuelTank.get())} / ${FluidStorage.formatFluid(fuelTank.getCap())}`,
            ],
        }], {
            energyCost: Math.max(settings.machine.energy_cost, ...lanes.map((lane) => lane.cost)),
            rateMultiplier: fuelBoostActive ? fuel.rateMultiplier : 1,
        });
    },

    onPlayerBreak: Machine.onDestroy,
});

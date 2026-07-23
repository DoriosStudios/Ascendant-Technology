// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceLanes,
    crusherRecipes,
    getPooledOutputCapacity,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    displayTemperature,
    halveStack,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:impact_crusher";
const INPUTS = Object.freeze([3, 4]);
const OUTPUTS = Object.freeze([[5, 6], [7, 8]]);
const PROGRESS_SLOTS = Object.freeze([9, 10]);
const LAVA_DISPLAY_SLOT = 15;
const COOLANT_DISPLAY_SLOT = 16;
const LAVA_PER_CRAFT = 400;
const MAX_HEAT = 1000;
const HEAT_KEY = "ascendant:impact_crusher_heat";
const LOCK_KEY = "ascendant:impact_crusher_locked";
const LOCK_SIGNATURE_KEY = "ascendant:impact_crusher_lock_signature";

const COOLANTS = Object.freeze({
    water: Object.freeze({ baseUse: 50, activeUse: 50, baseCooling: 15, activeCooling: 8 }),
    cryofluid: Object.freeze({ baseUse: 30, activeUse: 25, baseCooling: 35, activeCooling: 20 }),
});

registerIOInterface(ID, {
    items: {
        buttonSlots: [17, 18, 19, 20, 21, 22],
        anyInputSlots: INPUTS,
        anyOutputSlots: [5, 6, 7, 8],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [3] },
            { id: "input_2", inputSlots: [4] },
            { id: "input_3", inputSlots: INPUTS },
            { id: "output_1", outputSlots: [5, 6] },
            { id: "output_2", outputSlots: [7, 8] },
            { id: "output_3", outputSlots: [5, 6, 7, 8] },
        ],
    },
    liquids: {
        buttonSlots: [23, 24, 25, 26, 27, 28],
        anyInputIndices: [0, 1],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "fuel", inputIndices: [0] },
            { id: "input_2", inputIndices: [1] },
        ],
    },
});

function inputSignature(container) {
    let signature = "";
    for (let index = 0; index < INPUTS.length; index++) {
        const item = container.getItem(INPUTS[index]);
        signature += item ? `${item.typeId}:${item.amount}|` : "empty|";
    }
    return signature;
}

function createLane(machine, index, settings, lavaCraftBudget) {
    const inputSlot = INPUTS[index];
    const outputSlots = OUTPUTS[index];
    const input = machine.container.getItem(inputSlot);
    const recipe = input ? crusherRecipes[input.typeId] : undefined;
    const cost = recipe?.cost ?? settings.machine.energy_cost;
    if (!input || !recipe) {
        return {
            index, inputSlot, outputSlots, input, recipe, cost,
            progress: 0,
            batch: machine.boosts.process_batch,
            maxCrafts: 0,
        };
    }

    const byInput = Math.floor(input.amount / recipe.required);
    const byOutput = Math.floor(getPooledOutputCapacity(
        machine.container, outputSlots, recipe.output, recipe.outputMaxAmount,
    ) / recipe.amount);
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const processingCap = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1)) * intervalScale;
    return {
        index, inputSlot, outputSlots, input, recipe, cost,
        progress: machine.getProgress(index),
        batch: machine.boosts.process_batch,
        maxCrafts: Math.min(byInput, byOutput, lavaCraftBudget, processingCap),
    };
}

function coolMachine(machine, coolant, heat, activeLanes, locked) {
    const intervalScale = Math.max(1, machine.processingInterval / 4);
    let cooling = (10 + (activeLanes === 0 ? 10 : 0) + (locked ? 15 : 0)) * intervalScale;
    const profile = COOLANTS[coolant.getType()];
    if (profile && heat > 0) {
        const requested = Math.ceil((profile.baseUse + profile.activeUse * activeLanes) * intervalScale);
        if (coolant.get() >= requested) {
            coolant.consume(requested);
            cooling += (profile.baseCooling + profile.activeCooling * activeLanes) * intervalScale;
        }
    }
    return Math.max(0, heat - cooling);
}

function burnAndLock(machine) {
    for (let index = 0; index < INPUTS.length; index++) halveStack(machine.container, INPUTS[index]);
    for (let lane = 0; lane < OUTPUTS.length; lane++) {
        for (let index = 0; index < OUTPUTS[lane].length; index++) {
            halveStack(machine.container, OUTPUTS[lane][index]);
        }
    }
    for (let index = 0; index < INPUTS.length; index++) {
        setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
    }
    setDynamicNumber(machine.entity, LOCK_KEY, 1);
    setDynamicString(machine.entity, LOCK_SIGNATURE_KEY, inputSignature(machine.container));
}

function display(machine, lava, coolant, heat, lanes) {
    if (!machine.shouldUpdateUI) return;
    lava.display(LAVA_DISPLAY_SLOT);
    coolant.display(COOLANT_DISPLAY_SLOT);
    displayTemperature(machine, heat, MAX_HEAT, 2);
    for (let index = 0; index < lanes.length; index++) {
        displayProgress(machine, lanes[index].cost, PROGRESS_SLOTS[index], index);
    }
}

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:temperature_00");
            setUiItem(machine.container, LAVA_DISPLAY_SLOT, "utilitycraft:lava_00");
            setUiItem(machine.container, COOLANT_DISPLAY_SLOT, "utilitycraft:empty_fluid_bar");
            for (let index = 0; index < PROGRESS_SLOTS.length; index++) {
                setUiItem(machine.container, PROGRESS_SLOTS[index], "utilitycraft:progress_right_big_bar_00");
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
            }
            const tanks = FluidStorage.initializeMultiple(machine.entity, 2);
            tanks[0].setType("lava");
            setDynamicNumber(machine.entity, HEAT_KEY, 0);
            setDynamicNumber(machine.entity, LOCK_KEY, 0);
            setDynamicString(machine.entity, LOCK_SIGNATURE_KEY, "");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const lava = new FluidStorage(machine.entity, 0);
        const coolant = new FluidStorage(machine.entity, 1);
        if (lava.getType() === "empty") lava.setType("lava");
        machine.processIO();

        let heat = Number(machine.entity.getDynamicProperty(HEAT_KEY)) || 0;
        const locked = Number(machine.entity.getDynamicProperty(LOCK_KEY)) === 1;
        if (locked) {
            heat = coolMachine(machine, coolant, heat, 0, true);
            const signatureChanged = inputSignature(machine.container)
                !== String(machine.entity.getDynamicProperty(LOCK_SIGNATURE_KEY) ?? "");
            if (heat <= 0 && signatureChanged) {
                setDynamicNumber(machine.entity, LOCK_KEY, 0);
                setDynamicString(machine.entity, LOCK_SIGNATURE_KEY, "");
            }
            setDynamicNumber(machine.entity, HEAT_KEY, heat);
            const idleLanes = [
                { cost: settings.machine.energy_cost },
                { cost: settings.machine.energy_cost },
            ];
            display(machine, lava, coolant, heat, idleLanes);
            renderStatus(machine, false, "Thermal Lock", ["§r§cCool to 0 and change inputs"]);
            return;
        }

        let lavaCraftBudget = lava.getType() === "lava" ? Math.floor(lava.get() / LAVA_PER_CRAFT) : 0;
        const lanes = new Array(INPUTS.length);
        for (let index = 0; index < lanes.length; index++) {
            const lane = createLane(machine, index, settings, lavaCraftBudget);
            lanes[index] = lane;
            lavaCraftBudget = Math.max(0, lavaCraftBudget - lane.maxCrafts);
        }

        const energyUsed = advanceLanes(machine, lanes);
        let crafted = 0;
        let activeLanes = 0;
        for (let index = 0; index < lanes.length; index++) {
            const lane = lanes[index];
            if (lane.energyUsed > 0 || lane.processCount > 0) activeLanes++;
            if (lane.processCount > 0 && lane.input && lane.recipe) {
                const used = lane.processCount * lane.recipe.required;
                if (used >= lane.input.amount) machine.container.setItem(lane.inputSlot, undefined);
                else {
                    lane.input.amount -= used;
                    machine.container.setItem(lane.inputSlot, lane.input);
                }
                insertPooledOutput(
                    machine.container,
                    lane.outputSlots,
                    lane.recipe.output,
                    lane.processCount * lane.recipe.amount,
                );
                crafted += lane.processCount;
            }
            setDynamicNumber(machine.entity, `dorios:progress_${index}`, lane.progress);
            setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, lane.cost);
        }
        if (crafted > 0) lava.consume(crafted * LAVA_PER_CRAFT);

        const intervalScale = Math.max(1, machine.processingInterval / 4);
        heat += activeLanes * 16 * intervalScale + crafted * 5 + (crafted > 0 ? 10 : 0);
        heat = coolMachine(machine, coolant, heat, activeLanes, false);
        heat = Math.min(MAX_HEAT, heat);
        const overheated = heat >= MAX_HEAT;
        if (overheated) burnAndLock(machine);

        setDynamicNumber(machine.entity, HEAT_KEY, heat);
        display(machine, lava, coolant, heat, lanes);
        renderStatus(machine, !overheated && (energyUsed > 0 || crafted > 0), overheated ? "Thermal Lock" : (activeLanes > 0 ? "Crushing" : "Waiting"), [
            `§r§7Heat: ${Math.floor(heat)}/${MAX_HEAT}`,
            `§r§7Active lanes: ${activeLanes}/2`,
        ]);
    },

    onPlayerBreak: Machine.onDestroy,
});

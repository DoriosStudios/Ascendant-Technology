// @ts-check

import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceLanes,
    crusherRecipes,
    getPooledOutputCapacity,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    displayTemperature,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:impact_crusher";
const INVENTORY_SIZE = 39;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4,
    9, 10, 15, 16, 11, 12, 13, 14,
    5, 6, -1, -1, 7, 8, -1, -1,
    17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28,
    -1, -1, -1, -1, -1, -1,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 13, 14, 19, 20, 15, 16, 17, 18,
    5, 6, 7, 8, 9, 10, 11, 12,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
];
const LAYOUT_KEY = "ascendant:impact_crusher_layout";
const LAYOUT_VERSION = "output_last_v2";
const INPUTS = Object.freeze([3, 4]);
const PROGRESS_SLOTS = Object.freeze([5, 6]);
const LAVA_DISPLAY_SLOT = 7;
const STEAM_DISPLAY_SLOT = 8;
const OUTPUTS = Object.freeze([[13, 14, 15, 16], [17, 18, 19, 20]]);
const ALL_OUTPUTS = Object.freeze(OUTPUTS.flat());
const LAVA_PER_CRAFT = 400;
const LAVA_HEAT_USE = 50;
const STEAM_COOLING_USE = 75;
const MIN_OPERATING_HEAT = 350;
const MAX_HEAT = 1000;
const HEAT_KEY = "ascendant:impact_crusher_heat";
const LOCK_KEY = "ascendant:impact_crusher_locked";
const LOCK_UNTIL_KEY = "ascendant:impact_crusher_lock_until";
const LOCK_DURATION_TICKS = 20 * 30;

registerIOInterface(ID, {
    items: {
        buttonSlots: [21, 22, 23, 24, 25, 26],
        anyInputSlots: INPUTS,
        anyOutputSlots: ALL_OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [3] },
            { id: "input_2", inputSlots: [4] },
            { id: "input_3", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS[0] },
            { id: "output_2", outputSlots: OUTPUTS[1] },
            { id: "output_3", outputSlots: ALL_OUTPUTS },
        ],
    },
    liquids: {
        buttonSlots: [27, 28, 29, 30, 31, 32],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "fuel", inputIndices: [0] },
        ],
    },
    gases: {
        buttonSlots: [33, 34, 35, 36, 37, 38],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

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

function coolMachine(machine, steam, heat, activeLanes, locked) {
    const intervalScale = Math.max(1, machine.processingInterval / 4);
    let cooling = (4 + (activeLanes === 0 ? 4 : 0) + (locked ? 8 : 0)) * intervalScale;
    const requested = Math.ceil(STEAM_COOLING_USE * (1 + activeLanes * 0.5) * intervalScale);
    if (steam.getType() === "steam" && heat > 0 && steam.get() >= requested) {
        steam.consume(requested);
        cooling += (36 + activeLanes * 14 + (locked ? 20 : 0)) * intervalScale;
    }
    return Math.max(0, heat - cooling);
}

function burnAndLock(machine) {
    for (let index = 0; index < INPUTS.length; index++) {
        setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
    }
    setDynamicNumber(machine.entity, LOCK_KEY, 1);
    setDynamicNumber(machine.entity, LOCK_UNTIL_KEY, system.currentTick + LOCK_DURATION_TICKS);
}

function display(machine, lava, steam, heat, lanes) {
    if (!machine.shouldUpdateUI) return;
    lava.display(LAVA_DISPLAY_SLOT);
    steam.display(STEAM_DISPLAY_SLOT);
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
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setUiItem(machine.container, 2, "utilitycraft:temperature_00");
            setUiItem(machine.container, LAVA_DISPLAY_SLOT, "utilitycraft:lava_00");
            setUiItem(machine.container, STEAM_DISPLAY_SLOT, "utilitycraft:steam_00");
            for (let index = 0; index < PROGRESS_SLOTS.length; index++) {
                setUiItem(machine.container, PROGRESS_SLOTS[index], "utilitycraft:progress_right_big_bar_00");
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
            }
            new FluidStorage(machine.entity, 0).setType("lava");
            new GasStorage(machine.entity, 0).setType("steam");
            setDynamicNumber(machine.entity, HEAT_KEY, 0);
            setDynamicNumber(machine.entity, LOCK_KEY, 0);
            setDynamicNumber(machine.entity, LOCK_UNTIL_KEY, 0);
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
        const steam = new GasStorage(machine.entity, 0);
        if (lava.getType() === "empty") lava.setType("lava");
        if (steam.getType() === "empty") steam.setType("steam");
        machine.processIO();

        let heat = Number(machine.entity.getDynamicProperty(HEAT_KEY)) || 0;
        const locked = Number(machine.entity.getDynamicProperty(LOCK_KEY)) === 1;
        if (locked) {
            heat = coolMachine(machine, steam, heat, 0, true);
            const lockUntil = Number(machine.entity.getDynamicProperty(LOCK_UNTIL_KEY)) || 0;
            if (system.currentTick >= lockUntil && heat < MIN_OPERATING_HEAT) {
                setDynamicNumber(machine.entity, LOCK_KEY, 0);
                setDynamicNumber(machine.entity, LOCK_UNTIL_KEY, 0);
            }
            setDynamicNumber(machine.entity, HEAT_KEY, heat);
            const idleLanes = [
                { cost: settings.machine.energy_cost },
                { cost: settings.machine.energy_cost },
            ];
            display(machine, lava, steam, heat, idleLanes);
            const seconds = Math.max(0, Math.ceil((lockUntil - system.currentTick) / 20));
            renderStatus(machine, false, "Thermal Lock", [{
                title: "Thermal Information",
                lines: [
                    `§r§cCooldown §f${seconds}s`,
                    `§r§7Heat §f${Math.floor(heat)}/${MAX_HEAT}`,
                    `§r§7Lava Stored §f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
                    `§r§7Steam Cooling §f${steam.getType() === "steam" && steam.get() > 0 ? "Active" : "Unavailable"}`,
                    `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                ],
            }], { energyCost: settings.machine.energy_cost });
            return;
        }

        const intervalScale = Math.max(1, machine.processingInterval / 4);
        if (lava.getType() === "lava" && lava.get() >= LAVA_HEAT_USE * intervalScale && heat < MAX_HEAT) {
            lava.consume(LAVA_HEAT_USE * intervalScale);
            heat += 45 * intervalScale;
        }
        let lavaCraftBudget = heat >= MIN_OPERATING_HEAT && lava.getType() === "lava"
            ? Math.floor(lava.get() / LAVA_PER_CRAFT)
            : 0;
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

        heat += activeLanes * 16 * intervalScale + crafted * 5 + (crafted > 0 ? 10 : 0);
        heat = coolMachine(machine, steam, heat, activeLanes, false);
        heat = Math.min(MAX_HEAT, heat);
        const overheated = heat >= MAX_HEAT;
        if (overheated) burnAndLock(machine);

        setDynamicNumber(machine.entity, HEAT_KEY, heat);
        display(machine, lava, steam, heat, lanes);
        const waitingTitle = heat < MIN_OPERATING_HEAT ? "Heating" : "Waiting";
        renderStatus(machine, !overheated && (energyUsed > 0 || crafted > 0), overheated ? "Thermal Lock" : (activeLanes > 0 ? "Crushing" : waitingTitle), [{
            title: "Thermal Information",
            lines: [
                `§r§7Heat §f${Math.floor(heat)}/${MAX_HEAT}`,
                `§r§7Operating Heat §f${MIN_OPERATING_HEAT}+`,
                `§r§7Active Lanes §f${activeLanes}/2`,
                `§r§7Lava Stored §f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
                `§r§7Steam Cooling §f${steam.getType() === "steam" && steam.get() > 0 ? "Active" : "Unavailable"}`,
                `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                `§r§7Crushed §f${crafted}`,
            ],
        }], { energyCost: Math.max(settings.machine.energy_cost, ...lanes.map((lane) => lane.cost)) });
    },

    onPlayerBreak: Machine.onDestroy,
});

// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceProcess,
    consumePooledInput,
    countPooledInput,
    crusherRecipes,
    getPooledOutputCapacity,
    insertPooledOutput,
    selectPooledRecipe,
} from "../../ATCore/processing/index.js";
import { displayProgress, renderStatus, setDynamicNumber, setUiItem } from "./runtime.js";

const ID = "utilitycraft:pulverizer";
const INPUTS = Object.freeze([3, 4, 5, 6]);
const OUTPUTS = Object.freeze([7, 8, 9, 10]);
const STEAM_DISPLAY_SLOT = 11;
const STEAM_PER_CRAFT = 250;

registerIOInterface(ID, {
    items: {
        buttonSlots: [16, 17, 18, 19, 20, 21],
        anyInputSlots: INPUTS,
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
    gases: {
        buttonSlots: [22, 23, 24, 25, 26, 27],
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
            machine.blockSlots([STEAM_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, STEAM_DISPLAY_SLOT, "utilitycraft:steam_00");
            const steam = new GasStorage(machine.entity, 0);
            steam.setType("steam");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const steam = new GasStorage(machine.entity, 0);
        if (steam.getType() === "empty") steam.setType("steam");
        machine.processIO();

        const selected = selectPooledRecipe(machine.container, INPUTS, crusherRecipes);
        if (!selected) {
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            displayProgress(machine, settings.machine.energy_cost);
            renderStatus(machine, false, "Insert Items", [{
                title: "Pulverizer Information",
                lines: [`§r§7Steam Boost §fInactive`, `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`, `§r§7Input §fNone`],
            }], { energyCost: settings.machine.energy_cost });
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            return;
        }

        const { inputTypeId, recipe } = selected;
        const inputCrafts = Math.floor(countPooledInput(machine.container, INPUTS, inputTypeId) / recipe.required);
        const outputCrafts = Math.floor(getPooledOutputCapacity(
            machine.container, OUTPUTS, recipe.output, recipe.outputMaxAmount,
        ) / recipe.amount);
        const resourceCrafts = Math.min(inputCrafts, outputCrafts);
        if (resourceCrafts <= 0) {
            if (inputCrafts <= 0) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            displayProgress(machine, recipe.cost ?? settings.machine.energy_cost);
            renderStatus(machine, false, outputCrafts <= 0 ? "Output Full" : "Needs More Input", [{
                title: "Pulverizer Information",
                lines: [`§r§7Steam Boost §fInactive`, `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`, `§r§7Input §f${DoriosLib.text.formatIdentifier(inputTypeId)}`],
            }], { energyCost: recipe.cost ?? settings.machine.energy_cost });
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            return;
        }

        const baseCost = recipe.cost ?? settings.machine.energy_cost;
        const configuredBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
        const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
        let maxCrafts = Math.min(resourceCrafts, configuredBatch * intervalScale);
        const steamCrafts = steam.getType() === "steam" ? Math.floor(steam.get() / STEAM_PER_CRAFT) : 0;
        const steamActive = steamCrafts > 0;
        if (steamActive) maxCrafts = Math.min(maxCrafts, steamCrafts);
        const cost = baseCost * (steamActive ? 1.5 : 1);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            batch: configuredBatch,
            maxCrafts,
            rateMultiplier: steamActive ? 1.75 : 1,
        });

        if (result.processCount > 0) {
            consumePooledInput(machine.container, INPUTS, inputTypeId, result.processCount * recipe.required);
            insertPooledOutput(machine.container, OUTPUTS, recipe.output, result.processCount * recipe.amount);
            if (steamActive) steam.consume(result.processCount * STEAM_PER_CRAFT);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);
        if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? (steamActive ? "Steam Boost" : "Running") : "No Energy", [{
            title: "Pulverizer Information",
            lines: [
                `§r§7Input §f${DoriosLib.text.formatIdentifier(inputTypeId)}`,
                `§r§7Output §f${DoriosLib.text.formatIdentifier(recipe.output)}`,
                `§r§7Processed §f${result.processCount}`,
                `§r§7Steam Boost §f${steamActive ? "x1.75" : "Inactive"}`,
                `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
            ],
        }], { energyCost: cost, rateMultiplier: steamActive ? 1.75 : 1 });
    },

    onPlayerBreak: Machine.onDestroy,
});

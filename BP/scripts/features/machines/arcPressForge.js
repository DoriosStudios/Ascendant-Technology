// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { ButtonManager, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceProcess,
    consumePooledInput,
    countPooledInput,
    getPooledOutputCapacity,
    insertPooledOutput,
    pressRecipes,
    selectPooledRecipe,
} from "../../ATCore/processing/index.js";
import { displayProgress, renderStatus, setDynamicNumber, setDynamicString, setUiItem } from "./runtime.js";

const ID = "utilitycraft:arc_press_forge";
const INPUTS = Object.freeze([3, 4, 5, 6]);
const OUTPUTS = Object.freeze([16, 17, 18, 19]);
const MODE_KEY = "ascendant:arc_press_forge_mode";

function getMode(entity) {
    return entity.getDynamicProperty(MODE_KEY) === "high_speed" ? "high_speed" : "low_loss";
}

ButtonManager.registerMachineButton(ID, 8, ({ entity }) => {
    const next = getMode(entity) === "low_loss" ? "high_speed" : "low_loss";
    setDynamicString(entity, MODE_KEY, next);
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return next === "high_speed" ? "§r§cHigh Speed" : "§r§aLow Loss";
});

registerIOInterface(ID, {
    items: {
        buttonSlots: [20, 21, 22, 23, 24, 25],
        anyInputSlots: INPUTS,
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            machine.blockSlots([7, 9, 14, 15]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, 8, "utilitycraft:ui_filler", "§r§aLow Loss");
            setDynamicString(machine.entity, MODE_KEY, "low_loss");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        const selected = selectPooledRecipe(machine.container, INPUTS, pressRecipes);
        if (!selected) {
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            displayProgress(machine, settings.machine.energy_cost);
            renderStatus(machine, false, "Insert Items", [`§r§7Mode: ${mode}`]);
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
            renderStatus(machine, false, outputCrafts <= 0 ? "Output Full" : "Needs More Input");
            return;
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        const processBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
        const highSpeed = mode === "high_speed";
        const modeBatch = highSpeed ? processBatch * 2 : processBatch;
        const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
        const maxCrafts = Math.min(resourceCrafts, modeBatch * intervalScale);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            batch: modeBatch,
            maxCrafts,
            rateMultiplier: highSpeed ? 1 : 2,
        });

        if (result.processCount > 0) {
            consumePooledInput(machine.container, INPUTS, inputTypeId, result.processCount * recipe.required);
            let outputAmount = result.processCount * recipe.amount;
            if (highSpeed && outputAmount > 0) {
                const completedBatches = Math.ceil(result.processCount / modeBatch);
                for (let batchIndex = 0; batchIndex < completedBatches && outputAmount > 0; batchIndex++) {
                    if (Math.random() < 0.5) outputAmount--;
                }
            }
            if (outputAmount > 0) insertPooledOutput(machine.container, OUTPUTS, recipe.output, outputAmount);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? "Running" : "No Energy", [
            `§r§7Mode: ${highSpeed ? "High Speed" : "Low Loss"}`,
        ]);
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

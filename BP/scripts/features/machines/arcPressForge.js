// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { ButtonManager, GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
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
const INVENTORY_SIZE = 29;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    -1, 16, 17, 18, 19, 20, 21,
    -1, -1, -1, -1, -1, -1,
];
const INPUTS = Object.freeze([3, 4, 5, 6]);
const OUTPUTS = Object.freeze([7, 8, 9, 10]);
const MODE_BUTTON_SLOT = 11;
const MODE_KEY = "ascendant:arc_press_forge_mode";
const STEAM_DISPLAY_SLOT = 16;
const STEAM_PER_CRAFT = 125;

function getMode(entity) {
    return entity.getDynamicProperty(MODE_KEY) === "high_speed" ? "high_speed" : "low_loss";
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const next = getMode(entity) === "low_loss" ? "high_speed" : "low_loss";
    setDynamicString(entity, MODE_KEY, next);
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return next === "high_speed" ? "§r§cHigh Speed" : "§r§aLow Loss";
});

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [17, 18, 19, 20, 21, 22],
        anyInputSlots: INPUTS,
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUTS },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
    gases: {
        buttonSlots: [23, 24, 25, 26, 27, 28],
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
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "§r§aLow Loss");
            setUiItem(machine.container, STEAM_DISPLAY_SLOT, "utilitycraft:steam_00");
            new GasStorage(machine.entity, 0).setType("steam");
            setDynamicString(machine.entity, MODE_KEY, "low_loss");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;
        const steam = new GasStorage(machine.entity, 0);
        if (steam.getType() === "empty") steam.setType("steam");
        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        const selected = selectPooledRecipe(machine.container, INPUTS, pressRecipes);
        if (!selected) {
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Insert Items", [{
                title: "Forge Information",
                lines: [
                    `§r§7Mode §f${mode === "high_speed" ? "High Speed" : "Low Loss"}`,
                    `§r§7Steam Boost §fInactive`,
                    `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                ],
            }], { energyCost: settings.machine.energy_cost });
            return;
        }

        const { inputTypeId, recipe } = selected;
        const inputCrafts = Math.floor(countPooledInput(machine.container, INPUTS, inputTypeId) / recipe.required);
        const outputCrafts = Math.floor(getPooledOutputCapacity(
            machine.container, OUTPUTS, recipe.output, recipe.outputMaxAmount,
        ) / recipe.amount);
        const resourceCrafts = Math.min(inputCrafts, outputCrafts);
        if (resourceCrafts <= 0) {
            const idleCost = recipe.cost ?? settings.machine.energy_cost;
            if (inputCrafts <= 0) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", idleCost);
            displayProgress(machine, idleCost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, outputCrafts <= 0 ? "Output Full" : "Needs More Input", [{
                title: "Forge Information",
                lines: [
                    `§r§7Mode §f${mode === "high_speed" ? "High Speed" : "Low Loss"}`,
                    `§r§7Steam Boost §fInactive`,
                    `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                ],
            }], { energyCost: idleCost });
            return;
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        const processBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
        const highSpeed = mode === "high_speed";
        const modeBatch = highSpeed ? processBatch * 2 : processBatch;
        const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
        const maxCrafts = Math.min(resourceCrafts, modeBatch * intervalScale);
        const steamNeeded = maxCrafts * STEAM_PER_CRAFT;
        const steamActive = steam.getType() === "steam" && steam.get() >= steamNeeded;
        const operationCost = Math.ceil(cost * (steamActive ? 1.25 : 1));
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: operationCost,
            batch: modeBatch,
            maxCrafts,
            rateMultiplier: (highSpeed ? 2 : 1) * (steamActive ? 1.5 : 1),
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
            if (steamActive) steam.consume(result.processCount * STEAM_PER_CRAFT);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", operationCost);
        displayProgress(machine, operationCost);
        if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? "Running" : "No Energy", [{
            title: "Forge Information",
            lines: [
                `§r§7Mode §f${highSpeed ? "High Speed" : "Low Loss"}`,
                `§r§7Steam Boost §f${steamActive ? "x1.50" : "Inactive"}`,
                `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                `§r§7Mode Rate §f${highSpeed ? "x2.00" : "x1.00"}`,
            ],
        }], {
            energyCost: operationCost,
            rateMultiplier: (highSpeed ? 2 : 1) * (steamActive ? 1.5 : 1),
            batch: modeBatch,
        });
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

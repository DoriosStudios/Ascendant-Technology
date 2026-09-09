// @ts-check

import { parallelLimit, resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { ButtonManager, GasStorage, registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    advanceSlotCycle,
    createPooledOutputReservation,
    insertPooledOutput,
    pressRecipes,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:arc_press_forge";
const INVENTORY_SIZE = 29;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1, 16, 17, 18, 19, 20, 21, -1, -1, -1,
    -1, -1, -1,
];
const INPUTS = Object.freeze([3, 4, 5, 6]);
const OUTPUTS = Object.freeze([7, 8, 9, 10]);
const MODE_BUTTON_SLOT = 11;
const MODE_KEY = "ascendant:arc_press_forge_mode";
const CYCLE_KEY = "ascendant:arc_press_forge_cycle";
const STEAM_DISPLAY_SLOT = 16;
const STEAM_PER_CRAFT = 125;

function selectOperations(machine, settings, mode) {
    const operations = [];
    const reservation = createPooledOutputReservation(machine.container, OUTPUTS);
    const limit = parallelLimit(machine, INPUTS.length);
    const stackBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const batch = mode === "high_speed" ? stackBatch * 2 : stackBatch;
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const craftLimit = batch * intervalScale;
    let hasInput = false;
    let hasRecipe = false;
    let outputBlocked = false;

    for (const slot of INPUTS) {
        const input = machine.container.getItem(slot);
        if (!input) continue;
        hasInput = true;
        const recipe = pressRecipes[input.typeId];
        if (!recipe || input.amount < recipe.required) continue;
        hasRecipe = true;
        const crafts = Math.min(Math.floor(input.amount / recipe.required), craftLimit);
        if (!reservation.reserve(recipe.output, crafts * recipe.amount, recipe.outputMaxAmount)) {
            outputBlocked = true;
            continue;
        }
        operations.push({
            slot,
            input,
            recipe,
            crafts,
            batch,
            cost: recipe.cost ?? settings.machine.energy_cost,
        });
        if (operations.length >= limit) break;
    }
    return { operations, hasInput, hasRecipe, outputBlocked, batch };
}

function consumeSlot(container, slot, item, amount) {
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

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
        modes: [{ id: "disabled" }, { id: "input_1", inputIndices: [0] }],
    },
});

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(
                machine.container,
                MODE_BUTTON_SLOT,
                "utilitycraft:ui_filler",
                "§r§aLow Loss",
            );
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
        const highSpeed = mode === "high_speed";
        const selection = selectOperations(machine, settings, mode);
        const operations = selection.operations;
        if (operations.length === 0) {
            setDynamicString(machine.entity, CYCLE_KEY, "");
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            const message = selection.outputBlocked
                ? "Output Full"
                : selection.hasRecipe
                  ? "Needs More Input"
                  : selection.hasInput
                    ? "Invalid Input"
                    : "Insert Items";
            renderStatus(
                machine,
                false,
                message,
                [
                    {
                        title: "Forge Information",
                        lines: [
                            `§r§7Selected Slots §f0/${parallelLimit(machine, INPUTS.length)}`,
                            `§r§7Mode §f${highSpeed ? "High Speed" : "Low Loss"}`,
                            `§r§7Steam Boost §fInactive`,
                            `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                        ],
                    },
                ],
                { energyCost: settings.machine.energy_cost },
            );
            return;
        }

        const signature = `${mode}|${operations.map((operation) => `${operation.slot}:${operation.input.typeId}`).join("|")}`;
        if (machine.entity.getDynamicProperty(CYCLE_KEY) !== signature) {
            setDynamicString(machine.entity, CYCLE_KEY, signature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }
        const totalCrafts = operations.reduce((sum, operation) => sum + operation.crafts, 0);
        const steamNeeded = totalCrafts * STEAM_PER_CRAFT;
        const steamActive = steam.getType() === "steam" && steam.get() >= steamNeeded;
        const cycleOperations = operations.map((operation) => ({
            ...operation,
            cost: Math.ceil(operation.cost * (steamActive ? 1.25 : 1)),
        }));
        const rateMultiplier = (highSpeed ? 2 : 1) * (steamActive ? 1.5 : 1);
        const result = advanceSlotCycle(machine, {
            progress: machine.getProgress(),
            operations: cycleOperations,
            rateMultiplier,
        });

        let processed = 0;
        if (result.completed) {
            for (const operation of operations) {
                consumeSlot(
                    machine.container,
                    operation.slot,
                    operation.input,
                    resourceCost(
                        machine,
                        operation.crafts * operation.recipe.required,
                        operation.recipe.required,
                    ),
                );
                let outputAmount = operation.crafts * operation.recipe.amount;
                if (highSpeed) {
                    const completedBatches = Math.ceil(operation.crafts / operation.batch);
                    for (
                        let batchIndex = 0;
                        batchIndex < completedBatches && outputAmount > 0;
                        batchIndex++
                    ) {
                        if (Math.random() < 0.5) outputAmount--;
                    }
                }
                if (outputAmount > 0) {
                    insertPooledOutput(
                        machine.container,
                        OUTPUTS,
                        operation.recipe.output,
                        outputAmount,
                    );
                }
                processed += operation.crafts;
            }
            if (steamActive) steam.consume(resourceCost(machine, steamNeeded, STEAM_PER_CRAFT));
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", result.cost);
        displayProgress(machine, result.cost);
        if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
        const active = result.energyUsed > 0 || result.completed;
        renderStatus(
            machine,
            active,
            active ? "Running" : "No Energy",
            [
                {
                    title: "Forge Information",
                    lines: [
                        `§r§7Selected Slots §f${operations.length}/${parallelLimit(machine, INPUTS.length)}`,
                        `§r§7Processed §f${processed}`,
                        `§r§7Mode §f${highSpeed ? "High Speed" : "Low Loss"}`,
                        `§r§7Steam Boost §f${steamActive ? "x1.50" : "Inactive"}`,
                        `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                        `§r§7Mode Rate §f${highSpeed ? "x2.00" : "x1.00"}`,
                    ],
                },
            ],
            {
                energyCost: result.cost,
                rateMultiplier,
                batch: selection.batch,
            },
        );
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

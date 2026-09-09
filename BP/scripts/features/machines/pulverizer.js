// @ts-check

import { parallelLimit, resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { GasStorage, registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    advanceSlotCycle,
    createPooledOutputReservation,
    crusherRecipes,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:pulverizer";
const INPUTS = Object.freeze([3, 4, 5, 6]);
const OUTPUTS = Object.freeze([7, 8, 9, 10]);
const STEAM_DISPLAY_SLOT = 11;
const STEAM_PER_CRAFT = 250;
const CYCLE_KEY = "ascendant:pulverizer_cycle";

function selectOperations(machine, settings) {
    const operations = [];
    const reservation = createPooledOutputReservation(machine.container, OUTPUTS);
    const limit = parallelLimit(machine, INPUTS.length);
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const craftLimit = batch * intervalScale;
    let hasInput = false;
    let hasRecipe = false;
    let outputBlocked = false;

    for (const slot of INPUTS) {
        const input = machine.container.getItem(slot);
        if (!input) continue;
        hasInput = true;
        const recipe = crusherRecipes[input.typeId];
        if (!recipe || input.amount < recipe.required) continue;
        hasRecipe = true;
        const crafts = Math.min(Math.floor(input.amount / recipe.required), craftLimit);
        const outputAmount = crafts * recipe.amount;
        if (!reservation.reserve(recipe.output, outputAmount, recipe.outputMaxAmount)) {
            outputBlocked = true;
            continue;
        }
        operations.push({
            slot,
            input,
            recipe,
            crafts,
            cost: recipe.cost ?? settings.machine.energy_cost,
        });
        if (operations.length >= limit) break;
    }
    return { operations, hasInput, hasRecipe, outputBlocked };
}

function consumeSlot(container, slot, item, amount) {
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

registerIOInterface(ID, {
    automaticDefaults: true,
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
        modes: [{ id: "disabled" }, { id: "input_1", inputIndices: [0] }],
    },
});

registerATMachine(ID, {
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

        const selection = selectOperations(machine, settings);
        const operations = selection.operations;
        if (operations.length === 0) {
            setDynamicString(machine.entity, CYCLE_KEY, "");
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
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
                        title: "Pulverizer Information",
                        lines: [
                            `§r§7Selected Slots §f0/${parallelLimit(machine, INPUTS.length)}`,
                            `§r§7Steam Boost §fInactive`,
                            `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                        ],
                    },
                ],
                { energyCost: settings.machine.energy_cost },
            );
            return;
        }

        const signature = operations
            .map((operation) => `${operation.slot}:${operation.input.typeId}`)
            .join("|");
        if (machine.entity.getDynamicProperty(CYCLE_KEY) !== signature) {
            setDynamicString(machine.entity, CYCLE_KEY, signature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }
        const totalCrafts = operations.reduce((sum, operation) => sum + operation.crafts, 0);
        const steamNeeded = totalCrafts * STEAM_PER_CRAFT;
        const steamActive = steam.getType() === "steam" && steam.get() >= steamNeeded;
        const cycleOperations = operations.map((operation) => ({
            ...operation,
            cost: operation.cost * (steamActive ? 1.5 : 1),
        }));
        const result = advanceSlotCycle(machine, {
            progress: machine.getProgress(),
            operations: cycleOperations,
            rateMultiplier: steamActive ? 1.75 : 1,
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
                insertPooledOutput(
                    machine.container,
                    OUTPUTS,
                    operation.recipe.output,
                    operation.crafts * operation.recipe.amount,
                );
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
            active ? (steamActive ? "Steam Boost" : "Running") : "No Energy",
            [
                {
                    title: "Pulverizer Information",
                    lines: [
                        `§r§7Selected Slots §f${operations.length}/${parallelLimit(machine, INPUTS.length)}`,
                        `§r§7Processed §f${processed}`,
                        `§r§7Steam Boost §f${steamActive ? "x1.75" : "Inactive"}`,
                        `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                    ],
                },
            ],
            { energyCost: result.cost, rateMultiplier: steamActive ? 1.75 : 1 },
        );
    },

    onPlayerBreak: Machine.onDestroy,
});

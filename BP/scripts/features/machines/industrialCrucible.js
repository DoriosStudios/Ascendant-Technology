// @ts-check

import { parallelLimit, resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { FluidStorage, registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    advanceSlotCycle,
    createPooledOutputReservation,
    insertPooledOutput,
} from "../../ATCore/processing/index.js";
import { getIndustrialCrucibleRecipe } from "../../config/recipes/industrialCrucible.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:industrial_crucible";
const INVENTORY_SIZE = 32;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, -1, -1, 9, -1, -1, -1, -1, -1, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 9, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31,
];
const LAYOUT_KEY = "ascendant:industrial_crucible_layout";
const LAYOUT_VERSION = "output_last_v2";
const INPUT_SLOTS = [3, 4, 5, 6, 7, 8];
const LAVA_DISPLAY_SLOT = 9;
const OUTPUT_SLOTS = [14, 15, 16, 17, 18, 19];
const RECIPE_KEY = "ascendant:industrial_crucible_recipe";
const FLUID_IO_RATE = 128000;
const DEFAULT_STACK_SIZE = 64;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [20, 21, 22, 23, 24, 25],
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
    liquids: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
        anyInputIndices: [],
        anyOutputIndices: [0],
        modes: [{ id: "disabled" }, { id: "output_1", outputIndices: [0] }],
    },
});

registerATMachine(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([LAVA_DISPLAY_SLOT]);
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, RECIPE_KEY, "");

            const lava = new FluidStorage(machine.entity, 0);
            if (lava.getType() === "empty" || lava.get() <= 0) lava.setType("lava");
            lava.display(LAVA_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (
            !ensureMachineInventoryLayout(
                machine,
                INVENTORY_SIZE,
                LEGACY_SLOT_LAYOUT,
                LAYOUT_KEY,
                LAYOUT_VERSION,
                PREVIOUS_SLOT_LAYOUT,
            )
        )
            return;

        const lava = new FluidStorage(machine.entity, 0);
        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });

        const storedFluid = lava.getType();
        if (storedFluid !== "empty" && storedFluid !== "lava" && lava.get() > 0) {
            pauseProcess(machine, lava, settings.machine.energy_cost, "Drain Invalid Liquid");
            return;
        }
        if (storedFluid !== "lava") lava.setType("lava");

        const selection = selectOperations(machine, lava, settings);
        const operations = selection.operations;
        if (operations.length === 0) {
            const message = selection.hasKnownInput
                ? selection.outputBlocked
                    ? "Output Full"
                    : selection.tankBlocked
                      ? "Lava Tank Full"
                      : "Needs More Input"
                : selection.hasAnyInput
                  ? "Invalid Input"
                  : "Insert Process Item";
            resetProcess(machine, lava, settings.machine.energy_cost, message, "");
            return;
        }

        const signature = operations
            .map((operation) => `${operation.slot}:${operation.stack.typeId}`)
            .join("|");
        if (machine.entity.getDynamicProperty(RECIPE_KEY) !== signature) {
            setDynamicString(machine.entity, RECIPE_KEY, signature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const result = advanceSlotCycle(machine, {
            progress: machine.getProgress(),
            operations,
        });

        let processed = 0;
        if (result.completed) {
            for (const operation of operations) {
                consumeInput(
                    machine.container,
                    operation.slot,
                    operation.stack,
                    resourceCost(
                        machine,
                        operation.crafts * operation.recipe.input.amount,
                        operation.recipe.input.amount,
                    ),
                );
                insertPooledOutput(
                    machine.container,
                    OUTPUT_SLOTS,
                    operation.recipe.output.id,
                    operation.crafts * operation.recipe.output.amount,
                );
                lava.add(operation.crafts * operation.recipe.lavaGain);
                processed += operation.crafts;
            }
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", result.cost);
        display(machine, lava, result.cost);

        const active = result.energyUsed > 0 || result.completed;
        renderStatus(
            machine,
            active,
            active ? "Crucible Running" : "No Energy",
            machine.shouldUpdateUI
                ? [
                      {
                          title: "Crucible Information",
                          lines: [
                              `§r§7Selected Slots §f${operations.length}/${parallelLimit(machine, INPUT_SLOTS.length)}`,
                              `§r§7Processed §f${processed}`,
                              `§r§7Lava Gain §f+${FluidStorage.formatFluid(operations.reduce((sum, operation) => sum + operation.crafts * operation.recipe.lavaGain, 0))}`,
                              `§r§7Stored §f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
                          ],
                      },
                  ]
                : undefined,
            { energyCost: result.cost },
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function selectOperations(machine, lava, settings) {
    const operations = [];
    const reservation = createPooledOutputReservation(machine.container, OUTPUT_SLOTS);
    const limit = parallelLimit(machine, INPUT_SLOTS.length);
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    let hasAnyInput = false;
    let hasKnownInput = false;
    let outputBlocked = false;
    let tankBlocked = false;
    let availableLavaSpace = lava.getFreeSpace();

    for (const slot of INPUT_SLOTS) {
        const stack = machine.container.getItem(slot);
        if (!stack) continue;

        hasAnyInput = true;
        const recipe = getIndustrialCrucibleRecipe(stack.typeId);
        if (!recipe) continue;

        hasKnownInput = true;
        if (stack.amount < recipe.input.amount) continue;
        const crafts = Math.min(Math.floor(stack.amount / recipe.input.amount), batch);
        const lavaAmount = crafts * recipe.lavaGain;
        if (lavaAmount > availableLavaSpace) {
            tankBlocked = true;
            continue;
        }
        if (
            !reservation.reserve(
                recipe.output.id,
                crafts * recipe.output.amount,
                DEFAULT_STACK_SIZE,
            )
        ) {
            outputBlocked = true;
            continue;
        }
        operations.push({
            slot,
            stack,
            recipe,
            crafts,
            cost: recipe.energyCost || settings.machine.energy_cost,
        });
        availableLavaSpace -= lavaAmount;
        if (operations.length >= limit) break;
    }

    return { operations, hasAnyInput, hasKnownInput, outputBlocked, tankBlocked };
}

function consumeInput(container, slot, item, amount) {
    if (amount >= item.amount) {
        container.setItem(slot, undefined);
        return;
    }

    item.amount -= amount;
    container.setItem(slot, item);
}

function resetProcess(machine, lava, cost, message, recipeKey) {
    setDynamicString(machine.entity, RECIPE_KEY, recipeKey);
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, lava, cost, message);
}

function pauseProcess(machine, lava, cost, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    display(machine, lava, cost);
    renderStatus(
        machine,
        false,
        message,
        [
            {
                title: "Crucible Information",
                lines: [
                    `\u00A7r\u00A77Lava Stored \u00A7f${FluidStorage.formatFluid(lava.get())} / ${FluidStorage.formatFluid(lava.getCap())}`,
                ],
            },
        ],
        { energyCost: cost },
    );
}

function display(machine, lava, cost) {
    if (!machine.shouldUpdateUI) return;
    displayProgress(machine, cost);
    lava.display(LAVA_DISPLAY_SLOT);
}

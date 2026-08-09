// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceLanes } from "../../ATCore/processing/index.js";
import { getCryoStabilizerRecipe } from "../../config/recipes/cryoStabilizer.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:cryo_stabilizer";
const INVENTORY_SIZE = 28;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2,
    3, -1, -1, -1,
    7,
    9, 10, -1, -1,
    4, -1, -1, -1,
    11, 12, 13, 14, 15, 16,
    17, 18, 19, 20, 21, 22,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15,
    7, 8, 9, 10, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
];
const LAYOUT_KEY = "ascendant:cryo_stabilizer_layout";
const LAYOUT_VERSION = "output_last_v2";
const INPUT_SLOTS = [3, 4, 5, 6];
const CRYOFLUID_DISPLAY_SLOT = 7;
const OUTPUT_SLOTS = [12, 13, 14, 15];
const PROGRESS_PREFIX = "ascendant:cryo_stabilizer_progress_";
const RESOURCE_IO_RATE = 64000;
const itemMaximums = new Map();

registerIOInterface(ID, {
    items: {
        buttonSlots: [16, 17, 18, 19, 20, 21],
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
    liquids: {
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

            machine.blockSlots([CRYOFLUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);

            const cryofluid = new FluidStorage(machine.entity, 0);
            cryofluid.setType("cryofluid");
            cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, LEGACY_SLOT_LAYOUT,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;

        const cryofluid = new FluidStorage(machine.entity, 0);
        if (cryofluid.getType() === "empty") cryofluid.setType("cryofluid");
        machine.processIO({ maxFluidMovedPerTick: RESOURCE_IO_RATE });

        const lanes = [];
        let fluidBudget = cryofluid.getType() === "cryofluid" ? cryofluid.get() : 0;
        let occupied = 0;
        let blocked = 0;

        for (let index = 0; index < INPUT_SLOTS.length; index++) {
            const inputSlot = INPUT_SLOTS[index];
            const outputSlot = OUTPUT_SLOTS[index];
            const input = machine.container.getItem(inputSlot);
            const progressKey = `${PROGRESS_PREFIX}${index}`;
            if (!input) {
                setDynamicNumber(machine.entity, progressKey, 0);
                continue;
            }
            occupied++;

            const recipe = getCryoStabilizerRecipe(input.typeId);
            if (!recipe || input.amount < recipe.input.amount) {
                setDynamicNumber(machine.entity, progressKey, 0);
                blocked++;
                continue;
            }

            const output = machine.container.getItem(outputSlot);
            const inputCrafts = Math.floor(input.amount / recipe.input.amount);
            const fluidCrafts = recipe.cryofluid > 0
                ? Math.floor(fluidBudget / recipe.cryofluid)
                : Number.MAX_SAFE_INTEGER;
            const outputCrafts = getOutputCraftCapacity(
                output,
                recipe.output.id,
                recipe.output.amount,
                getItemMaximum(recipe.output.id),
            );
            const maxCrafts = Math.min(
                inputCrafts,
                fluidCrafts,
                outputCrafts,
                Math.max(1, Math.floor(machine.boosts.process_batch ?? 1)),
            );
            if (maxCrafts <= 0) {
                blocked++;
                continue;
            }

            const reservedFluid = maxCrafts * recipe.cryofluid;
            fluidBudget -= reservedFluid;
            lanes.push({
                index,
                inputSlot,
                outputSlot,
                input,
                output,
                recipe,
                progressKey,
                progress: getDynamicNumber(machine.entity, progressKey),
                cost: recipe.cost ?? settings.machine.energy_cost,
                maxCrafts,
                batch: machine.boosts.process_batch,
            });
        }

        const energyUsed = advanceLanes(machine, lanes);
        let completed = 0;
        let fluidUsed = 0;
        for (const lane of lanes) {
            if (lane.processCount > 0) {
                consumeInput(machine.container, lane.inputSlot, lane.input, lane.processCount * lane.recipe.input.amount);
                insertOutput(
                    machine.container,
                    lane.outputSlot,
                    lane.output,
                    lane.recipe.output.id,
                    lane.processCount * lane.recipe.output.amount,
                );
                fluidUsed += lane.processCount * lane.recipe.cryofluid;
                completed += lane.processCount;
            }
            setDynamicNumber(machine.entity, lane.progressKey, lane.progress);
        }
        if (fluidUsed > 0) cryofluid.consume(fluidUsed);

        const displayCost = lanes[0]?.cost ?? settings.machine.energy_cost;
        const displayProgressValue = lanes.length > 0
            ? Math.max(...lanes.map((lane) => lane.progress))
            : 0;
        setDynamicNumber(machine.entity, "dorios:progress_0", displayProgressValue);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", displayCost);
        displayProgress(machine, displayCost);
        if (machine.shouldUpdateUI) cryofluid.display(CRYOFLUID_DISPLAY_SLOT);

        const running = energyUsed > 0 || completed > 0;
        const message = completed > 0
            ? `Stabilized ${completed}`
            : running ? "Stabilizing" : occupied === 0 ? "Insert Items" : blocked > 0 ? "Blocked" : "No Energy";
        renderStatus(machine, running, message, [{
            title: "Stabilizer Information",
            lines: [
                `\u00A7r\u00A77Active Lanes \u00A7f${lanes.length}/4`,
                `\u00A7r\u00A77Blocked Lanes \u00A7f${blocked}`,
                `\u00A7r\u00A77Cryofluid \u00A7f${FluidStorage.formatFluid(cryofluid.get())} / ${FluidStorage.formatFluid(cryofluid.getCap())}`,
            ],
        }], { energyCost: displayCost });
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function getDynamicNumber(entity, key) {
    return Math.max(0, Number(entity.getDynamicProperty(key)) || 0);
}

function getItemMaximum(typeId) {
    if (itemMaximums.has(typeId)) return itemMaximums.get(typeId);
    let maximum = 0;
    try {
        maximum = new ItemStack(typeId, 1).maxAmount;
    } catch {}
    itemMaximums.set(typeId, maximum);
    return maximum;
}

function getOutputCraftCapacity(item, typeId, amountPerCraft, emptyMaximum) {
    if (!item) return Math.floor(emptyMaximum / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
}

function consumeInput(container, slot, item, amount) {
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

function insertOutput(container, slot, item, typeId, amount) {
    if (item) {
        item.amount += amount;
        container.setItem(slot, item);
    } else {
        container.setItem(slot, new ItemStack(typeId, amount));
    }
}

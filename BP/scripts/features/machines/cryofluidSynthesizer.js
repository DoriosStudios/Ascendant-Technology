// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    CRYOFLUID_SYNTHESIS_RECIPE,
    getCryofluidSynthesisInputValue,
} from "../../config/recipes/cryofluidSynthesizer.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:cryofluid_synthesizer";
const INVENTORY_SIZE = 29;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13,
    14, 15, -1, -1,
    16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27,
];
const TITANIUM_INPUTS = [3, 4, 5, 6];
const LAPIS_INPUTS = [7, 8, 9, 10];
const WATER_DISPLAY_SLOT = 11;
const CRYOFLUID_DISPLAY_SLOT = 12;
const TITANIUM_CREDIT_KEY = "ascendant:cryofluid_titanium_credit";
const LAPIS_CREDIT_KEY = "ascendant:cryofluid_lapis_credit";
const RESOURCE_IO_RATE = 128000;

registerIOInterface(ID, {
    items: {
        buttonSlots: [17, 18, 19, 20, 21, 22],
        anyInputSlots: [...TITANIUM_INPUTS, ...LAPIS_INPUTS],
        anyOutputSlots: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: TITANIUM_INPUTS },
            { id: "input_2", inputSlots: LAPIS_INPUTS },
            { id: "input_3", inputSlots: [...TITANIUM_INPUTS, ...LAPIS_INPUTS] },
        ],
    },
    liquids: {
        buttonSlots: [23, 24, 25, 26, 27, 28],
        anyInputIndices: [0],
        anyOutputIndices: [1],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
            { id: "output_1", outputIndices: [1] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([WATER_DISPLAY_SLOT, CRYOFLUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", CRYOFLUID_SYNTHESIS_RECIPE.energyCost);

            const water = new FluidStorage(machine.entity, 0);
            const cryofluid = new FluidStorage(machine.entity, 1);
            water.setType("water");
            cryofluid.setType("cryofluid");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        const water = new FluidStorage(machine.entity, 0);
        const cryofluid = new FluidStorage(machine.entity, 1);
        if (water.getType() === "empty") water.setType("water");
        if (cryofluid.getType() === "empty") cryofluid.setType("cryofluid");
        machine.processIO({ maxFluidMovedPerTick: RESOURCE_IO_RATE });

        const titaniumGroup = CRYOFLUID_SYNTHESIS_RECIPE.inputs.titanium;
        const lapisGroup = CRYOFLUID_SYNTHESIS_RECIPE.inputs.lapis;
        const titaniumValue = getStoredInputValue(
            machine,
            TITANIUM_INPUTS,
            titaniumGroup,
            TITANIUM_CREDIT_KEY,
        );
        const lapisValue = getStoredInputValue(
            machine,
            LAPIS_INPUTS,
            lapisGroup,
            LAPIS_CREDIT_KEY,
        );
        const inputCrafts = Math.min(
            Math.floor(titaniumValue / titaniumGroup.requiredValue),
            Math.floor(lapisValue / lapisGroup.requiredValue),
        );

        if (inputCrafts <= 0) {
            resetProcess(machine, water, cryofluid, "Needs Materials", titaniumValue, lapisValue);
            return;
        }

        const waterCrafts = Math.floor(water.get() / CRYOFLUID_SYNTHESIS_RECIPE.water);
        const outputCrafts = Math.floor(cryofluid.getFreeSpace() / CRYOFLUID_SYNTHESIS_RECIPE.cryofluid);
        if (waterCrafts <= 0 || outputCrafts <= 0) {
            pauseProcess(
                machine,
                water,
                cryofluid,
                waterCrafts <= 0 ? "Needs Water" : "Cryofluid Tank Full",
                titaniumValue,
                lapisValue,
            );
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: CRYOFLUID_SYNTHESIS_RECIPE.energyCost,
            maxCrafts: Math.min(inputCrafts, waterCrafts, outputCrafts),
            batch: machine.boosts.process_batch,
        });

        if (result.processCount > 0) {
            consumeInputValue(
                machine,
                TITANIUM_INPUTS,
                titaniumGroup,
                TITANIUM_CREDIT_KEY,
                result.processCount * titaniumGroup.requiredValue,
            );
            consumeInputValue(
                machine,
                LAPIS_INPUTS,
                lapisGroup,
                LAPIS_CREDIT_KEY,
                result.processCount * lapisGroup.requiredValue,
            );
            water.consume(result.processCount * CRYOFLUID_SYNTHESIS_RECIPE.water);
            cryofluid.add(result.processCount * CRYOFLUID_SYNTHESIS_RECIPE.cryofluid);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", CRYOFLUID_SYNTHESIS_RECIPE.energyCost);
        displayResources(machine, water, cryofluid);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            result.processCount > 0 ? `Synthesized ${result.processCount}` : active ? "Synthesizing Cryofluid" : "No Energy",
            machine.shouldUpdateUI ? [{ title: "Synthesis Information", lines: statusLines(titaniumValue, lapisValue, water, cryofluid) }] : undefined,
            { energyCost: CRYOFLUID_SYNTHESIS_RECIPE.energyCost, batch: 1 },
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function getStoredInputValue(machine, slots, group, creditKey) {
    let total = Math.max(0, Number(machine.entity.getDynamicProperty(creditKey)) || 0);
    for (const slot of slots) {
        const item = machine.container.getItem(slot);
        total += (item?.amount ?? 0) * getCryofluidSynthesisInputValue(group, item?.typeId);
    }
    return total;
}

function consumeInputValue(machine, slots, group, creditKey, requested) {
    let credit = Math.max(0, Number(machine.entity.getDynamicProperty(creditKey)) || 0);
    let remaining = Math.max(0, Math.floor(requested));
    const creditUsed = Math.min(credit, remaining);
    credit -= creditUsed;
    remaining -= creditUsed;

    for (const slot of slots) {
        if (remaining <= 0) break;
        const item = machine.container.getItem(slot);
        const value = getCryofluidSynthesisInputValue(group, item?.typeId);
        if (!item || value <= 0) continue;

        const amount = Math.min(item.amount, Math.ceil(remaining / value));
        const consumedValue = amount * value;
        if (amount >= item.amount) machine.container.setItem(slot, undefined);
        else {
            item.amount -= amount;
            machine.container.setItem(slot, item);
        }
        remaining -= consumedValue;
    }

    if (remaining < 0) credit += -remaining;
    setDynamicNumber(machine.entity, creditKey, credit);
    return remaining <= 0;
}

function resetProcess(machine, water, cryofluid, message, titanium, lapis) {
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, water, cryofluid, message, titanium, lapis);
}

function pauseProcess(machine, water, cryofluid, message, titanium, lapis) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", CRYOFLUID_SYNTHESIS_RECIPE.energyCost);
    displayResources(machine, water, cryofluid);
    renderStatus(
        machine,
        false,
        message,
        machine.shouldUpdateUI ? [{ title: "Synthesis Information", lines: statusLines(titanium, lapis, water, cryofluid) }] : undefined,
        { energyCost: CRYOFLUID_SYNTHESIS_RECIPE.energyCost, batch: 1 },
    );
}

function displayResources(machine, water, cryofluid) {
    displayProgress(machine, CRYOFLUID_SYNTHESIS_RECIPE.energyCost);
    if (!machine.shouldUpdateUI) return;
    water.display(WATER_DISPLAY_SLOT);
    cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
}

function statusLines(titanium, lapis, water, cryofluid) {
    return [
        `\u00A7r\u00A77Titanium Value \u00A7f${titanium}/${CRYOFLUID_SYNTHESIS_RECIPE.inputs.titanium.requiredValue}`,
        `\u00A7r\u00A77Lapis Value \u00A7f${lapis}/${CRYOFLUID_SYNTHESIS_RECIPE.inputs.lapis.requiredValue}`,
        `\u00A7r\u00A77Water \u00A7f${FluidStorage.formatFluid(water.get())} / ${FluidStorage.formatFluid(water.getCap())}`,
        `\u00A7r\u00A77Cryofluid \u00A7f${FluidStorage.formatFluid(cryofluid.get())} / ${FluidStorage.formatFluid(cryofluid.getCap())}`,
    ];
}

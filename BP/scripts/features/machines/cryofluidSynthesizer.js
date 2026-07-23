// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { ButtonManager, FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:cryofluid_synthesizer";
const MODE_BUTTON_SLOT = 3;
const TITANIUM_INPUTS = [4, 5, 6, 7];
const LAPIS_INPUTS = [8, 9, 10, 11];
const WATER_DISPLAY_SLOT = 12;
const CRYOFLUID_DISPLAY_SLOT = 13;
const MODE_KEY = "ascendant:cryofluid_synthesizer_mode";
const RESOURCE_IO_RATE = 128000;

const modes = new Map([
    ["stable", {
        id: "stable",
        title: "Stable",
        cost: 6000,
        titanium: 1,
        lapis: 1,
        water: 1000,
        cryofluid: 1000,
        ignoreSpeed: false,
    }],
    ["impulse", {
        id: "impulse",
        title: "Impulse",
        cost: 18000,
        titanium: 4,
        lapis: 2,
        water: 4000,
        cryofluid: 4000,
        ignoreSpeed: true,
    }],
]);

function getMode(entity) {
    return modes.get(entity.getDynamicProperty(MODE_KEY)) ?? modes.get("stable");
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const next = getMode(entity).id === "stable" ? modes.get("impulse") : modes.get("stable");
    setDynamicString(entity, MODE_KEY, next.id);
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return `\u00A7r${next.id === "stable" ? "\u00A7a" : "\u00A7c"}${next.title} Mode`;
});

registerIOInterface(ID, {
    items: {
        buttonSlots: [16, 17, 18, 19, 20, 21],
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
        buttonSlots: [22, 23, 24, 25, 26, 27],
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
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aStable Mode");
            setDynamicString(machine.entity, MODE_KEY, "stable");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);

            const water = new FluidStorage(machine.entity, 0);
            const cryofluid = new FluidStorage(machine.entity, 1);
            water.setType("water");
            cryofluid.setType("cryofluid");
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const water = new FluidStorage(machine.entity, 0);
        const cryofluid = new FluidStorage(machine.entity, 1);
        if (water.getType() === "empty") water.setType("water");
        if (cryofluid.getType() === "empty") cryofluid.setType("cryofluid");

        machine.processIO({ maxFluidMovedPerTick: RESOURCE_IO_RATE });
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        const titanium = countInputs(machine.container, TITANIUM_INPUTS, isTitanium);
        const lapis = countInputs(machine.container, LAPIS_INPUTS, isLapis);
        const inputCrafts = Math.min(
            Math.floor(titanium / mode.titanium),
            Math.floor(lapis / mode.lapis),
        );

        if (inputCrafts <= 0) {
            resetProcess(machine, water, cryofluid, mode, "Needs Titanium + Lapis", titanium, lapis);
            return;
        }

        const waterCrafts = Math.floor(water.get() / mode.water);
        const outputCrafts = Math.floor(cryofluid.getFreeSpace() / mode.cryofluid);
        if (waterCrafts <= 0 || outputCrafts <= 0) {
            pauseProcess(
                machine,
                water,
                cryofluid,
                mode,
                waterCrafts <= 0 ? "Needs Water" : "Cryofluid Tank Full",
                titanium,
                lapis,
            );
            return;
        }

        const speed = Math.max(Number.EPSILON, Number(machine.boosts.speed) || 1);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: mode.cost,
            maxCrafts: Math.min(inputCrafts, waterCrafts, outputCrafts),
            rateMultiplier: mode.ignoreSpeed ? 1 / speed : 1,
        });

        if (result.processCount > 0) {
            consumeInputs(machine.container, TITANIUM_INPUTS, isTitanium, result.processCount * mode.titanium);
            consumeInputs(machine.container, LAPIS_INPUTS, isLapis, result.processCount * mode.lapis);
            water.consume(result.processCount * mode.water);
            cryofluid.add(result.processCount * mode.cryofluid);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", mode.cost);
        displayResources(machine, water, cryofluid, mode.cost);

        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(
            machine,
            active,
            active ? "Synthesizing Cryofluid" : "No Energy",
            machine.shouldUpdateUI ? statusLines(mode, titanium, lapis, water, cryofluid) : undefined,
        );
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

function isTitanium(item) {
    return item?.typeId === "utilitycraft:titanium" || item?.typeId === "utilitycraft:raw_titanium";
}

function isLapis(item) {
    return item?.typeId === "minecraft:lapis_lazuli";
}

function countInputs(container, slots, predicate) {
    let total = 0;
    for (const slot of slots) {
        const item = container.getItem(slot);
        if (predicate(item)) total += item.amount;
    }
    return total;
}

function consumeInputs(container, slots, predicate, amount) {
    let remaining = amount;
    for (const slot of slots) {
        if (remaining <= 0) return;
        const item = container.getItem(slot);
        if (!predicate(item)) continue;

        const consumed = Math.min(item.amount, remaining);
        remaining -= consumed;
        if (consumed >= item.amount) container.setItem(slot, undefined);
        else {
            item.amount -= consumed;
            container.setItem(slot, item);
        }
    }
}

function resetProcess(machine, water, cryofluid, mode, message, titanium, lapis) {
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    pauseProcess(machine, water, cryofluid, mode, message, titanium, lapis);
}

function pauseProcess(machine, water, cryofluid, mode, message, titanium, lapis) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", mode.cost);
    displayResources(machine, water, cryofluid, mode.cost);
    renderStatus(
        machine,
        false,
        message,
        machine.shouldUpdateUI ? statusLines(mode, titanium, lapis, water, cryofluid) : undefined,
    );
}

function displayResources(machine, water, cryofluid, cost) {
    displayProgress(machine, cost);
    if (!machine.shouldUpdateUI) return;
    water.display(WATER_DISPLAY_SLOT);
    cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
}

function statusLines(mode, titanium, lapis, water, cryofluid) {
    return [
        `\u00A7r\u00A77Mode: \u00A7f${mode.title}`,
        `\u00A7r\u00A77Titanium: \u00A7f${titanium} / ${mode.titanium}`,
        `\u00A7r\u00A77Lapis: \u00A7f${lapis} / ${mode.lapis}`,
        `\u00A7r\u00A77Water: \u00A7f${FluidStorage.formatFluid(water.get())} / ${FluidStorage.formatFluid(water.getCap())}`,
        `\u00A7r\u00A77Cryofluid: \u00A7f${FluidStorage.formatFluid(cryofluid.get())} / ${FluidStorage.formatFluid(cryofluid.getCap())}`,
    ];
}

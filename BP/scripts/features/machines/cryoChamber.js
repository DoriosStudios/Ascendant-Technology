// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { advanceProcess, processCryoCoolingGrid } from "../../ATCore/processing/index.js";
import {
    cryoChamberGeneration,
    getCryoChamberCatalyst,
    getCryoChamberLapisSource,
} from "../../config/recipes/cryoChamber.js";
import {
    getCryoCoolingRecipe,
    isCryoCoolingOutput,
} from "../../config/recipes/cryoCooling.js";
import { getCryoStabilizerRecipe } from "../../config/recipes/cryoStabilizer.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:cryo_chamber";
const STABILIZER_STATUS_SLOT = 1;
const STABILIZER_PROGRESS_SLOT = 2;
const STABILIZER_INPUT_SLOT = 3;
const COOLING_SLOTS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const WATER_CONTAINER_SLOT = 13;
const WATER_DISPLAY_SLOT = 14;
const CRYO_CONTAINER_SLOT = 15;
const CRYO_DISPLAY_SLOT = 16;
const TITANIUM_SLOT = 17;
const LAPIS_SLOT = 18;
const COOLING_STATUS_SLOT = 21;
const GENERATOR_STATUS_SLOT = 22;
const STABILIZER_OUTPUT_SLOT = 23;
const STABILIZER_RECIPE_KEY = "ascendant:cryo_chamber_stabilizer_recipe";
const GENERATOR_PROGRESS_KEY = "ascendant:cryo_chamber_generator_progress";
const RESOURCE_IO_RATE = 64000;
const itemMaximums = new Map();

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [24, 25, 26, 27, 28, 29],
        anyInputSlots: [
            STABILIZER_INPUT_SLOT,
            ...COOLING_SLOTS,
            WATER_CONTAINER_SLOT,
            CRYO_CONTAINER_SLOT,
            TITANIUM_SLOT,
            LAPIS_SLOT,
        ],
        anyOutputSlots: [STABILIZER_OUTPUT_SLOT, ...COOLING_SLOTS, CRYO_CONTAINER_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [STABILIZER_INPUT_SLOT] },
            { id: "input_2", inputSlots: COOLING_SLOTS },
            { id: "input_3", inputSlots: [WATER_CONTAINER_SLOT, CRYO_CONTAINER_SLOT] },
            { id: "input_4", inputSlots: [TITANIUM_SLOT] },
            { id: "input_5", inputSlots: [LAPIS_SLOT] },
            {
                id: "input_6",
                inputSlots: [
                    STABILIZER_INPUT_SLOT,
                    ...COOLING_SLOTS,
                    WATER_CONTAINER_SLOT,
                    CRYO_CONTAINER_SLOT,
                    TITANIUM_SLOT,
                    LAPIS_SLOT,
                ],
            },
            { id: "output_1", outputSlots: [STABILIZER_OUTPUT_SLOT] },
            { id: "output_2", outputSlots: COOLING_SLOTS },
            { id: "output_3", outputSlots: [CRYO_CONTAINER_SLOT] },
            { id: "output_4", outputSlots: [STABILIZER_OUTPUT_SLOT, ...COOLING_SLOTS, CRYO_CONTAINER_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [30, 31, 32, 33, 34, 35],
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

            machine.blockSlots([WATER_DISPLAY_SLOT, CRYO_DISPLAY_SLOT]);
            setUiItem(machine.container, STABILIZER_PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            setDynamicString(machine.entity, STABILIZER_RECIPE_KEY, "");
            setDynamicNumber(machine.entity, GENERATOR_PROGRESS_KEY, 0);

            const water = new FluidStorage(machine.entity, 0);
            const cryofluid = new FluidStorage(machine.entity, 1);
            water.setType("water");
            cryofluid.setType("cryofluid");
            water.display(WATER_DISPLAY_SLOT);
            cryofluid.display(CRYO_DISPLAY_SLOT);
            setModuleStatus(machine, STABILIZER_STATUS_SLOT, "Cryo Stabilizer", "Insert Unstable Item");
            setModuleStatus(machine, COOLING_STATUS_SLOT, "Cooling Grid", "Load Cooling Items");
            setModuleStatus(machine, GENERATOR_STATUS_SLOT, "Cryofluid Generator", "Insert Titanium + Lapis");
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
        processFluidContainer(machine.container, WATER_CONTAINER_SLOT, water);
        processFluidContainer(machine.container, CRYO_CONTAINER_SLOT, cryofluid);

        const stabilizer = processStabilizer(machine, cryofluid, settings);
        const cooling = processCryoCoolingGrid(machine, water, {
            slots: COOLING_SLOTS,
            progressPrefix: "ascendant:cryo_chamber_cooling_progress_",
            getRecipe: getCryoCoolingRecipe,
            isOutput: isCryoCoolingOutput,
        });
        const generator = processGenerator(machine, water, cryofluid, settings);

        if (machine.shouldUpdateUI) {
            machine.energy.display(0);
            water.display(WATER_DISPLAY_SLOT);
            cryofluid.display(CRYO_DISPLAY_SLOT);
            setModuleStatus(
                machine,
                COOLING_STATUS_SLOT,
                "Cooling Grid",
                cooling.running ? `${cooling.activeCount} Active` : cooling.blockedCount > 0 ? `${cooling.blockedCount} Blocked` : "Idle",
                [
                    `\u00A7r\u00A77Ready: \u00A7f${cooling.readyCount}`,
                    `\u00A7r\u00A77Water: \u00A7f${FluidStorage.formatFluid(water.get())}`,
                ],
                cooling.running,
            );
        }

        setRunning(machine, stabilizer.active || cooling.running || generator.active);
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function processStabilizer(machine, cryofluid, settings) {
    const input = machine.container.getItem(STABILIZER_INPUT_SLOT);
    if (!input) return resetStabilizer(machine, settings.machine.energy_cost, "Insert Unstable Item");

    const recipe = getCryoStabilizerRecipe(input.typeId);
    if (!recipe || input.amount < recipe.input.amount) {
        return resetStabilizer(machine, recipe?.cost ?? settings.machine.energy_cost, recipe ? "Needs More Input" : "Invalid Input");
    }

    if (machine.entity.getDynamicProperty(STABILIZER_RECIPE_KEY) !== recipe.id) {
        setDynamicString(machine.entity, STABILIZER_RECIPE_KEY, recipe.id);
        setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    }

    const output = machine.container.getItem(STABILIZER_OUTPUT_SLOT);
    const outputCrafts = getOutputCapacity(output, recipe.output.id, recipe.output.amount);
    const fluidCrafts = recipe.cryofluid > 0
        ? Math.floor(cryofluid.get() / recipe.cryofluid)
        : Number.MAX_SAFE_INTEGER;
    if (outputCrafts <= 0 || fluidCrafts <= 0) {
        return pauseStabilizer(
            machine,
            recipe.cost,
            fluidCrafts <= 0 ? "Needs Cryofluid" : output?.typeId === recipe.output.id ? "Output Full" : "Output Conflict",
            recipe,
            cryofluid,
        );
    }

    const result = advanceProcess(machine, {
        progress: machine.getProgress(),
        cost: recipe.cost,
        maxCrafts: Math.min(
            Math.floor(input.amount / recipe.input.amount),
            fluidCrafts,
            outputCrafts,
        ),
        rateMultiplier: getRateMultiplier(settings.machine.rate_speed_base, recipe.cost, recipe.ticks),
    });

    if (result.processCount > 0) {
        consumeStack(machine.container, STABILIZER_INPUT_SLOT, result.processCount * recipe.input.amount);
        cryofluid.consume(result.processCount * recipe.cryofluid);
        insertStack(machine.container, STABILIZER_OUTPUT_SLOT, recipe.output.id, result.processCount * recipe.output.amount);
    }

    setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", recipe.cost);
    displayProgress(machine, recipe.cost, STABILIZER_PROGRESS_SLOT);
    const active = result.energyUsed > 0 || result.processCount > 0;
    setModuleStatus(
        machine,
        STABILIZER_STATUS_SLOT,
        "Cryo Stabilizer",
        active ? "Stabilizing" : "No Energy",
        [
            `\u00A7r\u00A77Output: \u00A7f${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
            `\u00A7r\u00A77Cryofluid: \u00A7f${FluidStorage.formatFluid(recipe.cryofluid)}`,
        ],
        active,
    );
    return { active };
}

function resetStabilizer(machine, cost, message) {
    setDynamicString(machine.entity, STABILIZER_RECIPE_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    return pauseStabilizer(machine, cost, message);
}

function pauseStabilizer(machine, cost, message, recipe, cryofluid) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost, STABILIZER_PROGRESS_SLOT);
    const lines = recipe ? [
        `\u00A7r\u00A77Output: \u00A7f${DoriosLib.text.formatIdentifier(recipe.output.id)}`,
        `\u00A7r\u00A77Stored: \u00A7f${FluidStorage.formatFluid(cryofluid?.get() ?? 0)}`,
    ] : undefined;
    setModuleStatus(machine, STABILIZER_STATUS_SLOT, "Cryo Stabilizer", message, lines);
    return { active: false };
}

function processGenerator(machine, water, cryofluid, settings) {
    const titanium = machine.container.getItem(TITANIUM_SLOT);
    const lapis = machine.container.getItem(LAPIS_SLOT);
    const catalyst = titanium ? getCryoChamberCatalyst(titanium.typeId) : undefined;
    const lapisSource = lapis ? getCryoChamberLapisSource(lapis.typeId) : undefined;
    if (!catalyst || !lapisSource) {
        return resetGenerator(machine, "Insert Titanium + Lapis");
    }

    const generation = getCryofluidGeneration(catalyst, lapisSource);
    const maxCrafts = Math.min(
        Math.floor(titanium.amount / catalyst.input.amount),
        Math.floor(lapis.amount / lapisSource.input.amount),
        Math.floor(water.get() / generation.water),
        Math.floor(cryofluid.getFreeSpace() / generation.cryofluid),
    );
    if (maxCrafts <= 0) {
        const message = water.get() < generation.water
            ? "Needs Water"
            : cryofluid.getFreeSpace() < generation.cryofluid ? "Cryofluid Full" : "Needs Materials";
        return pauseGenerator(machine, message, water, cryofluid, catalyst, lapisSource, generation);
    }

    const result = advanceProcess(machine, {
        progress: getDynamicNumber(machine.entity, GENERATOR_PROGRESS_KEY),
        cost: cryoChamberGeneration.cost,
        maxCrafts,
        rateMultiplier: getRateMultiplier(
            settings.machine.rate_speed_base,
            cryoChamberGeneration.cost,
            cryoChamberGeneration.ticks,
        ),
    });

    if (result.processCount > 0) {
        consumeStack(machine.container, TITANIUM_SLOT, result.processCount * catalyst.input.amount);
        consumeStack(machine.container, LAPIS_SLOT, result.processCount * lapisSource.input.amount);
        water.consume(result.processCount * generation.water);
        cryofluid.add(result.processCount * generation.cryofluid);
    }

    setDynamicNumber(machine.entity, GENERATOR_PROGRESS_KEY, result.progress);
    const active = result.energyUsed > 0 || result.processCount > 0;
    setModuleStatus(
        machine,
        GENERATOR_STATUS_SLOT,
        "Cryofluid Generator",
        active ? "Generating" : "No Energy",
        generatorLines(water, cryofluid, catalyst, lapisSource, generation),
        active,
    );
    return { active };
}

function resetGenerator(machine, message) {
    setDynamicNumber(machine.entity, GENERATOR_PROGRESS_KEY, 0);
    setModuleStatus(machine, GENERATOR_STATUS_SLOT, "Cryofluid Generator", message);
    return { active: false };
}

function pauseGenerator(machine, message, water, cryofluid, catalyst, lapisSource, generation) {
    setModuleStatus(
        machine,
        GENERATOR_STATUS_SLOT,
        "Cryofluid Generator",
        message,
        generatorLines(water, cryofluid, catalyst, lapisSource, generation),
    );
    return { active: false };
}

function generatorLines(water, cryofluid, catalyst, lapisSource, generation) {
    return [
        `\u00A7r\u00A77Catalyst: \u00A7f${catalyst ? DoriosLib.text.formatIdentifier(catalyst.input.id) : "None"}`,
        `\u00A7r\u00A77Lapis: \u00A7f${lapisSource ? DoriosLib.text.formatIdentifier(lapisSource.input.id) : "None"}`,
        ...(generation ? [
            `\u00A7r\u00A77Per Cycle: \u00A7f${FluidStorage.formatFluid(generation.cryofluid)}`,
        ] : []),
        `\u00A7r\u00A77Water: \u00A7f${FluidStorage.formatFluid(water.get())}`,
        `\u00A7r\u00A77Cryofluid: \u00A7f${FluidStorage.formatFluid(cryofluid.get())}`,
    ];
}

function getCryofluidGeneration(catalyst, lapisSource) {
    const multiplier = Math.max(0.01, Number(lapisSource.yieldMultiplier) || 1);
    return {
        water: Math.max(1, Math.round(catalyst.water * multiplier)),
        cryofluid: Math.max(1, Math.round(catalyst.cryofluid * multiplier)),
    };
}

function processFluidContainer(container, slot, tank) {
    const item = container.getItem(slot);
    if (!item || item.amount !== 1) return false;
    const result = tank.fluidItem(item.typeId);
    if (result === false) return false;
    container.setItem(slot, result ? new ItemStack(result, 1) : undefined);
    return true;
}

function setModuleStatus(machine, slot, title, message, lines = [], active = false) {
    if (!machine.shouldUpdateUI) return;
    machine.setLabel([
        `\u00A7r${active ? "\u00A7a" : "\u00A7e"}${title}`,
        `\u00A7r\u00A77${message}`,
        ...lines,
    ], slot);
}

function getOutputCapacity(item, typeId, amountPerCraft) {
    if (!item) return Math.floor(getItemMaximum(typeId) / amountPerCraft);
    if (item.typeId !== typeId) return 0;
    return Math.floor(Math.max(0, item.maxAmount - item.amount) / amountPerCraft);
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

function consumeStack(container, slot, amount) {
    const item = container.getItem(slot);
    if (!item) return;
    if (amount >= item.amount) container.setItem(slot, undefined);
    else {
        item.amount -= amount;
        container.setItem(slot, item);
    }
}

function insertStack(container, slot, typeId, amount) {
    const item = container.getItem(slot);
    if (!item) container.setItem(slot, new ItemStack(typeId, amount));
    else {
        item.amount += amount;
        container.setItem(slot, item);
    }
}

function getRateMultiplier(baseRate, cost, ticks) {
    return cost / (Math.max(Number.EPSILON, baseRate) * Math.max(1, ticks));
}

function getDynamicNumber(entity, key) {
    return Math.max(0, Number(entity.getDynamicProperty(key)) || 0);
}

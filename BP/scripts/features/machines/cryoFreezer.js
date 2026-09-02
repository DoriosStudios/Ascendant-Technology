// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import { processCryoCoolingGrid } from "../../ATCore/processing/index.js";
import {
    getCryoCoolingRecipe,
    isCryoCoolingOutput,
} from "../../config/recipes/cryoCooling.js";
import { renderStatus } from "./runtime.js";

const ID = "utilitycraft:cryo_freezer";
const INVENTORY_SIZE = 32;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    -1, -1,
    18, 19, 20, 21, 22, 23,
    24, 25, 26, 27, 28, 29,
];
const COOLANT_DISPLAY_SLOT = 2;
const FREEZER_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const FLUID_IO_RATE = 64000;

registerIOInterface(ID, {
    automaticDefaults: true,
    items: {
        buttonSlots: [20, 21, 22, 23, 24, 25],
        anyInputSlots: FREEZER_SLOTS,
        anyOutputSlots: FREEZER_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: FREEZER_SLOTS },
            { id: "output_1", outputSlots: FREEZER_SLOTS },
        ],
    },
    liquids: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
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

            machine.blockSlots([COOLANT_DISPLAY_SLOT]);
            const coolant = new FluidStorage(machine.entity, 0);
            coolant.display(COOLANT_DISPLAY_SLOT);
            renderStatus(machine, false, "Load Freezer Grid", [{
                title: "Freezer Grid",
                lines: [`§r§7Occupied Lanes §f0/15`, `§r§7Coolant §fNone`],
            }], { energyCost: settings.machine.energy_cost });
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });
        const coolant = new FluidStorage(machine.entity, 0);
        const result = processCryoCoolingGrid(machine, coolant, {
            slots: FREEZER_SLOTS,
            progressPrefix: "ascendant:cryo_freezer_progress_",
            getRecipe: getCryoCoolingRecipe,
            isOutput: isCryoCoolingOutput,
        });

        if (machine.shouldUpdateUI) coolant.display(COOLANT_DISPLAY_SLOT);
        renderStatus(
            machine,
            result.running,
            result.running ? "Freezing" : result.blockedCount > 0 ? "Grid Blocked" : "Idle",
            machine.shouldUpdateUI ? [{ title: "Freezer Grid", lines: statusLines(result, coolant) }] : undefined,
            { energyCost: settings.machine.energy_cost },
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function statusLines(result, coolant) {
    return [
        `\u00A7r\u00A77Active Lanes \u00A7f${result.activeCount}/15`,
        `\u00A7r\u00A77Completed \u00A7f${result.readyCount}`,
        `\u00A7r\u00A77Blocked \u00A7f${result.blockedCount}`,
        `\u00A7r\u00A77Coolant \u00A7f${DoriosLib.text.formatIdentifier(coolant.getType())}`,
        `\u00A7r\u00A77Stored \u00A7f${FluidStorage.formatFluid(coolant.get())} / ${FluidStorage.formatFluid(coolant.getCap())}`,
    ];
}

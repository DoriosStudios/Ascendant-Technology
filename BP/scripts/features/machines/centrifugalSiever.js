// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    advanceProcess,
    consumePooledInput,
    countPooledInput,
    getEligibleSieveDrops,
    hasSieveOutputCapacity,
    insertSieveOutputs,
    resolveMeshProfile,
    rollSieveDrops,
    selectSieveRecipe,
} from "../../ATCore/processing/index.js";
import { displayProgress, renderStatus, setDynamicNumber, setDynamicString, setUiItem } from "./runtime.js";

const ID = "utilitycraft:centrifugal_siever";
const INPUTS = Object.freeze([3, 4, 5, 6]);
const MESH_SLOT = 7;
const STEAM_DISPLAY_SLOT = 8;
const OUTPUTS = Object.freeze([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
const LOCK_KEY = "ascendant:centrifugal_siever_input";
const STEAM_PER_CRAFT = 125;

registerIOInterface(ID, {
    items: {
        buttonSlots: [26, 27, 28, 29, 30, 31],
        anyInputSlots: [...INPUTS, MESH_SLOT],
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUTS },
            { id: "input_2", inputSlots: [MESH_SLOT] },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
    gases: {
        buttonSlots: [32, 33, 34, 35, 36, 37],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

function reset(machine, cost) {
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    setDynamicString(machine.entity, LOCK_KEY, "");
}

DoriosLib.registry.blockComponent(ID, {
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
            reset(machine, settings.machine.energy_cost);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const steam = new GasStorage(machine.entity, 0);
        if (steam.getType() === "empty") steam.setType("steam");
        machine.processIO();

        const mesh = resolveMeshProfile(machine.container.getItem(MESH_SLOT));
        if (!mesh) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Insert Mesh");
            return;
        }

        const locked = String(machine.entity.getDynamicProperty(LOCK_KEY) ?? "");
        const selected = selectSieveRecipe(machine.container, INPUTS, locked);
        if (!selected) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Insert Sieveable Items");
            return;
        }

        const eligibleDrops = getEligibleSieveDrops(selected.recipe, mesh);
        if (eligibleDrops.length === 0) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Mesh Tier Too Low");
            return;
        }

        const availableInput = countPooledInput(machine.container, INPUTS, selected.inputTypeId);
        if (availableInput <= 0) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Insert Sieveable Items");
            return;
        }

        if (!hasSieveOutputCapacity(machine.container, OUTPUTS, eligibleDrops)) {
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(machine, false, "Output Full");
            return;
        }

        setDynamicString(machine.entity, LOCK_KEY, selected.inputTypeId);
        const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
        const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
        const maxCrafts = Math.min(availableInput, batch * intervalScale);
        const steamNeeded = maxCrafts * STEAM_PER_CRAFT;
        const steamActive = steam.getType() === "steam" && steam.get() >= steamNeeded;
        const cost = settings.machine.energy_cost * (steamActive ? 1.25 : 1);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            batch,
            maxCrafts,
            rateMultiplier: steamActive ? 1.5 : 1,
        });

        let produced = 0;
        if (result.processCount > 0) {
            const rolled = rollSieveDrops(eligibleDrops, result.processCount, mesh);
            produced = insertSieveOutputs(machine.container, OUTPUTS, rolled).insertedTotal;
            consumePooledInput(machine.container, INPUTS, selected.inputTypeId, result.processCount);
            if (steamActive) steam.consume(result.processCount * STEAM_PER_CRAFT);
            if (countPooledInput(machine.container, INPUTS, selected.inputTypeId) <= 0) {
                setDynamicString(machine.entity, LOCK_KEY, "");
            }
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
        displayProgress(machine, cost);
        if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
        const active = result.energyUsed > 0 || result.processCount > 0;
        renderStatus(machine, active, active ? (steamActive ? "Steam Boost" : "Sieving") : "No Energy", [
            `§r§7Mesh tier: ${mesh.tier}`,
            `§r§7Produced: ${produced}`,
        ]);
    },

    onPlayerBreak: Machine.onDestroy,
});

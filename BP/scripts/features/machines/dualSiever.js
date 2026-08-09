// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { ButtonManager, GasStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
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

const ID = "utilitycraft:dual_siever";
const INVENTORY_SIZE = 46;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1, -1,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
];
const MODE_KEY = "ascendant:dual_siever_mode";
const MODE_BUTTON_SLOT = 7;
const LANE_B_PROGRESS_SLOT = 8;
const STEAM_DISPLAY_SLOT = 9;
const STEAM_PER_CRAFT = 125;
const OUTPUTS = Object.freeze([
    14, 15, 16, 17, 18,
    19, 20, 21, 22, 23,
    24, 25, 26, 27, 28,
    29, 30, 31, 32, 33,
]);
const LANES = Object.freeze([
    Object.freeze({ index: 0, name: "A", inputs: Object.freeze([3]), meshSlot: 4, progressSlot: 2 }),
    Object.freeze({ index: 1, name: "B", inputs: Object.freeze([5]), meshSlot: 6, progressSlot: LANE_B_PROGRESS_SLOT }),
]);

function getMode(entity) {
    return entity.getDynamicProperty(MODE_KEY) === "shared" ? "shared" : "individual";
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const next = getMode(entity) === "individual" ? "shared" : "individual";
    setDynamicString(entity, MODE_KEY, next);
    setDynamicNumber(entity, "dorios:progress_0", 0);
    setDynamicNumber(entity, "dorios:progress_1", 0);
    return next === "shared" ? "§r§6SHR" : "§r§aIND";
});

registerIOInterface(ID, {
    items: {
        buttonSlots: [34, 35, 36, 37, 38, 39],
        anyInputSlots: [3, 4, 5, 6],
        anyOutputSlots: OUTPUTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [3] },
            { id: "input_2", inputSlots: [4] },
            { id: "input_3", inputSlots: [5] },
            { id: "input_4", inputSlots: [6] },
            { id: "input_5", inputSlots: [3, 5] },
            { id: "input_6", inputSlots: [4, 6] },
            { id: "output_1", outputSlots: OUTPUTS },
        ],
    },
    gases: {
        buttonSlots: [40, 41, 42, 43, 44, 45],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

function laneLockKey(index) {
    return `ascendant:dual_siever_input_${index}`;
}

function createLane(machine, definition, settings, steamBudget) {
    const mesh = resolveMeshProfile(machine.container.getItem(definition.meshSlot));
    const locked = String(machine.entity.getDynamicProperty(laneLockKey(definition.index)) ?? "");
    const selected = selectSieveRecipe(machine.container, definition.inputs, locked);
    const eligibleDrops = selected && mesh ? getEligibleSieveDrops(selected.recipe, mesh) : Object.freeze([]);
    const availableInput = selected
        ? countPooledInput(machine.container, definition.inputs, selected.inputTypeId)
        : 0;
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const maxCrafts = Math.min(availableInput, batch * intervalScale);
    const outputReady = eligibleDrops.length > 0
        && hasSieveOutputCapacity(machine.container, OUTPUTS, eligibleDrops);
    const ready = Boolean(mesh && selected && eligibleDrops.length > 0 && maxCrafts > 0 && outputReady);
    const steamNeeded = ready ? maxCrafts * STEAM_PER_CRAFT : 0;
    const steamActive = steamNeeded > 0 && steamBudget >= steamNeeded;
    const cost = settings.machine.energy_cost * (steamActive ? 1.25 : 1);

    let reason = "Ready";
    if (!mesh) reason = "Insert Mesh";
    else if (!selected || maxCrafts <= 0) reason = "Insert Items";
    else if (eligibleDrops.length === 0) reason = "Mesh Tier Too Low";
    else if (!outputReady) reason = "Output Full";

    return {
        ...definition,
        mesh,
        selected,
        eligibleDrops,
        maxCrafts,
        batch,
        ready,
        reason,
        cost,
        steamNeeded,
        steamActive,
        progress: machine.getProgress(definition.index),
        energyUsed: 0,
        crafted: 0,
        produced: 0,
    };
}

/** Charges independent lanes once under a weighted shared rate budget. */
function chargeIndividualLanes(machine, lanes) {
    const active = lanes.filter((lane) => lane.ready && lane.progress < lane.cost);
    if (active.length === 0) return 0;
    const consumption = Math.max(Number.EPSILON, machine.boosts.consumption ?? 1);
    const weightTotal = active.reduce((sum, lane) => sum + (lane.steamActive ? 1.5 : 1), 0);
    let budget = Math.min(machine.energy.get(), machine.rate * (weightTotal / active.length));
    let used = 0;

    for (let pass = 0; pass < 2 && budget > 0; pass++) {
        const pending = active.filter((lane) => lane.progress < lane.cost);
        let remainingWeight = pending.reduce((sum, lane) => sum + (lane.steamActive ? 1.5 : 1), 0);
        for (let index = 0; index < pending.length && budget > 0; index++) {
            const lane = pending[index];
            const weight = lane.steamActive ? 1.5 : 1;
            const share = budget * weight / Math.max(weight, remainingWeight);
            const requested = (lane.cost - lane.progress) * consumption;
            const granted = Math.min(share, requested);
            lane.progress += granted / consumption;
            lane.energyUsed += granted;
            budget -= granted;
            used += granted;
            remainingWeight -= weight;
        }
    }

    if (used > 0) machine.energy.consume(used);
    return used;
}

function commitLane(machine, lane, steam) {
    if (!lane.ready || lane.progress < lane.cost) return false;
    if (!hasSieveOutputCapacity(machine.container, OUTPUTS, lane.eligibleDrops)) return false;

    const rolled = rollSieveDrops(lane.eligibleDrops, lane.maxCrafts, lane.mesh);
    lane.produced = insertSieveOutputs(machine.container, OUTPUTS, rolled).insertedTotal;
    consumePooledInput(machine.container, lane.inputs, lane.selected.inputTypeId, lane.maxCrafts);
    if (lane.steamActive) steam.consume(lane.steamNeeded);
    lane.progress = Math.max(0, lane.progress - lane.cost);
    lane.crafted = lane.maxCrafts;
    if (countPooledInput(machine.container, lane.inputs, lane.selected.inputTypeId) <= 0) {
        setDynamicString(machine.entity, laneLockKey(lane.index), "");
    }
    return true;
}

function resetInactiveLane(machine, lane) {
    if (lane.ready || lane.reason === "Output Full") return;
    lane.progress = 0;
    setDynamicString(machine.entity, laneLockKey(lane.index), "");
}

function syncDisplays(machine, steam, mode, lanes, sharedCost) {
    if (!machine.shouldUpdateUI) return;
    steam.display(STEAM_DISPLAY_SLOT);
    if (mode === "shared") {
        displayProgress(machine, sharedCost, 2, 0);
        if (machine.container.getItem(LANE_B_PROGRESS_SLOT)) machine.container.setItem(LANE_B_PROGRESS_SLOT, undefined);
        return;
    }
    if (!machine.container.getItem(LANE_B_PROGRESS_SLOT)) {
        setUiItem(machine.container, LANE_B_PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
    }
    displayProgress(machine, lanes[0]?.cost ?? 1, 2, 0);
    displayProgress(machine, lanes[1]?.cost ?? 1, LANE_B_PROGRESS_SLOT, 1);
}

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, STEAM_DISPLAY_SLOT, "utilitycraft:steam_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "§r§aIND");
            setUiItem(machine.container, LANE_B_PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            const steam = new GasStorage(machine.entity, 0);
            steam.setType("steam");
            setDynamicString(machine.entity, MODE_KEY, "individual");
            for (let index = 0; index < LANES.length; index++) {
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, 0);
                setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, settings.machine.energy_cost);
                setDynamicString(machine.entity, laneLockKey(index), "");
            }
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
        let steamBudget = steam.getType() === "steam" ? steam.get() : 0;
        const lanes = new Array(LANES.length);
        for (let index = 0; index < LANES.length; index++) {
            const lane = createLane(machine, LANES[index], settings, steamBudget);
            lanes[index] = lane;
            if (lane.steamActive) steamBudget -= lane.steamNeeded;
            if (lane.selected) setDynamicString(machine.entity, laneLockKey(index), lane.selected.inputTypeId);
            resetInactiveLane(machine, lane);
        }

        let energyUsed = 0;
        let crafted = 0;
        let produced = 0;
        let sharedCost = settings.machine.energy_cost;

        if (mode === "shared") {
            const bothMatch = lanes.every((lane) => lane.ready)
                && lanes[0].selected.inputTypeId === lanes[1].selected.inputTypeId;
            const ready = bothMatch ? lanes : [];
            sharedCost = Math.max(1, Math.ceil(ready.reduce((sum, lane) => sum + lane.cost, 0) * 1.35));
            if (ready.length > 0) {
                const result = advanceProcess(machine, {
                    progress: machine.getProgress(0),
                    cost: sharedCost,
                    batch: 1,
                    maxCrafts: 1,
                    rateMultiplier: 0.72 * (ready.some((lane) => lane.steamActive) ? 1.5 : 1),
                });
                energyUsed = result.energyUsed;
                let progress = result.progress;
                if (result.processCount > 0) {
                    const combined = new Map();
                    for (let index = 0; index < ready.length; index++) {
                        const lane = ready[index];
                        const rolled = rollSieveDrops(lane.eligibleDrops, lane.maxCrafts, lane.mesh);
                        for (const [itemId, amount] of rolled) {
                            combined.set(itemId, (combined.get(itemId) ?? 0) + amount);
                        }
                        consumePooledInput(machine.container, lane.inputs, lane.selected.inputTypeId, lane.maxCrafts);
                        if (lane.steamActive) steam.consume(lane.steamNeeded);
                        lane.crafted = lane.maxCrafts;
                        crafted += lane.maxCrafts;
                        if (countPooledInput(machine.container, lane.inputs, lane.selected.inputTypeId) <= 0) {
                            setDynamicString(machine.entity, laneLockKey(lane.index), "");
                        }
                    }
                    produced = insertSieveOutputs(machine.container, OUTPUTS, combined).insertedTotal;
                }
                setDynamicNumber(machine.entity, "dorios:progress_0", progress);
            } else {
                setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            }
            setDynamicNumber(machine.entity, "dorios:progress_1", 0);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", sharedCost);
        } else {
            energyUsed = chargeIndividualLanes(machine, lanes);
            for (let index = 0; index < lanes.length; index++) {
                const lane = lanes[index];
                if (commitLane(machine, lane, steam)) {
                    crafted += lane.crafted;
                    produced += lane.produced;
                }
                setDynamicNumber(machine.entity, `dorios:progress_${index}`, lane.progress);
                setDynamicNumber(machine.entity, `dorios:energy_cost_${index}`, lane.cost);
            }
        }

        syncDisplays(machine, steam, mode, lanes, sharedCost);
        const readyCount = lanes.filter((lane) => lane.ready).length;
        const active = energyUsed > 0 || crafted > 0;
        const sharedMismatch = mode === "shared"
            && lanes.every((lane) => lane.ready)
            && lanes[0].selected.inputTypeId !== lanes[1].selected.inputTypeId;
        const firstProblem = sharedMismatch
            ? "Inputs Must Match"
            : (lanes.find((lane) => !lane.ready)?.reason ?? "Insert Items");
        const title = active
            ? (lanes.some((lane) => lane.steamActive) ? "Steam Boost" : "Sieving")
            : (readyCount > 0 ? "No Energy" : firstProblem);
        const steamRateMultiplier = mode === "shared"
            ? 0.72 * (lanes.some((lane) => lane.steamActive) ? 1.5 : 1)
            : (readyCount > 0
                ? lanes.filter((lane) => lane.ready).reduce((sum, lane) => sum + (lane.steamActive ? 1.5 : 1), 0) / readyCount
                : 1);
        const displayedCost = mode === "shared"
            ? sharedCost
            : Math.max(settings.machine.energy_cost, ...lanes.map((lane) => lane.cost));
        renderStatus(machine, active, title, [{
            title: "Siever Information",
            lines: [
                `§r§7Mode §f${mode === "shared" ? "Shared" : "Individual"}`,
                `§r§7Ready Lanes §f${readyCount}/2`,
                `§r§7Steam Lanes §f${lanes.filter((lane) => lane.steamActive).length}/2`,
                `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                `§r§7Processed §f${crafted}`,
                `§r§7Output §f${produced}`,
            ],
        }], {
            energyCost: displayedCost,
            rateMultiplier: steamRateMultiplier,
            batch: mode === "shared" ? 1 : machine.boosts.process_batch,
        });
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

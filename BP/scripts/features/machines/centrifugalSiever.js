// @ts-check

import { parallelLimit, resourceCost } from "../../ATCore/machinery/upgradeEffects.js";

import { GasStorage, registerIOInterface } from "DoriosCore/index.js";
import { Machine, registerATMachine } from "../../ATCore/machinery/atMachine.js";
import {
    advanceSlotCycle,
    getEligibleSieveDrops,
    hasSieveOutputCapacity,
    insertSieveOutputs,
    resolveMeshProfile,
    rollSieveDrops,
    sieveRecipes,
} from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderStatus,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:centrifugal_siever";
const INVENTORY_SIZE = 40;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -1, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
];
const INPUTS = Object.freeze([3, 4, 5, 6]);
const MESH_SLOT = 7;
const STEAM_DISPLAY_SLOT = 8;
const OUTPUTS = Object.freeze([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
const LOCK_KEY = "ascendant:centrifugal_siever_input";
const STEAM_PER_CRAFT = 125;

function selectOperations(machine, mesh, settings) {
    const operations = [];
    const limit = parallelLimit(machine, INPUTS.length);
    const batch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const intervalScale = Math.max(1, Math.floor(machine.processingInterval / 4));
    const craftLimit = batch * intervalScale;
    let hasInput = false;
    let hasRecipe = false;
    let meshBlocked = false;
    let outputBlocked = false;

    for (const slot of INPUTS) {
        const input = machine.container.getItem(slot);
        if (!input) continue;
        hasInput = true;
        const recipe = sieveRecipes.get(input.typeId);
        if (!recipe) continue;
        hasRecipe = true;
        const eligibleDrops = getEligibleSieveDrops(recipe, mesh);
        if (eligibleDrops.length === 0) {
            meshBlocked = true;
            continue;
        }
        if (!hasSieveOutputCapacity(machine.container, OUTPUTS, eligibleDrops)) {
            outputBlocked = true;
            continue;
        }
        operations.push({
            slot,
            input,
            recipe,
            eligibleDrops,
            crafts: Math.min(input.amount, craftLimit),
            cost: settings.machine.energy_cost,
        });
        if (operations.length >= limit) break;
    }
    return { operations, hasInput, hasRecipe, meshBlocked, outputBlocked, batch };
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
        buttonSlots: [28, 29, 30, 31, 32, 33],
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
        buttonSlots: [34, 35, 36, 37, 38, 39],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [{ id: "disabled" }, { id: "input_1", inputIndices: [0] }],
    },
});

function reset(machine, cost) {
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    setDynamicString(machine.entity, LOCK_KEY, "");
}

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
            reset(machine, settings.machine.energy_cost);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;
        const steam = new GasStorage(machine.entity, 0);
        if (steam.getType() === "empty") steam.setType("steam");
        machine.processIO();

        const mesh = resolveMeshProfile(machine.container.getItem(MESH_SLOT));
        if (!mesh) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            renderStatus(
                machine,
                false,
                "Insert Mesh",
                [
                    {
                        title: "Sieving Information",
                        lines: [
                            `§r§7Mesh §fNone`,
                            `§r§7Steam Boost §fInactive`,
                            `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                        ],
                    },
                ],
                { energyCost: settings.machine.energy_cost },
            );
            return;
        }

        const selection = selectOperations(machine, mesh, settings);
        const operations = selection.operations;
        if (operations.length === 0) {
            reset(machine, settings.machine.energy_cost);
            displayProgress(machine, settings.machine.energy_cost);
            if (machine.shouldUpdateUI) steam.display(STEAM_DISPLAY_SLOT);
            const message = selection.outputBlocked
                ? "Output Full"
                : selection.meshBlocked
                  ? "Mesh Tier Too Low"
                  : selection.hasInput
                    ? "Invalid Input"
                    : "Insert Sieveable Items";
            renderStatus(
                machine,
                false,
                message,
                [
                    {
                        title: "Sieving Information",
                        lines: [
                            `§r§7Selected Slots §f0/${parallelLimit(machine, INPUTS.length)}`,
                            `§r§7Mesh Tier §f${mesh.tier}`,
                            `§r§7Steam Boost §fInactive`,
                            `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                        ],
                    },
                ],
                { energyCost: settings.machine.energy_cost },
            );
            return;
        }

        const signature = `${mesh.itemTypeId}|${operations.map((operation) => `${operation.slot}:${operation.input.typeId}`).join("|")}`;
        if (machine.entity.getDynamicProperty(LOCK_KEY) !== signature) {
            setDynamicString(machine.entity, LOCK_KEY, signature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }
        const totalCrafts = operations.reduce((sum, operation) => sum + operation.crafts, 0);
        const steamNeeded = totalCrafts * STEAM_PER_CRAFT;
        const steamActive = steam.getType() === "steam" && steam.get() >= steamNeeded;
        const cycleOperations = operations.map((operation) => ({
            ...operation,
            cost: settings.machine.energy_cost * (steamActive ? 1.25 : 1),
        }));
        const result = advanceSlotCycle(machine, {
            progress: machine.getProgress(),
            operations: cycleOperations,
            rateMultiplier: steamActive ? 1.5 : 1,
        });

        let produced = 0;
        if (result.completed) {
            const rolled = new Map();
            for (const operation of operations) {
                for (const [typeId, amount] of rollSieveDrops(
                    operation.eligibleDrops,
                    operation.crafts,
                    mesh,
                )) {
                    rolled.set(typeId, (rolled.get(typeId) ?? 0) + amount);
                }
                consumeSlot(
                    machine.container,
                    operation.slot,
                    operation.input,
                    resourceCost(machine, operation.crafts, 1),
                );
            }
            produced = insertSieveOutputs(machine.container, OUTPUTS, rolled).insertedTotal;
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
            active ? (steamActive ? "Steam Boost" : "Sieving") : "No Energy",
            [
                {
                    title: "Sieving Information",
                    lines: [
                        `§r§7Selected Slots §f${operations.length}/${parallelLimit(machine, INPUTS.length)}`,
                        `§r§7Mesh Tier §f${mesh.tier}`,
                        `§r§7Produced §f${produced}`,
                        `§r§7Steam Boost §f${steamActive ? "x1.50" : "Inactive"}`,
                        `§r§7Steam Stored §f${GasStorage.formatGas(steam.get())} / ${GasStorage.formatGas(steam.getCap())}`,
                    ],
                },
            ],
            {
                energyCost: result.cost,
                rateMultiplier: steamActive ? 1.5 : 1,
                batch: selection.batch,
            },
        );
    },

    onPlayerBreak: Machine.onDestroy,
});

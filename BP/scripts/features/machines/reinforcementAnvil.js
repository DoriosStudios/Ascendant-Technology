// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { ButtonManager, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    applyDurabilityRepair,
    applyReinforcement,
    getReinforcementModuleLevel,
    getReinforcementPoints,
    getReinforcementTarget,
    installReinforcementRuntime,
} from "../../ATCore/enchanting/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:reinforcement_anvil";
const REPAIR_MODE = "repair";
const REINFORCE_MODE = "reinforce";
const MODE_KEY = "ascendant:reinforcement_anvil_mode";
const SIGNATURE_KEY = "ascendant:reinforcement_anvil_signature";
const REPAIR_COST = 8_000;
const REINFORCE_COST = 14_000;
const MODE_BUTTON_SLOT = 3;
const INPUT_SLOT = 4;
const MODULE_SLOT = 5;
const OUTPUT_SLOT = 6;

installReinforcementRuntime();

registerIOInterface(ID, {
    items: {
        buttonSlots: [11, 12, 13, 14, 15, 16],
        anyInputSlots: [INPUT_SLOT, MODULE_SLOT],
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "input_2", inputSlots: [MODULE_SLOT] },
            { id: "input_3", inputSlots: [INPUT_SLOT, MODULE_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
        ],
    },
});

function getMode(entity) {
    return entity.getDynamicProperty(MODE_KEY) === REINFORCE_MODE
        ? REINFORCE_MODE
        : REPAIR_MODE;
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const next = getMode(entity) === REPAIR_MODE ? REINFORCE_MODE : REPAIR_MODE;
    setDynamicString(entity, MODE_KEY, next);
    resetOperation(entity);
    return next === REPAIR_MODE ? "\u00A7r\u00A7aRepair" : "\u00A7r\u00A79Reinforce";
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([9, 10]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aRepair");
            setDynamicString(machine.entity, MODE_KEY, REPAIR_MODE);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", REPAIR_COST);
            resetOperation(machine.entity);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const mode = getMode(machine.entity);
        const cost = mode === REPAIR_MODE ? REPAIR_COST : REINFORCE_COST;
        const input = machine.container.getItem(INPUT_SLOT);

        if (!input) {
            resetOperation(machine.entity);
            showState(machine, cost, false, "Insert Item", mode);
            return;
        }
        if (input.amount !== 1) {
            resetOperation(machine.entity);
            showState(machine, cost, false, "Split Stack", mode, input.typeId);
            return;
        }
        if (machine.container.getItem(OUTPUT_SLOT)) {
            showState(machine, cost, false, "Output Full", mode, input.typeId);
            return;
        }

        const durability = getDurability(input);
        if (!durability) {
            resetOperation(machine.entity);
            showState(machine, cost, false, "Invalid Item", mode, input.typeId);
            return;
        }

        let moduleLevel = 0;
        let target = 0;
        if (mode === REPAIR_MODE) {
            if (Number(durability.damage) <= 0) {
                resetOperation(machine.entity);
                showState(machine, cost, false, "Already Repaired", mode, input.typeId, "No damage");
                return;
            }
        } else {
            moduleLevel = getReinforcementModuleLevel(machine.container.getItem(MODULE_SLOT));
            target = getReinforcementTarget(durability, moduleLevel);
            if (target <= 0) {
                resetOperation(machine.entity);
                showState(machine, cost, false, "Need Reinforcement Module", mode, input.typeId);
                return;
            }

            const current = getReinforcementPoints(input);
            if (current >= target) {
                resetOperation(machine.entity);
                showState(machine, cost, false, "Target Reached", mode, input.typeId, `${current}/${target}`);
                return;
            }
        }

        syncOperation(machine.entity, createSignature(mode, input, durability, moduleLevel));
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost,
            batch: 1,
            maxCrafts: 1,
        });

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        if (result.processCount > 0) {
            const completed = mode === REPAIR_MODE
                ? applyDurabilityRepair(input)
                : applyReinforcement(input, moduleLevel);

            if (!completed) {
                resetOperation(machine.entity);
                showState(machine, cost, false, "Operation Failed", mode, input.typeId);
                return;
            }

            machine.container.setItem(INPUT_SLOT, undefined);
            machine.container.setItem(OUTPUT_SLOT, completed.stack);
            resetOperation(machine.entity);
            const resultText = mode === REPAIR_MODE
                ? `${completed.before} -> ${completed.after} damage`
                : `${completed.before} -> ${completed.after}`;
            showState(
                machine,
                cost,
                true,
                mode === REPAIR_MODE ? "Repaired" : "Reinforced",
                mode,
                input.typeId,
                resultText,
            );
            return;
        }

        const running = result.energyUsed > 0;
        showState(
            machine,
            cost,
            running,
            running ? (mode === REPAIR_MODE ? "Repairing" : "Reinforcing") : "No Energy",
            mode,
            input.typeId,
            mode === REPAIR_MODE ? "Restore 25%" : `${getReinforcementPoints(input)}/${target}`,
        );
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

function syncOperation(entity, signature) {
    if (entity.getDynamicProperty(SIGNATURE_KEY) === signature) return;
    setDynamicString(entity, SIGNATURE_KEY, signature);
    setDynamicNumber(entity, "dorios:progress_0", 0);
}

function resetOperation(entity) {
    setDynamicString(entity, SIGNATURE_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
}

function createSignature(mode, input, durability, moduleLevel) {
    return `${mode}|${input.typeId}|${durability.damage}|${getReinforcementPoints(input)}|${moduleLevel}`;
}

function showState(machine, cost, running, title, mode, itemTypeId = "", target = "") {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);
    machine.setLabel([
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${title}`,
        `\u00A7r\u00A77Mode: ${mode === REPAIR_MODE ? "Repair" : "Reinforce"}`,
        `\u00A7r\u00A77Item: ${formatItem(itemTypeId)}`,
        ...(target ? [`\u00A7r\u00A77Target: ${target}`] : []),
        `\u00A7r\u00A77Cost: ${cost} DE`,
    ]);
}

function getDurability(stack) {
    try {
        return stack.getComponent("minecraft:durability") ?? stack.getComponent("durability");
    } catch {
        return undefined;
    }
}

function formatItem(typeId) {
    if (!typeId) return "-";
    const value = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

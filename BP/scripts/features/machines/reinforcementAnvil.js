// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    applyDurabilityRepair,
    applyReinforcement,
    getReinforcementMaximum,
    getReinforcementModuleLevel,
    getReinforcementPoints,
    getReinforcementTarget,
    installReinforcementRuntime,
} from "../../ATCore/enchanting/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    renderMachineInfo,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:reinforcement_anvil";
const INVENTORY_SIZE = 14;
const LEGACY_SLOT_LAYOUT_15 = [
    0, 1, 2, 4, 5, 7, 8, -1, 9, 10, 11, 12, 13, 14,
];
const LEGACY_SLOT_LAYOUT_17 = [
    0, 1, 2, 4, 5, 7, 8, -1, 11, 12, 13, 14, 15, 16,
];
const SIGNATURE_KEY = "ascendant:reinforcement_anvil_signature";
const REPAIR_COST = 8_000;
const REINFORCE_COST = 14_000;
const ITEM_SLOT = 3;
const MODULE_SLOT = 4;

installReinforcementRuntime();

registerIOInterface(ID, {
    items: {
        buttonSlots: [8, 9, 10, 11, 12, 13],
        anyInputSlots: [ITEM_SLOT, MODULE_SLOT],
        anyOutputSlots: [ITEM_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [ITEM_SLOT] },
            { id: "input_2", inputSlots: [MODULE_SLOT] },
            { id: "input_3", inputSlots: [ITEM_SLOT, MODULE_SLOT] },
            { id: "output_1", outputSlots: [ITEM_SLOT] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", REPAIR_COST);
            resetOperation(machine.entity);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const legacyLayout = machine.container.size >= 17
            ? LEGACY_SLOT_LAYOUT_17
            : LEGACY_SLOT_LAYOUT_15;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, legacyLayout)) return;

        machine.processIO();

        const input = machine.container.getItem(ITEM_SLOT);
        const module = machine.container.getItem(MODULE_SLOT);
        if (!input) {
            resetOperation(machine.entity);
            showState(machine, false, "Insert Item", undefined, module);
            return;
        }
        if (input.amount !== 1) {
            resetOperation(machine.entity);
            showState(machine, false, "Split Stack", undefined, module, input);
            return;
        }

        const operation = inspectOperation(input, module);
        if (!operation) {
            resetOperation(machine.entity);
            showState(machine, false, "Invalid Item", undefined, module, input);
            return;
        }
        if (!operation.repair && !operation.reinforce) {
            resetOperation(machine.entity);
            const title = module && operation.moduleLevel <= 0
                ? "Invalid Module"
                : operation.moduleLevel > 0
                    ? "Fully Processed"
                    : "Fully Repaired";
            showState(machine, false, title, operation, module, input);
            return;
        }

        syncOperation(machine.entity, createSignature(input, operation));
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: operation.cost,
            batch: 1,
            maxCrafts: 1,
        });

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        if (result.processCount > 0) {
            let completedStack = input;
            if (operation.repair) {
                const repaired = applyDurabilityRepair(completedStack);
                if (!repaired) {
                    resetOperation(machine.entity);
                    showState(machine, false, "Operation Failed", operation, module, input);
                    return;
                }
                completedStack = repaired.stack;
            }
            if (operation.reinforce) {
                const reinforced = applyReinforcement(completedStack, operation.moduleLevel);
                if (!reinforced) {
                    resetOperation(machine.entity);
                    showState(machine, false, "Operation Failed", operation, module, input);
                    return;
                }
                completedStack = reinforced.stack;
            }

            machine.container.setItem(ITEM_SLOT, completedStack);
            resetOperation(machine.entity);
            showState(
                machine,
                true,
                operation.repair && operation.reinforce
                    ? "Repaired + Reinforced"
                    : operation.repair ? "Repaired" : "Reinforced",
                inspectOperation(completedStack, module),
                module,
                completedStack,
            );
            return;
        }

        const running = result.energyUsed > 0;
        showState(
            machine,
            running,
            running ? `${formatOperation(operation)}...` : "No Energy",
            operation,
            module,
            input,
        );
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

function inspectOperation(input, module) {
    const durability = getDurability(input);
    if (!durability) return undefined;

    const damage = Math.max(0, Math.floor(Number(durability.damage) || 0));
    const maximum = Math.max(1, Math.floor(Number(durability.maxDurability) || 1));
    const moduleLevel = getReinforcementModuleLevel(module);
    const reinforcement = getReinforcementPoints(input);
    const reinforcementMaximum = getReinforcementMaximum(input);
    const target = getReinforcementTarget(durability, moduleLevel);
    const repair = damage > 0;
    const reinforce = target > 0 && reinforcement < target;

    return {
        cost: (repair ? REPAIR_COST : 0) + (reinforce ? REINFORCE_COST : 0),
        damage,
        maximum,
        moduleLevel,
        reinforcement,
        reinforcementMaximum,
        target,
        repair,
        reinforce,
    };
}

function syncOperation(entity, signature) {
    if (entity.getDynamicProperty(SIGNATURE_KEY) === signature) return;
    setDynamicString(entity, SIGNATURE_KEY, signature);
    setDynamicNumber(entity, "dorios:progress_0", 0);
}

function resetOperation(entity) {
    setDynamicString(entity, SIGNATURE_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
}

function createSignature(input, operation) {
    return `${input.typeId}|${operation.damage}|${operation.reinforcement}|${operation.moduleLevel}`;
}

function showState(machine, running, title, operation, module, input) {
    const cost = operation?.cost ?? REPAIR_COST;
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost || REPAIR_COST);

    const durabilityText = operation
        ? `${operation.maximum - operation.damage}/${operation.maximum}`
        : "-";
    const reserveCap = operation?.target || operation?.reinforcementMaximum || 0;
    const reserveText = operation && reserveCap > 0
        ? `${operation.reinforcement}/${reserveCap}`
        : "-";
    renderMachineInfo(machine, running, title, [{
        title: "Anvil Information",
        lines: [
            `\u00A7r\u00A77Operation \u00A7f${operation ? formatOperation(operation) : "-"}`,
            `\u00A7r\u00A77Item \u00A7f${formatItem(input?.typeId ?? "")}`,
            `\u00A7r\u00A77Durability \u00A7f${durabilityText}`,
            `\u00A7r\u00A77Reserve \u00A7f${reserveText}`,
            `\u00A7r\u00A77Module \u00A7f${formatModule(module, operation?.moduleLevel ?? 0)}`,
        ],
    }], { energyCost: cost, batch: 1 });
}

function formatOperation(operation) {
    if (operation.repair && operation.reinforce) return "Repair + Reinforce";
    if (operation.repair) return "Repair";
    if (operation.reinforce) return "Reinforce";
    return "Complete";
}

function formatModule(module, level) {
    if (!module) return "None (repair only)";
    if (level <= 0) return "Invalid";
    return `Tier ${["", "I", "II", "III"][level]}`;
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

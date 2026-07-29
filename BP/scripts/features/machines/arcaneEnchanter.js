// @ts-check

import { world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, FluidStorage, Machine, registerIOInterface } from "DoriosCore/index.js";
import {
    applyArcaneEnchantPlan,
    buildArcaneEnchantPlan,
    createArcaneEnchantSignature,
    getArcaneEnchantCosts,
    getArcaneRateMultiplier,
    getEnchantabilityModuleLevel,
    isArcaneEnchantPlan,
} from "../../ATCore/enchanting/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:arcane_enchanter";
const INVENTORY_SIZE = 22;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 11, 8, 9,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];
const INPUT_SLOT = 3;
const LAPIS_SLOT = 4;
const MODULE_SLOT = 5;
const OUTPUT_SLOT = 6;
const XP_DISPLAY_SLOT = 7;
const XP_TYPE = "xp";
const OPERATION_SECONDS = 6;
const OPERATION_SIGNATURE_KEY = "ascendant:arcane_enchanter_signature";
const OPERATION_PLAN_KEY = "ascendant:arcane_enchanter_plan";

registerIOInterface(ID, {
    items: {
        buttonSlots: [10, 11, 12, 13, 14, 15],
        anyInputSlots: [INPUT_SLOT, LAPIS_SLOT, MODULE_SLOT],
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [INPUT_SLOT] },
            { id: "input_2", inputSlots: [LAPIS_SLOT] },
            { id: "input_3", inputSlots: [MODULE_SLOT] },
            { id: "input_4", inputSlots: [INPUT_SLOT, LAPIS_SLOT, MODULE_SLOT] },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: [16, 17, 18, 19, 20, 21],
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

/** @type {Map<string, { signature: string, plan: ReturnType<typeof buildArcaneEnchantPlan> }>} */
const operationCache = new Map();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    operationCache.delete(removedEntityId);
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([XP_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);
            clearOperation(machine, true);

            const xpTank = new FluidStorage(machine.entity, 0);
            if (xpTank.get() <= 0) xpTank.setType(XP_TYPE);
            xpTank.display(XP_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        machine.processIO();

        const xpTank = new FluidStorage(machine.entity, 0);
        if (xpTank.get() <= 0 && xpTank.getType() !== XP_TYPE) xpTank.setType(XP_TYPE);

        const input = machine.container.getItem(INPUT_SLOT);
        if (!input) {
            clearOperation(machine, true);
            showState(machine, xpTank, settings.machine.energy_cost, false, "Insert Item");
            return;
        }

        if (input.amount !== 1) {
            clearOperation(machine, true);
            showState(machine, xpTank, settings.machine.energy_cost, false, "Split Stack", {
                input: formatItem(input.typeId),
            });
            return;
        }

        const module = machine.container.getItem(MODULE_SLOT);
        const moduleLevel = getEnchantabilityModuleLevel(module);
        if (moduleLevel <= 0) {
            clearOperation(machine, true);
            showState(machine, xpTank, settings.machine.energy_cost, false, "Need Enchant Module", {
                input: formatItem(input.typeId),
            });
            return;
        }

        const signature = createArcaneEnchantSignature(input, moduleLevel);
        resetChangedOperation(machine, signature);

        const lapis = machine.container.getItem(LAPIS_SLOT);
        if (!lapis || lapis.typeId !== "minecraft:lapis_lazuli" || lapis.amount <= 0) {
            showState(machine, xpTank, settings.machine.energy_cost, false, "Need Lapis", {
                input: formatItem(input.typeId),
                moduleLevel,
            });
            return;
        }

        const output = machine.container.getItem(OUTPUT_SLOT);
        if (output) {
            showState(machine, xpTank, settings.machine.energy_cost, false, "Output Full", {
                input: formatItem(input.typeId),
                target: formatItem(output.typeId),
                moduleLevel,
            });
            return;
        }

        const plan = getOrCreateOperation(machine, input, moduleLevel, signature);
        if (!plan.ready) {
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            showState(machine, xpTank, settings.machine.energy_cost, false, plan.message ?? "Invalid Item", {
                input: formatItem(input.typeId),
                target: plan.targetSummary,
                moduleLevel,
            });
            return;
        }

        if (!plan.changed) {
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            showState(machine, xpTank, settings.machine.energy_cost, false, "Already Enchanted", {
                input: formatItem(input.typeId),
                target: plan.targetSummary,
                moduleLevel,
            });
            return;
        }

        const costs = getArcaneEnchantCosts(
            settings.machine.energy_cost,
            moduleLevel,
            plan.changeCount,
        );
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", costs.energy);

        if (xpTank.getType() !== XP_TYPE) {
            showState(machine, xpTank, costs.energy, false, "Need XP Tank", {
                input: formatItem(input.typeId),
                target: plan.targetSummary,
                moduleLevel,
                xpCost: costs.xp,
            });
            return;
        }

        if (xpTank.get() < costs.xp) {
            showState(machine, xpTank, costs.energy, false, "Need XP", {
                input: formatItem(input.typeId),
                target: plan.targetSummary,
                moduleLevel,
                xpCost: costs.xp,
            });
            return;
        }

        if (machine.energy.get() <= 0) {
            showState(machine, xpTank, costs.energy, false, "No Energy", {
                input: formatItem(input.typeId),
                target: plan.targetSummary,
                moduleLevel,
                xpCost: costs.xp,
            });
            return;
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: costs.energy,
            maxCrafts: 1,
            batch: 1,
            rateMultiplier: getArcaneRateMultiplier(
                settings.machine.rate_speed_base,
                costs.energy,
                OPERATION_SECONDS,
            ),
        });

        if (result.processCount > 0) {
            const enchanted = applyArcaneEnchantPlan(input, plan);
            if (!enchanted || !commitEnchant(machine, xpTank, input, lapis, enchanted, costs.xp)) {
                clearOperation(machine, true);
                showState(machine, xpTank, costs.energy, false, "Enchant Failed", {
                    input: formatItem(input.typeId),
                    target: plan.targetSummary,
                    moduleLevel,
                    xpCost: costs.xp,
                });
                return;
            }

            clearOperation(machine, true);
            showState(machine, xpTank, costs.energy, true, "Enchanted", {
                input: formatItem(enchanted.typeId),
                target: plan.targetSummary,
                moduleLevel,
                xpCost: costs.xp,
            });
            return;
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        showState(machine, xpTank, costs.energy, result.energyUsed > 0, "Enchanting", {
            input: formatItem(input.typeId),
            target: plan.targetSummary,
            moduleLevel,
            xpCost: costs.xp,
        });
    },

    onPlayerBreak(event) {
        Machine.onDestroy(event);
    },
});

/**
 * @param {Machine} machine
 * @param {import("@minecraft/server").ItemStack} input
 * @param {number} moduleLevel
 * @param {string} signature
 * @returns {ReturnType<typeof buildArcaneEnchantPlan>}
 */
function getOrCreateOperation(machine, input, moduleLevel, signature) {
    const cached = operationCache.get(machine.entity.id);
    if (cached?.signature === signature) return cached.plan;

    if (machine.entity.getDynamicProperty(OPERATION_SIGNATURE_KEY) === signature) {
        const persisted = readPersistedPlan(machine.entity.getDynamicProperty(OPERATION_PLAN_KEY));
        if (persisted) {
            operationCache.set(machine.entity.id, { signature, plan: persisted });
            return persisted;
        }
    }

    const plan = buildArcaneEnchantPlan(input, moduleLevel);
    operationCache.set(machine.entity.id, { signature, plan });
    setDynamicString(machine.entity, OPERATION_SIGNATURE_KEY, signature);
    setDynamicString(machine.entity, OPERATION_PLAN_KEY, JSON.stringify(plan));
    return plan;
}

/**
 * @param {Machine} machine
 * @param {string} signature
 */
function resetChangedOperation(machine, signature) {
    const previousSignature = machine.entity.getDynamicProperty(OPERATION_SIGNATURE_KEY);
    if (!previousSignature || previousSignature === signature) return;

    operationCache.delete(machine.entity.id);
    setDynamicString(machine.entity, OPERATION_SIGNATURE_KEY, "");
    setDynamicString(machine.entity, OPERATION_PLAN_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
}

/**
 * @param {Machine} machine
 * @param {boolean} resetProgress
 */
function clearOperation(machine, resetProgress) {
    operationCache.delete(machine.entity.id);
    setDynamicString(machine.entity, OPERATION_SIGNATURE_KEY, "");
    setDynamicString(machine.entity, OPERATION_PLAN_KEY, "");
    if (resetProgress) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof buildArcaneEnchantPlan> | undefined}
 */
function readPersistedPlan(raw) {
    if (typeof raw !== "string" || raw.length === 0) return undefined;

    try {
        const plan = JSON.parse(raw);
        return isArcaneEnchantPlan(plan) ? plan : undefined;
    } catch {
        return undefined;
    }
}

/**
 * @param {Machine} machine
 * @param {FluidStorage} xpTank
 * @param {import("@minecraft/server").ItemStack} input
 * @param {import("@minecraft/server").ItemStack} lapis
 * @param {import("@minecraft/server").ItemStack} output
 * @param {number} xpCost
 * @returns {boolean}
 */
function commitEnchant(machine, xpTank, input, lapis, output, xpCost) {
    const inputBackup = input.clone();
    const lapisBackup = lapis.clone();
    let consumedXp = 0;

    try {
        machine.container.setItem(OUTPUT_SLOT, output);
        machine.container.setItem(INPUT_SLOT, undefined);

        if (lapis.amount <= 1) {
            machine.container.setItem(LAPIS_SLOT, undefined);
        } else {
            const remainingLapis = lapis.clone();
            remainingLapis.amount--;
            machine.container.setItem(LAPIS_SLOT, remainingLapis);
        }

        consumedXp = xpTank.consume(xpCost);
        if (consumedXp !== xpCost) throw new Error("XP changed before commit");
        return true;
    } catch {
        try {
            machine.container.setItem(OUTPUT_SLOT, undefined);
            machine.container.setItem(INPUT_SLOT, inputBackup);
            machine.container.setItem(LAPIS_SLOT, lapisBackup);
            if (consumedXp > 0) xpTank.add(consumedXp);
        } catch {}
        return false;
    }
}

/**
 * @param {Machine} machine
 * @param {FluidStorage} xpTank
 * @param {number} energyCost
 * @param {boolean} running
 * @param {string} message
 * @param {{ input?: string, target?: string, moduleLevel?: number, xpCost?: number }} [context]
 */
function showState(machine, xpTank, energyCost, running, message, context = {}) {
    setRunning(machine, running);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);
    displayProgress(machine, energyCost);
    xpTank.display(XP_DISPLAY_SLOT);

    machine.setLabel([
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${message}`,
        `\u00A7r\u00A77Input: \u00A7f${context.input ?? "-"}`,
        `\u00A7r\u00A77Target: \u00A7f${context.target ?? "-"}`,
        `\u00A7r\u00A77Module: \u00A7fLv.${context.moduleLevel ?? 0}`,
        `\u00A7r\u00A77Cost: \u00A7f${EnergyStorage.formatEnergyToText(energyCost)}`,
        `\u00A7r\u00A77XP Cost: \u00A7f${context.xpCost ?? 0}`,
        `\u00A7r\u00A77XP Tank: \u00A7f${formatXpTank(xpTank)}`,
    ]);
}

/** @param {FluidStorage} tank */
function formatXpTank(tank) {
    return `${Math.floor(tank.get())}/${Math.floor(tank.getCap())}`;
}

/** @param {string} typeId */
function formatItem(typeId) {
    return DoriosLib.text.formatIdentifier(typeId);
}

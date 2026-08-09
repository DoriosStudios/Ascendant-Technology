// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    FluidStorage,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    createDisenchantSignature,
    extractFirstEnchantment,
    getAbsorbedXp,
    readDisenchantments,
    removeAllDisenchantments,
} from "../../ATCore/enchanting/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    ensureMachineInventoryLayout,
    renderMachineInfo,
    setDynamicNumber,
    setDynamicString,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:disenchanter";
const INVENTORY_SIZE = 34;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 7, 8, 9, -1,
    6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21,
];
const OLDER_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 11, 8, 9, -1,
    6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    12, 13, 14, 15, 16, 17,
    18, 19, 20, 21, 22, 23,
];
const PREVIOUS_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 18, 19, 20, 21,
    6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
];
const LAYOUT_KEY = "ascendant:disenchanter_layout";
const LAYOUT_VERSION = "output_last_v2";
const MODE_KEY = "ascendant:disenchanter_mode";
const SIGNATURE_KEY = "ascendant:disenchanter_signature";
const EXTRACTION_MODE = "extraction";
const ABSORPTION_MODE = "absorption";
const EXTRACTION_COST = 10000;
const ABSORPTION_COST = 7000;
const MODE_BUTTON_SLOT = 3;
const SOURCE_SLOT = 4;
const CATALYST_SLOT = 5;
const XP_DISPLAY_SLOT = 6;
const BOOK_OUTPUT_SLOTS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const XP_TYPE = "xp";

registerIOInterface(ID, {
    items: {
        buttonSlots: [22, 23, 24, 25, 26, 27],
        anyInputSlots: [SOURCE_SLOT, CATALYST_SLOT],
        anyOutputSlots: [SOURCE_SLOT, ...BOOK_OUTPUT_SLOTS],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [SOURCE_SLOT] },
            { id: "input_2", inputSlots: [CATALYST_SLOT] },
            { id: "input_3", inputSlots: [SOURCE_SLOT, CATALYST_SLOT] },
            { id: "output_1", outputSlots: [SOURCE_SLOT] },
            { id: "output_2", outputSlots: BOOK_OUTPUT_SLOTS },
            { id: "output_3", outputSlots: [SOURCE_SLOT, ...BOOK_OUTPUT_SLOTS] },
        ],
    },
    liquids: {
        buttonSlots: [28, 29, 30, 31, 32, 33],
        anyInputIndices: [],
        anyOutputIndices: [0],
        modes: [
            { id: "disabled" },
            { id: "output_1", outputIndices: [0] },
        ],
    },
});

function getMode(entity) {
    return entity.getDynamicProperty(MODE_KEY) === ABSORPTION_MODE
        ? ABSORPTION_MODE
        : EXTRACTION_MODE;
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const next = getMode(entity) === EXTRACTION_MODE ? ABSORPTION_MODE : EXTRACTION_MODE;
    setDynamicString(entity, MODE_KEY, next);
    resetOperation(entity);
    return next === EXTRACTION_MODE ? "\u00A7r\u00A7aExtraction" : "\u00A7r\u00A76Absorption";
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([XP_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aExtraction");
            setDynamicString(machine.entity, LAYOUT_KEY, LAYOUT_VERSION);
            setDynamicString(machine.entity, MODE_KEY, EXTRACTION_MODE);
            resetOperation(machine.entity);

            const xpTank = new FluidStorage(machine.entity, 0);
            if (xpTank.get() <= 0) xpTank.setType(XP_TYPE);
            xpTank.display(XP_DISPLAY_SLOT);
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", EXTRACTION_COST);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        const legacyLayout = machine.container.size >= 24 ? OLDER_SLOT_LAYOUT : LEGACY_SLOT_LAYOUT;
        if (!ensureMachineInventoryLayout(
            machine, INVENTORY_SIZE, legacyLayout,
            LAYOUT_KEY, LAYOUT_VERSION, PREVIOUS_SLOT_LAYOUT,
        )) return;

        machine.processIO();

        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const xpTank = new FluidStorage(machine.entity, 0);
        if (xpTank.get() <= 0 && xpTank.getType() !== XP_TYPE) xpTank.setType(XP_TYPE);

        const mode = getMode(machine.entity);
        const energyCost = mode === ABSORPTION_MODE ? ABSORPTION_COST : EXTRACTION_COST;
        const source = machine.container.getItem(SOURCE_SLOT);

        if (!source) {
            resetOperation(machine.entity);
            showState(machine, xpTank, energyCost, false, "Insert Item", { mode });
            return;
        }

        if (source.amount !== 1) {
            resetOperation(machine.entity);
            showState(machine, xpTank, energyCost, false, "Split Stack", {
                mode,
                source: formatItem(source.typeId),
            });
            return;
        }

        const enchantments = readDisenchantments(source);
        if (enchantments.length === 0) {
            resetOperation(machine.entity);
            showState(machine, xpTank, energyCost, false, "No Enchantments", {
                mode,
                source: formatItem(source.typeId),
            });
            return;
        }

        const signature = createDisenchantSignature(source, mode, enchantments);
        syncOperation(machine.entity, signature);

        let xpGain = 0;
        if (mode === EXTRACTION_MODE) {
            const catalyst = machine.container.getItem(CATALYST_SLOT);
            if (!catalyst || catalyst.typeId !== "minecraft:book" || catalyst.amount <= 0) {
                showState(machine, xpTank, energyCost, false, "Need Book", {
                    mode,
                    source: formatItem(source.typeId),
                    enchantments: enchantments.length,
                });
                return;
            }

            if (findEmptyBookOutputSlot(machine.container) < 0) {
                showState(machine, xpTank, energyCost, false, "Output Full", {
                    mode,
                    source: formatItem(source.typeId),
                    enchantments: enchantments.length,
                });
                return;
            }
        } else {
            xpGain = getAbsorbedXp(enchantments);
            if (xpTank.getType() !== XP_TYPE) {
                showState(machine, xpTank, energyCost, false, "Need XP Tank", {
                    mode,
                    source: formatItem(source.typeId),
                    enchantments: enchantments.length,
                    xpGain,
                });
                return;
            }

            if (xpTank.getFreeSpace() < xpGain) {
                showState(machine, xpTank, energyCost, false, "XP Tank Full", {
                    mode,
                    source: formatItem(source.typeId),
                    enchantments: enchantments.length,
                    xpGain,
                });
                return;
            }
        }

        if (machine.energy.get() <= 0) {
            showState(machine, xpTank, energyCost, false, "No Energy", {
                mode,
                source: formatItem(source.typeId),
                enchantments: enchantments.length,
                xpGain,
            });
            return;
        }

        setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: energyCost,
            maxCrafts: 1,
            batch: 1,
        });

        if (result.processCount > 0) {
            const committed = mode === EXTRACTION_MODE
                ? commitExtraction(machine, source, enchantments)
                : commitAbsorption(machine, xpTank, source, xpGain);

            resetOperation(machine.entity);
            showState(
                machine,
                xpTank,
                energyCost,
                committed,
                committed ? (mode === EXTRACTION_MODE ? "Extracted" : "Absorbed") : "Operation Failed",
                {
                    mode,
                    source: formatItem(source.typeId),
                    enchantments: committed
                        ? (mode === EXTRACTION_MODE ? enchantments.length - 1 : 0)
                        : enchantments.length,
                    xpGain,
                },
            );
            return;
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        showState(
            machine,
            xpTank,
            energyCost,
            result.energyUsed > 0,
            mode === EXTRACTION_MODE ? "Extracting" : "Absorbing",
            {
                mode,
                source: formatItem(source.typeId),
                enchantments: enchantments.length,
                xpGain,
            },
        );
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

function commitExtraction(machine, source, enchantments) {
    const catalyst = machine.container.getItem(CATALYST_SLOT);
    if (!catalyst || catalyst.typeId !== "minecraft:book") return false;
    const outputSlot = findEmptyBookOutputSlot(machine.container);
    if (outputSlot < 0) return false;

    const result = extractFirstEnchantment(source, enchantments);
    if (!result) return false;

    const sourceBackup = source.clone();
    const catalystBackup = catalyst.clone();

    try {
        machine.container.setItem(SOURCE_SLOT, result.source);
        if (catalyst.amount <= 1) {
            machine.container.setItem(CATALYST_SLOT, undefined);
        } else {
            const remaining = catalyst.clone();
            remaining.amount--;
            machine.container.setItem(CATALYST_SLOT, remaining);
        }
        machine.container.setItem(outputSlot, result.book);
        return true;
    } catch {
        try {
            machine.container.setItem(outputSlot, undefined);
            machine.container.setItem(SOURCE_SLOT, sourceBackup);
            machine.container.setItem(CATALYST_SLOT, catalystBackup);
        } catch {}
        return false;
    }
}

function findEmptyBookOutputSlot(container) {
    return BOOK_OUTPUT_SLOTS.find((slot) => !container.getItem(slot)) ?? -1;
}

function commitAbsorption(machine, xpTank, source, xpGain) {
    const updated = removeAllDisenchantments(source);
    if (!updated || xpGain <= 0 || xpTank.getFreeSpace() < xpGain) return false;

    const sourceBackup = source.clone();
    let addedXp = 0;

    try {
        machine.container.setItem(SOURCE_SLOT, updated);
        addedXp = xpTank.add(xpGain);
        if (addedXp !== xpGain) throw new Error("XP tank changed before commit");
        return true;
    } catch {
        try {
            machine.container.setItem(SOURCE_SLOT, sourceBackup);
            if (addedXp > 0) xpTank.add(-addedXp);
        } catch {}
        return false;
    }
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

function showState(machine, xpTank, energyCost, running, message, context = {}) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", energyCost);
    displayProgress(machine, energyCost);
    if (machine.shouldUpdateUI) xpTank.display(XP_DISPLAY_SLOT);

    const mode = context.mode === ABSORPTION_MODE ? "Absorption" : "Extraction";
    const xpPercent = xpTank.getCap() > 0 ? (xpTank.get() / xpTank.getCap()) * 100 : 0;
    renderMachineInfo(machine, running, message, [
        {
            title: "Disenchantment Information",
            lines: [
                `\u00A7r\u00A77Mode \u00A7f${mode}`,
                `\u00A7r\u00A77Source \u00A7f${context.source ?? "-"}`,
                `\u00A7r\u00A77Enchantments \u00A7f${context.enchantments ?? 0}`,
                `\u00A7r\u00A77XP Gain \u00A7f${context.xpGain ?? 0} mB`,
            ],
        },
        {
            title: "XP Information",
            lines: [
                `\u00A7r\u00A77Stored \u00A7f${Math.floor(xpTank.get())} / ${Math.floor(xpTank.getCap())} mB`,
                `\u00A7r\u00A77Capacity \u00A7f${xpPercent.toFixed(2)}%%`,
            ],
        },
    ], { energyCost, batch: 1 });
}

function formatItem(typeId) {
    return DoriosLib.text.formatIdentifier(typeId);
}

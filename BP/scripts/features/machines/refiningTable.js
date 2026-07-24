// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    FluidStorage,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    collectStatsAbilityNames,
    getStatsCoreDefinition,
    isStatsCoreEnabled,
    readStatsState,
    resolveStatsAttributes,
    writeStatsState,
} from "../../ATCore/StatsCore/API.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { REFINING_TABLE_CONFIG as CONFIG } from "../../config/recipes/refiningTable.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:refining_table";
const ENERGY_SLOT = 0;
const STATUS_SLOT = 1;
const PROGRESS_SLOT = 2;
const EQUIPMENT_SLOT = 3;
const INGOT_SLOT = 4;
const CHIP_SLOT = 5;
const CONFIRM_SLOT = 6;
const DETAILS_SLOT = 7;
const RUNIC_CORE_SLOT = 8;
const SPEED_UPGRADE_SLOT = 9;
const ENERGY_UPGRADE_SLOT = 10;
const XP_DISPLAY_SLOT = 11;

const ITEM_IO_SLOTS = [12, 13, 14, 15, 16, 17];
const FLUID_IO_SLOTS = [18, 19, 20, 21, 22, 23];
const MATERIAL_SLOTS = [INGOT_SLOT, CHIP_SLOT, RUNIC_CORE_SLOT];

const QUEUED_KEY = "ascendant:refining_table_queued";
const ACTIVE_SIGNATURE_KEY = "ascendant:refining_table_signature";
const PENDING_KEY = "ascendant:refining_table_pending";

registerIOInterface(ID, {
    items: {
        buttonSlots: ITEM_IO_SLOTS,
        anyInputSlots: [EQUIPMENT_SLOT, ...MATERIAL_SLOTS],
        anyOutputSlots: [EQUIPMENT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [EQUIPMENT_SLOT] },
            { id: "input_2", inputSlots: MATERIAL_SLOTS },
            { id: "input_3", inputSlots: [EQUIPMENT_SLOT, ...MATERIAL_SLOTS] },
            { id: "output_1", outputSlots: [EQUIPMENT_SLOT] },
        ],
    },
    liquids: {
        buttonSlots: FLUID_IO_SLOTS,
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

ButtonManager.registerMachineButton(ID, CONFIRM_SLOT, ({ entity }) => {
    if (getString(entity, ACTIVE_SIGNATURE_KEY)) return;
    setDynamicString(entity, QUEUED_KEY, "true");
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([XP_DISPLAY_SLOT]);
            setUiItem(machine.container, STATUS_SLOT, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, DETAILS_SLOT, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, CONFIRM_SLOT, "utilitycraft:ui_filler", "\u00A7rRefine");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", CONFIG.defaults.idleEnergyCost);
            clearOperation(machine, true);

            const xpTank = new FluidStorage(machine.entity, 0);
            xpTank.setType(CONFIG.defaults.xpFluidType);
            xpTank.display(XP_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        machine.processIO();
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const xpTank = new FluidStorage(machine.entity, 0);
        if (xpTank.get() <= 0 && xpTank.getType() !== CONFIG.defaults.xpFluidType) {
            xpTank.setType(CONFIG.defaults.xpFluidType);
        }

        const preview = buildPreview(machine, xpTank);
        const activeSignature = getString(machine.entity, ACTIVE_SIGNATURE_KEY);

        if (activeSignature) {
            processActiveRefinement(machine, xpTank, preview, activeSignature);
            return;
        }

        if (getString(machine.entity, QUEUED_KEY)) {
            setDynamicString(machine.entity, QUEUED_KEY, "");
            if (!preview.ready) {
                clearOperation(machine, true);
                showState(machine, xpTank, preview, false, preview.problem ?? "Not Ready");
                return;
            }

            const pending = {
                refinement: rollRefinement(preview),
                awakenAbility: preview.awakeningRequested,
            };
            setDynamicString(machine.entity, PENDING_KEY, JSON.stringify(pending));
            setDynamicString(machine.entity, ACTIVE_SIGNATURE_KEY, preview.signature);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            showState(machine, xpTank, preview, true, "Queued");
            return;
        }

        showState(machine, xpTank, preview, false, preview.problem ?? "Ready");
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

function processActiveRefinement(machine, xpTank, preview, activeSignature) {
    if (!preview.valid || preview.signature !== activeSignature) {
        clearOperation(machine, true);
        showState(machine, xpTank, preview, false, "Inputs Changed");
        return;
    }

    if (xpTank.get() < preview.xpCost) {
        showState(machine, xpTank, preview, false, "Need More XP");
        return;
    }

    const result = advanceProcess(machine, {
        progress: machine.getProgress(),
        cost: preview.energyCost,
        batch: 1,
        maxCrafts: 1,
    });
    setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);

    if (result.processCount <= 0) {
        const running = result.energyUsed > 0;
        showState(machine, xpTank, preview, running, running ? "Refining" : "No Energy");
        return;
    }

    const applied = applyRefinement(machine, xpTank, preview);
    clearOperation(machine, true);
    const nextPreview = buildPreview(machine, xpTank);
    showState(machine, xpTank, nextPreview, false, applied ? "Refined" : "Refine Failed");
}

function buildPreview(machine, xpTank) {
    const equipment = machine.container.getItem(EQUIPMENT_SLOT);
    const definition = equipment ? getStatsCoreDefinition(equipment.typeId) : undefined;
    const state = equipment && definition ? readStatsState(equipment, definition) : undefined;
    const attributes = state && definition ? resolveStatsAttributes(definition, state) : undefined;
    const chipStack = machine.container.getItem(CHIP_SLOT);
    const chip = CONFIG.chips.get(normalizeId(chipStack?.typeId));
    const ingotStack = machine.container.getItem(INGOT_SLOT);
    const ingot = CONFIG.ingots.get(normalizeId(ingotStack?.typeId));
    const runicCore = machine.container.getItem(RUNIC_CORE_SLOT);
    const template = definition ? CONFIG.templates[definition.type] : undefined;
    const effectiveIngots = ingot
        ? Math.min(CONFIG.defaults.maxIngotsPerRoll, Math.max(0, Number(ingotStack?.amount ?? 0)))
        : 0;
    const potentialAbilities = definition
        ? collectStatsAbilityNames(definitionAbilityAttributes(definition), { state })
        : [];
    const requiresRunicCore = definition?.uniqueAbilityUnlock === "totem"
        && potentialAbilities.length > 0
        && state?.abilityData?.uniqueUnlocked !== true;
    const runicCorePresent = normalizeId(runicCore?.typeId) === CONFIG.defaults.unlockCatalystId;
    const awakeningRequested = requiresRunicCore && runicCorePresent;
    const availableXp = Math.max(0, Number(xpTank.get()) || 0);

    const preview = {
        valid: false,
        ready: false,
        problem: "Insert Equipment",
        equipment,
        definition,
        state,
        attributes,
        chip,
        ingot,
        effectiveIngots,
        availableXp,
        xpCost: 0,
        energyCost: CONFIG.defaults.idleEnergyCost,
        range: { min: 0, max: 0 },
        odds: { strong: 0, masterwork: 0, transcendent: 0 },
        requiresRunicCore,
        awakeningRequested,
        potentialAbilities,
        signature: "",
    };

    if (!isStatsCoreEnabled()) return { ...preview, problem: "StatsCore Disabled" };
    if (!equipment) return preview;
    if (!definition) return { ...preview, problem: "Unsupported Item" };
    if (!template) return { ...preview, problem: "Unsupported Profile" };
    if (ingotStack && !ingot) return { ...preview, valid: true, problem: "Unsupported Ingot" };
    if (!chip) return { ...preview, valid: true, problem: "Insert Chip" };

    const range = computeRollRange(chip, ingot, effectiveIngots);
    const costs = computeCosts(chip, ingot, effectiveIngots, Number(state?.refinement?.rerolls ?? 0));
    const signature = [
        equipment.typeId,
        state?.uid ?? "",
        state?.refinement?.rerolls ?? 0,
        state?.refinement?.quality ?? 0,
        state?.abilityData?.uniqueUnlocked === true ? 1 : 0,
        chip.id,
        chipStack?.amount ?? 0,
        ingot?.id ?? "",
        effectiveIngots,
        awakeningRequested ? 1 : 0,
        runicCore?.amount ?? 0,
    ].join("|");
    const enoughXp = availableXp >= costs.xpCost;

    return {
        ...preview,
        valid: true,
        ready: enoughXp,
        problem: enoughXp ? "Ready" : "Need More XP",
        range,
        xpCost: costs.xpCost,
        energyCost: costs.energyCost,
        odds: {
            strong: chanceAtOrAbove(range, CONFIG.defaults.strongThreshold),
            masterwork: chanceAtOrAbove(range, CONFIG.defaults.masterworkThreshold),
            transcendent: chanceAtOrAbove(range, CONFIG.defaults.transcendentThreshold),
        },
        signature,
    };
}

function computeRollRange(chip, ingot, amount) {
    const power = Number(ingot?.power ?? 0);
    const min = Math.min(0.98, chip.minQuality + amount * 0.012 * power);
    const max = Math.min(
        0.99,
        Math.max(min + CONFIG.defaults.minRollSpread, chip.maxQuality + amount * 0.018 * power),
    );
    return { min, max };
}

function computeCosts(chip, ingot, amount, rerolls) {
    const power = Number(ingot?.power ?? 0);
    const rerollScalar = 1 + Math.min(1.8, Math.max(0, rerolls) * 0.18);
    return {
        xpCost: Math.max(1, Math.floor((chip.baseXpCost + amount * 20 * power) * rerollScalar)),
        energyCost: Math.max(1, Math.floor((chip.baseEnergyCost + amount * 960 * power) * rerollScalar)),
    };
}

function chanceAtOrAbove(range, threshold) {
    if (range.max <= threshold) return 0;
    if (range.min >= threshold) return 1;
    return Math.max(0, Math.min(1, (range.max - threshold) / Math.max(Number.EPSILON, range.max - range.min)));
}

function rollRefinement(preview) {
    const quality = preview.range.min + Math.random() * Math.max(0, preview.range.max - preview.range.min);
    const template = CONFIG.templates[preview.definition.type];
    const tierScale = CONFIG.tierScales[normalizeId(preview.definition.tier)] ?? 1;
    const bonuses = {};

    for (const [key, maxValue] of Object.entries(template)) {
        const variance = 0.92 + Math.random() * 0.16;
        const cap = key === "extraDamage" || key === "elementalDamage" ? 12 : 0.99;
        bonuses[key] = roundBonus(Math.min(cap, Number(maxValue) * quality * tierScale * variance));
    }

    if ((bonuses.elementalChance ?? 0) > 0 && (bonuses.elementalDamage ?? 0) > 0) {
        const element = pickElement();
        if (element) {
            bonuses.elemental = {
                ...element,
                chance: bonuses.elementalChance,
                damage: bonuses.elementalDamage,
                quality: roundBonus(quality),
            };
        }
    }

    return {
        version: 1,
        grade: gradeFromQuality(quality),
        quality: roundBonus(quality),
        minQuality: roundBonus(preview.range.min),
        maxQuality: roundBonus(preview.range.max),
        spentXp: Math.max(0, Number(preview.state?.refinement?.spentXp ?? 0)) + preview.xpCost,
        rerolls: Math.max(0, Number(preview.state?.refinement?.rerolls ?? 0)) + 1,
        chipId: preview.chip.id,
        chipLabel: preview.chip.label,
        ingotId: preview.ingot?.id ?? "",
        ingotAmount: preview.effectiveIngots,
        bonuses,
    };
}

function pickElement() {
    const totalWeight = CONFIG.elements.reduce((sum, element) => sum + Math.max(0, element.weight), 0);
    let roll = Math.random() * Math.max(1, totalWeight);
    for (const element of CONFIG.elements) {
        roll -= Math.max(0, element.weight);
        if (roll <= 0) return element;
    }
    return CONFIG.elements[0];
}

function applyRefinement(machine, xpTank, preview) {
    const equipment = machine.container.getItem(EQUIPMENT_SLOT);
    const pending = readJson(machine.entity, PENDING_KEY);
    if (!equipment || !pending?.refinement || xpTank.get() < preview.xpCost) return false;

    const definition = getStatsCoreDefinition(equipment.typeId);
    if (!definition) return false;
    const state = readStatsState(equipment, definition);
    const awakenAbility = pending.awakenAbility === true;

    if (awakenAbility) {
        const runicCore = machine.container.getItem(RUNIC_CORE_SLOT);
        if (normalizeId(runicCore?.typeId) !== CONFIG.defaults.unlockCatalystId) return false;
    }

    writeStatsState(equipment, definition, {
        ...state,
        abilityData: {
            ...state.abilityData,
            uniqueUnlocked: awakenAbility || state.abilityData?.uniqueUnlocked === true,
        },
        refinement: pending.refinement,
    }, {
        syncLore: true,
        forceLore: true,
    });

    machine.container.setItem(EQUIPMENT_SLOT, equipment);
    xpTank.consume(preview.xpCost);
    consumeSlot(machine.container, CHIP_SLOT, 1);
    consumeSlot(machine.container, INGOT_SLOT, preview.effectiveIngots);
    if (awakenAbility) consumeSlot(machine.container, RUNIC_CORE_SLOT, 1);
    return true;
}

function showState(machine, xpTank, preview, running, title) {
    const cost = Math.max(1, Number(preview.energyCost) || CONFIG.defaults.idleEnergyCost);
    machine.setEnergyCost(cost);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost, PROGRESS_SLOT);
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(ENERGY_SLOT);
    xpTank.display(XP_DISPLAY_SLOT);
    machine.setLabel([
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${title}`,
        `\u00A7r\u00A77Equipment: \u00A7f${formatItem(preview.equipment?.typeId)}`,
        `\u00A7r\u00A77Chip: \u00A7f${preview.chip?.label ?? "-"}`,
        `\u00A7r\u00A77XP: \u00A7f${FluidStorage.formatFluid(preview.availableXp)} / ${FluidStorage.formatFluid(preview.xpCost)}`,
        `\u00A7r\u00A77Energy: \u00A7f${EnergyStorage.formatEnergyToText(cost)}`,
    ], STATUS_SLOT);
    machine.setLabel(buildDetails(preview), DETAILS_SLOT);
}

function buildDetails(preview) {
    if (!preview.definition || !preview.state || !preview.attributes) {
        return ["\u00A7r\u00A77Refinement Details", "\u00A7rInsert supported equipment"];
    }

    const levels = Object.values(preview.state.progression ?? {}).map((entry) => Number(entry?.level ?? 1));
    const level = Math.max(1, ...levels);
    const grade = formatGrade(preview.state.refinement?.grade);
    const type = formatItem(preview.definition.type);
    const lines = [
        `\u00A7r\u00A7d${type} Profile`,
        `\u00A7r\u00A77Level: \u00A7f${level}`,
        `\u00A7r\u00A77Current: \u00A7f${grade}`,
    ];

    if (preview.chip) {
        lines.push(`\u00A7r\u00A77Roll: \u00A7f${formatPercent(preview.range.min)} - ${formatPercent(preview.range.max)}`);
        lines.push(`\u00A7r\u00A77Masterwork: \u00A7f${formatPercent(preview.odds.masterwork)}`);
        lines.push(`\u00A7r\u00A77Transcendent: \u00A7f${formatPercent(preview.odds.transcendent)}`);
    }
    if (preview.requiresRunicCore) {
        lines.push(`\u00A7r\u00A77Ability: ${preview.awakeningRequested ? "\u00A7eAwaken" : "\u00A78Locked"}`);
    }
    return lines;
}

function definitionAbilityAttributes(definition) {
    return {
        effects: Array.isArray(definition?.attributes?.effects) ? definition.attributes.effects : [],
        mining: { effects: Array.isArray(definition?.mining?.effects) ? definition.mining.effects : [] },
        support: { effects: Array.isArray(definition?.support?.effects) ? definition.support.effects : [] },
    };
}

function consumeSlot(container, slot, amount) {
    if (amount <= 0) return;
    const item = container.getItem(slot);
    if (!item) return;
    const remaining = item.amount - amount;
    if (remaining <= 0) container.setItem(slot, undefined);
    else {
        item.amount = remaining;
        container.setItem(slot, item);
    }
}

function clearOperation(machine, resetProgress) {
    setDynamicString(machine.entity, QUEUED_KEY, "");
    setDynamicString(machine.entity, ACTIVE_SIGNATURE_KEY, "");
    setDynamicString(machine.entity, PENDING_KEY, "");
    if (resetProgress) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
}

function getString(entity, key) {
    return String(entity.getDynamicProperty(key) ?? "");
}

function readJson(entity, key) {
    const raw = getString(entity, key);
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

function normalizeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function roundBonus(value) {
    return Math.round((Number(value) || 0) * 10000) / 10000;
}

function gradeFromQuality(quality) {
    if (quality >= CONFIG.defaults.transcendentThreshold) return "transcendent";
    if (quality >= CONFIG.defaults.masterworkThreshold) return "masterwork";
    if (quality >= CONFIG.defaults.strongThreshold) return "exceptional";
    if (quality >= 0.32) return "steady";
    return "rough";
}

function formatGrade(value) {
    const normalized = normalizeId(value) || "unrefined";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatPercent(value) {
    return `${Math.round(Math.max(0, Number(value) || 0) * 1000) / 10}%`;
}

function formatItem(typeId) {
    if (!typeId) return "-";
    const value = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

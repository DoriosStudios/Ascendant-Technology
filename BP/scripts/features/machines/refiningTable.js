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
    collectStatsAbilityEntries,
    getStatsCoreDefinition,
    isStatsCoreEnabled,
    readStatsState,
    resolveStatsAttributes,
    writeStatsState,
} from "../../ATCore/StatsCore/API.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { REFINING_TABLE_CONFIG as CONFIG } from "../../config/recipes/refiningTable.js";
import { computeRefinementRollRange, rollStatsRefinement } from "../../ATCore/StatsCore/refining/rolls.js";
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
const STATS_DISPLAY_SLOT = 24;
const INVENTORY_SIZE = 25;
const LABEL_NAME_TAG_LIMIT = 255;
const LABEL_LORE_ENTRY_LIMIT = 1000;
const LABEL_STRING_LIMIT = 100;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];

const ITEM_IO_SLOTS = [12, 13, 14, 15, 16, 17];
const FLUID_IO_SLOTS = [18, 19, 20, 21, 22, 23];
const MATERIAL_SLOTS = [INGOT_SLOT, CHIP_SLOT, RUNIC_CORE_SLOT];

const QUEUED_KEY = "ascendant:refining_table_queued";
const ACTIVE_SIGNATURE_KEY = "ascendant:refining_table_signature";
const PENDING_KEY = "ascendant:refining_table_pending";
const previewCache = new Map();

function getMachineCacheKey(machine) {
    return String(machine?.entity?.id ?? "");
}

function getCachedPreview(machine, inputs) {
    const key = getMachineCacheKey(machine);
    if (!key) return null;

    const cached = previewCache.get(key);
    if (!cached) return null;
    return cached.state === inputs.state
        && cached.definition === inputs.definition
        && cached.equipmentTypeId === inputs.equipmentTypeId
        && cached.chipTypeId === inputs.chipTypeId
        && cached.chipAmount === inputs.chipAmount
        && cached.ingotTypeId === inputs.ingotTypeId
        && cached.ingotAmount === inputs.ingotAmount
        && cached.runicCoreTypeId === inputs.runicCoreTypeId
        && cached.runicCoreAmount === inputs.runicCoreAmount
        && cached.availableXp === inputs.availableXp
        && cached.statsCoreEnabled === inputs.statsCoreEnabled
        ? cached.preview
        : null;
}

function cachePreview(machine, inputs, preview) {
    const key = getMachineCacheKey(machine);
    if (key) {
        previewCache.set(key, { ...inputs, preview });
        if (previewCache.size > 256) previewCache.delete(previewCache.keys().next().value);
    }
    return preview;
}

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

            machine.blockSlots([XP_DISPLAY_SLOT, STATS_DISPLAY_SLOT]);
            setUiItem(machine.container, STATUS_SLOT, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, PROGRESS_SLOT, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, DETAILS_SLOT, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, STATS_DISPLAY_SLOT, "utilitycraft:ui_filler");
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
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

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
                awakenAdvanced: preview.advancedAwakeningRequested,
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
        if (entity) {
            previewCache.delete(String(entity.id ?? ""));
            ButtonManager.unwatchEntity(entity);
        }
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
    const chipStack = machine.container.getItem(CHIP_SLOT);
    const chip = CONFIG.chips.get(normalizeId(chipStack?.typeId));
    const ingotStack = machine.container.getItem(INGOT_SLOT);
    const ingot = CONFIG.ingots.get(normalizeId(ingotStack?.typeId));
    const runicCore = machine.container.getItem(RUNIC_CORE_SLOT);
    const runicCoreId = normalizeId(runicCore?.typeId);
    const runicCorePresent = runicCoreId === CONFIG.defaults.unlockCatalystId;
    const advancedCorePresent = runicCoreId === CONFIG.defaults.advancedUnlockCatalystId;
    const availableXp = Math.max(0, Number(xpTank.get()) || 0);
    const cacheInputs = {
        state,
        definition,
        equipmentTypeId: String(equipment?.typeId ?? ""),
        chipTypeId: String(chipStack?.typeId ?? ""),
        chipAmount: Number(chipStack?.amount ?? 0),
        ingotTypeId: String(ingotStack?.typeId ?? ""),
        ingotAmount: Number(ingotStack?.amount ?? 0),
        runicCoreTypeId: String(runicCore?.typeId ?? ""),
        runicCoreAmount: Number(runicCore?.amount ?? 0),
        availableXp,
        statsCoreEnabled: isStatsCoreEnabled(),
    };
    const cachedPreview = getCachedPreview(machine, cacheInputs);
    if (cachedPreview) return cachedPreview;

    const attributes = state && definition ? resolveStatsAttributes(definition, state) : undefined;
    const template = definition ? CONFIG.templates[definition.type] : undefined;
    const abilityEntries = definition
        ? collectStatsAbilityEntries(definitionAbilityAttributes(definition), { state })
        : [];
    const primaryAbilities = abilityEntries.filter(entry => !entry.advanced);
    const advancedAbilities = abilityEntries.filter(entry => entry.advanced);
    const requiresRunicCore = definition?.uniqueAbilityUnlock === "totem"
        && primaryAbilities.length > 0
        && state?.abilityData?.uniqueUnlocked !== true;
    const requiresAdvancedCore = advancedAbilities.length > 0
        && state?.abilityData?.advancedUnlocked !== true;
    const awakeningRequested = requiresRunicCore && (runicCorePresent || advancedCorePresent);
    const advancedAwakeningRequested = advancedCorePresent
        && state?.abilityData?.advancedUnlocked !== true
        && (requiresAdvancedCore || requiresRunicCore);
    const advancedRoll = state?.abilityData?.advancedUnlocked === true || advancedAwakeningRequested;
    const maxIngots = advancedRoll
        ? CONFIG.defaults.advancedMaxIngotsPerRoll
        : CONFIG.defaults.maxIngotsPerRoll;
    const effectiveIngots = ingot
        ? Math.min(maxIngots, Math.max(0, Number(ingotStack?.amount ?? 0)))
        : 0;
    const potentialAbilities = abilityEntries.map(entry => entry.name);
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
        requiresAdvancedCore,
        awakeningRequested,
        advancedAwakeningRequested,
        advancedRoll,
        primaryAbilities: primaryAbilities.map(entry => entry.name),
        advancedAbilities: advancedAbilities.map(entry => entry.name),
        potentialAbilities,
        signature: "",
    };

    if (!cacheInputs.statsCoreEnabled) return cachePreview(machine, cacheInputs, { ...preview, problem: "StatsCore Disabled" });
    if (!equipment) return cachePreview(machine, cacheInputs, preview);
    if (!definition) return cachePreview(machine, cacheInputs, { ...preview, problem: "Unsupported Item" });
    if (!template) return cachePreview(machine, cacheInputs, { ...preview, problem: "Unsupported Profile" });
    if (ingotStack && !ingot) return cachePreview(machine, cacheInputs, { ...preview, valid: true, problem: "Unsupported Ingot" });
    if (!chip) return cachePreview(machine, cacheInputs, { ...preview, valid: true, problem: "Insert Chip" });

    const range = computeRefinementRollRange(chip, ingot, effectiveIngots, { advanced: advancedRoll });
    const costs = computeCosts(
        chip,
        ingot,
        effectiveIngots,
        Number(state?.refinement?.rerolls ?? 0),
        advancedRoll
    );
    const signature = [
        equipment.typeId,
        state?.uid ?? "",
        state?.refinement?.rerolls ?? 0,
        state?.refinement?.quality ?? 0,
        state?.abilityData?.uniqueUnlocked === true ? 1 : 0,
        state?.abilityData?.advancedUnlocked === true ? 1 : 0,
        chip.id,
        chipStack?.amount ?? 0,
        ingot?.id ?? "",
        effectiveIngots,
        awakeningRequested ? 1 : 0,
        advancedAwakeningRequested ? 1 : 0,
        runicCoreId,
        runicCore?.amount ?? 0,
    ].join("|");
    const enoughXp = availableXp >= costs.xpCost;

    return cachePreview(machine, cacheInputs, {
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
    });
}

function computeCosts(chip, ingot, amount, rerolls, advanced = false) {
    const power = Number(ingot?.power ?? 0);
    const rerollScalar = 1 + Math.min(1.8, Math.max(0, rerolls) * 0.18);
    const advancedScalar = advanced ? 1.25 : 1;
    return {
        xpCost: Math.max(1, Math.floor((chip.baseXpCost + amount * 20 * power) * rerollScalar * advancedScalar)),
        energyCost: Math.max(1, Math.floor((chip.baseEnergyCost + amount * 960 * power) * rerollScalar * advancedScalar)),
    };
}

function chanceAtOrAbove(range, threshold) {
    if (range.max <= threshold) return 0;
    if (range.min >= threshold) return 1;
    return Math.max(0, Math.min(1, (range.max - threshold) / Math.max(Number.EPSILON, range.max - range.min)));
}

function rollRefinement(preview) {
    return rollStatsRefinement({
        definition: preview.definition,
        state: preview.state,
        chip: preview.chip,
        ingot: preview.ingot,
        amount: preview.effectiveIngots,
        range: preview.range,
        xpCost: preview.xpCost,
        advanced: preview.advancedRoll,
    });
}

function applyRefinement(machine, xpTank, preview) {
    const equipment = machine.container.getItem(EQUIPMENT_SLOT);
    const pending = readJson(machine.entity, PENDING_KEY);
    if (!equipment || !pending?.refinement || xpTank.get() < preview.xpCost) return false;

    const definition = getStatsCoreDefinition(equipment.typeId);
    if (!definition) return false;
    const state = readStatsState(equipment, definition);
    const awakenAbility = pending.awakenAbility === true;
    const awakenAdvanced = pending.awakenAdvanced === true;

    if (awakenAdvanced) {
        const runicCore = machine.container.getItem(RUNIC_CORE_SLOT);
        if (normalizeId(runicCore?.typeId) !== CONFIG.defaults.advancedUnlockCatalystId) return false;
    } else if (awakenAbility) {
        const runicCore = machine.container.getItem(RUNIC_CORE_SLOT);
        const coreId = normalizeId(runicCore?.typeId);
        if (coreId !== CONFIG.defaults.unlockCatalystId && coreId !== CONFIG.defaults.advancedUnlockCatalystId) return false;
    }

    writeStatsState(equipment, definition, {
        ...state,
        // Attribute points from the retired use-based system are not a
        // refinement reward. The table owns all refinement-side stat changes.
        attributeProgress: {},
        refined: true,
        abilityData: {
            ...state.abilityData,
            uniqueUnlocked: awakenAbility || awakenAdvanced || state.abilityData?.uniqueUnlocked === true,
            advancedUnlocked: awakenAdvanced || state.abilityData?.advancedUnlocked === true,
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
    if (awakenAbility || awakenAdvanced) consumeSlot(machine.container, RUNIC_CORE_SLOT, 1);
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
    machine.setLabel(toMachineLabelStrings([
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${title}`,
        `\u00A7r\u00A77Equipment: \u00A7f${formatItem(preview.equipment?.typeId)}`,
        `\u00A7r\u00A77Chip: \u00A7f${preview.chip?.label ?? "-"}`,
        `\u00A7r\u00A77XP: \u00A7f${FluidStorage.formatFluid(preview.availableXp)} / ${FluidStorage.formatFluid(preview.xpCost)}`,
        `\u00A7r\u00A77Energy: \u00A7f${EnergyStorage.formatEnergyToText(cost)}`,
    ]), STATUS_SLOT);
    machine.setLabel(toMachineLabelStrings(buildDetails(preview)), DETAILS_SLOT);
    machine.setLabel(toMachineLabelStrings(buildAllStats(preview)), STATS_DISPLAY_SLOT);
}

/**
 * Packs machine UI text into the limits used by item name tags and lore.
 * The first string becomes the name tag; the remaining strings become lore.
 *
 * @param {unknown[]} lines
 * @returns {string[]}
 */
function toMachineLabelStrings(lines) {
    const normalized = (Array.isArray(lines) ? lines : [lines]).map(line => String(line ?? ""));
    const [title = "", ...body] = normalized;
    const [nameTag = "", ...titleOverflow] = splitLabelText(title, LABEL_NAME_TAG_LIMIT);
    const loreText = [...titleOverflow, ...body].join("\n");
    if (!loreText) return [nameTag];

    const lore = splitLabelText(loreText, LABEL_LORE_ENTRY_LIMIT);
    return [nameTag, ...lore.slice(0, LABEL_STRING_LIMIT - 1)];
}

/**
 * Splits text at a line or word boundary without exceeding the supplied limit.
 *
 * @param {string} value
 * @param {number} limit
 * @returns {string[]}
 */
function splitLabelText(value, limit) {
    const chunks = [];
    let remaining = String(value ?? "");

    while (remaining.length > limit) {
        let cut = remaining.lastIndexOf("\n", limit);
        if (cut <= 0) cut = remaining.lastIndexOf(" ", limit);
        if (cut <= 0) cut = limit;

        chunks.push(remaining.slice(0, cut));
        const separator = remaining[cut];
        remaining = remaining.slice(cut + (separator === "\n" || separator === " " ? 1 : 0));
    }

    chunks.push(remaining);
    return chunks;
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

    if (preview.definition.type !== "support" && Number(preview.attributes?.crit?.multiplier ?? 1) > 1) {
        lines.push(`\u00A7r\u00A77Critical Multiplier: \u00A7fx${Number(preview.attributes.crit.multiplier).toFixed(2)}`);
    }

    if (preview.chip) {
        lines.push(`\u00A7r\u00A77Roll: \u00A7f${formatPercent(preview.range.min)} - ${formatPercent(preview.range.max)}`);
        lines.push(`\u00A7r\u00A77Masterwork: \u00A7f${formatPercent(preview.odds.masterwork)}`);
        lines.push(`\u00A7r\u00A77Transcendent: \u00A7f${formatPercent(preview.odds.transcendent)}`);
    }
    if (preview.requiresRunicCore) {
        lines.push(`\u00A7r\u00A77Primary Ability: ${preview.awakeningRequested ? "\u00A7eAwaken" : "\u00A78Locked"}`);
    }
    if (preview.requiresAdvancedCore) {
        lines.push(`\u00A7r\u00A77Bonus Abilities: ${preview.advancedAwakeningRequested ? "\u00A7dAwaken +" : "\u00A78Advanced Core"}`);
    }
    if (preview.advancedRoll) {
        lines.push(`\u00A7r\u00A7dAdvanced ceiling: \u00A7f${CONFIG.defaults.advancedMaxIngotsPerRoll} ingots`);
    }
    return lines;
}

function buildAllStats(preview) {
    if (!preview.definition || !preview.state || !preview.attributes) {
        return [
            "\u00A7r\u00A7dAll Statistics",
            "\u00A7r\u00A77Insert supported equipment",
        ];
    }

    const attributes = preview.attributes;
    const state = preview.state;
    const refinement = attributes.refinement ?? {};
    const lines = [
        `\u00A7r\u00A7d${formatItem(preview.definition.type)} Statistics`,
        `\u00A7r\u00A77Grade: \u00A7f${formatGrade(refinement.grade)}`,
        `\u00A7r\u00A77Quality: \u00A7f${formatPercent(refinement.quality)}`,
        "\u00A7r\u00A78Levels",
        `\u00A7r\u00A77Offensive: \u00A7f${formatCompactNumber(attributes.levels?.offensive, 1)}`,
        `\u00A7r\u00A77Mining: \u00A7f${formatCompactNumber(attributes.levels?.mining, 1)}`,
        `\u00A7r\u00A77Defensive: \u00A7f${formatCompactNumber(attributes.levels?.defensive, 1)}`,
    ];

    if (refinement.active) {
        lines.push("\u00A7r\u00A78Refinement");
        lines.push(`\u00A7r\u00A77Range: \u00A7f${formatPercent(refinement.minQuality)} - ${formatPercent(refinement.maxQuality)}`);
        lines.push(`\u00A7r\u00A77Rerolls: \u00A7f${formatCompactNumber(refinement.rerolls)}`);
        lines.push(`\u00A7r\u00A77XP: \u00A7f${formatCompactNumber(refinement.spentXp)} spent / ${formatCompactNumber(refinement.reserveXp)} reserved`);
        if (refinement.chipId) lines.push(`\u00A7r\u00A77Chip: \u00A7f${refinement.chipLabel || formatItem(refinement.chipId)}`);
        if (refinement.ingotId) lines.push(`\u00A7r\u00A77Material: \u00A7f${formatItem(refinement.ingotId)} x${formatCompactNumber(refinement.ingotAmount)}`);
    }

    if (preview.definition.type !== "support") {
        lines.push("\u00A7r\u00A78Combat");
        pushFlatStat(lines, "Extra Damage", attributes.flatDamageBonus);
        pushPercentStat(lines, "Damage Bonus", Number(attributes.damageMultiplier ?? 1) - 1);
        pushPercentStat(lines, "Critical Chance", attributes.crit?.chance);
        if (Number(attributes.crit?.multiplier ?? 1) > 1) {
            lines.push(`\u00A7r\u00A77Critical Multiplier: \u00A7fx${Number(attributes.crit.multiplier).toFixed(2)}`);
        }
        pushPercentStat(lines, "Armor Penetration", attributes.penetration?.percent);
        pushPercentStat(lines, "Lifesteal", attributes.lifesteal?.percent);

        for (const element of attributes.elemental ?? []) {
            const label = formatItem(element?.id);
            lines.push(`\u00A7r\u00A77${label}: \u00A7f${formatPercent(element?.chance)} / +${formatCompactNumber(element?.damage)} damage`);
        }

        lines.push("\u00A7r\u00A78Mining");
        pushPercentStat(lines, "Bonus Loot Chance", attributes.mining?.bonusLootChance);
        pushPercentStat(lines, "Preserving", attributes.mining?.durabilitySaveChance);
        pushFlatStat(lines, "Preserving Repair", attributes.mining?.preservationRepairAmount);
        pushTroubleStats(lines, attributes.mining, attributes.levels?.mining);
    } else {
        lines.push("\u00A7r\u00A78Defense");
        pushPercentStat(lines, "Damage Reduction", attributes.support?.damageReduction);
        pushPercentStat(lines, "Evasion", attributes.support?.negateAllDamageChance);
        pushPercentStat(lines, "Preserving", attributes.support?.durabilityPreserveChance);
        pushFlatStat(lines, "Preserving Repair", attributes.support?.preservationRepairAmount);
    }

    const eventDrivenLines = [];
    flattenEventDrivenStats(attributes.eventDriven, [], eventDrivenLines);
    if (eventDrivenLines.length > 0) {
        lines.push("\u00A7r\u00A78Event-driven");
        lines.push(...eventDrivenLines);
    }

    const primaryUnlocked = state.abilityData?.uniqueUnlocked === true;
    const advancedUnlocked = state.abilityData?.advancedUnlocked === true;
    if (preview.primaryAbilities.length > 0 || preview.advancedAbilities.length > 0) {
        lines.push("\u00A7r\u00A78Abilities");
        for (const ability of preview.primaryAbilities) {
            lines.push(`\u00A7r\u00A77${ability}: ${primaryUnlocked ? "\u00A7aUnlocked" : "\u00A78Locked"}`);
        }
        for (const ability of preview.advancedAbilities) {
            lines.push(`\u00A7r\u00A77${ability}: ${advancedUnlocked ? "\u00A7dUnlocked +" : "\u00A78Advanced Core"}`);
        }
    }

    return lines;
}

function pushFlatStat(lines, label, value) {
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric > 0) lines.push(`\u00A7r\u00A77${label}: \u00A7f+${formatCompactNumber(numeric)}`);
}

function pushPercentStat(lines, label, value) {
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric > 0) lines.push(`\u00A7r\u00A77${label}: \u00A7f${formatPercent(numeric)}`);
}

function pushTroubleStats(lines, mining, miningLevel) {
    const doubleTrouble = mining?.doubleTrouble;
    if (!doubleTrouble || typeof doubleTrouble !== "object") return;

    const level = Math.max(1, Number(miningLevel) || 1);
    const baseChance = Math.max(0, Number(doubleTrouble.baseChance) || 0);
    const chancePer10Levels = Math.max(0, Number(doubleTrouble.chancePer10Levels) || 0);
    const maxChance = Math.max(0, Number(doubleTrouble.maxChance) || 0);
    const doubleChance = Math.min(maxChance, baseChance + Math.floor(level / 10) * chancePer10Levels);
    if (doubleChance > 0) lines.push(`\u00A7r\u00A77Double Trouble: \u00A7f${formatPercent(doubleChance)}`);

    const tripleScale = Math.max(0, Number(mining?.tripleTrouble?.chanceScale) || 0);
    const tripleChance = doubleChance * tripleScale;
    if (tripleChance > 0) lines.push(`\u00A7r\u00A77Triple Trouble: \u00A7f${formatPercent(tripleChance)}`);
}

function flattenEventDrivenStats(value, path, lines) {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
        const nextPath = [...path, key];
        if (typeof entry === "number" && Number.isFinite(entry) && entry !== 0) {
            const label = nextPath.map(formatStatKey).join(" / ");
            const percentLike = /chance|bonus|percent|reduction|efficiency|scale/i.test(key);
            const formatted = percentLike ? formatPercent(entry) : formatCompactNumber(entry);
            lines.push(`\u00A7r\u00A77${label}: \u00A7f${formatted}`);
        } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            flattenEventDrivenStats(entry, nextPath, lines);
        }
    }
}

function formatStatKey(value) {
    return String(value ?? "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatCompactNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(fallback);
    return numeric.toFixed(Number.isInteger(numeric) ? 0 : 2).replace(/\.?0+$/, "");
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

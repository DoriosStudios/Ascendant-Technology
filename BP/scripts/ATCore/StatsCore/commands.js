import * as DoriosLib from "DoriosLib/index.js";
import {
    getEquipment,
    getLevelFromXp,
    getStatsCoreDefinition,
    getTotalXpForLevel,
    isStatsCoreEnabled,
    normalizeAppliesTo,
    persistEquipmentItem,
    readStatsState,
    resolveStatsAttributes,
    setStatsCoreEnabled,
    writeStatsState,
} from "./API.js";
import { getCategoriesForDefinition, getCategoryForReason } from "./core/state.js";
import { REFINING_TABLE_CONFIG as REFINING_CONFIG } from "../../config/recipes/refiningTable.js";
import { rollStatsRefinement } from "./refining/rolls.js";
import { getInheritableAbilityRecord } from "./refining/inheritance.js";
import {
    REFINEMENT_ABILITY_CATALOG,
    REFINEMENT_ABILITY_KEYS,
    REFINEMENT_ATTRIBUTE_CATALOG,
    REFINEMENT_ATTRIBUTE_KEYS,
    getRefinementAbilityOption,
    getRefinementAttributeOption,
} from "./refining/commandCatalog.js";
import {
    STATSCORE_FEEDBACK_STYLES,
    getStatsCoreFeedbackStyle,
    isStatsCoreInsightBridgeEnabled,
    setStatsCoreFeedbackStyle,
    setStatsCoreInsightBridgeEnabled,
} from "./feedback/index.js";
import {
    STATSCORE_EFFECT_IDS,
    getStatsCoreEffectDefinition,
    upsertStatsCoreEffect,
} from "./effects/index.js";

function sendCommandMessage(sourceEntity, message) {
    try {
        sourceEntity?.sendMessage?.(message);
    } catch {
        console.info(message);
    }
}

function normalizeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function entryAlias(id) {
    const normalized = normalizeId(id);
    return normalized.includes(":") ? normalized.split(":").pop() : normalized;
}

function getConfigEntry(entries, value) {
    const normalized = normalizeId(value);
    if (!normalized) return undefined;
    if (entries.has(normalized)) return entries.get(normalized);
    for (const [id, entry] of entries) {
        if (entryAlias(id) === normalized) return entry;
    }
    return undefined;
}

function getRefinementElementSummary(refinement) {
    const element = refinement?.bonuses?.elemental;
    const elementId = normalizeId(element?.id);
    if (!elementId) return "§8None";

    const configured = REFINING_CONFIG.elements.find(entry => normalizeId(entry?.id) === elementId);
    const label = element?.label || configured?.label || elementId
        .split(/[_\s-]+/g)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    const chance = Math.round(Math.max(0, Number(element?.chance ?? 0) || 0) * 100);
    return `${label} §7(${chance}%)`;
}

const REFINEMENT_PRESETS = Object.freeze({
    worst: Object.freeze({ tier: "wood", chip: "chip", ingot: "copper_ingot", core: "none", amount: 1 }),
    basic: Object.freeze({ tier: "stone", chip: "basic_chip", ingot: "iron_ingot", core: "none", amount: 2 }),
    standard: Object.freeze({ tier: "iron", chip: "advanced_chip", ingot: "steel_ingot", core: "normal", amount: 4 }),
    elite: Object.freeze({ tier: "netherite", chip: "ultimate_chip", ingot: "netherite_ingot", core: "normal", amount: 8 }),
    absolute: Object.freeze({ tier: "aetherium", chip: "absolute_chip", ingot: "aetherium", core: "normal", amount: 8 }),
    best: Object.freeze({ tier: "aetherium", chip: "absolute_chip", ingot: "aetherium", core: "advanced", amount: 12 }),
});
const REFINEMENT_ACTIONS = Object.freeze(["custom", "random", ...Object.keys(REFINEMENT_PRESETS)]);

function reportRefineSyntax(source, reason) {
    const message = [
        `§c${reason}`,
        "§7Preset/random: §f/sc:refine <worst|basic|standard|elite|absolute|best|random> <target>",
        "§7Custom: §f/sc:refine custom <target> <tier> <chip> <ingot> <none|normal|advanced> [amount]",
    ].join("\n");
    sendCommandMessage(source, message);
    console.info(`[StatsCore] ${reason}`);
}

function randomEntry(entries) {
    return entries[Math.floor(Math.random() * entries.length)];
}

function getRandomRefinementOptions() {
    const coreMode = randomEntry(["none", "normal", "advanced"]);
    const maxIngots = coreMode === "advanced"
        ? REFINING_CONFIG.defaults.advancedMaxIngotsPerRoll
        : REFINING_CONFIG.defaults.maxIngotsPerRoll;
    return {
        label: "random",
        tier: randomEntry(Object.keys(REFINING_CONFIG.tierScales)),
        chip: randomEntry([...REFINING_CONFIG.chips.values()]),
        ingot: randomEntry([...REFINING_CONFIG.ingots.values()]),
        coreMode,
        amount: 1 + Math.floor(Math.random() * maxIngots),
    };
}

function getRefinementOptions(action, tierValue, chipValue, ingotValue, coreValue, amount) {
    const normalizedAction = normalizeId(action);
    if (normalizedAction === "random") return getRandomRefinementOptions();

    const preset = REFINEMENT_PRESETS[normalizedAction];
    const values = preset ?? {
        tier: normalizeId(tierValue),
        chip: chipValue,
        ingot: ingotValue,
        core: normalizeId(coreValue),
        amount: Math.max(1, Math.floor(Number(amount) || 1)),
    };
    const chip = getConfigEntry(REFINING_CONFIG.chips, values.chip);
    const ingot = getConfigEntry(REFINING_CONFIG.ingots, values.ingot);
    const coreMode = normalizeId(values.core);
    const tier = normalizeId(values.tier);
    if (
        !chip
        || !ingot
        || !REFINING_CONFIG.tierScales[tier]
        || !["none", "normal", "advanced"].includes(coreMode)
    ) return undefined;

    return {
        label: preset ? normalizedAction : "custom",
        tier,
        chip,
        ingot,
        coreMode,
        amount: values.amount,
    };
}

function getSelectedPlayers(value) {
    if (Array.isArray(value)) return value.filter(entity => entity?.typeId === "minecraft:player");
    return value?.typeId === "minecraft:player" ? [value] : [];
}

function getSelectedEntities(value) {
    if (Array.isArray(value)) return value.filter(entity => entity?.id);
    return value?.id ? [value] : [];
}

function normalizeAbilityKey(value) {
    return normalizeId(value)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getDefinitionEffects(definition) {
    return [
        ...(Array.isArray(definition?.attributes?.effects) ? definition.attributes.effects : []),
        ...(Array.isArray(definition?.mining?.effects) ? definition.mining.effects : []),
        ...(Array.isArray(definition?.support?.effects) ? definition.support.effects : []),
    ].filter(effect => effect && typeof effect === "object");
}

function definitionHasAbility(definition, abilityKey) {
    const expected = normalizeAbilityKey(abilityKey);
    return getDefinitionEffects(definition).some(effect => {
        return [
            effect?.key,
            effect?.kind,
            effect?.label,
        ].some(value => normalizeAbilityKey(value) === expected);
    });
}

function getHeldStatsItem(player) {
    const { item } = getEquipment(player);
    if (!item) return { ok: false, message: "No mainhand equipment." };

    const definition = getStatsCoreDefinition(item);
    if (!definition) return { ok: false, message: `${item.typeId} is not registered.` };
    return { ok: true, item, definition, state: readStatsState(item, definition) };
}

function persistCommandState(player, item, definition, state, options = {}) {
    const levelChanged = options.levelChanged === true;
    const syncLore = options.syncLore === true || levelChanged;
    const result = writeStatsState(item, definition, state, {
        syncLore,
        levelChanged,
        forceLore: options.forceLore === true,
    });
    if (!persistEquipmentItem(player, "Mainhand", item)) {
        return { ok: false, message: "Could not persist the equipment." };
    }
    return { ok: true, state: result.state };
}

function applySpecificAttribute(player, attributeKey, rawValue) {
    const context = getHeldStatsItem(player);
    if (!context.ok) return context;

    const option = getRefinementAttributeOption(attributeKey);
    if (!option) return { ok: false, message: "Unknown refinement attribute." };
    if (!option.itemTypes.includes(context.definition.type)) {
        return { ok: false, message: `${option.label} is incompatible with ${context.definition.type} equipment.` };
    }

    const requested = Number(rawValue);
    if (!Number.isFinite(requested)) return { ok: false, message: `${option.label} requires a float value.` };
    const value = Math.min(option.max, Math.max(option.min, requested));
    const nextRefinement = {
        ...context.state.refinement,
        version: 1,
        grade: "custom",
        bonuses: {
            ...context.state.refinement?.bonuses,
            [option.property]: value,
        },
    };
    const persisted = persistCommandState(player, context.item, context.definition, {
        ...context.state,
        refined: true,
        refinement: nextRefinement,
    }, { syncLore: true, forceLore: true });
    if (!persisted.ok) return persisted;

    return {
        ok: true,
        message: `${option.label} = ${value} (${option.valueType})`,
    };
}

function applySpecificAbility(player, abilityKey, rawLevel, appliesTo) {
    const context = getHeldStatsItem(player);
    if (!context.ok) return context;

    const option = getRefinementAbilityOption(abilityKey);
    if (!option) return { ok: false, message: "Unknown StatsCore ability." };

    const level = Math.min(option.max, Math.max(option.min, Math.floor(Number(rawLevel) || option.min)));
    const targets = normalizeAppliesTo(appliesTo);
    if (targets.length <= 0) {
        return { ok: false, message: "appliesTo requires categories or exact entity typeIds." };
    }
    const nativeAbility = definitionHasAbility(context.definition, option.key);
    const currentInherited = Array.isArray(context.state.abilityData?.inheritedAbilities)
        ? context.state.abilityData.inheritedAbilities
        : [];
    const existingInherited = currentInherited.find(entry => normalizeAbilityKey(entry?.key) === option.key);
    const inheritedRecord = nativeAbility
        ? null
        : existingInherited ?? getInheritableAbilityRecord(context.definition, option.key, currentInherited);
    if (!nativeAbility && !inheritedRecord) {
        return { ok: false, message: `${option.label} is not compatible with this equipment category.` };
    }

    const nextInherited = nativeAbility
        ? currentInherited
        : [
            ...currentInherited.filter(entry => normalizeAbilityKey(entry?.key) !== option.key),
            {
                ...inheritedRecord,
                effect: {
                    ...inheritedRecord.effect,
                    appliesTo: [...targets],
                    commandLevel: level,
                },
            },
        ];
    const persisted = persistCommandState(player, context.item, context.definition, {
        ...context.state,
        refined: true,
        abilityData: {
            ...context.state.abilityData,
            appliedAbilities: {
                ...context.state.abilityData?.appliedAbilities,
                [option.key]: level,
            },
            abilityTargets: {
                ...context.state.abilityData?.abilityTargets,
                [option.key]: targets,
            },
            inheritedAbilities: nextInherited,
        },
    }, { syncLore: true, forceLore: true });
    if (!persisted.ok) return persisted;

    return {
        ok: true,
        message: `${option.label} level ${level}${nativeAbility ? "" : " (inherited +)"} | appliesTo: ${targets.join(", ")}`,
    };
}

function getRefinementElementOption(elementId) {
    const expected = normalizeId(elementId);
    return REFINING_CONFIG.elements.find(element => normalizeId(element?.id) === expected) ?? null;
}

function applySpecificElement(player, elementId, rawChance, rawDamage) {
    const context = getHeldStatsItem(player);
    if (!context.ok) return context;

    const element = getRefinementElementOption(elementId);
    if (!element) return { ok: false, message: "Unknown StatsCore element." };
    const allowedTypes = Array.isArray(element.allowedTypes) ? element.allowedTypes : null;
    const support = context.definition.type === "support";
    if ((support && element.id !== "earth") || (allowedTypes && !allowedTypes.includes(context.definition.type))) {
        return { ok: false, message: `${element.id} is incompatible with ${context.definition.type} equipment.` };
    }

    const requestedChance = Number(rawChance);
    const requestedDamage = Number(rawDamage);
    if (!Number.isFinite(requestedChance) || !Number.isFinite(requestedDamage)) {
        return { ok: false, message: "Element chance and damage must be numeric." };
    }
    const chance = Math.min(1, Math.max(0, requestedChance));
    const damage = Math.min(18, Math.max(0, requestedDamage));
    const nextRefinement = {
        ...context.state.refinement,
        version: 1,
        grade: "custom",
        quality: Math.max(1, Number(context.state.refinement?.quality ?? 0) || 0),
        bonuses: {
            ...context.state.refinement?.bonuses,
            elementalChance: chance,
            elementalDamage: damage,
            elemental: {
                ...element,
                chance: element.id === "light" ? 1 : chance,
                damage: element.id === "light"
                    ? Math.max(1, Number(element.blessingDamage ?? damage) || 8)
                    : damage,
                quality: 1,
            },
        },
    };
    const persisted = persistCommandState(player, context.item, context.definition, {
        ...context.state,
        refined: true,
        refinement: nextRefinement,
    }, { syncLore: true, forceLore: true });
    if (!persisted.ok) return persisted;

    return {
        ok: true,
        message: `${element.id} | ${Math.round((element.id === "light" ? 1 : chance) * 100)}% chance | ${element.id === "earth" ? "armor affinity" : `${damage} damage`}`,
    };
}

function addEquipmentProgress(player, xpType, unit, rawAmount) {
    const context = getHeldStatsItem(player);
    if (!context.ok) return context;
    if (context.state.refined !== true) {
        return { ok: false, message: "Refine this equipment before adding StatsCore XP." };
    }

    const category = getCategoryForReason(xpType) || normalizeId(xpType);
    if (!getCategoriesForDefinition(context.definition).has(category)) {
        return { ok: false, message: `${category || xpType} XP is incompatible with this equipment.` };
    }

    const amount = Math.max(1, Math.floor(Number(rawAmount) || 1));
    const current = context.state.progression?.[category] ?? { level: 1, xp: 0 };
    const currentXp = Math.max(0, Math.floor(Number(current.xp) || 0));
    let nextXp = currentXp;

    if (normalizeId(unit) === "levels") {
        const addedLevels = Math.min(1000, amount);
        const currentLevel = getLevelFromXp(currentXp, context.definition);
        const currentLevelStart = getTotalXpForLevel(currentLevel, context.definition);
        const progressInsideLevel = Math.max(0, currentXp - currentLevelStart);
        nextXp = getTotalXpForLevel(currentLevel + addedLevels, context.definition) + progressInsideLevel;
    } else {
        nextXp += Math.min(2_000_000_000, amount);
    }

    const nextLevel = getLevelFromXp(nextXp, context.definition);
    const persisted = persistCommandState(player, context.item, context.definition, {
        ...context.state,
        progression: {
            ...context.state.progression,
            [category]: {
                xp: nextXp,
                level: nextLevel,
            },
        },
    }, { levelChanged: nextLevel > current.level });
    if (!persisted.ok) return persisted;

    return {
        ok: true,
        message: `${category} -> level ${nextLevel}, ${nextXp} total XP`,
    };
}

function sendCatalog(source, title, entries) {
    sendCommandMessage(source, `\u00A76${title}`);
    const lines = entries.map(entry => {
        const targetType = entry.appliesToType ? ` | appliesTo: ${entry.appliesToType}` : "";
        const details = entry.description ? `\n\u00A78${entry.description}` : "";
        const example = entry.valueHelp ? `\n\u00A77Example: \u00A7f${entry.valueHelp}` : "";
        return `\u00A7e${entry.key}\u00A77 — ${entry.label} | ${entry.valueType} ${entry.min}..${entry.max}${targetType}${details}${example}`;
    });
    for (let index = 0; index < lines.length; index += 6) {
        sendCommandMessage(source, lines.slice(index, index + 6).join("\n"));
    }
}

function refineHeldEquipment(player, tier, chip, ingot, amount, coreMode) {
    const { item } = getEquipment(player);
    if (!item) return { ok: false, message: "No mainhand equipment." };

    const definition = getStatsCoreDefinition(item);
    if (!definition) return { ok: false, message: `${item.typeId} is not registered.` };

    const state = readStatsState(item, definition);
    const normalizedCore = normalizeId(coreMode);
    const awakenPrimary = normalizedCore === "normal" || normalizedCore === "advanced";
    const awakenAdvanced = normalizedCore === "advanced";
    const advancedRoll = awakenAdvanced || state.abilityData?.advancedUnlocked === true;
    const maxIngots = advancedRoll
        ? REFINING_CONFIG.defaults.advancedMaxIngotsPerRoll
        : REFINING_CONFIG.defaults.maxIngotsPerRoll;
    const effectiveAmount = Math.min(
        maxIngots,
        Math.max(1, Math.floor(Number(amount) || 1)),
    );
    const refinement = rollStatsRefinement({
        definition,
        state,
        chip,
        ingot,
        amount: effectiveAmount,
        tier,
        advanced: advancedRoll,
        coreMode: normalizedCore,
    });
    if (!refinement) return { ok: false, message: "This equipment has no refining profile." };

    const result = writeStatsState(item, definition, {
        ...state,
        attributeProgress: {},
        refined: true,
        abilityData: {
            ...state.abilityData,
            uniqueUnlocked: awakenPrimary || state.abilityData?.uniqueUnlocked === true,
            advancedUnlocked: awakenAdvanced || state.abilityData?.advancedUnlocked === true,
        },
        refinement,
    }, { syncLore: true, forceLore: true });
    if (!persistEquipmentItem(player, "Mainhand", item)) {
        return { ok: false, message: "Could not persist the refined equipment." };
    }

    const attributes = resolveStatsAttributes(definition, result.state);
    const troubles = attributes?.mining?.doubleTrouble
        ? ["Double Trouble", ...(attributes.mining.tripleTrouble ? ["Triple Trouble"] : [])]
        : [];
    return {
        ok: true,
        message: `${item.typeId} -> ${refinement.grade} (${Math.round(refinement.quality * 100)}%) | core: ${normalizedCore} | ingots: ${refinement.ingotAmount} | element: ${getRefinementElementSummary(refinement)}`,
        troubles,
    };
}

DoriosLib.registry.customCommand({
    name: "sc:state",
    description: "Changes the global StatsCore state",
    permissionLevel: "admin",
    parameters: [
        {
            name: "mode",
            type: "enum",
            values: ["on", "off"],
        },
    ],
    callback(origin, mode) {
        const source = origin.sourceEntity;
        const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";

        if (normalizedMode !== "on" && normalizedMode !== "off") {
            sendCommandMessage(source, "\u00A7cStatsCore: use on or off.");
            return;
        }

        const nextState = normalizedMode === "on";
        const previousState = isStatsCoreEnabled();
        setStatsCoreEnabled(nextState);

        sendCommandMessage(
            source,
            `\u00A7${nextState ? "a" : "c"}StatsCore ${nextState ? "enabled" : "disabled"}.`
        );

        if (previousState === nextState) {
            sendCommandMessage(source, "\u00A77StatsCore was already in that state.");
        }

        console.warn(`[StatsCore] ${nextState ? "Enabled" : "Disabled"} (Command).`);
    },
});

DoriosLib.registry.customCommand({
    name: "sc:style",
    description: "Sets this player's StatsCore feedback style",
    permissionLevel: "any",
    parameters: [
        { name: "style", type: "enum", values: STATSCORE_FEEDBACK_STYLES, optional: true },
    ],
    callback(origin, style) {
        const source = origin.sourceEntity;
        if (!source || source.typeId !== "minecraft:player") {
            sendCommandMessage(source, "\u00A7cThis command must be used by a player.");
            return;
        }

        if (style === undefined) {
            sendCommandMessage(source, `\u00A77StatsCore feedback style: \u00A7f${getStatsCoreFeedbackStyle(source)}`);
            return;
        }

        if (!setStatsCoreFeedbackStyle(source, style)) {
            sendCommandMessage(source, "\u00A7cUse only_text, only_icons, text_and_icons, or both_partial.");
            return;
        }

        sendCommandMessage(source, `\u00A7aStatsCore feedback style: \u00A7f${getStatsCoreFeedbackStyle(source)}`);
    },
});

DoriosLib.registry.customCommand({
    name: "sc:insight_bridge",
    description: "Routes this player's StatsCore alerts through Dorios' Insight",
    permissionLevel: "any",
    parameters: [
        { name: "mode", type: "enum", values: ["on", "off"], optional: true },
    ],
    callback(origin, mode) {
        const source = origin.sourceEntity;
        if (!source || source.typeId !== "minecraft:player") {
            sendCommandMessage(source, "§cThis command must be used by a player.");
            return;
        }

        if (mode === undefined) {
            sendCommandMessage(source, `§7StatsCore Insight bridge: §f${isStatsCoreInsightBridgeEnabled(source) ? "on" : "off"}`);
            return;
        }

        const normalized = normalizeId(mode);
        if (normalized !== "on" && normalized !== "off") {
            sendCommandMessage(source, "§cUse on or off.");
            return;
        }
        const enabled = normalized === "on";
        if (!setStatsCoreInsightBridgeEnabled(source, enabled)) {
            sendCommandMessage(source, "§cCould not save the Insight bridge setting.");
            return;
        }

        sendCommandMessage(source, `§aStatsCore Insight bridge ${enabled ? "enabled" : "disabled"}.`);
    },
});

DoriosLib.registry.customCommand({
    name: "sc:refine_element",
    description: "Applies one StatsCore element to mainhand equipment for testing",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["apply"] },
        { name: "target", type: "player" },
        { name: "element", type: "enum", values: REFINING_CONFIG.elements.map(entry => entry.id) },
        { name: "chance", type: "float" },
        { name: "damage", type: "float" },
    ],
    callback(origin, action, target, element, chance, damage) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "apply") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }
        for (const player of players) {
            const result = applySpecificElement(player, element, chance, damage);
            sendCommandMessage(source, result.ok
                ? `\u00A7a${player.name}: \u00A7f${result.message}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

DoriosLib.registry.customCommand({
    name: "sc:effects",
    description: "Applies a timed StatsCore status for HUD and WAILA testing",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "effect", type: "enum", values: STATSCORE_EFFECT_IDS },
        { name: "target", type: "entity" },
        { name: "duration_seconds", type: "int" },
    ],
    callback(origin, effectId, target, durationSeconds) {
        const source = origin.sourceEntity;
        const effect = getStatsCoreEffectDefinition(effectId);
        const seconds = Math.floor(Number(durationSeconds));
        if (!effect) {
            sendCommandMessage(source, "§cUnknown StatsCore effect.");
            return;
        }
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86_400) {
            sendCommandMessage(source, "§cDuration must be between 1 and 86400 seconds.");
            return;
        }

        const entities = getSelectedEntities(target);
        if (!entities.length) {
            sendCommandMessage(source, "§cNo entities matched the target.");
            return;
        }

        let applied = 0;
        for (const entity of entities) {
            if (upsertStatsCoreEffect(entity, {
                ...effect,
                source: "command",
                durationTicks: seconds * 20,
            })) {
                applied++;
            }
        }

        sendCommandMessage(
            source,
            `§a${effect.name} applied to §f${applied}§a entit${applied === 1 ? "y" : "ies"} for §f${seconds}s§a.`,
        );
    },
});

DoriosLib.registry.customCommand({
    name: "sc:refine",
    description: "Refines mainhand equipment with custom, preset, or fully random options",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: REFINEMENT_ACTIONS },
        { name: "target", type: "player" },
        { name: "tier", type: "enum", values: Object.keys(REFINING_CONFIG.tierScales), optional: true },
        { name: "chip", type: "enum", values: [...REFINING_CONFIG.chips.keys()].map(entryAlias), optional: true },
        { name: "ingot", type: "enum", values: [...REFINING_CONFIG.ingots.keys()].map(entryAlias), optional: true },
        { name: "core", type: "enum", values: ["none", "normal", "advanced"], optional: true },
        { name: "amount", type: "int", optional: true },
    ],
    callback(origin, action, target, tier, chipValue, ingotValue, core, amount) {
        const source = origin.sourceEntity;
        const normalizedAction = normalizeId(action);
        if (!REFINEMENT_ACTIONS.includes(normalizedAction)) {
            reportRefineSyntax(source, "Unknown refine action.");
            return;
        }
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const fixedOptions = normalizedAction === "random"
            ? undefined
            : getRefinementOptions(normalizedAction, tier, chipValue, ingotValue, core, amount);
        if (normalizedAction !== "random" && !fixedOptions) {
            reportRefineSyntax(
                source,
                normalizedAction === "custom"
                    ? "Custom refinement requires a valid tier, chip, ingot, and core."
                    : `Invalid ${normalizedAction} preset configuration.`,
            );
            return;
        }
        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const options = fixedOptions ?? getRefinementOptions("random");
            if (!options) continue;
            const result = refineHeldEquipment(
                player,
                options.tier,
                options.chip,
                options.ingot,
                options.amount,
                options.coreMode,
            );
            sendCommandMessage(source, result.ok
                ? `\u00A7aRefined \u00A7f${player.name}: \u00A77[${options.label}] ${options.tier}, ${options.chip.label}, ${options.ingot.label}, ${options.coreMode}, x${options.amount} | ${result.message}${result.troubles.length ? ` \u00A78| \u00A7d${result.troubles.join(" + ")} active` : ""}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

DoriosLib.registry.customCommand({
    name: "sc:refine_attribute",
    description: "Applies one typed refinement attribute to mainhand equipment",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["apply"] },
        { name: "target", type: "player" },
        { name: "attribute", type: "enum", values: REFINEMENT_ATTRIBUTE_KEYS },
        { name: "value", type: "float" },
    ],
    callback(origin, action, target, attribute, value) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "apply") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const result = applySpecificAttribute(player, attribute, value);
            sendCommandMessage(source, result.ok
                ? `\u00A7a${player.name}: \u00A7f${result.message}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

DoriosLib.registry.customCommand({
    name: "sc:refine_ability",
    description: "Applies one compatible StatsCore ability at an integer level",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["apply"] },
        { name: "target", type: "player" },
        { name: "ability", type: "enum", values: REFINEMENT_ABILITY_KEYS },
        { name: "level", type: "int" },
        { name: "applies_to", type: "string" },
    ],
    callback(origin, action, target, ability, level, appliesTo) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "apply") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const result = applySpecificAbility(player, ability, level, appliesTo);
            sendCommandMessage(source, result.ok
                ? `\u00A7a${player.name}: \u00A7f${result.message}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

DoriosLib.registry.customCommand({
    name: "sc:refine_list",
    description: "Lists typed StatsCore refinement attributes or abilities",
    permissionLevel: "any",
    parameters: [
        { name: "kind", type: "enum", values: ["attributes", "abilities", "elements"] },
    ],
    callback(origin, kind) {
        const source = origin.sourceEntity;
        if (normalizeId(kind) === "attributes") {
            sendCatalog(source, "StatsCore refinement attributes", Object.values(REFINEMENT_ATTRIBUTE_CATALOG));
            return;
        }
        if (normalizeId(kind) === "elements") {
            const entries = REFINING_CONFIG.elements.map(element => ({
                key: element.id,
                label: String(element.label ?? element.id),
                valueType: "chance + damage",
                min: 0,
                max: element.id === "earth" ? "armor only" : 18,
                description: element.id === "earth"
                    ? "Armor affinity that improves damage reduction and Preserving."
                    : "Applies this elemental behavior to eligible combat equipment.",
                valueHelp: "chance uses 0..1; damage uses 0..18",
            }));
            sendCatalog(source, "StatsCore refinement elements", entries);
            return;
        }
        sendCatalog(source, "StatsCore refinement abilities", Object.values(REFINEMENT_ABILITY_CATALOG));
    },
});

DoriosLib.registry.customCommand({
    name: "sc:stats_xp",
    description: "Force-adds XP or levels to compatible mainhand equipment progression",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["add"] },
        { name: "target", type: "player" },
        {
            name: "xp_type",
            type: "enum",
            values: [
                "offensive",
                "defensive",
                "mining",
                "utility",
                "combat",
                "kill",
                "hurt",
                "armor",
                "block",
                "ore",
                "tool",
            ],
        },
        { name: "unit", type: "enum", values: ["xp", "levels"] },
        { name: "amount", type: "int" },
    ],
    callback(origin, action, target, xpType, unit, amount) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "add") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const result = addEquipmentProgress(player, xpType, unit, amount);
            sendCommandMessage(source, result.ok
                ? `\u00A7a${player.name}: \u00A7f${result.message}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

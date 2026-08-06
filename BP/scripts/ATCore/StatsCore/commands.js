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

function sendCommandMessage(sourceEntity, message) {
    try {
        sourceEntity?.sendMessage?.(message);
    } catch {
        console.warn(message);
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

function getSelectedPlayers(value) {
    if (Array.isArray(value)) return value.filter(entity => entity?.typeId === "minecraft:player");
    return value?.typeId === "minecraft:player" ? [value] : [];
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

function persistCommandState(player, item, definition, state) {
    const result = writeStatsState(item, definition, state, {
        syncLore: true,
        forceLore: true,
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
    });
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
    if (!definitionHasAbility(context.definition, option.key)) {
        return { ok: false, message: `${option.label} is not available for this equipment.` };
    }

    const level = Math.min(option.max, Math.max(option.min, Math.floor(Number(rawLevel) || option.min)));
    const targets = normalizeAppliesTo(appliesTo);
    if (targets.length <= 0) {
        return { ok: false, message: "appliesTo requires categories or exact entity typeIds." };
    }
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
        },
    });
    if (!persisted.ok) return persisted;

    return {
        ok: true,
        message: `${option.label} level ${level} | appliesTo: ${targets.join(", ")}`,
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
    });
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
        return `\u00A7e${entry.key}\u00A77 — ${entry.label} | ${entry.valueType} ${entry.min}..${entry.max}${targetType}`;
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
        message: `${item.typeId} -> ${refinement.grade} (${Math.round(refinement.quality * 100)}%) | core: ${normalizedCore} | ingots: ${refinement.ingotAmount}`,
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
    name: "sc:refine",
    description: "Custom-refines mainhand equipment with selectable Runic Core behavior",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["custom", "random"] },
        { name: "target", type: "player" },
        { name: "tier", type: "enum", values: Object.keys(REFINING_CONFIG.tierScales) },
        { name: "chip", type: "enum", values: [...REFINING_CONFIG.chips.keys()].map(entryAlias) },
        { name: "ingot", type: "enum", values: [...REFINING_CONFIG.ingots.keys()].map(entryAlias) },
        { name: "core", type: "enum", values: ["none", "normal", "advanced"] },
        { name: "amount", type: "int", optional: true },
    ],
    callback(origin, action, target, tier, chipValue, ingotValue, core, amount) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "custom") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /sc:state on first.");
            return;
        }

        const chip = getConfigEntry(REFINING_CONFIG.chips, chipValue);
        const ingot = getConfigEntry(REFINING_CONFIG.ingots, ingotValue);
        const coreMode = normalizeId(core);
        if (
            !chip
            || !ingot
            || !REFINING_CONFIG.tierScales[normalizeId(tier)]
            || !["none", "normal", "advanced"].includes(coreMode)
        ) {
            sendCommandMessage(source, "\u00A7cInvalid tier, chip, ingot, or core.");
            return;
        }

        const requestedAmount = Math.max(1, Math.floor(Number(amount) || 1));
        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const result = refineHeldEquipment(
                player,
                normalizeId(tier),
                chip,
                ingot,
                requestedAmount,
                coreMode,
            );
            sendCommandMessage(source, result.ok
                ? `\u00A7aRefined \u00A7f${player.name}: \u00A77${result.message}${result.troubles.length ? ` \u00A78| \u00A7d${result.troubles.join(" + ")} active` : ""}`
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
        { name: "kind", type: "enum", values: ["attributes", "abilities"] },
    ],
    callback(origin, kind) {
        const source = origin.sourceEntity;
        if (normalizeId(kind) === "attributes") {
            sendCatalog(source, "StatsCore refinement attributes", Object.values(REFINEMENT_ATTRIBUTE_CATALOG));
            return;
        }
        sendCatalog(source, "StatsCore refinement abilities", Object.values(REFINEMENT_ABILITY_CATALOG));
    },
});

DoriosLib.registry.customCommand({
    name: "sc:xp",
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

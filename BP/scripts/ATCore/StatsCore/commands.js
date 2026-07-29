import * as DoriosLib from "DoriosLib/index.js";
import {
    getEquipment,
    getStatsCoreDefinition,
    isStatsCoreEnabled,
    persistEquipmentItem,
    readStatsState,
    resolveStatsAttributes,
    setStatsCoreEnabled,
    writeStatsState,
} from "./API.js";
import { REFINING_TABLE_CONFIG as REFINING_CONFIG } from "../../config/recipes/refiningTable.js";
import { rollStatsRefinement } from "./refining/rolls.js";
import { STATSCORE_FEEDBACK_STYLES, getStatsCoreFeedbackStyle, setStatsCoreFeedbackStyle } from "./feedback/index.js";

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

function refineHeldEquipment(player, tier, chip, ingot, amount) {
    const { item } = getEquipment(player);
    if (!item) return { ok: false, message: "No mainhand equipment." };

    const definition = getStatsCoreDefinition(item);
    if (!definition) return { ok: false, message: `${item.typeId} is not registered.` };

    const state = readStatsState(item, definition);
    const refinement = rollStatsRefinement({
        definition,
        state,
        chip,
        ingot,
        amount,
        tier,
    });
    if (!refinement) return { ok: false, message: "This equipment has no refining profile." };

    // This command deliberately awakens abilities: it exists solely to test
    // refined equipment behavior without consuming a Runic Core.
    const result = writeStatsState(item, definition, {
        ...state,
        attributeProgress: {},
        refined: true,
        abilityData: {
            ...state.abilityData,
            uniqueUnlocked: true,
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
        message: `${item.typeId} -> ${refinement.grade} (${Math.round(refinement.quality * 100)}%)`,
        troubles,
    };
}

DoriosLib.registry.customCommand({
    name: "utilitycraft:statscorestate",
    description: "Changes the global StatsCore state",
    permissionLevel: "admin",
    parameters: [
        {
            name: "action",
            type: "enum",
            values: ["state"],
        },
        {
            name: "mode",
            type: "enum",
            values: ["on", "off"],
        },
    ],
    callback(origin, action, mode) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "state") return;
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
    name: "utilitycraft:statscorestyle",
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
            sendCommandMessage(source, "\u00A7cUse only_text, only_icons, or text_and_icons.");
            return;
        }

        sendCommandMessage(source, `\u00A7aStatsCore feedback style: \u00A7f${getStatsCoreFeedbackStyle(source)}`);
    },
});

DoriosLib.registry.customCommand({
    name: "utilitycraft:statscorerefine",
    description: "Test-refines the mainhand equipment of one or more players",
    permissionLevel: "admin",
    cheatsRequired: true,
    parameters: [
        { name: "action", type: "enum", values: ["refine"] },
        { name: "target", type: "player" },
        { name: "tier", type: "enum", values: Object.keys(REFINING_CONFIG.tierScales) },
        { name: "chip", type: "enum", values: [...REFINING_CONFIG.chips.keys()].map(entryAlias) },
        { name: "ingot", type: "enum", values: [...REFINING_CONFIG.ingots.keys()].map(entryAlias) },
        { name: "amount", type: "int", optional: true },
    ],
    callback(origin, action, target, tier, chipValue, ingotValue, amount) {
        const source = origin.sourceEntity;
        if (normalizeId(action) !== "refine") return;
        if (!isStatsCoreEnabled()) {
            sendCommandMessage(source, "\u00A7cStatsCore is disabled. Use /statscore state on first.");
            return;
        }

        const chip = getConfigEntry(REFINING_CONFIG.chips, chipValue);
        const ingot = getConfigEntry(REFINING_CONFIG.ingots, ingotValue);
        if (!chip || !ingot || !REFINING_CONFIG.tierScales[normalizeId(tier)]) {
            sendCommandMessage(source, "\u00A7cInvalid tier, chip, or ingot.");
            return;
        }

        const effectiveAmount = Math.min(
            REFINING_CONFIG.defaults.maxIngotsPerRoll,
            Math.max(1, Math.floor(Number(amount) || 1)),
        );
        const players = getSelectedPlayers(target);
        if (!players.length) {
            sendCommandMessage(source, "\u00A7cNo players matched the target.");
            return;
        }

        for (const player of players) {
            const result = refineHeldEquipment(player, normalizeId(tier), chip, ingot, effectiveAmount);
            sendCommandMessage(source, result.ok
                ? `\u00A7aRefined \u00A7f${player.name}: \u00A77${result.message}${result.troubles.length ? ` \u00A78| \u00A7d${result.troubles.join(" + ")} active` : ""}`
                : `\u00A7c${player.name}: ${result.message}`);
        }
    },
});

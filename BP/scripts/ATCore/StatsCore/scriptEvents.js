import { system } from "@minecraft/server";
import { STATSCORE } from "./constants.js";
import { getEquipment, persistEquipmentItem } from "./core/equipment.js";
import { collectStatsAbilityNames } from "./core/abilities.js";
import { getStatsCoreDefinition, getStatsCoreRegistrySize, registerStatsCoreDefinitions } from "./core/registry.js";
import { readStatsState, resetStatsState } from "./core/state.js";
import { clearStatsCoreLore } from "./core/lore.js";
import { resolveStatsAttributes } from "./attributes/resolve.js";
import { formatPercent, safeJsonParse, titleCaseIdentifier } from "./utils.js";

function sendMessage(entity, message) {
    try {
        entity?.sendMessage?.(message);
    } catch {
        console.warn(message);
    }
}

function inspectHeldItem(sourceEntity) {
    const { item } = getEquipment(sourceEntity, STATSCORE.slots.mainhand);
    if (!item) {
        sendMessage(sourceEntity, "\u00A7cStatsCore: no mainhand item.");
        return;
    }

    const definition = getStatsCoreDefinition(item);
    if (!definition) {
        sendMessage(sourceEntity, `\u00A7cStatsCore: ${item.typeId} is not registered.`);
        return;
    }

    const state = readStatsState(item, definition);
    const attributes = resolveStatsAttributes(definition, state);
    const registrySize = getStatsCoreRegistrySize();
    const abilityNames = collectStatsAbilityNames(attributes, { state });
    const categories = Object.values(state.progression ?? {});
    const level = categories.reduce((highest, entry) => Math.max(highest, Number(entry?.level ?? 1)), 1);
    const xp = categories.reduce((total, entry) => total + Math.max(0, Number(entry?.xp ?? 0)), 0);

    sendMessage(sourceEntity, `\u00A7dStatsCore \u00A77(${registrySize} registered)`);
    sendMessage(sourceEntity, `\u00A77Item: \u00A7f${item.typeId}`);
    sendMessage(sourceEntity, `\u00A77Level: \u00A7f${level} \u00A78| \u00A77XP: \u00A7f${xp}`);
    sendMessage(sourceEntity, `\u00A77Affinity: \u00A7f${titleCaseIdentifier(state.affinity)} \u00A78| \u00A77Branch: \u00A7f${titleCaseIdentifier(state.branch)}`);
    sendMessage(sourceEntity, `\u00A77Crit: \u00A7f${formatPercent(attributes.crit.chance)} \u00A78x${Number(attributes.crit.multiplier ?? 1).toFixed(2)}`);
    sendMessage(sourceEntity, `\u00A77Armor Penetration: \u00A7f${formatPercent(attributes.penetration.percent)} \u00A78| \u00A77Lifesteal: \u00A7f${formatPercent(attributes.lifesteal.percent)}`);
    sendMessage(sourceEntity, `\u00A77Bonus Loot: \u00A7f${formatPercent(attributes.mining.bonusLootChance)} \u00A78| \u00A77Preserving: \u00A7f${formatPercent(attributes.mining.durabilitySaveChance)}`);
    if (abilityNames.length > 0) {
        sendMessage(sourceEntity, `\u00A77Abilities: \u00A7g${abilityNames.join(" \u00A78+ \u00A7g")}`);
    }
}

function resetHeldItem(sourceEntity) {
    const { item } = getEquipment(sourceEntity, STATSCORE.slots.mainhand);
    if (!item) {
        sendMessage(sourceEntity, "\u00A7cStatsCore: no mainhand item.");
        return;
    }

    const stateChanged = resetStatsState(item);
    const loreChanged = clearStatsCoreLore(item);
    const changed = stateChanged || loreChanged;
    if (changed) {
        persistEquipmentItem(sourceEntity, STATSCORE.slots.mainhand, item);
    }

    sendMessage(sourceEntity, `\u00A7aStatsCore reset: ${item.typeId}`);
}

export function initializeStatsCoreScriptEvents() {
    if (globalThis.__statsCoreScriptEventsInitialized) return;
    globalThis.__statsCoreScriptEventsInitialized = true;

    if (!system.afterEvents?.scriptEventReceive?.subscribe) return;

    system.afterEvents.scriptEventReceive.subscribe(event => {
        const id = event?.id;
        if (!id || !Object.values(STATSCORE.scriptEvents).includes(id)) return;

        if (id === STATSCORE.scriptEvents.inspect) {
            inspectHeldItem(event.sourceEntity);
            return;
        }

        if (id === STATSCORE.scriptEvents.reset) {
            resetHeldItem(event.sourceEntity);
            return;
        }

        if (id === STATSCORE.scriptEvents.register) {
            const payload = safeJsonParse(String(event.message ?? "").trim());
            if (!payload) return;

            try {
                registerStatsCoreDefinitions(payload);
            } catch (error) {
                console.warn("[StatsCore] register script event failed:", error);
            }
        }
    });
}

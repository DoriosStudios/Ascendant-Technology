import { system } from "@minecraft/server";
import { STATSCORE } from "./constants.js";
import { getEquipment, persistEquipmentItem } from "./core/equipment.js";
import { collectStatsAbilityNames } from "./core/abilities.js";
import { getStatsCoreDefinition, getStatsCoreRegistrySnapshot, registerStatsCoreDefinitions } from "./core/registry.js";
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
        sendMessage(sourceEntity, "§cStatsCore: no mainhand item.");
        return;
    }

    const definition = getStatsCoreDefinition(item);
    if (!definition) {
        sendMessage(sourceEntity, `§cStatsCore: ${item.typeId} is not registered.`);
        return;
    }

    const state = readStatsState(item, definition);
    const attributes = resolveStatsAttributes(definition, state);
    const registrySize = Object.keys(getStatsCoreRegistrySnapshot()).length;
    const abilityNames = collectStatsAbilityNames(attributes);

    sendMessage(sourceEntity, `§dStatsCore §7(${registrySize} registered)`);
    sendMessage(sourceEntity, `§7Item: §f${item.typeId}`);
    sendMessage(sourceEntity, `§7Level: §f${state.level} §8| §7XP: §f${state.xp}`);
    sendMessage(sourceEntity, `§7Affinity: §f${titleCaseIdentifier(state.affinity)} §8| §7Branch: §f${titleCaseIdentifier(state.branch)}`);
    sendMessage(sourceEntity, `§7Crit: §f${formatPercent(attributes.crit.chance)} §8x${Number(attributes.crit.multiplier ?? 1).toFixed(2)}`);
    sendMessage(sourceEntity, `§7Armor Penetration: §f${formatPercent(attributes.penetration.percent)} §8| §7Lifesteal: §f${formatPercent(attributes.lifesteal.percent)}`);
    sendMessage(sourceEntity, `§7Ore Bonus: §f${formatPercent(attributes.mining.oreBonusChance)} §8| §7Preserving: §f${formatPercent(attributes.mining.durabilitySaveChance)}`);
    if (abilityNames.length > 0) {
        sendMessage(sourceEntity, `§7Abilities: §g${abilityNames.join(" §8+ §g")}`);
    }
}

function resetHeldItem(sourceEntity) {
    const { item } = getEquipment(sourceEntity, STATSCORE.slots.mainhand);
    if (!item) {
        sendMessage(sourceEntity, "§cStatsCore: no mainhand item.");
        return;
    }

    const stateChanged = resetStatsState(item);
    const loreChanged = clearStatsCoreLore(item);
    const changed = stateChanged || loreChanged;
    if (changed) {
        persistEquipmentItem(sourceEntity, STATSCORE.slots.mainhand, item);
    }

    sendMessage(sourceEntity, `§aStatsCore reset: ${item.typeId}`);
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
                const count = registerStatsCoreDefinitions(payload);
                if (count > 0) {
                    console.warn(`[StatsCore] Registered ${count} definition${count === 1 ? "" : "s"} via ScriptEvent.`);
                }
            } catch (error) {
                console.warn("[StatsCore] register script event failed:", error);
            }
        }
    });
}

import { system } from "@minecraft/server";
import { getStatsCoreEffectDefinition } from "./catalog.js";
import { getStatsCoreEffect, upsertStatsCoreEffect } from "./state.js";
import { applyPotionBleeding, applyPreparedBlessing } from "../combat/effects.js";
import { applyEffectById } from "../shared/effects.js";

const SOURCE = "alchemy";

/** Apply a drink/splash/cloud payload using the real StatsCore status machinery. */
export function applyStatsCorePotionEffect(target, id, durationTicks, level = 1) {
    const definition = getStatsCoreEffectDefinition(id);
    if (!definition || !target || durationTicks < 20) return false;
    const previous = getStatsCoreEffect(target, id, SOURCE);
    // Cloud refreshes and weaker bottles cannot downgrade an active stronger potion.
    if (previous && previous.level > level) return true;
    const ticks = Math.max(durationTicks, previous?.level === level ? previous.expiresAtTick - system.currentTick : 0);
    if (id === "bleeding") return applyPotionBleeding(target, ticks, level);
    if (id === "blessed") {
        const undead = target.matches?.({ families: ["undead"] }) === true;
        return applyPreparedBlessing({ target, prepared: {
            undead, source: SOURCE, level,
            aspect: { playerDurationTicks: ticks, mobDurationTicks: ticks, regenerationAmplifier: level - 1,
                healthBoostAmplifier: 4 + level, resistanceAmplifier: level - 1,
                healAmount: previous ? 0 : 8 * level, blessingDamage: 8 * level, tickInterval: 10 },
        } });
    }
    if (id === "cursed") {
        applyEffectById(target, "slowness", ticks, level - 1, true);
        applyEffectById(target, "weakness", ticks, level + 1, true);
        applyEffectById(target, "hunger", ticks, level + 1, true);
    } else if (id === "berserk") {
        applyEffectById(target, "strength", ticks, level - 1, true);
    }
    return upsertStatsCoreEffect(target, { id, source: SOURCE, level, durationTicks: ticks,
        displayMode: id === "soul_collector" ? "charges" : "duration",
        ...(id === "soul_collector" ? { maxCharges: 5, currentCharges: previous?.currentCharges ?? 0 } : {}),
        data: { damageType: previous?.data?.damageType, stacks: previous?.data?.stacks ?? 0 },
    });
}

/** Timed defensive adaptation works with or without StatsCore armor. */
export function applyStatsCorePotionDefense(event, target, damageType) {
    const state = getStatsCoreEffect(target, "adaptive_resilience", SOURCE);
    if (!state || event.damage <= 0) return;
    const same = state.data?.damageType === damageType;
    const stacks = same ? Math.min(5, Number(state.data?.stacks ?? 0) + 1) : 1;
    event.damage *= 1 - Math.min(0.45, 0.03 * state.level * stacks);
    // Hurt events are restricted; update the published status on the following tick.
    system.run(() => {
        if (getStatsCoreEffect(target, "adaptive_resilience", SOURCE) !== state) return;
        upsertStatsCoreEffect(target, { ...state, source: SOURCE, data: { ...state.data, damageType, stacks } });
    });
}

/** Potion bonuses are independent of equipment effects and consume no equipment charges. */
export function applyStatsCorePotionOffense(event, attacker, target) {
    if (event.damage <= 0) return;
    const marked = getStatsCoreEffect(target, "marked", SOURCE);
    if (marked) event.damage *= 1 + 0.1 * marked.level;
    const berserk = getStatsCoreEffect(attacker, "berserk", SOURCE);
    if (berserk) event.damage += berserk.level;
    const soul = getStatsCoreEffect(attacker, "soul_collector", SOURCE);
    if (!soul || soul.currentCharges < soul.maxCharges) return;
    const charges = soul.currentCharges;
    event.damage *= 1 + 0.05 * soul.level * charges;
    // Reserve now so multiple same-tick hits cannot consume the same souls.
    soul.currentCharges = 0;
    system.run(() => {
        try {
            // A lethal charged hit may already have collected a new soul. Keep
            // that charge while completing the heal earned by the original hit.
            if (getStatsCoreEffect(attacker, "soul_collector", SOURCE) === soul) {
                upsertStatsCoreEffect(attacker, { ...soul, source: SOURCE });
            }
            const health = attacker.getComponent?.("minecraft:health");
            if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + (0.35 + 0.2 * soul.level) * charges));
        } catch { /* An entity may die or unload before the deferred heal. */ }
    });
}

/** Like the equipment ability, kills fill five souls and the next hit spends them. */
export function collectStatsCorePotionSoul(attacker, gainedCharges = 1) {
    const state = getStatsCoreEffect(attacker, "soul_collector", SOURCE);
    if (!state) return;
    upsertStatsCoreEffect(attacker, { ...state, source: SOURCE,
        currentCharges: Math.min(state.maxCharges, state.currentCharges + gainedCharges),
    });
}

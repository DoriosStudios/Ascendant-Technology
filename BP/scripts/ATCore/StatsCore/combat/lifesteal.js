import { clamp01 } from "../utils.js";

function getHealth(entity) {
    try {
        return entity?.getComponent?.("minecraft:health") ?? entity?.getComponent?.("health");
    } catch {
        return undefined;
    }
}

function getCurrentHealth(health) {
    return Number(health?.currentValue ?? health?.value ?? 0);
}

function getMaxHealth(health, current) {
    return Number(
        health?.effectiveMax
        ?? health?.defaultValue
        ?? health?.max
        ?? Math.max(current, 20)
    );
}

export function applyLifeSteal(attacker, finalDamage, attributes, context = {}) {
    const lifesteal = attributes?.lifesteal ?? {};
    let percent = clamp01(lifesteal.percent ?? 0);
    if (context.crit === true) {
        percent = clamp01(percent + clamp01(lifesteal.critBonus ?? 0));
    }

    if (percent <= 0 || finalDamage <= 0) return 0;

    const health = getHealth(attacker);
    if (!health) return 0;

    const current = getCurrentHealth(health);
    const max = getMaxHealth(health, current);
    if (!Number.isFinite(current) || !Number.isFinite(max) || current >= max) return 0;

    const healed = Math.max(0, Math.min(max - current, finalDamage * percent));
    if (healed <= 0) return 0;

    try {
        if (typeof health.setCurrentValue === "function") {
            health.setCurrentValue(Math.min(max, current + healed));
        } else {
            health.currentValue = Math.min(max, current + healed);
        }
        return healed;
    } catch {
        return 0;
    }
}


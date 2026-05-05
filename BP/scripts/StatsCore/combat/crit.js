import { STATSCORE } from "../constants.js";
import { getCurrentTick, normalizeChance, rollChance } from "../utils.js";

const recentHits = new Map();

function entityKey(entity) {
    if (!entity) return "unknown";
    if (entity.id) return String(entity.id);

    const loc = entity.location;
    if (!loc) return String(entity.typeId ?? "entity");

    return `${entity.typeId}:${Math.floor(loc.x)}:${Math.floor(loc.y)}:${Math.floor(loc.z)}`;
}

function contactKey(attacker, target) {
    return `${entityKey(attacker)}>${entityKey(target)}`;
}

export function rollStatsCrit({ attacker, target, attributes }) {
    const now = getCurrentTick();
    const key = contactKey(attacker, target);
    const lastHitTick = Number(recentHits.get(key) ?? -1);
    const isOpening = lastHitTick < 0 || now - lastHitTick >= STATSCORE.runtime.openingWindowTicks;
    const isPrecision = attacker?.isSneaking === true;

    const crit = attributes?.crit ?? {};
    const maxChance = normalizeChance(crit.maxChance, 0.35);
    const chance = Math.min(
        maxChance,
        normalizeChance(crit.chance, 0)
            + (isOpening ? normalizeChance(crit.openingBonus, 0) : 0)
            + (isPrecision ? normalizeChance(crit.precisionBonus, 0) : 0)
    );

    return {
        active: rollChance(chance),
        chance,
        multiplier: Math.max(1, Number(crit.multiplier) || 1),
        isOpening,
        isPrecision
    };
}

export function rememberCombatContact(attacker, target) {
    recentHits.set(contactKey(attacker, target), getCurrentTick());

    if (recentHits.size <= 512) return;

    const now = getCurrentTick();
    for (const [key, tick] of recentHits.entries()) {
        if (now - Number(tick) > STATSCORE.runtime.openingWindowTicks * 4) {
            recentHits.delete(key);
        }
    }
}

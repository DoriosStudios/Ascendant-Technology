import { STATSCORE } from "../constants.js";
import { getCurrentTick, titleCaseIdentifier } from "../utils.js";

const feedbackCooldowns = new Map();

function getPlayerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function canShow(player, key, cooldownTicks = STATSCORE.runtime.feedbackCooldownTicks) {
    if (!player) return false;

    const now = getCurrentTick();
    const id = `${getPlayerKey(player)}:${key}`;
    const nextAllowed = Number(feedbackCooldowns.get(id) ?? 0);
    if (nextAllowed > now) return false;

    feedbackCooldowns.set(id, now + Math.max(1, Math.floor(Number(cooldownTicks) || 1)));
    return true;
}

function showActionBar(player, message, key, cooldownTicks) {
    if (!message || !canShow(player, key, cooldownTicks)) return;
    try {
        player?.onScreenDisplay?.setActionBar?.(message);
    } catch { }
}

function playSound(entity, soundId, options) {
    try {
        const location = entity?.location;
        if (!location || !soundId) return;
        entity.dimension?.playSound?.(soundId, location, options);
    } catch { }
}

function spawnParticle(entity, particleId, offset = { x: 0, y: 1, z: 0 }) {
    try {
        const location = entity?.location;
        if (!location || !particleId) return;
        entity.dimension?.spawnParticle?.(particleId, {
            x: location.x + (offset.x ?? 0),
            y: location.y + (offset.y ?? 0),
            z: location.z + (offset.z ?? 0)
        });
    } catch { }
}

export function showCombatFeedback(attacker, target, result) {
    if (!attacker || result?.crit?.active !== true) return;

    showActionBar(
        attacker,
        `§eCrit §7x${Number(result.crit.multiplier ?? 1).toFixed(2)}${result.penetration?.restored > 0 ? " §8| §bPierce" : ""}`,
        "combat",
        10
    );

    playSound(attacker, "random.orb", { volume: 0.35, pitch: 1.35 });
    spawnParticle(target ?? attacker, "minecraft:critical_hit_emitter", { x: 0, y: 1, z: 0 });
}

export function showMiningFeedback(player, blockId, result) {
    if (!player || (!result?.bonusDrop && !result?.bonusXp)) return;

    const segments = [];
    if (result?.bonusXp) segments.push("§gLuck");
    if (result?.bonusDrop) segments.push("§bRefined Yield");

    showActionBar(player, `${segments.join(" §8| ")} §8| §7${titleCaseIdentifier(blockId)}`, "mining", 16);
    playSound(player, result?.bonusXp ? "random.orb" : "random.pop", {
        volume: 0.3,
        pitch: result?.bonusXp ? 1.35 : 1.25,
    });
}

export function showLevelUp(player, stack, result) {
    if (!player || !result?.levelUp) return;

    showActionBar(
        player,
        `§dStatsCore Lv ${result.previousLevel} -> ${result.level}`,
        `level:${stack?.typeId ?? "item"}`,
        4
    );

    playSound(player, "random.levelup", { volume: 0.45, pitch: 1.1 });
    spawnParticle(player, "minecraft:totem_particle", { x: 0, y: 1.2, z: 0 });
}

import { system } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getCurrentTick, titleCaseIdentifier } from "../utils.js";
import { actionBar } from "../../../DoriosLib/messages/index.js";
import {
    getAbilityIcon,
    getAttributeIcon,
    getElementIcon,
    getProgressionIcon,
    STATSCORE_ICONS,
    uniqueIcons,
} from "../icons.js";

const feedbackCooldowns = new Map();
const pendingActionBars = new Map();

/**
 * The canonical names make the presentation choice explicit. Legacy values are
 * accepted on read so players do not lose their saved preference after updating.
 */
export const STATSCORE_FEEDBACK_STYLES = Object.freeze([
    "only_text",
    "only_icons",
    "text_and_icons",
    "text",
    "emoji",
    "both",
]);

const FEEDBACK_STYLE_ALIASES = Object.freeze({
    text: "only_text",
    emoji: "only_icons",
    both: "text_and_icons",
});

function normalizeFeedbackStyle(style) {
    const normalized = String(style ?? "").trim().toLowerCase();
    const canonical = FEEDBACK_STYLE_ALIASES[normalized] ?? normalized;
    return STATSCORE_FEEDBACK_STYLES.includes(canonical) ? canonical : "text_and_icons";
}

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

export function getStatsCoreFeedbackStyle(player) {
    try {
        return normalizeFeedbackStyle(player?.getDynamicProperty?.(STATSCORE.playerProperties.feedbackStyle));
    } catch {
        return "text_and_icons";
    }
}

export function setStatsCoreFeedbackStyle(player, style) {
    const rawStyle = String(style ?? "").trim().toLowerCase();
    const normalized = normalizeFeedbackStyle(rawStyle);
    if (!player || (!STATSCORE_FEEDBACK_STYLES.includes(rawStyle) && !FEEDBACK_STYLE_ALIASES[rawStyle])) return false;
    try {
        player.setDynamicProperty?.(STATSCORE.playerProperties.feedbackStyle, normalized);
        return true;
    } catch {
        return false;
    }
}

function formatFeedback(entry, style) {
    const text = String(entry?.text ?? "").trim();
    const icons = String(entry?.emoji ?? "").trim() || STATSCORE_ICONS.unknown;
    if (style === "only_icons") return icons;
    if (style === "only_text") return text;
    return text ? `${icons} ${text}` : icons;
}

function queueActionBar(player, entry) {
    const playerKey = getPlayerKey(player);
    const pending = pendingActionBars.get(playerKey) ?? { player, entries: [], scheduled: false };
    pending.player = player;
    if (!pending.entries.some(value => value.key === entry.key)) pending.entries.push(entry);
    pendingActionBars.set(playerKey, pending);

    if (pending.scheduled) return;
    pending.scheduled = true;
    system.runTimeout(() => {
        const queued = pendingActionBars.get(playerKey);
        pendingActionBars.delete(playerKey);
        if (!queued?.player || !queued.entries?.length) return;

        const style = getStatsCoreFeedbackStyle(queued.player);
        const messages = queued.entries.map(value => formatFeedback(value, style)).filter(Boolean);
        if (messages.length > 0) actionBar(queued.player, messages.join(" \u00A78| "));
    }, 2);
}

function showActionBar(player, message, key, cooldownTicks, emoji = STATSCORE_ICONS.unknown) {
    if (!message || !canShow(player, key, cooldownTicks)) return;
    queueActionBar(player, { key, text: message, emoji });
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
    if (!attacker) return;

    const elemental = Array.isArray(result?.elemental) ? result.elemental.filter(Boolean) : [];
    const extraDamage = Math.max(0, Number(result?.extraDamage ?? 0) || 0);
    const segments = [];
    if (result?.crit?.active === true) {
        segments.push(`\u00A7eCrit \u00A77x${Number(result.crit.multiplier ?? 1).toFixed(2)}`);
    }
    if (extraDamage > 0.001) {
        const formatted = Number.isInteger(extraDamage) ? String(extraDamage) : extraDamage.toFixed(1);
        segments.push(`\u00A7c+${formatted} Extra Damage`);
    }
    if (result?.penetration?.restored > 0) segments.push("\u00A7bPierce");
    if (elemental.length > 0) {
        segments.push(`\u00A79${elemental.map(titleCaseIdentifier).join(" + ")}`);
    }
    if (segments.length <= 0) return;

    const icons = uniqueIcons([
        result?.crit?.active === true ? STATSCORE_ICONS.criticalMultiplier : "",
        extraDamage > 0.001 ? STATSCORE_ICONS.attackDamage : "",
        result.penetration?.restored > 0 ? STATSCORE_ICONS.fullArmor : "",
        ...elemental.map(getElementIcon),
    ]);
    showActionBar(
        attacker,
        segments.join(" \u00A78| "),
        "combat",
        10,
        icons
    );

    playSound(attacker, "random.orb", { volume: 0.35, pitch: 1.35 });
    spawnParticle(target ?? attacker, "minecraft:critical_hit_emitter", { x: 0, y: 1, z: 0 });
}

export function showMiningFeedback(player, blockId, result) {
    if (!player || (!result?.bonusDrop && !result?.bonusXp && !result?.preserved)) return;

    const segments = [];
    if (result?.bonusXp) segments.push("\u00A7gLuck");
    if (result?.bonusDrop) segments.push(result?.bonusDropLabel ?? "\u00A7bRefined Yield");
    if (result?.preserved) segments.push("\u00A7aPreserving");

    const label = segments.join(" \u00A78| ");
    const icons = uniqueIcons([
        result?.bonusXp ? STATSCORE_ICONS.luck : "",
        result?.bonusDropLabel?.includes("Triple")
            ? STATSCORE_ICONS.tripleTrouble
            : result?.bonusDropLabel?.includes("Double")
                ? STATSCORE_ICONS.doubleTrouble
                : result?.bonusDrop ? STATSCORE_ICONS.oreYield : "",
        result?.preserved ? STATSCORE_ICONS.preservingTool : "",
    ]);
    showActionBar(player, `${label} \u00A78| \u00A77${titleCaseIdentifier(blockId)}`, `mining:${label}:${blockId}`, 16, icons);
    if (result?.silent !== true) {
        playSound(player, result?.bonusXp ? "random.orb" : "random.pop", {
            volume: 0.3,
            pitch: result?.bonusXp ? 1.35 : 1.25,
        });
    }
}

export function showLevelUp(player, stack, result) {
    if (!player || !result?.levelUp || !result.category) return;

    const categoryName = titleCaseIdentifier(result.category);
    const raisedGains = Array.isArray(result.raisedAttributeGains) ? result.raisedAttributeGains : [];
    const raised = raisedGains.length > 0
        ? ` \u00A78| \u00A7b${raisedGains.map(({ label, value }) => {
            const percent = Math.max(0, Number(value ?? 0) || 0) * 100;
            const formatted = Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));
            return `+${formatted}% ${label}`;
        }).join(", ")}`
        : Array.isArray(result.raisedAttributeLabels) && result.raisedAttributeLabels.length > 0
            ? ` \u00A78| \u00A7b${result.raisedAttributeLabels.map(label => `+1 ${label}`).join(", ")}`
            : "";
    const raisedLabels = raisedGains.length > 0
        ? raisedGains.map(({ label }) => label)
        : Array.isArray(result.raisedAttributeLabels) ? result.raisedAttributeLabels : [];
    const icons = uniqueIcons([
        getProgressionIcon(result.category),
        ...raisedLabels.map(label => getAttributeIcon(label, result.category)),
    ]);
    showActionBar(
        player,
        `\u00A76${categoryName} Lvl ${result.previousLevel} -> ${result.level}${raised}`,
        `level:${stack?.typeId ?? "item"}`,
        4,
        icons
    );

    playSound(player, "random.levelup", { volume: 0.45, pitch: 1.1 });
    spawnParticle(player, "minecraft:totem_particle", { x: 0, y: 1.2, z: 0 });
}

export function showAbilityFeedback(player, label, emoji = "") {
    if (!player || !label) return;
    showActionBar(player, `\u00A7g${label}`, `ability:${String(label).toLowerCase()}`, 4, emoji || getAbilityIcon(label));
}

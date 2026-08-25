import { system } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getCurrentTick, titleCaseIdentifier } from "../utils.js";
import {
    isInsightActionbarQueueAvailable,
    setActionBarSafe,
} from "../shared/messages.js";
import {
    getAbilityIcon,
    getAttributeIcon,
    getElementIcon,
    getProgressionIcon,
    STATSCORE_ICONS,
    uniqueIcons,
} from "../icons.js";

const feedbackCooldowns = new Map();
const feedbackPreferences = new Map();
const pendingActionBars = new Map();
const pendingLevelUps = new Map();
const INSIGHT_ACTIVITY_EVENT = "insight:statscore_activity_v1";
const MINING_ABILITY_TOKENS = Object.freeze([
    "double trouble",
    "triple trouble",
    "green thumb",
    "primal",
    "forger",
    "crushing",
    "berserk",
    "worm",
]);

/**
 * The canonical names make the presentation choice explicit. Legacy values are
 * accepted on read so players do not lose their saved preference after updating.
 */
export const STATSCORE_FEEDBACK_STYLES = Object.freeze([
    "only_text",
    "only_icons",
    "text_and_icons",
    "both_partial",
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
    return STATSCORE_FEEDBACK_STYLES.includes(canonical) ? canonical : "both_partial";
}

function getPlayerKey(player) {
    return String(player?.id ?? player?.name ?? "unknown");
}

function getPreferenceCache(player) {
    const playerKey = getPlayerKey(player);
    const tick = getCurrentTick();
    let cached = feedbackPreferences.get(playerKey);
    if (!cached || cached.tick !== tick) {
        cached = { tick };
        feedbackPreferences.set(playerKey, cached);
    }

    if (feedbackPreferences.size > 128) {
        for (const [key, entry] of feedbackPreferences) {
            if (entry.tick !== tick) feedbackPreferences.delete(key);
        }
    }
    return cached;
}

function canShow(player, key, cooldownTicks = STATSCORE.runtime.feedbackCooldownTicks) {
    if (!player) return false;

    const now = getCurrentTick();
    const id = `${getPlayerKey(player)}:${key}`;
    const nextAllowed = Number(feedbackCooldowns.get(id) ?? 0);
    if (nextAllowed > now) return false;

    feedbackCooldowns.set(id, now + Math.max(1, Math.floor(Number(cooldownTicks) || 1)));
    if (feedbackCooldowns.size > 256) {
        for (const [cachedId, expiresAt] of feedbackCooldowns) {
            if (Number(expiresAt ?? 0) <= now) feedbackCooldowns.delete(cachedId);
        }
    }
    return true;
}

export function getStatsCoreFeedbackStyle(player) {
    const cached = getPreferenceCache(player);
    if (cached.style !== undefined) return cached.style;
    try {
        cached.style = normalizeFeedbackStyle(player?.getDynamicProperty?.(STATSCORE.playerProperties.feedbackStyle));
    } catch {
        cached.style = "both_partial";
    }
    return cached.style;
}

export function setStatsCoreFeedbackStyle(player, style) {
    const rawStyle = String(style ?? "").trim().toLowerCase();
    const normalized = normalizeFeedbackStyle(rawStyle);
    if (!player || (!STATSCORE_FEEDBACK_STYLES.includes(rawStyle) && !FEEDBACK_STYLE_ALIASES[rawStyle])) return false;
    try {
        player.setDynamicProperty?.(STATSCORE.playerProperties.feedbackStyle, normalized);
        getPreferenceCache(player).style = normalized;
        return true;
    } catch {
        return false;
    }
}

/**
 * Both addons use this player property as a single source of truth. When the
 * bridge is active, Insight owns StatsCore's visual feedback.
 */
export function isStatsCoreInsightBridgeEnabled(player) {
    const cached = getPreferenceCache(player);
    if (cached.insightBridge !== undefined) return cached.insightBridge;
    try {
        cached.insightBridge = player?.getDynamicProperty?.(STATSCORE.playerProperties.insightBridge) === true;
    } catch {
        cached.insightBridge = false;
    }
    return cached.insightBridge;
}

export function setStatsCoreInsightBridgeEnabled(player, enabled) {
    if (!player) return false;
    try {
        player.setDynamicProperty?.(STATSCORE.playerProperties.insightBridge, enabled === true);
        getPreferenceCache(player).insightBridge = enabled === true;
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

function formatPartialFeedback(entries) {
    const values = Array.isArray(entries) ? entries : [];
    const icons = uniqueIcons(values.flatMap(entry => String(entry?.emoji ?? "")
        .split(/\s+/g)
        .filter(Boolean)));
    const primary = [...values]
        .filter(entry => String(entry?.text ?? "").trim())
        .sort((left, right) => Number(right?.priority ?? 0) - Number(left?.priority ?? 0))[0];
    const text = String(primary?.text ?? "").trim();
    const prefix = icons || STATSCORE_ICONS.unknown;
    return text ? `${prefix} ${text}` : prefix;
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
        const messages = style === "both_partial"
            ? [formatPartialFeedback(queued.entries)]
            : queued.entries.map(value => formatFeedback(value, style)).filter(Boolean);
        if (messages.length > 0) setActionBarSafe(queued.player, messages.join(" \u00A78| "));
    }, 2);
}

function showActionBar(player, message, key, cooldownTicks, emoji = STATSCORE_ICONS.unknown, priority = 0) {
    if (isStatsCoreInsightBridgeEnabled(player) && !isInsightActionbarQueueAvailable()) return;
    if (!message || !canShow(player, key, cooldownTicks)) return;
    queueActionBar(player, { key, text: message, emoji, priority });
}

function normalizeInsightIcons(values) {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(list
        .flatMap(value => String(value ?? "").trim().split(/\s+/g))
        .filter(Boolean))];
}

function publishInsightActivity(player, activity = {}) {
    if (isInsightActionbarQueueAvailable()) return;
    if (!player?.id || !isStatsCoreInsightBridgeEnabled(player)) return;

    const primary = normalizeInsightIcons(activity.primary);
    const attributes = normalizeInsightIcons(activity.attributes);
    const levelUps = normalizeInsightIcons(activity.levelUps);
    if (primary.length <= 0 && attributes.length <= 0 && levelUps.length <= 0) return;

    try {
        system.sendScriptEvent(INSIGHT_ACTIVITY_EVENT, JSON.stringify({
            playerId: player.id,
            primary,
            attributes,
            levelUps,
            durationTicks: activity.durationTicks ?? 32,
        }));
    } catch {
        // The optional Insight HUD may not be installed.
    }
}

function formatInsightIcon(icon) {
    return String(icon ?? "").trim() || STATSCORE_ICONS.unknown;
}

function getMiningAbilityLabel(label) {
    const text = String(label ?? "").trim();
    const plain = text.replace(/§./g, "").toLowerCase();
    return MINING_ABILITY_TOKENS.some(token => plain.includes(token)) ? text : "";
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

    const damage = Math.max(0, Number(result?.damage ?? 0) || 0);
    const elemental = Array.isArray(result?.elemental) ? result.elemental.filter(Boolean) : [];
    const extraDamage = Math.max(0, Number(result?.extraDamage ?? 0) || 0);
    const flatDamageBonus = Math.max(0, Number(result?.flatDamageBonus ?? 0) || 0);
    const damageMultiplier = Math.max(1, Number(result?.damageMultiplier ?? 1) || 1);
    const berserkDamageBonus = Math.max(0, Number(result?.berserkDamageBonus ?? 0) || 0);
    const segments = [];
    const hudAttributes = [];
    if (damage > 0.001) {
        const formatted = Number.isInteger(damage) ? String(damage) : damage.toFixed(1);
        segments.push(`\u00A7cDamage ${formatted}`);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.attackDamage));
    }
    if (result?.crit?.active === true) {
        const critText = `\u00A7eCrit \u00A77x${Number(result.crit.multiplier ?? 1).toFixed(2)}`;
        segments.push(critText);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.criticalMultiplier));
    }
    if (flatDamageBonus > 0.001) {
        const formatted = Number.isInteger(flatDamageBonus) ? String(flatDamageBonus) : flatDamageBonus.toFixed(1);
        const extraDamageText = `\u00A7c+${formatted} Extra Damage`;
        segments.push(extraDamageText);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.attackDamage));
    }
    if (damageMultiplier > 1.001) {
        const multiplierText = `\u00A7cDamage x${damageMultiplier.toFixed(2)}`;
        segments.push(multiplierText);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.attackDamage));
    }
    if (berserkDamageBonus > 0.001) {
        const berserkText = `\u00A7cBerserk +${Number.isInteger(berserkDamageBonus) ? berserkDamageBonus : berserkDamageBonus.toFixed(1)}`;
        segments.push(berserkText);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.sword));
    }
    if (extraDamage > 0.001 && flatDamageBonus <= 0.001 && damageMultiplier <= 1.001 && berserkDamageBonus <= 0.001) {
        const extraDamageText = `\u00A7c+${Number.isInteger(extraDamage) ? extraDamage : extraDamage.toFixed(1)} Damage`;
        segments.push(extraDamageText);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.attackDamage));
    }
    if (result?.markedDamageBonus > 0) {
        const marked = `\u00A7dMarked Damage +${Math.round(result.markedDamageBonus * 100)}%`;
        segments.push(marked);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.attackDamage));
    }
    if (result?.penetration?.restored > 0) {
        segments.push("\u00A7bPierce");
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.fullArmor));
    }
    if (result?.lifestealHealed > 0) {
        const lifesteal = `\u00A7aLifesteal +${Number(result.lifestealHealed).toFixed(1)}`;
        segments.push(lifesteal);
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.healedHeart));
    }
    if (elemental.length > 0) {
        segments.push(`\u00A79${elemental.map(titleCaseIdentifier).join(" + ")}`);
        for (const element of elemental) {
            hudAttributes.push(formatInsightIcon(getElementIcon(element)));
        }
    }
    const abilities = Array.isArray(result?.abilities) ? result.abilities.filter(Boolean) : [];
    publishInsightActivity(
        attacker,
        {
            primary: abilities.map(getAbilityIcon),
            attributes: hudAttributes,
        },
    );
    if (segments.length <= 0) return;

    const icons = uniqueIcons([
        result?.crit?.active === true ? STATSCORE_ICONS.criticalMultiplier : "",
        damage > 0.001 || extraDamage > 0.001 ? STATSCORE_ICONS.attackDamage : "",
        result.penetration?.restored > 0 ? STATSCORE_ICONS.fullArmor : "",
        ...elemental.map(getElementIcon),
    ]);
    const partialStyle = getStatsCoreFeedbackStyle(attacker) === "both_partial";
    const totalDamageText = damage > 0.001
        ? `§cDamage ${Number.isInteger(damage) ? damage : damage.toFixed(1)}`
        : "";
    if (partialStyle && !totalDamageText) return;
    showActionBar(
        attacker,
        partialStyle ? totalDamageText : segments.join(" \u00A78| "),
        "combat",
        10,
        partialStyle ? STATSCORE_ICONS.attackDamage : icons,
        70
    );

    playSound(attacker, "random.orb", { volume: 0.35, pitch: 1.35 });
    spawnParticle(target ?? attacker, "minecraft:critical_hit_emitter", { x: 0, y: 1, z: 0 });
}

export function showMiningFeedback(player, blockId, result) {
    if (!player || (!result?.bonusDrop && !result?.bonusXp && !result?.preserved)) return;

    const segments = [];
    const hudAttributes = [];
    if (result?.bonusXp) {
        segments.push("\u00A7gLuck");
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.luck));
    }
    const bonusLabel = result?.bonusDropLabel ?? "\u00A7bRefined Yield";
    const primaryAbility = result?.bonusDrop ? getMiningAbilityLabel(bonusLabel) : "";
    if (result?.bonusDrop) {
        segments.push(bonusLabel);
        if (!primaryAbility) {
            hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.oreYield));
        }
    }
    if (result?.preserved) {
        segments.push("\u00A7aPreserving");
        hudAttributes.push(formatInsightIcon(STATSCORE_ICONS.preservingTool));
    }

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
    publishInsightActivity(
        player,
        {
            primary: primaryAbility ? getAbilityIcon(primaryAbility) : [],
            attributes: hudAttributes,
        },
    );
    showActionBar(player, `${label} \u00A78| \u00A77${titleCaseIdentifier(blockId)}`, `mining:${label}:${blockId}`, 16, icons, 50);
    if (result?.silent !== true) {
        playSound(player, result?.bonusXp ? "random.orb" : "random.pop", {
            volume: 0.3,
            pitch: result?.bonusXp ? 1.35 : 1.25,
        });
    }
}

function flushLevelUps(playerKey) {
    const pending = pendingLevelUps.get(playerKey);
    pendingLevelUps.delete(playerKey);
    if (!pending?.player || !pending.entries?.length) return;

    const groups = new Map();
    const allIcons = [];
    const gains = new Map();

    for (const entry of pending.entries) {
        const category = String(entry.result?.category ?? "utility");
        const group = groups.get(category) ?? {
            category,
            count: 0,
            previousLevel: Number.POSITIVE_INFINITY,
            level: 0,
        };
        group.count++;
        group.previousLevel = Math.min(group.previousLevel, Math.max(1, Number(entry.result?.previousLevel ?? 1) || 1));
        group.level = Math.max(group.level, Math.max(1, Number(entry.result?.level ?? 1) || 1));
        groups.set(category, group);

        allIcons.push(getProgressionIcon(category));
        const raisedGains = Array.isArray(entry.result?.raisedAttributeGains) ? entry.result.raisedAttributeGains : [];
        const raisedLabels = raisedGains.length > 0
            ? raisedGains.map(value => value?.label).filter(Boolean)
            : Array.isArray(entry.result?.raisedAttributeLabels) ? entry.result.raisedAttributeLabels : [];
        allIcons.push(...raisedLabels.map(label => getAttributeIcon(label, category)));

        for (const raised of raisedGains) {
            const label = String(raised?.label ?? "").trim();
            if (!label) continue;
            gains.set(label, Number(gains.get(label) ?? 0) + Math.max(0, Number(raised?.value ?? 0) || 0));
        }
        if (raisedGains.length <= 0) {
            for (const label of raisedLabels) {
                const normalized = String(label ?? "").trim();
                if (normalized) gains.set(normalized, Number(gains.get(normalized) ?? 0) + 1);
            }
        }
    }

    const summaries = [...groups.values()].map(group => {
        const itemCount = group.count > 1 ? ` \u00A77(${group.count} armor pieces)` : "";
        return `\u00A7e${titleCaseIdentifier(group.category)} ${group.previousLevel} -> ${group.level}${itemCount}`;
    });
    const raised = [...gains.entries()].map(([label, value]) => {
        if (value >= 1 && Number.isInteger(value)) return `+${value} ${label}`;
        const percent = value * 100;
        const formatted = Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));
        return `+${formatted}% ${label}`;
    });
    const raisedText = raised.length > 0 ? ` \u00A78| \u00A7b${raised.join(", ")}` : "";

    publishInsightActivity(pending.player, { levelUps: allIcons });

    showActionBar(
        pending.player,
        `\u00A76Level Up \u00A78| ${summaries.join(" \u00A78| ")}${raisedText}`,
        "level:batch",
        4,
        uniqueIcons(allIcons),
        100
    );
    playSound(pending.player, "random.levelup", { volume: 0.45, pitch: 1.1 });
    spawnParticle(pending.player, "minecraft:totem_particle", { x: 0, y: 1.2, z: 0 });
}

export function showLevelUp(player, stack, result) {
    if (!player || !result?.levelUp || !result.category) return;

    const playerKey = getPlayerKey(player);
    const pending = pendingLevelUps.get(playerKey) ?? { player, entries: [], scheduled: false };
    pending.player = player;
    pending.entries.push({ stack, result });
    pendingLevelUps.set(playerKey, pending);
    if (pending.scheduled) return;

    pending.scheduled = true;
    system.runTimeout(() => flushLevelUps(playerKey), 3);
}

export function showAbilityFeedback(player, label, emoji = "") {
    if (!player || !label) return;
    publishInsightActivity(
        player,
        { primary: formatInsightIcon(emoji || getAbilityIcon(label)) },
    );
    showActionBar(
        player,
        `\u00A7g${label}`,
        `ability:${String(label).toLowerCase()}`,
        4,
        emoji || getAbilityIcon(label),
        80
    );
}

/** Shows a real health gain in every feedback style, including both_partial. */
export function showHealingFeedback(player, amount) {
    const healed = Math.max(0, Number(amount) || 0);
    // One heart is two health points. Tiny fractional regeneration ticks are
    // intentionally silent so they do not hide progression feedback.
    if (!player || healed <= 0.2) return;

    const hearts = healed / 2;
    const formatted = Number.isInteger(hearts) ? String(hearts) : hearts.toFixed(1);
    publishInsightActivity(player, { attributes: [STATSCORE_ICONS.healedHeart] });
    showActionBar(
        player,
        `\u00A7aHealing +${formatted} hearts`,
        "healing",
        4,
        STATSCORE_ICONS.healedHeart,
        75,
    );
}

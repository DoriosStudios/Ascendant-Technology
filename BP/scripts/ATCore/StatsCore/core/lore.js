import { STATSCORE } from "../constants.js";
import { collectStatsAbilityNames } from "./abilities.js";
import { formatPercent, titleCaseIdentifier } from "../utils.js";

const MAX_VISIBLE_LORE_STATS = 3;

function getLore(stack) {
    if (!stack || typeof stack.getLore !== "function") return [];
    try {
        const lore = stack.getLore();
        return Array.isArray(lore) ? lore : [];
    } catch {
        return [];
    }
}

function stripStatsCoreLore(lore) {
    const result = [];
    let insideStatsCoreBlock = false;

    for (const line of lore ?? []) {
        if (line === STATSCORE.lore.start) {
            insideStatsCoreBlock = true;
            continue;
        }

        if (line === STATSCORE.lore.end) {
            insideStatsCoreBlock = false;
            continue;
        }

        if (!insideStatsCoreBlock) {
            result.push(line);
        }
    }

    return result;
}

function arraysEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) return false;
    }

    return true;
}

function readStatsLoreSignature(stack) {
    if (!stack || typeof stack.getDynamicProperty !== "function") return [];

    try {
        const raw = stack.getDynamicProperty(STATSCORE.props.loreSignature);
        if (typeof raw !== "string" || raw.length <= 0) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(line => typeof line === "string") : [];
    } catch {
        return [];
    }
}

function stripTrailingStatsLore(lore, statsLore) {
    if (!Array.isArray(lore) || lore.length <= 0) return [];
    if (!Array.isArray(statsLore) || statsLore.length <= 0) return [...lore];
    if (statsLore.length > lore.length) return [...lore];

    const trailing = lore.slice(lore.length - statsLore.length);
    if (!arraysEqual(trailing, statsLore)) {
        return [...lore];
    }

    return lore.slice(0, lore.length - statsLore.length);
}

function getBaseLore(stack) {
    const lore = getLore(stack);
    const strippedLegacyLore = stripStatsCoreLore(lore);

    if (!arraysEqual(strippedLegacyLore, lore)) {
        return strippedLegacyLore;
    }

    return stripTrailingStatsLore(lore, readStatsLoreSignature(stack));
}

function buildReadableStatEntry(label, value) {
    const numeric = Math.max(0, Number(value ?? 0));
    if (numeric <= 0) return null;

    return `\u00A7r\u00A79+${formatPercent(numeric)} ${label}`;
}

function buildReadableFlatEntry(label, value) {
    const numeric = Math.max(0, Math.floor(Number(value ?? 0) || 0));
    if (numeric <= 0) return null;

    return `\u00A7r\u00A79+${numeric} ${label}`;
}

function getElementIcon(elementId) {
    switch (String(elementId ?? "").toLowerCase()) {
        case "plant":
        case "poison":
            return "\u2620";
        case "frost":
        case "ice":
            return "\u2744";
        case "fire":
            return "\u25B2";
        case "lightning":
        case "shock":
            return "\u26A1";
        case "darkness":
        case "dark":
            return "\u25C6";
        default:
            return "\u2726";
    }
}

function buildReadableElementEntry(attributes) {
    const element = Array.isArray(attributes?.elemental)
        ? attributes.elemental.find(entry => entry?.id && Number(entry?.chance ?? 0) > 0)
        : null;
    if (!element) return null;

    const icon = getElementIcon(element.id);
    const damage = Math.max(0, Number(element.damage ?? 0) || 0);
    return `\u00A7r${icon} \u00A78${formatPercent(element.chance)} \u00A79+${damage.toFixed(damage % 1 === 0 ? 0 : 1)} Element`;
}

function buildAbilityLoreEntry(attributes, state) {
    const names = collectStatsAbilityNames(attributes, { state });

    if (!names.length) {
        return null;
    }

    return `\u00A7r\u00A77Ability: \u00A7g${names.join(" \u00A78+ \u00A7g")}`;
}

function buildReadableStatEntries(definition, attributes) {
    const flatDamageBonus = Math.max(0, Number(attributes?.flatDamageBonus ?? 0));
    const damageBonus = Math.max(0, Number(attributes?.damageMultiplier ?? 1) - 1);
    const critChance = Math.max(0, Number(attributes?.crit?.chance ?? 0));
    const critDamage = Math.max(0, Number(attributes?.crit?.multiplier ?? 1) - 1);
    const penetration = Math.max(0, Number(attributes?.penetration?.percent ?? 0));
    const lifesteal = Math.max(0, Number(attributes?.lifesteal?.percent ?? 0));
    const elemental = buildReadableElementEntry(attributes);
    const oreBonus = Math.max(0, Number(attributes?.mining?.oreBonusChance ?? 0));
    const yieldBonus = Math.max(0, Number(attributes?.mining?.bonusDropChance ?? 0));
    const preserving = Math.max(
        0,
        Number(attributes?.mining?.durabilitySaveChance ?? 0),
        Number(attributes?.support?.durabilityPreserveChance ?? 0)
    );
    const damageReduction = Math.max(0, Number(attributes?.support?.damageReduction ?? 0));
    const evasion = Math.max(0, Number(attributes?.support?.negateAllDamageChance ?? 0));

    const entries = definition?.type === "support"
        ? [
            buildReadableStatEntry("Damage Reduction", damageReduction),
            buildReadableStatEntry("Evasion", evasion),
            buildReadableStatEntry("Preserving", preserving)
        ]
        : definition?.type === "tool"
            ? [
                buildReadableFlatEntry("Attack Damage", flatDamageBonus),
                elemental,
                buildReadableStatEntry("Ore Bonus", oreBonus),
                buildReadableStatEntry("Bonus Yield", yieldBonus),
                buildReadableStatEntry("Preserving", preserving),
                buildReadableStatEntry("Bonus Damage", damageBonus)
            ]
            : definition?.type === "hybrid"
                ? [
                    buildReadableFlatEntry("Attack Damage", flatDamageBonus),
                    elemental,
                    buildReadableStatEntry("Bonus Damage", damageBonus),
                    buildReadableStatEntry("Critical Chance", critChance),
                    buildReadableStatEntry("Ore Bonus", oreBonus),
                    buildReadableStatEntry("Preserving", preserving),
                    buildReadableStatEntry("Lifesteal", lifesteal),
                    buildReadableStatEntry("Armor Penetration", penetration),
                    buildReadableStatEntry("Critical Damage", critDamage)
                ]
                : [
                    buildReadableFlatEntry("Attack Damage", flatDamageBonus),
                    elemental,
                    buildReadableStatEntry("Bonus Damage", damageBonus),
                    buildReadableStatEntry("Critical Chance", critChance),
                    buildReadableStatEntry("Lifesteal", lifesteal),
                    buildReadableStatEntry("Armor Penetration", penetration),
                    buildReadableStatEntry("Critical Damage", critDamage)
                ];

    return entries.filter(Boolean).slice(0, MAX_VISIBLE_LORE_STATS);
}

function buildStatsCoreLore(definition, state, attributes) {
    const statsLore = buildReadableStatEntries(definition, attributes);
    const abilityLore = buildAbilityLoreEntry(attributes, state);

    if (!statsLore.length && !abilityLore) {
        return [];
    }

    return abilityLore ? [...statsLore, abilityLore] : statsLore;
}

export function syncStatsCoreLore(stack, definition, state, attributes, force = false) {
    if (!stack || typeof stack.setLore !== "function") return false;

    const currentLore = getLore(stack);
    const baseLore = getBaseLore(stack);
    const statsLore = buildStatsCoreLore(definition, state, attributes);
    const nextLore = statsLore.length > 0
        ? [...baseLore, ...statsLore]
        : [...baseLore];
    const signature = JSON.stringify(statsLore);
    const currentLoreSignature = JSON.stringify(currentLore);
    const nextLoreSignature = JSON.stringify(nextLore);

    try {
        if (!force && currentLoreSignature === nextLoreSignature) {
            return false;
        }

        stack.setLore(nextLore);

        if (typeof stack.setDynamicProperty === "function") {
            stack.setDynamicProperty(STATSCORE.props.loreSignature, statsLore.length > 0 ? signature : undefined);
        }

        return true;
    } catch {
        return false;
    }
}

export function clearStatsCoreLore(stack) {
    if (!stack || typeof stack.setLore !== "function") return false;

    const currentLore = getLore(stack);
    const nextLore = getBaseLore(stack);
    const changed = JSON.stringify(currentLore) !== JSON.stringify(nextLore);
    if (!changed) return false;

    try {
        stack.setLore(nextLore);
        if (typeof stack.setDynamicProperty === "function") {
            stack.setDynamicProperty(STATSCORE.props.loreSignature, undefined);
        }
        return true;
    } catch {
        return false;
    }
}

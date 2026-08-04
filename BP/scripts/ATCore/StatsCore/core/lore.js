import { STATSCORE } from "../constants.js";
import { getStatsAbilitySummary } from "./abilities.js";
import { formatPercent, titleCaseIdentifier } from "../utils.js";
import { getAbilityIcon, getElementIcon, STATSCORE_ICONS } from "../icons.js";

const MAX_VISIBLE_LORE_ATTRIBUTES = 3;

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

function stripStatsLoreOccurrences(lore, statsLore) {
    if (!Array.isArray(lore) || lore.length <= 0) return [];
    if (!Array.isArray(statsLore) || statsLore.length <= 0) return [...lore];

    const result = [];
    for (let index = 0; index < lore.length;) {
        let matches = index + statsLore.length <= lore.length;
        for (let offset = 0; matches && offset < statsLore.length; offset++) {
            matches = lore[index + offset] === statsLore[offset];
        }
        if (matches) {
            index += statsLore.length;
            continue;
        }
        result.push(lore[index]);
        index++;
    }
    return result;
}

function getBaseLore(stack, currentLore = undefined) {
    const lore = Array.isArray(currentLore) ? currentLore : getLore(stack);
    const strippedLegacyLore = stripStatsCoreLore(lore);

    if (!arraysEqual(strippedLegacyLore, lore)) {
        return strippedLegacyLore;
    }

    return stripStatsLoreOccurrences(lore, readStatsLoreSignature(stack));
}

function buildReadableStatEntry(label, value, icon) {
    const numeric = Math.max(0, Number(value ?? 0));
    if (numeric <= 0) return null;

    return `\u00A7r${icon} \u00A79+${formatPercent(numeric)} ${label}`;
}

function buildReadableFlatEntry(label, value, icon) {
    const numeric = Math.max(0, Number(value ?? 0) || 0);
    if (numeric <= 0) return null;

    const formatted = numeric.toFixed(numeric % 1 === 0 ? 0 : 1);
    return `\u00A7r${icon} \u00A79+${formatted} ${label}`;
}

function buildReadableMultiplierEntry(label, value, icon) {
    const numeric = Math.max(1, Number(value ?? 1));
    if (numeric <= 1) return null;
    return `\u00A7r${icon} \u00A79x${numeric.toFixed(2)} ${label}`;
}

function buildReadableElementEntries(attributes) {
    const elements = Array.isArray(attributes?.elemental)
        ? attributes.elemental.filter(entry => (
            entry?.id
            && Number(entry?.chance ?? 0) > 0
            && Number(entry?.damage ?? 0) > 0
        ))
        : [];

    return elements.map(element => {
        const icon = getElementIcon(element.id);
        const damage = Math.max(0, Number(element.damage ?? 0) || 0);
        return `\u00A7r${icon} \u00A78${formatPercent(element.chance)} \u00A79+${damage.toFixed(damage % 1 === 0 ? 0 : 1)} ${titleCaseIdentifier(element.id)} Damage`;
    });
}

function buildCombinedExtraDamageEntry(attributes) {
    const flatDamage = Math.max(0, Number(attributes?.flatDamageBonus ?? 0) || 0);
    const bonusDamage = Math.max(0, Number(attributes?.damageMultiplier ?? 1) - 1);
    const elements = buildReadableElementEntries(attributes)
        .map(entry => entry.replace(/^§r[^\s]+\s+/, "").replace(/^§8/, ""));
    const parts = [];

    if (flatDamage > 0) {
        parts.push(`+${flatDamage.toFixed(flatDamage % 1 === 0 ? 0 : 1)}`);
    }
    if (bonusDamage > 0) {
        parts.push(`+${formatPercent(bonusDamage)} Bonus`);
    }
    parts.push(...elements);
    if (parts.length <= 0) return null;

    return `§r${STATSCORE_ICONS.attackDamage} §9Extra Damage §8| §7${parts.join(" §8+ §7")}`;
}

function buildAbilityLoreEntry(attributes, state) {
    const summary = getStatsAbilitySummary(attributes, { state });
    if (!summary.primary) return null;

    const icon = getAbilityIcon(summary.primary);
    const additional = summary.total > 1 ? " \u00A7e+" : "";
    return `\u00A7r${icon} \u00A77Ability: \u00A7g${summary.primary}${additional}`;
}

function isProgressionCategoryEnabled(definition, category) {
    const progression = definition?.progression ?? {};
    if (category === "offensive") return Number(progression.combatXp ?? 0) > 0 || Number(progression.killXp ?? 0) > 0;
    if (category === "mining") return Number(progression.blockXp ?? 0) > 0 || Number(progression.oreXp ?? 0) > 0 || Number(progression.toolXp ?? 0) > 0;
    if (category === "defensive") return Number(progression.armorXp ?? 0) > 0;
    return false;
}

function buildLevelLoreEntry(definition, state) {
    const progression = state?.progression ?? {};
    const entries = [];
    if (isProgressionCategoryEnabled(definition, "offensive")) {
        entries.push(`\u00A7cOffensive Level ${Math.max(1, Number(progression.offensive?.level ?? 1) || 1)}`);
    }
    if (isProgressionCategoryEnabled(definition, "mining")) {
        entries.push(`\u00A7qMining Level ${Math.max(1, Number(progression.mining?.level ?? 1) || 1)}`);
    }
    if (isProgressionCategoryEnabled(definition, "defensive")) {
        entries.push(`\u00A73Defensive Level ${Math.max(1, Number(progression.defensive?.level ?? 1) || 1)}`);
    }
    return entries.length > 0 ? `\u00A7r${entries.join(" \u00A78| ")}` : null;
}

function buildReadableStatEntries(definition, attributes) {
    const flatDamageBonus = Math.max(0, Number(attributes?.flatDamageBonus ?? 0));
    const damageBonus = Math.max(0, Number(attributes?.damageMultiplier ?? 1) - 1);
    const critChance = Math.max(0, Number(attributes?.crit?.chance ?? 0));
    const critMultiplier = Math.max(1, Number(attributes?.crit?.multiplier ?? 1));
    const penetration = Math.max(0, Number(attributes?.penetration?.percent ?? 0));
    const lifesteal = Math.max(0, Number(attributes?.lifesteal?.percent ?? 0));
    const preserving = Math.max(
        0,
        Number(attributes?.mining?.durabilitySaveChance ?? 0),
        Number(attributes?.support?.durabilityPreserveChance ?? 0)
    );
    const damageReduction = Math.max(0, Number(attributes?.support?.damageReduction ?? 0));
    const evasion = Math.max(0, Number(attributes?.support?.negateAllDamageChance ?? 0));
    const adaptiveResilience = Math.max(0, Number(attributes?.eventDriven?.adaptiveResilience?.reductionPerStack ?? 0));
    const healingEfficiency = Math.max(0, Number(attributes?.eventDriven?.healingEfficiency?.bonus ?? 0));
    const chargeMastery = Math.max(0, Number(attributes?.eventDriven?.chargeMastery?.maxDamageBonus ?? 0));
    const persistence = Math.max(0, Number(attributes?.eventDriven?.persistence?.maxBonus ?? 0));
    const scavenging = Math.max(0, Number(attributes?.eventDriven?.scavenging?.chance ?? 0));
    const dimensionalAttunement = Math.max(0, Number(attributes?.eventDriven?.dimensionalAttunement?.durationTicks ?? 0));

    const candidate = (line, activation) => line ? {
        line,
        activation: Math.max(0, Number(activation ?? 0) || 0),
    } : null;
    const directEntries = definition?.type === "support"
        ? []
        : [
            buildCombinedExtraDamageEntry(attributes),
        ].filter(Boolean);

    const candidates = definition?.type === "support"
        ? [
            candidate(buildReadableStatEntry("Damage Reduction", damageReduction, STATSCORE_ICONS.damageReduction), 1),
            candidate(buildReadableStatEntry("Adaptive Resilience", adaptiveResilience, STATSCORE_ICONS.damageReduction), 0.8),
            candidate(buildReadableStatEntry("Healing Efficiency", healingEfficiency, STATSCORE_ICONS.healedHeart), 0.75),
            candidate(dimensionalAttunement > 0
                ? `\u00A7r${STATSCORE_ICONS.darkness} \u00A79${Math.round(dimensionalAttunement / 20)}s Dimensional Attunement`
                : null, 0.35),
            candidate(buildReadableStatEntry("Evasion", evasion, STATSCORE_ICONS.evasion), evasion),
            candidate(buildReadableStatEntry("Preserving", preserving, STATSCORE_ICONS.preservingArmor), preserving),
        ]
        : definition?.type === "tool"
            ? [
                candidate(buildReadableStatEntry("Scavenging", scavenging, STATSCORE_ICONS.scavenger), scavenging),
                candidate(buildReadableStatEntry("Preserving", preserving, STATSCORE_ICONS.preservingTool), preserving),
            ]
            : [
                candidate(buildReadableStatEntry("Persistence", persistence, STATSCORE_ICONS.sword), 0.95),
                candidate(buildReadableStatEntry("Charge Mastery", chargeMastery, STATSCORE_ICONS.sword), 0.85),
                candidate(buildReadableStatEntry("Scavenging", scavenging, STATSCORE_ICONS.scavenger), scavenging),
                candidate(buildReadableStatEntry("Critical Chance", critChance, STATSCORE_ICONS.criticalChance), critChance),
                candidate(buildReadableMultiplierEntry("Critical Multiplier", critMultiplier, STATSCORE_ICONS.criticalMultiplier), critChance * 0.95),
                candidate(buildReadableStatEntry("Lifesteal", lifesteal, STATSCORE_ICONS.healedHeart), lifesteal),
                candidate(buildReadableStatEntry("Armor Penetration", penetration, STATSCORE_ICONS.fullArmor), penetration),
                candidate(buildReadableStatEntry("Preserving", preserving, STATSCORE_ICONS.preservingTool), preserving),
            ];

    const attributeEntries = candidates
        .filter(Boolean)
        .sort((left, right) => right.activation - left.activation)
        .slice(0, MAX_VISIBLE_LORE_ATTRIBUTES)
        .map(entry => entry.line);

    return [...directEntries, ...attributeEntries];
}

function buildStatsCoreLore(definition, state, attributes) {
    const levelLore = buildLevelLoreEntry(definition, state);
    const statsLore = buildReadableStatEntries(definition, attributes);
    const abilityLore = buildAbilityLoreEntry(attributes, state);

    if (!levelLore && !statsLore.length && !abilityLore) {
        return [];
    }

    return [levelLore, ...statsLore, abilityLore].filter(Boolean);
}

export function syncStatsCoreLore(stack, definition, state, attributes, force = false) {
    if (!stack || typeof stack.setLore !== "function") return false;

    const currentLore = getLore(stack);
    const baseLore = getBaseLore(stack, currentLore);
    const statsLore = buildStatsCoreLore(definition, state, attributes);
    const nextLore = statsLore.length > 0
        ? [...baseLore, ...statsLore]
        : [...baseLore];
    const signature = JSON.stringify(statsLore);

    try {
        if (!force && arraysEqual(currentLore, nextLore)) {
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
    const nextLore = getBaseLore(stack, currentLore);
    const changed = !arraysEqual(currentLore, nextLore);
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

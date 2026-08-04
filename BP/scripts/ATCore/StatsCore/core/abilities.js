import { titleCaseIdentifier } from "../utils.js";
import { collectStatsEffectPool } from "../shared/effectSelectors.js";

function getAbilityContext(options) {
    return options?.abilityData ?? options?.state?.abilityData ?? options ?? {};
}

function getOperatorModeLabel(options) {
    const abilityData = getAbilityContext(options);
    const mode = String(abilityData?.operatorMode ?? "crushy").trim().toLowerCase();
    if (mode === "silky") return "Silky";
    if (mode === "greedy") return "Greedy";
    return "Crushy";
}

export function resolveStatsAbilityName(effect, options = undefined) {
    const kind = String(effect?.kind ?? "").trim().toLowerCase();
    const levelPlaceholder = typeof effect?.levelPlaceholder === "string"
        ? effect.levelPlaceholder.trim()
        : "";

    if (kind === "operator") {
        return `${getOperatorModeLabel(options)} Operator`;
    }

    if (typeof effect?.label === "string" && effect.label.trim().length > 0) {
        return `${levelPlaceholder ? `${levelPlaceholder} ` : ""}${effect.label.trim()}`;
    }

    if (kind === "mark") return "Mark";
    if (kind === "fire") return "Fire";
    if (kind === "sweep") return "Sweeping";
    if (kind === "bleed") return "Bleeding";
    if (kind === "xp_orb") return "Luck";
    if (kind === "retaliate") return "Retaliation";
    if (kind === "status" && typeof effect?.id === "string" && effect.id.trim().length > 0) {
        return titleCaseIdentifier(effect.id);
    }
    if (kind === "passive" && typeof effect?.key === "string" && effect.key.trim().length > 0) {
        return titleCaseIdentifier(effect.key);
    }

    if (typeof effect?.id === "string" && effect.id.trim().length > 0) {
        return titleCaseIdentifier(effect.id);
    }

    return "";
}

function getStatsAbilityEffects(attributes) {
    return collectStatsEffectPool(attributes);
}

export function isAdvancedStatsAbilityEffect(effect) {
    return effect?.requiresAdvancedUnlock === true
        || String(effect?.unlockTier ?? "").trim().toLowerCase() === "advanced";
}

export function collectStatsAbilityEntries(attributes, options = undefined) {
    const entries = [];
    const seen = new Set();

    for (const effect of getStatsAbilityEffects(attributes)) {
        const name = resolveStatsAbilityName(effect, options);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;

        seen.add(key);
        entries.push({
            name,
            effect,
            advanced: isAdvancedStatsAbilityEffect(effect),
        });
    }

    return entries;
}

export function collectStatsAbilityNames(attributes, options = undefined) {
    return collectStatsAbilityEntries(attributes, options).map(entry => entry.name);
}

export function getStatsAbilitySummary(attributes, options = undefined) {
    const entries = collectStatsAbilityEntries(attributes, options);
    const primaryEntry = entries.find(entry => !entry.advanced) ?? entries[0] ?? null;

    return {
        entries,
        primary: primaryEntry?.name ?? "",
        additionalCount: Math.max(0, entries.length - (primaryEntry ? 1 : 0)),
        total: entries.length,
    };
}


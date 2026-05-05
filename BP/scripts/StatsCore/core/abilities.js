import { titleCaseIdentifier } from "../utils.js";

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

    if (kind === "operator") {
        return `${getOperatorModeLabel(options)} Operator`;
    }

    if (typeof effect?.label === "string" && effect.label.trim().length > 0) {
        return effect.label.trim();
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

export function getStatsAbilityEffects(attributes) {
    return [
        ...(Array.isArray(attributes?.effects) ? attributes.effects : []),
        ...(Array.isArray(attributes?.mining?.effects) ? attributes.mining.effects : []),
        ...(Array.isArray(attributes?.support?.effects) ? attributes.support.effects : []),
    ].filter(effect => effect && typeof effect === "object");
}

export function collectStatsAbilityNames(attributes, options = undefined) {
    const names = [];
    const seen = new Set();

    for (const effect of getStatsAbilityEffects(attributes)) {
        const name = resolveStatsAbilityName(effect, options);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;

        seen.add(key);
        names.push(name);
    }

    return names;
}

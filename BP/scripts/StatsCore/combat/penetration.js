import { getPlayerArmorMitigationProfile } from "../../DoriosCore/armor/reduction.js";
import { clamp01, normalizeChance } from "../utils.js";

function getDamageType(event) {
    try {
        return String(event?.damageSource?.cause ?? event?.cause ?? "all").toLowerCase();
    } catch {
        return "all";
    }
}

function isBossLike(entity) {
    const id = String(entity?.typeId ?? "").toLowerCase();
    return id.includes("wither") || id.includes("ender_dragon") || id.includes("boss");
}

export function applyArmorPenetration({ damage, target, event, attributes }) {
    const penetration = attributes?.penetration ?? {};
    let percent = Math.min(
        normalizeChance(penetration.cap, 0.35),
        normalizeChance(penetration.percent, 0)
    );

    if (percent <= 0 || !target) {
        return { damage, restored: 0, percent: 0 };
    }

    if (isBossLike(target)) {
        percent *= clamp01(penetration.bossScalar ?? 0.5);
    }

    if (percent <= 0) {
        return { damage, restored: 0, percent: 0 };
    }

    if (target.typeId !== "minecraft:player") {
        return { damage, restored: 0, percent };
    }

    const profile = getPlayerArmorMitigationProfile(target, getDamageType(event));
    const totalReduction = clamp01(profile?.totalReduction ?? 0);
    if (totalReduction <= 0 || totalReduction >= 0.99) {
        return { damage, restored: 0, percent };
    }

    const unmitigatedDamage = damage / Math.max(0.01, 1 - totalReduction);
    const piercedReduction = totalReduction * (1 - percent);
    const piercedDamage = unmitigatedDamage * (1 - piercedReduction);
    const nextDamage = Math.max(damage, piercedDamage);

    return {
        damage: nextDamage,
        restored: Math.max(0, nextDamage - damage),
        percent
    };
}

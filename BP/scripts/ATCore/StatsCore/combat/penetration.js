import { getPlayerArmorMitigationProfile } from "../support/armor.js";
import { clamp01, normalizeChance } from "../utils.js";
import { getEventDamageType, isBossLikeEntity } from "../shared/damage.js";

export function applyArmorPenetration({ damage, target, event, attributes }) {
    const penetration = attributes?.penetration ?? {};
    let percent = Math.min(
        normalizeChance(penetration.cap, 0.35),
        normalizeChance(penetration.percent, 0)
    );

    if (percent <= 0 || !target) {
        return { damage, restored: 0, percent: 0 };
    }

    if (isBossLikeEntity(target)) {
        const bossScalar = clamp01(penetration.bossScalar ?? 0.55);
        const bossCap = clamp01(penetration.bossCap ?? 0.2);
        percent = Math.min(bossCap, percent * bossScalar);
    }

    if (percent <= 0) {
        return { damage, restored: 0, percent: 0 };
    }

    if (target.typeId !== "minecraft:player") {
        return { damage, restored: 0, percent };
    }

    const profile = getPlayerArmorMitigationProfile(target, getEventDamageType(event));
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

import { system, world } from "@minecraft/server";

// New armor component system (utilitycraft:armor)
// Aggregates per-piece damage reduction and negation chance.
// Defaults:
//  - damage_reduction default fraction when boolean true: 0.05 (5%)
//  - damage_negation default when boolean true: 0.025 (2.5%)
//  - reductions sum across pieces and are clamped to 90% max
//  - negation chances combine as independent probabilities

const DEFAULT_DAMAGE_REDUCTION = 0.05; // 5%
const DEFAULT_DAMAGE_NEGATION = 0.025; // 2.5%
const MAX_TOTAL_REDUCTION = 0.9; // 90%
const ARMOR_SLOTS = ['Head', 'Chest', 'Legs', 'Feet'];

function toFraction(val, fallback) {
    if (val === undefined || val === null || val === false) return null;
    if (val === true) return fallback;
    const n = Number(val);
    if (Number.isNaN(n)) return null;
    if (n > 1) return Math.min(MAX_TOTAL_REDUCTION, n / 100);
    return Math.min(MAX_TOTAL_REDUCTION, Math.max(0, n));
}

function combinesNegation(chances) {
    if (!Array.isArray(chances) || chances.length === 0) return 0;
    let prod = 1;
    for (const p of chances) {
        const v = Number(p) || 0;
        prod *= (1 - Math.min(0.9999, Math.max(0, v)));
    }
    return 1 - prod;
}

function damageTypeFromEvent(event) {
    try {
        // event.damageSource?.cause is commonly used, fallback to event.cause or 'all'
        const raw = event?.damageSource?.cause ?? event?.cause ?? 'all';
        return String(raw).toLowerCase();
    } catch {
        return 'all';
    }
}

function getArmorEquipmentComponent(entity) {
    return entity?.getComponent?.('equippable');
}

function resolveEffectiveArmorConfig(item, damageType) {
    if (!item) return null;

    const id = item?.typeId ?? item?.type ?? '';
    const comp = item.getComponent?.('utilitycraft:armor')?.customComponentParameters?.params ?? null;

    const effective = comp ? { ...comp } : (typeof id === 'string' && id.includes('aetherium') ? {
        damage_reduction: 0.075,
        damage_negation: 0.025,
        reduces: 'all'
    } : null);

    if (!effective) return null;

    const cases = effective.cases ?? {};
    const override = (cases && typeof cases === 'object') ? (cases[damageType] ?? null) : null;
    const merged = { ...effective, ...(override || {}) };

    const reducesField = merged.reduces ?? (merged.damage_reduction || merged.damage_negation ? 'all' : 'none');
    if (reducesField === 'none') return null;

    if (Array.isArray(reducesField)) {
        const lowered = reducesField.map((value) => String(value).toLowerCase());
        if (!lowered.includes(damageType) && !lowered.includes('all')) return null;
    } else if (typeof reducesField === 'string') {
        const lowered = reducesField.toLowerCase();
        if (lowered !== 'all' && lowered !== damageType) return null;
    }

    return merged;
}

export function getPlayerArmorMitigationProfile(player, damageType = 'all') {
    if (!player || player.typeId !== 'minecraft:player') return undefined;

    const equipComp = getArmorEquipmentComponent(player);
    if (!equipComp) return undefined;

    const normalizedDamageType = String(damageType || 'all').toLowerCase();
    const reductions = [];
    const negations = [];
    let pieceCount = 0;

    for (const slot of ARMOR_SLOTS) {
        const item = equipComp.getEquipment(slot);
        if (!item) continue;

        const effective = resolveEffectiveArmorConfig(item, normalizedDamageType);
        if (!effective) continue;

        pieceCount += 1;

        const dr = toFraction(effective.damage_reduction, DEFAULT_DAMAGE_REDUCTION);
        const dn = toFraction(effective.damage_negation, DEFAULT_DAMAGE_NEGATION);

        if (dr && dr > 0) reductions.push(dr);
        if (dn && dn > 0) negations.push(dn);
    }

    return {
        damageType: normalizedDamageType,
        pieceCount,
        reductionValues: reductions,
        negationValues: negations,
        totalReduction: Math.min(MAX_TOTAL_REDUCTION, reductions.reduce((sum, value) => sum + value, 0)),
        totalNegation: combinesNegation(negations)
    };
}

world.beforeEvents.entityHurt.subscribe((event) => {
    try {
        const target = event?.hurtEntity;
        if (!target || target.typeId !== 'minecraft:player') return;

        const damageType = damageTypeFromEvent(event);

        const profile = getPlayerArmorMitigationProfile(target, damageType);
        if (!profile || (profile.reductionValues.length === 0 && profile.negationValues.length === 0)) return;

        if (Math.random() < profile.totalNegation) {
            // Negates all damage
            event.cancel = true;
            try {
                // Play shield block sound at player's location when damage is negated
                if (typeof target?.dimension?.playSound === 'function') {
                    target.dimension.playSound?.('item.shield.block', target.location, { volume: 0.8, pitch: 1 });
                } else if (typeof target?.playSound === 'function') {
                    // Fallback to player.playSound when dimension-based API not available
                    target.playSound?.('item.shield.block');
                }
            } catch (err) {
                // ignore sound errors
            }
            return;
        }

        const original = Number(event.damage ?? 0) || 0;
        event.damage = original * (1 - profile.totalReduction);
    } catch (err) {
        console.warn && console.warn('Armor reduction hook error:', err);
    }
});
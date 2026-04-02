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

world.beforeEvents.entityHurt.subscribe((event) => {
    try {
        const target = event?.hurtEntity;
        if (!target || target.typeId !== 'minecraft:player') return;

        const equipComp = target.getComponent?.('equippable');
        if (!equipComp) return;

        const slots = ['Head', 'Chest', 'Legs', 'Feet'];

        const damageType = damageTypeFromEvent(event);

        const reductions = [];
        const negations = [];

        for (const slot of slots) {
            const item = equipComp.getEquipment(slot);
            if (!item) continue;

            const id = item?.typeId ?? item?.type ?? '';

            // Read the armor component if present
            const comp = item.getComponent?.('utilitycraft:armor')?.customComponentParameters?.params ?? null;

            // Backwards compatibility: treat items with 'aetherium' in id as armor with aetherium defaults
            const effective = comp ? { ...comp } : (typeof id === 'string' && id.includes('aetherium') ? {
                damage_reduction: 0.075,
                damage_negation: 0.025,
                reduces: 'all'
            } : null);

            if (!effective) continue;

            // If the component has cases, allow damage-type-specific overrides
            const cases = effective.cases ?? {};
            const override = (cases && typeof cases === 'object') ? (cases[damageType] ?? null) : null;
            const merged = { ...effective, ...(override || {}) };

            // Determine whether this piece applies to the current damage type
            const reducesField = merged.reduces ?? (merged.damage_reduction || merged.damage_negation ? 'all' : 'none');
            if (reducesField === 'none') continue;

            // supports reduces as array or 'all'
            if (Array.isArray(reducesField)) {
                const lowered = reducesField.map(x => String(x).toLowerCase());
                if (!lowered.includes(damageType) && !lowered.includes('all')) continue;
            }

            const dr = toFraction(merged.damage_reduction, DEFAULT_DAMAGE_REDUCTION);
            const dn = toFraction(merged.damage_negation, DEFAULT_DAMAGE_NEGATION);

            if (dr && dr > 0) reductions.push(dr);
            if (dn && dn > 0) negations.push(dn);
        }

        if (reductions.length === 0 && negations.length === 0) return;

        const combinedNegation = combinesNegation(negations);
        if (Math.random() < combinedNegation) {
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

        const totalReduction = Math.min(MAX_TOTAL_REDUCTION, reductions.reduce((s, v) => s + v, 0));
        const original = Number(event.damage ?? 0) || 0;
        event.damage = original * (1 - totalReduction);
    } catch (err) {
        console.warn && console.warn('Armor reduction hook error:', err);
    }
});
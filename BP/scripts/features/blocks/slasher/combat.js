import { world, system, EntityDamageCause } from "@minecraft/server";
import { bindAggressorTarget, registerAggressorDamage } from "../../../ATCore/StatsCore/shared/aggressors.js";
import { invalidateEquipmentContextCache } from "../../../ATCore/StatsCore/shared/contextCache.js";
import { XP_CAP, damageAt, damageLevel } from "./config.js";
import { rollBonusXp } from "./xp.js";
import { save, valid } from "./state.js";
import { weaponDamage, enchantLevel, wearWeapon } from "./weapon.js";

const LEGACY_EXECUTOR = "utilitycraft:mob_slasher_executor";
const contexts = new WeakMap();
const victims = new Map();
const dirty = new Set();
let flushScheduled = false;
function changed(state) {
    dirty.add(state);
    if (flushScheduled) return;
    flushScheduled = true;
    system.run(() => {
        flushScheduled = false;
        for (const entry of dirty) if (entry.alive) {
            try { save(entry); } catch (error) { console.warn(`[Mob Slasher] Could not save ${entry.key}: ${error}`); }
        }
        dirty.clear();
    });
}
// Remove an old shared executor when its saved chunk loads. No replacement is spawned.
world.afterEvents.entityLoad?.subscribe(({ entity }) => {
    if (entity.typeId === LEGACY_EXECUTOR) entity.remove();
});
system.run(() => {
    const id = world.getDynamicProperty("at:ms:executor");
    if (typeof id !== "string") return;
    try {
        const legacy = world.getEntity(id);
        if (legacy?.typeId === LEGACY_EXECUTOR) legacy.remove();
    } catch {}
    world.setDynamicProperty("at:ms:executor", undefined);
});

function contextFor(state) {
    let context = contexts.get(state);
    if (context?.revision === state.revision) return context;
    const properties = new Map(), effects = new Map();
    let health = 20;
    const revision = state.revision;
    context = {
        id: `slasher:${state.key}:${revision}`, typeId: LEGACY_EXECUTOR, revision, slasherState: state,
        get isValid() { return valid(state) && state.revision === revision; },
        get dimension() { return state.block.dimension; },
        get location() { return state.block.center(); },
        isSneaking: false, isOnGround: true,
        getComponent(id) {
            if (id.endsWith("equippable")) return {
                getEquipment: slot => slot === "Mainhand" && context.isValid ? state.weapon?.clone() : undefined,
                setEquipment: (slot, item) => {
                    if (slot !== "Mainhand" || !context.isValid) return false;
                    state.weapon = item?.clone(); changed(state); return true;
                },
            };
            if (id.endsWith("health")) return { currentValue: health, effectiveMax: 20, defaultValue: 20, setCurrentValue: value => { health = value; } };
            return undefined;
        },
        getDynamicProperty: key => properties.get(key),
        setDynamicProperty: (key, value) => value === undefined ? properties.delete(key) : properties.set(key, value),
        getTags: () => ["dorios:machine"], hasTag: tag => tag === "dorios:machine",
        matches: query => query.families?.includes("inanimate") ?? false,
        getViewDirection: () => ({ x: 0, y: 0, z: 1 }), getVelocity: () => ({ x: 0, y: 0, z: 0 }),
        getHeadLocation: () => state.block.center(),
        addEffect: (id, duration, options) => effects.set(String(id?.id ?? id), { ...options, expires: system.currentTick + duration }),
        getEffect: id => { const effect = effects.get(String(id?.id ?? id)); return effect?.expires > system.currentTick ? effect : undefined; },
        removeEffect: id => effects.delete(String(id?.id ?? id)),
    };
    registerAggressorDamage(context, (target, amount, cause) => dealHit(state, context, target, amount, cause));
    contexts.set(state, context);
    return context;
}
function dealHit(state, context, target, amount, cause = EntityDamageCause.entityAttack) {
    if (!context.isValid || !target.isValid) return false;
    const storing = !!(state.modules.storer && state.active.storer !== false);
    const bonus = storing ? rollBonusXp(target) : 0;
    if (storing && state.pauseFull !== false && state.xp + bonus > XP_CAP) return false;

    // Vanilla player credit when a player is nearby; otherwise the block still
    // attacks. The Slasher's own weapon attributes are calculated above.
    const player = state.block.dimension.getPlayers({ location: state.block.center(), maxDistance: 16, closest: 1 })[0];
    const damageSource = player ? { cause, damagingEntity: player } : { cause };
    const record = { state, bonus, attackerId: player?.id, expires: system.currentTick + 1 };
    victims.set(target.id, record);
    // This short mapping lets StatsCore read the installed weapon instead of
    // the credited player's hand. It does not create a Minecraft entity.
    bindAggressorTarget(target, player, context, 1);
    let success;
    try { success = target.applyDamage(amount, damageSource); }
    catch (error) { victims.delete(target.id); throw error; }
    if (!success) { victims.delete(target.id); return false; }
    // A later player/environmental kill must not inherit this attack's bonus.
    // Keep the record only when this hit has already reduced health to zero.
    if (target.isValid && target.getComponent("minecraft:health")?.currentValue > 0) victims.delete(target.id);

    return true;
}
export function attack(state, target) {
    const context = contextFor(state);
    let amount = damageAt(damageLevel(state)) + weaponDamage(state.weapon);
    amount += 1.25 * enchantLevel(state.weapon, "sharpness");
    if (target.matches({ families: ["undead"] })) amount += 2.5 * enchantLevel(state.weapon, "smite");
    if (target.matches({ families: ["arthropod"] })) amount += 2.5 * enchantLevel(state.weapon, "bane_of_arthropods");
    if (/(?:bow|crossbow)$/.test(state.weapon?.typeId ?? "")) amount += enchantLevel(state.weapon, "power");
    if (!dealHit(state, context, target, amount)) return;

    const fire = enchantLevel(state.weapon, "fire_aspect") || (enchantLevel(state.weapon, "flame") > 0 ? 1 : 0);
    if (fire && target.isValid) target.setOnFire(4 * fire, true);
    const knockback = enchantLevel(state.weapon, "knockback") + enchantLevel(state.weapon, "punch");
    if (knockback && target.isValid) {
        const center = state.block.center(), location = target.location;
        const dx = location.x - center.x, dz = location.z - center.z, distance = Math.hypot(dx, dz) || 1;
        target.applyKnockback({ x: dx / distance * knockback * 0.4, z: dz / distance * knockback * 0.4 }, 0.1);
    }
    if (state.weapon) {
        state.weapon = wearWeapon(state.weapon.clone());
        invalidateEquipmentContextCache(context);
        changed(state);
    }
}
world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const record = victims.get(deadEntity.id);
    victims.delete(deadEntity.id);
    if (!record || record.expires < system.currentTick || !record.bonus || !valid(record.state)) return;
    if (record.attackerId !== damageSource?.damagingEntity?.id) return;
    if (!record.attackerId && damageSource?.cause !== EntityDamageCause.entityAttack) return;
    const state = record.state;
    if (!state.modules.storer || state.active.storer === false) return;
    state.xp = Math.min(XP_CAP, state.xp + record.bonus);
    changed(state);
});
system.runInterval(() => {
    for (const [id, record] of victims) if (record.expires < system.currentTick) victims.delete(id);
}, 200);

import { system, world } from "@minecraft/server";
import { ELIGIBLE_AGGRESSORS } from "../config/aggressors.js";

const eligible = new Set(ELIGIBLE_AGGRESSORS);
const contexts = new Map();
const delegatedDamage = new WeakMap();
export const isEligibleAggressor = entity => eligible.has(entity?.typeId);

// A logical machine aggressor retains its own equipment and cooldown identity.
// The physical attacker may be a nearby player, or absent for machine-only damage.
export function registerAggressorDamage(context, callback) {
    delegatedDamage.set(context, callback);
}
export function bindAggressorTarget(target, executor, context, duration = 1200) {
    contexts.set(target.id, { executorId: executor?.id, context, expires: system.currentTick + duration });
}
export function resolveAggressor(entity, target) {
    const entry = contexts.get(target?.id);
    if (entry && entry.executorId === entity?.id && entry.expires >= system.currentTick) return entry.context;
    return entity;
}
export function applyAggressorDamage(target, amount, attacker, cause) {
    const delegated = delegatedDamage.get(attacker);
    return delegated ? delegated(target, amount, cause) : target.applyDamage(amount, { cause, damagingEntity: attacker });
}
system.runInterval(() => {
    for (const [id, entry] of contexts) if (entry.expires < system.currentTick) contexts.delete(id);
}, 200);

// All death subscribers can resolve attribution this tick, then release it in one batch.
const deadTargets = new Set();
let deathCleanupScheduled = false;
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    deadTargets.add(deadEntity.id);
    if (deathCleanupScheduled) return;
    deathCleanupScheduled = true;
    system.run(() => {
        for (const id of deadTargets) contexts.delete(id);
        deadTargets.clear(); deathCleanupScheduled = false;
    });
});

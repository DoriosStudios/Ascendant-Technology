import { EntityDamageCause, system } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getCurrentTick, normalizeChance, rollChance } from "../utils.js";
import { applyEffectById } from "../shared/effects.js";
import { markStatsCoreOverrideDamage } from "../shared/damage.js";
import { getEquipmentStatsContext } from "../shared/context.js"; 
import { ENTITY_CATEGORIES, ENTITY_CATEGORY_MEMBERS, OFFENSIVE_ENTITY_CATEGORIES, effectAppliesToEntity, getEntityCategory } from "../shared/entityCategories.js";
import { resolveStatsAbilityName } from "../core/abilities.js";
import {
    getStatsCoreEffect,
    removeStatsCoreEffect,
    upsertStatsCoreEffect,
} from "../effects/index.js";

const procDamageTargets = new Map();
const effectCooldowns = new Map();
const bleedStates = new Map();
const blessingStates = new Map();
const HOT_ENTITY_TOKENS = Object.freeze(["blaze", "magma", "strider", "ghast", "piglin", "hoglin", "zoglin", "wither_skeleton"]);
const COLD_ENTITY_TOKENS = Object.freeze(["stray", "snow_golem", "breeze", "ice", "frozen", "frost"]);
const DARK_RESISTANT_TOKENS = Object.freeze(["wither", "warden", "ender", "shulker"]);
const UNDEAD_ENTITY_TOKENS = Object.freeze([
    "bogged", "drowned", "husk", "parched", "phantom", "skeleton", "stray",
    "wither", "zoglin", "zombie",
]);
const SWEEP_ENTITY_CATEGORIES = Object.freeze([
    ...OFFENSIVE_ENTITY_CATEGORIES,
    ENTITY_CATEGORIES.passive,
]);
const SWEEP_ENTITY_CATEGORY_SET = new Set(SWEEP_ENTITY_CATEGORIES);
const SWEEP_EXCLUDED_ENTITY_TYPES = ENTITY_CATEGORY_MEMBERS[ENTITY_CATEGORIES.ally];
let bleedProcessorRunId;
let blessingProcessorRunId;

function entityKey(entity) {
    return String(entity?.id ?? entity?.typeId ?? "unknown");
}

function cleanupTimedEntries(map) {
    const now = getCurrentTick();
    for (const [key, value] of map.entries()) {
        if (Number(value?.expiresAt ?? 0) <= now) {
            map.delete(key);
        }
    }
}

function getEffectKey(effect) {
    return String(effect?.key ?? effect?.label ?? effect?.kind ?? effect?.id ?? "effect");
}

function getCooldownKey(entity, effect) {
    return `${entityKey(entity)}:${getEffectKey(effect)}`;
}

function hasHealthComponent(entity) {
    try {
        return !!entity?.getComponent?.("minecraft:health") || !!entity?.getComponent?.("health");
    } catch {
        return false;
    }
}

function getHealthComponent(entity) {
    try {
        return entity?.getComponent?.("minecraft:health") ?? entity?.getComponent?.("health") ?? null;
    } catch {
        return null;
    }
}

function hasEntityToken(entity, tokens) {
    const id = String(entity?.typeId ?? "").toLowerCase();
    return tokens.some(token => id.includes(token));
}

function isNetherOrHotTarget(entity) {
    const dimensionId = String(entity?.dimension?.id ?? "").toLowerCase();
    return dimensionId.includes("nether") || hasEntityToken(entity, HOT_ENTITY_TOKENS);
}

function isColdTarget(entity) {
    return hasEntityToken(entity, COLD_ENTITY_TOKENS);
}

function isUndeadTarget(entity) {
    try {
        if (entity?.matches?.({ families: ["undead"] }) === true) return true;
    } catch { }
    return hasEntityToken(entity, UNDEAD_ENTITY_TOKENS);
}

function isBlessingElement(value) {
    const id = String(value?.id ?? value?.key ?? value?.type ?? value ?? "").trim().toLowerCase();
    return id === "light" || id === "blessing" || id === "blessed";
}

function isWaterElement(value) {
    const id = String(value?.id ?? value?.key ?? value?.type ?? value ?? "").trim().toLowerCase();
    return id === "water";
}

function isBlessingFocus(weaponTypeId, definition) {
    const normalizedId = String(weaponTypeId ?? definition?.id ?? "").trim().toLowerCase();
    const path = normalizedId.split(":").pop() ?? "";
    const branch = String(definition?.branch ?? "").trim().toLowerCase();
    return normalizedId === "minecraft:stick"
        || branch === "stick"
        || branch === "wand"
        || /(^|_)(wand|staff)(_|$)/.test(path);
}

/**
 * Rolls Light before vanilla damage is committed so friendly hits can be
 * cancelled. The actual mutation is deferred by the combat module.
 */
export function prepareBlessingForHit({ attacker, target, attributes, weaponTypeId, definition }) {
    const aspects = Array.isArray(attributes?.elemental) ? attributes.elemental : [];
    if (!target || !aspects.length) return null;
    const category = getEntityCategory(target);
    const friendly = category === ENTITY_CATEGORIES.ally || category === ENTITY_CATEGORIES.passive;
    const onFire = (() => {
        try {
            return Number(target.getComponent?.("minecraft:onfire")?.onFireTicksRemaining ?? 0) > 0;
        } catch {
            return false;
        }
    })();
    const waterAspect = aspects.find(isWaterElement);
    if (waterAspect && friendly && onFire) {
        return {
            aspect: waterAspect,
            elementId: "water",
            cancelDamage: true,
            extinguishTarget: true,
        };
    }

    const aspect = aspects.find(isBlessingElement);
    if (!aspect) return null;
    const undead = isUndeadTarget(target);
    if (!undead && !friendly) return null;

    const playerTarget = String(target?.typeId ?? "").toLowerCase() === "minecraft:player";
    if (playerTarget && !isBlessingFocus(weaponTypeId, definition)) return null;

    const attackerIsPlayer = String(attacker?.typeId ?? "").toLowerCase() === "minecraft:player";
    if (friendly && !undead && !playerTarget && attackerIsPlayer && attacker?.isSneaking === true) {
        return {
            aspect,
            undead: false,
            cancelDamage: false,
            curseAttacker: true,
        };
    }

    return { aspect, undead, cancelDamage: friendly && !undead };
}

function canDamageWithEffect(effect, entity) {
    const id = String(effect?.id ?? effect?.key ?? "").trim().toLowerCase();
    if (id === "void" && entity?.typeId === "minecraft:player") return true;
    return effectAppliesToEntity(effect, entity, OFFENSIVE_ENTITY_CATEGORIES);
}

function canSweepEntity(_effect, entity) {
    // Sweeping has a fixed target policy. Do not inherit an old
    // `appliesTo: ["hostile"]` restriction persisted on a refined item.
    const category = getEntityCategory(entity);
    return category !== ENTITY_CATEGORIES.ally && SWEEP_ENTITY_CATEGORY_SET.has(category);
}

function healTarget(target, amount) {
    const health = getHealthComponent(target);
    const current = Number(health?.currentValue ?? health?.value ?? 0);
    const max = Number(health?.effectiveMax ?? health?.defaultValue ?? health?.max ?? current);
    if (!health || !Number.isFinite(current) || !Number.isFinite(max) || max <= current) return false;
    if (typeof health.setCurrentValue !== "function") return false;

    try {
        health.setCurrentValue(Math.min(max, current + Math.max(0, Number(amount ?? 0) || 0)));
        return true;
    } catch {
        return false;
    }
}

function markProcDamageTarget(target, durationTicks = 2) {
    if (!target) return;

    procDamageTargets.set(entityKey(target), {
        expiresAt: getCurrentTick() + Math.max(1, Math.floor(Number(durationTicks) || 1))
    });

    if (procDamageTargets.size > STATSCORE.runtime.markCleanupSize) {
        cleanupTimedEntries(procDamageTargets);
    }
}

function isEffectOnCooldown(entity, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!entity || cooldownTicks <= 0) return false;

    const key = getCooldownKey(entity, effect);
    const cooldown = effectCooldowns.get(key);
    const now = getCurrentTick();
    if (Number(cooldown?.expiresAt ?? 0) > now) return true;
    if (cooldown) effectCooldowns.delete(key);
    return false;
}

function setEffectCooldown(entity, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!entity || cooldownTicks <= 0) return;

    effectCooldowns.set(getCooldownKey(entity, effect), {
        expiresAt: getCurrentTick() + cooldownTicks
    });
    if (effectCooldowns.size > STATSCORE.runtime.markCleanupSize) {
        cleanupTimedEntries(effectCooldowns);
    }
}

function tryApplyDamage(target, amount, attacker, cause = EntityDamageCause.entityAttack, healthChecked = false) {
    if (!target || (!healthChecked && !hasHealthComponent(target))) return false;

    try {
        markProcDamageTarget(target, 4);
        return target.applyDamage?.(amount, {
            // `entity_attack` is valid in the `/damage` command but not in
            // Script API's EntityDamageCause enum. Keep compatibility with
            // existing callers while using the API's camel-case value.
            cause: cause === "entity_attack" ? EntityDamageCause.entityAttack : cause,
            damagingEntity: attacker,
        }) === true;
    } catch {
        return false;
    }
}

export function applyStatsProcDamage(target, amount, attacker, cause = EntityDamageCause.entityAttack) {
    return tryApplyDamage(target, Math.max(0, Number(amount ?? 0) || 0), attacker, cause);
}

function getSweepDamageScale(effect, offensiveLevel) {
    const baseScale = Math.max(0.5, Number(effect?.damageScale ?? 0.5) || 0.5);
    const scalePer5Levels = Math.max(0, Number(effect?.damageScalePer5Levels ?? 0.05) || 0.05);
    const maxScale = Math.max(baseScale, Number(effect?.maxDamageScale ?? 1) || 1);
    const levelSteps = Math.floor(Math.max(1, Number(offensiveLevel ?? 1) || 1) / 5);
    return Math.min(maxScale, baseScale + levelSteps * scalePer5Levels);
}

function getSweepRadius(effect, offensiveLevel) {
    const baseRadius = Math.max(0.5, Number(effect?.radius ?? 2.5) || 2.5);
    const radiusPer5Levels = Math.max(0, Number(effect?.radiusPer5Levels ?? 0.5) || 0.5);
    const maxRadiusLevel = Math.max(1, Math.floor(Number(effect?.maxRadiusLevel ?? 25) || 25));
    const cappedLevel = Math.min(maxRadiusLevel, Math.max(1, Number(offensiveLevel ?? 1) || 1));
    return baseRadius + Math.floor(cappedLevel / 5) * radiusPer5Levels;
}

function applySweep(attacker, target, effect, finalDamage, offensiveLevel) {
    if (!attacker || !target || !target.dimension || isEffectOnCooldown(attacker, effect)) return false;

    const radius = getSweepRadius(effect, offensiveLevel);
    const damageScale = getSweepDamageScale(effect, offensiveLevel);
    const sweepDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    const attackerId = attacker.id;
    const targetId = target.id;
    let hits = 0;

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
        excludeTypes: SWEEP_EXCLUDED_ENTITY_TYPES,
    })) {
        if (!entity || entity.id === attackerId || entity.id === targetId) continue;
        if (!hasHealthComponent(entity)) continue;
        if (!canSweepEntity(effect, entity)) continue;

        if (tryApplyDamage(entity, sweepDamage, attacker, EntityDamageCause.entityAttack, true)) {
            hits++;
            spawnParticleSafe(entity, "minecraft:critical_hit_emitter");
        }
    }

    if (hits > 0) {
        setEffectCooldown(attacker, effect);
        return true;
    }

    return false;
}

function spawnParticleSafe(entity, particleId) {
    if (!entity?.dimension || !particleId) return false;

    try {
        entity.dimension.spawnParticle?.(particleId, entity.location);
        return true;
    } catch {
        return false;
    }
}

function ensureBleedProcessor() {
    if (bleedProcessorRunId !== undefined) return;

    bleedProcessorRunId = system.runInterval(() => {
        if (bleedStates.size <= 0) {
            const runId = bleedProcessorRunId;
            bleedProcessorRunId = undefined;
            try {
                system.clearRun(runId);
            } catch { }
            return;
        }

        const now = getCurrentTick();
        for (const [key, state] of bleedStates.entries()) {
            if (!state?.target || !hasHealthComponent(state.target) || Number(state.expiresAt ?? 0) <= now) {
                const target = state?.target;
                bleedStates.delete(key);
                if (target) publishBleedingState(target);
                continue;
            }

            if (Number(state.nextTickAt ?? 0) > now) continue;

            const tickInterval = Math.max(5, Math.floor(Number(state.tickInterval ?? 20) || 20));
            const amount = Math.max(
                1,
                Number(state.damage ?? 1) * (1 + (Math.max(1, Number(state.stacks ?? 1)) - 1) * 0.5)
            );

            try {
                markProcDamageTarget(state.target, 3);
                const damaged = state.target.applyDamage?.(amount, {
                    cause: "magic",
                    damagingEntity: state.attacker,
                });
                if (damaged === true) {
                    spawnParticleSafe(state.target, "ascendant_technology:blood_particle");
                }
            } catch {
                const target = state?.target;
                bleedStates.delete(key);
                if (target) publishBleedingState(target);
                continue;
            }

            state.nextTickAt = now + tickInterval;
        }
    }, 5);
}

function applyBleed(target, attacker, effect, finalDamage) {
    if (!target || !hasHealthComponent(target) || isEffectOnCooldown(attacker, effect)) return false;

    ensureBleedProcessor();

    const now = getCurrentTick();
    const key = `${entityKey(target)}:${getEffectKey(effect)}`;
    const tickInterval = Math.max(5, Math.floor(Number(effect?.tickInterval ?? 20) || 20));
    const durationTicks = Math.max(tickInterval, Math.floor(Number(effect?.durationTicks ?? effect?.duration ?? 80) || 80));
    const maxStacks = Math.max(1, Math.floor(Number(effect?.maxStacks ?? 1) || 1));
    const damageRatio = Math.max(0.02, Number(effect?.damageRatio ?? 0.12) || 0.12);
    const damage = Math.max(1, Number(finalDamage ?? 0) * damageRatio);
    const existing = bleedStates.get(key);

    if (existing) {
        existing.attacker = attacker ?? existing.attacker;
        existing.damage = Math.max(Number(existing.damage ?? 0), damage);
        existing.stacks = Math.min(maxStacks, Math.max(1, Number(existing.stacks ?? 1)) + 1);
        existing.expiresAt = now + durationTicks;
        if (effect?.refresh !== false) {
            existing.nextTickAt = Math.min(Number(existing.nextTickAt ?? now + tickInterval), now + tickInterval);
        }
    } else {
        bleedStates.set(key, {
            attacker,
            target,
            damage,
            stacks: 1,
            tickInterval,
            expiresAt: now + durationTicks,
            nextTickAt: now + tickInterval,
        });
    }

    publishBleedingState(target);
    setEffectCooldown(attacker, effect);
    return true;
}

function publishBleedingState(target) {
    const now = getCurrentTick();
    const targetId = entityKey(target);
    let expiresAt = 0;
    let stacks = 1;

    for (const state of bleedStates.values()) {
        if (entityKey(state?.target) !== targetId || Number(state?.expiresAt ?? 0) <= now) continue;
        expiresAt = Math.max(expiresAt, Number(state.expiresAt));
        stacks = Math.max(stacks, Math.max(1, Number(state.stacks ?? 1)));
    }

    if (expiresAt <= now) {
        removeStatsCoreEffect(target, "bleeding");
        return;
    }
    upsertStatsCoreEffect(target, {
        id: "bleeding",
        expiresAtTick: expiresAt,
        level: stacks,
    });
}

function ensureBlessingProcessor() {
    if (blessingProcessorRunId !== undefined) return;

    blessingProcessorRunId = system.runInterval(() => {
        if (blessingStates.size <= 0) {
            const runId = blessingProcessorRunId;
            blessingProcessorRunId = undefined;
            try {
                system.clearRun(runId);
            } catch { }
            return;
        }

        const now = getCurrentTick();
        for (const [key, state] of blessingStates.entries()) {
            if (!state?.target || !hasHealthComponent(state.target) || Number(state.expiresAt ?? 0) <= now) {
                const target = state?.target;
                blessingStates.delete(key);
                if (target) removeStatsCoreEffect(target, "blessed");
                continue;
            }
            if (Number(state.nextTickAt ?? 0) > now) continue;

            const tickInterval = Math.max(5, Math.floor(Number(state.tickInterval ?? 10) || 10));
            if (!tryApplyDamage(state.target, Math.max(1, Number(state.damage ?? 8) || 8), state.attacker, "magic")) {
                const target = state?.target;
                blessingStates.delete(key);
                if (target) removeStatsCoreEffect(target, "blessed");
                continue;
            }
            state.nextTickAt = now + tickInterval;
        }
    }, 5);
}

function publishBlessingState(target, durationTicks, undead) {
    upsertStatsCoreEffect(target, {
        id: "blessed",
        polarity: undead ? "debuff" : "buff",
        durationTicks,
    });
}

function playStatsCoreSound(entity, soundId, options = {}) {
    try {
        entity?.dimension?.playSound?.(soundId, entity.location, options);
        return true;
    } catch {
        return false;
    }
}

/** Applies the intentional cost for breaking Blessing's friendly-hit protection. */
export function applyBlessingCurse(attacker) {
    if (!attacker || !hasHealthComponent(attacker)) return false;

    const durationTicks = 30 * 20;
    applyEffectById(attacker, "slowness", durationTicks, 0, false);
    applyEffectById(attacker, "weakness", durationTicks, 2, false);
    applyEffectById(attacker, "hunger", durationTicks, 2, false);
    upsertStatsCoreEffect(attacker, {
        id: "cursed",
        durationTicks,
    });
    playStatsCoreSound(attacker, "ascendant.statscore.blessing_curse", {
        volume: 1,
        pitch: 1,
    });

    try {
        markStatsCoreOverrideDamage(attacker, 4);
        attacker.applyDamage?.(8, {
            cause: EntityDamageCause.override ?? "override",
        });
    } catch {
        return false;
    }
    return true;
}

export function applyPreparedBlessing({ attacker, target, prepared }) {
    const aspect = prepared?.aspect;
    if (!target || !aspect || !hasHealthComponent(target)) return false;

    if (prepared.extinguishTarget === true) {
        try {
            return target.extinguishFire?.(true) === true;
        } catch {
            return false;
        }
    }

    const playerTarget = String(target?.typeId ?? "").toLowerCase() === "minecraft:player";
    const durationTicks = playerTarget
        ? Math.max(20, Math.floor(Number(aspect.playerDurationTicks ?? 2400) || 2400))
        : Math.max(20, Math.floor(Number(aspect.mobDurationTicks ?? 18000) || 18000));
    const regenerationAmplifier = Math.max(0, Math.floor(Number(aspect.regenerationAmplifier ?? 0) || 0));
    let applied = applyEffectById(target, "regeneration", durationTicks, regenerationAmplifier, false);

    if (prepared.undead === true) {
        const tickInterval = Math.max(5, Math.floor(Number(aspect.tickInterval ?? 10) || 10));
        const damage = Math.max(1, Number(aspect.blessingDamage ?? 8) || 8);
        blessingStates.set(`${entityKey(target)}:blessing`, {
            attacker,
            target,
            damage,
            tickInterval,
            expiresAt: getCurrentTick() + durationTicks,
            nextTickAt: getCurrentTick() + tickInterval,
        });
        ensureBlessingProcessor();
        applied = true;
    } else {
        // Effect amplifiers are zero-based: amplifier 5 is Health Boost VI.
        const healthBoost = applyEffectById(target, "health_boost", durationTicks, 5, false);
        const resistance = applyEffectById(target, "resistance", durationTicks, 0, false);
        const healed = healTarget(target, Math.max(1, Number(aspect.healAmount ?? 8) || 8));
        applied = applied || healthBoost || resistance || healed;
    }

    spawnParticleSafe(target, "dorios:light_blessing_burst");
    playStatsCoreSound(target, "ascendant.statscore.blessing", {
        volume: 0.9,
        pitch: prepared.undead === true ? 0.9 : 1.05,
    });
    publishBlessingState(target, durationTicks, prepared.undead === true);
    return applied;
}

function shouldTriggerEffect(effect, context) {
    const kind = String(effect?.kind ?? "").trim().toLowerCase();
    // Sweeping deliberately has a broader target policy than the other combat
    // effects: it can begin on, and spread to, passive creatures. Previously
    // the generic hostile-only gate rejected a cow/pig/chicken before
    // applySweep() was ever reached.
    const targetIsAllowed = kind === "sweep"
        ? canSweepEntity(effect, context?.target)
        : effectAppliesToEntity(effect, context?.target, OFFENSIVE_ENTITY_CATEGORIES);
    if (!targetIsAllowed) return false;

    const on = String(effect?.on ?? "hit").toLowerCase();
    if (on === "crit" && context?.crit?.active !== true) return false;
    if (on === "marked" && context?.marked !== true) return false;
    const projectileDamage = Boolean(context?.damagingProjectile)
        || String(context?.damageSource?.cause ?? "").trim().toLowerCase() === "projectile";
    if (effect?.requiresProjectile === true && !projectileDamage) return false;
    return rollChance(effect?.chance, 1);
}

export function getMark(target) {
    const effect = getStatsCoreEffect(target, "marked");
    if (!effect) return null;
    return {
        sourceId: effect.data?.sourceId,
        expiresAt: effect.expiresAtTick,
        damageBonus: Number(effect.data?.damageBonus ?? 0) || 0,
    };
}

export function getMarkedDamageBonus(target, attributes) {
    const mark = getMark(target);
    if (!mark) return 0;

    return Math.max(
        Number(attributes?.markedDamageBonus ?? 0) || 0,
        Number(mark.damageBonus ?? 0) || 0
    );
}

export function isProcDamageTarget(target) {
    const key = entityKey(target);
    const state = procDamageTargets.get(key);
    if (!state) return false;

    if (Number(state.expiresAt ?? 0) <= getCurrentTick()) {
        procDamageTargets.delete(key);
        return false;
    }

    return true;
}

function applyMark(target, attacker, effect) {
    const durationTicks = Math.max(20, Math.floor(Number(effect.durationTicks ?? effect.duration ?? 100) || 100));
    upsertStatsCoreEffect(target, {
        id: "marked",
        durationTicks,
        data: {
            sourceId: entityKey(attacker),
            damageBonus: normalizeChance(effect.damageBonus, 0),
        },
    });
}

function applyStatusEffect(target, effect) {
    if (!target || !effect?.id) return false;

    const duration = Math.max(1, Math.floor(Number(effect.duration ?? 40) || 40));
    const amplifier = Math.max(0, Math.floor(Number(effect.amplifier ?? 0) || 0));
    return applyEffectById(target, effect.id, duration, amplifier, effect.showParticles !== false);
}

function applyFire(target, effect) {
    const seconds = Math.max(1, Math.floor(Number(effect.seconds ?? effect.durationSeconds ?? 3) || 3));
    try {
        target?.setOnFire?.(seconds, true);
        return true;
    } catch {
        return false;
    }
}

function transformEntity(target, nextTypeId, chance) {
    if (!target || !nextTypeId || !rollChance(chance, 0)) return false;
    const dimension = target.dimension;
    const location = { ...target.location };
    const nameTag = target.nameTag;
    let rotation;
    try { rotation = target.getRotation?.(); } catch { }

    system.run(() => {
        try {
            if (target.isValid === false) return;
            const sourceHealth = getHealthComponent(target);
            const currentHealth = Number(sourceHealth?.currentValue ?? 0);
            if (!Number.isFinite(currentHealth) || currentHealth <= 0) return;
            const replacement = dimension?.spawnEntity?.(nextTypeId, location);
            if (!replacement) return;
            if (nameTag) replacement.nameTag = nameTag;
            if (rotation) replacement.setRotation?.(rotation);
            const replacementHealth = getHealthComponent(replacement);
            replacementHealth?.setCurrentValue?.(Math.min(
                Number(replacementHealth?.effectiveMax ?? replacementHealth?.defaultValue ?? currentHealth),
                currentHealth,
            ));
            target.remove?.();
        } catch { }
    });
    return true;
}

function pullMatchingEntitiesToCenter(dimension, typeId, center, excludedId, radius = 7.5, strength = 0.72) {
    if (!dimension || !typeId || !center) return false;
    let pulled = false;

    try {
        for (const entity of dimension.getEntities({
            type: typeId,
            location: center,
            maxDistance: Math.max(2, Number(radius) || 7.5),
        })) {
            if (!entity || entity.id === excludedId) continue;
            const dx = Number(center.x) - Number(entity.location.x);
            const dy = Number(center.y) - Number(entity.location.y);
            const dz = Number(center.z) - Number(entity.location.z);
            const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
            const normalizedRadius = Math.max(2, Number(radius) || 7.5);
            const baseForce = Math.max(0.05, Number(strength) || 0.72);
            // Far entities receive the strongest pull while nearby entities
            // settle around the struck target instead of overshooting it.
            const distanceRatio = Math.min(1, distance / normalizedRadius);
            const force = baseForce * (0.12 + distanceRatio * 0.88);
            const horizontalDistance = Math.max(0.001, Math.hypot(dx, dz));
            const verticalForce = Math.max(-0.18, Math.min(0.28, (dy / distance) * force + 0.06));
            entity.applyImpulse?.({
                x: dx / horizontalDistance * force,
                y: verticalForce,
                z: dz / horizontalDistance * force,
            });
            pulled = true;
        }
    } catch { }
    return pulled;
}

function triggerVoidSingularity(target) {
    const dimension = target?.dimension;
    const typeId = target?.typeId;
    const center = target?.location
        ? { x: target.location.x, y: target.location.y, z: target.location.z }
        : null;
    if (!dimension || !typeId || !center) return false;

    try {
        dimension.spawnParticle?.("ascendant_technology:void_singularity", {
            x: center.x,
            y: center.y + 0.08,
            z: center.z,
        });
        dimension.playSound?.("ascendant.statscore.void_singularity", center, {
            volume: 1,
            pitch: 0.9,
        });
    } catch { }

    const pull = () => pullMatchingEntitiesToCenter(
        dimension,
        typeId,
        center,
        target.id,
        7.5,
        0.72,
    );
    pull();
    // Subsequent pulses retain the captured center even when the struck entity
    // dies or becomes invalid during the Void hit.
    for (const delay of [2, 4, 6]) system.runTimeout(pull, delay);
    return true;
}

function applyElementalAspect(attacker, target, aspect, finalDamage) {
    if (!target || !aspect?.id || !rollChance(aspect.chance, 0)) return false;
    if (!canDamageWithEffect(aspect, target)) return false;

    const id = String(aspect.id).toLowerCase();
    const duration = Math.max(20, Math.floor(Number(aspect.durationTicks ?? 80) || 80));
    const amplifier = Math.max(0, Math.floor(Number(aspect.amplifier ?? 0) || 0));
    const baseDamage = Math.max(0, Number(aspect.damage ?? 0) || 0);
    const scaledDamage = Math.max(0, Number(finalDamage ?? 0) || 0) * Math.max(0, Number(aspect.damageScale ?? 0) || 0);
    let amount = Math.max(1, baseDamage + scaledDamage);

    // Plant / Poison
    // Stronger and longer poison effects
    if (id === "plant" || id === "poison") {
        if (isNetherOrHotTarget(target)) {
            amount *= 0.65;
        }

        // increase duration and potency
        const longDuration = Math.max(duration * 2, 80);
        const strongAmp = Math.max(1, Math.floor(Number(amplifier) || 1));
        const poisoned = applyEffectById(target, "fatal_poison", longDuration, strongAmp, false)
            || applyEffectById(target, "poison", longDuration, strongAmp, false);

        // increase direct damage from the aspect as well
        amount *= 1.5;
        return tryApplyDamage(target, amount, attacker, "magic") || poisoned;
    }

    // Ice / Frost / Freezing
    // Stronger freezing effect: heavy damage and deeper slow.
    if (id === "frost" || id === "ice") {
        // custom particle placeholder:
        // TODO: spawn custom frost particle here, e.g. spawnParticleSafe(target, "minecraft:custom_frost_particle");

        if (isColdTarget(target)) {
            // cold targets receive a small heal instead of damage
            return healTarget(target, Math.max(1, amount * 0.25));
        }

        // increase damage vs hot/ nether targets
        if (isNetherOrHotTarget(target)) {
            amount *= 2.0; // drastically stronger against hot targets
        } else {
            amount *= 1.6; // generally stronger overall
        }

        // apply a much stronger slowness (amplifier 2 or more)
        const heavySlownessAmp = Math.max(2, Math.floor(Number(amplifier) || 2));
        const slowed = applyEffectById(target, "slowness", Math.max(40, duration * 2), heavySlownessAmp, false);
        if (target.typeId === "minecraft:skeleton") {
            transformEntity(target, "minecraft:stray", 0.65);
        }
        return tryApplyDamage(target, amount, attacker, "freezing") || slowed;
    }

    if (id === "wind") {
        if (target.typeId === "minecraft:blaze") {
            amount *= 0.35;
            applyEffectById(target, "health_boost", 160, 1, false);
            applyEffectById(target, "resistance", 160, 0, false);
            applyEffectById(target, "regeneration", 160, 0, false);
            transformEntity(target, "minecraft:breeze", 0.12);
        }
        try {
            target.applyImpulse?.({ x: 0, y: 0.22, z: 0 });
        } catch { }
        return tryApplyDamage(target, amount, attacker, "magic");
    }

    if (id === "water") {
        if (isNetherOrHotTarget(target)) amount *= 1.75;
        try { target.extinguishFire?.(true); } catch { }
        return tryApplyDamage(target, amount, attacker, "magic");
    }

    if (id === "void") {
        triggerVoidSingularity(target);
        applyEffectById(target, "weakness", Math.max(80, duration), 1, false);
        markStatsCoreOverrideDamage(target, 4);
        return tryApplyDamage(target, amount, attacker, EntityDamageCause.override);
    }

    // Fire - burns cold targets harder and loses bite vs hot targets
    if (id === "fire") {
        if (isColdTarget(target)) amount *= 1.35;
        if (isNetherOrHotTarget(target)) amount *= 0.65;
        const ignited = applyFire(target, aspect);
        return tryApplyDamage(target, amount, attacker, "fire") || ignited;
    }

    // Lightning remains a real lightning strike. Its entity damage/fire can
    // land after this callback, so clean the local aftermath for the next few
    // ticks instead of extinguishing only before the bolt resolves.
    if (id === "lightning" || id === "shock") {
        if (target?.isInWater === true || target?.isWet === true) amount *= 1.5; // stronger bonus vs wet
        const impact = {
            x: Number(target.location?.x ?? 0),
            y: Number(target.location?.y ?? 0),
            z: Number(target.location?.z ?? 0),
        };
        const dimension = target.dimension;
        let struck = false;
        try {
            dimension?.spawnEntity?.("minecraft:lightning_bolt", impact);
            struck = true;
        } catch {
            try {
                dimension?.runCommand(`summon lightning_bolt ${impact.x} ${impact.y} ${impact.z}`);
                struck = true;
            } catch {}
        }

        clearLightningHazards(dimension, impact);
        for (const delay of [1, 2, 4]) {
            system.runTimeout(() => clearLightningHazards(dimension, impact), delay);
        }
        const weakened = applyEffectById(target, "weakness", duration, amplifier, false);
        return tryApplyDamage(target, amount, attacker, "lightning") || weakened || struck;
    }

    // Darkness
    // Extremely powerful and rare effect: applies blindness, darkness, weakness I, wither I and slowness I.
    // If the target is resistant (deep dark / end-like) it's reduced. If the target is a player wearing
    // StatsCore equipment, reflect the effects to the attacker instead.
    if (id === "darkness" || id === "dark") {
        // Check resistance
        if (hasEntityToken(target, DARK_RESISTANT_TOKENS)) amount *= 0.7;

        // Determine final recipient: if the target is a player and has StatsCore equipment, apply to attacker instead
        let recipient = target;
        try {
            const targetContext = getEquipmentStatsContext && typeof getEquipmentStatsContext === "function"
                ? getEquipmentStatsContext(target)
                : null;
            if (targetContext && attacker) {
                recipient = attacker; // reflect to attacker
            }
        } catch { }

        // Apply stacked status effects: blindness, darkness, weakness I, wither I, slowness I
        // blindness
        applyEffectById(recipient, "blindness", Math.max(40, duration), 0, false);
        // darkness
        applyEffectById(recipient, "darkness", Math.max(40, duration), 0, false);
        // weakness I
        applyEffectById(recipient, "weakness", Math.max(40, duration), 0, false);
        // wither I
        applyEffectById(recipient, "wither", Math.max(40, duration), 0, false);
        // slowness I
        applyEffectById(recipient, "slowness", Math.max(40, duration), 0, false);

        return tryApplyDamage(target, amount * 0.25, attacker, "wither");
    }

    return tryApplyDamage(target, amount, attacker, "magic");
}

function applyElementalAspects({ attacker, target, attributes, finalDamage, skipElemental = [] }) {
    const aspects = Array.isArray(attributes?.elemental) ? attributes.elemental : [];
    const skipped = new Set(skipElemental.map(value => String(value ?? "").trim().toLowerCase()));
    const applied = [];

    for (const aspect of aspects) {
        const aspectId = String(aspect?.id ?? aspect?.type ?? "").trim().toLowerCase();
        if (isBlessingElement(aspect) || skipped.has(aspectId)) continue;
        if (applyElementalAspect(attacker, target, aspect, finalDamage)) {
            applied.push(aspectId);
        }
    }

    return applied.filter(Boolean);
}

function queueAftershockLandingBurst(target, effect) {
    const slownessDuration = Math.max(1, Math.floor(Number(effect?.slownessDurationTicks ?? 100) || 100));
    const slownessAmplifier = Math.max(0, Math.floor(Number(effect?.slownessAmplifier ?? 3) || 3));
    let attempts = 0;
    const checkLanding = () => {
        if (!hasHealthComponent(target)) return;
        attempts++;
        if (target?.isOnGround === true || attempts >= 30) {
            applyEffectById(target, "slowness", slownessDuration, slownessAmplifier, false);
            spawnParticleSafe(target, "minecraft:critical_hit_emitter");
            return;
        }
        system.runTimeout(checkLanding, 2);
    };
    system.runTimeout(checkLanding, 2);
}

function applyAftershock(attacker, target, effect, finalDamage) {
    if (!attacker || !target || !target.dimension || isEffectOnCooldown(attacker, effect)) return false;

    const radius = Math.max(2, Number(effect?.radius ?? 7.5) || 7.5);
    const maxTargets = Math.max(1, Math.floor(Number(effect?.maxTargets ?? 12) || 12));
    const damageScale = Math.max(0.1, Number(effect?.damageScale ?? 0.5) || 0.5);
    const shockDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    let applied = false;
    let hits = 0;

    try {
        target.applyKnockback?.({ x: 0, z: 0 }, Math.max(0.8, Number(effect?.knockbackVertical ?? 1.1) || 1.1));
        queueAftershockLandingBurst(target, effect);
        spawnParticleSafe(target, "minecraft:critical_hit_emitter");
        applied = true;
    } catch { }

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === attacker.id || entity.id === target.id) continue;
        if (!hasHealthComponent(entity)) continue;
        if (!canDamageWithEffect(effect, entity)) continue;

        const hit = tryApplyDamage(entity, shockDamage, attacker, EntityDamageCause.entityAttack, true);
        let lifted = false;
        try {
            entity.applyKnockback?.({ x: 0, z: 0 }, Math.max(0.8, Number(effect?.knockbackVertical ?? 1.1) || 1.1));
            queueAftershockLandingBurst(entity, effect);
            spawnParticleSafe(entity, "minecraft:critical_hit_emitter");
            lifted = true;
        } catch { }

        applied = hit || lifted || applied;
        if (hit || lifted) {
            hits++;
        }

        if (hits >= maxTargets) break;
    }

    if (applied) {
        setEffectCooldown(attacker, effect);
    }

    return applied;
}

function applyReaper(attacker, target, effect, finalDamage) {
    if (!attacker || !target?.dimension) return false;

    const radius = Math.max(1.5, Number(effect?.radius ?? 4.5) || 4.5);
    const damageScale = Math.max(0.1, Number(effect?.damageScale ?? 0.55) || 0.55);
    const reapDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    let applied = applyBleed(target, attacker, { ...effect, key: "reaper_bleeding", kind: "bleed", chance: 1 }, finalDamage);

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === attacker.id || entity.id === target.id) continue;
        if (!hasHealthComponent(entity)) continue;
        if (!canDamageWithEffect(effect, entity)) continue;
        if (entity.typeId !== target.typeId) continue;

        applied = tryApplyDamage(entity, reapDamage, attacker, EntityDamageCause.entityAttack, true) || applied;
        applyBleed(entity, attacker, { ...effect, key: "reaper_bleeding", kind: "bleed", chance: 1 }, reapDamage);
    }

    return applied;
}

function applyHarpoon(target, attacker, effect) {
    if (!target) return false;
    applyMark(target, attacker, effect);
    return true;
}

/**
 * Extinguishes players and fire created around a lightning impact. The sphere
 * is deliberately limited to ten blocks so it cannot alter distant builds.
 *
 * @param {import("@minecraft/server").Dimension | undefined} dimension
 * @param {{x:number,y:number,z:number}} impact
 */
function clearLightningHazards(dimension, impact) {
    if (!dimension) return;

    try {
        for (const player of dimension.getPlayers({ location: impact, maxDistance: 10 })) {
            try {
                player.extinguishFire?.(true);
            } catch {}
        }
    } catch {}

    const radius = 10;
    const radiusSquared = radius * radius;
    const minX = Math.floor(impact.x - radius);
    const maxX = Math.floor(impact.x + radius);
    const minY = Math.floor(impact.y - radius);
    const maxY = Math.floor(impact.y + radius);
    const minZ = Math.floor(impact.z - radius);
    const maxZ = Math.floor(impact.z + radius);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const dx = x - impact.x;
                const dy = y - impact.y;
                const dz = z - impact.z;
                if ((dx * dx) + (dy * dy) + (dz * dz) > radiusSquared) continue;

                try {
                    const block = dimension.getBlock({ x, y, z });
                    if (block?.typeId === "minecraft:fire" || block?.typeId === "minecraft:soul_fire") {
                        block.setType("minecraft:air");
                    }
                } catch {}
            }
        }
    }
}

function applySkewer(attacker, target, effect) {
    if (!attacker || !target || !attacker.location || !target.location) return false;
    applyMark(target, attacker, effect);

    const dx = Number(target.location.x ?? 0) - Number(attacker.location.x ?? 0);
    const dz = Number(target.location.z ?? 0) - Number(attacker.location.z ?? 0);
    const distance = Math.max(0.001, Math.hypot(dx, dz));
    try {
        target.applyKnockback?.({
            x: (dx / distance) * 2.4,
            z: (dz / distance) * 2.4,
        }, 0.55);
    } catch { }
    try {
        attacker.applyImpulse?.({
            x: (dx / distance) * 0.42,
            y: 0.08,
            z: (dz / distance) * 0.42,
        });
    } catch { }
    return true;
}

function applyPinningShot(target, attacker, effect) {
    if (!target || !attacker) return false;
    if (isEffectOnCooldown(attacker, effect)) return false;

    const duration = Math.max(20, Math.floor(Number(effect?.durationTicks ?? 80) || 80));
    applyEffectById(
        target,
        "slowness",
        duration,
        Math.max(0, Math.floor(Number(effect?.slownessAmplifier ?? 3) || 3)),
        false
    );
    applyEffectById(
        target,
        "weakness",
        duration,
        Math.max(0, Math.floor(Number(effect?.weaknessAmplifier ?? 1) || 1)),
        false
    );
    applyMark(target, attacker, {
        ...effect,
        durationTicks: duration,
        damageBonus: Math.max(0, Number(effect?.damageBonus ?? 0.06) || 0.06),
    });
    setEffectCooldown(attacker, effect);
    return true;
}

function distanceSquared(left, right) {
    const dx = Number(left?.x ?? 0) - Number(right?.x ?? 0);
    const dy = Number(left?.y ?? 0) - Number(right?.y ?? 0);
    const dz = Number(left?.z ?? 0) - Number(right?.z ?? 0);
    return (dx * dx) + (dy * dy) + (dz * dz);
}

function applyBallista(attacker, target, effect, finalDamage) {
    if (!attacker || !target || !target.dimension || isEffectOnCooldown(attacker, effect)) return false;

    applyMark(target, attacker, {
        ...effect,
        durationTicks: effect?.markDurationTicks ?? effect?.durationTicks,
        damageBonus: effect?.damageBonus,
    });

    const maxChains = Math.max(1, Math.floor(Number(effect?.maxChains ?? 3) || 3));
    const range = Math.max(1.5, Number(effect?.chainRange ?? 5) || 5);
    const damageScale = Math.max(0.1, Number(effect?.damageScale ?? 0.45) || 0.45);
    const chainedDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    const nearbyTargets = target.dimension.getEntities({
        location: target.location,
        maxDistance: range,
    })
        .filter(entity => entity && entity.id !== attacker.id && entity.id !== target.id)
        .filter(entity => hasHealthComponent(entity) && canDamageWithEffect(effect, entity))
        .sort((left, right) => distanceSquared(target.location, left.location) - distanceSquared(target.location, right.location))
        .slice(0, maxChains);
    let applied = true;

    for (const nextTarget of nearbyTargets) {
        spawnParticleTrail(target.dimension, target.location, nextTarget.location);
        const hit = tryApplyDamage(nextTarget, chainedDamage, attacker, "projectile");
        applyMark(nextTarget, attacker, {
            ...effect,
            durationTicks: effect?.markDurationTicks ?? effect?.durationTicks,
            damageBonus: effect?.damageBonus,
        });
        applied = hit || applied;
    }

    if (applied) {
        setEffectCooldown(attacker, effect);
    }

    return applied;
}

export function applyCombatEffects({ attacker, target, attributes, crit, finalDamage, damageSource, damagingProjectile, preAppliedElemental = [] }) {
    const effects = Array.isArray(attributes?.effects) ? attributes.effects : [];
    if (!target) return { count: 0, elemental: [], abilities: [] };

    const marked = Boolean(getMark(target));
    const elemental = [
        ...preAppliedElemental,
        ...applyElementalAspects({ attacker, target, attributes, finalDamage, skipElemental: preAppliedElemental }),
    ];
    const abilities = [];
    let applied = elemental.length;

    if (!effects.length) return { count: applied, elemental, abilities };

    const recordAbility = (effect) => {
        const name = resolveStatsAbilityName(effect);
        if (name && !abilities.includes(name)) abilities.push(name);
    };

    for (const effect of effects) {
        if (!effect || typeof effect !== "object") continue;
        if (!shouldTriggerEffect(effect, {
            attacker,
            target,
            crit,
            marked,
            damageSource,
            damagingProjectile,
        })) continue;

        const targetEntity = effect.target === "attacker" ? attacker : target;
        const kind = String(effect.kind ?? "").toLowerCase();

        if (kind === "passive") {
            continue;
        }

        if (kind === "skewer") {
            if (applySkewer(attacker, target, effect)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "mark") {
            applyMark(target, attacker, effect);
            applied++;
            recordAbility(effect);
            continue;
        }

        if (kind === "harpoon") {
            if (applyHarpoon(target, attacker, effect)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "pinning_shot") {
            if (applyPinningShot(target, attacker, effect)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "ballista") {
            if (applyBallista(attacker, target, effect, finalDamage)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "aftershock") {
            if (applyAftershock(attacker, target, effect, finalDamage)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "reaper") {
            if (applyReaper(attacker, target, effect, finalDamage)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "sweep") {
            if (applySweep(attacker, target, effect, finalDamage, attributes?.levels?.offensive)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "bleed") {
            if (applyBleed(target, attacker, effect, finalDamage)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (kind === "fire") {
            if (applyFire(targetEntity, effect)) {
                applied++;
                recordAbility(effect);
            }
            continue;
        }

        if (applyStatusEffect(targetEntity, effect)) {
            applied++;
            recordAbility(effect);
        }
    }

    return { count: applied, elemental, abilities };
}

function spawnParticleTrail(dimension, from, to, particleId = "minecraft:critical_hit_emitter") {
    if (!dimension || !from || !to) return;
    const dx = Number(to.x ?? 0) - Number(from.x ?? 0);
    const dy = Number(to.y ?? 0) - Number(from.y ?? 0);
    const dz = Number(to.z ?? 0) - Number(from.z ?? 0);
    const distance = Math.max(0.01, Math.hypot(dx, dy, dz));
    const steps = Math.min(18, Math.max(2, Math.ceil(distance * 2)));

    for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        try {
            dimension.spawnParticle?.(particleId, {
                x: Number(from.x ?? 0) + (dx * progress),
                y: Number(from.y ?? 0) + 0.8 + (dy * progress),
                z: Number(from.z ?? 0) + (dz * progress),
            });
        } catch { }
    }
}


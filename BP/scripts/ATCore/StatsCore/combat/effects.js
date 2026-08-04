import { EntityDamageCause, system, world } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getCurrentTick, normalizeChance, rollChance } from "../utils.js";
import { applyEffectById } from "../shared/effects.js";
import { getEquipmentStatsContext } from "../shared/context.js"; 
import { ENTITY_CATEGORIES, ENTITY_CATEGORY_MEMBERS, OFFENSIVE_ENTITY_CATEGORIES, effectAppliesToEntity, getEntityCategory } from "../shared/entityCategories.js";
import { resolveStatsAbilityName } from "../core/abilities.js";

const marks = new Map();
const procDamageTargets = new Map();
const effectCooldowns = new Map();
const bleedStates = new Map();
const HOT_ENTITY_TOKENS = Object.freeze(["blaze", "magma", "strider", "ghast", "piglin", "hoglin", "zoglin", "wither_skeleton"]);
const COLD_ENTITY_TOKENS = Object.freeze(["stray", "snow_golem", "breeze", "ice", "frozen", "frost"]);
const DARK_RESISTANT_TOKENS = Object.freeze(["wither", "warden", "ender", "shulker"]);
const SWEEP_ENTITY_CATEGORIES = Object.freeze([
    ...OFFENSIVE_ENTITY_CATEGORIES,
    ENTITY_CATEGORIES.passive,
]);
const SWEEP_ENTITY_CATEGORY_SET = new Set(SWEEP_ENTITY_CATEGORIES);
const SWEEP_EXCLUDED_ENTITY_TYPES = ENTITY_CATEGORY_MEMBERS[ENTITY_CATEGORIES.ally];
let bleedProcessorRunId;

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

function canDamageWithEffect(effect, entity) {
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
                bleedStates.delete(key);
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
                spawnParticleSafe(state.target, "minecraft:falling_dust_red_sand_particle");
                state.target.applyDamage?.(amount, {
                    cause: "magic",
                    damagingEntity: state.attacker,
                });
            } catch {
                bleedStates.delete(key);
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

    setEffectCooldown(attacker, effect);
    return true;
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

function cleanupMarksIfNeeded() {
    if (marks.size <= STATSCORE.runtime.markCleanupSize) return;

    const now = getCurrentTick();
    for (const [key, mark] of marks.entries()) {
        if (Number(mark?.expiresAt ?? 0) <= now) {
            marks.delete(key);
        }
    }
}

export function getMark(target) {
    const key = entityKey(target);
    const mark = marks.get(key);
    if (!mark) return null;

    if (Number(mark.expiresAt ?? 0) <= getCurrentTick()) {
        marks.delete(key);
        return null;
    }

    return mark;
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
    marks.set(entityKey(target), {
        sourceId: entityKey(attacker),
        expiresAt: getCurrentTick() + durationTicks,
        damageBonus: normalizeChance(effect.damageBonus, 0)
    });
    cleanupMarksIfNeeded();
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
        return tryApplyDamage(target, amount, attacker, "freezing") || slowed;
    }

    // Fire - burns cold targets harder and loses bite vs hot targets
    if (id === "fire") {
        if (isColdTarget(target)) amount *= 1.35;
        if (isNetherOrHotTarget(target)) amount *= 0.65;
        const ignited = applyFire(target, aspect);
        return tryApplyDamage(target, amount, attacker, "fire") || ignited;
    }

    // Lightning
    // Sends a lightning strike to all nearby targets (useful with sweeping) and then
    // extinguishes fire on nearby players and ground to avoid leaving dangerous lingering fires.
    if (id === "lightning" || id === "shock") {
        if (target?.isInWater === true || target?.isWet === true) amount *= 1.5; // stronger bonus vs wet

        // radius to search for additional targets to strike with lightning
        const strikeRadius = Math.max(2.5, Number(aspect?.radius ?? 3) || 3);

        try {
            const origin = target.location;
            if (origin && target.dimension) {
                // collect nearby entities (including the original target)
                const struck = [];
                for (const ent of target.dimension.getEntities({ location: origin, maxDistance: strikeRadius })) {
                    if (!ent) continue;
                    if (!canDamageWithEffect(aspect, ent)) continue;
                    struck.push(ent);
                }

                // Summon lightning at each struck entity's location
                for (const ent of struck) {
                    try {
                        const loc = ent.location;
                        if (!loc) continue;
                        // summon lightning bolt at the entity
                        if (typeof ent.dimension?.runCommand === "function") {
                            ent.dimension.runCommand(`summon lightning_bolt ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`);
                        }
                    } catch { }
                }

                // A successful lightning proc cleans a 7×7×3 volume centred
                // on the strike and extinguishes every online player.
                const center = {
                    x: Math.floor(Number(origin.x ?? 0)),
                    y: Math.floor(Number(origin.y ?? 0)),
                    z: Math.floor(Number(origin.z ?? 0)),
                };
                for (let x = -3; x <= 3; x++) {
                    for (let y = -1; y <= 1; y++) {
                        for (let z = -3; z <= 3; z++) {
                            try {
                                const block = target.dimension.getBlock?.({ x: center.x + x, y: center.y + y, z: center.z + z });
                                const blockId = String(block?.typeId ?? "").toLowerCase();
                                if (blockId === "minecraft:fire" || blockId === "minecraft:soul_fire") {
                                    block.setType?.("minecraft:air");
                                }
                            } catch { }
                        }
                    }
                }
                for (const player of world.getPlayers?.() ?? []) {
                    try {
                        player.extinguishFire?.(true);
                    } catch { }
                }
            }
        } catch { }

        const weakened = applyEffectById(target, "weakness", duration, amplifier, false);
        return tryApplyDamage(target, amount, attacker, "lightning") || weakened;
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

function applyElementalAspects({ attacker, target, attributes, finalDamage }) {
    const aspects = Array.isArray(attributes?.elemental) ? attributes.elemental : [];
    const applied = [];

    for (const aspect of aspects) {
        if (applyElementalAspect(attacker, target, aspect, finalDamage)) {
            applied.push(String(aspect?.id ?? aspect?.type ?? "").trim().toLowerCase());
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

export function applyCombatEffects({ attacker, target, attributes, crit, finalDamage, damageSource, damagingProjectile }) {
    const effects = Array.isArray(attributes?.effects) ? attributes.effects : [];
    if (!target) return { count: 0, elemental: [], abilities: [] };

    const marked = Boolean(getMark(target));
    const elemental = applyElementalAspects({ attacker, target, attributes, finalDamage });
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


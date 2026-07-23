import { system } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { getCurrentTick, normalizeChance, rollChance } from "../utils.js";
import { applyEffectById } from "../shared/effects.js";
import { getEquipmentStatsContext } from "../shared/context.js"; 

const marks = new Map();
const procDamageTargets = new Map();
const effectCooldowns = new Map();
const bleedStates = new Map();
const CALM_EVENT_IDS = Object.freeze(["minecraft:become_calm", "become_calm_event"]);
const HOT_ENTITY_TOKENS = Object.freeze(["blaze", "magma", "strider", "ghast", "piglin", "hoglin", "zoglin", "wither_skeleton"]);
const COLD_ENTITY_TOKENS = Object.freeze(["stray", "snow_golem", "breeze", "ice", "frozen", "frost"]);
const DARK_RESISTANT_TOKENS = Object.freeze(["wither", "warden", "ender", "shulker"]);
const PET_ENTITY_TOKENS = Object.freeze(["wolf", "cat", "ocelot", "parrot", "horse", "donkey", "mule", "llama", "fox", "rabbit", "bee"]);
let bleedProcessorActive = false;

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

function isPlayerEntity(entity) {
    return entity?.isPlayer === true || String(entity?.typeId ?? entity?.id ?? "").toLowerCase() === "minecraft:player";
}

function isPetEntity(entity) {
    if (!entity) return false;
    if (isPlayerEntity(entity)) return true;
    if (entity?.isTamed === true || entity?.isLeashed === true) return true;
    return hasEntityToken(entity, PET_ENTITY_TOKENS);
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

    cleanupTimedEntries(effectCooldowns);
    const cooldown = effectCooldowns.get(getCooldownKey(entity, effect));
    return Number(cooldown?.expiresAt ?? 0) > getCurrentTick();
}

function setEffectCooldown(entity, effect) {
    const cooldownTicks = Math.max(0, Math.floor(Number(effect?.cooldownTicks ?? 0) || 0));
    if (!entity || cooldownTicks <= 0) return;

    effectCooldowns.set(getCooldownKey(entity, effect), {
        expiresAt: getCurrentTick() + cooldownTicks
    });
}

function tryApplyDamage(target, amount, attacker, cause = "entity_attack") {
    if (!target || !hasHealthComponent(target)) return false;

    try {
        markProcDamageTarget(target, 4);
        target.applyDamage?.(amount, {
            cause,
            damagingEntity: attacker,
        });
        return true;
    } catch {
        return false;
    }
}

function formatCommandNumber(value, digits = 3) {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return "0";

    return (Math.round(numeric * (10 ** digits)) / (10 ** digits)).toFixed(digits);
}

function createTemporarySelectorTag(prefix, entity) {
    const base = `${prefix}_${entityKey(entity)}_${getCurrentTick()}`;
    return base.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 120);
}

function addTemporaryTag(entity, tag) {
    if (!entity || !tag || typeof entity.addTag !== "function") return false;

    try {
        entity.addTag(tag);
        return true;
    } catch {
        return false;
    }
}

function removeTemporaryTag(entity, tag) {
    if (!entity || !tag || typeof entity.removeTag !== "function") return;

    try {
        entity.removeTag(tag);
    } catch { }
}

function tryApplyCommandDamage(target, amount, attacker, cause = "entity_attack") {
    if (!target || !hasHealthComponent(target)) return false;

    const damageAmount = Math.max(1, Math.round(Number(amount ?? 0) || 0));
    const location = target.location;
    const origin = attacker?.location ?? location;
    if (!location || !origin) return false;

    const targetTag = createTemporarySelectorTag("statscore_sweep_target", target);
    const attackerTag = attacker ? createTemporarySelectorTag("statscore_sweep_source", attacker) : "";
    const targetSelector = `@e[tag=${targetTag},c=1]`;
    const sourcePosition = attackerTag
        ? `at @e[tag=${attackerTag},c=1]`
        : `positioned ${formatCommandNumber(origin.x)} ${formatCommandNumber(origin.y)} ${formatCommandNumber(origin.z)}`;
    const command = `execute as ${targetSelector} ${sourcePosition} run damage @s ${damageAmount} ${cause} entity @p`;
    let targetTagged = false;
    let attackerTagged = false;

    try {
        markProcDamageTarget(target, 4);
        targetTagged = addTemporaryTag(target, targetTag);
        if (!targetTagged) {
            return tryApplyDamage(target, damageAmount, attacker, cause);
        }

        if (attackerTag) {
            attackerTagged = addTemporaryTag(attacker, attackerTag);
        }

        if (typeof target.dimension?.runCommand === "function") {
            target.dimension.runCommand(command);
            return true;
        }

        if (typeof attacker?.runCommand === "function") {
            attacker.runCommand(`execute ${sourcePosition} run damage ${targetSelector} ${damageAmount} ${cause} entity @p`);
            return true;
        }

        return tryApplyDamage(target, damageAmount, attacker, cause);
    } catch {
        return tryApplyDamage(target, damageAmount, attacker, cause);
    } finally {
        if (attackerTagged) {
            removeTemporaryTag(attacker, attackerTag);
        }

        if (targetTagged) {
            removeTemporaryTag(target, targetTag);
        }
    }
}

function applySweep(attacker, target, effect, finalDamage) {
    if (!attacker || !target || !target.dimension || isEffectOnCooldown(attacker, effect)) return false;

    const radius = Math.max(1.5, Number(effect?.radius ?? 2.5) || 2.5);
    const maxTargets = Math.max(1, Math.floor(Number(effect?.maxTargets ?? 2) || 2));
    const damageScale = Math.max(0.1, Number(effect?.damageScale ?? 0.35) || 0.35);
    const sweepDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    let hits = 0;

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === attacker.id || entity.id === target.id) continue;
        if (!hasHealthComponent(entity)) continue;
        if (isPlayerEntity(entity) || isPetEntity(entity)) continue;

        if (tryApplyCommandDamage(entity, sweepDamage, attacker)) {
            hits++;
        }

        if (hits >= maxTargets) break;
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
    if (bleedProcessorActive) return;
    bleedProcessorActive = true;

    system.runInterval(() => {
        if (bleedStates.size <= 0) return;

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
    const on = String(effect?.on ?? "hit").toLowerCase();
    if (on === "crit" && context?.crit?.active !== true) return false;
    if (on === "marked" && context?.marked !== true) return false;
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

                // After lightning, extinguish fire on nearby players/entities
                for (const ent of attacker.dimension.getEntities({ location: origin, maxDistance: strikeRadius })) {
                    try {
                        if (typeof ent.setOnFire === "function") {
                            ent.setOnFire?.(0, true);
                        }
                    } catch { }
                }

                // Attempt to clear fire blocks in a small area using a safer fill command.
                try {
                    const radius = Math.min(6, Math.max(2, Math.floor(strikeRadius) + 1));
                    if (typeof attacker.dimension.runCommand === "function") {
                        attacker.dimension.runCommand(`fill ~${radius} ~-2 ~${radius} ~-${radius} ~2 ~-${radius} air replace fire`);
                    }
                } catch { }
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
    let applied = 0;

    for (const aspect of aspects) {
        if (applyElementalAspect(attacker, target, aspect, finalDamage)) {
            applied++;
        }
    }

    return applied;
}

function queueAftershockSlowness(target, effect) {
    const levitationDuration = Math.max(1, Math.floor(Number(effect?.levitationDurationTicks ?? 40) || 40));
    const slownessDuration = Math.max(1, Math.floor(Number(effect?.slownessDurationTicks ?? 100) || 100));
    const slownessAmplifier = Math.max(0, Math.floor(Number(effect?.slownessAmplifier ?? 3) || 3));

    system.runTimeout(() => {
        if (!hasHealthComponent(target)) return;
        applyEffectById(target, "slowness", slownessDuration, slownessAmplifier, false);
    }, levitationDuration);
}

function applyAftershock(attacker, target, effect, finalDamage) {
    if (!attacker || !target || !target.dimension || isEffectOnCooldown(attacker, effect)) return false;

    const levitationDuration = Math.max(1, Math.floor(Number(effect?.levitationDurationTicks ?? 40) || 40));
    const levitationAmplifier = Math.max(0, Math.floor(Number(effect?.levitationAmplifier ?? 4) || 4));
    const radius = Math.max(2, Number(effect?.radius ?? 7.5) || 7.5);
    const maxTargets = Math.max(1, Math.floor(Number(effect?.maxTargets ?? 12) || 12));
    const damageScale = Math.max(0.1, Number(effect?.damageScale ?? 0.5) || 0.5);
    const shockDamage = Math.max(1, Number(finalDamage ?? 0) * damageScale);
    let applied = false;
    let hits = 0;

    if (applyEffectById(target, "levitation", levitationDuration, levitationAmplifier, false)) {
        queueAftershockSlowness(target, effect);
        applied = true;
    }

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === attacker.id || entity.id === target.id) continue;
        if (!hasHealthComponent(entity)) continue;

        const hit = tryApplyDamage(entity, shockDamage, attacker);
        const lifted = applyEffectById(entity, "levitation", levitationDuration, levitationAmplifier, false);
        if (lifted) {
            queueAftershockSlowness(entity, effect);
        }

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
    let applied = false;

    for (const entity of target.dimension.getEntities({
        location: target.location,
        maxDistance: radius,
    })) {
        if (!entity || entity.id === attacker.id || entity.id === target.id) continue;
        if (!hasHealthComponent(entity)) continue;
        if (entity.typeId !== target.typeId) continue;

        applied = tryApplyDamage(entity, reapDamage, attacker) || applied;
    }

    return applied;
}

function applyHarpoon(target, attacker, effect) {
    if (!target) return false;
    applyMark(target, attacker, effect);
    return true;
}

function applyDeadeye(target) {
    if (!target?.triggerEvent) return false;

    let applied = false;
    for (const eventId of CALM_EVENT_IDS) {
        try {
            target.triggerEvent(eventId);
            applied = true;
        } catch { }
    }

    return applied;
}

function distanceSquared(left, right) {
    const dx = Number(left?.x ?? 0) - Number(right?.x ?? 0);
    const dy = Number(left?.y ?? 0) - Number(right?.y ?? 0);
    const dz = Number(left?.z ?? 0) - Number(right?.z ?? 0);
    return (dx * dx) + (dy * dy) + (dz * dz);
}

function findNearestUntouchedTarget(current, attacker, visited, range) {
    if (!current?.dimension || !current?.location) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const entity of current.dimension.getEntities({
        location: current.location,
        maxDistance: range,
    })) {
        if (!entity || entity.id === attacker?.id) continue;
        if (!hasHealthComponent(entity)) continue;
        if (visited.has(entity.id)) continue;

        const nextDistance = distanceSquared(current.location, entity.location);
        if (nextDistance >= bestDistance) continue;

        best = entity;
        bestDistance = nextDistance;
    }

    return best;
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
    const visited = new Set([attacker.id, target.id]);
    let current = target;
    let applied = true;

    for (let index = 0; index < maxChains; index++) {
        const nextTarget = findNearestUntouchedTarget(current, attacker, visited, range);
        if (!nextTarget) break;

        visited.add(nextTarget.id);
        current = nextTarget;

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

export function applyCombatEffects({ attacker, target, attributes, crit, finalDamage }) {
    const effects = Array.isArray(attributes?.effects) ? attributes.effects : [];
    if (!target) return 0;

    const marked = Boolean(getMark(target));
    let applied = applyElementalAspects({ attacker, target, attributes, finalDamage });

    if (!effects.length) return applied;

    for (const effect of effects) {
        if (!effect || typeof effect !== "object") continue;
        if (!shouldTriggerEffect(effect, { attacker, target, crit, marked })) continue;

        const targetEntity = effect.target === "attacker" ? attacker : target;
        const kind = String(effect.kind ?? "").toLowerCase();

        if (kind === "passive") {
            continue;
        }

        if (kind === "mark") {
            applyMark(target, attacker, effect);
            applied++;
            continue;
        }

        if (kind === "harpoon") {
            if (applyHarpoon(target, attacker, effect)) applied++;
            continue;
        }

        if (kind === "deadeye") {
            if (applyDeadeye(target)) applied++;
            continue;
        }

        if (kind === "ballista") {
            if (applyBallista(attacker, target, effect, finalDamage)) applied++;
            continue;
        }

        if (kind === "aftershock") {
            if (applyAftershock(attacker, target, effect, finalDamage)) applied++;
            continue;
        }

        if (kind === "reaper") {
            if (applyReaper(attacker, target, effect, finalDamage)) applied++;
            continue;
        }

        if (kind === "sweep") {
            if (applySweep(attacker, target, effect, finalDamage)) applied++;
            continue;
        }

        if (kind === "bleed") {
            if (applyBleed(target, attacker, effect, finalDamage)) applied++;
            continue;
        }

        if (kind === "fire") {
            if (applyFire(targetEntity, effect)) applied++;
            continue;
        }

        if (applyStatusEffect(targetEntity, effect)) {
            applied++;
        }
    }

    return applied;
}

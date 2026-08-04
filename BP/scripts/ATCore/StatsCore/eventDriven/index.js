import { ButtonState, InputButton, system, world } from "@minecraft/server";
import { STATSCORE } from "../constants.js";
import { applyStatsProcDamage, isProcDamageTarget } from "../combat/effects.js";
import { showAbilityFeedback } from "../feedback/index.js";
import { STATSCORE_ICONS } from "../icons.js";
import { getEquipmentStatsContext, getHeldStatsContext } from "../shared/context.js";
import { getEntityHurtAttacker, getEntityHurtTarget, getEventDamageType } from "../shared/damage.js";
import { findEffectByKind } from "../shared/effectSelectors.js";
import { applyEffectById } from "../shared/effects.js";
import { OFFENSIVE_ENTITY_CATEGORIES, effectAppliesToEntity } from "../shared/entityCategories.js";
import { getCurrentTick, rollChance } from "../utils.js";

const adaptiveStates = new Map();
const guardWindows = new Map();
const effectCooldowns = new Map();
const chargeStates = new Map();
const recentShots = new Map();
const projectileProfiles = new Map();
const persistenceStacks = new Map();
const soulCharges = new Map();
const pendingOverheal = new Map();
const blastProtectionWindows = new Map();

function entityKey(entity) {
    return String(entity?.id ?? entity?.name ?? entity?.typeId ?? "unknown");
}

function distance(left, right) {
    const dx = Number(left?.x ?? 0) - Number(right?.x ?? 0);
    const dy = Number(left?.y ?? 0) - Number(right?.y ?? 0);
    const dz = Number(left?.z ?? 0) - Number(right?.z ?? 0);
    return Math.hypot(dx, dy, dz);
}

function cleanupTimedMap(map) {
    const now = getCurrentTick();
    for (const [key, value] of map.entries()) {
        if (Number(value?.expiresAt ?? 0) <= now) map.delete(key);
    }
}

function cleanupEventDrivenState() {
    cleanupTimedMap(adaptiveStates);
    cleanupTimedMap(guardWindows);
    cleanupTimedMap(effectCooldowns);
    cleanupTimedMap(chargeStates);
    cleanupTimedMap(recentShots);
    cleanupTimedMap(projectileProfiles);
    cleanupTimedMap(persistenceStacks);
    cleanupTimedMap(soulCharges);
    cleanupTimedMap(pendingOverheal);
    cleanupTimedMap(blastProtectionWindows);
}

function cooldownKey(entity, kind) {
    return `${entityKey(entity)}:${String(kind ?? "effect").toLowerCase()}`;
}

function isOnCooldown(entity, effect) {
    const key = cooldownKey(entity, effect?.kind ?? effect?.key);
    const entry = effectCooldowns.get(key);
    const now = getCurrentTick();
    if (Number(entry?.expiresAt ?? 0) > now) return true;
    if (entry) effectCooldowns.delete(key);
    return false;
}

function setCooldown(entity, effect) {
    const ticks = Math.max(1, Math.floor(Number(effect?.cooldownTicks ?? 1) || 1));
    effectCooldowns.set(cooldownKey(entity, effect?.kind ?? effect?.key), {
        expiresAt: getCurrentTick() + ticks,
    });
}

function getHealth(entity) {
    try {
        return entity?.getComponent?.("minecraft:health") ?? entity?.getComponent?.("health") ?? null;
    } catch {
        return null;
    }
}

function getHealthValues(entity) {
    const health = getHealth(entity);
    const current = Number(health?.currentValue ?? health?.value ?? 0);
    const max = Number(health?.effectiveMax ?? health?.defaultValue ?? health?.max ?? current);
    return {
        health,
        current: Number.isFinite(current) ? current : 0,
        max: Number.isFinite(max) ? max : 0,
    };
}

function healEntity(entity, amount) {
    const { health, current, max } = getHealthValues(entity);
    if (!health || max <= current || amount <= 0 || typeof health.setCurrentValue !== "function") return false;
    try {
        health.setCurrentValue(Math.min(max, current + amount));
        return true;
    } catch {
        return false;
    }
}

function getArmorEntries(player) {
    const entries = [];
    for (const slotName of [...STATSCORE.slots.armor, STATSCORE.slots.offhand]) {
        const context = getEquipmentStatsContext(player, slotName);
        if (!context || context.attributes?.refinement?.active !== true) continue;
        if (context.definition?.type !== "support") continue;
        entries.push(context);
    }
    return entries;
}

function getSupportEffects(entries, kind) {
    const effects = [];
    for (const entry of entries) {
        const effect = findEffectByKind(entry.attributes?.support?.effects, kind);
        if (effect) effects.push(effect);
    }
    return effects;
}

function firstSupportEffect(entries, kind) {
    return getSupportEffects(entries, kind)[0] ?? null;
}

function combineArmorAttribute(entries, key) {
    return entries
        .map(entry => entry.attributes?.eventDriven?.[key])
        .filter(value => value && typeof value === "object");
}

function deferFeedback(player, label, icon) {
    system.run(() => showAbilityFeedback(player, label, icon));
}

function handlePerfectGuardInput(event) {
    const player = event?.player;
    if (!player || event?.button !== InputButton.Sneak || event?.newButtonState !== ButtonState.Pressed) return;

    const effect = firstSupportEffect(getArmorEntries(player), "perfect_guard");
    if (!effect || isOnCooldown(player, effect)) return;

    guardWindows.set(entityKey(player), {
        expiresAt: getCurrentTick() + Math.max(1, Math.floor(Number(effect.windowTicks ?? 8) || 8)),
    });
}

function applyPerfectGuard(event, target, entries) {
    const effect = firstSupportEffect(entries, "perfect_guard");
    const window = guardWindows.get(entityKey(target));
    if (!effect || !window || Number(window.expiresAt ?? 0) < getCurrentTick() || isOnCooldown(target, effect)) return false;

    guardWindows.delete(entityKey(target));
    setCooldown(target, effect);

    if (rollChance(effect.cancelChance, 0)) {
        event.cancel = true;
    } else {
        const multiplier = Math.max(0, Math.min(1, Number(effect.damageMultiplier ?? 0.2) || 0.2));
        event.damage = Math.max(0, Number(event.damage ?? 0) * multiplier);
    }

    deferFeedback(target, "Perfect Guard", STATSCORE_ICONS.fullArmor);
    return true;
}

function applyAdaptiveResilience(event, target, entries) {
    const profiles = combineArmorAttribute(entries, "adaptiveResilience");
    if (!profiles.length) return;

    const key = entityKey(target);
    const now = getCurrentTick();
    const damageType = getEventDamageType(event);
    const cached = adaptiveStates.get(key);
    const previous = Number(cached?.expiresAt ?? 0) > now ? cached : null;
    if (cached && !previous) adaptiveStates.delete(key);
    const sameType = previous?.damageType === damageType;
    const maxStacks = Math.max(...profiles.map(value => Number(value.maxStacks ?? 1) || 1));
    const stacks = sameType ? Math.min(maxStacks, Math.max(1, Number(previous?.stacks ?? 1) || 1)) : 1;
    const reductionPerStack = profiles.reduce((sum, value) => sum + Math.max(0, Number(value.reductionPerStack ?? 0) || 0), 0);
    const reduction = Math.min(0.45, reductionPerStack * stacks);

    if (reduction > 0) {
        event.damage = Math.max(0, Number(event.damage ?? 0) * (1 - reduction));
    }

    const durationTicks = Math.max(...profiles.map(value => Number(value.durationTicks ?? 100) || 100));
    adaptiveStates.set(key, {
        damageType,
        stacks: Math.min(maxStacks, stacks + 1),
        expiresAt: now + durationTicks,
    });

    if (stacks > 1) {
        deferFeedback(target, `Adaptive Resilience x${stacks}`, STATSCORE_ICONS.damageReduction);
    }
}

function applyBlastDamageWard(event, target, entries) {
    const effect = firstSupportEffect(entries, "blast_ward");
    if (!effect) return;

    const protectedWindow = blastProtectionWindows.get(entityKey(target));
    const protectedByBlockWard = Number(protectedWindow?.expiresAt ?? 0) > getCurrentTick();
    if (!protectedByBlockWard && isOnCooldown(target, effect)) return;

    const reduction = Math.max(0, Math.min(0.95, Number(effect.damageReduction ?? 0.5) || 0.5));
    event.damage = Math.max(0, Number(event.damage ?? 0) * (1 - reduction));
    if (!protectedByBlockWard) setCooldown(target, effect);
    deferFeedback(target, "Blast Ward", STATSCORE_ICONS.fullArmor);
}

function getRecentShot(attacker) {
    const key = entityKey(attacker);
    const recent = recentShots.get(key);
    if (Number(recent?.expiresAt ?? 0) > getCurrentTick()) return recent;
    if (recent) recentShots.delete(key);
    return null;
}

function getProjectileShotProfile(projectile, attacker) {
    const projectileId = entityKey(projectile);
    const existing = projectileProfiles.get(projectileId);
    if (Number(existing?.expiresAt ?? 0) > getCurrentTick()) return existing;
    if (existing) projectileProfiles.delete(projectileId);

    const recent = getRecentShot(attacker);
    const context = recent?.attributes ? null : getHeldStatsContext(attacker);
    const attributes = recent?.attributes ?? context?.attributes;
    if (!attributes) return null;

    const profile = {
        attributes,
        origin: recent?.origin ?? { ...attacker.location },
        chargeRatio: Math.max(0, Math.min(1, Number(recent?.chargeRatio ?? 0) || 0)),
        overcharge: recent?.overcharge === true,
        lastDamage: Number(recent?.lastDamage ?? 0) || 0,
        weaponKey: recent?.weaponKey ?? context?.state?.uid ?? context?.stack?.typeId ?? "projectile",
        branch: recent?.branch ?? context?.definition?.branch ?? "",
        expiresAt: getCurrentTick() + 200,
    };
    projectileProfiles.set(projectileId, profile);
    return profile;
}

function getProjectileOwner(projectile) {
    if (!projectile) return null;
    try {
        return projectile.getComponent?.("minecraft:projectile")?.owner
            ?? projectile.getComponent?.("projectile")?.owner
            ?? null;
    } catch {
        return null;
    }
}

function applyPersistence(attacker, target, shot, persistence) {
    if (!attacker || !target || !persistence) return 0;

    const key = `${entityKey(attacker)}:${String(shot?.weaponKey ?? "projectile")}:${entityKey(target)}`;
    const now = getCurrentTick();
    const cached = persistenceStacks.get(key);
    const previous = Number(cached?.expiresAt ?? 0) > now ? cached : null;
    const stacks = Math.max(1, Math.floor(Number(previous?.stacks ?? 0) || 0) + 1);
    const perHit = Math.max(0, Number(persistence.bonusPerHit ?? 0.025) || 0.025);
    const maxBonus = Math.max(0, Number(persistence.maxBonus ?? 0.5) || 0.5);
    const bonus = Math.min(maxBonus, stacks * perHit);
    persistenceStacks.set(key, {
        stacks,
        expiresAt: now + Math.max(20, Math.floor(Number(persistence.resetTicks ?? 200) || 200)),
    });
    return bonus;
}

function queueWindCharge(target) {
    if (!target?.dimension || !target?.location) return;
    const location = { ...target.location };
    const dimension = target.dimension;
    system.run(() => {
        try {
            dimension.spawnEntity?.("minecraft:wind_charge", location);
        } catch { }
    });
}

function applyProjectileAttributes(event, attacker, target) {
    const projectile = event?.damageSource?.damagingProjectile ?? event?.damagingProjectile;
    if (!projectile) return;

    const shot = getProjectileShotProfile(projectile, attacker);
    const attributes = shot?.attributes;
    if (!attributes?.eventDriven) return;

    const charge = attributes.eventDriven.chargeMastery;
    const persistence = attributes.eventDriven.persistence;
    let bonus = 0;

    if (charge) {
        bonus += Math.max(0, Number(charge.maxDamageBonus ?? 0) || 0)
            * Math.max(0, Math.min(1, Number(shot?.chargeRatio ?? 0) || 0));
    }
    if (persistence) {
        bonus += applyPersistence(attacker, target, shot, persistence);
    }

    if (bonus > 0) {
        event.damage = Math.max(0, Number(event.damage ?? 0) * (1 + bonus));
        deferFeedback(attacker, `Persistence +${Math.round(bonus * 100)}%`, STATSCORE_ICONS.sword);
    }
    if (charge) queueWindCharge(target);
    if (shot) shot.lastDamage = Math.max(0, Number(event.damage ?? 0) || 0);
}

function consumeSoulCollector(event, attacker, attributes) {
    const effect = findEffectByKind(attributes?.effects, "soul_collector");
    const key = entityKey(attacker);
    const state = soulCharges.get(key);
    if (!effect || !state || Number(state.expiresAt ?? 0) <= getCurrentTick()) return;

    const maxCharges = Math.max(1, Math.floor(Number(effect.maxCharges ?? 5) || 5));
    const charges = Math.min(maxCharges, Math.max(0, Math.floor(Number(state.charges ?? 0) || 0)));
    // Soul Collector is a full-charge payoff. Keeping partial charges makes
    // the ability predictable and gives players a meaningful burst to plan for.
    if (charges < maxCharges) return;

    const damageBonus = Math.max(0, Number(effect.damagePerCharge ?? 0) || 0) * charges;
    event.damage = Math.max(0, Number(event.damage ?? 0) * (1 + damageBonus));
    soulCharges.delete(key);

    const healAmount = Math.max(0, Number(effect.healPerCharge ?? 0) || 0) * charges;
    const target = getEntityHurtTarget(event);
    system.run(() => {
        healEntity(attacker, healAmount);
        spawnSoulCollectorBurst(target, attacker);
        showAbilityFeedback(attacker, `Soul Collector x${charges}`, STATSCORE_ICONS.soul);
    });
}

function getValidParticleAnchor(...entities) {
    for (const entity of entities) {
        try {
            if (entity?.isValid === false || !entity?.dimension || !entity?.location) continue;
            return entity;
        } catch { }
    }

    return null;
}

function spawnSoulCollectorBurst(target, attacker) {
    // The struck entity can already be invalid when a full Soul Collector
    // discharge kills it. In that case emit the effect from the wielder.
    const entity = getValidParticleAnchor(target, attacker);
    if (!entity) return false;

    const location = {
        x: Number(entity.location.x ?? 0),
        y: Number(entity.location.y ?? 0) + 0.8,
        z: Number(entity.location.z ?? 0),
    };
    let spawned = false;
    // Do not treat a successful API call as proof that a custom particle was
    // rendered: Bedrock can silently discard an unavailable identifier. The
    // two vanilla emitters therefore always accompany the custom soul burst.
    for (const particleId of [
        "ascendant:soul_harvester",
        "ascendant:soul_harvester_blast",
        "minecraft:totem_particle",
        "minecraft:critical_hit_emitter",
    ]) {
        try {
            entity.dimension.spawnParticle?.(particleId, location);
            spawned = true;
        } catch { }
    }

    try {
        entity.dimension.playSound?.("ascendant.statscore.soul_explosion", location, { volume: 0.85, pitch: 1 });
    } catch { }

    return spawned;
}

function applyGuardWorm(event, player) {
    const context = getHeldStatsContext(player);
    const effect = findEffectByKind(context?.attributes?.mining?.effects, "worm");
    if (!effect) return;

    const reduction = Math.max(0, Math.min(0.95, Number(effect.damageReduction ?? 0.4) || 0.4));
    event.damage = Math.max(0, Number(event.damage ?? 0) * (1 - reduction));
    deferFeedback(player, "Guard Worm", STATSCORE_ICONS.pickaxe);
}

function handleEntityHurtBefore(event) {
    if (event?.cancel === true) return;

    const target = getEntityHurtTarget(event);
    if (!target) return;

    if (target.typeId === "minecraft:player") {
        applyGuardWorm(event, target);
        const entries = getArmorEntries(target);
        if (applyPerfectGuard(event, target, entries) || event.cancel === true) return;

        const damageType = getEventDamageType(event);
        if (damageType === "block_explosion" || damageType === "entity_explosion") {
            applyBlastDamageWard(event, target, entries);
        }
        applyAdaptiveResilience(event, target, entries);
    }

    if (isProcDamageTarget(target)) return;
    const attacker = getEntityHurtAttacker(event);
    if (!attacker || attacker.id === target.id) return;

    applyProjectileAttributes(event, attacker, target);
    const context = getHeldStatsContext(attacker);
    if (context) consumeSoulCollector(event, attacker, context.attributes);
}

function handleHealBefore(event) {
    const player = event?.healedEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    const profiles = combineArmorAttribute(getArmorEntries(player), "healingEfficiency");
    if (!profiles.length) return;

    const bonus = Math.min(0.25, profiles.reduce((sum, value) => sum + Math.max(0, Number(value.bonus ?? 0) || 0), 0));
    const baseHealing = Math.max(0, Number(event.healing ?? 0) || 0);
    const boostedHealing = baseHealing * (1 + bonus);
    event.healing = boostedHealing;

    const { current, max } = getHealthValues(player);
    const excess = Math.max(0, current + boostedHealing - max);
    if (excess <= 0) return;

    pendingOverheal.set(entityKey(player), {
        excess,
        durationTicks: Math.max(...profiles.map(value => Number(value.overhealAbsorptionDurationTicks ?? 100) || 100)),
        expiresAt: getCurrentTick() + 4,
    });
}

function handleHealAfter(event) {
    const player = event?.healedEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    const pending = pendingOverheal.get(entityKey(player));
    if (!pending || Number(pending.expiresAt ?? 0) < getCurrentTick()) return;
    pendingOverheal.delete(entityKey(player));

    const amplifier = Math.max(0, Math.min(3, Math.ceil(Number(pending.excess ?? 0) / 4) - 1));
    applyEffectById(player, "absorption", Math.max(20, Math.floor(Number(pending.durationTicks ?? 100))), amplifier, false);
    showAbilityFeedback(player, "Healing Efficiency", STATSCORE_ICONS.healedHeart);
}

function getEventItemContext(player, itemStack) {
    const expectedTypeId = itemStack?.typeId;
    return getHeldStatsContext(player, expectedTypeId) ?? getHeldStatsContext(player);
}

function isProjectileStatsContext(context) {
    const attributes = context?.attributes;
    if (!attributes) return false;
    if (attributes.eventDriven?.chargeMastery || attributes.eventDriven?.persistence) return true;
    return Boolean(findEffectByKind(attributes.effects, "overcharge"));
}

function storeShotProfile(event, completed = false) {
    const player = event?.source;
    if (!player || player.typeId !== "minecraft:player") return;

    const context = getEventItemContext(player, event?.itemStack);
    if (!isProjectileStatsContext(context)) return;

    const key = entityKey(player);
    const start = chargeStates.get(key);
    const previousShot = recentShots.get(key);
    const fullChargeTicks = Math.max(1, Number(context.attributes.eventDriven?.chargeMastery?.fullChargeTicks ?? 20) || 20);
    const heldTicks = Math.max(0, getCurrentTick() - Number(start?.startedAt ?? getCurrentTick()));
    const chargeRatio = completed
        ? 1
        : start
            ? Math.max(0, Math.min(1, heldTicks / fullChargeTicks))
            : Math.max(0, Math.min(1, Number(previousShot?.chargeRatio ?? 0) || 0));
    const overcharge = completed
        || chargeRatio >= 0.98
        || start?.completed === true
        || (!start && previousShot?.overcharge === true);

    recentShots.set(key, {
        attributes: context.attributes,
        origin: start?.origin ?? previousShot?.origin ?? { ...player.location },
        chargeRatio,
        overcharge,
        weaponKey: context.state?.uid ?? context.stack?.typeId ?? "projectile",
        branch: context.definition?.branch ?? "",
        expiresAt: getCurrentTick() + 100,
    });

    chargeStates.delete(key);
}

function handleItemStartUse(event) {
    const player = event?.source;
    const context = getEventItemContext(player, event?.itemStack);
    if (!player || !isProjectileStatsContext(context)) return;

    chargeStates.set(entityKey(player), {
        startedAt: getCurrentTick(),
        origin: { ...player.location },
        completed: false,
        expiresAt: getCurrentTick() + 1200,
    });
}

function activateHarpoonCharge(player, context) {
    const effect = findEffectByKind(context?.attributes?.effects, "harpoon");
    if (!player || !effect || isOnCooldown(player, effect)) return;

    try {
        const direction = player.getViewDirection?.();
        if (!direction) return;
        player.applyImpulse?.({
            x: Number(direction.x ?? 0) * Math.max(0.2, Number(effect.loyaltyBoostStrength ?? 2.15) * 0.32),
            y: Math.max(0.08, Number(direction.y ?? 0) * 0.25),
            z: Number(direction.z ?? 0) * Math.max(0.2, Number(effect.loyaltyBoostStrength ?? 2.15) * 0.32),
        });
        applyEffectById(player, "slow_falling", Math.max(20, Number(effect.fallGraceTicks ?? 60) || 60), 0, false);
        setCooldown(player, effect);
        showAbilityFeedback(player, "Harpoon", STATSCORE_ICONS.sword);
    } catch { }
}

function handleItemCompleteUse(event) {
    const player = event?.source;
    const context = getEventItemContext(player, event?.itemStack);
    if (!player || !isProjectileStatsContext(context)) return;

    const key = entityKey(player);
    const start = chargeStates.get(key) ?? { startedAt: getCurrentTick() };
    chargeStates.set(key, {
        ...start,
        completed: true,
        expiresAt: getCurrentTick() + 20,
    });
    storeShotProfile(event, true);

    activateHarpoonCharge(player, context);

    const overcharge = findEffectByKind(context.attributes?.effects, "overcharge");
    if (overcharge) showAbilityFeedback(player, "Overcharge Ready", STATSCORE_ICONS.lightning);
}

function handleItemReleaseUse(event) {
    storeShotProfile(event, false);
}

function handleItemStopUse(event) {
    storeShotProfile(event, false);
}

function applyOverchargeBurst(event, centerTarget = null) {
    const attacker = event?.source;
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const projectile = event?.projectile ?? event?.damageSource?.damagingProjectile;
    const shot = projectile
        ? getProjectileShotProfile(projectile, attacker)
        : getRecentShot(attacker);
    if (!shot?.overcharge) return;

    const effect = findEffectByKind(shot.attributes?.effects, "overcharge");
    if (!effect || isOnCooldown(attacker, effect)) return;

    const dimension = event?.dimension ?? centerTarget?.dimension;
    const location = centerTarget?.location ?? event?.location;
    if (!dimension || !location) return;

    const radius = Math.max(1, Number(effect.radius ?? 3.5) || 3.5);
    const damage = Math.max(1, Number(shot.lastDamage ?? 4) * Math.max(0.1, Number(effect.damageScale ?? 0.4) || 0.4));
    let applied = false;

    for (const entity of dimension.getEntities({ location, maxDistance: radius })) {
        if (!entity || entity.id === attacker.id || entity.id === event?.projectile?.id) continue;
        if (!effectAppliesToEntity(effect, entity, OFFENSIVE_ENTITY_CATEGORIES)) continue;
        if (applyStatsProcDamage(entity, damage, attacker, "magic")) {
            try {
                entity.setOnFire?.(Math.max(1, Math.floor(Number(effect.fireSeconds ?? 2) || 2)), true);
            } catch { }
            applied = true;
        }
    }

    shot.overcharge = false;
    if (!applied) return;
    setCooldown(attacker, effect);
    showAbilityFeedback(attacker, "Overcharge", STATSCORE_ICONS.lightning);
}

function handleProjectileHitEntity(event) {
    let target = null;
    try {
        target = event?.getEntityHit?.()?.entity ?? null;
    } catch { }
    applyOverchargeBurst(event, target);
}

function handleProjectileHitBlock(event) {
    applyOverchargeBurst(event, null);
}

function handleEntityDie(event) {
    const projectile = event?.damageSource?.damagingProjectile;
    const attacker = event?.damageSource?.damagingEntity
        ?? event?.damagingEntity
        ?? getProjectileOwner(projectile);
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const shot = projectile
        ? projectileProfiles.get(entityKey(projectile)) ?? getRecentShot(attacker)
        : getRecentShot(attacker);
    const context = shot?.attributes ? null : getHeldStatsContext(attacker);
    const attributes = shot?.attributes ?? context?.attributes;
    const effect = findEffectByKind(attributes?.effects, "soul_collector");
    if (!effect) return;

    const key = entityKey(attacker);
    const previous = soulCharges.get(key);
    const maxCharges = Math.max(1, Math.floor(Number(effect.maxCharges ?? 5) || 5));
    const branch = String(shot?.branch ?? context?.definition?.branch ?? "").toLowerCase();
    const gainedCharges = branch === "hoe" ? 2 : 1;
    const charges = Math.min(maxCharges, Math.max(0, Number(previous?.charges ?? 0) || 0) + gainedCharges);
    soulCharges.set(key, {
        charges,
        expiresAt: getCurrentTick() + Math.max(20, Math.floor(Number(effect.durationTicks ?? 600) || 600)),
    });
    showAbilityFeedback(attacker, `Soul Collector ${charges}/${maxCharges}`, STATSCORE_ICONS.soul);
}

function handleItemPickup(event) {
    const player = event?.entity;
    if (!player || player.typeId !== "minecraft:player") return;

    const context = getHeldStatsContext(player);
    const scavenging = context?.attributes?.eventDriven?.scavenging;
    if (!scavenging || !rollChance(scavenging.chance, 0)) return;

    const itemCount = (event?.items ?? []).reduce((sum, item) => sum + Math.max(1, Number(item?.amount ?? 1) || 1), 0);
    const xp = Math.max(1, Math.floor(Number(scavenging.xpAmount ?? 1) || 1) + Math.floor(itemCount / 8));
    try {
        player.addExperience?.(xp);
    } catch { }
    healEntity(player, Math.max(0, Number(scavenging.healAmount ?? 0) || 0));
    showAbilityFeedback(player, `Scavenging +${xp} XP`, STATSCORE_ICONS.scavenger);
}

function handleExplosionBefore(event) {
    const impacted = (() => {
        try {
            return event?.getImpactedBlocks?.() ?? [];
        } catch {
            return [];
        }
    })();
    if (!event?.dimension || impacted.length <= 0) return;

    const protectedPlayers = [];
    for (const player of world.getPlayers?.() ?? []) {
        if (player.dimension?.id !== event.dimension.id) continue;
        const effect = firstSupportEffect(getArmorEntries(player), "blast_ward");
        if (!effect || isOnCooldown(player, effect)) continue;

        const radius = Math.max(1, Number(effect.protectionRadius ?? 4) || 4);
        if (!impacted.some(block => distance(block?.location, player.location) <= radius)) continue;
        protectedPlayers.push({ player, effect, radius });
    }
    if (!protectedPlayers.length) return;

    const filtered = impacted.filter(block => {
        return !protectedPlayers.some(({ player, radius }) => distance(block?.location, player.location) <= radius);
    });
    try {
        event.setImpactedBlocks(filtered);
    } catch {
        return;
    }

    for (const { player, effect } of protectedPlayers) {
        setCooldown(player, effect);
        blastProtectionWindows.set(entityKey(player), { expiresAt: getCurrentTick() + 5 });
        deferFeedback(player, "Blast Ward", STATSCORE_ICONS.fullArmor);
    }
}

function handleDimensionChange(event) {
    const player = event?.player;
    if (!player) return;

    const entries = getArmorEntries(player);
    const attunements = combineArmorAttribute(entries, "dimensionalAttunement");
    if (attunements.length > 0) {
        const duration = Math.max(...attunements.map(value => Number(value.durationTicks ?? 100) || 100));
        const amplifier = Math.max(...attunements.map(value => Number(value.amplifier ?? 0) || 0));
        const dimensionId = String(event?.toDimension?.id ?? player.dimension?.id ?? "").toLowerCase();
        const effectId = dimensionId.includes("nether")
            ? "fire_resistance"
            : dimensionId.includes("the_end") || dimensionId.endsWith(":end")
                ? "slow_falling"
                : "regeneration";
        applyEffectById(player, effectId, duration, amplifier, false);
        showAbilityFeedback(player, "Dimensional Attunement", STATSCORE_ICONS.darkness);
    }

    const phaseStep = firstSupportEffect(entries, "phase_step");
    if (!phaseStep || isOnCooldown(player, phaseStep)) return;
    setCooldown(player, phaseStep);

    applyEffectById(
        player,
        "speed",
        Math.max(20, Math.floor(Number(phaseStep.durationTicks ?? 100) || 100)),
        Math.max(0, Math.floor(Number(phaseStep.speedAmplifier ?? 0) || 0)),
        false
    );
    applyEffectById(
        player,
        "resistance",
        Math.max(20, Math.floor(Number(phaseStep.durationTicks ?? 100) || 100)),
        Math.max(0, Math.floor(Number(phaseStep.resistanceAmplifier ?? 0) || 0)),
        false
    );
    try {
        const direction = player.getViewDirection?.();
        if (direction) {
            player.applyImpulse?.({ x: direction.x * 0.7, y: Math.max(0.08, direction.y * 0.2), z: direction.z * 0.7 });
        }
    } catch { }
    showAbilityFeedback(player, "Phase Step", STATSCORE_ICONS.walkingSpeed);
}

export function initializeEventDrivenStatsModule() {
    if (globalThis.__statsCoreEventDrivenInitialized) return;
    globalThis.__statsCoreEventDrivenInitialized = true;

    system.runInterval(cleanupEventDrivenState, 200);

    world.afterEvents?.playerButtonInput?.subscribe?.(handlePerfectGuardInput);
    world.beforeEvents?.entityHurt?.subscribe?.(handleEntityHurtBefore);
    world.beforeEvents?.entityHeal?.subscribe?.(handleHealBefore);
    world.afterEvents?.entityHeal?.subscribe?.(handleHealAfter);
    world.afterEvents?.itemStartUse?.subscribe?.(handleItemStartUse);
    world.afterEvents?.itemCompleteUse?.subscribe?.(handleItemCompleteUse);
    world.afterEvents?.itemReleaseUse?.subscribe?.(handleItemReleaseUse);
    world.afterEvents?.itemStopUse?.subscribe?.(handleItemStopUse);
    world.afterEvents?.projectileHitEntity?.subscribe?.(handleProjectileHitEntity);
    world.afterEvents?.projectileHitBlock?.subscribe?.(handleProjectileHitBlock);
    world.afterEvents?.entityDie?.subscribe?.(handleEntityDie);
    world.afterEvents?.entityItemPickup?.subscribe?.(handleItemPickup);
    world.beforeEvents?.explosion?.subscribe?.(handleExplosionBefore);
    world.afterEvents?.playerDimensionChange?.subscribe?.(handleDimensionChange);
}

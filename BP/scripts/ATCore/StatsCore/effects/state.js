import { system, world } from "@minecraft/server";
import {
    getStatsCoreEffectDefinition,
    normalizeStatsCoreEffectId,
} from "./catalog.js";
import {
    initializeStatsCoreEffectsBridge,
    publishStatsCoreEffects,
} from "./insightBridge.js";

const CLEANUP_INTERVAL_TICKS = 20;
const INSIGHT_RESYNC_INTERVAL_TICKS = 40;
const MAX_EFFECT_LEVEL = 20;
const DEFAULT_EFFECT_SOURCE = "gameplay";

const statesByEntity = new Map();
let sequence = 0;
let initialized = false;

function entityKey(entity) {
    return String(entity?.id ?? "");
}

function normalizeEffectSource(value) {
    const source = String(value ?? DEFAULT_EFFECT_SOURCE)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "_")
        .slice(0, 48);
    return source || DEFAULT_EFFECT_SOURCE;
}

function effectKey(effectId, source = DEFAULT_EFFECT_SOURCE) {
    const id = normalizeStatsCoreEffectId(effectId);
    return id ? `${normalizeEffectSource(source)}:${id}` : "";
}

function sanitizeText(value, maxLength = 48) {
    return String(value ?? "")
        .replace(/§.?/g, "")
        .replace(/[\r\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

function ensureEntityState(entity) {
    const key = entityKey(entity);
    if (!key) return undefined;
    if (!statesByEntity.has(key)) {
        statesByEntity.set(key, {
            entity,
            effects: new Map(),
            dirty: true,
            lastInsightSyncTick: -Infinity,
        });
    }
    const state = statesByEntity.get(key);
    state.entity = entity;
    return state;
}

function resolveExpiresAt(effect) {
    if (effect?.persistent === true && effect?.expiresAtTick == null) {
        return Infinity;
    }
    if (Object.prototype.hasOwnProperty.call(effect, "expiresAtTick")) {
        const absolute = Math.floor(Number(effect.expiresAtTick));
        return Number.isFinite(absolute) && absolute > system.currentTick
            ? absolute
            : undefined;
    }

    const durationSource = effect?.durationTicks
        ?? effect?.remainingTicks
        ?? effect?.duration;
    if (durationSource !== undefined) {
        const duration = Math.floor(Number(durationSource));
        return Number.isFinite(duration) && duration > 0
            ? system.currentTick + duration
            : undefined;
    }

    return effect?.persistent === true ? Infinity : undefined;
}

function normalizeEffect(effect, source, existing) {
    if (!effect || typeof effect !== "object") return undefined;
    const id = normalizeStatsCoreEffectId(effect.id ?? effect.key ?? effect.kind);
    const definition = getStatsCoreEffectDefinition(id);
    if (!id || !definition) return undefined;

    const expiresAtTick = resolveExpiresAt(effect);
    if (expiresAtTick === undefined) return undefined;

    const polarity = ["buff", "debuff", "neutral"].includes(
        String(effect.polarity ?? definition.polarity).toLowerCase(),
    )
        ? String(effect.polarity ?? definition.polarity).toLowerCase()
        : definition.polarity;
    const requestedDisplayMode = String(
        effect.displayMode
            ?? effect.display?.mode
            ?? existing?.displayMode
            ?? definition.displayMode
            ?? "duration",
    ).trim().toLowerCase();
    const maxCharges = Math.max(0, Math.floor(Number(
        effect.maxCharges
            ?? effect.display?.max
            ?? existing?.maxCharges
            ?? definition.maxCharges
            ?? 0,
    ) || 0));
    const displayMode = requestedDisplayMode === "charges" && maxCharges > 0
        ? "charges"
        : "duration";
    const currentCharges = displayMode === "charges"
        ? Math.min(maxCharges, Math.max(0, Math.floor(Number(
            effect.currentCharges
                ?? effect.charges
                ?? effect.display?.current
                ?? effect.level
                ?? existing?.currentCharges
                ?? 0,
        ) || 0)))
        : 0;

    return {
        id,
        key: effectKey(id, source),
        source,
        name: sanitizeText(effect.name ?? definition.name),
        polarity,
        icon: sanitizeText(effect.icon ?? definition.icon, 32),
        glyph: sanitizeText(effect.glyph ?? definition.glyph, 4),
        level: Math.max(
            1,
            Math.min(MAX_EFFECT_LEVEL, Math.floor(Number(
                effect.level ?? effect.stacks,
            ) || 1)),
        ),
        order: Number.isFinite(Number(effect.order))
            ? Number(effect.order)
            : definition.order,
        expiresAtTick,
        displayMode,
        currentCharges,
        maxCharges: displayMode === "charges" ? maxCharges : 0,
        data: effect.data ?? existing?.data,
        appliedAtTick: existing?.appliedAtTick ?? system.currentTick,
        lastParticleTick: existing?.lastParticleTick ?? -Infinity,
        sequence: existing?.sequence ?? sequence++,
    };
}

function activeEffects(state) {
    const now = system.currentTick;
    for (const [id, effect] of state.effects) {
        if (Number.isFinite(effect.expiresAtTick) && effect.expiresAtTick <= now) {
            state.effects.delete(id);
            state.dirty = true;
        }
    }
    return [...state.effects.values()].sort((left, right) =>
        left.order - right.order
        || left.sequence - right.sequence
        || left.name.localeCompare(right.name)
    );
}

function toPublicEffect(effect) {
    return {
        id: effect.id,
        name: effect.name,
        polarity: effect.polarity,
        icon: effect.icon,
        glyph: effect.glyph,
        level: effect.level,
        order: effect.order,
        expiresAtTick: Number.isFinite(effect.expiresAtTick)
            ? effect.expiresAtTick
            : null,
        persistent: !Number.isFinite(effect.expiresAtTick),
        displayMode: effect.displayMode,
        currentCharges: effect.currentCharges,
        maxCharges: effect.maxCharges,
    };
}

function collapseEffectsForDisplay(effects) {
    const byId = new Map();
    for (const effect of effects) {
        const existing = byId.get(effect.id);
        if (!existing) {
            byId.set(effect.id, { ...effect });
            continue;
        }

        const existingExpiry = Number.isFinite(existing.expiresAtTick)
            ? existing.expiresAtTick
            : Infinity;
        const nextExpiry = Number.isFinite(effect.expiresAtTick)
            ? effect.expiresAtTick
            : Infinity;
        const longer = nextExpiry > existingExpiry ? effect : existing;
        byId.set(effect.id, {
            ...longer,
            level: Math.max(existing.level, effect.level),
            order: Math.min(existing.order, effect.order),
            sequence: Math.min(existing.sequence, effect.sequence),
            expiresAtTick: Math.max(existingExpiry, nextExpiry),
        });
    }

    return [...byId.values()].sort((left, right) =>
        left.order - right.order
        || left.sequence - right.sequence
        || left.name.localeCompare(right.name)
    );
}

function syncState(state, forceInsight = false) {
    const effects = activeEffects(state);
    const displayedEffects = collapseEffectsForDisplay(effects);

    const insightSyncDue = forceInsight
        || state.dirty
        || system.currentTick - state.lastInsightSyncTick >= INSIGHT_RESYNC_INTERVAL_TICKS;
    let insightSynced = true;
    if (insightSyncDue) {
        insightSynced = publishStatsCoreEffects(
            state.entity,
            displayedEffects.map(toPublicEffect),
        );
        if (insightSynced) state.lastInsightSyncTick = system.currentTick;
    }
    state.dirty = !insightSynced;
    return effects;
}

export function upsertStatsCoreEffect(entity, effect) {
    const state = ensureEntityState(entity);
    if (!state) return false;

    const id = normalizeStatsCoreEffectId(effect?.id ?? effect?.key ?? effect?.kind);
    const source = normalizeEffectSource(effect?.source);
    const key = effectKey(id, source);
    const normalized = normalizeEffect(effect, source, state.effects.get(key));
    if (!normalized) {
        if (key && state.effects.delete(key)) {
            state.dirty = true;
            syncState(state, true);
        }
        return false;
    }

    state.effects.set(normalized.key, normalized);
    state.dirty = true;
    syncState(state, true);
    return true;
}

export function getStatsCoreEffect(
    entity,
    effectId,
    source = DEFAULT_EFFECT_SOURCE,
) {
    const state = statesByEntity.get(entityKey(entity));
    if (!state) return undefined;
    state.entity = entity;
    activeEffects(state);
    if (state.dirty) syncState(state);
    return state.effects.get(effectKey(effectId, source));
}

export function getStatsCoreEffects(entity) {
    const state = statesByEntity.get(entityKey(entity));
    if (!state) return [];
    state.entity = entity;
    return activeEffects(state).map((effect) => ({
        ...toPublicEffect(effect),
        key: effect.key,
        source: effect.source,
        data: effect.data,
    }));
}

export function removeStatsCoreEffect(
    entity,
    effectId,
    source = DEFAULT_EFFECT_SOURCE,
) {
    const state = statesByEntity.get(entityKey(entity));
    if (!state) return false;
    state.entity = entity;
    const removed = state.effects.delete(effectKey(effectId, source));
    if (removed) {
        state.dirty = true;
        syncState(state, true);
    }
    return removed;
}

export function clearStatsCoreEffects(entity) {
    const key = entityKey(entity);
    const state = statesByEntity.get(key);
    if (state) {
        state.entity = entity;
        state.effects.clear();
        state.dirty = true;
        syncState(state, true);
        if (!state.dirty) statesByEntity.delete(key);
    }
    return true;
}

function cleanupStates() {
    for (const [key, state] of statesByEntity) {
        const effects = syncState(state);
        if (!effects.length && !state.dirty) statesByEntity.delete(key);
    }
}

function emitPersistentEffectParticles() {
    const now = system.currentTick;
    for (const state of statesByEntity.values()) {
        const entity = state?.entity;
        if (!entity || entity.typeId === "minecraft:player") continue;

        for (const effect of activeEffects(state)) {
            if (effect.id !== "marked") continue;
            if (now - Number(effect.appliedAtTick ?? now) < 20) continue;
            if (now - Number(effect.lastParticleTick ?? -Infinity) < 2) continue;

            try {
                entity.dimension?.spawnParticle?.(
                    "ascendant_technology:marked_particle",
                    {
                        x: Number(entity.location?.x ?? 0),
                        y: Number(entity.location?.y ?? 0) + 2.5,
                        z: Number(entity.location?.z ?? 0),
                    },
                );
                effect.lastParticleTick = now;
            } catch { }
        }
    }
}

export function initializeStatsCoreEffects() {
    if (initialized) return;
    initialized = true;

    initializeStatsCoreEffectsBridge();
    system.runInterval(cleanupStates, CLEANUP_INTERVAL_TICKS);
    system.runInterval(emitPersistentEffectParticles, 2);

    world.afterEvents.entityDie.subscribe((event) => {
        clearStatsCoreEffects(event.deadEntity);
    });
    world.afterEvents.playerLeave.subscribe((event) => {
        statesByEntity.delete(event.playerId);
    });
    world.afterEvents.playerSpawn.subscribe((event) => {
        if (!event.initialSpawn) return;
        system.run(() => clearStatsCoreEffects(event.player));
    });
}

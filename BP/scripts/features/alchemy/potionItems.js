import { MolangVariableMap, system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { ALCHEMY_POTION_COMPONENTS, potionEffects } from "../../config/alchemy.js";
import { readPotion, potionSignature } from "../../ATCore/alchemy/potions.js";
import { applyStatsCorePotionEffect } from "../../ATCore/StatsCore/effects/potions.js";
import { getPotionPresentation } from "../../ATCore/alchemy/presentation.js";

const PROJECTILE = "utilitycraft:alchemical_potion_projectile";
const CLOUD = "utilitycraft:alchemical_potion_cloud";
const PAYLOAD = "ascendant:alchemy_payload";
const clouds = new Map();

// Slow the vanilla arc in time while retaining its approximate spatial path.
// Velocity scales linearly, gravity quadratically, and drag exponentially.
const FLIGHT_TIME_SCALE = 0.6;
const THROW_SPEED = 0.5 * FLIGHT_TIME_SCALE;
const THROW_GRAVITY = 0.05 * FLIGHT_TIME_SCALE ** 2;
const THROW_AIR_INERTIA = 0.99 ** FLIGHT_TIME_SCALE;
const THROW_ANGLE = 20 * Math.PI / 180;

// Bedrock requires minecraft:food on every item using an onConsume handler.
DoriosLib.registry.itemComponent(ALCHEMY_POTION_COMPONENTS.drink, {
    onConsume({ source, itemStack }) {
        const potion = readPotion(itemStack);
        if (potion?.form === "drink") applyPotion(source, potion, 1);
    },
});

DoriosLib.registry.itemComponent(ALCHEMY_POTION_COMPONENTS.throwable, {
    onUse({ source, itemStack }) {
        const potion = readPotion(itemStack);
        if (!potion || potion.form === "drink") return;
        const inventory = source.getComponent("inventory").container;
        const slot = source.selectedSlotIndex;
        const held = inventory.getItem(slot);
        if (potionSignature(held) !== potionSignature(itemStack)) return;
        const direction = source.getViewDirection();
        const head = source.getHeadLocation();
        const projectile = source.dimension.spawnEntity(PROJECTILE, {
            x: head.x + direction.x * 0.5, y: head.y + direction.y * 0.5,
            z: head.z + direction.z * 0.5,
        });
        try {
            projectile.setDynamicProperty(PAYLOAD, JSON.stringify(potion));
            projectile.setProperty("ascendant:potion_visual", getPotionPresentation(potion).textureIndex);
            const component = projectile.getComponent("minecraft:projectile");
            component.owner = source;
            component.gravity = THROW_GRAVITY;
            component.airInertia = THROW_AIR_INERTIA;
            component.shoot(getThrowVelocity(direction));
        } catch (error) { projectile.remove(); throw error; }
        if (source.getGameMode() !== "Creative") {
            inventory.setItem(slot, undefined);
        }
        playSound(source.dimension, "random.bow", head, { volume: 0.5, pitch: 0.9 + Math.random() * 0.2 });
    },
});

function getThrowVelocity(direction) {
    const horizontal = Math.hypot(direction.x, direction.z);
    if (horizontal < 1e-8) return { x: 0, y: Math.sign(direction.y) * THROW_SPEED, z: 0 };
    const elevation = Math.min(Math.PI / 2, Math.atan2(direction.y, horizontal) + THROW_ANGLE);
    const horizontalSpeed = Math.cos(elevation) * THROW_SPEED;
    return {
        x: direction.x / horizontal * horizontalSpeed,
        y: Math.sin(elevation) * THROW_SPEED,
        z: direction.z / horizontal * horizontalSpeed,
    };
}

function impact(projectile, directTarget, hitLocation) {
    if (!projectile?.isValid || projectile.typeId !== PROJECTILE || projectile.getDynamicProperty("ascendant:impacted")) return;
    const payload = projectile.getDynamicProperty(PAYLOAD);
    if (typeof payload !== "string") return;
    const potion = JSON.parse(payload);
    projectile.setDynamicProperty("ascendant:impacted", true);
    const dimension = projectile.dimension;
    const location = hitLocation ?? projectile.location;
    playSound(dimension, "random.glass", location, { volume: 1, pitch: 0.9 + Math.random() * 0.2 });
    emitParticles(dimension, "ascendant:alchemical_splash", location, potion);
    if (potion.form === "lingering") {
        const cloud = dimension.spawnEntity(CLOUD, location);
        cloud.setDynamicProperty(PAYLOAD, payload);
        cloud.setDynamicProperty("ascendant:cloud_life", 600);
        cloud.setDynamicProperty("ascendant:cloud_radius", 3);
        trackCloud(cloud);
        emitCloud(cloud, potion, 3);
    } else {
        for (const target of dimension.getEntities({ location, maxDistance: 4.25 })) {
            if (!target.hasComponent("minecraft:health")) continue;
            const d = distance(target.location, location);
            const factor = target.id === directTarget?.id ? 1 : Math.max(0, 1 - d / 4);
            if (factor > 0) applyPotion(target, potion, factor);
        }
    }
    projectile.remove();
}

world.afterEvents.projectileHitEntity.subscribe(e => impact(e.projectile, e.getEntityHit().entity, e.location));
world.afterEvents.projectileHitBlock.subscribe(e => impact(e.projectile, undefined, e.location));
// The on-hit definition event also covers impacts reported only through the entity event.
system.afterEvents.scriptEventReceive.subscribe(e => {
    if (e.id !== "ascendant:alchemical_impact") return;
    const projectile = e.sourceEntity;
    // Prefer the hit event's exact position and direct target when both fire.
    system.run(() => impact(projectile));
});

function trackCloud(entity) {
    if (entity.typeId === CLOUD) clouds.set(entity.id, { entity, nextApplication: new Map() });
}
world.afterEvents.entityLoad.subscribe(e => trackCloud(e.entity));
world.afterEvents.entityRemove.subscribe(e => clouds.delete(e.removedEntityId));
system.run(() => {
    for (const dimension of ["overworld", "nether", "the_end"]) {
        for (const entity of world.getDimension(dimension).getEntities({ type: CLOUD })) trackCloud(entity);
    }
});
system.runInterval(() => {
    for (const [id, state] of clouds) {
        const cloud = state.entity;
        if (!cloud.isValid) { clouds.delete(id); continue; }
        const life = Number(cloud.getDynamicProperty("ascendant:cloud_life") ?? 0) - 10;
        let radius = Number(cloud.getDynamicProperty("ascendant:cloud_radius") ?? 0) - 0.05;
        const payload = cloud.getDynamicProperty(PAYLOAD);
        if (life <= 0 || radius <= 0.5 || typeof payload !== "string") { cloud.remove(); clouds.delete(id); continue; }
        const potion = JSON.parse(payload);
        for (const target of cloud.dimension.getEntities({ location: cloud.location, maxDistance: radius })) {
            if (radius <= 0.5) break;
            if (!target.hasComponent("minecraft:health") || Math.abs(target.location.y - cloud.location.y) > 1.5) continue;
            if ((state.nextApplication.get(target.id) ?? 0) > system.currentTick) continue;
            applyPotion(target, potion, 0.25);
            state.nextApplication.set(target.id, system.currentTick + 20);
            radius -= 0.25;
        }
        for (const [target, next] of state.nextApplication) if (next <= system.currentTick) state.nextApplication.delete(target);
        cloud.setDynamicProperty("ascendant:cloud_life", life);
        cloud.setDynamicProperty("ascendant:cloud_radius", radius);
        emitCloud(cloud, potion, radius);
    }
}, 10);

function emitCloud(cloud, potion, radius) {
    emitParticles(cloud.dimension, "ascendant:alchemical_cloud", {
        x: cloud.location.x, y: cloud.location.y + 0.1, z: cloud.location.z,
    }, potion, radius);
}

function emitParticles(dimension, particle, location, potion, radius = 0) {
    // Presentation failures (e.g. an unloaded chunk) must not interrupt effects
    // or leave a spent projectile alive.
    try {
        const variables = new MolangVariableMap();
        variables.setColorRGBA("variable.color", { ...getPotionPresentation(potion).color, alpha: 0.85 });
        variables.setFloat("variable.cloud_radius", radius);
        dimension.spawnParticle(particle, location, variables);
    } catch {}
}

function playSound(dimension, sound, location, options) {
    try { dimension.playSound(sound, location, options); } catch {}
}

export function applyPotion(target, potion, factor = 1) {
    for (const effect of potionEffects(potion)) {
        if (effect.statsCore) {
            const ticks = Math.round(effect.duration * 20 * factor);
            if (ticks >= 20) applyStatsCorePotionEffect(target, effect.id, ticks, effect.amplifier + 1);
            continue;
        }
        if (effect.id === "instant_health" || effect.id === "instant_damage") {
            const undead = target.matches({ families: ["undead"] });
            const heals = (effect.id === "instant_health") !== undead;
            const amount = Math.round((heals ? 4 : 6) * 2 ** effect.amplifier * factor);
            const health = target.getComponent("minecraft:health");
            if (heals && health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
            else if (amount > 0) target.applyDamage(amount, { cause: "magic" });
        } else {
            const ticks = Math.max(1, Math.round(effect.duration * 20 * factor));
            if (effect.duration > 0 && ticks < 20) continue;
            target.addEffect(effect.id, ticks, { amplifier: effect.amplifier, showParticles: true });
        }
    }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }

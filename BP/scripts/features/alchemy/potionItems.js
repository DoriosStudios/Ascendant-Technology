import { system, world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { ALCHEMY_POTION_COMPONENTS, potionEffects } from "../../config/alchemy.js";
import { readPotion, potionSignature } from "../../ATCore/alchemy/potions.js";
import { applyStatsCorePotionEffect } from "../../ATCore/StatsCore/effects/potions.js";

const PROJECTILE = "utilitycraft:alchemical_potion_projectile";
const CLOUD = "utilitycraft:alchemical_potion_cloud";
const PAYLOAD = "ascendant:alchemy_payload";
const clouds = new Map();

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
        projectile.setDynamicProperty(PAYLOAD, JSON.stringify(potion));
        const component = projectile.getComponent("minecraft:projectile");
        try {
            component.owner = source;
            component.shoot({ x: direction.x * 0.6, y: direction.y * 0.6 + 0.1, z: direction.z * 0.6 });
        } catch (error) { projectile.remove(); throw error; }
        if (source.getGameMode() !== "Creative") {
            inventory.setItem(slot, undefined);
        }
    },
});

function impact(projectile, directTarget) {
    if (!projectile?.isValid || projectile.typeId !== PROJECTILE || projectile.getDynamicProperty("ascendant:impacted")) return;
    const payload = projectile.getDynamicProperty(PAYLOAD);
    if (typeof payload !== "string") return;
    const potion = JSON.parse(payload);
    projectile.setDynamicProperty("ascendant:impacted", true);
    const { dimension, location } = projectile;
    dimension.playSound("random.glass", location);
    if (potion.form === "lingering") {
        const cloud = dimension.spawnEntity(CLOUD, location);
        cloud.setDynamicProperty(PAYLOAD, payload);
        cloud.setDynamicProperty("ascendant:cloud_life", 600);
        cloud.setDynamicProperty("ascendant:cloud_radius", 3);
        trackCloud(cloud);
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

world.afterEvents.projectileHitEntity.subscribe(e => impact(e.projectile, e.getEntityHit().entity));
world.afterEvents.projectileHitBlock.subscribe(e => impact(e.projectile));
// The on-hit definition event also covers impacts reported only through the entity event.
system.afterEvents.scriptEventReceive.subscribe(e => {
    if (e.id === "ascendant:alchemical_impact") impact(e.sourceEntity);
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
        // Native potion particle material and texture are reused by the resource pack.
        cloud.dimension.spawnParticle("ascendant:alchemical_cloud", cloud.location);
    }
}, 10);

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

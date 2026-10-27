import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system } from "@minecraft/server";
import { ID, RANGE, DAMAGE_CAP, MODULES, DIRECTIONS, rangeLevel } from "./slasher/config.js";
import { load, save, clear } from "./slasher/state.js";
import { attack } from "./slasher/combat.js";
import { openMain } from "./slasher/forms.js";

const movedItems = new Map();
function accepted(state, entity) {
    if (!entity.isValid || entity.hasTag("dorios:magnet_immune")) return false;
    if (state.filter.length === 0) return state.filterMode !== "whitelist";
    const listed = state.filter.includes(entity.typeId);
    return state.filterMode === "whitelist" ? listed : !listed;
}
function enabled(state, name) { return state.modules[name] && state.active[name] !== false; }
function process(state) {
    const block = state.block;
    if (!block.permutation.getState("utilitycraft:isOn")) return;
    const now = system.currentTick;
    const center = block.center(), dimension = block.dimension;
    const radius = RANGE[rangeLevel(state)];
    const doAttack = now >= state.nextAttack;
    const doMagnet = enabled(state, "mobMagnet") && now >= (state.nextMagnet ?? 0);
    if (doAttack || doMagnet) {
        const mobs = dimension.getEntities({ location: center, maxDistance: radius,
            excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb", "utilitycraft:mob_slasher_executor"],
            excludeFamilies: ["player", "inanimate", "projectile", "machine", "dorios:machine", "dorios:battery", "dorios:energy_container", "dorios:fluid_container"] });
        for (const mob of mobs) {
            if (!accepted(state, mob) || !mob.getComponent("minecraft:health")) continue;
            if (doMagnet && Number(mob.getDynamicProperty("utilitycraft:mob_magnet_cooldown") ?? 0) <= now) {
                mob.teleport({ x: center.x, y: block.location.y + 1.25, z: center.z });
                mob.setDynamicProperty("utilitycraft:mob_magnet_cooldown", now + Math.max(5, state.cooldown ?? 5));
            }
            if (doAttack) attack(state, mob);
        }
        if (doAttack) state.nextAttack = now + 5;
        if (doMagnet) state.nextMagnet = now + Math.max(5, state.cooldown ?? 5);
    }
    if (now < state.nextUtility) return;
    state.nextUtility = now + 10;
    if (enabled(state, "xpMagnet")) {
        const offset = state.xpOffset ?? { x: 0, y: -0.4, z: 0 };
        const destination = { x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z };
        let loaded = false;
        try { loaded = !!dimension.getBlock(destination); } catch {}
        if (loaded) for (const orb of dimension.getEntities({ type: "minecraft:xp_orb", location: center, maxDistance: radius })) {
            const at = orb.location;
            if (Math.hypot(at.x - destination.x, at.y - destination.y, at.z - destination.z) < 0.25) continue;
            orb.teleport(destination);
        }
    }
    if (enabled(state, "teleporter")) {
        const direction = DIRECTIONS[state.direction];
        const distance = Math.min(state.distance, state.upgrades.range * 0.5);
        if (distance <= 0) return;
        const destination = { x: center.x + direction.x * distance, y: center.y + direction.y * distance, z: center.z + direction.z * distance };
        // getBlock returns undefined for unloaded destinations; never force chunk loads.
        try { if (!dimension.getBlock(destination)) return; } catch { return; }
        for (const item of dimension.getEntities({ type: "minecraft:item", location: center, maxDistance: radius })) {
            if ((movedItems.get(item.id) ?? 0) > now) continue;
            const location = item.location;
            if (Math.hypot(location.x - destination.x, location.y - destination.y, location.z - destination.z) < 0.25) continue;
            item.teleport(destination); item.clearVelocity();
            movedItems.set(item.id, now + 20);
        }
    }
}
function install(state, player, hand) {
    const module = MODULES[hand.typeId];
    const upgrade = hand.typeId === "utilitycraft:range_upgrade" ? "range" : hand.typeId === "utilitycraft:damage_upgrade" ? "damage" : undefined;
    if (!module && !upgrade) return false;
    if (module && state.modules[module]) return true;
    const cap = upgrade === "range" ? 8 : DAMAGE_CAP;
    if (upgrade && state.upgrades[upgrade] >= cap) return true;
    const equipment = player.getComponent("minecraft:equippable");
    const remaining = hand.clone();
    if (remaining.amount > 1) remaining.amount--; 
    if (!equipment.setEquipment("Mainhand", hand.amount > 1 ? remaining : undefined)) return true;
    if (module) { state.modules[module] = true; state.active[module] = true; }
    else state.upgrades[upgrade]++;
    try { save(state); } catch (error) {
        if (module) { delete state.modules[module]; delete state.active[module]; } else state.upgrades[upgrade]--;
        equipment.setEquipment("Mainhand", hand); throw error;
    }
    state.revision++;
    player.onScreenDisplay.setActionBar(module ? `§a${hand.typeId}` : `§a${state.upgrades[upgrade]}/${cap}`);
    return true;
}
function destroy(state, player) {
    if (!state.alive) return;
    const block = state.block;
    const drops = [];
    if (state.weapon) drops.push(state.weapon);
    for (const [item, module] of Object.entries(MODULES)) if (state.modules[module]) drops.push(new ItemStack(item));
    for (const [name, amount] of Object.entries(state.upgrades)) if (amount > 0) drops.push(new ItemStack(`utilitycraft:${name}_upgrade`, amount));
    if (player && state.xp > 0) player.addExperience(state.xp);
    clear(block);
    for (const item of drops) block.dimension.spawnItem(item, block.center());
}
DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace({ block }) { clear(block); },
    onTick({ block }) {
        try { process(load(block)); } catch (error) {
            const state = load(block);
            if (system.currentTick >= (state.nextError ?? 0)) {
                state.nextError = system.currentTick + 200;
                console.warn(`[Mob Slasher] ${state.key}: ${error}`);
            }
        }
    },
    onPlayerInteract({ block, player }) {
        if (!player) return;
        const state = load(block);
        const hand = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
        if (hand && install(state, player, hand)) return;
        if (!player.isSneaking) openMain(player, state);
    },
    onPlayerBreak({ block, player }) { destroy(load(block), player); },
    onBreak({ block }) {
        const state = load(block);
        // Let the player-break callback return XP before the general destruction path.
        system.run(() => destroy(state));
    },
});
system.runInterval(() => {
    for (const [id, until] of movedItems) if (until <= system.currentTick) movedItems.delete(id);
}, 100);

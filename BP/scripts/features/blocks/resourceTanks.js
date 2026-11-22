import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, system } from "@minecraft/server";
import { FluidStorage, GasStorage, createResourceLore, getResourcesFromItem } from "DoriosCore/index.js";
import { INFINITE_STORAGE_CAPACITY } from "../../DoriosCore/machinery/constants.js";
import { takeNativeDropSnapshot, replaceNativeBlockDrop, queueBlockDestruction } from "../../DoriosCore/utils/nativeDrops.js";
import { ABSOLUTE_TANK_CAPACITY, tankVisualTypes } from "../../config/resources/tanks.js";

const placements = new Map();
const breaking = new Set();
const storageClasses = { fluid: FluidStorage, gas: GasStorage };
const placementKey = block => `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
const entityId = params => params.infinite ? "utilitycraft:infinite_tank" : `ascendant:absolute_${params.resource}_tank`;

function findEntity(block, params) {
    return block.dimension.getEntitiesAtBlockLocation(block.location).find(entity => entity.typeId === entityId(params));
}

function initializeTank(block, params, saved) {
    const Storage = storageClasses[params.resource];
    const existing = findEntity(block, params);
    if (existing?.scoreboardIdentity) return existing;
    const entity = existing ?? block.dimension.spawnEntity(entityId(params), {
        x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5,
    });
    if (params.infinite) {
        entity.triggerEvent(`utilitycraft:${params.resource}`);
        entity.addTag("dorios:infinite_storage");
        entity.addTag(`dorios:constant_${params.resource}_type`);
    }
    Storage.initializeObjectives(0);
    Storage.initialize(entity);
    const storage = Storage.initializeSingle(entity);
    const capacity = params.infinite ? INFINITE_STORAGE_CAPACITY : ABSOLUTE_TANK_CAPACITY;
    storage.setCap(Math.max(capacity, saved?.amount ?? 0));
    storage.setType(params.infinite ? params.type : saved?.type ?? "empty");
    storage.set(params.infinite ? capacity : saved?.amount ?? 0);
    updateVisual(entity, params, storage);
    return entity;
}

function updateVisual(entity, params, storage) {
    if (params.infinite) return;
    const index = Math.max(0, tankVisualTypes[params.resource].indexOf(storage.getType()));
    if (entity.getProperty("ascendant:resource_visual") !== index) {
        entity.setProperty("ascendant:resource_visual", index);
    }
    const capacity = storage.getCap();
    const fill = capacity > 0 ? Math.max(0, Math.min(1, storage.get() / capacity)) : 0;
    if (entity.getProperty("ascendant:fill_level") !== fill) {
        entity.setProperty("ascendant:fill_level", fill);
    }
}

function showStatus(player, params, storage) {
    const type = storage.getType();
    const label = type === "empty" || tankVisualTypes[params.resource].includes(type)
        ? { translate: `ui.at.resource.${type}` }
        : { text: DoriosLib.text.formatIdentifier(type) };
    const amount = params.infinite
        ? { translate: "ui.at.tank.infinite" }
        : { text: `${FluidStorage.formatFluid(storage.get())} / ${FluidStorage.formatFluid(storage.getCap())}` };
    player.onScreenDisplay.setActionBar({ rawtext: [
        label, { text: " §7— §f" }, amount,
    ] });
}

DoriosLib.registry.blockComponent("ascendant:resource_tank", {
    beforeOnPlayerPlace({ block, player }, { params }) {
        if (params.infinite) return;
        const snapshot = getResourcesFromItem(DoriosLib.entity.getEquipment(player, "Mainhand"));
        const key = placementKey(block);
        placements.set(key, snapshot);
        system.runTimeout(() => { if (placements.get(key) === snapshot) placements.delete(key); }, 2);
    },

    onPlace({ block }, { params }) {
        const key = placementKey(block);
        const snapshot = placements.get(key);
        placements.delete(key);
        const resources = params.resource === "fluid" ? snapshot?.fluids : snapshot?.gases;
        initializeTank(block, params, resources?.find(entry => entry.index === 0));
    },

    onTick({ block }, { params }) {
        if (!globalThis.worldLoaded) return;
        const entity = initializeTank(block, params);
        updateVisual(entity, params, new storageClasses[params.resource](entity));
    },

    onPlayerInteract({ block, player }, { params }) {
        if (!player) return;
        const entity = initializeTank(block, params);
        const Storage = storageClasses[params.resource];
        const storage = new Storage(entity);
        const held = DoriosLib.entity.getEquipment(player, "Mainhand");
        if (held && !held.typeId.includes("wrench") && held.typeId !== "utilitycraft:copy_paste_tool") {
            const result = params.resource === "fluid" ? storage.fluidItem(held.typeId) : storage.gasItem(held.typeId);
            if (result !== false) {
                const holder = params.resource === "fluid"
                    ? FluidStorage.itemFluidHolders[held.typeId]
                    : GasStorage.itemGasHolders[held.typeId];
                if (DoriosLib.player.isCreative(player) && holder && result) {
                    const inventory = player.getComponent("minecraft:inventory").container;
                    const overflow = inventory.addItem(new ItemStack(result));
                    if (overflow) player.dimension.spawnItem(overflow, player.location);
                } else if (params.resource === "fluid") FluidStorage.replaceHeldFluidItem(player, held.typeId, result || undefined);
                else GasStorage.replaceHeldGasItem(player, held.typeId, result || undefined);
            }
        }
        updateVisual(entity, params, storage);
        showStatus(player, params, storage);
    },

    onPlayerBreak({ block, brokenBlockPermutation }, { params }) {
        const entity = findEntity(block, params);
        if (!entity || params.infinite || breaking.has(entity.id)) return;
        const native = takeNativeDropSnapshot(block.dimension, block.location, brokenBlockPermutation.type.id);
        const item = new ItemStack(brokenBlockPermutation.type.id);
        item.setLore(createResourceLore(entity, { energy: false, fluids: params.resource === "fluid", gases: params.resource === "gas" }));
        breaking.add(entity.id);
        queueBlockDestruction(entity, () => {
            try {
                if (!replaceNativeBlockDrop(native, item)) block.dimension.spawnItem(item, block.center());
                entity.remove();
            } finally { breaking.delete(entity.id); }
        });
    },

    onBreak({ block }, { params }) {
        const entity = findEntity(block, params);
        if (!entity) return;
        system.run(() => { if (entity.isValid && !breaking.has(entity.id)) entity.remove(); });
    },
});

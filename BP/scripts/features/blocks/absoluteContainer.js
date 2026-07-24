// @ts-check

import { world } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { EnergyStorage, FluidStorage, Machine } from "DoriosCore/index.js";
import {
    hasOpenUI,
    tryGetEntityFromBlock,
} from "../../DoriosCore/utils/entity.js";

const ID = "utilitycraft:absolute_container";
const STORAGE_SLOTS = Array.from({ length: 168 }, (_, index) => index);
const ENERGY_DISPLAY_SLOT = 168;
const FLUID_DISPLAY_SLOT = 169;
const initializedEntities = new Set();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    initializedEntities.delete(removedEntityId);
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, (entity) => {
            initializeContainer(entity);
            displayResources(entity);

            const inventory = entity.getComponent("inventory")?.container;
            inventory?.setItem(0, undefined);
            initializedEntities.delete(entity.id);
            DoriosLib.block.setState(event.block, "utilitycraft:on", true);
        });
    },

    onTick(event) {
        const entity = tryGetEntityFromBlock(event.block);
        if (!entity?.isValid) return;

        if (!initializedEntities.has(entity.id)) initializeContainer(entity);
        if (hasOpenUI(entity)) displayResources(entity);
        DoriosLib.block.setState(event.block, "utilitycraft:on", true);
    },

    onPlayerBreak(event) {
        const entity = tryGetEntityFromBlock(event.block);
        if (entity) initializedEntities.delete(entity.id);
        Machine.onDestroy(event);
    },
});

function initializeContainer(entity) {
    DoriosLib.container.setConfig(entity, {
        version: 1,
        type: "simple",
        inputConfig: STORAGE_SLOTS,
        outputConfig: STORAGE_SLOTS,
    });
    initializedEntities.add(entity.id);
}

function displayResources(entity) {
    new EnergyStorage(entity).display(ENERGY_DISPLAY_SLOT);
    new FluidStorage(entity, 0).display(FLUID_DISPLAY_SLOT);
}

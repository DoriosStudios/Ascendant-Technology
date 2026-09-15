// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { FluidStorage, InterfaceManager } from "DoriosCore/index.js";
import { getFluidCapsuleId } from "../../config/resources/capsules.js";

function getItemMaximum(typeId) {
    try {
        return new ItemStack(typeId, 1).maxAmount;
    } catch {
        return 0;
    }
}

/** Registers a tank-ejection button that returns whole buckets as finite capsules. */
export function registerFluidEjection(machineId, buttonSlot, displaySlot, messageKey) {
    const interfaceId = `${machineId}:fluid_ejection`;
    InterfaceManager.registerInterface(interfaceId, {
        buttons: {
            eject: {
                slot: buttonSlot,
                nameTag: "Eject Fluid",
                onPress: ejectFluid,
            },
        },
    });
    InterfaceManager.linkBlockInterface(machineId, interfaceId);

    function ejectFluid({ entity, player }) {
        const tank = new FluidStorage(entity, 0);
        const amount = tank.get();
        const fluid = tank.getType();
        const fullCapsuleId = getFluidCapsuleId(fluid, 8);
        const supported = fullCapsuleId && getItemMaximum(fullCapsuleId) > 0;
        const drops = [];
        if (supported) {
            const buckets = Math.floor(amount / 1000);
            let fullCapsules = Math.floor(buckets / 8);
            while (fullCapsules > 0) {
                const count = Math.min(fullCapsules, getItemMaximum(fullCapsuleId));
                drops.push(new ItemStack(fullCapsuleId, count));
                fullCapsules -= count;
            }
            const remainder = buckets % 8;
            if (remainder > 0) drops.push(new ItemStack(getFluidCapsuleId(fluid, remainder), 1));
        }

        tank.set(0);
        tank.setType("empty");
        tank.display(displaySlot);
        for (const drop of drops) entity.dimension.spawnItem(drop, entity.location);

        if (amount > 0 && !supported) {
            player?.sendMessage({
                translate: messageKey,
                with: [FluidStorage.formatFluid(amount), DoriosLib.text.formatIdentifier(fluid)],
            });
        }
    }
}

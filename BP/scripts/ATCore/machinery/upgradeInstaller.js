import * as DoriosLib from "DoriosLib/index.js";
import { UPGRADE_PROFILES } from "./upgradeProfiles.js";
import { UPGRADE_DEFINITIONS, supportsUpgrade, findUpgradeSlot } from "./upgradeEffects.js";

DoriosLib.registry.itemComponent("ascendant:machine_upgrade", {
    onUseOn({ source: player, block, itemStack }) {
        if (player.typeId !== "minecraft:player") return;
        const profile = UPGRADE_PROFILES[block.typeId];
        const definition = UPGRADE_DEFINITIONS[itemStack.typeId];
        const message = key => player.onScreenDisplay.setActionBar({ translate: `message.ascendant.upgrade.${key}` });
        if (!definition || !supportsUpgrade(profile, definition.type)) return message("unsupported");
        const container = DoriosLib.container.resolveAt(block.dimension, block.location)?.container;
        if (!container) return message("failed");
        const slot = findUpgradeSlot(container, profile, itemStack.typeId);
        if (slot === undefined) return message("occupied");
        const equipment = player.getComponent("equippable");
        const held = equipment?.getEquipment("Mainhand");
        if (!held || held.typeId !== itemStack.typeId) return;
        const installed = container.getItem(slot);
        const amount = Math.min(player.isSneaking ? held.amount : 1, 8 - (installed?.amount ?? 0));
        if (amount <= 0) return message("max");
        const next = installed?.clone() ?? held.clone();
        next.amount = (installed?.amount ?? 0) + amount;
        const creative = DoriosLib.player.isCreative(player);
        const remaining = held.clone();
        if (held.amount > amount) remaining.amount -= amount;
        try {
            container.setItem(slot, next);
            if (!creative && !equipment.setEquipment("Mainhand", held.amount > amount ? remaining : undefined)) {
                throw new Error("Could not update held upgrade");
            }
        } catch {
            container.setItem(slot, installed);
            return message("failed");
        }
        message("applied");
    },
});

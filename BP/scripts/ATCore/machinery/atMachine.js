import * as DoriosLib from "DoriosLib/index.js";
import { Machine as CoreMachine, FluidStorage, GasStorage } from "DoriosCore/index.js";
import { getResourcesFromItem } from "../../DoriosCore/machinery/resourceLore.js";
import { UPGRADE_PROFILES } from "./upgradeProfiles.js";
import { resolveATBoosts, capacityTarget } from "./upgradeEffects.js";
import { world } from "@minecraft/server";

let tickContext;
const capacityStates = new Map();
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => capacityStates.delete(removedEntityId));

/** Local subclass: no prototype patching, no changes to shared registries or core files. */
export class Machine extends CoreMachine {
    constructor(block, settings) {
        super(block, settings);
        if (!this.valid) return;
        const profile = UPGRADE_PROFILES[block.typeId];
        this.upgradeProfile = profile;
        Object.assign(this.boosts, resolveATBoosts(this.container, profile));
        this.syncUpgradeCapacity();
        if (tickContext) tickContext.push(this);
    }

    syncUpgradeCapacity() {
        const profile = this.upgradeProfile;
        if (!profile || !this.valid) return;
        const signature = [this.boosts.energy_capacity_multiplier, this.boosts.fluid_capacity_multiplier, this.boosts.gas_capacity_multiplier].join(":");
        const previous = capacityStates.get(this.entity.id);
        if (previous?.signature === signature && !previous.draining) return;
        let draining = false;
        const apply = (storage, base, multiplier) => {
            const stored = storage.get();
            const target = capacityTarget(base, multiplier, stored);
            draining ||= stored > Math.floor(base * multiplier);
            if (storage.getCap() !== target) storage.setCap(target);
            storage.getCap(); // Refresh the instance cache after setCap.
        };
        if (profile.energy_cap) apply(this.energy, profile.energy_cap, this.boosts.energy_capacity_multiplier);
        for (let index = 0; index < (profile.fluid_types ?? 0); index++) {
            apply(new FluidStorage(this.entity, index), profile.fluid_cap, this.boosts.fluid_capacity_multiplier);
        }
        for (let index = 0; index < (profile.gas_types ?? 0); index++) {
            apply(new GasStorage(this.entity, index), profile.gas_cap, this.boosts.gas_capacity_multiplier);
        }
        capacityStates.set(this.entity.id, { signature, draining });
    }

    static spawnEntity(event, config, callback) {
        // Shared placement clamps restored lore to the initial capacity. Expand only
        // this placement's config to retain stored excess when upgrades drop separately.
        const item = event.player.getComponent("equippable")?.getEquipment("Mainhand");
        const snapshot = getResourcesFromItem(item);
        const settings = { ...config.machine };
        settings.energy_cap = Math.max(settings.energy_cap ?? 0, snapshot.energy);
        if (settings.fluid_cap) settings.fluid_cap = Math.max(settings.fluid_cap, ...snapshot.fluids.map(entry => entry.amount));
        if (settings.gas_cap) settings.gas_cap = Math.max(settings.gas_cap, ...snapshot.gases.map(entry => entry.amount));
        return CoreMachine.spawnEntity(event, { ...config, machine: settings }, callback);
    }
}

/** Ensure a removed capacity upgrade stops accepting excess again after consumption. */
export function registerATMachine(id, component) {
    const onTick = component.onTick;
    DoriosLib.registry.blockComponent(id, {
        ...component,
        onTick(event, parameters) {
            const previous = tickContext;
            const machines = [];
            tickContext = machines;
            try { return onTick?.(event, parameters); }
            finally {
                tickContext = previous;
                for (const machine of machines) if (machine.entity.isValid) machine.syncUpgradeCapacity();
            }
        },
    });
}

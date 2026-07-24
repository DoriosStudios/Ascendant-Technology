// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    Machine,
} from "DoriosCore/index.js";
import {
    damageLaserBarrierContacts,
    getLaserBarrierDirection,
    removeLaserBarrierField,
    syncLaserBarrierField,
} from "../../ATCore/security/index.js";

const ID = "utilitycraft:laser_barrier";
const MACHINE_ENTITY_ID = "utilitycraft:machine_entity";
const SIZE_UPGRADE_ID = "utilitycraft:size_upgrade";

const ENERGY_SLOT = 0;
const LABEL_SLOT = 1;
const POWER_BUTTON_SLOT = 2;
const BLOCKED_SLOT = 3;
const LENGTH_UPGRADE_SLOT = 4;
const HEIGHT_UPGRADE_SLOT = 5;
const ENERGY_UPGRADE_SLOT = 6;

const BASE_LENGTH = 3;
const BASE_HEIGHT = 3;
const MAX_SIZE_LEVEL = 8;
const TICK_INTERVAL = 10;
const TICKS_PER_SECOND = 20;
const CONTACT_DAMAGE = 2;

const ENABLED_PROPERTY = "ascendant:laser_enabled";
const ACTIVE_PROPERTY = "ascendant:laser_active";
const LENGTH_PROPERTY = "ascendant:laser_length";
const HEIGHT_PROPERTY = "ascendant:laser_height";
const DIRECTION_PROPERTY = "ascendant:laser_direction";
const LEGACY_LENGTH_PROPERTY = "laser:len";
const LEGACY_HEIGHT_PROPERTY = "laser:hei";

ButtonManager.registerMachineButton(ID, POWER_BUTTON_SLOT, ({ entity }) => {
    setEnabled(entity, !isEnabled(entity));
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([BLOCKED_SLOT]);
            syncPowerButton(machine.entity);
            setEnabled(machine.entity, true);
            machine.entity.setDynamicProperty(ACTIVE_PROPERTY, false);
            storeProjection(machine.entity, event.block, BASE_LENGTH, BASE_HEIGHT);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.energy.display(ENERGY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(event.block, { ...settings, ignoreTick: true });
        if (!machine.valid) return;

        if (machine.shouldUpdateUI) {
            syncPowerButton(machine.entity);
            ButtonManager.ensureWatching(machine.entity, ID);
        } else {
            ButtonManager.unwatchEntity(machine.entity);
        }

        const lengthLevel = getSizeLevel(machine.container, LENGTH_UPGRADE_SLOT);
        const heightLevel = getSizeLevel(machine.container, HEIGHT_UPGRADE_SLOT);
        const length = BASE_LENGTH + lengthLevel;
        const height = BASE_HEIGHT + heightLevel;
        const cycleCost = Math.max(
            1,
            Math.ceil(
                settings.machine.energy_cost
                * (TICK_INTERVAL / TICKS_PER_SECOND)
                * (machine.boosts.consumption ?? 1),
            ),
        );
        machine.setEnergyCost(cycleCost);

        const stored = getStoredProjection(machine.entity, machine.block);
        const currentDirection = getLaserBarrierDirection(machine.block);
        const projectionChanged = stored.length !== length
            || stored.height !== height
            || stored.direction !== currentDirection;

        if (stored.active && projectionChanged) {
            removeLaserBarrierField(machine.entity, {
                dimension: machine.dimension,
                origin: machine.block.location,
                direction: stored.direction,
                length: stored.length,
                height: stored.height,
            });
            machine.entity.setDynamicProperty(ACTIVE_PROPERTY, false);
        }

        if (!isEnabled(machine.entity)) {
            deactivate(machine, stored, "Disabled", length, height, cycleCost, lengthLevel, heightLevel);
            return;
        }

        if (!currentDirection) {
            deactivate(machine, stored, "Invalid Direction", length, height, cycleCost, lengthLevel, heightLevel);
            return;
        }

        if (!machine.energy.has(cycleCost)) {
            deactivate(machine, stored, "No Energy", length, height, cycleCost, lengthLevel, heightLevel);
            return;
        }

        const record = syncLaserBarrierField(machine.entity, machine.block, length, height);
        storeProjection(machine.entity, machine.block, length, height, true);

        if (!record || record.projected === 0) {
            machine.off();
            renderStatus(machine, {
                title: "Projection Blocked",
                enabled: true,
                active: false,
                length,
                height,
                lengthLevel,
                heightLevel,
                cycleCost,
                projected: 0,
                blocked: record?.blocked ?? length * height,
                total: record?.total ?? length * height,
            });
            return;
        }

        machine.energy.consume(cycleCost);
        damageLaserBarrierContacts(record, CONTACT_DAMAGE);
        machine.on();

        renderStatus(machine, {
            title: record.blocked > 0 ? "Partially Blocked" : "Barrier Active",
            enabled: true,
            active: true,
            length,
            height,
            lengthLevel,
            heightLevel,
            cycleCost,
            projected: record.projected,
            blocked: record.blocked,
            total: record.total,
        });
    },

    onPlayerBreak(event) {
        const entity = event.dimension
            .getEntitiesAtBlockLocation(event.block.location)
            .find((candidate) => candidate.typeId === MACHINE_ENTITY_ID);

        if (entity) {
            ButtonManager.unwatchEntity(entity);
            const stored = getStoredProjection(entity, event.block, event.brokenBlockPermutation);
            removeLaserBarrierField(entity, {
                dimension: event.dimension,
                origin: event.block.location,
                direction: stored.direction,
                length: stored.length,
                height: stored.height,
            });
        }

        Machine.onDestroy(event);
    },
});

function deactivate(machine, stored, title, length, height, cycleCost, lengthLevel, heightLevel) {
    if (stored.active) {
        removeLaserBarrierField(machine.entity, {
            dimension: machine.dimension,
            origin: machine.block.location,
            direction: stored.direction,
            length: stored.length,
            height: stored.height,
        });
        machine.entity.setDynamicProperty(ACTIVE_PROPERTY, false);
    }

    machine.off();
    renderStatus(machine, {
        title,
        enabled: isEnabled(machine.entity),
        active: false,
        length,
        height,
        lengthLevel,
        heightLevel,
        cycleCost,
        projected: 0,
        blocked: 0,
        total: length * height,
    });
}

function renderStatus(machine, status) {
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(ENERGY_SLOT);
    machine.setLabel([
        `\u00A7r${status.active ? "\u00A7a" : "\u00A7e"}${status.title}`,
        `\u00A7r\u00A77Power: \u00A7f${status.enabled ? "Enabled" : "Disabled"}`,
        `\u00A7r\u00A77Field: \u00A7f${status.length} x ${status.height}`,
        `\u00A7r\u00A77Projected: \u00A7f${status.projected}/${status.total}`,
        status.blocked > 0
            ? `\u00A7r\u00A77Blocked: \u00A7c${status.blocked}`
            : `\u00A7r\u00A77Damage: \u00A7f${CONTACT_DAMAGE}`,
        `\u00A7r\u00A77Upkeep: \u00A7f${EnergyStorage.formatEnergyToText(status.cycleCost)}/cycle`,
        `\u00A7r\u00A77Size: \u00A7fL${status.lengthLevel} H${status.heightLevel}`,
    ], LABEL_SLOT);
}

function getSizeLevel(container, slot) {
    const item = container.getItem(slot);
    if (item?.typeId !== SIZE_UPGRADE_ID) return 0;
    return Math.min(MAX_SIZE_LEVEL, item.amount);
}

function isEnabled(entity) {
    return entity.getDynamicProperty(ENABLED_PROPERTY) !== "false";
}

function setEnabled(entity, enabled) {
    entity.setDynamicProperty(ENABLED_PROPERTY, enabled ? "true" : "false");
}

function syncPowerButton(entity) {
    const container = entity.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const current = container.getItem(POWER_BUTTON_SLOT);
    if (current?.typeId === "utilitycraft:ui_filler") return;

    const button = new ItemStack("utilitycraft:ui_filler", 1);
    button.nameTag = " ";
    container.setItem(POWER_BUTTON_SLOT, button);
}

function storeProjection(entity, block, length, height, active = false) {
    const direction = getLaserBarrierDirection(block);
    if (entity.getDynamicProperty(LENGTH_PROPERTY) !== length) {
        entity.setDynamicProperty(LENGTH_PROPERTY, length);
    }
    if (entity.getDynamicProperty(HEIGHT_PROPERTY) !== height) {
        entity.setDynamicProperty(HEIGHT_PROPERTY, height);
    }
    if (direction && entity.getDynamicProperty(DIRECTION_PROPERTY) !== direction) {
        entity.setDynamicProperty(DIRECTION_PROPERTY, direction);
    }
    if (entity.getDynamicProperty(ACTIVE_PROPERTY) !== active) {
        entity.setDynamicProperty(ACTIVE_PROPERTY, active);
    }
}

function getStoredProjection(entity, block, permutation = block?.permutation) {
    const storedDirection = entity.getDynamicProperty(DIRECTION_PROPERTY);
    const permutationDirection = permutation?.getState("minecraft:cardinal_direction");
    const direction = normalizeDirection(storedDirection)
        ?? normalizeDirection(permutationDirection)
        ?? "north";

    return {
        active: entity.getDynamicProperty(ACTIVE_PROPERTY) === true
            || (entity.getDynamicProperty(ACTIVE_PROPERTY) === undefined && isBlockOn(block)),
        direction,
        length: clampStoredSize(
            entity.getDynamicProperty(LENGTH_PROPERTY)
                ?? entity.getDynamicProperty(LEGACY_LENGTH_PROPERTY),
            BASE_LENGTH,
        ),
        height: clampStoredSize(
            entity.getDynamicProperty(HEIGHT_PROPERTY)
                ?? entity.getDynamicProperty(LEGACY_HEIGHT_PROPERTY),
            BASE_HEIGHT,
        ),
    };
}

function isBlockOn(block) {
    try {
        return block?.permutation.getState("utilitycraft:on") === true;
    } catch {
        return false;
    }
}

function clampStoredSize(value, fallback) {
    const numeric = Math.floor(Number(value));
    return Number.isFinite(numeric)
        ? Math.max(1, Math.min(fallback + MAX_SIZE_LEVEL, numeric))
        : fallback;
}

function normalizeDirection(direction) {
    return direction === "north"
        || direction === "south"
        || direction === "east"
        || direction === "west"
        ? direction
        : null;
}

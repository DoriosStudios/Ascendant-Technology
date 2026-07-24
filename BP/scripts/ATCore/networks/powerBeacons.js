// @ts-check

import { system, world } from "@minecraft/server";
import { EnergyStorage } from "DoriosCore/index.js";

export const POWER_BEACON_ENTITY_ID = "utilitycraft:power_beacon_entity";

const MAX_POWER_BEACON_RANGE = 48;
const REBUILD_INTERVAL_TICKS = 600;
const POWER_BEACON_RANGES = new Map([
    ["utilitycraft:basic_power_beacon", 4],
    ["utilitycraft:advanced_power_beacon", 8],
    ["utilitycraft:expert_power_beacon", 12],
    ["utilitycraft:ultimate_power_beacon", 24],
    ["utilitycraft:absolute_power_beacon", 48],
]);

/** @typedef {{entity: import("@minecraft/server").Entity, range: number, location: {x:number,y:number,z:number}, targets: Map<string, EnergyStorage>, targetIds: string[], orderDirty: boolean, activeTargets: Array<{energy:EnergyStorage,space:number}>, nextRebuildTick: number}} PowerBeaconRecord */

/** @type {Map<string, PowerBeaconRecord>} */
const beacons = new Map();
/** @type {Map<string, Set<string>>} */
const beaconIdsByTargetId = new Map();
const pendingClassification = new Set();

function integerLocation(location) {
    return {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    };
}

function sameLocation(first, second) {
    return first.x === second.x && first.y === second.y && first.z === second.z;
}

function distanceSquared(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    const dz = first.z - second.z;
    return dx * dx + dy * dy + dz * dz;
}

function staggerOffset(entityId) {
    let hash = 0;
    for (let index = 0; index < entityId.length; index++) {
        hash = ((hash * 31) + entityId.charCodeAt(index)) >>> 0;
    }
    return 1 + (hash % REBUILD_INTERVAL_TICKS);
}

function getBlockAtEntity(entity) {
    if (!entity?.isValid) return undefined;
    try {
        return entity.dimension.getBlock(integerLocation(entity.location));
    } catch {
        return undefined;
    }
}

function resolveBeaconRange(entity) {
    const block = getBlockAtEntity(entity);
    return POWER_BEACON_RANGES.get(block?.typeId);
}

function isPowerBeacon(entity) {
    return entity?.isValid === true && entity.typeId === POWER_BEACON_ENTITY_ID;
}

function isPowerBeaconTarget(entity) {
    if (!entity?.isValid || entity.typeId === POWER_BEACON_ENTITY_ID) return false;

    const families = entity.getComponent("minecraft:type_family");
    return families?.hasTypeFamily("dorios:machine") === true
        && families.hasTypeFamily("dorios:energy_container")
        && !families.hasTypeFamily("dorios:energy_source")
        && !families.hasTypeFamily("dorios:battery");
}

function isInsideBeacon(record, entity) {
    if (!record.entity?.isValid || !entity?.isValid || entity.dimension.id !== record.entity.dimension.id) return false;
    return distanceSquared(record.location, integerLocation(entity.location)) <= record.range * record.range;
}

function shouldClassifyEntity(entity) {
    if (!entity?.isValid) return false;
    if (
        entity.typeId === "utilitycraft:machine_entity"
        || entity.typeId === "utilitycraft:machine"
        || entity.typeId === POWER_BEACON_ENTITY_ID
    ) {
        return true;
    }

    const families = entity.getComponent("minecraft:type_family");
    return families?.hasTypeFamily("dorios:machine") === true
        && families.hasTypeFamily("dorios:energy_container");
}

function unlinkTarget(record, targetId) {
    if (!record.targets.delete(targetId)) return false;
    record.orderDirty = true;

    const beaconIds = beaconIdsByTargetId.get(targetId);
    if (!beaconIds) return true;
    beaconIds.delete(record.entity.id);
    if (beaconIds.size === 0) beaconIdsByTargetId.delete(targetId);
    return true;
}

function clearTargets(record) {
    for (const targetId of record.targets.keys()) {
        const beaconIds = beaconIdsByTargetId.get(targetId);
        if (!beaconIds) continue;
        beaconIds.delete(record.entity.id);
        if (beaconIds.size === 0) beaconIdsByTargetId.delete(targetId);
    }
    record.targets.clear();
    record.targetIds.length = 0;
    record.orderDirty = false;
    record.activeTargets.length = 0;
}

function addTarget(record, entity) {
    if (!isPowerBeaconTarget(entity) || !isInsideBeacon(record, entity)) return false;
    if (record.targets.has(entity.id)) return true;

    let energy;
    try {
        energy = new EnergyStorage(entity);
    } catch {
        return false;
    }

    record.targets.set(entity.id, energy);
    record.targetIds.push(entity.id);
    record.orderDirty = true;
    const beaconIds = beaconIdsByTargetId.get(entity.id) ?? new Set();
    beaconIds.add(record.entity.id);
    beaconIdsByTargetId.set(entity.id, beaconIds);
    return true;
}

function queryTargets(record) {
    try {
        return record.entity.dimension.getEntities({
            families: ["dorios:energy_container"],
            location: record.entity.location,
            maxDistance: record.range + 1,
        });
    } catch {
        return [];
    }
}

function rebuildRecord(record, scheduleNext = true) {
    if (!record.entity?.isValid) {
        unregisterPowerBeacon(record.entity?.id);
        return false;
    }

    record.location = integerLocation(record.entity.location);
    clearTargets(record);
    for (const entity of queryTargets(record)) addTarget(record, entity);
    if (scheduleNext) record.nextRebuildTick = system.currentTick + REBUILD_INTERVAL_TICKS;
    return true;
}

function queryNearbyBeacons(entity) {
    try {
        return entity.dimension.getEntities({
            type: POWER_BEACON_ENTITY_ID,
            location: entity.location,
            maxDistance: MAX_POWER_BEACON_RANGE + 1,
        });
    } catch {
        return [];
    }
}

function addTargetToNearbyBeacons(entity) {
    if (!isPowerBeaconTarget(entity)) return;

    for (const beaconEntity of queryNearbyBeacons(entity)) {
        const range = resolveBeaconRange(beaconEntity);
        if (!range) continue;
        const record = ensurePowerBeacon(beaconEntity, range);
        if (record) addTarget(record, entity);
    }
}

function classifyEntity(entity) {
    if (!entity?.isValid) return;

    if (isPowerBeacon(entity)) {
        const range = resolveBeaconRange(entity);
        if (range) ensurePowerBeacon(entity, range);
        return;
    }

    addTargetToNearbyBeacons(entity);
}

function scheduleClassification(entity) {
    if (!entity?.id || !shouldClassifyEntity(entity) || pendingClassification.has(entity.id)) return;
    pendingClassification.add(entity.id);
    system.run(() => {
        pendingClassification.delete(entity.id);
        classifyEntity(entity);
    });
}

/**
 * Registers one dedicated Power Beacon entity and seeds its target cache
 * with one bounded entity query.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {number} range
 * @returns {PowerBeaconRecord|undefined}
 */
export function ensurePowerBeacon(entity, range) {
    if (!entity?.isValid) return undefined;

    const normalizedRange = Math.max(1, Math.min(MAX_POWER_BEACON_RANGE, Math.floor(Number(range) || 1)));
    const location = integerLocation(entity.location);
    let record = beacons.get(entity.id);
    if (!record) {
        record = {
            entity,
            range: normalizedRange,
            location,
            targets: new Map(),
            targetIds: [],
            orderDirty: false,
            activeTargets: [],
            nextRebuildTick: system.currentTick + staggerOffset(entity.id),
        };
        beacons.set(entity.id, record);
        rebuildRecord(record, false);
        return record;
    }

    record.entity = entity;
    if (record.range !== normalizedRange || !sameLocation(record.location, location)) {
        record.range = normalizedRange;
        record.location = location;
        rebuildRecord(record);
    }
    return record;
}

/**
 * Performs the staggered safety rebuild for a loaded Power Beacon.
 *
 * @param {import("@minecraft/server").Entity} entity
 * @param {number} range
 * @returns {PowerBeaconRecord|undefined}
 */
export function maintainPowerBeacon(entity, range) {
    const record = ensurePowerBeacon(entity, range);
    if (!record) return undefined;
    if (system.currentTick >= record.nextRebuildTick) rebuildRecord(record);
    return record;
}

/**
 * Removes a Power Beacon and all reverse target associations from the cache.
 *
 * @param {string} beaconId
 * @returns {boolean}
 */
export function unregisterPowerBeacon(beaconId) {
    const record = beacons.get(beaconId);
    if (!record) return false;
    clearTargets(record);
    beacons.delete(beaconId);
    return true;
}

/**
 * Transfers energy fairly across cached receivers. Membership is cached;
 * validity, range and current free capacity are evaluated for every transfer.
 *
 * @param {PowerBeaconRecord} record
 * @param {EnergyStorage} source
 * @param {number} limit
 * @returns {{transferred:number,targetCount:number}}
 */
export function transferPowerBeaconEnergy(record, source, limit) {
    let available = source.get();
    let remainingLimit = Math.min(available, Math.max(0, Math.floor(limit)));
    if (available <= 0 || remainingLimit <= 0) return { transferred: 0, targetCount: 0 };

    const activeTargets = record.activeTargets;
    let activeCount = 0;
    if (record.orderDirty) {
        record.targetIds = [...record.targets.keys()].sort((firstId, secondId) => {
            const first = record.targets.get(firstId)?.entity;
            const second = record.targets.get(secondId)?.entity;
            if (!first?.isValid && !second?.isValid) return firstId.localeCompare(secondId);
            if (!first?.isValid) return 1;
            if (!second?.isValid) return -1;
            const difference = distanceSquared(record.location, integerLocation(first.location))
                - distanceSquared(record.location, integerLocation(second.location));
            return difference || firstId.localeCompare(secondId);
        });
        record.orderDirty = false;
    }

    for (const targetId of record.targetIds) {
        const targetEnergy = record.targets.get(targetId);
        if (!targetEnergy) continue;
        const targetEntity = targetEnergy.entity;
        if (!isPowerBeaconTarget(targetEntity) || !isInsideBeacon(record, targetEntity)) {
            unlinkTarget(record, targetId);
            continue;
        }

        const space = targetEnergy.getFreeSpace();
        if (space <= 0) continue;
        const active = activeTargets[activeCount] ?? { energy: targetEnergy, space };
        active.energy = targetEnergy;
        active.space = space;
        activeTargets[activeCount++] = active;
    }
    activeTargets.length = activeCount;

    let transferred = 0;
    for (let index = 0; index < activeCount; index++) {
        if (available <= 0 || remainingLimit <= 0) break;

        const target = activeTargets[index];
        const remainingTargets = activeCount - index;
        const fairShare = Math.max(1, Math.ceil(remainingLimit / remainingTargets));
        const amount = Math.min(target.space, available, remainingLimit, fairShare);
        if (amount <= 0) continue;

        const sent = source.transferTo(target.energy, amount);
        if (sent <= 0) continue;
        available -= sent;
        remainingLimit -= sent;
        transferred += sent;
    }

    return { transferred, targetCount: activeCount };
}

function removeEntityFromCaches(entityId) {
    pendingClassification.delete(entityId);
    unregisterPowerBeacon(entityId);

    const beaconIds = beaconIdsByTargetId.get(entityId);
    if (!beaconIds) return;
    for (const beaconId of [...beaconIds]) {
        const record = beacons.get(beaconId);
        if (record) unlinkTarget(record, entityId);
    }
    beaconIdsByTargetId.delete(entityId);
}

world.afterEvents.entitySpawn.subscribe(({ entity }) => scheduleClassification(entity));
world.afterEvents.entityLoad.subscribe(({ entity }) => scheduleClassification(entity));
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => removeEntityFromCaches(removedEntityId));

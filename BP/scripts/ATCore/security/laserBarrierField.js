// @ts-check

import { system, world } from "@minecraft/server";

export const LASER_BARRIER_FIELD_ID = "utilitycraft:laser_barrier_field";

const FIELD_MAINTENANCE_TICKS = 100;
const BLOCKED_RETRY_TICKS = 20;

const records = new Map();
const claimsByDimension = new Map();

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    const record = records.get(removedEntityId);
    if (record) releaseRecord(record);
});

export function getLaserBarrierDirection(block) {
    const direction = block?.permutation.getState("minecraft:cardinal_direction");
    return normalizeDirection(direction);
}

export function buildLaserBarrierPositions(origin, direction, length, height) {
    const forward = getForward(direction);
    if (!forward) return [];

    const normalizedLength = Math.max(1, Math.floor(Number(length) || 1));
    const normalizedHeight = Math.max(1, Math.floor(Number(height) || 1));
    const positions = new Array(normalizedLength * normalizedHeight);
    let index = 0;

    for (let vertical = 0; vertical < normalizedHeight; vertical++) {
        for (let distance = 1; distance <= normalizedLength; distance++) {
            positions[index++] = {
                x: origin.x + forward.x * distance,
                y: origin.y + vertical,
                z: origin.z + forward.z * distance,
            };
        }
    }

    return positions;
}

export function syncLaserBarrierField(entity, block, length, height) {
    const direction = getLaserBarrierDirection(block);
    if (!entity?.id || !direction) return null;

    const signature = `${direction}|${length}|${height}`;
    let record = records.get(entity.id);

    if (!record || record.signature !== signature) {
        if (record) releaseRecord(record);
        record = createRecord(entity.id, block, direction, length, height, signature);
        records.set(entity.id, record);
        claimRecord(record);
        maintainProjection(record);
        return record;
    }

    record.dimension = block.dimension;
    record.origin = { ...block.location };

    if (system.currentTick >= record.nextMaintenanceTick) {
        maintainProjection(record);
    }

    return record;
}

export function removeLaserBarrierField(entityOrId, fallback) {
    const entityId = typeof entityOrId === "string" ? entityOrId : entityOrId?.id;
    if (!entityId) return;

    const record = records.get(entityId);
    if (record) releaseRecord(record);

    if (!fallback?.dimension || !fallback?.origin) return;
    clearUnclaimedPositions(
        entityId,
        fallback.dimension,
        buildLaserBarrierPositions(
            fallback.origin,
            fallback.direction,
            fallback.length,
            fallback.height,
        ),
    );
}

export function damageLaserBarrierContacts(record, damage = 4) {
    if (!record || record.projectedKeys.size === 0) return 0;

    const box = getDamageBox(record);
    const selector = [
        `x=${formatCoordinate(box.x)}`,
        `y=${formatCoordinate(box.y)}`,
        `z=${formatCoordinate(box.z)}`,
        `dx=${formatCoordinate(box.dx)}`,
        `dy=${formatCoordinate(box.dy)}`,
        `dz=${formatCoordinate(box.dz)}`,
        "type=!minecraft:item",
        "type=!minecraft:xp_orb",
        "type=!utilitycraft:machine_entity",
        "type=!utilitycraft:power_beacon_entity",
        "type=!utilitycraft:machine_area_outline",
        "family=!inanimate",
        "family=!projectile",
        "family=!item",
    ].join(",");

    try {
        return record.dimension.runCommand(
            `damage @e[${selector}] ${Math.max(0, Number(damage) || 0)} contact`,
        ).successCount;
    } catch {
        return 0;
    }
}

function createRecord(entityId, block, direction, length, height, signature) {
    const positions = buildLaserBarrierPositions(block.location, direction, length, height);
    const positionMap = new Map();

    for (const position of positions) positionMap.set(positionKey(position), position);

    return {
        entityId,
        dimension: block.dimension,
        origin: { ...block.location },
        direction,
        forward: getForward(direction),
        length,
        height,
        signature,
        positions: positionMap,
        projectedKeys: new Set(),
        bounds: getBounds(positions),
        total: positions.length,
        projected: 0,
        blocked: 0,
        nextMaintenanceTick: system.currentTick,
    };
}

function claimRecord(record) {
    const claims = getDimensionClaims(record.dimension.id);
    for (const key of record.positions.keys()) {
        let owners = claims.get(key);
        if (!owners) {
            owners = new Set();
            claims.set(key, owners);
        }
        owners.add(record.entityId);
    }
}

function releaseRecord(record) {
    records.delete(record.entityId);
    const claims = claimsByDimension.get(record.dimension.id);

    for (const [key, position] of record.positions) {
        const owners = claims?.get(key);
        owners?.delete(record.entityId);
        if (owners?.size) continue;
        claims?.delete(key);
        clearFieldBlock(record.dimension, position);
    }

    if (claims?.size === 0) claimsByDimension.delete(record.dimension.id);
}

function maintainProjection(record) {
    record.projectedKeys.clear();
    record.projected = 0;
    record.blocked = 0;

    for (const [key, position] of record.positions) {
        const block = getBlock(record.dimension, position);
        if (!block) {
            record.blocked++;
            continue;
        }

        if (block.typeId !== LASER_BARRIER_FIELD_ID && block.isAir !== true) {
            record.blocked++;
            continue;
        }

        if (block.typeId !== LASER_BARRIER_FIELD_ID) {
            try {
                block.setType(LASER_BARRIER_FIELD_ID);
            } catch {
                record.blocked++;
                continue;
            }
        }

        record.projectedKeys.add(key);
        record.projected++;
    }

    record.nextMaintenanceTick = system.currentTick
        + (record.blocked > 0 ? BLOCKED_RETRY_TICKS : FIELD_MAINTENANCE_TICKS)
        + stableOffset(record.entityId);
}

function clearUnclaimedPositions(entityId, dimension, positions) {
    const claims = claimsByDimension.get(dimension.id);

    for (const position of positions) {
        const key = positionKey(position);
        const owners = claims?.get(key);
        owners?.delete(entityId);
        if (owners?.size) continue;
        claims?.delete(key);
        clearFieldBlock(dimension, position);
    }
}

function clearFieldBlock(dimension, position) {
    const block = getBlock(dimension, position);
    if (block?.typeId !== LASER_BARRIER_FIELD_ID) return;
    try {
        block.setType("minecraft:air");
    } catch {
        // Unloaded or invalid blocks will be reconciled on a later machine tick.
    }
}

function getDimensionClaims(dimensionId) {
    let claims = claimsByDimension.get(dimensionId);
    if (!claims) {
        claims = new Map();
        claimsByDimension.set(dimensionId, claims);
    }
    return claims;
}

function getBounds(positions) {
    if (positions.length === 0) {
        return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
    }

    let minX = positions[0].x;
    let minY = positions[0].y;
    let minZ = positions[0].z;
    let maxX = minX;
    let maxY = minY;
    let maxZ = minZ;

    for (let index = 1; index < positions.length; index++) {
        const position = positions[index];
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        minZ = Math.min(minZ, position.z);
        maxX = Math.max(maxX, position.x);
        maxY = Math.max(maxY, position.y);
        maxZ = Math.max(maxZ, position.z);
    }

    return { minX, minY, minZ, maxX, maxY, maxZ };
}

function getForward(direction) {
    if (direction === "north") return { x: 0, y: 0, z: -1 };
    if (direction === "south") return { x: 0, y: 0, z: 1 };
    if (direction === "east") return { x: 1, y: 0, z: 0 };
    if (direction === "west") return { x: -1, y: 0, z: 0 };
    return null;
}

function normalizeDirection(direction) {
    return direction === "north"
        || direction === "south"
        || direction === "east"
        || direction === "west"
        ? direction
        : null;
}

function getBlock(dimension, position) {
    try {
        return dimension.getBlock(position);
    } catch {
        return undefined;
    }
}

function positionKey(position) {
    return `${position.x}|${position.y}|${position.z}`;
}

function getDamageBox(record) {
    const { minX, minY, minZ, maxX, maxY, maxZ } = record.bounds;
    const variesAlongX = record.forward.x !== 0;

    const x = variesAlongX ? minX : minX - 0.5;
    const z = variesAlongX ? minZ - 0.5 : minZ;
    const endX = variesAlongX ? maxX + 1 : maxX + 1.5;
    const endZ = variesAlongX ? maxZ + 1.5 : maxZ + 1;

    return {
        x,
        y: minY,
        z,
        dx: endX - x,
        dy: maxY - minY + 1,
        dz: endZ - z,
    };
}

function formatCoordinate(value) {
    return Number(value.toFixed(3)).toString();
}

function stableOffset(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % 20;
}

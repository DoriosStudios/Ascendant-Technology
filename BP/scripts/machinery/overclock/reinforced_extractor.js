import { system } from "@minecraft/server";
import { FluidManager, Rotation } from "../../DoriosCore/index.js";

const DEFAULT_RATE = 4000;
const MAX_SCAN = 256;
const DEFAULT_MODE = "nearest";

const OFFSETS = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

function findFacingOffset(block) {
    const facing = block.getState("utilitycraft:axis");
    const map = {
        north: { x: 0, y: 0, z: -1 },
        south: { x: 0, y: 0, z: 1 },
        east: { x: 1, y: 0, z: 0 },
        west: { x: -1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        down: { x: 0, y: -1, z: 0 },
    };
    return map[facing] ?? { x: 0, y: 0, z: 1 };
}

const SOURCE_TANK_INDICES = [0, 1];

function resolveSourceTank(entity) {
    if (!entity) return null;

    const candidates = [];
    for (const index of SOURCE_TANK_INDICES) {
        const tank = FluidManager.findType(entity, index);
        if (!tank || tank.getCap() <= 0) continue;
        candidates.push(tank);
    }

    if (candidates.length === 0) return null;

    const withFluid = candidates.filter(tank => tank.get() > 0 && tank.getType() !== "empty");
    if (withFluid.length === 0) return candidates[0];

    const nonWater = withFluid.filter(tank => tank.getType() !== "water");
    const pool = nonWater.length ? nonWater : withFluid;

    let best = pool[0];
    for (let i = 1; i < pool.length; i++) {
        if (pool[i].get() > best.get()) best = pool[i];
    }

    return best;
}

function selectSourceFromEntities(entities) {
    if (!Array.isArray(entities) || entities.length === 0) return null;

    let best = null;
    for (const entity of entities) {
        if (!entity) continue;
        if (entity?.hasTag?.("dorios:fluid_input_only")) continue;

        const tank = resolveSourceTank(entity);
        if (!tank || tank.getCap() <= 0) continue;

        const amount = tank.get();
        const type = tank.getType();
        const hasFluid = amount > 0 && type !== "empty";

        const score = (hasFluid ? amount : 0) + (type !== "water" ? 1_000_000 : 0);
        if (!best || score > best.score) {
            best = { entity, tank, score };
        }
    }

    return best;
}

function posKey(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function isSamePos(a, b) {
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

function isTubeBlock(block) {
    if (!block) return false;
    if (block.hasTag?.("dorios:isTube")) return true;
    if (block.typeId === "utilitycraft:reinforced_cable") return true;
    if (block.typeId === "utilitycraft:reinforced_extractor") return true;
    return false;
}

function scanFluidTargets(startBlock, sourcePos) {
    const dim = startBlock.dimension;
    const queue = [startBlock.location];
    const visited = new Set();
    const rawTargets = [];
    const blockedTargets = new Set();
    let steps = 0;

    while (queue.length && steps < MAX_SCAN) {
        const pos = queue.shift();
        const key = posKey(pos);
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        const block = dim.getBlock(pos);
        if (!block || !block.hasTag("dorios:fluid")) continue;

        const isTube = isTubeBlock(block);

        if (block.typeId === "utilitycraft:reinforced_extractor") {
            const off = findFacingOffset(block);
            const frontPos = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
            blockedTargets.add(posKey(frontPos));
        }

        if (isTube) {
            for (const off of OFFSETS) {
                queue.push({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z });
            }
            continue;
        }

        rawTargets.push(pos);
    }

    return rawTargets.filter(pos => {
        if (sourcePos && isSamePos(pos, sourcePos)) return false;
        if (blockedTargets.has(posKey(pos))) return false;
        return true;
    });
}

function orderTargets(targets, origin, mode) {
    const list = Array.isArray(targets) ? [...targets] : [];
    list.sort((a, b) => DoriosAPI.math.distanceBetween(origin, a) - DoriosAPI.math.distanceBetween(origin, b));
    if (mode === "farthest") list.reverse();
    if (mode !== "round") return list;
    return list;
}

DoriosAPI.register.blockComponent("reinforced_extractor", {
    // Sem entidade própria: apenas encaminha do bloco à frente para a rede.
    beforeOnPlayerPlace(e, { params }) {
        const { block, player, permutationToPlace } = e;

        // Ensure axis/rotation state follows the player's facing.
        try {
            if (params?.rotation) {
                if (player?.isInSurvival?.()) {
                    system.run(() => player.runCommand(`clear @s ${permutationToPlace.type.id} 0 1`));
                }
                e.cancel = true;
                Rotation.facing(player, block, permutationToPlace);
            }
        } catch { /* ignore rotation issues */ }
    },
    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const rate = settings?.machine?.fluid_rate ?? DEFAULT_RATE;
        const dim = e.block.dimension;

        // ------------------------------
        // 1) Identificar fonte à frente
        // ------------------------------
        const facing = findFacingOffset(e.block);
        const srcPos = {
            x: e.block.location.x + facing.x,
            y: e.block.location.y + facing.y,
            z: e.block.location.z + facing.z,
        };

        const sourceBlock = dim.getBlock(srcPos);
        const sourceEntities = dim.getEntitiesAtBlockLocation(srcPos);
        const sourcePick = selectSourceFromEntities(sourceEntities ?? []);
        const sourceEntity = sourcePick?.entity ?? null;

        let fluidSource = null;      // FluidManager quando for entidade
        let liquidType = null;
        let amount = 0;
        let infinite = false;

        const vanillaFluids = {
            "minecraft:water": "water",
            "minecraft:lava": "lava",
        };

        const sourceTank = sourcePick?.tank ?? null;

        if (sourceTank) {
            // Tanque/contêiner de fluido (entidade)
            fluidSource = sourceTank;
            liquidType = fluidSource.getType();
            amount = fluidSource.get();
        } else if (sourceBlock && vanillaFluids[sourceBlock.typeId]) {
            // Fluido vanilla (apenas bloco cheio)
            if (sourceBlock.permutation.getState("liquid_depth") !== 0) return;
            liquidType = vanillaFluids[sourceBlock.typeId];
            amount = 1000;
        } else if (sourceBlock?.typeId === "utilitycraft:crucible") {
            // Crisol com lava (alinha com UtilityCraft)
            const lavaLevel = sourceBlock.permutation.getState("utilitycraft:lava");
            if (lavaLevel < 1) return;
            liquidType = "lava";
            amount = 250 * lavaLevel;
        } else if (sourceBlock?.typeId === "utilitycraft:sink") {
            // Pia com água infinita
            liquidType = "water";
            amount = Infinity;
            infinite = true;
        } else if (sourceBlock?.hasTag?.("dorios:fluid")) {
            // Bloco de fluido Dorios sem entidade → nada para extrair
            return;
        } else {
            return; // Fonte inválida
        }

        if (!liquidType || amount <= 0) return;

        // ------------------------------
        // 2) Encontrar alvos na rede
        // ------------------------------
        const targets = scanFluidTargets(e.block, srcPos);
        if (targets.length === 0) return;

        const extractorEntity = dim.getEntitiesAtBlockLocation(e.block.location)[0];
        const mode = extractorEntity?.getDynamicProperty?.("transferMode") ?? DEFAULT_MODE;
        const orderedTargets = orderTargets(targets, e.block.location, mode);

        // ------------------------------
        // 3) Transferir
        // ------------------------------
        let transferred = 0;

        if (fluidSource) {
            transferred = fluidSource.transferToNetwork(rate, mode, orderedTargets);
        } else {
            let remaining = Math.min(rate, infinite ? rate : amount);

            for (const loc of orderedTargets) {
                if (remaining <= 0) break;

                const targetBlock = dim.getBlock(loc);
                if (!targetBlock?.hasTag("dorios:fluid")) continue;

                let targetEntity = null;
                const candidates = dim.getEntitiesAtBlockLocation(loc);
                if (Array.isArray(candidates) && candidates.length) {
                    for (const candidate of candidates) {
                        const tank = FluidManager.findType(candidate, 0);
                        if (!tank || tank.getCap() <= 0) continue;
                        targetEntity = candidate;
                        break;
                    }
                }

                if (!targetEntity && targetBlock.typeId.includes("fluid_tank")) {
                    targetEntity = FluidManager.addfluidToTank(targetBlock, liquidType, 0);
                }

                if (!targetEntity) continue;

                const targetTank = FluidManager.findType(targetEntity, 0);
                if (!targetTank || targetTank.getCap() <= 0) continue;

                const targetType = targetTank.getType();
                if (targetType !== "empty" && targetType !== liquidType) continue;

                const space = targetTank.getFreeSpace();
                if (space <= 0) continue;

                const move = Math.min(remaining, space);
                if (move <= 0) continue;

                const inserted = targetTank.tryInsert(liquidType, move);
                if (!inserted) continue;

                remaining -= move;
                transferred += move;
            }
        }

        // ------------------------------
        // 4) Atualizar fonte finita
        // ------------------------------
        if (!infinite && transferred > 0) {
            if (fluidSource) {
                // já debitado
            } else if (sourceBlock && vanillaFluids[sourceBlock.typeId]) {
                sourceBlock.setType("minecraft:air");
            } else if (sourceBlock?.typeId === "utilitycraft:crucible") {
                sourceBlock.setPermutation(sourceBlock.permutation.withState("utilitycraft:lava", 0));
            }
        }
    },
});

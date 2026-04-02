import { Machine, Energy, FluidManager, getCachedBlockEntity } from "../../DoriosCore/index.js";

const OVERCLOCK = Object.freeze({
    offsets: Object.freeze([
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ]),
    props: Object.freeze({
        level: "dorios:overclock_level",
        ttl: "dorios:overclock_ttl",
        effectiveness: "dorios:overclock_eff",
        heat: "dorios:overclock_heat",
        fuel: "dorios:oc_fuel",
        towerNeed: "dorios:oc_energy_need"
    }),
    limits: Object.freeze({
        maxScanNodes: 96,
        ttl: 6
    }),
    relay: Object.freeze({
        energyTransfer: 20000,
        energyDistribution: 20000
    }),
    tower: Object.freeze({
        baseEnergyCost: 32000,
        fuelSlots: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10])
    }),

/**
 * Fuel registry for the Overclock Tower. Extendable for future items.
 * - duration: ticks of overclock generation per item consumed.
 * - power: overclock level contributed while burning.
 * - effectiveness: multiplier applied when this fuel is active.
 */
    fuels: Object.freeze({
    "utilitycraft:titanium": {
        duration: 500,
        power: 1,
        effectiveness: 1.25,
    },
    "minecraft:copper_ingot": {
        duration: 400,
        power: 0.5,
        effectiveness: 2.0,
    },
    "utilitycraft:energized_iron_ingot": {
        duration: 50,
        power: 3,
        effectiveness: 1.5,
    },
    }),
    cooling: Object.freeze({
        cryoDrainPerTick: 120,
        waterDrainPerTick: 240,
        meltHeatThreshold: 32
    })
});

function key(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function getNeighbors(pos) {
    return OVERCLOCK.offsets.map(off => ({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z }));
}

function blockIsNetwork(block) {
    if (!block) return false;
    return block.hasTag("dorios:overclock_network") || block.typeId === "utilitycraft:reinforced_cable";
}

function blockIsSource(block) {
    if (!block) return false;
    return block.hasTag("dorios:overclock_source") || block.typeId === "utilitycraft:overclock_tower";
}

function readBlockOverclock(block) {
    if (!block) return { level: 0, effectiveness: 0 };
    const entity = getCachedBlockEntity(block);
    if (!entity?.isValid) return { level: 0, effectiveness: 0 };
    const level = Number(entity.getDynamicProperty(OVERCLOCK.props.level) ?? 0);
    const effectiveness = Number(entity.getDynamicProperty(OVERCLOCK.props.effectiveness) ?? 0);
    return { level, effectiveness };
}

function scanForOverclockSource(block) {
    const dim = block.dimension;
    const start = block.location;
    const queue = [start];
    const visited = new Set();
    let best = { level: 0, effectiveness: 0, pos: null };
    let steps = 0;

    while (queue.length && steps < OVERCLOCK.limits.maxScanNodes) {
        const pos = queue.shift();
        const k = key(pos);
        if (visited.has(k)) continue;
        visited.add(k);
        steps++;

        const node = dim.getBlock(pos);
        if (!node || !blockIsNetwork(node)) continue;

        const data = readBlockOverclock(node);
        if (data.level > best.level || (data.level === best.level && data.effectiveness > best.effectiveness)) {
            best = { level: data.level, effectiveness: data.effectiveness, pos: { ...pos } };
            if (blockIsSource(node)) break; // prefer direct sources
        }

        for (const next of getNeighbors(pos)) {
            if (!visited.has(key(next))) queue.push(next);
        }
    }

    return best;
}

function collectOverclockTargets(startBlock) {
    const dim = startBlock.dimension;
    const start = startBlock.location;
    const queue = [start];
    const visited = new Set();
    const machineKeys = new Set();
    const machines = [];
    let steps = 0;

    while (queue.length && steps < OVERCLOCK.limits.maxScanNodes) {
        const pos = queue.shift();
        const k = key(pos);
        if (visited.has(k)) continue;
        visited.add(k);
        steps++;

        const node = dim.getBlock(pos);
        if (!node || !blockIsNetwork(node)) continue;

        for (const next of getNeighbors(pos)) {
            if (!visited.has(key(next))) queue.push(next);
        }

        for (const off of OVERCLOCK.offsets) {
            const adjPos = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
            const adjBlock = dim.getBlock(adjPos);
            if (!adjBlock?.hasTag("dorios:machine")) continue;
            if (adjBlock.hasTag("dorios:overclock_network")) continue;

            const entity = getCachedBlockEntity(adjBlock);
            if (!entity) continue;

            const tf = entity.getComponent?.("minecraft:type_family");
            if (!tf?.hasTypeFamily?.("dorios:machine")) continue;
            if (tf.hasTypeFamily?.("dorios:energy_source")) continue;

            const uniqueKey = entity.scoreboardIdentity?.id ?? key(adjPos);
            if (machineKeys.has(uniqueKey)) continue;
            machineKeys.add(uniqueKey);
            machines.push(entity);
        }
    }

    return machines;
}

function applyOverclockToNetworkMachines(block, level, effectiveness) {
    if (level <= 0 || effectiveness <= 0) return 0;
    const targets = collectOverclockTargets(block);
    for (const entity of targets) {
        setOverclockOnEntity(entity, level, effectiveness);
    }
    return targets.length;
}

function collectEnergyTargets(startBlock, sourceEntity) {
    const dim = startBlock.dimension;
    const start = startBlock.location;
    const queue = [start];
    const visited = new Set();
    const entityKeys = new Set();
    const targets = [];
    let steps = 0;

    while (queue.length && steps < OVERCLOCK.limits.maxScanNodes) {
        const pos = queue.shift();
        const k = key(pos);
        if (visited.has(k)) continue;
        visited.add(k);
        steps++;

        const node = dim.getBlock(pos);
        if (!node || !blockIsNetwork(node)) continue;

        for (const next of getNeighbors(pos)) {
            if (!visited.has(key(next))) queue.push(next);
        }

        for (const off of OVERCLOCK.offsets) {
            const adjPos = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
            const adjBlock = dim.getBlock(adjPos);
            if (!adjBlock?.hasTag("dorios:energy")) continue;
            const isTower = adjBlock.typeId === "utilitycraft:overclock_tower";
            if (adjBlock.hasTag("dorios:overclock_network") && !isTower) continue;

            const entity = getCachedBlockEntity(adjBlock);
            if (!entity || entity === sourceEntity) continue;

            const tf = entity.getComponent?.("minecraft:type_family");
            if (!tf?.hasTypeFamily?.("dorios:energy_container")) continue;
            if (tf.hasTypeFamily?.("dorios:energy_source")) continue;

            if (adjBlock.typeId === "utilitycraft:overclock_tower") {
                let shouldCharge = false;
                try {
                    const need = Number(entity.getDynamicProperty(OVERCLOCK.props.towerNeed) ?? 0);
                    if (Number.isFinite(need) && need > 0) {
                        const towerEnergy = new Energy(entity);
                        shouldCharge = towerEnergy.get() < need;
                    }
                } catch {
                    shouldCharge = false;
                }

                if (!shouldCharge) continue;
            }

            const uniqueKey = entity.scoreboardIdentity?.id ?? key(adjPos);
            if (entityKeys.has(uniqueKey)) continue;
            entityKeys.add(uniqueKey);
            targets.push(entity);
        }
    }

    return targets;
}

function distributeRelayEnergy(relayEntity, block) {
    if (!relayEntity || !block) return 0;
    const relayEnergy = new Energy(relayEntity);
    let available = relayEnergy.get();
    if (available <= 0) return 0;

    let remaining = Math.min(available, OVERCLOCK.relay.energyDistribution);
    const targets = collectEnergyTargets(block, relayEntity);
    if (targets.length === 0) return 0;

    targets.sort((a, b) => DoriosAPI.math.distanceBetween(relayEntity.location, a.location)
        - DoriosAPI.math.distanceBetween(relayEntity.location, b.location));

    let transferred = 0;
    for (const target of targets) {
        if (remaining <= 0) break;
        const energy = new Energy(target);
        const space = energy.getFreeSpace();
        if (space <= 0) continue;
        const send = Math.min(space, remaining);
        const sent = relayEnergy.transferTo(energy, send);
        if (sent > 0) {
            remaining -= sent;
            transferred += sent;
        }
    }

    return transferred;
}

function collectRelaysFrom(block) {
    const dim = block.dimension;
    const start = block.location;
    const queue = [start];
    const visited = new Set();
    const relays = [];
    let steps = 0;

    while (queue.length && steps < OVERCLOCK.limits.maxScanNodes) {
        const pos = queue.shift();
        const k = key(pos);
        if (visited.has(k)) continue;
        visited.add(k);
        steps++;

        const node = dim.getBlock(pos);
        if (!node || !blockIsNetwork(node)) continue;

        if (node.typeId === "utilitycraft:overclock_relay") {
            const ent = getCachedBlockEntity(node);
            if (ent) relays.push(ent);
        }

        for (const next of getNeighbors(pos)) {
            if (!visited.has(key(next))) queue.push(next);
        }
    }

    return relays;
}

function setOverclockOnEntity(entity, level, effectiveness) {
    if (!entity) return;
    const eff = Math.max(0, effectiveness ?? 0);
    const lvl = Math.max(0, level ?? 0);
    const currentLevel = Number(entity.getDynamicProperty(OVERCLOCK.props.level) ?? 0);
    const currentEffectiveness = Number(entity.getDynamicProperty(OVERCLOCK.props.effectiveness) ?? 0);
    const currentTtl = Number(entity.getDynamicProperty(OVERCLOCK.props.ttl) ?? 0);

    if (currentLevel !== lvl) {
        entity.setDynamicProperty(OVERCLOCK.props.level, lvl);
    }

    if (currentEffectiveness !== eff) {
        entity.setDynamicProperty(OVERCLOCK.props.effectiveness, eff);
    }

    if (currentLevel !== lvl || currentEffectiveness !== eff || currentTtl <= 2) {
        entity.setDynamicProperty(OVERCLOCK.props.ttl, OVERCLOCK.limits.ttl);
    }
}

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

function applyOverclockToTarget(block, level, effectiveness) {
    if (level <= 0 || effectiveness <= 0) return false;

    const dim = block.dimension;
    const off = findFacingOffset(block);
    const targetPos = { x: block.location.x + off.x, y: block.location.y + off.y, z: block.location.z + off.z };
    const targetBlock = dim.getBlock(targetPos);
    if (!targetBlock?.hasTag("dorios:machine")) return false;

    const entity = getCachedBlockEntity(targetBlock);
    const family = entity?.getComponent("minecraft:type_family");
    if (family?.hasTypeFamily("dorios:energy_source")) return false; // skip generators
    if (!entity) return false;

    const current = Number(entity.getDynamicProperty(OVERCLOCK.props.level) ?? 0);
    const nextLevel = Math.max(current, level * effectiveness);
    setOverclockOnEntity(entity, nextLevel, effectiveness);
    return true;
}

function updateHeat(entity, delta) {
    if (!entity) return 0;
    const current = Number(entity.getDynamicProperty(OVERCLOCK.props.heat) ?? 0);
    const next = Math.max(0, current + delta);
    if (next !== current) {
        entity.setDynamicProperty(OVERCLOCK.props.heat, next);
    }
    return next;
}

function getPossibleFuels(fuelsRegistry) {
    // Return a list of the possible fuels for tower, with bonus values on display
    /*
    * example: (on display)
    *
    * Titanium Ingot (formatted)
    *   +0.350 Speed
    *   +1.25 Efficiency
    * 
    * Copper Ingot (formatted)
    *   +0.156 Speed
    *   +0.50 Efficiency
    * 
    * etc...
    */
    const possible_fuels = [];
    const registry = fuelsRegistry && typeof fuelsRegistry === "object"
        ? fuelsRegistry
        : {};

    for (const [itemId, fuelData] of Object.entries(registry)) {
        if (!fuelData || typeof fuelData !== "object") continue;

        const power = Number(fuelData.power ?? 0);
        const effectiveness = Number(fuelData.effectiveness ?? 0);

        if (!Number.isFinite(power) || power <= 0) continue;
        if (!Number.isFinite(effectiveness) || effectiveness <= 0) continue;

        const itemName = DoriosAPI.utils.formatIdToText(itemId);
        const effectiveEffectiveness = Math.max(1, effectiveness);
        const strength = power * effectiveEffectiveness;
        const speedBonus = (0.35 * strength).toFixed(3);
        const consumption = 1 + (0.25 * strength);
        const efficiencyLoss = (100 - (100 / consumption)).toFixed(1);

        possible_fuels.push(`§r§e${itemName}`);
        possible_fuels.push(`§r§7  +${speedBonus} Speed`);
        possible_fuels.push(`§r§7  -${efficiencyLoss}%% Efficiency`);
    }
    return possible_fuels;
}

function buildActiveFuelLore(entries, effectiveEffectiveness, maxEffectiveness) {
    if (!Array.isArray(entries) || entries.length <= 1) return [];
    const effValue = Number(effectiveEffectiveness);
    if (!Number.isFinite(effValue) || effValue <= 0) return [];

    const totals = new Map();
    for (const entry of entries) {
        if (!entry) continue;
        const key = entry.itemId || `slot_${entry.slot}`;
        const existing = totals.get(key) ?? {
            itemId: entry.itemId || "",
            slot: entry.slot,
            power: 0,
            effectiveness: entry.effectiveness
        };

        existing.power += Number(entry.power ?? 0) || 0;
        if (Number.isFinite(entry.effectiveness)) {
            existing.effectiveness = Math.max(existing.effectiveness ?? 0, entry.effectiveness);
        }
        totals.set(key, existing);
    }

    const lines = [`§r§6Fuel Contributions (Eff x${effValue.toFixed(2)})`];
    const ordered = [...totals.values()].sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    const maxEff = Number.isFinite(maxEffectiveness) ? maxEffectiveness : 0;
    const effEpsilon = 0.0001;

    for (const entry of ordered) {
        const name = entry.itemId
            ? DoriosAPI.utils.formatIdToText(entry.itemId)
            : `Fuel Slot ${entry.slot}`;
        const strength = (Number(entry.power ?? 0) || 0) * effValue;
        const speedBonus = (0.35 * strength).toFixed(3);
        const effNote = Math.abs((entry.effectiveness ?? 0) - maxEff) <= effEpsilon ? " (max)" : "";

        lines.push(`§r§e${name}`);
        lines.push(`§r§7  +${speedBonus} Speed`);
        lines.push(`§r§7  Eff x${Number(entry.effectiveness ?? 0).toFixed(2)}${effNote}`);
    }

    return lines;
}

function meltBlock(block) {
    const dim = block.dimension;
    const event = {
        block,
        brokenBlockPermutation: block.permutation,
        player: null,
        dimension: dim,
    };
    try {
        Machine.onDestroy(event);
    } catch { /* noop */ }

    dim.playSound?.("random.anvil_break", block.center(), { volume: 1, pitch: 0.8 });
    dim.setBlockType(block.location, "minecraft:air");
    dim.updatePipes?.(block.location);
}

function drainCoolant(entity, type) {
    if (!entity) return { ok: false, eff: 0 };
    try {
        const fluid = new FluidManager(entity, 0);
        const current = fluid.get();
        if (current <= 0) return { ok: false, eff: 0 };

        if (type === "cryofluid") {
            if (current < OVERCLOCK.cooling.cryoDrainPerTick) return { ok: false, eff: 0 };
            fluid.add(-OVERCLOCK.cooling.cryoDrainPerTick);
            return { ok: true, eff: 1 };
        }
        if (type === "water") {
            if (current < OVERCLOCK.cooling.waterDrainPerTick) return { ok: false, eff: 0 };
            fluid.add(-OVERCLOCK.cooling.waterDrainPerTick);
            return { ok: true, eff: 0.5 };
        }
    } catch { /* ignore fluid errors */ }
    return { ok: false, eff: 0 };
}

DoriosAPI.register.blockComponent("overclock_tower", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, (entity) => {
            entity.setDynamicProperty(OVERCLOCK.props.level, 0);
            entity.setDynamicProperty(OVERCLOCK.props.effectiveness, 0);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;
        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const inv = machine.inv;
        if (!inv) return;

        let totalPower = 0;
        let maxEffectiveness = 0;
        let activeBurns = 0;
        const activeFuelEntries = [];

        for (const slot of OVERCLOCK.tower.fuelSlots) {
            const burnKey = `dorios:oc_burn_${slot}`;
            const powerKey = `dorios:oc_power_${slot}`;
            const effKey = `dorios:oc_eff_${slot}`;
            const fuelIdKey = `${OVERCLOCK.props.fuel}_${slot}`;

            try {
                let burn = Number(machine.entity.getDynamicProperty(burnKey) ?? 0);
                let power = Number(machine.entity.getDynamicProperty(powerKey) ?? 0);
                let eff = Number(machine.entity.getDynamicProperty(effKey) ?? 0);
                let fuelId = machine.entity.getDynamicProperty(fuelIdKey);
                if (typeof fuelId !== "string") fuelId = "";

                // Guard against invalid slot indexes to avoid container bounds errors.
                if (slot < 0 || slot >= inv.size) {
                    machine.entity.setDynamicProperty(burnKey, 0);
                    machine.entity.setDynamicProperty(powerKey, 0);
                    machine.entity.setDynamicProperty(effKey, 0);
                    machine.entity.setDynamicProperty(fuelIdKey, "");
                    continue;
                }

                if (burn <= 0) {
                    const stack = inv.getItem(slot);
                    const fuel = stack ? OVERCLOCK.fuels[stack.typeId] : undefined;

                    if (!stack || stack.amount <= 0) {
                        machine.entity.setDynamicProperty(burnKey, 0);
                        machine.entity.setDynamicProperty(powerKey, 0);
                        machine.entity.setDynamicProperty(effKey, 0);
                        machine.entity.setDynamicProperty(fuelIdKey, "");
                        continue;
                    }

                    if (!fuel) {
                        machine.entity.setDynamicProperty(powerKey, 0);
                        machine.entity.setDynamicProperty(effKey, 0);
                        machine.entity.setDynamicProperty(fuelIdKey, "");
                        continue;
                    }

                    const duration = Math.max(1, Math.floor(fuel.duration ?? 0));
                    power = Number(fuel.power ?? 0) || 0;
                    eff = Number(fuel.effectiveness ?? 1) || 0;

                    if (duration <= 0 || power <= 0 || eff <= 0) {
                        machine.entity.setDynamicProperty(powerKey, 0);
                        machine.entity.setDynamicProperty(effKey, 0);
                        machine.entity.setDynamicProperty(fuelIdKey, "");
                        continue;
                    }

                    burn = duration;
                    fuelId = stack.typeId;
                    machine.entity.setDynamicProperty(fuelIdKey, fuelId);

                    // consume one item
                    stack.amount -= 1;
                    if (stack.amount <= 0) {
                        inv.setItem(slot, undefined);
                    } else {
                        inv.setItem(slot, stack);
                    }
                } else {
                    burn -= 1;
                }

                machine.entity.setDynamicProperty(burnKey, burn);
                machine.entity.setDynamicProperty(powerKey, power);
                machine.entity.setDynamicProperty(effKey, eff);

                if (burn > 0 && power > 0 && eff > 0) {
                    totalPower += power;
                    maxEffectiveness = Math.max(maxEffectiveness, eff);
                    activeBurns++;

                    if (!fuelId) {
                        const stack = inv.getItem(slot);
                        if (stack?.typeId) fuelId = stack.typeId;
                    }

                    activeFuelEntries.push({
                        itemId: fuelId,
                        power,
                        effectiveness: eff,
                        slot
                    });
                }
            } catch {
                // Ignore transient slot errors (e.g., invalid amounts) to keep the tower running.
                machine.entity.setDynamicProperty(burnKey, 0);
                machine.entity.setDynamicProperty(powerKey, 0);
                machine.entity.setDynamicProperty(effKey, 0);
                machine.entity.setDynamicProperty(fuelIdKey, "");
                continue;
            }
        }

        if (totalPower <= 0 || activeBurns <= 0) {
            machine.showWarning("Insert Fuel", false, getPossibleFuels(OVERCLOCK.fuels), { footerLines: ["Needs Overclock Fuel"] });
            machine.entity.setDynamicProperty(OVERCLOCK.props.level, 0);
            machine.entity.setDynamicProperty(OVERCLOCK.props.towerNeed, 0);
            machine.off();
            return;
        }

        const energyCost = Math.ceil(OVERCLOCK.tower.baseEnergyCost * Math.max(1, totalPower / 2));
        machine.entity.setDynamicProperty(OVERCLOCK.props.towerNeed, energyCost);
        if (machine.energy.get() < energyCost) {
            machine.showWarning("Low Energy", false, [], { footerLines: ["Insufficient power"] });
            machine.entity.setDynamicProperty(OVERCLOCK.props.level, 0);
            machine.off();
            return;
        }

        machine.energy.consume(energyCost);
        machine.addProgress(energyCost);

        // Share leftover energy with relays on the same overclock network (no extra cables needed)
        try {
            const relays = collectRelaysFrom(e.block);
            let available = machine.energy.get();
            for (const relay of relays) {
                if (available <= 0) break;
                const relayEnergy = new Energy(relay);
                const free = relayEnergy.getFreeSpace();
                if (free <= 0) continue;
                const send = Math.min(OVERCLOCK.relay.energyTransfer, free, available);
                const sent = machine.energy.transferToEntity(relay, send);
                available -= sent;
            }
        } catch { /* ignore energy share errors */ }

        const effectiveEffectiveness = Math.max(maxEffectiveness, 1);
        const fuelLore = buildActiveFuelLore(activeFuelEntries, effectiveEffectiveness, maxEffectiveness);
        setOverclockOnEntity(machine.entity, totalPower, effectiveEffectiveness);
        machine.showStatus("Overclock Charge", fuelLore, { footerLines: [`Level ${totalPower.toFixed(2)}`] });
        machine.displayEnergy();
        machine.displayOverclock();
        machine.on();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

DoriosAPI.register.blockComponent("overclock_relay", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, (entity) => {
            entity.setDynamicProperty(OVERCLOCK.props.level, 0);
            entity.setDynamicProperty(OVERCLOCK.props.effectiveness, 0);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;
        const machine = new Machine(e.block, settings, true);
        if (!machine?.entity) return;

        const source = scanForOverclockSource(e.block);
        const level = Number(source.level ?? 0);
        const effectiveness = Number.isFinite(source.effectiveness) && source.effectiveness > 0
            ? source.effectiveness
            : 1;

        setOverclockOnEntity(machine.entity, level, level > 0 ? effectiveness : 0);

        if (level > 0) {
            applyOverclockToNetworkMachines(e.block, level, effectiveness);
            machine.on();
        } else {
            machine.off();
        }

        distributeRelayEnergy(machine.entity, e.block);

        machine.displayEnergy?.();
        machine.displayOverclock?.();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

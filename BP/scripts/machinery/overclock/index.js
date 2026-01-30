import { Machine, Energy, FluidManager } from "../managers_extra.js";

const OFFSETS = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

const LEVEL_PROP = "dorios:overclock_level";
const TTL_PROP = "dorios:overclock_ttl";
const EFF_PROP = "dorios:overclock_eff";
const HEAT_PROP = "dorios:overclock_heat";
const FUEL_PROP = "dorios:oc_fuel";

const MAX_SCAN_NODES = 96;
const OVERCLOCK_TTL = 6;

const RELAY_ENERGY_TRANSFER = 20000; // DE/tick max sent from tower to each relay
const RELAY_ENERGY_DISTRIBUTION = 20000; // DE/tick max sent from relay to network machines

const TOWER_BASE_ENERGY_COST = 32000;
const TOWER_FUEL_SLOTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Fuel registry for the Overclock Tower. Extendable for future items.
 * - duration: ticks of overclock generation per item consumed.
 * - power: overclock level contributed while burning.
 * - effectiveness: multiplier applied when this fuel is active.
 */
const OVERCLOCK_FUELS = {
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
};

const CRYO_DRAIN_PER_TICK = 120;
const WATER_DRAIN_PER_TICK = 240;
const OVERHEAT_WARNING_THRESHOLD = 32;
const MELT_HEAT_THRESHOLD = 42;

function key(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function getNeighbors(pos) {
    return OFFSETS.map(off => ({ x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z }));
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
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity?.isValid) return { level: 0, effectiveness: 0 };
    const level = Number(entity.getDynamicProperty(LEVEL_PROP) ?? 0);
    const effectiveness = Number(entity.getDynamicProperty(EFF_PROP) ?? 0);
    return { level, effectiveness };
}

function scanForOverclockSource(block) {
    const dim = block.dimension;
    const start = block.location;
    const queue = [start];
    const visited = new Set();
    let best = { level: 0, effectiveness: 0, pos: null };
    let steps = 0;

    while (queue.length && steps < MAX_SCAN_NODES) {
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

    while (queue.length && steps < MAX_SCAN_NODES) {
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

        for (const off of OFFSETS) {
            const adjPos = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
            const adjBlock = dim.getBlock(adjPos);
            if (!adjBlock?.hasTag("dorios:machine")) continue;
            if (adjBlock.hasTag("dorios:overclock_network")) continue;

            const entities = dim.getEntitiesAtBlockLocation(adjPos);
            if (!Array.isArray(entities) || entities.length === 0) continue;

            for (const entity of entities) {
                const tf = entity?.getComponent?.("minecraft:type_family");
                if (!tf?.hasTypeFamily?.("dorios:machine")) continue;
                if (tf.hasTypeFamily?.("dorios:energy_source")) continue;

                const uniqueKey = entity.scoreboardIdentity?.id ?? key(adjPos);
                if (machineKeys.has(uniqueKey)) continue;
                machineKeys.add(uniqueKey);
                machines.push(entity);
            }
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

    while (queue.length && steps < MAX_SCAN_NODES) {
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

        for (const off of OFFSETS) {
            const adjPos = { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z };
            const adjBlock = dim.getBlock(adjPos);
            if (!adjBlock?.hasTag("dorios:energy")) continue;
            if (adjBlock.hasTag("dorios:overclock_network")) continue;

            const entities = dim.getEntitiesAtBlockLocation(adjPos);
            if (!Array.isArray(entities) || entities.length === 0) continue;

            for (const entity of entities) {
                if (!entity || entity === sourceEntity) continue;
                const tf = entity.getComponent?.("minecraft:type_family");
                if (!tf?.hasTypeFamily?.("dorios:energy_container")) continue;
                if (tf.hasTypeFamily?.("dorios:energy_source")) continue;

                const uniqueKey = entity.scoreboardIdentity?.id ?? key(adjPos);
                if (entityKeys.has(uniqueKey)) continue;
                entityKeys.add(uniqueKey);
                targets.push(entity);
            }
        }
    }

    return targets;
}

function distributeRelayEnergy(relayEntity, block) {
    if (!relayEntity || !block) return 0;
    const relayEnergy = new Energy(relayEntity);
    let available = relayEnergy.get();
    if (available <= 0) return 0;

    let remaining = Math.min(available, RELAY_ENERGY_DISTRIBUTION);
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

    while (queue.length && steps < MAX_SCAN_NODES) {
        const pos = queue.shift();
        const k = key(pos);
        if (visited.has(k)) continue;
        visited.add(k);
        steps++;

        const node = dim.getBlock(pos);
        if (!node || !blockIsNetwork(node)) continue;

        if (node.typeId === "utilitycraft:overclock_relay") {
            const ent = dim.getEntitiesAtBlockLocation(pos)[0];
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
    entity.setDynamicProperty(LEVEL_PROP, lvl);
    entity.setDynamicProperty(EFF_PROP, eff);
    entity.setDynamicProperty(TTL_PROP, OVERCLOCK_TTL);
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

    const entity = dim.getEntitiesAtBlockLocation(targetPos)[0];
    const family = entity?.getComponent("minecraft:type_family");
    if (family?.hasTypeFamily("dorios:energy_source")) return false; // skip generators
    if (!entity) return false;

    const current = Number(entity.getDynamicProperty(LEVEL_PROP) ?? 0);
    const nextLevel = Math.max(current, level * effectiveness);
    setOverclockOnEntity(entity, nextLevel, effectiveness);
    return true;
}

function updateHeat(entity, delta) {
    if (!entity) return 0;
    const current = Number(entity.getDynamicProperty(HEAT_PROP) ?? 0);
    const next = Math.max(0, current + delta);
    entity.setDynamicProperty(HEAT_PROP, next);
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
            if (current < CRYO_DRAIN_PER_TICK) return { ok: false, eff: 0 };
            fluid.add(-CRYO_DRAIN_PER_TICK);
            return { ok: true, eff: 1 };
        }
        if (type === "water") {
            if (current < WATER_DRAIN_PER_TICK) return { ok: false, eff: 0 };
            fluid.add(-WATER_DRAIN_PER_TICK);
            return { ok: true, eff: 0.5 };
        }
    } catch { /* ignore fluid errors */ }
    return { ok: false, eff: 0 };
}

DoriosAPI.register.blockComponent("overclock_tower", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, (entity) => {
            entity.setDynamicProperty(LEVEL_PROP, 0);
            entity.setDynamicProperty(EFF_PROP, 0);
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

        for (const slot of TOWER_FUEL_SLOTS) {
            const burnKey = `dorios:oc_burn_${slot}`;
            const powerKey = `dorios:oc_power_${slot}`;
            const effKey = `dorios:oc_eff_${slot}`;
            const fuelIdKey = `${FUEL_PROP}_${slot}`;

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
                    const fuel = stack ? OVERCLOCK_FUELS[stack.typeId] : undefined;

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
            machine.showWarning("Insert Fuel", false, getPossibleFuels(OVERCLOCK_FUELS), { footerLines: ["Needs Overclock Fuel"] });
            machine.entity.setDynamicProperty(LEVEL_PROP, 0);
            machine.off();
            return;
        }

        const energyCost = Math.ceil(TOWER_BASE_ENERGY_COST * Math.max(1, totalPower / 2));
        if (machine.energy.get() < energyCost) {
            machine.showWarning("Low Energy", false, [], { footerLines: ["Insufficient power"] });
            machine.entity.setDynamicProperty(LEVEL_PROP, 0);
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
                const send = Math.min(RELAY_ENERGY_TRANSFER, free, available);
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
            entity.setDynamicProperty(LEVEL_PROP, 0);
            entity.setDynamicProperty(EFF_PROP, 0);
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

DoriosAPI.register.blockComponent("overclock_injector", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, (entity) => {
            entity.setDynamicProperty(HEAT_PROP, 0);
            entity.setDynamicProperty(LEVEL_PROP, 0);
            entity.setDynamicProperty(EFF_PROP, 0);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;
        const machine = new Machine(e.block, settings, true);
        if (!machine?.entity) return;

        // Scan for overclock source in the network
        const source = scanForOverclockSource(e.block);
        const level = Number(source.level ?? 0);
        const effectiveness = Number.isFinite(source.effectiveness) && source.effectiveness > 0
            ? source.effectiveness
            : 1;

        // Store the overclock data on the injector entity
        setOverclockOnEntity(machine.entity, level, level > 0 ? effectiveness : 0);

        // Heat management and coolant consumption
        let currentHeat = Number(machine.entity.getDynamicProperty(HEAT_PROP) ?? 0);
        let overheating = false;
        let coolantStatus = "§cNo Coolant";
        let coolantEffectiveness = 0;

        if (level > 0) {
            // Try to drain coolant
            const fluid = new FluidManager(machine.entity, 0);
            const fluidType = fluid.getType();
            const fluidAmount = fluid.get();

            let coolantOk = false;

            if (fluidType === "utilitycraft:cryofluid" && fluidAmount >= CRYO_DRAIN_PER_TICK) {
                fluid.add(-CRYO_DRAIN_PER_TICK);
                coolantEffectiveness = 1.0;
                coolantOk = true;
                coolantStatus = "§bCryofluid (100%)";
            } else if (fluidType === "minecraft:water" && fluidAmount >= WATER_DRAIN_PER_TICK) {
                fluid.add(-WATER_DRAIN_PER_TICK);
                coolantEffectiveness = 0.5;
                coolantOk = true;
                coolantStatus = "§9Water (50%)";
            }

            if (coolantOk) {
                // Reduce heat when coolant is present
                currentHeat = Math.max(0, currentHeat - 2);
            } else {
                // Increase heat when no coolant
                currentHeat += level * 0.5;
            }

            // Check if overheating
            if (currentHeat >= OVERHEAT_WARNING_THRESHOLD) {
                overheating = true;
                e.block.setBlockState("utilitycraft:overheating", true);
                
                // Melt the block if heat reaches critical threshold
                if (currentHeat >= MELT_HEAT_THRESHOLD) {
                    meltBlock(e.block);
                    return;
                }
            } else {
                e.block.setBlockState("utilitycraft:overheating", false);
            }

            // Apply overclock to the facing machine
            const applied = applyOverclockToTarget(e.block, level, effectiveness * coolantEffectiveness);

            if (applied) {
                machine.on();
            } else {
                machine.off();
            }
        } else {
            // No overclock available, cool down gradually
            currentHeat = Math.max(0, currentHeat - 1);
            machine.off();
            e.block.setBlockState("utilitycraft:overheating", false);
        }

        machine.entity.setDynamicProperty(HEAT_PROP, currentHeat);

        // Display status
        const statusLines = [
            `§r§7Overclock Level: §e${level.toFixed(2)}`,
            `§r§7Effectiveness: §e${(effectiveness * 100).toFixed(0)}%`,
            `§r§7Coolant: ${coolantStatus}`,
            `§r§7Heat: §${overheating ? 'c' : (currentHeat > 25 ? 'e' : 'a')}${currentHeat.toFixed(1)}§r§7/${MELT_HEAT_THRESHOLD}`
        ];

        if (overheating) {
            statusLines.push(`§r§c§lWARNING: OVERHEATING! (${MELT_HEAT_THRESHOLD - currentHeat.toFixed(1)}° to melt)`);
        }

        machine.showStatus("Overclock Injector", statusLines);
        machine.displayEnergy?.();
        machine.displayFluid?.();
        machine.displayOverclock?.();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});
import { ItemStack, world, system } from "@minecraft/server";

// Detect Adventure Condiment presence by probing a known item id.
export const HAS_ADVENTURE_CONDIMENT = (() => {
    try {
        const probe = new ItemStack("ac:thermometer", 1);
        return !!probe && typeof probe.maxAmount === "number";
    } catch {
        return false;
    }
})();

const MULTI_CORE_RUNTIME = {
    coolingAuras: new Map(),
    heaterAuras: new Map()
};

const COOLING_AURAS = MULTI_CORE_RUNTIME.coolingAuras;
const HEATER_AURAS = MULTI_CORE_RUNTIME.heaterAuras;

function getLocationKey(block) {
    const loc = block?.location;
    return loc ? `${loc.x},${loc.y},${loc.z}` : null;
}

function applyCoolingToPlayers(aura) {
    try {
        const { block, radius, id, temperature, players } = aura;
        const dim = block.dimension;
        const loc = block.location;
        const newlyInside = new Set();
        for (const p of world.getPlayers()) {
            if (p.dimension.id !== dim.id) continue;
            const dx = p.location.x - loc.x;
            const dy = p.location.y - loc.y;
            const dz = p.location.z - loc.z;
            const dist2 = dx * dx + dy * dy + dz * dz;
            if (dist2 <= radius * radius) {
                newlyInside.add(p.id);
                if (!players.has(p.id)) {
                    try {
                        dim.runCommand(`ac:temperature ${p.name} add ${id} ${temperature}`);
                    } catch { /* ignore */ }
                    players.add(p.id);
                }
            }
        }

        for (const pid of Array.from(players)) {
            if (!newlyInside.has(pid)) {
                const pl = world.getPlayers().find(x => x.id === pid);
                if (pl) {
                    try {
                        dim.runCommand(`ac:temperature ${pl.name} remove ${id}`);
                    } catch { /* ignore */ }
                }
                players.delete(pid);
            }
        }
    } catch (error) {
        console.warn("[Cryo] error applying AC player cooling:", error);
    }
}

function stopCoolingAura(key) {
    const aura = COOLING_AURAS.get(key);
    if (!aura) return;
    try {
        const { id, players, block } = aura;
        const dim = block.dimension;
        for (const pid of players) {
            const pl = world.getPlayers().find(x => x.id === pid);
            if (pl) {
                try { dim.runCommand(`ac:temperature ${pl.name} remove ${id}`); } catch { /* ignore */ }
            }
        }
    } catch (error) {
        console.warn("[Cryo] error stopping aura:", error);
    }
    COOLING_AURAS.delete(key);
}

/**
 * Start or refresh a per-player AC cooling aura around the block.
 * The aura consumes energyPerSecond DE per second from the machine to remain active.
 */
export function applyACAreaCoolingAt(block, radius = 15, temperature = -5, durationTicks = 40, machine = null, energyPerSecond = 100) {
    if (!HAS_ADVENTURE_CONDIMENT) return;
    try {
        const key = getLocationKey(block);
        if (!key) return;
        let aura = COOLING_AURAS.get(key);
        if (!aura) {
            const id = `cryo_${block.location.x}_${block.location.y}_${block.location.z}_${Date.now()}`;
            aura = {
                id,
                block,
                radius,
                temperature,
                players: new Set(),
                nextConsumeTick: system.currentTick,
                durationTicks
            };
            COOLING_AURAS.set(key, aura);
        } else {
            aura.radius = radius;
            aura.temperature = temperature;
            aura.durationTicks = durationTicks;
        }

        if (machine && typeof machine.energy?.get === "function") {
            if (machine.energy.get() >= energyPerSecond) {
                machine.energy.consume(energyPerSecond);
                aura.nextConsumeTick = system.currentTick + 20;
                applyCoolingToPlayers(aura);
            } else {
                stopCoolingAura(key);
            }
        } else {
            applyCoolingToPlayers(aura);
            aura.nextConsumeTick = system.currentTick + 20;
        }
    } catch (error) {
        console.warn("[Cryo] Failed to start AC player cooling aura", error);
    }
}

export function tickCoolingAuras(block, machine, energyPerSecond = 100) {
    if (!HAS_ADVENTURE_CONDIMENT) return;
    const key = getLocationKey(block);
    if (!key) return;
    const aura = COOLING_AURAS.get(key);
    if (!aura) return;

    if (system.currentTick < (aura.nextConsumeTick || 0)) return;

    if (machine && typeof machine.energy?.get === "function") {
        if (machine.energy.get() >= energyPerSecond) {
            machine.energy.consume(energyPerSecond);
            aura.nextConsumeTick = system.currentTick + 20;
            applyCoolingToPlayers(aura);
        } else {
            stopCoolingAura(key);
        }
        return;
    }

    applyCoolingToPlayers(aura);
    aura.nextConsumeTick = system.currentTick + 20;
}

export function stopCoolingAuraAt(block) {
    const key = getLocationKey(block);
    if (!key) return;
    stopCoolingAura(key);
}

function applyHeaterToPlayers(aura) {
    try {
        const { block, radius, id, temperature, players } = aura;
        const dim = block.dimension;
        const loc = block.location;
        const nowInside = new Set();
        for (const p of world.getPlayers()) {
            if (p.dimension.id !== dim.id) continue;
            const dx = p.location.x - loc.x;
            const dy = p.location.y - loc.y;
            const dz = p.location.z - loc.z;
            const dist2 = dx * dx + dy * dy + dz * dz;
            if (dist2 <= radius * radius) {
                nowInside.add(p.id);
                if (!players.has(p.id)) {
                    try { dim.runCommand(`ac:temperature ${p.name} add ${id} ${temperature}`); } catch { /* ignore */ }
                    players.add(p.id);
                }
            }
        }

        for (const pid of Array.from(players)) {
            if (!nowInside.has(pid)) {
                const pl = world.getPlayers().find(x => x.id === pid);
                if (pl) {
                    try { dim.runCommand(`ac:temperature ${pl.name} remove ${id}`); } catch { /* ignore */ }
                }
                players.delete(pid);
            }
        }
    } catch (error) {
        console.warn("[Energizer] heater apply error", error);
    }
}

function stopHeaterAura(key) {
    const aura = HEATER_AURAS.get(key);
    if (!aura) return;
    try {
        const { id, players, block } = aura;
        const dim = block.dimension;
        for (const pid of players) {
            const pl = world.getPlayers().find(x => x.id === pid);
            if (pl) {
                try { dim.runCommand(`ac:temperature ${pl.name} remove ${id}`); } catch { /* ignore */ }
            }
        }
    } catch (error) {
        console.warn("[Energizer] stop heater aura error", error);
    }
    HEATER_AURAS.delete(key);
    console.info(`[Energizer] heater aura stopped at ${key}`);
}

export function startHeaterAura(block, radius = 10, temperature = 5, machine = null, energyPerSecond = 100) {
    if (!HAS_ADVENTURE_CONDIMENT) return;
    try {
        const key = getLocationKey(block);
        if (!key) return;
        let aura = HEATER_AURAS.get(key);
        if (!aura) {
            const id = `energizer_${block.location.x}_${block.location.y}_${block.location.z}_${Date.now()}`;
            aura = { id, block, radius, temperature, players: new Set(), nextConsumeTick: system.currentTick, energyPerSecond };
            HEATER_AURAS.set(key, aura);
            console.info(`[Energizer] heater aura started at ${key} id=${id}`);
        } else {
            aura.radius = radius;
            aura.temperature = temperature;
            aura.energyPerSecond = energyPerSecond;
        }

        if (machine && typeof machine.energy?.get === "function") {
            if (machine.energy.get() >= energyPerSecond) {
                machine.energy.consume(energyPerSecond);
                aura.nextConsumeTick = system.currentTick + 20;
                applyHeaterToPlayers(aura);
                console.info(`[Energizer] consumed ${energyPerSecond} to start/refresh heater at ${key}`);
            } else {
                stopHeaterAura(key);
                console.info(`[Energizer] insufficient energy to start heater at ${key}`);
            }
        } else {
            applyHeaterToPlayers(aura);
            aura.nextConsumeTick = system.currentTick + 20;
        }
    } catch (error) {
        console.warn("[Energizer] startHeaterAura error", error);
    }
}

export function tickHeaterAura(block, machine, options = {}) {
    if (!HAS_ADVENTURE_CONDIMENT) return;
    const radius = Number.isFinite(options.radius) ? options.radius : 10;
    const temperature = Number.isFinite(options.temperature) ? options.temperature : 5;
    const energyPerSecond = Number.isFinite(options.energyPerSecond) ? options.energyPerSecond : 100;

    if (machine?.energy?.get && machine.energy.get() > 0) {
        startHeaterAura(block, radius, temperature, machine, energyPerSecond);
    }

    const key = getLocationKey(block);
    const aura = key ? HEATER_AURAS.get(key) : null;
    if (!aura) return;

    if (system.currentTick < (aura.nextConsumeTick || 0)) return;

    if (machine && typeof machine.energy?.get === "function") {
        if (machine.energy.get() >= (aura.energyPerSecond || energyPerSecond)) {
            machine.energy.consume(aura.energyPerSecond || energyPerSecond);
            aura.nextConsumeTick = system.currentTick + 20;
            applyHeaterToPlayers(aura);
        } else if (key) {
            stopHeaterAura(key);
        }
        return;
    }

    applyHeaterToPlayers(aura);
    aura.nextConsumeTick = system.currentTick + 20;
}

export function stopHeaterAuraAt(block) {
    const key = getLocationKey(block);
    if (!key) return;
    stopHeaterAura(key);
}

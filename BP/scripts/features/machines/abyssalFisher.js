// @ts-check

import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    FluidStorage,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    getAbyssalLootTable,
    rollAbyssalDrops,
} from "../../ATCore/fishing/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import { abyssalFisherConfig } from "../../config/recipes/abyssalFisher.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:abyssal_fisher";
const MODE_BUTTON_SLOT = 3;
const NET_SLOT = 4;
const WATER_DISPLAY_SLOT = 6;
const OUTPUT_SLOTS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
const ITEM_IO_BUTTON_SLOTS = [29, 30, 31, 32, 33, 34];
const FLUID_IO_BUTTON_SLOTS = [35, 36, 37, 38, 39, 40];
const MODE_KEY = "ascendant:abyssal_fisher_mode";
const OPERATION_KEY = "ascendant:abyssal_fisher_operation";
const WATER_TYPE = "water";
const FLUID_IO_RATE = 128000;
const MACHINE_UPDATES_PER_SECOND = 5;
const ENVIRONMENT_REFRESH_TICKS = 100;
const CACHE_CLEANUP_INTERVAL = 1200;
const CACHE_EXPIRATION = 6000;
const WATER_TYPES = new Set([
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:bubble_column",
    "utilitycraft:sink",
]);

const modes = new Map([
    ["expedition", {
        id: "expedition",
        title: "Expedition",
        short: "EXP",
        color: "\u00A76",
        baseCasts: 1,
        energyMultiplier: 1.35,
        waterPerCast: 350,
        chanceMultiplier: 1.08,
        amountMultiplier: 1,
        tierBonus: 1,
        luckBonus: 4,
        minimumBatchSeconds: 3.6,
        secondsPerCast: 1.25,
    }],
    ["mass", {
        id: "mass",
        title: "Mass",
        short: "MASS",
        color: "\u00A7b",
        baseCasts: 2,
        energyMultiplier: 1,
        waterPerCast: 225,
        chanceMultiplier: 0.92,
        amountMultiplier: 1.15,
        tierBonus: 0,
        luckBonus: 0,
        minimumBatchSeconds: 1.8,
        secondsPerCast: 0.55,
    }],
]);
const modeOrder = ["expedition", "mass"];
const netProfiles = new Map();
const environmentStates = new Map();
let lastCacheCleanupTick = 0;

function getMode(entity) {
    return modes.get(entity.getDynamicProperty(MODE_KEY)) ?? modes.get("expedition");
}

ButtonManager.registerMachineButton(ID, MODE_BUTTON_SLOT, ({ entity }) => {
    const current = getMode(entity);
    const index = modeOrder.indexOf(current.id);
    const next = modes.get(modeOrder[(index + 1) % modeOrder.length]);
    setDynamicString(entity, MODE_KEY, next.id);
    setDynamicString(entity, OPERATION_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return `\u00A7r${next.color}${next.short}`;
});

registerIOInterface(ID, {
    items: {
        buttonSlots: ITEM_IO_BUTTON_SLOTS,
        anyInputSlots: [NET_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [NET_SLOT] },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
    liquids: {
        buttonSlots: FLUID_IO_BUTTON_SLOTS,
        anyInputIndices: [0],
        anyOutputIndices: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputIndices: [0] },
        ],
    },
});

DoriosLib.registry.blockComponent(ID, {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;

            machine.blockSlots([5, WATER_DISPLAY_SLOT, 9, 10]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, MODE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A76EXP");
            setUiItem(machine.container, WATER_DISPLAY_SLOT, "utilitycraft:empty_fluid_bar");
            setDynamicString(machine.entity, MODE_KEY, "expedition");
            setDynamicString(machine.entity, OPERATION_KEY, "");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);

            const water = new FluidStorage(machine.entity, 0);
            water.setType(WATER_TYPE);
            water.display(WATER_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;

        const water = new FluidStorage(machine.entity, 0);
        if (water.getType() === "empty") water.setType(WATER_TYPE);
        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });
        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        cleanupCaches();
        const mode = getMode(machine.entity);
        const netItem = machine.container.getItem(NET_SLOT);
        const net = resolveNetProfile(netItem);
        if (!net) {
            resetProcess(machine, water, settings.machine.energy_cost, "Insert Fishing Net", mode);
            return;
        }

        if (!hasOutputSpace(machine.container)) {
            pauseProcess(machine, water, settings.machine.energy_cost, "Output Full", mode, net);
            return;
        }

        const environment = getEnvironment(machine);
        const operation = buildOperation(machine, settings, mode, net, environment);
        if (operation.table.empty) {
            resetProcess(machine, water, operation.energyCost, "Net Too Weak", mode, net, environment);
            return;
        }
        if (water.getType() !== WATER_TYPE) {
            pauseProcess(machine, water, operation.energyCost, "Wrong Liquid", mode, net, environment, operation);
            return;
        }
        if (water.get() < operation.waterCost) {
            pauseProcess(machine, water, operation.energyCost, "Low Water", mode, net, environment, operation);
            return;
        }

        if (machine.entity.getDynamicProperty(OPERATION_KEY) !== operation.key) {
            setDynamicString(machine.entity, OPERATION_KEY, operation.key);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        const result = advanceProcess(machine, {
            progress: machine.getProgress(),
            cost: operation.energyCost,
            maxCrafts: 1,
            batch: 1,
            rateMultiplier: getRateMultiplier(
                settings.machine.rate_speed_base,
                operation.energyCost,
                operation.cycleSeconds,
                net.speed,
            ),
        });

        let distribution = null;
        if (result.processCount > 0) {
            const drops = rollAbyssalDrops({
                table: operation.table,
                totalRolls: operation.totalRolls,
                chanceMultiplier: operation.chanceMultiplier,
                amountMultiplier: operation.amountMultiplier,
                effectiveTier: operation.effectiveTier,
                effectiveLuck: operation.effectiveLuck,
                config: abyssalFisherConfig,
            });
            distribution = insertDrops(machine, drops);
            water.consume(operation.waterCost);
            damageNet(machine.container, operation.castCount);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", operation.energyCost);
        displayProgress(machine, operation.energyCost);
        if (machine.shouldUpdateUI) water.display(WATER_DISPLAY_SLOT);

        const running = result.energyUsed > 0 || result.processCount > 0;
        const message = result.processCount > 0
            ? mode.id === "expedition" ? "Survey Complete" : "Net Burst"
            : running
                ? mode.id === "expedition" ? "Surveying" : "Casting"
                : "No Energy";
        renderStatus(machine, water, running, message, mode, net, environment, operation, distribution);
    },

    onPlayerBreak(event) {
        const entity = event.dimension
            .getEntitiesAtBlockLocation(event.block.location)
            .find((candidate) => candidate.typeId === "utilitycraft:machine_entity");
        if (entity) {
            ButtonManager.unwatchEntity(entity);
            environmentStates.delete(entity.id);
        }
        Machine.onDestroy(event);
    },
});

function resolveNetProfile(item) {
    if (!item) return null;
    const cached = netProfiles.get(item.typeId);
    if (cached !== undefined) return cached;

    const params = item.getComponent("utilitycraft:fishing_net")?.customComponentParameters?.params;
    if (!params || typeof params !== "object") {
        netProfiles.set(item.typeId, null);
        return null;
    }
    const profile = {
        typeId: item.typeId,
        speed: Math.max(0.1, Number(params.speed) || 1),
        chance: Math.max(0.05, Number(params.chance_multiplier) || 1),
        amount: Math.max(0.1, Number(params.amount_multiplier) || 1),
        rolls: Math.max(1, Math.floor(Number(params.rolls) || 1)),
        tier: Math.max(0, Math.floor(Number(params.tier) || 0)),
        luck: Math.max(0, Number(params.luck) || abyssalFisherConfig.luck.default),
    };
    netProfiles.set(item.typeId, profile);
    return profile;
}

function buildOperation(machine, settings, mode, net, environment) {
    const processBatch = Math.max(1, Math.floor(machine.boosts.process_batch ?? 1));
    const castCount = Math.max(1, mode.baseCasts * processBatch);
    const effectiveTier = Math.max(0, net.tier + mode.tierBonus + environment.tierBonus);
    const effectiveLuck = Math.max(0, net.luck + mode.luckBonus + environment.luckBonus);
    const energyCost = Math.max(
        1,
        Math.ceil(settings.machine.energy_cost * castCount * mode.energyMultiplier),
    );
    const waterCost = Math.max(1, Math.ceil(mode.waterPerCast * castCount));
    const cycleSeconds = mode.minimumBatchSeconds
        + Math.max(0, castCount - 1) * mode.secondsPerCast;
    return {
        key: `${mode.id}|${net.typeId}|${effectiveTier}|${effectiveLuck}|${castCount}|${environment.signature}`,
        table: getAbyssalLootTable(effectiveTier),
        castCount,
        totalRolls: castCount * net.rolls,
        effectiveTier,
        effectiveLuck,
        energyCost,
        waterCost,
        cycleSeconds,
        chanceMultiplier: net.chance * mode.chanceMultiplier * environment.chanceMultiplier,
        amountMultiplier: net.amount * mode.amountMultiplier,
    };
}

function getEnvironment(machine) {
    let state = environmentStates.get(machine.entity.id);
    if (state && system.currentTick < state.nextRefreshTick) {
        state.lastSeenTick = system.currentTick;
        return state.environment;
    }

    const nearbyWater = countNearbyWater(machine.block, 2);
    const depth = Number(machine.block.location.y ?? 64);
    const dimensionId = machine.dimension.id;
    let label = "Reservoir";
    let tierBonus = 0;
    let chanceMultiplier = 1;
    let luckBonus = 0;

    if (nearbyWater >= 6) {
        label = "Current";
        tierBonus++;
        chanceMultiplier *= 1.05;
        luckBonus++;
    }
    if (nearbyWater >= 14 && depth <= 48) {
        label = "Abyssal";
        tierBonus++;
        chanceMultiplier *= 1.08;
        luckBonus += 2;
    }
    if (dimensionId === "minecraft:the_end") {
        label = "Void Tide";
        tierBonus += 2;
        chanceMultiplier *= 1.12;
        luckBonus += 4;
    } else if (dimensionId === "minecraft:nether") {
        label = "Boiled";
        tierBonus = Math.max(0, tierBonus - 1);
        chanceMultiplier *= 0.92;
        luckBonus = Math.max(0, luckBonus - 1);
    } else if (depth <= 16) {
        chanceMultiplier *= 1.03;
        luckBonus++;
        if (label === "Reservoir") label = "Deep Reservoir";
    }

    const environment = {
        label,
        nearbyWater,
        depth,
        dimensionId,
        tierBonus,
        chanceMultiplier,
        luckBonus,
        signature: `${label}|${nearbyWater}|${tierBonus}|${luckBonus}`,
    };
    state = {
        environment,
        nextRefreshTick: system.currentTick + ENVIRONMENT_REFRESH_TICKS,
        lastSeenTick: system.currentTick,
    };
    environmentStates.set(machine.entity.id, state);
    return environment;
}

function countNearbyWater(block, radius) {
    let total = 0;
    const origin = block.location;
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                if (x === 0 && y === 0 && z === 0) continue;
                const neighbor = block.dimension.getBlock({
                    x: origin.x + x,
                    y: origin.y + y,
                    z: origin.z + z,
                });
                if (neighbor && WATER_TYPES.has(neighbor.typeId)) total++;
            }
        }
    }
    return total;
}

function hasOutputSpace(container) {
    for (let index = 0; index < OUTPUT_SLOTS.length; index++) {
        const item = container.getItem(OUTPUT_SLOTS[index]);
        if (!item || item.amount < item.maxAmount) return true;
    }
    return false;
}

function insertDrops(machine, drops) {
    let inserted = 0;
    let overflow = 0;
    for (let index = 0; index < drops.length; index++) {
        const stack = drops[index];
        const accepted = DoriosLib.containers.insert(machine.container, {
            item: stack,
            slots: OUTPUT_SLOTS,
        });
        inserted += accepted;
        const remaining = stack.amount - accepted;
        if (remaining <= 0) continue;
        overflow += remaining;
        const overflowStack = stack.clone();
        overflowStack.amount = remaining;
        try {
            machine.dimension.spawnItem(overflowStack, machine.block.center());
        } catch {}
    }
    return { inserted, overflow, stacks: drops.length };
}

function damageNet(container, amount) {
    const item = container.getItem(NET_SLOT);
    if (!item) return;
    try {
        const durability = item.getComponent("minecraft:durability");
        if (!durability) return;
        durability.damage = Math.min(
            durability.maxDurability,
            durability.damage + Math.max(1, Math.floor(amount)),
        );
        if (durability.damage >= durability.maxDurability) container.setItem(NET_SLOT, undefined);
        else container.setItem(NET_SLOT, item);
    } catch {}
}

function getRateMultiplier(baseRate, energyCost, cycleSeconds, netSpeed) {
    const updates = Math.max(1, cycleSeconds * MACHINE_UPDATES_PER_SECOND);
    return energyCost / (Math.max(Number.EPSILON, baseRate) * updates)
        * Math.max(0.1, netSpeed);
}

function resetProcess(machine, water, cost, message, mode, net = null, environment = null) {
    setDynamicString(machine.entity, OPERATION_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) water.display(WATER_DISPLAY_SLOT);
    renderStatus(machine, water, false, message, mode, net, environment);
}

function pauseProcess(machine, water, cost, message, mode, net = null, environment = null, operation = null) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) water.display(WATER_DISPLAY_SLOT);
    renderStatus(machine, water, false, message, mode, net, environment, operation);
}

function renderStatus(machine, water, running, message, mode, net, environment, operation = null, distribution = null) {
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);
    const lines = [
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${message}`,
        `\u00A7r\u00A77Mode: \u00A7f${mode.title}`,
        `\u00A7r\u00A77Net: \u00A7f${net ? formatTypeId(net.typeId) : "None"}`,
        `\u00A7r\u00A77Water: \u00A7f${FluidStorage.formatFluid(water.get())}`,
        `\u00A7r\u00A77Current: \u00A7f${environment?.label ?? "Unknown"}`,
    ];
    if (operation) {
        lines.push(`\u00A7r\u00A77Casts: \u00A7f${operation.castCount} (${operation.totalRolls} rolls)`);
        lines.push(`\u00A7r\u00A77Tier/Luck: \u00A7f${operation.effectiveTier}/${operation.effectiveLuck}`);
        lines.push(`\u00A7r\u00A77Cycle: \u00A7f${EnergyStorage.formatEnergyToText(operation.energyCost)} DE`);
    }
    if (distribution?.inserted > 0) lines.push(`\u00A7r\u00A7aCaught: ${distribution.inserted}`);
    if (distribution?.overflow > 0) lines.push(`\u00A7r\u00A76Overflow: ${distribution.overflow}`);
    machine.setLabel(lines);
}

function formatTypeId(typeId) {
    const path = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return path
        .split("_")
        .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
        .join(" ");
}

function cleanupCaches() {
    const tick = system.currentTick;
    if (tick - lastCacheCleanupTick < CACHE_CLEANUP_INTERVAL) return;
    lastCacheCleanupTick = tick;
    for (const [entityId, state] of environmentStates) {
        if (tick - state.lastSeenTick > CACHE_EXPIRATION) environmentStates.delete(entityId);
    }
}

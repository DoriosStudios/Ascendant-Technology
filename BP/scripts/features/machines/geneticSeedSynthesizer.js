// @ts-check

import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import {
    ButtonManager,
    EnergyStorage,
    FluidStorage,
    Machine,
    registerIOInterface,
} from "DoriosCore/index.js";
import {
    getGeneticSeedRecipe,
    getGeneticSoil,
} from "../../ATCore/genetics/index.js";
import { advanceProcess } from "../../ATCore/processing/index.js";
import {
    displayProgress,
    setDynamicNumber,
    setDynamicString,
    setRunning,
    setUiItem,
} from "./runtime.js";

const ID = "utilitycraft:genetic_seed_synthesizer";
const INVENTORY_SIZE = 39;
const LEGACY_SLOT_LAYOUT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
];
const SEED_SLOTS = [3, 4, 5, 6];
const SOIL_SLOT = 7;
const PROFILE_BUTTON_SLOT = 8;
const CRYOFLUID_DISPLAY_SLOT = 9;
const OUTPUT_SLOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
const PROFILE_KEY = "ascendant:genetic_seed_profile";
const OPERATION_KEY = "ascendant:genetic_seed_operation";
const CRYOFLUID = "cryofluid";
const FLUID_IO_RATE = 128000;
const MACHINE_UPDATES_PER_SECOND = 5;
const itemMaximums = new Map();

const profiles = new Map([
    ["growth", {
        id: "growth",
        title: "Growth",
        short: "GRW",
        color: "\u00A7a",
        speed: 1.45,
        cryofluid: 1,
        bonusRollChance: 0,
        preserveLowFluidProgress: false,
    }],
    ["resilience", {
        id: "resilience",
        title: "Resilience",
        short: "RES",
        color: "\u00A7b",
        speed: 1,
        cryofluid: 0.65,
        bonusRollChance: 0,
        preserveLowFluidProgress: true,
    }],
    ["yield", {
        id: "yield",
        title: "Yield",
        short: "YLD",
        color: "\u00A76",
        speed: 0.8,
        cryofluid: 1.85,
        bonusRollChance: 0.45,
        preserveLowFluidProgress: false,
    }],
]);
const profileOrder = ["growth", "resilience", "yield"];

function getProfile(entity) {
    return profiles.get(entity.getDynamicProperty(PROFILE_KEY)) ?? profiles.get("growth");
}

ButtonManager.registerMachineButton(ID, PROFILE_BUTTON_SLOT, ({ entity }) => {
    const current = getProfile(entity);
    const currentIndex = profileOrder.indexOf(current.id);
    const next = profiles.get(profileOrder[(currentIndex + 1) % profileOrder.length]);
    setDynamicString(entity, PROFILE_KEY, next.id);
    setDynamicString(entity, OPERATION_KEY, "");
    setDynamicNumber(entity, "dorios:progress_0", 0);
    return `\u00A7r${next.color}${next.short}`;
});

registerIOInterface(ID, {
    items: {
        buttonSlots: [27, 28, 29, 30, 31, 32],
        anyInputSlots: [...SEED_SLOTS, SOIL_SLOT],
        anyOutputSlots: OUTPUT_SLOTS,
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: SEED_SLOTS },
            { id: "input_2", inputSlots: [SOIL_SLOT] },
            { id: "input_3", inputSlots: [...SEED_SLOTS, SOIL_SLOT] },
            { id: "output_1", outputSlots: OUTPUT_SLOTS },
        ],
    },
    liquids: {
        buttonSlots: [33, 34, 35, 36, 37, 38],
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

            machine.blockSlots([CRYOFLUID_DISPLAY_SLOT]);
            setUiItem(machine.container, 1, "utilitycraft:arrow_indicator_90");
            setUiItem(machine.container, 2, "utilitycraft:progress_right_big_bar_00");
            setUiItem(machine.container, PROFILE_BUTTON_SLOT, "utilitycraft:ui_filler", "\u00A7r\u00A7aGRW");
            setDynamicString(machine.entity, PROFILE_KEY, "growth");
            setDynamicString(machine.entity, OPERATION_KEY, "");
            setDynamicNumber(machine.entity, "dorios:energy_cost_0", settings.machine.energy_cost);

            const cryofluid = new FluidStorage(machine.entity, 0);
            cryofluid.setType(CRYOFLUID);
            cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
        });
    },

    onTick(event, { params: settings }) {
        const machine = new Machine(event.block, settings);
        if (!machine.valid) return;
        if (!machine.ensureInventoryLayout(INVENTORY_SIZE, LEGACY_SLOT_LAYOUT)) return;

        const cryofluid = new FluidStorage(machine.entity, 0);
        if (cryofluid.getType() === "empty") cryofluid.setType(CRYOFLUID);
        machine.processIO({ maxFluidMovedPerTick: FLUID_IO_RATE });

        if (machine.shouldUpdateUI) ButtonManager.ensureWatching(machine.entity, ID);
        else ButtonManager.unwatchEntity(machine.entity);

        const profile = getProfile(machine.entity);
        const soilItem = machine.container.getItem(SOIL_SLOT);
        if (!soilItem) {
            resetProcess(machine, cryofluid, settings.machine.energy_cost, "Insert Soil", profile);
            return;
        }

        const soil = getGeneticSoil(soilItem.typeId);
        if (!soil) {
            resetProcess(machine, cryofluid, settings.machine.energy_cost, "Invalid Soil", profile);
            return;
        }

        const outputState = inspectOutputs(machine.container);
        const operation = buildOperation(machine, soil, profile, outputState);
        if (operation.seedCount === 0) {
            resetProcess(machine, cryofluid, settings.machine.energy_cost, "Insert Seeds", profile, soil);
            return;
        }
        if (operation.validCount === 0) {
            resetProcess(
                machine,
                cryofluid,
                settings.machine.energy_cost,
                operation.invalidCount > 0 ? "Invalid Seed" : "Output Full",
                profile,
                soil,
            );
            return;
        }

        const previousKey = String(machine.entity.getDynamicProperty(OPERATION_KEY) ?? "");
        if (previousKey !== operation.key) {
            setDynamicString(machine.entity, OPERATION_KEY, operation.key);
            setDynamicNumber(machine.entity, "dorios:progress_0", 0);
        }

        if (cryofluid.getType() !== CRYOFLUID) {
            pauseProcess(machine, cryofluid, operation, "Wrong Liquid");
            return;
        }
        if (cryofluid.get() < operation.cryofluidCost) {
            if (!profile.preserveLowFluidProgress) setDynamicNumber(machine.entity, "dorios:progress_0", 0);
            pauseProcess(machine, cryofluid, operation, "Low Cryofluid");
            return;
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
                profile.speed,
            ),
        });

        let produced = 0;
        let overflow = 0;
        if (result.processCount > 0) {
            const rolled = rollOperation(operation, profile);
            const distribution = insertOutputs(machine, rolled);
            produced = distribution.inserted;
            overflow = distribution.overflow;
            cryofluid.consume(operation.cryofluidCost);
        }

        setDynamicNumber(machine.entity, "dorios:progress_0", result.progress);
        setDynamicNumber(machine.entity, "dorios:energy_cost_0", operation.energyCost);
        displayProgress(machine, operation.energyCost);
        if (machine.shouldUpdateUI) cryofluid.display(CRYOFLUID_DISPLAY_SLOT);

        const active = result.energyUsed > 0 || result.processCount > 0;
        const message = result.processCount > 0
            ? "Synthesized"
            : active
                ? processingVerb(profile.id)
                : "No Energy";
        renderMachineStatus(machine, cryofluid, active, message, profile, soil, operation, produced, overflow);
    },

    onPlayerBreak(event) {
        const entity = event.dimension.getEntitiesAtBlockLocation(event.block.location)[0];
        if (entity) ButtonManager.unwatchEntity(entity);
        Machine.onDestroy(event);
    },
});

function buildOperation(machine, soil, profile, outputState) {
    const lanes = [];
    let seedCount = 0;
    let invalidCount = 0;
    let energyCost = 0;
    let cryofluidCost = 0;
    let cycleSeconds = 0;
    let expectedOutput = 0;
    let key = `${profile.id}|${soil.typeId}`;
    let activeKey = "";

    for (let index = 0; index < SEED_SLOTS.length; index++) {
        const slot = SEED_SLOTS[index];
        const seed = machine.container.getItem(slot);
        if (!seed) {
            key += "|-";
            continue;
        }

        seedCount++;
        key += `|${slot}:${seed.typeId}`;
        const recipe = getGeneticSeedRecipe(seed.typeId);
        if (!recipe) {
            invalidCount++;
            continue;
        }
        if (!canAcceptRecipe(outputState, recipe)) continue;

        const laneEnergy = Math.max(1, Math.ceil(recipe.cost * soil.cost * 4));
        const laneCryofluid = Math.max(
            1,
            Math.ceil(Math.max(25, Math.ceil(laneEnergy / 256)) * 1.75 * profile.cryofluid),
        );
        lanes.push({ slot, recipe });
        activeKey += `${activeKey ? "," : ""}${slot}`;
        energyCost += laneEnergy;
        cryofluidCost += laneCryofluid;
        cycleSeconds = Math.max(cycleSeconds, recipe.cycleSeconds);
        expectedOutput += recipe.expectedBase + recipe.expectedBonus * profile.bonusRollChance;
    }

    key += `|active:${activeKey}`;
    return {
        key,
        soil,
        profile,
        lanes,
        seedCount,
        invalidCount,
        validCount: lanes.length,
        energyCost,
        cryofluidCost,
        cycleSeconds,
        expectedOutput: Math.round(expectedOutput),
    };
}

function inspectOutputs(container) {
    let hasEmpty = false;
    const stackableTypes = new Set();
    for (const slot of OUTPUT_SLOTS) {
        const item = container.getItem(slot);
        if (!item) {
            hasEmpty = true;
            continue;
        }
        if (item.amount < item.maxAmount) stackableTypes.add(item.typeId);
    }
    return { hasEmpty, stackableTypes };
}

function canAcceptRecipe(outputState, recipe) {
    if (outputState.hasEmpty) return true;
    for (const typeId of recipe.outputTypeIds) {
        if (outputState.stackableTypes.has(typeId)) return true;
    }
    return false;
}

function rollOperation(operation, profile) {
    const rolled = new Map();
    for (const lane of operation.lanes) {
        for (const drop of lane.recipe.drops) {
            if (Math.random() > drop.chance) continue;
            addRoll(rolled, drop.item, randomAmount(drop.amount));
            if (!drop.reproductive && profile.bonusRollChance > 0 && Math.random() <= profile.bonusRollChance) {
                addRoll(rolled, drop.item, randomAmount(drop.amount));
            }
        }
    }
    return rolled;
}

function randomAmount(amount) {
    if (!Array.isArray(amount)) return amount;
    return DoriosLib.math.randomInt(amount[0], amount[1]);
}

function addRoll(rolled, typeId, amount) {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) return;
    rolled.set(typeId, (rolled.get(typeId) ?? 0) + normalized);
}

function insertOutputs(machine, rolled) {
    let inserted = 0;
    let overflow = 0;
    for (const [typeId, amount] of rolled) {
        const accepted = insertSingleOutput(machine.container, typeId, amount);
        inserted += accepted;
        const remaining = amount - accepted;
        if (remaining > 0) {
            overflow += remaining;
            spawnOverflow(machine, typeId, remaining);
        }
    }
    return { inserted, overflow };
}

function insertSingleOutput(container, typeId, amount) {
    let remaining = amount;
    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break;
        const current = container.getItem(slot);
        if (!current || current.typeId !== typeId) continue;
        const moved = Math.min(remaining, current.maxAmount - current.amount);
        if (moved <= 0) continue;
        current.amount += moved;
        container.setItem(slot, current);
        remaining -= moved;
    }

    const maximum = getItemMaximum(typeId);
    if (maximum <= 0) return amount - remaining;
    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break;
        if (container.getItem(slot)) continue;
        const moved = Math.min(remaining, maximum);
        container.setItem(slot, new ItemStack(typeId, moved));
        remaining -= moved;
    }
    return amount - remaining;
}

function spawnOverflow(machine, typeId, amount) {
    const maximum = getItemMaximum(typeId);
    if (maximum <= 0) return;
    let remaining = amount;
    while (remaining > 0) {
        const moved = Math.min(remaining, maximum);
        try {
            machine.dimension.spawnItem(new ItemStack(typeId, moved), machine.block.center());
        } catch {
            return;
        }
        remaining -= moved;
    }
}

function getItemMaximum(typeId) {
    if (itemMaximums.has(typeId)) return itemMaximums.get(typeId);
    let maximum = 0;
    try {
        maximum = new ItemStack(typeId, 1).maxAmount;
    } catch {}
    itemMaximums.set(typeId, maximum);
    return maximum;
}

function getRateMultiplier(baseRate, energyCost, cycleSeconds, profileSpeed) {
    const updates = Math.max(1, Math.round(cycleSeconds * MACHINE_UPDATES_PER_SECOND));
    return energyCost / (Math.max(Number.EPSILON, baseRate) * updates) * profileSpeed;
}

function processingVerb(profileId) {
    if (profileId === "growth") return "Culturing";
    if (profileId === "resilience") return "Stabilizing";
    return "Amplifying Yield";
}

function resetProcess(machine, cryofluid, cost, message, profile, soil = null) {
    setDynamicString(machine.entity, OPERATION_KEY, "");
    setDynamicNumber(machine.entity, "dorios:progress_0", 0);
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", cost);
    displayProgress(machine, cost);
    if (machine.shouldUpdateUI) cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
    renderMachineStatus(machine, cryofluid, false, message, profile, soil);
}

function pauseProcess(machine, cryofluid, operation, message) {
    setDynamicNumber(machine.entity, "dorios:energy_cost_0", operation.energyCost);
    displayProgress(machine, operation.energyCost);
    if (machine.shouldUpdateUI) cryofluid.display(CRYOFLUID_DISPLAY_SLOT);
    renderMachineStatus(machine, cryofluid, false, message, operation.profile, operation.soil, operation);
}

function renderMachineStatus(machine, cryofluid, running, message, profile, soil, operation = null, produced = 0, overflow = 0) {
    setRunning(machine, running);
    if (!machine.shouldUpdateUI) return;

    machine.energy.display(0);
    const lines = [
        `\u00A7r${running ? "\u00A7a" : "\u00A7e"}${message}`,
        `\u00A7r\u00A77Profile: \u00A7f${profile.title}`,
        `\u00A7r\u00A77Soil: \u00A7f${soil?.typeId ? formatTypeId(soil.typeId) : "None"}`,
        `\u00A7r\u00A77Active Lanes: \u00A7f${operation?.validCount ?? 0}/4`,
        `\u00A7r\u00A77Cryofluid: \u00A7f${FluidStorage.formatFluid(cryofluid.get())}`,
    ];

    if (operation?.energyCost) {
        lines.push(`\u00A7r\u00A77Cycle: \u00A7f${EnergyStorage.formatEnergyToText(operation.energyCost)} DE`);
        lines.push(`\u00A7r\u00A77Expected Yield: \u00A7f~${operation.expectedOutput}`);
    }
    if (produced > 0) lines.push(`\u00A7r\u00A7aProduced: ${produced}`);
    if (overflow > 0) lines.push(`\u00A7r\u00A7cOverflow: ${overflow}`);
    machine.setLabel(lines);
}

function formatTypeId(typeId) {
    const path = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return path.split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

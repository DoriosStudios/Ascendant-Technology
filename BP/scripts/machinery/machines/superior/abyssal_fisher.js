import { EnchantmentTypes, ItemStack } from "@minecraft/server";
import {
    Machine,
    FluidManager,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    extractEnchantments,
    formatItemName,
    tickGate
} from "../../../DoriosCore/main.js";
import { abyssalFisherConfig, abyssalFisherLoot } from "../../../config/recipes/abyssal_fisher.js";
import {
    formatBatchWithQuantity,
    formatEnergyWithFluidCost,
    formatFluidNeedValue,
    formatFluidTankBuffer,
    formatMachineEnergyBuffer,
    formatSecondsLabel,
    shouldRefreshSuperiorUi,
    syncSuperiorButtonPanel
} from "./utils.js";

const ABYSALL_FISHER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        modeButton: 3,
        net: 4,
        waterInput: 5,
        waterDisplay: 6,
        upgrades: Object.freeze([7, 8, 9, 10]),
        outputs: Object.freeze([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28])
    }),
    transfer: Object.freeze({
        outputIntervalTicks: 4,
        inputPullIntervalTicks: 4
    }),
    quantity: Object.freeze({
        maxLevel: 4
    }),
    water: Object.freeze({
        type: "water"
    }),
    defaults: Object.freeze({
        energyCost: 2400,
        fluidCap: 32000
    }),
    modes: Object.freeze({
        expedition: Object.freeze({
            id: "expedition",
            title: "Expedition",
            summary: "Long-cycle casts that push toward rarer abyssal catches.",
            batchSizes: Object.freeze([1, 1, 2, 2, 3]),
            energyMultiplier: 1.35,
            waterPerCast: 350,
            chanceMultiplier: 1.08,
            amountMultiplier: 1,
            tierBonus: 1,
            luckBonus: 4,
            minimumBatchSeconds: 3.6,
            secondsPerCast: 1.25
        }),
        mass: Object.freeze({
            id: "mass",
            title: "Mass",
            summary: "Shorter industrial batches tuned for raw throughput.",
            batchSizes: Object.freeze([2, 3, 4, 5, 6]),
            energyMultiplier: 1,
            waterPerCast: 225,
            chanceMultiplier: 0.92,
            amountMultiplier: 1.15,
            tierBonus: 0,
            luckBonus: 0,
            minimumBatchSeconds: 1.8,
            secondsPerCast: 0.55
        })
    })
});

const MODE_LIST = Object.freeze(Object.values(ABYSALL_FISHER.modes));
const MAX_STACK_SIZE_CACHE = new Map();
const WATER_TYPES = new Set([
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:bubble_column",
    "utilitycraft:sink"
]);

const BOOK_ITEM_ID = "minecraft:book";
const ENCHANTED_BOOK_ITEM_ID = "minecraft:enchanted_book";
const ITEM_ID_FIXES = Object.freeze({
    "minecraft:lily_pad": "minecraft:waterlily"
});
const ABYSSAL_ENCHANTMENT_SOURCES = Object.freeze([
    Object.freeze({ entries: Object.freeze(["minecraft:protection", "minecraft:fire_protection", "minecraft:blast_protection", "minecraft:projectile_protection"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:sharpness", "minecraft:smite", "minecraft:bane_of_arthropods", "minecraft:density"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:silk_touch", "minecraft:fortune"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:depth_strider", "minecraft:frost_walker"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:multishot", "minecraft:piercing", "minecraft:breach"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:loyalty", "minecraft:riptide"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:unbreaking"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:mending"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:efficiency"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:respiration"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:aqua_affinity"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:thorns"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:feather_falling"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:fire_aspect"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:knockback"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:looting"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:power"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:punch"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:flame"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:infinity"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:quick_charge"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:impaling"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:channeling"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:lure"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:luck_of_the_sea"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:soul_speed"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:swift_sneak"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:wind_burst"]), weight: 1 }),
    Object.freeze({ entries: Object.freeze(["minecraft:lunge"]), weight: 1 })
]);
const MULTIPLIER_LOCKED_ITEM_IDS = new Set([
    BOOK_ITEM_ID,
    ENCHANTED_BOOK_ITEM_ID,
    "minecraft:saddle"
]);

const LUCK_CONFIG = abyssalFisherConfig?.luck ?? {};
const BOOK_ENCHANT_CONFIG = abyssalFisherConfig?.bookEnchant ?? {};
const EQUIPMENT_CONFIG = abyssalFisherConfig?.equipment ?? {};
const FISHING_CATEGORY_CONFIG = abyssalFisherConfig?.fishingCategories ?? {};
const DEFAULT_LUCK = LUCK_CONFIG.default ?? 0;
const FISHING_CATEGORY_KEYS = Object.freeze(["fish", "junk", "treasure"]);
let cachedEnchantmentTypes = null;

const ABYSALL_FISHER_BUTTONS = Object.freeze({
    id: "abyssal_fisher_mode",
    namespace: "ascendant:abyssal_fisher",
    cooldownTicks: 6,
    defaultIconItemId: "utilitycraft:switch_button",
    defaults: Object.freeze({
        mode: ABYSALL_FISHER.modes.expedition.id
    }),
    buttons: Object.freeze([
        Object.freeze({
            id: "mode_cycle",
            property: "mode",
            slot: ABYSALL_FISHER.slots.modeButton,
            type: "cycle",
            values: Object.freeze(MODE_LIST.map(mode => mode.id)),
            defaultValue: ABYSALL_FISHER.modes.expedition.id,
            getTitle: ({ state }) => `Mode: ${getMode(state.mode).title}`,
            getLore: ({ state }) => buildModeButtonLore(getMode(state.mode)),
            pressHint: "Take the switch to cycle the fishing profile.",
            showStatusInLore: false,
            showValueInLore: false,
            showPressHintInLore: false,
            stateColorInTitle: false,
            onChange: ({ machine }) => {
                machine?.setProgress?.(0, ABYSALL_FISHER.slots.progress);
            }
        })
    ])
});

DoriosAPI.register.blockComponent("abyssal_fisher", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? ABYSALL_FISHER.defaults.energyCost);
            machine.displayEnergy(ABYSALL_FISHER.slots.energy);
            machine.displayProgress(ABYSALL_FISHER.slots.progress);
            machine.blockSlots([ABYSALL_FISHER.slots.waterDisplay, ABYSALL_FISHER.slots.waterInput]);

            const tank = getWaterTank(machine, settings);
            tank.display(ABYSALL_FISHER.slots.waterDisplay);
            machine.entity.setItem(ABYSALL_FISHER.slots.status, "utilitycraft:arrow_indicator_90", 1, "");

            syncSuperiorButtonPanel(machine, ABYSALL_FISHER_BUTTONS, {
                detectPresses: false,
                forceRender: true
            });
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;

        const tank = getWaterTank(machine, settings);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "abyssal_fisher:ui");
        const panelState = syncSuperiorButtonPanel(machine, ABYSALL_FISHER_BUTTONS, {
            forceRender: shouldRefreshUi
        });
        const mode = getMode(panelState.mode);
        const environment = resolveEnvironmentContext(machine.block);
        const quantityLevel = getQuantityUpgradeLevel(machine);

        if (tickGate(machine.entity, "abyssal_fisher:transfer_cd", ABYSALL_FISHER.transfer.outputIntervalTicks)) {
            transferOutputSlots(machine);
        }

        if (tickGate(machine.entity, "abyssal_fisher:inputs_cd", ABYSALL_FISHER.transfer.inputPullIntervalTicks)) {
            machine.pullItemsFromAbove(ABYSALL_FISHER.slots.net);
        }

        const netItem = machine.inv.getItem(ABYSALL_FISHER.slots.net);
        const netData = resolveNetParams(netItem);
        if (!netData) {
            showMachineWarning(machine, tank, "Insert Net", {
                mode,
                environment,
                quantityLevel,
                castCount: getCastCount(mode, quantityLevel),
                netItemId: null
            }, shouldResetProgress("Insert Net"), shouldRefreshUi);
            return;
        }

        const operation = buildOperationPlan({
            machine,
            tank,
            settings,
            mode,
            environment,
            quantityLevel,
            netData,
            netItemId: netItem?.typeId ?? null
        });

        if (!operation.ready) {
            showMachineWarning(machine, tank, operation.message ?? "Standby", operation, shouldResetProgress(operation.message), shouldRefreshUi);
            return;
        }

        machine.setEnergyCost(operation.energyCost);
        applyDynamicRecipeRate(machine, operation.referenceRecipe, {
            energyCost: operation.energyCost,
            speedMultiplier: (machine.boosts.speed ?? 1) * operation.netData.speed
        });

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, tank, "No Energy", operation, false, shouldRefreshUi);
            return;
        }

        let lastBatch = null;
        const progress = machine.getProgress();
        if (progress >= operation.energyCost) {
            lastBatch = processBatch(machine, operation, tank);
            if (!lastBatch.completed) {
                showMachineWarning(
                    machine,
                    tank,
                    lastBatch.message ?? "Output Full",
                    {
                        ...operation,
                        lastBatch
                    },
                    shouldResetProgress(lastBatch.message ?? "Output Full"),
                    shouldRefreshUi
                );
                return;
            }
            machine.addProgress(-operation.energyCost);

            // Consume 1 durability per cast in the batch (castCount from operation)
            try {
                const netSlot = ABYSALL_FISHER.slots.net;
                const netStack = machine.inv.getItem(netSlot);
                if (netStack) {
                    const damageAmount = Math.max(1, Math.floor(operation.castCount || 1));
                    if (netStack?.durability && typeof netStack.durability.damage === 'function') {
                        netStack.durability.damage(damageAmount, 1);
                    } else {
                        const durComp = netStack.getComponent?.('minecraft:durability') ?? netStack.getComponent?.('durability');
                        if (durComp) {
                            durComp.damage = Math.min(durComp.maxDurability, durComp.damage + damageAmount);
                        }
                    }

                    const finalDur = netStack.getComponent?.('minecraft:durability') ?? netStack.getComponent?.('durability');
                    if (finalDur && Number(finalDur.damage) >= Number(finalDur.maxDurability)) {
                        machine.inv.setItem(netSlot, undefined);
                    } else {
                        machine.inv.setItem(netSlot, netStack);
                    }
                }
            } catch {
                // Best-effort; ignore durability failures
            }
        } else {
            const consumption = machine.boosts.consumption;
            const energyToConsume = Math.min(
                machine.energy.get(),
                machine.rate,
                Math.max(0, operation.energyCost - progress) * consumption
            );

            if (energyToConsume > 0) {
                machine.energy.consume(energyToConsume);
                machine.addProgress(energyToConsume / Math.max(consumption, Number.EPSILON));
            }
        }

        showMachineStatus(
            machine,
            tank,
            lastBatch
                ? (operation.mode.id === ABYSALL_FISHER.modes.expedition.id ? "Survey Complete" : "Net Burst")
                : (operation.mode.id === ABYSALL_FISHER.modes.expedition.id ? "Surveying" : "Casting"),
            {
                ...operation,
                lastBatch
            },
            shouldRefreshUi
        );
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function getWaterTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : ABYSALL_FISHER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === "empty" && tank.get() <= 0) {
        tank.setType(ABYSALL_FISHER.water.type);
    }

    return tank;
}

function getMode(modeId) {
    return MODE_LIST.find(mode => mode.id === modeId) ?? ABYSALL_FISHER.modes.expedition;
}

function resolveNetParams(netItem) {
    const params = netItem?.getComponent?.("utilitycraft:fishing_net")?.customComponentParameters?.params;
    if (!params || typeof params !== "object") return null;

    return {
        speed: Math.max(0.1, Number(params.speed) || 1),
        chance: Math.max(0.05, Number(params.chance_multiplier) || 1),
        amount: Math.max(0.1, Number(params.amount_multiplier) || 1),
        rolls: Math.max(1, Math.floor(Number(params.rolls) || 1)),
        tier: Math.max(0, Math.floor(Number(params.tier) || 0)),
        luck: Math.max(0, Number(params.luck) || DEFAULT_LUCK)
    };
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of ABYSALL_FISHER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(ABYSALL_FISHER.quantity.maxLevel, total));
}

function getCastCount(mode, quantityLevel) {
    const batchSizes = Array.isArray(mode?.batchSizes) && mode.batchSizes.length
        ? mode.batchSizes
        : [1];
    const index = Math.max(0, Math.min(batchSizes.length - 1, Number(quantityLevel) || 0));
    return Math.max(1, Number(batchSizes[index]) || 1);
}

function resolveEnvironmentContext(block) {
    const nearbyWater = countNearbyWaterBlocks(block, 2);
    const depth = Number(block?.location?.y ?? 64);
    const dimensionId = block?.dimension?.id ?? "minecraft:overworld";

    let label = "Reservoir";
    let description = "Stable internal feed with no abyssal terrain bonus.";
    let tierBonus = 0;
    let chanceMultiplier = 1;
    let luckBonus = 0;

    if (nearbyWater >= 6) {
        label = "Current";
        description = "Surrounding water flow improves the quality of the catch table.";
        tierBonus += 1;
        chanceMultiplier *= 1.05;
        luckBonus += 1;
    }

    if (nearbyWater >= 14 && depth <= 48) {
        label = "Abyssal";
        description = "Dense deep-water placement pushes the machine into stronger loot bands.";
        tierBonus += 1;
        chanceMultiplier *= 1.08;
        luckBonus += 2;
    }

    if (dimensionId === "minecraft:the_end") {
        label = "Void Tide";
        description = "Dimensional turbulence grants rare-tier pressure to every cast.";
        tierBonus += 2;
        chanceMultiplier *= 1.12;
        luckBonus += 4;
    } else if (dimensionId === "minecraft:nether") {
        label = "Boiled";
        description = "Nether placement is unstable and suppresses higher-tier aquatic rolls.";
        tierBonus = Math.max(0, tierBonus - 1);
        chanceMultiplier *= 0.92;
        luckBonus = Math.max(0, luckBonus - 1);
    }

    if (depth <= 16 && dimensionId === "minecraft:overworld") {
        chanceMultiplier *= 1.03;
        luckBonus += 1;
        if (label === "Reservoir") {
            label = "Deep Reservoir";
            description = "Low-Y placement adds a mild abyssal pressure bonus.";
        }
    }

    return {
        label,
        description,
        tierBonus,
        chanceMultiplier,
        luckBonus,
        nearbyWater,
        depth,
        dimensionId
    };
}

function countNearbyWaterBlocks(block, radius = 2) {
    const dim = block?.dimension;
    const origin = block?.location;
    if (!dim || !origin) return 0;

    let total = 0;
    for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
                if (dx === 0 && dy === 0 && dz === 0) continue;

                const neighbor = dim.getBlock({
                    x: origin.x + dx,
                    y: origin.y + dy,
                    z: origin.z + dz
                });
                if (!neighbor) continue;
                if (WATER_TYPES.has(neighbor.typeId)) {
                    total += 1;
                }
            }
        }
    }

    return total;
}

function buildOperationPlan({ machine, tank, settings, mode, environment, quantityLevel, netData, netItemId }) {
    const castCount = getCastCount(mode, quantityLevel);
    const totalRolls = castCount * Math.max(1, netData.rolls);
    const effectiveTier = Math.max(0, netData.tier + mode.tierBonus + environment.tierBonus);
    const effectiveLuck = Math.max(0, netData.luck + mode.luckBonus + environment.luckBonus);
    const eligibleLoot = abyssalFisherLoot.filter(entry => effectiveTier >= Math.max(0, Number(entry?.tier) || 0));
    const eligibleLootByCategory = groupLootByCategory(eligibleLoot);
    const luckOfTheSeaEquivalent = resolveLuckOfTheSeaEquivalent(effectiveLuck);
    const categoryWeights = resolveFishingCategoryWeights(eligibleLootByCategory, luckOfTheSeaEquivalent);
    const averageLootAttemptsPerRoll = resolveAverageLootAttemptsPerRoll({
        eligibleLoot,
        netData,
        mode,
        environment
    });

    const operation = {
        ready: false,
        message: null,
        mode,
        environment,
        quantityLevel,
        castCount,
        totalRolls,
        netData,
        netItemId,
        effectiveTier,
        effectiveLuck,
        luckOfTheSeaEquivalent,
        eligibleLoot,
        eligibleLootByCategory,
        categoryWeights,
        averageLootAttemptsPerRoll,
        outputPlan: null,
        waterCost: Math.max(1, Math.ceil((mode.waterPerCast ?? 0) * castCount)),
        energyCost: Math.max(
            1,
            Math.ceil((settings?.machine?.energy_cost ?? ABYSALL_FISHER.defaults.energyCost) * castCount * (mode.energyMultiplier ?? 1))
        ),
        cycleSeconds: computeCycleSeconds(mode, castCount),
        expectedOutputs: 0,
        candidateOutputIds: []
    };

    if (!eligibleLoot.length) {
        operation.message = "Net Too Weak";
        return operation;
    }

    operation.candidateOutputIds = resolveCandidateOutputIdsFromLoot(eligibleLoot);
    operation.outputPlan = buildOutputPlan(machine, operation.candidateOutputIds);
    operation.expectedOutputs = estimateExpectedOutputs(operation);
    operation.referenceRecipe = buildReferenceRecipe(operation.energyCost, operation.cycleSeconds);

    if (operation.outputPlan.compatibleSlotCount <= 0) {
        operation.message = "Output Conflict";
        return operation;
    }

    if (!operation.outputPlan.hasSpace) {
        operation.message = "Output Full";
        return operation;
    }

    if ((tank?.get() ?? 0) < operation.waterCost) {
        operation.message = "Low Water";
        return operation;
    }

    operation.ready = true;
    return operation;
}

function resolveCandidateOutputIdsFromLoot(lootEntries) {
    return [...new Set(
        lootEntries
            .flatMap(resolveCandidateOutputIds)
            .filter(Boolean)
    )];
}

function resolveCandidateOutputIds(loot) {
    const itemId = resolveLootItemId(loot);
    if (!itemId) return [];
    if (itemId === BOOK_ITEM_ID) {
        return [BOOK_ITEM_ID, ENCHANTED_BOOK_ITEM_ID];
    }
    return [itemId];
}

function buildOutputPlan(machine, candidateOutputIds) {
    const uniqueOutputIds = [...new Set(candidateOutputIds.filter(Boolean))];
    const slots = [];
    let totalSpace = 0;
    let compatibleSlotCount = 0;
    let emptySlotCount = 0;

    for (const slot of ABYSALL_FISHER.slots.outputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            const maxAmount = resolveMaxStackSize(null, uniqueOutputIds[0]);
            slots.push({
                slot,
                empty: true,
                compatible: true,
                space: maxAmount,
                itemId: null
            });
            compatibleSlotCount += 1;
            emptySlotCount += 1;
            totalSpace += maxAmount;
            continue;
        }

        if (!uniqueOutputIds.includes(stack.typeId)) {
            slots.push({
                slot,
                empty: false,
                compatible: false,
                space: 0,
                itemId: stack.typeId
            });
            continue;
        }

        const maxAmount = resolveMaxStackSize(stack, stack.typeId);
        const space = Math.max(0, maxAmount - stack.amount);
        slots.push({
            slot,
            empty: false,
            compatible: true,
            space,
            itemId: stack.typeId
        });
        compatibleSlotCount += 1;
        totalSpace += space;
    }

    return {
        slots,
        totalSpace,
        emptySlotCount,
        compatibleSlotCount,
        hasSpace: totalSpace > 0,
        candidateOutputIds: uniqueOutputIds
    };
}

function computeCycleSeconds(mode, castCount) {
    const minimum = Math.max(0.5, Number(mode?.minimumBatchSeconds) || 2);
    const secondsPerCast = Math.max(0.1, Number(mode?.secondsPerCast) || 0.5);
    return Number((minimum + (Math.max(1, castCount) - 1) * secondsPerCast).toFixed(2));
}

function buildReferenceRecipe(energyCost, cycleSeconds) {
    return {
        energyCost,
        seconds: cycleSeconds,
        ticks: Math.ceil(cycleSeconds * 20)
    };
}

function processBatch(machine, operation, tank) {
    const drops = rollBatchDrops(operation);
    const cappedDrops = clampDropStacksToAvailableCapacity(machine?.inv, drops, ABYSALL_FISHER.slots.outputs);
    if (drops.length > 0 && cappedDrops.length <= 0) {
        return {
            completed: false,
            preventedOverflow: true,
            message: "Output Full",
            produced: 0,
            uniqueOutputs: 0,
            overflow: drops.reduce((sum, stack) => sum + Math.max(0, Number(stack?.amount) || 0), 0),
            waterUsed: 0,
            rolledStacks: drops.length
        };
    }

    const preview = simulateDropStorage(machine?.inv, cappedDrops, ABYSALL_FISHER.slots.outputs);
    if (!preview.completed) {
        return {
            completed: false,
            preventedOverflow: true,
            message: "Output Full",
            produced: 0,
            uniqueOutputs: 0,
            overflow: preview.overflowCount,
            waterUsed: 0,
            rolledStacks: cappedDrops.length
        };
    }

    if (operation.waterCost > 0) {
        tank.consume(operation.waterCost);
    }

    const distribution = storeDropsInMachine(machine, cappedDrops, machine.block.center());

    return {
        completed: true,
        produced: distribution.collectedCount,
        uniqueOutputs: distribution.uniqueTypes,
        overflow: distribution.overflowCount,
        waterUsed: operation.waterCost,
        rolledStacks: cappedDrops.length
    };
}

function rollBatchDrops(operation) {
    const simpleDrops = new Map();
    const customStacks = [];

    for (let roll = 0; roll < operation.totalRolls; roll += 1) {
        const attemptCount = rollLootAttemptsForRoll(operation);
        for (let attempt = 0; attempt < attemptCount; attempt += 1) {
            const categoryKey = pickLootCategory(operation.categoryWeights);
            if (!categoryKey) continue;

            const loot = pickWeightedLootEntry(operation.eligibleLootByCategory.get(categoryKey));
            if (!loot) continue;
            const baseAmount = rollAmount(loot.amount);
            const lootItemId = resolveLootItemId(loot);
            if (!lootItemId) continue;
            const totalAmount = resolveScaledLootAmount(loot, lootItemId, baseAmount, operation);
            if (totalAmount <= 0) continue;

            if (lootItemId === BOOK_ITEM_ID) {
                customStacks.push(...createBookDropStacks(totalAmount, operation.effectiveTier, operation.effectiveLuck));
                continue;
            }

            if (loot.randomEnchant || loot.durabilityDamageRange) {
                customStacks.push(...createEquipmentDropStacks(
                    { ...loot, item: lootItemId },
                    totalAmount,
                    operation.effectiveLuck,
                    operation.effectiveTier
                ));
                continue;
            }

            addSimpleDrop(simpleDrops, lootItemId, totalAmount);
        }
    }

    return [
        ...convertSimpleDropsToStacks(simpleDrops),
        ...customStacks
    ];
}

function addSimpleDrop(dropMap, itemId, amount) {
    if (!itemId || amount <= 0) return;
    dropMap.set(itemId, (dropMap.get(itemId) ?? 0) + amount);
}

function convertSimpleDropsToStacks(dropMap) {
    const stacks = [];
    for (const [itemId, totalAmount] of dropMap.entries()) {
        stacks.push(...createPlainItemStacks(itemId, totalAmount));
    }
    return stacks;
}

function createPlainItemStacks(itemId, amount) {
    const total = Math.max(0, Math.floor(amount));
    if (!itemId || total <= 0) return [];

    const maxAmount = Math.max(1, resolveMaxStackSize(null, itemId));
    const stacks = [];
    let remaining = total;

    while (remaining > 0) {
        const stackAmount = Math.min(maxAmount, remaining);
        stacks.push(new ItemStack(itemId, stackAmount));
        remaining -= stackAmount;
    }

    return stacks;
}

function rollAmount(definition) {
    if (Array.isArray(definition) && definition.length >= 2) {
        const min = Math.floor(Number(definition[0]) || 0);
        const max = Math.floor(Number(definition[1]) || min);
        return DoriosAPI.math.randomInterval(Math.min(min, max), Math.max(min, max));
    }

    const value = Number(definition);
    return Number.isFinite(value) ? value : 1;
}

function resolveScaledLootAmount(loot, itemId, baseAmount, operation) {
    const normalizedBaseAmount = Math.max(0, Math.ceil(Number(baseAmount) || 0));
    if (normalizedBaseAmount <= 0) return 0;

    if (shouldLockLootMultiplier(loot, itemId)) {
        return normalizedBaseAmount;
    }

    return Math.max(
        0,
        Math.ceil(normalizedBaseAmount * operation.netData.amount * (operation.mode.amountMultiplier ?? 1))
    );
}

function shouldLockLootMultiplier(loot, itemId) {
    if (!itemId) return false;
    if (loot?.randomEnchant || loot?.durabilityDamageRange) return true;
    if (MULTIPLIER_LOCKED_ITEM_IDS.has(itemId)) return true;
    return resolveMaxStackSize(null, itemId) <= 1;
}

function resolveLootItemId(loot) {
    const itemId = typeof loot?.item === "string" ? loot.item : "";
    return ITEM_ID_FIXES[itemId] ?? itemId;
}

function resolveLootCategoryKey(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (FISHING_CATEGORY_KEYS.includes(normalized)) {
        return normalized;
    }

    const fallback = typeof FISHING_CATEGORY_CONFIG.defaultCategory === "string"
        ? FISHING_CATEGORY_CONFIG.defaultCategory.toLowerCase()
        : "junk";
    return FISHING_CATEGORY_KEYS.includes(fallback) ? fallback : "junk";
}

function groupLootByCategory(lootEntries) {
    const grouped = new Map(FISHING_CATEGORY_KEYS.map(key => [key, []]));

    for (const loot of lootEntries) {
        const categoryKey = resolveLootCategoryKey(loot?.category);
        if (!grouped.has(categoryKey)) {
            grouped.set(categoryKey, []);
        }
        grouped.get(categoryKey).push(loot);
    }

    return grouped;
}

function resolveLuckOfTheSeaEquivalent(effectiveLuck = 0) {
    const luckConfig = FISHING_CATEGORY_CONFIG.luckOfTheSea ?? {};
    const luckPerLevel = Math.max(1, Number(luckConfig.luckPerLevel) || 10);
    const maxEquivalentLevel = Math.max(0, Number(luckConfig.maxEquivalentLevel) || 3);
    return clamp(Math.max(0, Number(effectiveLuck) || 0) / luckPerLevel, 0, maxEquivalentLevel);
}

function resolveFishingCategoryWeights(eligibleLootByCategory, equivalentLuckLevel = 0) {
    const baseWeights = FISHING_CATEGORY_CONFIG.baseWeights ?? {};
    const luckConfig = FISHING_CATEGORY_CONFIG.luckOfTheSea ?? {};
    const availableCategories = FISHING_CATEGORY_KEYS.filter(key => (eligibleLootByCategory.get(key)?.length ?? 0) > 0);
    const rawWeights = {
        fish: Math.max(0, (Number(baseWeights.fish) || 0.85) + (equivalentLuckLevel * (Number(luckConfig.fishDeltaPerLevel) || -0.0015))),
        junk: Math.max(0, (Number(baseWeights.junk) || 0.10) + (equivalentLuckLevel * (Number(luckConfig.junkDeltaPerLevel) || -0.0195))),
        treasure: Math.max(0, (Number(baseWeights.treasure) || 0.05) + (equivalentLuckLevel * (Number(luckConfig.treasureDeltaPerLevel) || 0.021)))
    };

    for (const key of FISHING_CATEGORY_KEYS) {
        if (!availableCategories.includes(key)) {
            rawWeights[key] = 0;
        }
    }

    const totalWeight = FISHING_CATEGORY_KEYS.reduce((sum, key) => sum + Math.max(0, rawWeights[key] || 0), 0);
    if (totalWeight <= 0) {
        if (!availableCategories.length) {
            return Object.fromEntries(FISHING_CATEGORY_KEYS.map(key => [key, 0]));
        }

        const fallbackWeight = 1 / availableCategories.length;
        return Object.fromEntries(FISHING_CATEGORY_KEYS.map(key => [key, availableCategories.includes(key) ? fallbackWeight : 0]));
    }

    return Object.fromEntries(
        FISHING_CATEGORY_KEYS.map(key => [key, Math.max(0, rawWeights[key] || 0) / totalWeight])
    );
}

function resolveAverageLootAttemptsPerRoll({ eligibleLoot, netData, mode, environment }) {
    const baseChanceTotal = eligibleLoot.reduce((sum, loot) => sum + Math.max(0, Number(loot?.chance) || 0), 0);
    const pressure = Math.max(0, Number(netData?.chance) || 0)
        * Math.max(0, Number(mode?.chanceMultiplier) || 1)
        * Math.max(0, Number(environment?.chanceMultiplier) || 1);

    return Math.max(0, baseChanceTotal * pressure);
}

function rollLootAttemptsForRoll(operation) {
    const floatAttempts = Math.max(0, Number(operation?.averageLootAttemptsPerRoll) || 0);
    if (floatAttempts <= 0) return 0;

    const guaranteedAttempts = Math.floor(floatAttempts);
    const fractional = floatAttempts - guaranteedAttempts;
    return guaranteedAttempts + (Math.random() < fractional ? 1 : 0);
}

function pickLootCategory(categoryWeights) {
    const weights = FISHING_CATEGORY_KEYS
        .map(key => [key, Math.max(0, Number(categoryWeights?.[key]) || 0)])
        .filter(([, weight]) => weight > 0);
    if (!weights.length) return null;

    const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (const [key, weight] of weights) {
        roll -= weight;
        if (roll <= 0) return key;
    }

    return weights[weights.length - 1]?.[0] ?? null;
}

function pickWeightedLootEntry(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;

    const weightedEntries = entries
        .map(entry => [entry, Math.max(0, Number(entry?.chance) || 0)])
        .filter(([, weight]) => weight > 0);
    if (!weightedEntries.length) {
        return entries[Math.floor(Math.random() * entries.length)] ?? null;
    }

    const totalWeight = weightedEntries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (const [entry, weight] of weightedEntries) {
        roll -= weight;
        if (roll <= 0) return entry;
    }

    return weightedEntries[weightedEntries.length - 1]?.[0] ?? null;
}

function estimateExpectedOutputs(operation) {
    const attemptsPerRoll = Math.max(0, Number(operation?.averageLootAttemptsPerRoll) || 0);
    if (attemptsPerRoll <= 0) return 0;

    let expectedPerAttempt = 0;
    for (const categoryKey of FISHING_CATEGORY_KEYS) {
        const categoryChance = Math.max(0, Number(operation?.categoryWeights?.[categoryKey]) || 0);
        if (categoryChance <= 0) continue;

        const entries = operation?.eligibleLootByCategory?.get?.(categoryKey) ?? [];
        const totalWeight = entries.reduce((sum, loot) => sum + Math.max(0, Number(loot?.chance) || 0), 0);
        if (!entries.length || totalWeight <= 0) continue;

        let categoryAverageAmount = 0;
        for (const loot of entries) {
            const averageBaseAmount = Array.isArray(loot.amount)
                ? ((Number(loot.amount[0]) || 0) + (Number(loot.amount[1]) || 0)) / 2
                : Number(loot.amount) || 1;
            const itemId = resolveLootItemId(loot);
            const averageAmount = shouldLockLootMultiplier(loot, itemId)
                ? Math.max(0, averageBaseAmount)
                : Math.max(0, averageBaseAmount)
                    * Math.max(0, operation.netData.amount)
                    * Math.max(0, Number(operation.mode.amountMultiplier) || 1);
            const itemWeight = Math.max(0, Number(loot?.chance) || 0) / totalWeight;
            categoryAverageAmount += averageAmount * itemWeight;
        }

        expectedPerAttempt += categoryAverageAmount * categoryChance;
    }

    return Math.max(0, Math.round(expectedPerAttempt * attemptsPerRoll * operation.totalRolls));
}

function storeDropsInMachine(machine, drops, overflowLoc) {
    let collectedCount = 0;
    let overflowCount = 0;
    const insertedTypes = new Set();

    for (const stack of drops) {
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue;

        const insertedAmount = insertItemIntoSlots(machine?.inv, stack, ABYSALL_FISHER.slots.outputs);
        if (insertedAmount > 0) {
            collectedCount += insertedAmount;
            insertedTypes.add(stack.typeId);
        }

        const spilled = Math.max(0, stack.amount - insertedAmount);
        if (spilled > 0) {
            overflowCount += spilled;
            try {
                machine?.dim?.spawnItem?.(cloneItemStack(stack, spilled), overflowLoc);
            } catch {
                // Ignore emergency overflow spawn failures.
            }
        }
    }

    return {
        collectedCount,
        overflowCount,
        uniqueTypes: insertedTypes.size
    };
}

function clampDropStacksToAvailableCapacity(container, drops, slots) {
    if (!container || !Array.isArray(drops) || !Array.isArray(slots)) {
        return [];
    }

    const slotStates = slots.map(slot => {
        const stack = container.getItem(slot);
        return {
            slot,
            stack: stack ? cloneItemStack(stack, stack.amount) : null
        };
    });

    const clamped = [];
    for (const stack of drops) {
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue;

        const requestedAmount = Math.max(0, Math.floor(Number(stack.amount) || 0));
        if (requestedAmount <= 0) continue;

        const simulatedStack = cloneItemStack(stack, requestedAmount);
        const insertableAmount = insertItemIntoSlotStates(slotStates, simulatedStack);
        if (insertableAmount <= 0) continue;

        clamped.push(cloneItemStack(stack, insertableAmount));
    }

    return clamped;
}

function simulateDropStorage(container, drops, slots) {
    if (!container || !Array.isArray(drops) || !Array.isArray(slots)) {
        return {
            completed: false,
            overflowCount: drops?.reduce?.((sum, stack) => sum + Math.max(0, Number(stack?.amount) || 0), 0) ?? 0
        };
    }

    const slotStates = slots.map(slot => {
        const stack = container.getItem(slot);
        return {
            slot,
            stack: stack ? cloneItemStack(stack, stack.amount) : null
        };
    });

    let overflowCount = 0;
    for (const stack of drops) {
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue;
        const insertedAmount = insertItemIntoSlotStates(slotStates, stack);
        overflowCount += Math.max(0, stack.amount - insertedAmount);
    }

    return {
        completed: overflowCount <= 0,
        overflowCount
    };
}

function insertItemIntoSlots(container, stack, slots) {
    if (!container || !stack?.typeId || !Array.isArray(slots) || slots.length <= 0) return 0;

    let remaining = stack.amount;

    for (const slot of slots) {
        const slotItem = container.getItem(slot);
        if (!canStacksMerge(slotItem, stack)) continue;

        const space = Math.max(0, (slotItem.maxAmount ?? resolveMaxStackSize(slotItem, slotItem.typeId)) - slotItem.amount);
        if (space <= 0) continue;

        const amountToInsert = Math.min(space, remaining);
        slotItem.amount += amountToInsert;
        container.setItem(slot, slotItem);
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    for (const slot of slots) {
        const slotItem = container.getItem(slot);
        if (slotItem) continue;

        const amountToInsert = Math.min(resolveMaxStackSize(stack, stack.typeId), remaining);
        const newStack = cloneItemStack(stack, amountToInsert);
        container.setItem(slot, newStack);
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    return stack.amount - remaining;
}

function insertItemIntoSlotStates(slotStates, stack) {
    if (!Array.isArray(slotStates) || !stack?.typeId || stack.amount <= 0) return 0;

    let remaining = stack.amount;

    for (const state of slotStates) {
        if (!canStacksMerge(state.stack, stack)) continue;

        const maxAmount = resolveMaxStackSize(state.stack, state.stack?.typeId);
        const space = Math.max(0, maxAmount - (state.stack?.amount ?? 0));
        if (space <= 0) continue;

        const amountToInsert = Math.min(space, remaining);
        state.stack.amount += amountToInsert;
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    for (const state of slotStates) {
        if (state.stack) continue;

        const amountToInsert = Math.min(resolveMaxStackSize(stack, stack.typeId), remaining);
        state.stack = cloneItemStack(stack, amountToInsert);
        remaining -= amountToInsert;
        if (remaining <= 0) {
            return stack.amount;
        }
    }

    return stack.amount - remaining;
}

function cloneItemStack(stack, amount = stack?.amount ?? 1) {
    if (typeof stack?.clone === "function") {
        const clone = stack.clone();
        clone.amount = amount;
        return clone;
    }

    const clone = new ItemStack(stack.typeId, amount);
    if (stack?.nameTag) clone.nameTag = stack.nameTag;
    const lore = typeof stack?.getLore === "function" ? stack.getLore() : [];
    if (Array.isArray(lore) && lore.length && typeof clone.setLore === "function") {
        clone.setLore(lore);
    }
    const durability = stack?.getComponent?.("minecraft:durability");
    const cloneDurability = clone.getComponent?.("minecraft:durability");
    if (durability && cloneDurability && Number.isFinite(Number(durability.damage))) {
        cloneDurability.damage = Math.max(0, Math.floor(Number(durability.damage)));
    }
    return clone;
}

function resolveMaxStackSize(slot, outputId) {
    if (slot?.maxAmount) return slot.maxAmount;
    if (!outputId) return 64;

    const cached = MAX_STACK_SIZE_CACHE.get(outputId);
    if (cached) return cached;

    try {
        const probe = new ItemStack(outputId, 1);
        if (probe?.maxAmount) {
            MAX_STACK_SIZE_CACHE.set(outputId, probe.maxAmount);
            return probe.maxAmount;
        }

        const component = probe?.getComponent?.("minecraft:max_stack_size");
        if (typeof component?.value === "number") {
            MAX_STACK_SIZE_CACHE.set(outputId, component.value);
            return component.value;
        }
    } catch {
        // Ignore invalid probes and fall back to a standard stack size.
    }

    MAX_STACK_SIZE_CACHE.set(outputId, 64);
    return 64;
}

function getStackLore(stack) {
    const lore = typeof stack?.getLore === "function" ? stack.getLore() : [];
    return Array.isArray(lore) ? lore : [];
}

function getDurabilityDamage(stack) {
    const durability = stack?.getComponent?.("minecraft:durability");
    if (!durability) return 0;
    return Math.max(0, Math.floor(Number(durability.damage) || 0));
}

function areStringArraysEqual(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function normalizeEnchantmentId(type) {
    if (!type) return "";
    const id = type.id ?? type.identifier ?? type.typeId ?? type.name ?? "";
    return typeof id === "string" ? id.toLowerCase() : "";
}

function normalizeEnchantmentList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(entry => {
            const id = normalizeEnchantmentId(entry?.type);
            const level = Math.floor(Number(entry?.level ?? 0));
            if (!id || level <= 0) return null;
            return { id, level };
        })
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id) || a.level - b.level);
}

function buildEnchantmentSignature(list) {
    const normalized = normalizeEnchantmentList(list);
    if (!normalized.length) return "";
    return normalized.map(entry => `${entry.id}:${entry.level}`).join("|");
}

function canStacksMerge(existing, incoming) {
    if (!existing || !incoming) return false;
    if (existing.typeId !== incoming.typeId) return false;
    if ((existing.nameTag ?? "") !== (incoming.nameTag ?? "")) return false;
    if (!areStringArraysEqual(getStackLore(existing), getStackLore(incoming))) return false;
    if (getDurabilityDamage(existing) !== getDurabilityDamage(incoming)) return false;
    return buildEnchantmentSignature(extractEnchantments(existing)) === buildEnchantmentSignature(extractEnchantments(incoming));
}

function createBookDropStacks(amount, netTier = 0, netLuck = 0) {
    const total = Math.max(0, Math.floor(amount ?? 0));
    if (total <= 0) return [];

    const allTypes = getAllEnchantmentTypes();
    if (!allTypes?.length) {
        return createPlainItemStacks(BOOK_ITEM_ID, total);
    }

    const enchantConfig = {
        chance: BOOK_ENCHANT_CONFIG.baseChance ?? 0.2,
        chancePerTier: BOOK_ENCHANT_CONFIG.chancePerTier ?? 0,
        chancePerLuck: BOOK_ENCHANT_CONFIG.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck ?? 0,
        maxChance: BOOK_ENCHANT_CONFIG.maxChance ?? 1,
        count: [
            BOOK_ENCHANT_CONFIG.minCount ?? 1,
            BOOK_ENCHANT_CONFIG.maxCount ?? 3
        ],
        countPerLuck: BOOK_ENCHANT_CONFIG.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck ?? 0,
        qualityPerLuck: BOOK_ENCHANT_CONFIG.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck ?? 0,
        minQuality: BOOK_ENCHANT_CONFIG.minQuality ?? 0,
        guaranteedLuckThreshold: BOOK_ENCHANT_CONFIG.guaranteedLuckThreshold,
        guaranteedTierThreshold: BOOK_ENCHANT_CONFIG.guaranteedTierThreshold
    };
    const finalChance = resolveEnchantChance(enchantConfig, netTier, netLuck);
    const [minEnchantments, maxEnchantments] = resolveEnchantCountRange(enchantConfig, 1, 1, netTier, netLuck, allTypes.length);
    const qualityFactor = resolveEnchantQualityFactor(enchantConfig, netTier, netLuck);

    if (maxEnchantments <= 0) {
        return createPlainItemStacks(BOOK_ITEM_ID, total);
    }

    const stacks = [];
    for (let index = 0; index < total; index += 1) {
        if (Math.random() > finalChance) {
            stacks.push(new ItemStack(BOOK_ITEM_ID, 1));
            continue;
        }

        const bookStack = new ItemStack(ENCHANTED_BOOK_ITEM_ID, 1);
        const enchantCount = DoriosAPI.math.randomInterval(minEnchantments, maxEnchantments);
        const enchantments = rollRandomEnchantmentsForItem(bookStack, enchantCount, qualityFactor);

        if (enchantments.length > 0 && enchantItem(bookStack, enchantments)) {
            stacks.push(bookStack);
        } else {
            stacks.push(new ItemStack(BOOK_ITEM_ID, 1));
        }
    }

    return stacks;
}

function createEquipmentDropStacks(loot, amount, netLuck = 0, netTier = 0) {
    const total = Math.max(0, Math.floor(amount ?? 0));
    if (total <= 0) return [];

    const damageRange = loot.durabilityDamageRange ?? EQUIPMENT_CONFIG.durabilityDamageRange;
    const randomEnchant = loot.randomEnchant ?? {};
    const enchantConfig = {
        chance: randomEnchant.chance ?? EQUIPMENT_CONFIG.enchantChance ?? 0,
        chancePerTier: randomEnchant.chancePerTier ?? EQUIPMENT_CONFIG.chancePerTier ?? 0,
        chancePerLuck: randomEnchant.chancePerLuck ?? EQUIPMENT_CONFIG.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck ?? 0,
        maxChance: randomEnchant.maxChance ?? EQUIPMENT_CONFIG.maxChance ?? 1,
        count: randomEnchant.count ?? EQUIPMENT_CONFIG.enchantCount,
        countPerLuck: randomEnchant.countPerLuck ?? EQUIPMENT_CONFIG.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck ?? 0,
        countPerTier: randomEnchant.countPerTier,
        qualityPerLuck: randomEnchant.qualityPerLuck ?? EQUIPMENT_CONFIG.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck ?? 0,
        qualityPerTier: randomEnchant.qualityPerTier,
        minQuality: randomEnchant.minQuality ?? EQUIPMENT_CONFIG.minQuality ?? 0,
        guaranteedLuckThreshold: randomEnchant.guaranteedLuckThreshold ?? EQUIPMENT_CONFIG.guaranteedLuckThreshold,
        guaranteedTierThreshold: randomEnchant.guaranteedTierThreshold ?? EQUIPMENT_CONFIG.guaranteedTierThreshold
    };
    const enchantChance = resolveEnchantChance(enchantConfig, netTier, netLuck);
    const qualityFactor = resolveEnchantQualityFactor(enchantConfig, netTier, netLuck);
    const probeStack = new ItemStack(loot.item, 1);
    const compatibleTypes = getCompatibleEnchantmentTypes(probeStack);
    const [minEnchantCount, maxEnchantCount] = resolveEnchantCountRange(
        enchantConfig,
        1,
        1,
        netTier,
        netLuck,
        compatibleTypes.length
    );

    const stacks = [];
    for (let index = 0; index < total; index += 1) {
        const stack = new ItemStack(loot.item, 1);
        applyRandomDurability(stack, damageRange);

        if (compatibleTypes.length > 0 && enchantChance > 0 && Math.random() <= enchantChance) {
            const enchantCount = DoriosAPI.math.randomInterval(minEnchantCount, maxEnchantCount);
            const enchantments = rollRandomEnchantmentsForItem(stack, enchantCount, qualityFactor);
            if (enchantments.length > 0) {
                enchantItem(stack, enchantments);
            }
        }

        stacks.push(stack);
    }

    return stacks;
}

function getAllEnchantmentTypes() {
    if (!globalThis.worldLoaded) return [];
    if (cachedEnchantmentTypes) return cachedEnchantmentTypes;

    try {
        cachedEnchantmentTypes = EnchantmentTypes.getAll();
    } catch {
        cachedEnchantmentTypes = [];
    }

    return cachedEnchantmentTypes;
}

function rollRandomEnchantmentsForItem(item, count, qualityFactor = 0) {
    const compatibleTypes = getCompatibleEnchantmentTypes(item);
    return rollRandomEnchantmentsFromTypes(item, compatibleTypes, count, qualityFactor);
}

function getCompatibleEnchantmentTypes(item) {
    const types = getAllEnchantmentTypes();
    if (!types?.length) return [];

    const enchantable = getEnchantableComponent(item);
    if (!enchantable) return [];

    return types.filter(type => canApplyEnchantment(enchantable, type));
}

function getEnchantableComponent(stack) {
    if (!stack || typeof stack.getComponent !== "function") return null;
    return stack.getComponent("minecraft:enchantable")
        ?? stack.getComponent("minecraft:enchantments")
        ?? stack.getComponent("enchantments")
        ?? null;
}

function canApplyEnchantment(enchantComp, type) {
    if (!enchantComp || !type) return false;
    if (typeof enchantComp.canAddEnchantment === "function") {
        let can = null;
        try {
            can = enchantComp.canAddEnchantment({ type, level: 1 });
        } catch {
            can = null;
        }
        if (can === true) return true;

        try {
            can = enchantComp.canAddEnchantment(type);
        } catch {
            can = null;
        }
        if (can === true) return true;
        if (can === false) return false;
        return false;
    }

    return true;
}

function canWriteEnchantments(enchantComp) {
    if (!enchantComp) return false;
    if (typeof enchantComp.addEnchantments === "function") return true;
    if (typeof enchantComp.addEnchantment === "function") return true;
    return false;
}

function sanitizeEnchantmentEntries(enchantComp, enchantments) {
    if (!Array.isArray(enchantments)) return [];

    const selected = new Map();
    for (const entry of enchantments) {
        const level = Math.floor(Number(entry?.level ?? 0));
        const type = entry?.type ?? null;
        const id = normalizeEnchantmentId(type);
        if (!id || level <= 0) continue;
        if (!canApplyEnchantment(enchantComp, type)) continue;

        const previous = selected.get(id);
        if (!previous || previous.level < level) {
            selected.set(id, { type, level });
        }
    }

    return [...selected.values()];
}

function applyEnchantmentEntriesToStack(targetStack, enchantments) {
    const enchantComp = getEnchantableComponent(targetStack);
    if (!enchantComp || !canWriteEnchantments(enchantComp)) return false;

    const sanitized = sanitizeEnchantmentEntries(enchantComp, enchantments);
    if (!sanitized.length) return false;

    try {
        enchantComp.removeAllEnchantments?.();
    } catch {
        // Ignore components that do not support explicit clearing.
    }

    try {
        if (typeof enchantComp.addEnchantments === "function") {
            enchantComp.addEnchantments(sanitized);
        } else if (typeof enchantComp.addEnchantment === "function") {
            for (const entry of sanitized) {
                enchantComp.addEnchantment(entry);
            }
        } else {
            return false;
        }
    } catch {
        return false;
    }

    return buildEnchantmentSignature(extractEnchantments(targetStack)) === buildEnchantmentSignature(sanitized);
}

function buildVerifiedEnchantmentPlan(item, enchantments) {
    const trialStack = cloneItemStack(item, 1);
    if (!applyEnchantmentEntriesToStack(trialStack, enchantments)) {
        return [];
    }

    return extractEnchantments(trialStack);
}

function buildEnchantCandidatePool(types) {
    if (!Array.isArray(types) || !types.length) return [];

    const typeById = new Map(types.map(type => [normalizeEnchantmentId(type), type]));
    const consumedIds = new Set();
    const pool = [];

    for (const source of ABYSSAL_ENCHANTMENT_SOURCES) {
        const options = (source.entries ?? [])
            .map(id => typeById.get(String(id).toLowerCase()))
            .filter(Boolean);
        if (!options.length) continue;

        for (const option of options) {
            consumedIds.add(normalizeEnchantmentId(option));
        }

        pool.push({
            options,
            weight: Math.max(0, Number(source.weight ?? 1) || 1)
        });
    }

    const fallbackOptions = types.filter(type => !consumedIds.has(normalizeEnchantmentId(type)));
    if (fallbackOptions.length) {
        pool.push({
            options: fallbackOptions,
            weight: 1
        });
    }

    return pool;
}

function pickCandidateFromPool(pool, blockedIds) {
    const availablePool = pool
        .map(entry => ({
            ...entry,
            options: entry.options.filter(option => !blockedIds.has(normalizeEnchantmentId(option)))
        }))
        .filter(entry => entry.options.length > 0);

    const source = pickWeightedPoolEntry(availablePool);
    if (!source) return null;

    const choiceIndex = Math.floor(Math.random() * source.options.length);
    return source.options[choiceIndex] ?? null;
}

function pickWeightedPoolEntry(pool) {
    const totalWeight = pool.reduce((sum, entry) => sum + Math.max(0, Number(entry?.weight ?? 1) || 0), 0);
    if (totalWeight <= 0) return pool[0] ?? null;

    let roll = Math.random() * totalWeight;
    for (const entry of pool) {
        roll -= Math.max(0, Number(entry?.weight ?? 1) || 0);
        if (roll <= 0) return entry;
    }

    return pool[pool.length - 1] ?? null;
}

function rollRandomEnchantmentsFromTypes(item, types, count, qualityFactor = 0) {
    if (!item || !types?.length || count <= 0) return [];

    const pool = buildEnchantCandidatePool(types);
    const picked = [];
    const blockedIds = new Set();
    const total = Math.min(count, types.length);

    for (let index = 0; index < total; index += 1) {
        let accepted = false;
        let attempts = 0;

        while (attempts < Math.max(8, types.length * 2)) {
            attempts += 1;

            const type = pickCandidateFromPool(pool, blockedIds);
            if (!type) break;

            const typeId = normalizeEnchantmentId(type);
            const candidate = createRandomEnchantment(type, qualityFactor);
            const verified = buildVerifiedEnchantmentPlan(item, [...picked, candidate]);
            if (verified.length > picked.length) {
                picked.splice(0, picked.length, ...verified);
                blockedIds.add(typeId);
                accepted = true;
                break;
            }

            blockedIds.add(typeId);
        }

        if (!accepted) break;
    }

    return picked;
}

function createRandomEnchantment(type, qualityFactor = 0) {
    const minLevel = type.minLevel ?? 1;
    const maxLevel = type.maxLevel ?? 1;
    const adjustedMin = Math.min(
        maxLevel,
        Math.floor(minLevel + ((maxLevel - minLevel) * clamp(qualityFactor, 0, 1)))
    );
    const level = DoriosAPI.math.randomInterval(adjustedMin, maxLevel);
    return { type, level };
}

function shouldGuaranteeEnchant(config, netTier = 0, netLuck = 0) {
    const guaranteedLuckThreshold = Number(config?.guaranteedLuckThreshold);
    const guaranteedTierThreshold = Number(config?.guaranteedTierThreshold);

    return (Number.isFinite(guaranteedLuckThreshold) && Math.max(0, netLuck) >= guaranteedLuckThreshold)
        || (Number.isFinite(guaranteedTierThreshold) && Math.max(0, netTier) >= guaranteedTierThreshold);
}

function resolveEnchantChance(config, netTier = 0, netLuck = 0) {
    if (shouldGuaranteeEnchant(config, netTier, netLuck)) {
        return 1;
    }

    const baseChance = Number(config?.chance ?? config?.baseChance) || 0;
    const chancePerTier = Number(config?.chancePerTier) || 0;
    const chancePerLuck = Number(config?.chancePerLuck ?? LUCK_CONFIG.enchantChancePerLuck) || 0;
    const maxChance = clamp(Number(config?.maxChance ?? 1) || 1, 0, 1);

    return clamp(
        baseChance
        + (Math.max(0, netTier) * chancePerTier)
        + (Math.max(0, netLuck) * chancePerLuck),
        0,
        maxChance
    );
}

function resolveEnchantCountRange(config, fallbackMin, fallbackMax, netTier = 0, netLuck = 0, maxAvailable = 1) {
    const [baseMin, baseMax] = resolveCountRange(config?.count, fallbackMin, fallbackMax);
    const countPerLuck = Number(config?.countPerLuck ?? LUCK_CONFIG.enchantCountPerLuck) || 0;
    const countPerTier = Number(config?.countPerTier) || 0;
    const bonus = Math.max(0, Math.floor((Math.max(0, netLuck) * countPerLuck) + (Math.max(0, netTier) * countPerTier)));
    const maxCount = Math.min(Math.max(0, maxAvailable), baseMax + bonus);
    const minCount = Math.min(maxCount, baseMin + Math.floor(bonus / 2));

    if (maxCount <= 0) {
        return [0, 0];
    }

    return [
        Math.max(1, minCount),
        Math.max(1, maxCount)
    ];
}

function resolveEnchantQualityFactor(config, netTier = 0, netLuck = 0) {
    const minQuality = Number(config?.minQuality) || 0;
    const qualityPerTier = Number(config?.qualityPerTier) || 0;
    const qualityPerLuck = Number(config?.qualityPerLuck ?? LUCK_CONFIG.enchantQualityPerLuck) || 0;

    return clamp(
        minQuality
        + (Math.max(0, netTier) * qualityPerTier)
        + (Math.max(0, netLuck) * qualityPerLuck),
        0,
        1
    );
}

function enchantItem(item, enchantments) {
    const verified = buildVerifiedEnchantmentPlan(item, enchantments);
    if (!verified.length) return false;
    return applyEnchantmentEntriesToStack(item, verified);
}

function applyRandomDurability(item, damageRange) {
    const durability = item?.getComponent?.("minecraft:durability");
    if (!durability || !Array.isArray(damageRange)) return;

    const minDamage = clamp(Number(damageRange[0]) || 0, 0, 1);
    const maxDamage = clamp(Number(damageRange[1]) || minDamage, minDamage, 1);
    const damagePercent = minDamage + ((maxDamage - minDamage) * Math.random());
    durability.damage = Math.min(durability.maxDurability, Math.floor(durability.maxDurability * damagePercent));
}

function resolveCountRange(value, fallbackMin, fallbackMax) {
    if (Array.isArray(value) && value.length >= 2) {
        return [
            Math.max(1, Math.floor(Number(value[0]) || fallbackMin)),
            Math.max(1, Math.floor(Number(value[1]) || fallbackMax))
        ];
    }

    if (typeof value === "number") {
        const amount = Math.max(1, Math.floor(value));
        return [amount, amount];
    }

    return [fallbackMin, fallbackMax];
}

function transferOutputSlots(machine) {
    let transferred = false;
    for (const slot of ABYSALL_FISHER.slots.outputs) {
        transferred = transferSlotForward(machine, slot) || transferred;
    }
    return transferred;
}

function transferSlotForward(machine, slotIndex) {
    const facing = machine.block.getState("utilitycraft:axis");
    if (!facing) return false;

    const offsets = {
        east: [-1, 0, 0],
        west: [1, 0, 0],
        north: [0, 0, 1],
        south: [0, 0, -1],
        up: [0, -1, 0],
        down: [0, 1, 0]
    };

    const offset = offsets[facing];
    if (!offset) return false;

    const { x, y, z } = machine.block.location;
    const targetLoc = { x: x + offset[0], y: y + offset[1], z: z + offset[2] };
    DoriosAPI.containers.transferItemsAt(machine.inv, targetLoc, machine.dim, slotIndex);
    return true;
}

function isQuantityUpgradeItem(item) {
    if (!item?.typeId) return false;

    if (item.typeId === "utilitycraft:quantity_upgrade") {
        return true;
    }

    if (typeof item.hasTag === "function" && item.hasTag("utilitycraft:quantity_upgrade")) {
        return true;
    }

    const [, raw = ""] = item.typeId.split(":");
    return raw === "quantity_upgrade";
}

function buildModeButtonLore(mode) {
    return [
        `§7${mode.summary}`,
        `§7Casts: §f${mode.batchSizes[0]}-${mode.batchSizes[mode.batchSizes.length - 1]}`,
        `§7Water/Cast: §f${formatFluidNeedValue(mode.waterPerCast)}`
    ];
}

function shouldResetProgress(message) {
    return !["No Energy", "Low Water", "Output Full", "Output Conflict"].includes(message);
}

function buildMachineLore(machine, tank, context = {}) {
    const mode = context.mode ?? ABYSALL_FISHER.modes.expedition;
    const environment = context.environment ?? resolveEnvironmentContext(machine.block);
    const quantityLevel = Number(context.quantityLevel ?? 0);
    const castCount = Number(context.castCount ?? getCastCount(mode, quantityLevel));
    const totalRolls = Number(context.totalRolls ?? 0);
    const lastBatch = context.lastBatch ?? null;
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Mode",
            value: mode.title
        },
        {
            label: "Net",
            value: context.netItemId ? formatItemName(context.netItemId) : "None"
        },
        {
            label: "Water",
            value: formatFluidTankBuffer(tank, ABYSALL_FISHER.water.type)
        },
        {
            label: "Casts",
            value: formatBatchWithQuantity(castCount, quantityLevel)
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    appendLoreSection(lines, "Environment Information", [
        {
            label: "Environment",
            value: environment.label
        },
        {
            label: "Tier",
            value: context.effectiveTier ?? 0
        },
        {
            label: "Luck",
            value: Math.round(context.effectiveLuck ?? 0)
        }
    ]);

    const operationInfo = [
        {
            label: "Expected",
            value: context.expectedOutputs ?? 0
        },
        {
            label: "Cost",
            value: formatEnergyWithFluidCost(context.energyCost ?? 0, context.waterCost ?? 0, "Water")
        },
        {
            label: "Cycle",
            value: formatSecondsLabel(context.cycleSeconds ?? 0)
        },
        {
            label: "Rolls",
            value: totalRolls
        }
    ];

    appendLoreSection(lines, "Fishing Operation", operationInfo);

    const batchInfo = [];
    if (lastBatch?.produced > 0) {
        batchInfo.push(`§7Stored: §f${lastBatch.produced} items §7(${lastBatch.uniqueOutputs} outputs)`);
    }
    if (lastBatch?.preventedOverflow && lastBatch.overflow > 0) {
        batchInfo.push(`§6Paused to prevent overflow: §f${lastBatch.overflow}`);
    } else if (lastBatch?.overflow > 0) {
        batchInfo.push(`§6Overflow dropped: §f${lastBatch.overflow}`);
    }

    if (batchInfo.length > 0) {
        appendLoreSection(lines, "Last Batch", batchInfo);
    }

    return lines;
}

function buildFooterLines(context = {}) {
    const mode = context.mode ?? ABYSALL_FISHER.modes.expedition;
    const environment = context.environment ?? { label: "Reservoir" };
    return [
        `Mode: ${mode.title}`,
        `Env: ${environment.label}`,
        `Casts: ${formatBatchWithQuantity(context.castCount ?? 1, context.quantityLevel ?? 0)}`
    ];
}

function updateDisplays(machine, tank, refreshUi = true) {
    if (!refreshUi) return;

    tank.display(ABYSALL_FISHER.slots.waterDisplay);
    machine.displayEnergy(ABYSALL_FISHER.slots.energy);
    machine.displayProgress(ABYSALL_FISHER.slots.progress);
}

function showMachineWarning(machine, tank, message, context = {}, resetProgress = true, refreshUi = true) {
    machine.off();
    if (!refreshUi) return;

    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(machine, tank, { ...context, message }),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, tank, true);
}

function showMachineStatus(machine, tank, message, context = {}, refreshUi = true) {
    machine.on();
    if (!refreshUi) return;

    machine.showStatus(
        message,
        buildMachineLore(machine, tank, context),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine, tank, true);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

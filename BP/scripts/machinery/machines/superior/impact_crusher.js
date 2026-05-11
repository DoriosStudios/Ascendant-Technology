import { ItemStack } from "@minecraft/server";
import {
    Machine,
    FluidManager,
    updatePipes,
    canFluidNodeProvide,
    isFluidNodeEnabled,
    fluidNodeMatchesType,
    findRecipeByInputId,
    resolveRecipeTimeSeconds,
    buildOverclockLoreLine,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate,
    formatItemName,
    formatFluidDisplayName
} from "../../../DoriosCore/main.js";
import { getPulverizerRecipes } from "../../../config/recipes/pulverizer.js";
import {
    formatBatchWithQuantity,
    formatEnergyCost,
    formatMachineEnergyBuffer,
    formatPercentValue,
    shouldRefreshSuperiorUi
} from "./utils.js";

const PULVERIZER_RECIPE_BASELINE = Object.freeze({
    energyCost: 1600,
    seconds: 3
});

const IMPACT_CRUSHER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        heat: 2,
        inputs: Object.freeze([3, 4]),
        laneOneOutputs: Object.freeze([5, 6]),
        laneTwoOutputs: Object.freeze([7, 8]),
        upgrades: Object.freeze([9, 10, 11, 12]),
        lavaInput: 13,
        lavaDisplay: 14,
        coolantInput: 15,
        coolantDisplay: 16,
        laneProgress: Object.freeze([17, 18]),
        hidden: Object.freeze([19])
    }),
    transfer: Object.freeze({
        itemAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        }),
        fluidAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        })
    }),
    quantity: Object.freeze({
        maxLevel: 4,
        batchSizes: Object.freeze([1, 2, 3, 4, 5])
    }),
    fluids: Object.freeze({
        lava: Object.freeze(["lava"]),
        coolant: Object.freeze(["water", "cryofluid", "saline_coolant"])
    }),
    defaults: Object.freeze({
        energyCost: 4400,
        lavaPerCraft: 400,
        fluidCap: 32000,
        fluidInputRate: 1000,
        baseRecipeSeconds: 0.65,
        tickIntervalTicks: 2
    }),
    progress: Object.freeze({
        indicator: "arrow_right",
        temperatureIndicator: "temperature",
        temperatureSegments: 31
    }),
    thermal: Object.freeze({
        maxHeat: 1000,
        safeThreshold: 350,
        warningThreshold: 700,
        hardThreshold: 900,
        passiveCooling: 10,
        idleCoolingBonus: 10,
        lockedCoolingBonus: 15,
        heatPerActiveLane: 16,
        heatPerCraft: 5,
        craftBurstBonus: 10,
        coolant: Object.freeze({
            water: Object.freeze({
                id: "water",
                label: "Water",
                color: "§9",
                baseConsumption: 50,
                perActiveConsumption: 50,
                baseCooling: 15,
                perActiveCooling: 8
            }),
            cryofluid: Object.freeze({
                id: "cryofluid",
                label: "Cryofluid",
                color: "§b",
                baseConsumption: 30,
                perActiveConsumption: 25,
                baseCooling: 35,
                perActiveCooling: 20
            }),
            salineCoolant: Object.freeze({
                id: "saline_coolant",
                label: "Saline Coolant",
                color: "§3",
                baseConsumption: 35,
                perActiveConsumption: 40,
                baseCooling: 30,
                perActiveCooling: 16
            })
        })
    })
});

const LANE_PROGRESS_KEYS = IMPACT_CRUSHER.slots.inputs.map((_, index) => `impact_crusher:lane_progress_${index}`);
const STATE_KEYS = Object.freeze({
    heat: "impact_crusher:heat",
    lockActive: "impact_crusher:lock_active",
    lockSignature: "impact_crusher:lock_signature"
});
const MAX_STACK_SIZE_CACHE = new Map();
const ALL_OUTPUT_SLOTS = Object.freeze([
    ...IMPACT_CRUSHER.slots.laneOneOutputs,
    ...IMPACT_CRUSHER.slots.laneTwoOutputs
]);

DoriosAPI.register.blockComponent("impact_crusher", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? IMPACT_CRUSHER.defaults.energyCost);
            machine.displayEnergy(IMPACT_CRUSHER.slots.energy);
            machine.blockSlots([
                IMPACT_CRUSHER.slots.lavaInput,
                IMPACT_CRUSHER.slots.lavaDisplay,
                IMPACT_CRUSHER.slots.coolantInput,
                IMPACT_CRUSHER.slots.coolantDisplay,
                ...IMPACT_CRUSHER.slots.laneProgress,
                ...IMPACT_CRUSHER.slots.hidden
            ]);

            const { lavaTank, coolantTank } = getImpactCrusherTanks(machine, settings);

            setHeat(machine.entity, 0);
            clearLock(machine.entity);
            resetLaneProgressIndicators(machine, true);
            updateDisplays(machine, lavaTank, coolantTank, true);
            renderStatus(machine, {
                header: "Idle",
                headerColor: "§e",
                lavaTank,
                coolantTank,
                quantityLevel: 0,
                batchSize: getBatchSize(0),
                heat: 0,
                laneStates: createIdleLaneStates(),
                focusLane: null,
                cooling: null,
                burned: null,
                locked: false
            }, true);
        });
    },

    onPlayerInteract(e, { params: settings }) {
        const machine = new Machine(e.block, settings, true);
        if (!machine?.entity) return;

        const handled = handleImpactCrusherFluidInteraction(e.player, machine, settings);
        if (handled) {
            e.cancel = true;
        }
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid) return;

        const { lavaTank, coolantTank } = getImpactCrusherTanks(machine, settings);
        const recipes = resolveRecipes(e.block, settings);
        const quantityLevel = getQuantityUpgradeLevel(machine);
        const batchSize = getBatchSize(quantityLevel);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "impact_crusher:ui");

        runAdaptiveTickGate(
            machine.entity,
            "impact_crusher:item_io",
            IMPACT_CRUSHER.transfer.itemAdaptive,
            () => {
                const hasOutputItems = ALL_OUTPUT_SLOTS.some(slot => !!machine.inv.getItem(slot));
                const hasInputRoom = IMPACT_CRUSHER.slots.inputs.some(slot => {
                    const stack = machine.inv.getItem(slot);
                    return !stack || stack.amount < stack.maxAmount;
                });

                if (!hasOutputItems && !hasInputRoom) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                let moved = transferOutputLanes(machine);
                for (const slot of IMPACT_CRUSHER.slots.inputs) {
                    moved = machine.pullItemsFromAbove(slot) || moved;
                }

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        runAdaptiveTickGate(
            machine.entity,
            "impact_crusher:fluid_io",
            IMPACT_CRUSHER.transfer.fluidAdaptive,
            () => {
                const lavaFree = Math.max(0, lavaTank?.getFreeSpace?.() ?? 0);
                const coolantFree = Math.max(0, coolantTank?.getFreeSpace?.() ?? 0);
                if (lavaFree <= 0 && coolantFree <= 0) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                const nodes = resolveFluidNodes(machine, e.block);
                if (!nodes.length) {
                    return ADAPTIVE_CHECK_RESULT.stalled;
                }

                const fluidRate = resolveFluidInputRate(settings);
                let moved = false;

                if (lavaFree > 0) {
                    moved = pullFluidFromNetwork(
                        machine,
                        e.block,
                        lavaTank,
                        IMPACT_CRUSHER.fluids.lava,
                        fluidRate,
                        nodes
                    ) || moved;
                }

                if (coolantFree > 0) {
                    moved = pullFluidFromNetwork(
                        machine,
                        e.block,
                        coolantTank,
                        IMPACT_CRUSHER.fluids.coolant,
                        fluidRate,
                        nodes
                    ) || moved;
                }

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        if (isLockActive(machine.entity)) {
            const lockContext = handleLockedMachine(machine, lavaTank, coolantTank, quantityLevel, batchSize);
            renderStatus(machine, lockContext, shouldRefreshUi);
            updateDisplays(machine, lavaTank, coolantTank, shouldRefreshUi);
            machine.off();
            return;
        }

        if (!recipes.length) {
            resetLaneProgressIndicators(machine, shouldRefreshUi);
            const cooling = applyThermalCycle(machine, coolantTank, {
                activeLaneCount: 0,
                plannedCrafts: 0,
                craftedLaneCount: 0,
                locked: false
            });
            renderStatus(machine, {
                header: "No Recipes",
                headerColor: "§c",
                lavaTank,
                coolantTank,
                quantityLevel,
                batchSize,
                heat: cooling.heat,
                laneStates: createStaticLaneStates("§cNo Crusher Recipes"),
                focusLane: null,
                cooling,
                burned: null,
                locked: false
            }, shouldRefreshUi);
            updateDisplays(machine, lavaTank, coolantTank, shouldRefreshUi);
            machine.off();
            return;
        }

        const yieldBoost = Math.max(1, machine.boosts.overclockYield ?? 1);
        const laneStates = buildLaneStates(machine, recipes, lavaTank, batchSize, yieldBoost, settings);
        let availableEnergy = machine.energy.get();
        let rateBudget = machine.rate;
        let active = false;
        let craftedAnything = false;
        let craftedLaneCount = 0;
        let plannedCrafts = 0;

        const currentHeat = getHeat(machine.entity);
        const thermalSpeedMultiplier = resolveThermalSpeedMultiplier(currentHeat);

        for (let index = 0; index < laneStates.length; index++) {
            const lane = laneStates[index];
            if (lane.ready) {
                plannedCrafts += lane.craftCount;
            }

            if (!lane.ready) {
                finalizeLane(machine, lane, shouldRefreshUi);
                continue;
            }

            active = true;

            if (machine.energy.get() <= 0 || availableEnergy <= 0 || rateBudget <= 0) {
                lane.message = lane.progress > 0 ? "Holding Heat" : "No Energy";
                lane.color = lane.progress > 0 ? "§6" : "§c";
                finalizeLane(machine, lane, shouldRefreshUi);
                continue;
            }

            const remainingActive = countEnergyReadyLanes(laneStates, index);
            if (remainingActive > 0 && lane.progress < lane.energyCost) {
                const consumption = machine.boosts.consumption;
                const progressNeeded = lane.energyCost - lane.progress;
                const laneChargeCap = resolveLaneEnergyChargeCap(lane, machine, currentHeat);
                const laneBudget = Math.min(
                    availableEnergy / remainingActive,
                    rateBudget / remainingActive,
                    progressNeeded * consumption,
                    laneChargeCap
                );

                if (laneBudget > 0) {
                    const consumed = machine.energy.consume(laneBudget);
                    if (consumed > 0) {
                        availableEnergy = Math.max(0, availableEnergy - consumed);
                        rateBudget = Math.max(0, rateBudget - consumed);
                        lane.progress += consumed / Math.max(consumption, Number.EPSILON);
                        lane.message = thermalSpeedMultiplier < 1 ? "Thermal Strain" : "Charging Impact";
                        lane.color = thermalSpeedMultiplier < 1 ? "§6" : "§a";
                    }
                }
            }

            if (lane.ready && lane.progress >= lane.energyCost) {
                const crafted = craftLane(machine, lane, lavaTank, yieldBoost);
                if (crafted.count > 0) {
                    craftedAnything = true;
                    craftedLaneCount += 1;
                    lane.message = `Crushed x${crafted.count}`;
                    lane.color = "§2";
                    lane.progress = Math.max(0, lane.progress - lane.energyCost);
                }
            }

            if (lane.ready && lane.message === "Ready Impact") {
                lane.color = currentHeat >= IMPACT_CRUSHER.thermal.warningThreshold ? "§6" : "§a";
            }

            finalizeLane(machine, lane, shouldRefreshUi);
        }

        const cooling = applyThermalCycle(machine, coolantTank, {
            activeLaneCount: laneStates.filter(lane => lane.ready).length,
            plannedCrafts,
            craftedLaneCount,
            locked: false
        });

        if (cooling.overheated) {
            const burned = triggerOverheat(machine, shouldRefreshUi);
            renderStatus(machine, {
                header: "Overheated",
                headerColor: "§c",
                lavaTank,
                coolantTank,
                quantityLevel,
                batchSize,
                heat: getHeat(machine.entity),
                laneStates,
                focusLane: laneStates.find(lane => lane.typeId) ?? null,
                cooling,
                burned,
                locked: true
            }, shouldRefreshUi);
            updateDisplays(machine, lavaTank, coolantTank, shouldRefreshUi);
            machine.off();
            return;
        }

        const focusLane = laneStates.find(lane => lane.ready) ?? laneStates.find(lane => lane.typeId) ?? null;
        const header = inferHeader({ laneStates, craftedAnything, active, heat: cooling.heat, energy: machine.energy.get(), coolantTank });
        const headerColor = inferHeaderColor({ laneStates, craftedAnything, active, heat: cooling.heat, energy: machine.energy.get(), coolantTank });

        renderStatus(machine, {
            header,
            headerColor,
            lavaTank,
            coolantTank,
            quantityLevel,
            batchSize,
            heat: cooling.heat,
            laneStates,
            focusLane,
            cooling,
            burned: null,
            locked: false
        }, shouldRefreshUi);
        updateDisplays(machine, lavaTank, coolantTank, shouldRefreshUi);

        if (active || craftedAnything) {
            machine.on();
        } else {
            machine.off();
        }
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function resolveRecipes(block, settings) {
    const component = block.getComponent("utilitycraft:machine_recipes")?.customComponentParameters?.params;
    if (component?.type === "impact_crusher" || component?.type === "pulverizer" || component?.type === "crusher") {
        return getPulverizerRecipes();
    }
    if (Array.isArray(component)) return component;
    if (Array.isArray(settings?.machine?.recipes)) return settings.machine.recipes;
    return getPulverizerRecipes();
}

function getImpactCrusherTanks(machine, settings) {
    applyImpactCrusherFluidWhitelist(machine?.entity);

    const tanks = FluidManager.initializeMultiple(machine.entity, 2);
    const boostedCap = Math.max(
        1,
        Math.floor(resolveTankCapacity(settings) * Math.max(1, Number(machine?.boosts?.overclockCapacity ?? 1)))
    );

    for (const tank of tanks) {
        ensureTankSetup(tank, boostedCap);
        normalizeTankState(tank);
    }

    const lavaSelection = selectRoleTank(tanks, IMPACT_CRUSHER.fluids.lava);
    const coolantSelection = selectRoleTank(
        tanks,
        IMPACT_CRUSHER.fluids.coolant,
        new Set(lavaSelection ? [lavaSelection.index] : [])
    );

    return {
        tanks,
        lavaTank: lavaSelection?.tank ?? null,
        coolantTank: coolantSelection?.tank ?? null
    };
}

function resolveTankCapacity(settings) {
    const configured = Number(settings?.machine?.fluid_cap);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return IMPACT_CRUSHER.defaults.fluidCap;
}

function resolveFluidInputRate(settings) {
    const configured = Number(settings?.machine?.fluid_rate);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return IMPACT_CRUSHER.defaults.fluidInputRate;
}

function normalizeAllowedFluidTypes(allowedTypes) {
    if (!Array.isArray(allowedTypes)) return [];
    return [...new Set(
        allowedTypes
            .filter(type => typeof type === "string" && type.length > 0)
            .map(type => type.toLowerCase())
    )];
}

function applyImpactCrusherFluidWhitelist(entity) {
    if (!entity) return;

    const allowedTypes = normalizeAllowedFluidTypes([
        ...IMPACT_CRUSHER.fluids.lava,
        ...IMPACT_CRUSHER.fluids.coolant
    ]);

    const whitelistValue = allowedTypes.join(",");
    if (entity.getDynamicProperty?.("dorios:fluid_whitelist") !== whitelistValue) {
        entity.setDynamicProperty?.("dorios:fluid_whitelist", whitelistValue);
    }

    const currentTags = new Set(entity.getTags?.() ?? []);
    for (const type of allowedTypes) {
        const tag = `fluidWhitelist:${type}`;
        if (!currentTags.has(tag)) {
            entity.addTag?.(tag);
        }
    }
}

function ensureTankSetup(tank, cap) {
    if (!tank) return tank;
    if (cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap);
    }
    return tank;
}

function normalizeTankState(tank) {
    if (!tank) return tank;
    if ((tank.get?.() ?? 0) <= 0 && tank.getType?.() !== "empty") {
        tank.setType("empty");
    }
    return tank;
}

function selectRoleTank(tanks, allowedTypes, excludedIndexes = new Set()) {
    const normalizedAllowed = normalizeAllowedFluidTypes(allowedTypes);
    if (!normalizedAllowed.length || !Array.isArray(tanks)) return null;

    let reserved = null;
    let empty = null;

    for (let index = 0; index < tanks.length; index++) {
        if (excludedIndexes.has(index)) continue;

        const tank = tanks[index];
        if (!tank) continue;

        const type = tank.getType();
        const amount = Math.max(0, tank.get());
        const freeSpace = Math.max(0, tank.getFreeSpace());

        if (normalizedAllowed.includes(type) && amount > 0) {
            return { tank, index };
        }

        if (!reserved && normalizedAllowed.includes(type)) {
            reserved = { tank, index };
        }

        if (!empty && type === "empty" && freeSpace > 0) {
            empty = { tank, index };
        }
    }

    return reserved ?? empty;
}

function resolveTargetTankForFluid(tanks, fluidType) {
    const normalizedType = typeof fluidType === "string" ? fluidType.toLowerCase() : "";
    if (!normalizedType) return null;

    if (IMPACT_CRUSHER.fluids.lava.includes(normalizedType)) {
        return selectRoleTank(tanks, IMPACT_CRUSHER.fluids.lava)?.tank ?? null;
    }

    if (IMPACT_CRUSHER.fluids.coolant.includes(normalizedType)) {
        return selectRoleTank(tanks, IMPACT_CRUSHER.fluids.coolant)?.tank ?? null;
    }

    return null;
}

function getSelectedInventoryItem(player) {
    const slot = player?.selectedSlotIndex ?? 0;
    const inventory = player?.getComponent("minecraft:inventory")?.container;
    if (!inventory) return null;

    return {
        slot,
        inventory,
        item: inventory.getItem(slot)
    };
}

function replaceHeldFluidContainer(player, expectedTypeId, nextTypeId) {
    if (!player || !expectedTypeId) return false;
    if (typeof player.isInCreative === "function" && player.isInCreative()) return true;
    if (expectedTypeId === nextTypeId) return true;

    const selected = getSelectedInventoryItem(player);
    if (!selected) return false;

    const { slot, inventory } = selected;
    const current = inventory.getItem(slot);
    if (!current || current.typeId !== expectedTypeId) return false;

    if (current.amount > 1) {
        current.amount -= 1;
        inventory.setItem(slot, current);

        if (nextTypeId) {
            const overflow = inventory.addItem(new ItemStack(nextTypeId, 1));
            if (overflow) {
                player.dimension?.spawnItem?.(overflow, player.location);
            }
        }
        return true;
    }

    inventory.setItem(slot, nextTypeId ? new ItemStack(nextTypeId, 1) : undefined);
    return true;
}

function showFluidInteractionFeedback(player, tank) {
    if (!player?.onScreenDisplay?.setActionBar || !tank) return;

    const type = tank.getType();
    const stored = Math.max(0, tank.get());
    const cap = Math.max(0, tank.getCap());
    const percent = cap > 0 ? ((stored / cap) * 100).toFixed(2) : "0.00";

    player.onScreenDisplay.setActionBar(
        `§b${formatFluidDisplayName(type)}: §f${FluidManager.formatFluid(stored)}§7 / §f${FluidManager.formatFluid(cap)} §7(${percent}%)`
    );
}

function handleImpactCrusherFluidInteraction(player, machine, settings) {
    if (!player || !machine?.entity) return false;

    const mainHand = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (!mainHand?.typeId) return false;

    const containerData = FluidManager.getContainerData(mainHand.typeId);
    if (!containerData?.type) return false;

    const { tanks } = getImpactCrusherTanks(machine, settings);
    const targetTank = resolveTargetTankForFluid(tanks, containerData.type);
    if (!targetTank) return false;

    const interactionResult = targetTank.fluidItem(mainHand.typeId);
    if (interactionResult === false) return false;

    if (!replaceHeldFluidContainer(player, mainHand.typeId, interactionResult)) {
        return false;
    }

    const { lavaTank, coolantTank } = getImpactCrusherTanks(machine, settings);
    const shouldRefreshUi = shouldRefreshSuperiorUi(machine, "impact_crusher:ui");
    updateDisplays(machine, lavaTank, coolantTank, shouldRefreshUi);
    showFluidInteractionFeedback(player, targetTank);
    return true;
}

function parseCachedNodes(entity, propertyId = "dorios:fluid_nodes") {
    if (!entity) return [];
    try {
        const cached = entity.getDynamicProperty(propertyId);
        if (!cached) return [];
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function resolveFluidNodes(machine, block) {
    const nodes = parseCachedNodes(machine?.entity, "dorios:fluid_nodes");
    if (nodes.length) return nodes;

    updatePipes(block, "fluid");
    return parseCachedNodes(machine?.entity, "dorios:fluid_nodes");
}

function pullFluidFromNetwork(machine, block, tank, allowedTypes, maxPull, fluidNodes = []) {
    if (!machine?.entity || !tank || !block) return false;

    const normalizedAllowed = normalizeAllowedFluidTypes(allowedTypes);
    if (!normalizedAllowed.length) return false;

    const freeSpace = tank.getFreeSpace();
    if (freeSpace <= 0) return false;

    const currentType = tank.getType();
    if (currentType !== "empty" && !normalizedAllowed.includes(currentType)) {
        return false;
    }

    const desiredTypes = currentType === "empty"
        ? new Set(normalizedAllowed)
        : new Set([currentType]);

    const pullLimit = Math.min(freeSpace, Math.max(0, Number(maxPull) || 0));
    if (pullLimit <= 0) return false;

    const nodes = Array.isArray(fluidNodes) ? fluidNodes : [];
    if (!nodes.length) return false;

    const dim = block.dimension;
    const origin = block.location;
    const orderedTargets = nodes.length > 1
        ? [...nodes].sort((a, b) =>
            DoriosAPI.math.distanceBetween(origin, a) - DoriosAPI.math.distanceBetween(origin, b)
        )
        : nodes;

    let remaining = pullLimit;

    for (const loc of orderedTargets) {
        if (remaining <= 0) break;
        if (!canFluidNodeProvide(loc)) continue;
        if (!isFluidNodeEnabled(loc)) continue;

        const [sourceEntity] = dim.getEntitiesAtBlockLocation(loc);
        if (!sourceEntity || sourceEntity === machine.entity) continue;
        if (sourceEntity.hasTag?.("dorios:fluid_input_only")) continue;

        const sourceTank = FluidManager.findType(sourceEntity, 0);
        if (!sourceTank || sourceTank.get() <= 0) continue;

        const sourceType = sourceTank.getType();
        if (!sourceType || sourceType === "empty") continue;
        if (!fluidNodeMatchesType(loc, sourceType)) continue;
        if (!desiredTypes.has(sourceType)) continue;

        const pulled = sourceTank.transferTo(tank, remaining);
        if (pulled > 0) {
            remaining -= pulled;
        }
    }

    return remaining < pullLimit;
}

function isTankTypeAllowed(tank, allowedTypes) {
    const type = tank?.getType?.();
    if (!type || type === "empty") return false;
    return normalizeAllowedFluidTypes(allowedTypes).includes(type);
}

function getAcceptedTankAmount(tank, allowedTypes) {
    if (!isTankTypeAllowed(tank, allowedTypes)) return 0;
    return Math.max(0, tank?.get?.() ?? 0);
}

function buildLaneStates(machine, recipes, lavaTank, batchSize, yieldBoost, settings) {
    const candidateCount = IMPACT_CRUSHER.slots.inputs.reduce((total, slot) => {
        const stack = machine.inv.getItem(slot);
        if (!stack?.typeId) return total;
        const recipe = matchRecipe(recipes, stack.typeId);
        return recipe ? total + 1 : total;
    }, 0);

    let remainingCandidates = candidateCount;
    let remainingLava = getAcceptedTankAmount(lavaTank, IMPACT_CRUSHER.fluids.lava);

    return IMPACT_CRUSHER.slots.inputs.map((inputSlot, laneIndex) => {
        const reservedLaneBudget = remainingCandidates > 0
            ? Math.floor(remainingLava / remainingCandidates)
            : remainingLava;

        const lane = createLaneState(
            machine,
            recipes,
            batchSize,
            yieldBoost,
            settings,
            laneIndex,
            inputSlot,
            getLaneOutputSlots(laneIndex),
            reservedLaneBudget
        );

        if (lane.recipe) {
            remainingCandidates = Math.max(0, remainingCandidates - 1);
            remainingLava = Math.max(0, remainingLava - lane.reservedLava);
        }

        return lane;
    });
}

function createLaneState(machine, recipes, batchSize, yieldBoost, settings, laneIndex, inputSlot, outputSlots, lavaBudget) {
    const inputStack = machine.inv.getItem(inputSlot);
    const state = {
        laneIndex,
        inputSlot,
        outputSlots,
        inputStack,
        progress: getLaneProgress(machine.entity, laneIndex),
        recipe: null,
        typeId: inputStack?.typeId ?? null,
        ready: false,
        color: "§7",
        message: "Waiting Input",
        availableCrafts: 0,
        craftCount: 0,
        inputNeeded: 0,
        outputAmount: 0,
        energyCost: 0,
        lavaNeeded: 0,
        reservedLava: 0,
        recipeSeconds: IMPACT_CRUSHER.defaults.baseRecipeSeconds,
        batchSize
    };

    if (!inputStack) {
        state.progress = 0;
        return state;
    }

    const recipe = matchRecipe(recipes, inputStack.typeId);
    if (!recipe) {
        state.progress = 0;
        state.color = "§c";
        state.message = "Invalid Recipe";
        return state;
    }

    state.recipe = recipe;

    const outputPlan = buildOutputPlan(machine, recipe.output.id, outputSlots);
    if (outputPlan.compatibleSlotCount <= 0) {
        state.color = "§c";
        state.message = "Output Conflict";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    const inputPerCraft = Math.max(1, recipe.input.amount ?? 1);
    const outputPerCraft = Math.max(1, recipe.output.amount ?? 1);
    const availableCrafts = Math.floor(inputStack.amount / inputPerCraft);
    if (availableCrafts <= 0) {
        state.progress = 0;
        state.color = "§e";
        state.message = `Need ${inputPerCraft}`;
        return state;
    }

    const maxCraftsByOutput = Math.floor(outputPlan.totalSpace / Math.max(1, outputPerCraft * yieldBoost));
    if (maxCraftsByOutput <= 0) {
        state.color = "§e";
        state.message = "Output Full";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    const lavaPerCraft = resolveLavaPerCraft(recipe);
    const maxCraftsByLava = Math.floor(Math.max(0, lavaBudget) / Math.max(1, lavaPerCraft));
    if (maxCraftsByLava <= 0) {
        state.color = "§6";
        state.message = "Need Lava";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    const craftCount = Math.max(0, Math.min(batchSize, availableCrafts, maxCraftsByOutput, maxCraftsByLava));
    if (craftCount <= 0) {
        state.color = "§6";
        state.message = "Need Lava";
        state.energyCost = estimateBatchEnergy(recipe, 1, settings);
        state.progress = Math.min(state.progress, state.energyCost);
        return state;
    }

    state.availableCrafts = availableCrafts;
    state.craftCount = craftCount;
    state.inputNeeded = inputPerCraft * craftCount;
    state.outputAmount = estimateBatchOutput(recipe, craftCount, yieldBoost);
    state.energyCost = estimateBatchEnergy(recipe, craftCount, settings);
    state.lavaNeeded = lavaPerCraft * craftCount;
    state.reservedLava = state.lavaNeeded;
    state.recipeSeconds = resolveImpactCrusherRecipeSeconds(recipe);
    state.ready = true;
    state.color = "§a";
    state.message = "Ready Impact";
    state.progress = Math.min(state.progress, state.energyCost);
    return state;
}

function craftLane(machine, lane, lavaTank, yieldBoost) {
    if (!lane.ready || !lane.recipe || lane.craftCount <= 0) {
        return { count: 0, produced: 0 };
    }

    if (!lavaTank || getAcceptedTankAmount(lavaTank, IMPACT_CRUSHER.fluids.lava) < lane.lavaNeeded) {
        lane.message = "Need Lava";
        lane.color = "§6";
        return { count: 0, produced: 0 };
    }

    machine.entity.changeItemAmount(lane.inputSlot, -lane.inputNeeded);
    lavaTank.consume(lane.lavaNeeded);
    if (lavaTank.get() <= 0) {
        lavaTank.setType("empty");
    }

    const rawOutput = (lane.recipe.output.amount ?? 1) * lane.craftCount * yieldBoost;
    const produced = machine.addFractionalItem(lane.recipe.output.id, rawOutput);
    const inserted = distributeOutput(machine, lane.recipe.output.id, produced, lane.outputSlots);

    return {
        count: lane.craftCount,
        produced: inserted,
        outputId: lane.recipe.output.id
    };
}

function applyThermalCycle(machine, coolantTank, { activeLaneCount, plannedCrafts, craftedLaneCount, locked }) {
    const currentHeat = getHeat(machine.entity);
    let nextHeat = currentHeat;
    const heatGain = !locked && activeLaneCount > 0
        ? (activeLaneCount * IMPACT_CRUSHER.thermal.heatPerActiveLane)
            + (plannedCrafts * IMPACT_CRUSHER.thermal.heatPerCraft)
            + (craftedLaneCount * IMPACT_CRUSHER.thermal.craftBurstBonus)
        : 0;

    nextHeat += heatGain;

    const cooling = resolveCoolingStep(coolantTank, activeLaneCount, locked, nextHeat > 0 || activeLaneCount > 0);
    nextHeat = Math.max(0, Math.min(IMPACT_CRUSHER.thermal.maxHeat, nextHeat - cooling.totalCooling));
    setHeat(machine.entity, nextHeat);

    return {
        heat: nextHeat,
        heatGain,
        overheated: !locked && nextHeat >= IMPACT_CRUSHER.thermal.maxHeat,
        ...cooling
    };
}

function resolveCoolingStep(coolantTank, activeLaneCount, locked, shouldCool) {
    if (!shouldCool) {
        return {
            descriptor: null,
            totalCooling: 0,
            consumed: 0
        };
    }

    let totalCooling = IMPACT_CRUSHER.thermal.passiveCooling;
    if (activeLaneCount <= 0) {
        totalCooling += IMPACT_CRUSHER.thermal.idleCoolingBonus;
    }
    if (locked) {
        totalCooling += IMPACT_CRUSHER.thermal.lockedCoolingBonus;
    }

    const descriptor = getCoolantDescriptor(coolantTank);
    if (!descriptor || coolantTank.get() <= 0) {
        return {
            descriptor: null,
            totalCooling,
            consumed: 0
        };
    }

    const required = descriptor.baseConsumption + (descriptor.perActiveConsumption * Math.max(0, activeLaneCount));
    if (required <= 0) {
        return {
            descriptor,
            totalCooling,
            consumed: 0
        };
    }

    const available = Math.max(0, coolantTank.get());
    const consumed = Math.min(required, available);
    const ratio = required > 0 ? consumed / required : 0;
    if (consumed > 0) {
        coolantTank.consume(consumed);
        if (coolantTank.get() <= 0) {
            coolantTank.setType("empty");
        }
        totalCooling += Math.floor((descriptor.baseCooling + (descriptor.perActiveCooling * Math.max(0, activeLaneCount))) * ratio);
    }

    return {
        descriptor,
        totalCooling,
        consumed
    };
}

function triggerOverheat(machine, refreshUi = true) {
    resetLaneProgressIndicators(machine, refreshUi);
    setHeat(machine.entity, IMPACT_CRUSHER.thermal.maxHeat);

    const burned = {
        inputs: 0,
        outputs: 0
    };

    for (const slot of IMPACT_CRUSHER.slots.inputs) {
        burned.inputs += burnHalfOfSlot(machine, slot);
    }

    for (const slot of ALL_OUTPUT_SLOTS) {
        burned.outputs += burnHalfOfSlot(machine, slot);
    }

    setLock(machine.entity, getInputSignature(machine));
    playOverheatEffects(machine);
    return burned;
}

function burnHalfOfSlot(machine, slot) {
    const stack = machine.inv.getItem(slot);
    if (!stack) return 0;

    const burnedAmount = Math.max(1, Math.ceil(stack.amount / 2));
    machine.entity.changeItemAmount(slot, -burnedAmount);
    return burnedAmount;
}

function playOverheatEffects(machine) {
    const pos = machine.block.center();
    try {
        machine.dim.playSound?.("bucket.empty_lava", pos, { volume: 1, pitch: 0.8 });
    } catch { /* ignore invalid sound ids */ }
    try {
        machine.dim.playSound?.("random.fizz", pos, { volume: 0.9, pitch: 0.7 });
    } catch { /* ignore invalid sound ids */ }

    for (let index = 0; index < 4; index++) {
        try {
            machine.dim.spawnParticle?.("minecraft:basic_flame_particle", pos);
        } catch { /* ignore invalid particle ids */ }
        try {
            machine.dim.spawnParticle?.("minecraft:lava_particle", pos);
        } catch { /* ignore invalid particle ids */ }
    }
}

function handleLockedMachine(machine, lavaTank, coolantTank, quantityLevel, batchSize) {
    const cooling = applyThermalCycle(machine, coolantTank, {
        activeLaneCount: 0,
        plannedCrafts: 0,
        craftedLaneCount: 0,
        locked: true
    });

    let header = "Cooling Lock";
    let headerColor = "§c";
    if (cooling.heat <= 0) {
        const signature = getInputSignature(machine);
        if (signature !== getLockSignature(machine.entity)) {
            clearLock(machine.entity);
            header = "Unlocked";
            headerColor = "§2";
        } else {
            header = "Reseat Input";
            headerColor = "§e";
        }
    }

    const stillLocked = isLockActive(machine.entity);

    return {
        header,
        headerColor,
        lavaTank,
        coolantTank,
        quantityLevel,
        batchSize,
        heat: cooling.heat,
        laneStates: createStaticLaneStates(
            stillLocked
                ? (cooling.heat > 0 ? "§cThermal Lock" : "§eReseat Required")
                : "§2Unlocked"
        ),
        focusLane: null,
        cooling,
        burned: null,
        locked: stillLocked
    };
}

function renderStatus(machine, context, refreshUi = true) {
    if (!refreshUi) return;

    const heat = Math.max(0, Number(context.heat) || 0);
    const zone = resolveThermalZone(heat);
    const coolantDescriptor = getCoolantDescriptor(context.coolantTank);
    const lore = [
        `${context.headerColor}${context.header}`,
        `§7Heat: §f${heat}§7/§f${IMPACT_CRUSHER.thermal.maxHeat} §7(${formatPercentValue((heat / IMPACT_CRUSHER.thermal.maxHeat) * 100)})`,
        `§7Zone: ${zone.color}${zone.label}`,
        `§7Energy: §f${formatMachineEnergyBuffer(machine)}`,
        `§7Lava: §f${formatTankBuffer(context.lavaTank, "lava")}`,
        `§7Coolant: §f${formatTankBuffer(context.coolantTank, coolantDescriptor?.id)}`,
        `§7Batch Cap: §f${formatBatchWithQuantity(context.batchSize ?? 1, context.quantityLevel ?? 0)}`,
        `§7Charge Rate: §f${resolveThermalSpeedMultiplier(heat).toFixed(2)}x thermal`
    ];

    if (context.focusLane?.recipe) {
        lore.push(
            `§7Focus: §fLane ${context.focusLane.laneIndex + 1} • ${formatItemName(context.focusLane.recipe.input.id)} -> ${formatItemName(context.focusLane.recipe.output.id)}`,
            `§7Lane Cost: §f${formatEnergyCost(context.focusLane.energyCost)} §7+ §f${FluidManager.formatFluid(context.focusLane.lavaNeeded)} Lava`,
            `§7Lane Output: §f${context.focusLane.outputAmount}`
        );
    }

    if (context.cooling?.descriptor && context.cooling.consumed > 0) {
        lore.push(
            `§7Cooling: §f-${context.cooling.totalCooling} heat §7(${context.cooling.descriptor.color}${context.cooling.descriptor.label}§7 ${FluidManager.formatFluid(context.cooling.consumed)})`
        );
    } else if (heat > 0) {
        lore.push("§7Cooling: §fPassive vent only");
    }

    if (context.locked) {
        lore.push("§cLock: §fOverheat safeguard engaged");
        if (heat <= 0) {
            lore.push("§eAction: §fReseat the input to recover the machine");
        }
    }

    if (context.burned?.inputs > 0 || context.burned?.outputs > 0) {
        lore.push(`§cBurned: §f${context.burned.inputs} input / ${context.burned.outputs} output items`);
    }

    if (Array.isArray(context.laneStates)) {
        lore.push(...context.laneStates.map(buildLaneMessage));
    }

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) {
        lore.push(overclockLine.replace(/^§r/, ""));
    }

    machine.setLabel({
        title: "§6Impact Crusher",
        lore
    }, IMPACT_CRUSHER.slots.status);
}

function updateDisplays(machine, lavaTank, coolantTank, refreshUi = true) {
    if (!refreshUi) return;

    displayRoleTank(machine, lavaTank, IMPACT_CRUSHER.slots.lavaDisplay);
    displayRoleTank(machine, coolantTank, IMPACT_CRUSHER.slots.coolantDisplay);
    machine.displayEnergy(IMPACT_CRUSHER.slots.energy);
    setHeatGauge(machine, getHeat(machine.entity), true);
}

function displayRoleTank(machine, tank, slotIndex) {
    if (tank) {
        tank.display(slotIndex);
        return;
    }

    const current = machine.inv?.getItem(slotIndex);
    if (current?.typeId === "utilitycraft:empty_fluid_bar") return;

    const emptyBar = new ItemStack("utilitycraft:empty_fluid_bar", 1);
    emptyBar.nameTag = "§rEmpty";
    machine.inv?.setItem(slotIndex, emptyBar);
}

function transferOutputLanes(machine) {
    let transferred = false;
    for (const slot of ALL_OUTPUT_SLOTS) {
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

function matchRecipe(recipes, inputId) {
    if (!inputId) return null;
    return findRecipeByInputId(recipes, inputId);
}

function estimateBatchEnergy(recipe, crafts, settings) {
    const perCraftCost = resolveImpactCrusherRecipeEnergyCostPerCraft(recipe, settings);
    return Math.max(1, Math.ceil(perCraftCost * Math.max(1, crafts)));
}

function estimateBatchOutput(recipe, crafts, yieldBoost = 1) {
    return Math.max(1, Math.ceil((recipe?.output?.amount ?? 1) * Math.max(1, crafts) * Math.max(1, yieldBoost)));
}

function resolveImpactCrusherRecipeEnergyCostPerCraft(recipe, settings) {
    const fallback = settings?.machine?.energy_cost ?? IMPACT_CRUSHER.defaults.energyCost;
    const recipeCost = Number(recipe?.energyCost);
    if (!Number.isFinite(recipeCost) || recipeCost <= 0) {
        return Math.max(1, fallback);
    }

    const ratio = recipeCost / Math.max(1, PULVERIZER_RECIPE_BASELINE.energyCost);
    return Math.max(1, Math.ceil(fallback * Math.max(Number.EPSILON, ratio)));
}

function resolveImpactCrusherRecipeSeconds(recipe) {
    const baseSeconds = Math.max(Number.EPSILON, Number(IMPACT_CRUSHER.defaults.baseRecipeSeconds) || Number.EPSILON);
    const recipeSeconds = Number(resolveRecipeTimeSeconds(recipe));
    if (!Number.isFinite(recipeSeconds) || recipeSeconds <= 0) {
        return baseSeconds;
    }

    const ratio = recipeSeconds / Math.max(Number.EPSILON, PULVERIZER_RECIPE_BASELINE.seconds);
    return Math.max(Number.EPSILON, Number((baseSeconds * Math.max(Number.EPSILON, ratio)).toFixed(2)));
}

function resolveLavaPerCraft(recipe) {
    return Math.max(1, Math.ceil(recipe?.lavaPerCraft ?? recipe?.heatCost ?? IMPACT_CRUSHER.defaults.lavaPerCraft));
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of IMPACT_CRUSHER.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(IMPACT_CRUSHER.quantity.maxLevel, total));
}

function isQuantityUpgradeItem(item) {
    if (!item?.typeId) return false;
    if (item.typeId === "utilitycraft:quantity_upgrade") return true;
    if (typeof item.hasTag === "function" && item.hasTag("utilitycraft:quantity_upgrade")) return true;

    const [, raw = ""] = item.typeId.split(":");
    return raw === "quantity_upgrade";
}

function getBatchSize(quantityLevel) {
    const index = Math.max(0, Math.min(IMPACT_CRUSHER.quantity.batchSizes.length - 1, Number(quantityLevel) || 0));
    return IMPACT_CRUSHER.quantity.batchSizes[index];
}

function getLaneOutputSlots(laneIndex) {
    return laneIndex === 0
        ? IMPACT_CRUSHER.slots.laneOneOutputs
        : IMPACT_CRUSHER.slots.laneTwoOutputs;
}

function buildOutputPlan(machine, outputId, outputSlots) {
    const slots = [];
    let totalSpace = 0;
    let compatibleSlotCount = 0;

    for (const slot of outputSlots) {
        const stack = machine.inv.getItem(slot);
        if (!stack) {
            const maxAmount = resolveMaxStackSize(null, outputId);
            slots.push({ slot, empty: true, compatible: true, space: maxAmount });
            compatibleSlotCount += 1;
            totalSpace += maxAmount;
            continue;
        }

        if (stack.typeId !== outputId) {
            slots.push({ slot, empty: false, compatible: false, space: 0 });
            continue;
        }

        const maxAmount = resolveMaxStackSize(stack, outputId);
        const space = Math.max(0, maxAmount - stack.amount);
        slots.push({ slot, empty: false, compatible: true, space });
        compatibleSlotCount += 1;
        totalSpace += space;
    }

    return { slots, totalSpace, compatibleSlotCount };
}

function resolveMaxStackSize(slot, itemId) {
    if (slot?.maxAmount) return slot.maxAmount;

    const cached = MAX_STACK_SIZE_CACHE.get(itemId);
    if (cached) return cached;

    try {
        const probe = new ItemStack(itemId, 1);
        if (probe?.maxAmount) {
            MAX_STACK_SIZE_CACHE.set(itemId, probe.maxAmount);
            return probe.maxAmount;
        }
        const component = probe?.getComponent?.("minecraft:max_stack_size");
        if (typeof component?.value === "number") {
            MAX_STACK_SIZE_CACHE.set(itemId, component.value);
            return component.value;
        }
    } catch {
        // Ignore invalid probes and fall back to a standard stack size.
    }

    MAX_STACK_SIZE_CACHE.set(itemId, 64);
    return 64;
}

function distributeOutput(machine, outputId, amount, outputSlots) {
    let remaining = Math.max(0, amount);
    if (remaining <= 0) return 0;

    const maxAmount = resolveMaxStackSize(null, outputId);

    for (const slot of outputSlots) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (!current || current.typeId !== outputId) continue;

        const space = Math.max(0, resolveMaxStackSize(current, outputId) - current.amount);
        const inserted = Math.min(space, remaining);
        if (inserted <= 0) continue;

        machine.entity.changeItemAmount(slot, inserted);
        remaining -= inserted;
    }

    for (const slot of outputSlots) {
        if (remaining <= 0) break;

        const current = machine.inv.getItem(slot);
        if (current) continue;

        const inserted = Math.min(maxAmount, remaining);
        if (inserted <= 0) continue;

        machine.entity.setItem(slot, outputId, inserted);
        remaining -= inserted;
    }

    if (remaining > 0) {
        try {
            machine.dim.spawnItem(new ItemStack(outputId, remaining), machine.block.center());
        } catch {
            // Ignore emergency output spill failures.
        }
    }

    return amount - remaining;
}

function countEnergyReadyLanes(laneStates, startIndex = 0) {
    let total = 0;
    for (let index = startIndex; index < laneStates.length; index++) {
        const lane = laneStates[index];
        if (lane.ready && lane.progress < lane.energyCost) {
            total += 1;
        }
    }
    return total;
}

function resolveLaneEnergyChargeCap(lane, machine, heat) {
    const seconds = Math.max(
        Number.EPSILON,
        Number(lane?.recipeSeconds ?? IMPACT_CRUSHER.defaults.baseRecipeSeconds)
    );
    const energyCost = Math.max(1, Number(lane?.energyCost) || 1);
    const speedMultiplier = Math.max(Number.EPSILON, Number(machine?.boosts?.speed ?? 1));
    const consumptionMultiplier = Math.max(Number.EPSILON, Number(machine?.boosts?.consumption ?? 1));
    const thermalMultiplier = resolveThermalSpeedMultiplier(heat);

    const progressPerSecond = (energyCost / seconds) * speedMultiplier * thermalMultiplier;
    const energyPerSecond = progressPerSecond * consumptionMultiplier;
    const intervalTicks = Math.max(1, IMPACT_CRUSHER.defaults.tickIntervalTicks);
    return Math.max(0, (energyPerSecond / 20) * intervalTicks);
}

function resolveThermalSpeedMultiplier(heat) {
    if (heat < IMPACT_CRUSHER.thermal.warningThreshold) return 1;
    if (heat >= IMPACT_CRUSHER.thermal.hardThreshold) return 0.45;

    const range = IMPACT_CRUSHER.thermal.hardThreshold - IMPACT_CRUSHER.thermal.warningThreshold;
    const ratio = (heat - IMPACT_CRUSHER.thermal.warningThreshold) / Math.max(1, range);
    return Math.max(0.45, 1 - (ratio * 0.4));
}

function resolveThermalZone(heat) {
    if (heat >= IMPACT_CRUSHER.thermal.hardThreshold) {
        return { label: "Critical", color: "§c" };
    }
    if (heat >= IMPACT_CRUSHER.thermal.warningThreshold) {
        return { label: "Danger", color: "§6" };
    }
    if (heat >= IMPACT_CRUSHER.thermal.safeThreshold) {
        return { label: "Warm", color: "§e" };
    }
    return { label: "Stable", color: "§2" };
}

function getCoolantDescriptor(coolantTank) {
    const type = coolantTank?.getType?.();
    if (type === IMPACT_CRUSHER.thermal.coolant.water.id) {
        return IMPACT_CRUSHER.thermal.coolant.water;
    }
    if (type === IMPACT_CRUSHER.thermal.coolant.cryofluid.id) {
        return IMPACT_CRUSHER.thermal.coolant.cryofluid;
    }
    if (type === IMPACT_CRUSHER.thermal.coolant.salineCoolant.id) {
        return IMPACT_CRUSHER.thermal.coolant.salineCoolant;
    }
    return null;
}

function formatTankBuffer(tank, fallbackType) {
    const cap = FluidManager.formatFluid(Math.max(0, tank?.getCap?.() ?? 0));
    const amount = FluidManager.formatFluid(Math.max(0, tank?.get?.() ?? 0));
    const type = tank?.getType?.() ?? fallbackType ?? "empty";
    if (!type || type === "empty") {
        return `Empty ${amount} / ${cap}`;
    }
    return `${formatFluidDisplayName(type)} ${amount} / ${cap}`;
}

function buildLaneMessage(lane) {
    const laneNumber = lane.laneIndex + 1;
    const suffix = lane.ready && lane.craftCount > 0
        ? ` x${lane.craftCount}`
        : "";
    return `${lane.color}[${laneNumber}] ${lane.message}${suffix}`;
}

function inferHeader({ laneStates, craftedAnything, active, heat, energy, coolantTank }) {
    if (craftedAnything) {
        return heat >= IMPACT_CRUSHER.thermal.warningThreshold ? "Impact Crushing (Hot)" : "Impact Crushing";
    }
    if (active) {
        return getCoolantDescriptor(coolantTank) ? "Charging Impact" : "Running Dry";
    }
    if (energy <= 0 && laneStates.some(lane => lane.typeId)) return "No Energy";
    if (laneStates.some(lane => lane.message === "Need Lava")) return "Need Lava";
    if (heat > 0) return "Cooling Down";
    if (laneStates.some(lane => lane.typeId)) return "Idle";
    return "Waiting Input";
}

function inferHeaderColor({ laneStates, craftedAnything, active, heat, energy, coolantTank }) {
    if (craftedAnything) return heat >= IMPACT_CRUSHER.thermal.warningThreshold ? "§6" : "§2";
    if (active) return getCoolantDescriptor(coolantTank) ? "§a" : "§6";
    if (energy <= 0 && laneStates.some(lane => lane.typeId)) return "§c";
    if (laneStates.some(lane => lane.message === "Need Lava")) return "§6";
    if (heat > 0) return "§e";
    if (laneStates.some(lane => lane.typeId)) return "§e";
    return "§7";
}

function getLaneProgress(entity, laneIndex) {
    return Number(entity.getDynamicProperty(LANE_PROGRESS_KEYS[laneIndex])) || 0;
}

function setLaneProgress(entity, laneIndex, value) {
    const nextValue = Math.max(0, Number(value) || 0);
    const currentValue = Number(entity.getDynamicProperty(LANE_PROGRESS_KEYS[laneIndex])) || 0;
    if (currentValue === nextValue) return;
    entity.setDynamicProperty(LANE_PROGRESS_KEYS[laneIndex], nextValue);
}

function finalizeLane(machine, lane, refreshUi = true) {
    const energyCost = Math.max(1, lane.energyCost || 1);
    lane.progress = Math.min(Math.max(0, lane.progress), energyCost);
    setLaneProgress(machine.entity, lane.laneIndex, lane.progress);
    if (refreshUi) {
        setProgressArrow(machine.inv, IMPACT_CRUSHER.slots.laneProgress[lane.laneIndex], lane.progress / energyCost);
    }
}

function resetLaneProgressIndicators(machine, refreshUi = true) {
    for (let laneIndex = 0; laneIndex < IMPACT_CRUSHER.slots.laneProgress.length; laneIndex++) {
        setLaneProgress(machine.entity, laneIndex, 0);
        if (refreshUi) {
            setProgressArrow(machine.inv, IMPACT_CRUSHER.slots.laneProgress[laneIndex], 0);
        }
    }
}

function setHeat(entity, value) {
    entity.setDynamicProperty(STATE_KEYS.heat, Math.max(0, Math.min(IMPACT_CRUSHER.thermal.maxHeat, Math.floor(Number(value) || 0))));
}

function getHeat(entity) {
    return Math.max(0, Math.min(IMPACT_CRUSHER.thermal.maxHeat, Math.floor(Number(entity.getDynamicProperty(STATE_KEYS.heat)) || 0)));
}

function setHeatGauge(machine, heat, refreshUi = true) {
    if (!refreshUi) return;
    setTemperatureBar(machine.inv, IMPACT_CRUSHER.slots.heat, heat);
}

function setTemperatureBar(inv, slotIndex, heat) {
    const clampedHeat = Math.max(0, Math.min(IMPACT_CRUSHER.thermal.maxHeat, Math.floor(Number(heat) || 0)));
    const ratio = IMPACT_CRUSHER.thermal.maxHeat > 0
        ? clampedHeat / IMPACT_CRUSHER.thermal.maxHeat
        : 0;
    const maxSegments = Math.max(1, Number(IMPACT_CRUSHER.progress.temperatureSegments) || 31);
    const frame = Math.max(0, Math.min(maxSegments, Math.floor(Math.max(0, Math.min(1, ratio)) * maxSegments)));
    const itemId = `utilitycraft:${IMPACT_CRUSHER.progress.temperatureIndicator}_${String(frame).padStart(2, "0")}`;
    const nextNameTag = `§r§6Heat: §f${clampedHeat}§7 / §f${IMPACT_CRUSHER.thermal.maxHeat}`;
    const current = inv.getItem(slotIndex);
    if (current?.typeId === itemId && current?.nameTag === nextNameTag && (current.amount ?? 1) === 1) return;

    const bar = new ItemStack(itemId, 1);
    bar.nameTag = nextNameTag;
    inv.setItem(slotIndex, bar);
}

function setProgressArrow(inv, slotIndex, ratio) {
    const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    const frame = Math.max(0, Math.min(16, Math.floor(clampedRatio * 16)));
    const itemId = `utilitycraft:${IMPACT_CRUSHER.progress.indicator}_${frame}`;
    const current = inv.getItem(slotIndex);
    if (current?.typeId === itemId && (current.amount ?? 1) === 1) return;
    inv.setItem(slotIndex, new ItemStack(itemId, 1));
}

function setLock(entity, signature) {
    entity.setDynamicProperty(STATE_KEYS.lockActive, 1);
    entity.setDynamicProperty(STATE_KEYS.lockSignature, signature ?? "");
}

function clearLock(entity) {
    entity.setDynamicProperty(STATE_KEYS.lockActive, 0);
    entity.setDynamicProperty(STATE_KEYS.lockSignature, "");
}

function isLockActive(entity) {
    return Number(entity.getDynamicProperty(STATE_KEYS.lockActive) ?? 0) === 1;
}

function getLockSignature(entity) {
    return String(entity.getDynamicProperty(STATE_KEYS.lockSignature) ?? "");
}

function getInputSignature(machine) {
    return IMPACT_CRUSHER.slots.inputs
        .map(slot => {
            const stack = machine.inv.getItem(slot);
            return stack ? `${stack.typeId}:${stack.amount}` : "empty:0";
        })
        .join("|");
}

function createIdleLaneStates() {
    return IMPACT_CRUSHER.slots.inputs.map((_, laneIndex) => ({
        laneIndex,
        ready: false,
        typeId: null,
        craftCount: 0,
        color: "§7",
        message: "Waiting Input"
    }));
}

function createStaticLaneStates(message) {
    return IMPACT_CRUSHER.slots.inputs.map((_, laneIndex) => ({
        laneIndex,
        ready: false,
        typeId: null,
        craftCount: 0,
        color: message.startsWith("§c") ? "§c" : (message.startsWith("§e") ? "§e" : "§7"),
        message: message.replace(/^§./, "")
    }));
}

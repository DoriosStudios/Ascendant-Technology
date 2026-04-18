import { ItemStack, system } from "@minecraft/server";
import {
    Machine,
    applyDynamicRecipeRate,
    buildOverclockLoreLine,
    appendLoreSection,
    formatItemName,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate
} from "../../../DoriosCore/index.js";
import {
    formatEnergyCost,
    formatMachineEnergyBuffer,
    formatSecondsLabel
} from "./utils.js";

const VERDANT_CULTIVATOR = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        seeds: Object.freeze([3, 4, 5, 6]),
        clock: 7,
        upgrades: Object.freeze([8, 9, 10, 11]),
        outputs: Object.freeze([12, 13, 14, 15, 16, 17, 18, 19, 20])
    }),
    transfer: Object.freeze({
        itemAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        })
    }),
    defaults: Object.freeze({
        energyCost: 6400,
        maxRangeLevel: 7,
        baseSideLength: 3,
        sweepCostBase: 1200,
        sweepCostPerSide: 120,
        harvestCost: 900,
        plantCost: 260,
        growthCost: 380,
        clockPulseBaseTargets: 1,
        clockPulseTargetsPerQuantityLevel: 1,
        clockPulseBaseChance: 0.8,
        dropCollectionDelayTicks: 8,
        cycleTimeBaseSeconds: 1.1,
        cycleTimePerSideSeconds: 0.18,
        cycleTimePerHarvestSeconds: 0.08,
        cycleTimePerPlantSeconds: 0.06,
        cycleTimePerPulseSeconds: 0.7,
        maxHarvestCycleBonusSeconds: 2.4,
        maxPlantCycleBonusSeconds: 1.8,
        maxQuantityLevel: 4,
        harvestBonusChancePerLevel: 0.4,
        biomeBonusYieldChance: 0.25,
        biomeBonusExtraPulseTargets: 1
    }),
    properties: Object.freeze({
        configSignature: "ascendant:verdant_config"
    })
});

const SEED_PATTERN_LAYOUT = Object.freeze([
    Object.freeze({ slotIndex: 0, row: 0, col: 0 }),
    Object.freeze({ slotIndex: 1, row: 0, col: 1 }),
    Object.freeze({ slotIndex: 2, row: 1, col: 0 }),
    Object.freeze({ slotIndex: 3, row: 1, col: 1 })
]);

const TILLABLE_FARMLAND_SOILS = Object.freeze([
    "minecraft:dirt",
    "minecraft:grass",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:dirt_with_roots"
]);

const CLOCK_TIER_CHANCE_MULTIPLIERS = Object.freeze({
    0: 1,
    1: 0.8,
    2: 0.6,
    3: 0.1,
    4: 0.05
});

const VANILLA_CROP_SPECS = Object.freeze({
    "minecraft:wheat_seeds": Object.freeze({
        seedItemId: "minecraft:wheat_seeds",
        cropBlockId: "minecraft:wheat",
        commandBlockId: "wheat",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze(["minecraft:wheat_seeds"]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom"
    }),
    "minecraft:carrot": Object.freeze({
        seedItemId: "minecraft:carrot",
        cropBlockId: "minecraft:carrots",
        commandBlockId: "carrots",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom"
    }),
    "minecraft:potato": Object.freeze({
        seedItemId: "minecraft:potato",
        cropBlockId: "minecraft:potatoes",
        commandBlockId: "potatoes",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom"
    }),
    "minecraft:beetroot_seeds": Object.freeze({
        seedItemId: "minecraft:beetroot_seeds",
        cropBlockId: "minecraft:beetroot",
        commandBlockId: "beetroot",
        ageState: "growth",
        maxAge: 7,
        validSoils: Object.freeze(["minecraft:farmland"]),
        bonusExclusions: Object.freeze(["minecraft:beetroot_seeds"]),
        biomeTokens: Object.freeze(["plains", "meadow", "sunflower"]),
        biomeTitle: "Plains Bloom"
    }),
    "minecraft:nether_wart": Object.freeze({
        seedItemId: "minecraft:nether_wart",
        cropBlockId: "minecraft:nether_wart",
        commandBlockId: "nether_wart",
        ageState: "age",
        maxAge: 3,
        validSoils: Object.freeze(["minecraft:soul_sand"]),
        bonusExclusions: Object.freeze([]),
        biomeTokens: Object.freeze(["nether"]),
        biomeTitle: "Nether Resonance"
    })
});

const UTILITY_TIER_SOILS = Object.freeze({
    1: "utilitycraft:yellow_soil",
    2: "utilitycraft:red_soil",
    3: "utilitycraft:blue_soil",
    4: "utilitycraft:black_soil"
});

const UTILITY_TIER_SEEDS = Object.freeze({
    1: Object.freeze([
        "utilitycraft:coal_seeds",
        "utilitycraft:copper_seeds",
        "utilitycraft:dyes_seeds",
        "utilitycraft:glass_seeds",
        "utilitycraft:gunpowder_seeds",
        "utilitycraft:iron_seeds",
        "utilitycraft:leather_seeds",
        "utilitycraft:prismarine_crystals_seeds",
        "utilitycraft:prismarine_shards_seeds",
        "utilitycraft:water_seeds",
        "utilitycraft:wool_seeds"
    ]),
    2: Object.freeze([
        "utilitycraft:ghast_seeds",
        "utilitycraft:glowstone_seeds",
        "utilitycraft:gold_seeds",
        "utilitycraft:honey_seeds",
        "utilitycraft:lapis_seeds",
        "utilitycraft:lava_seeds",
        "utilitycraft:quartz_seeds",
        "utilitycraft:redstone_seeds",
        "utilitycraft:resin_seeds",
        "utilitycraft:slime_seeds"
    ]),
    3: Object.freeze([
        "utilitycraft:amethyst_seeds",
        "utilitycraft:blaze_seeds",
        "utilitycraft:diamond_seeds",
        "utilitycraft:emerald_seeds",
        "utilitycraft:enderpearl_seeds",
        "utilitycraft:obsidian_seeds"
    ]),
    4: Object.freeze([
        "utilitycraft:nether_star_seeds",
        "utilitycraft:netherite_seeds",
        "utilitycraft:shulker_seeds",
        "utilitycraft:totem_seeds",
        "utilitycraft:wither_seeds"
    ])
});

const UTILITY_CROP_NAME_OVERRIDES = Object.freeze({
    prismarine_crystals: "prismarine_crystal_crop",
    nether_star: "netherstar_crop"
});

const UTILITY_BIOME_CONFIG = Object.freeze({
    water: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    prismarine_crystals: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    prismarine_shards: Object.freeze({
        tokens: Object.freeze(["ocean", "river", "beach"]),
        title: "Tidal Surge"
    }),
    slime: Object.freeze({
        tokens: Object.freeze(["swamp", "mangrove"]),
        title: "Bog Bloom"
    }),
    resin: Object.freeze({
        tokens: Object.freeze(["swamp", "mangrove"]),
        title: "Bog Bloom"
    }),
    honey: Object.freeze({
        tokens: Object.freeze(["flower", "meadow", "sunflower"]),
        title: "Flower Burst"
    }),
    ghast: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    glowstone: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    quartz: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    blaze: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    netherite: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    nether_star: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    }),
    wither: Object.freeze({
        tokens: Object.freeze(["nether"]),
        title: "Nether Resonance"
    })
});

const CROP_SPECS = Object.freeze({
    ...VANILLA_CROP_SPECS,
    ...buildUtilityCropSpecs()
});

DoriosAPI.register.blockComponent("verdant_cultivator", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? VERDANT_CULTIVATOR.defaults.energyCost);
            machine.displayEnergy(VERDANT_CULTIVATOR.slots.energy);
            machine.displayProgress(VERDANT_CULTIVATOR.slots.progress);
            machine.entity.setItem(VERDANT_CULTIVATOR.slots.status, "utilitycraft:arrow_indicator_90", 1, "");
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;

        runAdaptiveTickGate(
            machine.entity,
            "verdant_cultivator:item_io",
            VERDANT_CULTIVATOR.transfer.itemAdaptive,
            () => {
                const hasOutputs = VERDANT_CULTIVATOR.slots.outputs.some(slot => !!machine.inv.getItem(slot));
                const hasInputRoom = [...VERDANT_CULTIVATOR.slots.seeds, VERDANT_CULTIVATOR.slots.clock].some(slot => {
                    const stack = machine.inv.getItem(slot);
                    return !stack || stack.amount < stack.maxAmount;
                });

                if (!hasOutputs && !hasInputRoom) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                let moved = machine.transferItems("complex");
                for (const slot of VERDANT_CULTIVATOR.slots.seeds) {
                    moved = pullMatchingItemsFromAbove(machine, slot, isSupportedSeedItem) || moved;
                }
                moved = pullMatchingItemsFromAbove(machine, VERDANT_CULTIVATOR.slots.clock, isClockItem) || moved;

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        const operation = buildOperation(machine);

        if (!operation.supportedFacing) {
            clearConfigSignature(machine);
            showMachineWarning(machine, "Horizontal Only", operation, true);
            return;
        }

        if (!operation.hasValidSeeds) {
            clearConfigSignature(machine);
            showMachineWarning(machine, operation.message ?? "Insert Seeds", operation, true);
            return;
        }

        syncConfigSignature(machine, operation);

        if (!operation.ready) {
            machine.setProgress(0, VERDANT_CULTIVATOR.slots.progress);
            if (operation.message === "Monitoring") {
                showMachineStatus(machine, operation.message, operation);
            } else {
                showMachineWarning(machine, operation.message ?? "Monitoring", operation, true);
            }
            return;
        }

        machine.setEnergyCost(operation.energyCost);
        applyOperationRate(machine, operation);

        if (machine.energy.get() <= 0) {
            showMachineWarning(machine, "No Energy", operation, false);
            return;
        }

        const progress = machine.getProgress();
        if (progress >= operation.energyCost) {
            const lastCycle = executeOperation(machine, operation, settings);
            machine.addProgress(-operation.energyCost);
            showMachineStatus(machine, resolveCompletedMessage(lastCycle), {
                ...operation,
                lastCycle
            });
            return;
        }

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

        showMachineStatus(machine, resolveChargingMessage(operation), operation);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function buildUtilityCropSpecs() {
    const specs = {};

    for (const [tierKey, seedIds] of Object.entries(UTILITY_TIER_SEEDS)) {
        const tier = Number(tierKey);
        const soilId = UTILITY_TIER_SOILS[tier];
        if (!soilId) continue;

        for (const seedItemId of seedIds) {
            const rawName = seedItemId.split(":")[1]?.replace(/_seeds$/, "") ?? "";
            if (!rawName) continue;

            const cropName = UTILITY_CROP_NAME_OVERRIDES[rawName] ?? `${rawName}_crop`;
            const biomeConfig = UTILITY_BIOME_CONFIG[rawName] ?? null;

            specs[seedItemId] = Object.freeze({
                seedItemId,
                cropBlockId: `utilitycraft:${cropName}`,
                commandBlockId: `utilitycraft:${cropName}`,
                ageState: "utilitycraft:age",
                maxAge: 5,
                validSoils: Object.freeze([soilId]),
                bonusExclusions: Object.freeze([seedItemId]),
                biomeTokens: Object.freeze([...(biomeConfig?.tokens ?? [])]),
                biomeTitle: biomeConfig?.title ?? null
            });
        }
    }

    return specs;
}

function resolveSeedTemplates(machine) {
    return VERDANT_CULTIVATOR.slots.seeds.map(slot => {
        const stack = machine.inv.getItem(slot);
        const spec = stack ? getCropSpec(stack.typeId) : null;
        return {
            slot,
            stack,
            spec,
            invalid: Boolean(stack && !spec)
        };
    });
}

function getCropSpec(typeId) {
    if (!typeId) return null;
    return CROP_SPECS[typeId] ?? null;
}

function isSupportedSeedItem(item) {
    return Boolean(getCropSpec(item?.typeId));
}

function isClockItem(item) {
    return item?.typeId === "utilitycraft:accelerator_clock";
}

function buildOperation(machine) {
    const axis = machine.block.getState("utilitycraft:axis");
    const vectors = resolveHorizontalFieldVectors(machine.block);
    const supportedFacing = Boolean(vectors);
    const rangeLevel = Math.max(0, Math.min(VERDANT_CULTIVATOR.defaults.maxRangeLevel, Number(machine.upgrades?.range) || 0));
    const quantityLevel = getQuantityUpgradeLevel(machine);
    const sideLength = VERDANT_CULTIVATOR.defaults.baseSideLength + (rangeLevel * 2);
    const clockInstalled = isClockItem(machine.inv.getItem(VERDANT_CULTIVATOR.slots.clock));
    const templates = resolveSeedTemplates(machine);
    const validTemplates = templates.filter(template => template.spec);
    const invalidTemplate = templates.find(template => template.invalid) ?? null;
    const bufferInfo = getOutputBufferInfo(machine);

    const baseOperation = {
        supportedFacing,
        axis,
        rangeLevel,
        quantityLevel,
        sideLength,
        clockInstalled,
        forwardVector: vectors?.forward ?? null,
        rearVector: vectors
            ? {
                x: -vectors.forward.x,
                z: -vectors.forward.z
            }
            : null,
        seedTemplates: templates,
        activeTemplateCount: validTemplates.length,
        invalidTemplate,
        bufferFilledSlots: bufferInfo.filledSlots,
        bufferTotalItems: bufferInfo.totalItems,
        outputsFilled: bufferInfo.filledSlots,
        biomeId: null,
        activeBiomeBonusTitle: null,
        biomeBonusActive: false,
        hasValidSeeds: validTemplates.length > 0,
        focusSpec: validTemplates[0]?.spec ?? null,
        harvestTargets: [],
        plantTargets: [],
        replantTargets: [],
        growthTargets: [],
        selectedGrowthTargets: [],
        blockedCount: 0,
        invalidSoilCount: 0,
        activeCellCount: 0,
        ready: false,
        message: null,
        energyCost: 0,
        cycleSeconds: 0,
        configSignature: ""
    };

    if (!supportedFacing) {
        return {
            ...baseOperation,
            hasValidSeeds: validTemplates.length > 0,
            message: "Horizontal Only"
        };
    }

    if (validTemplates.length <= 0) {
        return {
            ...baseOperation,
            message: invalidTemplate ? "Unsupported Seed" : "Insert Seeds"
        };
    }

    const field = buildFieldLayout(machine.block, sideLength, templates);
    const biomeProbe = field.cells[0]?.position ?? machine.block.location;
    const biomeId = getBiomeId(machine.dim, biomeProbe);
    const activeBiomeBonuses = dedupeBiomeBonuses(
        validTemplates
            .map(template => resolveBiomeBonus(template.spec, biomeId))
            .filter(result => result.active)
    );

    const harvestTargets = [];
    const plantCandidates = [];
    const growthCandidates = [];
    let blockedCount = 0;
    let invalidSoilCount = 0;

    for (const cell of field.cells) {
        const evaluation = evaluateFieldCell(machine, cell);
        if (evaluation.kind === "harvest") {
            harvestTargets.push(cell);
            continue;
        }
        if (evaluation.kind === "plant") {
            plantCandidates.push(cell);
            continue;
        }
        if (evaluation.kind === "grow") {
            growthCandidates.push(cell);
            continue;
        }
        if (evaluation.kind === "invalid_soil") {
            invalidSoilCount += 1;
            continue;
        }
        if (evaluation.kind === "blocked") {
            blockedCount += 1;
        }
    }

    const plantBudgets = buildSeedBudgets(validTemplates);
    const replantTargets = reservePlantTargets(harvestTargets, plantBudgets);
    const plantTargets = reservePlantTargets(plantCandidates, plantBudgets);

    const quantityPulseTargets = quantityLevel * VERDANT_CULTIVATOR.defaults.clockPulseTargetsPerQuantityLevel;
    const biomePulseTargets = activeBiomeBonuses.length > 0
        ? VERDANT_CULTIVATOR.defaults.biomeBonusExtraPulseTargets
        : 0;
    const pulseTargetBudget = VERDANT_CULTIVATOR.defaults.clockPulseBaseTargets + quantityPulseTargets + biomePulseTargets;
    const pulseTargetCount = clockInstalled
        ? Math.min(
            growthCandidates.length,
            Math.max(VERDANT_CULTIVATOR.defaults.clockPulseBaseTargets, pulseTargetBudget)
        )
        : 0;
    const selectedGrowthTargets = pulseTargetCount > 0
        ? sampleEntries(growthCandidates, pulseTargetCount)
        : [];

    const ready = harvestTargets.length > 0 || plantTargets.length > 0 || selectedGrowthTargets.length > 0;
    const energyCost = ready
        ? Math.max(
            1,
            VERDANT_CULTIVATOR.defaults.sweepCostBase
                + (sideLength * VERDANT_CULTIVATOR.defaults.sweepCostPerSide)
                + (harvestTargets.length * VERDANT_CULTIVATOR.defaults.harvestCost)
                + ((plantTargets.length + replantTargets.length) * VERDANT_CULTIVATOR.defaults.plantCost)
                + (selectedGrowthTargets.length * VERDANT_CULTIVATOR.defaults.growthCost)
        )
        : 0;
    const cycleSeconds = ready
        ? resolveOperationCycleSeconds({
            sideLength,
            harvestCount: harvestTargets.length,
            plantCount: plantTargets.length + replantTargets.length,
            pulseCount: selectedGrowthTargets.length
        })
        : 0;
    const configSignature = buildConfigSignature({
        axis,
        sideLength,
        quantityLevel,
        clockInstalled,
        templates
    });

    return {
        ...baseOperation,
        biomeId,
        activeBiomeBonusTitle: activeBiomeBonuses[0]?.title ?? null,
        biomeBonusActive: activeBiomeBonuses.length > 0,
        harvestTargets,
        plantTargets,
        replantTargets,
        growthTargets: growthCandidates,
        selectedGrowthTargets,
        blockedCount,
        invalidSoilCount,
        activeCellCount: field.cells.length,
        ready,
        message: resolveIdleMessage({ blockedCount, invalidSoilCount, ready }),
        energyCost,
        cycleSeconds,
        configSignature
    };
}

function buildFieldLayout(block, sideLength, templates) {
    const vectors = resolveHorizontalFieldVectors(block);
    const pattern = buildSeedPattern(templates);
    if (!vectors || pattern.cells.length <= 0) return { cells: [] };

    const halfWidth = Math.floor(sideLength / 2);
    const cells = [];
    const anchor = {
        x: block.location.x + vectors.forward.x,
        y: block.location.y,
        z: block.location.z + vectors.forward.z
    };

    for (let row = 0; row < sideLength; row++) {
        for (let col = 0; col < sideLength; col++) {
            const patternIndex = ((row % pattern.height) * pattern.width) + (col % pattern.width);
            const template = pattern.cells[patternIndex] ?? null;
            if (!template?.spec) continue;

            const lateral = col - halfWidth;
            cells.push({
                row,
                col,
                template,
                spec: template.spec,
                position: {
                    x: anchor.x + (vectors.forward.x * row) + (vectors.right.x * lateral),
                    y: anchor.y,
                    z: anchor.z + (vectors.forward.z * row) + (vectors.right.z * lateral)
                }
            });
        }
    }

    return { cells };
}

function resolveHorizontalFieldVectors(block) {
    const forward = getFrontVector(block);
    if (!forward || forward.y !== 0) return null;

    if (forward.x === 1) {
        return {
            forward: { x: 1, z: 0 },
            right: { x: 0, z: 1 }
        };
    }

    if (forward.x === -1) {
        return {
            forward: { x: -1, z: 0 },
            right: { x: 0, z: -1 }
        };
    }

    if (forward.z === 1) {
        return {
            forward: { x: 0, z: 1 },
            right: { x: -1, z: 0 }
        };
    }

    if (forward.z === -1) {
        return {
            forward: { x: 0, z: -1 },
            right: { x: 1, z: 0 }
        };
    }

    return null;
}

function getFrontVector(block) {
    const axis = block?.permutation?.getState?.("utilitycraft:axis") ?? block?.getState?.("utilitycraft:axis");

    switch (axis) {
        case "east":
            return { x: 1, y: 0, z: 0 };
        case "west":
            return { x: -1, y: 0, z: 0 };
        case "north":
            return { x: 0, y: 0, z: -1 };
        case "south":
            return { x: 0, y: 0, z: 1 };
        case "up":
            return { x: 0, y: 1, z: 0 };
        case "down":
            return { x: 0, y: -1, z: 0 };
        default:
            return null;
    }
}

function buildSeedPattern(templates) {
    const entries = SEED_PATTERN_LAYOUT
        .map(layout => ({
            row: layout.row,
            col: layout.col,
            template: templates[layout.slotIndex] ?? null
        }))
        .filter(entry => entry.template?.spec);

    if (entries.length <= 0) {
        return {
            width: 0,
            height: 0,
            cells: []
        };
    }

    const rows = [...new Set(entries.map(entry => entry.row))].sort((a, b) => a - b);
    const cols = [...new Set(entries.map(entry => entry.col))].sort((a, b) => a - b);
    const firstTemplate = entries[0].template;
    const cells = [];

    for (const row of rows) {
        for (const col of cols) {
            const template = entries.find(entry => entry.row === row && entry.col === col)?.template
                ?? entries.find(entry => entry.row === row)?.template
                ?? entries.find(entry => entry.col === col)?.template
                ?? firstTemplate;
            cells.push(template);
        }
    }

    return {
        width: Math.max(1, cols.length),
        height: Math.max(1, rows.length),
        cells
    };
}

function evaluateFieldCell(machine, cell) {
    const block = machine.dim.getBlock(cell.position);
    if (!block) return { kind: "blocked" };

    if (block.typeId === cell.spec.cropBlockId) {
        if (isCropMature(block, cell.spec)) {
            return { kind: "harvest" };
        }
        if (canGrowCrop(block, cell.spec)) {
            return { kind: "grow" };
        }
        return { kind: "monitor" };
    }

    if (!block.isAir) {
        return { kind: "blocked" };
    }

    const soilBlock = machine.dim.getBlock({
        x: cell.position.x,
        y: cell.position.y - 1,
        z: cell.position.z
    });

    if (!soilBlock || !isValidSoil(soilBlock, cell.spec)) {
        return { kind: "invalid_soil" };
    }

    return { kind: "plant" };
}

function isCropMature(block, spec) {
    const age = block?.permutation?.getState?.(spec.ageState);
    return typeof age === "number" && age >= spec.maxAge;
}

function canGrowCrop(block, spec) {
    const age = block?.permutation?.getState?.(spec.ageState);
    return typeof age === "number" && age < spec.maxAge;
}

function isValidSoil(block, spec) {
    return resolvePlantingSoil(block, spec).valid;
}

function resolvePlantingSoil(block, spec) {
    const soilId = block?.typeId;
    if (!soilId || !spec?.validSoils?.length) {
        return { valid: false, tillRequired: false, targetSoilId: null };
    }

    if (spec.validSoils.includes(soilId)) {
        return {
            valid: true,
            tillRequired: false,
            targetSoilId: soilId
        };
    }

    if (spec.validSoils.includes("minecraft:farmland") && TILLABLE_FARMLAND_SOILS.includes(soilId)) {
        return {
            valid: true,
            tillRequired: true,
            targetSoilId: "minecraft:farmland"
        };
    }

    return { valid: false, tillRequired: false, targetSoilId: null };
}

function prepareSoilForPlanting(machine, soilBlock, spec) {
    const soilPlan = resolvePlantingSoil(soilBlock, spec);
    if (!soilPlan.valid) return false;
    if (!soilPlan.tillRequired) return true;

    try {
        soilBlock.setType(soilPlan.targetSoilId);
        return true;
    } catch {
        return runSetblock(machine, soilBlock.location, `${soilPlan.targetSoilId} replace`);
    }
}

function buildSeedBudgets(templates) {
    const budgets = new Map();

    for (const template of templates) {
        const amount = Number(template?.stack?.amount ?? 0);
        if (!template?.spec || amount <= 0) continue;
        budgets.set(template.slot, amount);
    }

    return budgets;
}

function reservePlantTargets(candidates, budgets) {
    const reserved = [];

    for (const candidate of candidates) {
        const slot = candidate?.template?.slot;
        if (typeof slot !== "number") continue;

        const remaining = budgets.get(slot) ?? 0;
        if (remaining <= 0) continue;

        budgets.set(slot, remaining - 1);
        reserved.push(candidate);
    }

    return reserved;
}

function getQuantityUpgradeLevel(machine) {
    let total = 0;
    for (const slot of VERDANT_CULTIVATOR.slots.upgrades) {
        const item = machine.inv.getItem(slot);
        if (!isQuantityUpgradeItem(item)) continue;
        total += item.amount;
    }

    return Math.max(0, Math.min(VERDANT_CULTIVATOR.defaults.maxQuantityLevel, total));
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

function executeOperation(machine, operation, settings) {
    let harvestedCount = 0;
    let plantedCount = 0;
    let pulsedCount = 0;
    let collectedCount = 0;
    let bonusCount = 0;
    let overflowCount = 0;
    const harvestedPositions = [];
    const replantTargets = new Set((operation.replantTargets ?? []).map(target => buildPositionKey(target.position)));

    for (const target of operation.selectedGrowthTargets) {
        const block = machine.dim.getBlock(target.position);
        if (!block || block.typeId !== target.spec.cropBlockId) continue;

        if (!growCropBlock(block, target.spec)) continue;
        pulsedCount += 1;
    }

    for (const target of operation.harvestTargets) {
        const block = machine.dim.getBlock(target.position);
        if (!block || block.typeId !== target.spec.cropBlockId || !isCropMature(block, target.spec)) continue;

        const harvestResult = harvestCrop(machine, target);
        if (!harvestResult.harvested) continue;

        harvestedCount += 1;
        harvestedPositions.push(target.position);

        if (replantTargets.has(buildPositionKey(target.position)) && plantTarget(machine, target)) {
            plantedCount += 1;
        }
    }

    for (const target of operation.plantTargets) {
        if (!plantTarget(machine, target)) continue;
        plantedCount += 1;
    }

    if (harvestedPositions.length > 0) {
        scheduleHarvestDropCollection(machine, harvestedPositions, operation, settings);
    }

    return {
        harvestedCount,
        plantedCount,
        pulsedCount,
        collectedCount,
        bonusCount,
        overflowCount
    };
}

function growCropBlock(block, spec) {
    const permutation = block?.permutation;
    if (!permutation) return false;

    const currentAge = permutation.getState(spec.ageState);
    if (typeof currentAge !== "number" || currentAge >= spec.maxAge) return false;

    const tier = Number(permutation.getState("utilitycraft:tier") ?? 0);
    const chanceMultiplier = CLOCK_TIER_CHANCE_MULTIPLIERS[tier] ?? 1;
    const finalChance = Math.min(
        0.95,
        VERDANT_CULTIVATOR.defaults.clockPulseBaseChance * chanceMultiplier
    );
    if (Math.random() > finalChance) return false;

    try {
        block.setPermutation(permutation.withState(spec.ageState, currentAge + 1));
        if (Math.random() <= 0.25) {
            block.dimension.spawnParticle("minecraft:crop_growth_emitter", block.center());
        }
        return true;
    } catch {
        return false;
    }
}

function harvestCrop(machine, target) {
    const block = machine.dim.getBlock(target.position);
    if (!block || block.typeId !== target.spec.cropBlockId || !isCropMature(block, target.spec)) {
        return {
            harvested: false
        };
    }

    if (!runSetblock(machine, target.position, "air destroy")) {
        return {
            harvested: false
        };
    }

    return {
        harvested: true
    };
}

function plantCrop(machine, spec, position) {
    const specifier = buildPlantBlockSpecifier(spec);
    return runSetblock(machine, position, `${specifier} replace`);
}

function buildPlantBlockSpecifier(spec) {
    if (spec.ageState === "utilitycraft:age") {
        return `${spec.commandBlockId} [\"utilitycraft:age\"=0]`;
    }

    return spec.commandBlockId;
}

function plantTarget(machine, target) {
    const block = machine.dim.getBlock(target.position);
    const soilBlock = machine.dim.getBlock({
        x: target.position.x,
        y: target.position.y - 1,
        z: target.position.z
    });

    if (!block || !block.isAir || !soilBlock || !isValidSoil(soilBlock, target.spec)) return false;
    if (!consumeSeedFromSlot(machine, target.template?.slot, target.spec.seedItemId)) return false;

    if (!prepareSoilForPlanting(machine, soilBlock, target.spec)) {
        restoreSeedToSlot(machine, target.template?.slot, target.spec.seedItemId);
        return false;
    }

    if (plantCrop(machine, target.spec, target.position)) {
        return true;
    }

    restoreSeedToSlot(machine, target.template?.slot, target.spec.seedItemId);
    return false;
}

function consumeSeedFromSlot(machine, slot, expectedTypeId) {
    if (!machine?.inv || typeof slot !== "number" || !expectedTypeId) return false;

    const stack = machine.inv.getItem(slot);
    if (!stack || stack.typeId !== expectedTypeId || stack.amount <= 0) return false;

    if (stack.amount <= 1) {
        machine.inv.setItem(slot, undefined);
        return true;
    }

    stack.amount -= 1;
    machine.inv.setItem(slot, stack);
    return true;
}

function restoreSeedToSlot(machine, slot, typeId) {
    if (!machine?.inv || typeof slot !== "number" || !typeId) return false;

    const current = machine.inv.getItem(slot);
    if (!current) {
        machine.inv.setItem(slot, new ItemStack(typeId, 1));
        return true;
    }

    if (current.typeId !== typeId || current.amount >= current.maxAmount) return false;
    current.amount += 1;
    machine.inv.setItem(slot, current);
    return true;
}

function runSetblock(machine, position, suffix) {
    try {
        machine.dim.runCommand(`setblock ${position.x} ${position.y} ${position.z} ${suffix}`);
        return true;
    } catch {
        return false;
    }
}

function scheduleHarvestDropCollection(machine, harvestedPositions, operation, settings) {
    if (!machine?.dim || !machine?.block || !Array.isArray(harvestedPositions) || harvestedPositions.length <= 0) {
        return;
    }

    const machineLocation = {
        x: machine.block.location.x,
        y: machine.block.location.y,
        z: machine.block.location.z
    };
    const operationSnapshot = {
        quantityLevel: operation.quantityLevel,
        biomeBonusActive: operation.biomeBonusActive,
        seedTemplates: (operation.seedTemplates ?? []).map(template => ({
            spec: template?.spec
                ? {
                    bonusExclusions: [...(template.spec.bonusExclusions ?? [])]
                }
                : null
        }))
    };

    system.runTimeout(() => {
        const block = machine.dim.getBlock(machineLocation);
        if (!block || block.typeId !== "utilitycraft:verdant_cultivator") return;

        const delayedMachine = new Machine(block, settings);
        if (!delayedMachine.valid || !delayedMachine.inv) return;

        delayedMachine.transferItems("complex");
        collectHarvestDrops(delayedMachine, harvestedPositions, operationSnapshot);
        delayedMachine.transferItems("complex");
    }, VERDANT_CULTIVATOR.defaults.dropCollectionDelayTicks);
}

function collectHarvestDrops(machine, harvestedPositions, operation) {
    const bounds = buildCollectionBounds(harvestedPositions);
    if (!bounds) {
        return {
            collectedCount: 0,
            bonusCount: 0,
            overflowCount: 0
        };
    }

    const nearbyItems = machine.dim.getEntities({
        type: "item",
        location: bounds.center,
        maxDistance: bounds.radius
    });

    const exclusions = buildHarvestExclusionSet(operation);
    let collectedCount = 0;
    let bonusCount = 0;
    let overflowCount = 0;

    for (const itemEntity of nearbyItems) {
        if (!isWithinBounds(itemEntity?.location, bounds)) continue;

        const stack = itemEntity.getComponent("minecraft:item")?.itemStack;
        if (!stack?.typeId || !Number.isFinite(stack.amount) || stack.amount <= 0) continue;

        const bonusAmount = isHarvestBonusEligible(stack, exclusions)
            ? rollHarvestBonus(operation.quantityLevel, operation.biomeBonusActive)
            : 0;
        const totalAmount = stack.amount + bonusAmount;
        const itemLocation = itemEntity.location;

        itemEntity.remove();

        const augmented = cloneItemStack(stack, totalAmount);
        const insertedAmount = insertItemIntoSlots(machine.inv, augmented, VERDANT_CULTIVATOR.slots.outputs);
        const overflowAmount = Math.max(0, totalAmount - insertedAmount);

        collectedCount += insertedAmount;
        bonusCount += bonusAmount;
        overflowCount += overflowAmount;

        if (overflowAmount > 0) {
            machine.dim.spawnItem(cloneItemStack(stack, overflowAmount), itemLocation);
        }
    }

    return {
        collectedCount,
        bonusCount,
        overflowCount
    };
}

function buildHarvestExclusionSet(operation) {
    const exclusions = new Set();

    for (const template of operation.seedTemplates ?? []) {
        for (const typeId of template?.spec?.bonusExclusions ?? []) {
            exclusions.add(typeId);
        }
    }

    return exclusions;
}

function isHarvestBonusEligible(stack, exclusions) {
    if (!stack?.typeId) return false;
    if (exclusions.has(stack.typeId)) return false;
    if (stack.typeId.endsWith("_seeds")) return false;
    if (stack.typeId.endsWith("_sapling")) return false;
    if (stack.typeId.endsWith("_propagule")) return false;
    return true;
}

function rollHarvestBonus(quantityLevel, biomeBonusActive) {
    let extra = 0;

    for (let level = 0; level < quantityLevel; level++) {
        if (Math.random() <= VERDANT_CULTIVATOR.defaults.harvestBonusChancePerLevel) {
            extra += 1;
        }
    }

    if (biomeBonusActive && Math.random() <= VERDANT_CULTIVATOR.defaults.biomeBonusYieldChance) {
        extra += 1;
    }

    return extra;
}

function getOutputBufferInfo(machine) {
    let filledSlots = 0;
    let totalItems = 0;

    for (const slot of VERDANT_CULTIVATOR.slots.outputs) {
        const stack = machine.inv.getItem(slot);
        if (!stack) continue;
        filledSlots += 1;
        totalItems += Number(stack.amount) || 0;
    }

    return { filledSlots, totalItems };
}

function buildConfigSignature({ axis, sideLength, quantityLevel, clockInstalled, templates }) {
    const templateSignature = templates
        .map(template => template.stack?.typeId ?? "empty")
        .join(",");

    return [
        axis,
        sideLength,
        quantityLevel,
        clockInstalled ? 1 : 0,
        templateSignature
    ].join("|");
}

function getStoredConfigSignature(machine) {
    const value = machine?.entity?.getDynamicProperty?.(VERDANT_CULTIVATOR.properties.configSignature);
    return typeof value === "string" ? value : "";
}

function syncConfigSignature(machine, operation) {
    const nextValue = operation?.configSignature ?? "";
    const previousValue = getStoredConfigSignature(machine);

    if (machine.getProgress() > 0 && previousValue && nextValue && previousValue !== nextValue) {
        machine.setProgress(0, VERDANT_CULTIVATOR.slots.progress);
    }

    if (previousValue !== nextValue) {
        machine.entity.setDynamicProperty(VERDANT_CULTIVATOR.properties.configSignature, nextValue);
    }
}

function clearConfigSignature(machine) {
    machine?.entity?.setDynamicProperty?.(VERDANT_CULTIVATOR.properties.configSignature, "");
}

function resolveIdleMessage({ blockedCount, invalidSoilCount, ready }) {
    if (ready) return null;
    if (blockedCount > 0 || invalidSoilCount > 0) return "Field Blocked";
    return "Monitoring";
}

function resolveChargingMessage(operation) {
    if ((operation.harvestTargets?.length ?? 0) > 0) return "Cultivating";
    if ((operation.plantTargets?.length ?? 0) > 0) return "Planting";
    if ((operation.selectedGrowthTargets?.length ?? 0) > 0) return "Pulsing";
    return "Charging";
}

function resolveCompletedMessage(lastCycle) {
    if ((lastCycle?.harvestedCount ?? 0) > 0) return "Cultivated";
    if ((lastCycle?.plantedCount ?? 0) > 0) return "Planted";
    if ((lastCycle?.pulsedCount ?? 0) > 0) return "Pulsed";
    return "Monitoring";
}

function resolveOperationCycleSeconds({ sideLength = 0, harvestCount = 0, plantCount = 0, pulseCount = 0 } = {}) {
    const harvestSeconds = Math.min(
        VERDANT_CULTIVATOR.defaults.maxHarvestCycleBonusSeconds,
        Math.max(0, harvestCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerHarvestSeconds
    );
    const plantSeconds = Math.min(
        VERDANT_CULTIVATOR.defaults.maxPlantCycleBonusSeconds,
        Math.max(0, plantCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerPlantSeconds
    );
    const pulseSeconds = Math.max(0, pulseCount) * VERDANT_CULTIVATOR.defaults.cycleTimePerPulseSeconds;

    return Math.max(
        0.5,
        VERDANT_CULTIVATOR.defaults.cycleTimeBaseSeconds
            + (Math.max(0, sideLength) * VERDANT_CULTIVATOR.defaults.cycleTimePerSideSeconds)
            + harvestSeconds
            + plantSeconds
            + pulseSeconds
    );
}

function applyOperationRate(machine, operation) {
    if (!machine || !operation?.ready || !Number.isFinite(operation.energyCost) || operation.energyCost <= 0) {
        return false;
    }

    const cycleSeconds = Math.max(0.5, Number(operation.cycleSeconds) || 0);
    if (!Number.isFinite(cycleSeconds) || cycleSeconds <= 0) {
        return false;
    }

    return applyDynamicRecipeRate(
        machine,
        { timeSeconds: cycleSeconds },
        { energyCost: operation.energyCost }
    );
}

function resolveBiomeBonus(spec, biomeId) {
    if (!spec?.biomeTokens?.length || !biomeId) {
        return { active: false, title: null };
    }

    const normalizedBiomeId = biomeId.toLowerCase();
    const active = spec.biomeTokens.some(token => normalizedBiomeId.includes(token));
    return {
        active,
        title: active ? spec.biomeTitle ?? "Biome Surge" : null
    };
}

function dedupeBiomeBonuses(bonuses) {
    const seen = new Set();
    const list = [];

    for (const bonus of bonuses) {
        if (!bonus?.active || !bonus.title || seen.has(bonus.title)) continue;
        seen.add(bonus.title);
        list.push(bonus);
    }

    return list;
}

function getBiomeId(dimension, location) {
    try {
        const biome = dimension.getBiome?.(location);
        if (!biome) return null;
        return biome.id ?? biome.typeId ?? biome.identifier ?? null;
    } catch {
        return null;
    }
}

function formatBiomeName(biomeId) {
    if (!biomeId) return "Unknown";
    const raw = biomeId.split(":").pop() ?? biomeId;
    return raw
        .split(/[_-]/g)
        .filter(Boolean)
        .map(capitalizeWord)
        .join(" ");
}

function capitalizeWord(value) {
    if (!value) return "";
    return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function sampleEntries(entries, count) {
    const pool = [...entries];
    for (let index = pool.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, count);
}

function transferOutputBufferToRear(machine) {
    return machine?.transferItems?.("complex") ?? false;
}

function pullMatchingItemsFromAbove(machine, targetSlot, predicate) {
    const aboveBlock = machine.block.above(1);
    if (!aboveBlock) return false;

    if (!DoriosAPI.constants.vanillaContainers.includes(aboveBlock.typeId)) return false;

    const inputContainer = aboveBlock.getComponent("minecraft:inventory")?.container;
    if (!inputContainer) return false;

    const targetItem = machine.inv.getItem(targetSlot);
    for (let slot = 0; slot < inputContainer.size; slot++) {
        const inputItem = inputContainer.getItem(slot);
        if (!inputItem || !predicate(inputItem)) continue;

        if (targetItem && inputItem.typeId !== targetItem.typeId) continue;

        if (!targetItem) {
            machine.inv.setItem(targetSlot, inputItem);
            inputContainer.setItem(slot, undefined);
            return true;
        }

        const space = targetItem.maxAmount - targetItem.amount;
        const amount = Math.min(space, inputItem.amount);
        if (amount <= 0) continue;

        targetItem.amount += amount;
        machine.inv.setItem(targetSlot, targetItem);

        if (inputItem.amount - amount <= 0) {
            inputContainer.setItem(slot, undefined);
        } else {
            inputItem.amount -= amount;
            inputContainer.setItem(slot, inputItem);
        }

        return true;
    }

    return false;
}

function insertItemIntoSlots(container, stack, slots) {
    if (!container || !stack?.typeId || !Array.isArray(slots) || slots.length === 0) return 0;

    let remaining = stack.amount;
    const sourceLore = typeof stack.getLore === "function" ? (stack.getLore() ?? []) : [];
    const sourceName = stack.nameTag ?? "";

    const matchesStack = slotItem => {
        if (!slotItem || slotItem.typeId !== stack.typeId) return false;
        if ((slotItem.nameTag ?? "") !== sourceName) return false;
        const slotLore = typeof slotItem.getLore === "function" ? (slotItem.getLore() ?? []) : [];
        if (slotLore.length !== sourceLore.length) return false;
        return slotLore.every((line, index) => line === sourceLore[index]);
    };

    for (const slot of slots) {
        const slotItem = container.getItem(slot);
        if (!matchesStack(slotItem)) continue;

        const space = slotItem.maxAmount - slotItem.amount;
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

        const amountToInsert = Math.min(stack.maxAmount ?? 64, remaining);
        const newStack = cloneItemStack(stack, amountToInsert);
        container.setItem(slot, newStack);
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
    return clone;
}

function buildCollectionBounds(positions = []) {
    if (!Array.isArray(positions) || positions.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const position of positions) {
        if (!position) continue;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        minZ = Math.min(minZ, position.z);
        maxX = Math.max(maxX, position.x);
        maxY = Math.max(maxY, position.y);
        maxZ = Math.max(maxZ, position.z);
    }

    if (!Number.isFinite(minX)) return null;

    const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    };
    const radius = Math.max(
        Math.abs(maxX - center.x),
        Math.abs(maxY - center.y),
        Math.abs(maxZ - center.z)
    ) + 2;

    return {
        minX: minX - 0.75,
        minY: minY - 0.75,
        minZ: minZ - 0.75,
        maxX: maxX + 0.75,
        maxY: maxY + 0.75,
        maxZ: maxZ + 0.75,
        center,
        radius
    };
}

function isWithinBounds(location, bounds) {
    if (!location || !bounds) return false;
    return location.x >= bounds.minX && location.x <= bounds.maxX
        && location.y >= bounds.minY && location.y <= bounds.maxY
        && location.z >= bounds.minZ && location.z <= bounds.maxZ;
}

function buildPositionKey(position) {
    return `${position?.x ?? 0},${position?.y ?? 0},${position?.z ?? 0}`;
}

function toSpawnPosition(location) {
    return {
        x: (location?.x ?? 0) + 0.5,
        y: (location?.y ?? 0) + 0.5,
        z: (location?.z ?? 0) + 0.5
    };
}

function buildMachineLore(machine, context = {}) {
    const lines = [];
    const overclockLine = buildOverclockLoreLine(machine)?.replace(/^§r/, "");

    const machineInfo = [
        {
            label: "Energy",
            value: formatMachineEnergyBuffer(machine)
        },
        {
            label: "Area",
            value: `${context.sideLength ?? 0}x${context.sideLength ?? 0}`
        },
        {
            label: "Templates",
            value: `${context.activeTemplateCount ?? 0}/4`
        },
        {
            label: "Clock",
            value: context.clockInstalled ? "Pulse" : "None"
        },
        {
            label: "Fortune",
            value: `Q${context.quantityLevel ?? 0}`
        },
        {
            label: "Buffer",
            value: `${context.bufferFilledSlots ?? 0}/${VERDANT_CULTIVATOR.slots.outputs.length} slots`
        }
    ];
    if (overclockLine) machineInfo.push(overclockLine);

    appendLoreSection(lines, "Machine Information", machineInfo, {
        spacing: false
    });

    const fieldInfo = [];
    if (context.focusSpec?.seedItemId) {
        fieldInfo.push({
            label: "Focus",
            value: formatItemName(context.focusSpec.seedItemId)
        });
    }
    if (context.invalidTemplate?.stack?.typeId) {
        fieldInfo.push({
            label: "Template Issue",
            value: formatItemName(context.invalidTemplate.stack.typeId),
            valueColor: "§e"
        });
    }
    fieldInfo.push(
        {
            label: "Harvest",
            value: context.harvestTargets?.length ?? 0
        },
        {
            label: "Plant",
            value: (context.plantTargets?.length ?? 0) + (context.replantTargets?.length ?? 0)
        }
    );

    if (context.clockInstalled) {
        fieldInfo.push({
            label: "Pulse",
            value: context.selectedGrowthTargets?.length ?? 0
        });
    }
    if ((context.invalidSoilCount ?? 0) > 0) {
        fieldInfo.push({
            label: "Soil",
            value: `${context.invalidSoilCount} blocked`,
            valueColor: "§e"
        });
    }
    if ((context.blockedCount ?? 0) > 0) {
        fieldInfo.push({
            label: "Blocked",
            value: context.blockedCount,
            valueColor: "§e"
        });
    }
    if ((context.energyCost ?? 0) > 0) {
        fieldInfo.push({
            label: "Cost",
            value: formatEnergyCost(context.energyCost)
        });
    }
    if ((context.cycleSeconds ?? 0) > 0) {
        fieldInfo.push({
            label: "Cycle",
            value: formatSecondsLabel(context.cycleSeconds)
        });
    }
    if (context.biomeId) {
        fieldInfo.push({
            label: "Biome",
            value: formatBiomeName(context.biomeId)
        });
    }
    if (context.activeBiomeBonusTitle) {
        fieldInfo.push({
            label: "Biome Bonus",
            value: context.activeBiomeBonusTitle,
            valueColor: "§b"
        });
    }

    if (fieldInfo.length > 0) {
        appendLoreSection(lines, "Field Operation", fieldInfo);
    }

    const lastCycle = context.lastCycle ?? null;
    if (lastCycle) {
        const lastSection = [];
        if ((lastCycle.harvestedCount ?? 0) > 0) {
            lastSection.push(`§7Harvested: §f${lastCycle.harvestedCount} crop(s)`);
        }
        if ((lastCycle.plantedCount ?? 0) > 0) {
            lastSection.push(`§7Planted: §f${lastCycle.plantedCount} slot(s)`);
        }
        if ((lastCycle.pulsedCount ?? 0) > 0) {
            lastSection.push(`§7Pulsed: §f${lastCycle.pulsedCount} crop(s)`);
        }
        if ((lastCycle.collectedCount ?? 0) > 0) {
            lastSection.push(`§7Buffered: §f${lastCycle.collectedCount} item(s)`);
        }
        if ((lastCycle.bonusCount ?? 0) > 0) {
            lastSection.push(`§bBiome/Fortune Bonus: §f${lastCycle.bonusCount}`);
        }
        if ((lastCycle.overflowCount ?? 0) > 0) {
            lastSection.push(`§6Overflow: §f${lastCycle.overflowCount} dropped`);
        }

        if (lastSection.length > 0) {
            appendLoreSection(lines, "Last Sweep", lastSection);
        }
    }

    return lines;
}

function buildFooterLines(context = {}) {
    const lines = [
        `Area: ${context.sideLength ?? 0}x${context.sideLength ?? 0}`,
        `Clock: ${context.clockInstalled ? "Pulse" : "Off"}`,
        `Fortune: Q${context.quantityLevel ?? 0}`
    ];

    if (context.activeBiomeBonusTitle) {
        lines.push(`Biome Bonus: ${context.activeBiomeBonusTitle}`);
    }

    return lines;
}

function updateDisplays(machine) {
    machine.displayEnergy(VERDANT_CULTIVATOR.slots.energy);
    machine.displayProgress(VERDANT_CULTIVATOR.slots.progress);
}

function showMachineWarning(machine, message, context = {}, resetProgress = true) {
    machine.off();
    machine.showWarning(
        message,
        resetProgress,
        buildMachineLore(machine, context),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine);
}

function showMachineStatus(machine, message, context = {}) {
    machine.on();
    machine.showStatus(
        message,
        buildMachineLore(machine, context),
        {
            footerLines: buildFooterLines(context),
            displayModel: "minimal"
        }
    );
    updateDisplays(machine);
}

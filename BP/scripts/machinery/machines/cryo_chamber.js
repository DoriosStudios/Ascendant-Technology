import { ItemStack } from "@minecraft/server";
import { Machine, Energy, FluidManager } from '../managers_extra.js';
import { getCryoChamberRecipes, getCryofluidGenerationConfig } from '../../config/recipes/cryo_chamber.js';

/**
 * Cryo Chamber - Multi-function thermal stabilizer
 * 
 * Operating Modes:
 * 1. Cryo Stabilizer - Stabilizes volatile materials using cryofluid
 * 2. Cooling Chamber - Converts items/food to cold variants
 * 3. Cryofluid Generator - Converts water + titanium catalyst into cryofluid
 * 
 * Slot Layout (inventory_size: 27):
 * - [0] Energy HUD
 * - [1] Stabilizer status label
 * - [2] Stabilizer progress indicator
 * - [3] Stabilizer input
 * - [4,5,9] Upgrade slots (energy, speed)
 * - [6-8,15-17,24-26] Cooling grid (inputs/outputs share slot)
 * - [10] Water input slot (generator)
 * - [11] Water tank display
 * - [12] Cryofluid capsule slot (output)
 * - [13] Cryofluid tank display
 * - [14] Stabilizer output slot
 * - [19] Titanium catalyst slot (generator)
 * - [18] Cooling status label
 * - [20] Generator status label
 * - [23] Layout guide indicator
 */

// Slot constants
const ENERGY_SLOT = 0;
const STABILIZER_STATUS_SLOT = 1;
const STABILIZER_PROGRESS_SLOT = 2;
const STABILIZER_INPUT_SLOT = 3;
const UPGRADE_SLOTS = [4, 5, 9];
const COOLING_STATUS_SLOT = 18;
const WATER_SLOT = 10;
const WATER_DISPLAY_SLOT = 11;
const CRYOFLUID_SLOT = 12;
const CRYOFLUID_DISPLAY_SLOT = 13;
const TITANIUM_SLOT = 19;
const STABILIZER_OUTPUT_SLOT = 14;
const FREEZER_GRID_SLOTS = [6, 7, 8, 15, 16, 17, 24, 25, 26];
const GENERATOR_STATUS_SLOT = 20;
const GUIDE_SLOT = 23;

const MODULE_LABELS = {
    stabilizer: 'Cryo Stabilizer',
    cooling: 'Cooling Chamber',
    generator: 'Cryofluid Generator'
};

const MODULE_CONFIG = {
    stabilizer: {
        key: 'stabilizer',
        label: MODULE_LABELS.stabilizer,
        statusSlot: STABILIZER_STATUS_SLOT,
        inputSlot: STABILIZER_INPUT_SLOT,
        outputSlot: STABILIZER_OUTPUT_SLOT,
        progressSlot: STABILIZER_PROGRESS_SLOT,
        indicatorType: 'arrow_right'
    },
    cooling: {
        key: 'cooling',
        label: MODULE_LABELS.cooling,
        statusSlot: COOLING_STATUS_SLOT,
        gridSlots: FREEZER_GRID_SLOTS
    },
    generator: {
        key: 'generator',
        label: MODULE_LABELS.generator,
        statusSlot: GENERATOR_STATUS_SLOT,
        inputSlot: TITANIUM_SLOT
    }
};

const COLORS = {
    red: '§c',
    green: '§a',
    darkGreen: '§2',
    yellow: '§e',
    blue: '§b',
    cyan: '§3',
    gray: '§7',
    white: '§f'
};

const DEFAULT_TANK_CAPACITY = 64000;

function resolveTankCapacity(settings) {
    const configured = Number(settings?.machine?.fluid_cap);
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }
    return DEFAULT_TANK_CAPACITY;
}

function ensureTankSetup(tank, defaultType, cap) {
    if (!tank) return tank;
    if (cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap);
    }
    if (defaultType && tank.getType() === 'empty') {
        tank.setType(defaultType);
    }
    return tank;
}

function getCryoChamberTanks(machine, settings) {
    if (!machine?.entity) return [null, null];
    const [waterTank, cryofluidTank] = FluidManager.initializeMultiple(machine.entity, 2);
    const cap = resolveTankCapacity(settings);
    return [
        ensureTankSetup(waterTank, 'water', cap),
        ensureTankSetup(cryofluidTank, 'cryofluid', cap)
    ];
}
DoriosAPI.register.blockComponent('cryo_chamber', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.displayEnergy();
            machine.blockSlots([WATER_DISPLAY_SLOT, CRYOFLUID_DISPLAY_SLOT, GUIDE_SLOT]);

            // Initialize dual fluid tanks
            const [waterTank, cryofluidTank] = getCryoChamberTanks(machine, settings);
            waterTank.display(WATER_DISPLAY_SLOT);
            cryofluidTank.display(CRYOFLUID_DISPLAY_SLOT);
            updateOperationGuide(machine);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        // Initialize tanks
        const [waterTank, cryofluidTank] = getCryoChamberTanks(machine, settings);

        // Handle item transfers
        if (tickGate(machine.entity, 'cryo:items_cd', 4)) {
            machine.transferItems();
        }

        // Handle fluid transfers
        if (tickGate(machine.entity, 'cryo:fluids_cd', 4)) {
            const configuredRate = Number(settings?.machine?.fluid_rate);
            const fluidRate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 100;

            waterTank.transferFluids(block, fluidRate, {
                relative: 'back',
                requireTube: false
            });
            cryofluidTank.transferFluids(block, fluidRate, {
                relative: 'front',
                requireTube: false
            });
            feedFluidSlot(machine, waterTank, WATER_SLOT);
            extractFluidSlot(machine, cryofluidTank, CRYOFLUID_SLOT);
        }

        const tankBundle = { water: waterTank, cryofluid: cryofluidTank };
        const statuses = [];
        statuses.push(processStabilizer(machine, tankBundle, settings));
        statuses.push(processCooling(machine, settings, tankBundle));
        statuses.push(processGenerator(machine, waterTank, cryofluidTank, settings));

        // Update displays
        waterTank.display(WATER_DISPLAY_SLOT);
        cryofluidTank.display(CRYOFLUID_DISPLAY_SLOT);
        machine.displayEnergy();
        updateMachineStatus(machine, statuses, waterTank, cryofluidTank);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

/**
 * Process Cryo Stabilizer mode.
 * Stabilizes volatile materials using cryofluid.
 */
function processStabilizer(machine, tanks, settings) {
    const recipes = getCryoChamberRecipes().stabilization;
    return processItemRecipe(machine, tanks, recipes, settings, MODULE_CONFIG.stabilizer);
}

/**
 * Process Cooling Chamber mode.
 * Cools items and food to cold variants using energy only.
 */
function processCooling(machine, settings, tanks) {
    const recipes = getCryoChamberRecipes().cooling;
    const slotSummaries = MODULE_CONFIG.cooling.gridSlots.map(slot =>
        processCoolingSlot(machine, settings, recipes, slot, tanks)
    );

    const summary = summarizeCoolingSlots(slotSummaries);
    return createModuleStatus(MODULE_CONFIG.cooling.key, MODULE_CONFIG.cooling.label, summary.state, summary.message);
}

/**
 * Shared logic for processing item-based recipes.
 */
function processItemRecipe(machine, tanks, recipes, settings, moduleConfig) {
    const { key, label, inputSlot, outputSlot, progressSlot, indicatorType = 'arrow_right' } = moduleConfig;
    let activeIndicator = indicatorType;

    const fail = (message, state = 'waiting', resetProgress = true) => {
        if (resetProgress) {
            setModuleProgress(machine, key, 0);
        }
        displayModuleProgress(machine, key, progressSlot, activeIndicator);
        return createModuleStatus(key, label, state, message);
    };

    if (machine.energy.get() <= 0) {
        return fail('No Energy', 'waiting', false);
    }

    const inputStack = machine.inv.getItem(inputSlot);
    if (!inputStack) {
        return fail('Insert Item');
    }

    const match = matchRecipeForStack(recipes, inputStack);
    if (!match) {
        return fail('Invalid Item', 'error');
    }

    const { recipe, variant } = match;
    activeIndicator = getRecipeIndicator(recipe, indicatorType);

    const fluidCtx = resolveFluidRequirement(recipe, tanks, { amountMultiplier: 1 });
    if (fluidCtx && !fluidCtx.ok) {
        return fail(fluidCtx.message ?? 'Need Fluid');
    }

    const outputStack = machine.inv.getItem(outputSlot);
    if (outputStack && outputStack.typeId !== recipe.output.id) {
        return fail('Output Blocked', 'error');
    }

    const outputSpace = (outputStack?.maxAmount ?? 64) - (outputStack?.amount ?? 0);
    if (outputSpace < recipe.output.amount) {
        return fail('Output Full');
    }

    const energyCost = recipe.energyCost ?? settings.machine.energy_cost;
    setModuleEnergyCost(machine, key, energyCost);
    const progress = getModuleProgress(machine, key);
    const context = buildRecipeMessageContext(recipe, variant, fluidCtx);

    if (progress >= energyCost) {
        machine.entity.changeItemAmount(inputSlot, -variant.amount);
        if (fluidCtx?.amount > 0 && fluidCtx.tank) {
            fluidCtx.tank.consume(fluidCtx.amount);
        }
        addItemToSlot(machine, outputSlot, recipe.output.id, recipe.output.amount);
        setModuleProgress(machine, key, 0);
        displayModuleProgress(machine, key, progressSlot, activeIndicator);
        const completionMessage = formatRecipeMessage(
            recipe.ui?.completionMessage,
            context,
            `Output +${recipe.output.amount} ${formatItemName(recipe.output.id)}`
        );
        return createModuleStatus(key, label, 'processing', completionMessage);
    }

    const consumption = machine.boosts.consumption;
    const needed = energyCost - progress;
    const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption);

    if (spendable > 0) {
        machine.energy.consume(spendable);
        const gained = spendable / Math.max(consumption, Number.EPSILON);
        addModuleProgress(machine, key, gained);
        displayModuleProgress(machine, key, progressSlot, activeIndicator);
        const processingMessage = formatRecipeMessage(
            recipe.ui?.processingMessage,
            context,
            `Processing ${formatItemName(recipe.output.id)}`
        );
        return createModuleStatus(key, label, 'processing', processingMessage);
    }

    displayModuleProgress(machine, key, progressSlot, activeIndicator);
    return createModuleStatus(key, label, 'waiting', 'Need Energy');
}

function processCoolingSlot(machine, settings, recipes, slot, tanks) {
    const moduleKey = moduleSlotKey(MODULE_CONFIG.cooling.key, slot);
    const tag = formatCoolingSlotTag(slot);

    const fail = (message, state = 'waiting', resetProgress = true) => {
        if (resetProgress) {
            setModuleProgress(machine, moduleKey, 0);
        }
        return { slot, state, message: `${tag}: ${message}` };
    };

    if (machine.energy.get() <= 0) {
        return fail('No Energy', 'waiting', false);
    }

    const stack = machine.inv.getItem(slot);
    if (!stack || stack.amount <= 0) {
        return fail('Empty');
    }

    const match = matchRecipeForStack(recipes, stack);
    if (!match) {
        const alreadyCooled = recipes.some(r => r.output.id === stack.typeId);
        if (alreadyCooled) {
            setModuleProgress(machine, moduleKey, 0);
            return { slot, state: 'waiting', message: `${tag}: Ready` };
        }
        return fail('Invalid Item', 'error');
    }

    const { recipe, variant } = match;

    const inputPerBatch = variant.amount ?? 1;
    const outputPerBatch = recipe.output.amount ?? 1;

    if (stack.amount % inputPerBatch !== 0) {
        return fail(`Need multiples of ${inputPerBatch}`, 'error', false);
    }

    const batchCount = Math.max(1, Math.floor(stack.amount / inputPerBatch));
    const sampleOutput = new ItemStack(recipe.output.id, outputPerBatch);
    const maxPerSlot = sampleOutput.maxAmount ?? 64;
    const maxBatchesPerSlot = Math.max(1, Math.floor(maxPerSlot / outputPerBatch));

    if (batchCount > maxBatchesPerSlot) {
        return fail('Result stack too large', 'error', false);
    }

    const fluidCtx = resolveFluidRequirement(recipe, tanks, { amountMultiplier: batchCount });
    if (fluidCtx && !fluidCtx.ok) {
        return fail(fluidCtx.message ?? 'Need Fluid');
    }

    const energyPerBatch = recipe.energyCost ?? settings.machine.energy_cost;
    const energyCost = energyPerBatch * batchCount;
    setModuleEnergyCost(machine, moduleKey, energyCost);
    const progress = getModuleProgress(machine, moduleKey);

    if (progress >= energyCost) {
        const outputAmount = outputPerBatch * batchCount;
        machine.inv.setItem(slot, new ItemStack(recipe.output.id, outputAmount));
        if (fluidCtx?.amount > 0 && fluidCtx.tank) {
            fluidCtx.tank.consume(fluidCtx.amount);
        }
        setModuleProgress(machine, moduleKey, 0);
        const context = buildRecipeMessageContext(recipe, variant, fluidCtx);
        const completionLabel = formatRecipeMessage(
            recipe.ui?.completionMessage,
            context,
            formatItemName(recipe.output.id)
        );
        return { slot, state: 'processing', message: `${tag}: ${completionLabel}` };
    }

    const consumption = machine.boosts.consumption;
    const needed = energyCost - progress;
    const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption);

    if (spendable > 0) {
        machine.energy.consume(spendable);
        addModuleProgress(machine, moduleKey, spendable / Math.max(consumption, Number.EPSILON));
        const context = buildRecipeMessageContext(recipe, variant, fluidCtx);
        const processingLabel = formatRecipeMessage(
            recipe.ui?.processingMessage,
            context,
            formatItemName(recipe.output.id)
        );
        return { slot, state: 'processing', message: `${tag}: ${processingLabel}` };
    }

    return fail('Need Energy', 'waiting', false);
}

function summarizeCoolingSlots(slotSummaries) {
    const counts = { processing: 0, waiting: 0, error: 0 };
    const alerts = [];

    for (const summary of slotSummaries) {
        if (!summary) continue;
        counts[summary.state] = (counts[summary.state] ?? 0) + 1;
        if (summary.state === 'error' && alerts.length < 2) {
            alerts.push(summary.message);
        }
    }

    const parts = [];
    if (counts.processing) parts.push(`${counts.processing} active`);
    if (counts.waiting) parts.push(`${counts.waiting} idle`);
    if (counts.error) parts.push(`${counts.error} blocked`);
    if (alerts.length) parts.push(alerts.join(' | '));

    const state = counts.processing > 0 ? 'processing' : (counts.error > 0 ? 'error' : 'waiting');
    return { state, message: parts.join(', ') || 'Idle' };
}

/**
 * Process Cryofluid Generator mode.
 * Converts water to cryofluid.
 */
function processGenerator(machine, waterTank, cryofluidTank, settings) {
    const config = getCryofluidGenerationConfig();
    const module = MODULE_CONFIG.generator;
    const key = module.key;
    const catalysts = resolveGeneratorCatalysts(config);
    const maxProcessPerTick = Math.max(1, config.maxProcessPerTick ?? 1000);
    const speedMultiplier = Math.max(1, machine.boosts.speed ?? 1);
    const minWaterRequired = Math.max(1, config.minInput ?? 100);
    const minCryoSpace = Math.max(1, config.minOutput ?? 50);
    const catalystSlot = module.inputSlot;
    const catalystStack = typeof catalystSlot === 'number' ? machine.inv.getItem(catalystSlot) : undefined;
    let catalystItemsNeeded = 0;
    let activeCatalyst = null;
    let activeCatalystLabel = '';
    let itemsPerProcess = 0;
    let waterPerItem = 0;
    let cryoPerItem = 0;
    const baseConversionRate = Math.max(0, Number(config.conversionRate) || 0);

    const fail = (message, state = 'waiting', resetProgress = true) => {
        if (resetProgress) {
            setModuleProgress(machine, key, 0);
        }
        displayModuleProgress(machine, key, module.progressSlot, module.indicatorType);
        return createModuleStatus(key, module.label, state, message);
    };

    if (machine.energy.get() <= 0) {
        return fail('No Energy', 'waiting', false);
    }

    const waterAvailable = waterTank.get();
    if (waterAvailable < minWaterRequired) {
        return fail('Need Water');
    }

    const cryofluidSpace = cryofluidTank.getFreeSpace();
    if (cryofluidSpace < minCryoSpace) {
        return fail('Cryofluid Full');
    }

    let processAmount = Math.min(Math.floor(maxProcessPerTick * speedMultiplier), waterAvailable);

    if (catalysts.length) {
        if (!catalystStack) {
            return fail(`Insert Titanium`);
        }

        activeCatalyst = catalysts.find(entry => entry.itemId === catalystStack.typeId) ?? null;
        if (!activeCatalyst) {
            return fail(`Insert Titanium`);
        }

        activeCatalystLabel = activeCatalyst.label ?? formatItemName(activeCatalyst.itemId);

        itemsPerProcess = Math.max(1, activeCatalyst.itemsPerProcess);
        waterPerItem = Math.max(1, activeCatalyst.waterPerItem);
        cryoPerItem = Math.max(0, activeCatalyst.cryoPerItem ?? Math.floor(waterPerItem * baseConversionRate));
        const availableCycles = Math.floor((catalystStack.amount ?? 0) / itemsPerProcess);
        if (availableCycles <= 0) {
            return fail(`Need ${activeCatalystLabel}`);
        }

        const maxWaterFromCatalyst = availableCycles * waterPerItem;
        processAmount = Math.min(processAmount, maxWaterFromCatalyst);

        if (processAmount < minWaterRequired) {
            return fail(`Need ${activeCatalystLabel}`);
        }
        catalystItemsNeeded = Math.max(
            itemsPerProcess,
            Math.ceil(processAmount / waterPerItem) * itemsPerProcess
        );

        if ((catalystStack.amount ?? 0) < catalystItemsNeeded) {
            return fail(`Need ${activeCatalystLabel}`);
        }
    }

    if (processAmount <= 0) {
        return fail('Need Water');
    }

    const conversionPerWater = activeCatalyst
        ? (waterPerItem > 0 ? (cryoPerItem / waterPerItem) : 0)
        : baseConversionRate;

    if (conversionPerWater > 0) {
        const maxBySpace = Math.floor(cryofluidSpace / conversionPerWater);
        processAmount = Math.min(processAmount, maxBySpace);
    }

    if (processAmount <= 0 || conversionPerWater <= 0) {
        return fail('Cryofluid Full');
    }

    if (activeCatalyst) {
        const cyclesNeeded = Math.max(1, Math.ceil(processAmount / waterPerItem));
        catalystItemsNeeded = Math.max(itemsPerProcess, cyclesNeeded * itemsPerProcess);
        if ((catalystStack.amount ?? 0) < catalystItemsNeeded) {
            return fail(`Need ${activeCatalystLabel}`);
        }
    }

    let potentialOutput = Math.floor(processAmount * conversionPerWater);
    const outputAmount = Math.min(potentialOutput, cryofluidSpace);
    if (outputAmount <= 0) {
        return fail('Cryofluid Full');
    }

    const energyCost = Math.max(1, Math.floor((processAmount / 1000) * config.energyCostPer1000mB));
    setModuleEnergyCost(machine, key, energyCost);
    const progress = getModuleProgress(machine, key);

    if (progress >= energyCost) {
        waterTank.consume(processAmount);
        cryofluidTank.add(outputAmount);
        if (catalystItemsNeeded > 0 && typeof catalystSlot === 'number') {
            machine.entity.changeItemAmount(catalystSlot, -catalystItemsNeeded);
        }
        setModuleProgress(machine, key, 0);
        displayModuleProgress(machine, key, module.progressSlot, module.indicatorType);
        const suffix = catalystItemsNeeded > 0
            ? ` (${activeCatalystLabel || 'Catalyst'} -${catalystItemsNeeded})`
            : '';
        return createModuleStatus(key, module.label, 'processing', `+${FluidManager.formatFluid(outputAmount)}${suffix}`);
    }

    const consumption = machine.boosts.consumption;
    const needed = energyCost - progress;
    const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption);

    if (spendable > 0) {
        machine.energy.consume(spendable);
        const gained = spendable / Math.max(consumption, Number.EPSILON);
        addModuleProgress(machine, key, gained);
        displayModuleProgress(machine, key, module.progressSlot, module.indicatorType);
        const suffix = catalystItemsNeeded > 0
            ? ` (${activeCatalystLabel || 'Catalyst'} ${catalystItemsNeeded})`
            : '';
        return createModuleStatus(key, module.label, 'processing', `Converting ${FluidManager.formatFluid(processAmount)}${suffix}`);
    }

    displayModuleProgress(machine, key, module.progressSlot, module.indicatorType);
    return createModuleStatus(key, module.label, 'waiting', 'Need Energy');
}

/**
 * Updates the layout guide slot to remind players of each module.
 */
function updateOperationGuide(machine) {
    const item = new ItemStack('utilitycraft:arrow_indicator_90', 1);
    item.nameTag = [
        '§rCryo Chamber Layout',
        '§7All modules run simultaneously',
        '',
        '§9Left: Cryofluid Generator (Water + Titanium)',
        '§bCenter: Cryo Stabilizer',
        '§aRight Grid: Cooling Chamber (3x3)'
    ].join('\n');
    machine.inv.setItem(GUIDE_SLOT, item);
}

function tickGate(entity, key, interval) {
    const cd = Number(entity.getDynamicProperty(key)) || 0;
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1);
        return false;
    }
    entity.setDynamicProperty(key, interval);
    return true;
}

function moduleSlotKey(moduleKey, slot) {
    return `${moduleKey}:${slot}`;
}

function formatCoolingSlotTag(slot) {
    const index = FREEZER_GRID_SLOTS.indexOf(slot);
    if (index === -1) {
        return `Slot ${slot}`;
    }
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    return `R${row}C${col}`;
}

const STATUS_COLORS = {
    processing: COLORS.darkGreen,
    waiting: COLORS.yellow,
    error: COLORS.red
};

function setModuleProgress(machine, key, value) {
    machine.entity.setDynamicProperty(`cryo:${key}:progress`, Math.max(0, Number(value) || 0));
}

function addModuleProgress(machine, key, delta) {
    if (!delta) return;
    const current = getModuleProgress(machine, key);
    setModuleProgress(machine, key, current + delta);
}

function getModuleProgress(machine, key) {
    return Number(machine.entity.getDynamicProperty(`cryo:${key}:progress`)) || 0;
}

function setModuleEnergyCost(machine, key, value) {
    machine.entity.setDynamicProperty(`cryo:${key}:energy_cost`, Math.max(1, Number(value) || 1));
}

function getModuleEnergyCost(machine, key, fallback = 1) {
    return Number(machine.entity.getDynamicProperty(`cryo:${key}:energy_cost`)) || fallback;
}

function displayModuleProgress(machine, key, slot, indicatorType = 'arrow_right') {
    if (typeof slot !== 'number') return;
    const cost = getModuleEnergyCost(machine, key, 1);
    const progress = getModuleProgress(machine, key);
    const normalized = cost > 0 ? Math.min(16, Math.floor((progress / cost) * 16)) : 0;
    const itemId = `utilitycraft:${indicatorType}_${normalized}`;
    machine.inv.setItem(slot, new ItemStack(itemId, 1));
}

function createModuleStatus(key, label, state, message) {
    return { key, label, state, message };
}

function updateMachineStatus(machine, statuses, waterTank, cryofluidTank) {
    const map = Object.create(null);
    for (const status of statuses ?? []) {
        if (!status?.key) continue;
        map[status.key] = status;
    }

    const anyProcessing = Object.values(map).some(status => status.state === 'processing');
    if (anyProcessing) {
        machine.on();
    } else {
        machine.off();
    }

    renderModuleStatus(machine, MODULE_CONFIG.stabilizer, map.stabilizer);
    renderModuleStatus(machine, MODULE_CONFIG.cooling, map.cooling);
    renderModuleStatus(machine, MODULE_CONFIG.generator, map.generator, waterTank, cryofluidTank);
}

function renderModuleStatus(machine, moduleConfig, status, waterTank, cryofluidTank) {
    if (!moduleConfig) return;
    const slot = moduleConfig.statusSlot;
    if (typeof slot !== 'number') return;

    const color = STATUS_COLORS[status?.state] ?? COLORS.gray;
    const label = moduleConfig.label;
    const message = status?.message ?? 'Idle';
    const lines = [`§r${color}${label}`, `§r${COLORS.white}${message}`];

    if (moduleConfig.key === MODULE_CONFIG.generator.key) {
        const waterAmount = FluidManager.formatFluid(waterTank?.get() ?? 0);
        const cryoAmount = FluidManager.formatFluid(cryofluidTank?.get() ?? 0);
        const efficiency = ((1 / machine.boosts.consumption) * 100).toFixed(0);
        const rateText = Energy.formatEnergyToText(Math.floor(machine.baseRate));
        lines.push('');
        lines.push(`§r${COLORS.gray}Water ${waterAmount}`);
        lines.push(`§r${COLORS.cyan}Cryo ${cryoAmount}`);
        lines.push(`§r${COLORS.green}Speed x${machine.boosts.speed.toFixed(2)}`);
        lines.push(`§r${COLORS.green}Eff ${efficiency}%`);
        lines.push(`§r${COLORS.red}Rate ${rateText}/t`);
        if (typeof moduleConfig.inputSlot === 'number') {
            const catalystStack = machine.inv.getItem(moduleConfig.inputSlot);
            const catalystLabel = catalystStack ? formatItemName(catalystStack.typeId) : 'Titanium';
            lines.push(`§r${COLORS.white}${catalystLabel} x${catalystStack?.amount ?? 0}`);
        }
    }

    machine.setLabel({ rawText: lines.join('\n') }, slot);
}

function formatItemName(itemId) {
    if (typeof itemId !== 'string' || itemId.length === 0) {
        return 'item';
    }
    const base = itemId.split(':').pop() ?? itemId;
    return base
        .split('_')
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

/**
 * Feed fluid from item slot into tank.
 */
function feedFluidSlot(machine, tank, slot) {
    const item = machine.inv.getItem(slot);
    if (!item) return;

    const containerData = FluidManager.getContainerData(item.typeId);
    if (!containerData) return;

    // Check if tank type matches or is empty
    const tankType = tank.getType();
    if (tankType !== 'empty' && tankType !== containerData.type) return;

    // Check if tank has space
    const space = tank.getFreeSpace();
    if (space < containerData.amount) return;

    // Transfer fluid
    if (tankType === 'empty') tank.setType(containerData.type);
    tank.add(containerData.amount);

    // Replace with empty container
    if (containerData.output) {
        machine.inv.setItem(slot, new ItemStack(containerData.output, 1));
    } else {
        machine.entity.changeItemAmount(slot, -1);
    }
}

/**
 * Extract fluid from tank into capsules.
 */
function extractFluidSlot(machine, tank, slot) {
    const item = machine.inv.getItem(slot);
    if (!item) return;

    const fillDef = FluidManager.getFluidFillDefinition(item.typeId);
    if (!fillDef) return;

    const tankType = tank.getType();
    if (!fillDef.fills[tankType]) return;

    // Check if tank has enough fluid
    const available = tank.get();
    if (available < fillDef.amount) return;

    // Consume fluid and give filled capsule
    tank.consume(fillDef.amount);
    machine.inv.setItem(slot, new ItemStack(fillDef.fills[tankType], 1));
}

/**
 * Adds items to a slot, stacking if possible.
 */
function addItemToSlot(machine, slot, itemId, amount) {
    const existing = machine.inv.getItem(slot);
    if (existing && existing.typeId === itemId) {
        const newAmount = Math.min(existing.maxAmount, existing.amount + amount);
        existing.amount = newAmount;
        machine.inv.setItem(slot, existing);
    } else if (!existing) {
        machine.inv.setItem(slot, new ItemStack(itemId, amount));
    }
}

function resolveGeneratorCatalysts(config) {
    if (!config) {
        return [];
    }
    const entries = [];
    if (config.catalyst) entries.push(config.catalyst);
    if (Array.isArray(config.catalysts)) entries.push(...config.catalysts);
    const normalized = [];
    for (const entry of entries) {
        const normalizedEntry = normalizeGeneratorCatalyst(entry);
        if (normalizedEntry) {
            normalized.push(normalizedEntry);
        }
    }
    return normalized;
}

function normalizeGeneratorCatalyst(entry) {
    if (!entry || typeof entry.itemId !== 'string') {
        return null;
    }
    const itemsPerProcess = Math.max(1, Number(entry.itemsPerProcess) || 1);
    const waterPerItem = Math.max(1, Number(entry.waterPerItem) || 1);
    const cryoPerItem = entry.cryoPerItem !== undefined
        ? Math.max(0, Number(entry.cryoPerItem) || 0)
        : undefined;
    const label = typeof entry.label === 'string' && entry.label.trim().length > 0
        ? entry.label.trim()
        : undefined;
    return {
        itemId: entry.itemId,
        label,
        itemsPerProcess,
        waterPerItem,
        cryoPerItem
    };
}

function formatCatalystOptionsLabel(catalysts) {
    if (!Array.isArray(catalysts) || catalysts.length === 0) {
        return 'Catalyst';
    }
    const names = catalysts.map(entry => entry.label ?? formatItemName(entry.itemId));
    return names.length === 1 ? names[0] : names.join(' / ');
}

const TEMPLATE_TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function matchRecipeForStack(recipes, stack) {
    if (!Array.isArray(recipes) || !stack) return null;
    for (const recipe of recipes) {
        const variant = findMatchingInputVariant(recipe, stack);
        if (variant) {
            return { recipe, variant };
        }
    }
    return null;
}

function findMatchingInputVariant(recipe, stack) {
    if (!recipe?.inputs?.length || !stack) return null;
    for (const candidate of recipe.inputs) {
        if (candidate.id === stack.typeId && stack.amount >= candidate.amount) {
            return candidate;
        }
    }
    return null;
}

function resolveFluidRequirement(recipe, tanks, options = {}) {
    const amountMultiplier = Math.max(1, Number(options.amountMultiplier) || 1);
    const fluidOptions = recipe?.fluids?.length
        ? recipe.fluids
        : (recipe?.fluid ? [recipe.fluid] : []);

    if (!fluidOptions.length) {
        return null;
    }

    for (const requirement of fluidOptions) {
        const tank = selectTankForFluid(requirement, tanks);
        if (!tank) continue;
        const requiredAmount = requirement.amount * amountMultiplier;
        const tankType = tank.getType();
        if (tankType !== 'empty' && tankType !== requirement.type) continue;
        if (tank.get() >= requiredAmount) {
            return {
                requirement,
                tank,
                amount: requiredAmount,
                ok: true,
                label: requirement.label ?? formatFluidLabel(requirement.type)
            };
        }
    }

    const fallbackRequirement = fluidOptions[0];
    const label = fallbackRequirement?.label ?? formatFluidLabel(fallbackRequirement?.type);
    return {
        requirement: fallbackRequirement,
        tank: selectTankForFluid(fallbackRequirement, tanks),
        amount: (fallbackRequirement?.amount ?? 0) * amountMultiplier,
        ok: false,
        label,
        message: label ? `Need ${label}` : 'Need Fluid'
    };
}

function selectTankForFluid(requirement, tanks) {
    if (!requirement || !tanks) return null;
    const source = (requirement.source ?? (requirement.type === 'water' ? 'water' : 'cryofluid')).toLowerCase();
    if (source === 'water') {
        return tanks.water ?? null;
    }
    return tanks.cryofluid ?? null;
}

function formatFluidLabel(type) {
    if (typeof type !== 'string' || type.length === 0) {
        return 'Fluid';
    }
    return type
        .split('_')
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

function buildRecipeMessageContext(recipe, variant, fluidCtx) {
    const inputName = formatItemName(variant?.id ?? recipe?.input?.id ?? recipe?.output?.id ?? 'item');
    const outputName = formatItemName(recipe?.output?.id ?? 'item');
    const fallbackFluidLabel = recipe?.fluids?.[0]?.label ?? formatFluidLabel(recipe?.fluids?.[0]?.type);
    return {
        input: inputName,
        inputAmount: variant?.amount ?? recipe?.input?.amount ?? 1,
        output: outputName,
        outputAmount: recipe?.output?.amount ?? 1,
        energyCost: recipe?.energyCost ?? 0,
        fluid: fluidCtx?.label ?? fallbackFluidLabel ?? '',
        fluidAmount: fluidCtx?.amount ?? recipe?.fluids?.[0]?.amount ?? 0,
        category: recipe?.category ?? 'cooling'
    };
}

function formatRecipeMessage(template, context, fallback) {
    if (typeof template !== 'string' || template.length === 0) {
        return fallback;
    }

    const safeContext = context ?? {};
    return template.replace(TEMPLATE_TOKEN_PATTERN, (_, token) => {
        const key = token.trim();
        const value = safeContext[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

function getRecipeIndicator(recipe, fallback) {
    if (recipe?.indicatorType) {
        return recipe.indicatorType;
    }
    if (recipe?.ui?.indicator) {
        return recipe.ui.indicator;
    }
    return fallback;
}

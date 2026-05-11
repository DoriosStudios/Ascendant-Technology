import { ItemStack } from '@minecraft/server';
import {
    Machine,
    FluidManager,
    Energy,
    buildOverclockLoreLine,
    applyDynamicRecipeRate,
    tickGate,
    formatItemName
} from '../../../DoriosCore/main.js';
import { getCryoChamberRecipes } from '../../../config/recipes/cryo_chamber.js';
import { shouldRefreshSuperiorUi } from './utils.js';

const CRYO_STABILIZER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        progress: 2,
        input: 3,
        output: 4,
        cryofluidInput: 5,
        cryofluidDisplay: 6,
        guide: 7,
        upgrades: Object.freeze([8, 9, 10])
    }),
    defaults: Object.freeze({
        energyCost: 4000,
        fluidCap: 64000,
        fluidRate: 64000,
        progressIndicator: 'arrow_right',
        guideItem: 'utilitycraft:arrow_indicator_90'
    })
});

const PROGRESS_PROPERTY = 'cryo_stabilizer:progress';
const ENERGY_COST_PROPERTY = 'cryo_stabilizer:energy_cost';

DoriosAPI.register.blockComponent('cryo_stabilizer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity || !machine?.inv) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? CRYO_STABILIZER.defaults.energyCost);
            machine.displayEnergy(CRYO_STABILIZER.slots.energy);
            machine.blockSlots([
                CRYO_STABILIZER.slots.cryofluidDisplay,
                CRYO_STABILIZER.slots.guide
            ]);

            const tank = getCryofluidTank(machine, settings);
            tank.display(CRYO_STABILIZER.slots.cryofluidDisplay);
            setProgress(machine, 0);
            setStoredEnergyCost(machine, settings?.machine?.energy_cost ?? CRYO_STABILIZER.defaults.energyCost);
            displayProgress(machine, true);
            updateGuide(machine);
            renderStatus(machine, {
                color: '§e',
                header: 'Idle',
                message: 'Insert an unstable item',
                inputName: '—',
                outputName: '—',
                energyCost: settings?.machine?.energy_cost ?? CRYO_STABILIZER.defaults.energyCost,
                fluidCost: 0,
                progressRatio: 0
            }, tank, true);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;

        const tank = getCryofluidTank(machine, settings);
        const recipes = getCryoChamberRecipes().stabilization;
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'cryo_stabilizer:ui');

        if (tickGate(machine.entity, 'cryo_stabilizer:item_io', 4)) {
            machine.transferItems();
        }

        if (tickGate(machine.entity, 'cryo_stabilizer:fluid_io', 4)) {
            const configuredRate = Number(settings?.machine?.fluid_rate);
            const fluidRate = Number.isFinite(configuredRate) && configuredRate > 0
                ? configuredRate
                : CRYO_STABILIZER.defaults.fluidRate;

            tank.transferFluids(machine.block, fluidRate, {
                relative: 'back',
                requireTube: false
            });
            feedFluidSlot(machine, tank, CRYO_STABILIZER.slots.cryofluidInput);
        }

        const status = processCryoStabilizer(machine, tank, recipes, settings);

        if (shouldRefreshUi) {
            tank.display(CRYO_STABILIZER.slots.cryofluidDisplay);
            machine.displayEnergy(CRYO_STABILIZER.slots.energy);
            displayProgress(machine, true);
            renderStatus(machine, status, tank, true);
        }

        if (status.active) {
            machine.on();
        } else {
            machine.off();
        }
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function getCryofluidTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : CRYO_STABILIZER.defaults.fluidCap;

    if (tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    if (tank.getType() === 'empty' && tank.get() <= 0) {
        tank.setType('cryofluid');
    }

    return tank;
}

function processCryoStabilizer(machine, tank, recipes, settings) {
    const energyCostFallback = settings?.machine?.energy_cost ?? CRYO_STABILIZER.defaults.energyCost;
    const inputStack = machine.inv.getItem(CRYO_STABILIZER.slots.input);
    const outputStack = machine.inv.getItem(CRYO_STABILIZER.slots.output);

    const fail = (header, message, options = {}) => {
        if (options.resetProgress !== false) {
            setProgress(machine, 0);
        }

        setStoredEnergyCost(machine, options.energyCost ?? energyCostFallback);
        return {
            active: false,
            color: options.color ?? '§e',
            header,
            message,
            inputName: inputStack?.typeId ? formatItemName(inputStack.typeId) : '—',
            outputName: options.outputName ?? (outputStack?.typeId ? formatItemName(outputStack.typeId) : '—'),
            energyCost: options.energyCost ?? energyCostFallback,
            fluidCost: options.fluidCost ?? 0,
            progressRatio: getProgressRatio(machine)
        };
    };

    if (machine.energy.get() <= 0 && getProgress(machine) <= 0) {
        return fail('No Energy', 'Charge the machine', {
            color: '§c',
            resetProgress: false
        });
    }

    if (!inputStack) {
        return fail('Waiting Input', 'Insert an unstable item');
    }

    const match = matchRecipeForStack(recipes, inputStack);
    if (!match) {
        return fail('Invalid Item', 'No stabilization recipe found', {
            color: '§c'
        });
    }

    const { recipe, variant } = match;
    const fluidRequirement = resolveFluidRequirement(recipe, tank);
    const nextEnergyCost = recipe.energyCost ?? energyCostFallback;
    setStoredEnergyCost(machine, nextEnergyCost);

    const outputName = formatItemName(recipe.output.id);
    const inputName = formatItemName(variant.id);

    if (!fluidRequirement.ok) {
        return fail('Need Cryofluid', fluidRequirement.message, {
            color: '§b',
            energyCost: nextEnergyCost,
            fluidCost: fluidRequirement.amount,
            outputName,
            resetProgress: false
        });
    }

    if (outputStack && outputStack.typeId !== recipe.output.id) {
        return fail('Output Blocked', 'Output slot contains another item', {
            color: '§c',
            energyCost: nextEnergyCost,
            fluidCost: fluidRequirement.amount,
            outputName,
            resetProgress: false
        });
    }

    const maxOutputAmount = outputStack?.maxAmount ?? 64;
    const outputSpace = maxOutputAmount - (outputStack?.amount ?? 0);
    if (outputSpace < recipe.output.amount) {
        return fail('Output Full', 'Move the stabilized output', {
            color: '§e',
            energyCost: nextEnergyCost,
            fluidCost: fluidRequirement.amount,
            outputName,
            resetProgress: false
        });
    }

    const progress = getProgress(machine);
    if (progress >= nextEnergyCost) {
        machine.entity.changeItemAmount(CRYO_STABILIZER.slots.input, -variant.amount);
        tank.consume(fluidRequirement.amount);
        addItemToSlot(machine, CRYO_STABILIZER.slots.output, recipe.output.id, recipe.output.amount);
        setProgress(machine, 0);

        return {
            active: true,
            color: '§2',
            header: 'Stabilized',
            message: `${outputName} ready`,
            inputName,
            outputName,
            energyCost: nextEnergyCost,
            fluidCost: fluidRequirement.amount,
            progressRatio: 0
        };
    }

    const consumption = Math.max(1, machine.boosts?.consumption ?? 1);
    const needed = nextEnergyCost - progress;
    const rate = resolveSpendRate(machine, recipe, settings, nextEnergyCost);
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption);

    if (spendable > 0) {
        machine.energy.consume(spendable);
        const gained = spendable / Math.max(consumption, Number.EPSILON);
        setProgress(machine, progress + gained);

        return {
            active: true,
            color: '§a',
            header: 'Stabilizing',
            message: `${inputName} -> ${outputName}`,
            inputName,
            outputName,
            energyCost: nextEnergyCost,
            fluidCost: fluidRequirement.amount,
            progressRatio: getProgressRatio(machine)
        };
    }

    return {
        active: false,
        color: '§e',
        header: 'Standby',
        message: 'Stored charge is waiting for more energy',
        inputName,
        outputName,
        energyCost: nextEnergyCost,
        fluidCost: fluidRequirement.amount,
        progressRatio: getProgressRatio(machine)
    };
}

function renderStatus(machine, status, tank, refreshUi = true) {
    if (!refreshUi) return;

    const tankAmount = FluidManager.formatFluid(tank?.get() ?? 0);
    const tankCap = FluidManager.formatFluid(tank?.getCap() ?? 0);
    const lore = [
        `${status.color}${status.header}`,
        `§7Status: §f${status.message}`,
        `§7Cryofluid: §f${tankAmount} §7/ §f${tankCap}`,
        `§7Input: §f${status.inputName}`,
        `§7Output: §f${status.outputName}`,
        `§7Energy Cost: §f${Energy.formatEnergyToText(status.energyCost)}`,
        `§7Cryofluid Cost: §f${FluidManager.formatFluid(status.fluidCost)}`,
        `§7Progress: §f${Math.round((status.progressRatio ?? 0) * 100)}%`,
        `§7Speed: §f${(machine.boosts?.speed ?? 1).toFixed(2)}x`,
        `§7Efficiency: §f${((1 / Math.max(machine.boosts?.consumption ?? 1, Number.EPSILON)) * 100).toFixed(0)}%`
    ];

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) {
        lore.push(overclockLine.replace(/^§r/, ''));
    }

    machine.setLabel({
        title: '§bCryo Stabilizer',
        lore
    }, CRYO_STABILIZER.slots.status);
}

function updateGuide(machine) {
    const guide = new ItemStack(CRYO_STABILIZER.defaults.guideItem, 1);
    guide.nameTag = [
        '§rCryo Stabilizer',
        '§7Dedicated cryogenic stabilization branch',
        '',
        '§bInput: unstable item',
        '§9Tank: Cryofluid',
        '§aOutput: stabilized result'
    ].join('\n');
    machine.inv.setItem(CRYO_STABILIZER.slots.guide, guide);
}

function getProgress(machine) {
    return Number(machine.entity.getDynamicProperty(PROGRESS_PROPERTY)) || 0;
}

function setProgress(machine, value) {
    machine.entity.setDynamicProperty(PROGRESS_PROPERTY, Math.max(0, Number(value) || 0));
}

function setStoredEnergyCost(machine, value) {
    machine.entity.setDynamicProperty(ENERGY_COST_PROPERTY, Math.max(1, Number(value) || 1));
}

function getStoredEnergyCost(machine) {
    return Number(machine.entity.getDynamicProperty(ENERGY_COST_PROPERTY)) || 1;
}

function getProgressRatio(machine) {
    const energyCost = Math.max(1, getStoredEnergyCost(machine));
    return Math.max(0, Math.min(1, getProgress(machine) / energyCost));
}

function displayProgress(machine, refreshUi = true) {
    if (!refreshUi) return;

    const frame = Math.max(0, Math.min(16, Math.floor(getProgressRatio(machine) * 16)));
    const itemId = `utilitycraft:${CRYO_STABILIZER.defaults.progressIndicator}_${frame}`;
    machine.inv.setItem(CRYO_STABILIZER.slots.progress, new ItemStack(itemId, 1));
}

function matchRecipeForStack(recipes, stack) {
    if (!Array.isArray(recipes) || !stack?.typeId) return null;

    for (const recipe of recipes) {
        const variant = findMatchingInputVariant(recipe, stack);
        if (variant) {
            return { recipe, variant };
        }
    }

    return null;
}

function findMatchingInputVariant(recipe, stack) {
    if (!recipe?.inputs?.length || !stack?.typeId) return null;

    for (const variant of recipe.inputs) {
        if (variant.id === stack.typeId && stack.amount >= variant.amount) {
            return variant;
        }
    }

    return null;
}

function resolveFluidRequirement(recipe, tank) {
    const requirement = recipe?.fluids?.[0] ?? recipe?.fluid;
    if (!requirement) {
        return {
            ok: true,
            amount: 0,
            message: ''
        };
    }

    const requiredAmount = Math.max(0, Number(requirement.amount) || 0);
    const tankType = tank?.getType?.() ?? 'empty';
    const validType = tankType === 'empty' || tankType === requirement.type;
    const currentAmount = tank?.get?.() ?? 0;

    if (!validType || currentAmount < requiredAmount) {
        return {
            ok: false,
            amount: requiredAmount,
            message: `Need ${requirement.label ?? 'Cryofluid'}`
        };
    }

    return {
        ok: true,
        amount: requiredAmount,
        message: ''
    };
}

function feedFluidSlot(machine, tank, slot) {
    const item = machine.inv.getItem(slot);
    if (!item?.typeId) return;

    const containerData = FluidManager.getContainerData(item.typeId);
    if (!containerData || containerData.type !== 'cryofluid') return;

    const tankType = tank.getType();
    if (tankType !== 'empty' && tankType !== containerData.type) return;

    if (tank.getFreeSpace() < containerData.amount) return;

    if (tankType === 'empty') {
        tank.setType(containerData.type);
    }

    tank.add(containerData.amount);

    if (containerData.output) {
        machine.inv.setItem(slot, undefined);
        machine.dim.spawnItem(new ItemStack(containerData.output, 1), {
            x: machine.block.location.x + 0.5,
            y: machine.block.location.y + 1,
            z: machine.block.location.z + 0.5
        });
        return;
    }

    machine.entity.changeItemAmount(slot, -1);
}

function addItemToSlot(machine, slot, itemId, amount) {
    const existing = machine.inv.getItem(slot);
    if (existing?.typeId === itemId) {
        const nextAmount = Math.min(existing.maxAmount ?? 64, (existing.amount ?? 0) + amount);
        existing.amount = nextAmount;
        machine.inv.setItem(slot, existing);
        return;
    }

    if (!existing) {
        machine.inv.setItem(slot, new ItemStack(itemId, amount));
    }
}

function resolveRecipeSecondsForDynamicRate(recipe) {
    if (!recipe || typeof recipe !== 'object') return null;

    const candidates = [
        recipe.timeSeconds,
        recipe.seconds,
        recipe.processingTimeSeconds
    ];

    for (const candidate of candidates) {
        const seconds = Number(candidate);
        if (Number.isFinite(seconds) && seconds > 0) {
            return seconds;
        }
    }

    return null;
}

function resolveSpendRate(machine, recipe, settings, energyCost) {
    const defaultRate = Number.isFinite(machine.processingRate) && machine.processingRate > 0
        ? machine.processingRate
        : machine.rate;

    if (settings?.machine?.dynamic_rate !== true) {
        return defaultRate;
    }

    const recipeSeconds = resolveRecipeSecondsForDynamicRate(recipe);
    if (!recipeSeconds) {
        return defaultRate;
    }

    const originalBaseRate = machine.baseRate;
    const originalRate = machine.rate;
    const originalProcessingRate = machine.processingRate;

    const applied = applyDynamicRecipeRate(
        machine,
        {
            ...recipe,
            timeSeconds: recipeSeconds
        },
        {
            energyCost,
            speedMultiplier: machine.boosts?.speed ?? 1,
            consumptionMultiplier: machine.boosts?.consumption ?? 1
        }
    );

    const derivedRate = applied && Number.isFinite(machine.processingRate) && machine.processingRate > 0
        ? machine.processingRate
        : defaultRate;

    machine.baseRate = originalBaseRate;
    machine.rate = originalRate;
    machine.processingRate = originalProcessingRate;

    return derivedRate;
}

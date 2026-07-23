import { ItemStack } from '@minecraft/server';
import {
    Machine,
    FluidManager,
    Energy,
    applyDynamicRecipeRate,
    tickGate,
    formatItemName
} from '../../../DoriosCore/main.js';
import { getCryoChamberRecipes } from '../../../config/recipes/cryo_chamber.js';
import { shouldRefreshSuperiorUi } from './utils.js';

const CRYO_FREEZER = Object.freeze({
    slots: Object.freeze({
        energy: 0,
        status: 1,
        tankDisplay: 2,
        freezerGrid: Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
    }),
    defaults: Object.freeze({
        energyCost: 4000,
        fluidCap: 64000,
        fluidRate: 64000
    }),
    ui: Object.freeze({
        templateTokenPattern: /\{\{\s*(\w+)\s*\}\}/g
    })
});

DoriosAPI.register.blockComponent('cryo_freezer', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity || !machine?.inv) return;

            machine.setEnergyCost(settings?.machine?.energy_cost ?? CRYO_FREEZER.defaults.energyCost);
            machine.displayEnergy(CRYO_FREEZER.slots.energy);
            machine.blockSlots([
                CRYO_FREEZER.slots.status,
                CRYO_FREEZER.slots.tankDisplay
            ]);

            const tank = getFreezerTank(machine, settings);
            tank.display(CRYO_FREEZER.slots.tankDisplay);
            renderStatus(machine, createIdleStatus(), tank, true);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const machine = new Machine(e.block, settings);
        if (!machine.valid || !machine.entity || !machine.inv) return;

        const tank = getFreezerTank(machine, settings);
        const shouldRefreshUi = shouldRefreshSuperiorUi(machine, 'cryo_freezer:ui');

        if (tickGate(machine.entity, 'cryo_freezer:fluid_io', 4)) {
            const configuredRate = Number(settings?.machine?.fluid_rate);
            const fluidRate = Number.isFinite(configuredRate) && configuredRate > 0
                ? configuredRate
                : CRYO_FREEZER.defaults.fluidRate;

            tank.transferFluids(machine.block, fluidRate, {
                relative: 'back',
                requireTube: false
            });
        }

        const status = processCryoFreezer(machine, tank, settings);

        if (shouldRefreshUi) {
            tank.display(CRYO_FREEZER.slots.tankDisplay);
            machine.displayEnergy(CRYO_FREEZER.slots.energy);
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

function createIdleStatus() {
    return {
        active: false,
        color: '§e',
        header: 'Idle',
        message: 'Load the freezing grid',
        activeCount: 0,
        idleCount: CRYO_FREEZER.slots.freezerGrid.length,
        blockedCount: 0,
        highlights: ['Uses one shared tank for Water and Cryofluid recipes']
    };
}

function getFreezerTank(machine, settings) {
    const tank = FluidManager.initializeSingle(machine.entity);
    const configuredCap = Number(settings?.machine?.fluid_cap);
    const cap = Number.isFinite(configuredCap) && configuredCap > 0
        ? configuredCap
        : CRYO_FREEZER.defaults.fluidCap;

    if (cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap);
    }

    return tank;
}

function processCryoFreezer(machine, tank, settings) {
    const recipes = getCryoChamberRecipes().cooling;
    const slotSummaries = CRYO_FREEZER.slots.freezerGrid.map(slot =>
        processFreezerSlot(machine, settings, recipes, slot, tank)
    );

    return summarizeFreezerSlots(slotSummaries);
}

function processFreezerSlot(machine, settings, recipes, slot, tank) {
    const tag = formatFreezerSlotTag(slot);

    const fail = (message, state = 'waiting', resetProgress = true) => {
        if (resetProgress) {
            setLaneProgress(machine, slot, 0);
        }

        return {
            slot,
            state,
            message: `${tag}: ${message}`
        };
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
        const alreadyCooled = recipes.some(recipe => recipe.output.id === stack.typeId);
        if (alreadyCooled) {
            setLaneProgress(machine, slot, 0);
            return {
                slot,
                state: 'waiting',
                message: `${tag}: Ready`
            };
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

    const fluidCtx = resolveFluidRequirement(recipe, tank, { amountMultiplier: batchCount });
    if (fluidCtx && !fluidCtx.ok) {
        return fail(fluidCtx.message ?? 'Need Fluid');
    }

    const energyPerBatch = recipe.energyCost ?? settings?.machine?.energy_cost ?? CRYO_FREEZER.defaults.energyCost;
    const energyCost = energyPerBatch * batchCount;
    setLaneEnergyCost(machine, slot, energyCost);
    const progress = getLaneProgress(machine, slot);

    if (progress >= energyCost) {
        const outputAmount = outputPerBatch * batchCount;
        machine.inv.setItem(slot, new ItemStack(recipe.output.id, outputAmount));
        if (fluidCtx?.amount > 0 && fluidCtx.tank) {
            fluidCtx.tank.consume(fluidCtx.amount);
        }
        setLaneProgress(machine, slot, 0);

        const context = buildRecipeMessageContext(recipe, variant, fluidCtx);
        const completionLabel = formatRecipeMessage(
            recipe.ui?.completionMessage,
            context,
            formatItemName(recipe.output.id)
        );

        return {
            slot,
            state: 'processing',
            message: `${tag}: ${completionLabel}`
        };
    }

    const consumption = Math.max(1, machine.boosts?.consumption ?? 1);
    const needed = energyCost - progress;
    const rate = resolveSpendRate(machine, recipe, settings, energyCost, { timeMultiplier: batchCount });
    const spendable = Math.min(machine.energy.get(), rate, needed * consumption);

    if (spendable > 0) {
        machine.energy.consume(spendable);
        addLaneProgress(machine, slot, spendable / Math.max(consumption, Number.EPSILON));

        const context = buildRecipeMessageContext(recipe, variant, fluidCtx);
        const processingLabel = formatRecipeMessage(
            recipe.ui?.processingMessage,
            context,
            formatItemName(recipe.output.id)
        );

        return {
            slot,
            state: 'processing',
            message: `${tag}: ${processingLabel}`
        };
    }

    return fail('Need Energy', 'waiting', false);
}

function summarizeFreezerSlots(slotSummaries) {
    const counts = { processing: 0, waiting: 0, error: 0 };
    const alerts = [];
    const activeMessages = [];

    for (const summary of slotSummaries) {
        if (!summary) continue;
        counts[summary.state] = (counts[summary.state] ?? 0) + 1;

        if (summary.state === 'error' && alerts.length < 2) {
            alerts.push(summary.message);
        } else if (summary.state === 'processing' && activeMessages.length < 2) {
            activeMessages.push(summary.message);
        }
    }

    const messageParts = [];
    if (counts.processing) messageParts.push(`${counts.processing} active`);
    if (counts.waiting) messageParts.push(`${counts.waiting} idle`);
    if (counts.error) messageParts.push(`${counts.error} blocked`);

    return {
        active: counts.processing > 0,
        color: counts.processing > 0 ? '§a' : (counts.error > 0 ? '§c' : '§e'),
        header: counts.processing > 0 ? 'Freezing' : (counts.error > 0 ? 'Blocked' : 'Idle'),
        message: messageParts.join(', ') || 'Idle',
        activeCount: counts.processing,
        idleCount: counts.waiting,
        blockedCount: counts.error,
        highlights: alerts.length ? alerts : activeMessages
    };
}

function renderStatus(machine, status, tank, refreshUi = true) {
    if (!refreshUi) return;

    const tankType = tank?.getType?.() ?? 'empty';
    const tankLabel = tankType === 'empty' ? 'Empty' : formatFluidLabel(tankType);

    const lore = [
        `${status.color}${status.header}`,
        `§7Grid: §f${status.message}`,
        `§7Energy: §f${Energy.formatEnergyToText(machine.energy.get())} §7/ §f${Energy.formatEnergyToText(machine.energy.getCap())}`,
        `§7Coolant: §f${FluidManager.formatFluid(tank?.get() ?? 0)} §7/ §f${FluidManager.formatFluid(tank?.getCap() ?? 0)}`,
        `§7Fluid Type: §f${tankLabel}`,
        `§7Active Lanes: §f${status.activeCount}`,
        `§7Blocked Lanes: §f${status.blockedCount}`
    ];

    if (status.highlights?.length) {
        lore.push('§7Highlights:');
        for (const entry of status.highlights.slice(0, 2)) {
            lore.push(`§8- §f${entry}`);
        }
    }

    machine.setLabel({
        title: '§bCryo Freezer',
        lore
    }, CRYO_FREEZER.slots.status);
}

function formatFreezerSlotTag(slot) {
    const index = CRYO_FREEZER.slots.freezerGrid.indexOf(slot);
    if (index === -1) {
        return `Slot ${slot}`;
    }

    const row = Math.floor(index / 5) + 1;
    const col = (index % 5) + 1;
    return `R${row}C${col}`;
}

function getLaneProgress(machine, slot) {
    return Number(machine.entity.getDynamicProperty(`cryo_freezer:${slot}:progress`)) || 0;
}

function setLaneProgress(machine, slot, value) {
    machine.entity.setDynamicProperty(`cryo_freezer:${slot}:progress`, Math.max(0, Number(value) || 0));
}

function addLaneProgress(machine, slot, delta) {
    if (!delta) return;
    setLaneProgress(machine, slot, getLaneProgress(machine, slot) + delta);
}

function setLaneEnergyCost(machine, slot, value) {
    machine.entity.setDynamicProperty(`cryo_freezer:${slot}:energy_cost`, Math.max(1, Number(value) || 1));
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

function resolveFluidRequirement(recipe, tank, options = {}) {
    const amountMultiplier = Math.max(1, Number(options.amountMultiplier) || 1);
    const fluidOptions = recipe?.fluids?.length
        ? recipe.fluids
        : (recipe?.fluid ? [recipe.fluid] : []);

    if (!fluidOptions.length) {
        return null;
    }

    for (const requirement of fluidOptions) {
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
        tank,
        amount: (fallbackRequirement?.amount ?? 0) * amountMultiplier,
        ok: false,
        label,
        message: label ? `Need ${label}` : 'Need Fluid'
    };
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
    return template.replace(CRYO_FREEZER.ui.templateTokenPattern, (_, token) => {
        const key = token.trim();
        const value = safeContext[key];
        return value === undefined || value === null ? '' : String(value);
    });
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

function resolveSpendRate(machine, recipe, settings, energyCost, options = {}) {
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

    const multiplier = Math.max(1, Number(options.timeMultiplier) || 1);
    const targetSeconds = Math.max(Number.EPSILON, recipeSeconds * multiplier);
    const originalBaseRate = machine.baseRate;
    const originalRate = machine.rate;
    const originalProcessingRate = machine.processingRate;

    const applied = applyDynamicRecipeRate(
        machine,
        {
            ...recipe,
            timeSeconds: targetSeconds
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


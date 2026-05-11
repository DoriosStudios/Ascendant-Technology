import {
    Machine,
    Energy,
    FluidManager,
    updatePipes,
    canFluidNodeProvide,
    isFluidNodeEnabled,
    fluidNodeMatchesType,
    buildOverclockLoreLine,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate,
    feedFluidSlot,
    fillFluidSlot,
    formatFluidDisplayName,
    resolveCachedLocationList,
    buildDualTankMachineState,
    buildStateSignature,
    shouldRefreshMachineUi,
    resetMachineRuntimeState,
    resolveMachineRecipes,
    findRecipeByFluidInputType,
    hasRecipes,
    listRecipes
} from '../../DoriosCore/main.js';
import {
    getVaporworksProcessorRecipes,
    getVaporworksProcessorInputRate
} from '../../config/recipes/vaporworks_processor.js';

const FLUID_INPUT_SLOT = 3;
const INPUT_DISPLAY_SLOT = 10;
const OUTPUT_DISPLAY_SLOT = 11;
const FLUID_OUTPUT_SLOT = 19;
const STATUS_SLOT = 1;

const DEFAULT_FLUID_CAP = 64000;
const UI_REFRESH_INTERVAL = 4;

const FLUID_IO_OPTIONS = Object.freeze({
    interval: 4,
    idleBackoffTicks: 8,
    stallBackoffTicks: 12,
    failureEscalationThreshold: 2,
    drasticBackoffTicks: 48
});

/*
Slots (inventory_size: 20)
- [0] Default energy HUD slot (`machine.displayEnergy`).
- [1] Status arrow slot.
- [3] Fluid input slot.
- [4, 5, 6] Upgrade slots from `settings.machine.upgrades`.
- [10] Input tank display slot.
- [11] Output tank display slot.
- [19] Fluid output slot.
- Hidden slots: [7, 8, 9, 12, 13, 14, 15, 16, 17, 18].
*/

DoriosAPI.register.blockComponent('vaporworks_processor', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings.machine.energy_cost ?? 2400);
            machine.displayProgress();
            machine.displayEnergy();
            machine.blockSlots([INPUT_DISPLAY_SLOT, OUTPUT_DISPLAY_SLOT]);

            const [tankInput, tankOutput] = getVaporworksTanks(machine, getMachineFluidCap(settings));
            tankInput.display(INPUT_DISPLAY_SLOT);
            tankOutput.display(OUTPUT_DISPLAY_SLOT);

            machine.entity.setItem(STATUS_SLOT, 'utilitycraft:arrow_indicator_90', 1, '');
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const [tankInput, tankOutput] = getVaporworksTanks(machine, getMachineFluidCap(settings));
        const recipes = resolveMachineRecipes(block, settings, 'vaporworks_processor', getVaporworksProcessorRecipes());
        const inputRate = getInputRate(settings, recipes);

        runAdaptiveTickGate(
            machine.entity,
            'vaporworks:fluid_io',
            FLUID_IO_OPTIONS,
            () => {
                const availableOutput = tankOutput.get();
                const freeInput = tankInput.getFreeSpace();
                if (availableOutput <= 0 && freeInput <= 0) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                const nodes = resolveCachedLocationList(
                    machine.entity,
                    'dorios:fluid_nodes',
                    block.location,
                    () => updatePipes(block, 'fluid')
                );
                let moved = false;

                if (availableOutput > 0) {
                    const beforeOutput = availableOutput;

                    // Direct adjacent push
                    tankOutput.transferFluids(block, availableOutput, { useFacing: true });

                    // Network push
                    if (nodes.length) {
                        const remainingOutput = tankOutput.get();
                        if (remainingOutput > 0) {
                            tankOutput.transferToNetwork(remainingOutput, 'nearest', nodes);
                        }
                    }

                    moved = tankOutput.get() < beforeOutput;
                }

                if (freeInput > 0 && nodes.length) {
                    const beforeInput = tankInput.get();
                    pullFluidFromNetwork(machine, block, tankInput, recipes, nodes, inputRate);
                    moved = tankInput.get() > beforeInput || moved;
                }

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        // Handle fluid input slot (capsule draining)
        feedFluidSlot(machine, tankInput, FLUID_INPUT_SLOT);

        // Handle fluid output slot (capsule filling)
        fillFluidSlot(machine, tankOutput, FLUID_OUTPUT_SLOT);

        const refreshDisplays = () => {
            tankInput.display(INPUT_DISPLAY_SLOT);
            tankOutput.display(OUTPUT_DISPLAY_SLOT);
            machine.displayEnergy();
            machine.displayProgress();
        };

        let state = buildDualTankMachineState(machine, tankInput, tankOutput);

        const fail = (message, reset = true) => {
            resetMachineRuntimeState(machine, reset);
            state = buildDualTankMachineState(machine, tankInput, tankOutput);

            const signature = buildStateSignature([
                'warning',
                message,
                state.energy,
                state.energyCost,
                state.progress,
                state.input.type,
                state.input.amount,
                state.input.cap,
                state.output.type,
                state.output.amount,
                state.output.cap
            ]);

            if (!shouldRefreshMachineUi(machine.entity, 'vaporworks:ui', signature, UI_REFRESH_INTERVAL)) {
                return;
            }

            machine.showWarning(message, false);
            refreshDisplays();
        };

        if (!hasRecipes(recipes)) {
            fail('No Recipes');
            return;
        }

        if (state.input.type === 'empty' || state.input.amount <= 0) {
            fail('Insert Fluid');
            return;
        }

        const recipe = findRecipeByFluidInputType(recipes, state.input.type);
        if (!recipe) {
            fail('Invalid Fluid');
            return;
        }

        const outputFluidType = recipe.outputFluid.type;
        if (state.output.type !== 'empty' && state.output.type !== outputFluidType) {
            fail(`Wrong Output\n§7Need ${formatFluidDisplayName(outputFluidType)}`);
            return;
        }

        const yieldBoost = Math.max(1, machine.boosts.overclockYield ?? 1);
        const inputPerCraft = Math.max(1, recipe.inputFluid.amount ?? 1000);
        const outputPerCraft = Math.max(1, recipe.outputFluid.amount ?? 500);
        const maxCrafts = Math.min(
            Math.floor(state.input.amount / inputPerCraft),
            Math.floor(state.output.free / (outputPerCraft * yieldBoost))
        );

        if (maxCrafts <= 0) {
            fail(state.input.amount < inputPerCraft ? 'Missing Fluid' : 'Output Tank Full');
            return;
        }

        const configuredCost = recipe.energyCost ?? settings?.machine?.energy_cost ?? 2400;
        machine.setEnergyCost(configuredCost);
        state = buildDualTankMachineState(machine, tankInput, tankOutput);

        if (state.energy <= 0) {
            fail('No Energy', false);
            return;
        }

        if (state.progress >= state.energyCost) {
            const craftRuns = Math.min(maxCrafts, Math.floor(state.progress / state.energyCost));
            if (craftRuns > 0) {
                tankInput.consume(inputPerCraft * craftRuns);

                if (tankOutput.getType() === 'empty') {
                    tankOutput.setType(outputFluidType);
                }

                tankOutput.add(Math.floor(outputPerCraft * craftRuns * yieldBoost));
                machine.addProgress(-(craftRuns * state.energyCost));
            }
        } else {
            const consumption = machine.boosts.consumption;
            const needed = state.energyCost - state.progress;
            const spendable = Math.min(state.energy, machine.rate, needed * consumption);
            if (spendable > 0) {
                machine.energy.consume(spendable);
                machine.addProgress(spendable / Math.max(consumption, Number.EPSILON));
            }
        }

        state = buildDualTankMachineState(machine, tankInput, tankOutput);
        const queuedCrafts = Math.min(
            Math.floor(state.input.amount / inputPerCraft),
            Math.floor(state.output.free / (outputPerCraft * yieldBoost))
        );
        const signature = buildStateSignature([
            'running',
            recipe.id ?? outputFluidType,
            state.energy,
            state.energyCost,
            state.progress,
            state.input.type,
            state.input.amount,
            state.input.cap,
            state.output.type,
            state.output.amount,
            state.output.cap,
            queuedCrafts
        ]);

        if (shouldRefreshMachineUi(machine.entity, 'vaporworks:ui', signature, UI_REFRESH_INTERVAL)) {
            updateHud(machine, recipe, state, queuedCrafts);
            refreshDisplays();
        }

        machine.on();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function toPositiveInt(value, fallback = 0) {
    const normalized = Math.floor(Number(value));
    return normalized > 0 ? normalized : fallback;
}

function getMachineFluidCap(settings) {
    return toPositiveInt(settings?.machine?.fluid_cap, DEFAULT_FLUID_CAP);
}

function getInputRate(settings, recipes) {
    const configuredRate = toPositiveInt(settings?.machine?.fluid_rate, 0);
    if (configuredRate > 0) {
        return configuredRate;
    }

    let fallbackRate = getVaporworksProcessorInputRate();
    for (const recipe of listRecipes(recipes)) {
        fallbackRate = Math.max(fallbackRate, toPositiveInt(recipe?.inputFluid?.amount, 0));
    }

    return fallbackRate;
}

function pullFluidFromNetwork(machine, block, tank, recipes, fluidNodes = [], maxPull = getVaporworksProcessorInputRate()) {
    if (!machine?.entity || !tank || !block) return;

    const freeSpace = tank.getFreeSpace();
    if (freeSpace <= 0) return;

    if (!hasRecipes(recipes)) return;

    const currentType = tank.getType();
    const acceptsType = currentType === 'empty'
        ? (type) => Boolean(findRecipeByFluidInputType(recipes, type))
        : (type) => type === currentType;

    const transferLimit = Math.min(freeSpace, maxPull);
    if (transferLimit <= 0) return;

    const nodes = Array.isArray(fluidNodes) ? fluidNodes : [];

    if (!Array.isArray(nodes) || nodes.length === 0) return;

    const dim = block.dimension;

    let remaining = transferLimit;

    for (const loc of nodes) {
        if (remaining <= 0) break;
        if (!canFluidNodeProvide(loc)) continue;
        if (!isFluidNodeEnabled(loc)) continue;

        const [sourceEntity] = dim.getEntitiesAtBlockLocation(loc);
        if (!sourceEntity || sourceEntity === machine.entity) continue;
        if (sourceEntity.hasTag?.('dorios:fluid_input_only')) continue;

        const sourceTank = FluidManager.findType(sourceEntity, 0);
        if (!sourceTank || sourceTank.get() <= 0) continue;

        const sourceType = sourceTank.getType();
        if (!sourceType || sourceType === 'empty') continue;
        if (!fluidNodeMatchesType(loc, sourceType)) continue;
        if (!acceptsType(sourceType)) continue;

        const pulled = sourceTank.transferTo(tank, remaining);
        if (pulled > 0) {
            remaining -= pulled;
        }
    }
}

function getVaporworksTanks(machine, fluidCap = DEFAULT_FLUID_CAP) {
    if (!machine?.entity) return [null, null];

    const tanks = FluidManager.initializeMultiple(machine.entity, 2);
    for (const tank of tanks) {
        if (tank?.getCap?.() <= 0) {
            tank?.setCap?.(fluidCap);
        }
    }

    return tanks;
}
function updateHud(machine, recipe, state, queuedCrafts) {
    const inputType = recipe.inputFluid.type;
    const outputType = recipe.outputFluid.type;
    const outputPerCraft = recipe.outputFluid.amount;

    const inputAmount = FluidManager.formatFluid(state.input.amount);
    const inputCap = FluidManager.formatFluid(state.input.cap);
    const outputAmount = FluidManager.formatFluid(state.output.amount);
    const outputCap = FluidManager.formatFluid(state.output.cap);

    const lore = [
        `§bInput: §f${formatFluidDisplayName(inputType)}`,
        `§7In Tank: §f${inputAmount} §7/ §f${inputCap}`,
        `§dFluid Output: §f${formatFluidDisplayName(outputType)}`,
        `§7Out Tank: §f${outputAmount} §7/ §f${outputCap}`,
        `§7Yield: §f${FluidManager.formatFluid(outputPerCraft)} each`,
        `§cCost: §f${Energy.formatEnergyToText(machine.getEnergyCost())}`,
        `§7Queued Crafts: §f${queuedCrafts}`
    ];

    if (recipe.description) {
        lore.push(`§7${recipe.description}`);
    }

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) lore.push(overclockLine);

    machine.setLabel({
        title: '§6Vaporworks Processor',
        lore,
        rawText: undefined
    });
}

import {
    Machine,
    Energy,
    FluidManager,
    updatePipes,
    buildOverclockLoreLine,
    ADAPTIVE_CHECK_RESULT,
    runAdaptiveTickGate,
    feedFluidSlot,
    formatFluidDisplayName
} from '../../DoriosCore/main.js';
import { getVaporworksProcessorRecipes } from '../../config/recipes/vaporworks_processor.js';

const VAPORWORKS = Object.freeze({
    slots: Object.freeze({
        fluidInput: 3,
        inputDisplay: 10,
        outputDisplay: 11,
        fluidOutput: 19,
        status: 1
    }),
    defaults: Object.freeze({
        fluidCap: 64000
    }),
    transfer: Object.freeze({
        fluidAdaptive: Object.freeze({
            interval: 4,
            idleBackoffTicks: 8,
            stallBackoffTicks: 12,
            failureEscalationThreshold: 2,
            drasticBackoffTicks: 48
        })
    })
});

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (STATUS_SLOT).
- [3] Entrada de fluido (FLUID_INPUT_SLOT).
- [4,5,6] Slots de upgrades (de acordo com settings.machine.upgrades).
- [10] Display do tanque de entrada (INPUT_DISPLAY_SLOT) — bloqueado para o jogador.
- [11] Display do tanque de saída (OUTPUT_DISPLAY_SLOT) — bloqueado para o jogador.
- [19] Saída de fluido (FLUID_OUTPUT_SLOT).
Slots escondidos: [7, 8, 9, 12, 13, 14, 15, 16, 17, 18] (preenchimento/UI, não utilizáveis pelo jogador).
*/

DoriosAPI.register.blockComponent('vaporworks_processor', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings.machine.energy_cost ?? 2400);
            machine.displayProgress();
            machine.displayEnergy();
            machine.blockSlots([VAPORWORKS.slots.inputDisplay, VAPORWORKS.slots.outputDisplay]);

            const [tankInput, tankOutput] = getVaporworksTanks(machine, settings);
            tankInput.display(VAPORWORKS.slots.inputDisplay);
            tankOutput.display(VAPORWORKS.slots.outputDisplay);

            machine.entity.setItem(VAPORWORKS.slots.status, 'utilitycraft:arrow_indicator_90', 1, '');
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const [tankInput, tankOutput] = getVaporworksTanks(machine, settings);
        const recipes = resolveRecipes(block, settings);

        runAdaptiveTickGate(
            machine.entity,
            'vaporworks:fluid_io',
            VAPORWORKS.transfer.fluidAdaptive,
            () => {
                const availableOutput = tankOutput.get();
                const freeInput = tankInput.getFreeSpace();
                if (availableOutput <= 0 && freeInput <= 0) {
                    return ADAPTIVE_CHECK_RESULT.idle;
                }

                const nodes = resolveFluidNodes(machine, block);
                let moved = false;

                if (availableOutput > 0) {
                    const beforeOutput = tankOutput.get();

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

                if (freeInput > 0) {
                    const beforeInput = tankInput.get();
                    pullFluidFromNetwork(machine, block, tankInput, recipes, settings, nodes);
                    moved = tankInput.get() > beforeInput || moved;
                }

                return moved
                    ? ADAPTIVE_CHECK_RESULT.moved
                    : ADAPTIVE_CHECK_RESULT.stalled;
            }
        );

        // Handle fluid input slot (capsule draining)
        feedFluidSlot(machine, tankInput, VAPORWORKS.slots.fluidInput);
        
        // Handle fluid output slot (capsule filling)
        fillFluidSlot(machine, tankOutput, VAPORWORKS.slots.fluidOutput);

        const fail = (message, reset = true) => {
            machine.showWarning(message, reset);
            tankInput.display(VAPORWORKS.slots.inputDisplay);
            tankOutput.display(VAPORWORKS.slots.outputDisplay);
        };

        if (!recipes.length) {
            fail('No Recipes');
            return;
        }

        const inputFluidType = tankInput.getType();
        if (inputFluidType === 'empty' || tankInput.get() <= 0) {
            fail('Insert Fluid');
            return;
        }

        const recipe = matchRecipe(recipes, inputFluidType);
        if (!recipe) {
            fail('Invalid Fluid');
            return;
        }

        const outputFluidType = recipe.outputFluid.type;
        const outputTankType = tankOutput.getType();

        if (outputTankType !== 'empty' && outputTankType !== outputFluidType) {
            fail(`Wrong Output\n§7Need ${formatFluidDisplayName(outputFluidType)}`);
            return;
        }

        const crafts = calculateCrafts(machine, tankInput, tankOutput, recipe, machine.boosts.overclockYield ?? 1);
        if (crafts.max <= 0) {
            fail(crafts.reason ?? 'Missing Fluid');
            return;
        }

        machine.setEnergyCost(recipe.energyCost ?? settings.machine.energy_cost ?? 2400);
        const energyAvailable = machine.energy.get();
        if (energyAvailable <= 0) {
            fail('No Energy', false);
            return;
        }

        const energyCost = machine.getEnergyCost();
        const progress = machine.getProgress();

        if (progress >= energyCost) {
            const craftRuns = Math.min(crafts.max, Math.floor(progress / energyCost));
            if (craftRuns > 0) {
                processCraft(machine, recipe, craftRuns, tankInput, tankOutput);
                machine.addProgress(-(craftRuns * energyCost));
            }
        } else {
            const consumption = machine.boosts.consumption;
            const needed = energyCost - progress;
            const spendable = Math.min(machine.energy.get(), machine.rate, needed * consumption);
            if (spendable > 0) {
                machine.energy.consume(spendable);
                machine.addProgress(spendable / Math.max(consumption, Number.EPSILON));
            }
        }

        updateHud(machine, recipe, tankInput, tankOutput, crafts.max);
        tankInput.display(VAPORWORKS.slots.inputDisplay);
        tankOutput.display(VAPORWORKS.slots.outputDisplay);
        machine.displayEnergy();
        machine.displayProgress();
        machine.on();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function resolveFluidCap(settings) {
    const configured = Number(settings?.machine?.fluid_cap);
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }
    return VAPORWORKS.defaults.fluidCap;
}

function resolveInputRate(settings, recipes) {
    const configured = Number(settings?.machine?.fluid_rate);
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }

    const amounts = Array.isArray(recipes)
        ? recipes
            .map(recipe => Number(recipe?.inputFluid?.amount))
            .filter(value => Number.isFinite(value) && value > 0)
        : [];

    if (amounts.length) {
        return Math.max(...amounts);
    }

    return 1000;
}

function getAllowedInputFluidTypes(recipes) {
    const allowed = new Set();
    if (!Array.isArray(recipes)) return allowed;

    for (const recipe of recipes) {
        const type = recipe?.inputFluid?.type;
        if (typeof type === 'string' && type.length > 0) {
            allowed.add(type);
        }
    }

    return allowed;
}

function parseCachedNodes(entity, propertyId = 'dorios:fluid_nodes') {
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
    const nodes = parseCachedNodes(machine?.entity, 'dorios:fluid_nodes');
    if (nodes.length) return nodes;

    updatePipes(block, 'fluid');
    return parseCachedNodes(machine?.entity, 'dorios:fluid_nodes');
}

function pullFluidFromNetwork(machine, block, tank, recipes, settings, fluidNodes = []) {
    if (!machine?.entity || !tank || !block) return;

    const freeSpace = tank.getFreeSpace();
    if (freeSpace <= 0) return;

    const allowedTypes = getAllowedInputFluidTypes(recipes);
    if (!allowedTypes.size) return;

    const currentType = tank.getType();
    if (currentType !== 'empty' && !allowedTypes.has(currentType)) {
        return;
    }

    const desiredTypes = currentType === 'empty' ? allowedTypes : new Set([currentType]);
    const maxPull = Math.min(freeSpace, resolveInputRate(settings, recipes));
    if (maxPull <= 0) return;

    const nodes = Array.isArray(fluidNodes) ? fluidNodes : [];

    if (!Array.isArray(nodes) || nodes.length === 0) return;

    const dim = block.dimension;
    const origin = block.location;
    const orderedTargets = nodes.length > 1
        ? [...nodes].sort((a, b) =>
            DoriosAPI.math.distanceBetween(origin, a) - DoriosAPI.math.distanceBetween(origin, b)
        )
        : nodes;

    let remaining = maxPull;

    for (const loc of orderedTargets) {
        if (remaining <= 0) break;

        const [sourceEntity] = dim.getEntitiesAtBlockLocation(loc);
        if (!sourceEntity || sourceEntity === machine.entity) continue;
        if (sourceEntity.hasTag?.('dorios:fluid_input_only')) continue;

        const sourceTank = FluidManager.findType(sourceEntity, 0);
        if (!sourceTank || sourceTank.get() <= 0) continue;

        const sourceType = sourceTank.getType();
        if (!sourceType || sourceType === 'empty') continue;
        if (!desiredTypes.has(sourceType)) continue;

        const pulled = sourceTank.transferTo(tank, remaining);
        if (pulled > 0) {
            remaining -= pulled;
        }
    }
}

function ensureTankCap(tank, cap) {
    if (!tank) return tank;
    if (Number.isFinite(cap) && cap > 0 && tank.getCap() <= 0) {
        tank.setCap(cap);
    }
    return tank;
}

function getVaporworksTanks(machine, settings) {
    if (!machine?.entity) return [null, null];
    const [tankInput, tankOutput] = FluidManager.initializeMultiple(machine.entity, 2);
    const fluidCap = resolveFluidCap(settings);
    return [ensureTankCap(tankInput, fluidCap), ensureTankCap(tankOutput, fluidCap)];
}

function resolveRecipes(block, settings) {
    const component = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params;
    if (component?.type === 'vaporworks_processor') return getVaporworksProcessorRecipes();
    if (Array.isArray(component)) return component;
    if (settings?.machine?.recipes && Array.isArray(settings.machine.recipes)) {
        return settings.machine.recipes;
    }
    return getVaporworksProcessorRecipes();
}

function matchRecipe(recipes, inputFluidType) {
    return recipes.find(recipe => recipe.inputFluid?.type === inputFluidType);
}

function calculateCrafts(machine, tankInput, tankOutput, recipe, yieldBoost = 1) {
    const inputPerCraft = Math.max(1, recipe.inputFluid.amount ?? 1000);
    const outputPerCraft = Math.max(1, recipe.outputFluid.amount ?? 500);

    const availableInput = Math.floor(tankInput.get() / inputPerCraft);
    const availableOutput = Math.floor(tankOutput.getFreeSpace() / (outputPerCraft * yieldBoost));

    const max = Math.min(availableInput, availableOutput);

    if (max <= 0) {
        if (availableInput <= 0) return { max: 0, reason: 'Missing Fluid' };
        if (availableOutput <= 0) return { max: 0, reason: 'Output Tank Full' };
    }

    return { max };
}

function processCraft(machine, recipe, crafts, tankInput, tankOutput) {
    const inputPerCraft = Math.max(1, recipe.inputFluid.amount ?? 1000);
    const totalInput = inputPerCraft * crafts;
    tankInput.consume(totalInput);

    const yieldBoost = machine.boosts.overclockYield ?? 1;
    const outputFluidType = recipe.outputFluid.type;
    if (tankOutput.getType() === 'empty') tankOutput.setType(outputFluidType);
    
    const outputAmount = recipe.outputFluid.amount * crafts * yieldBoost;
    tankOutput.add(Math.floor(outputAmount));
}

function updateHud(machine, recipe, tankInput, tankOutput, maxCrafts) {
    const inputType = recipe.inputFluid.type;
    const outputType = recipe.outputFluid.type;
    const inputPerCraft = recipe.inputFluid.amount;
    const outputPerCraft = recipe.outputFluid.amount;
    
    const inputAmount = FluidManager.formatFluid(tankInput.get());
    const inputCap = FluidManager.formatFluid(tankInput.getCap());
    const outputAmount = FluidManager.formatFluid(tankOutput.get());
    const outputCap = FluidManager.formatFluid(tankOutput.getCap());
    
    const lore = [
        `§bInput: §f${formatFluidDisplayName(inputType)}`,
        `§7In Tank: §f${inputAmount} §7/ §f${inputCap}`,
        `§dFluid Output: §f${formatFluidDisplayName(outputType)}`,
        `§7Out Tank: §f${outputAmount} §7/ §f${outputCap}`,
        `§7Yield: §f${FluidManager.formatFluid(outputPerCraft)} each`,
        `§cCost: §f${Energy.formatEnergyToText(machine.getEnergyCost())}`,
        `§7Queued Crafts: §f${maxCrafts}`
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

function fillFluidSlot(machine, tank, slotIndex) {
    const slotItem = machine.inv.getItem(slotIndex);
    if (!slotItem) return;

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId);
    if (!fillDefinition) return;

    const result = tank.fluidItem(slotItem.typeId);
    if (result === false) return;

    machine.entity.changeItemAmount(slotIndex, -1);

    if (!result) return;

    const updated = machine.inv.getItem(slotIndex);
    if (!updated) {
        machine.entity.setItem(slotIndex, result, 1);
        return;
    }

    if (updated.typeId === result && updated.amount < updated.maxAmount) {
        machine.entity.changeItemAmount(slotIndex, 1);
    } else {
        machine.entity.addItem(result, 1);
    }
}

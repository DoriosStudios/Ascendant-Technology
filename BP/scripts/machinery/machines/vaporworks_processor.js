import { Machine, Energy, FluidManager, updatePipes, buildOverclockLoreLine } from '../managers_extra.js';
import { getVaporworksProcessorRecipes } from '../../config/recipes/vaporworks_processor.js';

const FLUID_INPUT_SLOT = 3;
const INPUT_DISPLAY_SLOT = 10;
const OUTPUT_DISPLAY_SLOT = 11;
const FLUID_OUTPUT_SLOT = 19;
const STATUS_SLOT = 1;

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [1] Indicador de status/seta (STATUS_SLOT).
- [3] Entrada de fluido (FLUID_INPUT_SLOT).
- [4,5] Slots de upgrades (de acordo com settings.machine.upgrades).
- [10] Display do tanque de entrada (INPUT_DISPLAY_SLOT) — bloqueado para o jogador.
- [11] Display do tanque de saída (OUTPUT_DISPLAY_SLOT) — bloqueado para o jogador.
- [19] Saída de fluido (FLUID_OUTPUT_SLOT).
Slots escondidos: [6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18] (preenchimento/UI, não utilizáveis pelo jogador).
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

            const [tankInput, tankOutput] = FluidManager.initializeMultiple(machine.entity, 2);
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

        const [tankInput, tankOutput] = FluidManager.initializeMultiple(machine.entity, 2);

        if (tickGate(machine.entity, 'vw:fluids_cd', 4)) {
            const available = tankOutput.get();
            if (available > 0) {
                // Ensure network cache exists when we have fluid to send
                let nodes = [];
                try {
                    const cached = machine.entity.getDynamicProperty('dorios:fluid_nodes');
                    if (cached) nodes = JSON.parse(cached);
                } catch { /* ignore */ }

                if (!Array.isArray(nodes) || nodes.length === 0) {
                    updatePipes(block, 'fluid');
                    try {
                        const cached = machine.entity.getDynamicProperty('dorios:fluid_nodes');
                        if (cached) nodes = JSON.parse(cached);
                    } catch { /* ignore */ }
                }

                // Direct adjacent push
                tankOutput.transferFluids(block, available, { useFacing: true });

                // Network push
                if (Array.isArray(nodes) && nodes.length) {
                    tankOutput.transferToNetwork(available, 'nearest', nodes);
                }
            }
        }

        // Handle fluid input slot (capsule draining)
        feedFluidSlot(machine, tankInput, FLUID_INPUT_SLOT);
        
        // Handle fluid output slot (capsule filling)
        fillFluidSlot(machine, tankOutput, FLUID_OUTPUT_SLOT);

        const fail = (message, reset = true) => {
            machine.showWarning(message, reset);
            tankInput.display(INPUT_DISPLAY_SLOT);
            tankOutput.display(OUTPUT_DISPLAY_SLOT);
        };

        const recipes = resolveRecipes(block, settings);
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
        tankInput.display(INPUT_DISPLAY_SLOT);
        tankOutput.display(OUTPUT_DISPLAY_SLOT);
        machine.displayEnergy();
        machine.displayProgress();
        machine.on();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

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

function tickGate(entity, key, interval) {
    const cd = Number(entity.getDynamicProperty(key)) || 0;
    if (cd > 0) {
        entity.setDynamicProperty(key, cd - 1);
        return false;
    }
    entity.setDynamicProperty(key, interval);
    return true;
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
        `§dOutput: §f${formatFluidDisplayName(outputType)}`,
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

function feedFluidSlot(machine, tank, slotIndex) {
    const slotItem = machine.inv.getItem(slotIndex);
    if (!slotItem) return;

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId);
    if (fillDefinition) return;

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

function fillFluidSlot(machine, tank, slotIndex) {
    const slotItem = machine.inv.getItem(slotIndex);
    if (!slotItem) return;

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId);
    if (!fillDefinition) return;

    const result = tank.fillItem(slotItem.typeId);
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

function formatName(id) {
    const [, name = id] = id.split(':');
    return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatFluidDisplayName(type) {
    if (!type || type === 'empty') return 'Empty';
    const pretty = formatName(type);
    return pretty;
}

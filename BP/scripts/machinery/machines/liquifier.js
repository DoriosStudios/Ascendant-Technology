import { Machine, Energy, FluidManager, updatePipes, buildOverclockLoreLine, applyDynamicRecipeRate, tickGate, feedFluidSlot, rollByproduct, clampChance, addItemsToSlot, formatItemName, formatFluidDisplayName } from '../../DoriosCore/main.js';
import { getLiquifierRecipes } from '../../config/recipes/liquifier.js';

const LIQUIFIER = Object.freeze({
    slots: Object.freeze({
        input: 3,
        fluid: 10,
        fluidDisplay: 11,
        residue: 19
    }),
    defaults: Object.freeze({
        fluidType: 'liquified_aetherium'
    })
});

/*
Slots (inventory_size: 20)
- [0] HUD de energia (machine.displayEnergy padrão).
- [3] Input de item (INPUT_SLOT).
- [4,5] Slots de upgrades (de acordo com settings.machine.upgrades).
- [10] Entrada de fluido (FLUID_SLOT).
- [11] Display do tanque (FLUID_DISPLAY_SLOT) — bloqueado para o jogador.
- [19] Saída de resíduo secundário/resultado extra (RESIDUE_SLOT).
Slots escondidos: [6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18] (preenchimento/UI, não utilizáveis pelo jogador).
*/

DoriosAPI.register.blockComponent('liquifier', {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            if (!machine?.entity) return;

            machine.setEnergyCost(settings.machine.energy_cost ?? 2000);
            machine.displayProgress();
            machine.displayEnergy();
            machine.blockSlots([LIQUIFIER.slots.fluidDisplay]);

            const tank = FluidManager.initializeSingle(machine.entity);
            tank.display(LIQUIFIER.slots.fluidDisplay);
        });
    },

    onTick(e, { params: settings }) {
        if (!globalThis.worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        if (tickGate(machine.entity, 'liq:items_cd', 4)) {
            machine.transferItems();
        }

        const tank = FluidManager.initializeSingle(machine.entity);
        if (tickGate(machine.entity, 'liq:fluids_cd', 4)) {
            const available = tank.get();
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

                // Direct adjacent push (respect block facing so the outlet follows orientation)
                tank.transferFluids(block, available, { useFacing: true });

                // Network push (through fluid cables, including reinforced cable)
                if (Array.isArray(nodes) && nodes.length) {
                    tank.transferToNetwork(available, 'nearest', nodes);
                }
            }
        }
        feedFluidSlot(machine, tank, LIQUIFIER.slots.fluid);

        const fail = (message, reset = true) => {
            machine.showWarning(message, reset);
            tank.display(LIQUIFIER.slots.fluidDisplay);
        };

        const recipes = resolveRecipes(block, settings);
        if (!recipes.length) {
            fail('No Recipes');
            return;
        }

        const inputStack = machine.inv.getItem(LIQUIFIER.slots.input);
        if (!inputStack) {
            fail('Insert Item');
            return;
        }

        const recipe = matchRecipe(recipes, inputStack);
        if (!recipe) {
            fail('Invalid Item');
            return;
        }

        const fluidType = recipe.fluid.type ?? LIQUIFIER.defaults.fluidType;
        const tankType = tank.getType();

        if (tankType !== 'empty' && tankType !== fluidType) {
            fail(`Wrong Fluid\n§7Need ${formatFluidDisplayName(fluidType)}`);
            return;
        }

        const byproductSlot = machine.inv.getItem(LIQUIFIER.slots.residue);
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            fail('Residue Slot Busy');
            return;
        }

        const crafts = calculateCrafts(machine, tank, recipe, inputStack, byproductSlot, machine.boosts.overclockYield ?? 1);
        if (crafts.max <= 0) {
            fail(crafts.reason ?? 'Missing Items');
            return;
        }

        const configuredCost = recipe.energyCost ?? settings.machine.energy_cost ?? 2000;
        machine.setEnergyCost(configuredCost);
        if (settings?.machine?.dynamic_rate === true) {
            applyDynamicRecipeRate(machine, recipe, { energyCost: configuredCost });
        }
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
                processCraft(machine, recipe, craftRuns, tank);
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

        updateHud(machine, recipe, tank, crafts.max);
        tank.display(LIQUIFIER.slots.fluidDisplay);
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
    if (component?.type === 'liquifier') return getLiquifierRecipes();
    if (Array.isArray(component)) return component;
    if (settings?.machine?.recipes && Array.isArray(settings.machine.recipes)) {
        return settings.machine.recipes;
    }
    return getLiquifierRecipes();
}

function matchRecipe(recipes, stack) {
    return recipes.find(recipe => recipe.input?.id === stack.typeId);
}

function calculateCrafts(machine, tank, recipe, inputStack, byproductSlot, yieldBoost = 1) {
    const inputAmount = Math.max(1, recipe.input.amount ?? 1);
    const fluidPerCraft = Math.max(1, recipe.fluid.amount ?? 1);

    const availableItems = Math.floor(inputStack.amount / inputAmount);
    const availableFluid = Math.floor(tank.getFreeSpace() / (fluidPerCraft * yieldBoost));

    let residueCapacity = Number.MAX_SAFE_INTEGER;
    if (recipe.byproduct) {
        const residueAmount = Math.max(1, recipe.byproduct.amount ?? 1);
        if (!byproductSlot) {
            residueCapacity = Math.floor((64) / (residueAmount * yieldBoost));
        } else {
            if (byproductSlot.typeId !== recipe.byproduct.id) {
                return { max: 0, reason: 'Residue Slot Busy' };
            }
            const free = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount;
            residueCapacity = Math.floor(free / (residueAmount * yieldBoost));
        }
    }

    const max = Math.min(availableItems, availableFluid, residueCapacity);

    if (max <= 0) {
        if (availableItems <= 0) return { max: 0, reason: 'Missing Items' };
        if (availableFluid <= 0) return { max: 0, reason: 'Tank Full' };
        if (residueCapacity <= 0) return { max: 0, reason: 'Residue Full' };
    }

    return { max };
}

function processCraft(machine, recipe, crafts, tank) {
    const inputPerCraft = Math.max(1, recipe.input.amount ?? 1);
    const totalInput = inputPerCraft * crafts;
    machine.entity.changeItemAmount(LIQUIFIER.slots.input, -totalInput);

    const yieldBoost = machine.boosts.overclockYield ?? 1;
    const fluidType = recipe.fluid.type ?? LIQUIFIER.defaults.fluidType;
    if (tank.getType() === 'empty') tank.setType(fluidType);
    
    // Fluid amounts are already integers in mB, but apply yield boost
    const fluidAmount = recipe.fluid.amount * crafts * yieldBoost;
    tank.add(Math.floor(fluidAmount));

    if (recipe.byproduct) {
        const produced = rollByproduct(recipe.byproduct, crafts);
        if (produced > 0) {
            const byproductRaw = produced * yieldBoost;
            const byproductFinal = machine.addFractionalItem(recipe.byproduct.id, byproductRaw);
            if (byproductFinal > 0) {
                addItemsToSlot(machine, LIQUIFIER.slots.residue, recipe.byproduct.id, byproductFinal);
            }
        }
    }
}

function updateHud(machine, recipe, tank, maxCrafts) {
    const fluidType = recipe.fluid.type ?? LIQUIFIER.defaults.fluidType;
    const fluidPerCraft = recipe.fluid.amount;
    const tankAmount = FluidManager.formatFluid(tank.get());
    const tankCap = FluidManager.formatFluid(tank.getCap());
    const lore = [
        `§bInput: §f${formatItemName(recipe.input.id)}`,
        `§dMelt: §f${formatFluidDisplayName(fluidType)}`,
        `§7Yield: §f${FluidManager.formatFluid(fluidPerCraft)} each`,
        `§7Tank: §f${tankAmount} §7/ §f${tankCap}`,
        `§cCost: §f${Energy.formatEnergyToText(machine.getEnergyCost())}`,
        `§7Queued Crafts: §f${maxCrafts}`
    ];

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) lore.push(overclockLine);

    machine.setLabel({
        title: '§6Flux Crucible',
        lore,
        rawText: undefined
    });
}

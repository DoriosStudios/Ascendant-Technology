import { Machine, Energy, FluidManager, updatePipes, buildOverclockLoreLine, applyDynamicRecipeRate, tickGate, feedFluidSlot, rollByproduct, clampChance, addItemsToSlot, formatItemName, formatFluidDisplayName, findRecipeByInputId, resolveCachedLocationList, buildSingleTankMachineState, buildStateSignature, shouldRefreshMachineUi, resetMachineRuntimeState, resolveMachineRecipes, hasRecipes } from '../../DoriosCore/main.js';
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
                const nodes = resolveCachedLocationList(
                    machine.entity,
                    'dorios:fluid_nodes',
                    block.location,
                    () => updatePipes(block, 'fluid')
                );

                // Direct adjacent push (respect block facing so the outlet follows orientation)
                tank.transferFluids(block, available, { useFacing: true });

                // Network push (through fluid cables, including reinforced cable)
                if (nodes.length) {
                    tank.transferToNetwork(available, 'nearest', nodes);
                }
            }
        }
        feedFluidSlot(machine, tank, LIQUIFIER.slots.fluid);

        let state = buildSingleTankMachineState(machine, tank);

        const refreshDisplay = () => {
            tank.display(LIQUIFIER.slots.fluidDisplay);
            machine.displayEnergy();
            machine.displayProgress();
        };

        const fail = (message, reset = true) => {
            resetMachineRuntimeState(machine, reset);
            state = buildSingleTankMachineState(machine, tank);

            const signature = buildStateSignature([
                'warning',
                message,
                state.energy,
                state.energyCost,
                state.progress,
                state.tank.type,
                state.tank.amount,
                state.tank.cap
            ]);
            if (!shouldRefreshMachineUi(machine.entity, 'liquifier:ui', signature)) {
                return;
            }

            machine.showWarning(message, false);
            refreshDisplay();
        };

        const recipes = resolveMachineRecipes(block, settings, 'liquifier', getLiquifierRecipes());
        if (!hasRecipes(recipes)) {
            fail('No Recipes');
            return;
        }

        const inputStack = machine.inv.getItem(LIQUIFIER.slots.input);
        if (!inputStack) {
            fail('Insert Item');
            return;
        }

        const recipe = findRecipeByInputId(recipes, inputStack.typeId);
        if (!recipe) {
            fail('Invalid Item');
            return;
        }

        const fluidType = recipe.fluid.type ?? LIQUIFIER.defaults.fluidType;
        if (state.tank.type !== 'empty' && state.tank.type !== fluidType) {
            fail(`Wrong Fluid\n§7Need ${formatFluidDisplayName(fluidType)}`);
            return;
        }

        const byproductSlot = machine.inv.getItem(LIQUIFIER.slots.residue);
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            fail('Residue Slot Busy');
            return;
        }

        const yieldBoost = Math.max(1, machine.boosts.overclockYield ?? 1);
        const crafts = calculateCrafts(state, recipe, inputStack, byproductSlot, yieldBoost);
        if (crafts.max <= 0) {
            fail(crafts.reason ?? 'Missing Items');
            return;
        }

        const configuredCost = recipe.energyCost ?? settings?.machine?.energy_cost ?? 2000;
        machine.setEnergyCost(configuredCost);
        if (settings?.machine?.dynamic_rate === true) {
            applyDynamicRecipeRate(machine, recipe, { energyCost: configuredCost });
        }

        state = buildSingleTankMachineState(machine, tank);
        if (state.energy <= 0) {
            fail('No Energy', false);
            return;
        }

        const energyCost = state.energyCost;
        const progress = state.progress;

        if (progress >= energyCost) {
            const craftRuns = Math.min(crafts.max, Math.floor(progress / energyCost));
            if (craftRuns > 0) {
                processCraft(machine, recipe, craftRuns, tank);
                machine.addProgress(-(craftRuns * energyCost));
            }
        } else {
            const consumption = machine.boosts.consumption;
            const needed = energyCost - progress;
            const spendable = Math.min(state.energy, machine.rate, needed * consumption);
            if (spendable > 0) {
                machine.energy.consume(spendable);
                machine.addProgress(spendable / Math.max(consumption, Number.EPSILON));
            }
        }

        state = buildSingleTankMachineState(machine, tank);
        const currentInputStack = machine.inv.getItem(LIQUIFIER.slots.input);
        const currentByproductSlot = machine.inv.getItem(LIQUIFIER.slots.residue);
        const queuedCrafts = calculateCrafts(state, recipe, currentInputStack, currentByproductSlot, yieldBoost);

        const signature = buildStateSignature([
            'running',
            recipe?.input?.id ?? recipe?.fluid?.type ?? 'recipe',
            state.energy,
            state.energyCost,
            state.progress,
            queuedCrafts.max,
            state.tank.type,
            state.tank.amount,
            state.tank.cap
        ]);
        if (shouldRefreshMachineUi(machine.entity, 'liquifier:ui', signature)) {
            updateHud(machine, recipe, state, queuedCrafts.max);
            refreshDisplay();
        }

        machine.on();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

function calculateCrafts(state, recipe, inputStack, byproductSlot, yieldBoost = 1) {
    if (!inputStack) {
        return { max: 0, reason: 'Missing Items' };
    }

    const inputAmount = Math.max(1, recipe.input.amount ?? 1);
    const fluidPerCraft = Math.max(1, recipe.fluid.amount ?? 1);

    const availableItems = Math.floor(inputStack.amount / inputAmount);
    const availableFluid = Math.floor(state.tank.free / (fluidPerCraft * yieldBoost));

    let residueCapacity = Number.MAX_SAFE_INTEGER;
    if (recipe.byproduct) {
        const residueAmount = Math.max(1, recipe.byproduct.amount ?? 1);
        if (!byproductSlot) {
            residueCapacity = Math.floor(64 / (residueAmount * yieldBoost));
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

function updateHud(machine, recipe, state, maxCrafts) {
    const fluidType = recipe.fluid.type ?? LIQUIFIER.defaults.fluidType;
    const fluidPerCraft = recipe.fluid.amount;
    const tankAmount = FluidManager.formatFluid(state.tank.amount);
    const tankCap = FluidManager.formatFluid(state.tank.cap);
    const lore = [
        `§3Input: §f${formatItemName(recipe.input.id)}`,
        `§gProcessed: §f${formatFluidDisplayName(fluidType)}`,
        `§7Yield: §f${FluidManager.formatFluid(fluidPerCraft)} each`,
        `§7Tank: §f${tankAmount} §7/ §f${tankCap}`,
        `§cCost: §f${Energy.formatEnergyToText(machine.getEnergyCost())}`,
        `§7Queued Crafts: §f${maxCrafts}`
    ];

    const overclockLine = buildOverclockLoreLine(machine);
    if (overclockLine) lore.push(overclockLine);

    machine.setLabel({
        title: '§r§6Liquifier',
        lore,
        rawText: undefined
    });
}

import { Machine, Energy, FluidManager } from '../managers_extra.js';
import { getLiquifierRecipes } from '../../config/recipes/liquifier.js';

const INPUT_SLOT = 3;
const FLUID_SLOT = 10;
const FLUID_DISPLAY_SLOT = 11;
const RESIDUE_SLOT = 19;
const DEFAULT_FLUID_TYPE = 'liquified_aetherium';

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
            machine.blockSlots([FLUID_DISPLAY_SLOT]);

            const tank = FluidManager.initializeSingle(machine.entity);
            tank.display(FLUID_DISPLAY_SLOT);
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
            tank.transferFluids(block);
        }
        feedFluidSlot(machine, tank);

        const fail = (message, reset = true) => {
            machine.showWarning(message, reset);
            tank.display(FLUID_DISPLAY_SLOT);
        };

        const recipes = resolveRecipes(block, settings);
        if (!recipes.length) {
            fail('No Recipes');
            return;
        }

        const inputStack = machine.inv.getItem(INPUT_SLOT);
        if (!inputStack) {
            fail('Insert Item');
            return;
        }

        const recipe = matchRecipe(recipes, inputStack);
        if (!recipe) {
            fail('Invalid Item');
            return;
        }

        const fluidType = recipe.fluid.type ?? DEFAULT_FLUID_TYPE;
        const tankType = tank.getType();

        if (tankType !== 'empty' && tankType !== fluidType) {
            fail(`Wrong Fluid\n§7Need ${formatFluidDisplayName(fluidType)}`);
            return;
        }

        const byproductSlot = machine.inv.getItem(RESIDUE_SLOT);
        if (recipe.byproduct && byproductSlot && byproductSlot.typeId !== recipe.byproduct.id) {
            fail('Residue Slot Busy');
            return;
        }

        const crafts = calculateCrafts(machine, tank, recipe, inputStack, byproductSlot);
        if (crafts.max <= 0) {
            fail(crafts.reason ?? 'Missing Items');
            return;
        }

        machine.setEnergyCost(recipe.energyCost ?? settings.machine.energy_cost ?? 2000);
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
        tank.display(FLUID_DISPLAY_SLOT);
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

function calculateCrafts(machine, tank, recipe, inputStack, byproductSlot) {
    const inputAmount = Math.max(1, recipe.input.amount ?? 1);
    const fluidPerCraft = Math.max(1, recipe.fluid.amount ?? 1);

    const availableItems = Math.floor(inputStack.amount / inputAmount);
    const availableFluid = Math.floor(tank.getFreeSpace() / fluidPerCraft);

    let residueCapacity = Number.MAX_SAFE_INTEGER;
    if (recipe.byproduct) {
        const residueAmount = Math.max(1, recipe.byproduct.amount ?? 1);
        if (!byproductSlot) {
            residueCapacity = Math.floor((64) / residueAmount);
        } else {
            if (byproductSlot.typeId !== recipe.byproduct.id) {
                return { max: 0, reason: 'Residue Slot Busy' };
            }
            const free = (byproductSlot.maxAmount ?? 64) - byproductSlot.amount;
            residueCapacity = Math.floor(free / residueAmount);
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
    machine.entity.changeItemAmount(INPUT_SLOT, -totalInput);

    const fluidType = recipe.fluid.type ?? DEFAULT_FLUID_TYPE;
    if (tank.getType() === 'empty') tank.setType(fluidType);
    tank.add(recipe.fluid.amount * crafts);

    if (recipe.byproduct) {
        const produced = rollByproduct(recipe.byproduct, crafts);
        if (produced > 0) {
            addItemsToSlot(machine, RESIDUE_SLOT, recipe.byproduct.id, produced);
        }
    }
}

function rollByproduct(byproduct, crafts) {
    const chance = clampChance(byproduct.chance ?? 1);
    let total = 0;
    for (let i = 0; i < crafts; i++) {
        if (Math.random() <= chance) {
            total += Math.max(1, byproduct.amount ?? 1);
        }
    }
    return total;
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

function updateHud(machine, recipe, tank, maxCrafts) {
    const fluidType = recipe.fluid.type ?? DEFAULT_FLUID_TYPE;
    const fluidPerCraft = recipe.fluid.amount;
    const tankAmount = FluidManager.formatFluid(tank.get());
    const tankCap = FluidManager.formatFluid(tank.getCap());
    const lore = [
        `§bInput: §f${formatName(recipe.input.id)}`,
        `§dMelt: §f${formatFluidDisplayName(fluidType)}`,
        `§7Yield: §f${FluidManager.formatFluid(fluidPerCraft)} each`,
        `§7Tank: §f${tankAmount} §7/ §f${tankCap}`,
        `§cCost: §f${Energy.formatEnergyToText(machine.getEnergyCost())}`,
        `§7Queued Crafts: §f${maxCrafts}`
    ];

    machine.setLabel({
        title: '§6Flux Crucible',
        lore,
        rawText: undefined
    });
}

function feedFluidSlot(machine, tank) {
    const slotItem = machine.inv.getItem(FLUID_SLOT);
    if (!slotItem) return;

    const fillDefinition = FluidManager.getFluidFillDefinition?.(slotItem.typeId);
    if (fillDefinition) return;

    const result = tank.fluidItem(slotItem.typeId);
    if (result === false) return;

    machine.entity.changeItemAmount(FLUID_SLOT, -1);

    if (!result) return;

    const updated = machine.inv.getItem(FLUID_SLOT);
    if (!updated) {
        machine.entity.setItem(FLUID_SLOT, result, 1);
        return;
    }

    if (updated.typeId === result && updated.amount < updated.maxAmount) {
        machine.entity.changeItemAmount(FLUID_SLOT, 1);
    } else {
        machine.entity.addItem(result, 1);
    }
}

function addItemsToSlot(machine, slotIndex, itemId, amount) {
    if (!itemId || amount <= 0) return;

    const slot = machine.inv.getItem(slotIndex);
    if (!slot) {
        machine.entity.setItem(slotIndex, itemId, amount);
        return;
    }

    if (slot.typeId !== itemId) {
        machine.entity.setItem(slotIndex, itemId, amount);
        return;
    }

    machine.entity.changeItemAmount(slotIndex, amount);
}

function formatName(id) {
    const [, name = id] = id.split(':');
    return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatFluidDisplayName(type) {
    if (!type || type === 'empty') return 'Empty';
    const pretty = formatName(type);
    const cleaned = pretty.replace(/Liquified\s*/i, '').replace(/Dark\s*Matter/i, 'Dark Matter');
    return cleaned.length ? cleaned : pretty;
}

function clampChance(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(1, parsed));
}

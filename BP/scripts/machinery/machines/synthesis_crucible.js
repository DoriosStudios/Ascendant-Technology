import { Machine, FluidManager } from '../managers_extra'

// Layout guidance (matches the 25-slot complex machine inventory):
// 0: Energy bar (auto by Machine)
// 1: UI arrow (set on place)
// 2: Progress bar (auto by Machine)
// 3: Upgrade slot (left)
// 4: Fluid bar (XP / Aetherium Liquid, etc.)
// 5: Modifier slot (catalyst / upgrade item)
// 6: Upgrade slot (right)
// 7-15: 3×3 Input Grid
// 16-24: 3×3 Output Grid (mirrors input grid positions)
const FLUID_SLOT = 4;
const INPUT_START = 7;
const INPUT_END = INPUT_START + 8;
const MODIFIER_SLOT = 5;
const UPGRADE_SLOTS = [3, 6];

const DEFAULT_FLUID_TYPE = 'xp';
const DEFAULT_FLUID_PER_BATCH = 500; // mB per batch if recipe doesn't specify

DoriosAPI.register.blockComponent('synthesis_crucible', {
    /**
     * Runs before the machine is placed by the player.
     *
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            machine.displayEnergy();
            // Visual filler slot
            machine.entity.setItem(1, 'utilitycraft:arrow_right_0', 1, "");

            // Initialize and show fluid tank
            const tank = FluidManager.initializeSingle(machine.entity);
            tank.display(FLUID_SLOT);
            machine.blockSlots([FLUID_SLOT]);
        });
    },

    /**
     * Executes each tick for the machine.
     *
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        // Output auto-transfer (complex grid → last 9 slots)
        machine.transferItems('complex');

        const inv = machine.inv;
        const size = inv.size;
        const OUTPUT_END = size - 1;
        const OUTPUT_START = OUTPUT_END - 8;

        if (OUTPUT_START <= INPUT_END) {
            machine.showWarning('Invalid Layout');
            return;
        }

        // Fluid handling (XP / Aetherium Liquid / others)
        const fluid = FluidManager.initializeSingle(machine.entity);
        fluid.transferFluids(block);

        const modifier = inv.getItem(MODIFIER_SLOT);
        const modifierId = modifier?.typeId ?? 'none';

        // Gather grid inputs
        const gridItems = [];
        for (let slot = INPUT_START; slot <= INPUT_END; slot++) {
            gridItems.push(inv.getItem(slot) || null);
        }

        // Build recipe signature: modifier + grid fingerprint
        const gridSignature = gridItems
            .map(item => item?.typeId ?? 'air')
            .join(',');
        const recipesComponent = block.getComponent('utilitycraft:machine_recipes')?.customComponentParameters?.params;
        const recipes = recipesComponent ?? {};

        const signatureKey = `${modifierId}|${gridSignature}`;
        const fallbackKey = modifierId;
        /** @type {any} */
        const recipe = recipes[signatureKey] ?? recipes[fallbackKey] ?? null;

        // Fallback: if no recipe, attempt repair mode (Induction Anvil style) for damaged tools/armor
        const hasRepairable = gridItems.some(item => item?.getComponent('durability'));
        const energyCost = recipe?.cost ?? settings.machine.energy_cost;
        machine.setEnergyCost(energyCost);

        // Basic energy availability check
        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            fluid.display();
            return;
        }

        // Validate recipe outputs / capacity when recipe exists
        if (recipe) {
            // Output mapping: mirror grid positions 1:1 (input index → output index)
            for (let i = 0; i < gridItems.length; i++) {
                const targetSlot = OUTPUT_START + i;
                const outputDef = recipe.outputs?.[i];
                if (!outputDef) continue;
                const outId = outputDef.id ?? outputDef.output ?? outputDef.typeId;
                if (!outId) continue;

                const current = inv.getItem(targetSlot);
                if (current && current.typeId !== outId) {
                    machine.showWarning('Output Conflict');
                    fluid.display();
                    return;
                }
                const space = (current?.maxAmount ?? 64) - (current?.amount ?? 0);
                const need = (outputDef.amount ?? 1);
                if (space < need) {
                    machine.showWarning('Output Full');
                    fluid.display();
                    return;
                }
            }
        } else if (!hasRepairable) {
            machine.showWarning('No Recipe');
            fluid.display();
            return;
        }

        const progress = machine.getProgress();

        // Not enough accumulated progress → keep charging with energy
        if (progress < energyCost) {
            const consumption = machine.boosts.consumption;
            const energyToConsume = Math.min(machine.energy.get(), machine.rate, (energyCost - progress) * consumption);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / consumption);
            // Visuals
            machine.on();
            machine.displayEnergy();
            machine.displayProgress();
            fluid.display();
            machine.showStatus('Charging');
            return;
        }

        // Enough progress: execute batch
        if (recipe) {
            const fluidNeed = recipe.fluid?.amount ?? DEFAULT_FLUID_PER_BATCH;
            const fluidType = (recipe.fluid?.type ?? DEFAULT_FLUID_TYPE).toLowerCase();
            if (fluidNeed > 0) {
                if (fluid.getType() !== 'empty' && fluid.getType() !== fluidType) {
                    machine.showWarning(`Needs ${fluidType}`);
                    fluid.display();
                    return;
                }
                if (fluid.get() < fluidNeed) {
                    machine.showWarning('Not Enough Fluid');
                    fluid.display();
                    return;
                }
            }

            // Optional temperature gate (if another system sets it on the entity)
            const tempRequirement = recipe.temperature;
            if (tempRequirement) {
                const currentTemp = machine.entity.getDynamicProperty('dorios:temperature');
                const { min, max } = tempRequirement;
                if ((min !== undefined && currentTemp < min) || (max !== undefined && currentTemp > max)) {
                    machine.showWarning('Temp Out of Range');
                    fluid.display();
                    return;
                }
            }

            // Consume inputs & produce outputs
            for (let i = 0; i < gridItems.length; i++) {
                const input = gridItems[i];
                const outputDef = recipe.outputs?.[i];
                if (!input) continue;

                // If recipe requires a specific map per slot, enforce it (optional)
                if (recipe.inputs?.[i]) {
                    const allowed = recipe.inputs[i];
                    const ids = Array.isArray(allowed) ? allowed : [allowed];
                    if (!ids.includes(input.typeId)) {
                        machine.showWarning('Invalid Grid');
                        fluid.display();
                        return;
                    }
                }

                if (!outputDef) continue; // allow pass-through / blank slots

                const targetSlot = OUTPUT_START + i;
                const outId = outputDef.id ?? outputDef.output ?? outputDef.typeId;
                const outAmount = outputDef.amount ?? 1;
                const consume = outputDef.consume ?? recipe.consume ?? 1;

                machine.entity.changeItemAmount(INPUT_START + i, -consume);
                const current = inv.getItem(targetSlot);
                if (!current) {
                    machine.entity.setItem(targetSlot, outId, outAmount);
                } else {
                    machine.entity.changeItemAmount(targetSlot, outAmount);
                }
            }

            // Consume modifier if flagged
            if (recipe.consumeModifier) {
                machine.entity.changeItemAmount(MODIFIER_SLOT, -1);
            }

            if (fluidNeed > 0) {
                if (fluid.getType() === 'empty') fluid.setType(fluidType);
                fluid.add(-fluidNeed);
            }

            machine.addProgress(-energyCost);
        } else {
            // Repair batch (Induction Anvil style, but uses fluid as XP)
            const fluidType = DEFAULT_FLUID_TYPE;
            const fluidCostPerDurability = 10; // mB per durability point repaired
            let repairedSomething = false;

            for (let i = 0; i < gridItems.length; i++) {
                const item = gridItems[i];
                if (!item) continue;
                const durability = item.getComponent('durability');
                if (!durability) continue;

                const remaining = durability.getRemaining();
                if (remaining === 0) continue; // already fully repaired

                const repairAmount = Math.min(remaining, Math.floor(energyCost / 10));
                const fluidNeed = repairAmount * fluidCostPerDurability;

                if (fluid.getType() !== 'empty' && fluid.getType() !== fluidType) {
                    continue;
                }
                if (fluidNeed > fluid.get()) {
                    continue;
                }

                durability.repair(repairAmount);
                machine.entity.setItem(INPUT_START + i, item);
                if (fluid.getType() === 'empty') fluid.setType(fluidType);
                fluid.add(-fluidNeed);
                repairedSomething = true;
                // Consume progress proportionally (mirror induction anvil behavior)
                machine.addProgress(-Math.max(1, repairAmount * 10));
            }

            if (!repairedSomething) {
                machine.showWarning('Nothing to Repair');
                fluid.display();
                return;
            }
        }

        // Visuals & status
        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        fluid.display();

        // Status label
        machine.setLabel(`
§r§2Running
§r§7Recipe: ${recipe ? (recipe.name ?? 'Custom') : 'Repair Mode'}
§r§7Progress: ${Math.min(100, Math.floor((machine.getProgress() / machine.getEnergyCost()) * 100))}%
§r§7Fluid: ${DoriosAPI.utils.capitalizeFirst(fluid.getType())} ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.getCap())}
        `);
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

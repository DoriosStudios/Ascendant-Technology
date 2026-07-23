import { system, world, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { Energy } from "./energyStorage.js";
import { FluidManager, GasManager } from "./fluidStorage.js";
import { Machine, updatePipes, applyLabelToSlot, applyLabels } from "./machine.js";
import { getTickSpeed } from "./machine.js";
import { shouldRefreshEntityUi } from "./ui_refresh.js";

const normalizeRawMessageArg = value => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return value;
    return String(value);
};

const tr = (key, withArgs = []) => ({
    translate: key,
    with: withArgs.map(normalizeRawMessageArg)
});

/**
 * Generator class for energy-producing blocks.
 */
export class Generator {
    /**
     * Creates a new Generator instance.
     * 
     * @param {Block} block The block representing the generator.
     * @param {GeneratorSettings} settings generator's settings.
     */
    constructor(block, settings, ignoreTick = false) {
        this.valid = true

        if (globalThis.tickCount % globalThis.tickSpeed != 0 && !ignoreTick) {
            this.valid = false
            return
        }
        this.settings = settings
        this.dim = block.dimension
        this.block = block
        this.entity = this.dim.getEntitiesAtBlockLocation(block.location)[0]
        if (!this.entity) {
            this.valid = false;
            return;
        }

        // Ensure the entity has a scoreboard identity so Energy/Fluid managers don't throw
        if (!this.entity.scoreboardIdentity) {
            try {
                Energy.initialize(this.entity);
            } catch { /* ignore: scoreboard might not be ready yet */ }
        }

        this.inv = this.entity?.getComponent('inventory')?.container
        this.energy = new Energy(this.entity)
        this.baseRate = settings.generator.rate_speed_base
        this.rate = this.baseRate * getTickSpeed()
    }

    /**
     * Spawns a UtilityCraft generator entity at the given block location,
     * triggers the correct type and inventory events, and assigns its name.
     *
     * @param {Block} block The block where the generator will be placed.
     * @param {Object} data Generator configuration.
     * @param {Object} data.entity Entity config object.
     * @param {string} data.entity.name Generator name (e.g. "crusher").
     * @param {number} data.entity.inventory_size Number of slots in inventory.
     * @returns {Entity} The spawned generator entity.
     */
    static spawn(block, data) {
        const dim = block.dimension;
        const { entity } = data;

        let { x, y, z } = block.center(); y -= 0.25
        const generatorEntity = dim.spawnEntity("utilitycraft:machine", { x, y, z });

        let generatorEvent;
        let inventorySize = 2

        if (entity.type == 'simple') {
            generatorEvent = "utilitycraft:simple_generator";
            inventorySize = 4
        } else if (entity.type == 'fluid') {
            generatorEvent = "utilitycraft:fluid_generator";
            inventorySize = 3
        } else if (entity.type == 'passive') {
            generatorEvent = "utilitycraft:passive_generator";
            inventorySize = 2
        } else if (entity.type == 'battery') {
            generatorEvent = "utilitycraft:battery_generator";
            inventorySize = 2
        } else if (entity.type == 'power_beacon') {
            generatorEvent = "utilitycraft:power_beacon";
            inventorySize = 2
        }

        if (entity.inventory_size) inventorySize = entity.inventory_size

        // Ensure we always request a positive inventory size
        inventorySize = Math.max(1, Math.floor(inventorySize));

        const inventoryEvent = `utilitycraft:inventory_${inventorySize}`;

        generatorEntity.triggerEvent(generatorEvent);
        generatorEntity.triggerEvent(inventoryEvent);

        const name = entity.name ?? block.typeId.split(':')[1]
        generatorEntity.nameTag = `entity.utilitycraft:${name}.name`;

        return generatorEntity;
    }

    /**
     * Handles generator destruction:
     * - Drops inventory (excluding UI items).
     * - Drops the generator block item with stored energy and liquid info in lore.
     * - Removes the generator entity.
     */
    static onDestroy(e) {
        const { block, brokenBlockPermutation, player, dimension: dim } = e;
        const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
        if (!entity) return false;

        const energy = new Energy(entity);
        const fluid = new FluidManager(entity)
        const blockItemId = brokenBlockPermutation.type.id
        const blockItem = new ItemStack(blockItemId);
        const lore = [];

        if (energy.get() > 0) {
            lore.push(`§r§7  Energy: ${Energy.formatEnergyToText(energy.get())}/${Energy.formatEnergyToText(energy.cap)}`);
        }

        if (fluid.type != 'empty') {
            const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type)
            lore.push(`§r§7  ${liquidName}: ${FluidManager.formatFluid(fluid.get())}/${FluidManager.formatFluid(fluid.cap)}`);
        }

        if (lore.length > 0) {
            blockItem.setLore(lore);
        }

        system.run(() => {
            if (player?.isInSurvival()) {
                const oldItemEntity = dim.getEntities({ type: 'item', maxDistance: 3, location: block.center() })
                    .find(item => item.getComponent('minecraft:item')?.itemStack?.typeId === blockItemId);
                oldItemEntity?.remove()
            };
            Machine.dropAllItems(entity);
            entity.remove();
            dim.spawnItem(blockItem, block.center());
        });
        return true
    }

    /**
     * Spawns a generator entity at the given block location with energy settings.
     */
    static spawnGeneratorEntity(e, settings, callback) {
        const { block, player, permutationToPlace: perm } = e
        system.runTimeout(() => {
            if (perm.hasTag('dorios:energy')) {
                updatePipes(block, 'energy');
            }

            if (perm.hasTag('dorios:item')) {
                updatePipes(block, 'item');
            }

            if (perm.hasTag('dorios:fluid')) {
                updatePipes(block, 'fluid');
            }
            try { globalThis.refreshOverclockNetwork?.(block); } catch { /* ignore overclock refresh */ }
        }, 2)

        const itemInfo = Array.isArray(player.getComponent('equippable').getEquipment('Mainhand').getLore())
            ? player.getComponent('equippable').getEquipment('Mainhand').getLore()
            : [];
        let energy = 0;
        let fluid = undefined;

        for (const line of itemInfo) {
            if (!energy && typeof line === 'string' && line.includes('Energy')) {
                energy = Energy.getEnergyFromText(line);
            }
        }

        for (const line of itemInfo) {
            if (!fluid) {
                const parsed = FluidManager.getFluidFromText(line);
                const parsedLegacyGas = (!parsed?.type || parsed.type === 'empty' || parsed.amount <= 0)
                    ? GasManager.getGasFromText(line)
                    : null;
                const candidate = parsedLegacyGas ?? parsed;
                if (candidate?.type && candidate.type !== 'empty' && candidate.amount > 0) {
                    fluid = candidate;
                }
            }
            if (fluid) break;
        }
        system.run(() => {
            const entity = Generator.spawn(block, settings)
            Energy.initialize(entity)
            const energyManager = new Energy(entity)
            energyManager.set(energy)
            energyManager.setCap(settings.generator.energy_cap)
            energyManager.display()
            if (settings.generator.fluid_cap) {
                const fluidManager = new FluidManager(entity, 0)
                fluidManager.setCap(settings.generator.fluid_cap)

                if (fluid && fluid.amount > 0) {
                    fluidManager.setType(fluid.type)
                    fluidManager.set(fluid.amount)
                }
            }
            this.addNearbyMachines(entity)
            try { globalThis.refreshOverclockNetwork?.(block); } catch { /* ignore overclock refresh */ }
            system.run(() => { if (callback) callback(entity) })
        });
    }

    /**
     * Adds tags to the entity for all adjacent blocks (6 directions) around it.
     * Used by energy transfer functions to identify nearby machines.
     *
     * @param {Entity} entity The entity to tag with nearby positions.
     */
    static addNearbyMachines(entity) {
        let { x, y, z } = entity.location
        const directions = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1]
        ];

        for (const [dx, dy, dz] of directions) {
            const xf = x + dx;
            const yf = y + dy;
            const zf = z + dz;
            entity.addTag(`pos:[${xf},${yf},${zf}]`);
        }
    }

    /**
     * Opens a modal form for selecting transfer mode (nearest / farthest / round).
     */
    static openGeneratorTransferModeMenu(entity, player) {
        if (!entity || !player) return;

        const mode = entity.getDynamicProperty('transferMode') ?? 'nearest';
        const modeOptions = [
            { key: 'nearest', label: tr('ui.utilitycraft.generator.transfer.mode.nearest') },
            { key: 'farthest', label: tr('ui.utilitycraft.generator.transfer.mode.farthest') },
            { key: 'round', label: tr('ui.utilitycraft.generator.transfer.mode.round') }
        ];
        const currentIndex = modeOptions.findIndex(option => option.key === mode);
        const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

        const modal = new ModalFormData()
            .title(tr('ui.utilitycraft.generator.transfer.title'))
            .dropdown(
                tr('ui.utilitycraft.generator.transfer.body'),
                modeOptions.map(option => option.label),
                { defaultValueIndex: defaultIndex }
            );

        modal.show(player).then(result => {
            if (result.canceled) return;

            const [selection] = result.formValues;
            const newMode = modeOptions[selection]?.key ?? 'nearest';
            const modeLabel = modeOptions.find(option => option.key === newMode)?.label ?? modeOptions[0].label;

            entity.setDynamicProperty('transferMode', newMode);
            player.onScreenDisplay.setActionBar(tr('ui.utilitycraft.generator.transfer.set', [modeLabel]));
        });
    }

    setRate(baseRate) {
        this.baseRate = baseRate;
        this.rate = this.baseRate * getTickSpeed();
        return this.rate;
    }

    setLabel(content, slot = 1, options = {}) {
        applyLabelToSlot(this.inv, slot, content, {
            entity: this.entity,
            ...options
        });
    }

    setLabels(contents, slots, options = {}) {
        applyLabels(this.inv, contents, slots, {
            entity: this.entity,
            ...options
        });
    }

    on() {
        this.block.setState('utilitycraft:on', true)
    }

    off() {
        this.block.setState('utilitycraft:on', false)
    }

    displayEnergy(slot = 0, options = {}) {
        if (!shouldRefreshEntityUi(this.entity, `energy:${slot}`, options.interval, options.force === true)) return;
        this.energy.display(slot, { ...options, force: true });
    }
}

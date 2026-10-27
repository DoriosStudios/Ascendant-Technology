import * as DoriosLib from "DoriosLib/index.js";
import { Multiblock, MultiblockMachine, FluidStorage, EnergyStorage } from "DoriosCore/index.js";
import { CONSTANT_FLUID_TYPE_TAG } from "DoriosCore/machinery/constants.js";
import { ID, CONFIG, STATS_KEY, MAX_ESSENCE_SLOTS, EXTERNAL_COMPONENT_ADAPTERS, EXTERNAL_SHELL_IDS, computeChamberStats } from "./config.js";
import { validateChamberStructure, structureFailureMessage } from "./structure.js";
import { canPrepareInventory, prepareInventory } from "./uiState.js";
import { configureChamberIO } from "./io.js";
import { tickChamber } from "./runtime.js";
import { clearPending } from "./staging.js";

const scanning = new Set();

/** Chamber-specific activation with Core's standard multiblock lifecycle. */
export class MobChamberController extends MultiblockMachine {
    static async activateMachineController(e, config, entity) {
        const scanKey = entity.id;
        if (scanning.has(scanKey)) return;
        scanning.add(scanKey);
        try {
            Multiblock.DeactivationManager.deactivateEntity(entity, e.player);
            entity.setDynamicProperty(STATS_KEY, undefined);
            const detected = await Multiblock.StructureDetector.detectFromController(e, config.required_case);
            if (!detected || !entity.isValid) return;
            const checked = validateChamberStructure(detected.bounds, e.block.location,
                position => e.block.dimension.getBlock(position), EXTERNAL_COMPONENT_ADAPTERS, EXTERNAL_SHELL_IDS);
            if (!checked.valid) {
                e.player.sendMessage(structureFailureMessage(checked));
                return;
            }
            const container = entity.getComponent("minecraft:inventory")?.container;
            const stats = computeChamberStats(checked.components, { xpCapacity: checked.xpCapacity });
            if (!canPrepareInventory(container, stats)) {
                e.player.sendMessage("§c[Mob Chamber] Clear reserved UI/disabled essence slots before rescanning. Restore Essence Modules if needed to retrieve essences. No items were replaced.");
                return;
            }
            const [xp] = FluidStorage.initializeMultiple(entity, 1);
            if (xp.get() > 0 && xp.getType() !== "xp") {
                e.player.sendMessage("§c[Mob Chamber] Remove the non-XP fluid before activating.");
                return;
            }
            // setCap clamps fluid. Reject a smaller capacity before touching resources.
            if (xp.get() > stats.xpCapacity) {
                e.player.sendMessage("§c[Mob Chamber] Stored fluid exceeds the new capacity. Restore the Fluid Cells before scanning again.");
                return;
            }
            configureChamberIO(entity, stats);
            xp.setCap(stats.xpCapacity);
            entity.addTag(CONSTANT_FLUID_TYPE_TAG);
            xp.setType("xp");
            prepareInventory(container, stats);
            entity.setDynamicProperty(STATS_KEY, JSON.stringify(stats));
            // Reuse Core's lifecycle/energy sizing, but not its generic factory formulas.
            const energyCap = Multiblock.ActivationManager.activateMultiblock(entity, {
                ...detected, ...checked,
                inputBlocks: checked.ports.map(position => DoriosLib.linkNode.createLinkNodeTag(position)),
            });
            e.player.sendMessage(`§a[Mob Chamber] Structure ready: ${stats.essenceSlots} essence slots, ${stats.processingCapacity} simultaneous processing capacity.`);
            e.player.sendMessage(`§7[Mob Chamber] ${(stats.operationTicks / 20).toFixed(2)} s per operation; energy capacity ${EnergyStorage.formatEnergyToText(energyCap)}; XP capacity ${stats.xpCapacity} mB.`);
            const ignoredModules = (checked.components.essence_module ?? 0) - (MAX_ESSENCE_SLOTS - 1);
            if (ignoredModules > 0) e.player.sendMessage(`§e[Mob Chamber] ${ignoredModules} extra Essence ${ignoredModules === 1 ? "Module" : "Modules"} ignored; the machine is active with ${MAX_ESSENCE_SLOTS} essence slots.`);
            return { entity, structure: checked, stats, energyCap };
        } catch (error) {
            if (entity.isValid) Multiblock.DeactivationManager.deactivateEntity(entity, e.player);
            throw error;
        } finally {
            scanning.delete(scanKey);
        }
    }
}

DoriosLib.registry.blockComponent(ID, {
    onPlayerInteract(e) {
        return MobChamberController.handlePlayerInteract(e, CONFIG, {
            onInteractWithoutWrench({ player, entity }) {
                if (entity?.getDynamicProperty(Multiblock.Constants.STATE_PROPERTY_ID) === Multiblock.Constants.ACTIVE_STATE_VALUE) return;
                player.sendMessage("§7[Mob Chamber] Use a wrench to scan a closed titanium casing. Its dimensions may vary; the Controller can be anywhere on the shell.");
            },
        });
    },
    onPlayerBreak({ block, brokenBlockPermutation, player }) {
        const entity = Multiblock.EntityManager.getControllerEntityFromBlock(block, brokenBlockPermutation);
        try { if (entity) clearPending(entity); }
        finally {
            // Malformed pending metadata must never prevent standard destruction.
            Multiblock.DeactivationManager.handleBreakController(block, player, undefined, brokenBlockPermutation);
        }
    },
    onTick({ block }) { tickChamber(block); },
});

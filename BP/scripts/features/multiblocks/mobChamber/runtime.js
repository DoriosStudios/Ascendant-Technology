import { system, world } from "@minecraft/server";
import { Multiblock, EnergyStorage, FluidStorage } from "DoriosCore/index.js";
import { CONSTANT_FLUID_TYPE_TAG } from "DoriosCore/machinery/constants.js";
import { SLOTS, STATS_KEY, INVENTORY_SIZE, operationEnergyCost } from "./config.js";
import { selectEssences, deathProfile, deathXp } from "./essences.js";
import { generateDeathLoot } from "./loot.js";
import { savePending, getPending, readPendingLoot, clearPending, cleanupStagingPage, STAGING_ID } from "./staging.js";
import { planLootInsertion, commitOperation } from "./transaction.js";
import { configureChamberIO } from "./io.js";
import { renderChamberUI } from "./uiState.js";

export const PROGRESS_KEY = "at:mob_chamber_progress";
export const CURSOR_KEY = "at:mob_chamber_cursor";

world.afterEvents.entityLoad.subscribe(({ entity }) => {
    if (entity.typeId === STAGING_ID) system.run(() => cleanupStagingPage(entity));
});
// Also clean completed/deleted controllers' pages that never unloaded.
system.runInterval(() => {
    for (const name of ["overworld", "nether", "the_end"]) {
        for (const page of world.getDimension(name).getEntities({ type: STAGING_ID })) cleanupStagingPage(page);
    }
}, 200);

/** Discrete operations: the timer never consumes energy, and a pending roll is
 * kept verbatim until all loot, XP, energy and catalyst checks pass together.
 */
export function processChamber(entity, container, stats, energy, xp, random = Math.random) {
    let pending = getPending(entity);
    let progress = Number(entity.getDynamicProperty(PROGRESS_KEY) ?? 0);
    if (!pending) {
        const cursor = Number(entity.getDynamicProperty(CURSOR_KEY) ?? 0);
        const { selected, nextCursor } = selectEssences(container, stats, cursor);
        if (!selected.length) {
            entity.setDynamicProperty(PROGRESS_KEY, 0);
            return { status: "Waiting for essences", progress: 0 };
        }
        progress = Math.min(stats.operationTicks, progress + 1);
        entity.setDynamicProperty(PROGRESS_KEY, progress);
        const cost = operationEnergyCost(selected.length, stats.efficiencyMultiplier);
        if (progress < stats.operationTicks) return { status: "Processing", progress, cost };
        if (energy.get() < cost) return { status: "Not enough energy", progress, cost };
        const loot = [], profiles = [];
        let xpAmount = 0;
        for (const essence of selected) {
            const profile = deathProfile(essence.typeId, random);
            profiles.push(profile);
            loot.push(...generateDeathLoot(profile, random));
            xpAmount += deathXp(profile, random);
        }
        pending = savePending(entity, { selected, profiles, nextCursor, xp: xpAmount, cost }, loot);
    }

    progress = stats.operationTicks;
    const cost = operationEnergyCost(pending.selected.length, stats.efficiencyMultiplier);
    const result = status => ({ status, progress, cost });
    if (pending.selected.length > stats.processingCapacity || pending.selected.some(essence =>
        !SLOTS.essences.slice(0, stats.essenceSlots).includes(essence.slot)
        || container.getItem(essence.slot)?.typeId !== essence.typeId)) return result("Restore pending essences/capacity");
    const loot = readPendingLoot(entity, pending);
    if (!loot) return result("Waiting for pending storage");
    const plan = planLootInsertion(container, SLOTS.loot, loot);
    if (!plan) return result("Clog: loot output full");
    if (xp.get() + pending.xp > xp.getCap()) return result("Clog: XP tank full");
    if (energy.get() < cost) return result("Not enough energy");
    if (!commitOperation(container, plan, energy, xp, cost, pending.xp)) return result("Waiting for resources");
    // No async boundaries between the commit and its persistent completion.
    entity.setDynamicProperty(PROGRESS_KEY, 0);
    entity.setDynamicProperty(CURSOR_KEY, pending.nextCursor);
    clearPending(entity, pending);
    return { status: `Completed ${pending.selected.length} virtual deaths`, progress: 0, cost };
}

export function tickChamber(block) {
    const entity = Multiblock.EntityManager.getControllerEntityFromBlock(block);
    if (!entity || entity.getDynamicProperty(Multiblock.Constants.STATE_PROPERTY_ID) !== Multiblock.Constants.ACTIVE_STATE_VALUE) return;
    const raw = entity.getDynamicProperty(STATS_KEY);
    if (!raw) return;
    const stats = JSON.parse(raw), container = entity.getComponent("minecraft:inventory")?.container;
    if (container?.size !== INVENTORY_SIZE) return;
    const energy = new EnergyStorage(entity), xp = new FluidStorage(entity, 0);
    if (xp.get() > 0 && xp.getType() !== "xp") {
        renderChamberUI(entity, container, stats, energy, xp, { status: "Wrong fluid in XP tank", progress: 0 });
        return;
    }
    entity.addTag(CONSTANT_FLUID_TYPE_TAG);
    xp.setType("xp");
    if (entity.getDynamicProperty("at:mob_chamber_io") !== stats.essenceSlots) configureChamberIO(entity, stats);
    try {
        const result = processChamber(entity, container, stats, energy, xp);
        if (system.currentTick % 5 === 0) renderChamberUI(entity, container, stats, energy, xp, result);
    } catch (error) {
        renderChamberUI(entity, container, stats, energy, xp, { status: "Error: pending batch preserved", progress: stats.operationTicks });
        if (system.currentTick % 100 === 0) console.warn(`[Mob Chamber] ${error}`);
    }
}

import { world } from "@minecraft/server";

export const PENDING_KEY = "at:mob_chamber_pending";
export const STAGING_ID = "utilitycraft:mob_chamber_staging";
const OWNER_KEY = "at:mob_chamber_owner";

export function getPending(entity) {
    const raw = entity.getDynamicProperty(PENDING_KEY);
    if (raw === undefined) return undefined;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.pages) || !Array.isArray(value.selected)
        || !Number.isInteger(value.itemCount) || value.itemCount < 0
        || !Number.isFinite(value.xp) || value.xp < 0 || !Number.isFinite(value.cost) || value.cost <= 0) {
        throw new Error("Invalid pending Mob Chamber batch; preserved for recovery");
    }
    return value;
}

/** Native inventories keep all ItemStack data, including engine-only metadata.
 * Pages are unlimited by the visible output size; no output slot becomes staging.
 */
export function savePending(entity, batch, loot) {
    const pages = [];
    try {
        for (let offset = 0; offset < loot.length; offset += 54) {
            const page = entity.dimension.spawnEntity(STAGING_ID, entity.location);
            pages.push(page.id);
            page.setDynamicProperty(OWNER_KEY, entity.id);
            const container = page.getComponent("minecraft:inventory")?.container;
            if (container?.size !== 54) throw new Error("Staging inventory not ready");
            for (let index = offset; index < Math.min(offset + 54, loot.length); index++) container.setItem(index - offset, loot[index]);
        }
        const pending = { ...batch, version: 1, pages, itemCount: loot.length };
        entity.setDynamicProperty(PENDING_KEY, JSON.stringify(pending));
        return pending;
    } catch (error) {
        for (const id of pages) world.getEntity(id)?.remove();
        throw error;
    }
}

export function readPendingLoot(entity, pending) {
    const loot = [];
    for (const id of pending.pages) {
        const page = world.getEntity(id);
        if (!page?.isValid || page.typeId !== STAGING_ID || page.getDynamicProperty(OWNER_KEY) !== entity.id) return undefined;
        const container = page.getComponent("minecraft:inventory")?.container;
        if (!container) return undefined;
        for (let slot = 0; slot < container.size && loot.length < pending.itemCount; slot++) {
            const stack = container.getItem(slot);
            if (stack) loot.push(stack);
        }
    }
    return loot.length === pending.itemCount ? loot : undefined;
}

export function clearPending(entity, pending = getPending(entity)) {
    // Clear the reference before deleting pages; after a successful commit these
    // pages must never be treated as another operation on the next tick.
    entity.setDynamicProperty(PENDING_KEY, undefined);
    for (const id of pending?.pages ?? []) {
        const page = world.getEntity(id);
        if (page?.getDynamicProperty(OWNER_KEY) === entity.id) {
            try { page.remove(); } catch { /* Completed pages can be cleaned on load. */ }
        }
    }
}

export function cleanupStagingPage(page) {
    if (!page?.isValid || page.typeId !== STAGING_ID) return;
    const ownerId = page.getDynamicProperty(OWNER_KEY);
    if (typeof ownerId !== "string") { page.remove(); return; }
    const owner = world.getEntity(ownerId);
    if (owner) {
        // Keep malformed batches for recovery, never silently discard their data.
        let pending;
        try { pending = getPending(owner); } catch { return; }
        if (pending?.pages.includes(page.id)) return;
        page.remove();
        return;
    }
    // Owner and pages are colocated. If the Controller still exists, allow the
    // owner to load first instead of treating entity-load ordering as deletion.
    const location = page.location;
    let block;
    try { block = page.dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) }); } catch { return; }
    if (block && block.typeId !== "utilitycraft:mob_chamber_controller") page.remove();
}

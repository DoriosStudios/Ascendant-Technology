import { ItemStack, system, world } from "@minecraft/server";

const pendingBreaks = new Map();
const pendingDestructions = new Set();

function breakKey(dimension, location) {
  return `${dimension.id}:${location.x},${location.y},${location.z}`;
}

// Capture item identities before native loot exists. A nearby item with the
// same type is never sufficient evidence that it belongs to this break.
world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (event.cancel) return;
  const { block } = event;
  const dimension = block.dimension;
  const location = { ...block.location };
  const typeId = block.typeId;
  if (typeId !== "minecraft:netherrack" && !/(?:_log|_wood|_stem|_hyphae|bamboo_block)$/.test(typeId)
    && !dimension.getEntitiesAtBlockLocation(location).some(entity =>
      entity.getComponent("minecraft:inventory"))) return;

  const items = new Map();
  for (const entity of dimension.getEntities({ type: "item", location: block.center(), maxDistance: 3 })) {
    const stack = entity.getComponent("minecraft:item")?.itemStack;
    if (stack?.typeId === typeId) items.set(entity.id, stack.amount);
  }
  const snapshot = { dimension, location, typeId, items, used: false };
  const key = breakKey(dimension, location);
  pendingBreaks.set(key, snapshot);
  system.run(() => {
    if (pendingBreaks.get(key) === snapshot) pendingBreaks.delete(key);
  });
});

/** Takes the pre-break snapshot synchronously from a block break callback. */
export function takeNativeDropSnapshot(dimension, location, typeId) {
  const key = breakKey(dimension, location);
  const snapshot = pendingBreaks.get(key);
  if (snapshot?.typeId !== typeId) return undefined;
  pendingBreaks.delete(key);
  return snapshot;
}

/** Coalesces repeated callbacks for the same helper before deferred cleanup. */
export function queueBlockDestruction(entity, callback) {
  if (pendingDestructions.has(entity.id)) return false;
  pendingDestructions.add(entity.id);
  system.run(() => {
    try {
      if (entity.isValid) callback();
    } finally {
      pendingDestructions.delete(entity.id);
    }
  });
  return true;
}

/**
 * Replaces exactly one native block item, retaining older stacks and merged
 * remainders. Returns false if the break's native loot cannot be identified.
 * Spawn failures leave the original drop intact.
 */
export function replaceNativeBlockDrop(snapshot, replacement) {
  if (!snapshot || snapshot.used) return false;
  const { dimension, location, typeId, items } = snapshot;
  const plainItem = new ItemStack(typeId);
  for (const entity of dimension.getEntities({
    type: "item",
    location: { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 },
    maxDistance: 1.75,
  })) {
    const stack = entity.getComponent("minecraft:item")?.itemStack;
    if (!stack?.isStackableWith(plainItem)) continue;
    const previousAmount = items.get(entity.id) ?? 0;
    if (stack.amount <= previousAmount) continue;
    const position = entity.location;
    if (Math.floor(position.x) !== location.x || Math.floor(position.y) !== location.y
      || Math.floor(position.z) !== location.z) continue;

    const spawned = [];
    try {
      spawned.push(dimension.spawnItem(replacement, position));
      if (stack.amount > 1) {
        const remainder = stack.clone();
        remainder.amount--;
        spawned.push(dimension.spawnItem(remainder, position));
      }
      entity.remove();
    } catch (error) {
      for (const drop of spawned) drop.remove();
      throw error;
    }
    snapshot.used = true;
    return true;
  }
  return false;
}

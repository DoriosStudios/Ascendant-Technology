import { world } from "@minecraft/server";
import * as Constants from "./constants.js";
import { DeactivationManager } from "./deactivationManager.js";

/**
 * Global multiblock listeners.
 *
 * Any time a casing or internal component is broken or exploded, the owning multiblock is
 * resolved and deactivated to keep controller state consistent with the world.
 */
function isStructurePart(permutation) {
  const tags = permutation.getTags();
  return tags.includes(Constants.MULTIBLOCK_COMPONENT_TAG)
    || tags.some((tag) => tag.startsWith(Constants.MULTIBLOCK_CASE_TAG_PREFIX));
}

world.afterEvents.playerBreakBlock.subscribe((e) => {
  const { brokenBlockPermutation, block, player } = e;
  if (!isStructurePart(brokenBlockPermutation)) return;

  DeactivationManager.deactivateMultiblock(block, player, { blockId: "minecraft:water" });
});

world.afterEvents.blockExplode.subscribe((e) => {
  const { explodedBlockPermutation, block } = e;
  if (!isStructurePart(explodedBlockPermutation)) return;

  DeactivationManager.deactivateMultiblock(block, undefined, { blockId: "minecraft:water" });
});

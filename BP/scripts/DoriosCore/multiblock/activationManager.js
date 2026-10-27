import { system } from "@minecraft/server";
import { EnergyStorage } from "../machinery/energyStorage.js";
import * as Constants from "./constants.js";
import { isLinkNode, parseLinkNodeTag } from "../../DoriosLib/linkNodes/index.js";
import { setTaggedBlocksWaterlogged } from "./waterlogging.js";

export class ActivationManager {
  /**
   * Fills the detected multiblock bounds layer by layer with the specified block.
   *
   * This is mainly used by structures that need their internal volume to be
   * replaced with water or another helper block once the multiblock activates.
   * The fill is performed over several ticks to reduce the cost of a single
   * large `fill` command burst.
   *
   * @param {{ min: import("@minecraft/server").Vector3, max: import("@minecraft/server").Vector3 }} bounds Bounding box to fill.
   * @param {import("@minecraft/server").Dimension} dim Dimension where the fill commands should run.
   * @param {string} [blockId="minecraft:water"] Block identifier used to fill air.
   * @returns {void}
   */
  static fillBlocks(bounds, dim, blockId = "minecraft:water") {
    const xA = bounds.min.x;
    const yA = bounds.min.y;
    const zA = bounds.min.z;
    const xB = bounds.max.x;
    const yB = bounds.max.y;
    const zB = bounds.max.z;

    const yBottom = yA <= yB ? yA : yB;
    const yTop = yA <= yB ? yB : yA;

    system.run(async () => {
      for (let y = yBottom; y <= yTop; y++) {
        await dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} ${blockId} replace air`);
        if (blockId === "minecraft:water") {
          setTaggedBlocksWaterlogged(bounds, dim, y, true);
        }
        await system.waitTicks(4);
      }
    });
  }

  /**
   * Applies the activation state of a fully detected multiblock structure.
   *
   * Responsibilities:
   * - Shows the controller entity.
   * - Tags and activates all detected multiblock ports.
   * - Stores structure metadata such as bounds and vents.
   * - Optionally fills the internal bounds with a block.
   * - Calculates and applies the resulting energy capacity.
   * - Marks the controller state as `on`.
   *
   * @param {import("@minecraft/server").Entity} entity Controller entity representing the multiblock.
   * @param {{
   *   inputBlocks?: string[],
   *   bounds?: { min: import("@minecraft/server").Vector3, max: import("@minecraft/server").Vector3 },
   *   ventBlocks?: import("@minecraft/server").Vector3[],
   *   components?: Record<string, number>,
   *   componentsById?: Record<string, number>,
   *   energyCapacityById?: Record<string, number>,
   * }} structure Structure data returned by detection helpers.
   * @param {{ blockId?: string }} [fillBlocksConfig]
   * Optional fill configuration used for reactor-like structures.
   * @returns {number} Final calculated energy capacity for the structure.
   */
  static activateMultiblock(entity, structure, fillBlocksConfig) {
    const { inputBlocks, bounds, ventBlocks, components, componentsById, energyCapacityById } = structure;

    entity.triggerEvent(Constants.SHOW_EVENT_ID);

    for (const tag of inputBlocks) {
      entity.addTag(tag);

      const location = parseLinkNodeTag(tag);
      if (!location) continue;
      const { x, y, z } = location;
      const block = entity.dimension.getBlock({ x, y, z });

      if (isLinkNode(block)) {
        block.setPermutation(block.permutation.withState(Constants.ACTIVE_STATE_ID, 1));
        if (block.hasTag(Constants.ENERGY_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} energy|[${x},${y},${z}]`);
        if (block.hasTag(Constants.FLUID_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} fluid|[${x},${y},${z}]`);
        if (block.hasTag(Constants.GAS_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} gas|[${x},${y},${z}]`);
        if (block.hasTag(Constants.ITEM_BLOCK_TAG)) entity.runCommand(`scriptevent ${Constants.UPDATE_PIPES_EVENT_ID} item|[${x},${y},${z}]`);
      }
    }

    if (bounds) {
      entity.setDynamicProperty(Constants.BOUNDS_PROPERTY_ID, JSON.stringify(bounds));
    }

    if (ventBlocks) {
      entity.setDynamicProperty(Constants.VENT_BLOCKS_PROPERTY_ID, JSON.stringify(ventBlocks));
    }

    if (fillBlocksConfig && bounds) {
      ActivationManager.fillBlocks(bounds, entity.dimension, fillBlocksConfig.blockId);
    }

    const energyCap = ActivationManager.calculateEnergyCapacity(components ?? {}, componentsById, energyCapacityById);
    if (energyCap > 0) {
      EnergyStorage.setCap(entity, energyCap);
      entity.setDynamicProperty(Constants.ENERGY_CAP_PROPERTY_ID, energyCap);
    }

    entity.setDynamicProperty(Constants.STATE_PROPERTY_ID, Constants.ACTIVE_STATE_VALUE);
    return energyCap;
  }

  /**
   * Calculates the total energy capacity provided by multiblock components.
   *
   * Full block IDs take priority when available. A machine may explicitly
   * authorize external blocks with energyCapacityById; legacy local-name
   * counts remain a fallback for callers without componentsById.
   *
   * @param {Record<string, number>} components Component counts keyed by component id.
   * @param {Record<string, number>} [componentsById] Counts keyed by full block ID.
   * @param {Record<string, number>} [energyCapacityById] Machine-owned capacity adapters.
   * @returns {number} Total energy capacity represented by the structure.
   */
  static calculateEnergyCapacity(components, componentsById, energyCapacityById) {
    let total = 0;

    if (componentsById) {
      for (const [id, count] of Object.entries(componentsById)) {
        const defaultAmount = id.startsWith("utilitycraft:")
          ? Constants.ENERGY_PER_UNIT[id.slice("utilitycraft:".length)]
          : undefined;
        const amount = energyCapacityById?.[id] ?? defaultAmount;
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(count) || count <= 0) continue;
        total += count * amount;
      }
      return total;
    }

    for (const [id, count] of Object.entries(components)) {
      const amount = Constants.ENERGY_PER_UNIT[id];
      if (!amount) continue;
      total += count * amount;
    }

    return total;
  }
}

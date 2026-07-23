// @ts-check

import { world } from "@minecraft/server";
import { FluidStorage } from "DoriosCore/index.js";

/**
 * DoriosCore preloads storage index 0. AT currently adds one extra fluid tank
 * for the Impact Crusher coolant, so restore that objective cache once per
 * script/world load before machine ticks begin.
 */
world.afterEvents.worldLoad.subscribe(() => {
    FluidStorage.initializeObjectives(1);
});

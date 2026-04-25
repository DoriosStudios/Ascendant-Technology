// DoriosCore – top-level barrel export
// Runs the initializer (tick counter, world-load, shutdown, script events)
// and re-exports all public symbols from sub-modules.

import "./initializer.js";

export * from "./machinery/index.js";
export { Rotation } from "./utils/rotation.js";
export { getOrCreateObjective, loadObjectives } from "./utils/scoreboards.js";
export * from "./constants.js";

// Injector for Project EMC / transmutable items
// - Contains a precomputed mapping for key Ascendant items
// - On world load it merges these into the Project EMC persistent dynamic property
// - Also emits a batch ScriptEvent (for forwards-compatibility if Project EMC adds a batch receiver)
//
// To regenerate a larger mapping from recipes, run the Node generator at
// `tools/generate_transmutables.js` (created in this repo) and copy the
// generated object into ASCENDANT_TRANSMUTABLES below.

import { world, system } from "@minecraft/server";

// Basic mapping (seed values). Adjust values as needed or regenerate.
const ASCENDANT_TRANSMUTABLES = {
  // Titanium family
  "utilitycraft:titanium": 256,
  "utilitycraft:raw_titanium": 64,
  "utilitycraft:titanium_nugget": 32,
  "utilitycraft:titanium_chunk": 16,
  "utilitycraft:titanium_block": 2304,

  // Aetherium family
  "utilitycraft:aetherium": 1024,
  "utilitycraft:aetherium_shard": 256,
  "utilitycraft:refined_aetherium_shard": 512,

  // Example machinery / materials
  "utilitycraft:dark_matter": 139264,
  "utilitycraft:raw_titanium_block": 576,
  "utilitycraft:liquid_capsule": 128
};

function normalizeToEmcShape(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { emc_value: Number(v) };
  }
  return out;
}

function mergeIntoDynamicProperty(map) {
  try {
    const key = "custom_transmutable_items";
    const existingRaw = world.getDynamicProperty(key);
    let existing = {};
    if (existingRaw) {
      try { existing = JSON.parse(existingRaw); } catch { existing = {}; }
    }

    const normalized = normalizeToEmcShape(map);
    const merged = Object.assign({}, existing, normalized);

    world.setDynamicProperty(key, JSON.stringify(merged));
    console.warn(`[Ascendant] Merged ${Object.keys(map).length} transmutables into dynamic property '${key}'.`);
    return true;
  } catch (e) {
    console.warn("[Ascendant] Failed to merge transmutables to dynamic property:", e);
    return false;
  }
}

function sendBatchEvent(map) {
  try {
    // Forward-compatible batch event - Project EMC doesn't currently listen for this
    system.sendScriptEvent("project_emc:register_items_batch", JSON.stringify(map));
  } catch (e) {
    // ignore
  }
}

// Try to register using a possible exported API if available (best-effort).
function tryRegisterViaGlobalApi(map) {
  try {
    const api = globalThis.projectEmc ?? globalThis.ProjectEMC ?? null;
    if (api && typeof api.registerTransmutable === "function") {
      for (const [id, value] of Object.entries(map)) {
        try { api.registerTransmutable(id, Number(value)); } catch { /* continue */ }
      }
      console.warn("[Ascendant] Registered transmutables via global ProjectEMC API.");
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

function registerAscendantTransmutables() {
  if (tryRegisterViaGlobalApi(ASCENDANT_TRANSMUTABLES)) return;
  // Merge into Project EMC's persistent dynamic property so that it will be
  // picked up by Project EMC on world load (their loader reads
  // 'custom_transmutable_items'). This is the most reliable approach.
  mergeIntoDynamicProperty(ASCENDANT_TRANSMUTABLES);
  // Also emit a batch event for modpacks that support it.
  sendBatchEvent(ASCENDANT_TRANSMUTABLES);
}

// Ensure registration runs when the world loads
world.afterEvents.worldLoad.subscribe(() => {
  registerAscendantTransmutables();
});

export default ASCENDANT_TRANSMUTABLES;
export function injectAscendantTransmutables(registerFn) {
  if (typeof registerFn === "function") {
    for (const [id, value] of Object.entries(ASCENDANT_TRANSMUTABLES)) {
      try { registerFn(id, Number(value)); } catch { /* ignore */ }
    }
    return true;
  }
  return false;
}

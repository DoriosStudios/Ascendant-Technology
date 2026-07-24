import "./registeredDrops.js";
export { DROP_PARTICLES, dropParticle } from "./particles.js";

export const DROP_SETTINGS = {
  xpMode: "auto",
  replaceSearchRadius: 1.25,
  spawnOffset: { x: 0.5, y: 0.5, z: 0.5 },
  excavate: {
    enabled: true,
    lootFallback: "block_item",
  },
};

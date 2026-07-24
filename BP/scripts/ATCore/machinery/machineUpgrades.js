// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

DoriosLib.registry.registerMachineUpgrade({
  "utilitycraft:hyper_processing_upgrade": {
    type: "speed",
    levels: {
      1: { speed: 0.06 },
      2: { speed: 0.18 },
      3: { speed: 0.36 },
      4: { speed: 0.6 },
      5: { speed: 0.9 },
      6: { speed: 1.26 },
      7: { speed: 1.68 },
      8: { speed: 2.16 },
    },
  },
});

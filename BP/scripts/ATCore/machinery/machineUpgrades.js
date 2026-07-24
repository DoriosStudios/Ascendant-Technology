// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

DoriosLib.registry.registerMachineUpgrade({
  "utilitycraft:hyper_processing_upgrade": {
    type: "speed",
    levels: {
      1: { speed: 0.65 },
      2: { speed: 1.27 },
      3: { speed: 1.62 },
      4: { speed: 2.06 },
      5: { speed: 2.62 },
      6: { speed: 3.33 },
      7: { speed: 4.24 },
      8: { speed: 5.40 },
    },
  },
});

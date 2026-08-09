// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

DoriosLib.registry.registerMachineUpgrade({
  "utilitycraft:hyper_processing_upgrade": {
    type: "hyper",
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
  "utilitycraft:stack_upgrade": {
    type: "stack",
    levels: {
      1: { process_batch: 1, energy_cost: 1 },
      2: { process_batch: 2 ,energy_cost: 3 },
      3: { process_batch: 3, energy_cost: 5 },
      4: { process_batch: 4, energy_cost: 7 },
      5: { process_batch: 5, energy_cost: 9 },
      6: { process_batch: 6, energy_cost: 11 },
      7: { process_batch: 7, energy_cost: 13 },
      8: { process_batch: 8, energy_cost: 15 }
    }
  }
});

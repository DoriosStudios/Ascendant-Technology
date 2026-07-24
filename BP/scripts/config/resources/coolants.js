import * as DoriosLib from "DoriosLib/index.js";

export const coolantAdditions = {
    cryofluid: {
        efficiency: 1.75,
        tier: 2,
    },
};

DoriosLib.registry.registerCoolant(coolantAdditions);

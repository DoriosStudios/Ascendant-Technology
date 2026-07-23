// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

const emptyCapsule = "utilitycraft:empty_liquid_capsule";
const fluidInputs = {};
const gasItems = {};

for (let tier = 1; tier <= 8; tier++) {
    fluidInputs[`utilitycraft:water_capsule_${tier}`] = {
        type: "water",
        amount: tier * 1000,
        output: emptyCapsule,
    };
    fluidInputs[`utilitycraft:cryofluid_capsule_${tier}`] = {
        type: "cryofluid",
        amount: tier * 1000,
        output: emptyCapsule,
    };
    gasItems[`utilitycraft:steam_capsule_${tier}`] = {
        type: "steam",
        amount: tier * 1000,
        output: emptyCapsule,
    };
}

fluidInputs["utilitycraft:water_capsule_infinite"] = {
    type: "water",
    amount: 8000,
    infinite: true,
};
fluidInputs["utilitycraft:cryofluid_capsule_infinite"] = {
    type: "cryofluid",
    amount: 8000,
    infinite: true,
};

DoriosLib.registry.registerFluidItem(fluidInputs);
DoriosLib.registry.registerGasItem(gasItems);
DoriosLib.registry.registerGasHolder({
    [emptyCapsule]: {
        types: { steam: "utilitycraft:steam_capsule_8" },
        required: 8000,
    },
});

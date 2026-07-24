// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

const emptyCapsule = "utilitycraft:empty_liquid_capsule";
const capsuleCapacity = 8000;
const infiniteCapacity = 512000;

const fluidFamilies = {
    aetherium_liquid_capsule: "liquified_aetherium",
    dark_matter_liquid_capsule: "dark_matter",
    cryofluid_capsule: "cryofluid",
    water_capsule: "water",
    lava_capsule: "lava",
    xp_capsule: "xp",
};

const fluidItems = {};
const fluidOutputs = {};

for (const [capsule, fluid] of Object.entries(fluidFamilies)) {
    for (let tier = 1; tier <= 8; tier++) {
        fluidItems[`utilitycraft:${capsule}_${tier}`] = {
            type: fluid,
            amount: tier * 1000,
            output: emptyCapsule,
        };
    }

    const infiniteCapsule = `utilitycraft:${capsule}_infinite`;
    fluidItems[infiniteCapsule] = {
        type: fluid,
        amount: infiniteCapacity,
        output: infiniteCapsule,
        infinite: true,
    };
    fluidOutputs[fluid] = `utilitycraft:${capsule}_8`;
}

fluidItems["utilitycraft:milk_capsule_infinite"] = {
    type: "milk",
    amount: infiniteCapacity,
    output: "utilitycraft:milk_capsule_infinite",
    infinite: true,
};

DoriosLib.registry.registerFluidItem(fluidItems);
DoriosLib.registry.registerFluidHolder({
    [emptyCapsule]: {
        types: fluidOutputs,
        required: capsuleCapacity,
    },
});

const gasItems = {};

for (let tier = 1; tier <= 8; tier++) {
    gasItems[`utilitycraft:steam_capsule_${tier}`] = {
        type: "steam",
        amount: tier * 1000,
        output: emptyCapsule,
    };
}

DoriosLib.registry.registerGasItem(gasItems);
DoriosLib.registry.registerGasHolder({
    [emptyCapsule]: {
        types: { steam: "utilitycraft:steam_capsule_8" },
        required: capsuleCapacity,
    },
});

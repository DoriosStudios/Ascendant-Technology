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
    heavy_water_capsule: "heavy_water",
    saline_coolant_capsule: "saline_coolant",
    crude_oil_capsule: "crude_oil",
    petroleum_capsule: "petroleum",
    diesel_capsule: "diesel",
    sulfuric_acid_capsule: "sulfuric_acid",
};

const infiniteFluidFamilies = new Set([
    "liquified_aetherium", "dark_matter", "cryofluid", "water", "lava", "xp",
]);

const fluidItems = {};
const fluidOutputs = {};

/** Returns the finite capsule for a whole-bucket volume (1–8 B), if supported. */
export function getFluidCapsuleId(fluid, buckets) {
    if (!Number.isInteger(buckets) || buckets < 1 || buckets > 8) return undefined;
    const family = Object.keys(fluidFamilies).find((key) => fluidFamilies[key] === fluid);
    return family ? `utilitycraft:${family}_${buckets}` : undefined;
}

for (const [capsule, fluid] of Object.entries(fluidFamilies)) {
    for (let tier = 1; tier <= 8; tier++) {
        fluidItems[`utilitycraft:${capsule}_${tier}`] = {
            type: fluid,
            amount: tier * 1000,
            output: emptyCapsule,
        };
    }

    if (infiniteFluidFamilies.has(fluid)) {
        const infiniteCapsule = `utilitycraft:${capsule}_infinite`;
        fluidItems[infiniteCapsule] = {
            type: fluid,
            amount: infiniteCapacity,
            output: infiniteCapsule,
            infinite: true,
        };
    }
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
const gasOutputs = {};
const gasFamilies = {
    steam_capsule: "steam",
    hydrogen_capsule: "hydrogen_gas",
    oxygen_capsule: "oxygen_gas",
    methane_capsule: "methane_gas",
    heated_saline_coolant_capsule: "heated_saline_coolant_gas",
    fluorine_capsule: "fluorine_gas",
    hydrogen_fluoride_capsule: "hydrogen_fluoride_gas",
    natural_uranium_hexafluoride_capsule: "natural_uranium_hexafluoride_gas",
    enriched_uranium_hexafluoride_capsule: "enriched_uranium_hexafluoride_gas",
    depleted_uranium_hexafluoride_capsule: "depleted_uranium_hexafluoride_gas",
    nuclear_waste_capsule: "nuclear_waste_gas",
};

for (const [capsule, gas] of Object.entries(gasFamilies)) {
    for (let tier = 1; tier <= 8; tier++) {
        gasItems[`utilitycraft:${capsule}_${tier}`] = {
            type: gas,
            amount: tier * 1000,
            output: emptyCapsule,
        };
    }
    gasOutputs[gas] = `utilitycraft:${capsule}_8`;
}

DoriosLib.registry.registerGasItem(gasItems);
DoriosLib.registry.registerGasHolder({
    [emptyCapsule]: {
        types: gasOutputs,
        required: capsuleCapacity,
    },
});

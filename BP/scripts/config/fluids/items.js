import { system, world } from "@minecraft/server";

const RegisterContainer = "utilitycraft:register_fluid_container";
const RegisterOutput = "utilitycraft:register_fluid_output";

const ATNewCapsules = [
    // Ascendant Technology Expansion
    { id: "utilitycraft:aetherium_liquid_capsule_1", amount: 1000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_2", amount: 2000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_3", amount: 3000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_4", amount: 4000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_5", amount: 5000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_6", amount: 6000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_7", amount: 7000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:aetherium_liquid_capsule_8", amount: 8000, type: "liquified_aetherium", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_1", amount: 1000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_2", amount: 2000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_3", amount: 3000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_4", amount: 4000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_5", amount: 5000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_6", amount: 6000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_7", amount: 7000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:dark_matter_liquid_capsule_8", amount: 8000, type: "dark_matter", output: "utilitycraft:empty_liquid_capsule" },
    // Cryofluid capsules
    { id: "utilitycraft:cryofluid_capsule_1", amount: 1000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_2", amount: 2000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_3", amount: 3000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_4", amount: 4000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_5", amount: 5000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_6", amount: 6000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_7", amount: 7000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:cryofluid_capsule_8", amount: 8000, type: "cryofluid", output: "utilitycraft:empty_liquid_capsule" },
];

const ATNewContainers = [
    {
        id: "utilitycraft:empty_liquid_capsule",
        amount: { min: 1000, max: 8000 },
        fills: {
            liquified_aetherium: "utilitycraft:aetherium_liquid_capsule_8",
            dark_matter: "utilitycraft:dark_matter_liquid_capsule_8",
            cryofluid: "utilitycraft:cryofluid_capsule_8",
        }
    }
];

function sendRegistration(eventId, payload) {
    if (!payload || payload.length === 0) return;
    system.sendScriptEvent(eventId, JSON.stringify(payload));
}

world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        sendRegistration(RegisterContainer, ATNewCapsules);
        sendRegistration(RegisterOutput, ATNewContainers);
    }, 0);
});

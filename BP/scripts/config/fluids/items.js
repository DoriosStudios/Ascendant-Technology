import { system, world } from "@minecraft/server";

const RegisterContainer = "utilitycraft:register_fluid_container";
const RegisterOutput = "utilitycraft:register_fluid_output";
const RegisterLegacyContainer = "utilitycraft:register_fluid_item";
const RegisterLegacyHolder = "utilitycraft:register_fluid_holder";

const INFINITE_CAPSULE_FALLBACK_MB = 512000;

const ATInfiniteCapsules = [
    {
        id: "utilitycraft:aetherium_liquid_capsule_infinite",
        amount: 512000,
        type: "liquified_aetherium",
        output: "utilitycraft:aetherium_liquid_capsule_infinite"
    },
    {
        id: "utilitycraft:dark_matter_liquid_capsule_infinite",
        amount: 512000,
        type: "dark_matter",
        output: "utilitycraft:dark_matter_liquid_capsule_infinite"
    },
    {
        id: "utilitycraft:cryofluid_capsule_infinite",
        amount: 512000,
        type: "cryofluid",
        output: "utilitycraft:cryofluid_capsule_infinite"
    },
    {
        id: "utilitycraft:water_capsule_infinite",
        amount: INFINITE_CAPSULE_FALLBACK_MB,
        type: "water",
        output: "utilitycraft:water_capsule_infinite"
    },
    {
        id: "utilitycraft:lava_capsule_infinite",
        amount: INFINITE_CAPSULE_FALLBACK_MB,
        type: "lava",
        output: "utilitycraft:lava_capsule_infinite"
    },
    {
        id: "utilitycraft:milk_capsule_infinite",
        amount: INFINITE_CAPSULE_FALLBACK_MB,
        type: "milk",
        output: "utilitycraft:milk_capsule_infinite"
    },
    {
        id: "utilitycraft:xp_capsule_infinite",
        amount: INFINITE_CAPSULE_FALLBACK_MB,
        type: "xp",
        output: "utilitycraft:xp_capsule_infinite"
    }
];

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
    ...ATInfiniteCapsules,
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

const ATLegacyCapsules = Object.fromEntries(
    ATNewCapsules.map(({ id, amount, type, output }) => [id, { amount, type, output }])
);

function resolveLegacyRequired(value) {
    if (typeof value === "number") return value;
    if (Array.isArray(value)) return Math.max(...value.map(Number).filter(Number.isFinite));
    if (value && typeof value === "object") {
        const max = Number(value.max ?? value.maximum ?? value[1] ?? value.min ?? value.minimum ?? value[0]);
        return Number.isFinite(max) ? max : 0;
    }
    return 0;
}

const ATLegacyHolders = Object.fromEntries(
    ATNewContainers
        .filter(entry => entry && entry.id && entry.fills)
        .map(entry => {
            const required = resolveLegacyRequired(entry.amount);
            return [entry.id, { types: { ...entry.fills }, required }];
        })
);

function sendRegistration(eventId, payload) {
    if (!payload || payload.length === 0) return;
    system.sendScriptEvent(eventId, JSON.stringify(payload));
}

world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        sendRegistration(RegisterContainer, ATNewCapsules);
        sendRegistration(RegisterOutput, ATNewContainers);
        sendRegistration(RegisterLegacyContainer, ATLegacyCapsules);
        sendRegistration(RegisterLegacyHolder, ATLegacyHolders);
    }, 0);
});

import { system, world } from "@minecraft/server";

const FLUID_ITEM_EVENTS = Object.freeze({
    registerContainer: "utilitycraft:register_fluid_container",
    registerOutput: "utilitycraft:register_fluid_output",
    registerLegacyContainer: "utilitycraft:register_fluid_item",
    registerLegacyHolder: "utilitycraft:register_fluid_holder"
});

const FLUID_ITEM_DEFAULTS = Object.freeze({
    infiniteCapsuleFallbackMb: 512000
});

const ATInfiniteCapsules = [
    {
        id: "utilitycraft:aetherium_liquid_capsule_infinite",
        amount: 512000,
        infinite: true,
        type: "liquified_aetherium",
        output: "utilitycraft:aetherium_liquid_capsule_infinite"
    },
    {
        id: "utilitycraft:dark_matter_liquid_capsule_infinite",
        amount: 512000,
        infinite: true,
        type: "dark_matter",
        output: "utilitycraft:dark_matter_liquid_capsule_infinite"
    },
    {
        id: "utilitycraft:cryofluid_capsule_infinite",
        amount: 512000,
        infinite: true,
        type: "cryofluid",
        output: "utilitycraft:cryofluid_capsule_infinite"
    },
    {
        id: "utilitycraft:water_capsule_infinite",
        amount: FLUID_ITEM_DEFAULTS.infiniteCapsuleFallbackMb,
        infinite: true,
        type: "water",
        output: "utilitycraft:water_capsule_infinite"
    },
    {
        id: "utilitycraft:lava_capsule_infinite",
        amount: FLUID_ITEM_DEFAULTS.infiniteCapsuleFallbackMb,
        infinite: true,
        type: "lava",
        output: "utilitycraft:lava_capsule_infinite"
    },
    {
        id: "utilitycraft:milk_capsule_infinite",
        amount: FLUID_ITEM_DEFAULTS.infiniteCapsuleFallbackMb,
        infinite: true,
        type: "milk",
        output: "utilitycraft:milk_capsule_infinite"
    },
    {
        id: "utilitycraft:xp_capsule_infinite",
        amount: FLUID_ITEM_DEFAULTS.infiniteCapsuleFallbackMb,
        infinite: true,
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
    // Vanilla fluid capsules
    { id: "utilitycraft:water_capsule_1", amount: 1000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_2", amount: 2000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_3", amount: 3000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_4", amount: 4000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_5", amount: 5000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_6", amount: 6000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_7", amount: 7000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:water_capsule_8", amount: 8000, type: "water", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_1", amount: 1000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_2", amount: 2000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_3", amount: 3000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_4", amount: 4000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_5", amount: 5000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_6", amount: 6000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_7", amount: 7000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:lava_capsule_8", amount: 8000, type: "lava", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_1", amount: 1000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_2", amount: 2000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_3", amount: 3000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_4", amount: 4000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_5", amount: 5000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_6", amount: 6000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_7", amount: 7000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:xp_capsule_8", amount: 8000, type: "xp", output: "utilitycraft:empty_liquid_capsule" },
    // Steam capsules (migrated from legacy gas registry)
    { id: "utilitycraft:steam_capsule_1", amount: 1000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_2", amount: 2000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_3", amount: 3000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_4", amount: 4000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_5", amount: 5000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_6", amount: 6000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_7", amount: 7000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_8", amount: 8000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
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
            water: "utilitycraft:water_capsule_8",
            lava: "utilitycraft:lava_capsule_8",
            xp: "utilitycraft:xp_capsule_8",
            steam: "utilitycraft:steam_capsule_8",
        }
    }
];

const ATLegacyCapsules = Object.fromEntries(
    ATNewCapsules.map(({ id, ...definition }) => [id, { ...definition }])
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
        sendRegistration(FLUID_ITEM_EVENTS.registerContainer, ATNewCapsules);
        sendRegistration(FLUID_ITEM_EVENTS.registerOutput, ATNewContainers);
        sendRegistration(FLUID_ITEM_EVENTS.registerLegacyContainer, ATLegacyCapsules);
        sendRegistration(FLUID_ITEM_EVENTS.registerLegacyHolder, ATLegacyHolders);
    }, 0);
});

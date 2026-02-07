import { system, world } from "@minecraft/server";

const RegisterGasContainer = "utilitycraft:register_gas_container";
const RegisterGasOutput = "utilitycraft:register_gas_output";
const RegisterLegacyGasItem = "utilitycraft:register_gas_item";
const RegisterLegacyGasHolder = "utilitycraft:register_gas_holder";

const ATGasCapsules = [
    { id: "utilitycraft:steam_capsule_1", amount: 1000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_2", amount: 2000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_3", amount: 3000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_4", amount: 4000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_5", amount: 5000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_6", amount: 6000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_7", amount: 7000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
    { id: "utilitycraft:steam_capsule_8", amount: 8000, type: "steam", output: "utilitycraft:empty_liquid_capsule" },
];

const ATGasContainers = [
    {
        id: "utilitycraft:empty_liquid_capsule",
        amount: { min: 1000, max: 8000 },
        fills: {
            steam: "utilitycraft:steam_capsule_8",
        }
    }
];

const ATLegacyGasCapsules = Object.fromEntries(
    ATGasCapsules.map(({ id, amount, type, output }) => [id, { amount, type, output }])
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

const ATLegacyGasHolders = Object.fromEntries(
    ATGasContainers
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
        sendRegistration(RegisterGasContainer, ATGasCapsules);
        sendRegistration(RegisterGasOutput, ATGasContainers);
        sendRegistration(RegisterLegacyGasItem, ATLegacyGasCapsules);
        sendRegistration(RegisterLegacyGasHolder, ATLegacyGasHolders);
    }, 0);
});

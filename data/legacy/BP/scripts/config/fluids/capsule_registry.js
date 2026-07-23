export const FLUID_CAPSULE_COMPONENT_ID = "utilitycraft:fluid_capsule";
export const FLUID_CAPSULE_EMPTY_ID = "utilitycraft:empty_liquid_capsule";
export const FLUID_CAPSULE_EMPTY_FLUID = "empty";
export const FLUID_CAPSULE_STEP_AMOUNT = 1000;
export const FLUID_CAPSULE_MAX_TIER = 8;
export const FLUID_CAPSULE_MAX_AMOUNT = FLUID_CAPSULE_STEP_AMOUNT * FLUID_CAPSULE_MAX_TIER;
export const FLUID_CAPSULE_INFINITE_STORAGE_MB = 512000;

export const FLUID_CAPSULE_WORLD_FLUIDS = Object.freeze({
    blockByType: Object.freeze({
        water: "minecraft:water",
        lava: "minecraft:lava"
    }),
    typeByBlock: Object.freeze({
        "minecraft:water": "water",
        "minecraft:lava": "lava"
    })
});

const FINITE_FLUID_CAPSULES = Object.freeze([
    { id: "utilitycraft:aetherium_liquid_capsule_1", amount: 1000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_2", amount: 2000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_3", amount: 3000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_4", amount: 4000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_5", amount: 5000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_6", amount: 6000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_7", amount: 7000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:aetherium_liquid_capsule_8", amount: 8000, type: "liquified_aetherium", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_1", amount: 1000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_2", amount: 2000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_3", amount: 3000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_4", amount: 4000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_5", amount: 5000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_6", amount: 6000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_7", amount: 7000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:dark_matter_liquid_capsule_8", amount: 8000, type: "dark_matter", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_1", amount: 1000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_2", amount: 2000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_3", amount: 3000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_4", amount: 4000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_5", amount: 5000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_6", amount: 6000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_7", amount: 7000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:cryofluid_capsule_8", amount: 8000, type: "cryofluid", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_1", amount: 1000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_2", amount: 2000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_3", amount: 3000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_4", amount: 4000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_5", amount: 5000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_6", amount: 6000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_7", amount: 7000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:water_capsule_8", amount: 8000, type: "water", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_1", amount: 1000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_2", amount: 2000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_3", amount: 3000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_4", amount: 4000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_5", amount: 5000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_6", amount: 6000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_7", amount: 7000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:lava_capsule_8", amount: 8000, type: "lava", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_1", amount: 1000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_2", amount: 2000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_3", amount: 3000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_4", amount: 4000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_5", amount: 5000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_6", amount: 6000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_7", amount: 7000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:xp_capsule_8", amount: 8000, type: "xp", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_1", amount: 1000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_2", amount: 2000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_3", amount: 3000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_4", amount: 4000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_5", amount: 5000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_6", amount: 6000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_7", amount: 7000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID },
    { id: "utilitycraft:steam_capsule_8", amount: 8000, type: "steam", output: FLUID_CAPSULE_EMPTY_ID }
]);

const INFINITE_FLUID_CAPSULES = Object.freeze([
    { id: "utilitycraft:aetherium_liquid_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "liquified_aetherium", output: "utilitycraft:aetherium_liquid_capsule_infinite" },
    { id: "utilitycraft:dark_matter_liquid_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "dark_matter", output: "utilitycraft:dark_matter_liquid_capsule_infinite" },
    { id: "utilitycraft:cryofluid_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "cryofluid", output: "utilitycraft:cryofluid_capsule_infinite" },
    { id: "utilitycraft:water_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "water", output: "utilitycraft:water_capsule_infinite" },
    { id: "utilitycraft:lava_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "lava", output: "utilitycraft:lava_capsule_infinite" },
    { id: "utilitycraft:milk_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "milk", output: "utilitycraft:milk_capsule_infinite" },
    { id: "utilitycraft:xp_capsule_infinite", amount: FLUID_CAPSULE_INFINITE_STORAGE_MB, infinite: true, type: "xp", output: "utilitycraft:xp_capsule_infinite" }
]);

const EMPTY_FLUID_CAPSULE_DEFINITION = Object.freeze({
    id: FLUID_CAPSULE_EMPTY_ID,
    amount: 0,
    type: FLUID_CAPSULE_EMPTY_FLUID,
    output: null
});

export const FLUID_CAPSULE_REGISTRATIONS = Object.freeze([
    ...FINITE_FLUID_CAPSULES,
    ...INFINITE_FLUID_CAPSULES
]);

const MAX_FINITE_CAPSULE_BY_TYPE = new Map();
for (const definition of FINITE_FLUID_CAPSULES) {
    const current = MAX_FINITE_CAPSULE_BY_TYPE.get(definition.type);
    if (!current || definition.amount > current.amount) {
        MAX_FINITE_CAPSULE_BY_TYPE.set(definition.type, definition);
    }
}

export const FLUID_CAPSULE_OUTPUT_REGISTRATIONS = Object.freeze([
    Object.freeze({
        id: FLUID_CAPSULE_EMPTY_ID,
        amount: Object.freeze({ min: FLUID_CAPSULE_STEP_AMOUNT, max: FLUID_CAPSULE_MAX_AMOUNT }),
        fills: Object.freeze(Object.fromEntries(
            [...MAX_FINITE_CAPSULE_BY_TYPE.entries()].map(([type, definition]) => [type, definition.id])
        ))
    })
]);

export const FLUID_CAPSULE_LEGACY_CONTAINER_REGISTRATIONS = Object.freeze(
    Object.fromEntries(FLUID_CAPSULE_REGISTRATIONS.map(({ id, ...definition }) => [id, { ...definition }]))
);

export const FLUID_CAPSULE_LEGACY_HOLDER_REGISTRATIONS = Object.freeze(
    Object.fromEntries(
        FLUID_CAPSULE_OUTPUT_REGISTRATIONS.map(entry => [
            entry.id,
            {
                types: { ...entry.fills },
                required: Number(entry.amount?.max ?? entry.amount) || 0
            }
        ])
    )
);

const CAPSULE_DEFINITION_BY_ID = new Map([
    [FLUID_CAPSULE_EMPTY_ID, EMPTY_FLUID_CAPSULE_DEFINITION],
    ...FLUID_CAPSULE_REGISTRATIONS.map(definition => [definition.id, Object.freeze({ ...definition })])
]);

const FINITE_CAPSULE_ID_BY_KEY = new Map(
    FINITE_FLUID_CAPSULES.map(definition => [`${definition.type}:${definition.amount}`, definition.id])
);

const INFINITE_CAPSULE_ID_BY_TYPE = new Map(
    INFINITE_FLUID_CAPSULES.map(definition => [definition.type, definition.id])
);

function sanitizeFluidType(value) {
    return typeof value === "string"
        ? value.trim().toLowerCase()
        : "";
}

function normalizeFiniteAmount(value) {
    const numeric = Math.floor(Number(value) || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    const tier = Math.max(1, Math.min(FLUID_CAPSULE_MAX_TIER, Math.floor(numeric / FLUID_CAPSULE_STEP_AMOUNT)));
    return tier * FLUID_CAPSULE_STEP_AMOUNT;
}

export function getFluidCapsuleDefinitionById(itemId) {
    if (typeof itemId !== "string" || itemId.length === 0) return null;
    return CAPSULE_DEFINITION_BY_ID.get(itemId) ?? null;
}

export function getFluidCapsuleFluidTypeFromBlockId(blockId) {
    if (typeof blockId !== "string" || blockId.length === 0) return null;
    return FLUID_CAPSULE_WORLD_FLUIDS.typeByBlock[blockId] ?? null;
}

export function getFluidCapsuleFluidBlockId(fluidType) {
    const normalized = sanitizeFluidType(fluidType);
    return FLUID_CAPSULE_WORLD_FLUIDS.blockByType[normalized] ?? null;
}

export function getFluidCapsuleItemId(fluidType, amount, options = undefined) {
    const normalizedFluidType = sanitizeFluidType(fluidType);
    const infinite = options?.infinite === true;

    if (!normalizedFluidType || normalizedFluidType === FLUID_CAPSULE_EMPTY_FLUID || Number(amount) <= 0) {
        return FLUID_CAPSULE_EMPTY_ID;
    }

    if (infinite) {
        return INFINITE_CAPSULE_ID_BY_TYPE.get(normalizedFluidType) ?? null;
    }

    const normalizedAmount = normalizeFiniteAmount(amount);
    if (normalizedAmount <= 0) return FLUID_CAPSULE_EMPTY_ID;
    return FINITE_CAPSULE_ID_BY_KEY.get(`${normalizedFluidType}:${normalizedAmount}`) ?? null;
}

export function normalizeFluidCapsuleParams(rawParams, fallbackItemId = undefined) {
    const fallback = getFluidCapsuleDefinitionById(fallbackItemId);
    const normalizedFluidType = sanitizeFluidType(rawParams?.fluid ?? rawParams?.type ?? fallback?.type ?? FLUID_CAPSULE_EMPTY_FLUID);
    const infinite = rawParams?.infinite === true || fallback?.infinite === true;
    const rawAmount = rawParams?.amount ?? fallback?.amount ?? 0;

    if (!normalizedFluidType || normalizedFluidType === FLUID_CAPSULE_EMPTY_FLUID) {
        return Object.freeze({
            fluid: FLUID_CAPSULE_EMPTY_FLUID,
            amount: 0,
            infinite: false
        });
    }

    if (infinite) {
        const normalizedAmount = Math.max(FLUID_CAPSULE_STEP_AMOUNT, Math.floor(Number(rawAmount) || FLUID_CAPSULE_MAX_AMOUNT));
        return Object.freeze({
            fluid: normalizedFluidType,
            amount: normalizedAmount,
            infinite: true
        });
    }

    const normalizedAmount = normalizeFiniteAmount(rawAmount);
    if (normalizedAmount <= 0) {
        return Object.freeze({
            fluid: FLUID_CAPSULE_EMPTY_FLUID,
            amount: 0,
            infinite: false
        });
    }

    return Object.freeze({
        fluid: normalizedFluidType,
        amount: normalizedAmount,
        infinite: false
    });
}
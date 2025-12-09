const DEFAULT_ENERGY_COST = 9600;
const DEFAULT_SECONDS = 5;
const TICKS_PER_SECOND = 20;

/**
 * @typedef {Object} EnergizerRecipe
 * @property {string} id
 * @property {{ id: string, amount: number }} input
 * @property {{ id: string, amount: number }} output
 * @property {number} energyCost
 * @property {number} ticks
 * @property {number} seconds
 * @property {string | null} [description]
 * @property {('primary'|'aux')} [preferredSlot]
 */

const nativeEnergizerRecipes = [
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_ingot",
        input: { id: "minecraft:iron_ingot", amount: 1 },
        output: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
        energyCost: 96000,
        seconds: 4,
        description: "Baseline conversion that unlocks energized metals early-game."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:raw_energized_iron",
        input: { id: "minecraft:raw_iron", amount: 1 },
        output: { id: "utilitycraft:raw_energized_iron", amount: 1 },
        energyCost: 104000,
        seconds: 5,
        description: "Raw ores get energized directly so furnaces output the good stuff."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_block",
        input: { id: "utilitycraft:steel_block", amount: 1 },
        output: { id: "utilitycraft:energized_iron_block", amount: 1 },
        energyCost: 1820000,
        seconds: 18,
        description: "Bulk recipe for automation lines feeding higher-tier machines."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_ingot_from_steel",
        input: { id: "utilitycraft:steel_ingot", amount: 1 },
        output: { id: "utilitycraft:energized_iron_ingot", amount: 1 },
        energyCost: 88000,
        seconds: 3,
        description: "Steel shortcuts into energized iron when you are swimming in alloys."
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energized_iron_dust",
        input: { id: "utilitycraft:iron_dust", amount: 1 },
        output: { id: "utilitycraft:energized_iron_dust", amount: 1 },
        energyCost: 72000,
        seconds: 3,
        description: "Dust-tier conversion tuned for auxiliary slot batching.",
        preferredSlot: "aux"
    }),
    defineEnergizerRecipe({
        id: "utilitycraft:energy_upgrade_charge",
        input: { id: "minecraft:redstone_block", amount: 1 },
        output: { id: "utilitycraft:energy_upgrade", amount: 1 },
        energyCost: 2400000,
        seconds: 8,
        description: "Overcharges compacted redstone into an Energy Upgrade module."
    })
];

export function getEnergizerRecipes() {
    return nativeEnergizerRecipes;
}

export const energizerRecipes = getEnergizerRecipes();

function defineEnergizerRecipe(payload) {
    if (!payload || typeof payload !== "object") {
        throw new TypeError("Invalid energizer recipe payload");
    }

    const input = normalizeStack(payload.input, 1);
    const output = normalizeStack(payload.output, 1);
    const seconds = clampSeconds(payload.seconds ?? DEFAULT_SECONDS);

    return {
        id: typeof payload.id === "string" && payload.id.length ? payload.id : input.id,
        input,
        output,
        energyCost: Math.max(1, Math.floor(payload.energyCost ?? DEFAULT_ENERGY_COST)),
        ticks: seconds * TICKS_PER_SECOND,
        seconds,
        description: typeof payload.description === "string" ? payload.description : null,
        preferredSlot: payload.preferredSlot === "aux" ? "aux" : "primary"
    };
}

function normalizeStack(stack, fallbackAmount = 1) {
    if (!stack) throw new TypeError("Energizer recipe missing stack definition");

    if (typeof stack === "string") {
        return { id: stack, amount: fallbackAmount };
    }

    if (typeof stack === "object" && typeof stack.id === "string") {
        const amount = Math.max(1, Math.floor(stack.amount ?? fallbackAmount));
        return { id: stack.id, amount };
    }

    throw new TypeError("Invalid stack entry for energizer recipe");
}

function clampSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SECONDS;
    return Math.max(1, Math.floor(parsed));
}

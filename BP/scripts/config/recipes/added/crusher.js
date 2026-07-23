/** @type {Readonly<Record<string, { output: string, amount: number, cost: number, tier: number }>>} */
export const crusherRecipeAdditions = Object.freeze({
    "utilitycraft:titanium_chunk": {
        output: "utilitycraft:raw_titanium",
        amount: 1,
        cost: 2400,
        tier: 5,
    },
    "utilitycraft:titanium": {
        output: "utilitycraft:titanium_dust",
        amount: 1,
        cost: 2400,
        tier: 5,
    },
    "utilitycraft:raw_titanium": {
        output: "utilitycraft:titanium_dust",
        amount: 2,
        cost: 2400,
        tier: 5,
    },
    "utilitycraft:raw_titanium_block": {
        output: "utilitycraft:titanium_dust",
        amount: 6,
        cost: 21600,
        tier: 5,
    },
});

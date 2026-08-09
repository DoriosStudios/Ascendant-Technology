// @ts-check

export const CRYOFLUID_SYNTHESIS_RECIPE = Object.freeze({
    energyCost: 6_000,
    water: 1_000,
    cryofluid: 1_000,
    inputs: Object.freeze({
        titanium: Object.freeze({
            requiredValue: 8,
            alternatives: Object.freeze({
                "utilitycraft:titanium": 8,
                "utilitycraft:titanium_plate": 8,
                "utilitycraft:raw_titanium": 4,
                "utilitycraft:titanium_dust": 2,
                "utilitycraft:titanium_chunk": 2,
                "utilitycraft:titanium_nugget": 1,
            }),
        }),
        lapis: Object.freeze({
            requiredValue: 1,
            alternatives: Object.freeze({
                "minecraft:lapis_lazuli": 1,
                "minecraft:lapis_block": 9,
            }),
        }),
    }),
});

export function getCryofluidSynthesisInputValue(group, typeId) {
    return Math.max(0, Number(group?.alternatives?.[typeId]) || 0);
}

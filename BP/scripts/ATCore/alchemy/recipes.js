import { ALCHEMY, POTION_FAMILIES, potionEffects } from "../../config/alchemy.js";

const getFamily = p => POTION_FAMILIES.find(f => f.id === p?.family);
const duration = p => potionEffects(p)[0]?.duration ?? 0;

/** One upgrade only. The two UI sections queue their own transactions. */
export function resolvePotionUpgrade(p, operation) {
    const f = getFamily(p);
    if (!f) return null;
    if (operation === "amplify") {
        if (p.level >= f.maxLevel) return null;
        return { ...p, level: p.level + 1, duration: duration(p) };
    }
    if (operation !== "extend" || f.instant || p.extent === "maximum") return null;
    const extent = p.extent === "normal" ? "long" : "maximum";
    return { ...p, extent, duration: (p.longDuration ?? f.long) * (extent === "maximum" ? 4 : 1) };
}

export function resolveBrew(p, ingredient) {
    if (!p) return null;
    if (ingredient === "minecraft:gunpowder" && p.form === "drink") return { ...p, form: "splash" };
    if (ingredient === "minecraft:dragon_breath" && p.form === "splash") return { ...p, form: "lingering" };
    if (ingredient === "minecraft:nether_wart" && p.family === "water") return { ...p, family: "awkward" };
    if (ingredient === "minecraft:glowstone_dust" && p.family === "water") return { ...p, family: "thick" };
    if (ingredient === "minecraft:redstone" && p.family === "water") return { ...p, family: "mundane" };
    if (ingredient === "minecraft:fermented_spider_eye") {
        const corruptions = { water: "weakness", awkward: "weakness", mundane: "weakness", thick: "weakness",
            healing: "harming", poison: "harming", swiftness: "slowness", leaping: "slowness", nightvision: "invisibility" };
        const target = corruptions[p.family];
        if (target) {
            const f = POTION_FAMILIES.find(f => f.id === target);
            const level = Math.min(p.level, f.maxLevel);
            return { ...p, family: target, level, extent: f.instant ? "normal" : p.extent, duration: undefined, longDuration: undefined };
        }
    }
    if (ingredient === "minecraft:redstone") {
        const f = getFamily(p);
        if (f && !f.instant && p.level === 1 && p.extent === "normal") return { ...p, extent: "long", duration: undefined };
    }
    if (ingredient === "minecraft:glowstone_dust") {
        const f = getFamily(p);
        if (f && f.maxLevel > 1 && p.level === 1 && p.extent === "normal") return {
            ...p, level: f.strongLevel ?? 2, duration: f.strong ?? f.normal,
        };
    }
    if (p.family !== "awkward") return null;
    const f = POTION_FAMILIES.find(f => f.ingredient === ingredient && f.id !== "weakness");
    return f ? { family: f.id, level: 1, extent: "normal", form: p.form } : null;
}

export function planBrewingBatch(bottles, ingredient) {
    const changes = bottles.flatMap(({ slot, potion }) => {
        const output = resolveBrew(potion, ingredient);
        return output ? [{ slot, output }] : [];
    });
    return changes.length ? { changes, ingredientCount: 1, blaze: ALCHEMY.blazePerBrew,
        energy: ALCHEMY.brewEnergy, ticks: ALCHEMY.brewTicks } : null;
}

// Source for the first tab's generated recipe book.
export const BREWING_RECIPES = [
    { input: "water", ingredient: "minecraft:nether_wart", output: "awkward" },
    { input: "water", ingredient: "minecraft:fermented_spider_eye", output: "weakness" },
    { input: "water", ingredient: "minecraft:glowstone_dust", output: "thick" },
    { input: "water", ingredient: "minecraft:redstone", output: "mundane" },
    ...POTION_FAMILIES.filter(f => f.ingredient && f.id !== "weakness").map(f => ({ input: "awkward", ingredient: f.ingredient, output: f.id })),
    ...Object.entries({ healing: "harming", poison: "harming", swiftness: "slowness", leaping: "slowness", nightvision: "invisibility" })
        .map(([input, output]) => ({ input, ingredient: "minecraft:fermented_spider_eye", output })),
    { input: "Level I", ingredient: "minecraft:redstone", output: "Long I" },
    { input: "Level I", ingredient: "minecraft:glowstone_dust", output: "Strong (when supported)" },
    { input: "Drink", ingredient: "minecraft:gunpowder", output: "Splash" },
    { input: "Splash", ingredient: "minecraft:dragon_breath", output: "Lingering" },
];

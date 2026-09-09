import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { getCompactorRecipe, getCompactorRecipes } from "../BP/scripts/config/recipes/compactor.js";
import { getDecompactorRecipe } from "../BP/scripts/config/recipes/decompactor.js";

const root = resolve(import.meta.dirname, "..");
const dependency = resolve(process.argv[2] ?? join(root, "../UtilityCraft"));
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const files = (folder) =>
    readdirSync(folder, { recursive: true }).filter((file) => file.endsWith(".json"));
const smallItems = new Set();
for (const file of files(join(dependency, "BP/items/materials"))) {
    if (!file.replaceAll("\\", "/").startsWith("pebbles/") && !file.endsWith("_nugget.json"))
        continue;
    smallItems.add(
        json(join(dependency, "BP/items/materials", file))["minecraft:item"].description.identifier,
    );
}

// Geodes are opened in the Crusher; they have no small-to-solid crafting recipe.
const excluded = new Set(["utilitycraft:geode"]);
const expected = new Map();
for (const file of files(join(dependency, "BP/recipes"))) {
    const source = readFileSync(join(dependency, "BP/recipes", file), "utf8");
    // Only inspect potentially relevant material recipes, avoiding unrelated JSONC.
    if (
        ![
            ...smallItems,
            "utilitycraft:silicon",
            "utilitycraft:steel_ingot",
            "utilitycraft:energized_iron_ingot",
            "utilitycraft:raw_steel",
            "utilitycraft:raw_energized_iron",
        ].some((id) => source.includes(`"${id}"`))
    )
        continue;
    const data = JSON.parse(source);
    const recipe = data["minecraft:recipe_shaped"] ?? data["minecraft:recipe_shapeless"];
    if (!recipe || !recipe.tags.includes("crafting_table")) continue;
    const ingredients = recipe.pattern
        ? [...recipe.pattern.join("")]
              .filter((symbol) => symbol !== " ")
              .map((symbol) => recipe.key[symbol])
        : recipe.ingredients;
    if (
        !ingredients.length ||
        !ingredients.every((item) => item.item && item.item === ingredients[0].item)
    )
        continue;
    const input = ingredients[0].item;
    const required = ingredients.reduce((sum, item) => sum + (item.count ?? 1), 0);
    const result = recipe.result;
    if (Array.isArray(result)) continue;
    const output = typeof result === "string" ? result : result.item;
    const amount = typeof result === "string" ? 1 : (result.count ?? 1);
    // Exclude decompression, smelting, plates and multi-material crafting.
    if (required <= amount || required > 9 || input === output) continue;
    const id = `${input}>${output}:${required}:${amount}`;
    expected.set(id, { input, output, required, amount, file });
}

const registered = getCompactorRecipes();
const missing = [];
for (const recipe of expected.values()) {
    const actual = registered.find(
        (entry) =>
            entry.input === recipe.input &&
            entry.output === recipe.output &&
            entry.required === recipe.required &&
            entry.amount === recipe.amount,
    );
    if (!actual) {
        missing.push(
            `${recipe.required} ${recipe.input} -> ${recipe.amount} ${recipe.output} (${recipe.file})`,
        );
        continue;
    }
    assert.equal(
        getCompactorRecipe(actual.input, actual.required)?.output,
        actual.output,
        "A full batch must select the correct material recipe",
    );
    assert.ok(
        getCompactorRecipe(actual.input, actual.required - 1).required > actual.required - 1,
        "A partial batch must not be processed as a full batch",
    );
    const reverse = getDecompactorRecipe(actual.output);
    assert.ok(
        reverse &&
            reverse.output === actual.input &&
            reverse.required === actual.amount &&
            reverse.amount === actual.required,
        `Exact reverse for ${actual.output}`,
    );
}
assert.equal(
    missing.length,
    0,
    `Missing or incorrect UtilityCraft compactions:\n${missing.join("\n")}`,
);
for (const input of smallItems) {
    if (excluded.has(input)) {
        assert.ok(!getCompactorRecipe(input, 64), "Geodes keep their Crusher processing");
    } else {
        assert.ok(
            [...expected.values()].some((entry) => entry.input === input),
            `No source recipe found for small item ${input}`,
        );
    }
}
console.log(
    `Compactor source audit passed: ${expected.size} UtilityCraft recipes; ${smallItems.size - excluded.size} compactable small items; exact quantities and reversals.`,
);

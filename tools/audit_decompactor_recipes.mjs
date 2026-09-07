import {
  getCompactorRecipeCount,
  getCompactorRecipes,
} from "../BP/scripts/config/recipes/compactor.js";
import {
  getDecompactorConflictCount,
  getDecompactorRecipe,
  getDecompactorRecipeCount,
} from "../BP/scripts/config/recipes/decompactor.js";

const compactorRecipes = getCompactorRecipes();
const compactorCount = getCompactorRecipeCount();
const decompactorCount = getDecompactorRecipeCount();
const conflictCount = getDecompactorConflictCount();

if (compactorRecipes.length !== compactorCount) {
  fail(`Compactor snapshot has ${compactorRecipes.length} recipes; expected ${compactorCount}.`);
}
if (decompactorCount !== compactorCount) {
  fail(`Decompactor has ${decompactorCount} recipes; expected ${compactorCount}.`);
}
if (conflictCount !== 0) {
  fail(`Decompactor has ${conflictCount} ambiguous compacted input(s).`);
}

for (const compacting of compactorRecipes) {
  const reverse = getDecompactorRecipe(compacting.output);
  if (!reverse) fail(`Missing reverse recipe for ${compacting.output}.`);
  if (
    reverse.output !== compacting.input
    || reverse.required !== compacting.amount
    || reverse.amount !== compacting.required
    || reverse.cost !== compacting.cost
    || reverse.ticks !== compacting.ticks
  ) {
    fail(`Incorrect reverse recipe for ${compacting.output}.`);
  }
}

if (getDecompactorRecipe("minecraft:crafting_table")) {
  fail("Unregistered general reverse-crafting recipe leaked into the Decompactor.");
}

console.log(`Decompactor audit passed: ${decompactorCount} exact reversals, 0 conflicts.`);

function fail(message) {
  console.error(`Decompactor audit failed: ${message}`);
  process.exit(1);
}

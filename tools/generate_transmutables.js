#!/usr/bin/env node
// generate_transmutables.js
// Scans BP/recipes and the Project EMC reference map to infer EMC values
// for items introduced by this pack. Writes a JS file with the mapping that
// can be pasted into `BP/scripts/transmutable_injection_ascendant.js` or
// written directly to a generated injector file.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BP_ROOT = path.join(ROOT, 'BP');
const RECIPES_ROOT = path.join(BP_ROOT, 'recipes');
const REFERENCE_EMC_FILE = path.join(ROOT, 'references', 'project_emc_bp', 'scripts', 'project_emc', 'system', 'transmutable_items.js');

function readFileSyncSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractReferenceEmc(fileText) {
  const marker = 'const TRANSMUTABLE_ITEMS';
  const idx = fileText.indexOf(marker);
  if (idx === -1) return {};
  const after = fileText.slice(idx + marker.length);
  const eq = after.indexOf('=');
  const braceStart = after.indexOf('{', eq);
  if (braceStart === -1) return {};
  let i = braceStart;
  let depth = 0;
  while (i < after.length) {
    const ch = after[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const objText = after.slice(braceStart, i + 1);
        // Evaluate safely by wrapping in parentheses
        try {
          const obj = Function('return (' + objText + ')')();
          const out = {};
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            out[k] = (v && v.emc_value) ? Number(v.emc_value) : undefined;
          }
          return out;
        } catch (e) {
          console.error('Failed to evaluate reference object', e);
          return {};
        }
      }
    }
    i++;
  }
  return {};
}

function walkDir(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const resPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(resPath));
    else if (entry.isFile()) results.push(resPath);
  }
  return results;
}

function parseRecipeFile(p) {
  const text = readFileSyncSafe(p);
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    // Determine output id and count
    let output = null;
    let outputCount = 1;
    if (json.result && typeof json.result === 'object') {
      output = json.result.item || json.result || json.result.output || null;
      if (json.result.count) outputCount = Number(json.result.count);
      else if (json.result.count === undefined && typeof json.result === 'object' && json.result.item) {
        // keep default
      }
    }
    if (!output && json.output) {
      output = json.output;
      if (json.count) outputCount = Number(json.count) || 1;
    }

    if (!output) return null;

    // Gather ingredients
    const inputs = {};

    const addInput = (id, amt = 1) => { if (!id) return; inputs[id] = (inputs[id] || 0) + Number(amt); };

    // Shapeless style: ingredients array
    if (Array.isArray(json.ingredients)) {
      for (const ing of json.ingredients) {
        if (!ing) continue;
        if (typeof ing === 'string') addInput(ing, 1);
        else if (ing.item) addInput(ing.item, ing.count || 1);
        else if (ing.ingredients && Array.isArray(ing.ingredients)) {
          for (const i2 of ing.ingredients) { if (i2.item) addInput(i2.item, i2.count || 1); }
        }
      }
    }

    // Pattern/key style
    if (Array.isArray(json.pattern) && typeof json.key === 'object') {
      const pattern = json.pattern.join('');
      const counts = {};
      for (const ch of pattern) { if (ch !== ' ') counts[ch] = (counts[ch] || 0) + 1; }
      for (const [k, v] of Object.entries(json.key)) {
        if (!v) continue;
        let id = null;
        if (typeof v === 'string') id = v;
        else if (v.item) id = v.item;
        if (id && counts[k]) addInput(id, counts[k]);
      }
    }

    // Some recipes use 'ingredients' nested under 'components' or other shapes; try common keys
    if (json.shape && json.shape.ingredients) {
      for (const ing of json.shape.ingredients) if (ing.item) addInput(ing.item, ing.count || 1);
    }

    return { output: output, outputCount: Number(outputCount || 1), inputs };
  } catch (e) {
    return null;
  }
}

function main() {
  console.log('Generating transmutables mapping...');

  const refText = readFileSyncSafe(REFERENCE_EMC_FILE);
  const refMap = refText ? extractReferenceEmc(refText) : {};
  console.log(`Loaded ${Object.keys(refMap).length} reference EMC entries.`);

  const recipeFiles = walkDir(RECIPES_ROOT).filter(p => p.endsWith('.json'));
  const recipes = [];
  for (const rf of recipeFiles) {
    const r = parseRecipeFile(rf);
    if (r) recipes.push(r);
  }
  console.log(`Parsed ${recipes.length} recipes.`);

  // Iterative propagation
  const emc = Object.assign({}, refMap);
  let changed = true;
  let passes = 0;
  while (changed && passes < 50) {
    changed = false;
    passes++;
    for (const recipe of recipes) {
      const outId = recipe.output;
      if (emc[outId]) continue; // already known
      let sum = 0;
      let ok = true;
      for (const [inId, cnt] of Object.entries(recipe.inputs)) {
        if (emc[inId] === undefined || emc[inId] === null) { ok = false; break; }
        sum += emc[inId] * Number(cnt);
      }
      if (!ok) continue;
      const value = Math.max(1, Math.round(sum / recipe.outputCount));
      emc[outId] = value;
      changed = true;
      // console.log(`Inferred ${outId} = ${value}`);
    }
  }

  const outPath = path.join(ROOT, 'BP', 'scripts', 'transmutable_injection_ascendant.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(emc, null, 2), 'utf8');
  console.log(`Wrote ${Object.keys(emc).length} entries to ${outPath}`);
  console.log('Done. You can copy relevant entries into BP/scripts/transmutable_injection_ascendant.js');
}

main();

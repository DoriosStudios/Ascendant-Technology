import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APPLY = process.argv.includes("--apply");
const MARKER = "// LEGACY_DISABLED ";
const COMMENT = "// ";

// These identifiers are registered by UtilityCraft 3.5.0, which is an explicit
// behavior-pack dependency. They are shared UC contracts, not legacy AT code.
const UC_BLOCK_COMPONENTS = new Set([
  "utilitycraft:battery",
  "utilitycraft:fluid_container",
  "utilitycraft:furnator",
  "utilitycraft:machine_recipes",
  "utilitycraft:magmator",
  "utilitycraft:solar_panel",
  "utilitycraft:thermo_generator",
  "utilitycraft:upgradeable",
  "utilitycraft:wind_turbine",
]);

const UC_ITEM_COMPONENTS = new Set([
  "utilitycraft:dig_pebble",
  "utilitycraft:fishing_net",
  "utilitycraft:hammer",
  "utilitycraft:hoe",
  "utilitycraft:mesh",
  "utilitycraft:shovel",
]);

const TICKED_UC_BLOCK_COMPONENTS = new Set([
  "utilitycraft:battery",
  "utilitycraft:furnator",
  "utilitycraft:magmator",
  "utilitycraft:solar_panel",
  "utilitycraft:thermo_generator",
  "utilitycraft:wind_turbine",
]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function markedPropertyName(line) {
  if (!line.startsWith(MARKER)) return undefined;
  return line.slice(MARKER.length).match(/^\s*"([^"]+)"\s*:/)?.[1];
}

function findValueEnd(source, start) {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index++;

  const opening = source[index];
  if (opening !== "{" && opening !== "[") return undefined;

  const stack = [opening];
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (index += 1; index < source.length; index++) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") stack.push(character);
    if (character === "}" || character === "]") {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }

  return undefined;
}

function restoreMarkedProperties(source, allowedNames) {
  const lines = source.split(/(?<=\n)/);
  const restored = [];

  for (let index = 0; index < lines.length; index++) {
    const propertyName = markedPropertyName(lines[index]);
    if (!propertyName || !allowedNames.has(propertyName)) continue;

    const restoredLines = [lines[index].slice(MARKER.length)];
    const colon = restoredLines[0].indexOf(":", restoredLines[0].lastIndexOf('"') + 1);

    while (findValueEnd(restoredLines.join(""), colon + 1) === undefined) {
      index++;
      if (index >= lines.length) throw new Error(`Unterminated ${propertyName}`);

      const line = lines[index];
      if (line.startsWith(COMMENT)) restoredLines.push(line.slice(COMMENT.length));
      else if (!line.trim()) restoredLines.push(line);
      else throw new Error(`Unexpected line while restoring ${propertyName}: ${line}`);
    }

    const restoredStart = index - restoredLines.length + 1;
    lines.splice(restoredStart, restoredLines.length, ...restoredLines);

    // Disabling a final property can consume its preceding comma. Add it back
    // only when this is not the first active property in the object.
    for (let previous = restoredStart - 1; previous >= 0; previous--) {
      const candidate = lines[previous];
      if (!candidate.trim() || candidate.trimStart().startsWith("//")) continue;

      const ending = candidate.trimEnd().at(-1);
      if (ending !== "{" && ending !== ",") {
        lines[previous] = candidate.replace(/([^\s])([\r\n]*)$/, "$1,$2");
      }
      break;
    }

    index = restoredStart;
    restored.push(propertyName);
  }

  return { source: lines.join(""), restored };
}

function processTree(relativeDirectory, baseComponents, restoreGeneratorTicks) {
  const files = walk(path.join(ROOT, relativeDirectory)).filter((file) => file.endsWith(".json"));
  const restoredByName = new Map();
  let changedFiles = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    const markedNames = original
      .split(/\r?\n/)
      .map(markedPropertyName)
      .filter(Boolean);
    const allowed = new Set(baseComponents);

    if (restoreGeneratorTicks && markedNames.some((name) => TICKED_UC_BLOCK_COMPONENTS.has(name))) {
      allowed.add("minecraft:tick");
    }

    const result = restoreMarkedProperties(original, allowed);
    if (result.restored.length === 0) continue;

    changedFiles++;
    for (const name of result.restored) {
      restoredByName.set(name, (restoredByName.get(name) ?? 0) + 1);
    }
    if (APPLY) fs.writeFileSync(file, result.source, "utf8");
  }

  return {
    changedFiles,
    properties: Object.fromEntries([...restoredByName].sort(([left], [right]) => left.localeCompare(right))),
  };
}

const blocks = processTree("BP/blocks", UC_BLOCK_COMPONENTS, true);
const items = processTree("BP/items", UC_ITEM_COMPONENTS, false);

console.log(JSON.stringify({ mode: APPLY ? "apply" : "check", blocks, items }, null, 2));
if (!APPLY && (blocks.changedFiles > 0 || items.changedFiles > 0)) process.exitCode = 1;

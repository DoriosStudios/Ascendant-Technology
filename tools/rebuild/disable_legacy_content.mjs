import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const LEGACY_ROOT = path.join(ROOT, "legacy");

const BLOCK_COMPONENTS = new Set([
  "utilitycraft:absolute_container",
  "utilitycraft:abyssal_fisher",
  "utilitycraft:arc_press_forge",
  "utilitycraft:arcane_enchanter",
  "utilitycraft:catalyst_weaver",
  "utilitycraft:centrifugal_siever",
  "utilitycraft:conveyor",
  "utilitycraft:conveyor_network_updater",
  "utilitycraft:cryo_chamber",
  "utilitycraft:cryo_freezer",
  "utilitycraft:cryo_stabilizer",
  "utilitycraft:cryofluid_synthesizer",
  "utilitycraft:disenchanter",
  "utilitycraft:dual_siever",
  "utilitycraft:duplicator",
  "utilitycraft:enchantment_station",
  "utilitycraft:energizer",
  "utilitycraft:genetic_seed_synthesizer",
  "utilitycraft:impact_crusher",
  "utilitycraft:industrial_burner",
  "utilitycraft:laser_barrier",
  "utilitycraft:liquifier",
  "utilitycraft:magmatic_reactor_chamber",
  "utilitycraft:mob_magnet",
  "utilitycraft:network_center",
  "utilitycraft:overclock_relay",
  "utilitycraft:overclock_tower",
  "utilitycraft:pattern_placer",
  "utilitycraft:power_beacon",
  "utilitycraft:pulverizer",
  "utilitycraft:refining_table",
  "utilitycraft:reinforced_exporter",
  "utilitycraft:reinforced_importer",
  "utilitycraft:reinforcement_anvil",
  "utilitycraft:residue_processor",
  "utilitycraft:seismic_breaker",
  "utilitycraft:singularity_fabricator",
  "utilitycraft:special_container",
  "utilitycraft:vaporworks_processor",
  "utilitycraft:verdant_cultivator",
]);

const ITEM_COMPONENTS = new Set([
  "utilitycraft:armor",
  "utilitycraft:fluid_capsule",
]);

const DISABLED_BLOCK_PROPERTIES = BLOCK_COMPONENTS;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(absolute);
  }
  return files;
}

function findValueEnd(source, start) {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index++;

  const opening = source[index];
  if (opening === '"') {
    index++;
    while (index < source.length) {
      if (source[index] === "\\") index += 2;
      else if (source[index++] === '"') break;
    }
    return index;
  }

  if (opening !== "{" && opening !== "[") {
    while (index < source.length && source[index] !== "," && source[index] !== "}") index++;
    return index;
  }

  const stack = [opening];
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (index += 1; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") stack.push(char);
    if (char === "}" || char === "]") {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }

  throw new Error("Unterminated JSON value");
}

function maskComments(source) {
  let result = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        result += char;
      } else result += " ";
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        result += "  ";
        blockComment = false;
        index++;
      } else result += char === "\n" ? "\n" : " ";
      continue;
    }
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      result += "  ";
      lineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      result += "  ";
      blockComment = true;
      index++;
      continue;
    }
    result += char;
  }

  return result;
}

function findPropertyRanges(source, names) {
  const ranges = [];
  const searchable = maskComments(source);
  const escapedNames = [...names]
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`"(${escapedNames.join("|")})"\\s*:`, "g");

  for (const match of searchable.matchAll(matcher)) {
    const keyStart = match.index;
    const colon = source.indexOf(":", keyStart + match[0].lastIndexOf('"'));
    const valueEnd = findValueEnd(source, colon + 1);
    const lineStart = source.lastIndexOf("\n", keyStart - 1) + 1;
    const indentationOnly = source.slice(lineStart, keyStart).trim().length === 0;
    let start = indentationOnly ? lineStart : keyStart;
    let end = valueEnd;

    while (source[end] === " " || source[end] === "\t" || source[end] === "\r") end++;
    if (source[end] === ",") {
      end++;
      while (source[end] === " " || source[end] === "\t" || source[end] === "\r") end++;
      if (indentationOnly && source[end] === "\n") end++;
    } else {
      let previous = start - 1;
      while (previous >= 0 && /\s/.test(source[previous])) previous--;
      if (source[previous] === ",") start = previous;
      else if (indentationOnly && source[end] === "\n") end++;
    }

    ranges.push({ start, end, name: match[1] });
  }

  return ranges;
}

function commentRanges(source, ranges) {
  let result = source;
  for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
    const original = result.slice(range.start, range.end);
    const commented = original
      .split(/(?<=\n)/g)
      .map((line, index) => {
        if (!line.trim()) return line;
        return index === 0 ? `// LEGACY_DISABLED ${line}` : `// ${line}`;
      })
      .join("");
    result = result.slice(0, range.start) + commented + result.slice(range.end);
  }
  return result;
}

async function processTree(relativeDirectory, names) {
  const directory = path.join(ROOT, relativeDirectory);
  const files = await walk(directory);
  let changedFiles = 0;
  let disabledProperties = 0;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const ranges = findPropertyRanges(source, names);
    if (ranges.length === 0) continue;

    changedFiles++;
    disabledProperties += ranges.length;
    if (!APPLY) continue;

    const relative = path.relative(ROOT, file);
    const backup = path.join(LEGACY_ROOT, relative);
    await mkdir(path.dirname(backup), { recursive: true });
    try {
      await readFile(backup);
    } catch {
      await copyFile(file, backup);
    }
    await writeFile(file, commentRanges(source, ranges), "utf8");
  }

  return { changedFiles, disabledProperties };
}

const blocks = await processTree("BP/blocks", DISABLED_BLOCK_PROPERTIES);
const items = await processTree("BP/items", ITEM_COMPONENTS);

console.log(JSON.stringify({ mode: APPLY ? "apply" : "check", blocks, items }, null, 2));
if (!APPLY && (blocks.disabledProperties > 0 || items.disabledProperties > 0)) process.exitCode = 1;

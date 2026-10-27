import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "tools", "model_sources", "mob_slasher.geo.json");
const outputPath = resolve(projectRoot, "RP", "models", "blocks", "mob_slasher.geo.json");
const scale = 2 / 3;

const round = (value) => Math.round(value * 1_000_000) / 1_000_000;
const scaleNumber = (value) => typeof value === "number" ? round(value * scale) : value;
const scaleVector = (value) => Array.isArray(value) ? value.map(scaleNumber) : value;

function scaleLocator(locator) {
  if (Array.isArray(locator)) return scaleVector(locator);
  if (!locator || typeof locator !== "object") return locator;

  const scaled = structuredClone(locator);
  if ("offset" in scaled) scaled.offset = scaleVector(scaled.offset);
  return scaled;
}

function scaleCube(cube) {
  if ("origin" in cube) cube.origin = scaleVector(cube.origin);
  if ("size" in cube) cube.size = scaleVector(cube.size);
  if ("pivot" in cube) cube.pivot = scaleVector(cube.pivot);
  if ("inflate" in cube) cube.inflate = scaleNumber(cube.inflate);
}

function scaleBone(bone) {
  if ("pivot" in bone) bone.pivot = scaleVector(bone.pivot);
  if ("binding" in bone && typeof bone.binding !== "string") {
    throw new Error(`Unsupported binding in bone ${bone.name ?? "<unnamed>"}`);
  }

  for (const cube of bone.cubes ?? []) scaleCube(cube);

  if (bone.locators) {
    for (const [name, locator] of Object.entries(bone.locators)) {
      bone.locators[name] = scaleLocator(locator);
    }
  }
}

async function initializeSource() {
  if (!process.argv.includes("--initialize-source")) return;

  const current = await readFile(outputPath, "utf8");
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, current.endsWith("\n") ? current : `${current}\n`, "utf8");
  console.log(`Captured editable Mob Slasher source: ${sourcePath}`);
}

await initializeSource();

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const generated = structuredClone(source);
const geometries = generated["minecraft:geometry"];

if (!Array.isArray(geometries) || geometries.length === 0) {
  throw new Error("Mob Slasher source has no minecraft:geometry entries");
}

for (const geometry of geometries) {
  for (const bone of geometry.bones ?? []) scaleBone(bone);
}

await writeFile(outputPath, `${JSON.stringify(generated, null, "\t")}\n`, "utf8");
console.log(`Generated Mob Slasher runtime geometry at 2/3 scale: ${outputPath}`);

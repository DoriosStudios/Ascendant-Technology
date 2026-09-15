import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATES = ['off', 'on'];
const MATERIALS = 'minecraft:material_instances';

// Only full-block Box-UV models belong here. Solar/Wind keep their own geometry.
export const BLOCKS = [
    { name: 'decompactor', block: 'machines/decompactor', atlas: 'machines/legacy_atlases', output: 'machines' },
    { name: 'industrial_crucible', block: 'machines/industrial_crucible', atlas: 'machines/legacy_atlases', output: 'machines' },
    { name: 'absolute_furnator', block: 'generators/furnator/absolute_furnator', atlas: 'generators', output: 'generators' },
    { name: 'absolute_magmator', block: 'generators/magmator/absolute_magmator', atlas: 'generators', output: 'generators' },
    { name: 'absolute_thermo_generator', block: 'generators/thermo/absolute_thermo_generator', atlas: 'generators', output: 'generators' },
];

export const FACE_ORIGINS = Object.freeze({
    west: [0, 16], north: [16, 16], east: [32, 16],
    south: [48, 16], up: [16, 0], down: [32, 0],
});

/** Copy RGBA pixels exactly; no resizing, rotation, interpolation or palette loss. */
export function splitAtlas(atlas) {
    if (atlas.width !== 64 || atlas.height !== 64) {
        throw new Error(`Expected a 64x64 Box-UV atlas; got ${atlas.width}x${atlas.height}`);
    }
    return Object.fromEntries(Object.entries(FACE_ORIGINS).map(([face, [x, y]]) => {
        const image = new PNG({ width: 16, height: 16 });
        PNG.bitblt(atlas, image, x, y, 16, 16, 0, 0);
        return [face, image];
    }));
}

function readJson(file) {
    const text = fs.readFileSync(file, 'utf8');
    return { text, data: JSON.parse(text.replace(/^\uFEFF/, '')) };
}

/** Preserve indentation/newlines; leave identical documents byte-for-byte alone. */
function planJson(plan, file, original, data) {
    if (JSON.stringify(original.data) === JSON.stringify(data)) return;
    const indentation = original.text.match(/\n([\t ]+)"/)?.[1] ?? '    ';
    const newline = original.text.includes('\r\n') ? '\r\n' : '\n';
    const bom = original.text.startsWith('\uFEFF') ? '\uFEFF' : '';
    plan.push({ file, contents: bom + JSON.stringify(data, null, indentation).replace(/\n/g, newline) + newline });
}

function materialFaces(current, name, state) {
    const fallback = current?.['*'] ?? { render_method: 'alpha_test' };
    const result = { ...current };
    for (const face of ['*', ...Object.keys(FACE_ORIGINS)]) {
        result[face] = {
            ...fallback,
            ...current?.[face],
            texture: `utilitycraft_${name}_${state}_${face === '*' ? 'north' : face}`,
        };
    }
    return result;
}

/** Prepare everything before writing: missing inputs must not leave half-linked assets. */
export function prepareSplit(root = ROOT, names = BLOCKS.map(block => block.name)) {
    for (const name of names) {
        if (!BLOCKS.some(block => block.name === name)) throw new Error(`Unknown block: ${name}`);
    }
    const plan = [];
    const terrainFile = path.join(root, 'RP/textures/terrain_texture.json');
    const terrainOriginal = readJson(terrainFile);
    const terrain = structuredClone(terrainOriginal.data);
    if (!terrain.texture_data || typeof terrain.texture_data !== 'object' || Array.isArray(terrain.texture_data)) {
        throw new Error(`Missing texture_data object: ${terrainFile}`);
    }
    let exportedFaces = 0;
    for (const entry of BLOCKS.filter(block => names.includes(block.name))) {
        const blockFile = path.join(root, `BP/blocks/machinery/${entry.block}.json`);
        const original = readJson(blockFile);
        const document = structuredClone(original.data);
        const block = document['minecraft:block'];
        if (block?.description?.identifier !== `utilitycraft:${entry.name}`) throw new Error(`Unexpected block identifier: ${blockFile}`);
        const geometry = block.components?.['minecraft:geometry'];
        if ((typeof geometry === 'string' ? geometry : geometry?.identifier) !== 'minecraft:geometry.full_block') {
            throw new Error(`Refusing to replace custom geometry: ${blockFile}`);
        }
        // Match only standalone on-state conditions; never guess combined conditions.
        const onPattern = /^\s*q(?:uery)?\.block_state\(['"]utilitycraft:on['"]\)\s*==\s*(?:true|1)\s*$/;
        const offPattern = /^\s*q(?:uery)?\.block_state\(['"]utilitycraft:on['"]\)\s*==\s*(?:false|0)\s*$/;
        const permutations = block.permutations ?? [];
        const on = permutations.filter(p => onPattern.test(p.condition));
        if (on.length !== 1) throw new Error(`Expected one on-state permutation: ${blockFile}`);
        for (const permutation of permutations) {
            if (permutation.components?.[MATERIALS] && !onPattern.test(permutation.condition) && !offPattern.test(permutation.condition)) {
                throw new Error(`Unsupported material permutation in ${blockFile}: ${permutation.condition}`);
            }
        }
        for (const state of STATES) {
            const atlasFile = path.join(root, `RP/textures/blocks/${entry.atlas}/${entry.name}_${state}.png`);
            const atlas = PNG.sync.read(fs.readFileSync(atlasFile));
            const faces = splitAtlas(atlas);
            for (const [face, image] of Object.entries(faces)) {
                const relative = `textures/blocks/${entry.output}/${entry.name}_${state}_${face}`;
                const file = path.join(root, 'RP', `${relative}.png`);
                let unchanged = false;
                if (fs.existsSync(file)) {
                    const existing = PNG.sync.read(fs.readFileSync(file));
                    unchanged = existing.width === 16 && existing.height === 16 && existing.data.equals(image.data);
                }
                // Existing equivalent PNG encodings are kept, avoiding needless binary churn.
                if (!unchanged) plan.push({ file, contents: PNG.sync.write(image) });
                const key = `utilitycraft_${entry.name}_${state}_${face}`;
                terrain.texture_data[key] = { ...terrain.texture_data[key], textures: relative };
                exportedFaces++;
            }
        }
        block.components[MATERIALS] = materialFaces(block.components[MATERIALS], entry.name, 'off');
        for (const permutation of permutations) {
            if (!onPattern.test(permutation.condition) && !offPattern.test(permutation.condition)) continue;
            permutation.components ??= {};
            permutation.components[MATERIALS] = materialFaces(
                permutation.components[MATERIALS] ?? block.components[MATERIALS], entry.name,
                onPattern.test(permutation.condition) ? 'on' : 'off',
            );
        }
        planJson(plan, blockFile, original, document);
    }
    // Register the atlas only after all selected source images/blocks could be prepared.
    planJson(plan, terrainFile, terrainOriginal, terrain);
    return { plan, exportedFaces, blocks: new Set(names).size };
}

function main(args) {
    if (args.includes('--help')) {
        console.log('node tools/split_faces.mjs [--dry-run] [--only name,name]\nSplits off/on Box-UV atlases and updates RP/textures/terrain_texture.json and BP block materials.');
        return;
    }
    let dryRun = false;
    let names;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') dryRun = true;
        else if (args[i] === '--only' && args[i + 1]) names = args[++i].split(',').filter(Boolean);
        else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    if (names?.length === 0) throw new Error('--only requires at least one block name');
    const { plan, exportedFaces, blocks } = prepareSplit(ROOT, names);
    for (const { file, contents } of plan) {
        if (!dryRun) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, contents);
        }
        console.log(`${dryRun ? 'Would update' : 'Updated'}: ${path.relative(ROOT, file)}`);
    }
    console.log(`${blocks} blocks, ${exportedFaces} faces; ${plan.length} files ${dryRun ? 'to update' : 'updated'}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(process.argv.slice(2)); }
    catch (error) { console.error(`split_faces: ${error.message}`); process.exitCode = 1; }
}

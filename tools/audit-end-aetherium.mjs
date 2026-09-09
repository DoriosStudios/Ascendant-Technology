import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Evaluate the arithmetic subset used by these feature files. This checks the
// placement graph and geometry, not the Minecraft engine's Molang implementation.
export function auditEndAetherium(root) {
    const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
    let assertions = 0;
    const check = (condition, message) => {
        assert.ok(condition, message);
        assertions++;
    };
    const definitions = new Map();
    function feature(id) {
        if (!definitions.has(id)) {
            const definition = json(`BP/features/${id.split(":")[1]}.json`);
            const type = Object.keys(definition).find((key) => key.startsWith("minecraft:"));
            check(
                definition[type].description.identifier === id,
                `Feature identifier resolves: ${id}`,
            );
            definitions.set(id, [type, definition[type]]);
        }
        return definitions.get(id);
    }
    const compiled = new Map();
    function evaluate(value, variables, math) {
        if (typeof value !== "string") return value;
        if (!compiled.has(value)) {
            compiled.set(
                value,
                Function("v", "math", value.includes("return") ? value : `return (${value});`),
            );
        }
        return compiled.get(value)(variables, math);
    }
    function generate(
        half,
        diagonal,
        vertical,
        crystal,
        reversed,
        variables,
        solid = () => true,
        entry = "utilitycraft:ae_ore_end_dense_feature",
    ) {
        const values = [half, diagonal, vertical];
        const math = {
            floor: Math.floor,
            abs: Math.abs,
            mod: (a, b) => a % b,
            random_integer: () => values.shift(),
        };
        const blocks = new Map();
        function place(id, origin) {
            const [type, data] = feature(id);
            if (type === "minecraft:scatter_feature") {
                const distribution = data.distribution;
                assert.equal(distribution.coordinate_eval_order, "xyz");
                const iterations = evaluate(distribution.iterations, variables, math);
                assert.ok(Number.isInteger(iterations) && iterations >= 0);
                for (let i = 0; i < iterations; i++) {
                    const position = ["x", "y", "z"].map(
                        (axis, index) =>
                            origin[index] + evaluate(distribution[axis], variables, math),
                    );
                    place(data.places_feature, position);
                }
            } else if (type === "minecraft:aggregate_feature") {
                assert.equal(data.early_out, "none");
                for (const child of reversed ? [...data.features].reverse() : data.features)
                    place(child, origin);
            } else if (type === "minecraft:weighted_random_feature") {
                place(data.features[crystal ? 1 : 0][0], origin);
            } else if (type === "minecraft:single_block_feature") {
                assert.deepEqual(data.may_replace, ["minecraft:end_stone"]);
                if (!solid(origin)) return;
                const key = origin.join(",");
                assert.ok(!blocks.has(key), `Overlapping material placement at ${key}`);
                blocks.set(key, data.places_block);
            } else {
                assert.fail(`Unsupported feature type ${type}`);
            }
        }
        place(entry, [0, 0, 0]);
        assert.equal(values.length, 0, "Vein initializes length and both directions once");
        return blocks;
    }
    const sandId = "utilitycraft:end_sand";
    const crystalId = "utilitycraft:aetherium_crystal_block";
    const neighbors = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
    ];
    const signature = (blocks) =>
        JSON.stringify([...blocks].sort(([a], [b]) => a.localeCompare(b)));
    for (let half = 3; half <= 6; half++) {
        for (const diagonal of [0, 1])
            for (const vertical of [0, 1]) {
                const variables = {};
                const normal = () =>
                    generate(
                        half,
                        diagonal,
                        vertical,
                        false,
                        false,
                        variables,
                        () => true,
                        "utilitycraft:ae_ore_end_feature",
                    );
                const blocks = normal();
                check(blocks.size === half * 2 + 1, "Standard veins contain only 7–13 positions");
                check(
                    [...blocks.values()].every((id) => id === "utilitycraft:end_aetherium_ore"),
                    "Standard veins are ore only, without sand or crystal blocks",
                );
                check(
                    blocks.has("0,0,0") &&
                        [...blocks.keys()].every((key) =>
                            blocks.has(
                                key
                                    .split(",")
                                    .map((n) => -Number(n))
                                    .join(","),
                            ),
                        ),
                    "Standard veins remain centered and symmetric",
                );
                check(
                    [...blocks.keys()].every((key) => {
                        const [x, , z] = key.split(",").map(Number);
                        return z === x * (diagonal * 2 - 1);
                    }),
                    "Standard veins follow the selected diagonal",
                );
                check(
                    signature(blocks) === signature(normal()),
                    "Standard vein variables reset between placements",
                );
            }
    }
    for (let half = 3; half <= 6; half++) {
        for (const diagonal of [0, 1])
            for (const vertical of [0, 1])
                for (const crystal of [false, true]) {
                    const variables = {};
                    const blocks = generate(half, diagonal, vertical, crystal, false, variables);
                    check(
                        signature(blocks) ===
                            signature(generate(half, diagonal, vertical, crystal, true, variables)),
                        "Material order and reused variables do not change the vein",
                    );
                    const core = [...blocks]
                        .filter(([, id]) => id !== sandId)
                        .map(([key]) => key.split(",").map(Number));
                    const centerSlice = core.filter(([x]) => x === 0);
                    check(
                        centerSlice.length === 13,
                        "Dense center has thirteen mineral positions per section",
                    );
                    for (const sign of [-1, 1]) {
                        const tip = core.filter(([x]) => x === sign * half);
                        check(tip.length === 1, "Vein tapers to a single-block tip");
                        check(
                            tip[0][2] === sign * half * (diagonal * 2 - 1),
                            "Tips follow the selected diagonal",
                        );
                    }
                    check(
                        core.length === [51, 61, 71, 97][half - 3],
                        "Dense mineral volume matches its length",
                    );
                    check(
                        [...blocks.keys()].every((key) =>
                            blocks.has(
                                key
                                    .split(",")
                                    .map((n) => -Number(n))
                                    .join(","),
                            ),
                        ),
                        "Core and sand shell are symmetric around the center",
                    );
                    const crystals = [...blocks].filter(([, id]) => id === crystalId);
                    check(
                        crystals.length === (crystal ? 1 : 0) &&
                            (!crystal || crystals[0][0] === "0,0,0"),
                        "Only the central block can become a crystal block",
                    );
                    const uncovered = new Set();
                    for (const point of core)
                        for (const offset of neighbors) {
                            const adjacent = point.map((n, i) => n + offset[i]);
                            if (!blocks.has(adjacent.join(","))) uncovered.add(adjacent.join(","));
                        }
                    check(uncovered.size === 0, "Sand seals every mineral face, including both tips");
                    check(
                        [...blocks]
                            .filter(([, id]) => id === sandId)
                            .every(([key]) => {
                                const point = key.split(",").map(Number);
                                return core.some((mineral) =>
                                    mineral.every((coordinate, index) =>
                                        Math.abs(point[index] - coordinate) <= 1,
                                    ),
                                );
                            }),
                        "Every sand block stays within the one-block diagonal mineral shell",
                    );
                }
    }
    const empty = generate(6, 1, 1, true, false, {}, () => false);
    check(empty.size === 0, "The vein does not create blocks in air or non-End-Stone terrain");
    const edge = generate(6, 1, 1, true, false, {}, ([, y]) => y <= 0);
    check(
        [...edge.keys()].every((key) => Number(key.split(",")[1]) <= 0),
        "Island-edge filtering also applies to sand and crystals",
    );
    const [, center] = feature("utilitycraft:ae_ore_end_dense_center_feature");
    check(
        center.features[1][1] / center.features.reduce((sum, [, weight]) => sum + weight, 0) ===
            0.25,
        "Dense End crystal probability is 25% at the single center position",
    );
    const rule = json("BP/feature_rules/ae_ore_end_feature_rule.json")["minecraft:feature_rules"];
    const denseRule = json("BP/feature_rules/ae_ore_end_dense_feature_rule.json")[
        "minecraft:feature_rules"
    ];
    check(
        rule.description.places_feature === "utilitycraft:ae_ore_end_feature" &&
            rule.distribution.iterations === 24,
        "Standard veins retain their independent 24-attempt generation rule",
    );
    check(
        denseRule.description.places_feature === "utilitycraft:ae_ore_end_dense_feature" &&
            denseRule.distribution.iterations === 1 &&
            denseRule.distribution.scatter_chance.denominator === 64 &&
            denseRule.distribution.y.extent[0] === 8 &&
            denseRule.distribution.y.extent[1] === 48,
        "Dense End deposits are rare and generate lower than ordinary veins",
    );
    check(
        JSON.stringify(rule.conditions) === JSON.stringify(denseRule.conditions),
        "Both independent variants retain the End biome and generation pass",
    );
    const buriedAir = ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"];
    for (const name of ["ae_ore_end_dense_block_feature", "ae_ore_end_dense_crystal_block_feature"]) {
        const [, data] = feature(`utilitycraft:${name}`);
        check(
            JSON.stringify(data.may_not_attach_to?.all) === JSON.stringify(buriedAir),
            `${name} rejects all adjacent air types`,
        );
    }
    const owRule = json("BP/feature_rules/ae_ore_ow_dense_feature_rule.json")["minecraft:feature_rules"];
    const [, owDense] = feature("utilitycraft:ae_ore_ow_dense_feature");
    const [, owSection] = feature("utilitycraft:ae_ore_ow_dense_section_feature");
    const [, owMaterials] = feature("utilitycraft:ae_ore_ow_dense_materials_feature");
    check(
        owRule.description.places_feature === "utilitycraft:ae_ore_ow_dense_feature" &&
            owRule.distribution.scatter_chance.denominator === 512 &&
            owRule.distribution.iterations === 1 &&
            owRule.distribution.y.extent[0] === -60 && owRule.distribution.y.extent[1] === -8,
        "Dense Overworld deposits are rarer and span the deep deepslate range",
    );
    check(
        owDense.places_feature === "utilitycraft:ae_ore_ow_dense_section_feature" &&
            owSection.places_feature === "utilitycraft:ae_ore_ow_dense_materials_feature" &&
            JSON.stringify(owMaterials.features) === JSON.stringify([
                "utilitycraft:ae_ore_ow_dense_ore_gate_feature",
                "utilitycraft:ae_ore_ow_dense_center_gate_feature",
                "utilitycraft:ae_ore_ow_dense_shell_gate_feature",
            ]),
        "Dense Overworld feature graph resolves without sharing End material gates",
    );
    for (const name of ["ae_ore_ow_dense_block_feature", "ae_ore_ow_dense_crystal_block_feature"]) {
        const [, data] = feature(`utilitycraft:${name}`);
        check(
            data.may_replace?.[0] === "minecraft:deepslate" &&
                JSON.stringify(data.may_not_attach_to?.all) === JSON.stringify(buriedAir),
            `${name} is a buried deepslate-only mineral`,
        );
    }
    const [, owShell] = feature("utilitycraft:ae_ore_ow_dense_shell_block_feature");
    check(
        owShell.places_block === "utilitycraft:crushed_cobbled_deepslate" &&
            owShell.may_replace?.[0] === "minecraft:deepslate",
        "Dense Overworld shell exposes crushed cobbled deepslate only",
    );
    for (const name of ["low", "mid", "high"]) {
        const standard = json(`BP/feature_rules/ae_ore_ow_${name}_feature_rule.json`)["minecraft:feature_rules"];
        check(standard.distribution.scatter_chance.denominator === 48, `Standard Overworld ${name} veins are modestly more common`);
    }
    const sand = json("BP/blocks/nature/end_sand.json")["minecraft:block"];
    check(
        sand.description.identifier === sandId &&
            sand.description.menu_category.category === "nature",
        "End Sand is registered as a nature block",
    );
    const loot = json(`BP/${sand.components["minecraft:loot"]}`);
    check(loot.pools[0].entries[0].name === sandId, "End Sand drops itself");
    const atlas = json("RP/textures/terrain_texture.json").texture_data;
    check(
        atlas[sand.components["minecraft:material_instances"]["*"].texture].textures ===
            "textures/blocks/nature/end_sand",
        "End Sand has a dedicated texture path",
    );
    const placeholder = readFileSync(join(root, "RP/textures/blocks/nature/end_sand.png"));
    check(
        placeholder.subarray(1, 4).toString() === "PNG" &&
            placeholder.readUInt32BE(16) === 16 &&
            placeholder.readUInt32BE(20) === 16,
        "End Sand placeholder is a valid 16×16 PNG",
    );
    for (const lang of ["en_US", "pt_BR", "es_MX", "fr_FR", "de_DE", "ja_JP", "ru_RU", "zh_CN"]) {
        check(
            readFileSync(join(root, `RP/texts/${lang}.lang`), "utf8").includes(
                "tile.utilitycraft:end_sand.name=",
            ),
            `${lang} names End Sand`,
        );
    }
    return assertions;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(
        `End Aetherium audit passed: ${auditEndAetherium(resolve(import.meta.dirname, ".."))} checks.`,
    );
}

import { system } from "@minecraft/server";

const KDE = 1000;
const DEFAULT_FLUID_TYPE = 'liquified_aetherium';
const FLUID_PER_SECOND = 50; // mB per second (significant long-term drain)
const CLONER_BLOCK_ID = 'utilitycraft:cloner';

/**
 * @typedef {Object} ClonerRecipeDefinition
 * @property {{ id: string, amount?: number } | string} [input] Template stack to duplicate (at least one of `input`, `template`, or `base` is required).
 * @property {{ id: string, amount?: number } | string} [template] Alias for {@link ClonerRecipeDefinition.input} when `input` is omitted.
 * @property {{ id: string, amount?: number } | string} [base] Additional alias accepted for {@link ClonerRecipeDefinition.input}.
 * @property {{ id: string, amount?: number } | string} [output] Optional explicit output override (defaults to the input id).
 * @property {keyof typeof RARITY_BASE_RATE_KDE | string} [rarity] Optional rarity tier (defaults to `common`).
 * @property {number} [time] Optional processing time in seconds.
 * @property {number} [timeSeconds] Alternate time field in seconds (falls back to 1s if omitted).
 * @property {number} [cost] Optional extra cost in kDE added on top of the rarity baseline.
 * @property {{ type?: string, amount?: number } | string | null} [fluid] Optional fluid requirement (string values use the default amount).
 * @property {string} [id] Optional recipe identifier. Defaults to `<input id>-><output id>`.
 */

/**
 * @typedef {Object} ClonerRecipe
 * @property {string} id Unique recipe identifier.
 * @property {keyof typeof RARITY_BASE_RATE_KDE} rarity Normalized rarity tier.
 * @property {{ id: string, amount: number }} input Template input stack.
 * @property {{ id: string, amount: number }} output Output stack that includes the duplicated copy.
 * @property {number} timeSeconds Processing duration in seconds.
 * @property {number} ticks Processing duration in ticks.
 * @property {number} costKDE Total cost expressed in kDE.
 * @property {number} perSecondKDE Energy consumption rate per second in kDE.
 * @property {number} energyCost Total FE cost (kDE × 1 000) per craft.
 * @property {{ type: string, amount: number } | null} fluid Optional fluid requirement.
 */

/**
 * Energy consumption (in kDE per second) grows exponentially per rarity.
 * The curve starts at 5 kDE for common recipes (per the spec) and multiplies
 * by 25 for each subsequent tier, guaranteeing the example series 5 → 125 → 3 125.
 *
 * Total energy cost for a recipe is derived as:
 *   (rarityRateKDE * timeSeconds + recipe.cost) * 1 000
 */
export const CLONER_RARITIES = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic"
];

const RARITY_BASE_RATE_KDE = {
    common:      10,
    uncommon:    48,
    rare:        240,
    epic:        1200,
    legendary:   6000,
    mythic:      30000
};

const ASCENDANT_BLOCK_RARITIES = Object.freeze({
    "utilitycraft:absolute_battery": "legendary",
    "utilitycraft:absolute_container": "legendary",
    "utilitycraft:absolute_furnator": "legendary",
    "utilitycraft:absolute_magmator": "legendary",
    "utilitycraft:absolute_solar_panel": "legendary",
    "utilitycraft:absolute_thermo_generator": "legendary",
    "utilitycraft:absolute_wind_turbine": "legendary",
    "utilitycraft:aetherium_block": "epic",
    "utilitycraft:raw_titanium_block": "uncommon",
    "utilitycraft:titanium_block": "rare",
    "utilitycraft:deepslate_titanium_ore": "rare",
    "utilitycraft:deepslate_aetherium_ore": "epic",
    "utilitycraft:end_aetherium_ore": "legendary",
    "utilitycraft:catalyst_weaver": "epic",
    "utilitycraft:cryo_chamber": "epic",
    "utilitycraft:energizer": "rare",
    "utilitycraft:laser_barrier": "rare",
    "utilitycraft:laser_barrier_field": "rare",
    "utilitycraft:liquifier": "rare",
    "utilitycraft:mob_magnet": "rare",
    "utilitycraft:network_center": "rare",
    "utilitycraft:overclock_relay": "epic",
    "utilitycraft:overclock_tower": "legendary",
    "utilitycraft:reinforced_cable": "rare",
    "utilitycraft:reinforced_extractor": "epic",
    "utilitycraft:residue_processor": "rare",
    "utilitycraft:singularity_fabricator": "mythic",
    "utilitycraft:tabs_test_machine": "common"
});

const VANILLA_MYTHIC_BLOCKS = new Set([
    "minecraft:barrier",
    "minecraft:bedrock",
    "minecraft:chain_command_block",
    "minecraft:command_block",
    "minecraft:dragon_egg",
    "minecraft:end_portal_frame",
    "minecraft:reinforced_deepslate",
    "minecraft:repeating_command_block",
    "minecraft:spawner",
    "minecraft:structure_block"
]);

const VANILLA_LEGENDARY_BLOCKS = new Set([
    "minecraft:ancient_debris",
    "minecraft:beacon",
    "minecraft:conduit",
    "minecraft:end_gateway",
    "minecraft:lodestone",
    "minecraft:netherite_block",
    "minecraft:respawn_anchor"
]);

const VANILLA_EPIC_BLOCKS = new Set([
    "minecraft:diamond_block",
    "minecraft:diamond_ore",
    "minecraft:deepslate_diamond_ore",
    "minecraft:deepslate_emerald_ore",
    "minecraft:emerald_block",
    "minecraft:emerald_ore",
    "minecraft:enchanting_table",
    "minecraft:ender_chest"
]);

const VANILLA_RARE_BLOCKS = new Set([
    "minecraft:crying_obsidian",
    "minecraft:glowstone",
    "minecraft:gold_block",
    "minecraft:gold_ore",
    "minecraft:deepslate_gold_ore",
    "minecraft:obsidian",
    "minecraft:sculk",
    "minecraft:sculk_catalyst",
    "minecraft:sculk_sensor",
    "minecraft:sculk_shrieker",
    "minecraft:sea_lantern",
    "minecraft:spore_blossom"
]);

const VANILLA_UNCOMMON_BLOCKS = new Set([
    "minecraft:amethyst_block",
    "minecraft:budding_amethyst",
    "minecraft:calcite",
    "minecraft:coal_block",
    "minecraft:coal_ore",
    "minecraft:deepslate_coal_ore",
    "minecraft:copper_block",
    "minecraft:copper_ore",
    "minecraft:deepslate_copper_ore",
    "minecraft:cut_copper",
    "minecraft:exposed_copper",
    "minecraft:weathered_copper",
    "minecraft:oxidized_copper",
    "minecraft:iron_block",
    "minecraft:iron_ore",
    "minecraft:deepslate_iron_ore",
    "minecraft:lapis_block",
    "minecraft:lapis_ore",
    "minecraft:deepslate_lapis_ore",
    "minecraft:nether_gold_ore",
    "minecraft:nether_quartz_ore",
    "minecraft:raw_copper_block",
    "minecraft:raw_gold_block",
    "minecraft:raw_iron_block",
    "minecraft:redstone_block",
    "minecraft:redstone_ore",
    "minecraft:deepslate_redstone_ore",
    "minecraft:tuff",
    "minecraft:dripstone_block"
]);

const VANILLA_COMMON_BLOCKS = new Set([
    "minecraft:clay",
    "minecraft:cobblestone",
    "minecraft:coarse_dirt",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:gravel",
    "minecraft:ice",
    "minecraft:packed_ice",
    "minecraft:blue_ice",
    "minecraft:mycelium",
    "minecraft:rooted_dirt",
    "minecraft:sand",
    "minecraft:red_sand",
    "minecraft:snow_block",
    "minecraft:stone",
    "minecraft:glass"
]);

const VANILLA_COMMON_PATTERNS = [
    /^minecraft:.*_planks$/,
    /^minecraft:.*_log$/,
    /^minecraft:.*_wood$/,
    /^minecraft:stripped_.*_(log|wood)$/,
    /^minecraft:.*_stem$/,
    /^minecraft:.*_hyphae$/,
    /^minecraft:.*_slab$/,
    /^minecraft:.*_stairs$/,
    /^minecraft:.*_wall$/,
    /^minecraft:.*_fence$/,
    /^minecraft:.*_fence_gate$/,
    /^minecraft:.*_door$/,
    /^minecraft:.*_trapdoor$/,
    /^minecraft:.*_button$/,
    /^minecraft:.*_pressure_plate$/,
    /^minecraft:.*_sign$/,
    /^minecraft:.*_hanging_sign$/,
    /^minecraft:.*_carpet$/,
    /^minecraft:.*_wool$/,
    /^minecraft:.*_concrete$/,
    /^minecraft:.*_concrete_powder$/,
    /^minecraft:.*_terracotta$/,
    /^minecraft:.*_glazed_terracotta$/,
    /^minecraft:.*_glass_pane$/,
    /^minecraft:.*_glass$/,
    /^minecraft:.*_leaves$/,
    /^minecraft:.*_sapling$/,
    /^minecraft:.*_bricks$/,
    /^minecraft:.*_tiles$/,
    /^minecraft:.*_sandstone$/,
    /^minecraft:.*_stone$/,
    /^minecraft:.*_cobblestone$/,
    /^minecraft:.*_deepslate$/,
    /^minecraft:.*_basalt$/,
    /^minecraft:.*_blackstone$/,
    /^minecraft:.*_prismarine$/,
    /^minecraft:.*_purpur$/,
    /^minecraft:.*_quartz$/,
    /^minecraft:.*_mud$/,
    /^minecraft:.*_granite$/,
    /^minecraft:.*_diorite$/,
    /^minecraft:.*_andesite$/
];

function normalizeBlockId(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

function isCommonConstructionBlock(id) {
    if (!id.startsWith("minecraft:")) return false;
    if (VANILLA_COMMON_BLOCKS.has(id)) return true;
    return VANILLA_COMMON_PATTERNS.some(pattern => pattern.test(id));
}

function resolveVanillaBlockRarity(id) {
    if (!id.startsWith("minecraft:")) return null;
    if (VANILLA_MYTHIC_BLOCKS.has(id)) return "mythic";
    if (VANILLA_LEGENDARY_BLOCKS.has(id)) return "legendary";
    if (VANILLA_EPIC_BLOCKS.has(id)) return "epic";
    if (VANILLA_RARE_BLOCKS.has(id)) return "rare";
    if (VANILLA_UNCOMMON_BLOCKS.has(id)) return "uncommon";
    if (/_shulker_box$/.test(id)) return "rare";
    if (/_ore$/.test(id) || /:deepslate_.*_ore$/.test(id)) return "uncommon";
    if (/^minecraft:raw_.*_block$/.test(id)) return "uncommon";
    if (isCommonConstructionBlock(id)) return "common";
    return null;
}

function addBlocksToMap(target, blocks, rarity) {
    for (const id of blocks) {
        target[id] = rarity;
    }
}

function buildClonerBlockRarityMap() {
    const map = {};
    addBlocksToMap(map, VANILLA_COMMON_BLOCKS, "common");
    addBlocksToMap(map, VANILLA_UNCOMMON_BLOCKS, "uncommon");
    addBlocksToMap(map, VANILLA_RARE_BLOCKS, "rare");
    addBlocksToMap(map, VANILLA_EPIC_BLOCKS, "epic");
    addBlocksToMap(map, VANILLA_LEGENDARY_BLOCKS, "legendary");
    addBlocksToMap(map, VANILLA_MYTHIC_BLOCKS, "mythic");
    Object.assign(map, ASCENDANT_BLOCK_RARITIES);
    return map;
}

export const CLONER_BLOCK_RARITY_MAP = Object.freeze(buildClonerBlockRarityMap());

export function getClonerBlockRarity(id) {
    const normalized = normalizeBlockId(id);
    if (!normalized) return "common";

    const ascendantRarity = ASCENDANT_BLOCK_RARITIES[normalized];
    if (ascendantRarity) return ascendantRarity;

    const vanillaRarity = resolveVanillaBlockRarity(normalized);
    if (vanillaRarity) return vanillaRarity;

    return "common";
}

const nativeSingularityRecipes = [
    defineSingularityRecipe({
        id: "utilitycraft:clone_slime_core",
        rarity: "common",
        time: 3,
        input: { id: "minecraft:slime_ball" },
        output: { id: "minecraft:slime_ball" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_ender_pearl",
        rarity: "uncommon",
        time: 60,
        input: { id: "minecraft:ender_pearl" },
        output: { id: "minecraft:ender_pearl" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_ancient_debris",
        rarity: "rare",
        time: 150,
        input: { id: "minecraft:ancient_debris" },
        output: { id: "minecraft:ancient_debris" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_totem",
        rarity: "epic",
        time: 600,
        input: { id: "minecraft:totem_of_undying" },
        output: { id: "minecraft:totem_of_undying" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_nether_star",
        rarity: "legendary",
        time: 1200,
        input: { id: "minecraft:nether_star" },
        output: { id: "minecraft:nether_star" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_dragon_egg",
        rarity: "mythic",
        time: 2400,
        input: { id: "minecraft:dragon_egg" },
        output: { id: "minecraft:dragon_egg" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_aetherium_shard",
        rarity: "uncommon",
        time: 80,
        input: { id: "utilitycraft:aetherium_shard" },
        output: { id: "utilitycraft:aetherium_shard" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_void_essence",
        rarity: "rare",
        time: 160,
        input: { id: "utilitycraft:void_essence" },
        output: { id: "utilitycraft:void_essence" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_shulker_shell",
        rarity: "rare",
        time: 200,
        input: { id: "minecraft:shulker_shell" },
        output: { id: "minecraft:shulker_shell" }
    }),
    defineSingularityRecipe({
        id: "utilitycraft:clone_wither_skull",
        rarity: "epic",
        time: 900,
        input: { id: "minecraft:wither_skeleton_skull" },
        output: { id: "minecraft:wither_skeleton_skull" }
    })
].filter(Boolean);

const registeredSingularityRecipes = [];

export function registerSingularityRecipe(recipe) {
    const result = upsertSingularityRecipe(recipe);
    return result?.recipe ?? null;
}

export function getSingularityRecipes() {
    return [...nativeSingularityRecipes, ...registeredSingularityRecipes];
}

// Backwards compatibility for older integrations.
export function registerClonerRecipe(recipe) {
    return registerSingularityRecipe(recipe);
}

export function getClonerRecipes() {
    return getSingularityRecipes();
}

/**
 * Normalizes a cloner recipe definition object.
 * @param {ClonerRecipeDefinition} definition
 * @returns {ClonerRecipe | null}
 */
export function defineSingularityRecipe(definition) {
    if (!definition) return null;

    const inputStack = normalizeItemStack(definition.input ?? definition.template ?? definition.base);
    if (!inputStack) return null;
    if (isClonerItemId(inputStack.id)) return null;

    const outputStack = normalizeItemStack(definition.output ?? inputStack.id) ?? { id: inputStack.id, amount: 1 };
    if (isClonerItemId(outputStack.id ?? inputStack.id)) return null;

    const TEMPLATE_AMOUNT = 1;
    const COPY_AMOUNT = TEMPLATE_AMOUNT;

    const input = {
        id: inputStack.id,
        amount: TEMPLATE_AMOUNT
    };

    const output = {
        id: outputStack.id ?? inputStack.id,
        amount: TEMPLATE_AMOUNT + COPY_AMOUNT
    };

    const rarity = normalizeRarity(definition.rarity);
    const timeSeconds = normalizePositive(definition.time ?? definition.timeSeconds ?? 1, 1);
    const extraCostKDE = Math.max(0, Number(definition.cost ?? 0));

    const perSecondKDE = getRarityRateKDE(rarity);
    const baseCostKDE = perSecondKDE * timeSeconds;
    const totalCostKDE = baseCostKDE + extraCostKDE;

    const fluid = normalizeFluid(definition.fluid, timeSeconds);

    const id = definition.id ?? `${input.id}->${output.id}`;

    return {
        id,
        rarity,
        input,
        output,
        timeSeconds,
        ticks: Math.max(1, Math.round(timeSeconds * 20)),
        costKDE: totalCostKDE,
        perSecondKDE,
        energyCost: Math.max(KDE, Math.round(totalCostKDE * KDE)),
        fluid
    };
}

export function getRarityRateKDE(rarity) {
    return RARITY_BASE_RATE_KDE[rarity] ?? RARITY_BASE_RATE_KDE.common;
}

function normalizeRarity(value) {
    if (!value) return "common";
    const lowered = `${value}`.toLowerCase();
    return CLONER_RARITIES.includes(lowered) ? lowered : "common";
}

function normalizePositive(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function normalizeItemStack(stack) {
    if (!stack) return null;
    if (typeof stack === "string") {
        return { id: stack, amount: 1 };
    }
    if (typeof stack === "object" && typeof stack.id === "string") {
        const amount = normalizePositive(stack.amount ?? 1, 1);
        return { id: stack.id, amount };
    }
    return null;
}

function normalizeFluid(value, timeSeconds) {
    if (value === null) return null;

    const baseAmount = Math.max(1, Math.round(timeSeconds * FLUID_PER_SECOND));

    if (typeof value === 'object' && value !== null) {
        const type = sanitizeFluidType(value.type) ?? DEFAULT_FLUID_TYPE;
        const amount = normalizePositive(value.amount ?? baseAmount, baseAmount);
        return { type, amount };
    }

    if (typeof value === 'string') {
        return {
            type: sanitizeFluidType(value) ?? DEFAULT_FLUID_TYPE,
            amount: baseAmount
        };
    }

    return {
        type: DEFAULT_FLUID_TYPE,
        amount: baseAmount
    };
}

function sanitizeFluidType(type) {
    if (typeof type !== 'string') return null;
    const trimmed = type.trim();
    return trimmed.length ? trimmed.toLowerCase() : null;
}

function isClonerItemId(id) {
    if (typeof id !== 'string') return false;
    return id.toLowerCase() === CLONER_BLOCK_ID;
}

const CLONER_EVENT_ID = 'utilitycraft:register_cloner_recipe';

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== CLONER_EVENT_ID) return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== 'object') return;

        let added = 0;
        let replaced = 0;

        for (const [recipeId, definition] of Object.entries(payload)) {
            if (!definition || typeof definition !== 'object') {
                console.warn(`[UtilityCraft] Ignored invalid cloner recipe '${recipeId}'.`);
                continue;
            }

            try {
                const result = upsertSingularityRecipe({ id: recipeId, ...definition });
                if (!result) continue;
                if (result.status === 'replaced') replaced++;
                else added++;
            } catch (err) {
                console.warn(`[UtilityCraft] Failed to register singularity recipe '${recipeId}':`, err);
            }
        }

        console.warn(`[UtilityCraft] Registered ${added} new and replaced ${replaced} singularity recipes.`);
    } catch (err) {
        console.warn('[UtilityCraft] Failed to parse singularity recipe payload:', err);
    }
});

function upsertSingularityRecipe(definition) {
    const normalized = defineSingularityRecipe(definition);
    if (!normalized) return null;

    const nativeIndex = nativeSingularityRecipes.findIndex(entry => entry.id === normalized.id);
    if (nativeIndex >= 0) {
        nativeSingularityRecipes[nativeIndex] = normalized;
        return { recipe: normalized, status: 'replaced' };
    }

    const registeredIndex = registeredSingularityRecipes.findIndex(entry => entry.id === normalized.id);
    if (registeredIndex >= 0) {
        registeredSingularityRecipes[registeredIndex] = normalized;
        return { recipe: normalized, status: 'replaced' };
    }

    registeredSingularityRecipes.push(normalized);
    return { recipe: normalized, status: 'added' };
}

import { ItemStack, system, world } from "@minecraft/server";
import { ITEM_TYPES, STATSCORE } from "../constants.js";
import { getEquipment, persistEquipmentItem } from "../core/equipment.js";
import { getProgressAmount, grantStatsProgress } from "../progression/refinement.js";
import { showLevelUp, showMiningFeedback } from "../feedback/index.js";
import { normalizeId as normalizeBlockId, rollChance } from "../utils.js";
import { getEquipmentStatsContext } from "../shared/context.js";
import { repairItemDurability } from "../shared/durability.js";
import { hasSilkTouch } from "../shared/enchantments.js";
import { findEffectByKind } from "../shared/effectSelectors.js";

const UNBREAKABLE_BLOCKS = new Set([
    "minecraft:air",
    "minecraft:bedrock",
    "minecraft:end_portal",
    "minecraft:end_portal_frame",
    "minecraft:barrier",
    "minecraft:command_block",
    "minecraft:chain_command_block",
    "minecraft:repeating_command_block",
    "minecraft:structure_block",
    "minecraft:jigsaw",
]);

const GARDENER_PLANT_TOKENS = Object.freeze([
    "grass",
    "fern",
    "flower",
    "tulip",
    "rose",
    "dandelion",
    "orchid",
    "bush",
    "fungus",
    "roots",
    "vine",
    "mushroom",
    "sapling",
]);

const GARDENER_EXACT_BLOCKS = new Set([
    "minecraft:pumpkin",
    "minecraft:carved_pumpkin",
    "minecraft:melon_block",
]);

const PRIMAL_FIBER_TOKENS = Object.freeze([
    "grass",
    "fern",
    "vine",
    "roots",
    "fungus",
]);

const ORE_PLATE_DROPS = Object.freeze({
    "minecraft:copper_ore": "utilitycraft:copper_plate",
    "minecraft:deepslate_copper_ore": "utilitycraft:copper_plate",
    "minecraft:iron_ore": "utilitycraft:iron_plate",
    "minecraft:deepslate_iron_ore": "utilitycraft:iron_plate",
    "minecraft:gold_ore": "utilitycraft:gold_plate",
    "minecraft:deepslate_gold_ore": "utilitycraft:gold_plate",
    "minecraft:nether_gold_ore": "utilitycraft:gold_plate",
    "minecraft:ancient_debris": "utilitycraft:netherite_plate",
    "utilitycraft:deepslate_titanium_ore": "utilitycraft:titanium_plate",
});

const ORE_BONUS_DROPS = Object.freeze({
    "minecraft:coal_ore": "minecraft:coal",
    "minecraft:deepslate_coal_ore": "minecraft:coal",
    "minecraft:copper_ore": "minecraft:raw_copper",
    "minecraft:deepslate_copper_ore": "minecraft:raw_copper",
    "minecraft:iron_ore": "minecraft:raw_iron",
    "minecraft:deepslate_iron_ore": "minecraft:raw_iron",
    "minecraft:gold_ore": "minecraft:raw_gold",
    "minecraft:deepslate_gold_ore": "minecraft:raw_gold",
    "minecraft:redstone_ore": "minecraft:redstone",
    "minecraft:deepslate_redstone_ore": "minecraft:redstone",
    "minecraft:lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:deepslate_lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:diamond_ore": "minecraft:diamond",
    "minecraft:deepslate_diamond_ore": "minecraft:diamond",
    "minecraft:emerald_ore": "minecraft:emerald",
    "minecraft:deepslate_emerald_ore": "minecraft:emerald",
    "minecraft:nether_gold_ore": "minecraft:gold_nugget",
    "minecraft:nether_quartz_ore": "minecraft:quartz",
    "minecraft:ancient_debris": "minecraft:ancient_debris",
    "utilitycraft:deepslate_titanium_ore": "utilitycraft:raw_titanium",
    "utilitycraft:deepslate_aetherium_ore": "utilitycraft:aetherium_shard",
    "utilitycraft:end_aetherium_ore": "utilitycraft:aetherium_shard"
});

const ORE_DUST_DROPS = Object.freeze({
    "minecraft:coal_ore": "utilitycraft:coal_dust",
    "minecraft:deepslate_coal_ore": "utilitycraft:coal_dust",
    "minecraft:copper_ore": "utilitycraft:copper_dust",
    "minecraft:deepslate_copper_ore": "utilitycraft:copper_dust",
    "minecraft:iron_ore": "utilitycraft:iron_dust",
    "minecraft:deepslate_iron_ore": "utilitycraft:iron_dust",
    "minecraft:gold_ore": "utilitycraft:gold_dust",
    "minecraft:deepslate_gold_ore": "utilitycraft:gold_dust",
    "utilitycraft:deepslate_titanium_ore": "utilitycraft:titanium_dust",
});

const WORM_SOIL_DROPS = Object.freeze({
    "minecraft:dirt": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:grass_block": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:coarse_dirt": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:rooted_dirt": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:podzol": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:mycelium": Object.freeze({ itemId: "utilitycraft:dirt_handful", min: 1, max: 4 }),
    "minecraft:sand": Object.freeze({ itemId: "utilitycraft:sand_handful", min: 1, max: 4 }),
    "minecraft:red_sand": Object.freeze({ itemId: "utilitycraft:red_sand_handful", min: 1, max: 4 }),
    "minecraft:gravel": Object.freeze({ itemId: "utilitycraft:gravel_fragments", min: 1, max: 4 }),
});

const CROP_GROWTH_CONFIG = Object.freeze({
    "minecraft:wheat": Object.freeze({ ageState: "growth", maxAge: 7 }),
    "minecraft:carrots": Object.freeze({ ageState: "growth", maxAge: 7 }),
    "minecraft:potatoes": Object.freeze({ ageState: "growth", maxAge: 7 }),
    "minecraft:beetroot": Object.freeze({ ageState: "growth", maxAge: 7 }),
    "minecraft:nether_wart": Object.freeze({ ageState: "age", maxAge: 3 }),
});

function cloneLocation(location) {
    if (!location) return null;
    return {
        x: Number(location.x) || 0,
        y: Number(location.y) || 0,
        z: Number(location.z) || 0
    };
}

function sameLocation(left, right) {
    return Number(left?.x) === Number(right?.x)
        && Number(left?.y) === Number(right?.y)
        && Number(left?.z) === Number(right?.z);
}

function includesAnyToken(value, tokens) {
    return tokens.some(token => value.includes(token));
}

function getBlockStateNumber(permutation, stateKey) {
    try {
        const value = permutation?.getState?.(stateKey);
        return typeof value === "number" ? value : null;
    } catch {
        return null;
    }
}

function getCropGrowthInfo(blockId) {
    const normalized = normalizeBlockId(blockId);
    if (!normalized) return null;

    if (CROP_GROWTH_CONFIG[normalized]) {
        return CROP_GROWTH_CONFIG[normalized];
    }

    if (normalized.startsWith("utilitycraft:") && normalized.endsWith("_crop")) {
        return {
            ageState: "utilitycraft:age",
            maxAge: 5,
        };
    }

    return null;
}

function isRipeCropSnapshot(snapshot) {
    const growthInfo = getCropGrowthInfo(snapshot?.blockId);
    if (!growthInfo) return false;

    const currentAge = getBlockStateNumber(snapshot?.blockPermutation, growthInfo.ageState);
    return typeof currentAge === "number" && currentAge >= growthInfo.maxAge;
}

function isCreativePlayer(player) {
    const gameMode = player?.getGameMode?.();
    return player?.isInCreative?.() === true
        || (typeof gameMode === "string" && gameMode.toLowerCase() === "creative");
}

function isBreakableBlock(block) {
    const blockId = normalizeBlockId(block?.typeId);
    return !!block && !UNBREAKABLE_BLOCKS.has(blockId);
}

function isLeafBlockId(blockId) {
    return normalizeBlockId(blockId).includes("leaves");
}

function isGardenerTargetBlockId(blockId) {
    const normalized = normalizeBlockId(blockId);
    if (!normalized || UNBREAKABLE_BLOCKS.has(normalized)) return false;
    if (isLeafBlockId(normalized)) return true;
    if (GARDENER_EXACT_BLOCKS.has(normalized)) return true;
    return includesAnyToken(normalized, GARDENER_PLANT_TOKENS);
}

function isPrimalTargetBlockId(blockId) {
    const normalized = normalizeBlockId(blockId);
    if (!normalized || UNBREAKABLE_BLOCKS.has(normalized)) return false;
    if (isLeafBlockId(normalized)) return true;
    if (normalized.includes("sugar_cane") || normalized.endsWith(":reeds")) return true;
    return includesAnyToken(normalized, PRIMAL_FIBER_TOKENS);
}

function shouldSpawnPrimalFiber(blockId) {
    const normalized = normalizeBlockId(blockId);
    return isLeafBlockId(normalized) || includesAnyToken(normalized, PRIMAL_FIBER_TOKENS);
}

function formatCommandLocation(location) {
    return `${Math.floor(Number(location?.x) || 0)} ${Math.floor(Number(location?.y) || 0)} ${Math.floor(Number(location?.z) || 0)}`;
}

function canUseDefinitionForMining(definition) {
    if (!definition || definition.enabled === false) return false;
    if (definition.type === ITEM_TYPES.weapon || definition.type === ITEM_TYPES.support) return false;
    return getProgressAmount(definition, "block", 0) > 0
        || getProgressAmount(definition, "ore", 0) > 0
        || (definition?.mining?.oreBonusChance ?? 0) > 0
        || (Array.isArray(definition?.mining?.effects) && definition.mining.effects.length > 0);
}

function getFortune3BonusCount(blockId) {
    const normalized = normalizeBlockId(blockId);
    if (normalized === "minecraft:redstone_ore" || normalized === "minecraft:deepslate_redstone_ore") {
        return 2 + Math.floor(Math.random() * 4);
    }

    if (normalized === "minecraft:lapis_ore" || normalized === "minecraft:deepslate_lapis_ore") {
        return 2 + Math.floor(Math.random() * 5);
    }

    if (normalized === "minecraft:nether_gold_ore") {
        return 3 + Math.floor(Math.random() * 5);
    }

    if (normalized === "minecraft:ancient_debris") {
        return 0;
    }

    if (ORE_BONUS_DROPS[normalized]) {
        return 1 + Math.floor(Math.random() * 3);
    }

    return 0;
}

function spawnBonusDrop(dimension, location, itemId) {
    if (!dimension || !location || !itemId) return false;

    try {
        dimension.spawnItem(new ItemStack(itemId, 1), {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        });
        return true;
    } catch {
        return false;
    }
}

function spawnBonusDropCount(dimension, location, itemId, amount = 1) {
    if (!dimension || !location || !itemId) return false;

    try {
        dimension.spawnItem(new ItemStack(itemId, Math.max(1, Math.floor(Number(amount) || 1))), {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        });
        return true;
    } catch {
        return false;
    }
}

function rollInclusiveAmount(min = 1, max = 1) {
    const safeMin = Math.max(1, Math.floor(Number(min) || 1));
    const safeMax = Math.max(safeMin, Math.floor(Number(max) || safeMin));
    return safeMin + Math.floor(Math.random() * ((safeMax - safeMin) + 1));
}

function spawnBonusXp(dimension, location, amount) {
    if (!dimension || !location || amount <= 0) return false;

    try {
        if (typeof dimension.spawnExperienceOrb !== "function") {
            return false;
        }

        dimension.spawnExperienceOrb({
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        }, amount);
        return true;
    } catch {
        return false;
    }
}

function spawnDuplicateLoot(player, location) {
    if (!player || !location || typeof player.runCommand !== "function") return false;

    try {
        const pos = formatCommandLocation(location);
        player.runCommand(`loot spawn ${pos} mine ${pos} mainhand`);
        return true;
    } catch {
        return false;
    }
}

function clearBlockWithoutDrops(dimension, location) {
    if (!dimension || !location) return false;

    try {
        dimension.runCommand(`setblock ${formatCommandLocation(location)} air replace`);
        return true;
    } catch {
        return false;
    }
}

function destroyBlockWithDrops(dimension, location) {
    if (!dimension || !location) return false;

    try {
        dimension.runCommand(`setblock ${formatCommandLocation(location)} air destroy`);
        return true;
    } catch {
        return false;
    }
}

function collectFlatAreaBlocks(dimension, center, radius, predicate) {
    const blocks = [];
    if (!dimension || !center) return blocks;

    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
            const location = {
                x: center.x + offsetX,
                y: center.y,
                z: center.z + offsetZ,
            };

            const block = dimension.getBlock(location);
            if (!isBreakableBlock(block)) continue;
            if (typeof predicate === "function" && !predicate(block)) continue;

            blocks.push({
                block,
                location: cloneLocation(block.location),
                typeId: block.typeId,
                permutation: block.permutation,
            });
        }
    }

    return blocks;
}

function collectDrillBlocks(dimension, center, size) {
    const blocks = [];
    if (!dimension || !center) return blocks;

    const radius = Math.max(1, Math.floor((Math.max(3, Number(size) || 3) - 1) / 2));
    const minY = center.y - 1;
    const maxY = minY + (radius * 2);

    for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = center.z - radius; z <= center.z + radius; z++) {
                const block = dimension.getBlock({ x, y, z });
                if (!isBreakableBlock(block)) continue;

                blocks.push({
                    block,
                    location: cloneLocation(block.location),
                    typeId: block.typeId,
                    permutation: block.permutation,
                });
            }
        }
    }

    return blocks;
}

function executeOperatorBreak(snapshot, attributes, state) {
    const mode = normalizeBlockId(state?.abilityData?.operatorMode ?? "crushy");
    const operatorEffect = findEffectByKind(attributes?.mining?.effects, "operator");
    const size = Math.max(3, Number(operatorEffect?.size ?? (String(snapshot?.expected ?? "").includes("heavy_drill") ? 5 : 3)) || 3);
    const blocks = collectDrillBlocks(snapshot.dimension, snapshot.location, size);
    if (!blocks.length) return;

    for (const blockInfo of blocks) {
        if (mode === "silky") {
            const itemStack = blockInfo.permutation?.getItemStack?.(1);
            if (clearBlockWithoutDrops(snapshot.dimension, blockInfo.location) && itemStack?.typeId) {
                spawnBonusDropCount(snapshot.dimension, blockInfo.location, itemStack.typeId, itemStack.amount ?? 1);
                continue;
            }
        }

        destroyBlockWithDrops(snapshot.dimension, blockInfo.location);

        if (mode === "greedy") {
            const dropId = ORE_BONUS_DROPS[normalizeBlockId(blockInfo.typeId)];
            const bonusAmount = getFortune3BonusCount(blockInfo.typeId);
            if (dropId && bonusAmount > 0) {
                spawnBonusDropCount(snapshot.dimension, blockInfo.location, dropId, bonusAmount);
            }
        }
    }

    system.run(() => processMiningBreak(snapshot));
}

function executeForgerNetherrackBreak(snapshot) {
    if (!clearBlockWithoutDrops(snapshot.dimension, snapshot.location)) return;

    spawnBonusDropCount(snapshot.dimension, snapshot.location, "minecraft:nether_brick", 4);
    system.run(() => processMiningBreak(snapshot));
}

function executeGardenerBreak(snapshot) {
    const blocks = collectFlatAreaBlocks(snapshot.dimension, snapshot.location, 2, block => isGardenerTargetBlockId(block.typeId));
    let applied = false;

    for (const blockInfo of blocks) {
        if (sameLocation(blockInfo.location, snapshot.location)) continue;

        spawnDuplicateLoot(snapshot.player, blockInfo.location);
        applied = destroyBlockWithDrops(snapshot.dimension, blockInfo.location) || applied;
    }

    if (applied) {
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
    }
}

function executePrimalBreak(snapshot) {
    let bonusDrop = false;

    if (shouldSpawnPrimalFiber(snapshot.blockId)) {
        const fiberAmount = 2 + Math.floor(Math.random() * 3);
        bonusDrop = spawnBonusDropCount(snapshot.dimension, snapshot.location, "utilitycraft:fiber", fiberAmount) || bonusDrop;
    }

    if (normalizeBlockId(snapshot.blockId).includes("sugar_cane") || normalizeBlockId(snapshot.blockId).endsWith(":reeds")) {
        bonusDrop = spawnBonusDropCount(snapshot.dimension, snapshot.location, "minecraft:sugar_cane", 1 + Math.floor(Math.random() * 2)) || bonusDrop;
    }

    if (bonusDrop) {
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
    }
}

function executeForgerOreBonus(snapshot) {
    const plateId = ORE_PLATE_DROPS[normalizeBlockId(snapshot.blockId)];
    if (!plateId) return false;

    const applied = spawnBonusDrop(snapshot.dimension, snapshot.location, plateId);
    if (applied) {
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
    }

    return applied;
}

function executeCrushingDust(snapshot) {
    const dustId = ORE_DUST_DROPS[normalizeBlockId(snapshot.blockId)];
    if (!dustId) return false;

    const applied = spawnBonusDrop(snapshot.dimension, snapshot.location, dustId);
    if (applied) {
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
    }

    return applied;
}

function executeWormBreak(snapshot) {
    const dropConfig = WORM_SOIL_DROPS[normalizeBlockId(snapshot.blockId)];
    if (!dropConfig) return false;

    const applied = spawnBonusDropCount(
        snapshot.dimension,
        snapshot.location,
        dropConfig.itemId,
        rollInclusiveAmount(dropConfig.min, dropConfig.max)
    );

    if (applied) {
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
    }

    return applied;
}

function replantBrokenCrop(snapshot) {
    if (!isRipeCropSnapshot(snapshot)) return false;

    const growthInfo = getCropGrowthInfo(snapshot.blockId);
    const block = snapshot.dimension?.getBlock?.(snapshot.location);
    if (!growthInfo || !block || !block.isAir) return false;

    try {
        const replantedPermutation = snapshot.blockPermutation?.withState?.(growthInfo.ageState, 0);
        if (!replantedPermutation) return false;

        block.setPermutation(replantedPermutation);
        return true;
    } catch {
        return false;
    }
}

function resolveBerserkPlankId(blockId) {
    const normalized = normalizeBlockId(blockId);
    const woodFamilies = [
        "oak",
        "spruce",
        "birch",
        "jungle",
        "acacia",
        "dark_oak",
        "mangrove",
        "cherry",
        "pale_oak",
    ];

    for (const family of woodFamilies) {
        const ids = [
            `minecraft:${family}_log`,
            `minecraft:stripped_${family}_log`,
            `minecraft:${family}_wood`,
            `minecraft:stripped_${family}_wood`,
        ];

        if (ids.includes(normalized)) {
            return `minecraft:${family}_planks`;
        }
    }

    if ([
        "minecraft:crimson_stem",
        "minecraft:stripped_crimson_stem",
        "minecraft:crimson_hyphae",
        "minecraft:stripped_crimson_hyphae",
    ].includes(normalized)) {
        return "minecraft:crimson_planks";
    }

    if ([
        "minecraft:warped_stem",
        "minecraft:stripped_warped_stem",
        "minecraft:warped_hyphae",
        "minecraft:stripped_warped_hyphae",
    ].includes(normalized)) {
        return "minecraft:warped_planks";
    }

    if ([
        "minecraft:bamboo_block",
        "minecraft:stripped_bamboo_block",
    ].includes(normalized)) {
        return "minecraft:bamboo_planks";
    }

    return null;
}

function isBerserkLogBlockId(blockId) {
    return Boolean(resolveBerserkPlankId(blockId));
}

function executeBerserkLogBreak(snapshot, effect) {
    const plankId = resolveBerserkPlankId(snapshot.blockId);
    if (!plankId) return;
    if (!snapshot.dimension || !snapshot.location) return;

    const dropCenter = {
        x: Number(snapshot.location.x ?? 0) + 0.5,
        y: Number(snapshot.location.y ?? 0) + 0.5,
        z: Number(snapshot.location.z ?? 0) + 0.5,
    };
    const knownNearbyItemIds = new Set();

    // Snapshot nearby item entities before the break so we only touch the fresh log drop.
    try {
        for (const entity of snapshot.dimension.getEntities({
            type: "item",
            location: dropCenter,
            maxDistance: 1.75,
        })) {
            const entityId = entity?.id;
            if (typeof entityId === "string" && entityId.length > 0) {
                knownNearbyItemIds.add(entityId);
            }
        }
    } catch { }

    // Break the log normally first so the world resolves the block as a real mined break.
    if (!destroyBlockWithDrops(snapshot.dimension, snapshot.location)) return;

    const extraMin = Math.max(1, Math.floor(Number(effect?.extraPlanksMin ?? 1) || 1));
    const extraMax = Math.max(extraMin, Math.floor(Number(effect?.extraPlanksMax ?? 4) || 4));
    const totalAmount = 4 + rollInclusiveAmount(extraMin, extraMax);

    system.run(() => {
        // Remove only the newly spawned log item so we can replace it with planks.
        try {
            for (const entity of snapshot.dimension.getEntities({
                type: "item",
                location: dropCenter,
                maxDistance: 1.75,
            })) {
                const entityId = entity?.id;
                if (typeof entityId === "string" && knownNearbyItemIds.has(entityId)) {
                    continue;
                }

                const stack = entity?.getComponent?.("minecraft:item")?.itemStack;
                if (normalizeBlockId(stack?.typeId) !== normalizeBlockId(snapshot.blockId)) {
                    continue;
                }

                entity.remove();
            }
        } catch { }

        // Replace the removed log drop with 4 planks plus the Berserk extra plank roll.
        spawnBonusDropCount(snapshot.dimension, snapshot.location, plankId, totalAmount);
        showMiningFeedback(snapshot.player, snapshot.blockId, { bonusDrop: true, bonusXp: false });
        processMiningBreak(snapshot);
    });
}

function applyMiningEffects({ attributes, isOre, dimension, location }) {
    const effects = Array.isArray(attributes?.mining?.effects) ? attributes.mining.effects : [];
    if (!effects.length) {
        return { bonusXp: false };
    }

    let bonusXp = false;

    for (const effect of effects) {
        if (!effect || typeof effect !== "object") continue;

        const kind = String(effect.kind ?? "").toLowerCase();
        if (kind !== "xp_orb") continue;

        const requiresOre = effect.requireOre !== false;
        const on = String(effect.on ?? "ore_break").toLowerCase();
        if ((requiresOre || on === "ore_break") && !isOre) continue;

        const xpAmount = Math.max(1, Math.floor(Number(effect.xpAmount ?? 1) || 1));
        bonusXp = spawnBonusXp(dimension, location, xpAmount) || bonusXp;
    }

    return { bonusXp };
}

function processMiningBreak(snapshot) {
    const { player, blockId, location, dimension, expected } = snapshot;
    if (!player || !blockId) return;

    const context = getEquipmentStatsContext(player, STATSCORE.slots.mainhand, expected);
    if (!context) return;

    const { stack, definition, attributes } = context;
    if (!canUseDefinitionForMining(definition)) return;

    const isOre = Boolean(ORE_BONUS_DROPS[blockId]) || blockId.endsWith("_ore");
    const reason = isOre ? "ore" : "block";
    const progressAmount = getProgressAmount(definition, reason, isOre ? 4 : 1);

    let changed = false;
    let bonusDrop = false;
    let bonusXp = false;

    if (isOre && !hasSilkTouch(stack)) {
        const dropId = ORE_BONUS_DROPS[blockId];
        if (dropId && rollChance(attributes.mining.oreBonusChance, 0)) {
            bonusDrop = spawnBonusDrop(dimension, location, dropId);
        }
    }

    if (rollChance(attributes.mining.durabilitySaveChance, 0)) {
        changed = repairItemDurability(stack) || changed;
    }

    bonusXp = Boolean(applyMiningEffects({ attributes, isOre, dimension, location }).bonusXp);

    const progress = grantStatsProgress(stack, definition, progressAmount, reason, {
        forcePersist: isOre || bonusDrop
    });
    changed = progress.changed || changed;

    if (changed) {
        persistEquipmentItem(player, STATSCORE.slots.mainhand, stack);
    }

    showLevelUp(player, stack, progress);
    showMiningFeedback(player, blockId, { bonusDrop, bonusXp });
}

function snapshotBreakEvent(event) {
    const player = event?.player;
    if (!player) return null;

    const blockId = event?.brokenBlockPermutation?.type?.id
        ?? event?.brokenBlockPermutation?.typeId
        ?? event?.block?.typeId
        ?? "";
    const location = cloneLocation(event?.block?.location);
    const dimension = event?.dimension ?? player.dimension;
    if (!blockId || !location || !dimension) return null;

    const expected = event?.itemStack?.typeId ?? getEquipment(player, STATSCORE.slots.mainhand).item?.typeId;
    if (!expected) return null;
    return {
        player,
        blockId,
        blockPermutation: event?.brokenBlockPermutation ?? event?.block?.permutation ?? null,
        location,
        dimension,
        expected
    };
}

function handleBeforeBreak(event) {
    try {
        if (event?.cancel === true) return;

        const snapshot = snapshotBreakEvent(event);
        if (!snapshot || isCreativePlayer(snapshot.player)) return;

        const context = getEquipmentStatsContext(snapshot.player, STATSCORE.slots.mainhand, snapshot.expected);
        if (!context || !canUseDefinitionForMining(context.definition)) return;

        const { state, attributes } = context;
        const operatorEffect = findEffectByKind(attributes?.mining?.effects, "operator");
        const gardenerEffect = findEffectByKind(attributes?.mining?.effects, "gardener");
        const primalEffect = findEffectByKind(attributes?.mining?.effects, "primal");
        const forgerEffect = findEffectByKind(attributes?.mining?.effects, "forger");
        const reaperEffect = findEffectByKind(attributes?.mining?.effects, "reaper");
        const berserkEffect = findEffectByKind(attributes?.mining?.effects, "berserk_logging")
            ?? findEffectByKind(attributes?.mining?.effects, "berserk");

        if (operatorEffect) {
            const mode = normalizeBlockId(state?.abilityData?.operatorMode ?? "crushy");
            if (mode !== "crushy") {
                event.cancel = true;
                system.run(() => executeOperatorBreak(snapshot, attributes, state));
                return;
            }
        }

        if (berserkEffect && snapshot.player?.isSneaking && isBerserkLogBlockId(snapshot.blockId)) {
            event.cancel = true;
            system.run(() => executeBerserkLogBreak(snapshot, berserkEffect));
            return;
        }

        if (forgerEffect && normalizeBlockId(snapshot.blockId) === "minecraft:netherrack") {
            event.cancel = true;
            system.run(() => executeForgerNetherrackBreak(snapshot));
            return;
        }

        if (gardenerEffect && isGardenerTargetBlockId(snapshot.blockId)) {
            spawnDuplicateLoot(snapshot.player, snapshot.location);
        }

        if (primalEffect && isPrimalTargetBlockId(snapshot.blockId)) {
            spawnDuplicateLoot(snapshot.player, snapshot.location);
        }

        if (reaperEffect && isRipeCropSnapshot(snapshot)) {
            spawnDuplicateLoot(snapshot.player, snapshot.location);
        }
    } catch (error) {
        console.warn("[StatsCore] before break handler failed:", error);
    }
}

function handleAfterBreak(event) {
    const snapshot = snapshotBreakEvent(event);
    if (!snapshot) return;

    system.run(() => {
        processMiningBreak(snapshot);

        try {
            const context = getEquipmentStatsContext(snapshot.player, STATSCORE.slots.mainhand, snapshot.expected);
            if (!context) return;

            const { attributes } = context;

            if (findEffectByKind(attributes?.mining?.effects, "gardener") && isGardenerTargetBlockId(snapshot.blockId)) {
                executeGardenerBreak(snapshot);
            }

            if (findEffectByKind(attributes?.mining?.effects, "primal") && isPrimalTargetBlockId(snapshot.blockId)) {
                executePrimalBreak(snapshot);
            }

            if (findEffectByKind(attributes?.mining?.effects, "crushing")) {
                executeCrushingDust(snapshot);
            }

            if (findEffectByKind(attributes?.mining?.effects, "forger")) {
                executeForgerOreBonus(snapshot);
            }

            if (findEffectByKind(attributes?.mining?.effects, "reaper")) {
                replantBrokenCrop(snapshot);
            }

            if (findEffectByKind(attributes?.mining?.effects, "worm")) {
                executeWormBreak(snapshot);
            }
        } catch (error) {
            console.warn("[StatsCore] after break special handling failed:", error);
        }
    });
}

export function initializeMiningModule() {
    if (globalThis.__statsCoreMiningInitialized) return;
    globalThis.__statsCoreMiningInitialized = true;

    const beforeBreakEvents = world.beforeEvents?.playerBreakBlock;
    const afterBreakEvents = world.afterEvents?.playerBreakBlock;

    if (!beforeBreakEvents?.subscribe && !afterBreakEvents?.subscribe) {
        console.warn("[StatsCore] playerBreakBlock unavailable; mining module disabled.");
        return;
    }

    if (beforeBreakEvents?.subscribe) {
        beforeBreakEvents.subscribe(handleBeforeBreak);
    }

    if (afterBreakEvents?.subscribe) {
        afterBreakEvents.subscribe(handleAfterBreak);
        return;
    }

    beforeBreakEvents?.subscribe?.(event => {
        if (event?.cancel === true) return;

        const snapshot = snapshotBreakEvent(event);
        if (!snapshot) return;

        system.run(() => processMiningBreak(snapshot));
    });
}

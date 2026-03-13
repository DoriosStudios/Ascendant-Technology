import { ItemStack, system, world } from "@minecraft/server";

const HAMMER_EVENT_IDS = new Set(["dorios:hammerblock"]);
const HAMMER_COMPONENT_ID = "utilitycraft:hammer";
const CRUSHER_RECIPE_EVENT_ID = "utilitycraft:register_crusher_recipe";

/**
 * Local runtime cache for crusher recipes.
 * Filled via script events from UtilityCraft core and recipe injectors.
 */
const crusherRecipes = {};

function registerCrusherRecipes(payload) {
    if (!payload || typeof payload !== "object") return;

    for (const [inputId, data] of Object.entries(payload)) {
        if (!inputId || typeof inputId !== "string") continue;
        if (!data || typeof data !== "object") continue;
        if (!data.output || typeof data.output !== "string") continue;

        crusherRecipes[inputId] = data;
    }
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== CRUSHER_RECIPE_EVENT_ID) return;

    try {
        registerCrusherRecipes(JSON.parse(message));
    } catch (err) {
        console.warn("[Ascendant Technology] Failed to parse crusher recipe payload:", err);
    }
});

function getRecipeForBlock(block, minedBlockPermutation) {
    const blockId = minedBlockPermutation?.type?.id ?? block?.typeId;
    if (!blockId) return null;
    return crusherRecipes[blockId] ?? null;
}

function parseTier(value) {
    const tier = Number(value);
    return Number.isFinite(tier) ? tier : null;
}

function getTierFromComponent(component) {
    if (!component) return null;
    return parseTier(
        component?.customComponentParameters?.params?.tier ??
        component?.params?.tier
    );
}

function getHammerTierFromItem(itemStack) {
    if (!itemStack) return null;

    const explicitComponent = itemStack.getComponent?.(HAMMER_COMPONENT_ID);
    const explicitTier = getTierFromComponent(explicitComponent);
    if (explicitTier !== null) return explicitTier;

    const namespaces = new Set(["utilitycraft"]);
    const itemNamespace = itemStack?.typeId?.split(":")?.[0];
    if (itemNamespace) namespaces.add(itemNamespace);

    for (const namespace of namespaces) {
        const component = itemStack.getComponent?.(`${namespace}:hammer`);
        const tier = getTierFromComponent(component);
        if (tier !== null) return tier;
    }

    const allComponents = itemStack.getComponents?.() ?? [];
    for (const component of allComponents) {
        const componentId = component?.typeId ?? component?.id;
        if (!componentId?.endsWith?.(":hammer")) continue;

        const tier = getTierFromComponent(component);
        if (tier !== null) return tier;
    }

    return null;
}

function hasHammerComponent(itemStack) {
    if (!itemStack) return false;

    if (itemStack.getComponent?.(HAMMER_COMPONENT_ID)) return true;

    const allComponents = itemStack.getComponents?.() ?? [];
    return allComponents.some(component => {
        const componentId = component?.typeId ?? component?.id;
        return componentId?.endsWith?.(":hammer") ?? false;
    });
}

function getHammerTierFromBreakContext(player, itemStackBeforeBreak) {
    if (hasHammerComponent(itemStackBeforeBreak)) {
        return {
            hasComponent: true,
            tier: getHammerTierFromItem(itemStackBeforeBreak)
        };
    }

    const fromEventItem = getHammerTierFromItem(itemStackBeforeBreak);
    if (fromEventItem !== null) {
        return {
            hasComponent: true,
            tier: fromEventItem
        };
    }

    const equippable = player?.getComponent?.("equippable");
    const mainHand = equippable?.getEquipment?.("Mainhand");

    const hasMainHandComponent = hasHammerComponent(mainHand);
    return {
        hasComponent: hasMainHandComponent,
        tier: getHammerTierFromItem(mainHand)
    };
}

function hasRequiredTier(hammerTier, recipeTier) {
    const requiredTier = parseTier(recipeTier);
    if (requiredTier === null) return true;

    // If tier cannot be resolved from item in this runtime context,
    // keep compatibility and allow the recipe instead of silently failing.
    if (hammerTier === null) return true;

    return hammerTier >= requiredTier;
}

function replaceVanillaDropWithRecipe(block, minedBlockId, recipe) {
    let { x, y, z } = block.location;
    x += 0.5;
    z += 0.5;
    y += 0.2;

    // Wait one tick so vanilla drops exist, then replace them.
    system.run(() => {
        const closest = block.dimension.getEntities({
            type: "item",
            maxDistance: 3,
            location: { x, y, z }
        }).find(entity =>
            entity?.getComponent("minecraft:item")?.itemStack.typeId === minedBlockId
        );

        if (!closest) return;

        closest.remove();
        block.dimension.spawnItem(new ItemStack(recipe.output, recipe.amount ?? 1), { x, y, z });
    });
}

world.afterEvents.playerBreakBlock.subscribe(event => {
    const { block, brokenBlockPermutation, player, itemStackBeforeBreak } = event;
    if (!block || !player) return;

    const hammerState = getHammerTierFromBreakContext(player, itemStackBeforeBreak);
    if (!hammerState.hasComponent) return;

    const recipe = getRecipeForBlock(block, brokenBlockPermutation);
    if (!recipe) return;

    if (!hasRequiredTier(hammerState.tier, recipe.tier)) return;

    const minedBlockId = brokenBlockPermutation?.type?.id ?? block.typeId;
    if (!minedBlockId) return;

    replaceVanillaDropWithRecipe(block, minedBlockId, recipe);
});

/**
 * ScriptEvent handler to hammer a block at given coordinates.
 * Uses hammer tier from the player's main hand component, breaks the block, and drops the recipe output.
 */
system.afterEvents.scriptEventReceive.subscribe(e => {
    const { id, message, sourceEntity } = e
    const normalizedId = String(id ?? "").toLowerCase();

    if (HAMMER_EVENT_IDS.has(normalizedId)) {
        try {
            if (!sourceEntity?.dimension) return;

            const [x, y, z] = message.split(',').map(Number)
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

            const dim = sourceEntity.dimension
            const block = dim.getBlock({ x, y, z })
            if (!block) return

            const perm = block.permutation
            const recipe = crusherRecipes[perm?.type?.id]
            if (!recipe) return

            // Get hammer tier from custom item component
            const eq = sourceEntity.getComponent('equippable')
            const main = eq?.getEquipment('Mainhand')
            const hammerTier = getHammerTierFromItem(main)

            // Check required tier
            if (!hasRequiredTier(hammerTier, recipe.tier)) return

            const dropPos = { x: x + 0.5, y: y + 0.2, z: z + 0.5 }

            // Replace block with air and drop result
            system.run(() => {
                const currentBlock = dim.getBlock({ x, y, z });
                if (!currentBlock || currentBlock.typeId === 'minecraft:air') return;

                dim.setBlockType(block.location, 'minecraft:air')
                dim.spawnItem(new ItemStack(recipe.output, recipe.amount ?? 1), dropPos)
            })
        } catch (err) {
            console.warn(`[hammerBlock] Error: ${err}`)
        }
    }
})

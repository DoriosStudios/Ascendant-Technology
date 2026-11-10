import { ItemStack, world } from "@minecraft/server";

// One hide per Silverfish, including automated kills; no Looting multiplier.
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== "minecraft:silverfish" || !world.gameRules.doMobLoot) return;
    deadEntity.dimension.spawnItem(new ItemStack("utilitycraft:contaminated_hide", 1), deadEntity.location);
});

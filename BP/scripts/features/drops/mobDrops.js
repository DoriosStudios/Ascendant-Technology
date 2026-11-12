import { ItemStack, world } from "@minecraft/server";

const ENDERLING_TEAR_ID = "utilitycraft:enderling_tear";
const ENDERMAN_TEAR_CHANCE = 0.0001;
const ENDERLING_TEAR_CHANCE = 0.01;
const ENDERLING_ID = /enderling|blastling|snareling|watchling|endersent/;
const AUXILIARY_ID = /(?:^|[:_])(?:projectile|ammo|goo|web|trap)(?:[:_]|$)/;

export function getEnderlingTearChance(entity) {
    if (entity.typeId === "minecraft:enderman") return ENDERMAN_TEAR_CHANCE;
    const family = entity.getComponent?.("minecraft:type_family");
    if (family?.hasTypeFamily("projectile") || family?.hasTypeFamily("inanimate")) return 0;
    const typeId = String(entity.typeId ?? "").toLowerCase();
    const id = typeId.split(":").at(-1);
    if (AUXILIARY_ID.test(typeId)) return 0;
    return ENDERLING_ID.test(id) || family?.hasTypeFamily("enderling") || family?.hasTypeFamily("Enderling")
        ? ENDERLING_TEAR_CHANCE : 0;
}

export function rollEnderlingTear(entity, random = Math.random) {
    const chance = getEnderlingTearChance(entity);
    return chance > 0 && random() < chance
        ? new ItemStack(ENDERLING_TEAR_ID, 1) : undefined;
}

// One hide per Silverfish, including automated kills; no Looting multiplier.
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (!world.gameRules.doMobLoot) return;
    if (deadEntity.typeId === "minecraft:silverfish") {
        deadEntity.dimension.spawnItem(new ItemStack("utilitycraft:contaminated_hide", 1), deadEntity.location);
    }
    const tear = rollEnderlingTear(deadEntity);
    if (tear) deadEntity.dimension.spawnItem(tear, deadEntity.location);
});

import { ItemStack, EnchantmentTypes } from "@minecraft/server";
import { getStatsCoreDefinition } from "../../../ATCore/StatsCore/core/registry.js";
import { WEAPON_DAMAGE } from "./weaponDamage.js";
export function isCombatItem(stack) {
    if (!stack || stack.amount !== 1) return false;
    const definition = getStatsCoreDefinition(stack);
    return ["weapon", "hybrid"].includes(definition?.type)
        || WEAPON_DAMAGE[stack.typeId] > 0
        || /(?:sword|axe|mace|trident|bow|spear|staff|wand|shield)$/.test(stack.typeId);
}
export function serializeWeapon(stack) {
    if (!stack) return undefined;
    return {
        id: stack.typeId, name: stack.nameTag, lore: stack.getLore(),
        durability: stack.getComponent("minecraft:durability")?.damage,
        enchantments: stack.getComponent("minecraft:enchantable")?.getEnchantments().map(e => ({ id: e.type.id, level: e.level })),
        properties: Object.fromEntries(stack.getDynamicPropertyIds().map(id => [id, stack.getDynamicProperty(id)])),
        canDestroy: stack.getCanDestroy(), canPlaceOn: stack.getCanPlaceOn(),
        keepOnDeath: stack.keepOnDeath, lockMode: stack.lockMode,
    };
}
export function deserializeWeapon(data) {
    if (!data) return undefined;
    const stack = new ItemStack(data.id, 1);
    if (data.name !== undefined) stack.nameTag = data.name;
    stack.setLore(data.lore ?? []);
    stack.setCanDestroy(data.canDestroy ?? []); stack.setCanPlaceOn(data.canPlaceOn ?? []);
    if (data.keepOnDeath !== undefined) stack.keepOnDeath = data.keepOnDeath;
    if (data.lockMode !== undefined) stack.lockMode = data.lockMode;
    for (const [id, value] of Object.entries(data.properties ?? {})) stack.setDynamicProperty(id, value);
    const durability = stack.getComponent("minecraft:durability");
    if (durability && data.durability !== undefined) durability.damage = data.durability;
    const enchantable = stack.getComponent("minecraft:enchantable");
    for (const enchantment of data.enchantments ?? []) {
        if (!enchantable) throw new Error(`Missing enchantable component: ${data.id}`);
        enchantable.addEnchantment({ type: EnchantmentTypes.get(enchantment.id), level: enchantment.level });
    }
    return stack;
}
export function enchantLevel(stack, id) {
    return stack?.getComponent("minecraft:enchantable")?.getEnchantment(id)?.level ?? 0;
}
export function weaponDamage(stack) {
    if (!stack) return 0;
    if (WEAPON_DAMAGE[stack.typeId] !== undefined) return WEAPON_DAMAGE[stack.typeId];
    const id = stack.typeId.split(":")[1];
    if (id === "trident") return 9;
    if (id === "mace") return 6;
    if (id === "bow" || id === "crossbow") return 2;
    const tier = { wooden: 4, golden: 4, stone: 5, copper: 5, iron: 6, diamond: 7, netherite: 8 };
    for (const [material, amount] of Object.entries(tier)) {
        if (id === `${material}_sword`) return amount;
        if (id === `${material}_axe`) return amount - 1;
    }
    return 1;
}
export function wearWeapon(stack) {
    const durability = stack?.getComponent("minecraft:durability");
    if (!durability) return stack;
    const unbreaking = enchantLevel(stack, "unbreaking");
    const chance = durability.getDamageChance?.(unbreaking) ?? 100 / (unbreaking + 1);
    if (Math.random() * 100 >= chance) return stack;
    if (durability.damage + 1 >= durability.maxDurability) return undefined;
    durability.damage++;
    return stack;
}

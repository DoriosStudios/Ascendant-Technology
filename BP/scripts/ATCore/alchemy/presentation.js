import { POTION_FAMILIES } from "../../config/alchemy.js";

// Liquid colors sampled from the existing bottle textures, excluding glass and cork.
const COLORS = {
    swiftness: 0x2094a1,
    slowness: 0x586f8e,
    leaping: 0xa0a154,
    strength: 0xa17e00,
    healing: 0x9d1716,
    harming: 0x6b4043,
    poison: 0x56673f,
    regeneration: 0x823a6c,
    nightvision: 0x7ba141,
    invisibility: 0x9c9c9c,
    fire_resistance: 0xa16100,
    water_breathing: 0x608a7a,
    weakness: 0x2e312e,
    slow_falling: 0x9c8477,
    turtle_master: 0x595291,
    wind_charged: 0x777ea0,
    weaving: 0x4c4239,
    oozing: 0x61a167,
    infested: 0x596259,
    haste: 0x926b23,
    resistance: 0x545c70,
    absorption: 0x588d99,
    health_boost: 0xa41b1f,
    wither: 0x4a3e37,
    levitation: 0x9ac8de,
    blindness: 0xa4342b,
    darkness: 0x161617,
    saturation: 0x7e5641,
    marked: 0x330b05,
    bleeding: 0x7a0000,
    blessed: 0xd7c5ac,
    cursed: 0x331f3e,
    berserk: 0x7a2216,
    adaptive_resilience: 0xb4b5bf,
    soul_collector: 0x077b97,
};
const presentations = new Map(POTION_FAMILIES.map((family, index) => {
    const rgb = COLORS[family.id] ?? 0xb34de6;
    return [family.id, {
        textureIndex: index * 2,
        color: { red: (rgb >> 16 & 255) / 255, green: (rgb >> 8 & 255) / 255, blue: (rgb & 255) / 255 },
    }];
}));

export function getPotionPresentation(potion) {
    const presentation = presentations.get(potion.family) ?? presentations.values().next().value;
    return {
        color: presentation.color,
        textureIndex: presentation.textureIndex + Number(potion.form === "lingering"),
    };
}

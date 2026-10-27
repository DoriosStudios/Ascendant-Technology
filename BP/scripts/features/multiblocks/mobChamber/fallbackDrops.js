// Original compact drop map. Factual ranges checked against Mojang's vanilla
// samples at 46ba6ea985fb5a92d79a9419198f10dda14c199d; no game JSON is bundled.
// Adult, unburned, unsheared, player-kill baseline; no equipment/raid/child splits.
const drop = (id, min = 1, max = min, weight = 1) => ({ id: `minecraft:${id}`, min, max, weight });
const pool = (choices, chance = 1, rolls = [1, 1]) => ({ choices, chance, rolls });
const single = (...drops) => drops.map(entry => pool([entry]));
const cow = single(drop("leather", 0, 2), drop("beef", 1, 3));
export const FALLBACK_DROPS = Object.freeze({
    blaze: single(drop("blaze_rod", 0, 1)),
    chicken: single(drop("feather", 0, 2), drop("chicken")),
    cow, mooshroom: cow,
    creeper: single(drop("gunpowder", 0, 2)),
    enderman: single(drop("ender_pearl", 0, 1)),
    guardian: [
        ...single(drop("prismarine_shard", 0, 2)),
        pool([drop("cod", 1, 1, 2), drop("prismarine_crystals", 1, 1, 2), { weight: 1 }]),
        pool([drop("cod", 1, 1, 60), drop("salmon", 1, 1, 25), drop("tropical_fish", 1, 1, 2), drop("pufferfish", 1, 1, 13)], 0.025),
    ],
    hoglin: single(drop("porkchop", 2, 4), drop("leather", 0, 1)),
    magma_cube: single(drop("magma_cream", 0, 1)),
    pig: single(drop("porkchop", 1, 3)),
    piglin: [],
    sheep: single(drop("white_wool"), drop("mutton", 1, 2)),
    skeleton: single(drop("arrow", 0, 2), drop("bone", 0, 2)),
    slime: single(drop("slime_ball", 0, 2)),
    spider: single(drop("string", 0, 2), drop("spider_eye", 0, 1)),
    wither_skeleton: [...single(drop("coal", 0, 1), drop("bone", 0, 2)), pool([drop("wither_skeleton_skull")], 0.025)],
    zombie: [...single(drop("rotten_flesh", 0, 2)), pool([drop("iron_ingot"), drop("carrot"), drop("potato")], 0.025)],
    pillager: single(drop("arrow", 0, 2)),
    vindicator: single(drop("emerald", 0, 1)),
    witch: [pool([drop("glowstone_dust", 0, 2), drop("sugar", 0, 2), drop("spider_eye", 0, 2),
        drop("glass_bottle", 0, 2), drop("gunpowder", 0, 2), drop("stick", 0, 2, 2)], 1, [1, 3]),
        ...single(drop("redstone", 4, 8))],
    evoker: single(drop("emerald", 0, 1), drop("totem_of_undying")),
});

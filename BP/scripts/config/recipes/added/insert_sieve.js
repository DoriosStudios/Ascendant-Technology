import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    const newDrops = {
        "utilitycraft:crushed_cobbled_deepslate": [
            { item: "utilitycraft:aetherium_shard", amount: 1, chance: 0.005, tier: 7 },
        ],
        "utilitycraft:crushed_endstone": [
            { item: "utilitycraft:aetherium_shard", amount: 1, chance: 0.1, tier: 5 },
        ]
    };
    system.sendScriptEvent("utilitycraft:register_sieve_drop", JSON.stringify(newDrops));;
});
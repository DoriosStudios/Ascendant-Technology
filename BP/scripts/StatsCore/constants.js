export const STATSCORE = Object.freeze({
    namespace: "utilitycraft",
    name: "StatsCore",
    version: 1,
    props: Object.freeze({
        uid: "utilitycraft:statscore_uid",
        version: "utilitycraft:statscore_version",
        level: "utilitycraft:statscore_level",
        xp: "utilitycraft:statscore_xp",
        affinity: "utilitycraft:statscore_affinity",
        branch: "utilitycraft:statscore_branch",
        refinement: "utilitycraft:statscore_refinement",
        abilityData: "utilitycraft:statscore_ability_data",
        loreSignature: "utilitycraft:statscore_lore_signature"
    }),
    lore: Object.freeze({
        start: "§r§8[StatsCore]",
        end: "§r§8[/StatsCore]"
    }),
    slots: Object.freeze({
        mainhand: "Mainhand",
        offhand: "Offhand",
        armor: Object.freeze(["Head", "Chest", "Legs", "Feet"])
    }),
    scriptEvents: Object.freeze({
        register: "utilitycraft:register_statscore",
        inspect: "utilitycraft:statscore_inspect",
        reset: "utilitycraft:statscore_reset"
    }),
    runtime: Object.freeze({
        openingWindowTicks: 80,
        feedbackCooldownTicks: 12,
        markCleanupSize: 96
    }),
    progression: Object.freeze({
        maxLevel: 30,
        baseXp: 60,
        growth: 1.22,
        persistEveryXp: 24
    })
});

export const ITEM_TYPES = Object.freeze({
    weapon: "weapon",
    tool: "tool",
    hybrid: "hybrid",
    support: "support"
});

export const AFFINITIES = Object.freeze({
    aggression: "aggression",
    sustain: "sustain",
    mining: "mining",
    control: "control",
    precision: "precision",
    technique: "technique",
    survival: "survival",
    hybrid: "hybrid"
});

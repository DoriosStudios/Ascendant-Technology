import * as DoriosLib from "DoriosLib/index.js";
import { registerLinkNodeIO, setFluidConfig } from "DoriosCore/index.js";
import { ID, SLOTS } from "./config.js";
import { ESSENCE_IDS } from "./essences.js";

registerLinkNodeIO(ID, {
    items: {
        anyInputSlots: [...SLOTS.essences], anyOutputSlots: [...SLOTS.loot],
        inputs: [{ id: "essences", label: "Enabled Essences", color: "§d", slots: [...SLOTS.essences] },
            ...SLOTS.essences.map((slot, index) => ({ id: `essence_${index + 1}`, label: `Essence ${index + 1}`, color: "§d", slots: [slot] }))],
        outputs: [{ id: "loot", label: "Loot", color: "§a", slots: [...SLOTS.loot] }],
    },
    liquids: { anyInputIndices: [], anyOutputIndices: [0], inputs: [],
        outputs: [{ id: "xp", label: "XP", color: "§a", indices: [0] }] },
});

export function configureChamberIO(entity, stats) {
    const enabled = SLOTS.essences.slice(0, stats.essenceSlots);
    DoriosLib.container.setConfig(entity, {
        version: 1, type: "complex", networkFaces: "explicit",
        anyInputSlots: enabled, anyOutputSlots: [...SLOTS.loot],
        inputFilter: { itemIds: [...ESSENCE_IDS], slots: enabled },
        inputConfig: {}, outputConfig: {},
    });
    setFluidConfig(entity, {
        version: 1, type: "complex", networkFaces: "explicit",
        anyInputIndices: [], anyOutputIndices: [0], inputConfig: {}, outputConfig: {},
    });
    entity.setDynamicProperty("at:mob_chamber_io", stats.essenceSlots);
}

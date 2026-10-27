import * as DoriosLib from "DoriosLib/index.js";

// Initial recipes; final progression balance can be adjusted independently of the structure.
DoriosLib.registry.registerCrafterRecipe({
    "titanium_plate,expert_chip,titanium_plate,refined_aetherium_crystal,titanium_case,refined_aetherium_crystal,titanium_plate,advanced_runic_core,titanium_plate": {
        "output": "utilitycraft:mob_chamber_controller",
        "amount": 1
    },
    "titanium_plate,essence_vessel,titanium_plate,refined_aetherium_crystal,advanced_runic_core,refined_aetherium_crystal,titanium_plate,processing_module,titanium_plate": {
        "output": "utilitycraft:mob_chamber_core",
        "amount": 1
    },
    "titanium_plate,essence_vessel,titanium_plate,essence_vessel,titanium_case,essence_vessel,titanium_plate,refined_aetherium_crystal,titanium_plate": {
        "output": "utilitycraft:essence_module",
        "amount": 1
    }
});

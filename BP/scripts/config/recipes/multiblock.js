import * as DoriosLib from "DoriosLib/index.js";

DoriosLib.registry.registerCrafterRecipe({
    "titanium,tungsten,titanium,tungsten,glass,tungsten,titanium,tungsten,titanium": {
        "output": "utilitycraft:reinforced_titanium_glass",
        "amount": 1
    },
    "titanium_plated_block,titanium_plated_block,air,titanium_plated_block,titanium_plated_block,air,air,air,air": {
        "output": "utilitycraft:titanium_bricks",
        "amount": 4
    },
    "titanium_plate,diamond_dust,titanium_plate,diamond_dust,tungsten,diamond_dust,titanium_plate,diamond_dust,titanium_plate": {
        "output": "utilitycraft:titanium_case",
        "amount": 1
    },
    "titanium_plate,energy_cable,titanium_plate,energy_cable,titanium_case,energy_cable,titanium_plate,energy_cable,titanium_plate": {
        "output": "utilitycraft:titanium_energy_port",
        "amount": 1
    },
    "titanium_plate,fluid_pipe,titanium_plate,fluid_pipe,titanium_case,fluid_pipe,titanium_plate,fluid_pipe,titanium_plate": {
        "output": "utilitycraft:titanium_fluid_port",
        "amount": 1
    },
    "black_dye,titanium_plated_block,yellow_dye,air,air,air,air,air,air": {
        "output": "utilitycraft:titanium_hazard_block",
        "amount": 1
    },
    "titanium_plate,item_conduit,titanium_plate,item_conduit,titanium_case,item_conduit,titanium_plate,item_conduit,titanium_plate": {
        "output": "utilitycraft:titanium_item_port",
        "amount": 1
    },
    "titanium_plate,tungsten,titanium_plate,tungsten,titanium_plate,tungsten,titanium_plate,tungsten,titanium_plate": {
        "output": "utilitycraft:titanium_plated_block",
        "amount": 1
    },
    "titanium_plate,tungsten,titanium_plate,tungsten,air,tungsten,titanium_plate,tungsten,titanium_plate": {
        "output": "utilitycraft:titanium_vent_panel",
        "amount": 1
    }
});

DoriosLib.registry.registerInfuserRecipe({
    "utilitycraft:titanium_dust|minecraft:glass": { output: "utilitycraft:tempered_titanium_glass", required: 8 },
});

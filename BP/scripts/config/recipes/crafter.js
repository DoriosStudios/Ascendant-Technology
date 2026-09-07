// @ts-check

import * as DoriosLib from "DoriosLib/index.js";

/**
 * Ascendant Technology recipes accepted by the UtilityCraft Digitizer/Assembler.
 * Patterns mirror every shaped recipe tagged with `utilitycraft_workbench`.
 */
export const crafterRecipeAdditions = {
    "aetherium,echo_shard,aetherium,absolute_chip,ultimate_power_beacon,absolute_chip,aetherium,absolute_chip,aetherium": {
        output: "utilitycraft:absolute_power_beacon",
        amount: 1,
    },
    "netherite_ingot,echo_shard,netherite_ingot,ultimate_chip,expert_power_beacon,ultimate_chip,netherite_ingot,ultimate_chip,netherite_ingot": {
        output: "utilitycraft:ultimate_power_beacon",
        amount: 1,
    },
    "diamond_dust,echo_shard,diamond_dust,expert_chip,advanced_power_beacon,expert_chip,diamond_dust,expert_chip,diamond_dust": {
        output: "utilitycraft:expert_power_beacon",
        amount: 1,
    },
    "energized_iron_ingot,echo_shard,energized_iron_ingot,advanced_chip,basic_power_beacon,advanced_chip,energized_iron_ingot,advanced_chip,energized_iron_ingot": {
        output: "utilitycraft:advanced_power_beacon",
        amount: 1,
    },
    "gold_ingot,echo_shard,gold_ingot,basic_chip,beacon,basic_chip,gold_ingot,machine_case,gold_ingot": {
        output: "utilitycraft:basic_power_beacon",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/components/reinforced_machine_case.json
    "netherite_block,energized_iron_block,netherite_block,netherite_plate,superior_machine_case,netherite_plate,netherite_block,energized_iron_block,netherite_block": {
        output: "utilitycraft:reinforced_machine_case",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/components/superior_machine_case.json
    "titanium_block,tungsten,titanium_block,tungsten,machine_case,tungsten,titanium_block,tungsten,titanium_block": {
        output: "utilitycraft:superior_machine_case",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_battery.json
    "aetherium,ultimate_chip,aetherium,ultimate_chip,ultimate_battery,ultimate_chip,netherite_block,compressed_energized_iron_block_2,netherite_block": {
        output: "utilitycraft:absolute_battery",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_furnator.json
    "aetherium,absolute_chip,aetherium,absolute_chip,ultimate_furnator,absolute_chip,netherite_plate,redstone_block,netherite_plate": {
        output: "utilitycraft:absolute_furnator",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_magmator.json
    "aetherium,glass,aetherium,absolute_chip,ultimate_magmator,absolute_chip,aetherium,absolute_chip,aetherium": {
        output: "utilitycraft:absolute_magmator",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_solar_panel.json
    "steel_plate,absolute_chip,steel_plate,absolute_chip,ultimate_solar_panel,absolute_chip,aetherium,redstone_block,aetherium": {
        output: "utilitycraft:absolute_solar_panel",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_thermo_generator.json
    "copper_block,ultimate_fluid_tank,copper_block,absolute_chip,ultimate_thermo_generator,absolute_chip,aetherium,copper_block,aetherium": {
        output: "utilitycraft:absolute_thermo_generator",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/generators/absolute_wind_turbine.json
    "steel_plate,absolute_chip,steel_plate,absolute_chip,ultimate_wind_turbine,absolute_chip,aetherium,energized_iron_block,aetherium": {
        output: "utilitycraft:absolute_wind_turbine",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/absolute_container.json
    "aetherium,ultimate_fluid_tank,aetherium,netherite_block,absolute_battery,netherite_block,chest,network_center,chest": {
        output: "utilitycraft:absolute_container",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/abyssal_fisher.json
    "titanium,heart_of_the_sea,titanium,tungsten,autofisher,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:abyssal_fisher",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/arc_press_forge.json
    "titanium,piston,titanium,tungsten,electro_press,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:arc_press_forge",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/arcane_enchanter.json
    "titanium,expert_fluid_tank,titanium,tungsten,enchanting_table,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:arcane_enchanter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/catalyst_weaver.json
    "steel_block,expert_fluid_tank,steel_block,ultimate_chip,infuser,ultimate_chip,steel_block,superior_machine_case,steel_block": {
        output: "utilitycraft:catalyst_weaver",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/centrifugal_siever.json
    "titanium,brush,titanium,tungsten,autosieve,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:centrifugal_siever",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/compactor.json
    "steel_ingot,piston,steel_ingot,basic_chip,machine_case,basic_chip,energized_iron_ingot,steel_ingot,energized_iron_ingot": {
        output: "utilitycraft:compactor",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/cryo_chamber.json
    "titanium_plate,expert_fluid_tank,titanium_plate,absolute_chip,packed_ice,absolute_chip,titanium_block,superior_machine_case,titanium_block": {
        output: "utilitycraft:cryo_chamber",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/cryo_freezer.json
    "titanium,packed_ice,titanium,tungsten,cryo_chamber,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:cryo_freezer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/cryo_stabilizer.json
    "titanium,steel_block,titanium,tungsten,cryo_chamber,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:cryo_stabilizer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/cryofluid_synthesizer.json
    "titanium,expert_fluid_tank,titanium,tungsten,cryo_chamber,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:cryofluid_synthesizer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/decompactor.json
    "steel_ingot,sticky_piston,steel_ingot,basic_chip,machine_case,basic_chip,energized_iron_ingot,steel_ingot,energized_iron_ingot": {
        output: "utilitycraft:decompactor",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/disenchanter.json
    "titanium,grindstone,titanium,tungsten,enchantment_station,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:disenchanter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/dual_siever.json
    "titanium,titanium_mesh,titanium,tungsten,autosieve,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:dual_siever",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/duplicator.json
    "aetherium,ender_hopper,aetherium,absolute_chip,expert_fluid_tank,absolute_chip,aetherium_block,reinforced_machine_case,aetherium_block": {
        output: "utilitycraft:duplicator",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/enchantment_station.json
    "absolute_chip,nether_star,absolute_chip,gold_block,enchanting_table,gold_block,diamond_block,reinforced_machine_case,diamond_block": {
        output: "utilitycraft:enchantment_station",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/energizer.json
    "aetherium,redstone_block,aetherium,absolute_chip,expert_battery,absolute_chip,energized_iron_block,reinforced_machine_case,energized_iron_block": {
        output: "utilitycraft:energizer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/genetic_seed_synthesizer.json
    "titanium,netherite_hoe,titanium,tungsten,seed_synthesizer,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:genetic_seed_synthesizer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/impact_crusher.json
    "titanium,heavy_drill,titanium,tungsten,crusher,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:impact_crusher",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/industrial_burner.json
    "titanium,expert_fluid_tank,titanium,tungsten,incinerator,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:industrial_burner",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/industrial_crucible.json
    "titanium,lava_bucket,titanium,tungsten,magmatic_chamber,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:industrial_crucible",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/laser_barrier.json
    "ultimate_chip,red_stained_glass,ultimate_chip,redstone_lamp,redstone_block,redstone_lamp,steel_block,machine_case,steel_block": {
        output: "utilitycraft:laser_barrier",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/liquifier.json
    "aetherium,absolute_chip,aetherium,absolute_chip,expert_fluid_tank,absolute_chip,steel_block,reinforced_machine_case,steel_block": {
        output: "utilitycraft:liquifier",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/pattern_placer.json
    "titanium,dispenser,titanium,tungsten,block_placer,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:pattern_placer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/pulverizer.json
    "titanium,netherite_hammer,titanium,tungsten,crusher,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:pulverizer",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/refining_table.json
    "titanium_plate,aetherium,titanium_plate,absolute_chip,induction_anvil,absolute_chip,titanium_plate,reinforced_machine_case,titanium_plate": {
        output: "utilitycraft:refining_table",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/reinforcement_anvil.json
    "titanium,aetherium,titanium,tungsten,induction_anvil,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:reinforcement_anvil",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/residue_processor.json
    "mechanic_upper,steel_block,mechanic_upper,absolute_chip,crusher,absolute_chip,aetherium,reinforced_machine_case,aetherium": {
        output: "utilitycraft:residue_processor",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/seismic_breaker.json
    "titanium,netherite_pickaxe,titanium,tungsten,block_breaker,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:seismic_breaker",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/vaporworks_processor.json
    "waxed_copper,waxed_copper_grate,waxed_copper,advanced_chip,blast_furnace,advanced_chip,compressed_copper_block,machine_case,compressed_copper_block": {
        output: "utilitycraft:vaporworks_processor",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/machines/verdant_cultivator.json
    "titanium,netherite_hoe,titanium,tungsten,harvester,tungsten,titanium,superior_machine_case,titanium": {
        output: "utilitycraft:verdant_cultivator",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/mob_grinding/mob_magnet.json
    "lapis_block,iron_ingot,redstone_block,iron_ingot,lodestone,iron_ingot,redstone_block,iron_ingot,lapis_block": {
        output: "utilitycraft:mob_magnet",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/overclock/overclock_relay.json
    "titanium_plate,reinforced_cable,titanium_plate,titanium_plate,absolute_chip,titanium_plate,air,superior_machine_case,air": {
        output: "utilitycraft:overclock_relay",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/overclock/overclock_tower.json
    "aetherium,absolute_chip,aetherium,absolute_chip,reinforced_cable,absolute_chip,netherite_plate,superior_machine_case,netherite_plate": {
        output: "utilitycraft:overclock_tower",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/overclock/reinforced_cable.json
    "titanium_nugget,redstone,titanium_nugget,copper_nugget,energized_iron_dust,copper_nugget,titanium_nugget,redstone,titanium_nugget": {
        output: "utilitycraft:reinforced_cable",
        amount: 8,
    },
    // BP/recipes/blocks/machinery/transportation/aetherium_conveyor_bridge_receiver.json
    "energized_iron_dust,redstone,energized_iron_dust,aetherium,energized_iron_dust,aetherium,redstone_block,redstone_block,redstone_block": {
        output: "utilitycraft:aetherium_conveyor_bridge_receiver",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/aetherium_conveyor_bridge_transmitter.json
    "aetherium,redstone_block,aetherium,redstone_block,redstone,redstone_block,aetherium,redstone_block,aetherium": {
        output: "utilitycraft:aetherium_conveyor_bridge_transmitter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/aetherium_conveyor_horizontal.json
    "aetherium,aetherium,aetherium,redstone,energized_iron_dust,redstone,air,air,air": {
        output: "utilitycraft:aetherium_conveyor_horizontal",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/aetherium_conveyor_inclined.json
    "air,air,aetherium,air,aetherium,energized_iron_dust,aetherium,energized_iron_dust,redstone": {
        output: "utilitycraft:aetherium_conveyor_inclined",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/aetherium_conveyor_vertical.json
    "air,aetherium,redstone,air,aetherium,energized_iron_dust,air,aetherium,redstone": {
        output: "utilitycraft:aetherium_conveyor_vertical",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/copper_conveyor_bridge_receiver.json
    "energized_iron_dust,redstone,energized_iron_dust,copper_ingot,energized_iron_dust,copper_ingot,redstone_block,redstone_block,redstone_block": {
        output: "utilitycraft:copper_conveyor_bridge_receiver",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/copper_conveyor_bridge_transmitter.json
    "copper_ingot,redstone_block,copper_ingot,redstone_block,redstone,redstone_block,copper_ingot,redstone_block,copper_ingot": {
        output: "utilitycraft:copper_conveyor_bridge_transmitter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/copper_conveyor_horizontal.json
    "copper_ingot,copper_ingot,copper_ingot,redstone,energized_iron_dust,redstone,air,air,air": {
        output: "utilitycraft:copper_conveyor_horizontal",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/copper_conveyor_inclined.json
    "air,air,copper_ingot,air,copper_ingot,energized_iron_dust,copper_ingot,energized_iron_dust,redstone": {
        output: "utilitycraft:copper_conveyor_inclined",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/copper_conveyor_vertical.json
    "air,copper_ingot,redstone,air,copper_ingot,energized_iron_dust,air,copper_ingot,redstone": {
        output: "utilitycraft:copper_conveyor_vertical",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/titanium_conveyor_bridge_receiver.json
    "energized_iron_dust,redstone,energized_iron_dust,titanium_plate,energized_iron_dust,titanium_plate,redstone_block,redstone_block,redstone_block": {
        output: "utilitycraft:titanium_conveyor_bridge_receiver",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/titanium_conveyor_bridge_transmitter.json
    "titanium_plate,redstone_block,titanium_plate,redstone_block,redstone,redstone_block,titanium_plate,redstone_block,titanium_plate": {
        output: "utilitycraft:titanium_conveyor_bridge_transmitter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/titanium_conveyor_horizontal.json
    "titanium_plate,titanium_plate,titanium_plate,redstone,energized_iron_dust,redstone,air,air,air": {
        output: "utilitycraft:titanium_conveyor_horizontal",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/titanium_conveyor_inclined.json
    "air,air,titanium_plate,air,titanium_plate,energized_iron_dust,titanium_plate,energized_iron_dust,redstone": {
        output: "utilitycraft:titanium_conveyor_inclined",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/titanium_conveyor_vertical.json
    "air,titanium_plate,redstone,air,titanium_plate,energized_iron_dust,air,titanium_plate,redstone": {
        output: "utilitycraft:titanium_conveyor_vertical",
        amount: 16,
    },
    // BP/recipes/blocks/machinery/transportation/universal_exporter.json
    "air,universal_cable,air,universal_cable,hopper,universal_cable,air,universal_cable,air": {
        output: "utilitycraft:universal_exporter",
        amount: 1,
    },
    // BP/recipes/blocks/machinery/transportation/universal_importer.json
    "air,universal_cable,air,universal_cable,universal_cable,universal_cable,air,hopper,air": {
        output: "utilitycraft:universal_importer",
        amount: 1,
    },
    // BP/recipes/items/machinery/ultimate_chip.json
    "redstone,aetherium,redstone,aetherium,ultimate_chip,aetherium,redstone,aetherium,redstone": {
        output: "utilitycraft:absolute_chip",
        amount: 1,
    },
    // BP/recipes/items/materials/stack_upgrade.json
    "steel_plate,orange_dye,steel_plate,redstone_block,base_upgrade,redstone_block,steel_plate,aetherium_block,steel_plate": {
        output: "utilitycraft:stack_upgrade",
        amount: 1,
    },
    // BP/recipes/items/modules/base.json
    "steel_ingot,iron_plate,steel_ingot,iron_plate,ender_pearl_dust,iron_plate,steel_ingot,base_upgrade,steel_ingot": {
        output: "utilitycraft:ascane_module_base",
        amount: 1,
    },
    // BP/recipes/items/modules/ench1.json
    "popped_chorus_fruit,void_essence,popped_chorus_fruit,amethyst_shard,titanium_block,amethyst_shard,popped_chorus_fruit,ascane_module_base,popped_chorus_fruit": {
        output: "utilitycraft:enchantability_module",
        amount: 1,
    },
    // BP/recipes/items/modules/ench2.json
    "popped_chorus_fruit,void_essence,popped_chorus_fruit,amethyst_shard,emerald_block,amethyst_shard,popped_chorus_fruit,enchantability_module,popped_chorus_fruit": {
        output: "utilitycraft:enchantability_module_2",
        amount: 1,
    },
    // BP/recipes/items/modules/ench3.json
    "popped_chorus_fruit,void_essence,popped_chorus_fruit,amethyst_shard,compressed_gold_block,amethyst_shard,popped_chorus_fruit,enchantability_module_2,popped_chorus_fruit": {
        output: "utilitycraft:enchantability_module_3",
        amount: 1,
    },
    // BP/recipes/items/modules/ench4.json
    "popped_chorus_fruit,void_essence,popped_chorus_fruit,amethyst_shard,compressed_energized_iron_block,amethyst_shard,popped_chorus_fruit,enchantability_module_3,popped_chorus_fruit": {
        output: "utilitycraft:enchantability_module_4",
        amount: 1,
    },
    // BP/recipes/items/modules/ench5.json
    "popped_chorus_fruit,void_essence,popped_chorus_fruit,amethyst_shard,aetherium_block,amethyst_shard,popped_chorus_fruit,enchantability_module_4,popped_chorus_fruit": {
        output: "utilitycraft:enchantability_module_5",
        amount: 1,
    },
    // BP/recipes/items/modules/prot.json
    "gold_block,totem_of_undying,gold_block,blaze_block,base_upgrade,blaze_block,gold_block,ultimate_chip,gold_block": {
        output: "utilitycraft:curse_protection_module",
        amount: 1,
    },
    // BP/recipes/items/modules/rein1.json
    "iron_plate,steel_plate,iron_plate,iron_plate,ascane_module_base,iron_plate,iron_plate,steel_plate,iron_plate": {
        output: "utilitycraft:reinforcement_module",
        amount: 1,
    },
    // BP/recipes/items/modules/rein2.json
    "iron_block,steel_block,iron_block,iron_block,reinforcement_module,iron_block,iron_block,steel_block,iron_block": {
        output: "utilitycraft:reinforcement_module_2",
        amount: 1,
    },
    // BP/recipes/items/modules/rein3.json
    "compressed_iron_block,compressed_steel_block,compressed_iron_block,compressed_iron_block,reinforcement_module_2,compressed_iron_block,compressed_iron_block,compressed_steel_block,compressed_iron_block": {
        output: "utilitycraft:reinforcement_module_3",
        amount: 1,
    },
    // BP/recipes/items/nets/aetherium_fishing_net.json
    "aetherium,aetherium,aetherium,netherite_fishing_net,aetherium,netherite_fishing_net,aetherium,aetherium,aetherium": {
        output: "utilitycraft:aetherium_fishing_net",
        amount: 1,
    },
    // BP/recipes/items/nets/titanium_fishing_net.json
    "titanium,titanium,titanium,diamond_fishing_net,titanium,diamond_fishing_net,titanium,titanium,titanium": {
        output: "utilitycraft:titanium_fishing_net",
        amount: 1,
    },
    // BP/recipes/items/upgrades/size_upgrade.json
    "basic_chip,gold_dust,basic_chip,gold_dust,base_upgrade,gold_dust,basic_chip,ender_pearl,basic_chip": {
        output: "utilitycraft:size_upgrade",
        amount: 1,
    },
};

DoriosLib.registry.registerCrafterRecipe(crafterRecipeAdditions);

import { system, world } from "@minecraft/server";

/**
 * Registers Cryofluid as a coolant for UtilityCraft Heavy Machinery Expansion.
 * 
 * This uses UtilityCraft's scriptevent system to dynamically register
 * coolant types that can be used in machines like the Thermal Reactor.
 */
world.afterEvents.worldLoad.subscribe(() => {
    // Register Cryofluid as a coolant for Heavy Machinery
    const coolantData = {
        "cryofluid": {
            cooling_efficiency: 1.5,  // 150% effectiveness (superior coolant)
            description: "Advanced cooling fluid from Ascendant Technology"
        }
    };

    system.sendScriptEvent("utilitycraft:register_coolant", JSON.stringify(coolantData));
    console.warn("[Ascendant Technology] Registered Cryofluid as a coolant for Heavy Machinery.");
});

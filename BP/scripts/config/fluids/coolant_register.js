import { world, system } from "@minecraft/server";

const coolantsRegister = {
    "cryofluid": {
        efficiency: 1.5,
        tier: 2
    }
}

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent(
        "utilitycraft:register_coolant",
        JSON.stringify(coolantsRegister)
    )
})
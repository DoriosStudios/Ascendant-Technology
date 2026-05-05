import { registerDefaultStatsCoreDefinitions } from "./defaults.js";
import { initializeCombatModule } from "./combat/index.js";
import { initializeMiningModule } from "./mining/index.js";
import { initializeArmorSupportModule } from "./support/armor.js";
import { initializeStatsCoreScriptEvents } from "./scriptEvents.js";
import { initializeUtilityInteractionModule } from "./utility/index.js";

if (!globalThis.__statsCoreInitialized) {
    globalThis.__statsCoreInitialized = true;

    registerDefaultStatsCoreDefinitions();
    initializeCombatModule();
    initializeMiningModule();
    initializeArmorSupportModule();
    initializeUtilityInteractionModule();
    initializeStatsCoreScriptEvents();

    console.warn("[StatsCore] Initialized.");
}

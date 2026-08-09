import { initializeCombatModule } from "./combat/index.js";
import { initializeMiningModule } from "./mining/index.js";
import { initializeArmorSupportModule } from "./support/armor.js";
import { initializeArmorComponentRegistry } from "./support/armorComponent.js";
import { initializeBootDashModule } from "./support/dash.js";
import { initializeElytraSupportModule } from "./support/elytra.js";
import "./commands.js";
import { initializeStatsCoreRuntime } from "./runtime.js";
import { initializeStatsCoreScriptEvents } from "./scriptEvents.js";
import { initializeUtilityInteractionModule } from "./utility/index.js";
import { initializeEventDrivenStatsModule } from "./eventDriven/index.js";
import { initializeStatsCoreActionbarBridge } from "./shared/messages.js";

if (!globalThis.__statsCoreInitialized) {
    globalThis.__statsCoreInitialized = true;

    initializeStatsCoreRuntime();
    initializeStatsCoreActionbarBridge();
    // Register defensive before-event handlers first so cancelled hits do not
    // schedule combat or armor side effects in later subscribers.
    initializeArmorComponentRegistry();
    initializeEventDrivenStatsModule();
    initializeArmorSupportModule();
    initializeCombatModule();
    initializeMiningModule();
    initializeBootDashModule();
    initializeElytraSupportModule();
    initializeUtilityInteractionModule();
    initializeStatsCoreScriptEvents();

    // console.warn("[StatsCore] Initialized.");
}


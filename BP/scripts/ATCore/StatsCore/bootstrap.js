import { initializeBlessingGate, initializeCombatModule } from "./combat/index.js";
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
import { initializeWindMiningElement } from "./elements/windMining.js";
import { initializeStatsCoreActionbarBridge } from "./shared/messages.js";
import { initializeStatsCoreEffects } from "./effects/index.js";

if (!globalThis.__statsCoreInitialized) {
    globalThis.__statsCoreInitialized = true;

    initializeStatsCoreRuntime();
    initializeStatsCoreActionbarBridge();
    initializeStatsCoreEffects();
    // Blessing decides first so a protected hit cannot reach damage bonuses,
    // defensive side effects, vanilla knockback, or delayed procs.
    initializeBlessingGate();
    // Full defensive negations run before event-driven offensive bonuses.
    initializeArmorComponentRegistry();
    initializeUtilityInteractionModule();
    initializeArmorSupportModule();
    initializeEventDrivenStatsModule();
    initializeWindMiningElement();
    initializeCombatModule();
    initializeMiningModule();
    initializeBootDashModule();
    initializeElytraSupportModule();
    initializeStatsCoreScriptEvents();

    // console.warn("[StatsCore] Initialized.");
}


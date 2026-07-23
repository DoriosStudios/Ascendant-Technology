import { system, world } from "@minecraft/server";
import {
    FLUID_CAPSULE_LEGACY_CONTAINER_REGISTRATIONS,
    FLUID_CAPSULE_LEGACY_HOLDER_REGISTRATIONS,
    FLUID_CAPSULE_OUTPUT_REGISTRATIONS,
    FLUID_CAPSULE_REGISTRATIONS
} from "./capsule_registry.js";

const FLUID_ITEM_EVENTS = Object.freeze({
    registerContainer: "utilitycraft:register_fluid_container",
    registerOutput: "utilitycraft:register_fluid_output",
    registerLegacyContainer: "utilitycraft:register_fluid_item",
    registerLegacyHolder: "utilitycraft:register_fluid_holder"
});

function sendRegistration(eventId, payload) {
    if (!payload || payload.length === 0) return;
    system.sendScriptEvent(eventId, JSON.stringify(payload));
}

world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        sendRegistration(FLUID_ITEM_EVENTS.registerContainer, FLUID_CAPSULE_REGISTRATIONS);
        sendRegistration(FLUID_ITEM_EVENTS.registerOutput, FLUID_CAPSULE_OUTPUT_REGISTRATIONS);
        sendRegistration(FLUID_ITEM_EVENTS.registerLegacyContainer, FLUID_CAPSULE_LEGACY_CONTAINER_REGISTRATIONS);
        sendRegistration(FLUID_ITEM_EVENTS.registerLegacyHolder, FLUID_CAPSULE_LEGACY_HOLDER_REGISTRATIONS);
    }, 0);
});

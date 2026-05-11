import { isStatsCoreEnabled, setStatsCoreEnabled } from "./runtime.js";

function sendCommandMessage(sourceEntity, message) {
    try {
        sourceEntity?.sendMessage?.(message);
    } catch {
        console.warn(message);
    }
}

DoriosAPI.register.command({
    name: "statscore",
    description: "Enables or disables the global StatsCore system",
    permissionLevel: "admin",
    parameters: [
        {
            name: "mode",
            type: "enum",
            enum: ["on", "off"],
        },
    ],
    callback(origin, mode) {
        const source = origin.sourceEntity;
        const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";

        if (normalizedMode !== "on" && normalizedMode !== "off") {
            sendCommandMessage(source, "§cStatsCore: use on or off.");
            return;
        }

        const nextState = normalizedMode === "on";
        const previousState = isStatsCoreEnabled();
        setStatsCoreEnabled(nextState);

        sendCommandMessage(
            source,
            `§${nextState ? "a" : "c"}StatsCore ${nextState ? "enabled" : "disabled"}.`
        );

        if (previousState === nextState) {
            sendCommandMessage(source, "§7StatsCore was already in that state.");
        }

        console.warn(`[StatsCore] ${nextState ? "Enabled" : "Disabled"} (Command).`);
    },
});
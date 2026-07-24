import * as DoriosLib from "DoriosLib/index.js";
import { isStatsCoreEnabled, setStatsCoreEnabled } from "./runtime.js";

function sendCommandMessage(sourceEntity, message) {
    try {
        sourceEntity?.sendMessage?.(message);
    } catch {
        console.warn(message);
    }
}

DoriosLib.registry.customCommand({
    name: "utilitycraft:statscore",
    description: "Enables or disables the global StatsCore system",
    permissionLevel: "admin",
    parameters: [
        {
            name: "mode",
            type: "enum",
            values: ["on", "off"],
        },
    ],
    callback(origin, mode) {
        const source = origin.sourceEntity;
        const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";

        if (normalizedMode !== "on" && normalizedMode !== "off") {
            sendCommandMessage(source, "\u00A7cStatsCore: use on or off.");
            return;
        }

        const nextState = normalizedMode === "on";
        const previousState = isStatsCoreEnabled();
        setStatsCoreEnabled(nextState);

        sendCommandMessage(
            source,
            `\u00A7${nextState ? "a" : "c"}StatsCore ${nextState ? "enabled" : "disabled"}.`
        );

        if (previousState === nextState) {
            sendCommandMessage(source, "\u00A77StatsCore was already in that state.");
        }

        console.warn(`[StatsCore] ${nextState ? "Enabled" : "Disabled"} (Command).`);
    },
});

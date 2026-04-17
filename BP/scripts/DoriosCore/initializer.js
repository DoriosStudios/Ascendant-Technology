import { ItemStack, system, world } from "@minecraft/server";
import { Energy } from "./machinery/energyStorage.js";
import { sanitizeTickSpeed, getTickSpeed } from "./machinery/machine.js";
import { loadButtonItemStack } from "./buttons/index.js";

// ─── Tick counter ────────────────────────────────────────────────────────────

globalThis.tickCount ??= 0;
globalThis.tickSpeed ??= 2;
globalThis.worldLoaded ??= false;

system.runInterval(() => {
    globalThis.tickCount += 2;
    if (globalThis.tickCount == 1000) globalThis.tickCount = 0;
}, 2);

// ─── World load ──────────────────────────────────────────────────────────────

world.afterEvents.worldLoad.subscribe(() => {
    Energy.initializeObjectives();

    loadButtonItemStack("utilitycraft:ui_filler", ItemStack);

    if (world.getDynamicProperty("loaded") === undefined) {
        world.setDynamicProperty("loaded", false);
    }

    // Sync tick speed from world property when available
    try {
        const storedTickSpeed = Number(world.getDynamicProperty("utilitycraft:tickSpeed"));
        if (Number.isFinite(storedTickSpeed)) {
            const sanitized = sanitizeTickSpeed(storedTickSpeed);
            globalThis.tickSpeed = sanitized;
            world.setDynamicProperty("utilitycraft:tickSpeed", sanitized);
        } else {
            world.setDynamicProperty("utilitycraft:tickSpeed", getTickSpeed());
        }
    } catch { /* ignore dynamic property issues */ }

    globalThis.worldLoaded = world.getDynamicProperty("loaded");

    if (world.getDimension('overworld').getEntities()[0]) {
        world.setDynamicProperty("loaded", true);
        globalThis.worldLoaded = true;
    }
});

// ─── Player spawn ────────────────────────────────────────────────────────────

world.afterEvents.playerSpawn.subscribe(({ initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
        world.setDynamicProperty("loaded", true);
        globalThis.worldLoaded = true;
    }, 50);
});

// ─── Shutdown ────────────────────────────────────────────────────────────────

system.beforeEvents.shutdown.subscribe(() => {
    try {
        world.setDynamicProperty("loaded", false);
    } catch { /* ignore */ }
});

// Import script events so all handlers are registered
import "./scriptEvents.js";

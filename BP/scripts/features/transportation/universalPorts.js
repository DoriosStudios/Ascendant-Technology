import { ItemStack, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as DoriosLib from "DoriosLib/index.js";
import {
    RESOURCES, getUniversalPort, isCurrentPort, resetUniversalPort,
    setUniversalPortSettings,
} from "../../ATCore/transportation/portData.js";
import { transferUniversalPort } from "../../ATCore/transportation/universalTransfer.js";
import { readPortSettings, setPortUpgrade } from "../../ATCore/transportation/transportSettings.js";

const DISTRIBUTION_MODES = ["nearest", "farthest", "round"];
const tr = key => ({ translate: `ui.ascendant:universal.${key}` });

/** Shows the same upgrade feedback used by UC's native ports. */
function showUpgradeMessage(player, itemId, message, values = []) {
    player.onScreenDisplay.setActionBar({
        translate: `message.utilitycraft.upgrade.${message}`,
        with: {
            rawtext: [
                { translate: `upgrade.${itemId}.name` },
                ...values.map(value => ({ text: String(value) })),
            ],
        },
    });
}

/** Installs one upgrade in AT's settings before consuming the held item. */
function applyUpgrade(block, player, item, exporter) {
    let upgrade;
    let max = 0;
    if (item.typeId === "utilitycraft:filter_upgrade") {
        upgrade = "filter";
        max = 1;
    } else if (item.typeId === "utilitycraft:speed_upgrade" && exporter) {
        upgrade = "speed";
        max = 4;
    }

    if (!max) {
        showUpgradeMessage(player, item.typeId, "unsupported");
        return;
    }
    const current = readPortSettings(block.dimension.id, block.location).upgrades?.[upgrade] ?? 0;
    if (current >= max) {
        showUpgradeMessage(player, item.typeId, "max", [max]);
        return;
    }

    setPortUpgrade(block, upgrade, current + 1);
    player.runCommand(`clear @s ${item.typeId} 0 1`);
    showUpgradeMessage(player, item.typeId, "applied", [current + 1, max]);
}

/** Selects a resource and keeps the port cached while its menu is open. */
async function openSettings(block, player) {
    const port = getUniversalPort(block);
    port.uiOpen = (port.uiOpen ?? 0) + 1;
    try {
        const choice = await new ActionFormData()
            .title(tr("title"))
            .body(tr("description"))
            .button(tr("item"))
            .button(tr("fluid"))
            .button(tr("gas"))
            .show(player);
        if (choice.canceled || !isCurrentPort(port)) return;

        const resource = RESOURCES[choice.selection];
        await openResourceSettings(port, player, resource);
    } catch (error) {
        console.warn("[AT:universal_ports] Menu closed", error);
    } finally {
        port.uiOpen--;
        port.lastSeen = system.currentTick;
    }
}

/** Builds only the fields supported by this port and its installed upgrades. */
async function openResourceSettings(port, player, resource) {
    const settings = port.channels.get(resource)?.payload?.settings;
    if (!settings) return;

    const form = new ModalFormData()
        .title(tr(resource))
        .toggle(tr("enabled"), { defaultValue: settings.enabled });
    if (port.exporter) {
        form.dropdown(tr("distribution"), DISTRIBUTION_MODES.map(tr), {
            defaultValueIndex: DISTRIBUTION_MODES.indexOf(settings.mode),
        });
    }
    if (settings.filterEnabled) {
        form.toggle(tr("whitelist"), { defaultValue: settings.filter.mode === "whitelist" })
            .textField(tr("identifiers"), "minecraft:iron_ingot", {
                defaultValue: settings.filter.values.join(", "),
            });
    } else {
        form.label(tr("filter_upgrade"));
    }

    const result = await form.show(player);
    // The original port may have been broken or replaced while the form was open.
    if (result.canceled || !isCurrentPort(port)) return;
    const updated = readSettingsForm(result.formValues, settings, port.exporter);
    if (!updated) {
        player.onScreenDisplay.setActionBar(tr("invalid_filter"));
        return;
    }
    setUniversalPortSettings(port, resource, updated);
    player.onScreenDisplay.setActionBar(tr("saved"));
}

/** Reads fields in their display order; returns undefined for an invalid filter. */
function readSettingsForm(values, settings, exporter) {
    let index = 0;
    const enabled = values[index++] === true;
    const mode = exporter ? DISTRIBUTION_MODES[Number(values[index++])] : settings.mode;
    let filter = settings.filter;

    // Importers omit distribution; ports without Filter Upgrade omit both filter fields.
    if (settings.filterEnabled) {
        const whitelist = values[index++] === true;
        const text = String(values[index++] ?? "").trim();
        const identifiers = [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
        if (text.length > 1024 || identifiers.length > 8
            || identifiers.some(id => !/^[a-z0-9_.:-]{1,128}$/.test(id))) return undefined;
        filter = { mode: whitelist ? "whitelist" : "blacklist", values: identifiers };
    }
    return { enabled, mode, filter };
}

/** Defers DP writes until placement has left the read-only before event. */
function onPortPlace({ block }) {
    system.run(() => resetUniversalPort(block));
}

/** Returns installed upgrades before removing the port's routes and settings. */
function onPortBreak({ block }) {
    const upgrades = readPortSettings(block.dimension.id, block.location).upgrades ?? {};
    for (const name of ["speed", "filter"]) {
        if (upgrades[name] > 0) {
            const item = new ItemStack(`utilitycraft:${name}_upgrade`, upgrades[name]);
            block.dimension.spawnItem(item, block.center());
        }
    }
    resetUniversalPort(block);
}

/** Handles upgrades or opens the menu, leaving wrench interactions to their handler. */
function onPortInteract({ block, player }) {
    if (!player || player.isSneaking) return;
    const item = player.getComponent("equippable")?.getEquipment("Mainhand");
    if (item?.typeId.endsWith("_upgrade")) {
        applyUpgrade(block, player, item, block.hasTag("dorios:isExporter"));
        return;
    }
    if (item?.typeId === "utilitycraft:wrench" || item?.typeId === "utilitycraft:copy_paste_tool") return;
    void openSettings(block, player);
}

/** Only exporters transfer resources; importers are passive network endpoints. */
function onExporterTick({ block }) {
    transferUniversalPort(getUniversalPort(block));
}

const exporterComponent = {
    beforeOnPlayerPlace: onPortPlace,
    onBreak: onPortBreak,
    onPlayerInteract: onPortInteract,
    onTick: onExporterTick,
};

const importerComponent = {
    beforeOnPlayerPlace: onPortPlace,
    onBreak: onPortBreak,
    onPlayerInteract: onPortInteract,
};

DoriosLib.registry.blockComponent("ascendant:universal_exporter", exporterComponent);
DoriosLib.registry.blockComponent("ascendant:universal_importer", importerComponent);

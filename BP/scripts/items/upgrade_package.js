import { ActionFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";

const UPGRADE_PACKAGE_ID = "utilitycraft:upgrade_package";
const PACKAGE_CONTENT_PROP = "ascendant:upgrade_package_content";
const UPGRADE_ITEM_TAG = "utilitycraft:is_upgrade";
const UPGRADE_ITEM_SUFFIX = "_upgrade";
const MAX_UPGRADE_COUNT = 64;
const MAX_SCAN_BLOCKS = 128;
const USE_GATE_COOLDOWN = 1;

const UPGRADEABLE_TAGS = new Set(["dorios:upgraedable", "dorios:upgradeable"]);
const CARDINAL_OFFSETS = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 }
];

const formatUpgradeLabel = id => DoriosAPI?.utils?.formatIdToText?.(id) ?? String(id ?? "");

const normalizeRawMessageArg = value => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return value;
    return String(value);
};

const tr = (key, withArgs = []) => ({
    translate: key,
    with: withArgs.map(normalizeRawMessageArg)
});

const useGate = new Map();

function getUseGateTick() {
    const tick = Number(system.currentTick);
    if (Number.isFinite(tick)) return tick;
    return Date.now();
}

function shouldProcessAction(player, action) {
    if (!player) return false;
    const id = player.id ?? player.name ?? player.nameTag ?? "unknown";
    const key = `${id}:${action}`;
    const now = getUseGateTick();
    const last = useGate.get(key);
    if (last !== undefined && now - last <= USE_GATE_COOLDOWN) return false;
    useGate.set(key, now);
    return true;
}

function getPlayerInventory(player) {
    return player?.getComponent("inventory")?.container ?? null;
}

function getPlayerHeldItem(player) {
    const inv = getPlayerInventory(player);
    if (!inv) return null;
    const slot = player.selectedSlot;
    if (slot === undefined || slot === null) return null;
    return inv.getItem(slot) ?? null;
}

function setPlayerHeldItem(player, stack) {
    const inv = getPlayerInventory(player);
    if (!inv) return;
    const slot = player.selectedSlot;
    if (slot === undefined || slot === null) return;
    inv.setItem(slot, stack);
}

function isUpgradeItem(stack) {
    if (!stack?.typeId) return false;
    if (stack.hasTag?.(UPGRADE_ITEM_TAG)) return true;
    return stack.typeId.endsWith(UPGRADE_ITEM_SUFFIX);
}

function getUpgradeKeyFromItem(stack) {
    if (!isUpgradeItem(stack)) return null;
    return stack.typeId.replace(UPGRADE_ITEM_SUFFIX, "");
}

function normalizePackagePayload(payload) {
    const upgrades = {};
    let total = 0;

    if (payload?.upgrades && typeof payload.upgrades === "object") {
        for (const [key, value] of Object.entries(payload.upgrades)) {
            if (!key) continue;
            const amount = Math.max(0, Math.floor(Number(value) || 0));
            if (amount <= 0) continue;
            const clamped = Math.min(MAX_UPGRADE_COUNT, amount);
            upgrades[key] = clamped;
            total += clamped;
        }
    }

    return { upgrades, total };
}

function getPackagePayload(stack) {
    if (!stack || typeof stack.getDynamicProperty !== "function") {
        return normalizePackagePayload(null);
    }
    try {
        const raw = stack.getDynamicProperty(PACKAGE_CONTENT_PROP);
        if (typeof raw === "string" && raw.length > 0) {
            return normalizePackagePayload(JSON.parse(raw));
        }
    } catch {
        // ignore
    }
    return normalizePackagePayload(null);
}

function buildPackageLore(payload) {
    if (!payload?.total) return [];
    const lines = ["§7Upgrades:"];
    const entries = Object.entries(payload.upgrades ?? {})
        .filter(([, value]) => Number(value) > 0)
        .sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
        lines.push(`§7- ${formatUpgradeLabel(key)}: ${value}`);
    }

    return lines;
}

function setPackagePayload(stack, payload) {
    if (!stack || typeof stack.setDynamicProperty !== "function") {
        return normalizePackagePayload(payload);
    }

    const normalized = normalizePackagePayload(payload);
    try {
        stack.setDynamicProperty(PACKAGE_CONTENT_PROP, JSON.stringify(normalized));
    } catch {
        // ignore
    }

    try {
        const lore = buildPackageLore(normalized);
        if (typeof stack.setLore === "function") {
            stack.setLore(lore);
        }
    } catch {
        // ignore
    }

    return normalized;
}

function absorbUpgradesFromInventory(player, stack) {
    const inv = getPlayerInventory(player);
    if (!inv) return getPackagePayload(stack);

    const payload = getPackagePayload(stack);

    for (let slot = 0; slot < inv.size; slot++) {
        const item = inv.getItem(slot);
        const upgradeKey = getUpgradeKeyFromItem(item);
        if (!upgradeKey) continue;

        const current = payload.upgrades[upgradeKey] ?? 0;
        const space = Math.max(0, MAX_UPGRADE_COUNT - current);
        if (space <= 0) continue;

        const moveAmount = Math.min(space, item.amount);
        if (moveAmount <= 0) continue;

        payload.upgrades[upgradeKey] = current + moveAmount;
        payload.total += moveAmount;

        const remaining = item.amount - moveAmount;
        if (remaining > 0) {
            item.amount = remaining;
            inv.setItem(slot, item);
        } else {
            inv.setItem(slot, undefined);
        }
    }

    return payload;
}

function posKey(pos) {
    return `${pos.x}|${pos.y}|${pos.z}`;
}

function isUpgradeableBlock(block) {
    if (!block?.hasTag) return false;
    for (const tag of UPGRADEABLE_TAGS) {
        if (block.hasTag(tag)) return true;
    }
    return false;
}

function isConveyorBlock(block) {
    const conveyorApi = globalThis.utilitycraftConveyorUpgrades;
    if (conveyorApi?.isConveyorBlock) return conveyorApi.isConveyorBlock(block);
    return block?.hasTag?.("dorios:conveyor") ?? false;
}

function getSupportedKind(block) {
    if (!block) return null;
    if (isConveyorBlock(block)) return "conveyor";
    if (isUpgradeableBlock(block)) return "upgradable";
    return null;
}

function getScanSeeds(block) {
    if (!block?.dimension) return [];
    const seeds = [];
    const kind = getSupportedKind(block);
    if (kind) {
        seeds.push(block);
        return seeds;
    }

    for (const off of CARDINAL_OFFSETS) {
        const neighbor = block.dimension.getBlock({
            x: block.location.x + off.x,
            y: block.location.y + off.y,
            z: block.location.z + off.z
        });
        if (getSupportedKind(neighbor)) {
            seeds.push(neighbor);
        }
    }

    return seeds;
}

function scanConnectedSupportedBlocks(startBlock, maxScan = MAX_SCAN_BLOCKS) {
    if (!startBlock?.dimension) {
        return { upgradables: [], conveyors: [] };
    }

    const queue = getScanSeeds(startBlock);
    const visited = new Set();
    const upgradables = [];
    const conveyors = [];
    let scanned = 0;

    while (queue.length && scanned < maxScan) {
        const block = queue.shift();
        if (!block?.location) continue;
        const key = posKey(block.location);
        if (visited.has(key)) continue;
        visited.add(key);

        const kind = getSupportedKind(block);
        if (!kind) continue;
        scanned++;

        if (kind === "upgradable") upgradables.push(block);
        if (kind === "conveyor") conveyors.push(block);

        for (const off of CARDINAL_OFFSETS) {
            const neighbor = block.dimension.getBlock({
                x: block.location.x + off.x,
                y: block.location.y + off.y,
                z: block.location.z + off.z
            });
            if (!neighbor) continue;
            const neighborKind = getSupportedKind(neighbor);
            if (!neighborKind) continue;
            const neighborKey = posKey(neighbor.location);
            if (!visited.has(neighborKey)) queue.push(neighbor);
        }
    }

    return { upgradables, conveyors };
}

function getMaxState(block, key, maxTry = 16) {
    if (!block?.permutation) return 0;
    const perm = block.permutation;
    const current = perm.getState(key);
    if (current === undefined) return 0;

    let lastValid = current;
    for (let i = current + 1; i <= maxTry; i++) {
        try {
            perm.withState(key, i);
            lastValid = i;
        } catch {
            break;
        }
    }
    return lastValid;
}

function applyUpgradesToUpgradables(blocks, payload) {
    const remaining = { ...payload.upgrades };
    const applied = {};

    for (const block of blocks) {
        if (!block?.permutation) continue;
        let perm = block.permutation;
        let changed = false;

        for (const [key, amount] of Object.entries(remaining)) {
            if (!amount || amount <= 0) continue;
            const current = perm.getState(key);
            if (current === undefined || typeof current !== "number") continue;

            const max = getMaxState(block, key);
            if (!Number.isFinite(max) || max <= current) continue;

            let next = current;
            let remainingAmount = amount;

            while (remainingAmount > 0 && next < max) {
                next += 1;
                remainingAmount -= 1;
                applied[key] = (applied[key] ?? 0) + 1;
            }

            remaining[key] = remainingAmount;

            if (next !== current) {
                try {
                    perm = perm.withState(key, next);
                    changed = true;
                } catch {
                    // ignore invalid state updates
                }
            }
        }

        if (changed) {
            try {
                block.setPermutation(perm);
            } catch {
                // ignore
            }
        }
    }

    return {
        applied,
        payload: normalizePackagePayload({ upgrades: remaining })
    };
}

function applyUpgradesToConveyors(block, payload) {
    const conveyorApi = globalThis.utilitycraftConveyorUpgrades;
    if (!conveyorApi?.applyPackageUpgrades) {
        return { applied: {}, payload };
    }

    const upgradeTypes = conveyorApi.getUpgradeTypes?.() ?? new Set();
    const upgradesByType = {};
    const typeToKey = {};

    for (const [key, value] of Object.entries(payload.upgrades ?? {})) {
        const type = key.includes(":") ? key.split(":")[1] : key;
        if (!upgradeTypes.has(type)) continue;
        upgradesByType[type] = value;
        typeToKey[type] = key;
    }

    if (Object.keys(upgradesByType).length === 0) {
        return { applied: {}, payload };
    }

    const result = conveyorApi.applyPackageUpgrades(block, upgradesByType);
    const remaining = { ...payload.upgrades };

    for (const [type, appliedAmount] of Object.entries(result.applied ?? {})) {
        const key = typeToKey[type] ?? type;
        const current = Math.max(0, Math.floor(Number(remaining[key]) || 0));
        const next = Math.max(0, current - Math.max(0, Math.floor(Number(appliedAmount) || 0)));
        if (next > 0) {
            remaining[key] = next;
        } else {
            delete remaining[key];
        }
    }

    return {
        applied: result.applied ?? {},
        payload: normalizePackagePayload({ upgrades: remaining })
    };
}

function buildContextBody(payload, scan) {
    const lines = [];

    if (payload?.total) {
        lines.push("Package contents:");
        for (const [key, value] of Object.entries(payload.upgrades ?? {})) {
            if (!value || value <= 0) continue;
            lines.push(`- ${formatUpgradeLabel(key)}: ${value}`);
        }
    } else {
        lines.push("No upgrades stored in this package.");
    }

    if (scan.upgradables.length > 0) {
        lines.push("");
        lines.push(`Upgradable blocks detected: ${scan.upgradables.length}`);
    }

    if (scan.conveyors.length > 0) {
        lines.push(`Conveyors detected: ${scan.conveyors.length}`);
    }

    return lines.join("\n");
}

function showUpgradePackageMenu(player, packageStack, scan) {
    if (!player || !packageStack) return;
    const payload = getPackagePayload(packageStack);

    if (!payload.total) {
        player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.conveyor.upgrade_package.body_empty"));
        return;
    }

    const hasUpgradables = scan.upgradables.length > 0;
    const hasConveyors = scan.conveyors.length > 0;

    if (!hasUpgradables && !hasConveyors) {
        player.onScreenDisplay?.setActionBar("§cNo supported blocks found.");
        return;
    }

    const actions = [];
    const form = new ActionFormData()
        .title(tr("ui.utilitycraft.conveyor.upgrade_package.title"))
        .body(buildContextBody(payload, scan));

    if (hasUpgradables && hasConveyors) {
        form.button("Apply to All Supported");
        actions.push("apply_all");
    }

    if (hasUpgradables) {
        form.button(`Apply to Upgradables (${scan.upgradables.length})`);
        actions.push("apply_upgradables");
    }

    if (hasConveyors) {
        form.button("Apply to Conveyor Network");
        actions.push("apply_conveyors");
    }

    form.button(tr("ui.utilitycraft.conveyor.upgrade_package.button.cancel"));
    actions.push("cancel");

    form.show(player).then(result => {
        if (result.canceled || result.selection === undefined) return;
        const action = actions[result.selection];
        if (!action || action === "cancel") return;

        const held = getPlayerHeldItem(player);
        if (!held || held.typeId !== UPGRADE_PACKAGE_ID) return;

        let nextPayload = getPackagePayload(held);

        if (action === "apply_all" || action === "apply_upgradables") {
            const applied = applyUpgradesToUpgradables(scan.upgradables, nextPayload);
            nextPayload = applied.payload;
        }

        if (action === "apply_all" || action === "apply_conveyors") {
            const targetConveyor = scan.conveyors[0] ?? null;
            if (targetConveyor) {
                const applied = applyUpgradesToConveyors(targetConveyor, nextPayload);
                nextPayload = applied.payload;
            }
        }

        setPackagePayload(held, nextPayload);
        setPlayerHeldItem(player, held);
        player.onScreenDisplay?.setActionBar(tr("ui.utilitycraft.conveyor.upgrade_package.applied"));
    });
}

function handlePackageUse(player) {
    if (!shouldProcessAction(player, "use")) return;
    const held = getPlayerHeldItem(player);
    if (!held || held.typeId !== UPGRADE_PACKAGE_ID) return;

    system.run(() => {
        const payload = absorbUpgradesFromInventory(player, held);
        setPackagePayload(held, payload);
        setPlayerHeldItem(player, held);
    });
}

function handlePackageUseOn(player, block) {
    if (!shouldProcessAction(player, "useOn")) return;
    const held = getPlayerHeldItem(player);
    if (!held || held.typeId !== UPGRADE_PACKAGE_ID) return;
    if (!block) return;

    const scan = scanConnectedSupportedBlocks(block, MAX_SCAN_BLOCKS);
    system.run(() => {
        showUpgradePackageMenu(player, held, scan);
    });
}

DoriosAPI.register.itemComponent("upgrade_package", {
    onUse(e) {
        const player = e?.source;
        if (!player) return;
        handlePackageUse(player);
    },
    onUseOn(e) {
        const player = e?.source;
        const block = e?.block;
        if (!player) return;
        handlePackageUseOn(player, block);
    }
});

const itemUseEvent = world.afterEvents?.itemUse ?? world.beforeEvents?.itemUse;
if (itemUseEvent?.subscribe) {
    itemUseEvent.subscribe(({ source, itemStack }) => {
        if (!source || !itemStack || itemStack.typeId !== UPGRADE_PACKAGE_ID) return;
        handlePackageUse(source);
    });
}

const itemUseOnEvent = world.afterEvents?.itemUseOn ?? world.beforeEvents?.itemUseOn;
if (itemUseOnEvent?.subscribe) {
    itemUseOnEvent.subscribe(({ source, block, itemStack }) => {
        if (!source || !block || !itemStack || itemStack.typeId !== UPGRADE_PACKAGE_ID) return;
        handlePackageUseOn(source, block);
    });
}

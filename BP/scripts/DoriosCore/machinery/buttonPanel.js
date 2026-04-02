import { ItemStack, system, world } from "@minecraft/server";
import { LABEL_CHAR_LIMIT } from "../constants.js";

export const BUTTON_PANEL_DEFAULTS = Object.freeze({
    namespace: "ascendant:panel",
    cooldownTicks: 4,
    defaultButtonType: "toggle",
    defaultIconItemId: "utilitycraft:switch_button",
    markerPrefix: "§0btn:",
    statePrefix: "state",
    cooldownPrefix: "cooldown",
    renderPrefix: "render",
    defaultPressHint: "Take or replace the button item to switch.",
    fallbackButtonLabel: "Button"
});

const BUTTON_TYPES = new Set(["toggle", "cycle", "radio", "action", "page"]);
const normalizedPanelCache = new WeakMap();

function sanitizeKey(value, fallback = "panel") {
    const normalized = String(value ?? fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]/g, "_");
    return normalized.length > 0 ? normalized : fallback;
}

function truncateText(value, limit = LABEL_CHAR_LIMIT) {
    const text = typeof value === "string" && value.length > 0 ? value : " ";
    if (text.length <= limit) return text;
    if (limit <= 3) return text.slice(0, limit);
    return `${text.slice(0, limit - 3)}...`;
}

function splitLines(value) {
    if (typeof value !== "string") return [];
    return value
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(Boolean);
}

function normalizeLoreLines(value) {
    if (Array.isArray(value)) {
        return value
            .flatMap(entry => splitLines(typeof entry === "string" ? entry : ""))
            .map(line => line.startsWith("§r") || line.startsWith("§0") ? line : `§r${line}`);
    }
    return splitLines(typeof value === "string" ? value : "")
        .map(line => line.startsWith("§r") || line.startsWith("§0") ? line : `§r${line}`);
}

function humanizeKey(value) {
    const text = String(value ?? "")
        .replace(/[_-]+/g, " ")
        .trim();
    if (!text) return BUTTON_PANEL_DEFAULTS.fallbackButtonLabel;
    return text
        .split(/\s+/g)
        .map(token => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
}

function resolveCallbackValue(callback, fallback, context) {
    if (typeof callback !== "function") return fallback;
    try {
        const result = callback(context);
        return result === undefined ? fallback : result;
    } catch {
        return fallback;
    }
}

function getMachineCenter(machine) {
    const location = machine?.block?.location ?? machine?.entity?.location;
    if (!location) return { x: 0, y: 0, z: 0 };
    return {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5
    };
}

function getCurrentTick() {
    return Number(system.currentTick ?? 0);
}

function getDistanceSquared(a, b) {
    if (!a || !b) return Infinity;
    const dx = Number(a.x ?? 0) - Number(b.x ?? 0);
    const dy = Number(a.y ?? 0) - Number(b.y ?? 0);
    const dz = Number(a.z ?? 0) - Number(b.z ?? 0);
    return (dx * dx) + (dy * dy) + (dz * dz);
}

function normalizePanel(panelDefinition) {
    if (panelDefinition?.__normalizedButtonPanel === true) return panelDefinition;

    const panel = panelDefinition && typeof panelDefinition === "object" ? panelDefinition : {};
    if (panelDefinition && typeof panelDefinition === "object") {
        const cached = normalizedPanelCache.get(panelDefinition);
        if (cached) return cached;
    }

    const id = sanitizeKey(panel.id ?? panel.panelId ?? "panel");
    const normalized = {
        ...panel,
        __normalizedButtonPanel: true,
        id,
        namespace: sanitizeKey(panel.namespace ?? BUTTON_PANEL_DEFAULTS.namespace, BUTTON_PANEL_DEFAULTS.namespace),
        cooldownTicks: Number.isFinite(Number(panel.cooldownTicks)) && Number(panel.cooldownTicks) > 0
            ? Math.floor(Number(panel.cooldownTicks))
            : BUTTON_PANEL_DEFAULTS.cooldownTicks,
        defaultIconItemId: typeof panel.defaultIconItemId === "string" && panel.defaultIconItemId.length > 0
            ? panel.defaultIconItemId
            : BUTTON_PANEL_DEFAULTS.defaultIconItemId,
        buttons: []
    };

    normalized.buttons = Array.isArray(panel.buttons)
        ? panel.buttons.map((button, index) => normalizeButton(normalized, button, index))
        : [];

    if (panelDefinition && typeof panelDefinition === "object") {
        normalizedPanelCache.set(panelDefinition, normalized);
    }

    return normalized;
}

function normalizeButton(panel, buttonDefinition, index) {
    if (buttonDefinition?.__normalizedButton === true) return buttonDefinition;

    const button = buttonDefinition && typeof buttonDefinition === "object" ? buttonDefinition : {};
    const id = sanitizeKey(button.id ?? `button_${index}`);
    const type = BUTTON_TYPES.has(button.type) ? button.type : BUTTON_PANEL_DEFAULTS.defaultButtonType;
    const slot = Number.isInteger(button.slot) ? button.slot : index;
    const property = button.property ? sanitizeKey(button.property, id) : null;
    const values = Array.isArray(button.values) ? [...button.values] : [];

    return {
        ...button,
        __normalizedButton: true,
        id,
        type,
        slot,
        property,
        values,
        cooldownTicks: Number.isFinite(Number(button.cooldownTicks)) && Number(button.cooldownTicks) > 0
            ? Math.floor(Number(button.cooldownTicks))
            : panel.cooldownTicks
    };
}

function getPanelPropertyKey(panel, property) {
    return `${panel.namespace}:${panel.id}:${BUTTON_PANEL_DEFAULTS.statePrefix}:${sanitizeKey(property)}`;
}

function getButtonCooldownKey(panel, button) {
    return `${panel.namespace}:${panel.id}:${BUTTON_PANEL_DEFAULTS.cooldownPrefix}:${sanitizeKey(button.id)}`;
}

function getButtonRenderKey(panel, button) {
    return `${panel.namespace}:${panel.id}:${BUTTON_PANEL_DEFAULTS.renderPrefix}:${sanitizeKey(button.id)}`;
}

function getPanelDefaultState(panel) {
    const defaults = panel.defaults && typeof panel.defaults === "object"
        ? { ...panel.defaults }
        : {};

    const buttons = panel.buttons.map((button, index) => normalizeButton(panel, button, index));
    for (const button of buttons) {
        if (!button.property) continue;
        if (defaults[button.property] !== undefined) continue;

        if (button.type === "toggle") {
            defaults[button.property] = button.defaultValue ?? false;
            continue;
        }

        if (button.type === "cycle") {
            defaults[button.property] = button.defaultValue ?? button.values[0];
            continue;
        }

        if (button.type === "radio" || button.type === "page") {
            if (button.defaultValue !== undefined) {
                defaults[button.property] = button.defaultValue;
                continue;
            }
            if (button.defaultSelected === true || defaults[button.property] === undefined) {
                defaults[button.property] = button.value;
            }
        }
    }

    return defaults;
}

function serializeDynamicValue(value) {
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return value;
    }
    if (value === undefined || value === null) {
        return undefined;
    }
    return String(value);
}

export function getButtonPanelValue(machine, panelDefinition, property, fallback) {
    const panel = normalizePanel(panelDefinition);
    const state = getButtonPanelState(machine, panel);
    return state[property] === undefined ? fallback : state[property];
}

export function setButtonPanelValue(machine, panelDefinition, property, value) {
    if (!machine?.entity || !property) return undefined;
    const panel = normalizePanel(panelDefinition);
    const key = getPanelPropertyKey(panel, property);
    const serialized = serializeDynamicValue(value);
    const current = machine.entity.getDynamicProperty(key);
    if (current === serialized) return serialized;
    machine.entity.setDynamicProperty(key, serialized);
    return serialized;
}

export function getButtonPanelState(machine, panelDefinition) {
    const panel = normalizePanel(panelDefinition);
    const defaults = getPanelDefaultState(panel);

    if (!machine?.entity) {
        return defaults;
    }

    const state = { ...defaults };
    for (const property of Object.keys(defaults)) {
        const key = getPanelPropertyKey(panel, property);
        const stored = machine.entity.getDynamicProperty(key);
        if (stored !== undefined) {
            state[property] = stored;
        }
    }

    for (const [index, buttonDefinition] of panel.buttons.entries()) {
        const button = normalizeButton(panel, buttonDefinition, index);
        if (!button.property || state[button.property] !== undefined) continue;
        const key = getPanelPropertyKey(panel, button.property);
        const stored = machine.entity.getDynamicProperty(key);
        if (stored !== undefined) {
            state[button.property] = stored;
        }
    }

    return state;
}

function getButtonCooldownRemaining(machine, panel, button) {
    if (!machine?.entity) return 0;
    const unlockTick = Number(machine.entity.getDynamicProperty(getButtonCooldownKey(panel, button)) ?? 0);
    return Math.max(0, unlockTick - getCurrentTick());
}

function setButtonCooldown(machine, panel, button, cooldownTicks) {
    if (!machine?.entity) return;
    const key = getButtonCooldownKey(panel, button);
    const unlockTick = getCurrentTick() + Math.max(0, Math.floor(Number(cooldownTicks) || 0));
    machine.entity.setDynamicProperty(key, unlockTick);
}

function resolveButtonActive(button, state) {
    if (!button.property) return false;
    const value = state[button.property];

    if (button.type === "toggle") {
        return value === (button.activeValue ?? true);
    }

    if (button.type === "cycle") {
        return value === button.activeValue || (button.activeWhen && button.activeWhen.includes?.(value));
    }

    if (button.type === "radio" || button.type === "page") {
        return value === button.value;
    }

    return false;
}

function resolveButtonContext(machine, panel, button, state, options = {}) {
    const baseContext = {
        machine,
        panel,
        button,
        state,
        options
    };

    const visible = resolveCallbackValue(button.isVisible, true, baseContext) !== false;
    const enabled = visible && resolveCallbackValue(button.isEnabled, true, baseContext) !== false;
    const cooldownRemaining = getButtonCooldownRemaining(machine, panel, button);
    const coolingDown = cooldownRemaining > 0;
    const pressable = enabled && !coolingDown;
    const active = resolveButtonActive(button, state);
    const value = button.property ? state[button.property] : undefined;

    return {
        ...baseContext,
        visible,
        enabled,
        active,
        value,
        cooldownRemaining,
        coolingDown,
        pressable
    };
}

function resolveButtonItemId(panel, button, context) {
    if (typeof button.resolveItemId === "function") {
        const result = resolveCallbackValue(button.resolveItemId, null, context);
        if (typeof result === "string" && result.length > 0) return result;
    }

    const itemMap = button.iconItems && typeof button.iconItems === "object" ? button.iconItems : null;
    if (itemMap) {
        if (!context.pressable && typeof itemMap.disabled === "string") return itemMap.disabled;
        if (context.active && typeof itemMap.active === "string") return itemMap.active;
        if (typeof itemMap.inactive === "string") return itemMap.inactive;
    }

    if (typeof button.iconItemId === "string" && button.iconItemId.length > 0) {
        return button.iconItemId;
    }

    return panel.defaultIconItemId;
}

function resolveButtonTitle(button, context) {
    if (typeof button.getTitle === "function") {
        const result = resolveCallbackValue(button.getTitle, null, context);
        if (typeof result === "string" && result.trim().length > 0) {
            return result.trim();
        }
    }

    if (typeof button.title === "string" && button.title.trim().length > 0) {
        return button.title.trim();
    }

    if (typeof button.label === "string" && button.label.trim().length > 0) {
        return button.label.trim();
    }

    return humanizeKey(button.id);
}

function formatValue(value) {
    if (value === undefined || value === null || value === "") return "None";
    if (typeof value === "boolean") return value ? "On" : "Off";
    return String(value);
}

function buildButtonMarker(panel, button, context) {
    const panelKey = sanitizeKey(panel.id);
    const buttonKey = sanitizeKey(button.id);
    const viewState = [
        context.active ? "1" : "0",
        context.pressable ? "1" : "0",
        context.coolingDown ? `cd${context.cooldownRemaining}` : "cd0",
        formatValue(context.value)
    ].join("|");
    return `${BUTTON_PANEL_DEFAULTS.markerPrefix}${panelKey}:${buttonKey}:${viewState}`;
}

function buildButtonLore(panel, button, context, marker) {
    const lines = [];

    if (typeof button.getLore === "function") {
        lines.push(...normalizeLoreLines(resolveCallbackValue(button.getLore, [], context)));
    } else {
        lines.push(...normalizeLoreLines(button.lore));
    }

    const statusText = !context.enabled
        ? "Locked"
        : context.coolingDown
            ? `Cooldown ${context.cooldownRemaining}`
            : context.active
                ? "Active"
                : "Idle";

    if (button.showStatusInLore !== false) {
        lines.unshift(`§r§7Status: §f${statusText}`);
    }

    if (button.property && button.showValueInLore !== false) {
        lines.unshift(`§r§7Value: §f${formatValue(context.value)}`);
    }

    if (button.showPressHintInLore !== false) {
        const pressHint = typeof button.pressHint === "string" && button.pressHint.trim().length > 0
            ? button.pressHint.trim()
            : BUTTON_PANEL_DEFAULTS.defaultPressHint;
        lines.push(`§r§8${pressHint}`);
    }
    lines.push(marker);

    return lines.map(line => truncateText(line));
}

function createButtonItem(panel, button, context) {
    const itemId = resolveButtonItemId(panel, button, context);
    const item = new ItemStack(itemId, 1);
    const marker = buildButtonMarker(panel, button, context);
    const title = resolveButtonTitle(button, context);
    const color = button.stateColorInTitle === false
        ? ""
        : !context.enabled
            ? "§8"
            : context.coolingDown
                ? "§6"
                : context.active
                    ? "§a"
                    : "§7";

    item.nameTag = truncateText(color ? `${color}${title}` : title);
    item.setLore(buildButtonLore(panel, button, context, marker));
    return item;
}

function getItemMarker(item) {
    if (!item?.getLore) return "";
    const lore = item.getLore();
    if (!Array.isArray(lore) || lore.length === 0) return "";
    return lore.find(line => typeof line === "string" && line.startsWith(BUTTON_PANEL_DEFAULTS.markerPrefix)) ?? "";
}

function getRenderedButtonMarker(machine, panel, button) {
    if (!machine?.entity) return "";
    return String(machine.entity.getDynamicProperty(getButtonRenderKey(panel, button)) ?? "");
}

function setRenderedButtonMarker(machine, panel, button, marker) {
    if (!machine?.entity) return;
    const key = getButtonRenderKey(panel, button);
    const nextValue = marker || undefined;
    const current = machine.entity.getDynamicProperty(key);
    if (current === nextValue) return;
    machine.entity.setDynamicProperty(key, nextValue);
}

function isManagedButtonItem(item, panel, button) {
    if (!item) return false;
    const marker = getItemMarker(item);
    if (!marker) return false;
    const expectedPrefix = `${BUTTON_PANEL_DEFAULTS.markerPrefix}${sanitizeKey(panel.id)}:${sanitizeKey(button.id)}:`;
    return marker.startsWith(expectedPrefix);
}

function matchesExpectedButtonItem(item, expectedItem) {
    if (!item || !expectedItem) return false;
    return item.typeId === expectedItem.typeId && getItemMarker(item) === getItemMarker(expectedItem);
}

function collectPanelCleanupItemIds(machine, panel, state, options = {}) {
    const itemIds = new Set();
    if (typeof panel.defaultIconItemId === "string" && panel.defaultIconItemId.length > 0) {
        itemIds.add(panel.defaultIconItemId);
    }

    for (const [index, buttonDefinition] of panel.buttons.entries()) {
        const button = normalizeButton(panel, buttonDefinition, index);
        if (typeof button.iconItemId === "string" && button.iconItemId.length > 0) {
            itemIds.add(button.iconItemId);
        }

        if (button.iconItems && typeof button.iconItems === "object") {
            for (const value of Object.values(button.iconItems)) {
                if (typeof value === "string" && value.length > 0) {
                    itemIds.add(value);
                }
            }
        }

        const context = resolveButtonContext(machine, panel, button, state, options);
        const resolvedId = resolveButtonItemId(panel, button, context);
        if (typeof resolvedId === "string" && resolvedId.length > 0) {
            itemIds.add(resolvedId);
        }
    }

    return Array.from(itemIds);
}

function getNearbyPlayers(machine, radius = 10, options = {}) {
    const center = getMachineCenter(machine);
    const maxDistance = Math.max(1, Number(radius) || 10);
    const dimension = machine?.block?.dimension;
    if (!dimension) return [];

    if (options.cleanupAllPlayers === true) {
        return world.getAllPlayers().filter(player => player?.dimension?.id === dimension.id);
    }

    try {
        if (typeof dimension.getPlayers === "function") {
            return dimension.getPlayers({ location: center, maxDistance });
        }
    } catch {
        // Fall back to world iteration.
    }

    return world.getAllPlayers().filter(player =>
        player?.dimension?.id === dimension.id
        && getDistanceSquared(player.location, center) <= maxDistance * maxDistance
    );
}

function getNearbyDroppedItems(machine, radius = 4) {
    const center = getMachineCenter(machine);
    const maxDistance = Math.max(1, Number(radius) || 4);
    const dimension = machine?.block?.dimension;
    if (!dimension?.getEntities) return [];

    try {
        return dimension.getEntities({
            type: "minecraft:item",
            location: center,
            maxDistance
        });
    } catch {
        return [];
    }
}

function clearDroppedPanelItems(machine, itemIds, options = {}) {
    if (!machine || !Array.isArray(itemIds) || itemIds.length === 0) return;
    const cleanupRawItemIds = options.cleanupRawItemIds === true;

    const entities = getNearbyDroppedItems(machine, options.dropCleanupRadius ?? 4);
    for (const entity of entities) {
        const stack = entity?.getComponent?.("minecraft:item")?.itemStack;
        if (!stack) continue;

        const marker = getItemMarker(stack);
        if (marker.startsWith(BUTTON_PANEL_DEFAULTS.markerPrefix) || (cleanupRawItemIds && itemIds.includes(stack.typeId))) {
            try {
                entity.remove();
            } catch {
                // ignore despawn races
            }
        }
    }
}

function clearLeakedButtonItems(player, itemIds, options = {}) {
    if (!player || !Array.isArray(itemIds) || itemIds.length === 0) return;
    const cleanupRawItemIds = options.cleanupRawItemIds === true;

    const inventory = player.getComponent?.("inventory")?.container;
    if (inventory) {
        for (let slot = 0; slot < inventory.size; slot++) {
            const item = inventory.getItem(slot);
            if (!item) continue;
            const marker = getItemMarker(item);
            if (marker.startsWith(BUTTON_PANEL_DEFAULTS.markerPrefix) || (cleanupRawItemIds && itemIds.includes(item.typeId))) {
                inventory.setItem(slot, undefined);
            }
        }
    }
}

function cleanupLeakedPanelItems(machine, panel, state, options = {}) {
    const interval = Math.max(1, Math.floor(Number(options.cleanupIntervalTicks) || 8));
    if (getCurrentTick() % interval !== 0) return;

    const itemIds = collectPanelCleanupItemIds(machine, panel, state, options);
    if (itemIds.length === 0) return;

    const players = getNearbyPlayers(machine, options.cleanupRadius ?? 10, options);
    for (const player of players) {
        clearLeakedButtonItems(player, itemIds, options);
    }

    clearDroppedPanelItems(machine, itemIds, options);
}

function tryReturnItemToContainer(container, item) {
    if (!container || !item) return false;
    for (let slot = 0; slot < container.size; slot++) {
        try {
            const current = container.getItem(slot);
            if (!current) {
                container.setItem(slot, item);
                return true;
            }
        } catch {
            return false;
        }
    }
    return false;
}

function returnUnexpectedItem(machine, item, options = {}) {
    if (!item) return;

    const explicitContainer = options.returnContainer;
    const playerContainer = options.player?.getComponent?.("inventory")?.container;
    const container = explicitContainer ?? playerContainer;
    if (tryReturnItemToContainer(container, item)) {
        return;
    }

    try {
        machine.block.dimension.spawnItem(item, getMachineCenter(machine));
    } catch {
        // ignore spawn races
    }
}

function clearPanelSlot(machine, slot, options = {}) {
    if (!machine?.inv || !Number.isInteger(slot) || slot < 0 || slot >= machine.inv.size) return;
    const item = machine.inv.getItem(slot);
    machine.inv.setItem(slot, undefined);
    if (item) {
        returnUnexpectedItem(machine, item, options);
    }
}

function getNextButtonValue(button, state) {
    const current = button.property ? state[button.property] : undefined;

    if (button.type === "toggle") {
        const inactiveValue = button.inactiveValue ?? false;
        const activeValue = button.activeValue ?? true;
        return current === activeValue ? inactiveValue : activeValue;
    }

    if (button.type === "cycle") {
        const values = button.values;
        if (!values.length) return current;
        const currentIndex = values.findIndex(value => value === current);
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % values.length;
        return values[nextIndex];
    }

    if (button.type === "radio" || button.type === "page") {
        return button.value;
    }

    return current;
}

export function pressButtonPanelButton(machine, panelDefinition, buttonId, options = {}) {
    const panel = normalizePanel(panelDefinition);
    const normalizedId = sanitizeKey(buttonId);
    const buttonIndex = panel.buttons.findIndex((entry, index) => normalizeButton(panel, entry, index).id === normalizedId);
    if (buttonIndex < 0) {
        return { handled: false, state: getButtonPanelState(machine, panel) };
    }

    const button = normalizeButton(panel, panel.buttons[buttonIndex], buttonIndex);
    const state = getButtonPanelState(machine, panel);
    const context = resolveButtonContext(machine, panel, button, state, options);
    if (!context.visible || !context.pressable) {
        return { handled: false, state };
    }

    let nextValue = getNextButtonValue(button, state);
    let propertyValues = null;

    if (typeof button.onPress === "function") {
        const result = button.onPress({
            ...context,
            nextValue
        });
        if (result === false) {
            return { handled: false, state };
        }
        if (result && typeof result === "object") {
            if (Object.prototype.hasOwnProperty.call(result, "value")) {
                nextValue = result.value;
            }
            if (result.values && typeof result.values === "object") {
                propertyValues = result.values;
            }
        }
    }

    if (button.property) {
        setButtonPanelValue(machine, panel, button.property, nextValue);
    }

    if (propertyValues) {
        for (const [property, value] of Object.entries(propertyValues)) {
            setButtonPanelValue(machine, panel, property, value);
        }
    }

    setButtonCooldown(machine, panel, button, button.cooldownTicks);
    const nextState = getButtonPanelState(machine, panel);

    if (typeof button.onChange === "function" && button.property) {
        try {
            button.onChange({
                ...context,
                previousValue: state[button.property],
                value: nextState[button.property],
                state: nextState
            });
        } catch {
            // ignore button callback errors
        }
    }

    return {
        handled: true,
        state: nextState,
        button
    };
}

export function clearButtonPanel(machine, panelDefinition, options = {}) {
    const panel = normalizePanel(panelDefinition);
    for (const [index, buttonDefinition] of panel.buttons.entries()) {
        const button = normalizeButton(panel, buttonDefinition, index);
        clearPanelSlot(machine, button.slot, options);
        setRenderedButtonMarker(machine, panel, button, "");
    }
}

export function renderButtonPanel(machine, panelDefinition, options = {}) {
    const panel = normalizePanel(panelDefinition);
    const state = options.state ?? getButtonPanelState(machine, panel);

    for (const [index, buttonDefinition] of panel.buttons.entries()) {
        const button = normalizeButton(panel, buttonDefinition, index);
        const context = resolveButtonContext(machine, panel, button, state, options);
        if (!context.visible) {
            if (machine?.inv?.getItem(button.slot)) {
                clearPanelSlot(machine, button.slot, options);
            }
            setRenderedButtonMarker(machine, panel, button, "");
            continue;
        }

        const expectedItemId = resolveButtonItemId(panel, button, context);
        const expectedMarker = buildButtonMarker(panel, button, context);
        const currentItem = machine?.inv?.getItem(button.slot);
        if (currentItem?.typeId === expectedItemId && getItemMarker(currentItem) === expectedMarker) {
            setRenderedButtonMarker(machine, panel, button, expectedMarker);
            continue;
        }

        const expectedItem = createButtonItem(panel, button, context);
        if (!matchesExpectedButtonItem(currentItem, expectedItem)) {
            machine.inv.setItem(button.slot, expectedItem);
        }
        setRenderedButtonMarker(machine, panel, button, getItemMarker(expectedItem));
    }

    return state;
}

export function syncButtonPanel(machine, panelDefinition, options = {}) {
    const panel = normalizePanel(panelDefinition);
    if (!machine?.inv || !machine?.entity) {
        return getButtonPanelState(machine, panel);
    }

    let state = getButtonPanelState(machine, panel);

    for (const [index, buttonDefinition] of panel.buttons.entries()) {
        const button = normalizeButton(panel, buttonDefinition, index);
        const context = resolveButtonContext(machine, panel, button, state, options);
        const currentItem = machine.inv.getItem(button.slot);

        if (!context.visible) {
            if (currentItem) {
                clearPanelSlot(machine, button.slot, options);
            }
            setRenderedButtonMarker(machine, panel, button, "");
            continue;
        }

        const expectedItemId = resolveButtonItemId(panel, button, context);
        const expectedMarker = buildButtonMarker(panel, button, context);
        if (currentItem?.typeId === expectedItemId && getItemMarker(currentItem) === expectedMarker) {
            setRenderedButtonMarker(machine, panel, button, expectedMarker);
            continue;
        }

        const managedMismatch = isManagedButtonItem(currentItem, panel, button);
        const renderedMarker = getRenderedButtonMarker(machine, panel, button);
        const shouldInterpretAsPress = options.detectPresses !== false
            && !managedMismatch
            && renderedMarker.length > 0;

        if (shouldInterpretAsPress) {
            pressButtonPanelButton(machine, panel, button.id, options);
            state = getButtonPanelState(machine, panel);
            clearDroppedPanelItems(machine, collectPanelCleanupItemIds(machine, panel, state, options), options);
        }

        const unexpectedItem = machine.inv.getItem(button.slot);
        if (unexpectedItem && !isManagedButtonItem(unexpectedItem, panel, button)) {
            machine.inv.setItem(button.slot, undefined);
            returnUnexpectedItem(machine, unexpectedItem, options);
        }

        const refreshedContext = resolveButtonContext(machine, panel, button, state, options);
        if (!refreshedContext.visible) {
            machine.inv.setItem(button.slot, undefined);
            setRenderedButtonMarker(machine, panel, button, "");
            continue;
        }

        const refreshedItem = createButtonItem(panel, button, refreshedContext);
        machine.inv.setItem(button.slot, refreshedItem);
        setRenderedButtonMarker(machine, panel, button, getItemMarker(refreshedItem));
    }

    cleanupLeakedPanelItems(machine, panel, state, options);

    return state;
}

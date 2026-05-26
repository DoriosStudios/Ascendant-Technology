import { ItemStack, system } from "@minecraft/server";
import { LABEL_CHAR_LIMIT } from "../constants.js";
import { shouldRefreshEntityUi } from "../machinery/ui_refresh.js";

export const BUTTON_PANEL_DEFAULTS = Object.freeze({
	namespace: "ascendant:panel",
	cooldownTicks: 4,
	defaultButtonType: "toggle",
	defaultIconItemId: "utilitycraft:ui_filler",
	statePrefix: "state",
	cooldownPrefix: "cooldown",
	defaultPressHint: "Take or replace the button item to switch.",
	fallbackButtonLabel: "Button"
});

const BUTTON_TYPES = new Set(["toggle", "cycle", "radio", "action", "page"]);

/**
 * Shared item used by the button manager watcher loop.
 *
 * @type {import("@minecraft/server").ItemStack | null}
 */
export let ButtonItemStack = null;

const normalizedPanelCache = new WeakMap();
const registeredPanelMachineIds = new Set();
const panelByMachineId = new Map();
const machineRefByEntityId = new Map();

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
			.map(line => line.startsWith("§r") ? line : `§r${line}`);
	}

	return splitLines(typeof value === "string" ? value : "")
		.map(line => line.startsWith("§r") ? line : `§r${line}`);
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

function serializeDynamicValue(value) {
	if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
		return value;
	}

	if (value === undefined || value === null) {
		return undefined;
	}

	return String(value);
}

function getCurrentTick() {
	return Number(system.currentTick ?? 0);
}

/**
 * Initializes the shared button item used by the button system.
 *
 * @param {string} [itemId="utilitycraft:ui_filler"]
 * @param {typeof import("@minecraft/server").ItemStack} [ItemStackClass]
 * @returns {import("@minecraft/server").ItemStack | null}
 */
export function loadButtonItemStack(itemId = "utilitycraft:ui_filler", ItemStackClass = ItemStack) {
	if (!ItemStackClass) return null;

	const candidates = [
		itemId,
		"utilitycraft:ui_filler",
		"utilitycraft:switch_button"
	].filter((value, index, array) => typeof value === "string" && value.length > 0 && array.indexOf(value) === index);

	for (const candidate of candidates) {
		try {
			const item = new ItemStackClass(candidate, 1);
			item.nameTag = " ";
			if (typeof item.setLore === "function") {
				item.setLore([]);
			}
			ButtonItemStack = item;
			return ButtonItemStack;
		} catch {
			// Try next candidate.
		}
	}

	ButtonItemStack = null;
	return null;
}

function readSlotItem(container, slot) {
	if (!container || !Number.isInteger(slot) || slot < 0) return undefined;

	try {
		return container.getItem(slot);
	} catch {
		return undefined;
	}
}

function getEntityBlock(entity) {
	if (!entity?.dimension || !entity.location) return undefined;

	return entity.dimension.getBlock({
		x: Math.floor(entity.location.x),
		y: Math.floor(entity.location.y),
		z: Math.floor(entity.location.z)
	});
}

function getSlotState(item) {
	return item?.typeId ?? "empty";
}

/**
 * Static button manager for machine UI buttons.
 */
export class ButtonManager {
	/** @type {Map<string, { slot: number, onPressEvent: Function }[]>} */
	static machineDefinitions = new Map();

	/** @type {Map<string, { entity: import("@minecraft/server").Entity, machineId: string, cacheBySlot: Map<number, string> }>} */
	static activeWatchers = new Map();

	/** @type {number | undefined} */
	static intervalId = undefined;

	static registerMachineButton(machineId, slot, onPressEvent = () => { }) {
		if (typeof machineId !== "string" || machineId.length === 0) return false;
		if (!Number.isInteger(slot) || slot < 0) return false;

		const buttons = this.machineDefinitions.get(machineId) ?? [];
		const callback = typeof onPressEvent === "function" ? onPressEvent : () => { };
		const existingIndex = buttons.findIndex(button => button.slot === slot);
		const definition = { slot, onPressEvent: callback };

		if (existingIndex >= 0) {
			buttons[existingIndex] = definition;
		} else {
			buttons.push(definition);
			buttons.sort((left, right) => left.slot - right.slot);
		}

		this.machineDefinitions.set(machineId, buttons);
		return true;
	}

	static unregisterMachineButton(machineId, slot) {
		const buttons = this.machineDefinitions.get(machineId);
		if (!buttons?.length) return false;

		const filtered = buttons.filter(button => button.slot !== slot);
		if (filtered.length === buttons.length) return false;

		if (!filtered.length) {
			this.machineDefinitions.delete(machineId);
		} else {
			this.machineDefinitions.set(machineId, filtered);
		}

		return true;
	}

	static ensureWatching(entity, machineId) {
		if (!entity?.id) return false;

		const buttons = this.machineDefinitions.get(machineId);
		if (!buttons?.length) return false;

		const container = entity.getComponent("minecraft:inventory")?.container;
		if (!container) return false;

		const watcher = this.activeWatchers.get(entity.id);
		if (watcher) {
			watcher.entity = entity;
			watcher.machineId = machineId;
			this.ensureButtonItems(container, buttons);
			this.syncWatcherCache(watcher, container, buttons);
		} else {
			this.ensureButtonItems(container, buttons);
			this.activeWatchers.set(entity.id, this.createWatcher(entity, machineId, container, buttons));
		}

		this.start();
		return true;
	}

	static unwatchEntity(entity) {
		if (!entity?.id) return false;

		const deleted = this.activeWatchers.delete(entity.id);
		if (this.activeWatchers.size === 0) {
			this.stop();
		}

		return deleted;
	}

	static createWatcher(entity, machineId, container, buttons) {
		const cacheBySlot = new Map();
		for (const { slot } of buttons) {
			cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
		}

		return {
			entity,
			machineId,
			cacheBySlot
		};
	}

	static ensureButtonItems(container, buttons) {
		if (!container || !ButtonItemStack) return;

		for (const { slot } of buttons) {
			const currentItem = readSlotItem(container, slot);
			if (currentItem) continue;
			container.setItem(slot, ButtonItemStack);
		}
	}

	static syncWatcherCache(watcher, container, buttons) {
		const validSlots = new Set(buttons.map(({ slot }) => slot));

		for (const slot of watcher.cacheBySlot.keys()) {
			if (validSlots.has(slot)) continue;
			watcher.cacheBySlot.delete(slot);
		}

		for (const { slot } of buttons) {
			if (watcher.cacheBySlot.has(slot)) continue;
			watcher.cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
		}
	}

	static start() {
		if (this.intervalId !== undefined) return;

		this.intervalId = system.runInterval(() => {
			this.tick();
		}, 1);
	}

	static stop() {
		if (this.intervalId === undefined) return;

		system.clearRun(this.intervalId);
		this.intervalId = undefined;
	}

	static tick() {
		for (const [entityId, watcher] of this.activeWatchers) {
			try {
				const entity = watcher.entity;
				if (!entity?.isValid) {
					this.activeWatchers.delete(entityId);
					machineRefByEntityId.delete(entityId);
					continue;
				}

				const buttons = this.machineDefinitions.get(watcher.machineId);
				if (!buttons?.length) {
					this.activeWatchers.delete(entityId);
					machineRefByEntityId.delete(entityId);
					continue;
				}

				const container = entity.getComponent("minecraft:inventory")?.container;
				if (!container) {
					this.activeWatchers.delete(entityId);
					machineRefByEntityId.delete(entityId);
					continue;
				}

				this.syncWatcherCache(watcher, container, buttons);

				for (const { slot, onPressEvent } of buttons) {
					const currentState = getSlotState(readSlotItem(container, slot));
					const previousState = watcher.cacheBySlot.get(slot) ?? "empty";

					if (currentState === previousState) continue;

					if (ButtonItemStack) {
						container.setItem(slot, ButtonItemStack);
					}

					onPressEvent({
						entity,
						block: getEntityBlock(entity),
						container,
						slot
					});

					watcher.cacheBySlot.set(slot, getSlotState(readSlotItem(container, slot)));
				}
			} catch {
				this.activeWatchers.delete(entityId);
				machineRefByEntityId.delete(entityId);
			}
		}

		if (this.activeWatchers.size === 0) {
			this.stop();
		}
	}
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

function getPanelMachineId(panel) {
	return `${panel.namespace}:${panel.id}`;
}

function getPanelPropertyKey(panel, property) {
	return `${panel.namespace}:${panel.id}:${BUTTON_PANEL_DEFAULTS.statePrefix}:${sanitizeKey(property)}`;
}

function getButtonCooldownKey(panel, button) {
	return `${panel.namespace}:${panel.id}:${BUTTON_PANEL_DEFAULTS.cooldownPrefix}:${sanitizeKey(button.id)}`;
}

function getPanelDefaultState(panel) {
	const defaults = panel.defaults && typeof panel.defaults === "object"
		? { ...panel.defaults }
		: {};

	for (const [index, buttonDefinition] of panel.buttons.entries()) {
		const button = normalizeButton(panel, buttonDefinition, index);
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

function resolveButtonLore(button, context) {
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

	return lines.map(line => truncateText(line));
}

function createItemStackSafe(itemTypeId) {
	if (typeof itemTypeId !== "string" || itemTypeId.length === 0) return null;

	try {
		return new ItemStack(itemTypeId, 1);
	} catch {
		return null;
	}
}

function resolveRenderItemTypeId(panel, button, context) {
	const callbackValue = resolveCallbackValue(button?.getIconItemId, undefined, context);
	if (typeof callbackValue === "string" && callbackValue.length > 0) {
		return callbackValue;
	}

	if (context?.active === true && typeof button?.activeIconItemId === "string" && button.activeIconItemId.length > 0) {
		return button.activeIconItemId;
	}

	if (context?.active === false && typeof button?.inactiveIconItemId === "string" && button.inactiveIconItemId.length > 0) {
		return button.inactiveIconItemId;
	}

	if (typeof button?.iconItemId === "string" && button.iconItemId.length > 0) {
		return button.iconItemId;
	}

	if (typeof panel?.defaultIconItemId === "string" && panel.defaultIconItemId.length > 0) {
		return panel.defaultIconItemId;
	}

	return ButtonItemStack?.typeId ?? BUTTON_PANEL_DEFAULTS.defaultIconItemId;
}

function createButtonVisualItem(panel, button, context) {
	const candidateTypeIds = [
		resolveRenderItemTypeId(panel, button, context),
		button?.iconItemId,
		panel?.defaultIconItemId,
		ButtonItemStack?.typeId,
		BUTTON_PANEL_DEFAULTS.defaultIconItemId
	].filter((value, index, array) => typeof value === "string" && value.length > 0 && array.indexOf(value) === index);

	let item = null;
	for (const itemTypeId of candidateTypeIds) {
		item = createItemStackSafe(itemTypeId);
		if (item) break;
	}
	if (!item) return null;

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
	if (typeof item.setLore === "function") {
		item.setLore(resolveButtonLore(button, context));
	}
	return item;
}

function areLoreLinesEqual(left, right) {
	if (!Array.isArray(left) || !Array.isArray(right)) return false;
	if (left.length !== right.length) return false;
	return left.every((line, index) => line === right[index]);
}

function isSameVisualItem(currentItem, expectedItem) {
	if (!currentItem || !expectedItem) return false;
	if (currentItem.typeId !== expectedItem.typeId) return false;
	if ((currentItem.nameTag ?? "") !== (expectedItem.nameTag ?? "")) return false;

	const currentLore = typeof currentItem.getLore === "function" ? currentItem.getLore() : [];
	const expectedLore = typeof expectedItem.getLore === "function" ? expectedItem.getLore() : [];
	return areLoreLinesEqual(currentLore ?? [], expectedLore ?? []);
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
			// Ignore callback failures to keep the panel responsive.
		}
	}

	return {
		handled: true,
		state: nextState,
		button
	};
}

export function clearButtonPanel(machine, panelDefinition) {
	const panel = normalizePanel(panelDefinition);
	for (const [index, buttonDefinition] of panel.buttons.entries()) {
		const button = normalizeButton(panel, buttonDefinition, index);
		if (!machine?.inv) continue;
		machine.inv.setItem(button.slot, undefined);
	}
}

export function renderButtonPanel(machine, panelDefinition, options = {}) {
	const panel = normalizePanel(panelDefinition);
	const state = options.state ?? getButtonPanelState(machine, panel);

	if (!machine?.inv) return state;

	for (const [index, buttonDefinition] of panel.buttons.entries()) {
		const button = normalizeButton(panel, buttonDefinition, index);
		const context = resolveButtonContext(machine, panel, button, state, options);

		if (!context.visible) {
			machine.inv.setItem(button.slot, undefined);
			continue;
		}

		const expectedItem = createButtonVisualItem(panel, button, context);
		if (!expectedItem) continue;

		const currentItem = machine.inv.getItem(button.slot);
		if (!isSameVisualItem(currentItem, expectedItem)) {
			machine.inv.setItem(button.slot, expectedItem);
		}
	}

	return state;
}

function createFallbackMachine(entity) {
	const container = entity?.getComponent?.("minecraft:inventory")?.container;
	return {
		entity,
		block: getEntityBlock(entity),
		inv: container,
		dim: entity?.dimension
	};
}

function resolveButtonBySlot(panel, slot) {
	for (const [index, buttonDefinition] of panel.buttons.entries()) {
		const button = normalizeButton(panel, buttonDefinition, index);
		if (button.slot === slot) return button;
	}
	return null;
}

function registerPanelMachine(panel) {
	const machineId = getPanelMachineId(panel);
	panelByMachineId.set(machineId, panel);

	if (registeredPanelMachineIds.has(machineId)) {
		return machineId;
	}

	for (const [index, buttonDefinition] of panel.buttons.entries()) {
		const button = normalizeButton(panel, buttonDefinition, index);
		ButtonManager.registerMachineButton(machineId, button.slot, ({ entity, slot }) => {
			const runtimePanel = normalizePanel(panelByMachineId.get(machineId) ?? panel);
			const runtimeMachine = machineRefByEntityId.get(entity.id) ?? createFallbackMachine(entity);
			if (!runtimeMachine?.entity || !runtimeMachine?.inv) return;

			const slottedButton = resolveButtonBySlot(runtimePanel, slot);
			if (!slottedButton) return;

			pressButtonPanelButton(runtimeMachine, runtimePanel, slottedButton.id, {
				source: "button_manager"
			});
			renderButtonPanel(runtimeMachine, runtimePanel);
		});
	}

	registeredPanelMachineIds.add(machineId);
	return machineId;
}

export function syncButtonPanel(machine, panelDefinition, options = {}) {
	const panel = normalizePanel(panelDefinition);
	if (!machine?.entity) {
		return getButtonPanelState(machine, panel);
	}

	if (!ButtonItemStack) {
		loadButtonItemStack(panel.defaultIconItemId, ItemStack);
	}

	machineRefByEntityId.set(machine.entity.id, machine);

	const machineId = registerPanelMachine(panel);
	if (options.detectPresses !== false) {
		ButtonManager.ensureWatching(machine.entity, machineId);
	}

	const state = getButtonPanelState(machine, panel);
	const shouldRender = options.render === undefined
		? shouldRefreshEntityUi(
			machine.entity,
			`button_panel:${panel.namespace}:${panel.id}`,
			options.interval,
			options.forceRender === true
		)
		: options.render !== false;
	if (shouldRender) {
		renderButtonPanel(machine, panel, {
			...options,
			state
		});
	}

	return state;
}

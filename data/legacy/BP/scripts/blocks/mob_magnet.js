import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";

const MAGNET = Object.freeze({
	levels: Object.freeze({
		range: Object.freeze([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]),
		cooldown: Object.freeze([0, 5, 10, 15, 20, 30, 40])
	}),
	filters: Object.freeze({
		excludedTypes: Object.freeze([
	"minecraft:player",
	"minecraft:item",
	"minecraft:xp_orb",
	"minecraft:arrow",
	"minecraft:fireball",
	"minecraft:small_fireball",
	"minecraft:snowball",
	"minecraft:egg",
	"minecraft:thrown_trident",
	"minecraft:eye_of_ender_signal",
	"minecraft:lightning_bolt",
	"minecraft:falling_block",
	"utilitycraft:machine",
	"dorios:machine"
		]),
		excludedFamilies: Object.freeze([
	"player",
	"inanimate",
	"projectile",
	"machine",
	"dorios:battery",
	"dorios:energy_container",
	"dorios:fluid_container"
		]),
		modes: Object.freeze({
			blacklist: "blacklist",
			whitelist: "whitelist"
		})
	}),
	states: Object.freeze({
		immuneTag: "dorios:magnet_immune",
		range: "utilitycraft:range",
		filterUpgrade: "utilitycraft:filter",
		legacyFilterUpgrade: "utilitycraft:filter_upgrade",
		cooldownProp: "utilitycraft:mob_magnet_cooldown",
		storeSuffix: "_state"
	}),
	runtime: Object.freeze({
		globalTickKey: "__utilitycraft_mob_magnet_tick__",
		tickWrap: 1_000_000_000
	})
});

const normalizeRawMessageArg = value => {
	if (value === undefined || value === null) return "";
	if (typeof value === "object") return value;
	return String(value);
};

const tr = (key, withArgs = []) => ({
	translate: key,
	with: withArgs.map(normalizeRawMessageArg)
});
const formatMobName = id => DoriosAPI.utils.formatIdToText(id);

if (typeof globalThis[MAGNET.runtime.globalTickKey] !== "number") {
	globalThis[MAGNET.runtime.globalTickKey] = 0;
	system.runInterval(() => {
		globalThis[MAGNET.runtime.globalTickKey] = (globalThis[MAGNET.runtime.globalTickKey] + 1) % MAGNET.runtime.tickWrap;
	}, 1);
}

const getCurrentTick = () => {
	const systemTick = Number(system.currentTick);
	if (Number.isFinite(systemTick)) return systemTick;
	return globalThis[MAGNET.runtime.globalTickKey];
};

function normalizeCooldownGate(nextAllowed, now) {
	if (!Number.isFinite(nextAllowed) || nextAllowed <= 0) return 0;
	if (!Number.isFinite(now) || now < 0) return nextAllowed;
	if (nextAllowed - now > MAGNET.runtime.tickWrap / 2) return 0;
	return nextAllowed;
}

function isEntityStillValid(entity) {
	if (!entity) return false;
	const validity = entity.isValid;
	if (typeof validity === "function") {
		try {
			return Boolean(validity.call(entity));
		} catch {
			return false;
		}
	}
	if (typeof validity === "boolean") return validity;
	return true;
}


DoriosAPI.register.blockComponent("mob_magnet", {
	onTick({ block }) {
		const rangeUpgrade = clampIndex(getBlockStateValue(block.permutation, MAGNET.states.range), MAGNET.levels.range.length - 1);
		const maxRangeIndex = Math.min(rangeUpgrade, MAGNET.levels.range.length - 1);
		const magnetId = getMagnetId(block.location);
		const syncedState = syncMagnetState(block, magnetId, maxRangeIndex);
		if (!syncedState.isOn) return;

		const rangeSelected = syncedState.rangeIndex;
		const trueRange = MAGNET.levels.range[rangeSelected] ?? MAGNET.levels.range[0];
		const cooldownTicks = getCooldownTicks(magnetId);
		const now = getCurrentTick();

		const hasFilterUpgrade = hasFilterUpgradeInstalled(block);
		const filterConfig = hasFilterUpgrade ? getFilterConfig(magnetId) : null;

		const { x, y, z } = block.location;
		const center = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };

		const entities = block.dimension.getEntities({
			location: center,
			maxDistance: trueRange,
			excludeTypes: MAGNET.filters.excludedTypes,
			excludeFamilies: MAGNET.filters.excludedFamilies
		});

		const filteredEntities = applyEntityFilters(entities, filterConfig);

		for (const entity of filteredEntities) {
			if (!isEntityStillValid(entity)) continue;
			if (entity.hasTag(MAGNET.states.immuneTag)) continue;

			let nextAllowed = Number(entity.getDynamicProperty(MAGNET.states.cooldownProp)) || 0;
			nextAllowed = normalizeCooldownGate(nextAllowed, now);
			if (cooldownTicks > 0 && nextAllowed > now) continue;

			entity.teleport(
				{ x: x + 0.5, y: y + 1, z: z + 0.5 },
				{ dimension: block.dimension, facingLocation: center }
			);

			if (cooldownTicks > 0) {
				entity.setDynamicProperty(MAGNET.states.cooldownProp, now + cooldownTicks);
			}
		}
	},

	onPlayerInteract({ block, player }) {
		const hand = player.getComponent("equippable")?.getEquipment("Mainhand");
		if (hand || player.isSneaking) return;

		const magnetId = getMagnetId(block.location);
		if (hasFilterUpgradeInstalled(block)) {
			openEnhancedMenu(player, block, magnetId);
			return;
		}
		openSettingsMenu(player, block, magnetId);
	}
});

function openEnhancedMenu(player, block, magnetId) {
	const menu = new ActionFormData()
		.title(tr("ui.utilitycraft.mob_magnet.menu.title"))
		.body(tr("ui.utilitycraft.mob_magnet.menu.body"))
		.button(tr("ui.utilitycraft.mob_magnet.menu.configure"))
		.button(tr("ui.utilitycraft.mob_magnet.menu.filter"));

	menu.show(player).then(response => {
		if (response.canceled || response.selection === undefined) return;
		if (response.selection === 0) {
			openSettingsMenu(player, block, magnetId, () => openEnhancedMenu(player, block, magnetId));
			return;
		}
		openFilterMenu(player, block, magnetId);
	});
}

function openSettingsMenu(player, block, magnetId, returnToMenu) {
	const rangeUpgrade = clampIndex(getBlockStateValue(block.permutation, MAGNET.states.range), MAGNET.levels.range.length - 1);
	const maxRangeIndex = Math.min(rangeUpgrade, MAGNET.levels.range.length - 1);
	const syncedState = syncMagnetState(block, magnetId, maxRangeIndex);
	const isOn = syncedState.isOn;
	const rangeSelected = syncedState.rangeIndex;
	const cooldownIndex = getCooldownIndex(magnetId);
	const rangeOptions = MAGNET.levels.range
		.slice(0, maxRangeIndex + 1)
		.map((range, index) => tr("ui.utilitycraft.mob_magnet.settings.range_option", [range, index + 1]));
	const cooldownOptions = MAGNET.levels.cooldown
		.map(cooldown => tr("ui.utilitycraft.mob_magnet.settings.cooldown_option", [cooldown]));

	const form = new ModalFormData()
		.title(tr("ui.utilitycraft.mob_magnet.settings.title"))
		.toggle(tr("ui.utilitycraft.mob_magnet.settings.toggle"), { defaultValue: isOn })
		.dropdown(
			tr("ui.utilitycraft.mob_magnet.settings.range"),
			rangeOptions,
			{ defaultValueIndex: rangeSelected }
		)
		.dropdown(
			tr("ui.utilitycraft.mob_magnet.settings.cooldown"),
			cooldownOptions,
			{ defaultValueIndex: cooldownIndex }
		);

	form.show(player).then(result => {
		if (result.canceled || !result.formValues) return;

		const [enabledValue, rangeValue, cooldownValue] = result.formValues;
		const enabled = Boolean(enabledValue);
		const selectedRangeIndex = clampIndex(rangeValue, maxRangeIndex);
		const selectedCooldownIndex = clampIndex(cooldownValue, MAGNET.levels.cooldown.length - 1);

		if (enabled !== isOn) {
			applyBlockStates(block, {
				"utilitycraft:isOn": enabled
			});
		}

		saveStoredMagnetState(magnetId, { isOn: enabled, rangeIndex: selectedRangeIndex });
		setCooldownIndex(magnetId, selectedCooldownIndex);

		if (typeof returnToMenu === "function") returnToMenu();
	});
}

function openFilterMenu(player, block, magnetId) {
	const filterData = getFilterConfig(magnetId);
	const hasEntries = filterData.list.length > 0;
	const modeBodyKey = getFilterModeBodyKey(filterData.mode);
	const modeButtonKey = getFilterModeButtonKey(filterData.mode);

	const form = new ActionFormData()
		.title(tr("ui.utilitycraft.mob_magnet.filter.title"))
		.body(tr(modeBodyKey))
		.button(tr("ui.utilitycraft.mob_magnet.filter.add"));

	const actions = ["add"];

	if (hasEntries) {
		form.button(tr("ui.utilitycraft.mob_magnet.filter.list", [filterData.list.length]));
		actions.push("list");

		form.button(tr("ui.utilitycraft.mob_magnet.filter.remove"));
		actions.push("remove");
	}

	form.button(tr(modeButtonKey));
	actions.push("mode");

	form.show(player).then(response => {
		if (response.canceled || response.selection === undefined) return;
		const action = actions[response.selection];

		switch (action) {
			case "add":
				promptAddMob(player, block, magnetId, filterData, () => openFilterMenu(player, block, magnetId));
				break;
			case "list":
				showFilteredMobList(player, block, magnetId, filterData, () => openFilterMenu(player, block, magnetId));
				break;
			case "remove":
				promptRemoveMob(player, block, magnetId, filterData, () => openFilterMenu(player, block, magnetId));
				break;
			case "mode":
				toggleFilterMode(player, block, magnetId, filterData, () => openFilterMenu(player, block, magnetId));
				break;
		}
	});
}

function promptAddMob(player, block, magnetId, filterData, returnToMenu) {
	const form = new ModalFormData()
		.title(tr("ui.utilitycraft.mob_magnet.filter.add.title"))
		.textField(
			tr("ui.utilitycraft.mob_magnet.filter.add.field"),
			tr("ui.utilitycraft.mob_magnet.filter.add.placeholder")
		);

	form.show(player).then(result => {
		if (result.canceled || !result.formValues) {
			returnToMenu?.();
			return;
		}

		const [input] = result.formValues;
		const normalized = normalizeMobId(input);
		if (!normalized) {
			player.onScreenDisplay.setActionBar(tr("ui.utilitycraft.mob_magnet.filter.add.invalid"));
			promptAddMob(player, block, magnetId, filterData, returnToMenu);
			return;
		}

		if (!filterData.list.includes(normalized)) {
			filterData.list.push(normalized);
			saveFilterConfig(magnetId, filterData);
			player.onScreenDisplay.setActionBar(
				tr("ui.utilitycraft.mob_magnet.filter.add.success", [formatMobName(normalized)])
			);
		} else {
			player.onScreenDisplay.setActionBar(tr("ui.utilitycraft.mob_magnet.filter.add.duplicate"));
		}

		promptAddMob(player, block, magnetId, filterData, returnToMenu);
	});
}

function showFilteredMobList(player, block, magnetId, filterData, returnToMenu) {
	const form = new ActionFormData()
		.title(tr("ui.utilitycraft.mob_magnet.filter.list_title"))
		.body(
			filterData.list.length === 0
				? tr("ui.utilitycraft.mob_magnet.filter.list_empty")
				: tr("ui.utilitycraft.mob_magnet.filter.list_body")
		);

	for (const mobId of filterData.list) {
		form.button(DoriosAPI.utils.formatIdToText(mobId));
	}

	form.show(player).then(() => {
		returnToMenu?.();
	});
}

function promptRemoveMob(player, block, magnetId, filterData, returnToMenu) {
	if (filterData.list.length === 0) {
		returnToMenu?.();
		return;
	}

	const form = new ActionFormData()
		.title(tr("ui.utilitycraft.mob_magnet.filter.remove.title"))
		.body(tr("ui.utilitycraft.mob_magnet.filter.remove.body"));

	for (const mobId of filterData.list) {
		form.button(DoriosAPI.utils.formatIdToText(mobId));
	}

	form.show(player).then(result => {
		if (result.canceled || result.selection === undefined) {
			returnToMenu?.();
			return;
		}

		const removed = filterData.list.splice(result.selection, 1);
		if (removed.length) {
			saveFilterConfig(magnetId, filterData);
			player.onScreenDisplay.setActionBar(
				tr("ui.utilitycraft.mob_magnet.filter.remove.success", [formatMobName(removed[0])])
			);
		}

		if (filterData.list.length > 0) {
			promptRemoveMob(player, block, magnetId, filterData, returnToMenu);
			return;
		}

		returnToMenu?.();
	});
}

function toggleFilterMode(player, block, magnetId, filterData, returnToMenu) {
	filterData.mode = filterData.mode === MAGNET.filters.modes.whitelist
		? MAGNET.filters.modes.blacklist
		: MAGNET.filters.modes.whitelist;
	saveFilterAndNotify(
		player,
		magnetId,
		filterData,
		tr(getFilterModeSwitchedKey(filterData.mode))
	);
	returnToMenu?.();
}

function saveFilterAndNotify(player, magnetId, filterData, message) {
	saveFilterConfig(magnetId, filterData);
	player.onScreenDisplay.setActionBar(message);
}

function applyEntityFilters(entities, filterConfig) {
	if (!filterConfig || filterConfig.list.length === 0) return entities;
	const filterSet = new Set(filterConfig.list);
	if (filterConfig.mode === MAGNET.filters.modes.whitelist) {
		return entities.filter(entity => filterSet.has(entity.typeId));
	}
	return entities.filter(entity => !filterSet.has(entity.typeId));
}

function getFilterConfig(id) {
	const raw = world.getDynamicProperty(getFilterKey(id));
	if (typeof raw !== "string" || raw.length === 0) {
		return { mode: MAGNET.filters.modes.blacklist, list: [] };
	}
	try {
		const parsed = JSON.parse(raw);
		const mode = parsed.mode === MAGNET.filters.modes.whitelist ? MAGNET.filters.modes.whitelist : MAGNET.filters.modes.blacklist;
		const list = Array.isArray(parsed.list)
			? [...new Set(parsed.list.map(normalizeMobId).filter(Boolean))]
			: [];
		return { mode, list };
	} catch {
		return { mode: MAGNET.filters.modes.blacklist, list: [] };
	}
}

function saveFilterConfig(id, data) {
	const payload = {
		mode: data.mode === MAGNET.filters.modes.whitelist ? MAGNET.filters.modes.whitelist : MAGNET.filters.modes.blacklist,
		list: Array.from(new Set((data.list ?? []).map(normalizeMobId).filter(Boolean)))
	};
	world.setDynamicProperty(getFilterKey(id), JSON.stringify(payload));
}

function getFilterKey(id) {
	return `${id}_filters`;
}

function getCooldownKey(id) {
	return `${id}_cooldown_idx`;
}

function getMagnetId(location) {
	const { x, y, z } = location;
	return `mob_magnet_${x}_${y}_${z}`;
}

function getCooldownIndex(id) {
	const stored = world.getDynamicProperty(getCooldownKey(id));
	if (typeof stored === "number") {
		return clampIndex(stored, MAGNET.levels.cooldown.length - 1);
	}
	return 0;
}

function setCooldownIndex(id, index) {
	world.setDynamicProperty(getCooldownKey(id), clampIndex(index, MAGNET.levels.cooldown.length - 1));
}

function getCooldownTicks(id) {
	return MAGNET.levels.cooldown[getCooldownIndex(id)] ?? MAGNET.levels.cooldown[0];
}

function clampIndex(value, max = Number.MAX_SAFE_INTEGER) {
	const numeric = Math.floor(Number(value) || 0);
	return Math.max(0, Math.min(numeric, max));
}

function applyBlockStates(block, updates) {
	let permutation = block.permutation;
	for (const [key, value] of Object.entries(updates)) {
		if (value === undefined || value === null) continue;
		permutation = permutation.withState(key, value);
	}
	block.setPermutation(permutation);
}

function hasFilterUpgradeInstalled(block) {
	const permutation = block?.permutation;
	if (!permutation) return false;
	const currentValue = getBlockStateValue(permutation, MAGNET.states.filterUpgrade);
	if (currentValue !== undefined && currentValue !== null) {
		return Number(currentValue) > 0;
	}
	const legacyValue = getBlockStateValue(permutation, MAGNET.states.legacyFilterUpgrade);
	if (legacyValue !== undefined && legacyValue !== null) {
		return Number(legacyValue) > 0;
	}
	return false;
}

function getBlockStateValue(permutation, stateId) {
	if (!permutation) return undefined;
	try {
		return permutation.getState(stateId);
	} catch {
		return undefined;
	}
}

function normalizeMobId(value) {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
}

function formatModeLabel(mode) {
	return tr(
		mode === MAGNET.filters.modes.whitelist
			? "ui.utilitycraft.mob_magnet.filter.mode.whitelist"
			: "ui.utilitycraft.mob_magnet.filter.mode.blacklist"
	);
}

function getFilterModeBodyKey(mode) {
	return mode === MAGNET.filters.modes.whitelist
		? "ui.utilitycraft.mob_magnet.filter.body.whitelist"
		: "ui.utilitycraft.mob_magnet.filter.body.blacklist";
}

function getFilterModeButtonKey(mode) {
	return mode === MAGNET.filters.modes.whitelist
		? "ui.utilitycraft.mob_magnet.filter.mode_button.whitelist"
		: "ui.utilitycraft.mob_magnet.filter.mode_button.blacklist";
}

function getFilterModeSwitchedKey(mode) {
	return mode === MAGNET.filters.modes.whitelist
		? "ui.utilitycraft.mob_magnet.filter.mode_switched.whitelist"
		: "ui.utilitycraft.mob_magnet.filter.mode_switched.blacklist";
}

function getMagnetStateKey(id) {
	return `${id}${MAGNET.states.storeSuffix}`;
}

function getStoredMagnetState(id) {
	const raw = world.getDynamicProperty(getMagnetStateKey(id));
	if (typeof raw !== "string" || raw.length === 0) return null;
	try {
		const parsed = JSON.parse(raw);
		return {
			isOn: Boolean(parsed.isOn),
			rangeIndex: clampIndex(parsed.rangeIndex ?? 0, MAGNET.levels.range.length - 1)
		};
	} catch {
		return null;
	}
}

function saveStoredMagnetState(id, state) {
	const payload = {
		isOn: Boolean(state.isOn),
		rangeIndex: clampIndex(state.rangeIndex ?? 0, MAGNET.levels.range.length - 1)
	};
	world.setDynamicProperty(getMagnetStateKey(id), JSON.stringify(payload));
}

function syncMagnetState(block, magnetId, maxRangeIndex) {
	const stored = getStoredMagnetState(magnetId);
	const permutation = block.permutation;
	let isOn = Boolean(getBlockStateValue(permutation, "utilitycraft:isOn"));
	let rangeIndex = 0;

	if (stored) {
		if (typeof stored.isOn === "boolean") {
			isOn = stored.isOn;
		}
		if (typeof stored.rangeIndex === "number") {
			rangeIndex = clampIndex(stored.rangeIndex, maxRangeIndex);
		}
	}

	const updates = {};
	if (Boolean(getBlockStateValue(permutation, "utilitycraft:isOn")) !== isOn) {
		updates["utilitycraft:isOn"] = isOn;
	}

	if (Object.keys(updates).length > 0) {
		applyBlockStates(block, updates);
	}

	saveStoredMagnetState(magnetId, { isOn, rangeIndex });
	return { isOn, rangeIndex };
}

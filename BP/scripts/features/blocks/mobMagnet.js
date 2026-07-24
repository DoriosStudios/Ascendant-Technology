// @ts-check

import * as DoriosLib from "DoriosLib/index.js";
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const BLOCK_ID = "utilitycraft:mob_magnet";
const COMPONENT_ID = "utilitycraft:mob_magnet";
const IMMUNE_TAG = "dorios:magnet_immune";
const ENTITY_COOLDOWN_PROPERTY = "utilitycraft:mob_magnet_cooldown";
const RANGE_STATE = "utilitycraft:range";
const FILTER_STATE = "utilitycraft:filter";
const ON_STATE = "utilitycraft:isOn";

const RANGE_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
const COOLDOWN_LEVELS = [0, 5, 10, 15, 20, 30, 40];
const EXCLUDED_TYPES = [
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
  "utilitycraft:machine_entity",
];
const EXCLUDED_FAMILIES = [
  "player",
  "inanimate",
  "projectile",
  "machine",
  "dorios:machine",
  "dorios:battery",
  "dorios:energy_container",
  "dorios:fluid_container",
];

const stateCache = new Map();
const nextScanByMagnet = new Map();

function translate(key, values = []) {
  return {
    translate: key,
    with: values.map((value) => String(value)),
  };
}

function clampIndex(value, max) {
  return Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
}

function dimensionCode(dimensionId) {
  if (dimensionId === "minecraft:overworld") return "o";
  if (dimensionId === "minecraft:nether") return "n";
  if (dimensionId === "minecraft:the_end") return "e";
  return String(dimensionId ?? "unknown").replaceAll(":", ".");
}

function magnetKey(block) {
  const { x, y, z } = block.location;
  return `at:mm:${dimensionCode(block.dimension?.id)}:${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function defaultState() {
  return {
    rangeIndex: 0,
    cooldownIndex: 0,
    filterMode: "blacklist",
    filterList: [],
    filterSet: new Set(),
  };
}

function normalizeMobId(value) {
  if (typeof value !== "string") return "";
  const typeId = value.trim().toLowerCase();
  return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(typeId) ? typeId : "";
}

function normalizeState(value) {
  const state = defaultState();
  if (!value || typeof value !== "object") return state;
  state.rangeIndex = clampIndex(value.rangeIndex, RANGE_LEVELS.length - 1);
  state.cooldownIndex = clampIndex(value.cooldownIndex, COOLDOWN_LEVELS.length - 1);
  state.filterMode = value.filterMode === "whitelist" ? "whitelist" : "blacklist";
  state.filterList = Array.from(new Set(
    (Array.isArray(value.filterList) ? value.filterList : [])
      .map(normalizeMobId)
      .filter(Boolean),
  ));
  state.filterSet = new Set(state.filterList);
  return state;
}

function loadState(block) {
  const key = magnetKey(block);
  const cached = stateCache.get(key);
  if (cached) return cached;

  let state = defaultState();
  try {
    const raw = world.getDynamicProperty(key);
    if (typeof raw === "string" && raw.length > 0) state = normalizeState(JSON.parse(raw));
  } catch {
    state = defaultState();
  }
  stateCache.set(key, state);
  return state;
}

function saveState(block, state) {
  const key = magnetKey(block);
  const normalized = normalizeState(state);
  stateCache.set(key, normalized);
  try {
    world.setDynamicProperty(key, JSON.stringify({
      rangeIndex: normalized.rangeIndex,
      cooldownIndex: normalized.cooldownIndex,
      filterMode: normalized.filterMode,
      filterList: normalized.filterList,
    }));
  } catch (error) {
    console.warn("[Mob Magnet] Failed saving configuration:", error);
  }
  return normalized;
}

function clearState(block) {
  const key = magnetKey(block);
  stateCache.delete(key);
  nextScanByMagnet.delete(key);
  try {
    world.setDynamicProperty(key, undefined);
  } catch {
    // An old runtime may not support clearing undefined properties.
  }
}

function getBlockState(block, stateId, fallback = 0) {
  try {
    return block.permutation.getState(stateId) ?? fallback;
  } catch {
    return fallback;
  }
}

function setBlockState(block, stateId, value) {
  if (block?.typeId !== BLOCK_ID) return false;
  try {
    block.setPermutation(block.permutation.withState(stateId, value));
    return true;
  } catch {
    return false;
  }
}

function getRangeUpgradeLevel(block) {
  return clampIndex(getBlockState(block, RANGE_STATE), RANGE_LEVELS.length - 1);
}

function hasFilterUpgrade(block) {
  return Number(getBlockState(block, FILTER_STATE)) > 0;
}

function shouldPullEntity(entity, state) {
  if (!entity?.isValid || entity.hasTag?.(IMMUNE_TAG)) return false;
  if (state.filterSet.size === 0) return true;
  const listed = state.filterSet.has(entity.typeId);
  return state.filterMode === "whitelist" ? listed : !listed;
}

function processMagnet(block) {
  if (!Boolean(getBlockState(block, ON_STATE, false))) return;

  const key = magnetKey(block);
  const now = Number(system.currentTick) || 0;
  if (now < (nextScanByMagnet.get(key) ?? 0)) return;

  const state = loadState(block);
  const maxRangeIndex = getRangeUpgradeLevel(block);
  const rangeIndex = Math.min(state.rangeIndex, maxRangeIndex);
  const cooldown = COOLDOWN_LEVELS[state.cooldownIndex] ?? 0;
  const scanInterval = Math.max(4, cooldown);
  nextScanByMagnet.set(key, now + scanInterval);

  const center = {
    x: block.location.x + 0.5,
    y: block.location.y + 0.5,
    z: block.location.z + 0.5,
  };

  let entities;
  try {
    entities = block.dimension.getEntities({
      location: center,
      maxDistance: RANGE_LEVELS[rangeIndex] ?? RANGE_LEVELS[0],
      excludeTypes: EXCLUDED_TYPES,
      excludeFamilies: EXCLUDED_FAMILIES,
    });
  } catch (error) {
    console.warn("[Mob Magnet] Entity query failed:", error);
    return;
  }

  const useFilter = hasFilterUpgrade(block);
  const target = { x: center.x, y: block.location.y + 1.25, z: center.z };
  for (const entity of entities) {
    if (!entity?.isValid || entity.hasTag?.(IMMUNE_TAG)) continue;
    if (useFilter && !shouldPullEntity(entity, state)) continue;

    const nextAllowed = Number(entity.getDynamicProperty?.(ENTITY_COOLDOWN_PROPERTY)) || 0;
    if (nextAllowed > now) continue;

    try {
      entity.teleport(target, { dimension: block.dimension, facingLocation: center });
      entity.setDynamicProperty?.(ENTITY_COOLDOWN_PROPERTY, now + scanInterval);
    } catch {
      // Entity validity can change between the query and teleport.
    }
  }
}

function showForm(form, player, callback) {
  form.show(player).then(callback).catch((error) => {
    console.warn("[Mob Magnet] Form failed:", error);
  });
}

function reopen(callback) {
  if (typeof callback === "function") system.run(callback);
}

function openMainMenu(player, block) {
  const form = new ActionFormData()
    .title(translate("ui.utilitycraft.mob_magnet.menu.title"))
    .body(translate("ui.utilitycraft.mob_magnet.menu.body"))
    .button(translate("ui.utilitycraft.mob_magnet.menu.configure"))
    .button(translate("ui.utilitycraft.mob_magnet.menu.filter"));

  showForm(form, player, (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) openSettingsMenu(player, block, () => openMainMenu(player, block));
    else openFilterMenu(player, block);
  });
}

function openSettingsMenu(player, block, returnToMenu) {
  if (block?.typeId !== BLOCK_ID) return;
  const state = loadState(block);
  const maxRangeIndex = getRangeUpgradeLevel(block);
  const selectedRange = Math.min(state.rangeIndex, maxRangeIndex);
  const rangeOptions = RANGE_LEVELS.slice(0, maxRangeIndex + 1)
    .map((range, index) => translate("ui.utilitycraft.mob_magnet.settings.range_option", [range, index + 1]));
  const cooldownOptions = COOLDOWN_LEVELS
    .map((ticks) => translate("ui.utilitycraft.mob_magnet.settings.cooldown_option", [ticks]));

  const form = new ModalFormData()
    .title(translate("ui.utilitycraft.mob_magnet.settings.title"))
    .toggle(translate("ui.utilitycraft.mob_magnet.settings.toggle"), {
      defaultValue: Boolean(getBlockState(block, ON_STATE, false)),
    })
    .dropdown(translate("ui.utilitycraft.mob_magnet.settings.range"), rangeOptions, {
      defaultValueIndex: selectedRange,
    })
    .dropdown(translate("ui.utilitycraft.mob_magnet.settings.cooldown"), cooldownOptions, {
      defaultValueIndex: state.cooldownIndex,
    });

  showForm(form, player, (response) => {
    if (response.canceled || !response.formValues || block?.typeId !== BLOCK_ID) return;
    const [enabled, rangeIndex, cooldownIndex] = response.formValues;
    setBlockState(block, ON_STATE, Boolean(enabled));
    saveState(block, {
      ...state,
      rangeIndex: clampIndex(rangeIndex, maxRangeIndex),
      cooldownIndex: clampIndex(cooldownIndex, COOLDOWN_LEVELS.length - 1),
    });
    nextScanByMagnet.delete(magnetKey(block));
    reopen(returnToMenu);
  });
}

function filterBodyKey(mode) {
  return mode === "whitelist"
    ? "ui.utilitycraft.mob_magnet.filter.body.whitelist"
    : "ui.utilitycraft.mob_magnet.filter.body.blacklist";
}

function filterButtonKey(mode) {
  return mode === "whitelist"
    ? "ui.utilitycraft.mob_magnet.filter.mode_button.whitelist"
    : "ui.utilitycraft.mob_magnet.filter.mode_button.blacklist";
}

function filterSwitchedKey(mode) {
  return mode === "whitelist"
    ? "ui.utilitycraft.mob_magnet.filter.mode_switched.whitelist"
    : "ui.utilitycraft.mob_magnet.filter.mode_switched.blacklist";
}

function openFilterMenu(player, block) {
  if (block?.typeId !== BLOCK_ID || !hasFilterUpgrade(block)) return;
  const state = loadState(block);
  const actions = ["add"];
  const form = new ActionFormData()
    .title(translate("ui.utilitycraft.mob_magnet.filter.title"))
    .body(translate(filterBodyKey(state.filterMode)))
    .button(translate("ui.utilitycraft.mob_magnet.filter.add"));

  if (state.filterList.length > 0) {
    form.button(translate("ui.utilitycraft.mob_magnet.filter.list", [state.filterList.length]));
    actions.push("list");
    form.button(translate("ui.utilitycraft.mob_magnet.filter.remove"));
    actions.push("remove");
  }
  form.button(translate(filterButtonKey(state.filterMode)));
  actions.push("mode");

  showForm(form, player, (response) => {
    if (response.canceled || response.selection === undefined) return;
    const action = actions[response.selection];
    if (action === "add") promptAddMob(player, block);
    else if (action === "list") showFilterList(player, block);
    else if (action === "remove") promptRemoveMob(player, block);
    else if (action === "mode") {
      const nextMode = state.filterMode === "whitelist" ? "blacklist" : "whitelist";
      saveState(block, { ...state, filterMode: nextMode });
      player.onScreenDisplay.setActionBar(translate(filterSwitchedKey(nextMode)));
      reopen(() => openFilterMenu(player, block));
    }
  });
}

function promptAddMob(player, block) {
  const form = new ModalFormData()
    .title(translate("ui.utilitycraft.mob_magnet.filter.add.title"))
    .textField(
      translate("ui.utilitycraft.mob_magnet.filter.add.field"),
      translate("ui.utilitycraft.mob_magnet.filter.add.placeholder"),
    );

  showForm(form, player, (response) => {
    if (response.canceled || !response.formValues || block?.typeId !== BLOCK_ID) {
      reopen(() => openFilterMenu(player, block));
      return;
    }
    const typeId = normalizeMobId(response.formValues[0]);
    if (!typeId) {
      player.onScreenDisplay.setActionBar(translate("ui.utilitycraft.mob_magnet.filter.add.invalid"));
      reopen(() => promptAddMob(player, block));
      return;
    }

    const state = loadState(block);
    if (state.filterSet.has(typeId)) {
      player.onScreenDisplay.setActionBar(translate("ui.utilitycraft.mob_magnet.filter.add.duplicate"));
    } else {
      saveState(block, { ...state, filterList: [...state.filterList, typeId] });
      player.onScreenDisplay.setActionBar(translate(
        "ui.utilitycraft.mob_magnet.filter.add.success",
        [DoriosLib.text.formatIdentifier(typeId)],
      ));
    }
    reopen(() => openFilterMenu(player, block));
  });
}

function showFilterList(player, block) {
  const state = loadState(block);
  const form = new ActionFormData()
    .title(translate("ui.utilitycraft.mob_magnet.filter.list_title"))
    .body(translate(
      state.filterList.length > 0
        ? "ui.utilitycraft.mob_magnet.filter.list_body"
        : "ui.utilitycraft.mob_magnet.filter.list_empty",
    ));
  for (const typeId of state.filterList) form.button(DoriosLib.text.formatIdentifier(typeId));
  showForm(form, player, () => reopen(() => openFilterMenu(player, block)));
}

function promptRemoveMob(player, block) {
  const state = loadState(block);
  if (state.filterList.length === 0) {
    openFilterMenu(player, block);
    return;
  }
  const form = new ActionFormData()
    .title(translate("ui.utilitycraft.mob_magnet.filter.remove.title"))
    .body(translate("ui.utilitycraft.mob_magnet.filter.remove.body"));
  for (const typeId of state.filterList) form.button(DoriosLib.text.formatIdentifier(typeId));

  showForm(form, player, (response) => {
    if (!response.canceled && response.selection !== undefined && block?.typeId === BLOCK_ID) {
      const removed = state.filterList[response.selection];
      if (removed) {
        saveState(block, {
          ...state,
          filterList: state.filterList.filter((_, index) => index !== response.selection),
        });
        player.onScreenDisplay.setActionBar(translate(
          "ui.utilitycraft.mob_magnet.filter.remove.success",
          [DoriosLib.text.formatIdentifier(removed)],
        ));
      }
    }
    reopen(() => openFilterMenu(player, block));
  });
}

DoriosLib.registry.blockComponent(COMPONENT_ID, {
  beforeOnPlayerPlace({ block }) {
    clearState(block);
  },

  onTick({ block }) {
    processMagnet(block);
  },

  onPlayerInteract({ block, player }) {
    if (!player || player.isSneaking) return;
    if (DoriosLib.entity.getEquipment(player, "Mainhand")) return;
    if (hasFilterUpgrade(block)) openMainMenu(player, block);
    else openSettingsMenu(player, block);
  },

  onPlayerBreak({ block }) {
    clearState(block);
  },

  onBreak({ block }) {
    clearState(block);
  },
});
